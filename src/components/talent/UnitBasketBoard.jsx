import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, GripVertical, X, MapPin, Users, ChevronDown, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';
import { BRANDING } from '../../config/branding';
import { DISC_PROFILE_INFO, discProfileCode } from '../../utils/disc';
import { ROLE_PROFILES, ROLE_BY_ID, SIMULATION_UNITS, UNIT_ACCENT_CLASSES } from '../../config/roleProfiles';
import { computeRoleFit, bestRoleFor, FIT_LEVELS } from '../../utils/roleFit';
import { teamDiscComposition, teamSynergyNote } from '../../utils/teamFit';

// Quadro de simulação: um "basket" por unidade, com um quadrante por função.
// O gestor arrasta candidatos (com DISC concluído) da coluna esquerda para um
// quadrante e vê a compatibilidade com o perfil esperado da função — além da
// composição DISC da equipe JÁ CONTRATADA que ocupa aquele mesmo quadrante
// (estagiários/PJ/CLT marcados com essa função, ver src/hooks/useStaffDisc.js
// e as abas de cadastro), para avaliar também a sinergia com o time atual.
//
// Drag & drop nativo HTML5 (o repo não tem lib de DnD). Em telas de toque o
// arrastar não funciona bem, então cada card também tem o menu "Alocar em…".

const DRAG_MIME = 'text/plain';

