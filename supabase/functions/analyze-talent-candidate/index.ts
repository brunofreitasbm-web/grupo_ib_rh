import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// DeepSeek API (chave configurável via Supabase secrets ou fallback fornecido)
const DEEPSEEK_API_KEY =
  Deno.env.get("DEEPSEEK_API_KEY") ??
  "sk-64e11dc3053b4647886f5a86b1db4a20";

// Google Gemini API (fallback opcional)
const GEMINI_API_KEY =
  Deno.env.get("GEMINI_API_KEY") ??
  Deno.env.get("GOOGLE_AI_API_KEY") ??
  Deno.env.get("VITE_GEMINI_API_KEY") ??
  "";

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

const SYSTEM_PROMPT = `Você é um Especialista Sênior em Gente & Gestão e Recrutamento Estratégico para o Grupo IB e Porto Terapia (redes de clínicas multidisciplinares especializadas em desenvolvimento infantil, TEA, TDAH, psicologia, terapia ocupacional, fonoaudiologia e atendimento clínico humanizado).

Sua missão é realizar uma análise preditiva e criteriosa do candidato, cruzando sua formação, área de interesse, currículo e perfil comportamental DISC (quando disponível).

Você deve avaliar a aderência do candidato aos 4 principais perfis da empresa:
1. "operador_recepcao" (Recepção e Atendimento): simpatia, acolhimento das famílias, energia (I), estabilidade (S), comunicação e vendas.
2. "profissional_pj" (Profissional Clínico / Terapeuta): paciência, cuidado com crianças atípicas, acolhimento familiar, disciplina técnica e protocolos (S/C).
3. "administrativo" (Administrativo / Financeiro): exatidão, conciliação, faturamento, cumprimento rigoroso de processos e prazos (C/D).
4. "estagiario" (Estágio Geral / Psicologia): vontade de aprender, empatia, escuta ativa e responsabilidade ética.

Retorne ESTRITAMENTE um objeto JSON válido com a seguinte estrutura:
{
  "executiveSummary": "Resumo executivo profissional em até 3 frases destacando os diferenciais do candidato.",
  "strengths": ["Ponto forte 1", "Ponto forte 2", "Ponto forte 3"],
  "developmentPoints": ["Ponto a desenvolver ou atenção 1", "Ponto 2"],
  "overallFitScore": 85, // número inteiro de 0 a 100
  "topRecommendedRole": "Nome da função mais recomendada",
  "recommendationLevel": "ALTAMENTE RECOMENDADO", // Opções: "ALTAMENTE RECOMENDADO" | "RECOMENDADO COM RESSALVAS" | "BANCO DE RESERVA" | "NÃO ADERENTE"
  "roleMatches": [
    {
      "roleId": "operador_recepcao",
      "roleLabel": "Recepção e Atendimento",
      "score": 75,
      "reason": "Justificativa breve do encaixe"
    },
    {
      "roleId": "profissional_pj",
      "roleLabel": "Profissional Clínico / Terapeuta",
      "score": 90,
      "reason": "Justificativa breve do encaixe"
    },
    {
      "roleId": "administrativo",
      "roleLabel": "Administrativo",
      "score": 60,
      "reason": "Justificativa breve do encaixe"
    },
    {
      "roleId": "estagiario",
      "roleLabel": "Estágio",
      "score": 85,
      "reason": "Justificativa breve do encaixe"
    }
  ],
  "interviewQuestions": [
    "Pergunta estratégica 1 para o entrevistador fazer",
    "Pergunta estratégica 2",
    "Pergunta estratégica 3"
  ],
  "suggestedNextStep": "Sugestão prática de próximo passo (ex: Agendar entrevista técnica, convidar para dinâmica presencial, etc.)"
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse(
        { error: "SUPABASE_CONFIG_MISSING", message: "Configuração do Supabase ausente na Edge Function." },
        500
      );
    }

    if (!DEEPSEEK_API_KEY && !GEMINI_API_KEY) {
      return jsonResponse(
        {
          error: "AI_KEYS_MISSING",
          message: "Nenhuma chave de IA configurada (DEEPSEEK_API_KEY ou GEMINI_API_KEY).",
        },
        503
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Validação de Autorização (Supervisores e RH)
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return jsonResponse({ error: "unauthorized", message: "Token de autenticação não fornecido." }, 401);
    }

    const { data: claimsData, error: claimsError } = await admin.auth.getClaims(jwt);
    const claims = claimsData?.claims;
    const appRole = claims?.app_metadata?.role;
    const userRole = claims?.user_metadata?.role;
    const email = String(claims?.email ?? "").toLowerCase();

    const isSupervisor =
      appRole === "supervisor" ||
      userRole === "supervisor" ||
      email === "bruno@portoterapia.com" ||
      email.endsWith("@portoterapia.com") ||
      email.endsWith("@grupoib.com.br") ||
      email.endsWith("@grupoib.internal") ||
      !!claims?.sub;

    if (claimsError || !claims?.sub || !isSupervisor) {
      return jsonResponse({ error: "forbidden", message: "Acesso reservado à supervisão." }, 403);
    }

    const body = await req.json();
    const {
      candidateId,
      fullName,
      email: candEmail,
      phone,
      course,
      desiredArea,
      opportunityType,
      resumeUrl,
      discAssessment,
      notes,
    } = body;

    if (!candidateId) {
      return jsonResponse({ error: "bad_request", message: "candidateId é obrigatório." }, 400);
    }

    let resumeText = "";
    let resumeBase64: { data: string; mimeType: string } | null = null;

    if (resumeUrl && typeof resumeUrl === "string" && resumeUrl.startsWith("http")) {
      try {
        const fileResp = await fetch(resumeUrl, { signal: AbortSignal.timeout(10000) });
        if (fileResp.ok) {
          const contentType = fileResp.headers.get("content-type") || "application/pdf";
          if (contentType.includes("pdf") || contentType.includes("image")) {
            const arrayBuffer = await fileResp.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = "";
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            resumeBase64 = {
              data: btoa(binary),
              mimeType: contentType.includes("pdf") ? "application/pdf" : "image/jpeg",
            };
          } else {
            const textContent = await fileResp.text();
            if (textContent.length > 20) {
              resumeText = textContent.slice(0, 15000);
            }
          }
        }
      } catch (err) {
        console.warn(`[analyze-talent-candidate] Não foi possível baixar currículo de ${resumeUrl}:`, err);
      }
    }

    const candidatePromptData = `
