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
  Users, 
  Mail, 
  Globe, 
  DollarSign, 
  Lock,
  Smartphone
} from 'lucide-react';

export default function ConfiguracoesTab({ userRole = 'admin' }) {
  const [activeSubTab, setActiveSubTab] = useState('empresa');
  const [savedSuccess, setSavedSuccess] = useState(false);

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
      // 1. Empresa & Unidades
      nomeEmpresa: 'Porto Terapia - Clínica de Psicologia',
      razaoSocial: 'Porto Terapia Clínica de Psicologia LTDA',
      cnpj: '12.345.678/0001-90',
      emailEmpresa: 'contato@portoterapia.com.br',
      telefone: '(91) 98888-7777',
      unidades: [
        {
          id: 'antonio-barreto',
          nome: 'Unidade Antônio Barreto',
          endereco: 'R. Antônio Barreto, 2050 - Fátima, Belém - PA, 66060-021',
          geofenceKm: 5
        },
        {
          id: 'generalissimo',
          nome: 'Unidade Generalíssimo',
          endereco: 'Av. Generalíssimo Deodoro, 564 - Nazaré, Belém - PA',
          geofenceKm: 5
        }
      ],

      // 2. Geofencing & Ponto Eletrônico
      geofencePadraoKm: 5,
      toleranciaAtrasoMinutos: 15,
      exigirBiometriaFacial: true,
      bloquearPontoForaDoRaio: true,

      // 3. Permissões de Acesso
      papeis: {
        admin: { verAuditoria: true, verFinanceiro: true, editarEstagiarios: true, emitirFolha: true },
        gestor: { verAuditoria: true, verFinanceiro: true, editarEstagiarios: true, emitirFolha: false },
        supervisor: { verAuditoria: false, verFinanceiro: false, editarEstagiarios: false, emitirFolha: false }
      },

      // 4. Notificações & Alertas
      notificarEmailAusencias: true,
      emailNotificacoes: 'rh@portoterapia.com.br',
      alertarContratoExpirandoDias: 30,
      alertarAniversariantesDoDia: true,

      // 5. Aparência & Preferências
      modoEscuro: false,
      formatoData: 'DD/MM/YYYY',
      itensPorPagina: 15,
      moeda: 'BRL'
    };
  });

  const handleSave = () => {
    localStorage.setItem('app_configuracoes', JSON.stringify(settings));
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
            Gerencie parâmetros gerais da instituição, cerca virtual, permissões de acesso e notificações.
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
                  Dados da Instituição
                </h2>
                <p className="text-xs text-slate-500 mt-1">Informações cadastrais utilizadas na geração de relatórios e documentos.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nome Fantasia</label>
                  <input
                    type="text"
                    value={settings.nomeEmpresa}
                    onChange={(e) => setSettings({ ...settings, nomeEmpresa: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Razão Social</label>
                  <input
                    type="text"
                    value={settings.razaoSocial}
                    onChange={(e) => setSettings({ ...settings, razaoSocial: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">CNPJ</label>
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

              {/* Unidades Cadastradas */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-md font-semibold text-slate-800 mb-3">Unidades / Lojas Cadastradas</h3>
                <div className="space-y-3">
                  {settings.unidades.map((unidade, idx) => (
                    <div key={unidade.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <span className="font-semibold text-slate-800 text-sm">{unidade.nome}</span>
                        <p className="text-xs text-slate-500">{unidade.endereco}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium border border-indigo-200">
                          Raio Geofence: {unidade.geofenceKm} km
                        </span>
                      </div>
                    </div>
                  ))}
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
                    Raio Padrão da Cerca Virtual (Km)
                  </label>
                  <p className="text-xs text-slate-500 mb-3">Distância máxima permitida em relação à unidade para registrar presença.</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.5"
                      min="0.1"
                      max="50"
                      value={settings.geofencePadraoKm}
                      onChange={(e) => setSettings({ ...settings, geofencePadraoKm: parseFloat(e.target.value) || 1 })}
                      className="w-32 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-sm font-semibold text-slate-600">km</span>
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
