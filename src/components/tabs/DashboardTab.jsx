import React, { useState, useEffect, useCallback } from 'react';
import { Users, Timer, Clock, FileText } from 'lucide-react';
import { supabase } from '../../supabase';
import { mapInternFromDb, mapRecordFromDb, mapUnitFromDb } from '../../utils/mappings';

export default function DashboardTab({ filterUnit }) {
  const [interns, setInterns] = useState([]);
  const [records, setRecords] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // 1. Fetch interns
      const { data: internsData, error: internsError } = await supabase
        .from('interns')
        .select('*')
        .order('name', { ascending: true });

      // 2. Fetch units
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('*')
        .order('name', { ascending: true });

      // 3. Fetch monthly records to avoid downloading massive history
      const currentMonthPrefix = new Date().toISOString().substring(0, 7);
      const { data: recordsData, error: recordsError } = await supabase
        .from('records')
        .select('*')
        .gte('timestamp', `${currentMonthPrefix}-01T00:00:00`)
        .order('timestamp', { ascending: false });

      if (internsError) console.error('Erro ao buscar estagiários:', internsError);
      if (unitsError) console.error('Erro ao buscar unidades:', unitsError);
      if (recordsError) console.error('Erro ao buscar registros:', recordsError);

      if (internsData) setInterns(internsData.map(mapInternFromDb));
      if (unitsData) setUnits(unitsData.map(mapUnitFromDb));
      if (recordsData) setRecords(recordsData.map(mapRecordFromDb));
    } catch (err) {
      console.error('Erro geral ao carregar dados do dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Sincronização em tempo real via canais Supabase
    const internsChannel = supabase
      .channel('dashboard-interns-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interns' }, () => {
        fetchData();
      })
      .subscribe();

    const recordsChannel = supabase
      .channel('dashboard-records-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(internsChannel);
      supabase.removeChannel(recordsChannel);
    };
  }, [fetchData]);

  const unitName = (id) => {
    const u = units.find((x) => x.id === id);
    return u ? u.name : 'Unidade Outra';
  };

  const activeInterns = interns.filter(i => i.active !== false && (filterUnit === 'all' || i.unitId === filterUnit));
  const totalActive = activeInterns.length;
  
  // Total monthly payroll (allowance sum)
  const totalPayroll = activeInterns.reduce((acc, curr) => acc + (Number(curr.allowance) || 0), 0);
  
  // Average daily hours
  const avgDailyHours = activeInterns.length > 0 
    ? (activeInterns.reduce((acc, curr) => acc + (Number(curr.dailyHours) || 6), 0) / activeInterns.length).toFixed(1)
    : 0;

  // Dossier completion: check missing documents for active interns
  const requiredDocKeys = ['tce', 'pae', 'matricula', 'documentos', 'seguro', 'ficha'];
  let totalMissingDocs = 0;
  activeInterns.forEach(intern => {
    const docs = intern.documents || {};
    requiredDocKeys.forEach(key => {
      if (!docs[key] || !docs[key].content) {
        totalMissingDocs++;
      }
    });
  });

  // Breakdown per unit
  const unitStats = {};
  activeInterns.forEach(intern => {
    const uName = intern.unitId ? unitName(intern.unitId) : 'Outra/Não definida';
    unitStats[uName] = (unitStats[uName] || 0) + 1;
  });

  // Breakdown per shift
  const shiftStats = {};
  activeInterns.forEach(intern => {
    const shift = intern.shift || 'Manhã';
    shiftStats[shift] = (shiftStats[shift] || 0) + 1;
  });

  // Contract warnings (expiring in 30 days)
  const expiringSoon = activeInterns.filter(intern => {
    if (!intern.endDate) return false;
    const end = new Date(intern.endDate);
    const diffTime = end - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  });

  // Total records this month
  const currentMonthPrefix = new Date().toISOString().substring(0, 7);
  const recordsThisMonth = records.filter(r => {
    if (!r.timestamp) return false;
    const dateStr = typeof r.timestamp === 'string' ? r.timestamp : new Date(r.timestamp).toISOString();
    const inMonth = dateStr.substring(0, 7) === currentMonthPrefix;
    const matchesUnit = filterUnit === 'all' || r.geo?.unitId === filterUnit;
    return inMonth && matchesUnit;
  }).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-md shadow-indigo-100 hover:scale-[1.02] transition-transform duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-blue-100 font-semibold uppercase tracking-wider">Estagiários Ativos</p>
              <h3 className="text-3xl font-extrabold mt-2">{totalActive}</h3>
            </div>
            <div className="bg-white/20 p-2.5 rounded-xl">
              <Users size={22} className="text-white" />
            </div>
          </div>
          <p className="text-[10px] text-blue-100/80 mt-4 flex items-center gap-1 font-medium">
            Vínculos ativos na Porto Terapia
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-md shadow-emerald-100 hover:scale-[1.02] transition-transform duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-emerald-100 font-semibold uppercase tracking-wider">Folha de Pagamento</p>
              <h3 className="text-3xl font-extrabold mt-2">
                {totalPayroll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </h3>
            </div>
            <div className="bg-white/20 p-2.5 rounded-xl">
              <Timer size={22} className="text-white" />
            </div>
          </div>
          <p className="text-[10px] text-emerald-100/80 mt-4 flex items-center gap-1 font-medium">
            Soma total das bolsas/auxílios mensais
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-md shadow-amber-100 hover:scale-[1.02] transition-transform duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-amber-100 font-semibold uppercase tracking-wider">Média Carga Horária</p>
              <h3 className="text-3xl font-extrabold mt-2">{avgDailyHours}h <span className="text-xs font-normal">/dia</span></h3>
            </div>
            <div className="bg-white/20 p-2.5 rounded-xl">
              <Clock size={22} className="text-white" />
            </div>
          </div>
          <p className="text-[10px] text-amber-100/80 mt-4 flex items-center gap-1 font-medium">
            Carga horária diária média
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-5 text-white shadow-md shadow-red-100 hover:scale-[1.02] transition-transform duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-red-100 font-semibold uppercase tracking-wider">Pendências no Dossiê</p>
              <h3 className="text-3xl font-extrabold mt-2">{totalMissingDocs}</h3>
            </div>
            <div className="bg-white/20 p-2.5 rounded-xl">
              <FileText size={22} className="text-white" />
            </div>
          </div>
          <p className="text-[10px] text-red-100/80 mt-4 flex items-center gap-1 font-medium">
            Documentos obrigatórios ausentes
          </p>
        </div>
      </div>

      {/* Charts & Insights Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Unit & Shift Distributions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-md shadow-slate-100 border border-slate-100">
            <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider flex items-center gap-2">
              🏢 Distribuição por Unidade
            </h3>
            <div className="space-y-4">
              {Object.entries(unitStats).map(([uName, count]) => {
                const pct = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;
                return (
                  <div key={uName} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-gray-700">
                      <span>{uName}</span>
                      <span>{count} estagiários ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
              {Object.keys(unitStats).length === 0 && (
                <p className="text-center text-xs text-gray-400 italic py-4">Nenhum dado de unidade disponível.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md shadow-slate-100 border border-slate-100">
            <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider flex items-center gap-2">
              🌅 Distribuição por Turno
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {['Manhã', 'Tarde', 'Noite', 'Integral'].map(shift => {
                const count = shiftStats[shift] || 0;
                const pct = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;
                return (
                  <div key={shift} className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">{shift}</span>
                    <strong className="text-2xl font-black text-slate-800 block mt-1">{count}</strong>
                    <span className="text-[10px] text-indigo-600 font-semibold block mt-1 bg-indigo-50 px-1.5 py-0.5 rounded-full w-fit mx-auto">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Insights Panel */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 shadow-md shadow-slate-100 border border-slate-100 space-y-6">
          <h3 className="text-sm font-bold text-gray-800 mb-2 uppercase tracking-wider flex items-center gap-2 border-b pb-3">
            💡 Insights de Gerenciamento
          </h3>
          
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
              <span className="text-xl">📅</span>
              <div>
                <h4 className="text-xs font-bold text-blue-900">Registros de Ponto no Mês</h4>
                <p className="text-[10px] text-blue-700 leading-normal mt-0.5">
                  Foram registrados <strong>{recordsThisMonth} pontos</strong> de entrada/saída durante este mês.
                </p>
              </div>
            </div>

            {expiringSoon.length > 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <h4 className="text-xs font-bold text-amber-900">Contratos Próximos do Fim</h4>
                  <p className="text-[10px] text-amber-700 leading-normal mt-0.5">
                    Estagiários com contrato encerrando nos próximos 30 dias:
                  </p>
                  <ul className="text-[9px] text-amber-800 font-semibold mt-1 list-disc list-inside">
                    {expiringSoon.map(i => (
                      <li key={i.id}>{i.name} ({new Date(i.endDate).toLocaleDateString('pt-BR')})</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-green-50 border border-green-100 rounded-xl flex gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <h4 className="text-xs font-bold text-green-900">Vigência de Contratos</h4>
                  <p className="text-[10px] text-green-700 leading-normal mt-0.5">
                    Nenhum contrato de estágio expira nos próximos 30 dias.
                  </p>
                </div>
              </div>
            )}

            {totalMissingDocs > 0 ? (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex gap-3">
                <span className="text-xl">📁</span>
                <div>
                  <h4 className="text-xs font-bold text-red-900">Atenção ao Dossiê</h4>
                  <p className="text-[10px] text-red-700 leading-normal mt-0.5">
                    Existem pendências de documentos essenciais no dossiê. Revise a aba "Dossiê" para carregar TCEs ou comprovantes pendentes.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-green-50 border border-green-100 rounded-xl flex gap-3">
                <span className="text-xl">🎉</span>
                <div>
                  <h4 className="text-xs font-bold text-green-900">Documentação Completa</h4>
                  <p className="text-[10px] text-green-700 leading-normal mt-0.5">
                    Excelente! Todos os estagiários ativos possuem dossiês 100% preenchidos.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
