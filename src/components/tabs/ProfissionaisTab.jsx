import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Pencil, Trash2, Save, X, KeyRound, ShieldCheck, Loader2, Copy, Check } from 'lucide-react';
import { supabase } from '../../supabase';
import {
  mapProfessionalFromDb,
  mapProfessionalToDb,
  PROFESSIONAL_SELECT_FIELDS,
  isValidProfessionalPin,
  professionalRpcErrorMessage,
} from '../../utils/mappings';
import { getFriendlyDbErrorMessage } from '../../utils/mappings';
import { BRANDING } from '../../config/branding';
import { ProfessionSelect } from '../CourseFields';
import { getProfessionCouncil, normalizeProfessionValue } from '../../config/professions';
import { toast } from 'sonner';

// Cadastro de Profissionais PJ (prestadores de serviço). Deliberadamente sem
// biometria, sem username/conta de login individual e sem campos financeiros
// de folha — o vínculo é comercial (CNPJ/NF), não trabalhista. Ver plano do
// módulo PJ, seção 1 (blindagem jurídica).
const emptyForm = {
  unitId: '', name: '', profession: '', councilType: '', councilNumber: '', councilUf: '', councilValidity: '', specialties: '',
  cpf: '', cnpj: '', razaoSocial: '', nomeFantasia: '', naturezaJuridica: '', cnaePrincipal: '', inscricaoMunicipal: '',
  enderecoCep: '', enderecoLogradouro: '', enderecoNumero: '', enderecoComplemento: '', enderecoBairro: '', enderecoCidade: '', enderecoUf: '',
  email: '', phone: '',
  bankName: '', bankAgency: '', bankAccount: '', bankAccountType: 'Conta Corrente', pixKey: '',
  repName: '', repCpf: '', repRg: '', repBirthdate: '', repEmail: '', repPhone: '', repRole: '',
  serviceDescription: '', remunerationModel: '', remunerationValue: '', shiftValue: '', paymentDay: '', noticeDays: 30,
  contractStart: '', contractEnd: '', contractNotes: '', active: true,
};

