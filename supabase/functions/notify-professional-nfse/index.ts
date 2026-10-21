import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Dispara o aviso de "Apuração de Produção disponível — emita sua NF" com o
// template visual oficial FaçaAmigos (Grupo IB), contendo o valor apurado e o
// link público seguro com token para upload direto da NFSe.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const APP_PUBLIC_URL = (Deno.env.get("APP_PUBLIC_URL") ?? Deno.env.get("PORTAL_URL") ?? "").replace(/\/+$/, "");
const BREVO_REPLY_TO = Deno.env.get("BREVO_REPLY_TO") ?? "institutofacaamigos@gmail.com";

function parseSender() {
  const raw = Deno.env.get("BREVO_FROM") ?? "";
  const match = raw.match(/^(.*)<(.+)>$/);
  if (match) {
    return { email: match[2].trim(), name: match[1].trim().replace(/^"|"$/g, "") || "FaçaAmigos Gestão de Pessoas" };
  }
  if (raw.trim()) {
    return { email: raw.trim(), name: Deno.env.get("BREVO_SENDER_NAME") ?? "FaçaAmigos Gestão de Pessoas" };
  }
  return {
    email: Deno.env.get("BREVO_SENDER_EMAIL") ?? "institutofacaamigos@gmail.com",
    name: Deno.env.get("BREVO_SENDER_NAME") ?? "FaçaAmigos Gestão de Pessoas",
  };
}

const SENDER = parseSender();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function competenciaLabel(competencia: string) {
  const [year, month] = competencia.split("-");
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  const idx = Number(month) - 1;
  return idx >= 0 && idx < 12 ? `${months[idx]}/${year}` : competencia;
}

function fmtBRL(val: number) {
  return (Number(val) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escapeHtml(value: string) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(digest);
}

function buildFacaAmigosEmail(params: {
  professionalName: string;
  competencia: string;
  calculatedAmount: number;
  uploadLink: string;
  unitName?: string;
}) {
  const { professionalName, competencia, calculatedAmount, uploadLink, unitName } = params;
  const label = competenciaLabel(competencia);
  const firstName = escapeHtml(professionalName.split(/\s+/)[0] || "Prestador(a)");
  const company = "FaçaAmigos";
  const logoUrl = APP_PUBLIC_URL ? `${APP_PUBLIC_URL}/brand/facaamigos-email-logo.png` : "";
  const formattedValor = fmtBRL(calculatedAmount);

  const subject = `Apuração de Produção disponível (${label}) — FaçaAmigos`;

  const htmlContent = `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f1ea;font-family:'Nunito',Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f1ea;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">
            <!-- Faixa amarela de destaque FaçaAmigos -->
            <tr>
              <td style="background-color:#FFE234;height:8px;font-size:0;line-height:0;border-radius:8px 8px 0 0;">&nbsp;</td>
            </tr>
            <!-- Card Principal -->
            <tr>
              <td style="background-color:#ffffff;border-radius:0 0 24px 24px;padding:36px 32px 28px;box-shadow:0 4px 20px rgba(26,63,53,0.08);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="padding-bottom:24px;">
                      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${company}" width="200" style="display:block;max-width:200px;height:auto;" />` : `<span style="font-family:'Fredoka One',Arial,Helvetica,sans-serif;font-size:24px;color:#1A3F35;font-weight:bold;">${company}</span>`}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-family:'Fredoka One',Arial,Helvetica,sans-serif;font-size:22px;color:#F0196B;text-align:center;padding-bottom:14px;">
                      Olá, ${firstName}!
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#1A3F35;font-size:15px;line-height:1.6;padding-bottom:16px;">
                      Informamos que a sua apuração de produção referente à competência <strong>${escapeHtml(label)}</strong>${unitName ? ` (${escapeHtml(unitName)})` : ''} já foi consolidada.
                    </td>
                  </tr>

                  <!-- Box de Destaque com o Valor da Produção -->
                  <tr>
                    <td style="background-color:#f0fdf4;border:2px dashed #0d9488;border-radius:16px;padding:20px;text-align:center;margin-bottom:24px;">
                      <div style="font-size:13px;color:#0f766e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:6px;">
                        Valor Apurado da Produção
                      </div>
                      <div style="font-size:28px;font-weight:800;color:#115e59;font-family:Arial,Helvetica,sans-serif;">
                        ${formattedValor}
                      </div>
                      <div style="font-size:12px;color:#64748b;padding-top:6px;">
                        Competência de referência: <strong>${escapeHtml(label)}</strong>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="color:#1A3F35;font-size:14px;line-height:1.6;padding-top:20px;padding-bottom:24px;">
                      Por favor, emita a sua Nota Fiscal de Serviços Eletrônica (NFSe) correspondente. Para agilizar o processo de validação e o repasse financeiro, clique no botão seguro abaixo para fazer o upload do documento:
                    </td>
                  </tr>

                  <!-- Botão de Ação CTA FaçaAmigos -->
                  <tr>
                    <td align="center" style="padding-bottom:28px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center" style="border-radius:50px;background-color:#F0196B;">
                            <a href="${escapeHtml(uploadLink)}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:'Fredoka One',Arial,Helvetica,sans-serif;font-size:16px;color:#ffffff;text-decoration:none;font-weight:bold;letter-spacing:0.3px;">
                              Enviar Nota Fiscal (NFSe) &rarr;
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="background-color:#f8fafc;border-radius:12px;padding:16px;font-size:12px;color:#64748b;line-height:1.5;padding-bottom:16px;">
                      <strong>Dica:</strong> Na página de upload, você poderá conferir e ajustar o valor da nota e o mês de apuração, caso haja alguma dedução ou retenção específica da sua PJ.
                    </td>
                  </tr>

                  <tr>
                    <td style="color:#64748b;font-size:12px;line-height:1.5;padding-top:16px;">
                      Após o envio, a nota será conferida pelo Administrador do RH e, uma vez aprovada, seguirá diretamente para a liquidação e pagamento pelo Financeiro.
                    </td>
                  </tr>

                  <tr>
                    <td style="color:#1A3F35;font-size:13px;line-height:1.6;padding-top:20px;border-top:1px solid #e2e8f0;">
                      Atenciosamente,<br />
                      <strong>Gestão de Pessoas & RH • ${company}</strong>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  return { subject, htmlContent };
}

