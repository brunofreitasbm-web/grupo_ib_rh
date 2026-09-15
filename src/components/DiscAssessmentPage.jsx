import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ClipboardList, Clock, CheckCircle2, AlertTriangle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../supabase';
import { BRANDING } from '../config/branding';
import { DISC_GROUPS, DISC_TOTAL_GROUPS, DISC_ESTIMATED_MINUTES, computeDiscScores, validateDiscAnswers } from '../utils/disc';

// Página pública (sem autenticação) do Levantamento de Perfil Comportamental
// DISC. Acessada via link temporário enviado por e-mail pelo Banco de
// Talentos (aba administrativa) — ver send-disc-assessment (edge function) e
// CandidateActionsMenu.jsx. Rota registrada em main.jsx: /disc/:token.
//
// Fluxo: valida token (get_disc_session) → instruções → 24 grupos, um por
// vez → calcula o resultado no cliente (utils/disc.js) → grava via
// submit_disc_assessment (RPC SECURITY DEFINER) → conclusão. O candidato
// nunca vê o próprio resultado aqui — só o gestor, no Banco de Talentos.

const STEP = { LOADING: 'loading', ERROR: 'error', INTRO: 'intro', QUIZ: 'quiz', DONE: 'done' };

const ERROR_MESSAGES = {
  invalid_token: 'Este link é inválido. Verifique se copiou o endereço completo do e-mail.',
  token_expired: 'Este link expirou. Entre em contato com quem enviou o convite para receber um novo.',
  already_submitted: 'Este levantamento já foi respondido. Obrigado pela participação!',
};

