import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  ShieldCheck, 
  Bell, 
  Palette, 
  Save, 
  Check, 
  RefreshCw, 
  Sliders, 
  Upload,
  FileText,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon
} from 'lucide-react';
import { BRANDING } from '../../config/branding';
import { compressImage } from '../../utils/mappings';

export default function ConfiguracoesTab({ userRole = 'admin', units = [], onSaveUnit }) {
  const [activeSubTab, setActiveSubTab] = useState('empresa');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [expandedUnitId, setExpandedUnitId] = useState(null);
  const [editingUnits, setEditingUnits] = useState({});

  // Lista consolidada de unidades (branding + banco de dados)
  const availableUnits = units.length > 0 ? units : BRANDING.kioskUnits.map((ku) => ({
    id: ku.id,
    name: ku.buttonLabel || ku.name,
    razaoSocial: ku.razaoSocial || BRANDING.legalEntityName,
    cnpj: ku.cnpj || BRANDING.cnpj,
    address: ku.address || '',
    phone: ku.phone || BRANDING.phone,
    logoUrl: ku.logoPath || '',
    tceCustomText: '',
    paeCustomText: '',
    declaracaoCustomText: '',
    fichaCustomText: '',
    radiusM: 5000
  }));

  useEffect(() => {
    const unitMap = {};
    availableUnits.forEach(u => {
      unitMap[u.id] = {
        id: u.id,
        name: u.name || u.nome || u.buttonLabel || '',
        razaoSocial: u.razaoSocial || u.razao_social || BRANDING.legalEntityName,
        cnpj: u.cnpj || BRANDING.cnpj,
        address: u.address || u.endereco || '',
        phone: u.phone || BRANDING.phone,
        logoUrl: u.logoUrl || u.logo_url || BRANDING.logoPath || '',
        tceCustomText: u.tceCustomText || u.tce_custom_text || '',
        paeCustomText: u.paeCustomText || u.pae_custom_text || '',
        declaracaoCustomText: u.declaracaoCustomText || u.declaracao_custom_text || '',
        fichaCustomText: u.fichaCustomText || u.ficha_custom_text || '',
        radiusM: u.radiusM || 5000
      };
    });
    setEditingUnits(unitMap);
  }, [units]);

  // Default Settings State
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('app_configuracoes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Erro ao carregar configurações salvas', e);
      }
    }
    return {
      nomeEmpresa: BRANDING.displayName,
      razaoSocial: BRANDING.legalEntityName,
      cnpj: BRANDING.cnpj,
      emailEmpresa: BRANDING.contactEmail,
      telefone: BRANDING.phone,
      geofencePadraoM: 5000,
      toleranciaAtrasoMinutos: 15,
      exigirBiometriaFacial: true,
      bloquearPontoForaDoRaio: true,
      papeis: {
        admin: { verAuditoria: true, verFinanceiro: true, editarEstagiarios: true, emitirFolha: true },
        gestor: { verAuditoria: true, verFinanceiro: true, editarEstagiarios: true, emitirFolha: false },
        supervisor: { verAuditoria: false, verFinanceiro: false, editarEstagiarios: false, emitirFolha: false }
      },
      notificarEmailAusencias: true,
      emailNotificacoes: BRANDING.rhEmail,
      alertarContratoExpirandoDias: 30,
      alertarAniversariantesDoDia: true,
      backupIntervalo: 'semanal',
      emailBackup: BRANDING.rhEmail,
      modoEscuro: false,
      formatoData: 'DD/MM/YYYY',
      itensPorPagina: 15,
      moeda: 'BRL'
    };
  });

  const handleUnitFieldChange = (unitId, field, value) => {
    setEditingUnits(prev => ({
      ...prev,
      [unitId]: {
        ...prev[unitId],
        [field]: value
      }
    }));
  };

  const handleLogoUpload = async (unitId, file) => {
    if (!file) return;
    try {
      const base64 = await compressImage(file, 600, 400, 0.85);
      handleUnitFieldChange(unitId, 'logoUrl', base64);
    } catch (err) {
      console.error('Erro ao processar imagem de logo:', err);
      alert('Não foi possível carregar a imagem. Tente uma imagem menor ou formato JPEG/PNG.');
    }
  };

  const handleSaveSingleUnit = (unitId) => {
    const unitData = editingUnits[unitId];
    if (unitData && onSaveUnit) {
      onSaveUnit(unitData);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } else {
      localStorage.setItem(`unit_config_${unitId}`, JSON.stringify(unitData));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  const handleSave = () => {
    localStorage.setItem('app_configuracoes', JSON.stringify(settings));
    // Salva também todas as unidades
    Object.values(editingUnits).forEach(uData => {
      if (onSaveUnit) {
        onSaveUnit(uData);
      } else {
        localStorage.setItem(`unit_config_${uData.id}`, JSON.stringify(uData));
      }
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleReset = () => {
    if (window.confirm('Deseja restaurar as configurações padrão?')) {
      localStorage.removeItem('app_configuracoes');
      window.location.reload();
    }
  };

  const menuItems = [
    { id: 'empresa', label: 'Empresa & Unidades', icon: Building2 },
    { id: 'geofence', label: 'Geofencing & Ponto', icon: MapPin },
    { id: 'permissoes', label: 'Permissões & Acessos', icon: ShieldCheck },
    { id: 'notificacoes', label: 'Notificações & Alertas', icon: Bell },
    { id: 'aparencia', label: 'Aparência & Preferências', icon: Palette }
  ];

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Header da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Sliders className="w-7 h-7 text-indigo-600" />
            Configurações do Sistema
          </h1>
          <p className="text-sm text-slate-500">
            Gerencie parâmetros gerais da instituição, unidades, timbres visuais, cerca virtual e notificações.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Restaurar Padrão
          </button>
          <button
            onClick={handleSave}
            className={`px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-all flex items-center gap-2 ${
              savedSuccess ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" />
                Salvo com Sucesso!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Alterações
              </>
            )}
          </button>
        </div>
      </div>

      {/* Conteúdo Principal Layout 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Menu Lateral da Tab Configurações */}
        <div className="lg:col-span-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSubTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSubTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Painel de Conteúdo */}
        <div className="lg:col-span-9 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          {/* 1. EMPRESA & UNIDADES */}
          {activeSubTab === 'empresa' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  Dados da Instituição (Workspace Geral)
                </h2>
                <p className="text-xs text-slate-500 mt-1">Informações cadastrais gerais do grupo/workspace. Cada unidade abaixo pode possuir seus próprios dados específicos.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nome Fantasia do Grupo</label>
                  <input
                    type="text"
                    value={settings.nomeEmpresa}
                    onChange={(e) => setSettings({ ...settings, nomeEmpresa: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Razão Social Geral</label>
                  <input
                    type="text"
                    value={settings.razaoSocial}
                    onChange={(e) => setSettings({ ...settings, razaoSocial: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">CNPJ Principal</label>
                  <input
                    type="text"
                    value={settings.cnpj}
                    onChange={(e) => setSettings({ ...settings, cnpj: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">E-mail Principal</label>
                  <input
                    type="email"
                    value={settings.emailEmpresa}
                    onChange={(e) => setSettings({ ...settings, emailEmpresa: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Unidades Cadastradas com Personalização Completa */}
              <div className="pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-600" /> Unidades Cadastradas, Timbres & Documentos
                    </h3>
                    <p className="text-xs text-slate-500">Configure CNPJ, endereço, telefone, logo do timbre e modelos de documento individualizados por unidade.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {Object.values(editingUnits).map((uData) => {
                    const isExpanded = expandedUnitId === uData.id;
                    return (
                      <div key={uData.id} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all">
                        {/* Header do Card da Unidade */}
                        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            {uData.logoUrl ? (
                              <img src={uData.logoUrl} alt={uData.name} className="w-10 h-10 object-contain rounded border border-slate-200 p-0.5 bg-white" />
                            ) : (
                              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm border border-indigo-100">
                                {uData.name ? uData.name.substring(0, 2).toUpperCase() : 'UN'}
                              </div>
                            )}
                            <div>
                              <span className="font-bold text-slate-800 text-sm block">{uData.name}</span>
                              <p className="text-xs text-slate-500">
                                {uData.razaoSocial || 'Razão Social pendente'} • CNPJ: {uData.cnpj || 'Não informado'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setExpandedUnitId(isExpanded ? null : uData.id)}
                              className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              {isExpanded ? 'Recolher Configurações' : 'Editar Unidade & Timbre'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveSingleUnit(uData.id)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-1"
                            >
                              <Save className="w-3.5 h-3.5" /> Salvar Unidade
                            </button>
                          </div>
                        </div>

                        {/* Formulário Expansível por Unidade */}
                        {isExpanded && (
                          <div className="p-5 space-y-6 bg-slate-50">
                            {/* 1. Dados Cadastrais da Unidade */}
                            <div>
                              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-slate-200 pb-1">
                                <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Dados Cadastrais da Unidade
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Nome da Unidade</label>
                                  <input
                                    type="text"
                                    value={uData.name}
                                    onChange={(e) => handleUnitFieldChange(uData.id, 'name', e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Razão Social da Unidade</label>
                                  <input
                                    type="text"
                                    value={uData.razaoSocial}
                                    onChange={(e) => handleUnitFieldChange(uData.id, 'razaoSocial', e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Ex: Empresa Exemplo LTDA"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">CNPJ da Unidade</label>
                                  <input
                                    type="text"
                                    value={uData.cnpj}
                                    onChange={(e) => handleUnitFieldChange(uData.id, 'cnpj', e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                                    placeholder="00.000.000/0000-00"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Telefone da Unidade</label>
                                  <input
                                    type="text"
                                    value={uData.phone}
                                    onChange={(e) => handleUnitFieldChange(uData.id, 'phone', e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                                    placeholder="(00) 00000-0000"
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Endereço Completo</label>
                                  <input
                                    type="text"
                                    value={uData.address}
                                    onChange={(e) => handleUnitFieldChange(uData.id, 'address', e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Rua, Número, Bairro, Cidade - UF, CEP"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* 2. Timbre Visual & Logotipo da Unidade */}
                            <div>
                              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-slate-200 pb-1">
                                <ImageIcon className="w-3.5 h-3.5 text-indigo-600" /> Logotipo & Timbre Visual da Unidade (Cabeçalho de Documentos)
                              </h4>
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white p-3 border border-slate-200 rounded-lg">
                                {uData.logoUrl ? (
                                  <div className="relative group">
                                    <img src={uData.logoUrl} alt="Timbre Unidade" className="h-16 w-32 object-contain border border-slate-300 rounded p-1 bg-slate-50" />
                                    <button
                                      type="button"
                                      onClick={() => handleUnitFieldChange(uData.id, 'logoUrl', '')}
                                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 text-[10px] shadow hover:bg-red-700"
                                      title="Remover logotipo"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div className="h-16 w-32 border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-slate-400 text-[10px] bg-slate-50">
                                    <ImageIcon className="w-5 h-5 mb-1 text-slate-300" />
                                    Sem Timbre
                                  </div>
                                )}

                                <div className="space-y-2 flex-1 w-full">
                                  <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer transition-colors shadow-sm">
                                    <Upload className="w-3.5 h-3.5 text-indigo-600" /> Upload Imagem de Timbre/Logo
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handleLogoUpload(uData.id, e.target.files[0])}
                                      className="hidden"
                                    />
                                  </label>
                                  <p className="text-[10px] text-slate-400">Suporta arquivos JPG ou PNG. Recomendado: imagem retangular com fundo transparente ou branco.</p>
                                  <input
                                    type="text"
                                    value={uData.logoUrl}
                                    onChange={(e) => handleUnitFieldChange(uData.id, 'logoUrl', e.target.value)}
                                    placeholder="Ou insira a URL da imagem de timbre..."
                                    className="w-full px-2.5 py-1 text-[11px] border border-slate-200 rounded bg-slate-50 text-slate-600 focus:bg-white"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* 3. Modelos & Cláusulas Específicas da Unidade */}
                            <div>
                              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-slate-200 pb-1">
                                <FileText className="w-3.5 h-3.5 text-indigo-600" /> Modelos & Cláusulas Customizadas por Unidade
                              </h4>
                              <p className="text-[11px] text-slate-500 mb-3">Caso esta unidade exija cláusulas ou observações específicas nos documentos, preencha os campos abaixo (se deixar em branco, o sistema utilizará as cláusulas padrão):</p>
                              
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Cláusulas / Observações Específicas do TCE (Termo de Compromisso)</label>
                                  <textarea
                                    rows={2}
                                    value={uData.tceCustomText}
                                    onChange={(e) => handleUnitFieldChange(uData.id, 'tceCustomText', e.target.value)}
                                    placeholder="Insira cláusulas aditivas ou regras específicas para contratos nesta unidade..."
                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Observações do PAE (Plano de Atividades de Estágio)</label>
                                  <textarea
                                    rows={2}
                                    value={uData.paeCustomText}
                                    onChange={(e) => handleUnitFieldChange(uData.id, 'paeCustomText', e.target.value)}
                                    placeholder="Insira diretrizes de atividades específicas para esta unidade..."
                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Texto Adicional para Declaração de Vínculo</label>
                                  <textarea
                                    rows={2}
                                    value={uData.declaracaoCustomText}
                                    onChange={(e) => handleUnitFieldChange(uData.id, 'declaracaoCustomText', e.target.value)}
                                    placeholder="Insira observações institucionais adicionais para declarações emitidas nesta unidade..."
                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Observações para Ficha Cadastral</label>
                                  <textarea
                                    rows={2}
                                    value={uData.fichaCustomText}
                                    onChange={(e) => handleUnitFieldChange(uData.id, 'fichaCustomText', e.target.value)}
                                    placeholder="Regras ou termos de ciência internos da ficha cadastral nesta unidade..."
                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="pt-3 border-t border-slate-200 flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleSaveSingleUnit(uData.id)}
                                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow transition-colors flex items-center gap-1.5"
                              >
                                <Save className="w-4 h-4" /> Salvar Alterações da Unidade {uData.name}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 2. GEOFENCING & PONTO ELETRÔNICO */}
          {activeSubTab === 'geofence' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-indigo-600" />
                  Geolocalização & Controle de Ponto
                </h2>
                <p className="text-xs text-slate-500 mt-1">Configure o raio de validação do GPS e exigências biométricas.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Raio Padrão da Cerca Virtual (m)
                  </label>
                  <p className="text-xs text-slate-500 mb-3">Distância máxima permitida em relação à unidade para registrar presença.</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="50"
                      value={settings.geofencePadraoM || (settings.geofencePadraoKm ? Math.min(50, settings.geofencePadraoKm * 1000) : 15)}
                      onChange={(e) => setSettings({ ...settings, geofencePadraoM: Math.min(50, Math.max(1, parseInt(e.target.value) || 15)) })}
                      className="w-32 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-sm font-semibold text-slate-600">m</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Tolerância de Atraso (Minutos)
                  </label>
                  <p className="text-xs text-slate-500 mb-3">Minutos tolerados sem marcar ocorrência de atraso no relatório de frequência.</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={settings.toleranciaAtrasoMinutos}
                      onChange={(e) => setSettings({ ...settings, toleranciaAtrasoMinutos: parseInt(e.target.value) || 0 })}
                      className="w-32 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-sm font-semibold text-slate-600">minutos</span>
                  </div>
                </div>
              </div>

              {/* Switches de Comportamento */}
              <div className="space-y-4 pt-2">
                <label className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <div>
                    <span className="text-sm font-semibold text-slate-800">Exigir Validação Facial por Foto</span>
                    <p className="text-xs text-slate-500">Exige captura de foto/biometria facial no ato da marcação do ponto.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.exigirBiometriaFacial}
                    onChange={(e) => setSettings({ ...settings, exigirBiometriaFacial: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <div>
                    <span className="text-sm font-semibold text-slate-800">Bloquear Ponto Fora do Raio</span>
                    <p className="text-xs text-slate-500">Impede o envio da marcação se a distância for maior que a configurada.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.bloquearPontoForaDoRaio}
                    onChange={(e) => setSettings({ ...settings, bloquearPontoForaDoRaio: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                </label>

                {/* Painel Informativo da Restrição Vigente */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                      Restrição de Acesso ao Ponto Vigente (Unidades com Biometria Obrigatória)
                    </h4>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      A modalidade de autenticação por senha (PIN/Credential) ou contingência manual foi <strong>desativada com efeito imediato</strong> para o perfil de estagiários nas unidades com biometria obrigatória (ver tabela de unidades). O registro de presença exige <strong>100% de validação por Biometria Facial e Geolocalização (GPS)</strong> sem fallback por senha.
                    </p>
                  </div>
                </div>

                {/* Painel de Backups de Segurança */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 pt-4 mt-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">💾 Backup & Recuperação de Dados</h3>
                  <p className="text-xs text-slate-500">Exporte ou agende cópias de segurança de todos os cadastros e registros de ponto do sistema.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Backup Programado (Periódico)</label>
                      <select
                        value={settings.backupIntervalo || 'semanal'}
                        onChange={(e) => setSettings({ ...settings, backupIntervalo: e.target.value })}
                        className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="desativado">Desativado</option>
                        <option value="diario">Diário</option>
                        <option value="semanal">Semanal</option>
                        <option value="mensal">Mensal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail de Destino do Backup</label>
                      <input
                        type="email"
                        placeholder="Ex: backup@empresa.com"
                        value={settings.emailBackup || settings.emailNotificacoes || ''}
                        onChange={(e) => setSettings({ ...settings, emailBackup: e.target.value })}
                        className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (window.handleManualBackupTrigger) {
                          window.handleManualBackupTrigger();
                        } else {
                          alert('Função de backup indisponível no momento.');
                        }
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow transition-colors"
                    >
                      Fazer Backup Manual Agora (Download JSON)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. PERMISSÕES & ACESSOS */}
          {activeSubTab === 'permissoes' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  Matriz de Permissões por Perfil
                </h2>
                <p className="text-xs text-slate-500 mt-1">Configure o nível de acesso e visibilidade das abas do sistema.</p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-semibold">
                    <tr>
                      <th className="p-3">Recurso / Módulo</th>
                      <th className="p-3 text-center">Administrador</th>
                      <th className="p-3 text-center">Gestor</th>
                      <th className="p-3 text-center">Supervisor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    <tr>
                      <td className="p-3 font-medium">Ver Auditoria de Registros</td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={settings.papeis.admin.verAuditoria}
                          onChange={(e) => setSettings({
                            ...settings,
                            papeis: { ...settings.papeis, admin: { ...settings.papeis.admin, verAuditoria: e.target.checked } }
                          })}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={settings.papeis.gestor.verAuditoria}
                          onChange={(e) => setSettings({
                            ...settings,
                            papeis: { ...settings.papeis, gestor: { ...settings.papeis.gestor, verAuditoria: e.target.checked } }
                          })}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={settings.papeis.supervisor.verAuditoria}
                          onChange={(e) => setSettings({
                            ...settings,
                            papeis: { ...settings.papeis, supervisor: { ...settings.papeis.supervisor, verAuditoria: e.target.checked } }
                          })}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                      </td>
                    </tr>

                    <tr>
                      <td className="p-3 font-medium">Acesso ao Módulo Financeiro</td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={settings.papeis.admin.verFinanceiro}
                          onChange={(e) => setSettings({
                            ...settings,
                            papeis: { ...settings.papeis, admin: { ...settings.papeis.admin, verFinanceiro: e.target.checked } }
                          })}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={settings.papeis.gestor.verFinanceiro}
                          onChange={(e) => setSettings({
                            ...settings,
                            papeis: { ...settings.papeis, gestor: { ...settings.papeis.gestor, verFinanceiro: e.target.checked } }
                          })}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={settings.papeis.supervisor.verFinanceiro}
                          onChange={(e) => setSettings({
                            ...settings,
                            papeis: { ...settings.papeis, supervisor: { ...settings.papeis.supervisor, verFinanceiro: e.target.checked } }
                          })}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                      </td>
                    </tr>

                    <tr>
                      <td className="p-3 font-medium">Emitir Folha de Pagamento (PDF)</td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={settings.papeis.admin.emitirFolha}
                          onChange={(e) => setSettings({
                            ...settings,
                            papeis: { ...settings.papeis, admin: { ...settings.papeis.admin, emitirFolha: e.target.checked } }
                          })}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={settings.papeis.gestor.emitirFolha}
                          onChange={(e) => setSettings({
                            ...settings,
                            papeis: { ...settings.papeis, gestor: { ...settings.papeis.gestor, emitirFolha: e.target.checked } }
                          })}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={settings.papeis.supervisor.emitirFolha}
                          onChange={(e) => setSettings({
                            ...settings,
                            papeis: { ...settings.papeis, supervisor: { ...settings.papeis.supervisor, emitirFolha: e.target.checked } }
                          })}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. NOTIFICAÇÕES & ALERTAS */}
          {activeSubTab === 'notificacoes' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-indigo-600" />
                  Notificações & Alertas Automáticos
                </h2>
                <p className="text-xs text-slate-500 mt-1">Defina quando e como o sistema deve alertar os gestores.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">E-mail para Recebimento de Alertas</label>
                  <input
                    type="email"
                    value={settings.emailNotificacoes}
                    onChange={(e) => setSettings({ ...settings, emailNotificacoes: e.target.value })}
                    className="w-full md:w-1/2 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <label className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <div>
                      <span className="text-sm font-semibold text-slate-800">Notificar Ausências Não Justificadas</span>
                      <p className="text-xs text-slate-500">Enviar aviso por e-mail quando estagiário faltar sem justificativa cadastrada.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notificarEmailAusencias}
                      onChange={(e) => setSettings({ ...settings, notificarEmailAusencias: e.target.checked })}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <div>
                      <span className="text-sm font-semibold text-slate-800">Alertar Aniversariantes do Dia</span>
                      <p className="text-xs text-slate-500">Exibir notificação em destaque no Dashboard no dia do aniversário do estagiário.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.alertarAniversariantesDoDia}
                      onChange={(e) => setSettings({ ...settings, alertarAniversariantesDoDia: e.target.checked })}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 5. APARÊNCIA & PREFERÊNCIAS */}
          {activeSubTab === 'aparencia' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <Palette className="w-5 h-5 text-indigo-600" />
                  Aparência & Preferências do Sistema
                </h2>
                <p className="text-xs text-slate-500 mt-1">Ajuste formatos de exibição e preferências regionais.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Formato de Data</label>
                  <select
                    value={settings.formatoData}
                    onChange={(e) => setSettings({ ...settings, formatoData: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="DD/MM/YYYY">DD/MM/AAAA (ex: 21/07/2026)</option>
                    <option value="YYYY-MM-DD">AAAA-MM-DD (ex: 2026-07-21)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Itens por Página nas Tabelas</label>
                  <select
                    value={settings.itensPorPagina}
                    onChange={(e) => setSettings({ ...settings, itensPorPagina: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value={10}>10 itens</option>
                    <option value={15}>15 itens</option>
                    <option value={25}>25 itens</option>
                    <option value={50}>50 itens</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
