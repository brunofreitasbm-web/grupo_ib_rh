import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// "Enviar Levantamento de Perfil" para quem JÁ FOI CONTRATADO (estagiário,
// profissional PJ ou funcionário CLT) — usado pela Simulação por Unidade do
// Banco de Talentos para desenhar os quadradinhos fixos da equipe atual.
//
// Mesmo padrão de send-disc-assessment (candidatos do Banco de Talentos),
// mas o sujeito é (subjectType, subjectId) apontando para uma linha já
// existente em interns/professionals/employees — não há overlay/snapshot
// aqui, porque a pessoa já é uma linha nossa.
//
// Só o hash SHA-256 do token é persistido; o token em texto puro existe
// apenas no link do e-mail. A validação/consumo acontece nas RPCs
// get_disc_session e submit_disc_assessment (migração
// 20260916130000_staff_roles_and_disc.sql), chamadas pela mesma página
// pública /disc/:token do fluxo de candidatos.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const APP_PUBLIC_URL = (Deno.env.get("APP_PUBLIC_URL") ?? Deno.env.get("PORTAL_URL") ?? "").replace(/\/+$/, "");
const TOKEN_TTL_DAYS = 7;

const SUBJECT_TABLES: Record<string, string> = {
  intern: "interns",
  professional: "professionals",
  employee: "employees",
};

// Mesmo parser de remetente de send-disc-assessment / notify-professional-nfse.
function parseSender() {
  const raw = Deno.env.get("BREVO_FROM") ?? "";
  const match = raw.match(/^(.*)<(.+)>$/);
  if (match) {
    return { email: match[2].trim(), name: match[1].trim().replace(/^"|"$/g, "") || "RH" };
  }
  if (raw.trim()) {
    return { email: raw.trim(), name: Deno.env.get("BREVO_SENDER_NAME") ?? "RH" };
  }
  return {
    email: Deno.env.get("BREVO_SENDER_EMAIL") ?? "",
    name: Deno.env.get("BREVO_SENDER_NAME") ?? "RH",
  };
}

const SENDER = parseSender();

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

function buildEmail(staffName: string, link: string, expiresAt: Date) {
  const firstName = escapeHtml(staffName.split(/\s+/)[0] || "colega");
  const safeLink = escapeHtml(link);
  const company = escapeHtml(SENDER.name);
  const logoUrl = APP_PUBLIC_URL ? escapeHtml(`${APP_PUBLIC_URL}/brand/facaamigos-email-logo.png`) : "";
  const expiresLabel = expiresAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const subject = `Levantamento de Perfil Comportamental — ${SENDER.name}`;
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f1ea;font-family:'Nunito',Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f1ea;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
            <tr>
              <td style="background-color:#FFE234;height:6px;font-size:0;line-height:0;border-radius:6px 6px 0 0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="background-color:#ffffff;border-radius:0 0 24px 24px;padding:32px 32px 24px;box-shadow:0 4px 16px rgba(26,63,53,0.08);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="padding-bottom:20px;">
                      ${logoUrl ? `<img src="${logoUrl}" alt="${company}" width="220" style="display:block;max-width:220px;height:auto;" />` : `<span style="font-family:'Fredoka One',Arial,Helvetica,sans-serif;font-size:22px;color:#1A3F35;">${company}</span>`}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-family:'Fredoka One',Arial,Helvetica,sans-serif;font-size:24px;color:#F0196B;text-align:center;padding-bottom:16px;">
                      Olá, ${firstName}!
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#1A3F35;font-size:15px;line-height:1.6;padding-bottom:12px;">
                      A equipe de gestão de <strong>${company}</strong> te convida a responder um breve
                      <strong>Levantamento de Perfil Comportamental (DISC)</strong>.
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#1A3F35;font-size:15px;line-height:1.6;padding-bottom:16px;">
                      Ele nos ajuda a entender melhor a sua forma de trabalhar, para apoiar decisões de equipe.
                      Não existe resposta certa ou errada — responda pensando em como você costuma agir no dia a dia.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom:20px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f1ea;border-radius:16px;">
                        <tr>
                          <td style="padding:16px 20px;color:#1A3F35;font-size:14px;line-height:1.7;">
                            ⏱️ <strong>Tempo médio:</strong> cerca de 10 minutos<br/>
                            📝 24 grupos de palavras: escolha a que <strong>mais</strong> e a que <strong>menos</strong> combina com você<br/>
                            🌿 Responda de uma só vez, em um local tranquilo
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom:20px;">
                      <a href="${safeLink}" style="background-color:#F0196B;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:9999px;font-family:'Nunito',Arial,Helvetica,sans-serif;font-weight:800;font-size:15px;display:inline-block;">
                        Responder levantamento
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#6b7a75;line-height:1.6;padding-bottom:8px;">
                      Se o botão não funcionar, copie e cole este endereço no navegador:<br/>
                      <span style="word-break:break-all;color:#2ECFB5;">${safeLink}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#6b7a75;line-height:1.6;">
                      O link é pessoal, pode ser usado uma única vez e é válido até <strong>${expiresLabel}</strong>.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 12px 0;font-family:'Nunito',Arial,Helvetica,sans-serif;font-size:12px;color:#9aa5a1;">
                Atenciosamente,<br/>
                <strong style="color:#1A3F35;">${company}</strong>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;

  const textContent =
    `Olá, ${staffName}!\n\n` +
    `Te convidamos a responder o Levantamento de Perfil Comportamental (DISC) — cerca de 10 minutos.\n\n` +
    `Acesse: ${link}\n\n` +
    `O link é pessoal, de uso único e válido até ${expiresLabel}.\n\n${SENDER.name}`;

  return { subject, htmlContent, textContent };
}

