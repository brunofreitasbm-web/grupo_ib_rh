import { useEffect, useState } from 'react';
import { fetchInternPhotos } from '../utils/internBiometry';

// Retorna { [internId]: photo } carregando as fotos sob demanda (com cache de sessão).
export default function useInternPhotos(ids, refreshKey = 0) {
  const [photos, setPhotos] = useState({});
  const key = (ids || []).filter(Boolean).join(',');
  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    fetchInternPhotos(key.split(',')).then((p) => { if (active) setPhotos((prev) => ({ ...prev, ...p })); });
    return () => { active = false; };
  }, [key, refreshKey]);
  return photos;
}
