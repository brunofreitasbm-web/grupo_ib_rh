import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Sincroniza profissionais PJ e funcionarios CLT da unidade "clinica-a" (Grupo IB)
// para o sistema CLINICA (tabela profiles / auth.users), na MESMA base Supabase.
// Disparado por trigger em public.professionals e public.employees.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

// O segredo do webhook vem só de variável de ambiente da função (nunca
// hardcoded — o valor anterior ficou exposto no histórico do repositório e
// precisa ser rotacionado no painel do Supabase: gerar um novo valor,
// `supabase secrets set SYNC_WEBHOOK_SECRET=<novo valor>` e atualizar o
// cabeçalho X-Webhook-Secret configurado no Database Webhook para o mesmo
// valor). A função recusa subir sem o segredo configurado, em vez de cair
// silenciosamente para um valor fixo.
const WEBHOOK_SECRET = Deno.env.get("SYNC_WEBHOOK_SECRET");
if (!WEBHOOK_SECRET) {
  throw new Error("SYNC_WEBHOOK_SECRET não configurado (supabase secrets set SYNC_WEBHOOK_SECRET=...)");
}

const CLINIC_ID = "c0000000-0000-0000-0000-000000000001";
const TARGET_UNIT_ID = "clinica-a";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Comparação em tempo constante para o segredo do webhook — comparar com
// `!==` vaza, por timing, quantos caracteres iniciais acertaram.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.length !== bufB.length) {
    // Ainda percorre um buffer de tamanho igual ao maior para não vazar o
    // comprimento por timing tão facilmente quanto um retorno imediato.
    let dummy = 0;
    const len = Math.max(bufA.length, bufB.length);
    for (let i = 0; i < len; i++) dummy |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
    return false;
  }
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

function stripAccents(s: string) {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

type Specialty = { id: string; value: string; label: string; sort_order?: number };

async function loadSpecialties(): Promise<Specialty[]> {
  const { data } = await admin
    .from("specialties")
    .select("id, value, label, sort_order")
    .eq("clinic_id", CLINIC_ID)
    .eq("active", true)
    .order("sort_order");
  return data ?? [];
}

async function matchDiscipline(professionText: string): Promise<Specialty | null> {
  const specialties = await loadSpecialties();
  if (!specialties.length) return null;
  if (!professionText) return specialties.find((s) => s.value === "outro") ?? specialties[0];

  if (GEMINI_API_KEY) {
    try {
      const prompt =
        `Você recebe a profissão/cargo de um profissional de saúde: "${professionText}".\n` +
        `Lista de especialidades já cadastradas no formato value|label: ${
          specialties.map((s) => `${s.value}|${s.label}`).join("; ")
        }.\n` +
        `Responda SOMENTE com um JSON no formato {"match": "<value existente ou null>", "new_label": "<rótulo em português se não houver equivalente na lista, senão null>"}.`;
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        },
      );
      const json = await resp.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed.match) {
          const found = specialties.find((s) => s.value === parsed.match);
          if (found) return found;
        }
        if (parsed.new_label) {
          const value = stripAccents(parsed.new_label)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
          const maxSort = Math.max(0, ...specialties.map((s) => s.sort_order ?? 0));
          const { data: created, error } = await admin
            .from("specialties")
            .insert({
              clinic_id: CLINIC_ID,
              value,
              label: parsed.new_label,
              sort_order: maxSort + 1,
              active: true,
            })
            .select("id, value, label")
            .single();
          if (!error && created) return created;
        }
      }
    } catch (err) {
      console.error("Gemini matching falhou, usando fallback por palavra-chave:", err);
    }
  }

  const normalized = stripAccents(professionText).toLowerCase();
  const found = specialties.find((s) => normalized.includes(stripAccents(s.label).toLowerCase()));
  return found ?? specialties.find((s) => s.value === "outro") ?? null;
}

function resolveRoleForEmployee(jobTitle?: string, department?: string) {
  const t = stripAccents(`${jobTitle ?? ""} ${department ?? ""}`).toLowerCase();
  if (/recep/.test(t)) return "recepcao";
  if (/financ|fatur/.test(t)) return "faturamento";
  if (/supervis/.test(t)) return "supervisor";
  if (/gerent|gestor|diretor|coordenad/.test(t)) return "gestor";
  if (/terap|psic|fono|fisiot|nutri|pedagog|musicoterap/.test(t)) return "terapeuta";
  return "recepcao";
}

