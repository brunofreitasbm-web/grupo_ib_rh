import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Ponte entre o Controle de Estagiário/PJ e o sistema externo de terapeutas.
//
// Dois modos, ambos protegidos pelo header X-Webhook-Secret:
//
//  1) PUSH  — chamado pelo Database Webhook de public.professionals.
//     Filtra a unidade 'clinica-a' (Faça Amigos), monta o payload mínimo
//     (nome, profissão, registro de classe) e repassa para THERAPIST_SYNC_URL.
//
//  2) PULL  — { "action": "list", "since": "2026-09-01T00:00:00Z" }
//     Devolve o diretório completo (ou o delta) para carga inicial e
//     reconciliação. É o mesmo payload do push, em lote.
//
// Nunca trafegam CPF, CNPJ, dados bancários, endereço ou representante legal.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("THERAPIST_WEBHOOK_SECRET")!;
const THERAPIST_SYNC_URL = Deno.env.get("THERAPIST_SYNC_URL");
const TARGET_UNIT_ID = Deno.env.get("THERAPIST_UNIT_ID") ?? "clinica-a";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function stripAccents(s: string) {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Espelha public.profession_slug / src/config/professions.js. */
function professionSlug(profession?: string | null) {
  const base = stripAccents(profession ?? "").replace(/\((a|o|as|os)\)/gi, "");
  return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
    "nao-informado";
}

function councilLabel(type?: string | null, num?: string | null, uf?: string | null) {
  const parts = [
    (type ?? "").trim().toUpperCase(),
    (uf ?? "").trim() ? `-${(uf ?? "").trim().toUpperCase()}` : "",
    (num ?? "").trim() ? ` ${(num ?? "").trim()}` : "",
  ];
  return parts.join("").trim() || null;
}

type Record_ = Record<string, unknown>;

function toTherapist(r: Record_) {
  return {
    source_system: "controle_pj",
    source_id: r["id"],
    unit_id: r["unit_id"],
    name: r["name"],
    profession: r["profession"] ?? null,
    profession_slug: professionSlug(r["profession"] as string),
    council_type: r["council_type"] ?? null,
    council_number: r["council_number"] ?? null,
    council_uf: r["council_uf"] ?? null,
    council_validity: r["council_validity"] ?? null,
    council_label: councilLabel(
      r["council_type"] as string,
      r["council_number"] as string,
      r["council_uf"] as string,
    ),
    specialties: r["specialties"] ?? null,
    email: r["email"] ?? null,
    phone: r["phone"] ?? null,
    active: r["active"] === true && r["registration_status"] === "validated",
    updated_at: r["updated_at"] ?? new Date().toISOString(),
  };
}

async function forward(body: unknown) {
  if (!THERAPIST_SYNC_URL) return { forwarded: false, reason: "THERAPIST_SYNC_URL não configurada" };
  const resp = await fetch(THERAPIST_SYNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Secret": WEBHOOK_SECRET,
    },
    body: JSON.stringify(body),
  });
  return { forwarded: true, status: resp.status };
}

Deno.serve(async (req: Request) => {
  if (req.headers.get("X-Webhook-Secret") !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  try {
    const payload = await req.json();

    // --- Modo PULL: snapshot / delta -------------------------------------
    if (payload?.action === "list") {
      const { data, error } = await admin.rpc("get_therapist_directory", {
        p_unit_id: payload.unit_id ?? TARGET_UNIT_ID,
        p_since: payload.since ?? null,
        p_include_inactive: payload.include_inactive ?? true,
      });
      if (error) throw error;
      return new Response(
        JSON.stringify({
          unit_id: payload.unit_id ?? TARGET_UNIT_ID,
          generated_at: new Date().toISOString(),
          therapists: (data ?? []).map(toTherapist),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // --- Modo PUSH: Database Webhook de public.professionals --------------
    const { table, type, record } = payload as
      { type: string; table: string; record: Record_ };

    if (table !== "professionals" || !record) {
      return new Response(JSON.stringify({ skipped: true, reason: "tabela fora do escopo" }), { status: 200 });
    }
    if (record["unit_id"] !== TARGET_UNIT_ID) {
      return new Response(JSON.stringify({ skipped: true, reason: `unit_id fora do escopo (só ${TARGET_UNIT_ID})` }), { status: 200 });
    }
    if (record["registration_status"] !== "validated") {
      return new Response(JSON.stringify({ skipped: true, reason: "cadastro ainda não validado pelo RH" }), { status: 200 });
    }

    const result = await forward({
      event: type === "INSERT" ? "therapist.created" : "therapist.updated",
      therapist: toTherapist(record),
    });

    return new Response(JSON.stringify({ ok: true, ...result }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
