import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Printer, Download, Upload, Bell, Loader2, CheckCircle2, XCircle, Eye, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../supabase';
import {
  mapProfessionalFromDb,
  mapProfessionalPresenceFromDb,
  PROFESSIONAL_SELECT_FIELDS,
  PROFESSIONAL_PRESENCE_SELECT_FIELDS,
  getFriendlyDbErrorMessage,
} from '../../utils/mappings';
import { calculateProfessionalProduction } from '../../utils/hoursCalculations';
import { BRANDING } from '../../config/branding';
import NfseUploadModal from '../NfseUploadModal';
import PjDispatchConfigModal from '../PjDispatchConfigModal';

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const openPdfInNewTab = (base64Content) => {
  try {
    const cleanBase64 = base64Content.replace(/^data:application\/pdf;base64,/, '');
    const byteCharacters = atob(cleanBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
  } catch (err) {
    console.error('Erro ao abrir PDF:', err);
    toast.error('Não foi possível abrir o arquivo PDF da nota.');
  }
};

export default function ProducaoProfissionaisTab({ filterUnit, restrictedUnitIds = [], branding }) {
  const [professionals, setProfessionals] = useState([]);
  const [presence, setPresence] = useState([]);
  const [nfDocs, setNfDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthKey, setMonthKey] = useState(new Date().toISOString().substring(0, 7));
  const [showNfseModal, setShowNfseModal] = useState(false);
  const [showDispatchConfigModal, setShowDispatchConfigModal] = useState(false);
  const [notifyingId, setNotifyingId] = useState(null);
  const [notifyingBulk, setNotifyingBulk] = useState(false);
  const [openingDocKey, setOpeningDocKey] = useState(null);
  const [actingDocKey, setActingDocKey] = useState(null);

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
        .select('professional_id, doc_key, meta, created_at')
        .order('created_at', { ascending: false });

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

  const noticeByProfessional = useMemo(() => {
    const map = new Map();
    nfDocs.forEach((doc) => {
      if (doc.doc_key === `aviso-nf-${monthKey}`) {
        map.set(doc.professional_id, doc.meta);
      }
    });
    return map;
  }, [nfDocs, monthKey]);

  // Documento de NFSe da competência corrente por profissional (pega o mais recente)
  const nfByProfessional = useMemo(() => {
    const map = new Map();
    nfDocs.forEach((doc) => {
      const isCompMatch = doc.meta?.competencia === monthKey || doc.doc_key.startsWith(`nf-${monthKey}-`);
      if (isCompMatch && !map.has(doc.professional_id)) {
        map.set(doc.professional_id, doc);
      }
    });
    return map;
  }, [nfDocs, monthKey]);

  const notifyProfessionals = async (items) => {
    try {
      const { data, error } = await supabase.functions.invoke('notify-professional-nfse', {
        body: { competencia: monthKey, items },
      });
      if (error) throw error;

      const results = data?.results || [];
      const sent = results.filter((r) => r.status === 'enviado').length;
      const semEmail = results.filter((r) => r.status === 'sem_email').length;
      const erros = results.filter((r) => r.status === 'erro').length;

      if (sent > 0) toast.success(`Aviso FaçaAmigos com link enviado para ${sent} prestador(es).`);
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
      const row = production.find((r) => r.professional.id === professionalId);
      await notifyProfessionals([
        {
          professionalId,
          calculatedAmount: row?.totalPayable || 0,
        },
      ]);
    } finally {
      setNotifyingId(null);
    }
  };

  const handleNotifyPending = async () => {
    const pendingRows = production.filter(
      (row) => !nfByProfessional.has(row.professional.id) && !noticeByProfessional.has(row.professional.id)
    );

    if (pendingRows.length === 0) {
      toast.info('Nenhum prestador pendente de aviso nesta competência.');
      return;
    }

    if (!window.confirm(`Enviar aviso FaçaAmigos com link e valor apurado para ${pendingRows.length} prestador(es) pendentes?`)) {
      return;
    }

    setNotifyingBulk(true);
    try {
      const items = pendingRows.map((r) => ({
        professionalId: r.professional.id,
        calculatedAmount: r.totalPayable || 0,
      }));
      await notifyProfessionals(items);
    } finally {
      setNotifyingBulk(false);
    }
  };

  const handleViewPdf = async (professionalId, docKey) => {
    setOpeningDocKey(docKey);
    try {
      const { data, error } = await supabase
        .from('professional_documents')
        .select('content')
        .eq('professional_id', professionalId)
        .eq('doc_key', docKey)
        .single();

      if (error) throw error;
      if (!data?.content) {
        toast.error('Conteúdo do arquivo não encontrado.');
        return;
      }
      openPdfInNewTab(data.content);
    } catch (err) {
      console.error('Erro ao buscar PDF da NF:', err);
      toast.error('Não foi possível carregar o arquivo da Nota Fiscal.');
    } finally {
      setOpeningDocKey(null);
    }
  };

  const handleApproveNf = async (professionalId, docKey, currentMeta) => {
    const valorFormatted = currentMeta?.valor ? fmtBRL(currentMeta.valor) : 'R$ 0,00';
    if (!window.confirm(`Confirmar validação e aprovar a NFSe (Valor: ${valorFormatted})? O registro será encaminhado ao Financeiro para liquidação.`)) {
      return;
    }

    setActingDocKey(docKey);
    try {
      const updatedMeta = {
        ...currentMeta,
        status: 'aprovado',
        validatedAt: new Date().toISOString(),
        validatedBy: 'RH',
      };
      const { error } = await supabase
        .from('professional_documents')
        .update({ meta: updatedMeta })
        .eq('professional_id', professionalId)
        .eq('doc_key', docKey);

      if (error) throw error;
      toast.success('NFSe APROVADA pelo RH! Encaminhada para o Financeiro com sucesso.');
      await fetchData();
    } catch (err) {
      console.error('Erro ao aprovar NFSe:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setActingDocKey(null);
    }
  };

  const handleRejectNf = async (professionalId, docKey, currentMeta) => {
    const reason = window.prompt('Informe a justificativa/motivo para a rejeição da NFSe (o prestador precisará reenviar):');
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error('A justificativa de rejeição é obrigatória.');
      return;
    }

    setActingDocKey(docKey);
    try {
      const updatedMeta = {
        ...currentMeta,
        status: 'rejeitado',
        rejectionReason: reason.trim(),
        validatedAt: new Date().toISOString(),
        validatedBy: 'RH',
      };
      const { error } = await supabase
        .from('professional_documents')
        .update({ meta: updatedMeta })
        .eq('professional_id', professionalId)
        .eq('doc_key', docKey);

      if (error) throw error;
      toast.warning(`NFSe rejeitada pelo RH. Motivo: ${reason}`);
      await fetchData();
    } catch (err) {
      console.error('Erro ao rejeitar NFSe:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setActingDocKey(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = 'Prestador,Dias com Presença,Total de Horas,Módulos Matutinos,Módulos Vespertinos,Módulos Entregues,Preço do Módulo,Módulos em Domingo,Diária Extra de Domingo,Honorários,Status NF,Valor NF\n';
    const rows = production
      .map((row) => {
        const nfDoc = nfByProfessional.get(row.professional.id);
        const nfStatus = nfDoc?.meta?.status || 'pendente_envio';
        const nfValor = nfDoc?.meta?.valor ? Number(nfDoc.meta.valor).toFixed(2) : '0.00';
        return [
          `"${row.professional.name}"`,
          row.daysPresent,
          row.totalHours.toFixed(2),
          row.morningShifts,
          row.afternoonShifts,
          row.shiftsPresent,
          row.shiftValue.toFixed(2),
          row.sundayShiftsPresent,
          row.sundayBonusTotal.toFixed(2),
          row.totalPayable.toFixed(2),
          `"${nfStatus}"`,
          nfValor,
        ].join(',');
      })
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
            className="p-2 border border-gray-300 rounded-lg text-xs bg-white font-medium"
          />
          <button
            onClick={() => setShowNfseModal(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors shadow-sm"
          >
            <Upload size={14} /> Anexar NFSe Manual
          </button>
          <button
            onClick={() => setShowDispatchConfigModal(true)}
            className="flex items-center gap-1.5 bg-[#F0196B] hover:bg-[#d6135c] text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors shadow-sm"
            title="Configurar dia do mês para disparo automatizado e disparar e-mails FaçaAmigos aos PJ"
          >
            <Bell size={14} /> Disparo de E-mails PJ (FaçaAmigos)
          </button>
          <button
            onClick={handleNotifyPending}
            disabled={notifyingBulk}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors shadow-sm disabled:opacity-50"
            title="Avisar todos os prestadores pendentes de emissão de NF nesta competência com o template FaçaAmigos"
          >
            {notifyingBulk ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />} Avisar Pendentes
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
        Base de conferência para as Notas Fiscais da competência. As notas enviadas pelos prestadores via link seguro do FaçaAmigos aparecem diretamente nesta tabela para validação do Administrador do RH. Ao aprovar, o registro segue automaticamente para a programação de pagamento do Financeiro.
      </p>

      <div className="overflow-x-auto p-4">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <th className="p-3 font-semibold">Prestador</th>
              <th className="p-3 font-semibold">Dias</th>
              <th className="p-3 font-semibold">Horas</th>
              <th className="p-3 font-semibold">Módulos (M/V)</th>
              <th className="p-3 font-semibold">Entregues</th>
              <th className="p-3 font-semibold">Preço Módulo</th>
              <th className="p-3 font-semibold">Módulos Dom.</th>
              <th className="p-3 font-semibold text-right">Extra Domingo</th>
              <th className="p-3 font-semibold text-right">Apurado Sistema</th>
              <th className="p-3 font-semibold text-center">Nota Fiscal (NFSe)</th>
              <th className="p-3 font-semibold text-right">Ações do RH</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {production.length === 0 ? (
              <tr><td colSpan={11} className="p-8 text-center text-gray-400">Nenhum prestador nesta unidade.</td></tr>
            ) : (
              production.map((row) => {
                const notice = noticeByProfessional.get(row.professional.id);
                const nfDoc = nfByProfessional.get(row.professional.id);
                const isNotifying = notifyingId === row.professional.id;

                const nfMeta = nfDoc?.meta || null;
                const nfStatus = nfMeta?.status || 'pendente';
                const nfValor = Number(nfMeta?.valor) || 0;
                const valorApurado = Number(row.totalPayable) || 0;
                const temDivergencia = nfDoc && nfValor > 0 && Math.abs(nfValor - valorApurado) > 0.05;
                const isActing = actingDocKey === nfDoc?.doc_key;
                const isOpening = openingDocKey === nfDoc?.doc_key;

                return (
                  <tr key={row.professional.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-semibold text-gray-800">
                      <div>{row.professional.name}</div>
                      {row.professional.cnpj && <div className="text-[10px] text-gray-400 font-normal">{row.professional.cnpj}</div>}
                    </td>
                    <td className="p-3 text-gray-600">{row.daysPresent}</td>
                    <td className="p-3 text-gray-600">{row.totalHours.toFixed(1)}h</td>
                    <td className="p-3 text-gray-600">{row.morningShifts} / {row.afternoonShifts}</td>
                    <td className="p-3 font-semibold text-gray-700">{row.shiftsPresent}</td>
                    <td className="p-3 text-gray-600">
                      {row.shiftValue > 0 ? fmtBRL(row.shiftValue) : <span className="text-amber-600">não informado</span>}
                    </td>
                    <td className="p-3 text-gray-600">{row.sundayShiftsPresent}</td>
                    <td className="p-3 text-right text-gray-600">{fmtBRL(row.sundayBonusTotal)}</td>
                    <td className="p-3 text-right font-extrabold text-teal-800">{fmtBRL(row.totalPayable)}</td>

                    {/* Coluna da Nota Fiscal */}
                    <td className="p-3 text-center">
                      {nfDoc ? (
                        <div className="flex flex-col items-center gap-1">
                          {/* Badge de Status */}
                          {nfStatus === 'aprovado' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 size={11} /> Aprovada p/ Financeiro
                            </span>
                          ) : nfStatus === 'rejeitado' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800" title={nfMeta?.rejectionReason || 'Rejeitada'}>
                              <XCircle size={11} /> Rejeitada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Pendente RH
                            </span>
                          )}

                          {/* Valor da Nota e divergência se houver */}
                          <div className="text-[11px] font-semibold text-gray-700">
                            {nfValor > 0 ? fmtBRL(nfValor) : '—'}
                            {nfMeta?.numeroNf && <span className="text-[10px] text-gray-400 ml-1">#{nfMeta.numeroNf}</span>}
                          </div>

                          {temDivergencia && (
                            <div className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              <AlertTriangle size={10} /> Dif: {fmtBRL(nfValor - valorApurado)}
                            </div>
                          )}

                          {/* Botão para ver PDF */}
                          <button
                            onClick={() => handleViewPdf(row.professional.id, nfDoc.doc_key)}
                            disabled={isOpening}
                            className="inline-flex items-center gap-1 text-[10px] text-teal-700 hover:text-teal-900 underline font-medium mt-0.5 disabled:opacity-50"
                          >
                            {isOpening ? <Loader2 size={10} className="animate-spin" /> : <Eye size={10} />} Ver PDF
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Pendente envio</span>
                      )}
                    </td>

                    {/* Coluna de Ações do RH */}
                    <td className="p-3 text-right">
                      {nfDoc ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {nfStatus !== 'aprovado' && (
                            <button
                              onClick={() => handleApproveNf(row.professional.id, nfDoc.doc_key, nfMeta)}
                              disabled={isActing}
                              className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                              title="Aprovar NFSe e liberar para o Financeiro"
                            >
                              {isActing ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Aprovar
                            </button>
                          )}

                          {nfStatus !== 'rejeitado' && (
                            <button
                              onClick={() => handleRejectNf(row.professional.id, nfDoc.doc_key, nfMeta)}
                              disabled={isActing}
                              className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                              title="Rejeitar NFSe com justificativa"
                            >
                              <XCircle size={11} /> Rejeitar
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleNotifyOne(row.professional.id)}
                          disabled={isNotifying}
                          title={notice ? `Aviso enviado em ${new Date(notice.sentAt).toLocaleDateString('pt-BR')} — clique para reenviar` : 'Emitir aviso FaçaAmigos com link e valor apurado'}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors shadow-sm disabled:opacity-50 ${
                            notice ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-[#F0196B] hover:bg-[#d6135c] text-white'
                          }`}
                        >
                          {isNotifying ? <Loader2 size={11} className="animate-spin" /> : <Bell size={11} />}
                          {notice ? 'Reenviar link' : 'Avisar PJ'}
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
                <td className="p-3">{production.reduce((acc, r) => acc + r.sundayShiftsPresent, 0)}</td>
                <td className="p-3 text-right">{fmtBRL(production.reduce((acc, r) => acc + r.sundayBonusTotal, 0))}</td>
                <td className="p-3 text-right text-teal-900 font-extrabold">{fmtBRL(production.reduce((acc, r) => acc + r.totalPayable, 0))}</td>
                <td className="p-3 text-center">
                  <span className="text-[10px] text-gray-500">
                    {production.filter((r) => nfByProfessional.get(r.professional.id)?.meta?.status === 'aprovado').length} aprovada(s)
                  </span>
                </td>
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

      <PjDispatchConfigModal
        isOpen={showDispatchConfigModal}
        onClose={() => setShowDispatchConfigModal(false)}
        production={production}
        monthKey={monthKey}
        nfByProfessional={nfByProfessional}
        onDispatched={fetchData}
      />
    </div>
  );
}
