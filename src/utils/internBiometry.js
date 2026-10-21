import { supabase } from '../supabase';

// Foto e face_descriptor (base64 / vetor) são pesados e NÃO fazem parte da lista
// padrão de estagiários (INTERN_SELECT_FIELDS). Estes helpers buscam sob demanda,
// por id, e só nas telas que realmente precisam.

// Cache de fotos por id durante a sessão (evita refetch a cada evento Realtime).
const photoCache = new Map();

export const invalidateInternPhoto = (id) => {
  if (id) photoCache.delete(id);
};

// Foto + descritor de UM estagiário (quiosque, edição, PDF, comparação).
export const fetchInternBiometry = async (id) => {
  if (!id) return null;
  const { data, error } = await supabase
    .from('interns')
    .select('id, photo, face_descriptor')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  photoCache.set(id, data.photo || null);
  return { photo: data.photo || '', faceDescriptor: data.face_descriptor || '' };
};

// Fotos de vários estagiários (avatar em listas) — em blocos pequenos e com cache.
export const fetchInternPhotos = async (ids, chunkSize = 20) => {
  const missing = [...new Set(ids)].filter((id) => id && !photoCache.has(id));
  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize);
    const { data, error } = await supabase.from('interns').select('id, photo').in('id', chunk);
    if (error) break;
    const got = new Set();
    (data || []).forEach((r) => { photoCache.set(r.id, r.photo || null); got.add(r.id); });
    chunk.forEach((id) => { if (!got.has(id)) photoCache.set(id, null); });
  }
  const out = {};
  ids.forEach((id) => { if (photoCache.get(id)) out[id] = photoCache.get(id); });
  return out;
};

// Ids com biometria cadastrada (consulta leve: só ids, sem o descritor).
export const fetchInternBiometryIds = async () => {
  const { data, error } = await supabase
    .from('interns')
    .select('id')
    .not('face_descriptor', 'is', null)
    .neq('face_descriptor', '[]');
  if (error) return new Set();
  return new Set((data || []).map((r) => r.id));
};
