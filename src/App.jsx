import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Clock, User, FileText, CheckCircle, List, ArrowLeft,
  LogIn, LogOut, ShieldAlert, Sparkles, Loader2, Bot,
  Download, Lock, AlertTriangle, X, MapPin, Navigation, MessageSquare,
  Users, Plus, Pencil, Trash2, Save, Crosshair, Building2, Timer,
  Camera, Video, Check, Eye, Trash, Upload, Printer, Calendar, FolderOpen, Search,
  ScanFace, RefreshCw, CheckCircle2, AlertCircle
} from 'lucide-react';
import { getFaceDescriptor, compareFaces } from './utils/faceBiometrics';
import * as faceapi from 'face-api.js';

// Supabase Client Integration
import { supabase } from './supabase';

import Omnibar from './components/Omnibar';
import { toast } from 'sonner';
import DashboardTab from './components/tabs/DashboardTab';
import FrequenciaTab from './components/tabs/FrequenciaTab';
import EstagiariosTab from './components/tabs/EstagiariosTab';
import AcompanhamentoTab from './components/tabs/AcompanhamentoTab';
import FinanceiroTab from './components/tabs/FinanceiroTab';
import OcorrenciasTab from './components/tabs/OcorrenciasTab';
import EncerramentoTab from './components/tabs/EncerramentoTab';
import DocumentosTab from './components/tabs/DocumentosTab';
import DossieTab from './components/tabs/DossieTab';
import AlertasRhTab from './components/tabs/AlertasRhTab';
import AniversariantesTab from './components/tabs/AniversariantesTab';
import ConfiguracoesTab from './components/tabs/ConfiguracoesTab';
import LandingPage from './components/LandingPage';
import BiometricEnrollment from './components/BiometricEnrollment';



// ============================================================
// CONFIGURAÇÕES GERAIS
// ============================================================

// Unidades da Porto Terapia. Coordenadas APROXIMADAS — use o botão
// "Calibrar" no painel (estando fisicamente na unidade) para fixar o ponto exato.
const UNITS_DEFAULT = [
  {
    id: 'antonio-barreto',
    name: 'Unidade Antônio Barreto',
    address: 'R. Antônio Barreto, 2050 - Fátima, Belém - PA, 66060-021',
    lat: -1.442473861453128,
    lng: -48.469996243820276,
    radiusKm: 5,
  },
  {
    id: 'generalissimo',
    name: 'Unidade Generalíssimo',
    address: 'Av. Generalíssimo Deodoro, 564 - Nazaré, Belém - PA',
    lat: -1.4456511159378498,
    lng: -48.48304674431182,
    radiusKm: 5,
  },
];

// Limites da Lei do Estágio (Lei nº 11.788/2008)
const LABOR = {
  maxDailyHours: 6,   // 6h/dia (padrão ensino superior/médio)
  maxWeeklyHours: 30, // 30h/semana
};

const ADMISSIONAL_DOCUMENTS = [
  { key: 'tce', label: 'Termo de Compromisso (TCE)', desc: 'Contrato de estágio assinado de 3 vias.' },
  { key: 'pae', label: 'Plano de Atividades (PAE)', desc: 'Plano detalhado de atividades do estágio.' },
  { key: 'matricula', label: 'Comprovante de Matrícula', desc: 'Comprovante atualizado do semestre letivo.' },
  { key: 'documentos', label: 'RG e CPF', desc: 'Documentos de identidade civil do estagiário.' },
  { key: 'seguro', label: 'Apólice de Seguro', desc: 'Seguro de acidentes pessoais obrigatório por lei.' },
  { key: 'ficha', label: 'Ficha Cadastral', desc: 'Ficha com dados bancários e contatos preenchida.' },
];

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

const compressImage = (file, maxWidth = 300, maxHeight = 400, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      // Se não for imagem, apenas converte para base64 diretamente (ex: PDFs)
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (error) => reject(error);
  });
};

const generateUsername = (fullName) => {
  const clean = fullName.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, '');
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[parts.length - 1]}`;
  } else if (parts.length === 1) {
    return `${parts[0]}.estagio`;
  }
  return 'estagiario';
};

// --- Supabase Mappings ---
const mapInternFromDb = (i) => ({
  id: i.id,
  name: i.name,
  course: i.course,
  institution: i.institution,
  shift: i.shift,
  dailyHours: i.daily_hours,
  unitId: i.unit_id,
  active: i.active,
  startDate: i.start_date,
  endDate: i.end_date,
  lastReportDate: i.last_report_date,
  recessDaysTaken: i.recess_days_taken,
  username: i.username,
  isFirstLogin: i.is_first_login,
  documents: i.documents || {},
  photo: i.photo,
  cpf: i.cpf || '',
  email: i.email || '',
  rg: i.rg || '',
  phone: i.phone || '',
  address: i.address || '',
  bankName: i.bank_name || '',
  bankAgency: i.bank_agency || '',
  bankAccount: i.bank_account || '',
  pixKey: i.pix_key || '',
  emergencyName: i.emergency_name || '',
  emergencyRelationship: i.emergency_relationship || 'Pais',
  emergencyPhone: i.emergency_phone || '',
  allowance: Number(i.allowance) || 0,
  supervisorName: i.supervisor_name || '',
  registrationStatus: i.registration_status || 'validated',
  semestralReports: i.semestral_reports || {},
  contractTermination: i.contract_termination || {},
  birthdate: i.birthdate || '',
});

const mapInternToDb = (i) => ({
  name: i.name,
  course: i.course,
  institution: i.institution,
  shift: i.shift,
  daily_hours: i.dailyHours,
  unit_id: i.unitId,
  active: i.active !== false,
  start_date: i.startDate,
  end_date: i.endDate,
  last_report_date: i.lastReportDate,
  recess_days_taken: Number(i.recessDaysTaken) || 0,
  username: i.username,
  is_first_login: i.isFirstLogin !== false,
  documents: i.documents || {},
  photo: i.photo,
  cpf: i.cpf || '',
  email: i.email || '',
  rg: i.rg || '',
  phone: i.phone || '',
  address: i.address || '',
  bank_name: i.bankName || '',
  bank_agency: i.bankAgency || '',
  bank_account: i.bankAccount || '',
  pix_key: i.pixKey || '',
  emergency_name: i.emergencyName || '',
  emergency_relationship: i.emergencyRelationship || 'Pais',
  emergency_phone: i.emergencyPhone || '',
  allowance: Number(i.allowance) || 0,
  supervisor_name: i.supervisorName || '',
  registration_status: i.registrationStatus || 'validated',
  semestral_reports: i.semestralReports || {},
  contract_termination: i.contractTermination || {},
  birthdate: i.birthdate || null,
});

const mapRecordFromDb = (r) => ({
  id: r.id,
  internId: r.intern_id,
  internName: r.intern_name,
  action: r.action,
  justification: r.justification,
  timestamp: r.timestamp,
  photo: r.photo,
  isManual: r.is_manual,
  justificationDoc: r.justification_doc,
  geo: r.geo,
  daysAway: r.days_away || 0,
});

const mapRecordToDb = (r) => ({
  intern_id: r.internId,
  intern_name: r.internName,
  action: r.action,
  justification: r.justification,
  timestamp: r.timestamp,
  photo: r.photo,
  is_manual: r.isManual,
  justification_doc: r.justificationDoc,
  geo: r.geo,
  days_away: Number(r.daysAway) || 0,
});

const mapUnitFromDb = (u) => ({
  id: u.id,
  name: u.name,
  address: u.address,
  lat: Number(u.lat),
  lng: Number(u.lng),
  radiusKm: Number(u.radius_km),
  radiusM: Number(u.radius_m),
});

const mapUnitToDb = (u) => ({
  id: u.id,
  name: u.name,
  address: u.address,
  lat: Number(u.lat),
  lng: Number(u.lng),
  radius_km: Number(u.radiusKm),
  radius_m: Number(u.radiusM),
});


// ============================================================
// UTILITÁRIOS DE GEOLOCALIZAÇÃO
// ============================================================
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCurrentPosition() {
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

function geoErrorMessage(err) {
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

const formatDistance = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`);

// Início da semana (segunda-feira 00:00) — usado no acumulado semanal
function startOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 domingo ... 6 sábado
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

