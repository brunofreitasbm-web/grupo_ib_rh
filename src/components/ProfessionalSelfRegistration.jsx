import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck, Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { validateCPF, validateCNPJ } from '../utils/helpers';
import { fileToBase64, professionalRpcErrorMessage } from '../utils/mappings';
import { ProfessionSelect } from './CourseFields';
import { getProfessionCouncil, normalizeProfessionValue } from '../config/professions';

// Autocadastro de Profissionais PJ (prestadores de serviço) — tela pública,
// SEM sessão, espelhando o "Cadastro Obrigatório" dos estagiários
// (renderRecadastroSection em App.jsx), mas com vocabulário e campos
// deliberadamente distintos: nada de jornada/bolsa/supervisor/emergência —
// ver Seção 0 do plano do módulo (blindagem de vínculo trabalhista).
//
// Fluxo: RPC create_professional_self_registration() cria o cadastro
// 'pending_validation' e devolve um token de upload de curta duração; cada
// anexo é então enviado por uma chamada separada a
// attach_professional_self_registration_document(), sequencialmente, com
// progresso e erro visíveis (ao contrário do autocadastro de estagiário, que
// falha silenciosamente sob RLS pós-RPC).

const DOC_TYPES = [
  { key: 'cartao_cnpj', label: 'Cartão CNPJ' },
  { key: 'contrato_social', label: 'Contrato Social (ou Requerimento de Empresário)' },
  { key: 'carteira_conselho', label: 'Carteira do Conselho Profissional' },
  { key: 'comprovante_endereco', label: 'Comprovante de Endereço' },
  { key: 'doc_identidade_representante', label: 'Documento de Identidade do Representante Legal' },
];

const emptyForm = {
  unitId: '',
  name: '', cnpj: '', razaoSocial: '', nomeFantasia: '', naturezaJuridica: '', cnaePrincipal: '', inscricaoMunicipal: '',
  enderecoCep: '', enderecoLogradouro: '', enderecoNumero: '', enderecoComplemento: '', enderecoBairro: '', enderecoCidade: '', enderecoUf: '',
  profession: '', councilType: '', councilNumber: '', councilUf: '', councilValidity: '', specialties: '',
  repName: '', repCpf: '', repRg: '', repBirthdate: '', repEmail: '', repPhone: '', repRole: '',
  email: '', phone: '',
  bankName: '', bankAgency: '', bankAccount: '', bankAccountType: 'Conta Corrente', pixKey: '',
  serviceDescription: '', remunerationModel: 'Por atendimento (NF mensal)', remunerationValue: '', paymentDay: '', noticeDays: 30,
  contractStart: '',
};

