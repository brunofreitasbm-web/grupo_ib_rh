import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Timer, Clock, FileText, Cake, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
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

  const activeInterns = useMemo(() => {
    return interns.filter(i => i.active !== false && (filterUnit === 'all' || i.unitId === filterUnit));
  }, [interns, filterUnit]);

  const totalActive = activeInterns.length;
  
  // Total monthly payroll (allowance sum)
  const totalPayroll = useMemo(() => {
    return activeInterns.reduce((acc, curr) => acc + (Number(curr.allowance) || 0), 0);
  }, [activeInterns]);
  
  // Average daily hours
  const avgDailyHours = useMemo(() => {
    return activeInterns.length > 0 
      ? (activeInterns.reduce((acc, curr) => acc + (Number(curr.dailyHours) || 6), 0) / activeInterns.length).toFixed(1)
      : 0;
  }, [activeInterns]);

  // Dossier completion: check missing documents for active interns
  const totalMissingDocs = useMemo(() => {
    const requiredDocKeys = ['tce', 'pae', 'matricula', 'documentos', 'seguro', 'ficha'];
    let count = 0;
    activeInterns.forEach(intern => {
      const docs = intern.documents || {};
      requiredDocKeys.forEach(key => {
        if (!docs[key] || !docs[key].content) {
          count++;
        }
      });
    });
    return count;
  }, [activeInterns]);

  // Breakdown per unit
  const unitStats = useMemo(() => {
    const stats = {};
    activeInterns.forEach(intern => {
      const uName = intern.unitId ? unitName(intern.unitId) : 'Outra/Não definida';
      stats[uName] = (stats[uName] || 0) + 1;
    });
    return stats;
  }, [activeInterns, units]);

  // Breakdown per shift
  const shiftStats = useMemo(() => {
    const stats = {};
    activeInterns.forEach(intern => {
      const shift = intern.shift || 'Manhã';
      stats[shift] = (stats[shift] || 0) + 1;
    });
    return stats;
  }, [activeInterns]);

  // Contract warnings (expiring in 30 days)
  const expiringSoon = useMemo(() => {
    return activeInterns.filter(intern => {
      if (!intern.endDate) return false;
      const end = new Date(intern.endDate);
      const diffTime = end - new Date();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    });
  }, [activeInterns]);

  // Total records this month
  const recordsThisMonth = useMemo(() => {
    const currentMonthPrefix = new Date().toISOString().substring(0, 7);
    return records.filter(r => {
      if (!r.timestamp) return false;
      const dateStr = typeof r.timestamp === 'string' ? r.timestamp : new Date(r.timestamp).toISOString();
      const inMonth = dateStr.substring(0, 7) === currentMonthPrefix;
      const matchesUnit = filterUnit === 'all' || r.geo?.unitId === filterUnit;
      return inMonth && matchesUnit;
    }).length;
  }, [records, filterUnit]);

  // Real-time presence: Present Today (who is currently clocked in)
  const presentToday = useMemo(() => {
    const todayPrefix = new Date().toLocaleDateString('pt-BR'); // matching helper formatting
    // Filter records from today
    const todayRecords = records.filter(r => {
      if (!r.timestamp) return false;
      const d = new Date(r.timestamp);
      const dateStr = d.toLocaleDateString('pt-BR');
      const matchesUnit = filterUnit === 'all' || r.geo?.unitId === filterUnit;
      return dateStr === todayPrefix && matchesUnit;
    });

    // Determine latest action for each intern today
    const latestAction = {};
    const internUnit = {};
    const internTime = {};
    
    // records are sorted descending (latest first)
    todayRecords.forEach(r => {
      if (!latestAction[r.internName]) {
        latestAction[r.internName] = r.action;
        internUnit[r.internName] = r.geo?.unitName || 'Unidade';
        internTime[r.internName] = new Date(r.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
    });

    return Object.entries(latestAction)
      .filter(([_, action]) => action === 'entrada')
      .map(([name, _]) => ({
        name,
        unit: internUnit[name],
        time: internTime[name]
      }));
  }, [records, filterUnit]);

  // Birthdays of the current month
  const birthdaysThisMonth = useMemo(() => {
    const currentMonth = new Date().getMonth();
    return activeInterns
      .filter(i => {
        if (!i.birthdate) return false;
        // Avoid timezone shift with safe parsing
        const parts = i.birthdate.split('-');
        if (parts.length !== 3) return false;
        const monthIndex = parseInt(parts[1], 10) - 1;
        return monthIndex === currentMonth;
      })
      .map(i => {
        const parts = i.birthdate.split('-');
        return {
          id: i.id,
          name: i.name,
          day: parseInt(parts[2], 10),
          course: i.course || 'Estagiário(a)'
        };
      })
      .sort((a, b) => a.day - b.day);
  }, [activeInterns]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/10 hover:scale-[1.02] transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-blue-100 font-semibold uppercase tracking-wider">Estagiários Ativos</p>
              <h3 className="text-3xl font-extrabold mt-2">{totalActive}</h3>
            </div>
            <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-sm">
              <Users size={22} className="text-white" />
            </div>
          </div>
          <p className="text-[10px] text-blue-200 mt-4 flex items-center gap-1 font-medium">
            Vínculos ativos na Porto Terapia
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/10 hover:scale-[1.02] transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-emerald-100 font-semibold uppercase tracking-wider">Folha de Pagamento</p>
              <h3 className="text-3xl font-extrabold mt-2">
                {totalPayroll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </h3>
            </div>
            <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-sm">
              <Timer size={22} className="text-white" />
            </div>
          </div>
          <p className="text-[10px] text-emerald-200 mt-4 flex items-center gap-1 font-medium">
            Soma total das bolsas/auxílios mensais
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg shadow-amber-500/10 hover:scale-[1.02] transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-amber-100 font-semibold uppercase tracking-wider">Média Carga Horária</p>
              <h3 className="text-3xl font-extrabold mt-2">{avgDailyHours}h <span className="text-xs font-normal">/dia</span></h3>
            </div>
            <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-sm">
              <Clock size={22} className="text-white" />
            </div>
          </div>
          <p className="text-[10px] text-amber-200 mt-4 flex items-center gap-1 font-medium">
            Carga horária diária média
          </p>
        </div>

        <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-5 text-white shadow-lg shadow-rose-500/10 hover:scale-[1.02] transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-rose-100 font-semibold uppercase tracking-wider">Pendências no Dossiê</p>
              <h3 className="text-3xl font-extrabold mt-2">{totalMissingDocs}</h3>
            </div>
            <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-sm">
              <FileText size={22} className="text-white" />
            </div>
          </div>
          <p className="text-[10px] text-rose-200 mt-4 flex items-center gap-1 font-medium">
            Documentos obrigatórios ausentes
          </p>
        </div>
      </div>

      {/* Main Grid: distribuições + painel de presenças + aniversariantes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Distributions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Distribuição por Unidade */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 transition-all duration-200 hover:shadow-md">
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
                      <span className="text-blue-600">{count} estagiários ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden border border-slate-200/60 shadow-inner">
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

          {/* Distribuição por Turno */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 transition-all duration-200 hover:shadow-md">
            <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider flex items-center gap-2">
              🌅 Distribuição por Turno
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {['Manhã', 'Tarde', 'Noite', 'Integral'].map(shift => {
                const count = shiftStats[shift] || 0;
                const pct = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;
                return (
                  <div key={shift} className="bg-slate-50 hover:bg-slate-100/70 border border-slate-150 rounded-2xl p-4 text-center transition-all duration-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">{shift}</span>
                    <strong className="text-2xl font-black text-slate-800 block mt-1">{count}</strong>
                    <span className="text-[10px] text-blue-600 font-semibold block mt-1.5 bg-blue-50/80 px-2 py-0.5 rounded-full w-fit mx-auto">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Estagiários Presentes Hoje */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 transition-all duration-200 hover:shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                Presentes Hoje ({presentToday.length})
              </h3>
              <span className="text-[10px] text-gray-400 font-medium">Atualizado em tempo real</span>
            </div>
            {presentToday.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400 italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                Nenhum estagiário com entrada em aberto nesta data.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {presentToday.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-green-50/40 border border-green-100/60 rounded-xl transition-all duration-200 hover:bg-green-50/80">
                    <div>
                      <h4 className="text-xs font-bold text-gray-800">{p.name}</h4>
                      <p className="text-[9px] text-gray-500 font-medium mt-0.5">{p.unit}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100/80 px-2 py-0.5 rounded-md">
                        Entrada: {p.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Insights & Birthdays */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Aniversariantes do Mês */}
          <div className="bg-gradient-to-br from-pink-500/5 to-rose-500/5 border border-pink-100 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-pink-800 uppercase tracking-wider flex items-center gap-2 border-b border-pink-100 pb-3">
              <Cake size={18} className="text-pink-500 animate-bounce" /> Aniversariantes do Mês 🎉
            </h3>
            {birthdaysThisMonth.length === 0 ? (
              <p className="text-[11px] text-pink-600/70 italic text-center py-4 bg-white/50 rounded-xl border border-dashed border-pink-200/50">
                Sem aniversariantes no mês atual.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {birthdaysThisMonth.map((b) => {
                  const isToday = new Date().getDate() === b.day;
                  return (
                    <div
                      key={b.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
                        isToday
                          ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md border-transparent hover:scale-[1.01]'
                          : 'bg-white border-pink-100 hover:border-pink-200 hover:shadow-sm'
                      }`}
                    >
                      <div className="max-w-[70%]">
                        <h4 className={`text-xs font-bold truncate ${isToday ? 'text-white' : 'text-gray-800'}`}>
                          {b.name}
                        </h4>
                        <p className={`text-[9px] truncate mt-0.5 ${isToday ? 'text-pink-100' : 'text-gray-400'}`}>
                          {b.course}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                            isToday
                              ? 'bg-white text-pink-600 animate-pulse'
                              : 'bg-pink-50 text-pink-700'
                          }`}
                        >
                          Dia {b.day}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Insights Panel */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4 hover:shadow-md transition-all duration-200">
            <h3 className="text-sm font-bold text-gray-800 mb-2 uppercase tracking-wider flex items-center gap-2 border-b pb-3">
              💡 Insights de Gerenciamento
            </h3>
            
            <div className="space-y-3.5">
              <div className="p-3 bg-blue-50/50 border border-blue-100/60 rounded-xl flex gap-3">
                <span className="text-xl">📅</span>
                <div>
                  <h4 className="text-xs font-bold text-blue-900">Registros de Ponto no Mês</h4>
                  <p className="text-[10px] text-blue-700/90 leading-normal mt-0.5">
                    Foram registrados <strong>{recordsThisMonth} pontos</strong> de entrada/saída durante este mês.
                  </p>
                </div>
              </div>

              {expiringSoon.length > 0 ? (
                <div className="p-3 bg-amber-50/60 border border-amber-100/60 rounded-xl flex gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <h4 className="text-xs font-bold text-amber-950">Contratos Próximos do Fim</h4>
                    <p className="text-[10px] text-amber-800 leading-normal mt-0.5">
                      Estagiários com contrato encerrando nos próximos 30 dias:
                    </p>
                    <ul className="text-[9px] text-amber-900 font-bold mt-1.5 list-disc list-inside space-y-0.5">
                      {expiringSoon.map(i => (
                        <li key={i.id} className="truncate">{i.name} ({new Date(i.endDate).toLocaleDateString('pt-BR')})</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50/50 border border-emerald-100/60 rounded-xl flex gap-3">
                  <span className="text-xl">✅</span>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">Vigência de Contratos</h4>
                    <p className="text-[10px] text-emerald-800/90 leading-normal mt-0.5">
                      Nenhum contrato de estágio expira nos próximos 30 dias.
                    </p>
                  </div>
                </div>
              )}

              {totalMissingDocs > 0 ? (
                <div className="p-3 bg-rose-50/50 border border-rose-100/60 rounded-xl flex gap-3">
                  <span className="text-xl">📁</span>
                  <div>
                    <h4 className="text-xs font-bold text-rose-950">Atenção ao Dossiê</h4>
                    <p className="text-[10px] text-rose-800/90 leading-normal mt-0.5">
                      Existem pendências de documentos essenciais no dossiê. Revise a aba "Dossiê" para carregar arquivos pendentes.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50/50 border border-emerald-100/60 rounded-xl flex gap-3">
                  <span className="text-xl">🎉</span>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">Documentação Completa</h4>
                    <p className="text-[10px] text-emerald-800/90 leading-normal mt-0.5">
                      Todos os estagiários ativos possuem dossiês completos!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
