import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Proxy de leitura para o Banco de Talentos do app Faça Amigos (módulo
// gerencial, projeto Supabase separado: ivjvpdzsfjdpyabbzzuj). O front-end
// deste sistema nunca vê a TALENT_API_KEY nem a anon key do outro projeto —
// só esta função, que roda no servidor, tem acesso a elas.
//
// Chamada pelo front-end autenticado (supabase.functions.invoke), repassando
// o JWT da sessão no header Authorization. Só contas com papel 'supervisor'
// (mesmo critério de Usuários do Sistema) podem consultar.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TALENT_API_URL = Deno.env.get("TALENT_API_URL") ??
  "https://ivjvpdzsfjdpyabbzzuj.supabase.co/functions/v1/export-job-applications";
const TALENT_API_ANON_KEY = Deno.env.get("TALENT_API_ANON_KEY");
const TALENT_API_KEY = Deno.env.get("TALENT_API_KEY");

if (!TALENT_API_ANON_KEY || !TALENT_API_KEY) {
  throw new Error(
    "TALENT_API_ANON_KEY / TALENT_API_KEY não configuradas (supabase secrets set TALENT_API_ANON_KEY=... TALENT_API_KEY=...)",
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Precisa cobrir todo header que o supabase-js manda por padrão (authorization,
// x-client-info, apikey, content-type, x-retry-count) — faltando um deles, o
// preflight do navegador falha e o fetch nem chega a sair (erro genérico
// "Failed to send a request to the Edge Function", sem detalhe do motivo).
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
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    const role = userData?.user?.app_metadata?.role;
    if (userError || !userData?.user || role !== "supervisor") {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const reqUrl = new URL(req.url);
    const status = reqUrl.searchParams.get("status");
    const limit = reqUrl.searchParams.get("limit");

    const upstream = new URL(TALENT_API_URL);
    if (status && ALLOWED_STATUS.includes(status)) upstream.searchParams.set("status", status);
    upstream.searchParams.set("limit", String(Math.min(Math.max(Number(limit) || 50, 1), 200)));

    const resp = await fetch(upstream.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${TALENT_API_ANON_KEY}`,
        "x-api-key": TALENT_API_KEY,
      },
    });

    const body = await resp.text();
    return new Response(body, {
      status: resp.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
