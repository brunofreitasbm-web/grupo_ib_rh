import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  APP_PUBLIC_URL,
  BREVO_API_KEY,
  EMAIL_RE,
  SENDER,
  sendCandidateDiscInvite,
} from "../_shared/disc-invite.ts";

// "Enviar Levantamento de Perfil" do Banco de Talentos.
//
// Gera um link temporário (7 dias, uso único) para o questionário DISC e envia
// por e-mail (Brevo) ao candidato. O candidato vem do projeto Faça Amigos, que é
// somente leitura para nós — por isso o front envia nome/e-mail/telefone e
// gravamos um snapshot em talent_candidates_meta (migração
// 20260915_talent_bank_overlay_disc). Token + e-mail: ../_shared/disc-invite.ts.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[send-disc-assessment] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
    return jsonResponse({ error: "SUPABASE_CONFIG_MISSING", message: "Configuração do Supabase ausente na Edge Function." }, 500);
  }
  if (!BREVO_API_KEY || !SENDER.email) {
    console.error("[send-disc-assessment] BREVO_API_KEY / BREVO_FROM não configurados");
    return jsonResponse({
      error: "BREVO_CONFIG_MISSING",
      message: "Envio de e-mail não configurado (BREVO_API_KEY / BREVO_FROM).",
    }, 503);
  }
  if (!APP_PUBLIC_URL) {
    console.error("[send-disc-assessment] APP_PUBLIC_URL / PORTAL_URL não configurados");
    return jsonResponse({
      error: "APP_PUBLIC_URL_MISSING",
      message: "Defina a secret APP_PUBLIC_URL com o endereço público do sistema (ex.: https://rh.grupoib.com.br).",
    }, 503);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Autenticação: gestor logado, nunca um usuário de quiosque (*_unit).
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return jsonResponse({ error: "unauthorized", message: "Token de autenticação não fornecido." }, 401);
  }
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  const user = userData?.user;
  const appRole = user?.app_metadata?.role;
  const userRole = user?.user_metadata?.role;
  const isKiosk = userRole?.endsWith?.("_unit") || appRole?.endsWith?.("_unit");
  if (userError || !user || isKiosk) {
    console.warn(`[send-disc-assessment] Acesso recusado para ${user?.email ?? "anônimo"}`);
    return jsonResponse({ error: "forbidden", message: "Acesso reservado a gestores do sistema." }, 403);
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
    return jsonResponse({ error: "invalid_candidate", message: "Candidato inválido." }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return jsonResponse({ error: "invalid_email", message: "Candidato sem e-mail válido." }, 400);
  }

  try {
    const { expiresAt } = await sendCandidateDiscInvite(admin, {
      candidateId,
      fullName,
      email,
      phone,
      sentBy: user.id,
    });

    console.log(`[send-disc-assessment] Levantamento enviado para candidato ${candidateId} por ${user.email}`);
    return jsonResponse({ ok: true, sentTo: email, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    console.error(`[send-disc-assessment] Falha ao enviar para candidato ${candidateId}:`, err);
    const message = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
    return jsonResponse({ error: "SEND_FAILED", message: `Não foi possível enviar o levantamento: ${message}` }, 500);
  }
});
