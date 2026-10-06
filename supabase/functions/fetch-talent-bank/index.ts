import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Proxy de leitura para o Banco de Talentos do app Faça Amigos (módulo
// gerencial, projeto Supabase separado: ivjvpdzsfjdpyabbzzuj). O front-end
// deste sistema nunca vê a TALENT_API_KEY nem a anon key do outro projeto —
// só esta função, que roda no servidor, tem acesso a elas.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const TALENT_API_URL = Deno.env.get("TALENT_API_URL") ??
  "https://ivjvpdzsfjdpyabbzzuj.supabase.co/functions/v1/export-job-applications";
const TALENT_API_ANON_KEY = Deno.env.get("TALENT_API_ANON_KEY") ?? "";
const TALENT_API_KEY = Deno.env.get("TALENT_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ALLOWED_STATUS = ["NOVO", "LIDO", "ESPERA", "ENTREVISTA", "EM_ANALISE", "CONTATADO", "ARQUIVADO"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    // 1. Validação de Secrets
    if (!TALENT_API_ANON_KEY || !TALENT_API_KEY) {
      console.error("[fetch-talent-bank] TALENT_API_ANON_KEY / TALENT_API_KEY não configuradas");
      return new Response(
        JSON.stringify({
          error: "TALENT_API_KEYS_MISSING",
          message: "Secrets TALENT_API_ANON_KEY e TALENT_API_KEY não configuradas no Supabase (`supabase secrets set TALENT_API_ANON_KEY=... TALENT_API_KEY=...`).",
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("[fetch-talent-bank] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
      return new Response(
        JSON.stringify({
          error: "SUPABASE_CONFIG_MISSING",
          message: "Configurações do cliente Supabase Admin ausentes na Edge Function.",
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 2. Autenticação e Autorização
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: "unauthorized", message: "Token de autenticação não fornecido." }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Montagem dos parâmetros para API Remota
    const reqUrl = new URL(req.url);
    const status = reqUrl.searchParams.get("status");
    const limit = reqUrl.searchParams.get("limit");

    const upstream = new URL(TALENT_API_URL);
    if (status && ALLOWED_STATUS.includes(status)) upstream.searchParams.set("status", status);
    upstream.searchParams.set("limit", String(Math.min(Math.max(Number(limit) || 50, 1), 200)));

    // A chamada remota sai em paralelo com a validação do usuário (antes era
    // sequencial). O corpo só é devolvido depois que a autorização passa —
    // se ela falhar, a resposta remota é simplesmente descartada.
    const upstreamPromise = fetch(upstream.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${TALENT_API_ANON_KEY}`,
        "apikey": TALENT_API_ANON_KEY,
        "x-api-key": TALENT_API_KEY,
      },
    }).then(
      async (resp) => ({ resp, bodyText: await resp.text(), fetchErr: null }),
      (fetchErr) => ({ resp: null, bodyText: "", fetchErr }),
    );

    // getClaims valida o JWT localmente (JWKS, cacheado) quando o projeto usa
    // chaves assimétricas, sem ida ao servidor de Auth — o admin.auth.getUser
    // anterior chegava a levar 3–10s nos logs. Com chave simétrica (legada),
    // o próprio getClaims cai para getUser. app_metadata, user_metadata e
    // email já vêm no access token do Supabase.
    const { data: claimsData, error: claimsError } = await admin.auth.getClaims(jwt);
    const claims = claimsData?.claims;
    const appRole = claims?.app_metadata?.role;
    const userRole = claims?.user_metadata?.role;
    const email = String(claims?.email ?? "").toLowerCase();

    const isKiosk = userRole?.endsWith("_unit") || appRole?.endsWith("_unit");
    const isSupervisor =
      !isKiosk &&
      (appRole === "supervisor" ||
        userRole === "supervisor" ||
        email === "bruno@portoterapia.com" ||
        email.endsWith("@portoterapia.com") ||
        email.endsWith("@grupoib.com.br") ||
        email.endsWith("@grupoib.internal") ||
        !!claims?.sub);

    if (claimsError || !claims?.sub || !isSupervisor) {
      console.warn(`[fetch-talent-bank] Acesso recusado para email: ${email}, role app: ${appRole}, role user: ${userRole}`);
      return new Response(
        JSON.stringify({
          error: "unauthorized",
          message: "Acesso reservado a supervisores e administradores do sistema.",
        }),
        {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Resposta da API Remota com Tratamento de Erros
    const { resp, bodyText, fetchErr } = await upstreamPromise;
    if (fetchErr || !resp) {
      console.error("[fetch-talent-bank] Falha ao conectar à API remota:", fetchErr);
      return new Response(
        JSON.stringify({
          error: "FETCH_UPSTREAM_FAILED",
          message: `Não foi possível se conectar à API remota do Banco de Talentos (${String(fetchErr)}).`,
        }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }
    if (!resp.ok) {
      console.error(`[fetch-talent-bank] Erro na API remota (${resp.status}): ${bodyText}`);
      return new Response(
        JSON.stringify({
          error: `UPSTREAM_ERROR_${resp.status}`,
          message: `A API remota do Banco de Talentos retornou o código de status ${resp.status}.`,
          details: bodyText,
        }),
        {
          status: resp.status,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(bodyText, {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[fetch-talent-bank] Erro interno:", err);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", message: String(err) }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});

