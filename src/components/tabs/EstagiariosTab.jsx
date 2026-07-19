import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Pencil, Trash2, Save, X, Building2, Upload } from 'lucide-react';
import { supabase } from '../../supabase';
import { mapInternFromDb, mapInternToDb, mapUnitFromDb, generateUsername, compressImage } from '../../utils/mappings';
import { validateCPF } from '../../utils/helpers';

export default function EstagiariosTab({ filterUnit }) {
  const [interns, setInterns] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  // CRUD States
  const [showManage, setShowManage] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [form, setForm] = useState({
    name: '', course: '', institution: '', shift: 'Manhã',
    dailyHours: 6, unitId: '', active: true,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    photo: '', cpf: '', email: '', rg: '', phone: '', address: '',
    bankName: '', bankAgency: '', bankAccount: '', pixKey: '',
    emergencyName: '', emergencyRelationship: 'Pais', emergencyPhone: '',
    allowance: 0, supervisorName: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const { data: internsData } = await supabase
        .from('interns')
        .select('*')
        .order('name', { ascending: true });

      const { data: unitsData } = await supabase
        .from('units')
        .select('*')
        .order('name', { ascending: true });

      if (internsData) setInterns(internsData.map(mapInternFromDb));
      if (unitsData) {
        const mappedUnits = unitsData.map(mapUnitFromDb);
        setUnits(mappedUnits);
        // Inicializa unitId apenas se ainda não foi definido (sem dependência no callback)
        setForm(f => f.unitId ? f : { ...f, unitId: mappedUnits[0]?.id || '' });
      }
    } catch (err) {
      console.error('Erro ao carregar estagiários:', err);
    } finally {
      setLoading(false);
    }
  }, []); // sem dependências — evita loop infinito de re-fetch

  useEffect(() => {
    fetchData();

    const internsChannel = supabase
      .channel('estagiarios-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interns' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(internsChannel);
    };
  }, [fetchData]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: '', course: '', institution: '', shift: 'Manhã',
      dailyHours: 6, unitId: units[0]?.id || '', active: true,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365 * 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      photo: '', cpf: '', email: '', rg: '', phone: '', address: '',
      bankName: '', bankAgency: '', bankAccount: '', pixKey: '',
      emergencyName: '', emergencyRelationship: 'Pais', emergencyPhone: '',
      allowance: 0, supervisorName: '',
    });
    setShowManage(false);
  };

  const handleEditIntern = (intern) => {
    setEditingId(intern.id);
    setForm({
      name: intern.name || '',
      course: intern.course || '',
      institution: intern.institution || '',
      shift: intern.shift || 'Manhã',
      dailyHours: intern.dailyHours || 6,
      unitId: intern.unitId || units[0]?.id || '',
      active: intern.active !== false,
      startDate: intern.startDate || '',
      endDate: intern.endDate || '',
      photo: intern.photo || '',
      cpf: intern.cpf || '',
      email: intern.email || '',
      rg: intern.rg || '',
      phone: intern.phone || '',
      address: intern.address || '',
      bankName: intern.bankName || '',
      bankAgency: intern.bankAgency || '',
      bankAccount: intern.bankAccount || '',
      pixKey: intern.pixKey || '',
      emergencyName: intern.emergencyName || '',
      emergencyRelationship: intern.emergencyRelationship || 'Pais',
      emergencyPhone: intern.emergencyPhone || '',
      allowance: intern.allowance || 0,
      supervisorName: intern.supervisorName || '',
    });
    setShowManage(true);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImage(file, 200, 260, 0.7);
      setForm(f => ({ ...f, photo: base64 }));
    } catch (err) {
      console.error('Erro ao processar foto:', err);
      alert('Erro ao processar imagem.');
    }
  };

  const handleSaveIntern = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert('Nome completo é obrigatório.');
    if (form.cpf && !validateCPF(form.cpf)) return alert('CPF informado é inválido.');

    const payload = {
      ...form,
      name: form.name.trim(),
      course: form.course.trim(),
      institution: form.institution.trim(),
      photo: form.photo,
      cpf: form.cpf.trim(),
      email: form.email.trim(),
      rg: form.rg.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      bankName: form.bankName.trim(),
      bankAgency: form.bankAgency.trim(),
      bankAccount: form.bankAccount.trim(),
      pixKey: form.pixKey.trim(),
      emergencyName: form.emergencyName.trim(),
      emergencyRelationship: form.emergencyRelationship,
      emergencyPhone: form.emergencyPhone.trim(),
      allowance: Number(form.allowance) || 0,
      supervisorName: form.supervisorName.trim(),
    };

    try {
      if (editingId) {
        const dbPayload = mapInternToDb(payload);
        delete dbPayload.last_report_date;
        delete dbPayload.recess_days_taken;
        delete dbPayload.semestral_reports;
        delete dbPayload.contract_termination;

        const { error } = await supabase
          .from('interns')
          .update(dbPayload)
          .eq('id', editingId);
        if (error) throw error;
        alert('Estagiário atualizado com sucesso!');
      } else {
        const email = payload.email || `${generateUsername(payload.name)}@portoterapia.com`;
        const createResult = await supabase.rpc('create_intern_user', {
          p_email: email,
          p_password: '0000',
          p_name: payload.name,
          p_course: payload.course,
          p_institution: payload.institution,
          p_shift: payload.shift,
          p_daily_hours: payload.dailyHours,
          p_unit_id: payload.unitId,
          p_start_date: payload.startDate,
          p_end_date: payload.endDate,
          p_photo: payload.photo || null,
          p_cpf: payload.cpf || null,
          p_rg: payload.rg || null,
          p_phone: payload.phone || null,
          p_address: payload.address || null,
          p_bank_name: payload.bankName || null,
          p_bank_agency: payload.bankAgency || null,
          p_bank_account: payload.bankAccount || null,
          p_pix_key: payload.pixKey || null,
          p_emergency_name: payload.emergencyName || null,
          p_emergency_relationship: payload.emergencyRelationship || 'Pais',
          p_emergency_phone: payload.emergencyPhone || null,
          p_allowance: Number(payload.allowance) || 0,
          p_supervisor_name: payload.supervisorName || null
        });

        if (createResult.error) {
          console.warn("Tentando fallback de criação...", createResult.error);
          const fallbackResult = await supabase.rpc('create_intern_user', {
            p_email: email,
            p_password: '0000',
            p_name: payload.name,
            p_course: payload.course,
            p_institution: payload.institution,
            p_shift: payload.shift,
            p_daily_hours: payload.dailyHours,
            p_unit_id: payload.unitId,
            p_start_date: payload.startDate,
            p_end_date: payload.endDate,
            p_photo: payload.photo || null,
            p_cpf: payload.cpf || null,
            p_rg: payload.rg || null,
            p_phone: payload.phone || null,
            p_address: payload.address || null,
            p_bank_name: payload.bankName || null,
            p_bank_agency: payload.bankAgency || null,
            p_bank_account: payload.bankAccount || null,
            p_pix_key: payload.pixKey || null,
            p_emergency_name: payload.emergencyName || null,
            p_emergency_relationship: payload.emergencyRelationship || 'Pais',
            p_emergency_phone: payload.emergencyPhone || null,
            p_allowance: Number(payload.allowance) || 0
          });
          if (fallbackResult.error) throw fallbackResult.error;
          const newId = fallbackResult.data;
          if (newId) {
            await supabase.from('interns').update({ supervisor_name: payload.supervisorName }).eq('id', newId);
          }
        } else {
          const newId = createResult.data;
          if (newId) {
            await supabase.from('interns').update({ supervisor_name: payload.supervisorName }).eq('id', newId);
          }
        }
        alert('Estagiário criado com sucesso!');
      }
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar estagiário:', error);
      alert('Erro ao salvar estagiário: ' + (error.message || error));
    }
  };

  const handleDeleteIntern = async (intern) => {
    const ok = window.confirm(
      `Excluir o estagiário "${intern.name}"?\n\n` +
      `Os registros de ponto já feitos serão mantidos no histórico. Esta ação não pode ser desfeita.`
    );
    if (!ok) return;
    try {
      const { error } = await supabase.rpc('delete_intern_user', {
        p_intern_id: intern.id
      });
      if (error) throw error;
      alert('Estagiário excluído com sucesso!');
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Erro ao excluir estagiário:', error);
      alert('Erro ao excluir estagiário.');
    }
  };

  const handleApproveRegistration = async (internId) => {
    const ok = window.confirm("Deseja realmente aprovar e validar o recadastro deste estagiário?");
    if (!ok) return;
    try {
      const { error } = await supabase
        .from('interns')
        .update({ registration_status: 'validated' })
        .eq('id', internId);
      if (error) throw error;
      alert("Cadastro validado com sucesso!");
      fetchData();
    } catch (err) {
      console.error("Erro ao aprovar cadastro:", err);
      alert("Erro ao validar cadastro: " + err.message);
    }
  };

  const filteredInterns = interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit);
  const unitName = (id) => units.find(u => u.id === id)?.name || '—';

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden transition-all hover:shadow-lg duration-300 border border-slate-100">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <Users size={20} className="text-blue-600" /> Gestão de Estagiários
        </h2>
        {!showManage && (
          <button
            onClick={() => setShowManage(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition-colors inline-flex items-center gap-1"
          >
            <Plus size={14} /> Novo Estagiário
          </button>
        )}
      </div>

      <div className="p-4 space-y-6">
        {showManage ? (
          <form onSubmit={handleSaveIntern} className="bg-slate-50 rounded-xl p-5 border border-slate-200 animate-fade-in space-y-4">
            <div className="flex justify-between items-center border-b pb-2.5">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <Building2 size={16} className="text-slate-500" /> 
                {editingId ? 'Editar Perfil de Estagiário' : 'Cadastrar Novo Estagiário'}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do estagiário"
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Curso Acadêmico</label>
                <input
                  type="text"
                  placeholder="Ex: Psicologia"
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={form.course}
                  onChange={e => setForm(f => ({ ...f, course: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Instituição de Ensino (IES)</label>
                <input
                  type="text"
                  placeholder="Ex: UFPA"
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={form.institution}
                  onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Turno de Trabalho</label>
                <select
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  value={form.shift}
                  onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}
                >
                  <option>Manhã</option>
                  <option>Tarde</option>
                  <option>Noite</option>
                  <option>Integral</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Carga Horária Diária (horas)</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={form.dailyHours}
                  onChange={e => setForm(f => ({ ...f, dailyHours: Number(e.target.value) }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Unidade Recomendada</label>
                <select
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  value={form.unitId}
                  onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))}
                >
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Início do Estágio *</label>
                <input
                  type="date"
                  required
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Fim do Contrato (Previsão)</label>
                <input
                  type="date"
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Bolsa / Auxílio Mensal (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={form.allowance}
                  onChange={e => setForm(f => ({ ...f, allowance: Number(e.target.value) }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Supervisor Responsável</label>
                <input
                  type="text"
                  placeholder="Nome do Supervisor"
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={form.supervisorName}
                  onChange={e => setForm(f => ({ ...f, supervisorName: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700">CPF</label>
                <input
                  type="text"
                  placeholder="Ex: 000.000.000-00"
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={form.cpf}
                  onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700">E-mail de Login/Contato *</label>
                <input
                  type="email"
                  required
                  placeholder="Email"
                  disabled={!!editingId}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>

            <div className="border-t pt-3 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                />
                <label htmlFor="active" className="text-xs font-semibold text-gray-700">
                  Estagiário ativo e autorizado a registrar frequência
                </label>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-white border rounded-lg px-3 py-1.5 text-xs text-gray-600 relative overflow-hidden cursor-pointer hover:bg-gray-50">
                  <Upload size={14} /> Upload Foto 3x4
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handlePhotoUpload}
                  />
                </div>
                {form.photo && (
                  <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 shadow-sm relative group">
                    <img src={form.photo} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, photo: '' }))}
                      className="absolute inset-0 bg-black/50 text-white items-center justify-center hidden group-hover:flex text-[9px] font-bold"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3.5 border-t pt-3.5">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-xs transition-colors inline-flex items-center gap-1"
              >
                <Save size={14} /> Salvar Alterações
              </button>
            </div>
          </form>
        ) : null}

        {/* Interns List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInterns.length === 0 ? (
            <div className="col-span-full p-8 text-center text-gray-400 italic">
              Nenhum estagiário cadastrado nesta unidade.
            </div>
          ) : (
            filteredInterns.map((intern) => (
              <div
                key={intern.id}
                className={`border rounded-xl p-4 flex flex-col justify-between transition-all duration-300 relative ${
                  intern.active === false 
                    ? 'bg-slate-50 border-slate-200 opacity-60' 
                    : 'bg-white border-slate-100 hover:shadow-md'
                }`}
              >
                {/* Status Badges */}
                <div className="absolute top-4 right-4 flex flex-col gap-1 items-end">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    intern.active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {intern.active !== false ? 'Ativo' : 'Inativo'}
                  </span>
                  {intern.registrationStatus === 'pending_validation' && (
                    <button
                      onClick={() => handleApproveRegistration(intern.id)}
                      className="text-[8px] bg-amber-100 text-amber-700 font-extrabold px-1.5 py-0.5 rounded-full hover:bg-amber-200 transition-colors flex items-center gap-0.5 shadow-sm border border-amber-200"
                      title="Clique para aprovar o recadastro feito pelo estagiário"
                    >
                      ⚠️ Validar Recadastro
                    </button>
                  )}
                </div>

                <div className="flex gap-3">
                  <div className="w-12 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                    {intern.photo ? (
                      <img src={intern.photo} alt={intern.name} className="w-full h-full object-cover" />
                    ) : (
                      <Users size={20} className="text-slate-400" />
                    )}
                  </div>

                  <div className="space-y-1 pr-14">
                    <h3 className="text-xs font-bold text-gray-800 line-clamp-1">{intern.name}</h3>
                    <p className="text-[10px] text-gray-500 leading-none">{intern.course || 'Sem curso'} • {intern.institution || 'Sem IES'}</p>
                    <p className="text-[9px] text-indigo-600 font-semibold">{unitName(intern.unitId)}</p>
                    <p className="text-[9px] text-slate-500 font-medium">Turno: {intern.shift} ({intern.dailyHours}h/dia)</p>
                  </div>
                </div>

                <div className="border-t mt-3 pt-2.5 flex justify-between items-center text-[10px]">
                  <div className="text-gray-500">
                    <p>Início: {intern.startDate ? new Date(intern.startDate).toLocaleDateString('pt-BR') : '—'}</p>
                    <p>Bolsa: {intern.allowance ? intern.allowance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}</p>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleEditIntern(intern)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteIntern(intern)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
