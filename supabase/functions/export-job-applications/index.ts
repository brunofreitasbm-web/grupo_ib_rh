import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Contraparte de leitura para o proxy `fetch-talent-bank` do outro projeto
// (controle-de-estagiario). Autenticação em duas camadas: o gateway do
// Supabase já exige um JWT válido (anon key) no Authorization por causa de
// verify_jwt, e aqui em cima ainda validamos x-api-key contra TALENT_API_KEY
// — o mesmo secret configurado nos dois projetos — para garantir que só o
// proxy autorizado (e não qualquer portador da anon key pública) acesse
// os dados de candidatos.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TALENT_API_KEY = Deno.env.get("TALENT_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const ALLOWED_STATUS = ["NOVO", "LIDO", "ESPERA", "ENTREVISTA", "EM_ANALISE", "CONTATADO", "ARQUIVADO"];
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hora

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  if (!TALENT_API_KEY) {
    console.error("[export-job-applications] TALENT_API_KEY não configurado — recusando por padrão seguro");
    return jsonResponse({ error: "TALENT_API_KEY_MISSING" }, 503);
  }

  const providedKey = req.headers.get("x-api-key");
  if (providedKey !== TALENT_API_KEY) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[export-job-applications] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
    return jsonResponse({ error: "SUPABASE_CONFIG_MISSING" }, 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const reqUrl = new URL(req.url);
  const status = reqUrl.searchParams.get("status");
  const limit = Math.min(Math.max(Number(reqUrl.searchParams.get("limit")) || 50, 1), 200);

  let query = admin
    .from("fa_kiosk_job_applications")
    .select("id, full_name, email, phone, course, desired_area, opportunity_type, resume_path, status, created_at_ms")
    .order("created_at_ms", { ascending: false })
    .limit(limit);

  if (status && ALLOWED_STATUS.includes(status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[export-job-applications] Erro ao consultar candidaturas:", error);
    return jsonResponse({ error: "QUERY_FAILED", message: error.message }, 500);
  }

  const rows = data ?? [];
  const paths = rows.map((r) => r.resume_path).filter(Boolean);

  let signedUrlByPath: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: signedUrls, error: signError } = await admin.storage
      .from("curriculos")
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

    if (signError) {
      console.error("[export-job-applications] Erro ao gerar URLs assinadas:", signError);
    } else {
      signedUrlByPath = Object.fromEntries(
        (signedUrls ?? [])
          .filter((s) => s.signedUrl && !s.error)
          .map((s) => [s.path, s.signedUrl])
      );
    }
  }

  const candidates = rows.map((r) => ({
    ...r,
    resume_url: r.resume_path ? signedUrlByPath[r.resume_path] ?? null : null,
  }));

  return jsonResponse({ candidates });
});
