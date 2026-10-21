import React, { useState, useEffect, useMemo } from 'react';
import { X, Bell, Calendar, Clock, Sliders, CheckCircle2, AlertCircle, Loader2, Send, Building2, ShieldCheck, Filter } from 'lucide-react';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import { BRANDING } from '../config/branding';

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PjDispatchConfigModal({
  isOpen,
  onClose,
  production = [],
  monthKey,
  nfByProfessional,
  units = [],
  onDispatched,
}) {
  const [activeTab, setActiveTab] = useState('agendamento'); // 'agendamento' | 'disparo_imediato'
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);

  // Lista de unidades com as regras de fechamento
  const [unitConfigs, setUnitConfigs] = useState([]);
  const [filterUnitId, setFilterUnitId] = useState('all');

  // Seleção de prestadores para disparo imediato
  const [selectedIds, setSelectedIds] = useState([]);

  // Carrega configurações de fechamento das unidades do banco e fallback local
  useEffect(() => {
    if (!isOpen) return;

    async function loadUnitSettings() {
      setLoadingUnits(true);
      try {
        const { data: dbUnits, error: dbError } = await supabase
          .from('units')
          .select('id, name, pj_fechamento_dia, pj_fechamento_dia_util, pj_fechamento_hora, pj_fechamento_ativo')
          .order('name', { ascending: true });

        // Unidades base (do banco ou branding)
        const baseList = (dbUnits && dbUnits.length > 0 ? dbUnits : BRANDING.kioskUnits || []).map((u) => ({
          id: u.id,
          name: u.name || u.buttonLabel || u.id,
          dayOfMonth: Number(u.pj_fechamento_dia) || 20,
          businessDayOnly: u.pj_fechamento_dia_util !== false,
          dispatchHour: u.pj_fechamento_hora || '08:00',
          enabled: u.pj_fechamento_ativo !== false,
        }));

        // Lê possíveis overrides do localStorage se houver
        let localOverrides = {};
        try {
          const raw = localStorage.getItem('grupoib_pj_unit_dispatch_settings');
          if (raw) localOverrides = JSON.parse(raw);
        } catch (e) {
          console.error('Erro ao ler overrides locais:', e);
        }

        const merged = baseList.map((item) => {
          const override = localOverrides[item.id];
          return override ? { ...item, ...override } : item;
        });

        setUnitConfigs(merged);
      } catch (err) {
        console.error('Erro ao carregar configurações de unidades:', err);
      } finally {
        setLoadingUnits(false);
      }
    }

    loadUnitSettings();
  }, [isOpen]);

  // Lista de prestadores da competência
  const eligibleProfessionals = useMemo(() => {
    return production.map((row) => {
      const nfDoc = nfByProfessional?.get(row.professional.id);
      const hasNf = Boolean(nfDoc);
      const isApproved = nfDoc?.meta?.status === 'aprovado';
      const hasEmail = Boolean(row.professional.email || row.professional.repEmail);
      const unitObj = unitConfigs.find((u) => u.id === row.professional.unitId);
      return {
        id: row.professional.id,
        name: row.professional.name,
        email: row.professional.email || row.professional.repEmail || '',
        unitId: row.professional.unitId,
        unitName: unitObj?.name || row.professional.unitName || row.professional.unitId,
        totalPayable: row.totalPayable,
        hasNf,
        isApproved,
        hasEmail,
      };
    });
  }, [production, nfByProfessional, unitConfigs]);

  // Filtra prestadores na aba de disparo
  const filteredProfessionals = useMemo(() => {
    if (filterUnitId === 'all') return eligibleProfessionals;
    return eligibleProfessionals.filter((p) => p.unitId === filterUnitId);
  }, [eligibleProfessionals, filterUnitId]);

  // Ao abrir ou trocar filtro, pré-seleciona os que não têm NF e possuem e-mail
  useEffect(() => {
    if (isOpen) {
      const defaultIds = filteredProfessionals
        .filter((p) => !p.hasNf && p.hasEmail)
        .map((p) => p.id);
      setSelectedIds(defaultIds);
    }
  }, [isOpen, filteredProfessionals]);

  if (!isOpen) return null;

  // Atualiza uma unidade específica no estado
  const handleUpdateUnitConfig = (unitId, field, value) => {
    setUnitConfigs((prev) =>
      prev.map((u) => (u.id === unitId ? { ...u, [field]: value } : u))
    );
  };

  // Aplica a regra de uma unidade para todas
  const handleApplyToAll = (baseUnit) => {
    if (!window.confirm(`Aplicar as regras da unidade "${baseUnit.name}" (Dia ${baseUnit.dayOfMonth}, às ${baseUnit.dispatchHour}) para TODAS as unidades?`)) {
      return;
    }
    setUnitConfigs((prev) =>
      prev.map((u) => ({
        ...u,
        dayOfMonth: baseUnit.dayOfMonth,
        businessDayOnly: baseUnit.businessDayOnly,
        dispatchHour: baseUnit.dispatchHour,
        enabled: baseUnit.enabled,
      }))
    );
    toast.info('Regra aplicada a todas as unidades. Clique em "Salvar Configurações".');
  };

  // Salva no banco (tabela units) e no localStorage
  const handleSaveAllSettings = async () => {
    setSavingSettings(true);
    try {
      // 1. Atualiza no Supabase (tabela units)
      const updates = unitConfigs.map((u) =>
        supabase
          .from('units')
          .update({
            pj_fechamento_dia: u.dayOfMonth,
            pj_fechamento_dia_util: u.businessDayOnly,
            pj_fechamento_hora: u.dispatchHour,
            pj_fechamento_ativo: u.enabled,
          })
          .eq('id', u.id)
      );

      await Promise.allSettled(updates);

      // 2. Salva no localStorage como cache
      const cacheObj = {};
      unitConfigs.forEach((u) => {
        cacheObj[u.id] = {
          dayOfMonth: u.dayOfMonth,
          businessDayOnly: u.businessDayOnly,
          dispatchHour: u.dispatchHour,
          enabled: u.enabled,
        };
      });
      localStorage.setItem('grupoib_pj_unit_dispatch_settings', JSON.stringify(cacheObj));

      toast.success('Regras de apuração e disparo por unidade salvas com sucesso!');
      setActiveTab('disparo_imediato');
    } catch (e) {
      console.error('Erro ao salvar regras por unidade:', e);
      toast.error('Erro ao persistir configurações.');
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleSelectAll = () => {
    const selectable = filteredProfessionals.filter((p) => p.hasEmail);
    if (selectedIds.length === selectable.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectable.map((p) => p.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSendEmails = async () => {
    if (selectedIds.length === 0) {
      toast.warning('Selecione pelo menos um prestador para disparar os e-mails.');
      return;
    }

    const items = selectedIds.map((id) => {
      const row = production.find((r) => r.professional.id === id);
      return {
        professionalId: id,
        calculatedAmount: row?.totalPayable || 0,
      };
    });

    const confirmMsg = `Confirmar o disparo de e-mails com template FaçaAmigos para ${items.length} prestador(es) na competência ${monthKey}?`;
    if (!window.confirm(confirmMsg)) return;

    setSendingBulk(true);
    try {
      const { data, error } = await supabase.functions.invoke('notify-professional-nfse', {
        body: { competencia: monthKey, items },
      });

      if (error) throw error;

      const results = data?.results || [];
      const sent = results.filter((r) => r.status === 'enviado').length;
      const semEmail = results.filter((r) => r.status === 'sem_email').length;
      const erros = results.filter((r) => r.status === 'erro').length;

      if (sent > 0) {
        toast.success(`E-mails FaçaAmigos disparados com sucesso para ${sent} prestador(es)!`);
      }
      if (semEmail > 0) toast.warning(`${semEmail} prestador(es) sem e-mail.`);
      if (erros > 0) toast.error(`Falha no envio para ${erros} prestador(es).`);

      if (onDispatched) onDispatched();
      onClose();
    } catch (err) {
      console.error('Erro ao disparar e-mails:', err);
      toast.error('Erro ao disparar e-mails para os prestadores.');
    } finally {
      setSendingBulk(false);
    }
  };

  const selectedCount = selectedIds.length;
  const selectedTotal = filteredProfessionals
    .filter((p) => selectedIds.includes(p.id))
    .reduce((acc, p) => acc + (p.totalPayable || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header FaçaAmigos */}
        <div className="h-2 bg-[#FFE234] w-full" />
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                Configuração de Apuração & Disparo PJ por Unidade
              </h3>
              <p className="text-xs text-slate-500">
                Módulo Grupo IB (FaçaAmigos) • Competência ativa: <strong>{monthKey}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Abas do Modal */}
        <div className="flex border-b border-slate-200 px-6 bg-white gap-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab('agendamento')}
            className={`py-3.5 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'agendamento'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calendar size={14} /> Data de Apuração por Unidade ({unitConfigs.length})
          </button>
          <button
            onClick={() => setActiveTab('disparo_imediato')}
            className={`py-3.5 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'disparo_imediato'
                ? 'border-[#F0196B] text-[#F0196B]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Send size={14} /> Disparar E-mails Agora ({filteredProfessionals.length})
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'agendamento' ? (
            <div className="space-y-4">
              <div className="p-4 bg-teal-50/70 border border-teal-200/60 rounded-2xl text-xs text-teal-900 leading-relaxed flex items-start gap-2.5">
                <AlertCircle size={18} className="text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Configuração por Unidade:</strong><br />
                  Cada unidade do Grupo IB pode ter um dia do mês e horário de fechamento próprios. O sistema consolida as presenças dos prestadores daquela unidade e envia o e-mail FaçaAmigos na data estipulada.
                </div>
              </div>

              {loadingUnits ? (
                <div className="py-12 flex justify-center items-center">
                  <Loader2 size={24} className="animate-spin text-teal-600" />
                </div>
              ) : (
                <div className="space-y-3">
                  {unitConfigs.map((u) => (
                    <div
                      key={u.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        u.enabled ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50/60 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <Building2 size={16} className="text-teal-700" />
                          <span className="font-extrabold text-sm text-slate-800">{u.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({u.id})</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleApplyToAll(u)}
                            className="text-[10px] text-teal-700 hover:text-teal-900 font-semibold underline"
                            title="Replicar este dia/horário para todas as outras unidades"
                          >
                            Replicar para todas
                          </button>

                          <label className="flex items-center gap-1.5 cursor-pointer ml-2">
                            <input
                              type="checkbox"
                              checked={u.enabled}
                              onChange={(e) => handleUpdateUnitConfig(u.id, 'enabled', e.target.checked)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-[11px] font-bold text-slate-700">
                              {u.enabled ? 'Disparo Ativo' : 'Pausado'}
                            </span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Dia do Mês */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Dia do Mês
                          </label>
                          <select
                            value={u.dayOfMonth}
                            disabled={!u.enabled}
                            onChange={(e) => handleUpdateUnitConfig(u.id, 'dayOfMonth', Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-teal-500 outline-none disabled:opacity-50"
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                              <option key={d} value={d}>
                                Todo dia {d} {d === 20 ? '(Padrão: 20)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Horário */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Horário
                          </label>
                          <input
                            type="time"
                            value={u.dispatchHour}
                            disabled={!u.enabled}
                            onChange={(e) => handleUpdateUnitConfig(u.id, 'dispatchHour', e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-teal-500 outline-none disabled:opacity-50"
                          />
                        </div>

                        {/* Dia Útil */}
                        <div className="flex items-end pb-2">
                          <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 font-medium">
                            <input
                              type="checkbox"
                              checked={u.businessDayOnly}
                              disabled={!u.enabled}
                              onChange={(e) => handleUpdateUnitConfig(u.id, 'businessDayOnly', e.target.checked)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
                            />
                            <span>Antecipar se fim de semana (Dia útil)</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Filtro por Unidade */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 text-xs">
                  <Filter size={14} className="text-teal-700" />
                  <span className="font-semibold text-slate-700">Filtrar Unidade:</span>
                  <select
                    value={filterUnitId}
                    onChange={(e) => setFilterUnitId(e.target.value)}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none"
                  >
                    <option value="all">Todas as Unidades ({eligibleProfessionals.length})</option>
                    {unitConfigs.map((u) => {
                      const count = eligibleProfessionals.filter((p) => p.unitId === u.id).length;
                      return (
                        <option key={u.id} value={u.id}>
                          {u.name} ({count} prestadores) • Fechamento: dia {u.dayOfMonth}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs text-teal-700 hover:text-teal-900 font-bold underline text-right"
                >
                  {selectedIds.length === filteredProfessionals.filter((p) => p.hasEmail).length
                    ? 'Desmarcar Todos'
                    : 'Selecionar Todos com E-mail'}
                </button>
              </div>

              {/* Tabela de Prestadores */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-2.5 w-10 text-center"></th>
                      <th className="p-2.5 font-semibold">Prestador</th>
                      <th className="p-2.5 font-semibold">Unidade</th>
                      <th className="p-2.5 font-semibold">E-mail de Destino</th>
                      <th className="p-2.5 font-semibold text-right">Valor Apurado</th>
                      <th className="p-2.5 font-semibold text-center">Status NF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProfessionals.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">
                          Nenhum prestador encontrado para esta unidade na competência {monthKey}.
                        </td>
                      </tr>
                    ) : (
                      filteredProfessionals.map((p) => {
                        const isSelected = selectedIds.includes(p.id);
                        return (
                          <tr
                            key={p.id}
                            className={`hover:bg-slate-50 transition-colors ${
                              !p.hasEmail ? 'opacity-50 bg-slate-50/50' : ''
                            }`}
                          >
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                disabled={!p.hasEmail}
                                checked={isSelected}
                                onChange={() => toggleSelectOne(p.id)}
                                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              />
                            </td>
                            <td className="p-2.5 font-semibold text-slate-800">{p.name}</td>
                            <td className="p-2.5 text-slate-600 font-medium">{p.unitName}</td>
                            <td className="p-2.5 text-slate-600">
                              {p.email ? (
                                <span className="font-mono text-[11px]">{p.email}</span>
                              ) : (
                                <span className="text-amber-600 italic text-[10px]">Sem e-mail cadastrado</span>
                              )}
                            </td>
                            <td className="p-2.5 text-right font-bold text-teal-800">
                              {fmtBRL(p.totalPayable)}
                            </td>
                            <td className="p-2.5 text-center">
                              {p.hasNf ? (
                                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                                  NF já anexada
                                </span>
                              ) : (
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                  Pendente
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Resumo da Carga Selecionada */}
              <div className="bg-slate-50 p-3.5 rounded-2xl flex items-center justify-between text-xs border border-slate-200">
                <div>
                  <span className="text-slate-500">Total apurado selecionado: </span>
                  <strong className="text-teal-800 text-sm font-extrabold">{fmtBRL(selectedTotal)}</strong>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {selectedCount} destinatário(s) selecionado(s)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer com Ações */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Fechar
          </button>

          {activeTab === 'agendamento' ? (
            <button
              type="button"
              onClick={handleSaveAllSettings}
              disabled={savingSettings}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              <span>Salvar Regras de Todas as Unidades</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSendEmails}
              disabled={sendingBulk || selectedCount === 0}
              className="px-5 py-2.5 bg-[#F0196B] hover:bg-[#d6135c] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingBulk ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Disparando E-mails...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Disparar para {selectedCount} Prestador(es)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