async function sendBrevoEmail(
  to: { email: string; name?: string }[],
  subject: string,
  htmlContent: string,
  textContent: string,
) {
  const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      sender: { email: SENDER.email, name: SENDER.name },
      to,
      subject,
      htmlContent,
      textContent,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Brevo respondeu ${resp.status}: ${errText}`);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[send-staff-disc-assessment] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
    return jsonResponse({ error: "SUPABASE_CONFIG_MISSING", message: "Configuração do Supabase ausente na Edge Function." }, 500);
  }
  if (!BREVO_API_KEY || !SENDER.email) {
    console.error("[send-staff-disc-assessment] BREVO_API_KEY / BREVO_FROM não configurados");
    return jsonResponse({
      error: "BREVO_CONFIG_MISSING",
      message: "Envio de e-mail não configurado (BREVO_API_KEY / BREVO_FROM).",
    }, 503);
  }
  if (!APP_PUBLIC_URL) {
    console.error("[send-staff-disc-assessment] APP_PUBLIC_URL / PORTAL_URL não configurados");
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
    console.warn(`[send-staff-disc-assessment] Acesso recusado para ${user?.email ?? "anônimo"}`);
    return jsonResponse({ error: "forbidden", message: "Acesso reservado a gestores do sistema." }, 403);
  }

  let body: { subjectType?: string; subjectId?: string; fullName?: string; email?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const subjectType = String(body.subjectType ?? "");
  const subjectId = String(body.subjectId ?? "").trim();
  const fullName = String(body.fullName ?? "").trim() || "Colaborador(a)";
  const email = String(body.email ?? "").trim().toLowerCase();

  const table = SUBJECT_TABLES[subjectType];
  if (!table) {
    return jsonResponse({ error: "invalid_subject_type", message: "Tipo de colaborador inválido." }, 400);
  }
  if (!UUID_RE.test(subjectId)) {
    return jsonResponse({ error: "invalid_subject", message: "Colaborador inválido." }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return jsonResponse({ error: "invalid_email", message: "Colaborador sem e-mail válido." }, 400);
  }

  try {
    // Confirma que a pessoa existe na tabela informada antes de gerar o link.
    const { data: subjectRow, error: subjectError } = await admin
      .from(table)
      .select("id, name")
      .eq("id", subjectId)
      .maybeSingle();
    if (subjectError) throw subjectError;
    if (!subjectRow) {
      return jsonResponse({ error: "invalid_subject", message: "Colaborador não encontrado." }, 404);
    }

    const token = toHex(crypto.getRandomValues(new Uint8Array(24)));
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    // Envia o e-mail antes de gravar o token: se o Brevo falhar, um link
    // anterior ainda válido não é invalidado à toa.
    const link = `${APP_PUBLIC_URL}/disc/${token}`;
    const { subject, htmlContent, textContent } = buildEmail(fullName, link, expiresAt);
    await sendBrevoEmail([{ email, name: fullName }], subject, htmlContent, textContent);

    // Token (reenvio substitui o anterior e libera nova resposta) — chave
    // única é (subject_type, subject_id).
    const { error: tokenError } = await admin.from("staff_disc_tokens").upsert(
      {
        subject_type: subjectType,
        subject_id: subjectId,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        sent_at: new Date().toISOString(),
        sent_to: email,
        attempts: 0,
        consumed_at: null,
        first_opened_at: null,
      },
      { onConflict: "subject_type,subject_id" },
    );
    if (tokenError) throw tokenError;

    console.log(`[send-staff-disc-assessment] Levantamento enviado para ${subjectType} ${subjectId} por ${user.email}`);
    return jsonResponse({ ok: true, sentTo: email, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    console.error(`[send-staff-disc-assessment] Falha ao enviar para ${subjectType} ${subjectId}:`, err);
    const message = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
    return jsonResponse({ error: "SEND_FAILED", message: `Não foi possível enviar o levantamento: ${message}` }, 500);
  }
});
