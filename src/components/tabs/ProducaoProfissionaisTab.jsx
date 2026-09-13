import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Printer, Download, Upload, Bell, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../supabase';
import {
  mapProfessionalFromDb,
  mapProfessionalPresenceFromDb,
  PROFESSIONAL_SELECT_FIELDS,
  PROFESSIONAL_PRESENCE_SELECT_FIELDS,
} from '../../utils/mappings';
import { calculateProfessionalProduction } from '../../utils/hoursCalculations';
import { BRANDING } from '../../config/branding';
import NfseUploadModal from '../NfseUploadModal';

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Apuração mensal de produção de Profissionais PJ: dias com presença, total de
// horas e Módulos Assistenciais (matutino/vespertino) entregues na competência,
// apresentado como base de conferência para a Nota Fiscal — nunca como "folha
// de pagamento" (ver plano do módulo PJ, seção 1). Os honorários são o preço do
// módulo multiplicado pelos módulos entregues (Cláusula 6ª do contrato-quadro).
//
// Vocabulário é blindagem: esta tela é impressa e exportada, então evita
// "gratificação" (verba celetista, art. 457 §1º da CLT) e "turno" (unidade de
// jornada). No código os campos seguem chamando shift* por compatibilidade.
export default function ProducaoProfissionaisTab({ filterUnit, restrictedUnitIds = [], branding }) {
  const [professionals, setProfessionals] = useState([]);
  const [presence, setPresence] = useState([]);
  const [nfDocs, setNfDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthKey, setMonthKey] = useState(new Date().toISOString().substring(0, 7));
  const [showNfseModal, setShowNfseModal] = useState(false);
  const [notifyingId, setNotifyingId] = useState(null);
  const [notifyingBulk, setNotifyingBulk] = useState(false);

  const labels = BRANDING.professionalLabels || { production: 'Apuração de Produção' };

  const fetchData = useCallback(async () => {
    try {
      const { data: profData } = await supabase.from('professionals').select(PROFESSIONAL_SELECT_FIELDS);
      const { data: presData } = await supabase
        .from('professional_presence')
        .select(PROFESSIONAL_PRESENCE_SELECT_FIELDS)
        .gte('timestamp', `${monthKey}-01T00:00:00`)
        .order('timestamp', { ascending: true });
      const { data: docsData } = await supabase
        .from('professional_documents')
        .select('professional_id, doc_key, meta, created_at');

      if (profData) setProfessionals(profData.map(mapProfessionalFromDb).filter((p) => !restrictedUnitIds.includes(p.unitId)));
      if (presData) setPresence(presData.map(mapProfessionalPresenceFromDb).filter((r) => !restrictedUnitIds.includes(r.unitId)));
      if (docsData) setNfDocs(docsData || []);
    } catch (err) {
      console.error('Erro ao carregar apuração de produção PJ:', err);
    } finally {
      setLoading(false);
    }
  }, [monthKey, restrictedUnitIds]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const production = useMemo(
    () => calculateProfessionalProduction(presence, professionals, monthKey, filterUnit),
    [presence, professionals, monthKey, filterUnit]
  );

  // Aviso de emissão de NF e a própria NF são registrados em
  // professional_documents (doc_key `aviso-nf-<mês>` e `nf-<mês>-*`,
  // respectivamente) — deriva por prestador o estado da competência corrente.
  const noticeByProfessional = useMemo(() => {
    const map = new Map();
    nfDocs.forEach((doc) => {
      if (doc.doc_key === `aviso-nf-${monthKey}`) {
        map.set(doc.professional_id, doc.meta);
      }
    });
    return map;
  }, [nfDocs, monthKey]);

  const hasNfForMonth = useMemo(() => {
    const set = new Set();
    nfDocs.forEach((doc) => {
      if (doc.doc_key.startsWith(`nf-${monthKey}-`) || doc.meta?.competencia === monthKey) {
        set.add(doc.professional_id);
      }
    });
    return set;
  }, [nfDocs, monthKey]);

  const notifyProfessionals = async (professionalIds) => {
    try {
      const { data, error } = await supabase.functions.invoke('notify-professional-nfse', {
        body: { competencia: monthKey, professionalIds },
      });
      if (error) throw error;

      const results = data?.results || [];
      const sent = results.filter((r) => r.status === 'enviado').length;
      const semEmail = results.filter((r) => r.status === 'sem_email').length;
      const erros = results.filter((r) => r.status === 'erro').length;

      if (sent > 0) toast.success(`Aviso enviado para ${sent} prestador(es).`);
      if (semEmail > 0) toast.warning(`${semEmail} prestador(es) sem e-mail cadastrado.`);
      if (erros > 0) toast.error(`Falha ao avisar ${erros} prestador(es).`);
      if (results.length === 0) toast.error('Nenhum resultado retornado pelo envio de aviso.');

      await fetchData();
    } catch (err) {
      console.error('Erro ao emitir aviso de NF:', err);
      toast.error('Erro ao emitir aviso de emissão de NF.');
    }
  };

  const handleNotifyOne = async (professionalId) => {
    setNotifyingId(professionalId);
    try {
      await notifyProfessionals([professionalId]);
    } finally {
      setNotifyingId(null);
    }
  };

  const handleNotifyPending = async () => {
    const pendingIds = production
      .filter((row) => !hasNfForMonth.has(row.professional.id) && !noticeByProfessional.has(row.professional.id))
      .map((row) => row.professional.id);

    if (pendingIds.length === 0) {
      toast.info('Nenhum prestador pendente de aviso nesta competência.');
      return;
    }

    if (!window.confirm(`Enviar aviso de emissão de NF para ${pendingIds.length} prestador(es) sem NF nem aviso nesta competência?`)) {
      return;
    }

    setNotifyingBulk(true);
    try {
      await notifyProfessionals(pendingIds);
    } finally {
      setNotifyingBulk(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = 'Prestador,Dias com Presença,Total de Horas,Módulos Matutinos,Módulos Vespertinos,Módulos Entregues,Preço do Módulo,Honorários\n';
    const rows = production
      .map((row) => [
        `"${row.professional.name}"`,
        row.daysPresent,
        row.totalHours.toFixed(2),
        row.morningShifts,
        row.afternoonShifts,
        row.shiftsPresent,
        row.shiftValue.toFixed(2),
        row.shiftTotal.toFixed(2),
      ].join(','))
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `producao_pj_${monthKey}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <FileText size={20} className="text-teal-600" /> {labels.production || 'Apuração de Produção'}
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="p-2 border border-gray-300 rounded-lg text-xs bg-white"
          />
          <button
            onClick={() => setShowNfseModal(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors shadow-sm"
          >
            <Upload size={14} /> Enviar NFSe (PDF)
          </button>
          <button
            onClick={handleNotifyPending}
            disabled={notifyingBulk}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors shadow-sm disabled:opacity-50"
            title="Avisar todos os prestadores pendentes de emissão de NF nesta competência"
          >
            {notifyingBulk ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />} Avisar Pendentes de NF
          </button>
          <button onClick={handleExportCSV} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700" title="Exportar CSV">
            <Download size={14} />
          </button>
          <button onClick={handlePrint} className="p-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg" title="Imprimir relatório de conferência">
            <Printer size={14} />
          </button>
        </div>
      </div>

      <p className="px-4 pt-3 text-[11px] text-gray-500">
        Base de conferência para as Notas Fiscais da competência. Não representa folha de pagamento nem controle de jornada.
        Os honorários são o preço do Módulo Assistencial multiplicado pelos módulos entregues na competência
        (corte matutino/vespertino às 12h); um mesmo dia rende dois módulos quando há execução antes e depois do corte.
        Os registros de execução têm finalidade fiscal e não constituem controle de ponto ou de jornada
        (art. 74 da CLT) — ver Cláusula 6ª do contrato-quadro PJ.
      </p>

      <div className="overflow-x-auto p-4">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <th className="p-3 font-semibold">Prestador</th>
              <th className="p-3 font-semibold">Dias com Presença</th>
              <th className="p-3 font-semibold">Total de Horas</th>
              <th className="p-3 font-semibold">Módulos (Mat. / Vesp.)</th>
              <th className="p-3 font-semibold">Módulos Entregues</th>
              <th className="p-3 font-semibold">Preço do Módulo</th>
              <th className="p-3 font-semibold text-right">Honorários</th>
              <th className="p-3 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {production.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">Nenhum prestador nesta unidade.</td></tr>
            ) : (
              production.map((row) => {
                const notice = noticeByProfessional.get(row.professional.id);
                const hasNf = hasNfForMonth.has(row.professional.id);
                const isNotifying = notifyingId === row.professional.id;

                return (
                  <tr key={row.professional.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-semibold text-gray-800">{row.professional.name}</td>
                    <td className="p-3 text-gray-600">{row.daysPresent}</td>
                    <td className="p-3 text-gray-600">{row.totalHours.toFixed(1)}h</td>
                    <td className="p-3 text-gray-600">{row.morningShifts} / {row.afternoonShifts}</td>
                    <td className="p-3 font-semibold text-gray-700">{row.shiftsPresent}</td>
                    <td className="p-3 text-gray-600">
                      {row.shiftValue > 0 ? fmtBRL(row.shiftValue) : <span className="text-amber-600">não informado</span>}
                    </td>
                    <td className="p-3 text-right font-bold text-gray-800">{fmtBRL(row.shiftTotal)}</td>
                    <td className="p-3 text-right">
                      {hasNf ? (
                        <span className="text-[10px] text-emerald-700 font-semibold">NF recebida</span>
                      ) : (
                        <button
                          onClick={() => handleNotifyOne(row.professional.id)}
                          disabled={isNotifying}
                          title={notice ? `Aviso enviado em ${new Date(notice.sentAt).toLocaleDateString('pt-BR')} — clique para reenviar` : 'Emitir aviso de NF ao prestador'}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded transition-colors disabled:opacity-50 ${
                            notice ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          {isNotifying ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
                          {notice ? 'Reenviar aviso' : 'Emitir aviso de NF'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {production.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200 font-semibold text-gray-700">
                <td className="p-3" colSpan={4}>Total da competência</td>
                <td className="p-3">{production.reduce((acc, r) => acc + r.shiftsPresent, 0)}</td>
                <td className="p-3"></td>
                <td className="p-3 text-right">{fmtBRL(production.reduce((acc, r) => acc + r.shiftTotal, 0))}</td>
                <td className="p-3"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <NfseUploadModal
        isOpen={showNfseModal}
        onClose={() => {
          setShowNfseModal(false);
          fetchData();
        }}
        branding={branding}
      />
    </div>
  );
}
