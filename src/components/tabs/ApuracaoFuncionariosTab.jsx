import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, Printer, Download, AlertTriangle } from 'lucide-react';
import { fetchCltMonthData, buildCltRows } from '../../utils/cltPayroll';
import { getEmployeeDocumentHtml, buildApuracaoCsv } from '../../utils/cltDocuments';
import { openPrintWindow } from '../../utils/documentPrint';
import { BRANDING } from '../../config/branding';
import { toast } from 'sonner';

// Apuração mensal de eventos (faltas, HE, adicional noturno, DSR) para a
// contabilidade. Deliberadamente NÃO calcula INSS/IRRF/FGTS/rescisão — ver
// aviso fixo abaixo e no template apuracao_mensal (cltDocuments.js).
export default function ApuracaoFuncionariosTab({ filterUnit, restrictedUnitIds = [], units = [] }) {
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthKey, setMonthKey] = useState(new Date().toISOString().slice(0, 7));

  const fetchAll = useCallback(async () => {
    try {
      const data = await fetchCltMonthData(monthKey, restrictedUnitIds);
      setEmployees(data.employees);
      setRecords(data.records);
      setAdjustments(data.adjustments);
      setHolidays(data.holidays);
      setOccurrences(data.occurrences);
    } catch (err) {
      console.error('Erro ao carregar apuração mensal:', err);
      toast.error('Erro ao carregar dados de apuração.');
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds, monthKey]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const rows = useMemo(
    () => buildCltRows({ employees, records, adjustments, holidays, occurrences }, monthKey, filterUnit),
    [employees, records, adjustments, holidays, occurrences, monthKey, filterUnit]
  );

  const unitName = (id) => units.find((u) => u.id === id)?.name || '—';

  const handlePrint = () => {
    const html = getEmployeeDocumentHtml('apuracao_mensal', {
      employee: null, unit: units.find((u) => u.id === filterUnit) || null, branding: BRANDING,
      dependents: [], extra: { competencia: monthKey, rows },
    });
    openPrintWindow(html, `Apuração Mensal ${monthKey}`);
  };

  const handleDownloadCsv = () => {
    const csv = buildApuracaoCsv(rows, monthKey);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apuracao_${monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <ClipboardList size={20} className="text-indigo-600" /> Apuração Mensal de Eventos
        </h2>
        <div className="flex items-center gap-2">
          <input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-xs" />
          <button onClick={handlePrint} className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1.5">
            <Printer size={13} /> Imprimir
          </button>
          <button onClick={handleDownloadCsv} className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5">
            <Download size={13} /> CSV
          </button>
        </div>
      </div>

      <div className="p-3 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
        <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-900">
          Documento de apoio à contabilidade: conta faltas, horas extras, adicional noturno e DSR perdidos, e desconta
          1/30 do salário-base declarado por dia de falta injustificada.
          <strong> Não calcula INSS, IRRF, FGTS, DSR em valor ou verbas de rescisão.</strong>
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <th className="p-3 font-semibold">Funcionário</th>
              <th className="p-3 font-semibold">Unidade</th>
              <th className="p-3 font-semibold">Salário / Dia (1/30)</th>
              <th className="p-3 font-semibold">Faltas Inj.</th>
              <th className="p-3 font-semibold">Faltas Just.</th>
              <th className="p-3 font-semibold">HE 50%</th>
              <th className="p-3 font-semibold">HE 100%</th>
              <th className="p-3 font-semibold">Noturno</th>
              <th className="p-3 font-semibold">DSR Perdidos</th>
              <th className="p-3 font-semibold text-right">Desconto Faltas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="p-8 text-center text-gray-400">Nenhum funcionário ativo para apurar.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-semibold text-gray-800">{r.name}</td>
                  <td className="p-3 text-gray-600">{unitName(r.unitId)}</td>
                  <td className="p-3 text-gray-600">
                    {r.baseSalary > 0 ? (
                      <>
                        {r.baseSalary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        <div className="text-[9px] text-gray-400">Dia: {r.dailyValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                      </>
                    ) : <span className="text-gray-400 italic">Sem salário cadastrado</span>}
                  </td>
                  <td className="p-3 text-gray-600">{r.absencesUnjustified}</td>
                  <td className="p-3 text-gray-600">{r.absencesJustified}</td>
                  <td className="p-3 text-gray-600">{r.extra50}</td>
                  <td className="p-3 text-gray-600">{r.extra100}</td>
                  <td className="p-3 text-gray-600">{r.nightReduced}</td>
                  <td className="p-3 text-gray-600">{r.dsrLostDays}</td>
                  <td className="p-3 text-right font-semibold text-red-700">
                    {r.absenceDeductionValue > 0
                      ? `- ${r.absenceDeductionValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                      : <span className="text-gray-400 italic font-normal">—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
