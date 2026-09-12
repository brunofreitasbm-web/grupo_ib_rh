import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Timer, Printer, Download, FileText, Building2, Upload, Eye, Trash2, CheckCircle2, Plus, DollarSign, Calendar, Tag, AlertCircle } from 'lucide-react';
import { supabase } from '../../supabase';
import { mapInternFromDb, mapRecordFromDb, mapUnitFromDb, INTERN_SELECT_FIELDS } from '../../utils/mappings';
import { BRANDING } from '../../config/branding';
import { dailyPayRate, absenceDeduction, payAfterAbsences } from '../../utils/cltCalculations';
import PublicPayrollUploadModal from '../PublicPayrollUploadModal';
import PayrollPdfViewerModal from '../PayrollPdfViewerModal';
import { toast } from 'sonner';
import { sanitizeHtml } from '../../utils/sanitizeHtml';

export default function FinanceiroTab({ filterUnit, restrictedUnitIds = [] }) {
  const [interns, setInterns] = useState([]);
  const [records, setRecords] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterFinanceMonth, setFilterFinanceMonth] = useState(new Date().toISOString().substring(0, 7));
  const [activeSubTab, setActiveSubTab] = useState('estagiarios'); // 'estagiarios' | 'folhas_unidades'
  const [payrolls, setPayrolls] = useState([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [viewingPayrollDoc, setViewingPayrollDoc] = useState(null);
  const [uploadUnitTarget, setUploadUnitTarget] = useState('');

  const fetchPayrolls = useCallback(async () => {
    try {
      let remotePayrolls = [];
      const { data: dbData, error: dbError } = await supabase
        .from('unit_payroll_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (!dbError && dbData) {
        remotePayrolls = dbData.map(item => ({
          id: item.id,
          unit_id: item.unit_id || item.meta?.unit_id,
          unit_name: item.meta?.unit_name || item.unit_id,
          competencia: item.meta?.competencia,
          valor: Number(item.meta?.valor) || 0,
          tipo_folha: item.meta?.tipo_folha || 'mensal',
          data_pagamento: item.meta?.data_pagamento,
          observacoes: item.meta?.observacoes,
          file_name: item.meta?.file_name || 'folha.pdf',
          file_size: item.meta?.file_size || '—',
          content: item.content,
          uploaded_by: item.meta?.uploaded_by || 'Contador (Senoguin)',
          status: item.meta?.status || 'pendente',
          created_at: item.created_at || item.meta?.created_at
        }));
      }

      // Lê fallback local
      let localPayrolls = [];
      try {
        const localStr = localStorage.getItem('local_payroll_documents') || '[]';
        localPayrolls = JSON.parse(localStr);
      } catch (e) {
        console.error('Erro ao ler folhas locais:', e);
      }

      // Consolida sem duplicatas por ID
      const mapById = new Map();
      [...remotePayrolls, ...localPayrolls].forEach(p => {
        if (p && p.id && !mapById.has(p.id)) {
          mapById.set(p.id, p);
        }
      });

      setPayrolls(Array.from(mapById.values()));
    } catch (err) {
      console.error('Erro ao buscar folhas de pagamento:', err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const { data: internsData } = await supabase
        .from('interns')
        .select(INTERN_SELECT_FIELDS)
        .order('name', { ascending: true });

      const { data: unitsData } = await supabase
        .from('units')
        .select('*');

      // Fetch records for the selected month to keep queries lightweight
      const { data: recordsData } = await supabase
        .from('records')
        .select('id, intern_id, intern_name, action, timestamp, justification, is_manual, geo, days_away')
        .gte('timestamp', `${filterFinanceMonth}-01T00:00:00`)
        .order('timestamp', { ascending: false });

      if (internsData) setInterns(internsData.map(mapInternFromDb).filter(i => !restrictedUnitIds.includes(i.unitId)));
      if (unitsData) setUnits(unitsData.map(mapUnitFromDb).filter(u => !restrictedUnitIds.includes(u.id)));
      if (recordsData) setRecords(recordsData.map(mapRecordFromDb));

      await fetchPayrolls();
    } catch (err) {
      console.error('Erro ao carregar dados do financeiro:', err);
    } finally {
      setLoading(false);
    }
  }, [filterFinanceMonth, restrictedUnitIds, fetchPayrolls]);

  useEffect(() => {
    fetchData();

    const internsChannel = supabase
      .channel('financeiro-interns-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interns' }, () => {
        fetchData();
      })
      .subscribe();

    const recordsChannel = supabase
      .channel('financeiro-records-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(internsChannel);
      supabase.removeChannel(recordsChannel);
    };
  }, [fetchData]);

  const unitName = (id) => units.find(u => u.id === id)?.name || '—';

  const monthKey = filterFinanceMonth || new Date().toISOString().substring(0, 7);
  const [year, month] = monthKey.split('-').map(Number);

  const firstDayOfMonthStr = `${year}-${month.toString().padStart(2, '0')}-01`;
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const lastDayOfMonthStr = `${year}-${month.toString().padStart(2, '0')}-${lastDayOfMonth.toString().padStart(2, '0')}`;

  const getEffectiveEnd = (i) => {
    if (i.contractTermination && i.contractTermination.date) {
      return i.contractTermination.date;
    }
    return i.endDate || '9999-12-31';
  };

  const filteredInterns = useMemo(() => {
    return interns.filter(i => {
      if (filterUnit !== 'all' && i.unitId !== filterUnit) return false;
      const start = i.startDate || '0000-01-01';
      const end = getEffectiveEnd(i);
      return (start <= lastDayOfMonthStr) && (end >= firstDayOfMonthStr);
    });
  }, [interns, filterUnit, firstDayOfMonthStr, lastDayOfMonthStr]);

  const calculatedInterns = useMemo(() => {
    return filteredInterns.map(intern => {
      const allowance = Number(intern.allowance) || 0;
      const internRecords = records.filter(r => {
        if (r.internId !== intern.id) return false;
        if (!r.timestamp) return false;
        const dateStr = typeof r.timestamp === 'string' ? r.timestamp : new Date(r.timestamp).toISOString();
        const recordYearMonth = dateStr.substring(0, 7);
        return recordYearMonth === monthKey && (r.justification || (r.justificationDoc && Object.keys(r.justificationDoc).length > 0));
      });

      let medicalDays = 0;
      let deductibleDays = 0;
      const occurrenceDetails = [];

      internRecords.forEach(r => {
        const type = r.justificationDoc?.type || 'outros';
        const isMedical = type === 'atestado' || (r.justification && r.justification.toLowerCase().includes('atestado'));
        const days = Number(r.daysAway) || 0;

        if (isMedical) {
          medicalDays += days;
        } else {
          deductibleDays += days;
        }

        occurrenceDetails.push({
          date: new Date(r.timestamp).toLocaleDateString('pt-BR'),
          type: isMedical ? 'Atestado Médico' : (type === 'curso' ? 'Curso' : (type === 'academico' ? 'Acadêmico' : 'Outros')),
          desc: r.justification || 'Sem descrição',
          days,
          isMedical
        });
      });

      // Regra de negócio: 1/30 da bolsa declarada por dia de ausência não
      // justificada (dailyPayRate/absenceDeduction em cltCalculations).
      const dailyValue = dailyPayRate(allowance);
      const deductionValue = absenceDeduction(allowance, deductibleDays);
      const finalPayment = payAfterAbsences(allowance, deductibleDays);

      return {
        intern,
        allowance,
        medicalDays,
        deductibleDays,
        dailyValue,
        deductionValue,
        occurrenceDetails,
        finalPayment
      };
    });
  }, [filteredInterns, records, monthKey]);

  const filteredPayrolls = useMemo(() => {
    return payrolls.filter(p => {
      if (filterUnit !== 'all' && p.unit_id !== filterUnit) return false;
      if (filterFinanceMonth && p.competencia && p.competencia !== filterFinanceMonth) return false;
      return true;
    });
  }, [payrolls, filterUnit, filterFinanceMonth]);

  const payrollsSummary = useMemo(() => {
    const totalCount = filteredPayrolls.length;
    const totalValue = filteredPayrolls.reduce((sum, p) => sum + (Number(p.valor) || 0), 0);
    const pendentesCount = filteredPayrolls.filter(p => p.status === 'pendente' || p.status === 'semipronto').length;
    return { totalCount, totalValue, pendentesCount };
  }, [filteredPayrolls]);

  const handleDeletePayroll = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta folha de pagamento?')) return;

    try {
      // Deleta localmente
      try {
        const localStr = localStorage.getItem('local_payroll_documents') || '[]';
        const localList = JSON.parse(localStr).filter(p => p.id !== id);
        localStorage.setItem('local_payroll_documents', JSON.stringify(localList));
      } catch (e) {
        console.error('Erro ao deletar localmente:', e);
      }

      // Deleta no Supabase se existir
      await supabase.from('unit_payroll_documents').delete().eq('id', id);

      setPayrolls(prev => prev.filter(p => p.id !== id));
      toast.success('Folha de pagamento excluída com sucesso.');
    } catch (err) {
      console.error('Erro ao excluir folha:', err);
      toast.error('Erro ao excluir folha de pagamento.');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      // Atualiza localmente
      try {
        const localStr = localStorage.getItem('local_payroll_documents') || '[]';
        const localList = JSON.parse(localStr).map(p => p.id === id ? { ...p, status: newStatus } : p);
        localStorage.setItem('local_payroll_documents', JSON.stringify(localList));
      } catch (e) {
        console.error('Erro ao atualizar status local:', e);
      }

      // Atualiza no Supabase
      const target = payrolls.find(p => p.id === id);
      if (target) {
        await supabase
          .from('unit_payroll_documents')
          .update({ meta: { ...target, status: newStatus } })
          .eq('id', id);
      }

      setPayrolls(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
      toast.success(`Status da folha atualizado para "${newStatus.toUpperCase()}".`);
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      toast.error('Erro ao atualizar status.');
    }
  };

  const totalPayrollValue = useMemo(() => {
    return calculatedInterns.reduce((sum, item) => sum + item.finalPayment, 0);
  }, [calculatedInterns]);

  const handleEmitirFolha = () => {
    const formattedMonth = `${month.toString().padStart(2, '0')}/${year}`;
    const selectedUnitObj = units.find(u => u.id === filterUnit);
    const unitSubtitle = selectedUnitObj ? ` - Unidade ${selectedUnitObj.name}` : '';

    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR');
    const formattedTime = now.toLocaleTimeString('pt-BR');
    const emissionTimestamp = `Emitido em: ${formattedDate} às ${formattedTime}`;

    const documentHtml = `
      <div style="font-family: Arial, sans-serif; color: #1e293b; padding: 25px; max-width: 900px; margin: 0 auto; background: #fff;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 15px;">
            ${BRANDING.logoPath ? `<img src="${BRANDING.logoPath}" alt="${BRANDING.logoAlt}" style="height: 60px; object-fit: contain;" />` : ''}
            <div>
              <h1 style="margin: 0; font-size: 20px; color: #1e3a8a; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">${BRANDING.displayName}</h1>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Clínica Interdisciplinar Infantil${unitSubtitle}</p>
            </div>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block;">Documento Oficial</span>
            <span style="font-size: 11px; color: #334155; font-weight: 600;">${emissionTimestamp}</span>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 25px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <h2 style="margin: 0; font-size: 18px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">FOLHA DE PAGAMENTO DE ESTAGIÁRIOS</h2>
          <p style="margin: 5px 0 0 0; font-size: 13px; color: #2563eb; font-weight: bold;">Mês/Ano de Referência: ${formattedMonth}</p>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; background: #eff6ff; border: 1px solid #bfdbfe; padding: 12px 18px; border-radius: 8px; margin-bottom: 20px;">
          <div>
            <span style="font-size: 11px; color: #1e40af; font-weight: bold; text-transform: uppercase; display: block;">Total de Estagiários</span>
            <span style="font-size: 14px; font-weight: bold; color: #1e3a8a;">${calculatedInterns.length} ${calculatedInterns.length === 1 ? 'estagiário' : 'estagiários'}</span>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 11px; color: #1e40af; font-weight: bold; text-transform: uppercase; display: block;">Valor Total da Folha</span>
            <span style="font-size: 18px; font-weight: bold; color: #1e3a8a;">
              ${totalPayrollValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f1f5f9; color: #334155; text-transform: uppercase; font-size: 10px; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 8px; text-align: left;">Nome Completo</th>
              <th style="padding: 8px; text-align: left;">CPF</th>
              <th style="padding: 8px; text-align: left;">Banco</th>
              <th style="padding: 8px; text-align: center;">Agência</th>
              <th style="padding: 8px; text-align: center;">Conta (CC)</th>
              <th style="padding: 8px; text-align: left;">Chave Pix</th>
              <th style="padding: 8px; text-align: center;">Faltas / Desconto (1/30)</th>
              <th style="padding: 8px; text-align: right;">Valor Final Devido</th>
            </tr>
          </thead>
          <tbody>
            ${calculatedInterns.length === 0 ? `
              <tr>
                <td colspan="8" style="padding: 20px; text-align: center; color: #94a3b8; italic;">Nenhum estagiário listado no período.</td>
              </tr>
            ` : calculatedInterns.map((item, idx) => `
              <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 8px; font-weight: bold; color: #0f172a;">${item.intern.name}</td>
                <td style="padding: 8px; color: #475569;">${item.intern.cpf || '—'}</td>
                <td style="padding: 8px; color: #475569;">${item.intern.bankName || '—'}</td>
                <td style="padding: 8px; text-align: center; color: #475569;">${item.intern.bankAgency || '—'}</td>
                <td style="padding: 8px; text-align: center; color: #475569;">${item.intern.bankAccount || '—'}</td>
                <td style="padding: 8px; color: #475569; word-break: break-all;">${item.intern.pixKey || '—'}</td>
                <td style="padding: 8px; text-align: center; color: #b91c1c;">${item.deductibleDays > 0 ? `${item.deductibleDays}d • - ${item.deductionValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : '—'}</td>
                <td style="padding: 8px; text-align: right; font-weight: bold; color: #0f172a; font-size: 12px;">
                  ${item.finalPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #e2e8f0; font-weight: bold; border-top: 2px solid #94a3b8;">
              <td colspan="7" style="padding: 10px; text-align: right; text-transform: uppercase; font-size: 11px; color: #1e293b;">TOTAL GERAL A PAGAR:</td>
              <td style="padding: 10px; text-align: right; font-size: 13px; color: #1e3a8a;">
                ${totalPayrollValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top: 50px; display: flex; justify-content: space-between; gap: 40px; page-break-inside: avoid;">
          <div style="flex: 1; text-align: center; border-top: 1px solid #94a3b8; padding-top: 8px;">
            <p style="margin: 0; font-size: 11px; font-weight: bold; color: #334155;">Gestão Financeira / RH</p>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">${BRANDING.displayName}</p>
          </div>
          <div style="flex: 1; text-align: center; border-top: 1px solid #94a3b8; padding-top: 8px;">
            <p style="margin: 0; font-size: 11px; font-weight: bold; color: #334155;">Direção Geral</p>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">Aprovação de Pagamentos</p>
          </div>
        </div>
      </div>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita popups para gerar a Folha de Pagamento em PDF.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Folha de Pagamento - ${BRANDING.displayName} (${formattedMonth})</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              @page { size: A4 portrait; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          ${sanitizeHtml(documentHtml)}
        </body>
      </html>
    `);
    printWindow.document.close();
    // Disparado pela janela que abriu, não por atributo onload inline no HTML
    // gerado (compatível com CSP sem 'unsafe-inline' em script-src). Mesmo
    // comportamento de antes.
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getTipoFolhaLabel = (tipo) => {
    switch (tipo) {
      case 'mensal': return 'Folha Mensal Regular';
      case 'decimo_terceiro': return '13º Salário';
      case 'adiantamento': return 'Adiantamento Salarial';
      case 'rescisao': return 'Rescisão contratual';
      case 'encargos': return 'Encargos / FGTS';
      default: return 'Folha de Pagamento';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden space-y-0">
      {/* Sub-Navegação do Financeiro */}
      <div className="p-4 border-b border-gray-200 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-white">
            <Timer size={22} className="text-indigo-400" /> Gestão Financeira & Folhas de Pagamento
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Controle de bolsas de estagiários e upload de folhas de pagamento em PDF por unidade ({BRANDING.shortName})
          </p>
        </div>

        {/* Botoes de Sub-Aba */}
        <div className="flex items-center gap-2 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setActiveSubTab('estagiarios')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeSubTab === 'estagiarios'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Timer size={15} />
            Folha de Estagiários
          </button>
          <button
            onClick={() => setActiveSubTab('folhas_unidades')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeSubTab === 'folhas_unidades'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <FileText size={15} />
            Folhas por Unidade (Contador)
            {payrollsSummary.pendentesCount > 0 && (
              <span className="bg-amber-500 text-slate-950 font-extrabold text-[10px] px-1.5 py-0.2 rounded-full">
                {payrollsSummary.pendentesCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* SUB-ABA 1: CÁLCULO DE ESTAGIÁRIOS */}
      {activeSubTab === 'estagiarios' && (
        <>
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">Competência:</span>
              <input
                type="month"
                value={filterFinanceMonth}
                onChange={(e) => setFilterFinanceMonth(e.target.value)}
                className="p-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={handleEmitirFolha}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Printer size={15} /> Emitir Relatório da Folha de Estagiários
            </button>
          </div>

          <div className="p-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-xs text-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <p><strong>Período de Referência:</strong> {month.toString().padStart(2, '0')}/{year} • <strong>Base de cálculo:</strong> bolsa declarada ÷ 30 dias = valor do dia.</p>
                <p className="mt-1 text-slate-500"><strong>Regra de Negócio:</strong> Atestados Médicos (com comprovante) abonam faltas e não possuem desconto. Cada dia de falta ou ausência não justificada desconta 1/30 da bolsa declarada.</p>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3.5 py-2 text-right shrink-0">
                <span className="text-[10px] text-indigo-700 uppercase tracking-wider font-semibold block">Total Geral de Bolsas</span>
                <span className="text-base font-bold text-indigo-950">
                  {totalPayrollValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 uppercase tracking-wider border-b border-gray-100">
                    <th className="p-3 font-semibold">Estagiário</th>
                    <th className="p-3 font-semibold">Unidade</th>
                    <th className="p-3 font-semibold">Bolsa/Auxílio</th>
                    <th className="p-3 font-semibold">Ocorrências do Mês</th>
                    <th className="p-3 font-semibold text-center">Dias Descontados</th>
                    <th className="p-3 font-semibold text-right">Desconto (1/30)</th>
                    <th className="p-3 font-semibold text-right">Valor Final Devido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {calculatedInterns.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-4 text-center text-gray-400">Nenhum estagiário correspondente aos filtros.</td>
                    </tr>
                  ) : (
                    calculatedInterns.map(({ intern, allowance, medicalDays, deductibleDays, dailyValue, deductionValue, occurrenceDetails, finalPayment }) => {
                      return (
                        <tr key={intern.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-medium text-gray-800">
                            <div className="font-bold">{intern.name}</div>
                            {intern.cpf && <div className="text-[10px] text-gray-400 font-normal">CPF: {intern.cpf}</div>}
                            {intern.bankName && <div className="text-[9px] text-gray-400 font-normal">{intern.bankName} • Ag {intern.bankAgency} • Cc {intern.bankAccount} {intern.pixKey ? `• Pix: ${intern.pixKey}` : ''}</div>}
                          </td>
                          <td className="p-3 text-slate-600">{intern.unitId ? unitName(intern.unitId) : '—'}</td>
                          <td className="p-3 font-semibold text-slate-800">
                            {allowance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            <div className="text-[9px] text-gray-400 font-normal">
                              Dia (1/30): {dailyValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                          </td>
                          <td className="p-3 max-w-xs">
                            {occurrenceDetails.length === 0 ? (
                              <span className="text-gray-400 italic text-[10px]">Sem ocorrências no mês</span>
                            ) : (
                              <div className="space-y-1">
                                {occurrenceDetails.map((occ, idx) => (
                                  <div key={idx} className={`p-1.5 rounded border text-[9px] ${occ.isMedical ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'
                                    }`}>
                                    <strong>{occ.date} - {occ.type} ({occ.days}d):</strong> {occ.desc}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {deductibleDays > 0 ? (
                              <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold text-[10px]">
                                -{deductibleDays} dias
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">Nenhum</span>
                            )}
                            {medicalDays > 0 && (
                              <div className="text-[9px] text-green-600 font-medium mt-1">+{medicalDays}d abonados</div>
                            )}
                          </td>
                          <td className="p-3 text-right font-semibold text-red-700">
                            {deductionValue > 0
                              ? `- ${deductionValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                              : <span className="text-gray-400 italic font-normal">—</span>}
                          </td>
                          <td className="p-3 text-right font-bold text-gray-900 text-sm">
                            {finalPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* SUB-ABA 2: FOLHAS DE PAGAMENTO POR UNIDADE (CONTADOR SENOGUIN) */}
      {activeSubTab === 'folhas_unidades' && (
        <div className="p-4 space-y-4">
          {/* Header e Ação de Upload */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Building2 size={18} className="text-indigo-600" />
                Upload de Folhas de Pagamento (Contador Senoguin)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Envio em PDF por unidade com cadastro de mês, valor total, tipo de folha e observações contábeis.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600 font-medium">Mês:</span>
                <input
                  type="month"
                  value={filterFinanceMonth}
                  onChange={(e) => setFilterFinanceMonth(e.target.value)}
                  className="p-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={() => {
                  setUploadUnitTarget(filterUnit !== 'all' ? filterUnit : '');
                  setIsUploadModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-indigo-200 transition-all cursor-pointer"
              >
                <Plus size={16} />
                Novo Upload de Folha (PDF)
              </button>
            </div>
          </div>

          {/* Cards KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Folhas Enviadas</p>
                <p className="text-xl font-extrabold text-slate-900 mt-0.5">{payrollsSummary.totalCount} arquivos</p>
              </div>
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <FileText size={22} />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Valor Acumulado no Mês</p>
                <p className="text-xl font-extrabold text-emerald-700 mt-0.5">
                  {payrollsSummary.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign size={22} />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pendentes de Conferência</p>
                <p className="text-xl font-extrabold text-amber-600 mt-0.5">{payrollsSummary.pendentesCount} folhas</p>
              </div>
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <AlertCircle size={22} />
              </div>
            </div>
          </div>

          {/* Tabela de Folhas de Pagamento Enviadas */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <th className="p-3 font-semibold">Unidade</th>
                  <th className="p-3 font-semibold">Competência</th>
                  <th className="p-3 font-semibold">Tipo de Folha</th>
                  <th className="p-3 font-semibold">Valor Total</th>
                  <th className="p-3 font-semibold">Data Pagamento / Notas</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayrolls.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-400">
                      <FileText size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-600">Nenhuma folha de pagamento cadastrada para este filtro.</p>
                      <p className="text-xs text-slate-400 mt-1">Clique no botão "Novo Upload de Folha (PDF)" acima para adicionar.</p>
                    </td>
                  </tr>
                ) : (
                  filteredPayrolls.map((payroll) => (
                    <tr key={payroll.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Building2 size={16} className="text-indigo-600 shrink-0" />
                          <span>{payroll.unit_name || unitName(payroll.unit_id)}</span>
                        </div>
                      </td>

                      <td className="p-3 font-mono font-semibold text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-slate-400" />
                          <span>{payroll.competencia}</span>
                        </div>
                      </td>

                      <td className="p-3 text-slate-700">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-[11px] font-medium">
                          <Tag size={12} className="text-indigo-500" />
                          {getTipoFolhaLabel(payroll.tipo_folha)}
                        </span>
                      </td>

                      <td className="p-3 font-bold text-emerald-700 font-mono text-sm">
                        {typeof payroll.valor === 'number'
                          ? payroll.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          : payroll.valor}
                      </td>

                      <td className="p-3 text-slate-600 max-w-xs">
                        {payroll.data_pagamento && (
                          <div className="text-[10px] text-slate-500 font-semibold mb-0.5">
                            Pago em: {new Date(payroll.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </div>
                        )}
                        {payroll.observacoes ? (
                          <span className="text-[11px] text-slate-700 italic truncate block">{payroll.observacoes}</span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sem notas adicionais</span>
                        )}
                      </td>

                      <td className="p-3">
                        <select
                          value={payroll.status || 'pendente'}
                          onChange={(e) => handleStatusChange(payroll.id, e.target.value)}
                          className={`text-[11px] font-bold rounded-lg border px-2 py-1 cursor-pointer transition-colors ${
                            payroll.status === 'aprovado'
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : payroll.status === 'conferido'
                              ? 'bg-blue-50 border-blue-300 text-blue-800'
                              : payroll.status === 'semipronto'
                              ? 'bg-purple-50 border-purple-300 text-purple-800'
                              : 'bg-amber-50 border-amber-300 text-amber-800'
                          }`}
                        >
                          <option value="semipronto">📥 Semipronto</option>
                          <option value="pendente">⏳ Pendente</option>
                          <option value="conferido">🔍 Conferido</option>
                          <option value="aprovado">✅ Aprovado</option>
                        </select>
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingPayrollDoc(payroll)}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                            title="Visualizar PDF sem baixar"
                          >
                            <Eye size={14} />
                            Ver PDF
                          </button>

                          {payroll.content && (
                            <a
                              href={payroll.content}
                              download={payroll.file_name || `folha-${payroll.unit_id}-${payroll.competencia}.pdf`}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                              title="Baixar arquivo PDF"
                            >
                              <Download size={14} />
                            </a>
                          )}

                          <button
                            onClick={() => handleDeletePayroll(payroll.id)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                            title="Excluir folha"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DE UPLOAD DE FOLHA EM PDF POR UNIDADE (SEM LOGIN) */}
      <PublicPayrollUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        units={units}
        initialUnitId={uploadUnitTarget}
      />

      {/* MODAL DE VISUALIZAÇÃO INTEGRADA DE PDF */}
      <PayrollPdfViewerModal
        isOpen={!!viewingPayrollDoc}
        onClose={() => setViewingPayrollDoc(null)}
        document={viewingPayrollDoc}
      />
    </div>
  );
}

