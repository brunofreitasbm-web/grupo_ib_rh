import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, GripVertical, X, MapPin, Users, ChevronDown, Loader2, RotateCcw, ArrowRightLeft, UserCheck, Sparkles, Filter, Info, Briefcase } from 'lucide-react';
import { supabase } from '../../supabase';
import { BRANDING } from '../../config/branding';
import { DISC_PROFILE_INFO, discProfileCode } from '../../utils/disc';
import { ROLE_PROFILES, ROLE_BY_ID, SIMULATION_UNITS, UNIT_ACCENT_CLASSES } from '../../config/roleProfiles';
import { computeRoleFit, bestRoleFor, FIT_LEVELS } from '../../utils/roleFit';
import { teamDiscComposition, teamSynergyNote } from '../../utils/teamFit';
import DiscResultModal from './DiscResultModal';

// Quadro de simulação: um "basket" por unidade, com um quadrante por função.
// Permite ao gestor arrastar tanto CANDIDATOS (do Banco de Talentos) quanto
// COLABORADORES (equipe contratada: Estagiários, Profissionais PJ e Funcionários CLT)
// entre unidades e funções para simular rearranjos de equipe, analisar o encaixe
// comportamental (Role Fit) e a recomposição do DISC da equipe em cada operação.

const DRAG_MIME = 'text/plain';
const STAFF_STORAGE_KEY = 'staff_disc_simulations_v2';

const SUBJECT_TYPE_LABEL = {
  intern: 'Estagiário',
  professional: 'Profissional PJ',
  employee: 'Funcionário CLT',
};

const SUBJECT_TYPE_ROLE_ID = {
  intern: 'estagiario',
  professional: 'profissional_pj',
  employee: 'operador_recepcao',
};