export default function ProfessionalSelfRegistration({ units = [], branding, onCancel }) {
  const labels = branding?.professionalLabels || { singular: 'Prestador(a)', plural: 'Profissionais PJ' };
  const kioskUnits = (branding?.kioskUnits || []).filter((ku) => ku.professionalKioskEmail);

  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState({}); // { [doc_key]: File }
  const [autonomyAccepted, setAutonomyAccepted] = useState(false);
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (field) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [field]: value }));
  };

  // O conselho de classe segue a profissão escolhida no catálogo, sem
  // sobrescrever um registro que a pessoa já tenha digitado.
  const setProfession = (value) =>
    setForm((f) => ({ ...f, profession: value, councilType: f.councilType || getProfessionCouncil(value) }));

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

  const unitName = (id) => kioskUnits.find((ku) => ku.id === id)?.name || units.find((u) => u.id === id)?.name || id;

  const validate = () => {
    const e = {};
    if (!form.unitId) e.unitId = 'Selecione a unidade.';
    if (!form.name.trim()) e.name = 'Informe o nome do prestador.';
    if (!validateCNPJ(form.cnpj)) e.cnpj = 'CNPJ inválido.';
    if (!form.razaoSocial.trim()) e.razaoSocial = 'Informe a razão social.';
    if (!form.profession.trim()) e.profession = 'Informe a profissão.';
    if (!form.councilType.trim() || !form.councilNumber.trim()) e.council = 'Informe o conselho profissional e o número de registro.';
    if (!form.repName.trim()) e.repName = 'Informe o nome do representante legal.';
    if (!validateCPF(form.repCpf)) e.repCpf = 'CPF do representante legal inválido.';
    if (!form.repRg.trim()) e.repRg = 'Informe o RG do representante legal.';
    DOC_TYPES.forEach((d) => {
      if (!files[d.key]) e[`doc_${d.key}`] = `Anexe: ${d.label}.`;
    });
    if (!autonomyAccepted) e.autonomy = 'É necessário aceitar a Declaração de Autonomia.';
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
      const { data, error } = await supabase.rpc('create_professional_self_registration', {
        p_unit_id: form.unitId,
        p_name: form.name.trim(),
        p_cnpj: form.cnpj,
        p_razao_social: form.razaoSocial.trim(),
        p_nome_fantasia: form.nomeFantasia.trim() || null,
        p_natureza_juridica: form.naturezaJuridica.trim() || null,
        p_cnae_principal: form.cnaePrincipal.trim() || null,
        p_inscricao_municipal: form.inscricaoMunicipal.trim() || null,
        p_endereco_cep: form.enderecoCep.trim() || null,
        p_endereco_logradouro: form.enderecoLogradouro.trim() || null,
        p_endereco_numero: form.enderecoNumero.trim() || null,
        p_endereco_complemento: form.enderecoComplemento.trim() || null,
        p_endereco_bairro: form.enderecoBairro.trim() || null,
        p_endereco_cidade: form.enderecoCidade.trim() || null,
        p_endereco_uf: form.enderecoUf.trim() || null,
        p_profession: normalizeProfessionValue(form.profession) || form.profession.trim(),
        p_council_type: form.councilType.trim(),
        p_council_number: form.councilNumber.trim(),
        p_council_uf: form.councilUf.trim() || null,
        p_council_validity: form.councilValidity || null,
        p_specialties: form.specialties.trim() || null,
        p_rep_name: form.repName.trim(),
        p_rep_cpf: form.repCpf,
        p_rep_rg: form.repRg.trim(),
        p_rep_birthdate: form.repBirthdate || null,
        p_rep_email: form.repEmail.trim() || null,
        p_rep_phone: form.repPhone.trim() || null,
        p_rep_role: form.repRole.trim() || null,
        p_email: form.email.trim() || null,
        p_phone: form.phone.trim() || null,
        p_bank_name: form.bankName.trim() || null,
        p_bank_agency: form.bankAgency.trim() || null,
        p_bank_account: form.bankAccount.trim() || null,
        p_bank_account_type: form.bankAccountType || null,
        p_pix_key: form.pixKey.trim() || null,
        p_service_description: form.serviceDescription.trim() || null,
        p_remuneration_model: form.remunerationModel.trim() || null,
        p_remuneration_value: form.remunerationValue === '' ? null : Number(form.remunerationValue),
        p_payment_day: form.paymentDay === '' ? null : Number(form.paymentDay),
        p_notice_days: form.noticeDays === '' ? null : Number(form.noticeDays),
        p_contract_start: form.contractStart || null,
        p_autonomy_declaration_accepted: autonomyAccepted,
        p_autonomy_declaration_version: branding?.autonomyDeclarationVersion || '1.0',
        p_lgpd_consent_accepted: lgpdAccepted,
      });
      if (error) throw error;

      const professionalId = data?.professional_id;
      const uploadToken = data?.upload_token;

      if (professionalId && uploadToken) {
        const docEntries = DOC_TYPES.filter((d) => files[d.key]);
        for (let i = 0; i < docEntries.length; i++) {
          const d = docEntries[i];
          const file = files[d.key];
          setProgressLabel(`Enviando anexo ${i + 1}/${docEntries.length}: ${d.label}...`);
          const base64 = await fileToBase64(file);
          const { error: attachError } = await supabase.rpc('attach_professional_self_registration_document', {
            p_professional_id: professionalId,
            p_token: uploadToken,
            p_doc_key: d.key,
            p_content: base64,
            p_meta: { name: file.name, size: (file.size / 1024).toFixed(1) + ' KB', type: d.key, uploadedAt: new Date().toISOString() },
          });
          if (attachError) {
            throw new Error(`Falha ao enviar "${d.label}": ${professionalRpcErrorMessage(attachError)}`);
          }
        }
      }

      setSuccess(true);
    } catch (err) {
      console.error('Erro no autocadastro de prestador PJ:', err);
      toast.error(professionalRpcErrorMessage(err));
    } finally {
      setSubmitting(false);
      setProgressLabel('');
    }
  };

  const inputClass = (hasError) =>
    `w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`;

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
          <CheckCircle2 size={48} className="mx-auto text-teal-600 mb-4" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">Cadastro enviado com sucesso</h2>
          <p className="text-sm text-gray-600 mb-6">
            Seus dados e documentos foram recebidos e ficam aguardando validação pela administração de{' '}
            <strong>{unitName(form.unitId)}</strong>. Você será contatado(a) para os próximos passos, incluindo a
            emissão do contrato de prestação de serviços.
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2.5 bg-teal-600 text-white rounded-lg font-semibold text-sm hover:bg-teal-700 transition-colors"
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
          Preencha todos os dados abaixo para que a administração possa validar seu cadastro e emitir o contrato de
          prestação de serviços. Este cadastro tem natureza exclusivamente comercial/civil — ver a Declaração de
          Autonomia ao final.
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

          {/* Dados da Pessoa Jurídica */}
          <section>
            <h2 className="text-sm font-bold text-teal-800 border-b border-teal-100 pb-2 mb-3">Dados da Pessoa Jurídica</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nome do(a) prestador(a) *</label>
                <input value={form.name} onChange={set('name')} className={inputClass(errors.name)} placeholder="Nome completo" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">CNPJ *</label>
                <input value={form.cnpj} onChange={set('cnpj')} className={inputClass(errors.cnpj)} placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Razão Social *</label>
                <input value={form.razaoSocial} onChange={set('razaoSocial')} className={inputClass(errors.razaoSocial)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nome Fantasia</label>
                <input value={form.nomeFantasia} onChange={set('nomeFantasia')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Natureza Jurídica</label>
                <input value={form.naturezaJuridica} onChange={set('naturezaJuridica')} className={inputClass(false)} placeholder="Ex.: Sociedade Simples Ltda." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">CNAE Principal</label>
                <input value={form.cnaePrincipal} onChange={set('cnaePrincipal')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Inscrição Municipal</label>
                <input value={form.inscricaoMunicipal} onChange={set('inscricaoMunicipal')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">E-mail de contato</label>
                <input type="email" value={form.email} onChange={set('email')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Telefone</label>
                <input value={form.phone} onChange={set('phone')} className={inputClass(false)} />
              </div>
            </div>

            <h3 className="text-xs font-bold text-gray-500 uppercase mt-4 mb-2">Endereço da sede</h3>
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

          {/* Habilitação Profissional */}
          <section>
            <h2 className="text-sm font-bold text-teal-800 border-b border-teal-100 pb-2 mb-3">Habilitação Profissional</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Profissão *</label>
                <ProfessionSelect value={form.profession} onChange={setProfession} className={inputClass(errors.profession)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Conselho *</label>
                  <input value={form.councilType} onChange={set('councilType')} className={inputClass(errors.council)} placeholder="CRP" />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Número *</label>
                  <input value={form.councilNumber} onChange={set('councilNumber')} className={inputClass(errors.council)} />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">UF</label>
                  <input value={form.councilUf} onChange={set('councilUf')} className={inputClass(false)} maxLength={2} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Validade do registro</label>
                <input type="date" value={form.councilValidity} onChange={set('councilValidity')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Especialidades</label>
                <input value={form.specialties} onChange={set('specialties')} className={inputClass(false)} />
              </div>
            </div>
          </section>

          {/* Representante Legal */}
          <section>
            <h2 className="text-sm font-bold text-teal-800 border-b border-teal-100 pb-2 mb-3">Representante Legal (assina pela PJ)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nome completo *</label>
                <input value={form.repName} onChange={set('repName')} className={inputClass(errors.repName)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Qualificação (ex.: sócio-administrador)</label>
                <input value={form.repRole} onChange={set('repRole')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">CPF *</label>
                <input value={form.repCpf} onChange={set('repCpf')} className={inputClass(errors.repCpf)} placeholder="000.000.000-00" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">RG *</label>
                <input value={form.repRg} onChange={set('repRg')} className={inputClass(errors.repRg)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Data de nascimento</label>
                <input type="date" value={form.repBirthdate} onChange={set('repBirthdate')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">E-mail</label>
                <input type="email" value={form.repEmail} onChange={set('repEmail')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Telefone</label>
                <input value={form.repPhone} onChange={set('repPhone')} className={inputClass(false)} />
              </div>
            </div>
          </section>

          {/* Dados bancários */}
          <section>
            <h2 className="text-sm font-bold text-teal-800 border-b border-teal-100 pb-2 mb-3">
              Dados Bancários da PJ (pagamento contra Nota Fiscal)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={form.bankName} onChange={set('bankName')} className={inputClass(false)} placeholder="Banco" />
              <select value={form.bankAccountType} onChange={set('bankAccountType')} className={inputClass(false)}>
                <option>Conta Corrente</option>
                <option>Conta Poupança</option>
              </select>
              <input value={form.bankAgency} onChange={set('bankAgency')} className={inputClass(false)} placeholder="Agência" />
              <input value={form.bankAccount} onChange={set('bankAccount')} className={inputClass(false)} placeholder="Conta" />
              <input value={form.pixKey} onChange={set('pixKey')} className={`${inputClass(false)} sm:col-span-2`} placeholder="Chave PIX (da PJ)" />
            </div>
          </section>

          {/* Objeto e condições comerciais */}
          <section>
            <h2 className="text-sm font-bold text-teal-800 border-b border-teal-100 pb-2 mb-3">Objeto e Condições Comerciais</h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição dos serviços a prestar</label>
                <textarea value={form.serviceDescription} onChange={set('serviceDescription')} rows={2} className={inputClass(false)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Modelo de remuneração</label>
                <input value={form.remunerationModel} onChange={set('remunerationModel')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Valor de referência (R$)</label>
                <input type="number" step="0.01" value={form.remunerationValue} onChange={set('remunerationValue')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Dia de pagamento (contra NF)</label>
                <input type="number" min="1" max="31" value={form.paymentDay} onChange={set('paymentDay')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Aviso prévio de rescisão (dias)</label>
                <input type="number" min="0" value={form.noticeDays} onChange={set('noticeDays')} className={inputClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Início da prestação de serviços</label>
                <input type="date" value={form.contractStart} onChange={set('contractStart')} className={inputClass(false)} />
              </div>
            </div>
          </section>

          {/* Anexos */}
          <section>
            <h2 className="text-sm font-bold text-teal-800 border-b border-teal-100 pb-2 mb-3">Documentos Obrigatórios</h2>
            <div className="space-y-2">
              {DOC_TYPES.map((d) => (
                <div key={d.key} className={`flex items-center justify-between gap-3 p-3 border rounded-lg ${errors[`doc_${d.key}`] ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={16} className="text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{d.label}</p>
                      {files[d.key] && <p className="text-[10px] text-teal-600 truncate">{files[d.key].name}</p>}
                    </div>
                  </div>
                  <label className="flex-shrink-0 cursor-pointer text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 hover:bg-teal-100 flex items-center gap-1">
                    <Upload size={12} />
                    {files[d.key] ? 'Trocar' : 'Anexar'}
                    <input type="file" accept="image/jpeg,image/jpg,image/png,application/pdf" onChange={setFile(d.key)} className="hidden" />
                  </label>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Formatos aceitos: JPG, PNG ou PDF. Tamanho máximo: 2MB por arquivo.</p>
          </section>

          {/* Declaração de Autonomia + LGPD */}
          <section className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <ShieldCheck size={18} className="text-teal-600 flex-shrink-0 mt-0.5" />
              <h2 className="text-sm font-bold text-gray-800">Declaração de Autonomia do Prestador de Serviços</h2>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white">
              {branding?.autonomyDeclarationText}
            </p>
            <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" checked={autonomyAccepted} onChange={(e) => setAutonomyAccepted(e.target.checked)} className="mt-0.5" />
              <span>Li e declaro estar de acordo com a Declaração de Autonomia do Prestador de Serviços acima.</span>
            </label>
            {errors.autonomy && <p className="text-[11px] text-red-600">{errors.autonomy}</p>}

            <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer pt-2 border-t border-gray-200">
              <input type="checkbox" checked={lgpdAccepted} onChange={(e) => setLgpdAccepted(e.target.checked)} className="mt-0.5" />
              <span>
                Autorizo o tratamento dos meus dados pessoais e da pessoa jurídica informados neste cadastro, nos
                termos da Lei nº 13.709/2018 (LGPD), exclusivamente para fins de análise cadastral, formalização
                contratual e gestão da prestação de serviços.
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
              className="flex-1 py-2.5 bg-teal-600 text-white rounded-lg font-semibold text-sm hover:bg-teal-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (<><Loader2 size={16} className="animate-spin" /> {progressLabel || 'Enviando...'}</>) : 'Enviar Cadastro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
