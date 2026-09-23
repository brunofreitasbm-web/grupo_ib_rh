import React, { useState } from 'react';
import { Send, Loader2, Sparkles, History } from 'lucide-react';
import { supabase } from '../../supabase';
import { toast } from 'sonner';
import { DISC_PROFILE_INFO, discProfileCode } from '../../utils/disc';
import DiscResultModal from './DiscResultModal';

import { BRANDING } from '../../config/branding';

// Célula reutilizável para as abas de Estagiários / Profissionais PJ /
// Funcionários CLT: mostra o resultado do DISC (se já respondido), um botão
// "Enviar Levantamento de Perfil Comportamental" (edge function
// send-staff-disc-assessment), ou — quando a pessoa já respondeu o mesmo
// levantamento QUANDO ERA CANDIDATA no Banco de Talentos (candidateMatch,
// cruzado por e-mail via useCandidateDiscByEmail) — um botão para aproveitar
// esse resultado em vez de pedir de novo (RPC import_candidate_disc_to_staff).
// Mesma ideia de CandidateActionsMenu, mas sem menu — aqui cada aba já usa
// botões de ícone inline nas linhas/cards.
export default function StaffDiscCell({ subjectType, subjectId, name, email, phone, token, assessment, candidateMatch, onSent }) {
  if (BRANDING.showStaffDiscAssessment === false) {
    return null;
  }

  const [busy, setBusy] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const send = async () => {
    if (!email) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-staff-disc-assessment', {
        body: { subjectType, subjectId, fullName: name, email, phone },
      });
      if (error) throw error;
      toast.success(`Levantamento de Perfil Comportamental enviado para ${data?.sentTo || email}.`);
      onSent?.();
    } catch (err) {
      console.error('Erro ao enviar Levantamento de Perfil Comportamental:', err);
      let detailMsg = '';
      try {
        const res = err?.context;
        const cloned = res && typeof res.clone === 'function' ? res.clone() : res;
        const body = cloned ? await cloned.json() : null;
        detailMsg = body?.message || '';
      } catch (_) {}
      toast.error(detailMsg || 'Não foi possível enviar o Levantamento de Perfil Comportamental.');
    } finally {
      setBusy(false);
    }
  };

  const importFromCandidate = async () => {
    if (!candidateMatch) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('import_candidate_disc_to_staff', {
        p_subject_type: subjectType,
        p_subject_id: subjectId,
        p_candidate_id: candidateMatch.candidateId,
      });
      if (error) throw error;
      toast.success(`Perfil DISC já respondido na seleção aproveitado para ${name}.`);
      onSent?.();
    } catch (err) {
      console.error('Erro ao aproveitar DISC da seleção:', err);
      toast.error('Não foi possível aproveitar o perfil respondido na seleção.');
    } finally {
      setBusy(false);
    }
  };

  if (assessment) {
    const info = DISC_PROFILE_INFO[assessment.primary_profile];
    return (
      <>
        <button
          type="button"
          onClick={() => setShowResult(true)}
          className={`inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded border ${info.badge} hover:opacity-80`}
          title={`${info.label}${assessment.secondary_profile ? ' / ' + DISC_PROFILE_INFO[assessment.secondary_profile].label : ''} — clique para ver o resultado completo`}
        >
          {discProfileCode(assessment.primary_profile, assessment.secondary_profile)}
        </button>
        {showResult && (
          <DiscResultModal
            candidate={{ full_name: name }}
            assessment={assessment}
            onClose={() => setShowResult(false)}
          />
        )}
      </>
    );
  }

  // Já respondeu quando era candidato(a) no Banco de Talentos — aproveita em
  // vez de reenviar o questionário.
  if (candidateMatch) {
    return (
      <button
        type="button"
        onClick={importFromCandidate}
        disabled={busy}
        title={`Já respondeu o Levantamento de Perfil na seleção — clique para aproveitar o resultado (perfil ${candidateMatch.assessment.primary_profile})`}
        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <History size={13} />}
      </button>
    );
  }

  const pending = token && !token.consumed_at;

  return (
    <button
      type="button"
      onClick={send}
      disabled={!email || busy}
      title={!email ? 'Sem e-mail cadastrado' : pending ? 'Reenviar Levantamento de Perfil Comportamental' : 'Enviar Levantamento de Perfil Comportamental'}
      className={`p-1.5 rounded-lg transition-colors border border-transparent disabled:opacity-30 disabled:cursor-not-allowed ${
        pending ? 'text-amber-600 hover:bg-amber-50 hover:border-amber-200' : 'text-slate-500 hover:bg-slate-100 hover:border-slate-200'
      }`}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : pending ? <Sparkles size={13} /> : <Send size={13} />}
    </button>
  );
}
