import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck, Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { validateCPF } from '../utils/helpers';
import { fileToBase64, employeeRpcErrorMessage } from '../utils/mappings';
import { ADMISSIONAL_DOCUMENTS } from '../config/cltConstants';
import BiometricEnrollment from './BiometricEnrollment';

// Autocadastro de Funcionários CLT — tela pública, SEM sessão, espelhando o
// autocadastro de Profissionais PJ (ProfessionalSelfRegistration.jsx), mas
// coletando apenas dados pessoais/documentais do candidato: cargo, salário,
// tipo de contrato, jornada e data de admissão são atribuição do RH e ficam
// para a validação (FuncionariosTab), nunca preenchidos pelo próprio
// candidato. A biometria facial usa o mesmo componente robusto (câmera +
// liveness ativo) da Autogestão de Biometria do estagiário, em vez do simples
// upload de foto do cadastro inicial de estagiário.
//
// Fluxo: RPC create_employee_self_registration() cria o cadastro
// 'pending_validation' (já com a biometria embutida) e devolve um token de
// upload de curta duração; cada documento é então enviado por uma chamada
// separada a attach_employee_self_registration_document(), sequencialmente,
// com progresso e erro visíveis. Ver supabase_schema.sql, seção 19.

// Subconjunto de ADMISSIONAL_DOCUMENTS (cltConstants.js) que faz sentido o
// próprio candidato enviar no autocadastro — precisa bater exatamente com a
// allowlist de doc_key da RPC attach_employee_self_registration_document.
const SELF_REGISTRATION_DOC_KEYS = [
  'rg_cnh', 'cpf', 'ctps_digital', 'pis', 'comprovante_residencia', 'titulo_eleitor',
  'certificado_reservista', 'certidao_nascimento_casamento', 'certidao_cpf_dependentes',
  'cartao_vacinacao_filhos', 'comprovante_escolaridade', 'foto_3x4',
];

const emptyForm = {
  unitId: '',
  name: '', cpf: '', rg: '', rgIssuer: '', birthdate: '', sex: '', maritalStatus: '', education: '',
  nationality: 'Brasileira', birthplace: '', motherName: '', fatherName: '', phone: '', email: '',
  enderecoCep: '', enderecoLogradouro: '', enderecoNumero: '', enderecoComplemento: '', enderecoBairro: '', enderecoCidade: '', enderecoUf: '',
  ctpsNumber: '', ctpsSeries: '', ctpsUf: '', pis: '', voterTitle: '', reservistCert: '', cnh: '', cnhCategory: '',
  bankName: '', bankAgency: '', bankAccount: '', bankAccountType: 'Conta Corrente', pixKey: '',
};

const emptyDependent = { name: '', cpf: '', birthdate: '', relationship: '', forIr: true, forSalarioFamilia: false };

