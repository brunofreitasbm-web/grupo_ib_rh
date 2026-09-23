import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  APP_PUBLIC_URL,
  BREVO_API_KEY,
  EMAIL_RE,
  SENDER,
  sendCandidateDiscInvite,
} from "../_shared/disc-invite.ts";

// Envio AUTOMÁTICO do Levantamento de Perfil DISC.
//
// Chamada servidor-a-servidor: o trigger trg_fa_job_application_disc do projeto
// Faça Amigos (repo faca_amigos) faz net.http_post aqui a cada candidatura nova
// em fa_kiosk_job_applications. Não há gestor logado — a autenticação é o
// header x-webhook-secret, comparado com a secret DISC_AUTO_WEBHOOK_SECRET ou,
// sem ela, com o segredo 'disc_auto_webhook_secret' do Vault deste projeto
// (lido pela RPC talent_disc_auto_webhook_secret, só service_role).
// Deploy com --no-verify-jwt (o chamador não tem JWT deste projeto).
//
// Idempotente por candidate_id: se já existe link enviado (manual ou
// automático), não reenvia — reenvio continua sendo decisão do gestor pelo
// botão do Banco de Talentos (send-disc-assessment).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ENV_WEBHOOK_SECRET = Deno.env.get("DISC_AUTO_WEBHOOK_SECRET") ?? "";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function loadWebhookSecret(admin: SupabaseClient) {
  if (ENV_WEBHOOK_SECRET) return ENV_WEBHOOK_SECRET;
  const { data, error } = await admin.rpc("talent_disc_auto_webhook_secret");
  if (error) {
    console.error("[auto-send-disc-assessment] Falha ao ler segredo do Vault:", error);
    return "";
  }
  return typeof data === "string" ? data : "";
}

async function secretMatches(provided: string, expected: string) {
  // Compara os hashes para não vazar o tamanho/prefixo do segredo por tempo de resposta.
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(provided)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[auto-send-disc-assessment] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
    return jsonResponse({ error: "SUPABASE_CONFIG_MISSING" }, 500);
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Falha fechado: sem segredo configurado, ninguém dispara e-mail por aqui.
  const webhookSecret = await loadWebhookSecret(admin);
  if (!webhookSecret) {
    console.error("[auto-send-disc-assessment] Segredo do webhook não configurado (env ou Vault)");
    return jsonResponse({ error: "WEBHOOK_NOT_CONFIGURED" }, 503);
  }
  if (!(await secretMatches(req.headers.get("x-webhook-secret") ?? "", webhookSecret))) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  if (!BREVO_API_KEY || !SENDER.email) {
    console.error("[auto-send-disc-assessment] BREVO_API_KEY / BREVO_FROM não configurados");
    return jsonResponse({ error: "BREVO_CONFIG_MISSING" }, 503);
  }
  if (!APP_PUBLIC_URL) {
    console.error("[auto-send-disc-assessment] APP_PUBLIC_URL / PORTAL_URL não configurados");
    return jsonResponse({ error: "APP_PUBLIC_URL_MISSING" }, 503);
  }

  let body: { candidateId?: string; fullName?: string; email?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const candidateId = String(body.candidateId ?? "").trim();
  const fullName = String(body.fullName ?? "").trim() || "Candidato";
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = body.phone ? String(body.phone).trim() : null;

  if (!candidateId || candidateId.length > 200) {
    return jsonResponse({ error: "invalid_candidate" }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return jsonResponse({ error: "invalid_email" }, 400);
  }

  try {
    const { data: existingToken, error: tokenReadError } = await admin
      .from("talent_disc_tokens")
      .select("candidate_id")
      .eq("candidate_id", candidateId)
      .maybeSingle();
    if (tokenReadError) throw tokenReadError;
    if (existingToken) {
      return jsonResponse({ ok: true, skipped: "already_sent" });
    }

    const { expiresAt } = await sendCandidateDiscInvite(admin, {
      candidateId,
      fullName,
      email,
      phone,
      sentBy: null,
    });

    console.log(`[auto-send-disc-assessment] Levantamento enviado automaticamente para candidato ${candidateId}`);
    return jsonResponse({ ok: true, sentTo: email, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    console.error(`[auto-send-disc-assessment] Falha ao enviar para candidato ${candidateId}:`, err);
    const message = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
    return jsonResponse({ error: "SEND_FAILED", message }, 500);
  }
});
