import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Timer } from 'lucide-react';
import { supabase } from '../../supabase';
import { mapInternFromDb, mapRecordFromDb, mapUnitFromDb } from '../../utils/mappings';

export default function FinanceiroTab({ filterUnit }) {
  const [interns, setInterns] = useState([]);
  const [records, setRecords] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterFinanceMonth, setFilterFinanceMonth] = useState(new Date().toISOString().substring(0, 7));

  const fetchData = useCallback(async () => {
    try {
      const { data: internsData } = await supabase
        .from('interns')
        .select('*')
        .order('name', { ascending: true });

      const { data: unitsData } = await supabase
        .from('units')
        .select('*');

      // Fetch records for the selected month to keep queries lightweight
      const { data: recordsData } = await supabase
        .from('records')
        .select('*')
        .gte('timestamp', `${filterFinanceMonth}-01T00:00:00`)
        .order('timestamp', { ascending: false });

      if (internsData) setInterns(internsData.map(mapInternFromDb));
      if (unitsData) setUnits(unitsData.map(mapUnitFromDb));
      if (recordsData) setRecords(recordsData.map(mapRecordFromDb));
    } catch (err) {
      console.error('Erro ao carregar dados do financeiro:', err);
    } finally {
      setLoading(false);
    }
  }, [filterFinanceMonth]);

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
  
  const totalWorkingDays = useMemo(() => {
    let count = 0;
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
      const day = date.getDay();
      if (day !== 0 && day !== 6) count++;
      date.setDate(date.getDate() + 1);
    }
    return count || 22;
  }, [year, month]);

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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <Timer size={20} className="text-blue-600" /> Aba de Financeiro (Folha de Pagamento)
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <input
              type="month"
              value={filterFinanceMonth}
              onChange={(e) => setFilterFinanceMonth(e.target.value)}
              className="p-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-xs text-slate-700">
          <p><strong>Período de Referência:</strong> {month.toString().padStart(2, '0')}/{year} • <strong>Dias Úteis Estimados:</strong> {totalWorkingDays} dias de trabalho (segunda a sexta).</p>
          <p className="mt-1 text-slate-500"><strong>Regra de Negócio:</strong> Atestados Médicos (com comprovante) abonam faltas e não possuem desconto. Outras ocorrências (faltas injustificadas, atrasos, etc.) deduzem o pagamento de forma proporcional aos dias afastados informados.</p>
        </div>

        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600 uppercase tracking-wider border-b border-gray-100">
                <th className="p-3 font-semibold">Estagiário</th>
                <th className="p-3 font-semibold">Unidade</th>
                <th className="p-3 font-semibold">Bolsa/Auxílio</th>
                <th className="p-3 font-semibold">Ocorrências do Mês</th>
                <th className="p-3 font-semibold text-center">Dias Descontados</th>
                <th className="p-3 font-semibold text-right">Valor Final Devido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInterns.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-gray-400">Nenhum estagiário correspondente aos filtros.</td>
                </tr>
              ) : (
                filteredInterns.map(intern => {
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

                  const finalDays = Math.max(0, totalWorkingDays - deductibleDays);
                  const finalPayment = totalWorkingDays > 0 ? (allowance / totalWorkingDays) * finalDays : allowance;

                  return (
                    <tr key={intern.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-medium text-gray-800">
                        <div className="font-bold">{intern.name}</div>
                        {intern.cpf && <div className="text-[10px] text-gray-400 font-normal">CPF: {intern.cpf}</div>}
                        {intern.bankName && <div className="text-[9px] text-gray-400 font-normal">{intern.bankName} • Ag {intern.bankAgency} • Cc {intern.bankAccount}</div>}
                      </td>
                      <td className="p-3 text-slate-600">{intern.unitId ? unitName(intern.unitId) : '—'}</td>
                      <td className="p-3 font-semibold text-slate-800">
                        {allowance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="p-3 max-w-xs">
                        {occurrenceDetails.length === 0 ? (
                          <span className="text-gray-400 italic text-[10px]">Sem ocorrências no mês</span>
                        ) : (
                          <div className="space-y-1">
                            {occurrenceDetails.map((occ, idx) => (
                              <div key={idx} className={`p-1.5 rounded border text-[9px] ${
                                occ.isMedical ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'
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
    </div>
  );
}
