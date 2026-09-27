import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Search, FileSignature, CheckCircle2, Clock, MapPin,
  AlertCircle, ShieldCheck, UserCheck, ChevronRight, Loader2, Sparkles,
  FileText, Download, Printer, Check, Building2, Calendar, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { validateCPF } from '../utils/helpers';
import { freelanceJobStatusMeta, FREELANCE_SERVICE_TYPES } from '../config/freelanceConstants';
import { getFreelanceOrderHtml, getFreelanceContractHtml, getFreelanceRpaHtml } from '../utils/freelanceDocuments';
import { openPrintWindow } from '../utils/documentPrint';
import FreelanceSelfRegistration from './FreelanceSelfRegistration';
import useGeolocation from '../hooks/useGeolocation';

export default function FreelanceKiosk({ units = [], branding, onBack }) {
  const kioskUnits = (branding?.kioskUnits || []).length > 0
    ? branding.kioskUnits
    : units;

  const [activeTab, setActiveTab] = useState('os_control'); // 'os_control' | 'register'
  const [selectedUnitId, setSelectedUnitId] = useState(kioskUnits[0]?.id || '');

  // Busca de OS por CPF
  const [cpfQuery, setCpfQuery] = useState('');
  const [freelancerData, setFreelancerData] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // id da OS em ação

  // Modal de justificativa/observação da entrega
  const [deliveryNotesModalJob, setDeliveryNotesModalJob] = useState(null);
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Geolocalização
  const { currentGPS, gpsLoading, getCurrentPosition } = useGeolocation();

  const currentUnit = kioskUnits.find((u) => u.id === selectedUnitId) || kioskUnits[0] || {};

  const handleSearchOS = async (overrideCpf) => {
    const targetCpf = overrideCpf || cpfQuery;
    const cleanCpf = targetCpf.replace(/\D/g, '');

    if (!cleanCpf || cleanCpf.length !== 11) {
      toast.error('Informe um CPF válido com 11 dígitos.');
      return;
    }

    setSearching(true);
    try {
      // 1. Tenta RPC primeiro
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('get_freelancer_os_for_kiosk', {
        p_cpf: cleanCpf,
        p_unit_id: selectedUnitId || null,
      });

      if (!rpcErr && rpcRes && rpcRes.success) {
        setFreelancerData(rpcRes.freelancer);
        setJobs(rpcRes.jobs || []);
        if ((rpcRes.jobs || []).length === 0) {
          toast.info('Nenhuma Ordem de Serviço encontrada para este CPF nesta unidade.');
        } else {
          toast.success(`${rpcRes.jobs.length} Ordem(ns) de Serviço encontrada(s).`);
        }
        setSearching(false);
        return;
      }

      // 2. Fallback direct select
      const { data: fData, error: fErr } = await supabase
        .from('freelancers')
        .select('*')
        .eq('cpf', cleanCpf)
        .maybeSingle();

      if (fErr) throw fErr;
      if (!fData) {
        toast.error('Freelancer não encontrado. Por favor, faça o cadastro obrigatório primeiro.');
        setFreelancerData(null);
        setJobs([]);
        setSearching(false);
        return;
      }

      setFreelancerData({
        id: fData.id,
        name: fData.name,
        cpf: fData.cpf,
        email: fData.email,
        phone: fData.phone,
        service_area: fData.service_area,
        pix_key: fData.pix_key,
        autonomy_accepted_at: fData.autonomy_declaration_accepted_at,
      });

      let query = supabase
        .from('freelance_jobs')
        .select('*')
        .eq('freelancer_id', fData.id)
        .order('created_at', { ascending: false });

      if (selectedUnitId) {
        query = query.eq('unit_id', selectedUnitId);
      }

      const { data: jData, error: jErr } = await query;
      if (jErr) throw jErr;

      setJobs(jData || []);
      if ((jData || []).length === 0) {
        toast.info('Nenhuma OS encontrada para este cadastro.');
      } else {
        toast.success(`${jData.length} Ordem(ns) de Serviço encontrada(s).`);
      }
    } catch (err) {
      console.error('Erro ao consultar OS:', err);
      toast.error(err?.message || 'Erro ao consultar OS por CPF.');
    } finally {
      setSearching(false);
    }
  };

  // Aceite do escopo e início presencial (Check-in de Escopo)
  const handleAcceptScope = async (job) => {
    setActionLoading(job.id);
    try {
      // Tenta obter GPS para comprovar presença no local do evento/unidade
      let posStr = '';
      try {
        const pos = await getCurrentPosition();
        if (pos?.coords) {
          posStr = `[GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}]`;
        }
      } catch {
        // GPS opcional
      }

      const { data: rpcRes, error: rpcErr } = await supabase.rpc('update_freelance_job_status_kiosk', {
        p_job_id: job.id,
        p_action: 'accept_scope',
        p_notes: posStr,
      });

      if (rpcErr) {
        // Fallback direto
        const { error: directErr } = await supabase
          .from('freelance_jobs')
          .update({
            status: 'aceita',
            accepted_at: new Date().toISOString(),
            executed_date: job.executed_date || new Date().toISOString().split('T')[0],
          })
          .eq('id', job.id);
        if (directErr) throw directErr;
      }

      toast.success('Escopo da OS aceito! Execução presencial iniciada.');
      handleSearchOS();
    } catch (err) {
      console.error('Erro ao aceitar escopo:', err);
      toast.error(err?.message || 'Erro ao registrar aceite da OS.');
    } finally {
      setActionLoading(null);
    }
  };

  // Declaração de entrega da OS (Check-out de Conclusão)
  const handleDeliverScopeSubmit = async () => {
    if (!deliveryNotesModalJob) return;
    const job = deliveryNotesModalJob;
    setActionLoading(job.id);
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('update_freelance_job_status_kiosk', {
        p_job_id: job.id,
        p_action: 'deliver_scope',
        p_notes: deliveryNotes.trim(),
      });

      if (rpcErr) {
        // Fallback
        const { error: directErr } = await supabase
          .from('freelance_jobs')
          .update({
            status: 'entregue',
            delivered_at: new Date().toISOString(),
            notes: job.notes ? `${job.notes}\n[Entrega]: ${deliveryNotes.trim()}` : `[Entrega]: ${deliveryNotes.trim()}`,
          })
          .eq('id', job.id);
        if (directErr) throw directErr;
      }

      toast.success('Entrega da OS declarada com sucesso! O supervisor fará a conferência.');
      setDeliveryNotesModalJob(null);
      setDeliveryNotes('');
      handleSearchOS();
    } catch (err) {
      console.error('Erro ao declarar entrega:', err);
      toast.error(err?.message || 'Erro ao declarar entrega da OS.');
    } finally {
      setActionLoading(null);
    }
  };

  // Impressão / Visualização de documento da OS
  const handlePrintDocument = (job, docType) => {
    try {
      let html = '';
      if (docType === 'ordem') {
        html = getFreelanceOrderHtml(freelancerData, job, currentUnit, branding);
      } else if (docType === 'contrato') {
        html = getFreelanceContractHtml(freelancerData, job, currentUnit, branding);
      } else if (docType === 'rpa') {
        html = getFreelanceRpaHtml(freelancerData, job, currentUnit, branding);
      }
      openPrintWindow(html);
    } catch (err) {
      toast.error('Erro ao gerar documento para visualização.');
    }
  };

  if (activeTab === 'register') {
    return (
      <FreelanceSelfRegistration
        units={units}
        branding={branding}
        onCancel={() => setActiveTab('os_control')}
        onSuccessRedirect={() => {
          setActiveTab('os_control');
        }}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Topo Navegação */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-md border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            title="Voltar ao Início"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-teal-100 text-teal-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                Módulo Freelance
              </span>
              <span className="text-xs text-gray-400">Grupo IB</span>
            </div>
            <h1 className="text-xl font-black text-gray-800 mt-0.5">Central Operacional de Freelancers</h1>
          </div>
        </div>

        {/* Botões de Ação Principal */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className="flex-1 sm:flex-initial bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <UserCheck size={16} /> Novo Cadastro Obrigatório
          </button>
        </div>
      </div>

      {/* Seletor de Unidade & Consulta por CPF */}
      <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
              <Building2 size={14} className="text-teal-600" /> Unidade da Operação
            </label>
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="w-full p-2.5 text-sm border border-gray-300 rounded-xl bg-white font-medium text-gray-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              {kioskUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.buttonLabel || u.id}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
              <Search size={14} className="text-teal-600" /> Consultar Minhas OS por CPF
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={cpfQuery}
                onChange={(e) => setCpfQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchOS()}
                placeholder="Digite seu CPF para buscar suas OS"
                className="flex-1 p-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium"
              />
              <button
                type="button"
                disabled={searching}
                onClick={() => handleSearchOS()}
                className="bg-gray-900 hover:bg-black text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Buscar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Resultados da Consulta */}
      {freelancerData && (
        <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-teal-900 shadow-sm">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-teal-950">{freelancerData.name}</span>
              <span className="bg-teal-200 text-teal-900 font-bold px-2 py-0.5 rounded-md text-[10px]">CPF: {freelancerData.cpf}</span>
            </div>
            <p className="text-teal-800">
              Área: <strong>{freelancerData.service_area || 'Geral'}</strong> • Declaração de Autonomia v1.0 Aceita em: {freelancerData.autonomy_accepted_at ? new Date(freelancerData.autonomy_accepted_at).toLocaleDateString('pt-BR') : 'Hoje'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className="text-[11px] font-bold text-teal-800 hover:text-teal-950 underline"
          >
            Atualizar Meus Dados
          </button>
        </div>
      )}

      {/* Lista de Ordens de Serviço (OS) para Controle Presencial */}
      {freelancerData && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <FileText size={18} className="text-teal-600" /> Ordens de Serviço (OS) do Dia e Recentes
          </h2>

          {jobs.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-500 border border-gray-200 space-y-3">
              <AlertCircle size={36} className="mx-auto text-gray-400" />
              <p className="font-medium text-sm">Nenhuma Ordem de Serviço (OS) cadastrada para este CPF nesta unidade.</p>
              <p className="text-xs text-gray-400">Solicite ao supervisor da unidade para emitir a OS de hoje.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {jobs.map((job) => {
                const meta = freelanceJobStatusMeta(job.status);
                return (
                  <div
                    key={job.id}
                    className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 hover:border-teal-200 transition-all space-y-4"
                  >
                    {/* Linha 1: Título e Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${meta.badge}`}>
                            {meta.label}
                          </span>
                          <span className="text-xs text-gray-400 font-mono">
                            {job.service_type}
                          </span>
                        </div>
                        <h3 className="font-extrabold text-gray-800 text-base mt-1">{job.title}</h3>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-xs text-gray-500 block">Valor Bruto (RPA)</span>
                        <span className="text-lg font-black text-emerald-600">
                          R$ {Number(job.gross_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Escopo e Datas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-600 bg-gray-50 p-3 rounded-xl">
                      <div>
                        <strong className="text-gray-800 block mb-0.5">Escopo de Atuação:</strong>
                        <p className="line-clamp-2">{job.scope}</p>
                      </div>
                      <div className="space-y-1">
                        <div><strong className="text-gray-800">Data Prevista:</strong> {job.scheduled_date ? new Date(`${job.scheduled_date}T00:00:00`).toLocaleDateString('pt-BR') : 'Hoje'}</div>
                        {job.accepted_at && <div><strong className="text-gray-800">Início / Aceite Presencial:</strong> {new Date(job.accepted_at).toLocaleString('pt-BR')}</div>}
                        {job.delivered_at && <div><strong className="text-gray-800">Entrega Declarada:</strong> {new Date(job.delivered_at).toLocaleString('pt-BR')}</div>}
                      </div>
                    </div>

                    {/* Painel de Controle Operacional da OS (Ações Presenciais no Dia) */}
                    <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Botão de Aceite de Escopo (Check-in de Início) */}
                        {(job.status === 'proposta' || job.status === 'rascunho') && (
                          <button
                            type="button"
                            disabled={actionLoading === job.id}
                            onClick={() => handleAcceptScope(job)}
                            className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {actionLoading === job.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                            Aceitar Escopo & Confirmar Presença no Local
                          </button>
                        )}

                        {/* Botão de Entrega (Check-out da OS) */}
                        {job.status === 'aceita' && (
                          <button
                            type="button"
                            disabled={actionLoading === job.id}
                            onClick={() => {
                              setDeliveryNotesModalJob(job);
                              setDeliveryNotes('');
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Sparkles size={14} /> Declarar Conclusão da OS (Entrega)
                          </button>
                        )}

                        {job.status === 'entregue' && (
                          <div className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                            <Clock size={14} /> Entrega enviada ao supervisor. Aguardando aceite de conferência.
                          </div>
                        )}

                        {job.status === 'aceito' && (
                          <div className="bg-teal-50 text-teal-800 border border-teal-200 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                            <CheckCircle2 size={14} /> Entrega conferida e aceita! Liberado para emissão do RPA.
                          </div>
                        )}

                        {job.status === 'pago' && (
                          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                            <CheckCircle2 size={14} /> Pago (RPA Nº {job.rpa_number || 'OK'}).
                          </div>
                        )}
                      </div>

                      {/* Ações de Visualização de Documentos */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handlePrintDocument(job, 'ordem')}
                          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Visualizar Ordem de Serviço (Ficha de Escopo)"
                        >
                          <FileText size={14} /> OS
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintDocument(job, 'contrato')}
                          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Visualizar Contrato por Escopo"
                        >
                          <FileSignature size={14} /> Contrato
                        </button>
                        {(job.status === 'aceito' || job.status === 'pago') && (
                          <button
                            type="button"
                            onClick={() => handlePrintDocument(job, 'rpa')}
                            className="p-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                            title="Visualizar Recibo de RPA"
                          >
                            <DollarSign size={14} /> RPA
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Conclusão / Entrega da OS */}
      {deliveryNotesModalJob && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2">
              Declarar Conclusão da OS — {deliveryNotesModalJob.title}
            </h3>

            <p className="text-xs text-gray-600">
              Descreva brevemente as entregas realizadas ou observações sobre o serviço executado presencialmente hoje.
            </p>

            <textarea
              rows={4}
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Ex.: Serviço de recreação do evento de 14h às 18h concluído com sucesso. Todos os materiais devolvidos em ordem."
              className="w-full p-3 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeliveryNotesModalJob(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={actionLoading === deliveryNotesModalJob.id}
                onClick={handleDeliverScopeSubmit}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading === deliveryNotesModalJob.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                Confirmar Entrega da OS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
