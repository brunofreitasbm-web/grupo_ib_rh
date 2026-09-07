import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Pencil, Trash2, Save, X, Loader2, ShieldCheck, Upload, UserPlus, Trash } from 'lucide-react';
import { supabase } from '../../supabase';
import {
  mapEmployeeFromDb, mapEmployeeToDb, EMPLOYEE_SELECT_FIELDS,
  mapDependentFromDb, mapDependentToDb,
  compressImage, getFriendlyDbErrorMessage,
} from '../../utils/mappings';
import { validateCPF } from '../../utils/helpers';
import { getFaceDescriptor } from '../../utils/faceBiometrics';
import { BRANDING } from '../../config/branding';
import { CONTRACT_TYPES, SCHEDULE_PRESETS, EMPLOYEE_STATUS, EXPERIENCE_PRESETS } from '../../config/cltConstants';
import { experienceDates } from '../../utils/cltCalculations';
import { toast } from 'sonner';

// Cadastro de Funcionários CLT. Terceiro tipo de vínculo do hub de RH, ao
// lado de Estagiários (EstagiariosTab) e Profissionais PJ (ProfissionaisTab).
// Ao contrário do PJ, aqui a jornada/salário/CTPS são o núcleo do cadastro —
// ver supabase_schema.sql seção 17 e o plano de implementação do módulo.
const emptyForm = {
  unitId: '', name: '', cpf: '', rg: '', rgIssuer: '', birthdate: '', sex: '',
  maritalStatus: '', education: '', nationality: 'Brasileira', birthplace: '',
  motherName: '', fatherName: '', phone: '', email: '',
  address: { logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '' },
  ctpsNumber: '', ctpsSeries: '', ctpsUf: '', pis: '', voterTitle: '', reservistCert: '', cnh: '', cnhCategory: '',
  bankName: '', bankAgency: '', bankAccount: '', bankAccountType: 'corrente', pixKey: '',
  jobTitle: '', cbo: '', department: '', admissionDate: '', contractType: 'indeterminado',
  experienceFirstEnd: '', experienceSecondEnd: '', contractEnd: '',
  baseSalary: '', weeklyHours: 44, schedule: { preset: '44h_5x2', days: SCHEDULE_PRESETS[0].days },
  workRegime: 'presencial', nightWork: false, hoursBank: false, hoursBankStartedAt: '',
  vtOpted: false, vtDailyCost: '', vrOpted: false, healthPlan: false, unionName: '', cbaReference: '',
  photo: '', faceDescriptor: '', biometricConsentAt: null, biometricConsentVersion: '',
  status: 'ativo', notes: '',
};

