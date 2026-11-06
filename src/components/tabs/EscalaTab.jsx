import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Trash2, Save, AlertTriangle, GripVertical, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../supabase';
import { mapInternFromDb, mapUnitFromDb, INTERN_SELECT_FIELDS } from '../../utils/mappings';
import { BRANDING } from '../../config/branding';
import { LABOR } from '../../config/labor';
import {
  monthDates, weekStartOf, hoursPerDay, generateMonthSchedule, validateSchedule,
} from '../../utils/escala';
import { weekdayOf } from '../../utils/cltCalculations';
import {
  openingHours, formatOpeningHours, isShoppingUnit, shiftWindows, shiftDuration, internShift, SHIFTS,
} from '../../config/shoppingHours';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAY_HEAD = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const DRAG_MIME = 'text/plain';

const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const shiftMonth = (monthKey, delta) => {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// entries: { [internId]: { [data]: { [turno]: { hours, source } } } }
// Cada dia tem 2 alocações independentes: Manhã e Tarde.
const dayHours = (byShift) => Object.values(byShift || {}).reduce((s, e) => s + e.hours, 0);
export default function EscalaTab({ filterUnit, restrictedUnitIds = [] }) {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [interns, setInterns] = useState([]);
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState('');
  const [entries, setEntries] = useState({});
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadBase = useCallback(async () => {
    const [{ data: internsData }, { data: unitsData }] = await Promise.all([
      supabase.from('interns').select(INTERN_SELECT_FIELDS).order('name', { ascending: true }),
      supabase.from('units').select('*').order('name', { ascending: true }),
    ]);
    if (internsData) {
      setInterns(internsData.map(mapInternFromDb)
        .filter((i) => i.active !== false && !restrictedUnitIds.includes(i.unitId)));
    }
    if (unitsData) setUnits(unitsData.map(mapUnitFromDb).filter((u) => !restrictedUnitIds.includes(u.id)));
    setLoading(false);
  }, [restrictedUnitIds]);

  useEffect(() => { loadBase(); }, [loadBase]);

  // Unidade da escala: segue o filtro global; sem filtro, a primeira disponível.
  useEffect(() => {
    if (filterUnit && filterUnit !== 'all') setUnitId(filterUnit);
    else if (!unitId && units.length) setUnitId(units[0].id);
  }, [filterUnit, units, unitId]);

  const unitInterns = useMemo(
    () => interns.filter((i) => i.unitId === unitId), [interns, unitId]);

  const dates = useMemo(() => monthDates(monthKey), [monthKey]);

  // Carrega a escala salva do mês (se a tabela ainda não existir, segue vazio).
  useEffect(() => {
    if (!unitId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('intern_schedule_entries')
        .select('intern_id, work_date, shift, hours, source')
        .eq('unit_id', unitId)
        .gte('work_date', dates[0])
        .lte('work_date', dates[dates.length - 1]);
      if (cancelled) return;
      const next = {};
      if (!error) {
        for (const r of data || []) {
          ((next[r.intern_id] ||= {})[r.work_date] ||= {})[r.shift || 'Manhã'] = { hours: Number(r.hours), source: r.source };
        }
      }
      setEntries(next);
      setDirty(false);
    })();
    return () => { cancelled = true; };
  }, [unitId, dates]);

  const place = (internId, date, shift) => {
    const intern = interns.find((i) => i.id === internId);
    if (!intern) return;
    const hours = Math.min(hoursPerDay(intern), shiftDuration(shift));
    setEntries((prev) => {
      const days = prev[internId] || {};
      return {
        ...prev,
        [internId]: { ...days, [date]: { ...(days[date] || {}), [shift]: { hours, source: 'manual' } } },
      };
    });
    setDirty(true);
  };
  const remove = (internId, date, shift) => {
    setEntries((prev) => {
      const days = prev[internId] || {};
      const { [shift]: _, ...restShifts } = days[date] || {};
      const { [date]: __, ...restDays } = days;
      return {
        ...prev,
        [internId]: Object.keys(restShifts).length ? { ...restDays, [date]: restShifts } : restDays,
      };
    });
    setDirty(true);
  };

  const complete = () => {
    // Só o que foi arrastado à mão fica fixo; o resto é regerado.
    const fixed = {};
    const fixedShifts = {};
    for (const intern of unitInterns) {
      const manualDays = {};
      for (const [d, byShift] of Object.entries(entries[intern.id] || {})) {
        const manual = Object.entries(byShift).filter(([, e]) => e.source === 'manual');
        if (manual.length) manualDays[d] = manual;
      }
      if (Object.keys(manualDays).length) {
        fixed[intern.id] = Object.fromEntries(Object.entries(manualDays)
          .map(([d, list]) => [d, list.reduce((s, [, e]) => s + e.hours, 0)]));
        fixedShifts[intern.id] = manualDays;
      }
    }
    const generated = generateMonthSchedule({ monthKey, interns: unitInterns, fixed });
    const next = {};
    for (const intern of unitInterns) {
      next[intern.id] = {};
      // Manuais mantêm turno e horas; os dias novos entram no turno padrão do cadastro.
      for (const [d, list] of Object.entries(fixedShifts[intern.id] || {})) {
        next[intern.id][d] = Object.fromEntries(list);
      }
      const defaultShift = internShift(intern);
      for (const [d, h] of Object.entries(generated[intern.id] || {})) {
        if (next[intern.id][d]) continue;
        next[intern.id][d] = {
          [defaultShift]: { hours: Math.min(h, shiftDuration(defaultShift)), source: 'auto' },
        };
      }
    }
    setEntries(next);
    setDirty(true);
    toast.success('Escala completada. Revise e salve.');
  };

  const clearAuto = () => {
    setEntries((prev) => {
      const next = {};
      for (const [id, days] of Object.entries(prev)) {
        next[id] = {};
        for (const [d, byShift] of Object.entries(days)) {
          const manual = Object.fromEntries(Object.entries(byShift).filter(([, e]) => e.source === 'manual'));
          if (Object.keys(manual).length) next[id][d] = manual;
        }
      }
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const { error: delErr } = await supabase
        .from('intern_schedule_entries').delete()
        .eq('unit_id', unitId).gte('work_date', dates[0]).lte('work_date', dates[dates.length - 1]);
      if (delErr) throw delErr;
      const rows = [];
      for (const intern of unitInterns) {
        for (const [d, byShift] of Object.entries(entries[intern.id] || {})) {
          for (const [shift, e] of Object.entries(byShift)) {
            rows.push({
              workspace_id: intern.workspaceId || BRANDING.id, unit_id: unitId,
              intern_id: intern.id, work_date: d, shift, hours: e.hours, source: e.source,
            });
          }
        }
      }
      if (rows.length) {
        const { error } = await supabase.from('intern_schedule_entries').insert(rows);
        if (error) throw error;
      }
      setDirty(false);
      toast.success('Escala salva.');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar a escala. A migration da tabela já foi aplicada?');
    } finally {
      setSaving(false);
    }
  };

  // Grade: semanas de segunda a domingo, com células vazias fora do mês.
  const weeks = useMemo(() => {
    const byWeek = new Map();
    for (const d of dates) {
      const ws = weekStartOf(d);
      if (!byWeek.has(ws)) byWeek.set(ws, Array(7).fill(null));
      byWeek.get(ws)[(weekdayOf(d) + 6) % 7] = d;
    }
    return [...byWeek.values()];
  }, [dates]);

  const namesOn = (date, shift) => unitInterns
    .filter((i) => entries[i.id]?.[date]?.[shift])
    .map((i) => ({ intern: i, entry: entries[i.id][date][shift] }));

  // Turnos sem ninguém, por dia (só em shopping, onde há horário de funcionamento).
  const uncovered = useMemo(() => {
    const out = {};
    if (!isShoppingUnit(unitId)) return out;
    for (const d of dates) {
      const missing = SHIFTS.filter((s) => !unitInterns.some((i) => entries[i.id]?.[d]?.[s]));
      if (missing.length) out[d] = missing;
    }
    return out;
  }, [dates, entries, unitInterns, unitId]);
  const uncoveredCount = Object.values(uncovered).reduce((s, m) => s + m.length, 0);

  const problems = useMemo(() => {
    const out = [];
    for (const i of unitInterns) {
      const flat = Object.fromEntries(Object.entries(entries[i.id] || {}).map(([d, byShift]) => [d, dayHours(byShift)]));
      for (const p of validateSchedule(flat)) out.push({ name: i.name, ...p });
    }
    return out;
  }, [entries, unitInterns]);

  const weekHours = (internId, week) => week.reduce(
    (s, d) => s + (d ? dayHours(entries[internId]?.[d]) : 0), 0);

  const [y, m] = monthKey.split('-').map(Number);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-gray-800">Escala de Estagiários</h2>
        <div className="flex items-center gap-1 ml-auto">
          <button className="p-2 rounded hover:bg-gray-100" onClick={() => setMonthKey(shiftMonth(monthKey, -1))} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
          <span className="font-semibold w-40 text-center">{MONTH_NAMES[m - 1]} {y}</span>
          <button className="p-2 rounded hover:bg-gray-100" onClick={() => setMonthKey(shiftMonth(monthKey, 1))} aria-label="Próximo mês"><ChevronRight size={18} /></button>
        </div>
        {(!filterUnit || filterUnit === 'all') && (
          <select className="border rounded px-2 py-1.5 text-sm" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <button onClick={complete} className="flex items-center gap-1.5 px-3 py-2 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
          <Sparkles size={16} /> Completar escala
        </button>
        <button onClick={clearAuto} className="flex items-center gap-1.5 px-3 py-2 rounded border text-sm hover:bg-gray-50">
          <Trash2 size={16} /> Limpar automáticos
        </button>
        <button onClick={save} disabled={!dirty || saving} className="flex items-center gap-1.5 px-3 py-2 rounded bg-green-600 text-white text-sm font-semibold disabled:opacity-40">
          <Save size={16} /> {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Regras: {LABOR.maxWeeklyHours}h/semana, máx. {LABOR.maxDailyHours}h/dia, semana de segunda a domingo. Sexta e sábado fixos; os demais dias alternam.
        {isShoppingUnit(unitId) && ' Funcionamento do shopping: seg a sáb 10h–22h, domingo 12h–22h.'}{' '}
        Arraste o nome para o turno (Manhã ou Tarde) do dia, ou clique no nome e depois no turno. Clique no nome dentro do turno para remover.
      </p>

      {problems.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>{problems.slice(0, 5).map((p, k) => (
            <div key={k}>{p.name}: {p.type === 'day' ? `${p.hours}h em ${p.date}` : `${p.hours}h na semana de ${p.weekStart}`} (limite excedido)</div>
          ))}</div>
        </div>
      )}

      {isShoppingUnit(unitId) && (
        <div className={`p-2 rounded text-sm border ${uncoveredCount ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
          {uncoveredCount
            ? `${uncoveredCount} turno(s) sem estagiário no mês (marcados em vermelho no calendário).`
            : 'Todos os turnos do mês têm ao menos um estagiário.'}
          <span className="ml-2 text-xs opacity-80">Turnos: Manhã 12h–18h e Tarde 18h–22h.</span>
        </div>
      )}

      {loading ? <p className="text-gray-500">Carregando…</p> : (
        <div className="flex flex-col lg:flex-row gap-4">
          <aside className="lg:w-56 shrink-0 bg-white border rounded-lg p-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Estagiários ({unitInterns.length})</h3>
            {unitInterns.length === 0 && <p className="text-xs text-gray-400">Nenhum estagiário ativo nesta unidade.</p>}
            <ul className="space-y-1.5">
              {unitInterns.map((i) => (
                <li key={i.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, i.id); e.dataTransfer.effectAllowed = 'copy'; }}
                  onClick={() => setSelectedIntern(selectedIntern === i.id ? null : i.id)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-sm cursor-grab select-none ${selectedIntern === i.id ? 'bg-blue-100 border-blue-400' : 'bg-gray-50 hover:bg-gray-100'}`}>
                  <GripVertical size={14} className="text-gray-400" />
                  <span className="truncate">{i.name}</span>
                </li>
              ))}
            </ul>
          </aside>

          <div className="flex-1 overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAY_HEAD.map((w, k) => (
                  <div key={w} className={`text-center text-xs font-semibold py-1 rounded ${k >= 4 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>{w}</div>
                ))}
              </div>
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
                  {week.map((d, di) => d ? (
                    <div key={d}
                      className={`min-h-[120px] border rounded p-1 text-xs ${di >= 4 ? 'bg-blue-50/50' : 'bg-white'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-500">{Number(d.slice(8))}</span>
                        <span className="text-[10px] text-gray-400">{formatOpeningHours(openingHours(unitId, weekdayOf(d)))}</span>
                      </div>
                      {SHIFTS.map((shift) => {
                        const w = shiftWindows(unitId)?.[shift];
                        const isMissing = uncovered[d]?.includes(shift);
                        return (
                          <div key={shift}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); place(e.dataTransfer.getData(DRAG_MIME), d, shift); }}
                            onClick={() => selectedIntern && place(selectedIntern, d, shift)}
                            className={`mb-1 rounded border border-dashed p-0.5 ${isMissing ? 'border-red-300 bg-red-50/60' : 'border-gray-200'} ${selectedIntern ? 'cursor-copy' : ''}`}>
                            <div className={`text-[10px] font-semibold ${isMissing ? 'text-red-600' : 'text-gray-400'}`}>
                              {shift}{w ? ` ${w.start}–${w.end}h` : ''}
                            </div>
                            <div className="space-y-0.5">
                              {namesOn(d, shift).map(({ intern, entry }) => (
                                <button key={intern.id}
                                  onClick={(e) => { e.stopPropagation(); remove(intern.id, d, shift); }}
                                  title={`${intern.name} — remover do turno ${shift}`}
                                  className={`group flex w-full items-center justify-between gap-1 px-1 py-0.5 rounded text-left truncate ${entry.source === 'manual' ? 'bg-blue-600 text-white' : 'bg-emerald-100 text-emerald-900'}`}>
                                  <span className="truncate">{intern.name.split(' ')[0]}</span>
                                  <X size={10} className="opacity-0 group-hover:opacity-100 shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <div key={`e${di}`} />)}
                </div>
              ))}
            </div>

            {unitInterns.length > 0 && (
              <div className="mt-4 bg-white border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 text-gray-600">
                    <th className="text-left p-2">Estagiário</th>
                    {weeks.map((_, wi) => <th key={wi} className="p-2">Sem. {wi + 1}</th>)}
                  </tr></thead>
                  <tbody>
                    {unitInterns.map((i) => (
                      <tr key={i.id} className="border-t">
                        <td className="p-2">{i.name}</td>
                        {weeks.map((w, wi) => {
                          const h = weekHours(i.id, w);
                          return <td key={wi} className={`p-2 text-center ${h > LABOR.maxWeeklyHours ? 'text-red-600 font-bold' : ''}`}>{h}h</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">
              <span className="inline-block w-3 h-3 bg-blue-600 rounded-sm align-middle mr-1" />manual
              <span className="inline-block w-3 h-3 bg-emerald-200 rounded-sm align-middle ml-3 mr-1" />automático
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
