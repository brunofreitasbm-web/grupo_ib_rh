import { BRANDING } from '../config/branding';

// Unidades que nunca devem aparecer no Grupo IB (pertencem a outro workspace).
// Identifica por id/nome (sem acento, espaço ou hífen), mesmo que o banco
// devolva a linha sem workspace_id ou a lista de unidades ainda não tenha carregado.
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const HIDDEN_FRAGMENTS = ['antoniobarreto', 'generalissimo'];

export const isHiddenUnitForWorkspace = (id, name, workspaceId = BRANDING.id) => {
  if (workspaceId !== 'grupoib') return false;
  const keys = [norm(id), norm(name)];
  return keys.some((k) => k && HIDDEN_FRAGMENTS.some((f) => k.includes(f)));
};