// Equipe já contratada (estagiários/PJ/CLT) com os resultados DISC
function useHiredTeam() {
  const [allStaff, setAllStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [internsRes, professionalsRes, employeesRes, assessmentsRes] = await Promise.all([
        supabase.from('interns').select('id, name, unit_id, role_id').neq('active', false),
        supabase.from('professionals').select('id, name, unit_id, role_id').neq('active', false),
        supabase.from('employees').select('id, name, unit_id, role_id').eq('status', 'ativo'),
        supabase.from('staff_disc_assessments').select('*'),
      ]);
      if (internsRes.error) throw internsRes.error;
      if (professionalsRes.error) throw professionalsRes.error;
      if (employeesRes.error) throw employeesRes.error;
      if (assessmentsRes.error) throw assessmentsRes.error;

      const roster = [
        ...(internsRes.data || []).map((r) => ({ ...r, subjectType: 'intern' })),
        ...(professionalsRes.data || []).map((r) => ({ ...r, subjectType: 'professional' })),
        ...(employeesRes.data || []).map((r) => ({ ...r, subjectType: 'employee' })),
      ];

      const assessmentByKey = Object.fromEntries(
        (assessmentsRes.data || []).map((a) => [`${a.subject_type}:${a.subject_id}`, a])
      );

      const list = roster.map((r) => {
        const key = `${r.subjectType}:${r.id}`;
        const roleId = r.role_id || SUBJECT_TYPE_ROLE_ID[r.subjectType];
        const assessment = assessmentByKey[key] || null;
        return {
          key,
          id: r.id,
          name: r.name,
          subjectType: r.subjectType,
          subjectLabel: SUBJECT_TYPE_LABEL[r.subjectType] || 'Colaborador',
          originalUnitId: r.unit_id,
          originalRoleId: roleId,
          assessment,
        };
      });

      setAllStaff(list);
    } catch (err) {
      console.error('Erro ao carregar equipe já contratada para Simulação por Unidade:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { allStaff, loading, reload };
}

const resolveUnits = () =>
  SIMULATION_UNITS.map((u) => {
    const ku = (BRANDING.kioskUnits || []).find((k) => k.id === u.id);
    return {
      id: u.id,
      label: u.shortLabel,
      fullName: ku?.name || u.shortLabel,
      address: ku?.address || '',
      accent: UNIT_ACCENT_CLASSES[ku?.accent] || UNIT_ACCENT_CLASSES.emerald,
    };
  });

export default function UnitBasketBoard({
  candidates,
  assignmentsById,
  busyId,
  onAssign,
  onUnassign,
  onOpenFit,
}) {
  const units = useMemo(resolveUnits, []);
  const unitsById = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u])), [units]);

  const [activeSideTab, setActiveSideTab] = useState('candidatos'); // 'candidatos' | 'equipe'
  const [search, setSearch] = useState('');
  const [teamDetail, setTeamDetail] = useState(null); // membro da equipe em detalhe (DiscResultModal)
  const [draggingId, setDraggingId] = useState(null); // ex: 'candidate:123' ou 'staff:employee:45'
  const [hoverKey, setHoverKey] = useState(null);

  const { allStaff, loading: staffLoading } = useHiredTeam();

  // Simulação local dos colaboradores (qual unidade/função cada colaborador foi movido)
  const [staffSimulations, setStaffSimulations] = useState(() => {
    try {
      const saved = localStorage.getItem(STAFF_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (_) {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staffSimulations));
    } catch (_) {}
  }, [staffSimulations]);

  const assignStaff = useCallback((staffKey, unitId, roleId) => {
    setStaffSimulations((prev) => ({
      ...prev,
      [staffKey]: { unit_id: unitId, role_id: roleId },
    }));
  }, []);

  const unassignStaff = useCallback((staffKey) => {
    setStaffSimulations((prev) => {
      const next = { ...prev };
      delete next[staffKey];
      return next;
    });
  }, []);

  const resetAllStaffSimulations = useCallback(() => {
    setStaffSimulations({});
    try { localStorage.removeItem(STAFF_STORAGE_KEY); } catch (_) {}
  }, []);

  const candidatesById = useMemo(() => Object.fromEntries(candidates.map((c) => [c.id, c])), [candidates]);
  const staffByKey = useMemo(() => Object.fromEntries(allStaff.map((s) => [s.key, s])), [allStaff]);

  // Candidatos filtrados
  const poolCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (!q) return true;
      return [c.full_name, c.email, c.course, c.desired_area]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [candidates, search]);

  // Colaboradores filtrados
  const poolStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allStaff.filter((s) => {
      if (!q) return true;
      const unit = unitsById[s.originalUnitId]?.label || s.originalUnitId;
      const role = ROLE_BY_ID[s.originalRoleId]?.label || s.originalRoleId;
      return [s.name, s.subjectLabel, unit, role]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [allStaff, search, unitsById]);

  // Candidatos alocados por quadrante
  const placedCandidates = useMemo(() => {
    const map = {};
    for (const [cid, a] of Object.entries(assignmentsById)) {
      const c = candidatesById[cid];
      if (!c) continue;
      const key = `${a.unit_id}::${a.role_id}`;
      (map[key] ||= []).push(c);
    }
    return map;
  }, [assignmentsById, candidatesById]);

  // Colaboradores agrupados por quadrante simulado
  const staffByQuadrant = useMemo(() => {
    const map = {};
    for (const s of allStaff) {
      const sim = staffSimulations[s.key];
      const unitId = sim ? sim.unit_id : s.originalUnitId;
      const roleId = sim ? sim.role_id : s.originalRoleId;
      const key = `${unitId}::${roleId}`;
      const isSimulated = Boolean(sim && (sim.unit_id !== s.originalUnitId || sim.role_id !== s.originalRoleId));
      (map[key] ||= []).push({
        ...s,
        simulatedUnitId: unitId,
        simulatedRoleId: roleId,
        isSimulated,
      });
    }
    return map;
  }, [allStaff, staffSimulations]);

  // Contadores globais de simulação
  const simulatedStaffCount = useMemo(() => {
    return Object.keys(staffSimulations).filter((k) => {
      const s = staffByKey[k];
      if (!s) return false;
      const sim = staffSimulations[k];
      return sim.unit_id !== s.originalUnitId || sim.role_id !== s.originalRoleId;
    }).length;
  }, [staffSimulations, staffByKey]);

  const placedCandidatesCount = useMemo(() => Object.keys(assignmentsById).length, [assignmentsById]);

  const handleDragStart = (e, type, id) => {
    const payload = `${type}:${id}`;
    e.dataTransfer.setData(DRAG_MIME, payload);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(payload);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setHoverKey(null);
  };

  const handleDrop = (e, unitId, roleId) => {
    e.preventDefault();
    const payload = e.dataTransfer.getData(DRAG_MIME) || draggingId;
    setHoverKey(null);
    setDraggingId(null);
    if (!payload) return;

    if (payload.startsWith('staff:')) {
      const staffKey = payload.slice(6);
      const s = staffByKey[staffKey];
      if (!s) return;
      const sim = staffSimulations[staffKey];
      const currentUnit = sim ? sim.unit_id : s.originalUnitId;
      const currentRole = sim ? sim.role_id : s.originalRoleId;
      if (currentUnit === unitId && currentRole === roleId) return;
      assignStaff(staffKey, unitId, roleId);
    } else {
      const cid = payload.replace(/^candidate:/, '');
      const c = candidatesById[cid];
      if (!c) return;
      const current = assignmentsById[cid];
      if (current && current.unit_id === unitId && current.role_id === roleId) return;
      onAssign(c, unitId, roleId);
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra de Ações Rápidas da Simulação */}
      {(simulatedStaffCount > 0 || placedCandidatesCount > 0) && (
        <div className="bg-slate-900 text-white rounded-xl p-3.5 px-5 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold tracking-wide uppercase text-slate-300">Estudo de Simulação Ativo</p>
              <p className="text-xs text-slate-300">
                {simulatedStaffCount > 0 && <span><strong>{simulatedStaffCount}</strong> colaborador(es) transferido(s)</span>}
                {simulatedStaffCount > 0 && placedCandidatesCount > 0 && <span> · </span>}
                {placedCandidatesCount > 0 && <span><strong>{placedCandidatesCount}</strong> candidato(s) alocado(s)</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {simulatedStaffCount > 0 && (
              <button
                type="button"
                onClick={resetAllStaffSimulations}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors border border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                Resetar mudanças de equipe
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Coluna Esquerda: Banco de Pessoas para Simulação (Candidatos ou Colaboradores) */}
        <div className="lg:col-span-3 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" /> Pessoas para Simulação
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Arraste qualquer pessoa para uma função de unidade para avaliar o encaixe DISC e a sinergia com a operação.
              </p>
            </div>

            {/* Alternador de Abas do Painel Esquerdo */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveSideTab('candidatos')}
                className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeSideTab === 'candidatos'
                    ? 'bg-white text-slate-900 font-bold shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Candidatos</span>
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600">
                  {candidates.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSideTab('equipe')}
                className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeSideTab === 'equipe'
                    ? 'bg-white text-slate-900 font-bold shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                <span>Equipe</span>
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600">
                  {allStaff.length}
                </span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={activeSideTab === 'candidatos' ? "Buscar candidato..." : "Buscar colaborador..."}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Conteúdo da Lista */}
            <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
              {activeSideTab === 'candidatos' ? (
                poolCandidates.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    {candidates.length === 0 ? 'Nenhum candidato concluiu o Levantamento de Perfil ainda.' : 'Nenhum candidato corresponde à busca.'}
                  </p>
                ) : (
                  poolCandidates.map((c) => (
                    <CandidateCard
                      key={c.id}
                      candidate={c}
                      assignment={assignmentsById[c.id]}
                      units={units}
                      busy={busyId === c.id}
                      dragging={draggingId === `candidate:${c.id}`}
                      onDragStart={(e) => handleDragStart(e, 'candidate', c.id)}
                      onDragEnd={handleDragEnd}
                      onAssign={(unitId, roleId) => onAssign(c, unitId, roleId)}
                      onUnassign={() => onUnassign(c)}
                    />
                  ))
                )
              ) : (
                staffLoading ? (
                  <div className="p-6 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                    <p className="text-xs">Carregando colaboradores...</p>
                  </div>
                ) : poolStaff.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Nenhum colaborador encontrado.</p>
                ) : (
                  poolStaff.map((s) => (
                    <StaffSidebarCard
                      key={s.key}
                      member={s}
                      units={units}
                      simulated={staffSimulations[s.key]}
                      dragging={draggingId === `staff:${s.key}`}
                      onDragStart={(e) => handleDragStart(e, 'staff', s.key)}
                      onDragEnd={handleDragEnd}
                      onAssign={(unitId, roleId) => assignStaff(s.key, unitId, roleId)}
                      onReset={() => unassignStaff(s.key)}
                      onOpenDetail={() => s.assessment && setTeamDetail(s)}
                    />
                  ))
                )
              )}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Baskets por Unidade */}
        <div className="lg:col-span-9 space-y-4">
          {units.map((unit) => (
            <div key={unit.id} className={`rounded-2xl border-2 ${unit.accent.border} bg-white overflow-hidden shadow-xs`}>
              <div className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 ${unit.accent.header}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${unit.accent.dot}`} />
                  <h3 className="text-sm font-bold">{unit.label}</h3>
                  <span className="text-xs opacity-75">({unit.fullName})</span>
                </div>
                {unit.address && (
                  <span className="text-[11px] flex items-center gap-1 opacity-80">
                    <MapPin className="w-3 h-3" /> {unit.address}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                {ROLE_PROFILES.map((role) => {
                  const key = `${unit.id}::${role.id}`;
                  const cItems = placedCandidates[key] || [];
                  const sItems = staffByQuadrant[key] || [];
                  const isHover = hoverKey === key;

                  // Calcula a composição DISC total desta operação (Colaboradores presentes + Candidatos alocados)
                  const staffWithDisc = sItems.filter((s) => s.assessment);
                  const candidatesWithDisc = cItems.filter((c) => c.discAssessment);
                  const combinedAssessments = [
                    ...staffWithDisc.map((s) => s.assessment),
                    ...candidatesWithDisc.map((c) => c.discAssessment),
                  ];
                  const composition = teamDiscComposition(combinedAssessments);

                  return (
                    <div
                      key={role.id}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (hoverKey !== key) setHoverKey(key); }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHoverKey((k) => (k === key ? null : k)); }}
                      onDrop={(e) => handleDrop(e, unit.id, role.id)}
                      className={`p-3 min-h-[160px] transition-all flex flex-col justify-between ${
                        isHover
                          ? 'bg-blue-50/80 ring-2 ring-inset ring-blue-400'
                          : draggingId
                          ? 'bg-slate-50/60'
                          : 'bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-800">{role.label}</span>
                          <span
                            className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-slate-100 text-slate-600 border-slate-200"
                            title={`Perfil esperado: ${role.expectedCode}`}
                          >
                            {role.expectedCode}
                          </span>
                        </div>

                        {/* Colaboradores na operação (Originais + Transferidos) */}
                        <div className="space-y-1.5 mb-2">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                            <span>Equipe da operação ({sItems.length})</span>
                          </div>

                          {sItems.length === 0 ? (
                            <p className="text-[10px] text-slate-300 italic py-1">Nenhum colaborador nesta função</p>
                          ) : (
                            sItems.map((s) => (
                              <PlacedStaffCard
                                key={s.key}
                                member={s}
                                role={role}
                                targetUnit={unit}
                                composition={composition}
                                dragging={draggingId === `staff:${s.key}`}
                                onDragStart={(e) => handleDragStart(e, 'staff', s.key)}
                                onDragEnd={handleDragEnd}
                                onOpenFit={() => s.assessment && onOpenFit({ full_name: s.name, discAssessment: s.assessment }, role, unit, composition)}
                                onOpenDisc={() => s.assessment && setTeamDetail(s)}
                                onReset={() => unassignStaff(s.key)}
                                units={units}
                                onAssign={(unitId, roleId) => assignStaff(s.key, unitId, roleId)}
                              />
                            ))
                          )}
                        </div>

                        {/* Candidatos Alocados nesta função */}
                        <div className="space-y-1.5 border-t border-slate-100 pt-2">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                            <span>Candidatos em teste ({cItems.length})</span>
                          </div>

                          {cItems.length === 0 ? (
                            <div className="h-14 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-center p-1">
                              <span className="text-[10px] text-slate-400">Solte um candidato ou colaborador aqui</span>
                            </div>
                          ) : (
                            cItems.map((c) => (
                              <PlacedCandidateCard
                                key={c.id}
                                candidate={c}
                                role={role}
                                composition={composition}
                                busy={busyId === c.id}
                                dragging={draggingId === `candidate:${c.id}`}
                                onDragStart={(e) => handleDragStart(e, 'candidate', c.id)}
                                onDragEnd={handleDragEnd}
                                onOpen={() => onOpenFit(c, role, unit, composition)}
                                onRemove={() => onUnassign(c)}
                              />
                            ))
                          )}
                        </div>
                      </div>

                      {/* Resumo da composição DISC da quadrante */}
                      {combinedAssessments.length > 0 && (
                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                          <span className="font-semibold text-slate-600">DISC da Operação:</span>
                          <span className="font-mono text-slate-700">
                            {['D', 'I', 'S', 'C'].filter((f) => composition.counts[f] > 0).map((f) => `${f}:${composition.counts[f]}`).join(' ')}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {teamDetail && (
        <DiscResultModal
          candidate={{ full_name: teamDetail.name }}
          assessment={teamDetail.assessment}
          onClose={() => setTeamDetail(null)}
        />
      )}
    </div>
  );
}

function ProfileBadge({ assessment }) {
  if (!assessment || !assessment.primary_profile) {
    return (
      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-400 border border-slate-200" title="Sem Levantamento DISC concluído">
        Sem DISC
      </span>
    );
  }
  const info = DISC_PROFILE_INFO[assessment.primary_profile];
  if (!info) return null;
  return (
    <span
      className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${info.badge}`}
      title={`${info.label}${assessment.secondary_profile ? ' / ' + DISC_PROFILE_INFO[assessment.secondary_profile].label : ''}`}
    >
      {discProfileCode(assessment.primary_profile, assessment.secondary_profile)}
    </span>
  );
}

function FitBadge({ fit, compact }) {
  if (!fit) return null;
  const lvl = FIT_LEVELS[fit.level];
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${lvl.badge}`} title={lvl.label}>
      {fit.score}{compact ? '' : ` · ${lvl.label}`}
    </span>
  );
}

// Card de Candidato na Coluna Esquerda
function CandidateCard({ candidate, assignment, units, busy, dragging, onDragStart, onDragEnd, onAssign, onUnassign }) {
  const best = useMemo(() => bestRoleFor(candidate.discAssessment), [candidate.discAssessment]);
  const unit = assignment ? units.find((u) => u.id === assignment.unit_id) : null;
  return (
    <div
      draggable={!busy}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`border rounded-xl p-2.5 bg-white shadow-xs cursor-grab active:cursor-grabbing select-none transition-all ${
        dragging ? 'opacity-40 border-blue-400 ring-2 ring-blue-300' : assignment ? 'opacity-75 border-slate-200 bg-slate-50/50' : 'border-slate-300 hover:border-slate-400 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-800 truncate">{candidate.full_name || '—'}</span>
            <ProfileBadge assessment={candidate.discAssessment} />
          </div>
          {candidate.course && <p className="text-[11px] text-slate-500 truncate">{candidate.course}</p>}
          {best && (
            <p className="text-[10px] text-slate-500 mt-0.5">
              Sugestão: <span className="font-semibold">{best.role.short}</span> <FitBadge fit={best.fit} compact />
            </p>
          )}
          {assignment && (
            <p className="text-[10px] text-blue-700 font-medium mt-0.5 truncate">
              → {unit?.label || assignment.unit_id} · {ROLE_BY_ID[assignment.role_id]?.short || assignment.role_id}
            </p>
          )}
        </div>
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
        ) : (
          <AssignMenu units={units} assignment={assignment} onAssign={onAssign} onUnassign={onUnassign} />
        )}
      </div>
    </div>
  );
}

// Card de Colaborador na Coluna Esquerda
function StaffSidebarCard({ member, units, simulated, dragging, onDragStart, onDragEnd, onAssign, onReset, onOpenDetail }) {
  const origUnit = units.find((u) => u.id === member.originalUnitId);
  const origRole = ROLE_BY_ID[member.originalRoleId];
  const simUnit = simulated ? units.find((u) => u.id === simulated.unit_id) : null;
  const simRole = simulated ? ROLE_BY_ID[simulated.role_id] : null;
  const isSimulated = Boolean(simulated && (simulated.unit_id !== member.originalUnitId || simulated.role_id !== member.originalRoleId));

  return (
    <div
      draggable={true}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`border rounded-xl p-2.5 bg-white shadow-xs cursor-grab active:cursor-grabbing select-none transition-all ${
        dragging
          ? 'opacity-40 border-indigo-400 ring-2 ring-indigo-300'
          : isSimulated
          ? 'border-indigo-300 bg-indigo-50/40 ring-1 ring-indigo-200'
          : 'border-slate-300 hover:border-slate-400 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button type="button" onClick={onOpenDetail} className="text-xs font-semibold text-slate-800 hover:underline truncate text-left">
              {member.name}
            </button>
            <ProfileBadge assessment={member.assessment} />
          </div>
          <p className="text-[11px] text-slate-500">
            {member.subjectLabel} · <span className="font-medium text-slate-700">{origUnit?.label || member.originalUnitId}</span>
          </p>
          {isSimulated ? (
            <div className="mt-1 flex items-center justify-between gap-1 text-[10px] bg-indigo-100/80 text-indigo-900 px-2 py-0.5 rounded border border-indigo-200 font-medium">
              <span className="truncate">→ Simulado: {simUnit?.label} ({simRole?.short})</span>
              <button type="button" onClick={onReset} className="text-indigo-600 hover:text-red-600 ml-1 font-bold shrink-0" title="Reverter para unidade original">
                ×
              </button>
            </div>
          ) : (
            <p className="text-[10px] text-slate-400 mt-0.5">Função atual: {origRole?.short || member.originalRoleId}</p>
          )}
        </div>

        <AssignMenu
          units={units}
          assignment={simulated || { unit_id: member.originalUnitId, role_id: member.originalRoleId }}
          onAssign={onAssign}
          onUnassign={isSimulated ? onReset : null}
        />
      </div>
    </div>
  );
}

// Card de Colaborador Alocado dentro da Quadrante da Operação
function PlacedStaffCard({ member, role, targetUnit, composition, dragging, onDragStart, onDragEnd, onOpenFit, onOpenDisc, onReset, units, onAssign }) {
  const isSimulated = member.isSimulated;
  const origUnit = units.find((u) => u.id === member.originalUnitId);
  const origRole = ROLE_BY_ID[member.originalRoleId];

  const fit = useMemo(() => {
    if (!member.assessment) return null;
    return computeRoleFit(member.assessment, role);
  }, [member.assessment, role]);

  const synergy = useMemo(() => {
    if (!member.assessment) return null;
    return teamSynergyNote(member.assessment, composition);
  }, [member.assessment, composition]);

  return (
    <div
      draggable={true}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`border rounded-lg p-2 transition-all cursor-grab active:cursor-grabbing shadow-xs ${
        dragging
          ? 'opacity-40 ring-2 ring-indigo-400'
          : isSimulated
          ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200'
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={onOpenFit}
              className="text-xs font-semibold text-slate-800 hover:text-blue-600 truncate text-left"
              title="Clique para ver a análise de encaixe e sinergia"
            >
              {member.name}
            </button>
            <ProfileBadge assessment={member.assessment} />
            {isSimulated && (
              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-indigo-600 text-white uppercase tracking-wider">
                Simulado
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            {fit && <FitBadge fit={fit} compact />}
            {isSimulated ? (
              <span className="text-[9px] text-indigo-700 font-medium truncate" title={`Origem real: ${origUnit?.label} (${origRole?.short})`}>
                Origem: {origUnit?.label}
              </span>
            ) : (
              <span className="text-[9px] text-slate-400">{member.subjectLabel}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isSimulated && (
            <button
              type="button"
              onClick={onReset}
              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
              title="Voltar colaborador para a unidade original"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <AssignMenu
            units={units}
            assignment={{ unit_id: targetUnit.id, role_id: role.id }}
            onAssign={onAssign}
            onUnassign={isSimulated ? onReset : null}
          />
        </div>
      </div>
    </div>
  );
}

const SYNERGY_DOT = { empty: 'bg-slate-300', positive: 'bg-emerald-500', caution: 'bg-amber-500', neutral: 'bg-sky-500' };

// Card de Candidato Alocado dentro da Quadrante da Operação
function PlacedCandidateCard({ candidate, role, composition, busy, dragging, onDragStart, onDragEnd, onOpen, onRemove }) {
  const fit = useMemo(() => computeRoleFit(candidate.discAssessment, role), [candidate.discAssessment, role]);
  const synergy = useMemo(() => teamSynergyNote(candidate.discAssessment, composition), [candidate.discAssessment, composition]);

  return (
    <div
      draggable={!busy}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`border border-slate-200 rounded-lg bg-white px-2 py-1.5 flex items-center gap-1.5 shadow-xs cursor-grab active:cursor-grabbing ${
        dragging ? 'opacity-40 ring-2 ring-blue-400' : ''
      }`}
    >
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left" title="Ver detalhe do encaixe e da sinergia com a equipe">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-800 truncate">{candidate.full_name}</span>
          <ProfileBadge assessment={candidate.discAssessment} />
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
          <FitBadge fit={fit} />
          {synergy && synergy.tone !== 'empty' && (
            <span className="inline-flex items-center gap-1 text-[9px] text-slate-500" title={synergy.note}>
              <span className={`w-1.5 h-1.5 rounded-full ${SYNERGY_DOT[synergy.tone]}`} /> equipe
            </span>
          )}
        </div>
      </button>

      {busy ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />
      ) : (
        <button type="button" onClick={onRemove} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0" title="Remover da simulação">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// Menu suspenso para alocar em qualquer unidade x função (alternativa acessível ao drag & drop)
function AssignMenu({ units, assignment, onAssign, onUnassign }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        title="Alocar ou mover em…"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-60 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 text-xs max-h-72 overflow-y-auto">
          {units.map((u) => (
            <div key={u.id}>
              <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide truncate">{u.label}</div>
              {ROLE_PROFILES.map((r) => {
                const active = assignment?.unit_id === u.id && assignment?.role_id === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={active}
                    onClick={(e) => { e.stopPropagation(); setOpen(false); onAssign(u.id, r.id); }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 disabled:text-indigo-600 disabled:font-semibold"
                  >
                    <span>{r.label}</span>
                    <span className="text-[10px] text-slate-400">{r.expectedCode}</span>
                  </button>
                );
              })}
            </div>
          ))}
          {assignment && onUnassign && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); onUnassign(); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
              >
                <X className="w-3.5 h-3.5" /> Reverter alocação
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
