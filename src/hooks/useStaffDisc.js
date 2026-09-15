import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../supabase';

// Overlay de DISC para quem já foi contratado (staff_disc_tokens /
// staff_disc_assessments), indexado por subject_id, para um subjectType
// fixo ('intern' | 'professional' | 'employee'). Usado pelas abas de
// Estagiários / Profissionais PJ / Funcionários CLT e pela Simulação por
// Unidade (que consome os três de uma vez).
export function useStaffDiscOverlay(subjectType, ids) {
  const [tokensById, setTokensById] = useState({});
  const [assessmentsById, setAssessmentsById] = useState({});
  const [loading, setLoading] = useState(false);

  const idsKey = (ids || []).join(',');

  const reload = useCallback(async () => {
    const list = idsKey ? idsKey.split(',') : [];
    if (list.length === 0) {
      setTokensById({});
      setAssessmentsById({});
      return;
    }
    setLoading(true);
    try {
      const [tokenRes, assessmentRes] = await Promise.all([
        supabase
          .from('staff_disc_tokens')
          .select('subject_id, sent_at, expires_at, consumed_at, first_opened_at')
          .eq('subject_type', subjectType)
          .in('subject_id', list),
        supabase
          .from('staff_disc_assessments')
          .select('*')
          .eq('subject_type', subjectType)
          .in('subject_id', list),
      ]);
      if (tokenRes.error) throw tokenRes.error;
      if (assessmentRes.error) throw assessmentRes.error;
      setTokensById(Object.fromEntries((tokenRes.data || []).map((t) => [t.subject_id, t])));
      setAssessmentsById(Object.fromEntries((assessmentRes.data || []).map((a) => [a.subject_id, a])));
    } catch (err) {
      // Tabelas novas (migração pode ainda não ter sido aplicada) — a aba
      // continua funcional, só sem o indicador de DISC.
      console.error(`Erro ao carregar overlay DISC de ${subjectType}:`, err);
    } finally {
      setLoading(false);
    }
  }, [subjectType, idsKey]);

  useEffect(() => { reload(); }, [reload]);

  return { tokensById, assessmentsById, loading, reload };
}
