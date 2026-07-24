import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CheckCircle2, ShieldAlert, ShieldCheck, RefreshCw, Lock, Sparkles } from 'lucide-react';
import * as faceapi from 'face-api.js';
import { loadModels, detectActiveLiveness, generateSecureEnrollmentPayload } from '../utils/faceBiometrics';
import { toast } from 'sonner';

export default function BiometricEnrollment({ internName = '', internCpf = '', onEnrollmentComplete, onCancel }) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [livenessStatus, setLivenessStatus] = useState('idle'); // 'idle' | 'checking' | 'passed' | 'failed'
  const [livenessScore, setLivenessScore] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Inicie a câmera para o cadastro biométrico.');
  const [securePayload, setSecurePayload] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const livenessIntervalRef = useRef(null);

  // Initialize camera stream via WebRTC MediaStream API
  const startCamera = async () => {
    try {
      setStatusMessage('Carregando modelos neurais de biometria...');
      await loadModels();
      
      setStatusMessage('Solicitando acesso à câmera via WebRTC...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      streamRef.current = stream;
      setIsCameraActive(true);
      setLivenessStatus('checking');
      setStatusMessage('Aguardando verificação de Liveness Ativo (pisque ou mova a cabeça levemente)...');
      
      // Start active liveness monitoring loop
      startLivenessMonitoring();
    } catch (err) {
      console.error('Erro ao acessar câmera:', err);
      toast.error('Erro ao acessar a câmera. Verifique as permissões de vídeo do seu navegador.');
      setStatusMessage('Falha ao acessar dispositivo de vídeo.');
    }
  };

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (livenessIntervalRef.current) {
      clearInterval(livenessIntervalRef.current);
      livenessIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Active Liveness check polling loop
  const startLivenessMonitoring = () => {
    let consecutivePassedFrames = 0;
    if (livenessIntervalRef.current) clearInterval(livenessIntervalRef.current);

    livenessIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

      const res = await detectActiveLiveness(videoRef.current);
      setLivenessScore(res.score);

      if (res.isLive) {
        consecutivePassedFrames++;
        if (consecutivePassedFrames >= 3) {
          clearInterval(livenessIntervalRef.current);
          livenessIntervalRef.current = null;
          setLivenessStatus('passed');
          setStatusMessage('✅ Liveness Ativo confirmado! Extraindo vetor facial de 128-d...');
          toast.success('Validação de liveness anti-spoofing concluída com sucesso!');
          extractEmbeddingAndGeneratePayload(res.score);
        }
      } else {
        consecutivePassedFrames = Math.max(0, consecutivePassedFrames - 1);
        if (res.reason) {
          setStatusMessage(`Centralize o rosto na câmera. (${res.reason})`);
        }
      }
    }, 600);
  };

  // Extract 128-d face embedding and construct secure payload
  const extractEmbeddingAndGeneratePayload = async (score) => {
    setIsExtracting(true);
    try {
      if (!videoRef.current) throw new Error('Câmera indisponível');
      
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection || !detection.descriptor) {
        throw new Error('Não foi possível extrair os descritores faciais do quadro capturado.');
      }

      const descriptorArray = Array.from(detection.descriptor);
      
      // Generate secure anti-spoofing payload token
      const payload = await generateSecureEnrollmentPayload(descriptorArray, {
        cpf: internCpf,
        name: internName,
        livenessScore: score,
        enrolledVia: 'BiometricEnrollmentWebRTC'
      });

      setSecurePayload(payload);
      toast.success('Payload seguro de biometria gerado com sucesso!');
      setStatusMessage('🎉 Cadastro biométrico concluído com assinatura digital SHA-256!');
      
      stopCamera();

      if (onEnrollmentComplete) {
        onEnrollmentComplete(payload);
      }
    } catch (err) {
      console.error('Erro na extração de embedding:', err);
      toast.error(err.message || 'Falha ao extrair biometria.');
      setLivenessStatus('failed');
      setStatusMessage('Erro na extração biométrica. Tente novamente.');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 max-w-xl mx-auto text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            Cadastro de Biometria Facial
          </h3>
          <p className="text-sm text-slate-500">
            {internName ? `Estagiário(a): ${internName}` : 'Reconhecimento antifraude via WebRTC'}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
          <Lock className="w-3.5 h-3.5" />
          Payload Seguro SHA-256
        </div>
      </div>

      {/* Video Stream & Frame */}
      <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-800 shadow-inner">
        <video
          ref={videoRef}
          muted
          playsInline
          className={`w-full h-full object-cover transition-opacity duration-300 ${isCameraActive ? 'opacity-100' : 'opacity-0 hidden'}`}
        />

        {!isCameraActive && (
          <div className="text-center p-6 text-slate-400">
            <Camera className="w-12 h-12 mx-auto mb-3 text-slate-500 opacity-80 animate-pulse" />
            <p className="text-sm">Clique no botão abaixo para ativar a câmera em tempo real.</p>
          </div>
        )}

        {/* Liveness Overlay Indicator */}
        {isCameraActive && (
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md transition-all ${
              livenessStatus === 'passed' ? 'bg-emerald-500/90 text-white' :
              livenessStatus === 'checking' ? 'bg-amber-500/90 text-white' :
              'bg-slate-800/80 text-slate-200'
            }`}>
              {livenessStatus === 'passed' && <CheckCircle2 className="w-4 h-4 text-white" />}
              {livenessStatus === 'checking' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {livenessStatus === 'passed' ? 'Liveness Confirmado' : `Liveness Score: ${Math.round(livenessScore * 100)}%`}
              </span>
            </div>

            <div className="px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Anti-Spoofing Active
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-indigo-500 flex-shrink-0" />
        <span className="truncate">{statusMessage}</span>
      </div>

      {/* Actions */}
      <div className="mt-5 flex items-center justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
          >
            Cancelar
          </button>
        )}

        {!isCameraActive ? (
          <button
            type="button"
            onClick={startCamera}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-md transition flex items-center gap-2"
          >
            <Camera className="w-4 h-4" />
            Iniciar Captura de Biometria
          </button>
        ) : (
          <button
            type="button"
            onClick={stopCamera}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition"
          >
            Parar Câmera
          </button>
        )}
      </div>

      {/* Secure Payload Metadata Output */}
      {securePayload && (
        <div className="mt-4 p-3 bg-indigo-950 text-indigo-100 rounded-xl text-xs font-mono border border-indigo-800 space-y-1">
          <div className="text-emerald-400 font-semibold flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" /> Payload Assinado (SHA-256):
          </div>
          <div className="truncate text-indigo-300">Hash: {securePayload.security.payloadSignature}</div>
          <div className="text-indigo-400">Dimensões Embedding: {securePayload.embedding.length} posições</div>
        </div>
      )}
    </div>
  );
}
