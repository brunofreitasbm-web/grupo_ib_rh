import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  UserPlus,
  KeyRound,
  Pencil,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Search,
  RefreshCw,
  X,
  Copy,
  Check,
  AlertTriangle,
  History,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../supabase';
import { BRANDING } from '../../config/branding';
import {
  availableSystemRoles,
  availablePermissionGroups,
  getRoleMeta,
  PERMISSION_PRESETS,
  KIOSK_ROLE_SCOPE,
  WORKSPACE_SCOPE_OPTIONS,
  permissionsToMap,
  permissionsToList,
  countGrantedPermissions,
} from '../../config/permissions';

// Cores por papel — escritas por extenso para o scanner JIT do Tailwind
// (mesmo motivo do KIOSK_ACCENT_CLASSES em App.jsx).
const ROLE_BADGE = {
  supervisor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  intern_unit: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  professional_unit: 'bg-amber-100 text-amber-700 border-amber-200',
  employee_unit: 'bg-rose-100 text-rose-700 border-rose-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
};

const AUDIT_LABEL = {
  create: 'Conta criada',
  update: 'Dados/permissões alterados',
  reset_password: 'Senha redefinida',
  disable: 'Acesso desativado',
  enable: 'Acesso reativado',
  delete: 'Conta excluída',
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

// Senha provisória legível: o supervisor precisa ditar/copiar isso para a
// pessoa, então nada de caracteres ambíguos (0/O, 1/l/I).
const generatePassword = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  buf.forEach((n) => { out += chars[n % chars.length]; });
  return out;
};

const emptyForm = {
  id: null,
  name: '',
  email: '',
  role: 'supervisor',
  unitId: '',
  workspaceScope: [BRANDING.id],
  permissions: [],
  notes: '',
  password: '',
};

