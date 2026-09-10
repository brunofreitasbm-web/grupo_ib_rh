import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Publica para o sistema externo APENAS a contagem de estagiários validados
// por curso. Nenhum dado pessoal — só {curso: quantidade}.
//
//  1) PUSH — Database Webhook de public.interns dispara aqui; a função lê o
//     agregado atualizado e repassa para INTERN_STATS_SYNC_URL.
//  2) PULL — { "action": "list" } devolve o snapshot atual.
//
// Use esta função quando o outro sistema está em OUTRO projeto Supabase.
// Se estiver na mesma base, prefira Realtime em public.intern_course_stats.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("INTERN_STATS_WEBHOOK_SECRET")!;
const SYNC_URL = Deno.env.get("INTERN_STATS_SYNC_URL");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function snapshot(unitId?: string | null) {
  const { data, error } = await admin.rpc("get_intern_course_counts", {
    p_unit_id: unitId ?? null,
  });
  if (error) throw error;
  const rows = data ?? [];
  return {
    unit_id: unitId ?? "__all__",
    generated_at: new Date().toISOString(),
    total: rows.reduce((sum: number, r: { total: number }) => sum + r.total, 0),
    // { "psicologia": 10, "musicoterapia": 10, "educacao-fisica": 10 }
    counts: Object.fromEntries(
      rows.map((r: { course_slug: string; total: number }) => [r.course_slug, r.total]),
    ),
    courses: rows,
  };
}

Deno.serve(async (req: Request) => {
  if (req.headers.get("X-Webhook-Secret") !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const stats = await snapshot(payload?.unit_id ?? null);

    if (payload?.action === "list") {
      return new Response(JSON.stringify(stats), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!SYNC_URL) {
      return new Response(JSON.stringify({ ok: true, forwarded: false, reason: "INTERN_STATS_SYNC_URL não configurada", stats }), { status: 200 });
    }

    const resp = await fetch(SYNC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": WEBHOOK_SECRET },
      body: JSON.stringify({ event: "intern_course_stats.updated", ...stats }),
    });

    return new Response(JSON.stringify({ ok: true, forwarded: true, status: resp.status }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
