import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Exclusão DEFINITIVA de candidatos do Banco de Talentos: apaga o registro (e o
// currículo) no projeto Faça Amigos via delete-job-applications e, só depois,
// a camada local (meta/tokens/DISC/simulação em CASCADE), deixando um tombstone
// em talent_purged_candidates (auditoria + impede reaparecer).
//
// Ação destrutiva: exige role 'supervisor' no app_metadata (NÃO replica a
// checagem frouxa do fetch-talent-bank) e REVALIDA elegibilidade e proteções no
// servidor — o cliente só sugere.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TALENT_API_ANON_KEY = Deno.env.get("TALENT_API_ANON_KEY") ?? "";
const TALENT_API_KEY = Deno.env.get("TALENT_API_KEY") ?? "";
const TALENT_DELETE_API_URL = Deno.env.get("TALENT_DELETE_API_URL") ??
  "https://ivjvpdzsfjdpyabbzzuj.supabase.co/functions/v1/delete-job-applications";

const ARCHIVE_RETENTION_DAYS = 7;
const DISC_DEADLINE_DAYS = 10;
const MAX_IDS = 100;
const PROTECTED_STATUSES = ["ENTREVISTA", "EM_ANALISE", "CONTATADO"];
const REASONS = ["arquivado", "disc", "manual", "duplicado"];
const DAY_MS = 24 * 60 * 60 * 1000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !TALENT_API_KEY || !TALENT_API_ANON_KEY) {
    console.error("[purge-talent-candidates] configuração ausente");
    return json({ error: "CONFIG_MISSING", message: "Secrets do Banco de Talentos não configurados." }, 500);
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthorized", message: "Token não fornecido." }, 401);
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData?.user) return json({ error: "unauthorized" }, 401);
  if (userData.user.app_metadata?.role !== "supervisor") {
    return json({ error: "forbidden", message: "Somente supervisores podem excluir candidatos." }, 403);
  }
  const userId = userData.user.id;

  let body: { ids?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const reason = String(body.reason ?? "");
  if (!REASONS.includes(reason)) return json({ error: "invalid_reason" }, 400);
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map((v) => String(v).trim()).filter(Boolean))];
  if (ids.length === 0 || ids.length > MAX_IDS) {
    return json({ error: "invalid_ids", message: `Informe de 1 a ${MAX_IDS} candidatos por chamada.` }, 400);
  }

  // --- Revalidação no servidor -------------------------------------------
  const [metaRes, tokenRes, assessRes, basketRes, freeRes] = await Promise.all([
    admin.from("talent_candidates_meta").select("candidate_id, status, archived_at").in("candidate_id", ids),
    admin.from("talent_disc_tokens").select("candidate_id, sent_at, consumed_at, is_manual").in("candidate_id", ids),
    admin.from("talent_disc_assessments").select("candidate_id").in("candidate_id", ids),
    admin.from("talent_basket_assignments").select("candidate_id").in("candidate_id", ids),
    admin.from("freelancers").select("source_candidate_id").in("source_candidate_id", ids),
  ]);
  for (const r of [metaRes, tokenRes, assessRes, basketRes, freeRes]) {
    if (r.error) {
      console.error("[purge-talent-candidates] falha ao ler dados locais:", r.error);
      return json({ error: "READ_FAILED", message: r.error.message }, 500);
    }
  }
  const meta = new Map((metaRes.data ?? []).map((m) => [m.candidate_id, m]));
  const token = new Map((tokenRes.data ?? []).map((t) => [t.candidate_id, t]));
  const assessed = new Set((assessRes.data ?? []).map((a) => a.candidate_id));
  const inBasket = new Set((basketRes.data ?? []).map((b) => b.candidate_id));
  const isFreelancer = new Set((freeRes.data ?? []).map((f) => f.source_candidate_id));

  const now = Date.now();
  const eligible: string[] = [];
  const refused: { id: string; why: string }[] = [];

  for (const id of ids) {
    const m = meta.get(id);
    // Exclusão explícita do gestor ("manual"/"duplicado") não depende de prazo,
    // mas nunca apaga quem virou freelancer (vínculo contratual).
    if (isFreelancer.has(id)) { refused.push({ id, why: "convertido_em_freelancer" }); continue; }
    if (reason === "manual" || reason === "duplicado") { eligible.push(id); continue; }

    if ((m?.status && PROTECTED_STATUSES.includes(m.status)) || inBasket.has(id)) {
      refused.push({ id, why: "protegido" });
      continue;
    }
    if (reason === "arquivado") {
      const ok = m?.status === "ARQUIVADO" && m.archived_at &&
        now - new Date(m.archived_at).getTime() >= ARCHIVE_RETENTION_DAYS * DAY_MS;
      if (!ok) { refused.push({ id, why: "arquivo_nao_vencido" }); continue; }
    } else {
      const t = token.get(id);
      const ok = t && !t.is_manual && !t.consumed_at && !assessed.has(id) &&
        now - new Date(t.sent_at).getTime() >= DISC_DEADLINE_DAYS * DAY_MS;
      if (!ok) { refused.push({ id, why: "disc_nao_vencido" }); continue; }
    }
    eligible.push(id);
  }

  if (eligible.length === 0) return json({ ok: true, deleted: [], failed: [], refused });

  // --- Exclusão remota (Faça Amigos) -------------------------------------
  let remoteDeleted: string[] = [];
  const failed: { id: string; why: string }[] = [];
  try {
    const resp = await fetch(TALENT_DELETE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TALENT_API_ANON_KEY}`,
        "apikey": TALENT_API_ANON_KEY,
        "x-api-key": TALENT_API_KEY,
      },
      body: JSON.stringify({ ids: eligible }),
    });
    const text = await resp.text();
    if (!resp.ok) {
      console.error(`[purge-talent-candidates] API remota ${resp.status}: ${text}`);
      return json({ error: "UPSTREAM_ERROR", message: `Faça Amigos respondeu ${resp.status}; nada foi apagado.`, refused }, 502);
    }
    const parsed = JSON.parse(text);
    remoteDeleted = Array.isArray(parsed?.deleted) ? parsed.deleted.map(String) : [];
    for (const f of Array.isArray(parsed?.failed) ? parsed.failed : []) {
      failed.push({ id: String(f?.id ?? ""), why: String(f?.why ?? "remote_failed") });
    }
  } catch (err) {
    console.error("[purge-talent-candidates] falha ao chamar API remota:", err);
    return json({ error: "UPSTREAM_UNREACHABLE", message: "Não foi possível falar com o Faça Amigos; nada foi apagado.", refused }, 502);
  }

  // --- Camada local: tombstone/auditoria, depois apaga overlay ------------
  const done = remoteDeleted.filter((id) => eligible.includes(id));
  if (done.length > 0) {
    const { error: tombErr } = await admin.from("talent_purged_candidates").upsert(
      done.map((id) => ({ candidate_id: id, purged_by: userId, reason, remote_deleted: true })),
      { onConflict: "candidate_id" },
    );
    if (tombErr) console.error("[purge-talent-candidates] falha ao gravar tombstone:", tombErr);
    const { error: delErr } = await admin.from("talent_candidates_meta").delete().in("candidate_id", done);
    if (delErr) console.error("[purge-talent-candidates] falha ao apagar overlay:", delErr);
  }
  console.log(`[purge-talent-candidates] user=${userId} reason=${reason} deleted=${done.length} failed=${failed.length} refused=${refused.length}`);
  return json({ ok: true, deleted: done, failed, refused });
});