export default function UsuariosSistema({ units = [], currentUserId = null }) {
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');
  const [showAudit, setShowAudit] = useState(false);

  const [form, setForm] = useState(null);           // null = modal fechado
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [revealPassword, setRevealPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const roles = useMemo(() => availableSystemRoles(), []);
  const permissionGroups = useMemo(() => availablePermissionGroups(), []);

  const unitName = useCallback(
    (unitId) => units.find((u) => u.id === unitId)?.name || unitId || '—',
    [units]
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase.rpc('list_system_users');
      if (err) throw err;
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao listar usuários do sistema:', err);
      // A migração da seção 21 pode ainda não ter sido aplicada no banco.
      setError(
        /function .* does not exist|schema cache/i.test(String(err?.message || ''))
          ? 'As funções de gestão de usuários ainda não foram aplicadas no banco. Rode a seção 21 do supabase_schema.sql no SQL Editor do Supabase.'
          : (err?.message || 'Não foi possível carregar os usuários.')
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const { data, error: err } = await supabase.rpc('list_system_user_audit', { p_limit: 100 });
      if (err) throw err;
      setAudit(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao carregar auditoria de usuários:', err);
      setAudit([]);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { if (showAudit) loadAudit(); }, [showAudit, loadAudit]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'todos' && u.role !== roleFilter) return false;
      if (!q) return true;
      return [u.name, u.email, unitName(u.unit_id)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [users, search, roleFilter, unitName]);

  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter((u) => u.role === 'supervisor').length,
    kiosks: users.filter((u) => u.role !== 'supervisor').length,
    disabled: users.filter((u) => u.disabled).length,
  }), [users]);

  // --- Ações -------------------------------------------------------------

  const openCreate = () => {
    setRevealPassword(false);
    setCopied(false);
    setForm({ ...emptyForm, password: generatePassword() });
  };

  const openEdit = (user) => {
    setRevealPassword(false);
    setCopied(false);
    setForm({
      id: user.id,
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'supervisor',
      unitId: user.unit_id || '',
      workspaceScope: Array.isArray(user.workspace_scope) ? user.workspace_scope : [],
      permissions: permissionsToList(user.permissions),
      notes: user.notes || '',
      password: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const roleMeta = getRoleMeta(form.role);

    if (!form.name.trim()) return toast.error('Informe o nome da conta.');
    if (!form.id && !form.email.trim()) return toast.error('Informe o e-mail de login.');
    if (roleMeta.requiresUnit && !form.unitId) return toast.error('Selecione a unidade desta conta de quiosque.');
    if (!form.id && (form.password || '').length < 8) return toast.error('A senha provisória precisa ter ao menos 8 caracteres.');
    if (form.workspaceScope.length === 0) return toast.error('Selecione ao menos um escopo de workspace.');

    setSaving(true);
    try {
      if (form.id) {
        const { error: err } = await supabase.rpc('update_system_user', {
          p_user_id: form.id,
          p_name: form.name.trim(),
          p_role: form.role,
          p_unit_id: roleMeta.requiresUnit ? form.unitId : null,
          p_workspace_scope: form.workspaceScope,
          p_permissions: permissionsToMap(form.permissions),
          p_notes: form.notes || null,
        });
        if (err) throw err;
        toast.success('Usuário atualizado.');
      } else {
        const { error: err } = await supabase.rpc('create_system_user', {
          p_email: form.email.trim().toLowerCase(),
          p_password: form.password,
          p_name: form.name.trim(),
          p_role: form.role,
          p_unit_id: roleMeta.requiresUnit ? form.unitId : null,
          p_workspace_scope: form.workspaceScope,
          p_permissions: permissionsToMap(form.permissions),
          p_notes: form.notes || null,
        });
        if (err) throw err;
        toast.success('Usuário criado. Entregue a senha provisória com segurança.');
      }
      setForm(null);
      await loadUsers();
      if (showAudit) loadAudit();
    } catch (err) {
      console.error('Erro ao salvar usuário do sistema:', err);
      toast.error(err?.message || 'Não foi possível salvar o usuário.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if ((resetPassword || '').length < 8) {
      return toast.error('A nova senha precisa ter ao menos 8 caracteres.');
    }
    setSaving(true);
    try {
      const { error: err } = await supabase.rpc('reset_system_user_password', {
        p_user_id: resetTarget.id,
        p_new_password: resetPassword,
      });
      if (err) throw err;
      toast.success(`Senha de ${resetTarget.name} redefinida.`);
      setResetTarget(null);
      setResetPassword('');
      if (showAudit) loadAudit();
    } catch (err) {
      console.error('Erro ao resetar senha:', err);
      toast.error(err?.message || 'Não foi possível redefinir a senha.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user) => {
    const activating = user.disabled;
    const question = activating
      ? `Reativar o acesso de ${user.name}?`
      : `Desativar o acesso de ${user.name}? As sessões abertas serão encerradas imediatamente.`;
    if (!window.confirm(question)) return;

    try {
      const { error: err } = await supabase.rpc('set_system_user_active', {
        p_user_id: user.id,
        p_active: activating,
      });
      if (err) throw err;
      toast.success(activating ? 'Acesso reativado.' : 'Acesso desativado.');
      await loadUsers();
      if (showAudit) loadAudit();
    } catch (err) {
      console.error('Erro ao alterar status do usuário:', err);
      toast.error(err?.message || 'Não foi possível alterar o status.');
    }
  };

  const handleDelete = async (user) => {
    const typed = window.prompt(
      `Excluir DEFINITIVAMENTE a conta de ${user.name} (${user.email})?\n\n` +
      'Prefira desativar o acesso — a exclusão é irreversível e remove o vínculo de autoria dos registros feitos por esta conta.\n\n' +
      'Para confirmar, digite EXCLUIR:'
    );
    if (typed !== 'EXCLUIR') return;

    try {
      const { error: err } = await supabase.rpc('delete_system_user', { p_user_id: user.id });
      if (err) throw err;
      toast.success('Conta excluída.');
      await loadUsers();
      if (showAudit) loadAudit();
    } catch (err) {
      console.error('Erro ao excluir usuário:', err);
      toast.error(err?.message || 'Não foi possível excluir a conta.');
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(form.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie manualmente.');
    }
  };

  const togglePermission = (id) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(id)
        ? prev.permissions.filter((p) => p !== id)
        : [...prev.permissions, id],
    }));
  };

  const toggleWorkspace = (id) => {
    setForm((prev) => ({
      ...prev,
      // 'all' é exclusivo: marcar "todos" limpa os escopos específicos.
      workspaceScope: id === 'all'
        ? (prev.workspaceScope.includes('all') ? [] : ['all'])
        : (prev.workspaceScope.includes(id)
            ? prev.workspaceScope.filter((w) => w !== id)
            : [...prev.workspaceScope.filter((w) => w !== 'all'), id]),
    }));
  };

  const formRoleMeta = form ? getRoleMeta(form.role) : null;

  // --- Render ------------------------------------------------------------

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Usuários do Sistema
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Contas que fazem login no painel administrativo e nos quiosques das unidades.
            Contas nominais de estagiário continuam sendo criadas na aba Estagiários.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAudit((v) => !v)}
            className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            {showAudit ? 'Ocultar auditoria' : 'Auditoria'}
          </button>
          <button
            onClick={loadUsers}
            className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Novo Usuário
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">{error}</p>
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Contas totais', value: stats.total, color: 'text-slate-800' },
          { label: 'Administradores', value: stats.admins, color: 'text-indigo-600' },
          { label: 'Quiosques', value: stats.kiosks, color: 'text-emerald-600' },
          { label: 'Desativadas', value: stats.disabled, color: 'text-rose-600' },
        ].map((card) => (
          <div key={card.label} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-xs font-semibold text-slate-500 uppercase">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou unidade..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="todos">Todos os papéis</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Carregando contas...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              {users.length === 0 ? 'Nenhuma conta encontrada.' : 'Nenhuma conta corresponde ao filtro.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-semibold">
                <tr>
                  <th className="p-3">Usuário</th>
                  <th className="p-3">Papel</th>
                  <th className="p-3">Unidade / Escopo</th>
                  <th className="p-3 text-center">Permissões</th>
                  <th className="p-3">Último acesso</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((u) => {
                  const meta = getRoleMeta(u.role);
                  const isSelf = u.id === currentUserId;
                  return (
                    <tr key={u.id} className={`hover:bg-slate-50 ${u.disabled ? 'opacity-60' : ''}`}>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800 flex items-center gap-2">
                          {u.name}
                          {isSelf && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded">
                              VOCÊ
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-md border ${ROLE_BADGE[u.role] || ROLE_BADGE.slate}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 text-xs">
                        {meta.requiresUnit ? (
                          unitName(u.unit_id)
                        ) : (
                          <span>
                            {(u.workspace_scope || []).includes('all')
                              ? 'Todos os workspaces'
                              : (u.workspace_scope || []).join(', ') || '—'}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {meta.requiresUnit ? (
                          <span className="text-xs text-slate-400">n/a</span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-700 rounded-md">
                            {countGrantedPermissions(u.permissions)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-slate-500">{formatDateTime(u.last_sign_in_at)}</td>
                      <td className="p-3 text-center">
                        {u.disabled ? (
                          <span className="px-2 py-1 text-xs font-semibold bg-rose-100 text-rose-700 rounded-md">
                            Desativado
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-md">
                            Ativo
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(u)}
                            title="Editar dados e permissões"
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setResetTarget(u); setResetPassword(generatePassword()); setRevealPassword(true); }}
                            title="Redefinir senha"
                            className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(u)}
                            disabled={isSelf}
                            title={isSelf ? 'Você não pode desativar a própria conta' : (u.disabled ? 'Reativar acesso' : 'Desativar acesso')}
                            className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {u.disabled ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={isSelf}
                            title={isSelf ? 'Você não pode excluir a própria conta' : 'Excluir conta'}
                            className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Auditoria */}
      {showAudit && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-100 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-700">Trilha de auditoria (últimas 100 ações)</h3>
          </div>
          {audit.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">Nenhuma ação registrada ainda.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {audit.map((a) => (
                <div key={a.id} className="px-4 py-3 text-sm flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xs text-slate-400 font-mono">{formatDateTime(a.created_at)}</span>
                  <span className="font-semibold text-slate-700">{AUDIT_LABEL[a.action] || a.action}</span>
                  <span className="text-slate-500">— {a.target_email || '(conta removida)'}</span>
                  <span className="text-xs text-slate-400">por {a.actor_email || 'sistema'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: criar/editar */}
      {form && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {form.id ? <Pencil className="w-5 h-5 text-blue-600" /> : <UserPlus className="w-5 h-5 text-blue-600" />}
                {form.id ? 'Editar Usuário' : 'Novo Usuário do Sistema'}
              </h3>
              <button onClick={() => setForm(null)} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nome *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Ex.: Maria Souza"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">E-mail de login *</label>
                  <input
                    type="email"
                    value={form.email}
                    disabled={!!form.id}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                    placeholder="maria@grupoib.com.br"
                  />
                  {form.id && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      O e-mail é a identidade do login e não pode ser alterado aqui.
                    </p>
                  )}
                </div>
              </div>

              {/* Papel */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Papel *</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {roles.map((r) => (
                    <label
                      key={r.id}
                      className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                        form.role === r.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        checked={form.role === r.id}
                        onChange={() => setForm({ ...form, role: r.id, unitId: r.requiresUnit ? form.unitId : '' })}
                        className="mt-1 text-blue-600"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{r.label}</p>
                        <p className="text-xs text-slate-500">{r.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Unidade (quiosque) */}
              {formRoleMeta?.requiresUnit && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Unidade *</label>
                  <select
                    value={form.unitId}
                    onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Selecione a unidade...</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Escopo de workspace */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Escopo de dados *</label>
                <div className="space-y-2">
                  {WORKSPACE_SCOPE_OPTIONS.map((w) => (
                    <label
                      key={w.id}
                      className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100"
                    >
                      <div>
                        <span className="text-sm font-semibold text-slate-800">{w.label}</span>
                        <p className="text-xs text-slate-500">{w.description}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.workspaceScope.includes(w.id)}
                        onChange={() => toggleWorkspace(w.id)}
                        className="w-5 h-5 text-blue-600 rounded"
                      />
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Só é possível conceder escopo igual ou menor que o seu — o banco recusa o contrário.
                </p>
              </div>

              {/* Permissões */}
              {formRoleMeta?.requiresUnit ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-xs font-semibold text-slate-700 uppercase mb-1">Permissões desta conta</p>
                  <p className="text-sm text-slate-600">
                    {KIOSK_ROLE_SCOPE[form.role] || 'Conta de quiosque, sem acesso ao painel administrativo.'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Contas de quiosque não acessam o painel administrativo, então a matriz de permissões não se aplica a elas.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-xs font-semibold text-slate-700 uppercase">
                      Permissões ({form.permissions.length})
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {PERMISSION_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          title={p.description}
                          onClick={() => setForm((prev) => ({ ...prev, permissions: p.grants() }))}
                          className="px-2 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                        >
                          {p.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, permissions: [] }))}
                        className="px-2 py-1 text-xs font-medium text-rose-600 bg-white border border-rose-200 rounded-md hover:bg-rose-50"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {permissionGroups.map((g) => {
                      const ids = g.permissions.map((p) => p.id);
                      const allOn = ids.every((id) => form.permissions.includes(id));
                      return (
                        <div key={g.id} className="border border-slate-200 rounded-xl overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 bg-slate-100">
                            <span className="text-sm font-bold text-slate-700">{g.label}</span>
                            <button
                              type="button"
                              onClick={() => setForm((prev) => ({
                                ...prev,
                                permissions: allOn
                                  ? prev.permissions.filter((p) => !ids.includes(p))
                                  : [...new Set([...prev.permissions, ...ids])],
                              }))}
                              className="text-xs font-medium text-blue-600 hover:underline"
                            >
                              {allOn ? 'Desmarcar todas' : 'Marcar todas'}
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-slate-100">
                            {g.permissions.map((p) => (
                              <label key={p.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50">
                                <input
                                  type="checkbox"
                                  checked={form.permissions.includes(p.id)}
                                  onChange={() => togglePermission(p.id)}
                                  className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="text-sm text-slate-700">{p.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Senha provisória (só na criação) */}
              {!form.id && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <label className="block text-xs font-semibold text-amber-800 uppercase mb-2">Senha provisória *</label>
                  <div className="flex gap-2">
                    <input
                      type={revealPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="flex-1 px-3 py-2 text-sm font-mono border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <button type="button" onClick={() => setRevealPassword((v) => !v)} className="px-3 py-2 bg-white border border-amber-300 rounded-lg text-amber-700 hover:bg-amber-100">
                      {revealPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button type="button" onClick={copyPassword} className="px-3 py-2 bg-white border border-amber-300 rounded-lg text-amber-700 hover:bg-amber-100">
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button type="button" onClick={() => setForm({ ...form, password: generatePassword() })} className="px-3 py-2 bg-white border border-amber-300 rounded-lg text-amber-700 hover:bg-amber-100">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-700 mt-2">
                    Esta senha não fica visível depois de salvar. Entregue-a por um canal seguro e peça a troca no primeiro acesso.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Observações internas</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Ex.: acesso temporário para o fechamento de dezembro."
                />
              </div>
            </form>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {form.id ? 'Salvar alterações' : 'Criar usuário'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: reset de senha */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                Redefinir senha
              </h3>
              <button onClick={() => setResetTarget(null)} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-sm font-semibold text-slate-800">{resetTarget.name}</p>
                <p className="text-xs text-slate-500">{resetTarget.email}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nova senha (mín. 8 caracteres)</label>
                <div className="flex gap-2">
                  <input
                    type={revealPassword ? 'text' : 'password'}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <button type="button" onClick={() => setRevealPassword((v) => !v)} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
                    {revealPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={() => setResetPassword(generatePassword())} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                A senha atual é substituída imediatamente. Entregue a nova por um canal seguro — ela não poderá ser consultada depois.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setResetTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={handleResetPassword}
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Redefinir senha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
