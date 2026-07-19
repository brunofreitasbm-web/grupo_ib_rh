import React, { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, FileText } from 'lucide-react';
import { supabase } from '../../supabase';
import { mapInternFromDb } from '../../utils/mappings';
import { formatDate, getInternRhMetrics } from '../../utils/helpers';

export default function AlertasRhTab({ filterUnit, onGenerateMinuta }) {
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const { data: internsData } = await supabase
        .from('interns')
        .select('*')
        .order('name', { ascending: true });

      if (internsData) setInterns(internsData.map(mapInternFromDb));
    } catch (err) {
      console.error('Erro ao buscar dados do RH:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const internsChannel = supabase
      .channel('rh-alerts-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interns' }, () => {
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
      </div>
    </div>
  );
}
