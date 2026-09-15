import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

// Cruza e-mails de quem já foi contratado (estagiário/PJ/CLT) com o
// Levantamento de Perfil DISC que a pessoa já tenha respondido QUANDO ERA
// CANDIDATA no Banco de Talentos (talent_candidates_meta +
// talent_disc_assessments) — para não pedir o questionário de novo.
//
// Retorna { [emailLowerCase]: { candidateId, assessment } } só para quem tem
// um match com resultado já concluído.
export function useCandidateDiscByEmail(emails) {
  const [byEmail, setByEmail] = useState({});
  const emailsKey = (emails || []).filter(Boolean).map((e) => String(e).toLowerCase()).join(',');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = emailsKey ? emailsKey.split(',') : [];
      if (list.length === 0) {
        setByEmail({});
        return;
      }
      try {
        // snapshot é jsonb sem índice dedicado — poucos registros no Banco de
        // Talentos, então filtra no cliente em vez de depender de um índice.
        const { data: metas, error } = await supabase.from('talent_candidates_meta').select('candidate_id, snapshot');
        if (error) throw error;
        const matching = (metas || []).filter((m) => list.includes(String(m.snapshot?.email || '').toLowerCase()));
        if (matching.length === 0) {
          if (!cancelled) setByEmail({});
          return;
        }
        const ids = matching.map((m) => m.candidate_id);
        const { data: assessments, error: aErr } = await supabase
          .from('talent_disc_assessments')
          .select('*')
          .in('candidate_id', ids);
        if (aErr) throw aErr;
        const assessmentByCandidateId = Object.fromEntries((assessments || []).map((a) => [a.candidate_id, a]));

        const map = {};
        for (const m of matching) {
          const assessment = assessmentByCandidateId[m.candidate_id];
          if (!assessment) continue;
          const email = String(m.snapshot?.email || '').toLowerCase();
          if (email) map[email] = { candidateId: m.candidate_id, assessment };
        }
        if (!cancelled) setByEmail(map);
      } catch (err) {
        console.error('Erro ao cruzar DISC de candidatos por e-mail:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [emailsKey]);

  return byEmail;
}
