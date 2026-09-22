// Envio do link do Levantamento de Perfil DISC para um candidato do Banco de
// Talentos. Usado por send-disc-assessment (gestor clica "Enviar") e por
// auto-send-disc-assessment (webhook disparado a cada candidatura nova no
// projeto Faça Amigos) — a mesma geração de token, overlay e e-mail nos dois.
//
// Só o hash SHA-256 do token é persistido; o token em texto puro existe apenas
// no link do e-mail. A validação/consumo acontece nas RPCs get_disc_session e
// submit_disc_assessment, chamadas pela página pública /disc/:token.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
export const APP_PUBLIC_URL = (Deno.env.get("APP_PUBLIC_URL") ?? Deno.env.get("PORTAL_URL") ?? "").replace(/\/+$/, "");
const TOKEN_TTL_DAYS = 7;

// Mesmo parser de remetente de notify-professional-nfse.
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

export const SENDER = parseSender();

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

function buildEmail(candidateName: string, link: string, expiresAt: Date) {
  const firstName = escapeHtml(candidateName.split(/\s+/)[0] || "candidato(a)");
  const safeLink = escapeHtml(link);
  const company = escapeHtml(SENDER.name);
  // Logo fixo da Faça Amigos (não o /logo.jpg genérico, que muda conforme o
  // workspace/deploy que chama esta função — este e-mail é sempre da marca
  // Faça Amigos, então não pode depender de qual site disparou o envio).
  const logoUrl = APP_PUBLIC_URL ? escapeHtml(`${APP_PUBLIC_URL}/brand/facaamigos-email-logo.png`) : "";
  const expiresLabel = expiresAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  // Cores da marca Faça Amigos: rosa #F0196B (CTA), verde escuro #1A3F35 (texto de
  // destaque), amarelo #FFE234 (faixa de detalhe). Layout em tabela para compatibilidade
  // com clientes de e-mail (Outlook não renderiza flex/grid nem @import de fontes).
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
            <!-- Faixa amarela de detalhe -->
            <tr>
              <td style="background-color:#FFE234;height:6px;font-size:0;line-height:0;border-radius:6px 6px 0 0;">&nbsp;</td>
            </tr>
            <!-- Cartão branco -->
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
                      Obrigado pelo seu interesse em fazer parte da equipe <strong>${company}</strong>!
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#1A3F35;font-size:15px;line-height:1.6;padding-bottom:16px;">
                      Como próxima etapa, te convidamos a responder um breve <strong>Levantamento de Perfil Comportamental (DISC)</strong>.
                      Ele nos ajuda a te conhecer melhor — não existe resposta certa ou errada, é só ser você mesmo(a).
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
            <!-- Rodapé -->
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
    `Olá, ${candidateName}!\n\n` +
    `Convidamos você a responder o Levantamento de Perfil Comportamental (DISC) — cerca de 10 minutos.\n\n` +
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

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CandidateDiscInvite {
  candidateId: string;
  fullName: string;
  email: string;
  phone: string | null;
  /** auth.users.id do gestor que enviou; null no envio automático. */
  sentBy: string | null;
}

export async function sendCandidateDiscInvite(
  admin: SupabaseClient,
  { candidateId, fullName, email, phone, sentBy }: CandidateDiscInvite,
) {
  const token = toHex(crypto.getRandomValues(new Uint8Array(24)));
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  // 1. Overlay do candidato (sem sobrescrever status/notas existentes).
  const { data: existingMeta, error: metaReadError } = await admin
    .from("talent_candidates_meta")
    .select("candidate_id")
    .eq("candidate_id", candidateId)
    .maybeSingle();
  if (metaReadError) throw metaReadError;

  const snapshot = { full_name: fullName, email, phone };
  if (existingMeta) {
    const { error } = await admin
      .from("talent_candidates_meta")
      .update({
        snapshot,
        updated_at: new Date().toISOString(),
        // Envio automático (sem gestor) não apaga quem editou por último.
        ...(sentBy ? { updated_by: sentBy } : {}),
      })
      .eq("candidate_id", candidateId);
    if (error) throw error;
  } else {
    const { error } = await admin
      .from("talent_candidates_meta")
      .insert({ candidate_id: candidateId, snapshot, updated_by: sentBy });
    if (error) throw error;
  }

  // 2. Envia o e-mail antes de gravar o token: se o Brevo falhar, um link
  //    anterior ainda válido não é invalidado à toa.
  const link = `${APP_PUBLIC_URL}/disc/${token}`;
  const { subject, htmlContent, textContent } = buildEmail(fullName, link, expiresAt);
  await sendBrevoEmail([{ email, name: fullName }], subject, htmlContent, textContent);

  // 3. Token (reenvio substitui o anterior e libera nova resposta).
  const { error: tokenError } = await admin.from("talent_disc_tokens").upsert({
    candidate_id: candidateId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    sent_at: new Date().toISOString(),
    sent_to: email,
    attempts: 0,
    consumed_at: null,
  });
  if (tokenError) throw tokenError;

  return { sentTo: email, expiresAt };
}
