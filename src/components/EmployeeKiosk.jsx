import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LogOut, User, ScanFace, CheckCircle, Loader2, Building2, MapPin, Camera, AlertTriangle, Coffee, LogIn, LogOut as LogOutIcon } from 'lucide-react';
import { supabase } from '../supabase';
import { employeeRpcErrorMessage } from '../utils/mappings';
import { getCurrentPosition, geoErrorMessage, haversineKm } from '../hooks/useGeolocation';
import { getFaceDescriptor, compareFaces, loadModels } from '../utils/faceBiometrics';
import { allowedNextTypes } from '../utils/cltCalculations';

// Quiosque de Funcionários CLT (empregados), por unidade. Papel próprio
// 'employee_unit', isolado no servidor de 'intern_unit'/'professional_unit'
// (ver supabase_schema.sql, seção 17). Ao contrário do quiosque PJ, este SE
// APROXIMA de controle de jornada: biometria facial obrigatória, GPS pode
// bloquear o registro (geofence) e cada marcação gera um NSR sequencial e
// imutável (Portaria MTP 671/2021).
const TYPE_META = {
  entrada: { label: 'Entrada', icon: LogIn, color: 'emerald' },
  intervalo_inicio: { label: 'Início do intervalo', icon: Coffee, color: 'amber' },
  intervalo_fim: { label: 'Fim do intervalo', icon: Coffee, color: 'amber' },
  saida: { label: 'Saída', icon: LogOutIcon, color: 'slate' },
};

const BUTTON_CLASSES = {
  emerald: 'bg-emerald-600 hover:bg-emerald-700',
  amber: 'bg-amber-600 hover:bg-amber-700',
  slate: 'bg-slate-600 hover:bg-slate-700',
};