// Equipe já contratada (estagiários/PJ/CLT) com função marcada, agrupada por
// quadrante unit_id×role_id, com o resultado DISC de quem já respondeu.
function useHiredTeamByQuadrant() {
  const [byQuadrant, setByQuadrant] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [internsRes, professionalsRes, employeesRes, assessmentsRes] = await Promise.all([
          supabase.from('interns').select('id, name, unit_id, role_id').not('role_id', 'is', null).neq('active', false),
          supabase.from('professionals').select('id, name, unit_id, role_id').not('role_id', 'is', null).neq('active', false),
          supabase.from('employees').select('id, name, unit_id, role_id').not('role_id', 'is', null).eq('status', 'ativo'),
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

        const map = {};
        for (const r of roster) {
          const key = `${r.unit_id}::${r.role_id}`;
          const assessment = assessmentByKey[`${r.subjectType}:${r.id}`] || null;
          (map[key] ||= []).push({ id: r.id, name: r.name, subjectType: r.subjectType, assessment });
        }
        if (!cancelled) setByQuadrant(map);
      } catch (err) {
        // Migração/colunas novas — o quadro continua funcional sem os
        // quadradinhos da equipe.
        console.error('Erro ao carregar equipe já contratada da Simulação por Unidade:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { byQuadrant, loading };
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
  const [search, setSearch] = useState('');
  const [draggingId, setDraggingId] = useState(null);
  const [hoverKey, setHoverKey] = useState(null);
  const { byQuadrant: teamByQuadrant } = useHiredTeamByQuadrant();

  const byId = useMemo(() => Object.fromEntries(candidates.map((c) => [c.id, c])), [candidates]);

  const pool = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (!q) return true;
      return [c.full_name, c.email, c.course, c.desired_area]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [candidates, search]);

  const placed = useMemo(() => {
    const map = {};
    for (const [cid, a] of Object.entries(assignmentsById)) {
      const c = byId[cid];
      if (!c) continue;
      const key = `${a.unit_id}::${a.role_id}`;
      (map[key] ||= []).push(c);
    }
    return map;
  }, [assignmentsById, byId]);

  const handleDragStart = (e, candidate) => {
    e.dataTransfer.setData(DRAG_MIME, candidate.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(candidate.id);
  };
  const handleDragEnd = () => { setDraggingId(null); setHoverKey(null); };

  const handleDrop = (e, unitId, roleId) => {
    e.preventDefault();
    const id = e.dataTransfer.getData(DRAG_MIME) || draggingId;
    setHoverKey(null);
    setDraggingId(null);
    const c = byId[id];
    if (!c) return;
    const current = assignmentsById[id];
    if (current && current.unit_id === unitId && current.role_id === roleId) return;
    onAssign(c, unitId, roleId);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Coluna: candidatos com perfil */}
      <div className="lg:col-span-3 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" /> Candidatos com perfil
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Arraste para um quadrante ou use "Alocar em…". Só aparecem candidatos com o Levantamento concluído.
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar candidato..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          {pool.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              {candidates.length === 0 ? 'Nenhum candidato concluiu o Levantamento de Perfil ainda.' : 'Nenhum candidato corresponde à busca.'}
            </p>
          ) : (
            pool.map((c) => (
              <CandidateCard
                key={c.id}
                candidate={c}
                assignment={assignmentsById[c.id]}
                units={units}
                busy={busyId === c.id}
                dragging={draggingId === c.id}
                onDragStart={(e) => handleDragStart(e, c)}
                onDragEnd={handleDragEnd}
                onAssign={(unitId, roleId) => onAssign(c, unitId, roleId)}
                onUnassign={() => onUnassign(c)}
              />
            ))
          )}
        </div>
      </div>

      {/* Coluna: baskets */}
      <div className="lg:col-span-9 space-y-4">
        {units.map((unit) => (
          <div key={unit.id} className={`rounded-2xl border-2 ${unit.accent.border} bg-white overflow-hidden`}>
            <div className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 ${unit.accent.header}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${unit.accent.dot}`} />
                <h3 className="text-sm font-bold">{unit.label}</h3>
              </div>
              {unit.address && (
                <span className="text-[11px] flex items-center gap-1 opacity-80">
                  <MapPin className="w-3 h-3" /> {unit.address}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {ROLE_PROFILES.map((role) => {
                const key = `${unit.id}::${role.id}`;
                const items = placed[key] || [];
                const isHover = hoverKey === key;
                const team = teamByQuadrant[key] || [];
                const teamWithDisc = team.filter((t) => t.assessment);
                const composition = teamDiscComposition(teamWithDisc.map((t) => t.assessment));
                return (
                  <div
                    key={role.id}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (hoverKey !== key) setHoverKey(key); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHoverKey((k) => (k === key ? null : k)); }}
                    onDrop={(e) => handleDrop(e, unit.id, role.id)}
                    className={`p-3 min-h-[140px] transition-colors ${isHover ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : draggingId ? 'bg-slate-50/60' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700">{role.label}</span>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-slate-100 text-slate-600 border-slate-200" title={`Perfil esperado: ${role.expectedCode}`}>
                        {role.expectedCode}
                      </span>
                    </div>

                    {team.length > 0 && (
                      <div className="mb-2 pb-2 border-b border-slate-100">
                        <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Equipe atual ({team.length})</p>
                        <div className="flex flex-wrap gap-1">
                          {teamWithDisc.map((t) => (
                            <TeamSquare key={t.id} member={t} />
                          ))}
                          {team.length > teamWithDisc.length && (
                            <span
                              className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-slate-400 bg-slate-100 border border-slate-200"
                              title={`${team.length - teamWithDisc.length} colaborador(es) sem Levantamento de Perfil concluído ainda`}
                            >
                              +{team.length - teamWithDisc.length}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {items.length === 0 ? (
                      <div className="h-20 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center">
                        <span className="text-[11px] text-slate-400">Solte um candidato aqui</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {items.map((c) => (
                          <PlacedCard
                            key={c.id}
                            candidate={c}
                            role={role}
                            composition={composition}
                            busy={busyId === c.id}
                            onDragStart={(e) => handleDragStart(e, c)}
                            onDragEnd={handleDragEnd}
                            onOpen={() => onOpenFit(c, role, unit, composition)}
                            onRemove={() => onUnassign(c)}
                          />
                        ))}
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
  );
}

function ProfileBadge({ assessment }) {
  const info = DISC_PROFILE_INFO[assessment.primary_profile];
  if (!info) return null;
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${info.badge}`} title={`${info.label}${assessment.secondary_profile ? ' / ' + DISC_PROFILE_INFO[assessment.secondary_profile].label : ''}`}>
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

function CandidateCard({ candidate, assignment, units, busy, dragging, onDragStart, onDragEnd, onAssign, onUnassign }) {
  const best = useMemo(() => bestRoleFor(candidate.discAssessment), [candidate.discAssessment]);
  const unit = assignment ? units.find((u) => u.id === assignment.unit_id) : null;
  return (
    <div
      draggable={!busy}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`border rounded-xl p-2.5 bg-white shadow-sm cursor-grab active:cursor-grabbing select-none transition-opacity ${
        dragging ? 'opacity-40' : assignment ? 'opacity-70 border-slate-200' : 'border-slate-300'
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
            <p className="text-[10px] text-blue-700 mt-0.5 truncate">
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

// Quadradinho fixo de um colaborador já contratado: letra do perfil primário
// sobre a cor do fator DISC (ver DISC_PROFILE_INFO). Não é arrastável — é só
// referência visual da equipe atual do quadrante.
function TeamSquare({ member }) {
  const { primary_profile: primary, secondary_profile: secondary } = member.assessment;
  const info = DISC_PROFILE_INFO[primary];
  return (
    <span
      className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
      style={{ backgroundColor: info.color }}
      title={`${member.name} — ${info.label}${secondary ? ' / ' + DISC_PROFILE_INFO[secondary].label : ''}`}
    >
      {primary}
    </span>
  );
}

const SYNERGY_DOT = { empty: 'bg-slate-300', positive: 'bg-emerald-500', caution: 'bg-amber-500', neutral: 'bg-sky-500' };

function PlacedCard({ candidate, role, composition, busy, onDragStart, onDragEnd, onOpen, onRemove }) {
  const fit = useMemo(() => computeRoleFit(candidate.discAssessment, role), [candidate.discAssessment, role]);
  const synergy = useMemo(() => teamSynergyNote(candidate.discAssessment, composition), [candidate.discAssessment, composition]);
  return (
    <div
      draggable={!busy}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="border border-slate-200 rounded-lg bg-white px-2 py-1.5 flex items-center gap-1.5 shadow-sm cursor-grab active:cursor-grabbing"
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

// Fallback sem arrastar (toque/teclado): unidade → função.
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
        className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        title="Alocar em…"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-60 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 text-xs max-h-72 overflow-y-auto">
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
                    className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 disabled:text-blue-600 disabled:font-semibold"
                  >
                    <span>{r.label}</span>
                    <span className="text-[10px] text-slate-400">{r.expectedCode}</span>
                  </button>
                );
              })}
            </div>
          ))}
          {assignment && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); onUnassign(); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
              >
                <X className="w-3.5 h-3.5" /> Remover da simulação
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