export default function EmployeeSelfRegistration({ branding, onCancel }) {
  const labels = branding?.employeeLabels || { singular: 'Funcionário(a)', plural: 'Funcionários CLT' };
  const kioskUnits = (branding?.kioskUnits || []).filter((ku) => ku.employeeKioskEmail);

  const [form, setForm] = useState(emptyForm);
  const [dependents, setDependents] = useState([]);
  const [newDependent, setNewDependent] = useState(emptyDependent);
  const [files, setFiles] = useState({}); // { [doc_key]: File }
  const [biometricPayload, setBiometricPayload] = useState(null);
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (field) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const requiredDocs = useMemo(
    () => ADMISSIONAL_DOCUMENTS.filter((d) => SELF_REGISTRATION_DOC_KEYS.includes(d.key)),
    []
  );

  const isDocRequired = (doc) => {
    const pseudoEmployee = { sex: form.sex, birthdate: form.birthdate };
    return doc.required(pseudoEmployee, dependents);
  };

  const setFile = (docKey) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo excede 2MB. Selecione um arquivo menor.');
      e.target.value = '';
      return;
    }
    setFiles((f) => ({ ...f, [docKey]: file }));
  };

  const handleAddDependent = () => {
    if (!newDependent.name.trim()) {
      toast.error('Informe o nome do dependente.');
      return;
    }
    setDependents((d) => [...d, newDependent]);
    setNewDependent(emptyDependent);
  };

  const handleRemoveDependent = (index) => {
    setDependents((d) => d.filter((_, i) => i !== index));
  };

  const unitName = (id) => kioskUnits.find((ku) => ku.id === id)?.name || id;

  const validate = () => {
    const e = {};
    if (!form.unitId) e.unitId = 'Selecione a unidade.';
    if (!form.name.trim()) e.name = 'Informe o nome completo.';
    if (!validateCPF(form.cpf)) e.cpf = 'CPF inválido.';
    if (!form.rg.trim()) e.rg = 'Informe o RG.';
    if (!form.birthdate) e.birthdate = 'Informe a data de nascimento.';
    requiredDocs.forEach((d) => {
      if (isDocRequired(d) && !files[d.key]) e[`doc_${d.key}`] = `Anexe: ${d.label}.`;
    });
    if (!biometricPayload) e.biometric = 'É necessário concluir a captura da biometria facial abaixo.';
    if (!lgpdAccepted) e.lgpd = 'É necessário aceitar o consentimento de tratamento de dados (LGPD).';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Revise os campos destacados antes de enviar.');
      return;
    }

    setSubmitting(true);
    setProgressLabel('Enviando dados do cadastro...');
    try {
      const { data, error } = await supabase.rpc('create_employee_self_registration', {
        p_unit_id: form.unitId,
        p_name: form.name.trim(),
        p_cpf: form.cpf,
        p_rg: form.rg.trim(),
        p_rg_issuer: form.rgIssuer.trim() || null,
        p_birthdate: form.birthdate || null,
        p_sex: form.sex || null,
        p_marital_status: form.maritalStatus.trim() || null,
        p_education: form.education.trim() || null,
        p_nationality: form.nationality.trim() || null,
        p_birthplace: form.birthplace.trim() || null,
        p_mother_name: form.motherName.trim() || null,
        p_father_name: form.fatherName.trim() || null,
        p_phone: form.phone.trim() || null,
        p_email: form.email.trim() || null,
        p_address: {
          cep: form.enderecoCep.trim() || '',
          logradouro: form.enderecoLogradouro.trim() || '',
          numero: form.enderecoNumero.trim() || '',
          complemento: form.enderecoComplemento.trim() || '',
          bairro: form.enderecoBairro.trim() || '',
          cidade: form.enderecoCidade.trim() || '',
          uf: form.enderecoUf.trim() || '',
        },
        p_ctps_number: form.ctpsNumber.trim() || null,
        p_ctps_series: form.ctpsSeries.trim() || null,
        p_ctps_uf: form.ctpsUf.trim() || null,
        p_pis: form.pis.trim() || null,
        p_voter_title: form.voterTitle.trim() || null,
        p_reservist_cert: form.reservistCert.trim() || null,
        p_cnh: form.cnh.trim() || null,
        p_cnh_category: form.cnhCategory.trim() || null,
        p_bank_name: form.bankName.trim() || null,
        p_bank_agency: form.bankAgency.trim() || null,
        p_bank_account: form.bankAccount.trim() || null,
        p_bank_account_type: form.bankAccountType || null,
        p_pix_key: form.pixKey.trim() || null,
        p_dependents: dependents,
        p_face_descriptor: JSON.stringify(biometricPayload.embedding),
        p_biometric_consent_accepted: true,
        p_biometric_consent_version: branding?.biometricConsentVersion || '1.0',
        p_lgpd_consent_accepted: lgpdAccepted,
      });
      if (error) throw error;

      const employeeId = data?.employee_id;
      const uploadToken = data?.upload_token;

      if (employeeId && uploadToken) {
        const docEntries = requiredDocs.filter((d) => files[d.key]);
        for (let i = 0; i < docEntries.length; i++) {
          const d = docEntries[i];
          const file = files[d.key];
          setProgressLabel(`Enviando anexo ${i + 1}/${docEntries.length}: ${d.label}...`);
          const base64 = await fileToBase64(file);
          const { error: attachError } = await supabase.rpc('attach_employee_self_registration_document', {
            p_employee_id: employeeId,
            p_token: uploadToken,
            p_doc_key: d.key,
            p_content: base64,
            p_meta: { name: file.name, size: (file.size / 1024).toFixed(1) + ' KB', type: d.key, uploadedAt: new Date().toISOString() },
          });
          if (attachError) {
            throw new Error(`Falha ao enviar "${d.label}": ${employeeRpcErrorMessage(attachError)}`);
          }
        }
      }

      setSuccess(true);
    } catch (err) {
      console.error('Erro no autocadastro de funcionário CLT:', err);
      toast.error(employeeRpcErrorMessage(err));
    } finally {
      setSubmitting(false);
      setProgressLabel('');
    }
  };

  const inputClass = (hasError) =>
    `w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`;

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
          <CheckCircle2 size={48} className="mx-auto text-indigo-600 mb-4" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">Cadastro enviado com sucesso</h2>
          <p className="text-sm text-gray-600 mb-6">
            Seus dados, documentos e biometria facial foram recebidos e ficam aguardando validação pelo RH de{' '}
            <strong>{unitName(form.unitId)}</strong>. Você será contatado(a) para os próximos passos, incluindo a
            formalização do contrato de trabalho.
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-colors"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-5 md:p-8">
        <div className="flex items-center gap-3 mb-1">
          <button type="button" onClick={onCancel} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold text-gray-800">Cadastro Obrigatório de {labels.singular}</h1>
        </div>
        <p className="text-xs text-gray-500 ml-9 mb-6">
          Preencha seus dados pessoais, anexe os documentos e cadastre sua biometria facial para que o RH possa
          validar seu cadastro e dar sequência à admissão. Cargo, salário, jornada e data de admissão serão
          definidos pelo RH na validação.
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Unidade */}
          <section>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Unidade contratante *</label>
            <select value={form.unitId} onChange={set('unitId')} className={inputClass(errors.unitId)}>
              <option value="">Selecione a unidade...</option>
              {kioskUnits.map((ku) => (
                <option key={ku.id} value={ku.id}>{ku.name}</option>
              ))}
            </select>
          </section>

          {/* Dados pessoais */}
          <section>
            <h2 className="text-sm font-bold text-indigo-800 border-b border-indigo-100 pb-2 mb-3">Dados Pessoais</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nome completo *</label>
                <input value={form.name} onChange={set('name')} className={inputClass(errors.name)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">CPF *</label>
                <input value={form.cpf} onChange={set('cpf')} className={inputClass(errors.cpf)} placeholder="000.000.000-00" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">RG *</label>
                <input value={form.rg} onChange={set('rg')} className={inputClass(errors.rg)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Órgão emissor</label>
                <input value={form.rgIssuer} onChange={set('rgIssuer')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Data de nascimento *</label>
                <input type="date" value={form.birthdate} onChange={set('birthdate')} className={inputClass(errors.birthdate)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Sexo</label>
                <select value={form.sex} onChange={set('sex')} className={inputClass(false)}>
                  <option value="">Selecione...</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Estado civil</label>
                <input value={form.maritalStatus} onChange={set('maritalStatus')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Escolaridade</label>
                <input value={form.education} onChange={set('education')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nacionalidade</label>
                <input value={form.nationality} onChange={set('nationality')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Naturalidade</label>
                <input value={form.birthplace} onChange={set('birthplace')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nome da mãe</label>
                <input value={form.motherName} onChange={set('motherName')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nome do pai</label>
                <input value={form.fatherName} onChange={set('fatherName')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Telefone</label>
                <input value={form.phone} onChange={set('phone')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">E-mail</label>
                <input type="email" value={form.email} onChange={set('email')} className={inputClass(false)} />
              </div>
            </div>

            <h3 className="text-xs font-bold text-gray-500 uppercase mt-4 mb-2">Endereço</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input value={form.enderecoCep} onChange={set('enderecoCep')} className={inputClass(false)} placeholder="CEP" />
              <input value={form.enderecoLogradouro} onChange={set('enderecoLogradouro')} className={`${inputClass(false)} sm:col-span-2`} placeholder="Logradouro" />
              <input value={form.enderecoNumero} onChange={set('enderecoNumero')} className={inputClass(false)} placeholder="Número" />
              <input value={form.enderecoComplemento} onChange={set('enderecoComplemento')} className={inputClass(false)} placeholder="Complemento" />
              <input value={form.enderecoBairro} onChange={set('enderecoBairro')} className={inputClass(false)} placeholder="Bairro" />
              <input value={form.enderecoCidade} onChange={set('enderecoCidade')} className={inputClass(false)} placeholder="Cidade" />
              <input value={form.enderecoUf} onChange={set('enderecoUf')} className={inputClass(false)} placeholder="UF" maxLength={2} />
            </div>
          </section>

          {/* Documentos trabalhistas */}
          <section>
            <h2 className="text-sm font-bold text-indigo-800 border-b border-indigo-100 pb-2 mb-3">Documentos Trabalhistas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={form.ctpsNumber} onChange={set('ctpsNumber')} className={inputClass(false)} placeholder="CTPS nº" />
              <input value={form.ctpsSeries} onChange={set('ctpsSeries')} className={inputClass(false)} placeholder="CTPS série" />
              <input value={form.ctpsUf} onChange={set('ctpsUf')} className={inputClass(false)} placeholder="CTPS UF" maxLength={2} />
              <input value={form.pis} onChange={set('pis')} className={inputClass(false)} placeholder="PIS/PASEP/NIT" />
              <input value={form.voterTitle} onChange={set('voterTitle')} className={inputClass(false)} placeholder="Título de eleitor" />
              <input value={form.reservistCert} onChange={set('reservistCert')} className={inputClass(false)} placeholder="Certificado de reservista" />
              <input value={form.cnh} onChange={set('cnh')} className={inputClass(false)} placeholder="CNH" />
              <input value={form.cnhCategory} onChange={set('cnhCategory')} className={inputClass(false)} placeholder="Categoria CNH" />
            </div>
          </section>

          {/* Dados bancários */}
          <section>
            <h2 className="text-sm font-bold text-indigo-800 border-b border-indigo-100 pb-2 mb-3">Dados Bancários</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={form.bankName} onChange={set('bankName')} className={inputClass(false)} placeholder="Banco" />
              <select value={form.bankAccountType} onChange={set('bankAccountType')} className={inputClass(false)}>
                <option>Conta Corrente</option>
                <option>Conta Poupança</option>
              </select>
              <input value={form.bankAgency} onChange={set('bankAgency')} className={inputClass(false)} placeholder="Agência" />
              <input value={form.bankAccount} onChange={set('bankAccount')} className={inputClass(false)} placeholder="Conta" />
              <input value={form.pixKey} onChange={set('pixKey')} className={`${inputClass(false)} sm:col-span-2`} placeholder="Chave PIX" />
            </div>
          </section>

          {/* Dependentes */}
          <section>
            <h2 className="text-sm font-bold text-indigo-800 border-b border-indigo-100 pb-2 mb-3">Dependentes (IR / Salário-Família)</h2>
            <div className="space-y-2">
              {dependents.map((d, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
                  <span>{d.name} {d.relationship ? `(${d.relationship})` : ''} {d.birthdate ? `— ${d.birthdate}` : ''}</span>
                  <button type="button" onClick={() => handleRemoveDependent(i)} className="text-red-500 hover:text-red-700 font-semibold">Remover</button>
                </div>
              ))}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                <input value={newDependent.name} onChange={(e) => setNewDependent({ ...newDependent, name: e.target.value })} className={inputClass(false)} placeholder="Nome" />
                <input value={newDependent.relationship} onChange={(e) => setNewDependent({ ...newDependent, relationship: e.target.value })} className={inputClass(false)} placeholder="Parentesco" />
                <input type="date" value={newDependent.birthdate} onChange={(e) => setNewDependent({ ...newDependent, birthdate: e.target.value })} className={inputClass(false)} />
                <button type="button" onClick={handleAddDependent} className="py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold">
                  Adicionar
                </button>
              </div>
            </div>
          </section>

          {/* Anexos */}
          <section>
            <h2 className="text-sm font-bold text-indigo-800 border-b border-indigo-100 pb-2 mb-3">Documentos</h2>
            <div className="space-y-2">
              {requiredDocs.map((d) => {
                const required = isDocRequired(d);
                return (
                  <div key={d.key} className={`flex items-center justify-between gap-3 p-3 border rounded-lg ${errors[`doc_${d.key}`] ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={16} className="text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate">{d.label}{!required && ' (opcional)'}</p>
                        {files[d.key] && <p className="text-[10px] text-indigo-600 truncate">{files[d.key].name}</p>}
                      </div>
                    </div>
                    <label className="flex-shrink-0 cursor-pointer text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-100 flex items-center gap-1">
                      <Upload size={12} />
                      {files[d.key] ? 'Trocar' : 'Anexar'}
                      <input type="file" accept="image/jpeg,image/jpg,image/png,application/pdf" onChange={setFile(d.key)} className="hidden" />
                    </label>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Formatos aceitos: JPG, PNG ou PDF. Tamanho máximo: 2MB por arquivo.</p>
          </section>

          {/* Biometria facial */}
          <section>
            <h2 className="text-sm font-bold text-indigo-800 border-b border-indigo-100 pb-2 mb-3">Biometria Facial *</h2>
            {biometricPayload ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-sm text-emerald-800">
                <CheckCircle2 size={18} />
                Biometria facial capturada com sucesso.
                <button type="button" onClick={() => setBiometricPayload(null)} className="ml-auto text-xs font-semibold text-emerald-700 underline">
                  Refazer
                </button>
              </div>
            ) : (
              <BiometricEnrollment
                internName={form.name}
                internCpf={form.cpf}
                onEnrollmentComplete={(payload) => setBiometricPayload(payload)}
              />
            )}
            {errors.biometric && <p className="text-[11px] text-red-600 mt-2">{errors.biometric}</p>}
          </section>

          {/* LGPD */}
          <section className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <ShieldCheck size={18} className="text-indigo-600 flex-shrink-0 mt-0.5" />
              <h2 className="text-sm font-bold text-gray-800">Consentimento LGPD</h2>
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" checked={lgpdAccepted} onChange={(e) => setLgpdAccepted(e.target.checked)} className="mt-0.5" />
              <span>
                Autorizo o tratamento dos meus dados pessoais informados neste cadastro, nos termos da Lei nº
                13.709/2018 (LGPD), exclusivamente para fins de análise cadastral, admissão e gestão da relação de
                trabalho.
              </span>
            </label>
            {errors.lgpd && <p className="text-[11px] text-red-600">{errors.lgpd}</p>}
          </section>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-2.5 border border-gray-300 rounded-lg font-semibold text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (<><Loader2 size={16} className="animate-spin" /> {progressLabel || 'Enviando...'}</>) : 'Enviar Cadastro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
