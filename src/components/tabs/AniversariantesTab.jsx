import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Cake, Users, Printer, Calendar, Edit2, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../supabase';
import { mapInternFromDb, mapUnitFromDb } from '../../utils/mappings';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_COLORS = [
  'from-red-400 to-rose-500',
  'from-pink-400 to-fuchsia-500',
  'from-green-400 to-emerald-500',
  'from-yellow-400 to-amber-500',
  'from-teal-400 to-cyan-500',
  'from-blue-400 to-indigo-500',
  'from-violet-400 to-purple-500',
  'from-orange-400 to-red-500',
  'from-lime-400 to-green-500',
  'from-cyan-400 to-blue-500',
  'from-indigo-400 to-blue-600',
  'from-amber-400 to-orange-500',
];

export default function AniversariantesTab({ filterUnit }) {
  const [interns, setInterns] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [editingId, setEditingId] = useState(null);
  const [editBirthday, setEditBirthday] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: internsData } = await supabase
        .from('interns')
        .select('*')
        .order('name', { ascending: true });
      const { data: unitsData } = await supabase
        .from('units')
        .select('*');
      if (internsData) setInterns(internsData.map(mapInternFromDb));
      if (unitsData) setUnits(unitsData.map(mapUnitFromDb));
    } catch (err) {
      console.error('Erro ao carregar aniversariantes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('aniversariantes-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interns' }, () => fetchData())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchData]);

  const unitName = (id) => units.find(u => u.id === id)?.name || '—';

  const filteredInterns = useMemo(() =>
    interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit),
    [interns, filterUnit]
  );

  const birthdayInterns = useMemo(() =>
    filteredInterns
      .filter(i => {
        if (!i.birthdate) return false;
        const d = new Date(i.birthdate + 'T00:00:00');
        return d.getMonth() === selectedMonth;
      })
      .sort((a, b) => {
        const dA = new Date(a.birthdate + 'T00:00:00').getDate();
        const dB = new Date(b.birthdate + 'T00:00:00').getDate();
        return dA - dB;
      }),
    [filteredInterns, selectedMonth]
  );

  const withoutBirthday = useMemo(() =>
    filteredInterns.filter(i => !i.birthdate && i.active !== false),
    [filteredInterns]
  );

  const nextBirthday = useMemo(() => {
    const today = new Date();
    const todayMD = today.getMonth() * 100 + today.getDate();
    const upcoming = filteredInterns
      .filter(i => i.birthdate)
      .map(i => {
        const d = new Date(i.birthdate + 'T00:00:00');
        const md = d.getMonth() * 100 + d.getDate();
        return { intern: i, md, day: d.getDate(), month: d.getMonth() };
      })
      .filter(x => x.md >= todayMD)
      .sort((a, b) => a.md - b.md);
    return upcoming[0] || null;
  }, [filteredInterns]);

  const handleSaveBirthday = async (internId) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('interns')
        .update({ birthdate: editBirthday || null })
        .eq('id', internId);
      if (error) throw error;
      setEditingId(null);
      setEditBirthday('');
      fetchData();
    } catch (err) {
      console.error('Erro ao salvar aniversário:', err);
      alert('Erro ao salvar data de aniversário. Verifique se a coluna "birthdate" foi adicionada ao banco de dados.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const monthLabel = MONTH_NAMES[selectedMonth];
    const rows = birthdayInterns.map(i => {
      const d = new Date(i.birthdate + 'T00:00:00');
      const dayStr = `${String(d.getDate()).padStart(2, '0')}/${String(selectedMonth + 1).padStart(2, '0')}`;
      const age = new Date().getFullYear() - d.getFullYear();
      return `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:8px 12px;font-weight:600;">${i.name}</td>
          <td style="padding:8px 12px;">${dayStr}</td>
          <td style="padding:8px 12px;">${age} anos</td>
          <td style="padding:8px 12px;">${i.course || '—'}</td>
          <td style="padding:8px 12px;">${unitName(i.unitId)}</td>
          <td style="padding:8px 12px;">${i.shift || '—'}</td>
          <td style="padding:8px 12px;text-align:center;">☐</td>
        </tr>`;
    }).join('');

    const html = `
      <html><head><title>Aniversariantes de ${monthLabel}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:20px;}
        h2{color:#1e3a8a;margin-bottom:2px;}
        .sub{color:#6b7280;font-size:9px;margin-bottom:16px;}
        table{width:100%;border-collapse:collapse;}
        th{background:#1e3a8a;color:white;padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;}
        tr:nth-child(even) td{background:#f9fafb;}
        .footer{margin-top:30px;font-size:9px;color:#6b7280;border-top:1px solid #d1d5db;padding-top:8px;}
      </style></head>
      <body>
        <h2>🎂 Aniversariantes de ${monthLabel}</h2>
        <p class="sub">Porto Terapia — Controle de Estágios · Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
        <table>
          <thead>
            <tr>
              <th>Nome</th><th>Data</th><th>Idade</th><th>Curso</th>
              <th>Unidade</th><th>Turno</th><th>Ação RH ✓</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="7" style="padding:12px;text-align:center;color:#9ca3af;">Nenhum aniversariante neste mês.</td></tr>'}</tbody>
        </table>
        <div class="footer">Lista gerada pelo Sistema de Controle de Estagiários · Porto Terapia</div>
      </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const prevMonth = () => setSelectedMonth(m => (m === 0 ? 11 : m - 1));
  const nextMonth = () => setSelectedMonth(m => (m === 11 ? 0 : m + 1));

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Cabeçalho com gradiente do mês */}
      <div className={`bg-gradient-to-br ${MONTH_COLORS[selectedMonth]} rounded-2xl p-6 text-white shadow-lg`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Cake size={22} />
              <h2 className="text-xl font-extrabold tracking-tight">Aniversariantes do Mês</h2>
            </div>
            <p className="text-white/80 text-xs">Lista de estagiários para ações de RH e fortalecimento de vínculo</p>
          </div>

          {/* Navegador de mês */}
          <div className="flex items-center gap-2 bg-white/20 rounded-xl px-4 py-2 backdrop-blur-sm">
            <button onClick={prevMonth} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <ChevronLeft size={18} />
            </button>
            <div className="text-center min-w-[120px]">
              <p className="font-extrabold text-lg leading-none">{MONTH_NAMES[selectedMonth]}</p>
              <p className="text-white/70 text-[11px] mt-0.5">{birthdayInterns.length} aniversariante(s)</p>
            </div>
            <button onClick={nextMonth} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Botão imprimir */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-white text-gray-800 font-semibold text-xs px-4 py-2.5 rounded-xl shadow hover:shadow-md hover:bg-gray-50 transition-all"
          >
            <Printer size={15} />
            Imprimir Lista RH
          </button>
        </div>

        {nextBirthday && (
          <div className="mt-4 bg-white/15 rounded-xl px-4 py-2.5 text-xs flex items-center gap-2">
            <span>🎯</span>
            <span>
              Próximo aniversário: <strong>{nextBirthday.intern.name}</strong> —{' '}
              {String(nextBirthday.day).padStart(2, '0')}/{String(nextBirthday.month + 1).padStart(2, '0')} ({MONTH_NAMES[nextBirthday.month]})
            </span>
          </div>
        )}
      </div>

      {/* Grade de seleção rápida de meses */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Navegação rápida por mês</p>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
          {MONTH_NAMES.map((m, idx) => {
            const count = interns.filter(i => {
              if (!i.birthdate) return false;
              if (filterUnit !== 'all' && i.unitId !== filterUnit) return false;
              return new Date(i.birthdate + 'T00:00:00').getMonth() === idx;
            }).length;
            return (
              <button
                key={idx}
                onClick={() => setSelectedMonth(idx)}
                className={`py-2 rounded-lg text-center transition-all ${
                  selectedMonth === idx
                    ? `bg-gradient-to-br ${MONTH_COLORS[idx]} text-white shadow-sm`
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="text-[10px] font-bold block">{m.substring(0, 3)}</span>
                {count > 0 && (
                  <span className={`text-[9px] font-extrabold block ${selectedMonth === idx ? 'text-white/80' : 'text-pink-500'}`}>
                    {count}🎂
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards de aniversariantes */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={16} className="text-pink-500" />
          <h3 className="font-bold text-gray-800 text-sm">
            Aniversariantes em {MONTH_NAMES[selectedMonth]}
          </h3>
          <span className="ml-auto text-[10px] bg-pink-100 text-pink-800 font-bold px-2.5 py-1 rounded-full">
            {birthdayInterns.length} {birthdayInterns.length === 1 ? 'pessoa' : 'pessoas'}
          </span>
        </div>

        {birthdayInterns.length === 0 ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl py-14 text-center">
            <span className="text-4xl block mb-3">🎂</span>
            <p className="text-slate-500 font-semibold text-sm">Nenhum aniversariante em {MONTH_NAMES[selectedMonth]}</p>
            <p className="text-slate-400 text-xs mt-1">Cadastre as datas de nascimento dos estagiários na seção abaixo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {birthdayInterns.map(intern => {
              const d = new Date(intern.birthdate + 'T00:00:00');
              const day = d.getDate();
              const age = new Date().getFullYear() - d.getFullYear();
              const isToday = new Date().getDate() === day && new Date().getMonth() === selectedMonth;

              return (
                <div
                  key={intern.id}
                  className={`relative bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 ${
                    isToday ? 'border-pink-400 shadow-pink-100 ring-2 ring-pink-300' : 'border-slate-100'
                  }`}
                >
                  {isToday && (
                    <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-extrabold text-center py-1.5 uppercase tracking-widest">
                      🎉 Hoje é o aniversário!
                    </div>
                  )}
                  <div className={`flex gap-4 p-4 ${isToday ? '' : ''}`}>
                    <div className="shrink-0">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shadow-inner">
                        {intern.photo
                          ? <img src={intern.photo} alt={intern.name} className="w-full h-full object-cover" />
                          : <span className="text-3xl">👤</span>
                        }
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm truncate leading-tight">{intern.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{intern.course || '—'}</p>
                      <p className="text-[10px] text-slate-400 truncate">{unitName(intern.unitId)}</p>
                      <div className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-gradient-to-r ${MONTH_COLORS[selectedMonth]} text-white shadow-sm`}>
                        <Cake size={11} />
                        {String(day).padStart(2, '0')}/{String(selectedMonth + 1).padStart(2, '0')} — {age} anos
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Estagiários sem data cadastrada */}
      {withoutBirthday.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
            <Users size={15} className="text-amber-600" />
            <h3 className="font-bold text-amber-800 text-sm">
              Estagiários sem data de nascimento cadastrada
            </h3>
            <span className="ml-auto text-[10px] bg-amber-200 text-amber-900 font-bold px-2.5 py-1 rounded-full">
              {withoutBirthday.length}
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {withoutBirthday.map(intern => (
              <div key={intern.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {intern.photo
                    ? <img src={intern.photo} alt={intern.name} className="w-full h-full object-cover" />
                    : <span className="text-sm">👤</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-xs truncate">{intern.name}</p>
                  <p className="text-[10px] text-slate-400">{unitName(intern.unitId)} · {intern.shift || '—'}</p>
                </div>
                {editingId === intern.id ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="date"
                      value={editBirthday}
                      onChange={e => setEditBirthday(e.target.value)}
                      className="text-[11px] p-1.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                    <button
                      onClick={() => handleSaveBirthday(intern.id)}
                      disabled={saving || !editBirthday}
                      className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                      title="Salvar"
                    >
                      <Save size={13} />
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditBirthday(''); }}
                      className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                      title="Cancelar"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingId(intern.id); setEditBirthday(''); }}
                    className="flex items-center gap-1.5 text-[10px] text-blue-600 hover:text-blue-800 font-semibold bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                  >
                    <Edit2 size={11} /> Cadastrar Data
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
