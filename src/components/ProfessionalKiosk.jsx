import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, LogOut, LogIn, LogOut as LogOutIcon, User, KeyRound, ShieldCheck, CheckCircle, Loader2, Building2, MapPin } from 'lucide-react';
import { supabase } from '../supabase';
import { mapProfessionalFromDb, professionalRpcErrorMessage, isValidProfessionalPin } from '../utils/mappings';
import { getCurrentPosition } from '../hooks/useGeolocation';

// Quiosque compartilhado de Profissionais PJ (prestadores de serviço), por
// unidade. Deliberadamente separado do quiosque de estagiários (App.jsx):
// nenhum estagiário aparece aqui, nenhum prestador aparece lá — a separação
// é reforçada no servidor pelo papel 'professional_unit' (ver supabase_schema.sql,
// seção 16). Vocabulário e regras não devem se aproximar de controle de
// jornada (ver plano do módulo PJ, seção 1 — blindagem jurídica):
//   * sem biometria, sem foto, sem geofence bloqueante;
//   * GPS é só informativo (nunca impede o registro);
//   * entrada/saída são autodeclaradas e voluntárias.
export default function ProfessionalKiosk({ unit, branding, onLogout }) {
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null); // { action, name }
  const [showChangePin, setShowChangePin] = useState(false);
  const successTimerRef = useRef(null);

  const labels = branding.professionalLabels || {
    singular: 'Prestador(a)', plural: 'Profissionais PJ',
    presence: 'Registro de Presença', production: 'Apuração de Produção',
  };

  const fetchProfessionals = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('professionals')
        .select('id, unit_id, name, active, terms_accepted_at, terms_version')
        .eq('unit_id', unit.id)
        .eq('active', true)
        .order('name', { ascending: true });
      if (fetchError) throw fetchError;
      setProfessionals((data || []).map(mapProfessionalFromDb));
    } catch (err) {
      console.error('Erro ao carregar prestadores da unidade:', err);
      setError('Não foi possível carregar a lista de prestadores desta unidade.');
    } finally {
      setLoading(false);
    }
  }, [unit.id]);

  useEffect(() => {
    fetchProfessionals();
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, [fetchProfessionals]);

  const selectedProfessional = professionals.find((p) => p.id === selectedId) || null;
  const needsTerms = selectedProfessional && !selectedProfessional.termsAcceptedAt;

  const resetForm = () => {
    setSelectedId('');
    setPin('');
    setError('');
    setShowChangePin(false);
  };

  // GPS é meramente informativo: qualquer falha (negado, indisponível, sem
  // suporte) é silenciosamente ignorada e o registro segue sem coordenadas.
  const tryGetInformativeGeo = async () => {
    try {
      const pos = await getCurrentPosition();
      const { latitude, longitude, accuracy } = pos.coords;
      return { lat: latitude, lng: longitude, accuracy, unitId: unit.id, unitName: unit.name };
    } catch {
      return {};
    }
  };

  const handleRegister = async (action) => {
    setError('');
    if (!selectedId) { setError(`Selecione seu nome na lista.`); return; }
    if (!isValidProfessionalPin(pin)) { setError('Digite seu PIN de 6 dígitos.'); return; }

    setSubmitting(true);
    try {
      const geo = await tryGetInformativeGeo();
      const { data, error: rpcError } = await supabase.rpc('register_professional_presence', {
        p_professional_id: selectedId,
        p_pin: pin,
        p_action: action,
        p_geo: geo,
      });
      if (rpcError) throw rpcError;

      setSuccess({ action, name: data?.name || selectedProfessional?.name || '' });
      setPin('');
      successTimerRef.current = setTimeout(() => {
        setSuccess(null);
        resetForm();
      }, 3000);
    } catch (err) {
      console.error('Erro ao registrar presença PJ:', err);
      setError(professionalRpcErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptTerms = async () => {
    setError('');
    if (!isValidProfessionalPin(pin)) { setError('Digite seu PIN de 6 dígitos para confirmar a ciência.'); return; }
    setSubmitting(true);
    try {
      const { error: rpcError } = await supabase.rpc('accept_professional_terms', {
        p_professional_id: selectedId,
        p_pin: pin,
        p_version: branding.professionalTermsVersion || '1.0',
      });
      if (rpcError) throw rpcError;
      await fetchProfessionals();
    } catch (err) {
      console.error('Erro ao registrar aceite do termo:', err);
      setError(professionalRpcErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const PinInput = ({ value, onChange, autoFocus }) => (
    <input
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={6}
      autoFocus={autoFocus}
      autoComplete="off"
      placeholder="• • • • • •"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      className="w-full p-3 text-center text-lg tracking-[0.4em] border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
    />
  );

  return (
    <div className="min-h-screen bg-teal-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden relative">
        <div className="bg-teal-700 p-5 text-white text-center relative flex flex-col items-center justify-center">
          <button
            onClick={onLogout}
            className="absolute top-4 right-4 p-1.5 bg-teal-800 hover:bg-teal-900 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all shadow-sm"
            title="Sair"
          >
            <LogOut size={12} /> Sair
          </button>
          <h1 className="text-xl font-bold mb-0.5">{labels.plural}</h1>
          <p className="text-teal-100 text-xs flex items-center gap-1">
            <Building2 size={12} /> {unit.name}
          </p>
        </div>

        <div className="p-6">
          {success ? (
            <div className="py-12 flex flex-col items-center justify-center text-center animate-fade-in">
              <CheckCircle size={64} className="text-emerald-500 mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-1">
                {success.action === 'entrada' ? 'Entrada registrada!' : 'Saída registrada!'}
              </h2>
              <p className="text-gray-600 text-sm">{success.name}</p>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-teal-600" size={28} />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                  <User size={14} className="text-teal-600" /> Selecione seu nome *
                </label>
                <select
                  size={6}
                  value={selectedId}
                  onChange={(e) => { setSelectedId(e.target.value); setError(''); setShowChangePin(false); }}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-xs overflow-y-auto"
                >
                  {professionals.length === 0 ? (
                    <option value="" disabled>Nenhum prestador ativo nesta unidade</option>
                  ) : (
                    professionals.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))
                  )}
                </select>
              </div>

              {needsTerms && selectedId && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                  <div className="flex items-start gap-2">
                    <ShieldCheck size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-900 leading-relaxed">{branding.professionalTermsText}</p>
                  </div>
                  <label className="block text-[10px] font-semibold text-gray-600">Digite seu PIN para confirmar a ciência</label>
                  <PinInput value={pin} onChange={setPin} />
                  {error && <p className="text-red-500 text-xs text-center font-semibold">{error}</p>}
                  <button
                    type="button"
                    onClick={handleAcceptTerms}
                    disabled={submitting}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                    Estou ciente e concordo
                  </button>
                </div>
              )}

              {selectedId && !needsTerms && !showChangePin && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                      <KeyRound size={14} className="text-teal-600" /> PIN de 6 dígitos *
                    </label>
                    <PinInput value={pin} onChange={setPin} autoFocus />
                  </div>

                  {error && <p className="text-red-500 text-xs text-center font-semibold animate-fade-in">{error}</p>}

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => handleRegister('entrada')}
                      disabled={submitting}
                      className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {submitting ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                      Entrada
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRegister('saida')}
                      disabled={submitting}
                      className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2.5 rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {submitting ? <Loader2 size={14} className="animate-spin" /> : <LogOutIcon size={14} />}
                      Saída
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setShowChangePin(true); setPin(''); setError(''); }}
                    className="w-full text-[10px] text-teal-700 hover:text-teal-900 font-semibold underline"
                  >
                    Alterar meu PIN
                  </button>
                </>
              )}

              {selectedId && showChangePin && (
                <ChangePinForm
                  professionalId={selectedId}
                  onDone={() => { setShowChangePin(false); setError(''); }}
                  onCancel={() => { setShowChangePin(false); setError(''); }}
                />
              )}

              {!selectedId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full flex items-center justify-center gap-1.5 text-[10px] text-gray-400 hover:text-gray-600 font-semibold pt-1"
                >
                  <ArrowLeft size={11} /> Voltar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="mt-6 text-[10px] text-gray-500 text-center max-w-sm leading-relaxed px-2">
        Registro voluntário e autodeclarado para organização de agenda e conferência dos
        serviços prestados. Não constitui controle de jornada de trabalho.
      </p>
      {unit.address && (
        <p className="mt-1 text-[9px] text-gray-400 flex items-center gap-1">
          <MapPin size={9} /> {unit.address}
        </p>
      )}
    </div>
  );
}

function ChangePinForm({ professionalId, onDone, onCancel }) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isValidProfessionalPin(currentPin)) { setError('Digite seu PIN atual (6 dígitos).'); return; }
    if (!isValidProfessionalPin(newPin)) { setError('O novo PIN deve ter 6 dígitos e não pode ser uma sequência óbvia.'); return; }
    if (newPin !== confirmPin) { setError('Os PINs digitados não coincidem.'); return; }
    if (newPin === currentPin) { setError('O novo PIN deve ser diferente do atual.'); return; }

    setSubmitting(true);
    try {
      const { error: rpcError } = await supabase.rpc('change_professional_pin', {
        p_professional_id: professionalId,
        p_current_pin: currentPin,
        p_new_pin: newPin,
      });
      if (rpcError) throw rpcError;
      setSuccess(true);
      setTimeout(onDone, 1500);
    } catch (err) {
      console.error('Erro ao alterar PIN:', err);
      setError(professionalRpcErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center text-emerald-800 text-xs font-semibold">
        PIN alterado com sucesso!
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
      <p className="text-[11px] font-bold text-slate-700">Alterar meu PIN</p>
      <div>
        <label className="block text-[10px] text-gray-500 mb-1">PIN atual</label>
        <input
          type="password" inputMode="numeric" maxLength={6} autoComplete="off"
          value={currentPin}
          onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full p-2 border border-gray-300 rounded-lg text-center tracking-[0.3em] text-sm"
        />
      </div>
      <div>
        <label className="block text-[10px] text-gray-500 mb-1">Novo PIN</label>
        <input
          type="password" inputMode="numeric" maxLength={6} autoComplete="off"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full p-2 border border-gray-300 rounded-lg text-center tracking-[0.3em] text-sm"
        />
      </div>
      <div>
        <label className="block text-[10px] text-gray-500 mb-1">Confirmar novo PIN</label>
        <input
          type="password" inputMode="numeric" maxLength={6} autoComplete="off"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full p-2 border border-gray-300 rounded-lg text-center tracking-[0.3em] text-sm"
        />
      </div>
      {error && <p className="text-red-500 text-[10px] text-center font-semibold">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 bg-white border border-gray-300 text-gray-600 font-semibold py-2 rounded-lg text-[11px]">
          Cancelar
        </button>
        <button type="submit" disabled={submitting} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 rounded-lg text-[11px] disabled:opacity-50">
          {submitting ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}