// NOTA DE SEGURANÇA (não alterado nesta correção — decisão pendente, ver
// SECURITY_HARDENING_PROMPT.md item C-3): a senha inicial abaixo é
// `primeiro.ultimo123`, previsível a partir do nome (dado público dentro da
// clínica). O jeito certo de corrigir isso é gerar uma senha aleatória forte
// e convidar por e-mail (`admin.inviteUserByEmail` ou
// `admin.generateLink({ type: 'invite' })`), mas esta função não tem
// visibilidade de como o sistema CLINICA hoje comunica a senha inicial ao
// profissional/funcionário recém-sincronizado — trocar para uma senha
// totalmente aleatória sem garantir que exista um canal para entregá-la
// deixaria a conta criada, porém inacessível. Fica registrado como decisão
// que só quem opera o sistema CLINICA pode tomar com segurança.
function buildInitialPassword(fullName: string) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const first = stripAccents(parts[0] || "profissional").toLowerCase();
  const last = stripAccents(parts[parts.length - 1] || first).toLowerCase();
  return `${first}.${last}123`;
}

Deno.serve(async (req: Request) => {
  const provided = req.headers.get("X-Webhook-Secret") ?? "";
  if (!timingSafeEqual(provided, WEBHOOK_SECRET)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  try {
    const payload = await req.json();
    const { table, record } = payload as { type: string; table: string; record: Record<string, unknown> };

    if (!record || record["unit_id"] !== TARGET_UNIT_ID) {
      return new Response(JSON.stringify({ skipped: true, reason: "unit_id fora do escopo (só clinica-a)" }), { status: 200 });
    }

    const isProfessional = table === "professionals";
    const eligible = isProfessional
      ? record["registration_status"] === "validated"
      : record["status"] === "ativo";

    const { data: existing } = await admin
      .from("profiles")
      .select("id, active")
      .eq("source_system", "grupo_ib")
      .eq("source_id", record["id"] as string)
      .maybeSingle();

    if (!eligible) {
      if (existing) {
        await admin.from("profiles").update({ active: false }).eq("id", existing.id);
        return new Response(JSON.stringify({ deactivated: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ skipped: true, reason: "não elegível para sincronizar" }), { status: 200 });
    }

    const professionText = (isProfessional ? record["profession"] : record["job_title"]) as string;
    const specialty = await matchDiscipline(professionText);
    const role = isProfessional ? "terapeuta" : resolveRoleForEmployee(record["job_title"] as string, record["department"] as string);
    const commonFields = {
      clinic_id: CLINIC_ID,
      role,
      full_name: record["name"] ?? null,
      council_type: record["council_type"] ?? null,
      council_number: record["council_number"] ?? null,
      council_uf: record["council_uf"] ?? null,
      council_validity: record["council_validity"] ?? null,
      phone: record["phone"] ?? null,
      cpf: record["cpf"] ?? null,
      email: record["email"] ?? null,
      photo_url: record["photo"] ?? null,
      discipline: specialty?.value ?? null,
      specialty_id: specialty?.id ?? null,
      active: true,
    };

    if (existing) {
      await admin.from("profiles").update(commonFields).eq("id", existing.id);
      return new Response(JSON.stringify({ updated: true, profile_id: existing.id }), { status: 200 });
    }

    const email = record["email"] as string | undefined;
    if (!email) {
      return new Response(JSON.stringify({ skipped: true, reason: "sem email cadastrado" }), { status: 200 });
    }

    const password = buildInitialPassword(record["name"] as string);
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { must_change_password: true, source: "grupo_ib" },
    });

    if (userError) {
      const alreadyExists = /already been registered|already exists/i.test(userError.message ?? "");
      if (alreadyExists) {
        const { data: list } = await admin.auth.admin.listUsers();
        const found = list?.users?.find((u) => u.email === email);
        if (found) {
          await admin.from("profiles").insert({
            id: found.id,
            source_system: "grupo_ib",
            source_id: record["id"],
            must_change_password: true,
            ...commonFields,
          });
          return new Response(JSON.stringify({ linked_existing_user: true, profile_id: found.id }), { status: 200 });
        }
      }
      throw userError;
    }

    await admin.from("profiles").insert({
      id: userData.user.id,
      source_system: "grupo_ib",
      source_id: record["id"],
      must_change_password: true,
      ...commonFields,
    });

    return new Response(JSON.stringify({ created: true, profile_id: userData.user.id }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
