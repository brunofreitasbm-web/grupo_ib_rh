import React, { useState, useEffect, useCallback } from 'react';
import { useBackLayers } from '../../hooks/useBackHandler';
import { Users, Plus, Pencil, Trash2, Save, X, ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';
import { createDebounced } from '../../utils/debounce';
import {
  mapFreelancerFromDb,
  mapFreelancerToDb,
  FREELANCER_SELECT_FIELDS,
  getFriendlyDbErrorMessage,
} from '../../utils/mappings';
import {
  FREELANCE_REQUIRED_FIELDS,
  FREELANCE_AUTONOMY_DECLARATION_TEXT,
  FREELANCE_AUTONOMY_DECLARATION_VERSION,
} from '../../config/freelanceConstants';
import { missingFields } from '../../utils/freelanceCalculations';
import { toast } from 'sonner';

// Cadastro de Freelancers (trabalhadores autônomos pessoa física para
// trabalhos pontuais). Deliberadamente sem PIN, sem presença/ponto e sem
// biometria — o vínculo nasce e se esgota em cada Ordem de Serviço (ver
// FreelanceJobsTab), nunca num cadastro guarda-chuva de prazo indeterminado.
// Ver src/config/freelanceConstants.js para o enquadramento legal completo.
const emptyForm = {
  unitId: '', name: '', cpf: '', nit: '', birthdate: '', email: '', phone: '',
  enderecoCep: '', enderecoLogradouro: '', enderecoNumero: '', enderecoComplemento: '',
  enderecoBairro: '', enderecoCidade: '', enderecoUf: '',
  serviceArea: '', bankName: '', bankAgency: '', bankAccount: '', bankAccountType: 'Conta Corrente', pixKey: '',
  sourceCandidateId: '', notes: '', active: true,
  autonomyDeclarationAcceptedAt: null, autonomyDeclarationVersion: '',
};

export default function FreelancersTab({ filterUnit, restrictedUnitIds = [], units = [] }) {
  const [freelancers, setFreelancers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showManage, setShowManage] = useState(false);

  // Botão/gesto voltar do celular: fecha a subtela mais interna (ver hooks/useBackHandler).
  useBackLayers([
    { active: showManage, back: () => setShowManage(false) }
  ]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [declarationChecked, setDeclarationChecked] = useState(false);

  const defaultUnitId = filterUnit !== 'all' ? filterUnit : (units?.[0]?.id || '');

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('freelancers')
        .select(FREELANCER_SELECT_FIELDS)
        .order('name', { ascending: true });
      if (error) throw error;
      setFreelancers((data || []).map(mapFreelancerFromDb).filter((f) => !restrictedUnitIds.includes(f.unitId)));
    } catch (err) {
      console.error('Erro ao buscar freelancers:', err?.message || err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds]);

  useEffect(() => {
    const onRealtimeChange = createDebounced(() => fetchData());
    fetchData();
    const channel = supabase
      .channel('freelance-freelancers-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freelancers' }, onRealtimeChange)
      .subscribe();
    return () => {
      onRealtimeChange.cancel();
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const filteredFreelancers = freelancers.filter((f) => filterUnit === 'all' || f.unitId === filterUnit);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, unitId: defaultUnitId });
    setDeclarationChecked(false);
    setShowManage(true);
  };

  const openEdit = (f) => {
    setEditingId(f.id);
    setForm({ ...emptyForm, ...f });
    setDeclarationChecked(!!f.autonomyDeclarationAcceptedAt);
    setShowManage(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Informe o nome do freelancer.'); return; }
    if (!form.unitId) { toast.error('Selecione a unidade.'); return; }
    if (!declarationChecked) { toast.error('É necessário registrar o aceite da Declaração de Autonomia.'); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        autonomyDeclarationAcceptedAt: form.autonomyDeclarationAcceptedAt || new Date().toISOString(),
        autonomyDeclarationVersion: form.autonomyDeclarationVersion || FREELANCE_AUTONOMY_DECLARATION_VERSION,
      };
      const dbData = mapFreelancerToDb(payload);
      if (editingId) {
        const { error } = await supabase.from('freelancers').update(dbData).eq('id', editingId);
        if (error) throw error;
        toast.success('Freelancer atualizado com sucesso.');
      } else {
        const { error } = await supabase.from('freelancers').insert([dbData]);
        if (error) throw error;
        toast.success('Freelancer cadastrado com sucesso.');
      }
      setShowManage(false);
      fetchData();
    } catch (err) {
      console.error('Erro ao salvar freelancer:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (f) => {
    if (!window.confirm(`Remover o cadastro de "${f.name}"? As Ordens de Serviço já lançadas serão mantidas para histórico.`)) return;
    try {
      const { error } = await supabase.from('freelancers').delete().eq('id', f.id);
      if (error) throw error;
      toast.success('Freelancer removido.');
      fetchData();
    } catch (err) {
      console.error('Erro ao remover freelancer:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    }
  };

  const handleToggleActive = async (f) => {
    try {
      const { error } = await supabase.from('freelancers').update({ active: !f.active }).eq('id', f.id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Erro ao alterar status do freelancer:', err);
      toast.error('Erro ao alterar status.');
    }
  };

  const unitName = (id) => units.find((u) => u.id === id)?.name || '—';

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <Users size={20} className="text-violet-600" /> Freelancers
        </h2>
        <button
          onClick={openNew}
          className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm"
        >
          <Plus size={14} /> Novo Freelancer
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <th className="p-3 font-semibold">Nome</th>
              <th className="p-3 font-semibold">Área de atuação</th>
              <th className="p-3 font-semibold">Unidade</th>
              <th className="p-3 font-semibold">Contato</th>
              <th className="p-3 font-semibold">Declaração</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredFreelancers.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-400">Nenhum freelancer cadastrado.</td></tr>
            )}
            {filteredFreelancers.map((f) => (
              <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                <td className="p-3 font-medium text-gray-800">{f.name}</td>
                <td className="p-3 text-gray-600">{f.serviceArea || '—'}</td>
                <td className="p-3 text-gray-600">{unitName(f.unitId)}</td>
                <td className="p-3 text-gray-600">{f.email || f.phone || '—'}</td>
                <td className="p-3">
                  {f.autonomyDeclarationAcceptedAt ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                      <ShieldCheck size={11} /> Aceita
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                      Pendente
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <button
                    onClick={() => handleToggleActive(f)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${f.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                  >
                    {f.active ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => openEdit(f)} className="text-gray-500 hover:text-violet-600 p-1.5" title="Editar">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(f)} className="text-gray-500 hover:text-rose-600 p-1.5" title="Remover">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-800">{editingId ? 'Editar Freelancer' : 'Novo Freelancer'}</h3>
              <button onClick={() => setShowManage(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nome completo *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Unidade *</label>
                  <select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2" required>
                    <option value="">Selecione…</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Área/atividade do serviço</label>
                  <input value={form.serviceArea} onChange={(e) => setForm({ ...form, serviceArea: e.target.value })} placeholder="Ex.: recreação de eventos, fotografia…" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">CPF *</label>
                  <input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">NIT/PIS/PASEP (eSocial)</label>
                  <input value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Data de nascimento</label>
                  <input type="date" value={form.birthdate} onChange={(e) => setForm({ ...form, birthdate: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">E-mail</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Telefone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                </div>
              </div>

              <fieldset className="border border-gray-200 rounded-lg p-3">
                <legend className="text-xs font-semibold text-gray-500 px-1">Endereço</legend>
                <div className="grid grid-cols-3 gap-2">
                  <input value={form.enderecoCep} onChange={(e) => setForm({ ...form, enderecoCep: e.target.value })} placeholder="CEP" className="border border-gray-200 rounded-lg px-3 py-2 col-span-1" />
                  <input value={form.enderecoLogradouro} onChange={(e) => setForm({ ...form, enderecoLogradouro: e.target.value })} placeholder="Logradouro" className="border border-gray-200 rounded-lg px-3 py-2 col-span-2" />
                  <input value={form.enderecoNumero} onChange={(e) => setForm({ ...form, enderecoNumero: e.target.value })} placeholder="Número" className="border border-gray-200 rounded-lg px-3 py-2" />
                  <input value={form.enderecoBairro} onChange={(e) => setForm({ ...form, enderecoBairro: e.target.value })} placeholder="Bairro" className="border border-gray-200 rounded-lg px-3 py-2" />
                  <input value={form.enderecoCidade} onChange={(e) => setForm({ ...form, enderecoCidade: e.target.value })} placeholder="Cidade" className="border border-gray-200 rounded-lg px-3 py-2" />
                  <input value={form.enderecoUf} onChange={(e) => setForm({ ...form, enderecoUf: e.target.value })} placeholder="UF" maxLength={2} className="border border-gray-200 rounded-lg px-3 py-2" />
                </div>
              </fieldset>

              <fieldset className="border border-gray-200 rounded-lg p-3">
                <legend className="text-xs font-semibold text-gray-500 px-1">Dados bancários (para o RPA)</legend>
                <div className="grid grid-cols-2 gap-2">
                  <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="Banco" className="border border-gray-200 rounded-lg px-3 py-2" />
                  <input value={form.pixKey} onChange={(e) => setForm({ ...form, pixKey: e.target.value })} placeholder="Chave PIX" className="border border-gray-200 rounded-lg px-3 py-2" />
                  <input value={form.bankAgency} onChange={(e) => setForm({ ...form, bankAgency: e.target.value })} placeholder="Agência" className="border border-gray-200 rounded-lg px-3 py-2" />
                  <input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} placeholder="Conta" className="border border-gray-200 rounded-lg px-3 py-2" />
                </div>
              </fieldset>

              <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                <label className="flex items-start gap-2 text-xs text-violet-900">
                  <input type="checkbox" checked={declarationChecked} onChange={(e) => setDeclarationChecked(e.target.checked)} className="mt-0.5" />
                  <span>
                    <strong>Declaração de Autonomia (v{FREELANCE_AUTONOMY_DECLARATION_VERSION})</strong> — confirmo que
                    o freelancer leu e aceitou os termos abaixo, condição para a emissão de Ordens de Serviço.
                    <span className="block mt-1 text-[11px] text-violet-700 max-h-24 overflow-y-auto">{FREELANCE_AUTONOMY_DECLARATION_TEXT}</span>
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Observações internas</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
              </div>

              {(() => {
                const missing = missingFields(form, FREELANCE_REQUIRED_FIELDS.filter(([k]) => k !== 'autonomyDeclarationAcceptedAt'));
                if (!missing.length) return null;
                return (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Pendente para emitir contrato: {missing.join(', ')}.
                  </p>
                );
              })()}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowManage(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg flex items-center gap-2 disabled:opacity-60">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
