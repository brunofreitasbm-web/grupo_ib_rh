import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Save, Loader2, Upload, Eye, Trash, X, Download,
  Timer, Play, Pause, RotateCcw, HeartHandshake, Star, TrendingUp,
  MessageSquare, Award, Smile, Meh, Frown, CheckCircle2, Bell, Sparkles, Clock
} from 'lucide-react';
import { supabase } from '../../supabase';
import { mapInternFromDb, mapUnitFromDb, fileToBase64, INTERN_SELECT_FIELDS } from '../../utils/mappings';
import NpsModal from '../NpsModal';

export default function AcompanhamentoTab({ filterUnit, restrictedUnitIds = [] }) {
  const [interns, setInterns] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form & Selection States
  const [selectedActivityIntern, setSelectedActivityIntern] = useState('');
  const [activityReportDate, setActivityReportDate] = useState('');
  const [activityRecessDays, setActivityRecessDays] = useState(0);
  const [activitySupervisorName, setActivitySupervisorName] = useState('');
  const [uploadingSemestralReport, setUploadingSemestralReport] = useState(false);
  const [semestralReportPeriod, setSemestralReportPeriod] = useState('1');

  // Document View Modal State
  const [viewDocBase64, setViewDocBase64] = useState(null);
  const [viewDocName, setViewDocName] = useState('');
  const [viewDocType, setViewDocType] = useState('');

  // ============================================================
  // ESTADOS E LÓGICA DO TEMPORIZADOR DE SESSÃO DO RESPONSÁVEL & NPS
  // ============================================================
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(15);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(15 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [sessionStatus, setSessionStatus] = useState('idle'); // 'idle' | 'running' | 'paused' | 'ended'
  const [isNpsModalOpen, setIsNpsModalOpen] = useState(false);
  const [npsEvaluations, setNpsEvaluations] = useState([]);
  const [loadingNps, setLoadingNps] = useState(false);
  const timerRef = useRef(null);

  // Função para tocar alerta sonoro suave ao fim do tempo da sessão
  const playNotificationChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (err) {
      console.log('Audio autoplay prevent/unsupported:', err);
    }
  };

  // Carregar dados de acompanhamento
  const fetchData = useCallback(async () => {
    try {
      const { data: internsData } = await supabase
        .from('interns')
        .select(INTERN_SELECT_FIELDS)
        .order('name', { ascending: true });

      const { data: unitsData } = await supabase
        .from('units')
        .select('*');

      if (internsData) setInterns(internsData.map(mapInternFromDb).filter(i => !restrictedUnitIds.includes(i.unitId)));
      if (unitsData) setUnits(unitsData.map(mapUnitFromDb).filter(u => !restrictedUnitIds.includes(u.id)));
    } catch (err) {
      console.error('Erro ao carregar dados de acompanhamento:', err);
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds]);

  // Carregar avaliações NPS
  const fetchNpsEvaluations = useCallback(async () => {
    setLoadingNps(true);
    try {
      const { data, error } = await supabase
        .from('nps_evaluations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setNpsEvaluations(data);
        localStorage.setItem('nps_evaluations_fallback', JSON.stringify(data));
      }
    } catch (err) {
      console.warn('Tabela nps_evaluations indisponível no Supabase, usando armazenamento local:', err);
      const cached = localStorage.getItem('nps_evaluations_fallback');
      if (cached) {
        setNpsEvaluations(JSON.parse(cached));
      }
    } finally {
      setLoadingNps(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchNpsEvaluations();

    const internsChannel = supabase
      .channel('acompanhamento-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interns' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(internsChannel);
    };
  }, [fetchData, fetchNpsEvaluations]);

  // Sincronizar dados quando um estagiário é selecionado
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

  const selectedInternData = interns.find(i => i.id === selectedActivityIntern);

  // Efeito da contagem regressiva do temporizador de sessão
  useEffect(() => {
    if (isTimerRunning && timeLeftSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeftSeconds((prev) => prev - 1);
      }, 1000);
    } else if (isTimerRunning && timeLeftSeconds === 0) {
      // TEMPO DA SESSÃO ENCERROU! Disparar NPS automaticamente
      setIsTimerRunning(false);
      setSessionStatus('ended');
      playNotificationChime();
      setIsNpsModalOpen(true);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, timeLeftSeconds]);

  // Controles do Temporizador
  const handleStartTimer = () => {
    if (timeLeftSeconds === 0) {
      setTimeLeftSeconds(sessionDurationMinutes * 60);
    }
    setIsTimerRunning(true);
    setSessionStatus('running');
  };

  const handlePauseTimer = () => {
    setIsTimerRunning(false);
    setSessionStatus('paused');
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setTimeLeftSeconds(sessionDurationMinutes * 60);
    setSessionStatus('idle');
  };

  const handleDurationChange = (mins) => {
    const m = parseInt(mins, 10) || 15;
    setSessionDurationMinutes(m);
    if (!isTimerRunning) {
      setTimeLeftSeconds(m * 60);
      setSessionStatus('idle');
    }
  };

  const handleEndSessionAndTriggerNps = () => {
    setIsTimerRunning(false);
    setSessionStatus('ended');
    playNotificationChime();
    setIsNpsModalOpen(true);
  };

  // Submissão da Avaliação NPS
  const handleNpsSubmit = async (evaluationData) => {
    const payload = {
      score: evaluationData.score,
      category: evaluationData.category,
      feedback: evaluationData.feedback,
      supervisor_name: evaluationData.supervisorName || activitySupervisorName || 'Responsável',
      intern_name: selectedInternData?.name || evaluationData.internName || 'Atendido',
      intern_id: selectedInternData?.id || null,
      session_duration: sessionDurationMinutes,
      unit_id: selectedInternData?.unitId || (filterUnit !== 'all' ? filterUnit : null),
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('nps_evaluations')
        .insert([payload]);

      if (error) console.warn('Supabase nps insert warning:', error);
    } catch (err) {
      console.warn('Usando fallback local para NPS:', err);
    }

    // Atualizar fallback local e estado
    const newEntry = {
      id: window.crypto?.randomUUID ? window.crypto.randomUUID() : String(Date.now()),
      ...payload
    };

    const updatedList = [newEntry, ...npsEvaluations];
    setNpsEvaluations(updatedList);
    localStorage.setItem('nps_evaluations_fallback', JSON.stringify(updatedList));
  };

  // Cálculos Estatísticos de NPS
  const totalNpsCount = npsEvaluations.length;
  const promoters = npsEvaluations.filter(e => e.score >= 9).length;
  const neutrals = npsEvaluations.filter(e => e.score >= 7 && e.score <= 8).length;
  const detractors = npsEvaluations.filter(e => e.score <= 6).length;

  const npsScore = totalNpsCount > 0
    ? Math.round(((promoters - detractors) / totalNpsCount) * 100)
    : 0;

  const averageRating = totalNpsCount > 0
    ? (npsEvaluations.reduce((sum, item) => sum + item.score, 0) / totalNpsCount).toFixed(1)
    : '0.0';

  const formatMMSS = (totalSec) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const totalSessionSecs = sessionDurationMinutes * 60;
  const timerProgress = totalSessionSecs > 0
    ? Math.max(0, Math.min(100, ((totalSessionSecs - timeLeftSeconds) / totalSessionSecs) * 100))
    : 0;

  // Relatórios Semestrais
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
      fetchData();
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

      const { error } = await supabase
        .from('interns')
        .update({ semestral_reports: updatedReports })
        .eq('id', selectedInternData.id);
      if (error) throw error;

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
      fetchData();
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

      const { error } = await supabase
        .from('interns')
        .update({ semestral_reports: updatedReports })
        .eq('id', selectedInternData.id);
      if (error) throw error;

      await supabase
        .from('document_contents')
        .delete()
        .eq('intern_id', selectedInternData.id)
        .eq('doc_key', `semestral_report_${period}`);

      alert('Relatório removido com sucesso!');
      fetchData();
    } catch (err) {
      console.error("Erro ao deletar relatório semestral:", err);
      alert('Erro ao excluir documento.');
    }
  };

  const handleViewDocumentContent = async (internId, docKey, fallbackName = '', docLabel = '') => {
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

  const handleDownloadOrOpenDoc = (base64, filename) => {
    const link = document.createElement('a');
    link.href = base64;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* ============================================================ */}
      {/* PAINEL SUPERIOR: SESSÃO DO RESPONSÁVEL & DISPARO DE NPS      */}
      {/* ============================================================ */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl shadow-xl border border-indigo-500/20 text-white p-5 overflow-hidden relative">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          
          {/* Título e Status da Sessão */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles size={11} className="text-amber-400" /> Acompanhamento do Responsável
              </span>
              {sessionStatus === 'running' && (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Sessão Ativa
                </span>
              )}
              {sessionStatus === 'paused' && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Pausada
                </span>
              )}
              {sessionStatus === 'ended' && (
                <span className="bg-purple-500/20 text-purple-300 border border-purple-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Tempo Encerrado
                </span>
              )}
            </div>

            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Timer className="text-indigo-400" size={24} /> Temporizador de Sessão & NPS de Atendimento
            </h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Inicie a contagem da sessão do responsável. Ao atingir o fim do tempo ou finalizar a sessão, a pesquisa de NPS (0 a 10) sobre atendimento é disparada automaticamente.
            </p>
          </div>

          {/* Cronômetro Visual & Controles */}
          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl flex flex-col sm:flex-row items-center gap-5 shadow-inner">
            
            {/* Relógio Digital */}
            <div className="text-center sm:text-left min-w-[130px]">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center justify-center sm:justify-start gap-1">
                <Clock size={11} /> Tempo Restante
              </div>
              <div className="text-3xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-indigo-100 tracking-tight">
                {formatMMSS(timeLeftSeconds)}
              </div>
              
              {/* Barra de Progresso do Tempo */}
              <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1.5 border border-slate-600">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
                  style={{ width: `${timerProgress}%` }}
                ></div>
              </div>
            </div>

            {/* Seleção de Duração e Botões de Ação */}
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              
              <div className="flex items-center gap-1.5">
                <select
                  disabled={isTimerRunning}
                  value={sessionDurationMinutes}
                  onChange={(e) => handleDurationChange(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                >
                  <option value={5}>Sessão de 5 min</option>
                  <option value={10}>Sessão de 10 min</option>
                  <option value={15}>Sessão de 15 min</option>
                  <option value={20}>Sessão de 20 min</option>
                  <option value={30}>Sessão de 30 min</option>
                  <option value={45}>Sessão de 45 min</option>
                  <option value={60}>Sessão de 60 min</option>
                </select>

                {!isTimerRunning ? (
                  <button
                    type="button"
                    onClick={handleStartTimer}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-1.5 px-3 rounded-lg transition-all flex items-center gap-1 shadow-md"
                  >
                    <Play size={13} /> Iniciar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePauseTimer}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs py-1.5 px-3 rounded-lg transition-all flex items-center gap-1 shadow-md"
                  >
                    <Pause size={13} /> Pausar
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleResetTimer}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs p-1.5 rounded-lg transition-colors"
                  title="Reiniciar Tempo"
                >
                  <RotateCcw size={13} />
                </button>
              </div>

              {/* Botão de Disparo Manual de NPS */}
              <button
                type="button"
                onClick={handleEndSessionAndTriggerNps}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs py-1.5 px-3 rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 border border-purple-400/30"
              >
                <HeartHandshake size={14} className="text-amber-300" /> Disparar NPS de Atendimento (0-10)
              </button>

            </div>

          </div>

        </div>
      </div>

      {/* ============================================================ */}
      {/* PAINEL DE METRICAS E HISTORICO NPS DE ATENDIMENTO             */}
      {/* ============================================================ */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Award size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Satisfação do Atendimento (NPS 0-10)</h3>
              <p className="text-xs text-slate-500">Métricas acumuladas do atendimento durante as sessões de acompanhamento</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Total de Avaliações:</span>
            <span className="bg-slate-100 text-slate-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-slate-200">
              {totalNpsCount}
            </span>
          </div>
        </div>

        {/* Cards de Métricas Principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Score NPS (-100 a +100) */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-3.5 space-y-1">
            <div className="flex justify-between items-center text-xs font-semibold text-indigo-900">
              <span>Score NPS</span>
              <TrendingUp size={16} className="text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-indigo-700">
              {npsScore > 0 ? `+${npsScore}` : npsScore}
            </div>
            <p className="text-[10px] text-indigo-600 font-medium">
              {npsScore >= 75 ? 'Zona de Excelência' : npsScore >= 50 ? 'Zona de Qualidade' : npsScore >= 0 ? 'Zona de Aperfeiçoamento' : 'Zona Crítica'}
            </p>
          </div>

          {/* Card 2: Média Geral (0 a 10) */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-3.5 space-y-1">
            <div className="flex justify-between items-center text-xs font-semibold text-emerald-900">
              <span>Média de Atendimento</span>
              <Star size={16} className="text-amber-500 fill-amber-400" />
            </div>
            <div className="text-2xl font-black text-emerald-700">
              {averageRating} <span className="text-xs font-normal text-emerald-600">/ 10</span>
            </div>
            <p className="text-[10px] text-emerald-600 font-medium">Pontuação média direta recebida</p>
          </div>

          {/* Card 3: Promotores (9-10) */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-1">
            <div className="flex justify-between items-center text-xs font-semibold text-emerald-900">
              <span className="flex items-center gap-1"><Smile size={14} className="text-emerald-600" /> Promotores (9-10)</span>
              <span className="text-xs font-bold text-emerald-700">{promoters}</span>
            </div>
            <div className="w-full bg-emerald-200/60 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full"
                style={{ width: `${totalNpsCount > 0 ? (promoters / totalNpsCount) * 100 : 0}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-emerald-700 font-medium">
              {totalNpsCount > 0 ? Math.round((promoters / totalNpsCount) * 100) : 0}% dos avaliadores
            </p>
          </div>

          {/* Card 4: Detratores (0-6) & Neutros (7-8) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1 font-semibold text-amber-700"><Meh size={13} /> Neutros (7-8):</span>
              <span className="font-bold text-slate-800">{neutrals} ({totalNpsCount > 0 ? Math.round((neutrals / totalNpsCount) * 100) : 0}%)</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1 font-semibold text-rose-700"><Frown size={13} /> Detratores (0-6):</span>
              <span className="font-bold text-slate-800">{detractors} ({totalNpsCount > 0 ? Math.round((detractors / totalNpsCount) * 100) : 0}%)</span>
            </div>
          </div>

        </div>

        {/* Lista de Avaliações Recentes */}
        {npsEvaluations.length > 0 && (
          <div className="pt-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MessageSquare size={13} className="text-indigo-600" /> Últimas Avaliações Registradas
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {npsEvaluations.slice(0, 5).map((item, idx) => {
                let badgeClass = 'bg-rose-100 text-rose-800 border-rose-200';
                if (item.score >= 9) badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                else if (item.score >= 7) badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';

                return (
                  <div key={item.id || idx} className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${badgeClass}`}>
                          Nota {item.score}/10
                        </span>
                        <span className="font-semibold text-slate-800">{item.intern_name || 'Atendido'}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500">Resp: {item.supervisor_name || 'Responsável'}</span>
                      </div>
                      {item.feedback && (
                        <p className="text-slate-600 text-[11px] italic mt-1 bg-white p-1.5 rounded-lg border border-slate-100">
                          "{item.feedback}"
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Recente'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* SEÇÃO PRINCIPAL DE ACOMPANHAMENTO DE ATIVIDADES E RECESSO    */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <FileText size={20} className="text-blue-600" /> Acompanhamento de Atividades Diárias
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
                                  onClick={() => handleViewDocumentContent(selectedInternData.id, `semestral_report_${period}`, rep.name, `Relatório Semestral ${period}º Sem.`)}
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

        {/* Modal de Visualização de Documentos */}
        {viewDocBase64 && (
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
                {viewDocBase64.startsWith('data:application/pdf') ? (
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
        )}

        {/* Modal de Avaliação NPS (Disparado no fim da sessão) */}
        <NpsModal
          isOpen={isNpsModalOpen}
          onClose={() => setIsNpsModalOpen(false)}
          onSubmit={handleNpsSubmit}
          supervisorName={selectedInternData?.supervisorName || activitySupervisorName}
          internName={selectedInternData?.name}
          internId={selectedInternData?.id}
          sessionDuration={sessionDurationMinutes}
        />
      </div>
    </div>
  );
}
