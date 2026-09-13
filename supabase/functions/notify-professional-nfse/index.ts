import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Dispara o aviso de "apuração de produção disponível, emita sua NF" para
// prestadores PJ. Reaproveita a tabela professional_documents (mesma usada
// pelo upload/aprovação de NFSe em NfseUploadModal / DocumentosProfissionaisTab)
// para registrar o envio como doc_key `aviso-nf-<competencia>` — dá
// idempotência de graça via upsert e evita criar tabela/migração nova.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const PORTAL_URL = Deno.env.get("PORTAL_URL") ?? "";

// Remetente: aceita BREVO_FROM já configurado no projeto (formato
// "Nome <email>" ou apenas "email"), com fallback para variáveis
// separadas caso existam.
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

function buildEmail(professionalName: string, competencia: string) {
  const label = competenciaLabel(competencia);
  const portalLine = PORTAL_URL
    ? `Acesse o portal do prestador em ${PORTAL_URL}, faça login com suas credenciais e utilize a opção "Enviar NFSe".`
    : `Acesse o portal do prestador com suas credenciais habituais e utilize a opção "Enviar NFSe".`;

  const subject = `Apuração de Produção disponível — competência ${label}`;
  const htmlContent = `
    <p>Olá, ${professionalName},</p>
    <p>A apuração de produção referente à competência <strong>${label}</strong> já está disponível.</p>
    <p>Solicitamos que emita a Nota Fiscal de Serviço correspondente e faça o upload no sistema, informando os dados cadastrais (número da nota e valor).</p>
    <p>${portalLine}</p>
    <p>Após o envio, a nota será conferida pelo supervisor de gestão de RH e, uma vez aprovada, seguirá para o pagamento.</p>
    <p>Atenciosamente,<br/>${SENDER.name}</p>
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
    console.error("[notify-professional-nfse] BREVO_API_KEY / BREVO_FROM (ou BREVO_SENDER_EMAIL) não configurados");
    return jsonResponse({ error: "BREVO_CONFIG_MISSING" }, 503);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[notify-professional-nfse] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
    return jsonResponse({ error: "SUPABASE_CONFIG_MISSING" }, 500);
  }

  let body: { competencia?: string; professionalIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const competencia = body.competencia;
  const professionalIds = Array.isArray(body.professionalIds) ? body.professionalIds.filter(Boolean) : [];

  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
    return jsonResponse({ error: "invalid_competencia" }, 400);
  }
  if (professionalIds.length === 0) {
    return jsonResponse({ error: "no_professional_ids" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: professionals, error: fetchError } = await admin
    .from("professionals")
    .select("id, name, email, rep_email")
    .in("id", professionalIds);

  if (fetchError) {
    console.error("[notify-professional-nfse] Erro ao buscar prestadores:", fetchError);
    return jsonResponse({ error: "QUERY_FAILED", message: fetchError.message }, 500);
  }

  const byId = new Map((professionals ?? []).map((p) => [p.id, p]));
  const docKey = `aviso-nf-${competencia}`;
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

    try {
      const { subject, htmlContent } = buildEmail(professional.name || "Prestador", competencia);
      await sendBrevoEmail(recipients, subject, htmlContent);

      const { error: upsertError } = await admin.from("professional_documents").upsert({
        professional_id: professionalId,
        doc_key: docKey,
        content: "",
        meta: {
          type: "aviso_nf",
          competencia,
          sentAt: new Date().toISOString(),
          sentTo: recipients.map((r) => r.email),
          status: "enviado",
        },
      });

      if (upsertError) throw upsertError;

      results.push({ professionalId, status: "enviado" });
    } catch (err) {
      console.error(`[notify-professional-nfse] Erro ao notificar prestador ${professionalId}:`, err);
      results.push({ professionalId, status: "erro", message: err instanceof Error ? err.message : String(err) });
    }
  }

  return jsonResponse({ results });
});
