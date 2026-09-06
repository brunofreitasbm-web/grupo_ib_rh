import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { List, LogIn, LogOut, Plus, Trash2, X, MapPin } from 'lucide-react';
import { supabase } from '../../supabase';
import {
  mapProfessionalFromDb,
  mapProfessionalPresenceFromDb,
  PROFESSIONAL_SELECT_FIELDS,
  PROFESSIONAL_PRESENCE_SELECT_FIELDS,
  getFriendlyDbErrorMessage,
} from '../../utils/mappings';
import { formatDistance } from '../../utils/helpers';
import { BRANDING } from '../../config/branding';
import { toast } from 'sonner';

// Log de presença de Profissionais PJ. Modelo inspirado em FrequenciaTab, mas
// sem foto/justificativa/abono — o registro é autodeclarado e voluntário
// (ver plano do módulo PJ, seção 1). O único lançamento manual possível é
// feito pelo supervisor, marcado como auth_method='manual_admin'.
export default function PresencaProfissionaisTab({ filterUnit, restrictedUnitIds = [], units = [] }) {
  const [professionals, setProfessionals] = useState([]);
  const [presence, setPresence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({ professionalId: '', action: 'entrada', date: '', time: '', note: '' });
  const [saving, setSaving] = useState(false);

  const labels = BRANDING.professionalLabels || { presence: 'Registro de Presença' };

  const fetchData = useCallback(async () => {
    try {
      const { data: profData } = await supabase.from('professionals').select(PROFESSIONAL_SELECT_FIELDS);
      const { data: presData } = await supabase
        .from('professional_presence')
        .select(PROFESSIONAL_PRESENCE_SELECT_FIELDS)
        .order('timestamp', { ascending: false })
        .limit(250);

      if (profData) setProfessionals(profData.map(mapProfessionalFromDb).filter((p) => !restrictedUnitIds.includes(p.unitId)));
      if (presData) setPresence(presData.map(mapProfessionalPresenceFromDb).filter((r) => !restrictedUnitIds.includes(r.unitId)));
    } catch (err) {
      console.error('Erro ao carregar presença de profissionais PJ:', err);
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('pj-presenca-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'professional_presence' }, () => fetchData())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchData]);

  const filteredPresence = useMemo(
    () => (filterUnit === 'all' ? presence : presence.filter((r) => r.unitId === filterUnit)),
    [presence, filterUnit]
  );

  const professionalsOfUnit = useMemo(
    () => professionals.filter((p) => filterUnit === 'all' || p.unitId === filterUnit),
    [professionals, filterUnit]
  );

  const unitName = (id) => units.find((u) => u.id === id)?.name || '—';

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const prof = professionals.find((p) => p.id === manualForm.professionalId);
    if (!prof) { toast.error('Selecione o prestador.'); return; }
    if (!manualForm.date || !manualForm.time) { toast.error('Informe data e horário.'); return; }

    setSaving(true);
    try {
      const timestamp = new Date(`${manualForm.date}T${manualForm.time}:00`).toISOString();
      const { error } = await supabase.from('professional_presence').insert([{
        professional_id: prof.id,
        professional_name: prof.name,
        unit_id: prof.unitId,
        action: manualForm.action,
        timestamp,
        auth_method: 'manual_admin',
        geo: {},
        note: manualForm.note || null,
      }]);
      if (error) throw error;
      toast.success('Registro manual lançado com sucesso.');
      setShowManualForm(false);
      setManualForm({ professionalId: '', action: 'entrada', date: '', time: '', note: '' });
      fetchData();
    } catch (err) {
      console.error('Erro ao lançar registro manual:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record) => {
    if (!window.confirm('Remover este registro de presença?')) return;
    try {
      const { error } = await supabase.from('professional_presence').delete().eq('id', record.id);
      if (error) throw error;
      toast.success('Registro removido.');
      fetchData();
    } catch (err) {
      console.error('Erro ao remover registro:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <List size={20} className="text-teal-600" /> {labels.presence || 'Registro de Presença'}
        </h2>
        <button
          onClick={() => setShowManualForm(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm"
        >
          <Plus size={14} /> Lançamento Manual
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <th className="p-3 font-semibold">Data</th>
              <th className="p-3 font-semibold">Hora</th>
              <th className="p-3 font-semibold">Prestador</th>
              <th className="p-3 font-semibold">Unidade</th>
              <th className="p-3 font-semibold">Movimentação</th>
              <th className="p-3 font-semibold">Origem</th>
              <th className="p-3 font-semibold">Observação</th>
              <th className="p-3 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredPresence.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">Nenhum registro de presença ainda.</td></tr>
            ) : (
              filteredPresence.map((r) => {
                const d = new Date(r.timestamp);
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-gray-600">{d.toLocaleDateString('pt-BR')}</td>
                    <td className="p-3 text-gray-600">{d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-3 font-semibold text-gray-800">{r.professionalName}</td>
                    <td className="p-3 text-gray-600">{unitName(r.unitId)}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${r.action === 'entrada' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                        {r.action === 'entrada' ? <LogIn size={10} /> : <LogOut size={10} />}
                        {r.action === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] text-gray-500">
                        {r.authMethod === 'pin' ? 'PIN (quiosque)' : 'Lançamento manual'}
                      </span>
                      {r.geo?.accuracy != null && (
                        <p className="text-[9px] text-gray-400 flex items-center gap-0.5 mt-0.5">
                          <MapPin size={9} /> GPS informativo (±{formatDistance((r.geo.accuracy || 0) / 1000)})
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-gray-500 max-w-[160px] truncate" title={r.note}>{r.note || '—'}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => handleDelete(r)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded" title="Remover">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showManualForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm relative">
            <button onClick={() => setShowManualForm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
            <h3 className="text-sm font-bold text-gray-800 mb-4">Lançamento Manual de Presença</h3>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Prestador</label>
                <select
                  required
                  value={manualForm.professionalId}
                  onChange={(e) => setManualForm({ ...manualForm, professionalId: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs"
                >
                  <option value="">Selecione...</option>
                  {professionalsOfUnit.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Movimentação</label>
                <select
                  value={manualForm.action}
                  onChange={(e) => setManualForm({ ...manualForm, action: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs"
                >
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Data</label>
                  <input type="date" required value={manualForm.date} onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Horário</label>
                  <input type="time" required value={manualForm.time} onChange={(e) => setManualForm({ ...manualForm, time: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-xs" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Observação (opcional)</label>
                <textarea rows={2} value={manualForm.note} onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-xs" />
              </div>
              <button type="submit" disabled={saving} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 rounded-lg text-xs disabled:opacity-50">
                {saving ? 'Salvando...' : 'Lançar Registro'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