export default function FuncionariosTab({ filterUnit, restrictedUnitIds = [], units = [] }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showManage, setShowManage] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [experiencePreset, setExperiencePreset] = useState(EXPERIENCE_PRESETS[0].key);
  const [dependents, setDependents] = useState([]);
  const [newDependent, setNewDependent] = useState({ name: '', cpf: '', birthdate: '', relationship: '', forIr: true, forSalarioFamilia: false });
  const [processingPhoto, setProcessingPhoto] = useState(false);

  const labels = BRANDING.employeeLabels || { singular: 'Funcionário(a)', plural: 'Funcionários CLT' };
  const defaultUnitId = filterUnit !== 'all' ? filterUnit : (units?.[0]?.id || '');

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select(EMPLOYEE_SELECT_FIELDS)
        .order('name', { ascending: true });
      if (error) throw error;
      setEmployees((data || []).map(mapEmployeeFromDb).filter((e) => !restrictedUnitIds.includes(e.unitId)));
    } catch (err) {
      console.error('Erro ao buscar funcionários CLT:', err);
      toast.error('Erro ao carregar funcionários.');
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('clt-funcionarios-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => fetchData())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchData]);

  const filteredEmployees = employees.filter((e) => filterUnit === 'all' || e.unitId === filterUnit);

  const fetchDependents = async (employeeId) => {
    if (!employeeId) { setDependents([]); return; }
    try {
      const { data, error } = await supabase.from('employee_dependents').select('*').eq('employee_id', employeeId).order('birthdate');
      if (error) throw error;
      setDependents((data || []).map(mapDependentFromDb));
    } catch (err) {
      console.error('Erro ao carregar dependentes:', err);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, unitId: defaultUnitId });
    setExperiencePreset(EXPERIENCE_PRESETS[0].key);
    setDependents([]);
    setShowManage(true);
  };

  const openEdit = (e) => {
    setEditingId(e.id);
    setForm({ ...emptyForm, ...e, address: e.address && Object.keys(e.address).length ? e.address : emptyForm.address });
    setDependents([]);
    fetchDependents(e.id);
    setShowManage(true);
  };

  const applySchedulePreset = (presetKey) => {
    const preset = SCHEDULE_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    setForm((f) => ({
      ...f,
      weeklyHours: preset.weeklyHours,
      schedule: preset.is12x36
        ? { preset: preset.key, shift: preset.shift, cycleAnchorDate: f.schedule?.cycleAnchorDate || f.admissionDate || '' }
        : { preset: preset.key, days: preset.days },
    }));
  };

  const applyExperiencePreset = (presetKey) => {
    setExperiencePreset(presetKey);
    if (!form.admissionDate) return;
    const preset = EXPERIENCE_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    const { firstEnd, secondEnd } = experienceDates(form.admissionDate, preset);
    setForm((f) => ({ ...f, experienceFirstEnd: firstEnd, experienceSecondEnd: secondEnd || '' }));
  };

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    setProcessingPhoto(true);
    try {
      const compressed = await compressImage(file, 400, 500, 0.8);
      const descriptor = await getFaceDescriptor(compressed);
      if (!descriptor) {
        toast.error('Não foi possível identificar um rosto nesta foto. A foto foi salva, mas a biometria facial não pôde ser cadastrada — tente outra foto mais nítida.');
      } else {
        toast.success('Rosto identificado e biometria facial cadastrada com sucesso.');
      }
      setForm((f) => ({ ...f, photo: compressed, faceDescriptor: descriptor ? JSON.stringify(descriptor) : f.faceDescriptor }));
    } catch (err) {
      console.error('Erro ao processar foto:', err);
      toast.error('Erro ao processar a foto enviada.');
    } finally {
      setProcessingPhoto(false);
    }
  };

  const toggleBiometricConsent = (checked) => {
    setForm((f) => ({
      ...f,
      biometricConsentAt: checked ? new Date().toISOString() : null,
      biometricConsentVersion: checked ? (BRANDING.biometricConsentVersion || '1.0') : '',
    }));
  };

  const handleAddDependent = async () => {
    if (!newDependent.name.trim()) { toast.error('Informe o nome do dependente.'); return; }
    if (!editingId) { toast.error('Salve o cadastro do funcionário antes de adicionar dependentes.'); return; }
    try {
      const { error } = await supabase.from('employee_dependents').insert([mapDependentToDb({ ...newDependent, employeeId: editingId })]);
      if (error) throw error;
      setNewDependent({ name: '', cpf: '', birthdate: '', relationship: '', forIr: true, forSalarioFamilia: false });
      fetchDependents(editingId);
    } catch (err) {
      console.error('Erro ao adicionar dependente:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    }
  };

  const handleRemoveDependent = async (dependentId) => {
    try {
      const { error } = await supabase.from('employee_dependents').delete().eq('id', dependentId);
      if (error) throw error;
      fetchDependents(editingId);
    } catch (err) {
      console.error('Erro ao remover dependente:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Informe o nome do funcionário.'); return; }
    if (!form.unitId) { toast.error('Selecione a unidade.'); return; }
    if (!form.admissionDate) { toast.error('Informe a data de admissão.'); return; }
    if (form.cpf && !validateCPF(form.cpf)) { toast.error('CPF inválido.'); return; }

    setSaving(true);
    try {
      const dbData = mapEmployeeToDb(form);
      if (editingId) {
        const { error } = await supabase.from('employees').update(dbData).eq('id', editingId);
        if (error) throw error;
        toast.success('Funcionário atualizado com sucesso.');
      } else {
        const { error } = await supabase.from('employees').insert([dbData]);
        if (error) throw error;
        toast.success('Funcionário cadastrado com sucesso.');
      }
      setShowManage(false);
      fetchData();
    } catch (err) {
      console.error('Erro ao salvar funcionário CLT:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleValidateRegistration = async (emp) => {
    if (!window.confirm(`Validar o cadastro de "${emp.name}"? Complete cargo, salário, jornada e data de admissão antes ou depois de validar.`)) return;
    try {
      const { error } = await supabase.from('employees').update({ registration_status: 'validated' }).eq('id', emp.id);
      if (error) throw error;
      toast.success('Cadastro validado com sucesso.');
      fetchData();
    } catch (err) {
      console.error('Erro ao validar cadastro do funcionário:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    }
  };

  const handleDelete = async (emp) => {
    if (!window.confirm(`Remover o cadastro de "${emp.name}"? Se já houver registros de ponto, a exclusão será bloqueada — use o Desligamento nesse caso.`)) return;
    try {
      const { error } = await supabase.from('employees').delete().eq('id', emp.id);
      if (error) throw error;
      toast.success('Funcionário removido.');
      fetchData();
    } catch (err) {
      console.error('Erro ao remover funcionário CLT:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    }
  };

  const unitName = (id) => units.find((u) => u.id === id)?.name || '—';
  const statusInfo = (key) => EMPLOYEE_STATUS.find((s) => s.key === key) || EMPLOYEE_STATUS[0];
  // Classes completas e literais (Tailwind JIT não compila `bg-${x}-100` interpolado).
  const STATUS_BADGE_CLASSES = {
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    sky: 'bg-sky-100 text-sky-800',
    orange: 'bg-orange-100 text-orange-800',
    slate: 'bg-slate-100 text-slate-700',
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <Users size={20} className="text-indigo-600" /> {labels.plural}
        </h2>
        <button
          onClick={openNew}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm"
        >
          <Plus size={14} /> Novo {labels.singular}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <th className="p-3 font-semibold">Nome</th>
              <th className="p-3 font-semibold">Cargo / Depto</th>
              <th className="p-3 font-semibold">Unidade</th>
              <th className="p-3 font-semibold">Admissão</th>
              <th className="p-3 font-semibold">Contrato</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredEmployees.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">Nenhum funcionário cadastrado.</td></tr>
            ) : (
              filteredEmployees.map((emp) => {
                const status = statusInfo(emp.status);
                return (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-semibold text-gray-800">
                      {emp.name}
                      {emp.biometricConsentAt ? (
                        <span title="Consentimento biométrico registrado"><ShieldCheck size={11} className="inline ml-1 text-emerald-500" /></span>
                      ) : (
                        <span className="ml-1 text-[9px] text-amber-600 font-normal">(sem consentimento biométrico)</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-600">{emp.jobTitle || '—'}{emp.department ? ` · ${emp.department}` : ''}</td>
                    <td className="p-3 text-gray-600">{unitName(emp.unitId)}</td>
                    <td className="p-3 text-gray-600">{emp.admissionDate || '—'}</td>
                    <td className="p-3 text-gray-600">{CONTRACT_TYPES.find((c) => c.key === emp.contractType)?.label || emp.contractType}</td>
                    <td className="p-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${STATUS_BADGE_CLASSES[status.color] || STATUS_BADGE_CLASSES.slate}`}>
                        {status.label}
                      </span>
                      {emp.registrationStatus === 'pending_validation' && (
                        <button
                          onClick={() => handleValidateRegistration(emp)}
                          className="block mt-1 text-[9px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200"
                          title="Cadastro enviado pelo próprio candidato — clique para validar"
                        >
                          ⚠️ Validar Cadastro
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => openEdit(emp)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded" title="Editar">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(emp)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded" title="Remover">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showManage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-4xl relative max-h-[92vh] overflow-y-auto">
            <button onClick={() => setShowManage(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
            <h3 className="text-base font-bold text-gray-800 mb-4">
              {editingId ? `Editar ${labels.singular}` : `Novo ${labels.singular}`}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Foto e biometria */}
              <Section title="Foto e Biometria Facial">
                <div className="flex items-start gap-4">
                  <div className="w-24 h-28 bg-slate-100 border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                    {form.photo ? <img src={form.photo} alt="Foto" className="w-full h-full object-cover" /> : <Users size={28} className="text-slate-300" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-indigo-100">
                      {processingPhoto ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      Enviar foto 3x4
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e.target.files?.[0])} />
                    </label>
                    <p className="text-[10px] text-gray-400">A biometria facial é extraída automaticamente da foto para uso no quiosque de ponto.</p>
                    <label className="flex items-start gap-2 text-[11px] text-gray-600 pt-1">
                      <input type="checkbox" checked={!!form.biometricConsentAt} onChange={(e) => toggleBiometricConsent(e.target.checked)} className="mt-0.5" />
                      <span>
                        Funcionário assinou o <strong>Termo de Consentimento — Biometria/LGPD</strong> (obrigatório para registrar ponto no quiosque).
                        {form.biometricConsentAt && <span className="block text-emerald-600">Consentimento registrado em {new Date(form.biometricConsentAt).toLocaleString('pt-BR')}.</span>}
                      </span>
                    </label>
                  </div>
                </div>
              </Section>

              {/* Dados pessoais */}
              <Section title="Dados Pessoais">
                <Grid>
                  <Field label="Nome completo *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
                  <Field label="Unidade *" as="select" value={form.unitId} onChange={(v) => setForm({ ...form, unitId: v })} required>
                    <option value="">Selecione...</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </Field>
                  <Field label="CPF" value={form.cpf} onChange={(v) => setForm({ ...form, cpf: v })} />
                  <Field label="RG" value={form.rg} onChange={(v) => setForm({ ...form, rg: v })} />
                  <Field label="Órgão emissor" value={form.rgIssuer} onChange={(v) => setForm({ ...form, rgIssuer: v })} />
                  <Field label="Data de nascimento" type="date" value={form.birthdate} onChange={(v) => setForm({ ...form, birthdate: v })} />
                  <Field label="Sexo" as="select" value={form.sex} onChange={(v) => setForm({ ...form, sex: v })}>
                    <option value="">Selecione...</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                    <option value="outro">Outro</option>
                  </Field>
                  <Field label="Estado civil" value={form.maritalStatus} onChange={(v) => setForm({ ...form, maritalStatus: v })} />
                  <Field label="Escolaridade" value={form.education} onChange={(v) => setForm({ ...form, education: v })} />
                  <Field label="Nacionalidade" value={form.nationality} onChange={(v) => setForm({ ...form, nationality: v })} />
                  <Field label="Naturalidade" value={form.birthplace} onChange={(v) => setForm({ ...form, birthplace: v })} />
                  <Field label="Nome da mãe" value={form.motherName} onChange={(v) => setForm({ ...form, motherName: v })} />
                  <Field label="Nome do pai" value={form.fatherName} onChange={(v) => setForm({ ...form, fatherName: v })} />
                  <Field label="Telefone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                  <Field label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                </Grid>
              </Section>

              {/* Documentos trabalhistas */}
              <Section title="Documentos Trabalhistas">
                <Grid>
                  <Field label="CTPS nº" value={form.ctpsNumber} onChange={(v) => setForm({ ...form, ctpsNumber: v })} />
                  <Field label="CTPS série" value={form.ctpsSeries} onChange={(v) => setForm({ ...form, ctpsSeries: v })} />
                  <Field label="CTPS UF" value={form.ctpsUf} onChange={(v) => setForm({ ...form, ctpsUf: v })} />
                  <Field label="PIS/PASEP/NIT" value={form.pis} onChange={(v) => setForm({ ...form, pis: v })} />
                  <Field label="Título de eleitor" value={form.voterTitle} onChange={(v) => setForm({ ...form, voterTitle: v })} />
                  <Field label="Certificado de reservista" value={form.reservistCert} onChange={(v) => setForm({ ...form, reservistCert: v })} />
                  <Field label="CNH" value={form.cnh} onChange={(v) => setForm({ ...form, cnh: v })} />
                  <Field label="Categoria CNH" value={form.cnhCategory} onChange={(v) => setForm({ ...form, cnhCategory: v })} />
                </Grid>
              </Section>

              {/* Contrato e jornada */}
              <Section title="Contrato e Jornada">
                <Grid>
                  <Field label="Cargo" value={form.jobTitle} onChange={(v) => setForm({ ...form, jobTitle: v })} />
                  <Field label="CBO" value={form.cbo} onChange={(v) => setForm({ ...form, cbo: v })} />
                  <Field label="Departamento" value={form.department} onChange={(v) => setForm({ ...form, department: v })} />
                  <Field label="Data de admissão *" type="date" value={form.admissionDate} onChange={(v) => setForm({ ...form, admissionDate: v })} required />
                  <Field label="Tipo de contrato" as="select" value={form.contractType} onChange={(v) => setForm({ ...form, contractType: v })}>
                    {CONTRACT_TYPES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </Field>
                  {form.contractType === 'experiencia' && (
                    <Field label="Preset de experiência" as="select" value={experiencePreset} onChange={applyExperiencePreset}>
                      {EXPERIENCE_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                    </Field>
                  )}
                  {form.contractType === 'experiencia' && (
                    <>
                      <Field label="Fim do 1º período" type="date" value={form.experienceFirstEnd} onChange={(v) => setForm({ ...form, experienceFirstEnd: v })} />
                      <Field label="Fim do 2º período" type="date" value={form.experienceSecondEnd} onChange={(v) => setForm({ ...form, experienceSecondEnd: v })} />
                    </>
                  )}
                  {form.contractType === 'tempo_determinado' && (
                    <Field label="Fim do contrato" type="date" value={form.contractEnd} onChange={(v) => setForm({ ...form, contractEnd: v })} />
                  )}
                  <Field label="Regime de trabalho" as="select" value={form.workRegime} onChange={(v) => setForm({ ...form, workRegime: v })}>
                    <option value="presencial">Presencial</option>
                    <option value="hibrido">Híbrido</option>
                    <option value="remoto">Remoto</option>
                  </Field>
                  <Field label="Jornada" as="select" value={form.schedule?.preset || 'custom'} onChange={applySchedulePreset}>
                    {SCHEDULE_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </Field>
                  {form.schedule?.preset === '12x36' && (
                    <Field label="Data-âncora do ciclo (dia trabalhado)" type="date" value={form.schedule?.cycleAnchorDate || ''} onChange={(v) => setForm({ ...form, schedule: { ...form.schedule, cycleAnchorDate: v } })} />
                  )}
                  <Field label="Salário base (R$)" type="number" value={form.baseSalary} onChange={(v) => setForm({ ...form, baseSalary: v })} />
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                    <input type="checkbox" checked={form.nightWork} onChange={(e) => setForm({ ...form, nightWork: e.target.checked })} />
                    Trabalho noturno habitual
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                    <input type="checkbox" checked={form.hoursBank} onChange={(e) => setForm({ ...form, hoursBank: e.target.checked })} />
                    Banco de horas
                  </label>
                  {form.hoursBank && (
                    <Field label="Banco de horas iniciado em" type="date" value={form.hoursBankStartedAt} onChange={(v) => setForm({ ...form, hoursBankStartedAt: v })} />
                  )}
                  <Field label="Sindicato / Convenção" value={form.unionName} onChange={(v) => setForm({ ...form, unionName: v })} />
                </Grid>
              </Section>

              {/* Benefícios */}
              <Section title="Benefícios">
                <Grid>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                    <input type="checkbox" checked={form.vtOpted} onChange={(e) => setForm({ ...form, vtOpted: e.target.checked })} />
                    Optou por Vale-Transporte
                  </label>
                  {form.vtOpted && (
                    <Field label="Custo diário do VT (R$)" type="number" value={form.vtDailyCost} onChange={(v) => setForm({ ...form, vtDailyCost: v })} />
                  )}
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                    <input type="checkbox" checked={form.vrOpted} onChange={(e) => setForm({ ...form, vrOpted: e.target.checked })} />
                    Vale-Refeição/Alimentação
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                    <input type="checkbox" checked={form.healthPlan} onChange={(e) => setForm({ ...form, healthPlan: e.target.checked })} />
                    Plano de saúde
                  </label>
                </Grid>
              </Section>

              {/* Bancário */}
              <Section title="Dados Bancários">
                <Grid>
                  <Field label="Banco" value={form.bankName} onChange={(v) => setForm({ ...form, bankName: v })} />
                  <Field label="Agência" value={form.bankAgency} onChange={(v) => setForm({ ...form, bankAgency: v })} />
                  <Field label="Conta" value={form.bankAccount} onChange={(v) => setForm({ ...form, bankAccount: v })} />
                  <Field label="Tipo de conta" as="select" value={form.bankAccountType} onChange={(v) => setForm({ ...form, bankAccountType: v })}>
                    <option value="corrente">Conta corrente</option>
                    <option value="poupanca">Conta poupança</option>
                    <option value="pagamento">Conta pagamento</option>
                  </Field>
                  <Field label="Chave PIX" value={form.pixKey} onChange={(v) => setForm({ ...form, pixKey: v })} />
                </Grid>
              </Section>

              {/* Dependentes */}
              <Section title="Dependentes">
                {!editingId ? (
                  <p className="text-[11px] text-gray-400">Salve o cadastro para poder incluir dependentes.</p>
                ) : (
                  <div className="space-y-2">
                    {dependents.map((d) => (
                      <div key={d.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
                        <span>{d.name} {d.relationship ? `(${d.relationship})` : ''} {d.birthdate ? `— ${d.birthdate}` : ''}</span>
                        <button type="button" onClick={() => handleRemoveDependent(d.id)} className="text-red-500 hover:text-red-700"><Trash size={13} /></button>
                      </div>
                    ))}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end pt-1">
                      <Field label="Nome" value={newDependent.name} onChange={(v) => setNewDependent({ ...newDependent, name: v })} />
                      <Field label="Parentesco" value={newDependent.relationship} onChange={(v) => setNewDependent({ ...newDependent, relationship: v })} />
                      <Field label="Nascimento" type="date" value={newDependent.birthdate} onChange={(v) => setNewDependent({ ...newDependent, birthdate: v })} />
                      <Field label="CPF" value={newDependent.cpf} onChange={(v) => setNewDependent({ ...newDependent, cpf: v })} />
                      <button type="button" onClick={handleAddDependent} className="h-8 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex items-center justify-center gap-1">
                        <UserPlus size={13} /> Adicionar
                      </button>
                    </div>
                  </div>
                )}
              </Section>

              {/* Status */}
              <Section title="Status">
                <Grid>
                  <Field label="Situação" as="select" value={form.status} onChange={(v) => setForm({ ...form, status: v })}>
                    {EMPLOYEE_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </Field>
                </Grid>
              </Section>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowManage(false)} className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-2">{title}</h4>
      {children}
    </div>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{children}</div>;
}

function Field({ label, value, onChange, as = 'input', type = 'text', required = false, placeholder = '', children }) {
  const commonProps = {
    value: value ?? '',
    onChange: (e) => onChange(e.target.value),
    required,
    placeholder,
    className: 'w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs',
  };
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>
      {as === 'select' ? (
        <select {...commonProps}>{children}</select>
      ) : (
        <input type={type} {...commonProps} />
      )}
    </div>
  );
}