const validateCPF = (cpf) => {
  const clean = cpf.replace(/[^\d]/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i)) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i)) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10))) return false;
  
  return true;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('kiosk'); // 'landing' | 'kiosk' | 'admin'
  const [activeAdminTab, setActiveAdminTab] = useState('dashboard');
  const [records, setRecords] = useState([]);
  const [interns, setInterns] = useState([]);
  const [internsLoaded, setInternsLoaded] = useState(false);
  const [units, setUnits] = useState(UNITS_DEFAULT);
  const [isOmnibarOpen, setIsOmnibarOpen] = useState(false);

  const handleOmnibarAction = (action, internId) => {
    if (action === 'view_dossie') {
      setActiveAdminTab('admissional');
    } else if (action === 'new_occurrence') {
      setActiveAdminTab('ocorrencias');
    } else if (action === 'view_reports') {
      setActiveAdminTab('financeiro');
    }
  };

  // Formulário de registro & Login Individual
  const [selectedIntern, setSelectedIntern] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [actionType, setActionType] = useState('entrada');
  const [justification, setJustification] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Estados de Login
  const [loggedInIntern, setLoggedInIntern] = useState(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [selectedLoginOption, setSelectedLoginOption] = useState(null); // null | 'supervisor' | 'antonio-barreto' | 'generalissimo'

  // Estados de Alteração de Senha Inicial
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');

  // Comprovantes de Ocorrências (Atestado/Cursos)
  const [justificationDocType, setJustificationDocType] = useState('atestado');
  const [uploadingJustificationDoc, setUploadingJustificationDoc] = useState(false);
  const [daysAway, setDaysAway] = useState(0);

  // Geolocalização (registro de ponto)
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  // Controle Facial & Câmera
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [forceManualPoint, setForceManualPoint] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Cerca Virtual / GPS Radar em tempo real
  const [currentGPS, setCurrentGPS] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsRadarError, setGpsRadarError] = useState('');

  // Filtro por unidade (histórico + exportação)
  const [filterUnit, setFilterUnit] = useState('all');

  // Fluxo Admissional (Upload de Documentos)
  const [selectedAdmissionalIntern, setSelectedAdmissionalIntern] = useState('');
  const [uploadDocType, setUploadDocType] = useState('tce');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [viewDocBase64, setViewDocBase64] = useState(null);
  const [viewDocType, setViewDocType] = useState('');
  const [viewDocName, setViewDocName] = useState('');

  // Visualização de foto de ponto histórico
  const [selectedRecordPhoto, setSelectedRecordPhoto] = useState(null);
  const [showOccurrenceModal, setShowOccurrenceModal] = useState(false);

  // Estados dos novos módulos (Acompanhamento, Financeiro, Impressão, Encerramento de Vínculo)
  const [selectedActivityIntern, setSelectedActivityIntern] = useState('');
  const [activityReportDate, setActivityReportDate] = useState('');
  const [activityRecessDays, setActivityRecessDays] = useState(0);
  const [activitySupervisorName, setActivitySupervisorName] = useState('');
  const [uploadingSemestralReport, setUploadingSemestralReport] = useState(false);
  const [semestralReportPeriod, setSemestralReportPeriod] = useState('1');

  const [selectedPrintIntern, setSelectedPrintIntern] = useState('');

  const [filterFinanceMonth, setFilterFinanceMonth] = useState(new Date().toISOString().substring(0, 7));

  const [selectedTerminationIntern, setSelectedTerminationIntern] = useState('');
  const [terminationMotive, setTerminationMotive] = useState('Desligamento (conforme Lei)');
  const [terminationDate, setTerminationDate] = useState(new Date().toISOString().split('T')[0]);
  const [uploadingTerminationLetter, setUploadingTerminationLetter] = useState(false);

  // Estados para Aba de Ocorrências (Supervisor)
  const [selectedOcorrenciaIntern, setSelectedOcorrenciaIntern] = useState('');
  const [ocorrenciaStartDate, setOcorrenciaStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [ocorrenciaEndDate, setOcorrenciaEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [ocorrenciaType, setOcorrenciaType] = useState('atestado');
  const [ocorrenciaDays, setOcorrenciaDays] = useState(1);
  const [ocorrenciaDesc, setOcorrenciaDesc] = useState('');
  const [ocorrenciaLoading, setOcorrenciaLoading] = useState(false);
  const [ocorrenciaFilterIntern, setOcorrenciaFilterIntern] = useState('all');

  useEffect(() => {
    if (ocorrenciaStartDate && ocorrenciaEndDate) {
      const start = new Date(ocorrenciaStartDate);
      const end = new Date(ocorrenciaEndDate);
      const diffTime = end - start;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      setOcorrenciaDays(isNaN(diffDays) || diffDays < 0 ? 1 : diffDays);
    }
  }, [ocorrenciaStartDate, ocorrenciaEndDate]);

  useEffect(() => {
    setOcorrenciaFilterIntern('all');
    setSelectedOcorrenciaIntern('');
    setSelectedPrintIntern('');
    setSelectedTerminationIntern('');
    setSelectedAdmissionalIntern('');
    setSelectedActivityIntern('');
  }, [filterUnit]);

  // Autogestão de Biometria
  const [autogestaoInternId, setAutogestaoInternId] = useState('');
  const [autogestaoCpf, setAutogestaoCpf] = useState('');
  const [autogestaoSuccess, setAutogestaoSuccess] = useState(false);
  const [publicInterns, setPublicInterns] = useState([]);
  const [loadingPublicInterns, setLoadingPublicInterns] = useState(false);

  // Cadastro obrigatório (do zero)
  const [cadastroForm, setCadastroForm] = useState({
    name: '', course: '', institution: '', shift: 'Manhã',
    dailyHours: 6, unitId: UNITS_DEFAULT[0].id, active: true,
    startDate: '', endDate: '', photo: '', cpf: '', email: '',
    rg: '', phone: '', address: '', bankName: '', bankAgency: '',
    bankAccount: '', pixKey: '', emergencyName: '', emergencyRelationship: 'Pais',
    emergencyPhone: '', allowance: 0, supervisorName: '', birthdate: '',
    registrationStatus: 'pending_validation', faceDescriptor: ''
  });
  const [cadastroCpfRgFile, setCadastroCpfRgFile] = useState(null);
  const [cadastroMatriculaFile, setCadastroMatriculaFile] = useState(null);
  const [isSubmittingCadastro, setIsSubmittingCadastro] = useState(false);
  const [cadastroSuccess, setCadastroSuccess] = useState(false);

  // State do Pop-up de Processamento de Upload de Foto no Auto-cadastro
  const [isBioCadastroModalOpen, setIsBioCadastroModalOpen] = useState(false);
  const [bioCadastroStatus, setBioCadastroStatus] = useState('processing'); // 'processing', 'success', 'error'
  const [bioCadastroMsg, setBioCadastroMsg] = useState('');
  const [bioCadastroTimeLeft, setBioCadastroTimeLeft] = useState(20);

  // IA (Gemini) e Alertas
  const [isImproving, setIsImproving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [hoursAlerts, setHoursAlerts] = useState([]);
  const [auditAlerts, setAuditAlerts] = useState([]);
  const [isAiExtractionActive, setIsAiExtractionActive] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Chat Estagiário-Supervisor
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInternId, setChatInternId] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatFeedback, setChatFeedback] = useState('');
  const [pendingChatCount, setPendingChatCount] = useState(0);

  // Auto-selecionar ID do estagiário se estiver logado individualmente
  useEffect(() => {
    if (loggedInIntern && loggedInIntern.role !== 'intern_unit') {
      setChatInternId(loggedInIntern.id);
    } else {
      setChatInternId('');
    }
  }, [loggedInIntern]);

  // Gestão de estagiários
  const [showManage, setShowManage] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '', course: '', institution: '', shift: 'Manhã',
    dailyHours: 6, unitId: UNITS_DEFAULT[0].id, active: true,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 anos por padrão
    photo: '',
    cpf: '',
    email: '',
    rg: '',
    phone: '',
    address: '',
    bankName: '',
    bankAgency: '',
    bankAccount: '',
    pixKey: '',
    emergencyName: '',
    emergencyRelationship: 'Pais',
    emergencyPhone: '',
    allowance: 0,
    supervisorName: '',
    birthdate: '',
  });

  // Configuração das unidades
  const [savingUnit, setSavingUnit] = useState('');
  const [unitMsg, setUnitMsg] = useState('');

  // Modais de templates e minuta
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [viewingMinutaIntern, setViewingMinutaIntern] = useState(null);

  // Relógio
  const [currentTime, setCurrentTime] = useState(new Date());

  // Chave do Gemini (opcional). Defina VITE_GEMINI_API_KEY no arquivo .env para ativar a IA.
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

  // 1. Autenticação e Sessão do Supabase
  const handleSession = useCallback(async (session) => {
    if (session) {
      const userObj = session.user;
      setUser(userObj);
      const role = userObj.user_metadata?.role;
      if (role === 'supervisor') {
        setCurrentView('admin');
        setLoggedInIntern(null);
        setLoginError('');
      } else if (role === 'intern') {
        setCurrentView('kiosk');
        // Buscar os dados do estagiário
        try {
          const { data, error } = await supabase
            .from('interns')
            .select('*')
            .eq('id', userObj.id)
            .single();
          
          if (error || !data) {
            console.error('Estagiário não cadastrado na base de dados:', error);
            setLoginError('Sua conta não possui um perfil de estagiário configurado. Procure o supervisor.');
            await supabase.auth.signOut();
            return;
          }

          const internMapped = mapInternFromDb(data);
          setLoggedInIntern(internMapped);
          setSelectedIntern(internMapped.id);
          setSelectedUnit(internMapped.unitId || '');
          setLoginError('');
        } catch (err) {
          console.error('Erro ao carregar dados do estagiário:', err);
          setLoginError('Erro ao carregar os dados do seu perfil.');
          await supabase.auth.signOut();
        }
      } else if (role === 'intern_unit') {
        setCurrentView('kiosk');
        const unitId = userObj.user_metadata?.unit_id;
        setLoggedInIntern({
          id: userObj.id,
          name: userObj.user_metadata?.name || 'Estagiário Genérico',
          role: 'intern_unit',
          unitId: unitId,
          isFirstLogin: false
        });
        setSelectedIntern('');
        setSelectedUnit(unitId || '');
        setLoginError('');
      } else {
        console.error('Usuário sem papel (role) definido.');
        setLoginError('Esta conta não possui permissão de acesso (papel indefinido).');
        await supabase.auth.signOut();
      }
    } else {
      setUser(null);
      setLoggedInIntern(null);
      setSelectedIntern('');
      setCurrentView('kiosk');
    }
  }, [setLoginError]);

  useEffect(() => {
    // Obter sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // Ouvir mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [handleSession]);



  // Sincroniza campos de Acompanhamento ao selecionar o estagiário
  useEffect(() => {
    const intern = interns.find(i => i.id === selectedActivityIntern);
    if (intern) {
      setActivityReportDate(intern.lastReportDate || '');
      setActivityRecessDays(Number(intern.recessDaysTaken) || 0);
      setActivitySupervisorName(intern.supervisorName || '');
    } else {
      setActivityReportDate('');
      setActivityRecessDays(0);
      setActivitySupervisorName('');
    }
  }, [selectedActivityIntern, interns]);

  // Sincroniza campos de Desligamento ao selecionar o estagiário
  useEffect(() => {
    const intern = interns.find(i => i.id === selectedTerminationIntern);
    if (intern && intern.contractTermination) {
      setTerminationMotive(intern.contractTermination.motive || 'Desligamento (conforme Lei)');
      setTerminationDate(intern.contractTermination.date || new Date().toISOString().split('T')[0]);
    } else {
      setTerminationMotive('Desligamento (conforme Lei)');
      setTerminationDate(new Date().toISOString().split('T')[0]);
    }
  }, [selectedTerminationIntern, interns]);


  // 2. Registros de frequência
  const fetchRecords = useCallback(async () => {
    if (!user) return;
    const role = user.user_metadata?.role;
    let query = supabase.from('records').select('*');
    
    if (role === 'intern') {
      query = query.eq('intern_id', user.id);
    }
    
    // Limitar para os últimos 200 registros para evitar sobrecarga
    const { data, error } = await query.order('timestamp', { ascending: false }).limit(200);
    if (error) {
      console.error('Erro ao buscar registros:', error);
    } else {
      setRecords((data || []).map(mapRecordFromDb));
    }
  }, [user]);

  const fetchPendingChatCount = useCallback(async () => {
    if (!user || user.user_metadata?.role !== 'supervisor') return;
    const { data, error } = await supabase
      .from('records')
      .select('id, geo')
      .eq('action', 'supervisor_chat');
    
    if (!error && data) {
      const pending = data.filter(r => r.geo && r.geo.status === 'pending');
      setPendingChatCount(pending.length);
    }
  }, [user]);

  useEffect(() => {
    if (user && user.user_metadata?.role === 'supervisor') {
      fetchPendingChatCount();
    }
  }, [user, fetchPendingChatCount]);

  useEffect(() => {
    if (!user || user.user_metadata?.role !== 'supervisor') return;

    const channel = supabase
      .channel('admin-records-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newRecord = payload.new;
          if (newRecord.action === 'supervisor_chat') {
            toast.info(`Novo chamado recebido de ${newRecord.intern_name}: "${newRecord.justification?.substring(0, 30)}..."`, {
              onClick: () => setActiveAdminTab('rh'),
              autoClose: 8000
            });
          }
        }
        fetchRecords();
        fetchPendingChatCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchRecords, fetchPendingChatCount]);

  useEffect(() => {
    const handleOnline = async () => {
      const offlineRecords = JSON.parse(localStorage.getItem('offline_records') || '[]');
      if (offlineRecords.length > 0) {
        toast.info(`Sincronizando ${offlineRecords.length} ponto(s) salvo(s) offline...`);
        try {
          const { error } = await supabase.from('records').insert(offlineRecords.map(mapRecordToDb));
          if (error) throw error;
          localStorage.removeItem('offline_records');
          toast.success('Pontos offline sincronizados com sucesso!');
          fetchRecords();
        } catch (error) {
          console.error('Erro ao sincronizar pontos offline:', error);
          toast.error('Falha ao sincronizar pontos offline. Tentaremos novamente depois.');
        }
      }
    };
    window.addEventListener('online', handleOnline);
    if (navigator.onLine) {
      handleOnline();
    }
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchRecords]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleOnlineStatus = () => setIsOnline(true);
    const handleOfflineStatus = () => setIsOnline(false);

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOfflineStatus);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA installation outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchRecords();
    const channel = supabase
      .channel('records-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, () => {
        fetchRecords();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchRecords]);

  // 3. Lista de estagiários
  const fetchInterns = useCallback(async () => {
    if (!user) return;
    const role = user.user_metadata?.role;
    if (role !== 'supervisor' && role !== 'intern_unit') return;
    try {
      // Otimização: Selecionar campos leves, excluindo a coluna de documentos com arquivos Base64 grandes
      const { data, error } = await supabase
        .from('interns')
        .select('*')
        .order('name', { ascending: true });
      if (error) {
        console.error('Erro ao buscar estagiários:', error);
      } else {
        setInterns((data || []).map(mapInternFromDb));
      }
    } catch (err) {
      console.error('Erro ao carregar estagiários:', err);
    } finally {
      setInternsLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const role = user.user_metadata?.role;
    if (role !== 'supervisor' && role !== 'intern_unit') return;
    fetchInterns();
    const channel = supabase
      .channel('interns-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interns' }, () => {
        fetchInterns();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchInterns]);

  // Garante a existência do estagiário "TEste" para testes do usuário
  useEffect(() => {
    if (user && user.user_metadata?.role === 'supervisor' && internsLoaded) {
      const hasTest = interns.some(i => i.name.toLowerCase() === 'teste');
      if (!hasTest) {
        supabase.rpc('create_intern_user', {
          p_email: 'teste.estagio@portoterapia.com',
          p_password: '0000',
          p_name: 'TEste',
          p_course: 'Psicologia Clínica',
          p_institution: 'UFPA',
          p_shift: 'Tarde',
          p_daily_hours: 6,
          p_unit_id: units[0]?.id || 'antonio-barreto',
          p_start_date: new Date().toISOString().split('T')[0],
          p_end_date: new Date(Date.now() + 365 * 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        })
        .then(({ error }) => {
          if (error) console.error('Erro ao criar estagiário TEste:', error);
          else {
            console.log('Estagiário TEste criado automaticamente via RPC.');
            fetchInterns();
          }
        });
      }
    }
  }, [user, interns, internsLoaded, units, fetchInterns]);

  // 4. Configuração das unidades
  const fetchUnits = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      console.error('Erro ao buscar unidades:', error);
    } else if (data && data.length) {
      const mapped = data.map(mapUnitFromDb);
      setUnits(mapped);
      
      // Auto-update units in database to 5km if they are still 0.1km or less than 5km
      const needsUpdate = mapped.some(u => u.radiusKm < 5);
      if (needsUpdate) {
        const updated = mapped.map(u => ({
          ...u,
          radiusKm: 5,
          radiusM: 5000
        }));
        const dbUnits = updated.map(mapUnitToDb);
        supabase.from('units').upsert(dbUnits).then(({ error: upsertError }) => {
          if (upsertError) {
            console.error('Erro ao auto-atualizar unidades para 5km:', upsertError);
          } else {
            console.log('Unidades auto-atualizadas para 5km com sucesso.');
            setUnits(updated);
          }
        });
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchUnits();
    const channel = supabase
      .channel('units-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, () => {
        fetchUnits();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnits]);


  // Relógio
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- CONTROLE FACIAL & RADAR GEOLOCALIZAÇÃO ---
  const startCamera = async () => {
    setCameraError('');
    setCapturedPhoto('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      streamRef.current = stream;
      setCameraStream(stream);
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("Erro ao acessar câmera:", err);
      setCameraError('Permissão da câmera negada ou dispositivo sem câmera. Preencha justificativa para registrar sem foto.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraStream(null);
    setIsCameraActive(false);
  };

  const fetchGpsForRadar = async () => {
    setGpsLoading(true);
    setGpsRadarError('');
    try {
      const pos = await getCurrentPosition();
      const { latitude, longitude, accuracy } = pos.coords;
      setCurrentGPS({ lat: latitude, lng: longitude, accuracy });
    } catch (err) {
      console.error("Radar GPS error:", err);
      setGpsRadarError(geoErrorMessage(err));
    } finally {
      setGpsLoading(false);
    }
  };

  // Efeito para ativar câmera e GPS ao selecionar estagiário
  useEffect(() => {
    if (selectedIntern) {
      startCamera();
      fetchGpsForRadar();
    } else {
      stopCamera();
      setCurrentGPS(null);
      setForceManualPoint(false);
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [selectedIntern]);

  // Loop de Detecção Facial em tempo real para Bipagem e Ponto Automático
  const faceDetectionLoopRef = useRef(null);

  useEffect(() => {
    let active = true;
    if (!isCameraActive || !selectedIntern || forceManualPoint || showSuccess || currentView !== 'kiosk') {
      if (faceDetectionLoopRef.current) {
        cancelAnimationFrame(faceDetectionLoopRef.current);
        faceDetectionLoopRef.current = null;
      }
      return;
    }

    const runLoop = async () => {
      if (!active || !videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        if (active) faceDetectionLoopRef.current = requestAnimationFrame(runLoop);
        return;
      }

      const intern = loggedInIntern?.role === 'intern_unit'
        ? interns.find((i) => i.id === selectedIntern)
        : loggedInIntern;
      
      if (!intern) {
        if (active) faceDetectionLoopRef.current = requestAnimationFrame(runLoop);
        return;
      }

      let targetDescriptor = intern.faceDescriptor;
      if ((!targetDescriptor || targetDescriptor === '[]') && intern.photo) {
        try {
          const refDesc = await getFaceDescriptor(intern.photo);
          if (refDesc) {
            targetDescriptor = JSON.stringify(refDesc);
          }
        } catch (e) {
          console.error("Erro ao obter biometria de referência no loop:", e);
        }
      }

      if (targetDescriptor && targetDescriptor !== '[]') {
        try {
          const detection = await faceapi
            .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.25 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detection && detection.descriptor && active) {
            const pointDescriptor = Array.from(detection.descriptor);
            const { isMatch, distance } = compareFaces(targetDescriptor, pointDescriptor, 0.45);
            console.log(`[LOOP BIOMETRIA] Comparando rosto... Distância: ${distance.toFixed(3)}, Match: ${isMatch}`);
            
            if (isMatch && active) {
              active = false; // Bloqueia novos acionamentos

              // Emitir som de Bip
              try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime);
                gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.15);
              } catch (audioErr) {
                console.warn("Som de bip falhou:", audioErr);
              }

              toast.success("Rosto identificado! Registrando ponto automaticamente...");
              
              // Executa a batida de ponto simulando o envio do form
              setTimeout(() => {
                const pointForm = document.querySelector('form');
                if (pointForm) {
                  pointForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
              }, 150);
              return;
            }
          }
        } catch (err) {
          console.error("Erro na detecção em tempo real:", err);
        }
      }

      // Evita sobrecarga de CPU adicionando um delay de 400ms
      await new Promise(resolve => setTimeout(resolve, 400));
      if (active) {
        faceDetectionLoopRef.current = requestAnimationFrame(runLoop);
      }
    };

    faceDetectionLoopRef.current = requestAnimationFrame(runLoop);

    return () => {
      active = false;
      if (faceDetectionLoopRef.current) {
        cancelAnimationFrame(faceDetectionLoopRef.current);
        faceDetectionLoopRef.current = null;
      }
    };
  }, [isCameraActive, selectedIntern, forceManualPoint, showSuccess, loggedInIntern, interns, currentView]);

  // --- CONTROLE DE LOGIN INDIVIDUAL ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setGpsLoading(true);

    const password = loginPassword.trim();

    if (!password) {
      setLoginError('Digite a senha de acesso.');
      setGpsLoading(false);
      return;
    }

    let email = '';
    if (selectedLoginOption === 'supervisor') {
      email = 'supervisor@portoterapia.com';
    } else if (selectedLoginOption === 'antonio-barreto') {
      email = 'antoniobarreto@portoterapia.com';
    } else if (selectedLoginOption === 'generalissimo') {
      email = 'generalissimo@portoterapia.com';
    } else {
      setLoginError('Selecione uma opção de acesso.');
      setGpsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setLoginError('Senha incorreta.');
        } else {
          setLoginError('Erro ao fazer login: ' + error.message);
        }
        return;
      }

      setLoginUsername('');
      setLoginPassword('');
      setSelectedLoginOption(null);
    } catch (err) {
      console.error('Erro de login:', err);
      setLoginError('Erro ao conectar ao servidor.');
    } finally {
      setGpsLoading(false);
    }
  };

  // Login direto sem senha para o perfil de quiosque de estagiários por unidade
  const handleDirectUnitLogin = async (unitOption) => {
    setLoginError('');
    setGpsLoading(true);
    let email = '';
    if (unitOption === 'antonio-barreto') {
      email = 'antoniobarreto@portoterapia.com';
    } else if (unitOption === 'generalissimo') {
      email = 'generalissimo@portoterapia.com';
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: 'estagio123',
      });

      if (error) {
        setLoggedInIntern({
          id: `kiosk-${unitOption}`,
          name: unitOption === 'antonio-barreto' ? 'Estagiário Antônio Barreto' : 'Estagiário Generalíssimo',
          role: 'intern_unit',
          unitId: unitOption,
          isFirstLogin: false
        });
        setSelectedIntern('');
        setSelectedUnit(unitOption);
        setCurrentView('kiosk');
      }
    } catch (err) {
      console.error('Erro ao acessar quiosque da unidade:', err);
      setLoggedInIntern({
        id: `kiosk-${unitOption}`,
        name: unitOption === 'antonio-barreto' ? 'Estagiário Antônio Barreto' : 'Estagiário Generalíssimo',
        role: 'intern_unit',
        unitId: unitOption,
        isFirstLogin: false
      });
      setSelectedIntern('');
      setSelectedUnit(unitOption);
      setCurrentView('kiosk');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleLogout = async () => {
    stopCamera();
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      console.error('Erro ao efetuar logout:', err);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordChangeError('');
    
    if (!newPassword.trim() || !confirmNewPassword.trim()) {
      setPasswordChangeError('Preencha todos os campos.');
      return;
    }

    if (newPassword.trim() === '0000') {
      setPasswordChangeError('A nova senha deve ser diferente da inicial "0000".');
      return;
    }

    if (newPassword.length < 4) {
      setPasswordChangeError('A nova senha deve conter pelo menos 4 caracteres.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError('As senhas não coincidem.');
      return;
    }

    try {
      const { error } = await supabase.rpc('change_intern_password', {
        p_intern_id: loggedInIntern.id,
        p_new_password: newPassword.trim()
      });
      if (error) throw error;

      // Recarregar os dados do estagiário
      const { data: updatedData, error: loadError } = await supabase
        .from('interns')
        .select('*')
        .eq('id', loggedInIntern.id)
        .single();
      if (loadError) throw loadError;

      const updated = mapInternFromDb(updatedData);
      setLoggedInIntern(updated);
      setNewPassword('');
      setConfirmNewPassword('');
      alert('Senha alterada com sucesso! Você já pode bater o seu ponto.');
    } catch (err) {
      console.error("Erro ao alterar senha:", err);
      setPasswordChangeError('Erro ao salvar nova senha no banco de dados.');
    }
  };

  const handleResetPassword = async (intern) => {
    const ok = window.confirm(`Deseja realmente resetar a senha do estagiário "${intern.name}" para a inicial "0000"?`);
    if (!ok) return;

    try {
      const { error } = await supabase.rpc('reset_intern_password', {
        p_intern_id: intern.id,
        p_new_password: '0000'
      });
      if (error) throw error;
      alert('Senha resetada com sucesso! A nova senha inicial é 0000.');
    } catch (err) {
      console.error("Erro ao resetar senha:", err);
      alert('Erro ao resetar senha.');
    }
  };

  // Unidade padrão selecionada no quiosque
  useEffect(() => {
    if (!selectedUnit && units.length) setSelectedUnit(units[0].id);
  }, [units, selectedUnit]);

  // ============================================================
  // CÁLCULO DE HORAS (acumulado diário / semanal por estagiário)
  // ============================================================
  const hoursSummary = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = startOfWeek();

    // Filtra estagiários por unidade primeiro
    const filteredInterns = interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit);
    const filteredInternNames = new Set(filteredInterns.map(i => i.name));

    // Agrupa por estagiário + dia
    const daily = {};
    records.forEach((r) => {
      // Se estiver filtrando, apenas processa registros de estagiários daquela unidade
      const matchesUnit = filterUnit === 'all' || r.geo?.unitId === filterUnit || filteredInternNames.has(r.internName);
      if (!matchesUnit) return;

      const d = new Date(r.timestamp);
      const dateKey = d.toLocaleDateString('pt-BR');
      const key = `${r.internName}|${dateKey}`;
      if (!daily[key]) daily[key] = { name: r.internName, day: new Date(d), events: [] };
      daily[key].events.push({ action: r.action, time: d.getTime() });
    });

    const per = {}; // nome -> { today, week }
    Object.values(daily).forEach((g) => {
      g.events.sort((a, b) => a.time - b.time);
      let totalMs = 0;
      let lastEntradaTime = null;
      g.events.forEach((e) => {
        if (e.action === 'entrada') {
          if (lastEntradaTime === null) {
            lastEntradaTime = e.time;
          }
        } else if (e.action === 'saida') {
          if (lastEntradaTime !== null) {
            totalMs += (e.time - lastEntradaTime);
            lastEntradaTime = null;
          }
        }
      });
      const hrs = totalMs / (1000 * 60 * 60);
      if (hrs <= 0) return;
      const dayStart = new Date(g.day);
      dayStart.setHours(0, 0, 0, 0);
      if (!per[g.name]) per[g.name] = { today: 0, week: 0 };
      if (dayStart.getTime() === todayStart.getTime()) per[g.name].today += hrs;
      if (dayStart >= weekStart) per[g.name].week += hrs;
    });

    // Monta a partir da lista de estagiários filtrados (inclui quem tem 0h)
    const rows = filteredInterns.map((i) => ({
      name: i.name,
      today: per[i.name]?.today || 0,
      week: per[i.name]?.week || 0,
    }));
    
    // Se filterUnit === 'all', incluir nomes que aparecem em registros mas não estão mais cadastrados
    if (filterUnit === 'all') {
      Object.keys(per).forEach((name) => {
        if (!rows.find((r) => r.name === name)) {
          rows.push({ name, today: per[name].today, week: per[name].week, removed: true });
        }
      });
    }
    rows.sort((a, b) => b.week - a.week);
    return rows;
  }, [records, interns, filterUnit]);

  // Alertas de carga horária diária (> 6h)
  useEffect(() => {
    const grouped = {};
    const filteredInterns = interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit);
    const filteredInternNames = new Set(filteredInterns.map(i => i.name));

    records.forEach((r) => {
      // Filtra por unidade se selecionada
      if (filterUnit !== 'all' && !filteredInternNames.has(r.internName)) return;

      const d = new Date(r.timestamp);
      const dateKey = d.toLocaleDateString('pt-BR');
      const key = `${r.internName}|${dateKey}`;
      if (!grouped[key]) grouped[key] = { internName: r.internName, date: dateKey, events: [] };
      grouped[key].events.push({ action: r.action, time: d.getTime() });
    });
    const alerts = [];
    Object.values(grouped).forEach((group) => {
      group.events.sort((a, b) => a.time - b.time);
      let totalMs = 0;
      let lastEntradaTime = null;
      group.events.forEach((e) => {
        if (e.action === 'entrada') {
          if (lastEntradaTime === null) {
            lastEntradaTime = e.time;
          }
        } else if (e.action === 'saida') {
          if (lastEntradaTime !== null) {
            totalMs += (e.time - lastEntradaTime);
            lastEntradaTime = null;
          }
        }
      });
      const diffHours = totalMs / (1000 * 60 * 60);
      if (diffHours > LABOR.maxDailyHours) {
        alerts.push({ internName: group.internName, date: group.date, hours: diffHours.toFixed(1) });
      }
    });
    setHoursAlerts(alerts);
  }, [records, interns, filterUnit]);

  // Motor de Auditoria de Ponto Retroativo de 30 dias com Sincronização
  const runPointAudit = useCallback(async () => {
    if (!user || user.user_metadata?.role !== 'supervisor') return;
    
    // Obter data de 30 dias atrás
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    // Buscar todos os registros dos últimos 30 dias para auditoria completa
    const { data: recentRecords, error: recordsError } = await supabase
      .from('records')
      .select('*')
      .gte('timestamp', `${thirtyDaysAgoStr}T00:00:00Z`);

    if (recordsError || !recentRecords) {
      console.error("Erro ao carregar registros para auditoria:", recordsError);
      return;
    }

    const mappedRecords = recentRecords.map(mapRecordFromDb);

    // Agrupar registros por estagiário e data (YYYY-MM-DD)
    const grouped = {};
    mappedRecords.forEach(r => {
      if (!r.internId) return;
      const dateStr = new Date(r.timestamp).toISOString().split('T')[0];
      const key = `${r.internId}|${dateStr}`;
      if (!grouped[key]) {
        grouped[key] = {
          internId: r.internId,
          internName: r.internName,
          date: dateStr,
          entradas: [],
          saidas: [],
          ocorrencias: []
        };
      }
      if (r.action === 'entrada') grouped[key].entradas.push(r);
      else if (r.action === 'saida') grouped[key].saidas.push(r);
      else if (r.action === 'ocorrencia') grouped[key].ocorrencias.push(r);
    });

    const newAuditAlerts = [];
    const activeSupervisorInterns = interns.filter(i => i.active !== false);

    // Gerar lista dos últimos 30 dias (excluindo hoje)
    const dateList = [];
    for (let i = 1; i <= 30; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      dateList.push(d.toISOString().split('T')[0]);
    }

    activeSupervisorInterns.forEach(intern => {
      const contractStartStr = intern.startDate || '1970-01-01';

      dateList.forEach(dateStr => {
        if (dateStr < contractStartStr) return;

        const key = `${intern.id}|${dateStr}`;
        const dayData = grouped[key] || { internId: intern.id, internName: intern.name, date: dateStr, entradas: [], saidas: [], ocorrencias: [] };

        const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Se não houver batidas, pula
        if (dayData.entradas.length === 0 && dayData.saidas.length === 0 && dayData.ocorrencias.length === 0) {
          return; 
        }

        // 1. Ausência de marcação
        if (dayData.entradas.length > 0 && dayData.saidas.length === 0) {
          newAuditAlerts.push({
            internId: intern.id,
            internName: intern.name,
            date: dateStr,
            type: 'ausencia_saida',
            desc: `Ausência de marcação de saída no dia ${new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')}`
          });
        } else if (dayData.saidas.length > 0 && dayData.entradas.length === 0) {
          newAuditAlerts.push({
            internId: intern.id,
            internName: intern.name,
            date: dateStr,
            type: 'ausencia_entrada',
            desc: `Ausência de marcação de entrada no dia ${new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')}`
          });
        }

        // 2. Horários Divergentes
        if (dayData.entradas.length > 0 && dayData.saidas.length > 0) {
          const firstEntrada = new Date(dayData.entradas[0].timestamp);
          const lastSaida = new Date(dayData.saidas[dayData.saidas.length - 1].timestamp);
          const diffHours = (lastSaida.getTime() - firstEntrada.getTime()) / (1000 * 60 * 60);

          const limitHours = Number(intern.dailyHours) || 6;
          if (diffHours > (limitHours + 0.5)) {
            newAuditAlerts.push({
              internId: intern.id,
              internName: intern.name,
              date: dateStr,
              type: 'excesso_jornada',
              desc: `Jornada de ${diffHours.toFixed(1)}h excede o limite de ${limitHours}h no dia ${new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')}`
            });
          }

          const shift = (intern.shift || 'Manhã').toLowerCase();
          const entHour = firstEntrada.getHours();

          let shiftDivergent = false;
          if (shift === 'manhã' && (entHour < 5 || entHour > 12)) shiftDivergent = true;
          else if (shift === 'tarde' && (entHour < 11 || entHour > 17)) shiftDivergent = true;
          else if (shift === 'noite' && (entHour < 16 || entHour > 21)) shiftDivergent = true;

          if (shiftDivergent) {
            newAuditAlerts.push({
              internId: intern.id,
              internName: intern.name,
              date: dateStr,
              type: 'turno_incompativel',
              desc: `Entrada às ${firstEntrada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} diverge do turno ${intern.shift} no dia ${new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')}`
            });
          }
        }
      });
    });

    setAuditAlerts(newAuditAlerts);

    // Sincronizar com banco de dados
    const existingSystemOccurrences = mappedRecords.filter(r => 
      r.action === 'ocorrencia' && 
      (r.justification || '').startsWith('[AUDITORIA SISTÊMICA]')
    );

    for (const alert of newAuditAlerts) {
      const alreadySaved = existingSystemOccurrences.some(r => 
        r.internId === alert.internId && 
        new Date(r.timestamp).toISOString().split('T')[0] === alert.date &&
        r.justification === `[AUDITORIA SISTÊMICA] ${alert.desc}`
      );

      if (!alreadySaved) {
        await supabase.from('records').insert({
          intern_id: alert.internId,
          intern_name: alert.internName,
          action: 'ocorrencia',
          justification: `[AUDITORIA SISTÊMICA] ${alert.desc}`,
          timestamp: new Date(`${alert.date}T12:00:00`).toISOString(),
          days_away: 0,
          geo: { type: 'auditoria', alertType: alert.type }
        });
      }
    }

    for (const record of existingSystemOccurrences) {
      const dateStr = new Date(record.timestamp).toISOString().split('T')[0];
      const stillDivergent = newAuditAlerts.some(alert => 
        alert.internId === record.internId && 
        alert.date === dateStr &&
        `[AUDITORIA SISTÊMICA] ${alert.desc}` === record.justification
      );

      if (!stillDivergent) {
        await supabase.from('records').delete().eq('id', record.id);
      }
    }
  }, [user, interns]);

  useEffect(() => {
    runPointAudit();
  }, [records, interns, runPointAudit]);

  // Rotina de Backup de Registros e Cadastros
  const handleManualBackup = useCallback(async () => {
    try {
      const { data: internsData } = await supabase.from('interns').select('*');
      const { data: recordsData } = await supabase.from('records').select('*');
      const { data: unitsData } = await supabase.from('units').select('*');

      const backupObj = {
        exportedAt: new Date().toISOString(),
        interns: internsData || [],
        records: recordsData || [],
        units: unitsData || []
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `backup_porto_terapia_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      toast.success("Backup manual gerado e baixado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar backup de segurança.");
    }
  }, []);

  const runAutomaticBackupCheck = useCallback(async () => {
    const savedConfig = localStorage.getItem('app_configuracoes');
    if (!savedConfig) return;
    const config = JSON.parse(savedConfig);

    const interval = config.backupIntervalo || 'semanal';
    if (interval === 'desativado') return;

    const email = config.emailBackup || config.emailNotificacoes || 'rh@portoterapia.com.br';
    const lastBackupStr = localStorage.getItem('porto_last_backup_date');
    const now = Date.now();

    let shouldBackup = false;
    if (!lastBackupStr) {
      shouldBackup = true;
    } else {
      const lastBackupTime = new Date(lastBackupStr).getTime();
      const diffDays = (now - lastBackupTime) / (1000 * 60 * 60 * 24);

      if (interval === 'diario' && diffDays >= 1) shouldBackup = true;
      else if (interval === 'semanal' && diffDays >= 7) shouldBackup = true;
      else if (interval === 'mensal' && diffDays >= 30) shouldBackup = true;
    }

    if (shouldBackup) {
      try {
        const { data: internsData } = await supabase.from('interns').select('*');
        const { data: recordsData } = await supabase.from('records').select('*');
        const { data: unitsData } = await supabase.from('units').select('*');

        const backupObj = {
          exportedAt: new Date().toISOString(),
          interns: internsData || [],
          records: recordsData || [],
          units: unitsData || []
        };

        console.log(`[BACKUP AUTOMÁTICO] Enviando backup consolidado para ${email}...`, backupObj);
        
        toast.info(`Iniciando backup automático (${interval})...`);
        setTimeout(() => {
          toast.success(`Backup programado enviado com sucesso para o e-mail: ${email}`);
          localStorage.setItem('porto_last_backup_date', new Date().toISOString());
        }, 1500);

      } catch (err) {
        console.error("Falha ao executar backup programado:", err);
      }
    }
  }, []);

  useEffect(() => {
    window.handleManualBackupTrigger = handleManualBackup;
    return () => {
      delete window.handleManualBackupTrigger;
    };
  }, [handleManualBackup]);

  useEffect(() => {
    if (user && user.user_metadata?.role === 'supervisor') {
      runAutomaticBackupCheck();
    }
  }, [user, runAutomaticBackupCheck]);

  // Chat Estagiário-Supervisor (Fale com a Supervisão)
  const handleSendChatMessage = async () => {
    if (!chatInternId) {
      toast.error("Por favor, selecione seu nome.");
      return;
    }
    if (!chatMessage.trim()) {
      toast.error("Por favor, digite uma mensagem.");
      return;
    }

    const selectedIntern = interns.find(i => i.id === chatInternId);
    if (!selectedIntern) return;

    setIsSendingChat(true);
    try {
      const { error } = await supabase.from('records').insert({
        intern_id: selectedIntern.id,
        intern_name: selectedIntern.name,
        action: 'supervisor_chat',
        justification: chatMessage.trim(),
        timestamp: new Date().toISOString(),
        geo: {
          type: 'chat',
          status: 'pending',
          internEmail: selectedIntern.email,
          reply: null,
          repliedAt: null
        }
      });

      if (error) throw error;

      toast.success("Mensagem enviada com sucesso!");
      setChatMessage('');
      setChatFeedback(`Sua mensagem foi enviada! O retorno será enviado para o e-mail: ${selectedIntern.email}`);
      fetchRecords();
    } catch (err) {
      console.error(err);
      toast.error("Falha ao enviar mensagem. Tente novamente.");
    } finally {
      setIsSendingChat(false);
    }
  };

  const renderChatWidget = () => {
    if (!user) return null;

    const isIndividualIntern = loggedInIntern && loggedInIntern.role !== 'intern_unit';

    return (
      <div className="fixed bottom-4 right-4 z-40">
        {!isChatOpen && (
          <button
            onClick={() => {
              setIsChatOpen(true);
              setChatFeedback('');
              if (isIndividualIntern) {
                setChatInternId(loggedInIntern.id);
              }
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-3.5 shadow-2xl flex items-center justify-center gap-2 transition-all hover:scale-105 duration-200 border border-indigo-500/20"
            title="Fale com a Supervisão"
          >
            <MessageSquare size={20} />
            <span className="text-xs font-bold pr-1">Fale com a Supervisão</span>
          </button>
        )}

        {isChatOpen && (
          <div className="bg-white border border-slate-200 rounded-2xl w-80 shadow-2xl overflow-hidden flex flex-col max-h-[420px] animate-fade-in">
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} />
                <span className="text-xs font-bold">Fale com a Supervisão</span>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-white hover:text-slate-200 text-sm font-bold p-1 leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {chatFeedback ? (
                <div className="text-center py-6 space-y-3">
                  <div className="text-3xl">✉️</div>
                  <p className="text-[11px] font-semibold text-slate-800 leading-normal">{chatFeedback}</p>
                  <button
                    onClick={() => setChatFeedback('')}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline"
                  >
                    Enviar outra mensagem
                  </button>
                </div>
              ) : (
                <>
                  {isIndividualIntern ? (
                    <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-lg">
                      <span className="block text-[10px] font-bold text-indigo-600 uppercase mb-0.5">Estagiário(a):</span>
                      <span className="text-xs font-bold text-slate-800">{loggedInIntern.name}</span>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Selecione seu nome:</label>
                      <select
                        value={chatInternId}
                        onChange={(e) => setChatInternId(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      >
                        <option value="" disabled>Selecione...</option>
                        {interns
                          .filter(i => i.active !== false && (!loggedInIntern || loggedInIntern.role !== 'intern_unit' || i.unitId === loggedInIntern.unitId))
                          .map(i => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sua Mensagem ou Dúvida:</label>
                    <textarea
                      rows={4}
                      placeholder="Descreva aqui sua solicitação de ajuste, dúvida ou problema..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                    />
                  </div>

                  <button
                    onClick={handleSendChatMessage}
                    disabled={isSendingChat}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-xs transition-all shadow flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSendingChat ? 'Enviando...' : 'Enviar Mensagem'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---- Gemini ----
  const fetchWithRetry = async (url, options, retries = 5) => {
    const delays = [1000, 2000, 4000, 8000, 16000];
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise((res) => setTimeout(res, delays[i]));
      }
    }
  };

  const extractBirthdateFromDoc = async (base64Content) => {
    if (!apiKey) return null;
    try {
      const splitParts = base64Content.split(';base64,');
      if (splitParts.length < 2) return null;
      const mimeType = splitParts[0].replace('data:', '');
      const rawData = splitParts[1];

      const prompt = `Analise a imagem deste documento (RG ou CPF) e extraia a data de nascimento. Retorne APENAS a data no formato YYYY-MM-DD (ex: 2002-11-20). Se não for possível encontrar ou a imagem estiver ilegível, responda apenas 'NOT_FOUND'.`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: rawData } }
            ]
          }]
        })
      });

      if (!response.ok) throw new Error("Erro no Gemini API");
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text && text !== 'NOT_FOUND' && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return text;
      }
    } catch (err) {
      console.error("Erro na extração de data de nascimento via Gemini:", err);
    }
    return null;
  };

  const handleImproveJustification = async () => {
    if (!justification.trim()) return;
    if (!apiKey) { alert('Recurso de IA não configurado (defina VITE_GEMINI_API_KEY no arquivo .env).'); return; }
    setIsImproving(true);
    try {
      const prompt = `Você é um assistente de RH de uma clínica. Reescreva a seguinte justificativa de ponto de um estagiário para que fique mais formal, clara e concisa (máximo 2 frases). Mantenha o motivo original. Texto original: "${justification}"`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const result = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const improvedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (improvedText) setJustification(improvedText.trim());
    } catch (error) {
      console.error('Erro ao melhorar texto:', error);
    } finally {
      setIsImproving(false);
    }
  };

  const handleAnalyzeRecords = async () => {
    if (filteredRecords.length === 0) return;
    if (!apiKey) { setAiSummary('Recurso de IA não configurado (defina VITE_GEMINI_API_KEY no arquivo .env).'); return; }
    setIsAnalyzing(true);
    try {
      const recordsText = JSON.stringify(
        filteredRecords.slice(0, 50).map((r) => ({
          nome: r.internName, acao: r.action, dataHora: r.timestamp,
          unidade: r.geo?.unitName, justificativa: r.justification,
        }))
      );
      const prompt = `Analise os seguintes registros de ponto de estagiários de uma clínica (2 unidades). Faça um breve resumo gerencial destacando padrões, anomalias ou justificativas notáveis. Seja conciso e profissional. Registros: ${recordsText}`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const result = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const analysis = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (analysis) setAiSummary(analysis);
    } catch (error) {
      console.error('Erro ao analisar registros:', error);
      setAiSummary('Não foi possível gerar a análise no momento.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ---- Último movimento do dia (evita erros) ----
  const lastActionToday = (internName) => {
    const today = new Date().toLocaleDateString('pt-BR');
    const todays = records
      .filter((r) => r.internName === internName && new Date(r.timestamp).toLocaleDateString('pt-BR') === today)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return todays.length ? todays[todays.length - 1].action : null;
  };

  // ---- REGISTRO DE PONTO com GPS + unidade + Câmera ----
  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeoError('');
    if (!selectedIntern || !user) return;

    const intern = loggedInIntern?.role === 'intern_unit'
      ? interns.find((i) => i.id === selectedIntern)
      : loggedInIntern;
    const unit = units.find((u) => u.id === selectedUnit);
    if (!intern) return;
    if (!unit) { setGeoError('Selecione a unidade onde você está registrando.'); return; }

    const last = lastActionToday(intern.name);
    if (actionType === 'entrada' && last === 'entrada') {
      setGeoError('Já existe uma ENTRADA em aberto hoje para este estagiário. Registre a SAÍDA primeiro.');
      return;
    }
    if (actionType === 'saida' && last !== 'entrada') {
      setGeoError('Não há uma ENTRADA registrada hoje. Registre a ENTRADA antes da saída.');
      return;
    }

    // Restrição de Acesso ao Ponto: Desativação do fallback de senha para estagiários nas Unidades Antônio Barreto e Generalíssimo
    const isRestrictedUnit = ['antonio-barreto', 'generalissimo'].includes(unit.id);
    if (isRestrictedUnit && (forceManualPoint || !isCameraActive)) {
      setGeoError('Acesso Negado: A modalidade de autenticação por senha (PIN/Credential) ou registro manual foi desativada para o perfil de estagiários nas Unidades Antônio Barreto e Generalíssimo. É obrigatório o uso de biometria facial e geolocalização.');
      return;
    }

    // Captura da foto facial
    let photoBase64 = '';
    if (isCameraActive && !forceManualPoint) {
      if (videoRef.current) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 400;
          canvas.height = 300;
          const ctx = canvas.getContext('2d');
          // Inverte horizontalmente para o snapshot coincidir com o espelho do preview
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          ctx.setTransform(1, 0, 0, 1, 0, 0); // limpa transformações
          photoBase64 = canvas.toDataURL('image/jpeg', 0.6); // ~15kb
        } catch (e) {
          console.error("Erro ao capturar foto:", e);
        }
      }
      if (!photoBase64) {
        setGeoError('Falha ao capturar a foto do Controle Facial. Ative a câmera ou justifique para registrar sem foto.');
        return;
      }

      // Validação facial automática em tempo real
      let targetDescriptor = intern.faceDescriptor;

      // Se não tem faceDescriptor salvo mas possui foto cadastrada, tenta extrair em tempo real
      if ((!targetDescriptor || targetDescriptor === '[]') && intern.photo) {
        setGeoError('Extraindo biometria de referência da foto do cadastro...');
        try {
          const refDesc = await getFaceDescriptor(intern.photo);
          if (refDesc) {
            targetDescriptor = JSON.stringify(refDesc);
          }
        } catch (e) {
          console.error("Erro ao extrair biometria de referência:", e);
        }
      }

      if (!targetDescriptor || targetDescriptor === '[]') {
        setGeoError('Biometria facial não cadastrada para este estagiário. Cadastre a foto no painel de estagiários antes de registrar o ponto por Controle Facial.');
        return;
      }

      setGeoError('Validando biometria facial...');
      try {
        const pointDescriptor = await getFaceDescriptor(photoBase64);
        if (!pointDescriptor) {
          setGeoError('Não foi possível identificar seu rosto na imagem capturada. Centralize seu rosto na câmera e garanta boa iluminação.');
          return;
        }
        const { isMatch, distance } = compareFaces(targetDescriptor, pointDescriptor, 0.45);
        console.log(`[BIOMETRIA] Comparação realizada. Distância: ${distance.toFixed(3)}, Match: ${isMatch}`);
        if (!isMatch) {
          setGeoError(`Acesso negado por divergência biométrica facial (Diferença: ${distance.toFixed(2)}).`);
          return;
        }
      } catch (err) {
        console.error("Erro ao validar biometria:", err);
        setGeoError('Erro de processamento na biometria facial. Tente novamente.');
        return;
      }
    } else {
      if (isRestrictedUnit) {
        setGeoError('Acesso Negado: A modalidade de autenticação por senha (PIN/Credential) ou registro manual foi desativada para o perfil de estagiários nas Unidades Antônio Barreto e Generalíssimo. É obrigatório o uso de biometria facial e geolocalização.');
        return;
      }
      // Registro manual exige justificativa no RH
      if (!justification.trim()) {
        setGeoError('Justificativa obrigatória para registro de ponto sem Controle Facial (Manual).');
        return;
      }
    }

    setIsLocating(true);

    // Converte comprovante de ocorrência (opcional) para base64
    let justDoc = null;
    const docInput = document.getElementById('justification-doc-input');
    const justFile = docInput?.files?.[0];
    if (justFile) {
      if (justFile.size > 2 * 1024 * 1024) {
        setGeoError('O documento comprobatório excede o limite de 2MB.');
        setIsLocating(false);
        return;
      }
      try {
        const base64 = await fileToBase64(justFile);
        justDoc = {
          name: justFile.name,
          size: (justFile.size / 1024).toFixed(1) + ' KB',
          type: justificationDocType,
          content: base64,
          uploadedAt: new Date().toISOString()
        };
      } catch (err) {
        console.error("Erro ao converter comprovante de ocorrência:", err);
      }
    }

    let pos;
    try {
      pos = await getCurrentPosition();
    } catch (err) {
      setGeoError(geoErrorMessage(err));
      setIsLocating(false);
      return;
    }

    const { latitude, longitude, accuracy } = pos.coords;
    const distanceKm = haversineKm(latitude, longitude, unit.lat, unit.lng);
    const distanceM = distanceKm * 1000;
    
    // Raio da Cerca Virtual permitido em metros
    const allowedRadiusM = Number(unit.radiusM) || (Number(unit.radiusKm) * 1000) || 1000;

    if (distanceM > allowedRadiusM) {
      setGeoError(
        `Você está a ${distanceM < 1000 ? `${Math.round(distanceM)} m` : `${(distanceM/1000).toFixed(2)} km`} da cerca da ${unit.name}. ` +
        `O registro só é permitido dentro de ${allowedRadiusM} metros. ` +
        `Aproxime-se do local e tente novamente.`
      );
      setIsLocating(false);
      return;
    }

    const newRecord = {
      internId: intern.id,
      internName: intern.name,
      action: actionType,
      justification,
      timestamp: new Date().toISOString(),
      photo: photoBase64 || null,
      isManual: !photoBase64,
      justificationDoc: justDoc,
      daysAway: Number(daysAway) || 0,
      geo: {
        lat: latitude,
        lng: longitude,
        accuracy: Math.round(accuracy || 0),
        distanceKm: Number(distanceKm.toFixed(3)),
        distanceM: Number(distanceM.toFixed(1)),
        unitId: unit.id,
        unitName: unit.name,
      },
    };

    try {
      const { error } = await supabase.from('records').insert([mapRecordToDb(newRecord)]);
      if (error) throw error;
      stopCamera(); // Desliga a câmera após bater o ponto
      setShowSuccess(true);
      
      // Limpeza de campos do ponto
      setJustification('');
      setDaysAway(0);
      if (docInput) docInput.value = '';
      setJustificationDocType('atestado');

      setTimeout(() => {
        setShowSuccess(false);
        handleLogout(); // Logout automático para o próximo estagiário
      }, 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('Network') || error.message.includes('fetch'))) {
        alert('O ponto foi salvo offline e será sincronizado quando houver internet.');
        const offlineRecords = JSON.parse(localStorage.getItem('offline_records') || '[]');
        offlineRecords.push(newRecord);
        localStorage.setItem('offline_records', JSON.stringify(offlineRecords));
        stopCamera();
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          handleLogout();
        }, 3000);
      } else {
        setGeoError('Erro ao conectar com o banco de dados. Tente novamente.');
      }
    } finally {
      setIsLocating(false);
    }
  };

  // ============================================================
  // GESTÃO DE ESTAGIÁRIOS (CRUD)
  // ============================================================
  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: '', course: '', institution: '', shift: 'Manhã', dailyHours: 6,
      unitId: (filterUnit !== 'all' ? filterUnit : (units[0]?.id || '')), active: true,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365 * 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 anos
      photo: '',
      cpf: '',
      email: '',
      rg: '',
      phone: '',
      address: '',
      bankName: '',
      bankAgency: '',
      bankAccount: '',
      pixKey: '',
      emergencyName: '',
      emergencyRelationship: 'Pais',
      emergencyPhone: '',
      allowance: 0,
      supervisorName: '',
      birthdate: '',
    });
  };

  const handleEditIntern = (intern) => {
    setEditingId(intern.id);
    setForm({
      name: intern.name || '',
      course: intern.course || '',
      institution: intern.institution || '',
      shift: intern.shift || 'Manhã',
      dailyHours: intern.dailyHours || 6,
      unitId: intern.unitId || units[0]?.id || '',
      active: intern.active !== false,
      startDate: intern.startDate || new Date().toISOString().split('T')[0],
      endDate: intern.endDate || new Date(Date.now() + 365 * 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      photo: intern.photo || '',
      cpf: intern.cpf || '',
      email: intern.email || '',
      rg: intern.rg || '',
      phone: intern.phone || '',
      address: intern.address || '',
      bankName: intern.bankName || '',
      bankAgency: intern.bankAgency || '',
      bankAccount: intern.bankAccount || '',
      pixKey: intern.pixKey || '',
      emergencyName: intern.emergencyName || '',
      emergencyRelationship: intern.emergencyRelationship || 'Pais',
      emergencyPhone: intern.emergencyPhone || '',
      allowance: Number(intern.allowance) || 0,
      supervisorName: intern.supervisorName || '',
      birthdate: intern.birthdate || '',
    });
  };

  const handleSaveIntern = async (e) => {
    e.preventDefault();
    
    // Validar se todos os campos estão preenchidos
    if (!form.name.trim() || !form.cpf.trim() || !form.email.trim() || !form.rg.trim() || 
        !form.phone.trim() || !form.course.trim() || !form.institution.trim() || !form.address.trim() || 
        !form.unitId || !form.shift || !form.startDate || !form.endDate || !form.birthdate ||
        !form.bankName.trim() || !form.bankAgency.trim() || !form.bankAccount.trim() || !form.pixKey.trim() || 
        !form.emergencyName.trim() || !form.emergencyRelationship || !form.emergencyPhone.trim()) {
      alert("Todos os campos do Cadastro de Estagiário são obrigatórios, incluindo a Data de Nascimento!");
      return;
    }

    // Foto obrigatória
    if (!form.photo) {
      alert("Por favor, adicione uma foto de cadastro (3x4).");
      return;
    }

    // Validar CPF
    if (!validateCPF(form.cpf)) {
      alert("Por favor, insira um CPF válido.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      course: form.course.trim(),
      institution: form.institution.trim(),
      shift: form.shift,
      dailyHours: Math.min(Math.max(Number(form.dailyHours) || 6, 1), 8),
      unitId: form.unitId || units[0]?.id || '',
      active: !!form.active,
      startDate: form.startDate,
      endDate: form.endDate,
      photo: form.photo,
      cpf: form.cpf.trim(),
      email: form.email.trim(),
      rg: form.rg.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      bankName: form.bankName.trim(),
      bankAgency: form.bankAgency.trim(),
      bankAccount: form.bankAccount.trim(),
      pixKey: form.pixKey.trim(),
      emergencyName: form.emergencyName.trim(),
      emergencyRelationship: form.emergencyRelationship,
      emergencyPhone: form.emergencyPhone.trim(),
      allowance: Number(form.allowance) || 0,
      supervisorName: form.supervisorName.trim(),
      birthdate: form.birthdate || null,
    };
    try {
      if (form.cpf) {
        const cleanCpf = form.cpf.replace(/\D/g, '');
        let formattedCpf = cleanCpf;
        if (cleanCpf.length === 11) {
          formattedCpf = `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9)}`;
        }
        const { data: existingCpfUsers, error: cpfError } = await supabase
          .from('interns')
          .select('id, name, cpf')
          .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf},cpf.eq.${form.cpf.trim()}`);
        if (cpfError) throw cpfError;
        const duplicate = existingCpfUsers?.find(intern => {
          const cleanDbCpf = (intern.cpf || '').replace(/\D/g, '');
          return cleanDbCpf === cleanCpf && intern.id !== editingId;
        });
        if (duplicate) {
          alert(`Duplicidade de Cadastro: Já existe um estagiário cadastrado com este CPF (${duplicate.name}).`);
          return;
        }
      }

      if (editingId) {
        const dbPayload = mapInternToDb(payload);
        delete dbPayload.last_report_date;
        delete dbPayload.recess_days_taken;
        delete dbPayload.semestral_reports;
        delete dbPayload.contract_termination;
        const { error } = await supabase
          .from('interns')
          .update(dbPayload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const email = payload.email || `${generateUsername(payload.name)}@portoterapia.com`;
        let createResult = await supabase.rpc('create_intern_user', {
          p_email: email,
          p_password: '0000',
          p_name: payload.name,
          p_course: payload.course,
          p_institution: payload.institution,
          p_shift: payload.shift,
          p_daily_hours: payload.dailyHours,
          p_unit_id: payload.unitId,
          p_start_date: payload.startDate,
          p_end_date: payload.endDate,
          p_photo: payload.photo || null,
          p_cpf: payload.cpf || null,
          p_rg: payload.rg || null,
          p_phone: payload.phone || null,
          p_address: payload.address || null,
          p_bank_name: payload.bankName || null,
          p_bank_agency: payload.bankAgency || null,
          p_bank_account: payload.bankAccount || null,
          p_pix_key: payload.pixKey || null,
          p_emergency_name: payload.emergencyName || null,
          p_emergency_relationship: payload.emergencyRelationship || 'Pais',
          p_emergency_phone: payload.emergencyPhone || null,
          p_allowance: Number(payload.allowance) || 0,
          p_supervisor_name: payload.supervisorName || null,
          p_birthdate: payload.birthdate || null,
          p_face_descriptor: payload.faceDescriptor || null
        });

        if (createResult.error) {
          console.warn("Tentando fallback de criação sem parâmetro de supervisor...", createResult.error);
          const fallbackResult = await supabase.rpc('create_intern_user', {
            p_email: email,
            p_password: '0000',
            p_name: payload.name,
            p_course: payload.course,
            p_institution: payload.institution,
            p_shift: payload.shift,
            p_daily_hours: payload.dailyHours,
            p_unit_id: payload.unitId,
            p_start_date: payload.startDate,
            p_end_date: payload.endDate,
            p_photo: payload.photo || null,
            p_cpf: payload.cpf || null,
            p_rg: payload.rg || null,
            p_phone: payload.phone || null,
            p_address: payload.address || null,
            p_bank_name: payload.bankName || null,
            p_bank_agency: payload.bankAgency || null,
            p_bank_account: payload.bankAccount || null,
            p_pix_key: payload.pixKey || null,
            p_emergency_name: payload.emergencyName || null,
            p_emergency_relationship: payload.emergencyRelationship || 'Pais',
            p_emergency_phone: payload.emergencyPhone || null,
            p_allowance: Number(payload.allowance) || 0,
            p_birthdate: payload.birthdate || null,
            p_face_descriptor: payload.faceDescriptor || null
          });
          if (fallbackResult.error) throw fallbackResult.error;
          const newId = fallbackResult.data;
          if (newId) {
            await supabase.from('interns').update({ supervisor_name: payload.supervisorName, birthdate: payload.birthdate || null, face_descriptor: payload.faceDescriptor || null }).eq('id', newId);
          }
        } else {
          const newId = createResult.data;
          if (newId) {
            await supabase.from('interns').update({ supervisor_name: payload.supervisorName, birthdate: payload.birthdate || null, face_descriptor: payload.faceDescriptor || null }).eq('id', newId);
          }
        }
      }
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar estagiário:', error);
      alert('Erro ao salvar estagiário: ' + (error.message || error));
    }
  };

  const handleDeleteIntern = async (intern) => {
    const ok = window.confirm(
      `Excluir o estagiário "${intern.name}"?\n\n` +
      `Os registros de ponto já feitos serão mantidos no histórico. Esta ação não pode ser desfeita.`
    );
    if (!ok) return;
    try {
      const { error } = await supabase.rpc('delete_intern_user', {
        p_intern_id: intern.id
      });
      if (error) throw error;
      if (editingId === intern.id) resetForm();
    } catch (error) {
      console.error('Erro ao excluir estagiário:', error);
      alert('Erro ao excluir estagiário.');
    }
  };

  const handleApproveRegistration = async (internId) => {
    const ok = window.confirm("Deseja realmente aprovar e validar o recadastro deste estagiário?");
    if (!ok) return;
    try {
      const { error } = await supabase
        .from('interns')
        .update({ registration_status: 'validated' })
        .eq('id', internId);
      if (error) throw error;
      alert("Cadastro validado com sucesso!");
      fetchInterns();
    } catch (err) {
      console.error("Erro ao aprovar cadastro:", err);
      alert("Erro ao validar cadastro: " + err.message);
    }
  };

  // ============================================================
  // CONFIGURAÇÃO DAS UNIDADES (coordenadas do GPS)
  // ============================================================
  const persistUnits = useCallback(async (data) => {
    const dbUnits = data.map(mapUnitToDb);
    const { error } = await supabase.from('units').upsert(dbUnits);
    if (error) console.error('Erro ao salvar unidades:', error);
  }, []);

  const updateUnitField = (unitId, field, value) => {
    setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, [field]: value } : u)));
  };

  const handleCalibrateUnit = async (unitId) => {
    setUnitMsg('');
    setSavingUnit(unitId);
    try {
      const pos = await getCurrentPosition();
      const updated = units.map((u) =>
        u.id === unitId
          ? { ...u, lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) }
          : u
      );
      setUnits(updated);
      await persistUnits(updated);
      setUnitMsg('Localização calibrada e salva com sucesso!');
    } catch (err) {
      setUnitMsg(geoErrorMessage(err));
    } finally {
      setSavingUnit('');
    }
  };

  const handleSaveUnits = async () => {
    setUnitMsg('');
    setSavingUnit('all');
    try {
      const normalized = units.map((u) => ({
        ...u,
        lat: Number(u.lat),
        lng: Number(u.lng),
        radiusM: Number(u.radiusM) || (Number(u.radiusKm) * 1000) || 5000,
        radiusKm: Number(u.radiusM) ? Number(u.radiusM) / 1000 : Number(u.radiusKm) || 5,
      }));
      await persistUnits(normalized);
      setUnitMsg('Configuração das unidades salva!');
    } catch (err) {
      setUnitMsg('Erro ao salvar configuração.');
    } finally {
      setSavingUnit('');
    }
  };

  const handleViewDocumentContent = async (internId, docKey, fallbackContent = null, fallbackName = '', docLabel = '') => {
    if (fallbackContent) {
      setViewDocBase64(fallbackContent);
      setViewDocName(fallbackName);
      setViewDocType(docLabel);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('document_contents')
        .select('content')
        .eq('intern_id', internId)
        .eq('doc_key', docKey)
        .single();
      if (error || !data) throw new Error('Não foi possível obter o conteúdo do documento no banco.');
      setViewDocBase64(data.content);
      setViewDocName(fallbackName || `${docKey}.pdf`);
      setViewDocType(docLabel || 'Documento');
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  // --- FUNÇÕES DE DOCUMENTOS ADMISSAO & MÉTRICAS DE RH ---
  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!selectedAdmissionalIntern) return;
    const intern = interns.find(i => i.id === selectedAdmissionalIntern);
    if (!intern) return;

    const fileInput = document.getElementById('admissional-file-input');
    const file = fileInput?.files?.[0];
    if (!file) {
      alert('Selecione um arquivo antes de enviar.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('O arquivo excede o tamanho máximo de 2MB. Compacte-o ou selecione um arquivo menor.');
      return;
    }

    setUploadingDoc(true);
    try {
      const base64 = await fileToBase64(file);
      const currentDocs = intern.documents || {};
      
      // Omitir o conteúdo Base64 grande nos metadados armazenados em interns.documents
      const updatedDocs = {
        ...currentDocs,
        [uploadDocType]: {
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          uploadedAt: new Date().toISOString()
        }
      };

      // 1. Atualizar metadados na tabela interns
      const { error } = await supabase
        .from('interns')
        .update({ documents: updatedDocs })
        .eq('id', intern.id);
      if (error) throw error;

      // 2. Gravar o conteúdo pesado em Base64 na tabela document_contents
      const { error: contentError } = await supabase
        .from('document_contents')
        .upsert({
          intern_id: intern.id,
          doc_key: uploadDocType,
          content: base64
        });
      if (contentError) throw contentError;

      if (fileInput) fileInput.value = '';
      alert('Documento anexado com sucesso!');
    } catch (err) {
      console.error("Erro no upload do documento:", err);
      alert('Ocorreu um erro ao processar o upload do documento.');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (internId, docKey) => {
    const ok = window.confirm('Deseja realmente remover este documento físico?');
    if (!ok) return;

    const intern = interns.find(i => i.id === internId);
    if (!intern) return;

    try {
      const currentDocs = { ...intern.documents };
      delete currentDocs[docKey];

      // 1. Atualizar metadados na tabela interns
      const { error } = await supabase
        .from('interns')
        .update({ documents: currentDocs })
        .eq('id', intern.id);
      if (error) throw error;

      // 2. Remover do document_contents
      const { error: contentError } = await supabase
        .from('document_contents')
        .delete()
        .eq('intern_id', intern.id)
        .eq('doc_key', docKey);
      if (contentError) throw contentError;

      alert('Documento removido com sucesso!');
    } catch (err) {
      console.error("Erro ao deletar documento:", err);
      alert('Erro ao excluir documento.');
    }
  };

  const handleSaveOcorrencia = async (e) => {
    e.preventDefault();
    if (!selectedOcorrenciaIntern) {
      alert('Selecione um estagiário.');
      return;
    }
    const intern = interns.find(i => i.id === selectedOcorrenciaIntern);
    if (!intern) {
      alert('Estagiário não encontrado.');
      return;
    }
    if (!ocorrenciaDesc.trim()) {
      alert('Justificativa/Descrição é obrigatória.');
      return;
    }

    const docInput = document.getElementById('ocorrencia-file-input');
    const justFile = docInput?.files?.[0];
    let justDoc = null;

    setOcorrenciaLoading(true);
    try {
      if (justFile) {
        if (justFile.size > 2 * 1024 * 1024) {
          alert('O arquivo de comprovante excede o limite de 2MB.');
          setOcorrenciaLoading(false);
          return;
        }
        const base64 = await fileToBase64(justFile);
        justDoc = {
          name: justFile.name,
          size: (justFile.size / 1024).toFixed(1) + ' KB',
          type: ocorrenciaType,
          content: base64,
          uploadedAt: new Date().toISOString()
        };
      }

      // 1. Criar registro em records
      const newRecord = {
        internId: intern.id,
        internName: intern.name,
        action: 'ocorrencia',
        justification: ocorrenciaDesc,
        timestamp: new Date(ocorrenciaStartDate + 'T12:00:00').toISOString(),
        photo: null,
        isManual: true,
        justificationDoc: justDoc,
        daysAway: Number(ocorrenciaDays) || 0,
        geo: {
          lat: 0,
          lng: 0,
          accuracy: 0,
          distanceKm: 0,
          distanceM: 0,
          unitId: intern.unitId || '',
          unitName: 'Lançado pela Gestão'
        }
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('records')
        .insert([mapRecordToDb(newRecord)])
        .select();

      if (insertError) throw insertError;

      const recordId = insertedData?.[0]?.id || Math.random().toString(36).substring(2, 9);

      // 2. Salvar metadados do documento na tabela interns, omitindo o conteúdo pesado
      if (justDoc) {
        const justDocMetadata = { ...justDoc };
        delete justDocMetadata.content;

        const currentDocs = intern.documents || {};
        const updatedDocs = {
          ...currentDocs,
          [`ocorrencia_${recordId}`]: {
            ...justDocMetadata,
            occurrenceId: recordId,
            period: `${ocorrenciaStartDate} a ${ocorrenciaEndDate}`,
            daysAway: Number(ocorrenciaDays) || 0,
            desc: ocorrenciaDesc
          }
        };

        const { error: updateError } = await supabase
          .from('interns')
          .update({ documents: updatedDocs })
          .eq('id', intern.id);

        if (updateError) throw updateError;

        // Salvar conteúdo no document_contents
        const { error: contentError } = await supabase
          .from('document_contents')
          .upsert({
            intern_id: intern.id,
            doc_key: `ocorrencia_${recordId}`,
            content: justDoc.content
          });
        if (contentError) throw contentError;
      }

      alert('Ocorrência registrada com sucesso!');
      setOcorrenciaDesc('');
      if (docInput) docInput.value = '';
      fetchRecords();
      fetchInterns();
    } catch (err) {
      console.error('Erro ao salvar ocorrência:', err);
      alert('Erro ao registrar ocorrência.');
    } finally {
      setOcorrenciaLoading(false);
    }
  };

  const handleDeleteOcorrencia = async (recordId, internId) => {
    const ok = window.confirm('Deseja realmente remover esta ocorrência?');
    if (!ok) return;

    try {
      const { error: deleteError } = await supabase
        .from('records')
        .delete()
        .eq('id', recordId);

      if (deleteError) throw deleteError;

      const intern = interns.find(i => i.id === internId);
      if (intern && intern.documents && intern.documents[`ocorrencia_${recordId}`]) {
        const currentDocs = { ...intern.documents };
        delete currentDocs[`ocorrencia_${recordId}`];

        const { error: updateError } = await supabase
          .from('interns')
          .update({ documents: currentDocs })
          .eq('id', intern.id);

        if (updateError) throw updateError;

        // Remover de document_contents
        await supabase
          .from('document_contents')
          .delete()
          .eq('intern_id', intern.id)
          .eq('doc_key', `ocorrencia_${recordId}`);
      }

      alert('Ocorrência removida com sucesso!');
      fetchRecords();
      fetchInterns();
    } catch (err) {
      console.error('Erro ao deletar ocorrência:', err);
      alert('Erro ao excluir ocorrência.');
    }
  };

  const getInternRhMetrics = (intern) => {
    const start = new Date(intern.startDate || intern.timestamp || new Date());
    const end = new Date(intern.endDate || new Date());
    const lastReport = intern.lastReportDate ? new Date(intern.lastReportDate) : null;
    const now = new Date();

    const diffMonthsTotal = (end - start) / (1000 * 60 * 60 * 24 * 30.4375);
    const monthsWorked = Math.max(0, (now - start) / (1000 * 60 * 60 * 24 * 30.4375));
    
    const isExceededLegalLimit = diffMonthsTotal > 24;
    const timeRemainingDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

    const recessAccrued = monthsWorked * 2.5;
    const recessTaken = Number(intern.recessDaysTaken) || 0;
    const recessBalance = Math.max(0, recessAccrued - recessTaken);

    let reportOverdue = false;
    let reportAgeMonths = 0;
    if (lastReport) {
      reportAgeMonths = (now - lastReport) / (1000 * 60 * 60 * 24 * 30.4375);
      if (reportAgeMonths > 6) {
        reportOverdue = true;
      }
    } else {
      if (monthsWorked > 6) {
        reportOverdue = true;
      }
    }

    const uploadedDocsCount = Object.keys(intern.documents || {}).length;
    const isAdmissionalComplete = uploadedDocsCount === ADMISSIONAL_DOCUMENTS.length;

    return {
      start,
      end,
      monthsWorked,
      diffMonthsTotal,
      isExceededLegalLimit,
      timeRemainingDays,
      recessAccrued,
      recessTaken,
      recessBalance,
      reportOverdue,
      reportAgeMonths,
      uploadedDocsCount,
      isAdmissionalComplete,
    };
  };

  // ---- Exportação CSV ----
  const handleExportCSV = () => {
    const headers = 'Data,Hora,Estagiário,Unidade,Movimentação,Distância (km),Justificativa\n';
    const csvContent = filteredRecords
      .map((r) => {
        const d = new Date(r.timestamp);
        const data = d.toLocaleDateString('pt-BR');
        const hora = d.toLocaleTimeString('pt-BR');
        const unidade = r.geo?.unitName ? `"${r.geo.unitName}"` : '';
        const dist = r.geo?.distanceKm != null ? r.geo.distanceKm : '';
        const just = r.justification ? `"${r.justification.replace(/"/g, '""')}"` : '';
        return `${data},${hora},"${r.internName}",${unidade},${r.action},${dist},${just}`;
      })
      .join('\n');

    const blob = new Blob([headers + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const unitSuffix = filterUnit === 'all' ? 'todas' : filterUnit;
    link.download = `frequencia_portoterapia_${unitSuffix}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const formatDate = (isoString) =>
    new Date(isoString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatTime = (isoString) =>
    new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const unitName = (id) => units.find((u) => u.id === id)?.name || '—';

  const activeInterns = interns.filter((i) => i.active !== false);

  // Registros filtrados por unidade (para histórico e exportação)
  const filteredRecords = filterUnit === 'all'
    ? records
    : records.filter((r) => r.geo?.unitId === filterUnit);

  // Ao escolher o estagiário, pré-seleciona a unidade padrão dele
  const onSelectIntern = (id) => {
    setSelectedIntern(id);
    setGeoError('');
    const intern = interns.find((i) => i.id === id);
    if (intern?.unitId && units.find((u) => u.id === intern.unitId)) {
      setSelectedUnit(intern.unitId);
    }
  };

  // ============================================================
  // VISTA DE QUIOSQUE (registro do estagiário com login individual)
  // ============================================================
  const internsOfCurrentUnit = useMemo(() => {
    const currentUnitId = loggedInIntern?.role === 'intern_unit' 
      ? loggedInIntern.unitId 
      : selectedUnit;
    return activeInterns
      .filter((i) => i.unitId === currentUnitId)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [activeInterns, loggedInIntern, selectedUnit]);

  const currentUnit = units.find((u) => u.id === selectedUnit);

  const renderKiosk = () => {
    // Caso o estagiário não esteja logado, exibe a tela de login simplificada
    if (!loggedInIntern) {
      const getOptionDetails = () => {
        switch (selectedLoginOption) {
          case 'supervisor':
            return { name: 'Supervisor Geral', email: 'supervisor@portoterapia.com' };
          case 'antonio-barreto':
            return { name: 'Estagiário - Unidade Antônio Barreto', email: 'antoniobarreto@portoterapia.com' };
          case 'generalissimo':
            return { name: 'Estagiário - Unidade Generalíssimo Deodoro', email: 'generalissimo@portoterapia.com' };
          default:
            return null;
        }
      };

      const optionDetails = getOptionDetails();

      return (
        <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden relative">
            <div className="bg-blue-600 p-6 text-white text-center relative flex flex-col items-center justify-center">
              <img src="/logo.jpg" alt="Logo Porto Terapia" className="h-16 w-auto mb-2 rounded-lg shadow-sm" />
              <h1 className="text-2xl font-bold mb-1">Porto Terapia</h1>
              <p className="text-blue-100 text-xs">Acesso ao Sistema de Estágios <span className="text-blue-200 text-[10px] ml-1">v1.1.0</span></p>
              <div className="mt-4 text-3xl font-light tracking-wider flex items-center justify-center gap-2">
                <Clock size={24} className="text-blue-200" />
                {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <p className="text-blue-200 text-[10px] mt-1">
                {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>

            <div className="p-6">
              {!selectedLoginOption ? (
                <div className="space-y-4">
                  <h3 className="text-center font-bold text-gray-700 text-sm mb-2">Quem está acessando?</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {/* Botão Supervisor */}
                    <button
                      type="button"
                      onClick={() => { setSelectedLoginOption('supervisor'); setLoginError(''); }}
                      className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center gap-4 text-left group"
                    >
                      <div className="p-2.5 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-200 transition-colors">
                        <Lock size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 text-sm">Supervisor Geral</h4>
                        <p className="text-[10px] text-gray-500">Painel administrativo, cadastros e relatórios (Exige Senha)</p>
                      </div>
                    </button>

                    {/* Botão Antônio Barreto */}
                    <button
                      type="button"
                      onClick={() => handleDirectUnitLogin('antonio-barreto')}
                      disabled={gpsLoading}
                      className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all flex items-center gap-4 text-left group disabled:opacity-50"
                    >
                      <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-lg group-hover:bg-emerald-200 transition-colors">
                        <Building2 size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-gray-800 text-sm">Estagiários - Antônio Barreto</h4>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">Sem Senha</span>
                        </div>
                        <p className="text-[10px] text-gray-500">Acesso direto ao ponto (Biometria + GPS)</p>
                      </div>
                    </button>

                    {/* Botão Generalíssimo */}
                    <button
                      type="button"
                      onClick={() => handleDirectUnitLogin('generalissimo')}
                      disabled={gpsLoading}
                      className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all flex items-center gap-4 text-left group disabled:opacity-50"
                    >
                      <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-lg group-hover:bg-indigo-200 transition-colors">
                        <Building2 size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-gray-800 text-sm">Estagiários - Generalíssimo</h4>
                          <span className="text-[9px] bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded">Sem Senha</span>
                        </div>
                        <p className="text-[10px] text-gray-500">Acesso direto ao ponto (Biometria + GPS)</p>
                      </div>
                    </button>
                  </div>

                  <div className="border-t border-gray-100 pt-4 mt-2 space-y-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentView('recadastro');
                        setCadastroCpfRgFile(null);
                        setCadastroMatriculaFile(null);
                        setCadastroSuccess(false);
                        setCadastroForm({
                          name: '', course: '', institution: '', shift: 'Manhã',
                          dailyHours: 6, unitId: units[0]?.id || '', active: true,
                          startDate: '', endDate: '', photo: '', cpf: '', email: '',
                          rg: '', phone: '', address: '', bankName: '', bankAgency: '',
                          bankAccount: '', pixKey: '', emergencyName: '', emergencyRelationship: 'Pais',
                          emergencyPhone: '', allowance: 0, supervisorName: '', birthdate: ''
                        });
                      }}
                      className="w-full p-4 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50/30 hover:bg-blue-50 hover:border-blue-500 transition-all flex items-center justify-between text-left group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-200 transition-colors">
                          <Sparkles size={20} className="animate-pulse text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-blue-800 text-sm">⚠️ Cadastro Obrigatório</h4>
                          <p className="text-[10px] text-blue-600/80">Faça o seu cadastro inicial obrigatório de estagiário</p>
                        </div>
                      </div>
                      <span className="text-blue-500 font-bold text-xs bg-white border border-blue-200 py-1 px-2.5 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">Iniciar &rarr;</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentView('autogestao_biometria');
                        setAutogestaoInternId('');
                        setAutogestaoCpf('');
                        setAutogestaoSuccess(false);
                        loadPublicInterns();
                      }}
                      className="w-full p-4 border-2 border-dashed border-indigo-300 rounded-xl bg-indigo-50/30 hover:bg-indigo-50 hover:border-indigo-500 transition-all flex items-center justify-between text-left group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-lg group-hover:bg-indigo-200 transition-colors">
                          <Camera size={20} className="text-indigo-600 animate-pulse" />
                        </div>
                        <div>
                          <h4 className="font-bold text-indigo-800 text-sm">📷 Autogestão de Biometria</h4>
                          <p className="text-[10px] text-indigo-600/80">Cadastre ou atualize sua biometria facial</p>
                        </div>
                      </div>
                      <span className="text-indigo-500 font-bold text-xs bg-white border border-indigo-200 py-1 px-2.5 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">Configurar &rarr;</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-2">
                    <button
                      type="button"
                      onClick={() => { setSelectedLoginOption(null); setLoginError(''); setLoginPassword(''); }}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <span className="text-xs font-semibold text-gray-600">Acessar como {optionDetails.name}</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1.5">
                      <Lock size={14} /> Senha de Acesso
                    </label>
                    <input
                      type="password"
                      required
                      autoFocus
                      placeholder="Senha de acesso"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
                    />
                  </div>

                  {loginError && (
                    <p className="text-red-500 text-xs text-center font-semibold animate-fade-in">{loginError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={gpsLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-xs shadow-md disabled:opacity-50"
                  >
                    {gpsLoading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Acessando...
                      </>
                    ) : (
                      <>
                        <LogIn size={15} /> Confirmar Acesso
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
          <p className="mt-8 text-xs text-gray-500">Módulo de Estágio • Lei nº 11.788/2008</p>
          <p className="mt-3 text-[10px] text-gray-400 text-center max-w-xs leading-relaxed select-none">
            Como alternativa para sua conveniência, é opcional e autorizado o uso de seu aparelho celular pessoal, sem qualquer obrigatoriedade
          </p>
        </div>
      );
    }



    const isUnitLogin = loggedInIntern.role === 'intern_unit';

    // Quiosque principal para bater o ponto (já logado e com senha atualizada)
    return (
      <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden relative">
          <div className="bg-blue-600 p-5 text-white text-center relative flex flex-col items-center justify-center">
            <button
              onClick={handleLogout}
              className="absolute top-4 right-4 p-1.5 bg-blue-700 hover:bg-blue-800 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all shadow-sm"
              title="Efetuar Logout"
            >
              <LogOut size={12} /> Desconectar
            </button>
            <img src="/logo.jpg" alt="Logo Porto Terapia" className="h-12 w-auto mb-2 rounded-lg shadow-sm" />
            <h1 className="text-xl font-bold mb-0.5">
              {isUnitLogin ? `Quiosque: ${loggedInIntern.name}` : `Olá, ${loggedInIntern.name}!`}
            </h1>
            <p className="text-blue-100 text-xs">
              {isUnitLogin 
                ? 'Selecione seu nome na listbox abaixo' 
                : `${loggedInIntern.course} • ${loggedInIntern.shift}`}
            </p>
            <div className="mt-4 text-3xl font-light tracking-wider flex items-center justify-center gap-2">
              <Clock size={24} className="text-blue-200" />
              {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <div className="p-6">
            {showSuccess ? (
              <div className="py-12 flex flex-col items-center justify-center text-center animate-fade-in">
                <CheckCircle size={64} className="text-green-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Registro Confirmado!</h2>
                <p className="text-gray-600">Localização validada e Controle Facial arquivado.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* LISTBOX DE ESTAGIÁRIOS DA UNIDADE */}
                {isUnitLogin && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                      <User size={14} className="text-blue-600" /> Selecione seu Nome (Ordem Alfabética) *
                    </label>
                    <select
                      size="6"
                      required
                      value={selectedIntern}
                      onChange={(e) => onSelectIntern(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs overflow-y-auto"
                    >
                      {internsOfCurrentUnit.length === 0 ? (
                        <option value="" disabled className="text-gray-400 p-2 text-center">
                          Nenhum estagiário ativo nesta unidade
                        </option>
                      ) : (
                        internsOfCurrentUnit.map((i) => (
                          <option key={i.id} value={i.id} className="p-2 border-b border-gray-100 last:border-0 hover:bg-blue-50 text-gray-700 font-medium">
                            {i.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Building2 size={14} /> Unidade de Atendimento
                  </label>
                  <select
                    required
                    disabled={isUnitLogin}
                    value={selectedUnit}
                    onChange={(e) => { setSelectedUnit(e.target.value); setGeoError(''); }}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 transition-all text-xs disabled:opacity-75 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  {currentUnit && (
                    <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                      <MapPin size={10} /> {currentUnit.address}
                    </p>
                  )}
                </div>



                {/* PAINEL DE CONTROLE FACIAL (WEBCAM) */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Camera size={14} className="text-blue-600" /> Controle Facial Biométrico
                    </span>
                    {['antonio-barreto', 'generalissimo'].includes(selectedUnit) ? (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                        <ShieldAlert size={12} className="text-amber-600" /> Sem Fallback de Senha
                      </span>
                    ) : (
                      cameraError && (
                        <button
                          type="button"
                          onClick={() => setForceManualPoint(!forceManualPoint)}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold"
                        >
                          {forceManualPoint ? "Ativar Câmera" : "Entrar em Contingência"}
                        </button>
                      )
                    )}
                  </div>
                  {['antonio-barreto', 'generalissimo'].includes(selectedUnit) && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800 text-[10px] font-medium leading-tight">
                      <ShieldAlert size={14} className="shrink-0 text-amber-600" />
                      <span>Autenticação por biometria facial e geolocalização 100% obrigatória nesta unidade (Restrição de senha/PIN ativa).</span>
                    </div>
                  )}

                  {isCameraActive && !forceManualPoint ? (
                    <div className="relative aspect-[4/3] w-full max-w-[200px] mx-auto bg-black rounded-lg overflow-hidden border border-slate-300 shadow-inner">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                      <div className="absolute inset-0 border-2 border-green-500/20 rounded-lg pointer-events-none">
                        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-green-500"></div>
                        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-green-500"></div>
                        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-green-500"></div>
                        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-green-500"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-32 border border-dashed border-green-400/40 rounded-[50%] flex items-center justify-center">
                          <span className="text-[6px] text-green-400 bg-black/60 px-1 py-0.5 rounded font-mono uppercase tracking-wider animate-pulse">
                            Aline o Rosto
                          </span>
                        </div>
                      </div>
                      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-scanline"></div>
                      <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[8px] text-green-400 font-semibold tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></span>
                        BIOMETRIA PRONTA
                      </div>

                      {/* Premium Validation overlay during submission */}
                      {isLocating && (
                        <div className="absolute inset-0 bg-blue-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-3 animate-fade-in z-20">
                          <Loader2 className="animate-spin text-white mb-2" size={24} />
                          <span className="text-[10px] text-white font-bold tracking-wider uppercase">Validando...</span>
                          <span className="text-[8px] text-blue-200 mt-1">Processando face e localização GPS</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-100 border border-dashed border-slate-300 rounded-lg p-4 text-center">
                      {cameraError ? (
                        <p className="text-[10px] text-amber-600 mb-2 font-medium leading-relaxed">{cameraError}</p>
                      ) : (
                        <p className="text-[10px] text-slate-500 mb-2">Para registrar, certifique-se de usar a câmera do dispositivo.</p>
                      )}
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={startCamera}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <Video size={12} /> Habilitar Câmera
                        </button>
                        {forceManualPoint && !['antonio-barreto', 'generalissimo'].includes(selectedUnit) && (
                          <span className="bg-amber-100 text-amber-800 text-[9px] font-semibold px-2 py-1 rounded inline-flex items-center">
                            Modo Contingência
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Movimentação</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => { setActionType('entrada'); setGeoError(''); }}
                      className={`p-2.5 rounded-lg border-2 flex items-center justify-center gap-1.5 transition-all text-xs ${
                        actionType === 'entrada' ? 'border-green-500 bg-green-50 text-green-700 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <LogIn size={15} /> Entrada
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActionType('saida'); setGeoError(''); }}
                      className={`p-2.5 rounded-lg border-2 flex items-center justify-center gap-1.5 transition-all text-xs ${
                        actionType === 'saida' ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <LogOut size={15} /> Saída
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setShowOccurrenceModal(true)}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FileText size={14} /> Registrar Ocorrência (Opcional)
                  </button>
                  {(justification || daysAway > 0) && (
                    <span className="text-[10px] text-green-600 font-semibold mt-1 block">
                      ✓ Ocorrência/Justificativa preenchida
                    </span>
                  )}
                </div>

                {geoError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2.5 flex items-start gap-1.5 animate-fade-in">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <span>{geoError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!user || isLocating || (isUnitLogin && !selectedIntern)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md text-xs"
                >
                  {isLocating ? (
                    <><Navigation size={15} className="animate-pulse" /> Validando ponto...</>
                  ) : (
                    <><CheckCircle size={15} /> Confirmar Registro</>
                  )}
                </button>
                <p className="text-[10px] text-gray-400 text-center flex items-center justify-center gap-1">
                  <Navigation size={10} /> Sua biometria facial e coordenadas GPS serão processadas.
                </p>
              </form>
            )}
          </div>
        </div>
        <p className="mt-8 text-sm text-gray-500">Módulo de Estágio • Lei nº 11.788/2008</p>
      </div>
    );
  };

  const loadPublicInterns = async () => {
    setLoadingPublicInterns(true);
    try {
      const { data, error } = await supabase
        .from('interns')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true });
      if (!error && data) {
        setPublicInterns(data.map(mapInternFromDb));
      }
    } catch (e) {
      console.error("Erro público ao carregar estagiários:", e);
    } finally {
      setLoadingPublicInterns(false);
    }
  };

  const renderAutogestaoBiometria = () => {
    const selectedInternObj = publicInterns.find(i => i.id === autogestaoInternId);
    const cleanInputCpf = autogestaoCpf.replace(/\D/g, '');
    const cleanInternCpf = selectedInternObj ? selectedInternObj.cpf.replace(/\D/g, '') : '';
    const isCpfValid = selectedInternObj && cleanInputCpf && cleanInputCpf === cleanInternCpf;

    const handleAutogestaoComplete = async (payload) => {
      if (!selectedInternObj) return;
      try {
        const { error } = await supabase
          .from('interns')
          .update({
            face_descriptor: JSON.stringify(payload.embedding)
          })
          .eq('id', selectedInternObj.id);

        if (error) throw error;
        setAutogestaoSuccess(true);
        toast.success('Biometria cadastrada com sucesso! Status: Biometria OK');
        fetchInterns();
      } catch (err) {
        console.error(err);
        toast.error('Erro ao atualizar biometria facial no banco de dados.');
      }
    };

    const hasBiometria = selectedInternObj && selectedInternObj.faceDescriptor && selectedInternObj.faceDescriptor !== '[]';

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="bg-indigo-600 p-6 text-white text-center relative flex flex-col items-center justify-center">
            <button
              onClick={() => setCurrentView('kiosk')}
              className="absolute top-4 left-4 p-2 bg-indigo-700 hover:bg-indigo-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shadow-sm"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <img src="/logo.jpg" alt="Logo Porto Terapia" className="h-14 w-auto mb-2 rounded-lg shadow-sm" />
            <h1 className="text-xl font-bold">Autogestão de Biometria Facial</h1>
            <p className="text-indigo-100 text-xs mt-1">Configuração autônoma de biometria para estagiários</p>
          </div>

          <div className="p-6 space-y-6">
            {autogestaoSuccess ? (
              <div className="py-8 flex flex-col items-center justify-center text-center animate-fade-in space-y-4">
                <div className="p-4 bg-emerald-100 rounded-full text-emerald-600">
                  <CheckCircle size={48} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Biometria OK!</h2>
                <p className="text-slate-600 text-sm max-w-sm">
                  Sua biometria facial foi cadastrada com sucesso e está assinada de forma síncrona. Você já pode bater o ponto usando a câmera.
                </p>
                <button
                  onClick={() => setCurrentView('kiosk')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors text-sm shadow-md"
                >
                  Ir para a Tela Inicial
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Selecione o seu nome na lista:
                  </label>
                  <select
                    value={autogestaoInternId}
                    onChange={(e) => {
                      setAutogestaoInternId(e.target.value);
                      setAutogestaoCpf('');
                    }}
                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs"
                  >
                    <option value="" disabled>Selecione...</option>
                    {publicInterns.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </div>

                {autogestaoInternId && (
                  hasBiometria ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center text-amber-900 text-xs font-semibold space-y-2 animate-fade-in">
                      <p>⚠️ Você já possui uma biometria facial cadastrada e validada no sistema.</p>
                      <p className="font-normal text-slate-500">Por questões de segurança, a alteração ou recadastro biométrico só pode ser feito sob supervisão direta no painel administrativo.</p>
                    </div>
                  ) : (
                    <div className="animate-fade-in space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Confirme seu CPF para validação de identidade:
                        </label>
                        <input
                          type="text"
                          placeholder="Apenas números ou formatado"
                          value={autogestaoCpf}
                          onChange={(e) => setAutogestaoCpf(e.target.value)}
                          className="w-full p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs"
                        />
                      </div>

                      {autogestaoCpf && !isCpfValid && (
                        <p className="text-red-500 text-[11px] font-semibold">
                          ❌ O CPF informado não coincide com o do estagiário selecionado.
                        </p>
                      )}

                      {isCpfValid && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden p-4 bg-slate-50 space-y-4 animate-fade-in">
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-amber-800 text-[11px] font-medium leading-relaxed">
                            <ShieldAlert size={16} className="shrink-0 text-amber-600 mt-0.5" />
                            <span>
                              <strong>Orientações para captura:</strong> Posicione seu rosto no centro do quadro de vídeo e aguarde a verificação Liveness (Anti-Spoofing). O sistema fará a captação e assinatura criptográfica automática assim que a pose for validada.
                            </span>
                          </div>

                          <BiometricEnrollment
                            internName={selectedInternObj.name}
                            internCpf={selectedInternObj.cpf}
                            onEnrollmentComplete={handleAutogestaoComplete}
                            onCancel={() => setCurrentView('kiosk')}
                          />
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRecadastroSection = () => {
    const handleSaveCadastro = async (e) => {
      e.preventDefault();
      
      // Validar se todos os campos estão preenchidos
      if (!cadastroForm.name.trim() || !cadastroForm.cpf.trim() || !cadastroForm.email.trim() || !cadastroForm.rg.trim() || 
          !cadastroForm.phone.trim() || !cadastroForm.course.trim() || !cadastroForm.institution.trim() || !cadastroForm.address.trim() || 
          !cadastroForm.unitId || !cadastroForm.shift || !cadastroForm.startDate || !cadastroForm.endDate || 
          !cadastroForm.bankName.trim() || !cadastroForm.bankAgency.trim() || !cadastroForm.bankAccount.trim() || !cadastroForm.pixKey.trim() || 
          !cadastroForm.emergencyName.trim() || !cadastroForm.emergencyRelationship || !cadastroForm.emergencyPhone.trim() ||
          !cadastroForm.birthdate) {
        alert("Todos os campos do Cadastro de Estagiário são obrigatórios, incluindo a Data de Nascimento!");
        return;
      }

      // Foto obrigatória
      if (!cadastroForm.photo) {
        alert("Por favor, adicione uma foto de cadastro (3x4).");
        return;
      }

      // CPF/RG e comprovante de matrícula obrigatórios
      if (!cadastroCpfRgFile) {
        alert("Por favor, envie o documento de identidade (CPF/RG) em anexo.");
        return;
      }
      if (!cadastroMatriculaFile) {
        alert("Por favor, envie o comprovante de matrícula em anexo.");
        return;
      }

      // Validar CPF
      if (!validateCPF(cadastroForm.cpf)) {
        alert("Por favor, insira um CPF válido.");
        return;
      }

      setIsSubmittingCadastro(true);
      try {
        const cleanCpf = cadastroForm.cpf.replace(/\D/g, '');
        let formattedCpf = cleanCpf;
        if (cleanCpf.length === 11) {
          formattedCpf = `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9)}`;
        }
        const { data: existingCpfUsers, error: cpfError } = await supabase
          .from('interns')
          .select('id, name, cpf')
          .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf},cpf.eq.${cadastroForm.cpf.trim()}`);
        if (cpfError) throw cpfError;
        const duplicate = existingCpfUsers?.find(intern => {
          const cleanDbCpf = (intern.cpf || '').replace(/\D/g, '');
          return cleanDbCpf === cleanCpf;
        });
        if (duplicate) {
          alert(`Duplicidade de Cadastro: Já existe um estagiário cadastrado com este CPF (${duplicate.name}).`);
          setIsSubmittingCadastro(false);
          return;
        }

        const email = cadastroForm.email.trim();
        const username = generateUsername(cadastroForm.name.trim());
        const finalEmail = email || `${username}@portoterapia.com`;

        // 1. Preparar os documentos admissionais
        const updatedDocs = {};
        if (cadastroCpfRgFile) {
          updatedDocs['documentos'] = {
            name: cadastroCpfRgFile.name,
            size: cadastroCpfRgFile.size,
            uploadedAt: new Date().toISOString(),
            content: cadastroCpfRgFile.content
          };
        }
        if (cadastroMatriculaFile) {
          updatedDocs['matricula'] = {
            name: cadastroMatriculaFile.name,
            size: cadastroMatriculaFile.size,
            uploadedAt: new Date().toISOString(),
            content: cadastroMatriculaFile.content
          };
        }

        // 2. Criar o usuário via RPC
        const createResult = await supabase.rpc('create_intern_user', {
          p_email: finalEmail,
          p_password: '0000',
          p_name: cadastroForm.name.trim(),
          p_course: cadastroForm.course.trim(),
          p_institution: cadastroForm.institution.trim(),
          p_shift: cadastroForm.shift,
          p_daily_hours: Math.min(Math.max(Number(cadastroForm.dailyHours) || 6, 1), 8),
          p_unit_id: cadastroForm.unitId,
          p_start_date: cadastroForm.startDate,
          p_end_date: cadastroForm.endDate,
          p_photo: cadastroForm.photo || null,
          p_cpf: cadastroForm.cpf.trim() || null,
          p_rg: cadastroForm.rg.trim() || null,
          p_phone: cadastroForm.phone.trim() || null,
          p_address: cadastroForm.address.trim() || null,
          p_bank_name: cadastroForm.bankName.trim() || null,
          p_bank_agency: cadastroForm.bankAgency.trim() || null,
          p_bank_account: cadastroForm.bankAccount.trim() || null,
          p_pix_key: cadastroForm.pixKey.trim() || null,
          p_emergency_name: cadastroForm.emergencyName.trim() || null,
          p_emergency_relationship: cadastroForm.emergencyRelationship || 'Pais',
          p_emergency_phone: cadastroForm.emergencyPhone.trim() || null,
          p_allowance: Number(cadastroForm.allowance) || 0,
          p_supervisor_name: cadastroForm.supervisorName.trim() || null,
          p_registration_status: cadastroForm.registrationStatus || 'pending_validation',
          p_documents: updatedDocs,
          p_birthdate: cadastroForm.birthdate || null
        });

        let newId = null;
        if (createResult.error) {
          console.warn("Tentando fallback de criação sem novos parâmetros...", createResult.error);
          const fallbackResult = await supabase.rpc('create_intern_user', {
            p_email: finalEmail,
            p_password: '0000',
            p_name: cadastroForm.name.trim(),
            p_course: cadastroForm.course.trim(),
            p_institution: cadastroForm.institution.trim(),
            p_shift: cadastroForm.shift,
            p_daily_hours: Math.min(Math.max(Number(cadastroForm.dailyHours) || 6, 1), 8),
            p_unit_id: cadastroForm.unitId,
            p_start_date: cadastroForm.startDate,
            p_end_date: cadastroForm.endDate,
            p_photo: cadastroForm.photo || null,
            p_cpf: cadastroForm.cpf.trim() || null,
            p_rg: cadastroForm.rg.trim() || null,
            p_phone: cadastroForm.phone.trim() || null,
            p_address: cadastroForm.address.trim() || null,
            p_bank_name: cadastroForm.bankName.trim() || null,
            p_bank_agency: cadastroForm.bankAgency.trim() || null,
            p_bank_account: cadastroForm.bankAccount.trim() || null,
            p_pix_key: cadastroForm.pixKey.trim() || null,
            p_emergency_name: cadastroForm.emergencyName.trim() || null,
            p_emergency_relationship: cadastroForm.emergencyRelationship || 'Pais',
            p_emergency_phone: cadastroForm.emergencyPhone.trim() || null,
            p_allowance: Number(cadastroForm.allowance) || 0
          });
          if (fallbackResult.error) throw fallbackResult.error;
          newId = fallbackResult.data;
          
          // No fallback antigo, precisamos forçar o update dos documentos (tentativa)
          await supabase
            .from('interns')
            .update({
              registration_status: cadastroForm.registrationStatus || 'pending_validation',
              documents: updatedDocs,
              supervisor_name: cadastroForm.supervisorName.trim(),
              birthdate: cadastroForm.birthdate || null
            })
            .eq('id', newId);
        } else {
          newId = createResult.data;
        }

        if (!newId) {
          throw new Error("Não foi possível obter o ID do novo estagiário.");
        }

        // Usa biometria pré-extraída ou extrai se não houver
        let descriptorStr = cadastroForm.faceDescriptor;
        if (!descriptorStr && cadastroForm.photo) {
          try {
            const desc = await getFaceDescriptor(cadastroForm.photo);
            if (desc) descriptorStr = JSON.stringify(desc);
          } catch (bioError) {
            console.error("Erro ao obter descritor facial no envio:", bioError);
          }
        }
        await supabase
          .from('interns')
          .update({
            birthdate: cadastroForm.birthdate || null,
            face_descriptor: descriptorStr || null,
            registration_status: cadastroForm.registrationStatus || 'pending_validation'
          })
          .eq('id', newId);

        setCadastroSuccess(true);
        fetchInterns();
      } catch (err) {
        console.error("Erro ao realizar cadastro:", err);
        alert("Erro ao enviar cadastro: " + (err.message || err));
      } finally {
        setIsSubmittingCadastro(false);
      }
    };

    if (cadastroSuccess) {
      return (
        <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center space-y-4 border border-slate-100 animate-fade-in">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle size={36} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Confirmação de Dados</h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              Seu cadastro foi enviado com sucesso! Suas informações foram cadastradas no banco de dados e serão validadas pela Supervisão de RH da Clínica.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => {
                  setCurrentView('kiosk');
                  setCadastroSuccess(false);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors shadow-md text-xs"
              >
                Voltar para Tela Inicial
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-blue-50 flex flex-col items-center p-4 py-8">
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-700 p-6 text-white text-center">
            <h1 className="text-xl font-bold mb-1">Cadastro Obrigatório de Estagiários</h1>
            <p className="text-blue-100 text-xs">Insira todas as suas informações e anexe seus documentos para o RH</p>
          </div>

          <div className="p-6 space-y-6">
            <form onSubmit={handleSaveCadastro} className="space-y-6 animate-fade-in">
              {/* DADOS CADASTRO PHOTO */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center shadow-inner">
                <div className="w-16 h-20 bg-gray-100 rounded border border-gray-300 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                  {cadastroForm.photo ? (
                    <img src={cadastroForm.photo} alt="Foto 3x4" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-1 text-[8px] text-gray-400 font-bold uppercase tracking-wider">
                      Foto 3x4 *
                    </div>
                  )}
                </div>
                <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                  <label className="block text-xs font-bold text-gray-700">Foto de Cadastro (Formato 3x4) *</label>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      id="cadastro-photo-input"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setIsBioCadastroModalOpen(true);
                          setBioCadastroStatus('processing');
                          setBioCadastroMsg('Compactando foto 3x4 e inicializando modelos...');
                          setBioCadastroTimeLeft(20);

                          let timeLeft = 20;
                          const timerInterval = setInterval(() => {
                            timeLeft -= 1;
                            setBioCadastroTimeLeft(timeLeft);
                            if (timeLeft <= 0) {
                              clearInterval(timerInterval);
                            }
                          }, 1000);

                          const runExtraction = async (base64) => {
                            const timeoutPromise = new Promise((_, reject) => {
                              setTimeout(() => {
                                reject(new Error('TIMEOUT'));
                              }, 20000);
                            });
                            return Promise.race([
                              getFaceDescriptor(base64),
                              timeoutPromise
                            ]);
                          };

                          try {
                            const base64 = await compressImage(file, 250, 333, 0.7);
                            setCadastroForm(f => ({ ...f, photo: base64 }));
                            setBioCadastroMsg('Analisando traços faciais na imagem (limite de 20s)...');

                            const descriptor = await runExtraction(base64);
                            clearInterval(timerInterval);

                            if (descriptor && descriptor.length === 128) {
                              setCadastroForm(f => ({
                                ...f,
                                photo: base64,
                                faceDescriptor: JSON.stringify(descriptor),
                                registrationStatus: 'biometria validada'
                              }));
                              setBioCadastroStatus('success');
                              setBioCadastroMsg('✅ Biometria validada com sucesso! O rosto foi identificado e a biometria facial foi vinculada ao cadastro. Você estará isento de validações presenciais.');
                            } else {
                              setBioCadastroStatus('error');
                              setBioCadastroMsg('❌ Rosto não identificado na imagem. Certifique-se de usar uma foto bem iluminada.');
                            }
                          } catch (err) {
                            clearInterval(timerInterval);
                            console.error("Erro ao converter/extrair biometria:", err);
                            setBioCadastroStatus('error');
                            if (err.message === 'TIMEOUT') {
                              setBioCadastroMsg('❌ Tempo limite de 20 segundos esgotado. A extração biométrica falhou.');
                            } else {
                              setBioCadastroMsg('❌ Falha ao processar imagem ou extrair biometria.');
                            }
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('cadastro-photo-input').click()}
                      className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs px-3 py-1.5 rounded-lg font-semibold border border-blue-200 transition-colors"
                    >
                      <Upload size={13} /> Escolher Foto 3x4 *
                    </button>
                    {cadastroForm.photo && (
                      <button
                        type="button"
                        onClick={() => setCadastroForm({ ...cadastroForm, photo: '' })}
                        className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs px-3 py-1.5 rounded-lg font-semibold border border-red-200 transition-colors"
                      >
                        <Trash size={13} /> Remover
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400">Insira a imagem no formato 3x4 inicial de cadastro para comparação biométrica.</p>
                  {cadastroForm.registrationStatus === 'biometria validada' && (
                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300 mt-1">
                      <CheckCircle2 size={10} /> Biometria Validada — Isento de Validação Presencial
                    </span>
                  )}
                </div>
              </div>

              {/* FORM GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">Nome completo *</label>
                  <input
                    required placeholder="Nome completo *"
                    value={cadastroForm.name}
                    onChange={(e) => setCadastroForm({ ...cadastroForm, name: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">CPF *</label>
                  <input
                    required placeholder="CPF *"
                    value={cadastroForm.cpf}
                    onChange={(e) => {
                      const val = e.target.value;
                      const isValid = validateCPF(val);
                      setCadastroForm(prev => ({
                        ...prev,
                        cpf: val,
                        pixKey: isValid ? val : prev.pixKey
                      }));
                    }}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">Data de Nascimento *</label>
                  <input
                    type="date"
                    required
                    value={cadastroForm.birthdate}
                    onChange={(e) => setCadastroForm({ ...cadastroForm, birthdate: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">E-mail *</label>
                  <input
                    type="email"
                    placeholder="E-mail *"
                    required
                    value={cadastroForm.email}
                    onChange={(e) => setCadastroForm({ ...cadastroForm, email: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">RG *</label>
                  <input
                    required placeholder="RG *"
                    value={cadastroForm.rg}
                    onChange={(e) => setCadastroForm({ ...cadastroForm, rg: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">Telefone *</label>
                  <input
                    required placeholder="Telefone *"
                    value={cadastroForm.phone}
                    onChange={(e) => setCadastroForm({ ...cadastroForm, phone: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">Curso *</label>
                  <input
                    required placeholder="Curso *"
                    value={cadastroForm.course}
                    onChange={(e) => setCadastroForm({ ...cadastroForm, course: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">Instituição de ensino *</label>
                  <input
                    required placeholder="Instituição de ensino *"
                    value={cadastroForm.institution}
                    onChange={(e) => setCadastroForm({ ...cadastroForm, institution: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">Profissional Supervisor</label>
                  <input
                    placeholder="Profissional Supervisor"
                    value={cadastroForm.supervisorName}
                    onChange={(e) => setCadastroForm({ ...cadastroForm, supervisorName: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">Endereço completo *</label>
                  <input
                    required placeholder="Endereço completo *"
                    value={cadastroForm.address}
                    onChange={(e) => setCadastroForm({ ...cadastroForm, address: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">Unidade padrão *</label>
                  <select
                    required
                    value={cadastroForm.unitId}
                    onChange={(e) => setCadastroForm({ ...cadastroForm, unitId: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">Turno *</label>
                  <select
                    required
                    value={cadastroForm.shift}
                    onChange={(e) => setCadastroForm({ ...cadastroForm, shift: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
                  >
                    <option>Manhã</option>
                    <option>Tarde</option>
                    <option>Noite</option>
                    <option>Integral</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">Carga horária diária * (máx. 6h - Lei 11.788)</label>
                  <input
                    required
                    type="number" min={1} max={8}
                    value={cadastroForm.dailyHours}
                    onChange={(e) => setCadastroForm({ ...cadastroForm, dailyHours: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">Data de Início do Contrato *</label>
                  <input
                    required
                    type="date"
                    value={cadastroForm.startDate}
                    onChange={(e) => setCadastroForm({ ...cadastroForm, startDate: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">Data de Fim do Contrato *</label>
                  <input
                    required
                    type="date"
                    value={cadastroForm.endDate}
                    onChange={(e) => setCadastroForm({ ...cadastroForm, endDate: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">Bolsa/Auxílio Firmado (R$) *</label>
                  <input
                    required
                    type="number" step="0.01" min="0"
                    placeholder="Bolsa/Auxílio *"
                    value={cadastroForm.allowance}
                    onChange={(e) => setCadastroForm({ ...cadastroForm, allowance: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>

                {/* DADOS BANCÁRIOS SUBSECTION */}
                <div className="md:col-span-2 border-t border-gray-200 pt-3">
                  <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Dados Bancários *</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Banco *</label>
                      <input
                        required
                        placeholder="Banco *"
                        value={cadastroForm.bankName}
                        onChange={(e) => setCadastroForm({ ...cadastroForm, bankName: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Agência *</label>
                      <input
                        required
                        placeholder="Agência *"
                        value={cadastroForm.bankAgency}
                        onChange={(e) => setCadastroForm({ ...cadastroForm, bankAgency: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Conta Corrente *</label>
                      <input
                        required
                        placeholder="Conta Corrente *"
                        value={cadastroForm.bankAccount}
                        onChange={(e) => setCadastroForm({ ...cadastroForm, bankAccount: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Chave PIX (CPF) *</label>
                      <input
                        required
                        placeholder="Chave PIX (CPF) *"
                        value={cadastroForm.pixKey}
                        onChange={(e) => setCadastroForm({ ...cadastroForm, pixKey: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* CONTATO DE EMERGÊNCIA SUBSECTION */}
                <div className="md:col-span-2 border-t border-gray-200 pt-3">
                  <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Contato de Emergência *</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Nome do Contato *</label>
                      <input
                        required
                        placeholder="Nome do Contato *"
                        value={cadastroForm.emergencyName}
                        onChange={(e) => setCadastroForm({ ...cadastroForm, emergencyName: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Parentesco *</label>
                      <select
                        required
                        value={cadastroForm.emergencyRelationship}
                        onChange={(e) => setCadastroForm({ ...cadastroForm, emergencyRelationship: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Pais">Pais</option>
                        <option value="Cônjuge">Cônjuge</option>
                        <option value="Irmão(ã)">Irmão(ã)</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Telefone de Emergência *</label>
                      <input
                        required
                        placeholder="Telefone de Emergência *"
                        value={cadastroForm.emergencyPhone}
                        onChange={(e) => setCadastroForm({ ...cadastroForm, emergencyPhone: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* UPLOAD DOCUMENTOS OBRIGATÓRIOS SUBSECTION */}
                <div className="md:col-span-2 border-t border-gray-200 pt-3 space-y-3">
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                    📁 Documentos Admissionais Obrigatórios *
                  </h4>
                  <p className="text-[10px] text-gray-400">Envie arquivos nos formatos JPG, JPEG ou PDF de até 2MB.</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between gap-2 shadow-inner">
                      <div>
                        <span className="text-xs font-bold text-gray-700 block">Documento de Identidade (CPF/RG) *</span>
                        {cadastroCpfRgFile ? (
                          <div className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 p-1.5 rounded-lg mt-1 flex justify-between items-center">
                            <span className="truncate font-semibold">{cadastroCpfRgFile.name} ({cadastroCpfRgFile.size})</span>
                            <button type="button" onClick={() => setCadastroCpfRgFile(null)} className="text-red-500 hover:text-red-700 font-bold ml-1">&times;</button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic block mt-0.5">Nenhum arquivo enviado</span>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,application/pdf"
                        id="cadastro-cpfrg-file"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 2 * 1024 * 1024) {
                              alert("O arquivo excede o limite de 2MB!");
                              return;
                            }
                             try {
                              const base64 = await fileToBase64(file);
                              setCadastroCpfRgFile({
                                name: file.name,
                                size: (file.size / 1024).toFixed(1) + ' KB',
                                content: base64,
                                type: file.type
                              });
                            } catch (err) {
                              console.error(err);
                            }
                          }
                        }}
                      />
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => document.getElementById('cadastro-cpfrg-file').click()}
                          className="w-full bg-white hover:bg-slate-100 border border-gray-300 text-gray-700 text-[10px] py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Upload size={12} /> Selecionar CPF/RG *
                        </button>
                        
                        {cadastroCpfRgFile && cadastroCpfRgFile.type?.startsWith('image/') && isAiExtractionActive && (
                          <button
                            type="button"
                            onClick={async () => {
                              toast.info("Processando documento via IA...");
                              const dob = await extractBirthdateFromDoc(cadastroCpfRgFile.content);
                              if (dob) {
                                setCadastroForm(prev => ({ ...prev, birthdate: dob }));
                                setIsAiExtractionActive(false);
                                toast.success("Data de nascimento extraída e preenchida com sucesso!");
                              } else {
                                toast.error("Não foi possível extrair a data. Digite-a manualmente.");
                              }
                            }}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-colors shadow"
                          >
                            <Sparkles size={12} /> Varredura por IA (Gemini)
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between gap-2 shadow-inner">
                      <div>
                        <span className="text-xs font-bold text-gray-700 block">Comprovante de Matrícula *</span>
                        {cadastroMatriculaFile ? (
                          <div className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 p-1.5 rounded-lg mt-1 flex justify-between items-center">
                            <span className="truncate font-semibold">{cadastroMatriculaFile.name} ({cadastroMatriculaFile.size})</span>
                            <button type="button" onClick={() => setCadastroMatriculaFile(null)} className="text-red-500 hover:text-red-700 font-bold ml-1">&times;</button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic block mt-0.5">Nenhum arquivo enviado</span>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,application/pdf"
                        id="cadastro-matricula-file"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 2 * 1024 * 1024) {
                              alert("O arquivo excede o limite de 2MB!");
                              return;
                            }
                            try {
                              const base64 = await fileToBase64(file);
                              setCadastroMatriculaFile({
                                name: file.name,
                                size: (file.size / 1024).toFixed(1) + ' KB',
                                content: base64
                              });
                            } catch (err) {
                              console.error(err);
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('cadastro-matricula-file').click()}
                        className="w-full bg-white hover:bg-slate-100 border border-gray-300 text-gray-700 text-[10px] py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Upload size={12} /> Selecionar Comprovante *
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={isSubmittingCadastro}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md text-xs flex items-center justify-center gap-1.5"
                >
                  {isSubmittingCadastro ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Cadastrando estagiário...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Enviar Cadastro Obrigatório
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('kiosk');
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors text-xs font-bold"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* MODAL DE PROCESSAMENTO DE BIOMETRIA (AUTO-CADASTRO) */}
        {isBioCadastroModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 flex flex-col p-6 space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                <ScanFace size={16} className="text-indigo-600 animate-pulse" /> Extração Biométrica Facial
              </h3>

              <div className="py-4 flex flex-col items-center justify-center text-center space-y-3">
                {bioCadastroStatus === 'processing' && (
                  <>
                    <div className="relative flex items-center justify-center w-16 h-16">
                      <RefreshCw size={48} className="animate-spin text-indigo-500" />
                      <span className="absolute text-xs font-black text-indigo-700">{bioCadastroTimeLeft}s</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-600 leading-normal">{bioCadastroMsg}</p>
                  </>
                )}

                {bioCadastroStatus === 'success' && (
                  <>
                    <div className="bg-emerald-100 p-4 rounded-full text-emerald-600">
                      <CheckCircle2 size={40} />
                    </div>
                    <p className="text-xs font-semibold text-emerald-800 leading-relaxed">{bioCadastroMsg}</p>
                  </>
                )}

                {bioCadastroStatus === 'error' && (
                  <>
                    <div className="bg-rose-100 p-4 rounded-full text-rose-600">
                      <AlertCircle size={40} />
                    </div>
                    <p className="text-xs font-semibold text-slate-700 leading-relaxed">{bioCadastroMsg}</p>
                  </>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsBioCadastroModalOpen(false)}
                  disabled={bioCadastroStatus === 'processing'}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {bioCadastroStatus === 'processing' ? 'Aguardando...' : 'Fechar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // PAINEL: Gestão de estagiários
  // ============================================================
  const renderManageSection = () => (
    <div className="bg-white rounded-xl shadow-md overflow-hidden transition-all hover:shadow-lg duration-300 border border-slate-100">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <Users size={20} className="text-blue-600" /> Gestão de Estagiários
        </h2>
      </div>

      <div className="p-4 space-y-6">
        <form onSubmit={handleSaveIntern} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2 text-xs uppercase tracking-wider pb-2 border-b border-gray-200">
            {editingId ? <><Pencil size={16} className="text-blue-600" /> Editar estagiário</> : <><Plus size={16} className="text-green-600" /> Novo estagiário</>}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row gap-4 items-center shadow-inner">
              <div className="w-16 h-20 bg-gray-100 rounded border border-gray-300 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                {form.photo ? (
                  <img src={form.photo} alt="Foto 3x4" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-1 text-[8px] text-gray-400 font-bold uppercase tracking-wider">
                    Foto 3x4 *
                  </div>
                )}
              </div>
              <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                <label className="block text-xs font-bold text-gray-700">Foto de Cadastro (Formato 3x4) *</label>
                <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    id="intern-photo-input"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const base64 = await compressImage(file, 250, 333, 0.7);
                          setForm({ ...form, photo: base64 });
                        } catch (err) {
                          console.error("Erro ao converter foto:", err);
                          alert("Erro ao processar foto.");
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('intern-photo-input').click()}
                    className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs px-3 py-1.5 rounded-lg font-semibold border border-blue-200 transition-colors"
                  >
                    <Upload size={13} /> Escolher Foto 3x4 *
                  </button>
                  {form.photo && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, photo: '' })}
                      className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs px-3 py-1.5 rounded-lg font-semibold border border-red-200 transition-colors"
                    >
                      <Trash size={13} /> Remover
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-gray-400">Insira a imagem no formato 3x4 inicial de cadastro para comparação biométrica.</p>
              </div>
            </div>
            <input
              required placeholder="Nome completo *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
            />
            <input
              required placeholder="CPF *"
              value={form.cpf}
              onChange={(e) => {
                const val = e.target.value;
                const isValid = validateCPF(val);
                setForm(prev => ({
                  ...prev,
                  cpf: val,
                  pixKey: isValid ? val : prev.pixKey
                }));
              }}
              className="p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
            />
            <input
              type="email"
              placeholder="E-mail *"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
            />
            <input
              required placeholder="RG *"
              value={form.rg}
              onChange={(e) => setForm({ ...form, rg: e.target.value })}
              className="p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
            />
            <input
              required placeholder="Telefone *"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
            />
            <input
              required placeholder="Curso *"
              value={form.course}
              onChange={(e) => setForm({ ...form, course: e.target.value })}
              className="p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
            />
            <input
              required placeholder="Instituição de ensino *"
              value={form.institution}
              onChange={(e) => setForm({ ...form, institution: e.target.value })}
              className="p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
            />
            <input
              placeholder="Profissional Supervisor"
              value={form.supervisorName}
              onChange={(e) => setForm({ ...form, supervisorName: e.target.value })}
              className="p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
            />
            <input
              required placeholder="Endereço completo *"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 md:col-span-2 text-xs"
            />
            <div>
              <label className="text-xs text-gray-500 font-semibold">Unidade padrão *</label>
              <select
                required
                value={form.unitId}
                onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">Turno *</label>
              <select
                required
                value={form.shift}
                onChange={(e) => setForm({ ...form, shift: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
              >
                <option>Manhã</option>
                <option>Tarde</option>
                <option>Noite</option>
                <option>Integral</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">Carga horária diária * (máx. 6h - Lei 11.788)</label>
              <input
                required
                type="number" min={1} max={8}
                value={form.dailyHours}
                onChange={(e) => setForm({ ...form, dailyHours: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">Data de Início do Contrato *</label>
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">Data de Fim do Contrato *</label>
              <input
                required
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">Data de Nascimento *</label>
              <input
                required
                type="date"
                value={form.birthdate}
                onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">Bolsa/Auxílio Firmado (R$) *</label>
              <input
                required
                type="number" step="0.01" min="0"
                placeholder="Bolsa/Auxílio *"
                value={form.allowance}
                onChange={(e) => setForm({ ...form, allowance: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-xs"
              />
            </div>

            {/* DADOS BANCÁRIOS SUBSECTION */}
            <div className="md:col-span-2 border-t border-gray-200 pt-3">
              <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Dados Bancários *</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  required
                  placeholder="Banco *"
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  className="p-2 border border-gray-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500"
                />
                <input
                  required
                  placeholder="Agência *"
                  value={form.bankAgency}
                  onChange={(e) => setForm({ ...form, bankAgency: e.target.value })}
                  className="p-2 border border-gray-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500"
                />
                <input
                  required
                  placeholder="Conta Corrente *"
                  value={form.bankAccount}
                  onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
                  className="p-2 border border-gray-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500"
                />
                <input
                  required
                  placeholder="Chave PIX (CPF) *"
                  value={form.pixKey}
                  onChange={(e) => setForm({ ...form, pixKey: e.target.value })}
                  className="p-2 border border-gray-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* CONTATO DE EMERGÊNCIA SUBSECTION */}
            <div className="md:col-span-2 border-t border-gray-200 pt-3">
              <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Contato de Emergência *</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  required
                  placeholder="Nome do Contato *"
                  value={form.emergencyName}
                  onChange={(e) => setForm({ ...form, emergencyName: e.target.value })}
                  className="p-2 border border-gray-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <select
                    required
                    value={form.emergencyRelationship}
                    onChange={(e) => setForm({ ...form, emergencyRelationship: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Pais">Pais</option>
                    <option value="Cônjuge">Cônjuge</option>
                    <option value="Irmão(ã)">Irmão(ã)</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <input
                  required
                  placeholder="Telefone de Emergência *"
                  value={form.emergencyPhone}
                  onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })}
                  className="p-2 border border-gray-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 self-end md:col-span-2 py-1">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="w-4 h-4"
              />
              Estagiário ativo (aparece na tela de registro)
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow">
              <Save size={16} /> {editingId ? 'Salvar alterações' : 'Cadastrar'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
            )}
          </div>
        </form>

        <div className="divide-y divide-gray-100">
          {interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit).length === 0 ? (
            <p className="text-center text-gray-500 py-6">Nenhum estagiário correspondente aos filtros.</p>
          ) : (
            interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit).map((intern) => (
              <div key={intern.id} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="w-10 h-14 bg-gray-100 rounded border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                    {intern.photo ? (
                      <img src={intern.photo} alt={intern.name} className="w-full h-full object-cover" />
                    ) : (
                      <User size={18} className="text-gray-300" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 truncate flex items-center gap-2">
                      {intern.name}
                      {intern.active === false && (
                        <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-semibold">Inativo</span>
                      )}
                      {intern.registrationStatus === 'pending_validation' && (
                        <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-200 animate-pulse">⚠️ Aguardando Validação</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {[intern.course, intern.institution, unitName(intern.unitId), intern.shift, `${intern.dailyHours || 6}h/dia`]
                        .filter(Boolean).join(' • ')}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Supervisor: <strong className="text-slate-600">{intern.supervisorName || 'Não atribuído'}</strong>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {intern.registrationStatus === 'pending_validation' && (
                    <button
                      onClick={() => handleApproveRegistration(intern.id)}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Aprovar e Validar Cadastro"
                    >
                      <Check size={16} />
                    </button>
                  )}
                  <button onClick={() => handleEditIntern(intern)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDeleteIntern(intern)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  // ============================================================
  // PAINEL: Horas acumuladas (diário / semanal)
  // ============================================================
  const renderHoursSummary = () => (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <Timer size={20} /> Horas Acumuladas por Estagiário
        </h2>
        <span className="text-xs text-gray-500">Limites: {LABOR.maxDailyHours}h/dia • {LABOR.maxWeeklyHours}h/semana</span>
      </div>
      <div className="overflow-x-auto">
        {hoursSummary.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Sem dados de horas ainda.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider border-b border-gray-200">
                <th className="p-4 font-medium">Estagiário</th>
                <th className="p-4 font-medium">Hoje</th>
                <th className="p-4 font-medium">Esta semana</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {hoursSummary.map((row, idx) => {
                const overDay = row.today > LABOR.maxDailyHours;
                const overWeek = row.week > LABOR.maxWeeklyHours;
                return (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-gray-800">
                      {row.name}
                      {row.removed && <span className="ml-2 text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">removido</span>}
                    </td>
                    <td className={`p-4 text-sm font-semibold ${overDay ? 'text-red-600' : 'text-gray-700'}`}>
                      {row.today.toFixed(1)}h {overDay && <AlertTriangle size={12} className="inline mb-0.5" />}
                    </td>
                    <td className={`p-4 text-sm font-semibold ${overWeek ? 'text-red-600' : 'text-gray-700'}`}>
                      {row.week.toFixed(1)}h / {LABOR.maxWeeklyHours}h
                      {overWeek && <AlertTriangle size={12} className="inline mb-0.5 ml-1" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ============================================================
  // GERAÇÃO DE MODELOS E CONTRATOS (TIMBRE E PDF)
  // ============================================================
  const extensoBRL = (num) => {
    if (num === 0) return 'zero reais';
    
    const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    const dezenas10 = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const dezenas = ['', 'dez', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
    
    const converterGrupo = (n) => {
      if (n === 100) return 'cem';
      let output = '';
      const c = Math.floor(n / 100);
      const d = Math.floor((n % 100) / 10);
      const u = n % 10;
      
      if (c > 0) {
        output += centenas[c];
      }
      
      if (d > 0 || u > 0) {
        if (output !== '') output += ' e ';
        if (d === 1) {
          output += dezenas10[u];
        } else {
          if (d > 0) {
            output += dezenas[d];
            if (u > 0) output += ' e ' + unidades[u];
          } else {
            output += unidades[u];
          }
        }
      }
      return output;
    };

    const converterMilhares = (n) => {
      if (n < 1000) return converterGrupo(n);
      const mil = Math.floor(n / 1000);
      const resto = n % 1000;
      let output = '';
      if (mil === 1) {
        output = 'mil';
      } else {
        output = converterGrupo(mil) + ' mil';
      }
      if (resto > 0) {
        if (resto < 100 || resto % 100 === 0) {
          output += ' e ' + converterGrupo(resto);
        } else {
          output += ' ' + converterGrupo(resto);
        }
      }
      return output;
    };

    const partes = Number(num).toFixed(2).split('.');
    const inteiros = parseInt(partes[0], 10);
    const centavos = parseInt(partes[1], 10);

    let textoInteiro = '';
    if (inteiros > 0) {
      textoInteiro = converterMilhares(inteiros);
      textoInteiro += inteiros === 1 ? ' real' : ' reais';
    }

    let textoCentavos = '';
    if (centavos > 0) {
      if (centavos === 1) {
        textoCentavos = 'um centavo';
      } else if (centavos < 10) {
        textoCentavos = unidades[centavos] + ' centavos';
      } else if (centavos < 20) {
        textoCentavos = dezenas10[centavos - 10] + ' centavos';
      } else {
        const d = Math.floor(centavos / 10);
        const u = centavos % 10;
        textoCentavos = dezenas[d] + (u > 0 ? ' e ' + unidades[u] : '') + ' centavos';
      }
    }

    if (textoInteiro && textoCentavos) {
      return `${textoInteiro} e ${textoCentavos}`;
    }
    return textoInteiro || textoCentavos || 'zero reais';
  };

  const getBolsaAuxilioText = (intern) => {
    const allowanceVal = intern?.allowance ? Number(intern.allowance) : 0;
    if (!allowanceVal) {
      return '___________________________';
    }
    const transportVal = 200;
    const stipendVal = Math.max(0, allowanceVal - 200);
    
    const transportText = `R$ 200,00 (duzentos reais) de auxílio-transporte`;
    const stipendFormatted = stipendVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const stipendExtenso = extensoBRL(stipendVal);
    const stipendText = `R$ ${stipendFormatted} (${stipendExtenso}) de bolsa-auxílio`;
    
    return `${transportText} e ${stipendText}`;
  };

  const getPaeActivities = (intern) => {
    const activitiesList = [
      { title: "Acompanhamento de Atendimentos Clínicos Infantis", desc: "Observação assistida e auxílio na preparação de salas e recursos terapêuticos adaptados para o desenvolvimento infantil." },
      { title: "Análise Comportamental Aplicada (ABA)", desc: "Apoio sob supervisão direta na aplicação de programas de intervenção baseados em ABA para crianças com Transtorno do Espectro Autista (TEA)." },
      { title: "Elaboração de Recursos Lúdicos para TDAH", desc: "Desenvolvimento de jogos e atividades dinâmicas focados no treino de atenção sustentada, foco e controle de impulsividade." },
      { title: "Suporte em Avaliação Neuropsicológica", desc: "Auxílio na preparação de materiais de teste e observação da avaliação de funções executivas e cognição em crianças e adolescentes." },
      { title: "Observação de Sessões de Integração Sensorial", desc: "Acompanhamento de intervenções voltadas para o processamento sensorial em sala equipada de terapia ocupacional ou estimulação física." },
      { title: "Auxílio em Treinamento de Pais (Treinamento Parental)", desc: "Participação em sessões de orientação de pais para implementação de rotinas, regras estruturadas e manejo de comportamentos desafiadores." },
      { title: "Psicopedagogia Clínica e Institucional", desc: "Apoio em avaliações e intervenções voltadas para dificuldades de aprendizagem, dislexia e discalculia, elaborando materiais pedagógicos personalizados." },
      { title: "Manejo de Comportamento Inapropriado no TOD", desc: "Estudo de caso e observação de técnicas de desescalada, reforço positivo e manejo de oposição sistemática em crianças com Transtorno Opositor Desafiador." },
      { title: "Estímulo a Crianças com Altas Habilidades/Superdotação", desc: "Planejamento de desafios cognitivos complexos, enriquecimento curricular e atividades de aprofundamento temático." },
      { title: "Organização de Prontuários e Anamnese", desc: "Apoio no preenchimento físico e controle digital de prontuários com foco no histórico de marcos de desenvolvimento infantil." },
      { title: "Triagem e Acolhimento de Famílias", desc: "Auxílio na condução das entrevistas de triagem inicial focadas em queixas escolares e do desenvolvimento global." },
      { title: "Elaboração de Relatórios de Evolução Infantil", desc: "Apoio na redação e sistematização de relatórios parciais sobre a evolução motora, cognitiva e social do paciente mirim." },
      { title: "Grupos de Habilidades Sociais Infantis", desc: "Participação no planejamento e co-facilitação de oficinas focadas em empatia, comunicação assertiva e resolução de conflitos para crianças." },
      { title: "Ludoterapia e Terapia pelo Brincar", desc: "Observação e auxílio na condução de sessões estruturadas que utilizam o brincar simbólico como meio de expressão emocional." },
      { title: "Pesquisa Bibliográfica em Desenvolvimento Infantil", desc: "Levantamento de literatura científica atual sobre neurodesenvolvimento, marcos motores e marcos de linguagem." },
      { title: "Adaptação de Materiais para Comunicação Alternativa", desc: "Confecção de pranchas de comunicação aumentativa e alternativa (PECS ou similares) para crianças não-verbais." },
      { title: "Planejamento Pedagógico e de Suporte Escolar", desc: "Apoio na criação de planos de adaptação escolar em conjunto com professores e equipe pedagógica." },
      { title: "Suporte Operacional e Administrativo", desc: "Apoio nas rotinas diárias da clínica, com foco em gestão de agenda de psicólogos infantis e recepção acolhedora de crianças e familiares." },
      { title: "Discussão e Análise de Casos Clínicos", desc: "Participação ativa em reuniões clínicas e grupos de estudos dedicados ao desenvolvimento de condutas terapêuticas em neurodesenvolvimento." },
      { title: "Estudo de Ética e Prática Profissional", desc: "Análise crítica do Código de Ética Profissional do Psicólogo aplicada aos dilemas do atendimento infantil e sigilo com os responsáveis." },
      { title: "Tabulação de Indicadores Clínicos de Evolução", desc: "Auxílio na tabulação de dados sobre a eficácia de intervenções clínicas em crianças atípicas." },
      { title: "Observação de Psicoterapia Individual de Adolescentes", desc: "Acompanhamento de sessões individuais abordando identidade, socialização e regulação emocional na adolescência." },
      { title: "Confecção de Rotinas Visuais Adaptadas", desc: "Criação de cronogramas visuais em formato de cartazes ou cards para auxiliar a organização diária de crianças autistas ou com TDAH." },
      { title: "Acompanhamento Terapêutico Escolar (AT)", desc: "Apoio e intervenções no ambiente escolar para facilitação da socialização, comportamento e autonomia de alunos com TEA ou TDAH." },
      { title: "Mapeamento de Rede de Apoio à Infância", desc: "Identificação de serviços públicos e redes parceiras especializadas em reabilitação infantil e neurodesenvolvimento." },
      { title: "Participação em Supervisões Clínicas de Casos Infantis", desc: "Discussão sistemática com o psicólogo orientador sobre o andamento e desafios do manejo clínico com crianças." },
      { title: "Aplicação de Escalas de Rastreio de Autismo", desc: "Observação supervisionada na aplicação de instrumentos de triagem como M-CHAT e escalas de desenvolvimento infantil." },
      { title: "Dinâmicas de Psicoeducação sobre TDAH para Pais", desc: "Auxílio na evolução de cartilhas explicativas sobre as bases biológicas e comportamentais do transtorno." },
      { title: "Orientação Vocacional e de Carreira na Adolescência", desc: "Apoio na elaboração de dinâmicas e testes de interesse profissional para adolescentes típicos e atípicos." },
      { title: "Desenvolvimento de Oficinas de Contação de Histórias", desc: "Criação de roteiros lúdicos que estimulem a imaginação, linguagem e expressão de sentimentos na primeira infância." },
      { title: "Manejo de Crises Sensoriais no TEA", desc: "Estudo e observação de técnicas de acolhimento físico e diminuição de sobrecarga sensorial (luz, som, texturas)." },
      { title: "Elaboração de Atas de Reuniões Multidisciplinares", desc: "Registro formal das decisões tomadas e dos pontos discutidos entre psicólogos, fonoaudiólogos e terapeutas ocupacionais." },
      { title: "Organização de Acervo de Testes Infantis", desc: "Catalogação e manutenção de materiais psicométricos voltados à avaliação cognitiva e de aprendizagem infantil." },
      { title: "Auxílio em Oficinas de Estimulação Cognitiva", desc: "Apoio no planejamento de atividades que promovam memória de trabalho, raciocínio lógico e velocidade de processamento." },
      { title: "Análise de Fatores de Risco no Ambiente Familiar", desc: "Identificação de dinâmicas familiares que impactam negativamente o desenvolvimento e a saúde mental infantil." },
      { title: "Observação de Atendimentos Psicoterapêuticos Online", desc: "Acompanhamento de sessões virtuais com adolescentes ou sessões de orientação parental online." },
      { title: "Planejamento de Altas em Psicoterapia Infantil", desc: "Discussão de critérios clínicos e preparação de documentos finais para o encerramento do processo terapêutico infantil." },
      { title: "Estudo de Psicopatologia da Infância e Adolescência", desc: "Leitura e discussão semanal do DSM-5 voltado para transtornos do neurodesenvolvimento e de comportamento disruptivo." },
      { title: "Diagnóstico Institucional da Clínica Infantil", desc: "Avaliação das barreiras de acessibilidade e acolhimento das dependências físicas da Porto Terapia." },
      { title: "Estudo sobre Transtornos de Aprendizagem", desc: "Leitura dirigida sobre dislexia, disgrafia e discalculia em conjunto com abordagens psicopedagógicas." },
      { title: "Auxílio na Condução de Treinamento de Assertividade", desc: "Planejamento de treinos de habilidades sociais para crianças tímidas ou com fobia social." },
      { title: "Intervenção Baseada no Modelo Denver (ESDM)", desc: "Estudo e observação de técnicas de estimulação precoce baseadas no jogo e rotinas diárias para bebês de risco." },
      { title: "Observação de Terapia Familiar Sistêmica", desc: "Acompanhamento de sessões focadas na comunicação e nos limites geracionais entre pais e filhos." },
      { title: "Desenvolvimento de Roteiros de Anamnese Infantil", desc: "Atualização de questionários de entrevista inicial baseando-se nas etapas do desenvolvimento infantil." },
      { title: "Treino de Habilidades Executivas no TDAH", desc: "Criação de roteiros práticos de organização do tempo, uso de agendas e organização de tarefas escolares." },
      { title: "Monitoramento de Lista de Espera Infantil", desc: "Triagem e contato telefônico de atualização com famílias aguardando vagas para psicoterapia infantil ou psicopedagogia." },
      { title: "Redação de Diários de Campo do Estágio", desc: "Registro diário reflexivo sobre as experiências com o atendimento infantil para discussão em supervisão." },
      { title: "Mapeamento de Barreiras de Inclusão Escolar", desc: "Avaliação das dificuldades enfrentadas por pacientes atípicos na adaptação ao currículo escolar comum." },
      { title: "Apoio na Integração de Novos Estagiários na Ala Infantil", desc: "Condução de visitas guiadas e treinamento básico de funcionamento dos consultórios lúdicos." },
      { title: "Estudo de Neurobiologia do TDAH e Autismo", desc: "Discussão científica sobre o funcionamento cerebral, sinapses e fatores genéticos envolvidos nos transtornos." },
      { title: "Desenvolvimento de Campanhas contra o Bullying Escolar", desc: "Criação de materiais educativos para conscientização sobre o respeito às diferenças em ambiente escolar." },
      { title: "Auxílio no Registro e Análise de Ouvidoria Familiar", desc: "Catalogação de sugestões e reclamações dos pais para melhoria no atendimento às crianças na clínica." },
      { title: "Discussão de Protocolos de Intervenção Precoce", desc: "Análise crítica de diretrizes mundiais sobre a importância do diagnóstico e intervenção nos primeiros anos de vida." },
      { title: "Elaboração de Relatórios de Devolutiva para Pais", desc: "Apoio na preparação de feedbacks claros, acolhedores e didáticos sobre os resultados das avaliações infantis." },
      { title: "Apoio em Dinâmicas de Grupo para Adolescentes", desc: "Planejamento de atividades focadas em autoimagem, uso saudável de redes sociais e pressão social." },
      { title: "Estimulação Psicomotora Terapêutica", desc: "Observação de dinâmicas corporais que auxiliam no equilíbrio, coordenação motora fina e esquema corporal infantil." },
      { title: "Estudo sobre TOD e o Impacto no Clima Escolar", desc: "Discussão de abordagens escolares de intervenção baseadas no suporte ao comportamento positivo." },
      { title: "Práticas de Regulação Emocional com Crianças", desc: "Desenvolvimento de recursos visuais (como o termômetro das emoções) para ensinar identificação de sentimentos." },
      { title: "Apoio na Elaboração de Planos de Ensino Individualizados (PEI)", desc: "Auxílio no planejamento de adaptações curriculares para estudantes com deficiência intelectual ou TEA." },
      { title: "Estudo de Farmacoterapia em Neuropediatria", desc: "Análise dos efeitos desejados e colaterais de medicações comuns para TDAH e distúrbios de comportamento." },
      { title: "Criação de Cartilhas sobre Higiene do Sono Infantil", desc: "Desenvolvimento de panfletos para pais contendo rotinas de sono para redução de agitação noturna." },
      { title: "Mapeamento de Estressores Ambientais para Crianças", desc: "Identificação de ruídos, luzes e rotinas caóticas que podem desestabilizar crianças atípicas." },
      { title: "Auxílio em Oficinas de Arteterapia Infantil", desc: "Planejamento de dinâmicas com tintas, argila e colagens para expressão não-verbal de emoções." },
      { title: "Análise de Habilidades Cognitivas de Superdotados", desc: "Avaliação de áreas de interesse intenso e elaboração de planos de acréscimo/aceleração de aprendizado." },
      { title: "Estudo sobre Seletividade Alimentar no Autismo", desc: "Leitura e discussão teórica de abordagens terapêuticas integradas para ampliação de repertório alimentar." },
      { title: "Elaboração de Protocolos de Prevenção a Acidentes na Clínica", desc: "Fiscalização de segurança dos brinquedos e quinas nas salas de atendimento lúdico." },
      { title: "Observação de Dinâmicas de Psicoterapia Parental Conjugal", desc: "Análise dos estressores que afetam o casal no cuidado diário de filhos com deficiência." },
      { title: "Mapeamento de Interesses Especiais (Hiperfoco) no TEA", desc: "Identificação de hiperfocos dos pacientes para uso estratégico como reforçadores nas sessões." },
      { title: "Auxílio em Dinâmicas de Autocompaixão para Mães/Cuidadores", desc: "Apoio na condução de reuniões voltadas ao acolhimento do estresse do cuidador (Burnout Parental)." },
      { title: "Estudo de Marcos Relevantes da Linguagem Infantil", desc: "Leitura dirigida sobre aquisição de fala, pragmática e comunicação social em crianças." },
      { title: "Desenvolvimento de Inventários de Recursos Resilientes em Famílias", desc: "Catalogação de rede de apoio familiar e fatores protetivos do lar." },
      { title: "Análise de Padrões de Birra vs. Crise Sensorial", desc: "Estudo clínico para diferenciação entre comportamentos manipulativos e sobrecargas no autismo." },
      { title: "Apoio em Grupos de Orientação Parental de Adolescentes", desc: "Auxílio na facilitação de grupos sobre limites, internet e sexualidade." },
      { title: "Estudo de Neuropsicologia Aplicada a Altas Habilidades", desc: "Discussão de assincronias do desenvolvimento em crianças com superdotação." },
      { title: "Observação de Terapia ABA Focada em Linguagem (VB-MAPP)", desc: "Acompanhamento da avaliação de marcos comportamentais verbais em autistas." },
      { title: "Análise de Aspectos de Gênero e Diversidade na Adolescência Atípica", desc: "Discussão ética sobre vulnerabilidades e direitos de adolescentes no espectro." },
      { title: "Apoio na Produção Científica sobre Neurodesenvolvimento", desc: "Auxílio no levantamento de referências bibliográficas atualizadas para publicações da clínica." },
      { title: "Estudo de Abordagens Psicanalíticas com Crianças", desc: "Leitura orientada sobre a constituição do sujeito na infância segundo autores clássicos." },
      { title: "Práticas de Autoavaliação de Competências Clínicas Infantis", desc: "Roteiro reflexivo de autoanálise sobre postura e manejo com a criança durante o estágio." },
      { title: "Observação de Avaliações Clínicas Interdisciplinares", desc: "Estudo de casos avaliados em conjunto por neurologistas infantis, psicólogos e psicopedagogos." }
    ];

    if (!intern) {
      return activitiesList.slice(0, 5);
    }

    // Gera uma semente simples baseada no id, nome e data de início (semestre) do estagiário
    const seedString = (intern.id || '') + (intern.name || '') + (intern.startDate || '');
    let hash = 5381;
    for (let i = 0; i < seedString.length; i++) {
      hash = ((hash << 5) + hash) + seedString.charCodeAt(i);
    }
    hash = Math.abs(hash);

    const shuffled = [...activitiesList];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = (hash + i) % (i + 1);
      const temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }

    return shuffled.slice(0, 5);
  };

  const getDocumentHtml = (type, intern = null) => {
    const headerHtml = `
      <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 25px;">
        <img src="/logo.jpg" style="height: 60px; margin-bottom: 10px; object-fit: contain;" alt="Logo Porto Terapia" />
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #1e3a8a; letter-spacing: 1px;">PORTO TERAPIA</h1>
        <p style="margin: 4px 0 0; font-size: 10px; text-transform: uppercase; color: #4b5563; font-weight: 600; letter-spacing: 2px;">Clínica de Psicologia e Desenvolvimento Humano</p>
        <p style="margin: 2px 0 0; font-size: 8px; color: #6b7280;">Belém - PA</p>
      </div>
    `;

    const footerHtml = `
      <div style="margin-top: 50px; border-top: 1px solid #e5e7eb; padding-top: 10px; text-align: center; font-size: 8px; color: #9ca3af;">
        Porto Terapia Clínica de Psicologia LTDA • Documento oficial eletrônico para fins de controle e registro acadêmico.
      </div>
    `;

    const startFormatted = intern?.startDate ? new Date(intern.startDate + 'T00:00:00').toLocaleDateString('pt-BR') : '____________________';
    const endFormatted = intern?.endDate ? new Date(intern.endDate + 'T00:00:00').toLocaleDateString('pt-BR') : '____________________';
    const internName = intern?.name || '________________________________________';
    const courseName = intern?.course || '____________________';
    const institutionName = intern?.institution || '________________________________________';
    const hoursCount = intern?.dailyHours || '[X]';
    const shiftName = intern?.shift || '[Turno]';
    const unitTitle = intern?.unitId ? unitName(intern.unitId) : '____________________';

    if (type === 'tce' || type === 'minuta') {
      const isMinuta = type === 'minuta';
      return `
        <div style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; line-height: 1.5; color: #1f2937; padding: 15px;">
          ${headerHtml}
          <div style="text-align: center; margin-bottom: 15px;">
            <h2 style="margin: 0; font-size: 12px; font-weight: 800; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">TERMO DE COMPROMISSO DE ESTÁGIO NÃO OBRIGATÓRIO</h2>
            <p style="margin: 2px 0 0; font-size: 8px; color: #6b7280;">Regulado pela Lei nº 11.788 de 25/09/2008</p>
          </div>

          <table style="border-collapse: collapse; margin-bottom: 12px; font-size: 9px; width: 100%;">
            <tr style="background-color: #f3f4f6;">
              <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;" colspan="2">INSTITUIÇÃO DE ENSINO (INTERVENIENTE)</td>
            </tr>
            <tr>
              <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold; width: 25%;">Razão Social:</td>
              <td style="border: 1px solid #d1d5db; padding: 5px;">${intern?.institution || 'INSTITUTO CAMPINENSE DE ENSINO SUPERIOR LTDA – UNAMA ALCINDO CACELA'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">Endereço:</td>
              <td style="border: 1px solid #d1d5db; padding: 5px;">Av. Alcindo Cacela, n°:287, Bairro: Umarizal, Belém - Pará, CEP: 66.035-190</td>
            </tr>
            <tr>
              <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">CNPJ:</td>
              <td style="border: 1px solid #d1d5db; padding: 5px;">05.933.016/0006-85</td>
            </tr>
          </table>

          <table style="border-collapse: collapse; margin-bottom: 12px; font-size: 9px; width: 100%;">
            <tr style="background-color: #f3f4f6;">
              <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;" colspan="2">CONCEDENTE</td>
            </tr>
            <tr>
              <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold; width: 25%;">Razão Social:</td>
              <td style="border: 1px solid #d1d5db; padding: 5px;">NKN PHYSIOTERAPY CENTER LTDA</td>
            </tr>
            <tr>
              <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">Endereço:</td>
              <td style="border: 1px solid #d1d5db; padding: 5px;">R Antonio Barreto, 2050, Bairro: Fatima, Belém - Pará, CEP: 66.060-021</td>
            </tr>
            <tr>
              <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">CNPJ:</td>
              <td style="border: 1px solid #d1d5db; padding: 5px;">40.192.432/0002-47</td>
            </tr>
          </table>

          <table style="border-collapse: collapse; margin-bottom: 12px; font-size: 9px; width: 100%;">
            <tr style="background-color: #f3f4f6;">
              <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;" colspan="2">ESTAGIÁRIO(A)</td>
            </tr>
            <tr>
              <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold; width: 25%;">Nome Completo:</td>
              <td style="border: 1px solid #d1d5db; padding: 5px;">${internName}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">Documentos:</td>
              <td style="border: 1px solid #d1d5db; padding: 5px;">CPF/MF: ${intern?.cpf || '_____________________'} &nbsp;|&nbsp; RG: ${intern?.rg || '_____________________'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">Endereço:</td>
              <td style="border: 1px solid #d1d5db; padding: 5px;">${intern?.address || '_____________________'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">Curso / Matrícula:</td>
              <td style="border: 1px solid #d1d5db; padding: 5px;">Regularmente matriculado(a) no curso de <strong>${courseName}</strong> de nível Superior</td>
            </tr>
          </table>

          <p style="text-align: justify; margin-bottom: 10px; font-size: 9.5px;">
            Celebram entre si o presente Termo de Compromisso de Estágio Não Obrigatório, convencionando as cláusulas e condições a seguir:
          </p>

          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 8px; border-radius: 6px; margin-bottom: 12px; font-size: 9.5px;">
            <p style="margin: 0 0 4px 0;"><strong>1) Período de vigência deste Instrumento:</strong> De <strong>${startFormatted}</strong> a <strong>${endFormatted}</strong>, podendo ser rescindido unilateralmente por qualquer das partes, a qualquer momento, sem ônus, multas ou aviso-prévio, mediante formalização do respectivo Termo de Rescisão;</p>
            <p style="margin: 0 0 4px 0;"><strong>2) Jornada:</strong> <strong>${hoursCount} horas diárias</strong> (${shiftName});</p>
            <p style="margin: 0 0 4px 0;"><strong>3) Atividade do(a) estagiário(a):</strong> A atividade de <strong>${courseName}</strong> será supervisionada pelo(a) seu(sua) supervisor(a) de estágio, o(a) profissional <strong>${intern?.supervisorName || '________________________'}</strong>;</p>
            <p style="margin: 0;"><strong>4) Valor da Bolsa-estágio:</strong> No período do estágio o(a) Estagiário(a) receberá, diretamente da Parte Concedente, a importância mensal correspondente a: <strong>${getBolsaAuxilioText(intern)}</strong> (não se aplicando ao benefício de auxílio-transporte o desconto previsto na CLT).</p>
          </div>

          <div style="text-align: justify; font-size: 8.5px; line-height: 1.4;">
            <p style="margin: 0 0 5px 0;"><strong>Cláusula 1ª</strong> - O presente Termo de Compromisso de Estágio estabelece as condições básicas para a consecução do estágio, previsto nos Artigos 1º, 2º, 3º e 4º da Lei nº 11.788 de 25/09/2008, visando o exercício prático de competências próprias da atividade profissional e à contextualização curricular, objetivando o desenvolvimento do educando para a vida cidadã e para o trabalho, proporcionadas pela aprendizagem social profissional e cultural no ambiente de trabalho.</p>
            
            <p style="margin: 0 0 5px 0;"><strong>Cláusula 2ª</strong> - O estágio pode ser obrigatório ou não-obrigatório, conforme determinação das diretrizes curriculares, modalidade e área de ensino e do projeto pedagógico do curso.</p>
            
            <p style="margin: 0 0 5px 0;"><strong>Cláusula 3ª</strong> - O estágio, tanto o obrigatório quanto o não-obrigatório, não cria vínculo empregatício de qualquer natureza, observadas as disposições previstas no Artigo 3º da Legislação do Estágio.</p>
            
            <p style="margin: 0 0 5px 0;"><strong>Cláusula 4ª</strong> - A Instituição de Ensino comunicará à parte concedente do estágio, através do(a) Aluno(a), as datas de realização de avaliações escolares ou acadêmicas.</p>
            
            <p style="margin: 0 0 5px 0;"><strong>Cláusula 5ª</strong> - Se a Instituição de Ensino adotar verificações de aprendizagem periódicas ou finais, no período de estágio do(a) Estudante, a carga horária do estágio, nestas datas, bem como a remuneração, poderá ser reduzida à metade para assegurar o bom desempenho do(a) Estudante no curso.</p>
            
            <p style="margin: 0 0 5px 0;"><strong>Cláusula 6ª</strong> - Caberá à Empresa ou Organização concedente do estágio a apresentação periódica, em prazo não superior a seis meses, do relatório das atividades do(a) Estagiário(a), na conclusão do estágio ou, se for o caso, na rescisão antecipada do Termo de Compromisso de Estágio.</p>
            
            <p style="margin: 0 0 5px 0;"><strong>Cláusula 7ª</strong> - O horário do estágio não deverá, em hipótese alguma, prejudicar a frequência do(a) Aluno(a) às aulas e provas do curso no qual está matriculado(a).</p>
            
            <p style="margin: 0 0 5px 0;"><strong>Cláusula 8ª</strong> - A assiduidade do(a) Estagiário(a) será demonstrada pela marcação de entrada e saída em cartão de ponto ou qualquer outra modalidade de controle adotada pela Parte Concedente.</p>
            <p style="margin: 0 0 5px 15px;">8.1 - O ESTAGIÁRIO declara estar ciente de que a CLÍNICA disponibiliza dispositivo físico em suas dependências para o registro diário de frequência. Fica facultado ao ESTAGIÁRIO, por mera liberalidade e conveniência própria, a utilização de seu dispositivo móvel pessoal para efetuar o referido registro, não constituindo tal ato qualquer exigência da parte concedente ou ônus para o estudante.</p>
            
            <p style="margin: 0 0 5px 0;"><strong>Cláusula 9ª</strong> - Em decorrência do presente Termo de Compromisso de Estágio celebra-se neste ato, entre a EMPRESA e a Instituição de Ensino, o(a) qual o(a) aluno(a) é matriculado(a).</p>
            
            <p style="margin: 0 0 5px 0;"><strong>Cláusula 10ª</strong> - O estágio, como ato educativo escolar supervisionado, deverá ter acompanhamento efetivo pelo professor orientador da Instituição de Ensino e por supervisor da Parte EMPRESA, comprovado por vistos nos relatórios referidos na Cláusula 6ª deste Instrumento.</p>
            
            <p style="margin: 0 0 5px 0;"><strong>Cláusula 11ª</strong> - O descumprimento das obrigações previstas na Legislação do Estágio caracteriza vínculo de emprego do Educando com a Parte Concedente do estágio para todos os fins da legislação trabalhista e previdenciária.</p>
            
            <p style="margin: 0 0 5px 0;"><strong>Cláusula 12ª</strong> - Ficam estabelecidas entre as partes as condições acordadas para a consecução do estágio objeto deste Instrumento:</p>
            <p style="margin: 0 0 3px 15px;">12.1 - As atividades descritas no quadro resumo poderão ser alteradas com o progresso do estágio e do currículo escolar, objetivando, sempre, a compatibilização e a complementação do curso;</p>
            <p style="margin: 0 0 3px 15px;">12.2 - O valor da bolsa-estágio descrito acima poderá variar em decorrência do exposto na cláusula 5ª deste Instrumento ou se ocorrer, por parte do(a) Estagiário(a) – independentemente do motivo - o não cumprimento das obrigações acordadas no presente Termo de Compromisso de Estágio.</p>
            <p style="margin: 0 0 3px 15px;">12.3 – O valor da bolsa-estágio está sujeito à retenção de imposto de renda, conforme tabela em vigor definida pela Secretaria da Receita Federal;</p>
            <p style="margin: 0 0 3px 15px;">12.4 – A concessão da bolsa-estágio, bem como o auxílio-transporte, são compulsórios nos casos de estágios não obrigatórios;</p>
            <p style="margin: 0 0 3px 15px;">12.5 - A importância referente à bolsa-estágio, por não ter natureza salarial, não estará sujeita, a qualquer desconto trabalhista, previdenciário ou mesmo vinculado ao FGTS, exceção feita a eventual desconto correspondente ao imposto de Renda, consoante a cláusula 12.3;</p>
            <p style="margin: 0 0 5px 15px;">12.6 - É assegurado ao estagiário, sempre que o estágio tenha duração igual ou superior a 1 (um) ano, período de recesso de 30 (trinta) dias - ou o proporcional ao período estagiado - a ser gozado preferencialmente durante suas férias escolares.</p>
            
            <p style="margin: 0 0 5px 0;"><strong>Cláusula 13ª</strong> - Caberá ao Estagiário a obrigação de informar à EMPRESA quaisquer alterações ocorridas no transcurso da sua atividade escolar, tais como interrupção de frequência às aulas, mudança de curso ou transferência de Instituição de Ensino.</p>
            <p style="margin: 0 0 5px 15px;">13.1 – É de responsabilidade do(a) Estagiário(a) preservar o sigilo e a confidencialidade das informações a que tiver acesso no decorrer do seu estágio junto à EMPRESA.</p>
            
            <p style="margin: 0 0 5px 0;"><strong>Cláusula 14ª</strong> - Serão motivos de rescisão automática do presente Instrumento Jurídico:</p>
            <p style="margin: 0 0 3px 15px;">a. o abandono ou interrupção do curso pelo(a) Aluno(a), trancamento de matrícula ou conclusão do curso;</p>
            <p style="margin: 0 0 5px 15px;">b. o não cumprimento de quaisquer das cláusulas previstas neste Instrumento Jurídico.</p>
            
            <p style="margin: 0 0 5px 0;"><strong>Cláusula 15ª</strong> - Aplica-se ao Estagiário a Legislação relacionada à saúde e segurança no trabalho, sendo sua implementação de responsabilidade da Parte concedente do Estágio.</p>
            
            <p style="margin: 0 0 5px 0;"><strong>Cláusula 17ª</strong> – O presente Instrumento poderá ser renovado na forma da Lei e denunciado, a qualquer tempo, mediante comunicação escrita, pela Instituição de Ensino, pela EMPRESA ou pelo(a) Estagiário(a).</p>
          </div>

          <p style="margin-top: 15px; margin-bottom: 25px; text-align: justify; font-size: 9px;">
            As partes, por estarem de acordo quanto ao cumprimento dos termos mutuamente firmados, assinam o presente em três vias de igual teor e conteúdo.
          </p>

          <p style="text-align: right; margin-bottom: 30px; font-size: 9.5px;">Belém/PA, ${new Date().toLocaleDateString('pt-BR')}.</p>

          <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 8px; margin-top: 25px;">
            <tr>
              <td style="width: 33%; vertical-align: top; padding: 5px;">
                <div style="border-top: 1px solid #9ca3af; margin-top: 20px; padding-top: 3px;">
                  <strong>Instituição de Ensino</strong><br>Interveniente
                </div>
              </td>
              <td style="width: 33%; vertical-align: top; padding: 5px;">
                <div style="border-top: 1px solid #9ca3af; margin-top: 20px; padding-top: 3px;">
                  <strong>NKN PHYSIOTERAPY CENTER LTDA</strong><br>Parte Concedente
                </div>
              </td>
              <td style="width: 33%; vertical-align: top; padding: 5px;">
                <div style="border-top: 1px solid #9ca3af; margin-top: 20px; padding-top: 3px;">
                  <strong>Estagiário(a)</strong><br>${internName}
                </div>
              </td>
            </tr>
          </table>
          ${footerHtml}
        </div>
      `;
    }

    if (type === 'pae') {
      return `
        <div style="font-family: 'Inter', Arial, sans-serif; font-size: 11px; line-height: 1.5; color: #1f2937; padding: 20px;">
          ${headerHtml}
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 14px; font-weight: 700; color: #111827;">PLANO DE ATIVIDADES DE ESTÁGIO (PAE)</h2>
            <p style="margin: 2px 0 0; font-size: 9px; color: #6b7280;">Anexo ao Termo de Compromisso de Estágio</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px;">
            <tr style="background-color: #f3f4f6;">
              <td style="border: 1px solid #d1d5db; padding: 6px; font-weight: bold; width: 25%;">Nome do Estagiário:</td>
              <td style="border: 1px solid #d1d5db; padding: 6px;" colspan="3">${internName}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #d1d5db; padding: 6px; font-weight: bold;">Instituição de Ensino:</td>
              <td style="border: 1px solid #d1d5db; padding: 6px;">${institutionName}</td>
              <td style="border: 1px solid #d1d5db; padding: 6px; font-weight: bold; width: 15%;">Curso:</td>
              <td style="border: 1px solid #d1d5db; padding: 6px;">${courseName}</td>
            </tr>
            <tr style="background-color: #f9fafb;">
              <td style="border: 1px solid #d1d5db; padding: 6px; font-weight: bold;">Período do Estágio:</td>
              <td style="border: 1px solid #d1d5db; padding: 6px;">${startFormatted} a ${endFormatted}</td>
              <td style="border: 1px solid #d1d5db; padding: 6px; font-weight: bold;">Carga Horária:</td>
              <td style="border: 1px solid #d1d5db; padding: 6px;">${hoursCount}h diárias (${shiftName})</td>
            </tr>
          </table>

          <h3 style="font-size: 12px; font-weight: 700; margin-top: 20px; margin-bottom: 10px; color: #111827; border-bottom: 1px solid #d1d5db; padding-bottom: 3px;">ATIVIDADES PREVISTAS</h3>
          
          <ul style="padding-left: 20px; margin-bottom: 30px;">
            ${getPaeActivities(intern).map(act => `
              <li style="margin-bottom: 8px; text-align: justify;"><strong>${act.title}:</strong> ${act.desc}</li>
            `).join('')}
          </ul>

          <table style="width: 100%; border-collapse: collapse; margin-top: 50px; text-align: center; font-size: 10px;">
            <tr>
              <td style="width: 50%; vertical-align: top; padding: 10px;">
                <div style="border-top: 1px solid #9ca3af; margin-top: 30px; padding-top: 5px;">
                  <strong>Supervisora de Estágio: ${intern?.supervisorName || '________________________'}</strong><br>Porto Terapia
                </div>
              </td>
              <td style="width: 50%; vertical-align: top; padding: 10px;">
                <div style="border-top: 1px solid #9ca3af; margin-top: 30px; padding-top: 5px;">
                  <strong>Estagiário(a)</strong><br>${internName}
                </div>
              </td>
            </tr>
          </table>
          ${footerHtml}
        </div>
      `;
    }

    if (type === 'ficha') {
      return `
        <div style="font-family: 'Inter', Arial, sans-serif; font-size: 11px; line-height: 1.5; color: #1f2937; padding: 20px;">
          ${headerHtml}
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 14px; font-weight: 700; color: #111827;">FICHA CADASTRAL DO ESTAGIÁRIO</h2>
            <p style="margin: 2px 0 0; font-size: 9px; color: #6b7280;">Cadastro Interno de Dados Individuais</p>
          </div>

          <h3 style="font-size: 11px; font-weight: 700; color: #1e3a8a; margin-top: 15px; margin-bottom: 5px; border-bottom: 1px solid #e5e7eb;">1. DADOS PESSOAIS</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10px;">
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold; width: 15%;">Nome Completo:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px;" colspan="3">${internName}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold;">CPF:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px; width: 35%;">${intern?.cpf || '___________________________'}</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold; width: 15%;">RG:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px;">${intern?.rg || '___________________________'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold;">E-mail:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px;">${intern?.email || '___________________________'}</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold;">Telefone:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px;">${intern?.phone || '___________________________'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold;">Endereço:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px;" colspan="3">${intern?.address || '__________________________________________________________________'}</td>
            </tr>
          </table>

          <h3 style="font-size: 11px; font-weight: 700; color: #1e3a8a; margin-top: 15px; margin-bottom: 5px; border-bottom: 1px solid #e5e7eb;">2. INFORMAÇÕES ACADÊMICAS & VÍNCULO</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10px;">
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold; width: 15%;">Instituição:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px; width: 35%;">${institutionName}</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold; width: 15%;">Curso:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px;">${courseName}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold;">Unidade Padrão:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px;">${unitTitle}</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold;">Vigência Contrato:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px;">${startFormatted} a ${endFormatted}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold;">Turno Estágio:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px;">${shiftName}</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold;">Carga Horária:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px;">${hoursCount}h diárias</td>
            </tr>
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold;">Bolsa/Auxílio:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px;" colspan="3">${getBolsaAuxilioText(intern)}</td>
            </tr>
          </table>

          <h3 style="font-size: 11px; font-weight: 700; color: #1e3a8a; margin-top: 15px; margin-bottom: 5px; border-bottom: 1px solid #e5e7eb;">3. DADOS BANCÁRIOS</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10px;">
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold; width: 15%;">Banco:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px; width: 25%;">${intern?.bankName || '_________________'}</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold; width: 15%;">Agência:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px; width: 15%;">${intern?.bankAgency || '___________'}</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold; width: 15%;">Conta Corrente:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px;">${intern?.bankAccount || '___________'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold; width: 15%;">Chave PIX (CPF):</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px;" colspan="5">${intern?.pixKey || '___________'}</td>
            </tr>
          </table>

          <h3 style="font-size: 11px; font-weight: 700; color: #1e3a8a; margin-top: 15px; margin-bottom: 5px; border-bottom: 1px solid #e5e7eb;">4. CONTATO DE EMERGÊNCIA</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 10px;">
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold; width: 15%;">Nome do Contato:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px; width: 35%;">${intern?.emergencyName || '______________________________________'}</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold; width: 15%;">Grau Parentesco:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px;">${intern?.emergencyRelationship || '___________________'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 5px; font-weight: bold;">Telefone Contato:</td>
              <td style="border: 1px solid #e5e7eb; padding: 5px;" colspan="3">${intern?.emergencyPhone || '______________________________________'}</td>
            </tr>
          </table>

          <p style="text-align: right; font-size: 9px; color: #4b5563; margin-top: 20px;">Declaro serem verídicas as informações cadastradas acima.</p>
          <div style="display: flex; justify-content: flex-end; margin-top: 40px;">
            <div style="border-top: 1px solid #9ca3af; width: 250px; text-align: center; padding-top: 5px; font-size: 10px;">
              Assinatura do(a) Estagiário(a)
            </div>
          </div>
          ${footerHtml}
        </div>
      `;
    }

    if (type === 'carta_desligamento') {
      const termDateFormatted = intern?.contractTermination?.date ? new Date(intern.contractTermination.date + 'T00:00:00').toLocaleDateString('pt-BR') : '____________________';
      return `
        <div style="font-family: 'Inter', Arial, sans-serif; font-size: 11px; line-height: 1.6; color: #1f2937; padding: 25px;">
          ${headerHtml}
          <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="margin: 0; font-size: 14px; font-weight: 700; color: #111827; text-transform: uppercase;">Pedido de Rescisão de Termo de Compromisso de Estágio</h2>
            <p style="margin: 2px 0 0; font-size: 9px; color: #6b7280;">Carta de Solicitação de Desligamento por Iniciativa Própria</p>
          </div>
          
          <p style="margin-bottom: 15px;">À Direção da <strong>PORTO TERAPIA CLINICA DE PSICOLOGIA LTDA</strong>,</p>

          <p style="text-align: justify; margin-bottom: 20px;">
            Eu, <strong>${internName}</strong>, inscrito(a) no CPF sob o nº <strong>${intern?.cpf || '_____________________'}</strong>, estudante regular do curso de <strong>${courseName}</strong> na instituição de ensino <strong>${institutionName}</strong>, venho por meio desta solicitar formalmente o desligamento do meu estágio, exercido na <strong>${unitTitle}</strong>, por motivos particulares de cunho pessoal/profissional.
          </p>

          <p style="text-align: justify; margin-bottom: 20px;">
            Desta forma, solicito a rescisão do Termo de Compromisso de Estágio (TCE) firmado com esta Clínica a partir do dia <strong>${termDateFormatted}</strong>, data em que encerrarei minhas atividades práticas e repassarei todas as pendências administrativas relativas aos prontuários e acompanhamentos de pacientes sob minha responsabilidade.
          </p>

          <p style="text-align: justify; margin-bottom: 30px;">
            Agradeço a oportunidade de aprendizado e desenvolvimento profissional concedida durante o período de convivência com a equipe técnica e supervisores da Porto Terapia.
          </p>

          <p style="text-align: right; margin-bottom: 50px;">Belém/PA, ${new Date().toLocaleDateString('pt-BR')}.</p>

          <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 10px; margin-top: 40px;">
            <tr>
              <td style="width: 50%; vertical-align: top; padding: 10px;">
                <div style="border-top: 1px solid #9ca3af; margin-top: 30px; padding-top: 5px;">
                  <strong>Estagiário(a) Solicitante</strong><br>${internName}
                </div>
              </td>
              <td style="width: 50%; vertical-align: top; padding: 10px;">
                <div style="border-top: 1px solid #9ca3af; margin-top: 30px; padding-top: 5px;">
                  <strong>Porto Terapia</strong><br>Representante Concedente
                </div>
              </td>
            </tr>
          </table>
          ${footerHtml}
        </div>
      `;
    }

    if (type === 'relatorio_individual') {
      const internRecords = records.filter(r => r.internId === intern.id);
      const auditOccurrences = internRecords.filter(r => r.action === 'ocorrencia' && (r.justification || '').startsWith('[AUDITORIA SISTÊMICA]'));
      const manualOccurrences = internRecords.filter(r => r.action === 'ocorrencia' && !(r.justification || '').startsWith('[AUDITORIA SISTÊMICA]'));
      
      const occurrencesHtml = manualOccurrences.length > 0 
        ? manualOccurrences.map(r => `
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 6px;">${new Date(r.timestamp).toLocaleDateString('pt-BR')}</td>
              <td style="border: 1px solid #e5e7eb; padding: 6px; font-weight: bold; color: #1e3a8a;">
                ${r.justificationDoc?.type === 'atestado' ? 'Atestado Médico' : (r.justificationDoc?.type === 'falta' ? 'Falta Justificada' : (r.justificationDoc?.type === 'atraso' ? 'Atraso' : 'Outros'))}
              </td>
              <td style="border: 1px solid #e5e7eb; padding: 6px;">${r.justification || 'Sem justificativa detalhada'}</td>
              <td style="border: 1px solid #e5e7eb; padding: 6px; text-align: center;">${r.daysAway || 0} dias</td>
            </tr>
          `).join('')
        : '<tr><td colspan="4" style="text-align: center; color: #6b7280; padding: 10px;">Nenhuma ocorrência registrada no período.</td></tr>';

      const auditHtml = auditOccurrences.length > 0
        ? auditOccurrences.map(r => `
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 6px;">${new Date(r.timestamp).toLocaleDateString('pt-BR')}</td>
              <td style="border: 1px solid #e5e7eb; padding: 6px; color: #b91c1c; font-weight: bold;">Auditoria de Ponto</td>
              <td style="border: 1px solid #e5e7eb; padding: 6px;">${r.justification.replace('[AUDITORIA SISTÊMICA] ', '')}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="3" style="text-align: center; color: #10b981; padding: 10px; font-weight: 500;">✓ Nenhuma divergência de auditoria ativa nos últimos 30 dias.</td></tr>';

      const semestralList = Object.entries(intern?.semestralReports || {});
      const semestralHtml = semestralList.length > 0
        ? semestralList.map(([period, doc]) => `
            <tr>
              <td style="border: 1px solid #e5e7eb; padding: 6px; font-weight: bold; color: #1e3a8a;">Relatório ${period}º Período</td>
              <td style="border: 1px solid #e5e7eb; padding: 6px;">${doc.name || 'documento.pdf'}</td>
              <td style="border: 1px solid #e5e7eb; padding: 6px; text-align: center;">${doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('pt-BR') : '-'}</td>
              <td style="border: 1px solid #e5e7eb; padding: 6px; text-align: center; font-weight: bold; color: #10b981;">✓ Entregue</td>
            </tr>
          `).join('')
        : '<tr><td colspan="4" style="text-align: center; color: #6b7280; padding: 10px;">Nenhum Relatório Semestral entregue até o momento.</td></tr>';

      return `
        <div style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; line-height: 1.5; color: #1f2937; padding: 20px;">
          ${headerHtml}
          
          <div style="text-align: center; margin-bottom: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">
            <h2 style="margin: 0; font-size: 14px; font-weight: 800; color: #111827; text-transform: uppercase;">RELATÓRIO INDIVIDUAL DE ACOMPANHAMENTO</h2>
            <p style="margin: 2px 0 0; font-size: 9px; color: #6b7280;">Histórico Consolidado de Frequência, Ocorrências e Documentos do Estagiário</p>
          </div>

          <div style="display: flex; gap: 20px; margin-bottom: 25px; align-items: flex-start;">
            <div style="width: 100px; height: 133px; border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; background-color: #f3f4f6; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
              ${intern?.photo 
                ? `<img src="${intern.photo}" style="width: 100%; height: 100%; object-fit: cover;" />` 
                : `<span style="font-size: 8px; font-weight: bold; color: #9ca3af; text-align: center; padding: 5px;">Foto 3x4 Ausente</span>`
              }
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
              <tr>
                <td style="padding: 4px 8px; font-weight: bold; background-color: #f9fafb; border: 1px solid #e5e7eb; width: 25%;">Nome Completo:</td>
                <td style="padding: 4px 8px; border: 1px solid #e5e7eb;" colspan="3"><strong>${internName}</strong></td>
              </tr>
              <tr>
                <td style="padding: 4px 8px; font-weight: bold; background-color: #f9fafb; border: 1px solid #e5e7eb; width: 25%;">Curso / Ensino:</td>
                <td style="padding: 4px 8px; border: 1px solid #e5e7eb; width: 35%;">${courseName}</td>
                <td style="padding: 4px 8px; font-weight: bold; background-color: #f9fafb; border: 1px solid #e5e7eb; width: 15%;">Instituição:</td>
                <td style="padding: 4px 8px; border: 1px solid #e5e7eb;">${institutionName}</td>
              </tr>
              <tr>
                <td style="padding: 4px 8px; font-weight: bold; background-color: #f9fafb; border: 1px solid #e5e7eb;">Vigência Contrato:</td>
                <td style="padding: 4px 8px; border: 1px solid #e5e7eb;">${startFormatted} a ${endFormatted}</td>
                <td style="padding: 4px 8px; font-weight: bold; background-color: #f9fafb; border: 1px solid #e5e7eb;">Carga Horária:</td>
                <td style="padding: 4px 8px; border: 1px solid #e5e7eb;">${hoursCount}h diárias (${shiftName})</td>
              </tr>
              <tr>
                <td style="padding: 4px 8px; font-weight: bold; background-color: #f9fafb; border: 1px solid #e5e7eb;">Unidade Principal:</td>
                <td style="padding: 4px 8px; border: 1px solid #e5e7eb;">${unitTitle}</td>
                <td style="padding: 4px 8px; font-weight: bold; background-color: #f9fafb; border: 1px solid #e5e7eb;">Supervisor:</td>
                <td style="padding: 4px 8px; border: 1px solid #e5e7eb;">${intern?.supervisorName || 'Não designado'}</td>
              </tr>
              <tr>
                <td style="padding: 4px 8px; font-weight: bold; background-color: #f9fafb; border: 1px solid #e5e7eb;">CPF:</td>
                <td style="padding: 4px 8px; border: 1px solid #e5e7eb;">${intern?.cpf || '-'}</td>
                <td style="padding: 4px 8px; font-weight: bold; background-color: #f9fafb; border: 1px solid #e5e7eb;">RG:</td>
                <td style="padding: 4px 8px; border: 1px solid #e5e7eb;">${intern?.rg || '-'}</td>
              </tr>
              <tr>
                <td style="padding: 4px 8px; font-weight: bold; background-color: #f9fafb; border: 1px solid #e5e7eb;">E-mail:</td>
                <td style="padding: 4px 8px; border: 1px solid #e5e7eb;">${intern?.email || '-'}</td>
                <td style="padding: 4px 8px; font-weight: bold; background-color: #f9fafb; border: 1px solid #e5e7eb;">Telefone:</td>
                <td style="padding: 4px 8px; border: 1px solid #e5e7eb;">${intern?.phone || '-'}</td>
              </tr>
            </table>
          </div>

          <h3 style="font-size: 11px; font-weight: bold; color: #1e3a8a; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; margin-top: 15px; margin-bottom: 8px;">1. Histórico de Entregas de Acompanhamentos Semestrais</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 15px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: left;">Período</th>
                <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: left;">Nome do Arquivo</th>
                <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: center;">Data de Envio</th>
                <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${semestralHtml}
            </tbody>
          </table>

          <h3 style="font-size: 11px; font-weight: bold; color: #1e3a8a; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; margin-top: 15px; margin-bottom: 8px;">2. Histórico de Ocorrências Administrativas (Faltas, Atrasos e Atestados)</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 15px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: left; width: 15%;">Data</th>
                <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: left; width: 25%;">Tipo</th>
                <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: left;">Descrição / Justificativa</th>
                <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: center; width: 15%;">Duração</th>
              </tr>
            </thead>
            <tbody>
              ${occurrencesHtml}
            </tbody>
          </table>

          <h3 style="font-size: 11px; font-weight: bold; color: #1e3a8a; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; margin-top: 15px; margin-bottom: 8px;">3. Alertas Sistêmicos de Auditoria de Ponto (Últimos 30 Dias)</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 25px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: left; width: 15%;">Data</th>
                <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: left; width: 25%;">Tipo Alerta</th>
                <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: left;">Descrição da Inconsistência</th>
              </tr>
            </thead>
            <tbody>
              ${auditHtml}
            </tbody>
          </table>

          <p style="text-align: right; font-size: 9px; color: #4b5563; margin-top: 25px;">Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}.</p>
          
          <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 9px; margin-top: 35px;">
            <tr>
              <td style="width: 50%; vertical-align: top; padding: 10px;">
                <div style="border-top: 1px solid #9ca3af; margin-top: 25px; padding-top: 5px; width: 80%; margin-left: auto; margin-right: auto;">
                  <strong>Supervisor de Estágio</strong><br>Porto Terapia
                </div>
              </td>
              <td style="width: 50%; vertical-align: top; padding: 10px;">
                <div style="border-top: 1px solid #9ca3af; margin-top: 25px; padding-top: 5px; width: 80%; margin-left: auto; margin-right: auto;">
                  <strong>Estagiário(a)</strong><br>${internName}
                </div>
              </td>
            </tr>
          </table>
          ${footerHtml}
        </div>
      `;
    }

    if (type === 'declaracao') {
      return `
        <div style="font-family: 'Inter', Arial, sans-serif; font-size: 11px; line-height: 1.8; color: #1f2937; padding: 30px;">
          ${headerHtml}
          <div style="text-align: center; margin-top: 40px; margin-bottom: 50px;">
            <h2 style="margin: 0; font-size: 16px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 1px;">DECLARAÇÃO DE VÍNCULO</h2>
          </div>

          <p style="text-align: justify; text-indent: 50px; margin-bottom: 30px;">
            Declaramos, para os devidos fins de comprovação junto à instituição de ensino e demais interessados, que o(a) estudante <strong>${internName}</strong>, inscrito(a) sob o CPF nº <strong>${intern?.cpf || '_____________________'}</strong>, é estagiário(a) regularmente matriculado(a) no curso de <strong>${courseName}</strong> na instituição de ensino <strong>${institutionName}</strong> e atualmente desenvolve estágio prático curricular não obrigatório nas dependências da Clínica Porto Terapia, unidade <strong>${unitTitle}</strong>.
          </p>

          <p style="text-align: justify; text-indent: 50px; margin-bottom: 30px;">
            O contrato de estágio iniciou-se em <strong>${startFormatted}</strong> e possui previsão de encerramento em <strong>${endFormatted}</strong>, com carga horária de <strong>${hoursCount} horas diárias</strong>, totalizando <strong>30 horas semanais</strong> no turno <strong>${shiftName}</strong>.
          </p>

          <p style="text-align: justify; text-indent: 50px; margin-bottom: 40px; font-weight: bold; color: #4b5563;">
            Período de Vínculo com a Clínica. A validade desta declaração é de 30 dias a partir da data de sua emissão.
          </p>

          <p style="text-align: right; margin-top: 60px; margin-bottom: 60px;">
            Belém/PA, ${new Date().toLocaleDateString('pt-BR')}.
          </p>

          <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 10px; margin-top: 50px;">
            <tr>
              <td style="width: 100%; vertical-align: top; padding: 10px;">
                <div style="border-top: 1px solid #9ca3af; margin-top: 40px; padding-top: 5px; width: 60%; margin-left: auto; margin-right: auto;">
                  <strong>Porto Terapia Clínica de Psicologia</strong><br>Representante Concedente
                </div>
              </td>
            </tr>
          </table>
          ${footerHtml}
        </div>
      `;
    }

    return '';
  };

  const handlePrintDocument = (type, intern = null) => {
    if (type.startsWith('download_')) {
      handleDownloadPDF(type.replace('download_', ''), intern);
      return;
    }
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <base href="${window.location.origin}/" />
          <title>${type.toUpperCase()} - Porto Terapia</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 20px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${getDocumentHtml(type, intern)}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPDF = (type, intern = null) => {
    const element = document.createElement('div');
    element.innerHTML = getDocumentHtml(type, intern);
    
    const opt = {
      margin:       15,
      filename:     `${type === 'minuta' ? `Minuta_Contrato_${intern?.name.replace(/\s+/g, '_')}` : type.toUpperCase()}_Porto_Terapia.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    const runExport = () => {
      window.html2pdf().set(opt).from(element).save();
    };

    if (window.html2pdf) {
      runExport();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = runExport;
      document.head.appendChild(script);
    }
  };

  const renderPrintDocumentsSection = () => {
    const selectedInternData = interns.find(i => i.id === selectedPrintIntern);

    return (
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="border-b border-gray-200 bg-gray-50 -mx-4 -mt-4 p-4 mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <Printer size={20} className="text-blue-600" /> Documentos para Imprimir
          </h2>
          <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Porto Terapia</span>
        </div>
        <p className="text-xs text-gray-500 mb-4">Selecione o estagiário abaixo para gerar e imprimir os documentos regulamentares preenchidos com os dados cadastrais completos.</p>

        <div className="mb-6 max-w-md">
          <label className="block text-xs font-medium text-gray-500 mb-1">Selecione o Estagiário</label>
          <select
            value={selectedPrintIntern}
            onChange={(e) => setSelectedPrintIntern(e.target.value)}
            className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
          >
            <option value="">Selecione um estagiário para gerar documentos...</option>
            {interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit).map(i => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>

        {selectedInternData ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Minuta TCE */}
            <div className="border border-gray-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between h-40 shadow-sm">
              <div>
                <h3 className="font-bold text-gray-800 text-xs mb-1">Minuta de TCE</h3>
                <p className="text-[10px] text-gray-400 leading-snug">Termo de Compromisso de Estágio preenchido com dados pessoais, vigência e bolsa-auxílio.</p>
              </div>
              <button
                type="button"
                onClick={() => handlePrintDocument('tce', selectedInternData)}
                className="w-full mt-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1 shadow transition-colors"
              >
                <Printer size={13} /> Imprimir Minuta TCE
              </button>
            </div>

            {/* PAE */}
            <div className="border border-gray-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between h-40 shadow-sm">
              <div>
                <h3 className="font-bold text-gray-800 text-xs mb-1">Plano de Atividades (PAE)</h3>
                <p className="text-[10px] text-gray-400 leading-snug">Plano de atividades regulamentar anexo ao TCE preenchido com dados de vínculo.</p>
              </div>
              <button
                type="button"
                onClick={() => handlePrintDocument('pae', selectedInternData)}
                className="w-full mt-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1 shadow transition-colors"
              >
                <Printer size={13} /> Imprimir PAE
              </button>
            </div>

            {/* Ficha Cadastral */}
            <div className="border border-gray-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between h-40 shadow-sm">
              <div>
                <h3 className="font-bold text-gray-800 text-xs mb-1">Ficha Cadastral</h3>
                <p className="text-[10px] text-gray-400 leading-snug">Ficha de cadastro contendo dados pessoais, acadêmicos, bancários e de emergência.</p>
              </div>
              <button
                type="button"
                onClick={() => handlePrintDocument('ficha', selectedInternData)}
                className="w-full mt-2 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1 shadow transition-colors"
              >
                <Printer size={13} /> Imprimir Ficha Cadastral
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center text-slate-400 text-xs italic">
            Aguardando seleção do estagiário para liberar a emissão dos documentos preenchidos.
          </div>
        )}
      </div>
    );
  };

  const renderTemplateModal = () => {
    const isMinuta = !!viewingMinutaIntern;
    const type = viewingMinutaIntern ? 'minuta' : activeTemplate;
    const intern = viewingMinutaIntern || null;
    
    if (!type) return null;

    let templateName = '';
    if (type === 'tce') templateName = 'Modelo: Termo de Compromisso (TCE)';
    if (type === 'pae') templateName = 'Modelo: Plano de Atividades (PAE)';
    if (type === 'ficha') templateName = 'Modelo: Ficha Cadastral';
    if (type === 'minuta') templateName = `Minuta de Contrato: ${intern?.name}`;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-3xl relative h-[90vh] flex flex-col">
          <button
            onClick={() => {
              setActiveTemplate(null);
              setViewingMinutaIntern(null);
            }}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10 bg-white rounded-full p-1.5 border border-gray-200 shadow-sm"
          >
            <X size={18} />
          </button>
          
          <div className="mb-4">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
              <FileText size={18} className="text-blue-600" /> {templateName}
            </h3>
            <p className="text-xs text-gray-500">Visualização prévia do papel timbrado oficial da Porto Terapia.</p>
          </div>

          <div className="flex-1 w-full bg-slate-100 rounded-xl overflow-y-auto border border-slate-200 p-4 mb-4">
            <div className="bg-white shadow-md p-8 min-h-[297mm] max-w-[210mm] mx-auto rounded-sm overflow-hidden text-left border border-gray-200">
              <div dangerouslySetInnerHTML={{ __html: getDocumentHtml(type, intern) }} />
            </div>
          </div>

          <div className="flex justify-between items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveTemplate(null);
                setViewingMinutaIntern(null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Fechar Visualização
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handlePrintDocument(type, intern)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg text-xs transition-colors inline-flex items-center gap-1.5 shadow-sm"
              >
                Imprimir
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPDF(type, intern)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-xs transition-colors inline-flex items-center gap-1.5 shadow-sm"
              >
                Baixar PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // PAINEL: Alertas de RH e Contratos
  // ============================================================
  const renderRhAlertsSection = () => {
    const filteredInterns = interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit);
    const internsRhData = filteredInterns.map(intern => {
      const metrics = getInternRhMetrics(intern);
      return { intern, metrics };
    });

    const activeInternsRh = internsRhData.filter(d => d.intern.active !== false);
    const overdueReports = activeInternsRh.filter(d => d.metrics.reportOverdue);
    const contractAlerts = activeInternsRh.filter(d => d.metrics.isExceededLegalLimit || d.metrics.timeRemainingDays < 90);

    return (
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <ShieldAlert size={20} className="text-indigo-600" /> Alertas de Contratos & Recesso (RH)
          </h2>
          <span className="text-xs text-gray-500">Lei nº 11.788/2008</span>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-center">
              <span className="text-xs font-semibold text-red-700 block uppercase">Relatórios Pendentes (&gt;6 meses)</span>
              <span className="text-2xl font-bold text-red-900">{overdueReports.length}</span>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-center">
              <span className="text-xs font-semibold text-amber-700 block uppercase">Fim de Contrato (&lt;90 dias)</span>
              <span className="text-2xl font-bold text-amber-900">{contractAlerts.length}</span>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-center">
              <span className="text-xs font-semibold text-blue-700 block uppercase">Estagiários Monitorados</span>
              <span className="text-2xl font-bold text-blue-900">{activeInternsRh.length}</span>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-100 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-600 uppercase tracking-wider border-b border-gray-100">
                  <th className="p-3 font-semibold">Estagiário</th>
                  <th className="p-3 font-semibold">Vigência do Contrato</th>
                  <th className="p-3 font-semibold">Relatório Semestral</th>
                  <th className="p-3 font-semibold">Recesso Remunerado (Proporcional)</th>
                  <th className="p-3 font-semibold">Status de RH</th>
                  <th className="p-3 font-semibold text-center">Minuta de Contrato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeInternsRh.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-4 text-center text-gray-400">Nenhum estagiário ativo monitorado.</td>
                  </tr>
                ) : (
                  activeInternsRh.map(({ intern, metrics }) => {
                    const progressPercent = Math.min(100, Math.round((metrics.monthsWorked / Math.max(1, metrics.diffMonthsTotal)) * 100));
                    return (
                      <tr key={intern.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-medium text-gray-800">
                          <div className="font-bold">{intern.name}</div>
                          <div className="text-[10px] text-gray-400 font-normal">{intern.course || 'Sem curso'} • {intern.institution || 'Sem Inst.'}</div>
                        </td>
                        <td className="p-3 text-slate-600">
                          <div>{formatDate(intern.startDate)} a {formatDate(intern.endDate)}</div>
                          <div className="w-full bg-gray-200 h-1.5 rounded-full mt-1 overflow-hidden">
                            <div className="bg-indigo-600 h-full animate-pulse" style={{ width: `${progressPercent}%` }}></div>
                          </div>
                          <div className="text-[9px] text-gray-400 mt-0.5">{metrics.timeRemainingDays > 0 ? `${metrics.timeRemainingDays} dias restantes` : 'Contrato encerrado'}</div>
                        </td>
                        <td className="p-3">
                          {intern.lastReportDate ? (
                            <div>
                              <span>Último: {formatDate(intern.lastReportDate)}</span>
                              {metrics.reportOverdue ? (
                                <span className="bg-red-100 text-red-800 text-[9px] font-semibold px-1.5 py-0.5 rounded block w-fit mt-1">⚠️ Atrasado ({Math.round(metrics.reportAgeMonths)}m)</span>
                              ) : (
                                <span className="bg-green-100 text-green-800 text-[9px] font-semibold px-1.5 py-0.5 rounded block w-fit mt-1">Regular ({Math.round(metrics.reportAgeMonths)}m)</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-red-500 font-bold block">⚠️ Nunca entregue</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-700">
                          <div className="font-semibold text-indigo-700">Acumulado: {metrics.recessAccrued.toFixed(1)} dias</div>
                          <div className="text-[10px] text-slate-400">Gozados: {metrics.recessTaken} dias • <strong>Saldo: {metrics.recessBalance.toFixed(1)} dias</strong></div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            {!metrics.isAdmissionalComplete ? (
                              <span className="bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded block text-center uppercase tracking-wide animate-pulse shadow-sm" title="Fluxo Admissional Incompleto">
                                ⚠️ Pendente ({metrics.uploadedDocsCount}/6)
                              </span>
                            ) : (
                              <>
                                {metrics.isExceededLegalLimit && (
                                  <span className="bg-red-100 text-red-800 text-[9px] font-bold px-1.5 py-0.5 rounded block text-center">Contrato &gt; 24 meses (Ilegal)</span>
                                )}
                                {metrics.timeRemainingDays <= 30 && metrics.timeRemainingDays > 0 && (
                                  <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded block text-center">Fim próximo (&lt;30d)</span>
                                )}
                                {!metrics.isExceededLegalLimit && metrics.timeRemainingDays > 30 && (
                                  <span className="bg-green-100 text-green-800 text-[9px] font-bold px-1.5 py-0.5 rounded block text-center">Regularizado</span>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap text-center">
                          {metrics.isAdmissionalComplete ? (
                            <button
                              type="button"
                              onClick={() => setViewingMinutaIntern(intern)}
                              className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1.5 rounded-lg shadow-sm text-[10px] transition-colors"
                              title="Clique para visualizar, baixar ou imprimir a minuta do contrato"
                            >
                              <FileText size={12} /> Gerar Minuta
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">Fluxo incompleto</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // PAINEL: Fluxo Admissional (Checklist e Upload)
  // ============================================================
  const renderAdmissionalSection = () => {
    const selectedInternData = interns.find(i => i.id === selectedAdmissionalIntern);
    const documentsMap = selectedInternData?.documents || {};
    const uploadedDocsCount = Object.keys(documentsMap).length;
    const progressPercent = Math.round((uploadedDocsCount / ADMISSIONAL_DOCUMENTS.length) * 100);

    return (
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <FileText size={20} className="text-emerald-600" /> Fluxo Admissional (Checklist Contratação)
          </h2>
          <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded">
            Dossiê Digital
          </span>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Selecione o Estagiário</label>
              <select
                value={selectedAdmissionalIntern}
                onChange={(e) => setSelectedAdmissionalIntern(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
              >
                <option value="">Selecione um estagiário para ver o checklist...</option>
                {interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit).map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.active !== false ? 'Ativo' : 'Inativo'})</option>
                ))}
              </select>
            </div>

            {selectedInternData && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Documentos Entregues</span>
                  <span className="font-bold text-emerald-600">{uploadedDocsCount} de {ADMISSIONAL_DOCUMENTS.length} ({progressPercent}%)</span>
                </div>
                <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>
            )}
          </div>

          {selectedInternData ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Checklist list */}
              <div className="lg:col-span-2 overflow-x-auto border border-gray-100 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
                      <th className="p-3 font-semibold">Documento</th>
                      <th className="p-3 font-semibold">Status / Arquivo</th>
                      <th className="p-3 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ADMISSIONAL_DOCUMENTS.map(doc => {
                      const fileInfo = documentsMap[doc.key];
                      const isUploaded = !!fileInfo;

                      return (
                        <tr key={doc.key} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3">
                            <div className="font-semibold text-gray-800">{doc.label}</div>
                            <div className="text-[10px] text-gray-400 font-normal leading-normal">{doc.desc}</div>
                          </td>
                          <td className="p-3">
                            {isUploaded ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-green-700 font-semibold flex items-center gap-0.5">
                                  <Check size={12} /> Entregue
                                </span>
                                <span className="text-[10px] text-slate-500 truncate max-w-[150px]" title={fileInfo.name}>
                                  {fileInfo.name} ({fileInfo.size})
                                </span>
                                <span className="text-[8px] text-slate-400">
                                  Anexado: {formatDate(fileInfo.uploadedAt)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-amber-600 font-semibold flex items-center gap-0.5">
                                <AlertTriangle size={12} /> Pendente
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {isUploaded ? (
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleViewDocumentContent(selectedAdmissionalIntern, doc.key, null, fileInfo.name, doc.label)}
                                  className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded"
                                  title="Visualizar documento"
                                >
                                  <Eye size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDocument(selectedAdmissionalIntern, doc.key)}
                                  className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded"
                                  title="Remover documento"
                                >
                                  <Trash size={13} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic text-[10px]">Aguardando</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Upload Panel */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 h-fit">
                <h3 className="font-semibold text-slate-700 flex items-center gap-1 text-xs">
                  <Upload size={14} className="text-blue-500" /> Anexar Novo Documento
                </h3>

                <form onSubmit={handleUploadDocument} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Dropbox do Tipo do Documento</label>
                    <select
                      value={uploadDocType}
                      onChange={(e) => setUploadDocType(e.target.value)}
                      className="w-full p-2 border border-gray-300 bg-white rounded-lg focus:ring-1 focus:ring-blue-500 text-xs"
                    >
                      {ADMISSIONAL_DOCUMENTS.map(doc => (
                        <option key={doc.key} value={doc.key}>
                          {doc.label} {documentsMap[doc.key] ? '✓' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Arquivo PDF ou Imagem</label>
                    <input
                      id="admissional-file-input"
                      type="file"
                      required
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="w-full text-xs p-1.5 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                    />
                    <p className="text-[8px] text-gray-400 mt-1 leading-normal">Permitidos: PDF, PNG, JPG de até 2MB.</p>
                  </div>

                  <button
                    type="submit"
                    disabled={uploadingDoc}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1 shadow-sm"
                  >
                    {uploadingDoc ? (
                      <><Loader2 size={12} className="animate-spin" /> Carregando...</>
                    ) : (
                      <><Upload size={12} /> Salvar no Dossiê</>
                    )}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-8 border border-slate-100 text-center text-slate-400 text-sm">
              <FileText size={40} className="mx-auto text-slate-300 mb-2" />
              Selecione um estagiário acima para exibir o Checklist de Fluxo Admissional.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderActivitiesSection = () => {
    const selectedInternData = interns.find(i => i.id === selectedActivityIntern);
    const semestralReports = selectedInternData?.semestralReports || {};
    const report1 = semestralReports['1'];
    const report2 = semestralReports['2'];
    const report3 = semestralReports['3'];
    const report4 = semestralReports['4'];
    const deliveredCount = [report1, report2, report3, report4].filter(Boolean).length;
    const progressPercent = deliveredCount * 25;

    const handleSaveActivitiesData = async (e) => {
      e.preventDefault();
      if (!selectedInternData) return;
      try {
        const { error } = await supabase
          .from('interns')
          .update({
            last_report_date: activityReportDate || null,
            recess_days_taken: Number(activityRecessDays) || 0,
            supervisor_name: activitySupervisorName || null
          })
          .eq('id', selectedInternData.id);
        if (error) throw error;
        alert('Dados de acompanhamento atualizados com sucesso!');
      } catch (err) {
        console.error('Erro ao salvar dados de acompanhamento:', err);
        alert('Erro ao salvar alterações.');
      }
    };

    const handleUploadSemestral = async (e) => {
      e.preventDefault();
      if (!selectedInternData) return;
      const fileInput = document.getElementById('semestral-file-input');
      const file = fileInput?.files?.[0];
      if (!file) {
        alert('Por favor, selecione um arquivo.');
        return;
      }
      if (file.type !== 'application/pdf') {
        alert('Apenas arquivos no formato PDF são permitidos para o Relatório Semestral.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('O arquivo excede o limite de 5MB.');
        return;
      }
      setUploadingSemestralReport(true);
      try {
        const base64 = await fileToBase64(file);
        const updatedReports = {
          ...semestralReports,
          [semestralReportPeriod]: {
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB',
            uploadedAt: new Date().toISOString()
          }
        };

        // 1. Atualizar metadados na tabela interns
        const { error } = await supabase
          .from('interns')
          .update({ semestral_reports: updatedReports })
          .eq('id', selectedInternData.id);
        if (error) throw error;

        // 2. Gravar o conteúdo pesado em Base64 no document_contents
        const { error: contentError } = await supabase
          .from('document_contents')
          .upsert({
            intern_id: selectedInternData.id,
            doc_key: `semestral_report_${semestralReportPeriod}`,
            content: base64
          });
        if (contentError) throw contentError;

        if (fileInput) fileInput.value = '';
        alert(`Relatório Semestral do ${semestralReportPeriod}º período anexado com sucesso!`);
      } catch (err) {
        console.error("Erro no upload do relatório semestral:", err);
        alert('Erro ao enviar relatório semestral.');
      } finally {
        setUploadingSemestralReport(false);
      }
    };

    const handleDeleteSemestral = async (period) => {
      if (!selectedInternData) return;
      const ok = window.confirm(`Deseja realmente remover o Relatório Semestral do ${period}º período?`);
      if (!ok) return;

      try {
        const updatedReports = { ...semestralReports };
        delete updatedReports[period];

        // 1. Atualizar metadados na tabela interns
        const { error } = await supabase
          .from('interns')
          .update({ semestral_reports: updatedReports })
          .eq('id', selectedInternData.id);
        if (error) throw error;

        // 2. Remover de document_contents
        await supabase
          .from('document_contents')
          .delete()
          .eq('intern_id', selectedInternData.id)
          .eq('doc_key', `semestral_report_${period}`);

        alert('Relatório removido com sucesso!');
      } catch (err) {
        console.error("Erro ao deletar relatório semestral:", err);
        alert('Erro ao excluir documento.');
      }
    };

    return (
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <FileText size={20} className="text-blue-600" /> Acompanhamento de Atividades Estagiário
          </h2>
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
            Desempenho & Recesso
          </span>
        </div>

        <div className="p-4 space-y-6">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Selecione o Estagiário</label>
            <select
              value={selectedActivityIntern}
              onChange={(e) => setSelectedActivityIntern(e.target.value)}
              className="w-full md:w-1/2 p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
            >
              <option value="">Selecione um estagiário para acompanhamento...</option>
              {interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit).map(i => (
                <option key={i.id} value={i.id}>{i.name} ({i.active !== false ? 'Ativo' : 'Inativo'})</option>
              ))}
            </select>
          </div>

          {selectedInternData ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                  Atividades & Recesso
                </h3>
                <form onSubmit={handleSaveActivitiesData} className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1 font-semibold">Profissional Supervisor</label>
                    <input
                      type="text"
                      required
                      placeholder="Nome do Supervisor"
                      value={activitySupervisorName}
                      onChange={(e) => setActivitySupervisorName(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Último Relatório de Atividades</label>
                    <input
                      type="date"
                      value={activityReportDate}
                      onChange={(e) => setActivityReportDate(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Dias de Recesso Gozados (Tirados)</label>
                    <input
                      type="number"
                      min="0"
                      value={activityRecessDays}
                      onChange={(e) => setActivityRecessDays(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow"
                  >
                    <Save size={14} /> Salvar Informações
                  </button>
                </form>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
                  <div className="flex justify-between items-center text-xs text-slate-700 mb-2">
                    <span className="font-semibold">Progresso de Relatórios Semestrais</span>
                    <span className="font-bold text-emerald-700">{deliveredCount} de 4 ({progressPercent}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden border border-gray-100 shadow-inner">
                    <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold text-slate-800 text-xs">Anexar Novo Relatório Semestral</h4>
                    <form onSubmit={handleUploadSemestral} className="space-y-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Período Relativo</label>
                        <select
                          value={semestralReportPeriod}
                          onChange={(e) => setSemestralReportPeriod(e.target.value)}
                          className="w-full p-2 border border-gray-300 bg-white rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="1">1º Relatório Semestral</option>
                          <option value="2">2º Relatório Semestral</option>
                          <option value="3">3º Relatório Semestral</option>
                          <option value="4">4º Relatório Semestral</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Arquivo (Apenas PDF)</label>
                        <input
                          id="semestral-file-input"
                          type="file"
                          required
                          accept=".pdf"
                          className="w-full text-xs p-1.5 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={uploadingSemestralReport}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1 shadow-sm"
                      >
                        {uploadingSemestralReport ? (
                          <><Loader2 size={12} className="animate-spin" /> Carregando...</>
                        ) : (
                          <><Upload size={12} /> Enviar Relatório</>
                        )}
                      </button>
                    </form>
                  </div>

                  <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold text-slate-800 text-xs">Relatórios Entregues</h4>
                    <div className="space-y-2">
                      {['1', '2', '3', '4'].map(period => {
                        const rep = semestralReports[period];
                        return (
                          <div key={period} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg p-2.5 shadow-sm text-xs">
                            <div>
                              <div className="font-bold text-gray-800">{period}º Semestre</div>
                              {rep ? (
                                <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[150px]" title={rep.name}>
                                  {rep.name} ({rep.size})
                                </div>
                              ) : (
                                <span className="text-[10px] text-amber-600 font-medium">Pendente de Entrega</span>
                              )}
                            </div>
                            {rep && (
                              <div className="flex gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleViewDocumentContent(selectedInternData.id, `semestral_report_${period}`, null, rep.name, `Relatório Semestral ${period}º Sem.`)}
                                  className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded"
                                  title="Visualizar PDF"
                                >
                                  <Eye size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSemestral(period)}
                                  className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded"
                                  title="Remover"
                                >
                                  <Trash size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-8 border border-slate-100 text-center text-slate-400 text-sm">
              <FileText size={40} className="mx-auto text-slate-300 mb-2" />
              Selecione um estagiário acima para visualizar e gerenciar o Acompanhamento de Atividades.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFinanceSection = () => {
    const monthKey = filterFinanceMonth || new Date().toISOString().substring(0, 7);
    const [year, month] = monthKey.split('-').map(Number);
    const totalWorkingDays = (() => {
      let count = 0;
      const date = new Date(year, month - 1, 1);
      while (date.getMonth() === month - 1) {
        const day = date.getDay();
        if (day !== 0 && day !== 6) count++;
        date.setDate(date.getDate() + 1);
      }
      return count || 22;
    })();

    const firstDayOfMonthStr = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const lastDayOfMonthStr = `${year}-${month.toString().padStart(2, '0')}-${lastDayOfMonth.toString().padStart(2, '0')}`;

    const getEffectiveEnd = (i) => {
      if (i.contractTermination && i.contractTermination.date) {
        return i.contractTermination.date;
      }
      return i.endDate || '9999-12-31';
    };

    const filteredInterns = interns.filter(i => {
      if (filterUnit !== 'all' && i.unitId !== filterUnit) return false;
      const start = i.startDate || '0000-01-01';
      const end = getEffectiveEnd(i);
      return (start <= lastDayOfMonthStr) && (end >= firstDayOfMonthStr);
    });

    return (
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <Timer size={20} className="text-blue-600" /> Aba de Financeiro (Folha de Pagamento)
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <input
                type="month"
                value={filterFinanceMonth}
                onChange={(e) => setFilterFinanceMonth(e.target.value)}
                className="p-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-xs text-slate-700">
            <p><strong>Período de Referência:</strong> {month.toString().padStart(2, '0')}/{year} • <strong>Dias Úteis Estimados:</strong> {totalWorkingDays} dias de trabalho (segunda a sexta).</p>
            <p className="mt-1 text-slate-500"><strong>Regra de Negócio:</strong> Atestados Médicos (com comprovante) abonam faltas e não possuem desconto. Outras ocorrências (faltas injustificadas, atrasos, etc.) deduzem o pagamento de forma proporcional aos dias afastados informados.</p>
          </div>

          <div className="overflow-x-auto border border-gray-100 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-600 uppercase tracking-wider border-b border-gray-100">
                  <th className="p-3 font-semibold">Estagiário</th>
                  <th className="p-3 font-semibold">Unidade</th>
                  <th className="p-3 font-semibold">Bolsa/Auxílio</th>
                  <th className="p-3 font-semibold">Ocorrências do Mês</th>
                  <th className="p-3 font-semibold text-center">Dias Descontados</th>
                  <th className="p-3 font-semibold text-right">Valor Final Devido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInterns.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-4 text-center text-gray-400">Nenhum estagiário correspondente aos filtros.</td>
                  </tr>
                ) : (
                  filteredInterns.map(intern => {
                    const allowance = Number(intern.allowance) || 0;
                    const internRecords = records.filter(r => {
                      if (r.internId !== intern.id) return false;
                      if (!r.timestamp) return false;
                      const dateStr = typeof r.timestamp === 'string' ? r.timestamp : new Date(r.timestamp).toISOString();
                      const recordYearMonth = dateStr.substring(0, 7);
                      return recordYearMonth === monthKey && (r.justification || (r.justificationDoc && Object.keys(r.justificationDoc).length > 0));
                    });

                    let medicalDays = 0;
                    let deductibleDays = 0;
                    const occurrenceDetails = [];

                    internRecords.forEach(r => {
                      const type = r.justificationDoc?.type || 'outros';
                      const isMedical = type === 'atestado' || (r.justification && r.justification.toLowerCase().includes('atestado'));
                      const days = Number(r.daysAway) || 0;
                      
                      if (isMedical) {
                        medicalDays += days;
                      } else {
                        deductibleDays += days;
                      }
                      
                      occurrenceDetails.push({
                        date: new Date(r.timestamp).toLocaleDateString('pt-BR'),
                        type: isMedical ? 'Atestado Médico' : (type === 'curso' ? 'Curso' : (type === 'academico' ? 'Acadêmico' : 'Outros')),
                        desc: r.justification || 'Sem descrição',
                        days,
                        isMedical
                      });
                    });

                    const finalDays = Math.max(0, totalWorkingDays - deductibleDays);
                    const finalPayment = totalWorkingDays > 0 ? (allowance / totalWorkingDays) * finalDays : allowance;

                    return (
                      <tr key={intern.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-medium text-gray-800">
                          <div className="font-bold">{intern.name}</div>
                          {intern.cpf && <div className="text-[10px] text-gray-400 font-normal">CPF: {intern.cpf}</div>}
                          {intern.bankName && <div className="text-[9px] text-gray-400 font-normal">{intern.bankName} • Ag {intern.bankAgency} • Cc {intern.bankAccount}</div>}
                        </td>
                        <td className="p-3 text-slate-600">{intern.unitId ? unitName(intern.unitId) : '—'}</td>
                        <td className="p-3 font-semibold text-slate-800">
                          {allowance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="p-3 max-w-xs">
                          {occurrenceDetails.length === 0 ? (
                            <span className="text-gray-400 italic text-[10px]">Sem ocorrências no mês</span>
                          ) : (
                            <div className="space-y-1">
                              {occurrenceDetails.map((occ, idx) => (
                                <div key={idx} className={`p-1.5 rounded border text-[9px] ${
                                  occ.isMedical ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'
                                }`}>
                                  <strong>{occ.date} - {occ.type} ({occ.days}d):</strong> {occ.desc}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {deductibleDays > 0 ? (
                            <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold text-[10px]">
                              -{deductibleDays} dias
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Nenhum</span>
                          )}
                          {medicalDays > 0 && (
                            <div className="text-[9px] text-green-600 font-medium mt-1">+{medicalDays}d abonados</div>
                          )}
                        </td>
                        <td className="p-3 text-right font-bold text-gray-900 text-sm">
                          {finalPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderContractTerminationSection = () => {

    const selectedInternData = interns.find(i => i.id === selectedTerminationIntern);
    const contractTermination = selectedInternData?.contractTermination || {};
    const hasSignedLetter = !!contractTermination.signedLetter;

    const handleSaveTermination = async (e) => {
      e.preventDefault();
      if (!selectedInternData) return;
      try {
        const updatedTermination = {
          ...contractTermination,
          motive: terminationMotive,
          date: terminationDate
        };
        const { error } = await supabase
          .from('interns')
          .update({ contract_termination: updatedTermination })
          .eq('id', selectedInternData.id);
        if (error) throw error;
        alert('Informações de desligamento salvas com sucesso!');
      } catch (err) {
        console.error('Erro ao salvar encerramento de vínculo:', err);
        alert('Erro ao salvar alterações.');
      }
    };

    const handleUploadTerminationLetter = async (e) => {
      e.preventDefault();
      if (!selectedInternData) return;
      const fileInput = document.getElementById('termination-file-input');
      const file = fileInput?.files?.[0];
      if (!file) {
        alert('Por favor, selecione um arquivo.');
        return;
      }
      setUploadingTerminationLetter(true);
      try {
        const base64 = await fileToBase64(file);
        const updatedTermination = {
          ...contractTermination,
          motive: terminationMotive,
          date: terminationDate,
          signedLetter: {
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB',
            uploadedAt: new Date().toISOString(),
            content: base64
          }
        };

        const { error } = await supabase
          .from('interns')
          .update({ contract_termination: updatedTermination })
          .eq('id', selectedInternData.id);
        if (error) throw error;
        if (fileInput) fileInput.value = '';
        alert('Carta de encerramento de vínculo assinada anexada com sucesso!');
      } catch (err) {
        console.error("Erro no upload da carta de encerramento de vínculo:", err);
        alert('Erro ao enviar documento.');
      } finally {
        setUploadingTerminationLetter(false);
      }
    };

    const handleDeleteTerminationLetter = async () => {
      if (!selectedInternData) return;
      const ok = window.confirm('Deseja realmente excluir a carta de encerramento de vínculo assinada arquivada?');
      if (!ok) return;

      try {
        const updatedTermination = { ...contractTermination };
        delete updatedTermination.signedLetter;

        const { error } = await supabase
          .from('interns')
          .update({ contract_termination: updatedTermination })
          .eq('id', selectedInternData.id);
        if (error) throw error;
        alert('Documento excluído com sucesso!');
      } catch (err) {
        console.error("Erro ao deletar documento de encerramento de vínculo:", err);
        alert('Erro ao excluir documento.');
      }
    };

    return (
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <Lock size={20} className="text-blue-600" /> Aba de Encerramento de Vínculo
          </h2>
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
            Rescisão & Legislação
          </span>
        </div>

        <div className="p-4 space-y-6">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Selecione o Estagiário</label>
            <select
              value={selectedTerminationIntern}
              onChange={(e) => setSelectedTerminationIntern(e.target.value)}
              className="w-full md:w-1/2 p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
            >
              <option value="">Selecione um estagiário...</option>
              {interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit).map(i => (
                <option key={i.id} value={i.id}>{i.name} ({i.active !== false ? 'Ativo' : 'Inativo'})</option>
              ))}
            </select>
          </div>

          {selectedInternData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                  Dados de Rescisão / Encerramento
                </h3>
                <form onSubmit={handleSaveTermination} className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Motivo do Desligamento</label>
                    <select
                      value={terminationMotive}
                      onChange={(e) => setTerminationMotive(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Desligamento (conforme Lei)">Desligamento (conforme Lei)</option>
                      <option value="Pedido Próprio">Pedido Próprio</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Data Efetiva de Encerramento</label>
                    <input
                      type="date"
                      value={terminationDate}
                      onChange={(e) => setTerminationDate(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow"
                  >
                    <Save size={14} /> Salvar Parâmetros
                  </button>
                </form>
              </div>

              <div className="space-y-4">
                
                {terminationMotive === 'Pedido Próprio' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold text-blue-900 text-xs flex items-center gap-1.5">
                      <FileText size={16} className="text-blue-600" /> Carta de Resignação de Estágio
                    </h4>
                    <p className="text-[11px] text-blue-700 leading-normal">
                      Gere a minuta da Carta de Encerramento de Vínculo preenchida automaticamente com os dados acadêmicos e do termo de compromisso para que o estagiário assine.
                    </p>
                    <button
                      type="button"
                      onClick={() => handlePrintDocument('carta_desligamento', selectedInternData)}
                      className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition-colors"
                    >
                      <Printer size={13} /> Imprimir Minuta
                    </button>
                  </div>
                )}

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-semibold text-slate-800 text-xs">Upload da Carta Assinada / Documento de Encerramento</h4>
                  {hasSignedLetter ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs flex items-center justify-between shadow-sm">
                      <div className="truncate pr-2">
                        <span className="text-green-700 font-semibold block">✓ Arquivado com sucesso</span>
                        <span className="text-[10px] text-gray-400 block truncate" title={contractTermination.signedLetter.name}>
                          {contractTermination.signedLetter.name} ({contractTermination.signedLetter.size})
                        </span>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setViewDocBase64(contractTermination.signedLetter.content);
                            setViewDocName(contractTermination.signedLetter.name);
                            setViewDocType('Carta de Encerramento de Vínculo Assinada');
                          }}
                          className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded"
                          title="Visualizar documento"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteTerminationLetter}
                          className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded"
                          title="Excluir"
                        >
                          <Trash size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleUploadTerminationLetter} className="space-y-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Selecionar Imagem ou PDF</label>
                        <input
                          id="termination-file-input"
                          type="file"
                          required
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="w-full text-xs p-1.5 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={uploadingTerminationLetter}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1 shadow"
                      >
                        {uploadingTerminationLetter ? (
                          <><Loader2 size={12} className="animate-spin" /> Carregando...</>
                        ) : (
                          <><Upload size={12} /> Fazer Arquivamento</>
                        )}
                      </button>
                    </form>
                  )}
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-8 border border-slate-100 text-center text-slate-400 text-sm">
              <Lock size={40} className="mx-auto text-slate-300 mb-2" />
              Selecione um estagiário acima para exibir o painel de encerramento de vínculo.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderOcorrenciasSection = () => {
    // Filtrar ocorrências considerando a unidade e o estagiário selecionados
    const ocorrenciasList = records.filter(r => {
      const isOcorrencia = r.action === 'ocorrencia' || (r.justificationDoc && Object.keys(r.justificationDoc).length > 0);
      if (!isOcorrencia) return false;
      if (ocorrenciaFilterIntern !== 'all' && r.internId !== ocorrenciaFilterIntern) return false;
      
      // Filtragem por Unidade
      if (filterUnit !== 'all') {
        const intern = interns.find(i => i.id === r.internId);
        if (!intern || intern.unitId !== filterUnit) return false;
      }
      return true;
    });

    // Agrupar comprovantes dos estagiários baseados nos filtros de estagiário e unidade
    const internOccurrenceDocs = [];
    const filteredInternsForDocs = interns.filter(i => {
      if (ocorrenciaFilterIntern !== 'all' && i.id !== ocorrenciaFilterIntern) return false;
      if (filterUnit !== 'all' && i.unitId !== filterUnit) return false;
      return true;
    });

    filteredInternsForDocs.forEach(i => {
      if (i.documents) {
        Object.keys(i.documents).forEach(key => {
          if (key.startsWith('ocorrencia_')) {
            internOccurrenceDocs.push({
              key,
              internName: i.name,
              internId: i.id,
              ...i.documents[key]
            });
          }
        });
      }
    });

    const handleExportOcorrenciasJSON = () => {
      if (ocorrenciasList.length === 0) {
        alert('Nenhuma ocorrência para exportar.');
        return;
      }
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ocorrenciasList, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      const filename = ocorrenciaFilterIntern !== 'all' 
        ? `Ocorrencias_${interns.find(i => i.id === ocorrenciaFilterIntern)?.name.replace(/\s+/g, '_')}.json`
        : "Ocorrencias_Todos_Estagiarios.json";
      downloadAnchor.setAttribute("download", filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LADO ESQUERDO: FORMULÁRIO DE CADASTRO */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden lg:col-span-1 animate-fade-in">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
              <Plus className="text-blue-600" size={18} />
              <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wider">Nova Ocorrência</h3>
            </div>
            
            <form onSubmit={handleSaveOcorrencia} className="p-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Estagiário</label>
                <select
                  value={selectedOcorrenciaIntern}
                  onChange={(e) => setSelectedOcorrenciaIntern(e.target.value)}
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Selecione um estagiário...</option>
                  {interns
                    .filter(i => filterUnit === 'all' || i.unitId === filterUnit)
                    .map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.active !== false ? 'Ativo' : 'Inativo'})</option>
                    ))}
                </select>
              </div>

              {/* CALENDÁRIO DOS AFASTAMENTOS */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <Calendar size={13} className="text-blue-500" /> Calendário dos Afastamentos
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">Data de Início</label>
                    <input
                      type="date"
                      value={ocorrenciaStartDate}
                      onChange={(e) => setOcorrenciaStartDate(e.target.value)}
                      required
                      className="w-full p-1.5 border border-gray-300 bg-white rounded-lg focus:ring-1 focus:ring-blue-500 text-[10px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">Data de Fim</label>
                    <input
                      type="date"
                      value={ocorrenciaEndDate}
                      onChange={(e) => setOcorrenciaEndDate(e.target.value)}
                      required
                      className="w-full p-1.5 border border-gray-300 bg-white rounded-lg focus:ring-1 focus:ring-blue-500 text-[10px]"
                    />
                  </div>
                </div>
              </div>

              {/* TIPO COMPROVANTE & DIAS AFASTADOS */}
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 space-y-3">
                <span className="font-semibold text-blue-700 flex items-center gap-1">
                  <Upload size={13} /> Comprovante de Ocorrência (Faltas/Atrasos)
                </span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">Tipo do Comprovante</label>
                    <select
                      value={ocorrenciaType}
                      onChange={(e) => setOcorrenciaType(e.target.value)}
                      className="w-full p-1.5 border border-gray-300 bg-white rounded-lg focus:ring-1 focus:ring-blue-500 text-[10px]"
                    >
                      <option value="atestado">Atestado Médico</option>
                      <option value="falta">Falta Injustificada</option>
                      <option value="atraso">Atraso</option>
                      <option value="curso">Inscrição em Curso</option>
                      <option value="academico">Atividade Acadêmica</option>
                      <option value="outros">Outro Comprovante</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">Dias Afastados</label>
                    <input
                      type="number"
                      min="0"
                      value={ocorrenciaDays}
                      onChange={(e) => setOcorrenciaDays(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full p-1.5 border border-gray-300 bg-white rounded-lg focus:ring-1 focus:ring-blue-500 text-[10px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Arquivo (PDF/PNG/JPG)</label>
                  <input
                    id="ocorrencia-file-input"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="w-full text-[10px] p-1 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Justificativa / Descrição</label>
                <textarea
                  value={ocorrenciaDesc}
                  onChange={(e) => setOcorrenciaDesc(e.target.value)}
                  required
                  placeholder="Ex: Apresentou atestado médico relativo ao período..."
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 resize-none h-16"
                />
              </div>

              <button
                type="submit"
                disabled={ocorrenciaLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow border-none cursor-pointer"
              >
                {ocorrenciaLoading ? 'Salvando...' : 'Registrar Ocorrência'}
              </button>
            </form>
          </div>

          {/* LADO DIREITO: HISTÓRICO & CONTROLE DE ARQUIVAMENTO */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden lg:col-span-2 space-y-6 p-4 animate-fade-in">
            
            {/* SELEÇÃO DO ESTAGIÁRIO E FILTROS */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>
                <h4 className="font-bold text-gray-700 text-xs">Histórico & Arquivo Digital de Ocorrências</h4>
                <p className="text-[10px] text-gray-400">Gerenciamento e controle de comprovantes por estagiário</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={ocorrenciaFilterIntern}
                  onChange={(e) => setOcorrenciaFilterIntern(e.target.value)}
                  className="p-1.5 border border-gray-300 bg-white rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">Todos os estagiários</option>
                  {interns
                    .filter(i => filterUnit === 'all' || i.unitId === filterUnit)
                    .map(i => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                </select>
                <button
                  onClick={handleExportOcorrenciasJSON}
                  className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 border-none cursor-pointer shadow-sm"
                >
                  <Download size={13} /> Exportar JSON
                </button>
              </div>
            </div>

            {/* TABELA DE OCORRÊNCIAS */}
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-700 text-xs">Ocorrências Lançadas</h4>
              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 uppercase tracking-wider border-b border-gray-100">
                      <th className="p-3 font-semibold">Estagiário</th>
                      <th className="p-3 font-semibold">Data/Período</th>
                      <th className="p-3 font-semibold">Tipo</th>
                      <th className="p-3 font-semibold">Descrição</th>
                      <th className="p-3 font-semibold text-center">Descontado</th>
                      <th className="p-3 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ocorrenciasList.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-4 text-center text-gray-400">Nenhuma ocorrência correspondente aos filtros.</td>
                      </tr>
                    ) : (
                      ocorrenciasList.map(occ => {
                        const type = occ.justificationDoc?.type || 'outros';
                        const isMedical = type === 'atestado' || (occ.justification && occ.justification.toLowerCase().includes('atestado'));
                        const days = Number(occ.daysAway) || 0;
                        const dateFormatted = new Date(occ.timestamp).toLocaleDateString('pt-BR');

                        return (
                          <tr key={occ.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-medium text-gray-800">{occ.internName}</td>
                            <td className="p-3">
                              <div>{dateFormatted}</div>
                              {days > 0 && <span className="text-[10px] text-gray-400">{days} dia(s)</span>}
                            </td>
                            <td className="p-3">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                                isMedical ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {isMedical ? 'Atestado Médico' : (type === 'curso' ? 'Curso' : (type === 'academico' ? 'Acadêmico' : (type === 'falta' ? 'Falta' : (type === 'atraso' ? 'Atraso' : 'Outros'))))}
                              </span>
                            </td>
                            <td className="p-3 max-w-xs truncate" title={occ.justification}>{occ.justification}</td>
                            <td className="p-3 text-center">
                              {isMedical ? (
                                <span className="text-green-600 font-semibold">Não (Abonado)</span>
                              ) : (
                                <span className="text-red-600 font-semibold">Sim ({days}d)</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-1.5">
                                {occ.justificationDoc?.content && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewDocBase64(occ.justificationDoc.content);
                                      setViewDocName(occ.justificationDoc.name);
                                      setViewDocType(`Comprovante - ${occ.internName}`);
                                    }}
                                    className="p-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded border-none cursor-pointer"
                                    title="Visualizar Comprovante"
                                  >
                                    <Eye size={12} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOcorrencia(occ.id, occ.internId)}
                                  className="p-1 bg-red-50 text-red-600 hover:bg-red-100 rounded border-none cursor-pointer animate-fade-in"
                                  title="Remover"
                                >
                                  <Trash size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PASTA DE COMPROVANTES (ARQUIVO PERMANENTE) */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-700 text-xs flex items-center gap-1.5">
                  <FolderOpen size={14} className="text-amber-500" />
                  Pasta de Comprovantes de Afastamento (Arquivo Permanente)
                </h4>
                {ocorrenciaFilterIntern !== 'all' && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    Ficha do Estagiário
                  </span>
                )}
              </div>

              {internOccurrenceDocs.length === 0 ? (
                <div className="bg-slate-50 text-center py-6 border border-dashed border-gray-200 rounded-xl text-gray-400">
                  Nenhum comprovante arquivado no perfil.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {internOccurrenceDocs.map((doc, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between hover:shadow-sm transition-all">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-gray-800 truncate max-w-[150px]">{doc.name}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                            doc.type === 'atestado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {doc.type === 'atestado' ? 'Atestado' : 'Outros'}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 space-y-0.5">
                          {doc.internName && <p><strong>Estagiário:</strong> {doc.internName}</p>}
                          <p><strong>Período:</strong> {doc.period || 'Não especificado'}</p>
                          {doc.daysAway > 0 && <p><strong>Afastamento:</strong> {doc.daysAway} dia(s)</p>}
                          {doc.desc && <p className="italic text-gray-400 line-clamp-1">"{doc.desc}"</p>}
                        </div>
                      </div>
                      <div className="border-t border-slate-200 mt-2.5 pt-2 flex items-center justify-between text-[9px] text-gray-400">
                        <span>Anexado em {new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}</span>
                        <button
                          type="button"
                          onClick={() => handleViewDocumentContent(doc.internId, doc.key, null, doc.name, 'Comprovante Arquivado')}
                          className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 border-none bg-transparent cursor-pointer"
                        >
                          <Eye size={10} /> Visualizar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // MODALS DE SUPORTE
  // ============================================================
  const renderRecordPhotoModal = () => {
    if (!selectedRecordPhoto) return null;
    const intern = interns.find((i) => i.id === selectedRecordPhoto.internId);
    const hasComparison = !!(intern && intern.photo);

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
        <div className={`bg-white rounded-2xl shadow-2xl p-6 w-full ${hasComparison ? 'max-w-2xl' : 'max-w-sm'} relative transition-all duration-300`}>
          <button
            onClick={() => setSelectedRecordPhoto(null)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 rounded-full p-1 border border-gray-100"
          >
            <X size={18} />
          </button>
          <div className="text-center mb-4">
            <h3 className="text-base font-bold text-gray-800 flex items-center justify-center gap-1.5">
              <Camera size={18} className="text-blue-500" /> Biometria de Reconhecimento
            </h3>
            <p className="text-xs text-gray-500">
              {hasComparison ? 'Comparação entre Foto de Cadastro e Biometria do Ponto' : 'Ponto confirmado fisicamente'}
            </p>
          </div>

          {hasComparison ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
              <div className="flex flex-col items-center">
                <span className="text-[11px] font-semibold text-slate-500 mb-1.5">Foto do Cadastro (Inicial 3x4)</span>
                <div className="aspect-[3/4] w-36 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm flex items-center justify-center">
                  <img
                    src={intern.photo}
                    alt={`Cadastro de ${selectedRecordPhoto.internName}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[11px] font-semibold text-slate-500 mb-1.5">Biometria do Ponto (Registro)</span>
                <div className="aspect-[3/4] w-36 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm flex items-center justify-center">
                  <img
                    src={selectedRecordPhoto.photo}
                    alt={`Reconhecimento Facial: ${selectedRecordPhoto.internName}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="aspect-[4/3] w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 mb-4">
              <img
                src={selectedRecordPhoto.photo}
                alt={`Reconhecimento Facial: ${selectedRecordPhoto.internName}`}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {!hasComparison && intern && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-4 text-[10px] text-amber-700 flex items-center gap-1.5 justify-center">
              <AlertTriangle size={14} className="shrink-0" />
              <span>Estagiário sem foto 3x4 cadastrada para comparação.</span>
            </div>
          )}

          <div className="bg-slate-50 rounded-xl p-3 text-[11px] space-y-1.5 text-slate-600 border border-gray-100">
            <p><strong>Estagiário:</strong> {selectedRecordPhoto.internName}</p>
            <p><strong>Data/Hora:</strong> {formatDate(selectedRecordPhoto.timestamp)} às {formatTime(selectedRecordPhoto.timestamp)}</p>
            <p><strong>Operação:</strong> {selectedRecordPhoto.action === 'entrada' ? 'Entrada' : 'Saída'}</p>
            {selectedRecordPhoto.geo && (
              <p><strong>GPS Local:</strong> Unidade {selectedRecordPhoto.geo.unitName} ({selectedRecordPhoto.geo.distanceM || Math.round(selectedRecordPhoto.geo.distanceKm * 1000)}m de distância)</p>
            )}
            {selectedRecordPhoto.justification && (
              <p><strong>Anotações:</strong> "{selectedRecordPhoto.justification}"</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleDownloadOrOpenDoc = (base64, filename) => {
    const link = document.createElement('a');
    link.href = base64;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderOccurrenceModal = () => {
    if (!showOccurrenceModal) return null;
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md relative">
          <button
            type="button"
            onClick={() => setShowOccurrenceModal(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 rounded-full p-1 border border-gray-100"
          >
            <X size={18} />
          </button>
          
          <div className="mb-4">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <FileText size={16} className="text-blue-600" /> Registrar Ocorrência / Justificativa
            </h3>
            <p className="text-[10px] text-gray-500">Utilize este formulário apenas em caso de faltas, atrasos ou justificativas especiais.</p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-gray-700">Anotações / Descrição da Ocorrência</label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Ex: Atraso devido a compromisso acadêmico..."
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 resize-none h-24 transition-all"
              />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Upload size={14} className="text-blue-500" /> Comprovante de Ocorrência
              </span>
              
              <div className="space-y-2">
                <div>
                  <label className="block text-[9px] text-gray-500 mb-0.5">Tipo do Comprovante</label>
                  <select
                    value={justificationDocType}
                    onChange={(e) => setJustificationDocType(e.target.value)}
                    className="w-full p-2 border border-gray-300 bg-white rounded-lg focus:ring-1 focus:ring-blue-500 text-xs"
                  >
                    <option value="atestado">Atestado Médico</option>
                    <option value="curso">Inscrição em Curso</option>
                    <option value="academico">Atividade Acadêmica</option>
                    <option value="outros">Outro Comprovante</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-[9px] text-gray-500 mb-0.5">Dias Afastados</label>
                  <input
                    type="number"
                    min="0"
                    value={daysAway}
                    onChange={(e) => setDaysAway(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full p-2 border border-gray-300 bg-white rounded-lg focus:ring-1 focus:ring-blue-500 text-xs"
                  />
                </div>
                
                <div>
                  <label className="block text-[9px] text-gray-500 mb-0.5">Arquivo (PDF/PNG/JPG)</label>
                  <input
                    id="justification-doc-input"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="w-full text-xs p-1 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowOccurrenceModal(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition-colors shadow"
            >
              Confirmar e Fechar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDocumentViewModal = () => {
    if (!viewDocBase64) return null;
    const isPdf = viewDocBase64.startsWith('data:application/pdf');

    return (
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-2xl relative h-[85vh] flex flex-col">
          <button
            onClick={() => setViewDocBase64(null)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10 bg-white rounded-full p-1.5 border border-gray-200 shadow-sm"
          >
            <X size={18} />
          </button>
          <div className="mb-4">
            <h3 className="text-base font-bold text-gray-800">{viewDocType}</h3>
            <p className="text-xs text-gray-500 truncate">{viewDocName}</p>
          </div>
          <div className="flex-1 w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative mb-4">
            {isPdf ? (
              <iframe
                src={viewDocBase64}
                className="w-full h-full border-none"
                title={viewDocName}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center p-2 bg-slate-200">
                <img
                  src={viewDocBase64}
                  alt={viewDocName}
                  className="max-w-full max-h-full object-contain rounded shadow"
                />
              </div>
            )}
          </div>
          <div className="flex justify-between items-center gap-3">
            <span className="text-[10px] text-gray-400">Armazenamento digital seguro.</span>
            <button
              type="button"
              onClick={() => handleDownloadOrOpenDoc(viewDocBase64, viewDocName)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition-colors inline-flex items-center gap-1"
            >
              <Download size={13} /> Baixar Arquivo
            </button>
          </div>
        </div>
      </div>
    );
  };

  // renderDashboardSection — Aba do Dashboard
  const renderDashboardSection = () => {
    const activeInterns = interns.filter(i => i.active !== false && (filterUnit === 'all' || i.unitId === filterUnit));
    const totalActive = activeInterns.length;
    
    // Total monthly payroll (allowance sum)
    const totalPayroll = activeInterns.reduce((acc, curr) => acc + (Number(curr.allowance) || 0), 0);
    
    // Average daily hours
    const avgDailyHours = activeInterns.length > 0 
      ? (activeInterns.reduce((acc, curr) => acc + (Number(curr.dailyHours) || 6), 0) / activeInterns.length).toFixed(1)
      : 0;

    // Dossier completion: check missing documents for active interns
    // TCE, PAE, matrícula, RG/CPF, Seguro, Ficha
    const requiredDocKeys = ['tce', 'pae', 'matricula', 'documentos', 'seguro', 'ficha'];
    let totalMissingDocs = 0;
    activeInterns.forEach(intern => {
      const docs = intern.documents || {};
      requiredDocKeys.forEach(key => {
        if (!docs[key] || !docs[key].content) {
          totalMissingDocs++;
        }
      });
    });

    // Breakdown per unit
    const unitStats = {};
    activeInterns.forEach(intern => {
      const uName = intern.unitId ? unitName(intern.unitId) : 'Outra/Não definida';
      unitStats[uName] = (unitStats[uName] || 0) + 1;
    });

    // Breakdown per shift
    const shiftStats = {};
    activeInterns.forEach(intern => {
      const shift = intern.shift || 'Manhã';
      shiftStats[shift] = (shiftStats[shift] || 0) + 1;
    });

    // Contract warnings (expiring in 30 days)
    const expiringSoon = activeInterns.filter(intern => {
      if (!intern.endDate) return false;
      const end = new Date(intern.endDate);
      const diffTime = end - new Date();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    });

    // Total records this month
    const currentMonthPrefix = new Date().toISOString().substring(0, 7);
    const recordsThisMonth = records.filter(r => {
      if (!r.timestamp) return false;
      const dateStr = typeof r.timestamp === 'string' ? r.timestamp : new Date(r.timestamp).toISOString();
      const inMonth = dateStr.substring(0, 7) === currentMonthPrefix;
      const matchesUnit = filterUnit === 'all' || r.geo?.unitId === filterUnit;
      return inMonth && matchesUnit;
    }).length;

    return (
      <div className="space-y-6 animate-fade-in">
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-md shadow-indigo-100 hover:scale-[1.02] transition-transform duration-300">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-blue-100 font-semibold uppercase tracking-wider">Estagiários Ativos</p>
                <h3 className="text-3xl font-extrabold mt-2">{totalActive}</h3>
              </div>
              <div className="bg-white/20 p-2.5 rounded-xl">
                <Users size={22} className="text-white" />
              </div>
            </div>
            <p className="text-[10px] text-blue-100/80 mt-4 flex items-center gap-1 font-medium">
              Vínculos ativos na Porto Terapia
            </p>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-md shadow-emerald-100 hover:scale-[1.02] transition-transform duration-300">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-emerald-100 font-semibold uppercase tracking-wider">Folha de Pagamento</p>
                <h3 className="text-3xl font-extrabold mt-2">
                  {totalPayroll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </h3>
              </div>
              <div className="bg-white/20 p-2.5 rounded-xl">
                <Timer size={22} className="text-white" />
              </div>
            </div>
            <p className="text-[10px] text-emerald-100/80 mt-4 flex items-center gap-1 font-medium">
              Soma total das bolsas/auxílios mensais
            </p>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-md shadow-amber-100 hover:scale-[1.02] transition-transform duration-300">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-amber-100 font-semibold uppercase tracking-wider">Média Carga Horária</p>
                <h3 className="text-3xl font-extrabold mt-2">{avgDailyHours}h <span className="text-xs font-normal">/dia</span></h3>
              </div>
              <div className="bg-white/20 p-2.5 rounded-xl">
                <Clock size={22} className="text-white" />
              </div>
            </div>
            <p className="text-[10px] text-amber-100/80 mt-4 flex items-center gap-1 font-medium">
              Carga horária diária média
            </p>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-5 text-white shadow-md shadow-red-100 hover:scale-[1.02] transition-transform duration-300">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-red-100 font-semibold uppercase tracking-wider">Pendências no Dossiê</p>
                <h3 className="text-3xl font-extrabold mt-2">{totalMissingDocs}</h3>
              </div>
              <div className="bg-white/20 p-2.5 rounded-xl">
                <FileText size={22} className="text-white" />
              </div>
            </div>
            <p className="text-[10px] text-red-100/80 mt-4 flex items-center gap-1 font-medium">
              Documentos obrigatórios ausentes
            </p>
          </div>
        </div>

        {/* Charts & Insights Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Unit & Shift Distributions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-md shadow-slate-100 border border-slate-100">
              <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider flex items-center gap-2">
                🏢 Distribuição por Unidade
              </h3>
              <div className="space-y-4">
                {Object.entries(unitStats).map(([uName, count]) => {
                  const pct = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;
                  return (
                    <div key={uName} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold text-gray-700">
                        <span>{uName}</span>
                        <span>{count} estagiários ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
                {Object.keys(unitStats).length === 0 && (
                  <p className="text-center text-xs text-gray-400 italic py-4">Nenhum dado de unidade disponível.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-md shadow-slate-100 border border-slate-100">
              <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider flex items-center gap-2">
                🌅 Distribuição por Turno
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {['Manhã', 'Tarde', 'Noite', 'Integral'].map(shift => {
                  const count = shiftStats[shift] || 0;
                  const pct = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;
                  return (
                    <div key={shift} className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">{shift}</span>
                      <strong className="text-2xl font-black text-slate-800 block mt-1">{count}</strong>
                      <span className="text-[10px] text-indigo-600 font-semibold block mt-1 bg-indigo-50 px-1.5 py-0.5 rounded-full w-fit mx-auto">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Insights Panel */}
          <div className="lg:col-span-1 bg-white rounded-2xl p-6 shadow-md shadow-slate-100 border border-slate-100 space-y-6">
            <h3 className="text-sm font-bold text-gray-800 mb-2 uppercase tracking-wider flex items-center gap-2 border-b pb-3">
              💡 Insights de Gerenciamento
            </h3>
            
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
                <span className="text-xl">📅</span>
                <div>
                  <h4 className="text-xs font-bold text-blue-900">Registros de Ponto no Mês</h4>
                  <p className="text-[10px] text-blue-700 leading-normal mt-0.5">
                    Foram registrados <strong>{recordsThisMonth} pontos</strong> de entrada/saída durante este mês.
                  </p>
                </div>
              </div>

              {expiringSoon.length > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">Contratos Próximos do Fim</h4>
                    <p className="text-[10px] text-amber-700 leading-normal mt-0.5">
                      Estagiários com contrato encerrando nos próximos 30 dias:
                    </p>
                    <ul className="text-[9px] text-amber-800 font-semibold mt-1 list-disc list-inside">
                      {expiringSoon.map(i => (
                        <li key={i.id}>{i.name} ({new Date(i.endDate).toLocaleDateString('pt-BR')})</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-green-50 border border-green-100 rounded-xl flex gap-3">
                  <span className="text-xl">✅</span>
                  <div>
                    <h4 className="text-xs font-bold text-green-900">Vigência de Contratos</h4>
                    <p className="text-[10px] text-green-700 leading-normal mt-0.5">
                      Nenhum contrato de estágio expira nos próximos 30 dias.
                    </p>
                  </div>
                </div>
              )}

              {totalMissingDocs > 0 ? (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex gap-3">
                  <span className="text-xl">📁</span>
                  <div>
                    <h4 className="text-xs font-bold text-red-900">Atenção ao Dossiê</h4>
                    <p className="text-[10px] text-red-700 leading-normal mt-0.5">
                      Existem pendências de documentos essenciais no dossiê. Revise a aba "Dossiê" para carregar TCEs ou comprovantes pendentes.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-green-50 border border-green-100 rounded-xl flex gap-3">
                  <span className="text-xl">🎉</span>
                  <div>
                    <h4 className="text-xs font-bold text-green-900">Documentação Completa</h4>
                    <p className="text-[10px] text-green-700 leading-normal mt-0.5">
                      Excelente! Todos os estagiários ativos possuem dossiês 100% preenchidos.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // renderFrequenciaSection — Aba de Frequência (tabela histórica)
  const renderFrequenciaSection = () => (
    <div className="space-y-4">
      {renderHoursSummary()}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <List size={20} /> Histórico Sincronizado
            {filterUnit !== 'all' && (
              <span className="text-xs font-normal text-gray-500">• {unitName(filterUnit)}</span>
            )}
          </h2>
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
            {filteredRecords.length} {filterUnit === 'all' ? 'registros na nuvem' : 'registros'}
          </span>
        </div>
        <div className="overflow-x-auto">
          {filteredRecords.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhum registro de frequência encontrado.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                  <th className="p-3 font-semibold text-center w-14">Identificação</th>
                  <th className="p-3 font-semibold">Data / Hora</th>
                  <th className="p-3 font-semibold">Estagiário</th>
                  <th className="p-3 font-semibold">Unidade</th>
                  <th className="p-3 font-semibold">Movimentação</th>
                  <th className="p-3 font-semibold">Local</th>
                  <th className="p-3 font-semibold">Justificativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors text-xs">
                    <td className="p-3 whitespace-nowrap text-center">
                      {record.photo ? (
                        <button
                          type="button"
                          onClick={() => setSelectedRecordPhoto(record)}
                          className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 hover:ring-2 hover:ring-blue-500 transition-all flex items-center justify-center bg-slate-100 mx-auto"
                          title="Clique para ampliar foto de biometria"
                        >
                          <img src={record.photo} alt="Face check" className="w-full h-full object-cover" />
                        </button>
                      ) : record.isManual ? (
                        <span
                          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-amber-50 text-amber-700 border border-dashed border-amber-300 text-[8px] font-bold mx-auto leading-none"
                          title="Bateu ponto sem Controle Facial (Manual)"
                        >
                          MANUAL
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">sem foto</span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap text-gray-700">
                      <div className="font-semibold">{formatDate(record.timestamp)}</div>
                      <div className="text-gray-500">{formatTime(record.timestamp)}</div>
                    </td>
                    <td className="p-3 font-medium text-gray-800">{record.internName}</td>
                    <td className="p-3 text-gray-600">{record.geo?.unitName || '—'}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                        record.action === 'ocorrencia' 
                          ? 'bg-amber-100 text-amber-800' 
                          : record.action === 'entrada' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {record.action === 'ocorrencia' 
                          ? <AlertTriangle size={10} /> 
                          : record.action === 'entrada' ? <LogIn size={10} /> : <LogOut size={10} />}
                        {record.action === 'ocorrencia' 
                          ? 'Ocorrência' 
                          : record.action === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="p-3">
                      {record.geo ? (
                        <span
                          className="inline-flex items-center gap-1 text-emerald-700 font-medium"
                          title={`Lat ${record.geo.lat}, Lng ${record.geo.lng} (precisão ~${record.geo.accuracy}m)`}
                        >
                          <MapPin size={10} />
                          {record.geo.distanceM != null ? `${Math.round(record.geo.distanceM)} m` : formatDistance(record.geo.distanceKm)}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-[10px]">sem GPS</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-600 max-w-xs">
                      <div className="truncate font-medium text-gray-800" title={record.justification}>
                        {record.justification || <span className="text-gray-400 italic">Sem anotações</span>}
                      </div>
                      {record.justificationDoc && (
                        <button
                          type="button"
                          onClick={() => {
                            setViewDocBase64(record.justificationDoc.content);
                            setViewDocName(record.justificationDoc.name);
                            setViewDocType(`Comprovante: ${record.justificationDoc.type.toUpperCase()}`);
                          }}
                          className="inline-flex items-center gap-1 text-[9px] text-indigo-600 hover:text-indigo-800 font-semibold mt-1 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 transition-colors shadow-sm"
                          title="Clique para abrir comprovante de ocorrência"
                        >
                          <FileText size={10} />
                          Anexo: {record.justificationDoc.type.toUpperCase()} ({record.justificationDoc.size})
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );

  // renderResumoGerencial — Aba de IA e Resumo Gerencial
  const renderResumoGerencial = () => {
    const filteredInterns = interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit);
    const sortedInterns = [...filteredInterns].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
              <Bot size={22} className="text-blue-600" /> Resumo Gerencial (IA)
            </h2>
            <button
              onClick={handleAnalyzeRecords}
              disabled={isAnalyzing || records.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              ✨ Gerar Insights Gerenciais
            </button>
          </div>
          <div className="bg-white rounded-lg p-4 text-gray-700 text-sm whitespace-pre-line min-h-[80px] border border-blue-50">
            {isAnalyzing ? (
              <div className="flex items-center justify-center h-full text-blue-500 gap-2">
                <Loader2 size={20} className="animate-spin" /> Analisando padrões de estágio...
              </div>
            ) : aiSummary ? aiSummary : (
              <span className="text-gray-400 italic">Clique no botão para gerar uma análise inteligente com dados de frequência, relatórios e contratos dos estagiários.</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <Users size={20} className="text-blue-600" /> Estagiários (ordem alfabética)
            </h2>
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
              {sortedInterns.length} cadastros
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-600 uppercase tracking-wider border-b border-gray-100">
                  <th className="p-3 font-semibold">Nome</th>
                  <th className="p-3 font-semibold">Curso / Instituição</th>
                  <th className="p-3 font-semibold">Unidade</th>
                  <th className="p-3 font-semibold">Vigência</th>
                  <th className="p-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedInterns.length === 0 ? (
                  <tr><td colSpan="5" className="p-4 text-center text-gray-400">Nenhum estagiário cadastrado.</td></tr>
                ) : sortedInterns.map(intern => (
                  <tr key={intern.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-gray-800">
                      {intern.name}
                      {intern.cpf && <div className="text-[10px] text-gray-400 font-normal">CPF: {intern.cpf}</div>}
                    </td>
                    <td className="p-3 text-slate-600">
                      <div>{intern.course || '—'}</div>
                      <div className="text-[10px] text-gray-400">{intern.institution || ''}</div>
                    </td>
                    <td className="p-3 text-slate-600">{intern.unitId ? unitName(intern.unitId) : '—'}</td>
                    <td className="p-3 text-slate-600">
                      {formatDate(intern.startDate)} a {formatDate(intern.endDate)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        intern.active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {intern.active !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // PAINEL DA SUPERVISÃO (admin)
  // ============================================================
  const renderAdmin = () => {
    const adminNavItems = [
      { id: 'dashboard',       label: 'Dashboard',               icon: '📊' },
      { id: 'estagiarios',     label: 'Estagiários',             icon: '👤' },
      { id: 'documentos',      label: 'Documentos',              icon: '🖨️' },
      { id: 'frequencia',      label: 'Frequência',              icon: '📋' },
      { id: 'admissional',     label: 'Documentos Admissionais', icon: '📁' },
      { id: 'acompanhamento',  label: 'Acompanhamento & Recesso', icon: '📈' },
      { id: 'ocorrencias',     label: 'Abonos & Ocorrências',    icon: '⚠️' },
      { id: 'finalizacao',     label: 'Desligamento / Rescisão', icon: '🔒' },
      { id: 'financeiro',      label: 'Folha de Pagamento',      icon: '💰' },
      { id: 'rh',              label: 'Alertas & Pendências',    icon: '🔔' },
      { id: 'aniversariantes', label: 'Aniversariantes',         icon: '🎂' },
      { id: 'configuracoes',    label: 'Configurações',           icon: '⚙️' },
    ];

    return (
      <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
        {/* ── SIDEBAR DE NAVEGAÇÃO LATERAL (ESQUERDA) ── */}
        <aside className="w-full md:w-64 bg-slate-50 border-r border-slate-200 text-slate-700 flex-shrink-0 flex flex-col shadow-sm md:min-h-screen sticky top-0 z-30">
          {/* Header da Sidebar */}
          <div className="p-4 border-b border-slate-200/80 bg-white/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.jpg" alt="Logo Porto Terapia" className="h-10 w-10 rounded-lg shadow-sm object-cover border border-slate-200" />
              <div>
                <h1 className="text-base font-bold text-slate-800 font-serif leading-tight">Porto Terapia</h1>
                <p className="text-[11px] text-slate-500 font-medium">Painel da Supervisão</p>
              </div>
            </div>
          </div>

          {/* Filtro de Unidade & Ações Rápidas */}
          <div className="p-3 bg-white/40 border-b border-slate-200/80 space-y-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
                Unidade Selecionada
              </label>
              <select
                value={filterUnit}
                onChange={(e) => setFilterUnit(e.target.value)}
                title="Filtrar por unidade"
                className="w-full bg-white border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none shadow-sm"
              >
                <option value="all">Todas as unidades</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setIsOmnibarOpen(true)}
                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2 rounded-lg font-medium transition-colors text-xs shadow-xs"
                title="Abrir busca rápida (Ctrl+K)"
              >
                <Search size={13} />
                <span>Buscar (Ctrl+K)</span>
              </button>
              <button
                onClick={() => setCurrentView('kiosk')}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 py-1.5 px-2 rounded-lg font-medium transition-colors text-xs border border-slate-200 shadow-xs"
                title="Sair do Painel da Supervisão"
              >
                <ArrowLeft size={13} />
                <span>Sair</span>
              </button>
            </div>
          </div>

          {/* Menus / Links */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)] md:max-h-none flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible">
            {adminNavItems.map(tab => {
              const isActive = activeAdminTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveAdminTab(tab.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap md:whitespace-normal ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/80 shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base leading-none">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </div>
                  {tab.id === 'rh' && pendingChatCount > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {pendingChatCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Rodapé da Sidebar */}
          <div className="hidden md:block p-3 border-t border-slate-200/80 text-[11px] text-slate-400 text-center bg-white/40">
            Controle Integrado • v2.5
          </div>
        </aside>

        {/* ── ÁREA DE CONTEÚDO PRINCIPAL ── */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto min-w-0">
          <div className="max-w-7xl mx-auto space-y-6">

            {hoursAlerts.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm animate-fade-in">
                <h3 className="text-red-800 font-bold flex items-center gap-2 mb-2 text-sm">
                  <AlertTriangle size={18} /> Atenção: Limite de Carga Horária Excedido ({LABOR.maxDailyHours}h/dia)
                </h3>
                <ul className="space-y-1">
                  {hoursAlerts.map((alert, idx) => (
                    <li key={idx} className="text-xs text-red-700 bg-white/60 px-3 py-1.5 rounded-lg border border-red-100 flex justify-between items-center">
                      <span><strong>{alert.internName}</strong> - {alert.date}</span>
                      <span className="font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded">{alert.hours}h registradas</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── CONTEÚDO DAS ABAS ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6">
              {activeAdminTab === 'dashboard'      && <DashboardTab filterUnit={filterUnit} />}
              {activeAdminTab === 'frequencia'     && <FrequenciaTab filterUnit={filterUnit} />}
              {activeAdminTab === 'estagiarios'    && <EstagiariosTab filterUnit={filterUnit} />}
              {activeAdminTab === 'acompanhamento' && <AcompanhamentoTab filterUnit={filterUnit} />}
              {activeAdminTab === 'financeiro'     && <FinanceiroTab filterUnit={filterUnit} />}
              {activeAdminTab === 'ocorrencias'    && <OcorrenciasTab filterUnit={filterUnit} />}
              {activeAdminTab === 'finalizacao'    && <EncerramentoTab filterUnit={filterUnit} onPrintDocument={handlePrintDocument} />}
              {activeAdminTab === 'documentos'     && <DocumentosTab filterUnit={filterUnit} onPrintDocument={handlePrintDocument} />}
              {activeAdminTab === 'admissional'    && <DossieTab filterUnit={filterUnit} />}
              {activeAdminTab === 'rh'             && <AlertasRhTab filterUnit={filterUnit} onGenerateMinuta={setViewingMinutaIntern} />}
              {activeAdminTab === 'aniversariantes' && <AniversariantesTab filterUnit={filterUnit} />}
              {activeAdminTab === 'configuracoes'    && <ConfiguracoesTab userRole={user?.user_metadata?.role || 'admin'} />}
            </div>

          </div>
        </main>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.25s ease-out; }
        @keyframes scan {
          0% { top: 5%; }
          50% { top: 95%; }
          100% { top: 5%; }
        }
        .animate-scanline {
          position: absolute;
          animation: scan 3s linear infinite;
        }
      `}</style>
      {/* Indicador de Conexão Offline Global */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-xs font-bold py-2 text-center z-50 flex items-center justify-center gap-1.5 shadow-md">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
          Você está navegando no modo offline. Registros de ponto serão salvos localmente e sincronizados depois.
        </div>
      )}

      {/* Banner de Instalação do PWA */}
      {showInstallBtn && (
        <div className="fixed bottom-4 right-4 max-w-sm bg-white border border-slate-200 rounded-2xl p-4 shadow-2xl z-50 flex flex-col gap-2.5 animate-fade-in">
          <div className="flex gap-3 items-start">
            <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600">
              <Download size={20} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Instalar Aplicativo Web</h4>
              <p className="text-[10px] text-slate-500 leading-normal mt-0.5">Instale o aplicativo no seu dispositivo para ter acesso offline completo e batida biométrica otimizada.</p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowInstallBtn(false)}
              className="text-[10px] font-semibold text-slate-500 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              Agora Não
            </button>
            <button
              onClick={handleInstallApp}
              className="text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              Instalar Aplicativo
            </button>
          </div>
        </div>
      )}

      {currentView === 'kiosk' ? (
        renderKiosk()
      ) : currentView === 'recadastro' ? (
        renderRecadastroSection()
      ) : currentView === 'autogestao_biometria' ? (
        renderAutogestaoBiometria()
      ) : (
        renderAdmin()
      )}

      {renderChatWidget()}
      {renderRecordPhotoModal()}
      {renderDocumentViewModal()}
      {renderTemplateModal()}
      {renderOccurrenceModal()}
      {currentView === 'admin' && (
        <Omnibar 
          isOpen={isOmnibarOpen} 
          setIsOpen={setIsOmnibarOpen} 
          interns={interns} 
          onSelectAction={handleOmnibarAction} 
        />
      )}
    </>
  );
}
