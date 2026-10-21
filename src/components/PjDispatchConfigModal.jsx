import React, { useState, useEffect, useMemo } from 'react';
import { X, Bell, Calendar, Clock, Sliders, CheckCircle2, AlertCircle, Loader2, Send, Users, ShieldCheck, Mail } from 'lucide-react';
import { supabase } from '../supabase';
import { toast } from 'sonner';

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const DEFAULT_SETTINGS = {
  dayOfMonth: 20,
  businessDayOnly: true, // Se cair em sábado/domingo, ajusta para o dia útil anterior
  dispatchHour: '08:00',
  autoNotifyEnabled: true,
};

export default function PjDispatchConfigModal({
  isOpen,
  onClose,
  production = [],
  monthKey,
  nfByProfessional,
  onDispatched,
}) {
  const [activeTab, setActiveTab] = useState('agendamento'); // 'agendamento' | 'disparo_imediato'
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('grupoib_pj_dispatch_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);

  // Seleção de prestadores para disparo
  const [selectedIds, setSelectedIds] = useState([]);

  // Lista de prestadores elegíveis (que não têm NF ou estão pendentes)
  const eligibleProfessionals = useMemo(() => {
    return production.map((row) => {
      const nfDoc = nfByProfessional?.get(row.professional.id);
      const hasNf = Boolean(nfDoc);
      const isApproved = nfDoc?.meta?.status === 'aprovado';
      const hasEmail = Boolean(row.professional.email || row.professional.repEmail);
      return {
        id: row.professional.id,
        name: row.professional.name,
        email: row.professional.email || row.professional.repEmail || '',
        unitName: row.professional.unitName || row.professional.unitId,
        totalPayable: row.totalPayable,
        hasNf,
        isApproved,
        hasEmail,
      };
    });
  }, [production, nfByProfessional]);

  // Ao abrir o modal, pré-seleciona todos que ainda NÃO têm NF e que POSSUEM e-mail
  useEffect(() => {
    if (isOpen) {
      const defaultIds = eligibleProfessionals
        .filter((p) => !p.hasNf && p.hasEmail)
        .map((p) => p.id);
      setSelectedIds(defaultIds);
    }
  }, [isOpen, eligibleProfessionals]);

  if (!isOpen) return null;

  const handleSaveSettings = () => {
    setSavingSettings(true);
    try {
      localStorage.setItem('grupoib_pj_dispatch_settings', JSON.stringify(settings));
      toast.success('Configuração de disparo automatizado salva com sucesso!');
      setActiveTab('disparo_imediato');
    } catch (e) {
      console.error('Erro ao salvar settings:', e);
      toast.error('Erro ao salvar configurações.');
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === eligibleProfessionals.filter((p) => p.hasEmail).length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligibleProfessionals.filter((p) => p.hasEmail).map((p) => p.id));
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

    const confirmMsg = `Confirmar o disparo de e-mails com template FaçaAmigos e link seguro para ${items.length} prestador(es) na competência ${monthKey}?`;
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
  const selectedTotal = eligibleProfessionals
    .filter((p) => selectedIds.includes(p.id))
    .reduce((acc, p) => acc + (p.totalPayable || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header FaçaAmigos */}
        <div className="h-2 bg-[#FFE234] w-full" />
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <Bell size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                Disparo Automatizado de E-mails aos PJ
              </h3>
              <p className="text-xs text-slate-500">
                Template FaçaAmigos • Módulo Grupo IB • Competência: <strong>{monthKey}</strong>
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
        <div className="flex border-b border-slate-200 px-6 bg-white gap-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('agendamento')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'agendamento'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calendar size={14} /> Regra de Disparo Mensal (Data do Mês)
          </button>
          <button
            onClick={() => setActiveTab('disparo_imediato')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'disparo_imediato'
                ? 'border-[#F0196B] text-[#F0196B]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Send size={14} /> Disparar Agora para Prestadores ({eligibleProfessionals.length})
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'agendamento' ? (
            <div className="space-y-5">
              <div className="p-4 bg-teal-50/70 border border-teal-200/60 rounded-2xl text-xs text-teal-900 leading-relaxed">
                <strong>Como funciona o disparo automatizado:</strong><br />
                Na data configurada de cada mês, o sistema consolida as presenças dos profissionais PJ, calcula a apuração de produção exata de cada prestador e envia o e-mail oficial FaçaAmigos com o valor e o link seguro para upload da NFSe.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Dia do Mês */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Calendar size={14} className="text-teal-600" /> Dia do Mês para Disparo
                  </label>
                  <select
                    value={settings.dayOfMonth}
                    onChange={(e) => setSettings({ ...settings, dayOfMonth: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-teal-500 outline-none"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        Todo dia {d} do mês {d === 20 ? '(Recomendado: Dia 20)' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Exemplo: dia 20 de cada mês.
                  </span>
                </div>

                {/* Horário */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Clock size={14} className="text-teal-600" /> Horário de Envio
                  </label>
                  <input
                    type="time"
                    value={settings.dispatchHour}
                    onChange={(e) => setSettings({ ...settings, dispatchHour: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-teal-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Horário de Brasília (recomendado: 08:00).
                  </span>
                </div>
              </div>

              {/* Ajuste para Dias Úteis */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.businessDayOnly}
                    onChange={(e) => setSettings({ ...settings, businessDayOnly: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      Garantir Envio em Dia Útil (Segunda a Sexta)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Se o dia {settings.dayOfMonth} cair em um sábado ou domingo, antecipa o envio para a sexta-feira anterior, garantindo que o prestador receba em horário comercial.
                    </p>
                  </div>
                </label>
              </div>

              {/* Resumo da Regra Ativa */}
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
                <AlertCircle size={16} className="text-amber-600 shrink-0" />
                <span>
                  Próxima execução prevista: <strong>Dia {settings.dayOfMonth} (útil) às {settings.dispatchHour}</strong>.
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  {selectedCount} de {eligibleProfessionals.length} prestador(es) selecionados
                </span>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-teal-700 hover:text-teal-900 font-bold underline"
                >
                  {selectedCount === eligibleProfessionals.filter((p) => p.hasEmail).length
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
                      <th className="p-2.5 font-semibold">E-mail de Destino</th>
                      <th className="p-2.5 font-semibold text-right">Valor Apurado</th>
                      <th className="p-2.5 font-semibold text-center">Status NF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eligibleProfessionals.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400">
                          Nenhum prestador encontrado para esta competência.
                        </td>
                      </tr>
                    ) : (
                      eligibleProfessionals.map((p) => {
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
                            <td className="p-2.5 font-semibold text-slate-800">
                              <div>{p.name}</div>
                              <div className="text-[10px] text-slate-400">{p.unitName}</div>
                            </td>
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

              {/* Box de Resumo da Carga */}
              <div className="bg-slate-50 p-3.5 rounded-2xl flex items-center justify-between text-xs border border-slate-200">
                <div>
                  <span className="text-slate-500">Total a faturar selecionado: </span>
                  <strong className="text-teal-800 text-sm font-extrabold">{fmtBRL(selectedTotal)}</strong>
                </div>
                <div className="text-[11px] text-slate-500">
                  {selectedCount} destinatário(s)
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
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 size={14} /> Salvar Regra de Disparo
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