async function sendBrevoEmail(to: { email: string; name?: string }[], subject: string, htmlContent: string) {
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
      ...(BREVO_REPLY_TO ? { replyTo: { email: BREVO_REPLY_TO } } : {}),
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Brevo respondeu ${resp.status}: ${errText}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  if (!BREVO_API_KEY || !SENDER.email) {
    return jsonResponse({ error: "BREVO_CONFIG_MISSING" }, 503);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "SUPABASE_CONFIG_MISSING" }, 500);
  }

  let body: {
    competencia?: string;
    professionalIds?: string[];
    items?: { professionalId: string; calculatedAmount?: number }[];
  };

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const competencia = body.competencia;
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
    return jsonResponse({ error: "invalid_competencia" }, 400);
  }

  // Permite receber lista de items com amount ou lista simples de IDs
  const itemsMap = new Map<string, number>();
  if (Array.isArray(body.items)) {
    body.items.forEach((item) => {
      if (item.professionalId) itemsMap.set(item.professionalId, Number(item.calculatedAmount) || 0);
    });
  } else if (Array.isArray(body.professionalIds)) {
    body.professionalIds.forEach((id) => {
      if (id) itemsMap.set(id, 0);
    });
  }

  const professionalIds = Array.from(itemsMap.keys());
  if (professionalIds.length === 0) {
    return jsonResponse({ error: "no_professional_ids" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: professionals, error: fetchError } = await admin
    .from("professionals")
    .select("id, name, email, rep_email, unit_id")
    .in("id", professionalIds);

  if (fetchError) {
    return jsonResponse({ error: "QUERY_FAILED", message: fetchError.message }, 500);
  }

  // Busca nomes das unidades para o e-mail
  const unitIds = Array.from(new Set((professionals ?? []).map((p) => p.unit_id).filter(Boolean)));
  const { data: unitsData } = await admin.from("units").select("id, name").in("id", unitIds);
  const unitNameById = new Map((unitsData ?? []).map((u) => [u.id, u.name]));

  const byId = new Map((professionals ?? []).map((p) => [p.id, p]));
  const results: { professionalId: string; status: string; message?: string }[] = [];

  for (const professionalId of professionalIds) {
    const professional = byId.get(professionalId);
    if (!professional) {
      results.push({ professionalId, status: "erro", message: "Prestador não encontrado." });
      continue;
    }

    const recipients = [professional.email, professional.rep_email]
      .filter((e): e is string => Boolean(e && e.trim()))
      .filter((e, idx, arr) => arr.indexOf(e) === idx)
      .map((email) => ({ email, name: professional.name || undefined }));

    if (recipients.length === 0) {
      results.push({ professionalId, status: "sem_email", message: "Prestador sem e-mail cadastrado." });
      continue;
    }

    const calculatedAmount = itemsMap.get(professionalId) || 0;

    try {
      // 1. Gera token seguro aleatório
      const rawTokenBytes = new Uint8Array(32);
      crypto.getRandomValues(rawTokenBytes);
      const rawToken = toHex(rawTokenBytes);
      const tokenHashBytes = await sha256Bytes(rawToken);

      // Validade: 15 dias para envio da NF
      const expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

      // Grava token no banco
      const { error: tokenError } = await admin.from("professional_invoice_tokens").insert({
        professional_id: professionalId,
        token_hash: "\\x" + toHex(tokenHashBytes),
        competencia,
        calculated_amount: calculatedAmount,
        expires_at: expiresAt,
      });

      if (tokenError) {
        console.error(`[notify-professional-nfse] Erro ao gravar token para ${professionalId}:`, tokenError);
      }

      // 2. Monta o link público com o token
      const uploadLink = APP_PUBLIC_URL ? `${APP_PUBLIC_URL}/pj/nf/${rawToken}` : `https://rh.grupoib.com.br/pj/nf/${rawToken}`;
      const unitName = unitNameById.get(professional.unit_id) || "";

      // 3. Monta e envia o e-mail FaçaAmigos
      const { subject, htmlContent } = buildFacaAmigosEmail({
        professionalName: professional.name || "Prestador",
        competencia,
        calculatedAmount,
        uploadLink,
        unitName,
      });

      await sendBrevoEmail(recipients, subject, htmlContent);

      // 4. Registra aviso em professional_documents
      await admin.from("professional_documents").upsert({
        professional_id: professionalId,
        doc_key: `aviso-nf-${competencia}`,
        content: "",
        meta: {
          type: "aviso_nf",
          competencia,
          calculatedAmount,
          sentAt: new Date().toISOString(),
          sentTo: recipients.map((r) => r.email),
          status: "enviado",
        },
      });

      results.push({ professionalId, status: "enviado" });
    } catch (err) {
      console.error(`[notify-professional-nfse] Erro ao processar prestador ${professionalId}:`, err);
      results.push({ professionalId, status: "erro", message: err instanceof Error ? err.message : String(err) });
    }
  }

  return jsonResponse({ results });
});