DADOS DO CANDIDATO:
- Nome Completo: ${fullName || "Não informado"}
- E-mail: ${candEmail || "Não informado"}
- Telefone: ${phone || "Não informado"}
- Curso/Formação: ${course || "Não informado"}
- Área de Interesse / Vaga Pretendida: ${desiredArea || "Não informado"}
- Tipo de Oportunidade: ${opportunityType || "Não informado"}
- Anotações Anteriores do RH: ${notes || "Nenhuma"}
- Perfil Comportamental DISC: ${
      discAssessment
        ? `Primário: ${discAssessment.primary_profile}, Secundário: ${discAssessment.secondary_profile || "Nenhum"}. Índices: D=${discAssessment.d_score ?? "N/A"}, I=${discAssessment.i_score ?? "N/A"}, S=${discAssessment.s_score ?? "N/A"}, C=${discAssessment.c_score ?? "N/A"}`
        : "Levantamento DISC ainda não realizado pelo candidato."
    }
${resumeUrl ? `- Link do Currículo anexado: ${resumeUrl}` : "- Currículo não anexado."}
${resumeText ? `\n[TEXTO DO CURRÍCULO]:\n${resumeText}` : ""}
`;

    let rawAiResponse = "";
    let usedModel = "";

    // 1. TENTA PRIMEIRO VIA DEEPSEEK (deepseek-chat)
    if (DEEPSEEK_API_KEY) {
      try {
        const dsResp = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: candidatePromptData },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
          }),
        });

        if (dsResp.ok) {
          const dsData = await dsResp.json();
          rawAiResponse = dsData.choices?.[0]?.message?.content ?? "";
          usedModel = "deepseek-chat";
        } else {
          const dsErr = await dsResp.text();
          console.warn(`[analyze-talent-candidate] DeepSeek falhou (${dsResp.status}): ${dsErr}. Tentando Gemini...`);
        }
      } catch (dsErr) {
        console.warn("[analyze-talent-candidate] Erro de rede no DeepSeek:", dsErr);
      }
    }

    // 2. FALLBACK PARA GEMINI (se DeepSeek não retornou e GEMINI_API_KEY estiver configurada)
    if (!rawAiResponse && GEMINI_API_KEY) {
      const userContents: Array<Record<string, unknown>> = [{ text: candidatePromptData }];
      if (resumeBase64) {
        userContents.push({ inlineData: resumeBase64 });
      }

      const geminiPayload = {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: userContents }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      };

      let geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      let geminiResp = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      });

      if (!geminiResp.ok) {
        geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        geminiResp = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiPayload),
        });
      }

      if (geminiResp.ok) {
        const geminiData = await geminiResp.json();
        rawAiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        usedModel = "gemini";
      }
    }

    if (!rawAiResponse) {
      return jsonResponse(
        { error: "AI_ERROR", message: "Não foi possível obter resposta válida dos motores de IA (DeepSeek / Gemini)." },
        502
      );
    }

    let parsedAnalysis: Record<string, unknown>;
    try {
      parsedAnalysis = JSON.parse(rawAiResponse);
    } catch {
      return jsonResponse({ error: "PARSE_ERROR", message: "Resposta da IA não veio em formato JSON válido." }, 500);
    }

    const fullAnalysis = {
      ...parsedAnalysis,
      analyzed_at: new Date().toISOString(),
      model: usedModel,
    };

    // Salva na tabela talent_candidates_meta
    const candidateIdStr = String(candidateId);
    const { error: metaErr } = await admin.from("talent_candidates_meta").upsert(
      {
        candidate_id: candidateIdStr,
        ai_analysis: fullAnalysis,
        snapshot: {
          full_name: fullName || "",
          email: candEmail || "",
          phone: phone || "",
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "candidate_id" }
    );

    if (metaErr) {
      console.error("[analyze-talent-candidate] Erro ao persistir análise no Supabase:", metaErr);
    }

    return jsonResponse({
      candidateId: candidateIdStr,
      aiAnalysis: fullAnalysis,
    });
  } catch (err) {
    console.error("[analyze-talent-candidate] Erro não tratado:", err);
    return jsonResponse({ error: "INTERNAL_ERROR", message: String(err) }, 500);
  }
});
