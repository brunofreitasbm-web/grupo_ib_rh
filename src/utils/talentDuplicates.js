// Detecção determinística de candidaturas duplicadas. Nunca por nome sozinho:
// só e-mail normalizado ou telefone (dígitos, sem DDI 55) coincidentes.

export const normalizeEmail = (v) => String(v || '').trim().toLowerCase();

export function normalizePhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length > 11) d = d.slice(2);
  return d.length >= 10 ? d.slice(-11) : '';
}

// Agrupa em clusters (união por e-mail OU telefone, transitivo).
// Retorna { clusters: Candidato[][], clusterById: Map<id, índice> }; só clusters >= 2.
export function findDuplicateClusters(candidates) {
  const parent = new Map();
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const byKey = new Map();
  for (const c of candidates) {
    const id = String(c.id);
    parent.set(id, id);
    for (const key of [
      normalizeEmail(c.email) && `e:${normalizeEmail(c.email)}`,
      normalizePhone(c.phone) && `p:${normalizePhone(c.phone)}`,
    ]) {
      if (!key) continue;
      if (byKey.has(key)) union(id, byKey.get(key));
      else byKey.set(key, id);
    }
  }

  const groups = new Map();
  for (const c of candidates) {
    const root = find(String(c.id));
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(c);
  }
  const clusters = [...groups.values()].filter((g) => g.length > 1);
  const clusterById = new Map();
  clusters.forEach((g, i) => g.forEach((c) => clusterById.set(String(c.id), i)));
  return { clusters, clusterById };
}

const createdMs = (c) =>
  c.created_at_ms || (c.created_at_iso ? new Date(c.created_at_iso).getTime() : 0) || 0;

// Principal sugerido: candidatura mais recente.
export const suggestMaster = (cluster) =>
  [...cluster].sort((a, b) => createdMs(b) - createdMs(a))[0];
