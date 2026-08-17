import { useState } from 'react';

// --- Funções puras (testáveis sem React) ---

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('SEM_SUPORTE'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export function geoErrorMessage(err) {
  if (err && err.message === 'SEM_SUPORTE') {
    return 'Este dispositivo não permite localização. Use um celular com GPS.';
  }
  switch (err && err.code) {
    case 1:
      return 'Você bloqueou o acesso à localização. Toque no cadeado do navegador, permita a localização e tente de novo.';
    case 2:
      return 'Não foi possível obter o sinal de GPS. Vá para um local aberto e tente novamente.';
    case 3:
      return 'A localização demorou demais para responder. Verifique o GPS e tente de novo.';
    default:
      return 'Não foi possível obter sua localização. Verifique se o GPS está ligado.';
  }
}

/**
 * Estado e lógica de geolocalização compartilhados pelo fluxo de bater ponto
 * (isLocating/geoError), pelo radar de calibração de unidade (currentGPS/
 * gpsRadarError/fetchGpsForRadar) e pelo indicador de carregamento de login
 * (gpsLoading, também usado por handleLogin/handleDirectUnitLogin em App.jsx).
 */
export default function useGeolocation() {
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [currentGPS, setCurrentGPS] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsRadarError, setGpsRadarError] = useState('');

  const fetchGpsForRadar = async () => {
    setGpsLoading(true);
    setGpsRadarError('');
    try {
      const pos = await getCurrentPosition();
      const { latitude, longitude, accuracy } = pos.coords;
      setCurrentGPS({ lat: latitude, lng: longitude, accuracy });
    } catch (err) {
      console.error('Radar GPS error:', err);
      setGpsRadarError(geoErrorMessage(err));
    } finally {
      setGpsLoading(false);
    }
  };

  return {
    isLocating, setIsLocating,
    geoError, setGeoError,
    currentGPS, setCurrentGPS,
    gpsLoading, setGpsLoading,
    gpsRadarError, setGpsRadarError,
    fetchGpsForRadar,
    getCurrentPosition,
    geoErrorMessage,
    haversineKm,
  };
}
