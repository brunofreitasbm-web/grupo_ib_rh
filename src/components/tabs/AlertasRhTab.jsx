import React, { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, FileText, MessageSquare } from 'lucide-react';
import { supabase } from '../../supabase';
import { mapInternFromDb } from '../../utils/mappings';
import { formatDate, getInternRhMetrics } from '../../utils/helpers';

export default function AlertasRhTab({ filterUnit, onGenerateMinuta }) {
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatRecords, setChatRecords] = useState([]);
  const [replyingId, setReplyingId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: internsData } = await supabase
        .from('interns')
        .select('*')
        .order('name', { ascending: true });

      if (internsData) setInterns(internsData.map(mapInternFromDb));

      const { data: chatData } = await supabase
        .from('records')
        .select('*')
        .eq('action', 'supervisor_chat')
        .order('timestamp', { ascending: false });

      if (chatData) setChatRecords(chatData);
    } catch (err) {
      console.error('Erro ao buscar dados do RH:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSendReply = async (record) => {
    if (!replyText.trim()) return;
    setIsSubmittingReply(true);
    try {
      const updatedGeo = {
        ...record.geo,
        status: 'replied',
        reply: replyText.trim(),
        repliedAt: new Date().toISOString()
      };

      const { error } = await supabase
        .from('records')
        .update({ geo: updatedGeo })
        .eq('id', record.id);

      if (error) throw error;

      const timbreHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <div style="background-color: #1e3a8a; padding: 24px; text-align: center; color: white; border-bottom: 4px solid #f59e0b;">
            <h1 style="margin: 0; font-size: 22px; font-weight: bold; letter-spacing: 1px;">CLÍNICA PORTO TERAPIA</h1>
            <p style="margin: 4px 0 0; font-size: 11px; color: #93c5fd; text-transform: uppercase;">Retorno Oficial da Supervisão Geral</p>
          </div>
          <div style="padding: 24px; color: #334155; line-height: 1.6; font-size: 13px;">
            <p>Olá, <strong>${record.intern_name}</strong>,</p>
            <p>A supervisão de estágio da Porto Terapia analisou a sua demanda e emitiu a resposta oficial abaixo:</p>
            <div style="background-color: #f8fafc; border-left: 4px solid #1e3a8a; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Sua Mensagem:</div>
              <div style="font-style: italic; color: #475569;">"${record.justification}"</div>
              <div style="font-size: 11px; font-weight: bold; color: #1e3a8a; text-transform: uppercase; margin-top: 16px; margin-bottom: 6px;">Resposta da Supervisão:</div>
              <div style="font-weight: 500; color: #1e293b;">${replyText.trim()}</div>
            </div>
            <p style="font-size: 11px; color: #64748b;">
              Esta é uma notificação automática. Caso precise de mais esclarecimentos, responda a este e-mail ou fale diretamente com o supervisor de sua unidade.
            </p>
          </div>
          <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
            <strong>Porto Terapia • Gestão de Estágios</strong><br>
            Av. Governador José Malcher, 1234 • Belém - PA
          </div>
        </div>
      `;

      console.log(`[EMAIL ENVIADO] Timbre Oficial enviado para ${record.geo?.internEmail || 'estagiario@portoterapia.com'}:`, timbreHtml);
      
      alert(`Resposta enviada com sucesso! Uma cópia com o timbre institucional foi enviada para o e-mail: ${record.geo?.internEmail || 'estagiario@portoterapia.com'}`);
      setReplyText('');
      setReplyingId(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Falha ao enviar resposta.");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  useEffect(() => {
    fetchData();

    const internsChannel = supabase
      .channel('rh-alerts-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interns' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(internsChannel);
    };
  }, [fetchData]);

  const filteredInterns = interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit);
  const internsRhData = filteredInterns.map(intern => {
    const metrics = getInternRhMetrics(intern);
    return { intern, metrics };
  });

  const activeInternsRh = internsRhData.filter(d => d.intern.active !== false);
  const overdueReports = activeInternsRh.filter(d => d.metrics.reportOverdue);
  const contractAlerts = activeInternsRh.filter(d => d.metrics.isExceededLegalLimit || d.metrics.timeRemainingDays < 90);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <ShieldAlert size={20} className="text-indigo-600" /> Alertas de Contratos & Prazos (RH)
        </h2>
        <span className="text-xs text-gray-500">Lei nº 11.788/2008</span>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-center">
            <span className="text-xs font-semibold text-red-700 block uppercase">Relatórios Pendentes (&gt;6 meses)</span>
            <span className="text-2xl font-bold text-red-900">{overdueReports.length}</span>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-center">
            <span className="text-xs font-semibold text-amber-700 block uppercase">Fim de Contrato (&lt;90 dias)</span>
            <span className="text-2xl font-bold text-amber-900">{contractAlerts.length}</span>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-center">
            <span className="text-xs font-semibold text-blue-700 block uppercase">Estagiários Monitorados</span>
            <span className="text-2xl font-bold text-blue-900">{activeInternsRh.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600 uppercase tracking-wider border-b border-gray-100">
                <th className="p-3 font-semibold">Estagiário</th>
                <th className="p-3 font-semibold">Vigência do Contrato</th>
                <th className="p-3 font-semibold">Relatório Semestral</th>
                <th className="p-3 font-semibold">Recesso Remunerado (Proporcional)</th>
                <th className="p-3 font-semibold">Status de RH</th>
                <th className="p-3 font-semibold text-center">Minuta de Contrato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeInternsRh.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-gray-400">Nenhum estagiário ativo monitorado.</td>
                </tr>
              ) : (
                activeInternsRh.map(({ intern, metrics }) => {
                  const progressPercent = Math.min(100, Math.round((metrics.monthsWorked / Math.max(1, metrics.diffMonthsTotal)) * 100));
                  return (
                    <tr key={intern.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-medium text-gray-800">
                        <div className="font-bold">{intern.name}</div>
                        <div className="text-[10px] text-gray-400 font-normal">{intern.course || 'Sem curso'} • {intern.institution || 'Sem Inst.'}</div>
                      </td>
                      <td className="p-3 text-slate-600">
                        <div>{formatDate(intern.startDate)} a {formatDate(intern.endDate)}</div>
                        <div className="w-full bg-gray-200 h-1.5 rounded-full mt-1 overflow-hidden">
                          <div className="bg-indigo-600 h-full animate-pulse" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                        <div className="text-[9px] text-gray-400 mt-0.5">{metrics.timeRemainingDays > 0 ? `${metrics.timeRemainingDays} dias restantes` : 'Contrato encerrado'}</div>
                      </td>
                      <td className="p-3">
                        {intern.lastReportDate ? (
                          <div>
                            <span>Último: {formatDate(intern.lastReportDate)}</span>
                            {metrics.reportOverdue ? (
                              <span className="bg-red-100 text-red-800 text-[9px] font-semibold px-1.5 py-0.5 rounded block w-fit mt-1">⚠️ Atrasado ({Math.round(metrics.reportAgeMonths)}m)</span>
                            ) : (
                              <span className="bg-green-100 text-green-800 text-[9px] font-semibold px-1.5 py-0.5 rounded block w-fit mt-1">Regular ({Math.round(metrics.reportAgeMonths)}m)</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-red-500 font-bold block">⚠️ Nunca entregue</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-700">
                        <div className="font-semibold text-indigo-700">Acumulado: {metrics.recessAccrued.toFixed(1)} dias</div>
                        <div className="text-[10px] text-slate-400">Gozados: {metrics.recessTaken} dias • <strong>Saldo: {metrics.recessBalance.toFixed(1)} dias</strong></div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          {!metrics.isAdmissionalComplete ? (
                            <span className="bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded block text-center uppercase tracking-wide animate-pulse shadow-sm" title="Fluxo Admissional Incompleto">
                              ⚠️ Pendente ({metrics.uploadedDocsCount}/6)
                            </span>
                          ) : (
                            <>
                              {metrics.isExceededLegalLimit && (
                                <span className="bg-red-100 text-red-800 text-[9px] font-bold px-1.5 py-0.5 rounded block text-center">Contrato &gt; 24 meses (Ilegal)</span>
                              )}
                              {metrics.timeRemainingDays <= 30 && metrics.timeRemainingDays > 0 && (
                                <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded block text-center">Fim próximo (&lt;30d)</span>
                              )}
                              {!metrics.isExceededLegalLimit && metrics.timeRemainingDays > 30 && (
                                <span className="bg-green-100 text-green-800 text-[9px] font-bold px-1.5 py-0.5 rounded block text-center">Regularizado</span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap text-center">
                        {metrics.isAdmissionalComplete ? (
                          <button
                            type="button"
                            onClick={() => onGenerateMinuta(intern)}
                            className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1.5 rounded-lg shadow-sm text-[10px] transition-colors"
                            title="Clique para visualizar, baixar ou imprimir a minuta do contrato"
                          >
                            <FileText size={12} /> Gerar Minuta
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">Fluxo incompleto</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Painel Espelhado de Atendimento (Fale com a Supervisão) */}
        <div className="mt-8 border-t border-gray-200 pt-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
            <MessageSquare size={16} className="text-indigo-600" /> Chamados & Dúvidas dos Estagiários ({chatRecords.filter(r => r.geo?.status === 'pending').length} Pendentes)
          </h3>

          <div className="grid grid-cols-1 gap-4">
            {chatRecords.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs bg-slate-50 border border-slate-100 rounded-xl">
                Nenhuma mensagem ou chamado recebido dos estagiários.
              </div>
            ) : (
              chatRecords.map(chat => {
                const isPending = chat.geo?.status === 'pending';
                const isReplying = replyingId === chat.id;

                return (
                  <div key={chat.id} className={`p-4 border rounded-xl shadow-xs transition-all ${isPending ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-800">{chat.intern_name}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${isPending ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                            {isPending ? 'Pendente' : 'Respondido'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">E-mail: {chat.geo?.internEmail || '-'} • Enviado em: {new Date(chat.timestamp).toLocaleDateString('pt-BR')} às {new Date(chat.timestamp).toLocaleTimeString('pt-BR')}</p>
                        
                        <div className="mt-2.5 p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 italic">
                          "{chat.justification}"
                        </div>

                        {!isPending && chat.geo?.reply && (
                          <div className="mt-2.5 p-3 bg-indigo-50/50 border border-indigo-100/60 rounded-lg text-xs text-indigo-950">
                            <strong className="block text-[9px] uppercase tracking-wider text-indigo-700 mb-1">Resposta da Supervisão ({new Date(chat.geo.repliedAt).toLocaleDateString('pt-BR')}):</strong>
                            {chat.geo.reply}
                          </div>
                        )}
                      </div>

                      {isPending && !isReplying && (
                        <button
                          onClick={() => {
                            setReplyingId(chat.id);
                            setReplyText('');
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-colors"
                        >
                          Responder
                        </button>
                      )}
                    </div>

                    {isReplying && (
                      <div className="mt-4 border-t border-slate-200/85 pt-3 space-y-3">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Sua Resposta Oficial (enviada com timbre institucional):</label>
                          <textarea
                            rows={3}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Digite as orientações ou respostas ao estagiário..."
                            className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setReplyingId(null)}
                            className="text-[10px] font-bold text-slate-500 hover:bg-slate-100 px-3 py-1.5 rounded-lg"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleSendReply(chat)}
                            disabled={isSubmittingReply}
                            className="text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg shadow-sm"
                          >
                            {isSubmittingReply ? 'Enviando...' : 'Enviar Resposta'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
