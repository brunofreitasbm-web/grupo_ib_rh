import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { fetchCltMonthData, buildCltRows } from '../../utils/cltPayroll';
import { fmtBRL, printPayrollDocument } from '../../utils/payrollShared';
import { escapeHtmlForDocument as esc } from '../../utils/helpers';

// Folha CLT: reaproveita a apuração mensal (cltPayroll) — salário-base menos
// 1/30 por falta injustificada. Não calcula INSS/IRRF/FGTS/DSR em valor; isso
// segue com a contabilidade.
export default function FolhaCltPanel({ monthKey, filterUnit, restrictedUnitIds = [], units = [] }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchCltMonthData(monthKey, restrictedUnitIds));
    } catch (err) {
      console.error('Erro ao carregar folha CLT:', err);
      toast.error('Erro ao carregar dados da folha CLT.');
    } finally {
      setLoading(false);
    }
  }, [monthKey, restrictedUnitIds]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(
    () => (data ? buildCltRows(data, monthKey, filterUnit) : []),
    [data, monthKey, filterUnit]
  );
  const total = useMemo(() => rows.reduce((s, r) => s + r.payAfterAbsences, 0), [rows]);
  const unitName = (id) => units.find((u) => u.id === id)?.name || '—';

  const handleEmitir = () => {
    const [y, m] = monthKey.split('-');
    const body = `
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:30px;">
        <thead>
          <tr style="background:#f1f5f9;color:#334155;text-transform:uppercase;font-size:10px;border-bottom:2px solid #cbd5e1;">
            <th style="padding:8px;text-align:left;">Nome Completo</th>
            <th style="padding:8px;text-align:left;">CPF</th>
            <th style="padding:8px;text-align:left;">Banco / Pix</th>
            <th style="padding:8px;text-align:right;">Salário-base</th>
            <th style="padding:8px;text-align:center;">Faltas / Desconto (1/30)</th>
            <th style="padding:8px;text-align:right;">Valor Final Devido</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length === 0
            ? '<tr><td colspan="6" style="padding:20px;text-align:center;color:#94a3b8;">Nenhum funcionário listado no período.</td></tr>'
            : rows.map((r, i) => `
              <tr style="border-bottom:1px solid #e2e8f0;background:${i % 2 === 0 ? '#fff' : '#f8fafc'};">
                <td style="padding:8px;font-weight:bold;">${esc(r.name)}</td>
                <td style="padding:8px;">${esc(r.cpf) || '—'}</td>
                <td style="padding:8px;word-break:break-all;">${esc([r.bankName, r.bankAgency && `Ag ${r.bankAgency}`, r.bankAccount && `Cc ${r.bankAccount}`, r.pixKey && `Pix ${r.pixKey}`].filter(Boolean).join(' • ')) || '—'}</td>
                <td style="padding:8px;text-align:right;">${fmtBRL(r.baseSalary)}</td>
                <td style="padding:8px;text-align:center;color:#b91c1c;">${r.absencesUnjustified > 0 ? `${r.absencesUnjustified}d • - ${fmtBRL(r.absenceDeductionValue)}` : '—'}</td>
                <td style="padding:8px;text-align:right;font-weight:bold;">${fmtBRL(r.payAfterAbsences)}</td>
              </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#e2e8f0;font-weight:bold;border-top:2px solid #94a3b8;">
            <td colspan="5" style="padding:10px;text-align:right;text-transform:uppercase;font-size:11px;">TOTAL GERAL A PAGAR:</td>
            <td style="padding:10px;text-align:right;font-size:13px;">${fmtBRL(total)}</td>
          </tr>
        </tfoot>
      </table>`;
    printPayrollDocument({
      title: 'Folha de Pagamento de Funcionários CLT',
      subtitle: `Mês/Ano de Referência: ${m}/${y}`,
      bodyHtml: body,
    });
  };

  return (
    <>
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-slate-600">
          Salário-base ÷ 30 = valor do dia; cada falta injustificada desconta 1/30. <strong>Não calcula INSS, IRRF, FGTS ou DSR em valor</strong> (contabilidade).
        </p>
        <button
          onClick={handleEmitir}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
        >
          <Printer size={15} /> Emitir Folha CLT
        </button>
      </div>
      <div className="p-4">
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3.5 py-2 text-right mb-4 inline-block float-right">
          <span className="text-[10px] text-indigo-700 uppercase tracking-wider font-semibold block">Total Geral CLT</span>
          <span className="text-base font-bold text-indigo-950">{fmtBRL(total)}</span>
        </div>
        <div className="overflow-x-auto border border-gray-100 rounded-xl clear-both">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600 uppercase tracking-wider border-b border-gray-100">
                <th className="p-3 font-semibold">Funcionário</th>
                <th className="p-3 font-semibold">Unidade</th>
                <th className="p-3 font-semibold text-right">Salário-base</th>
                <th className="p-3 font-semibold text-center">Faltas Inj.</th>
                <th className="p-3 font-semibold text-right">Desconto (1/30)</th>
                <th className="p-3 font-semibold text-right">Valor Final Devido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="p-6 text-center text-gray-400">Carregando…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-gray-400">Nenhum funcionário ativo correspondente aos filtros.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-gray-800">
                    {r.name}
                    {r.cpf && <div className="text-[10px] text-gray-400 font-normal">CPF: {r.cpf}</div>}
                  </td>
                  <td className="p-3 text-slate-600">{unitName(r.unitId)}</td>
                  <td className="p-3 text-right">
                    {r.baseSalary > 0 ? fmtBRL(r.baseSalary) : <span className="text-gray-400 italic">Sem salário cadastrado</span>}
                  </td>
                  <td className="p-3 text-center">{r.absencesUnjustified}</td>
                  <td className="p-3 text-right font-semibold text-red-700">
                    {r.absenceDeductionValue > 0 ? `- ${fmtBRL(r.absenceDeductionValue)}` : <span className="text-gray-400 italic font-normal">—</span>}
                  </td>
                  <td className="p-3 text-right font-bold text-gray-900 text-sm">{fmtBRL(r.payAfterAbsences)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