export default function EmployeeKiosk({ unit, branding, onLogout }) {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [step, setStep] = useState('select'); // select | camera | validating | receipt
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const resetTimerRef = useRef(null);

  const labels = branding.employeeLabels || { plural: 'Funcionários CLT', timesheet: 'Ponto Eletrônico' };

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_employee_kiosk_roster');
      if (rpcError) throw rpcError;
      setRoster(data || []);
    } catch (err) {
      console.error('Erro ao carregar funcionários da unidade:', err);
      setError('Não foi possível carregar a lista de funcionários desta unidade.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoster();
    loadModels().catch(() => {});
    return () => {
      stopCamera();
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchRoster]);

  const selectedEmployee = roster.find((e) => e.id === selectedId) || null;
  const nextTypes = selectedEmployee ? allowedNextTypes(selectedEmployee.last_type) : [];
  const needsConsent = selectedEmployee && !selectedEmployee.biometric_consent_at;

  const resetForm = () => {
    stopCamera();
    setSelectedId('');
    setStep('select');
    setError('');
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360, facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error('Erro ao acessar câmera:', err);
      throw new Error('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    // Espelha horizontalmente (como o preview de vídeo) para consistência.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const tryGetGeo = async () => {
    try {
      const pos = await getCurrentPosition();
      const { latitude, longitude, accuracy } = pos.coords;
      let distanceKm = null;
      if (unit.lat && unit.lng) distanceKm = haversineKm(latitude, longitude, unit.lat, unit.lng);
      return { geo: { lat: latitude, lng: longitude, accuracy, unitId: unit.id, unitName: unit.name }, distanceKm, geoOk: true };
    } catch (err) {
      return { geo: {}, distanceKm: null, geoOk: false, geoError: geoErrorMessage(err) };
    }
  };

  const beginRegister = async (type) => {
    setError('');
    if (!selectedId) { setError('Selecione seu nome na lista.'); return; }
    if (needsConsent) { setError('Termo de consentimento biométrico pendente. Procure o RH para regularizar.'); return; }
    setStep('camera');
    try {
      await startCamera();
      // Pequena espera para estabilizar o preview antes de capturar.
      setTimeout(() => handleCaptureAndRegister(type), 900);
    } catch (err) {
      setError(err.message);
      setStep('select');
    }
  };

  const handleCaptureAndRegister = async (type) => {
    setStep('validating');
    try {
      const photo = captureFrame();
      stopCamera();

      const descriptor = await getFaceDescriptor(photo);
      if (!descriptor) {
        setError('Não foi possível identificar seu rosto. Centralize o rosto na câmera, com boa iluminação, e tente novamente.');
        setStep('select');
        return;
      }

      const referenceDescriptor = selectedEmployee.face_descriptor
        || (selectedEmployee.photo ? await getFaceDescriptor(selectedEmployee.photo) : null);
      if (!referenceDescriptor) {
        setError('Este cadastro não possui biometria facial de referência. Procure o RH.');
        setStep('select');
        return;
      }

      const { isMatch, distance } = compareFaces(referenceDescriptor, descriptor, 0.45);
      if (!isMatch) {
        setError('Rosto não reconhecido. Tente novamente com boa iluminação, olhando para a câmera.');
        setStep('select');
        return;
      }

      const { geo, distanceKm, geoOk, geoError } = await tryGetGeo();
      const geofenceRequired = unit.cltGeofenceRequired !== false;
      if (geofenceRequired && unit.lat && unit.lng) {
        if (!geoOk) {
          setError(geoError || 'Não foi possível confirmar sua localização. Ative o GPS e tente novamente.');
          setStep('select');
          return;
        }
        const radiusKm = unit.radiusKm || 5;
        if (distanceKm != null && distanceKm > radiusKm) {
          setError(`Você está fora do raio permitido desta unidade (${distanceKm.toFixed(2)} km). Aproxime-se do local de trabalho.`);
          setStep('select');
          return;
        }
      }

      const { data, error: rpcError } = await supabase.rpc('register_employee_time_record', {
        p_employee_id: selectedId,
        p_type: type,
        p_photo: photo,
        p_geo: geo,
        p_biometric: { distance, threshold: 0.45 },
      });
      if (rpcError) throw rpcError;

      setReceipt({
        type, name: data?.name || selectedEmployee.name, nsr: data?.nsr,
        timestamp: data?.timestamp, hash: (data?.hash || '').slice(0, 12),
      });
      setStep('receipt');
      resetTimerRef.current = setTimeout(() => {
        setReceipt(null);
        resetForm();
        fetchRoster();
      }, 8000);
    } catch (err) {
      console.error('Erro ao registrar ponto CLT:', err);
      setError(employeeRpcErrorMessage(err));
      setStep('select');
    }
  };

  return (
    <div className="min-h-screen bg-indigo-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden relative">
        <div className="bg-indigo-700 p-5 text-white text-center relative flex flex-col items-center justify-center">
          <button
            onClick={onLogout}
            className="absolute top-4 right-4 p-1.5 bg-indigo-800 hover:bg-indigo-900 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all shadow-sm"
            title="Sair"
          >
            <LogOut size={12} /> Sair
          </button>
          <h1 className="text-xl font-bold mb-0.5">{labels.timesheet || 'Ponto Eletrônico'}</h1>
          <p className="text-indigo-100 text-xs flex items-center gap-1">
            <Building2 size={12} /> {unit.name}
          </p>
        </div>

        <div className="p-6">
          {step === 'receipt' && receipt ? (
            <div className="py-6 flex flex-col items-center justify-center text-center animate-fade-in">
              <CheckCircle size={56} className="text-emerald-500 mb-3" />
              <h2 className="text-lg font-bold text-gray-800 mb-1">{TYPE_META[receipt.type]?.label || 'Registro'} confirmada(o)!</h2>
              <p className="text-gray-600 text-sm mb-3">{receipt.name}</p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left text-[11px] text-slate-600 w-full space-y-1">
                <p><strong>Data/hora:</strong> {receipt.timestamp ? new Date(receipt.timestamp).toLocaleString('pt-BR') : '—'}</p>
                <p><strong>NSR:</strong> {receipt.nsr ?? '—'}</p>
                <p><strong>Hash:</strong> {receipt.hash || '—'}…</p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="mt-3 text-[11px] text-indigo-700 hover:text-indigo-900 font-semibold underline"
              >
                Imprimir comprovante
              </button>
            </div>
          ) : step === 'camera' || step === 'validating' ? (
            <div className="py-4 flex flex-col items-center justify-center text-center">
              <div className="w-full aspect-[4/3] bg-black rounded-xl overflow-hidden mb-3 relative">
                <video ref={videoRef} muted playsInline className="w-full h-full object-cover -scale-x-100" />
                {step === 'validating' && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 size={32} className="animate-spin text-white" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <Camera size={13} /> {step === 'camera' ? 'Centralize seu rosto e aguarde...' : 'Validando biometria e localização...'}
              </p>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-indigo-600" size={28} />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                  <User size={14} className="text-indigo-600" /> Selecione seu nome *
                </label>
                <select
                  size={6}
                  value={selectedId}
                  onChange={(e) => { setSelectedId(e.target.value); setError(''); }}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs overflow-y-auto"
                >
                  {roster.length === 0 ? (
                    <option value="" disabled>Nenhum funcionário ativo nesta unidade</option>
                  ) : (
                    roster.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)
                  )}
                </select>
              </div>

              {needsConsent && selectedId && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Termo de consentimento biométrico pendente. Procure o RH para regularizar antes de registrar o ponto.
                  </p>
                </div>
              )}

              {selectedId && !needsConsent && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {nextTypes.map((type) => {
                    const meta = TYPE_META[type];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => beginRegister(type)}
                        className={`text-white font-bold py-2.5 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 ${BUTTON_CLASSES[meta.color]}`}
                      >
                        <Icon size={14} /> {meta.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {error && <p className="text-red-500 text-xs text-center font-semibold animate-fade-in">{error}</p>}

              {!selectedId && (
                <p className="text-[10px] text-gray-400 text-center flex items-center justify-center gap-1">
                  <ScanFace size={12} /> A marcação exige reconhecimento facial e localização.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="mt-6 text-[10px] text-gray-500 text-center max-w-sm leading-relaxed px-2">
        Registro eletrônico de ponto (CLT), com validação biométrica, geolocalização e numeração
        sequencial de registro (NSR). Os dados de cada marcação são imutáveis.
      </p>
      {unit.address && (
        <p className="mt-1 text-[9px] text-gray-400 flex items-center gap-1">
          <MapPin size={9} /> {unit.address}
        </p>
      )}
    </div>
  );
}
