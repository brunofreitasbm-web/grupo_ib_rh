import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck, FileText, UserCheck, AlertCircle, Building2, MapPin, CreditCard, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import { validateCPF } from '../utils/helpers';
import { FREELANCE_AUTONOMY_DECLARATION_TEXT, FREELANCE_AUTONOMY_DECLARATION_VERSION, FREELANCE_SERVICE_TYPES } from '../config/freelanceConstants';

const emptyForm = {
  unitId: '',
  name: '',
  cpf: '',
  birthdate: '',
  email: '',
  phone: '',
  enderecoCep: '',
  enderecoLogradouro: '',
  enderecoNumero: '',
  enderecoComplemento: '',
  enderecoBairro: '',
  enderecoCidade: 'Belém',
  enderecoUf: 'PA',
  serviceArea: 'Evento / festa pontual',
  bankName: '',
  bankAgency: '',
  bankAccount: '',
  bankAccountType: 'Conta Corrente',
  pixKey: '',
};

export default function FreelanceSelfRegistration({ units = [], branding, onCancel, onSuccessRedirect }) {
  const kioskUnits = (branding?.kioskUnits || []).length > 0
    ? branding.kioskUnits
    : units;

  const [form, setForm] = useState({
    ...emptyForm,
    unitId: kioskUnits[0]?.id || '',
  });

  const [autonomyAccepted, setAutonomyAccepted] = useState(false);
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdFreelancer, setCreatedFreelancer] = useState(null);
  const [errors, setErrors] = useState({});

  const set = (field) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const e = {};
    if (!form.unitId) e.unitId = 'Selecione a unidade do Grupo IB.';
    if (!form.name.trim()) e.name = 'Informe seu nome completo.';
    if (!validateCPF(form.cpf)) e.cpf = 'Informe um CPF válido.';
    if (!form.phone.trim()) e.phone = 'Informe seu telefone de contato / WhatsApp.';
    if (!form.serviceArea.trim()) e.serviceArea = 'Selecione sua área principal de atuação.';
    if (!autonomyAccepted) e.autonomy = 'É obrigatório declarar e aceitar o Termo de Autonomia.';
    if (!lgpdAccepted) e.lgpd = 'É necessário aceitar o consentimento de privacidade (LGPD).';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Por favor, preencha todos os campos obrigatórios corretamente.');
      return;
    }

    setSubmitting(true);
    try {
      const cleanCpf = form.cpf.replace(/\D/g, '');
      const validBirthdate = form.birthdate && form.birthdate.trim() !== '' ? form.birthdate : null;

      // Tenta via RPC SECURITY DEFINER primeiro
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_freelancer_self_registration', {
        p_unit_id: form.unitId,
        p_name: form.name.trim(),
        p_cpf: cleanCpf,
        p_birthdate: validBirthdate,
        p_email: form.email.trim() || null,
        p_phone: form.phone.trim() || null,
        p_endereco_cep: form.enderecoCep.trim() || null,
        p_endereco_logradouro: form.enderecoLogradouro.trim() || null,
        p_endereco_numero: form.enderecoNumero.trim() || null,
        p_endereco_complemento: form.enderecoComplemento.trim() || null,
        p_endereco_bairro: form.enderecoBairro.trim() || null,
        p_endereco_cidade: form.enderecoCidade.trim() || null,
        p_endereco_uf: form.enderecoUf.trim() || null,
        p_service_area: form.serviceArea,
        p_bank_name: form.bankName.trim() || null,
        p_bank_agency: form.bankAgency.trim() || null,
        p_bank_account: form.bankAccount.trim() || null,
        p_bank_account_type: form.bankAccountType,
        p_pix_key: form.pixKey.trim() || null,
        p_autonomy_declaration_accepted: true,
        p_autonomy_declaration_version: FREELANCE_AUTONOMY_DECLARATION_VERSION,
        p_lgpd_consent_accepted: true,
      });

      if (rpcError) {
        console.warn('RPC create_freelancer_self_registration indisponível ou erro:', rpcError.message);

        // Fallback: verifica se já existe registro com o CPF informado para fazer UPDATE ou INSERT
        const { data: existing } = await supabase
          .from('freelancers')
          .select('id')
          .eq('cpf', cleanCpf)
          .maybeSingle();

        const payload = {
          unit_id: form.unitId,
          name: form.name.trim(),
          birthdate: validBirthdate,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          endereco_cep: form.enderecoCep.trim() || null,
          endereco_logradouro: form.enderecoLogradouro.trim() || null,
          endereco_numero: form.enderecoNumero.trim() || null,
          endereco_complemento: form.enderecoComplemento.trim() || null,
          endereco_bairro: form.enderecoBairro.trim() || null,
          endereco_cidade: form.enderecoCidade.trim() || null,
          endereco_uf: form.enderecoUf.trim() || null,
          service_area: form.serviceArea,
          bank_name: form.bankName.trim() || null,
          bank_agency: form.bankAgency.trim() || null,
          bank_account: form.bankAccount.trim() || null,
          bank_account_type: form.bankAccountType,
          pix_key: form.pixKey.trim() || null,
          autonomy_declaration_accepted_at: new Date().toISOString(),
          autonomy_declaration_version: FREELANCE_AUTONOMY_DECLARATION_VERSION,
          lgpd_consent_accepted_at: new Date().toISOString(),
          active: true,
        };

        let directData = null;
        let directError = null;

        if (existing?.id) {
          const res = await supabase
            .from('freelancers')
            .update(payload)
            .eq('id', existing.id)
            .select()
            .single();
          directData = res.data;
          directError = res.error;
        } else {
          const res = await supabase
            .from('freelancers')
            .insert({ ...payload, cpf: cleanCpf })
            .select()
            .single();
          directData = res.data;
          directError = res.error;
        }

        if (directError) throw directError;
        setCreatedFreelancer(directData);
      } else {
        setCreatedFreelancer(rpcData);
      }

      setSuccess(true);
      toast.success('Cadastro de Freelancer concluído com sucesso!');
    } catch (err) {
      console.error('Erro ao cadastrar freelancer:', err);
      const userMessage = err?.message?.toLowerCase()?.includes('row-level security')
        ? 'A política de segurança da tabela de freelancers precisa ser atualizada no Supabase. Aplique a migração 20261008150000_fix_freelancer_self_reg_rls.sql.'
        : err?.message || 'Não foi possível concluir o cadastro. Verifique os dados e tente novamente.';
      toast.error(userMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedUnitName = kioskUnits.find((u) => u.id === form.unitId)?.name || form.unitId;

  if (success) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-xl border border-teal-100 my-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 size={38} />
          </div>
          <h2 className="text-2xl font-black text-gray-800">Cadastro de Freelancer Concluído!</h2>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            Seu cadastro como prestador autônomo pessoa física foi registrado com sucesso na unidade <strong className="text-teal-700">{selectedUnitName}</strong>.
          </p>

          <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4 text-left text-xs text-teal-900 space-y-2 my-4">
            <div className="flex items-center gap-2 font-bold text-sm text-teal-800 border-b border-teal-200 pb-2">
              <UserCheck size={18} /> Resumo do Registro
            </div>
            <div><strong>Nome:</strong> {form.name}</div>
            <div><strong>CPF:</strong> {form.cpf}</div>
            <div><strong>Área de Atuação:</strong> {form.serviceArea}</div>
            {form.pixKey && <div><strong>Chave PIX:</strong> {form.pixKey}</div>}
            <div><strong>Aceite Jurídico:</strong> Registrado eletronicamente (Declaração de Autonomia v{FREELANCE_AUTONOMY_DECLARATION_VERSION})</div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left text-xs text-amber-800 flex items-start gap-2">
            <ShieldCheck size={18} className="shrink-0 text-amber-600 mt-0.5" />
            <div>
              <strong>Próximo Passo no Local:</strong> Apresente seu CPF ao supervisor da operação para aceite e acompanhamento da sua Ordem de Serviço (OS) de hoje.
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
            {onSuccessRedirect && (
              <button
                type="button"
                onClick={onSuccessRedirect}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md text-sm flex items-center justify-center gap-2"
              >
                <Sparkles size={16} /> Acessar Minhas OS de Hoje
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 px-6 rounded-xl transition-all text-sm"
            >
              Voltar à Página Inicial
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 bg-white rounded-2xl shadow-xl border border-gray-100 my-4 sm:my-8">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-6">
        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          title="Voltar"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-teal-100 text-teal-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
              Cadastro Obrigatório
            </span>
            <span className="text-xs text-gray-400">Hub FaçaAmigos</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mt-0.5">Cadastrar como Freelancer (Autônomo PF)</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bloco 1: Unidade de Atuação */}
        <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-4 space-y-3">
          <label className="block text-xs font-bold text-teal-900 uppercase tracking-wide flex items-center gap-1.5">
            <Building2 size={16} className="text-teal-600" /> Unidade do Grupo IB *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {kioskUnits.map((ku) => (
              <button
                key={ku.id}
                type="button"
                onClick={() => set('unitId')(ku.id)}
                className={`p-3 rounded-lg border text-left text-xs font-semibold transition-all flex items-center justify-between ${
                  form.unitId === ku.id
                    ? 'border-teal-600 bg-teal-600 text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-teal-300'
                }`}
              >
                <span>{ku.name || ku.buttonLabel || ku.id}</span>
                {form.unitId === ku.id && <CheckCircle2 size={16} />}
              </button>
            ))}
          </div>
          {errors.unitId && <p className="text-xs text-rose-600 mt-1">{errors.unitId}</p>}
        </div>

        {/* Bloco 2: Dados Pessoais */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-1 flex items-center gap-1.5">
            <UserCheck size={16} className="text-teal-600" /> Dados Pessoais
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">Nome Completo *</label>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="Digite seu nome completo"
                className={`w-full p-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none ${
                  errors.name ? 'border-rose-400 bg-rose-50' : 'border-gray-300'
                }`}
              />
              {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">CPF *</label>
              <input
                type="text"
                value={form.cpf}
                onChange={set('cpf')}
                placeholder="000.000.000-00"
                className={`w-full p-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none ${
                  errors.cpf ? 'border-rose-400 bg-rose-50' : 'border-gray-300'
                }`}
              />
              {errors.cpf && <p className="text-xs text-rose-600 mt-1">{errors.cpf}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Telefone / WhatsApp *</label>
              <input
                type="text"
                value={form.phone}
                onChange={set('phone')}
                placeholder="(91) 99999-0000"
                className={`w-full p-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none ${
                  errors.phone ? 'border-rose-400 bg-rose-50' : 'border-gray-300'
                }`}
              />
              {errors.phone && <p className="text-xs text-rose-600 mt-1">{errors.phone}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="seu.email@exemplo.com"
                className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Data de Nascimento</label>
              <input
                type="date"
                value={form.birthdate}
                onChange={set('birthdate')}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Bloco 3: Área de Atuação */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles size={16} className="text-teal-600" /> Área Principal de Atuação / Serviço *
          </label>
          <select
            value={form.serviceArea}
            onChange={set('serviceArea')}
            className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium text-gray-800"
          >
            {FREELANCE_SERVICE_TYPES.map((st) => (
              <option key={st.key} value={st.label}>
                {st.label}
              </option>
            ))}
          </select>
        </div>

        {/* Bloco 4: Dados Bancários / PIX */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-1 flex items-center gap-1.5">
            <CreditCard size={16} className="text-teal-600" /> Pagamento (Dados Bancários / PIX para RPA)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-gray-700 mb-1">Chave PIX (Recomendado para recebimento)</label>
              <input
                type="text"
                value={form.pixKey}
                onChange={set('pixKey')}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Banco</label>
              <input
                type="text"
                value={form.bankName}
                onChange={set('bankName')}
                placeholder="Ex.: Nubank, Itaú, BB"
                className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Agência</label>
              <input
                type="text"
                value={form.bankAgency}
                onChange={set('bankAgency')}
                placeholder="0001"
                className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Conta Corrente / Poupança</label>
              <input
                type="text"
                value={form.bankAccount}
                onChange={set('bankAccount')}
                placeholder="12345-6"
                className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Bloco 5: Declaração Obrigatória de Autonomia (Segurança Jurídica) */}
        <div className="border border-teal-200 bg-teal-50/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-teal-900 font-bold text-xs uppercase tracking-wide">
            <ShieldCheck size={18} className="text-teal-700" /> Declaração Eletrônica de Autonomia (Obrigatória)
          </div>
          <div className="bg-white p-3 rounded-lg border border-teal-100 text-xs text-gray-700 max-h-32 overflow-y-auto space-y-2 leading-relaxed">
            <p>{FREELANCE_AUTONOMY_DECLARATION_TEXT}</p>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autonomyAccepted}
                onChange={(e) => {
                  setAutonomyAccepted(e.target.checked);
                  if (errors.autonomy) setErrors((prev) => ({ ...prev, autonomy: null }));
                }}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-xs font-semibold text-gray-800">
                Declaro que li e concordo com os termos da Declaração de Autonomia para prestação de serviços como trabalhador autônomo pessoa física por escopo. *
              </span>
            </label>
            {errors.autonomy && <p className="text-xs text-rose-600 pl-6">{errors.autonomy}</p>}

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={lgpdAccepted}
                onChange={(e) => {
                  setLgpdAccepted(e.target.checked);
                  if (errors.lgpd) setErrors((prev) => ({ ...prev, lgpd: null }));
                }}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-xs text-gray-600">
                Autorizo o tratamento dos meus dados pessoais fornecidos acima para emissão de Ordens de Serviço, RPA e escrituração fiscal/previdenciária (LGPD). *
              </span>
            </label>
            {errors.lgpd && <p className="text-xs text-rose-600 pl-6">{errors.lgpd}</p>}
          </div>
        </div>

        {/* Botão de envio */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Processando Cadastro...
              </>
            ) : (
              <>
                <CheckCircle2 size={18} /> Confirmar Cadastro Obrigatório
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold rounded-xl text-sm transition-all"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