export default function ProfissionaisTab({ filterUnit, restrictedUnitIds = [], units = [] }) {
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showManage, setShowManage] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [pinModalId, setPinModalId] = useState(null);

  const labels = BRANDING.professionalLabels || { singular: 'Prestador(a)', plural: 'Profissionais PJ' };

  const defaultUnitId = filterUnit !== 'all' ? filterUnit : (units?.[0]?.id || '');

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select(PROFESSIONAL_SELECT_FIELDS)
        .order('name', { ascending: true });
      if (error) throw error;
      setProfessionals((data || []).map(mapProfessionalFromDb).filter((p) => !restrictedUnitIds.includes(p.unitId)));
    } catch (err) {
      console.error('Erro ao buscar profissionais PJ:', err);
      toast.error('Erro ao carregar prestadores.');
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('pj-profissionais-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'professionals' }, () => fetchData())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchData]);

  const filteredProfessionals = professionals.filter((p) => filterUnit === 'all' || p.unitId === filterUnit);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, unitId: defaultUnitId });
    setShowManage(true);
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    // Reaproveita todos os campos mapeados (mapProfessionalFromDb já usa as
    // mesmas chaves de emptyForm) — inclui o que o próprio prestador enviou
    // no autocadastro, para o RH conferir/corrigir antes de validar.
    setForm({ ...emptyForm, ...p });
    setShowManage(true);
  };

  const handleValidateRegistration = async (p) => {
    if (!window.confirm(`Validar o cadastro de "${p.name}"? Após validado, será possível definir o PIN e liberar o registro de presença.`)) return;
    try {
      const { error } = await supabase.from('professionals').update({ registration_status: 'validated' }).eq('id', p.id);
      if (error) throw error;
      toast.success('Cadastro validado com sucesso.');
      fetchData();
    } catch (err) {
      console.error('Erro ao validar cadastro do prestador:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Informe o nome do prestador.'); return; }
    if (!form.unitId) { toast.error('Selecione a unidade.'); return; }

    setSaving(true);
    try {
      // Grava sempre o texto canônico do catálogo; cadastros legados fora dele
      // são preservados como estão.
      const dbData = mapProfessionalToDb({
        ...form,
        profession: normalizeProfessionValue(form.profession) || form.profession.trim(),
      });
      if (editingId) {
        const { error } = await supabase.from('professionals').update(dbData).eq('id', editingId);
        if (error) throw error;
        toast.success('Prestador atualizado com sucesso.');
      } else {
        const { error } = await supabase.from('professionals').insert([dbData]);
        if (error) throw error;
        toast.success('Prestador cadastrado com sucesso.');
      }
      setShowManage(false);
      fetchData();
    } catch (err) {
      console.error('Erro ao salvar profissional PJ:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Remover o cadastro de "${p.name}"? Os registros de presença já lançados serão mantidos para histórico.`)) return;
    try {
      const { error } = await supabase.from('professionals').delete().eq('id', p.id);
      if (error) throw error;
      toast.success('Prestador removido.');
      fetchData();
    } catch (err) {
      console.error('Erro ao remover profissional PJ:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    }
  };

  const handleToggleActive = async (p) => {
    try {
      const { error } = await supabase.from('professionals').update({ active: !p.active }).eq('id', p.id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Erro ao alterar status do prestador:', err);
      toast.error('Erro ao alterar status.');
    }
  };

  const unitName = (id) => units.find((u) => u.id === id)?.name || '—';

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
          <Users size={20} className="text-teal-600" /> {labels.plural}
        </h2>
        <button
          onClick={openNew}
          className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm"
        >
          <Plus size={14} /> Novo {labels.singular}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <th className="p-3 font-semibold">Nome</th>
              <th className="p-3 font-semibold">Profissão / Conselho</th>
              <th className="p-3 font-semibold">Unidade</th>
              <th className="p-3 font-semibold">CNPJ</th>
              <th className="p-3 font-semibold">Vigência</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredProfessionals.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">Nenhum prestador cadastrado.</td></tr>
            ) : (
              filteredProfessionals.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-semibold text-gray-800">{p.name}</td>
                  <td className="p-3 text-gray-600">{p.profession || '—'}{p.councilType ? ` (${p.councilType} ${p.councilNumber || ''})` : ''}</td>
                  <td className="p-3 text-gray-600">{unitName(p.unitId)}</td>
                  <td className="p-3 text-gray-600">{p.cnpj || '—'}</td>
                  <td className="p-3 text-gray-600">{p.contractStart || '—'} a {p.contractEnd || '—'}</td>
                  <td className="p-3">
                    <button
                      onClick={() => handleToggleActive(p)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${p.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}
                    >
                      {p.active ? 'Ativo' : 'Inativo'}
                    </button>
                    {p.registrationStatus === 'pending_validation' && (
                      <button
                        onClick={() => handleValidateRegistration(p)}
                        className="block mt-1 text-[9px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200"
                        title="Cadastro enviado pelo próprio prestador — clique para validar"
                      >
                        ⚠️ Validar Cadastro
                      </button>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setPinModalId(p.id)}
                        disabled={p.registrationStatus === 'pending_validation'}
                        className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                        title={p.registrationStatus === 'pending_validation' ? 'Valide o cadastro antes de definir o PIN' : 'Definir/Resetar PIN'}
                      >
                        <KeyRound size={13} />
                      </button>
                      <button onClick={() => openEdit(p)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded" title="Editar">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(p)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded" title="Remover">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {p.termsAcceptedAt && (
                      <p className="text-[9px] text-emerald-600 mt-1 flex items-center justify-end gap-1">
                        <ShieldCheck size={10} /> Termo aceito
                      </p>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showManage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowManage(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
            <h3 className="text-base font-bold text-gray-800 mb-4">
              {editingId ? `Editar ${labels.singular}` : `Novo ${labels.singular}`}
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nome completo *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
              <Field label="Unidade *" as="select" value={form.unitId} onChange={(v) => setForm({ ...form, unitId: v })} required>
                <option value="">Selecione...</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Field>
              <Field label="CNPJ" value={form.cnpj} onChange={(v) => setForm({ ...form, cnpj: v })} />
              <Field label="Razão Social" value={form.razaoSocial} onChange={(v) => setForm({ ...form, razaoSocial: v })} />
              <Field label="Nome Fantasia" value={form.nomeFantasia} onChange={(v) => setForm({ ...form, nomeFantasia: v })} />
              <Field label="Natureza Jurídica" value={form.naturezaJuridica} onChange={(v) => setForm({ ...form, naturezaJuridica: v })} />
              <Field label="CNAE Principal" value={form.cnaePrincipal} onChange={(v) => setForm({ ...form, cnaePrincipal: v })} />
              <Field label="Inscrição Municipal" value={form.inscricaoMunicipal} onChange={(v) => setForm({ ...form, inscricaoMunicipal: v })} />
              <Field label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="Telefone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />

              <div className="md:col-span-2 border-t border-gray-100 pt-3 mt-1">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Endereço da sede</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Field label="CEP" value={form.enderecoCep} onChange={(v) => setForm({ ...form, enderecoCep: v })} />
                  <div className="md:col-span-2"><Field label="Logradouro" value={form.enderecoLogradouro} onChange={(v) => setForm({ ...form, enderecoLogradouro: v })} /></div>
                  <Field label="Número" value={form.enderecoNumero} onChange={(v) => setForm({ ...form, enderecoNumero: v })} />
                  <Field label="Complemento" value={form.enderecoComplemento} onChange={(v) => setForm({ ...form, enderecoComplemento: v })} />
                  <Field label="Bairro" value={form.enderecoBairro} onChange={(v) => setForm({ ...form, enderecoBairro: v })} />
                  <Field label="Cidade" value={form.enderecoCidade} onChange={(v) => setForm({ ...form, enderecoCidade: v })} />
                  <Field label="UF" value={form.enderecoUf} onChange={(v) => setForm({ ...form, enderecoUf: v })} />
                </div>
              </div>

              <div className="md:col-span-2 border-t border-gray-100 pt-3 mt-1">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Habilitação Profissional</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Profissão</label>
                    <ProfessionSelect
                      value={form.profession}
                      onChange={(v) => setForm((f) => ({
                        ...f,
                        profession: v,
                        // O conselho de classe segue a profissão, mas sem sobrescrever
                        // um registro já preenchido à mão.
                        councilType: f.councilType || getProfessionCouncil(v),
                      }))}
                      className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Conselho" value={form.councilType} onChange={(v) => setForm({ ...form, councilType: v })} placeholder="CRP, CRM..." />
                    <Field label="Nº Registro" value={form.councilNumber} onChange={(v) => setForm({ ...form, councilNumber: v })} />
                    <Field label="UF" value={form.councilUf} onChange={(v) => setForm({ ...form, councilUf: v })} />
                  </div>
                  <Field label="Validade do registro" type="date" value={form.councilValidity} onChange={(v) => setForm({ ...form, councilValidity: v })} />
                  <Field label="Especialidades" value={form.specialties} onChange={(v) => setForm({ ...form, specialties: v })} />
                </div>
              </div>

              <div className="md:col-span-2 border-t border-gray-100 pt-3 mt-1">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Representante Legal</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Field label="Nome completo" value={form.repName} onChange={(v) => setForm({ ...form, repName: v })} />
                  <Field label="Qualificação" value={form.repRole} onChange={(v) => setForm({ ...form, repRole: v })} placeholder="Ex.: sócio-administrador" />
                  <Field label="CPF" value={form.repCpf} onChange={(v) => setForm({ ...form, repCpf: v })} />
                  <Field label="RG" value={form.repRg} onChange={(v) => setForm({ ...form, repRg: v })} />
                  <Field label="Data de nascimento" type="date" value={form.repBirthdate} onChange={(v) => setForm({ ...form, repBirthdate: v })} />
                  <Field label="E-mail" type="email" value={form.repEmail} onChange={(v) => setForm({ ...form, repEmail: v })} />
                  <Field label="Telefone" value={form.repPhone} onChange={(v) => setForm({ ...form, repPhone: v })} />
                </div>
              </div>

              <div className="md:col-span-2 border-t border-gray-100 pt-3 mt-1">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Dados Bancários (pagamento contra NF)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Field label="Banco" value={form.bankName} onChange={(v) => setForm({ ...form, bankName: v })} />
                  <Field label="Tipo de conta" as="select" value={form.bankAccountType} onChange={(v) => setForm({ ...form, bankAccountType: v })}>
                    <option>Conta Corrente</option>
                    <option>Conta Poupança</option>
                  </Field>
                  <Field label="Agência" value={form.bankAgency} onChange={(v) => setForm({ ...form, bankAgency: v })} />
                  <Field label="Conta" value={form.bankAccount} onChange={(v) => setForm({ ...form, bankAccount: v })} />
                  <div className="md:col-span-2"><Field label="Chave PIX" value={form.pixKey} onChange={(v) => setForm({ ...form, pixKey: v })} /></div>
                </div>
              </div>

              <div className="md:col-span-2 border-t border-gray-100 pt-3 mt-1">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Objeto e Condições Comerciais</h4>
                <div className="md:col-span-2 mb-2">
                  <Field label="Descrição dos serviços" as="textarea" value={form.serviceDescription} onChange={(v) => setForm({ ...form, serviceDescription: v })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Field label="Modelo de remuneração" value={form.remunerationModel} onChange={(v) => setForm({ ...form, remunerationModel: v })} />
                  <Field label="Valor de referência (R$)" type="number" value={form.remunerationValue} onChange={(v) => setForm({ ...form, remunerationValue: v })} />
                  <Field label="Preço do Módulo Assistencial (R$)" type="number" value={form.shiftValue} onChange={(v) => setForm({ ...form, shiftValue: v })} />
                  <Field label="Dia de pagamento" type="number" value={form.paymentDay} onChange={(v) => setForm({ ...form, paymentDay: v })} />
                  <Field label="Aviso prévio (dias)" type="number" value={form.noticeDays} onChange={(v) => setForm({ ...form, noticeDays: v })} />
                  <Field label="Vigência início" type="date" value={form.contractStart} onChange={(v) => setForm({ ...form, contractStart: v })} />
                  <Field label="Vigência fim" type="date" value={form.contractEnd} onChange={(v) => setForm({ ...form, contractEnd: v })} />
                </div>
                <div className="md:col-span-2 mt-2">
                  <Field label="Observações do contrato" as="textarea" value={form.contractNotes} onChange={(v) => setForm({ ...form, contractNotes: v })} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-gray-600 md:col-span-2 border-t border-gray-100 pt-3 mt-1">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Prestador ativo (aparece no quiosque de registro de presença)
              </label>

              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowManage(false)} className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pinModalId && (
        <SetPinModal
          professionalId={pinModalId}
          professionalName={professionals.find((p) => p.id === pinModalId)?.name}
          onClose={() => setPinModalId(null)}
        />
      )}
    </div>
  );
}

function Field({ label, value, onChange, as = 'input', type = 'text', required = false, placeholder = '', children }) {
  const commonProps = {
    value: value || '',
    onChange: (e) => onChange(e.target.value),
    required,
    placeholder,
    className: 'w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-xs',
  };
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>
      {as === 'select' ? (
        <select {...commonProps}>{children}</select>
      ) : as === 'textarea' ? (
        <textarea rows={2} {...commonProps} />
      ) : (
        <input type={type} {...commonProps} />
      )}
    </div>
  );
}

function SetPinModal({ professionalId, professionalName, onClose }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedPin, setSavedPin] = useState('');
  const [copied, setCopied] = useState(false);

  const generateRandomPin = () => {
    let candidate;
    do {
      candidate = String(Math.floor(100000 + Math.random() * 900000));
    } while (!isValidProfessionalPin(candidate));
    setPin(candidate);
    setConfirmPin(candidate);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isValidProfessionalPin(pin)) {
      setError('O PIN deve ter exatamente 6 dígitos e não pode ser uma sequência óbvia (ex.: 123456).');
      return;
    }
    if (pin !== confirmPin) { setError('Os PINs digitados não coincidem.'); return; }

    setSaving(true);
    try {
      const { error: rpcError } = await supabase.rpc('set_professional_pin', {
        p_professional_id: professionalId,
        p_pin: pin,
      });
      if (rpcError) throw rpcError;
      setSavedPin(pin);
      toast.success('PIN definido com sucesso.');
    } catch (err) {
      console.error('Erro ao definir PIN:', err);
      setError(professionalRpcErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(savedPin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível: sem problema, o PIN já está visível na tela
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
        <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5">
          <KeyRound size={16} className="text-amber-600" /> Definir PIN
        </h3>
        <p className="text-xs text-gray-500 mb-4">{professionalName}</p>

        {savedPin ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-600">
              Informe este PIN pessoalmente ao prestador. Ele não será exibido novamente por aqui.
            </p>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <span className="flex-1 text-center text-xl font-bold tracking-[0.4em] text-slate-800">{savedPin}</span>
              <button type="button" onClick={handleCopy} className="p-1.5 text-slate-500 hover:text-slate-800" title="Copiar">
                {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              </button>
            </div>
            <button onClick={onClose} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 rounded-lg text-xs">
              Concluir
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-medium text-gray-500">PIN de 6 dígitos</label>
              <button type="button" onClick={generateRandomPin} className="text-[10px] text-teal-700 font-semibold underline">
                Gerar automaticamente
              </button>
            </div>
            <input
              type="text" inputMode="numeric" maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full p-2 border border-gray-300 rounded-lg text-center tracking-[0.3em] text-sm"
            />
            <label className="block text-[10px] font-medium text-gray-500">Confirmar PIN</label>
            <input
              type="text" inputMode="numeric" maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full p-2 border border-gray-300 rounded-lg text-center tracking-[0.3em] text-sm"
            />
            {error && <p className="text-red-500 text-[10px] text-center font-semibold">{error}</p>}
            <button type="submit" disabled={saving} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 rounded-lg text-xs disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar PIN'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