export default function DiscAssessmentPage() {
  const { token } = useParams();
  const [step, setStep] = useState(STEP.LOADING);
  const [errorCode, setErrorCode] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [groupIndex, setGroupIndex] = useState(0);
  const [answers, setAnswers] = useState(() => new Array(DISC_TOTAL_GROUPS).fill(null));
  const [submitting, setSubmitting] = useState(false);
  const [startedAt, setStartedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setErrorCode('invalid_token');
        setStep(STEP.ERROR);
        return;
      }
      try {
        const { data, error } = await supabase.rpc('get_disc_session', { p_token: token });
        if (cancelled) return;
        if (error) throw error;
        setCandidateName(data?.candidate_name || '');
        setStep(STEP.INTRO);
      } catch (err) {
        if (cancelled) return;
        const message = err?.message || '';
        const code = Object.keys(ERROR_MESSAGES).find((c) => message.includes(c)) || 'invalid_token';
        setErrorCode(code);
        setStep(STEP.ERROR);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const group = DISC_GROUPS[groupIndex];
  const current = answers[groupIndex];
  const answeredCount = answers.filter(Boolean).length;
  const progressPct = Math.round((answeredCount / DISC_TOTAL_GROUPS) * 100);

  const pick = useCallback((kind, factor) => {
    setAnswers((prev) => {
      const next = [...prev];
      const entry = next[groupIndex] || {};
      if (kind === 'most' && entry.least === factor) return prev;
      if (kind === 'least' && entry.most === factor) return prev;
      next[groupIndex] = { ...entry, [kind]: factor };
      return next;
    });
  }, [groupIndex]);

  const canAdvance = current?.most && current?.least;
  const isLastGroup = groupIndex === DISC_TOTAL_GROUPS - 1;

  const goNext = () => {
    if (!canAdvance) return;
    if (isLastGroup) {
      handleSubmit();
    } else {
      setGroupIndex((i) => Math.min(i + 1, DISC_TOTAL_GROUPS - 1));
    }
  };
  const goBack = () => setGroupIndex((i) => Math.max(i - 1, 0));

  const handleSubmit = async () => {
    const formatted = answers.map((a, g) => ({ g, most: a.most, least: a.least }));
    if (!validateDiscAnswers(formatted)) {
      toastError('Responda todos os grupos antes de concluir.');
      return;
    }
    setSubmitting(true);
    try {
      const scores = computeDiscScores(formatted);
      const durationSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : null;
      const { error } = await supabase.rpc('submit_disc_assessment', {
        p_token: token,
        p_answers: formatted,
        p_scores: { adaptado: scores.adaptado, natural: scores.natural, saldo: scores.saldo },
        p_primary: scores.primary,
        p_secondary: scores.secondary,
        p_duration: durationSeconds,
      });
      if (error) throw error;
      setStep(STEP.DONE);
    } catch (err) {
      const message = err?.message || '';
      const code = Object.keys(ERROR_MESSAGES).find((c) => message.includes(c));
      if (code) {
        setErrorCode(code);
        setStep(STEP.ERROR);
      } else {
        toastError('Não foi possível enviar suas respostas. Tente novamente em instantes.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Evita depender de sonner aqui (página pública, bundle separado) — erro
  // inline é suficiente para este fluxo curto.
  const [inlineError, setInlineError] = useState('');
  function toastError(msg) {
    setInlineError(msg);
    setTimeout(() => setInlineError(''), 4000);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <h1 className="text-lg font-bold text-slate-800">{BRANDING.displayName || BRANDING.shortName}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Levantamento de Perfil Comportamental</p>
        </div>

        {step === STEP.LOADING && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin" />
            <p className="text-sm">Carregando...</p>
          </div>
        )}

        {step === STEP.ERROR && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <p className="text-sm text-slate-700">{ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.invalid_token}</p>
          </div>
        )}

        {step === STEP.INTRO && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8">
            <ClipboardList className="w-10 h-10 text-blue-600 mb-3" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              Olá{candidateName ? `, ${candidateName.split(' ')[0]}` : ''}!
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Este levantamento nos ajuda a conhecer melhor a sua forma de trabalhar. Não existe resposta certa
              ou errada — responda com sinceridade, pensando em como você costuma agir no dia a dia.
            </p>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold">Tempo médio: {DISC_ESTIMATED_MINUTES} minutos</p>
                <p className="text-xs mt-1">
                  São {DISC_TOTAL_GROUPS} grupos de 4 palavras. Em cada grupo, escolha a palavra que <strong>MAIS</strong> e
                  a que <strong>MENOS</strong> combina com você.
                </p>
              </div>
            </div>
            <ul className="text-xs text-slate-500 list-disc pl-5 space-y-1 mb-6">
              <li>Responda de uma só vez, em um local tranquilo.</li>
              <li>Não há necessidade de pensar muito em cada grupo — vá pela primeira impressão.</li>
              <li>Suas respostas serão usadas apenas pela equipe de seleção.</li>
            </ul>
            <button
              type="button"
              onClick={() => { setStartedAt(Date.now()); setStep(STEP.QUIZ); }}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Começar
            </button>
          </div>
        )}

        {step === STEP.QUIZ && group && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span>Grupo {groupIndex + 1} de {DISC_TOTAL_GROUPS}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full mb-6 overflow-hidden">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${progressPct}%` }} />
            </div>

            <p className="text-sm text-slate-600 mb-4">Marque a que <strong>MAIS</strong> e a que <strong>MENOS</strong> combina com você:</p>

            <div className="space-y-2 mb-2">
              {group.options.map((opt) => (
                <div
                  key={opt.word}
                  className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3"
                >
                  <span className="text-sm font-medium text-slate-800">{opt.word}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => pick('most', opt.factor)}
                      disabled={current?.least === opt.factor}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                        current?.most === opt.factor
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-500 border-slate-300 hover:border-emerald-400'
                      }`}
                    >
                      MAIS
                    </button>
                    <button
                      type="button"
                      onClick={() => pick('least', opt.factor)}
                      disabled={current?.most === opt.factor}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                        current?.least === opt.factor
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white text-slate-500 border-slate-300 hover:border-rose-400'
                      }`}
                    >
                      MENOS
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {inlineError && (
              <p className="text-xs text-rose-600 mt-2">{inlineError}</p>
            )}

            <div className="flex items-center justify-between mt-6">
              <button
                type="button"
                onClick={goBack}
                disabled={groupIndex === 0}
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-slate-500 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" /> Voltar
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!canAdvance || submitting}
                className="flex items-center gap-1 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isLastGroup ? 'Concluir' : (
                  <>Próximo <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>
        )}

        {step === STEP.DONE && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-800 mb-2">Obrigado!</h2>
            <p className="text-sm text-slate-600">
              Suas respostas foram enviadas com sucesso. A equipe de seleção entrará em contato caso avance nas próximas etapas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
