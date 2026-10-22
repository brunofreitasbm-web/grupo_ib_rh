import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Award,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Copy,
  Check,
  RefreshCw,
  TrendingUp,
  BrainCircuit,
  User,
  ArrowRight,
  FileText,
  Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';

const RECOMMENDATION_COLORS = {
  'ALTAMENTE RECOMENDADO': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'RECOMENDADO COM RESSALVAS': 'bg-amber-50 text-amber-700 border-amber-200',
  'BANCO DE RESERVA': 'bg-blue-50 text-blue-700 border-blue-200',
  'NÃO ADERENTE': 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function CandidateAiAnalysisModal({
  candidate,
  analysis,
  loading = false,
  onReanalyze,
  onClose,
}) {
  const [copied, setCopied] = useState(false);

  if (!candidate) return null;

  const score = analysis?.overallFitScore ?? null;
  const level = analysis?.recommendationLevel || 'EM ANÁLISE';
  const badgeStyle = RECOMMENDATION_COLORS[level] || 'bg-slate-50 text-slate-700 border-slate-200';

  const getScoreColor = (val) => {
    if (val >= 80) return 'text-emerald-600 border-emerald-500 bg-emerald-50';
    if (val >= 65) return 'text-blue-600 border-blue-500 bg-blue-50';
    if (val >= 50) return 'text-amber-600 border-amber-500 bg-amber-50';
    return 'text-rose-600 border-rose-500 bg-rose-50';
  };

  const getProgressBarColor = (val) => {
    if (val >= 80) return 'bg-emerald-500';
    if (val >= 65) return 'bg-blue-500';
    if (val >= 50) return 'bg-amber-500';
    return 'bg-rose-400';
  };

  const copyAnalysisToClipboard = () => {
    if (!analysis) return;
    const text = `📋 PARECER DE RECRUTAMENTO COM IA — ${candidate.full_name?.toUpperCase()}
Formação: ${candidate.course || 'Não informado'} | Área: ${candidate.desired_area || 'Geral'}
Classificação: ${level} (Score Geral: ${score ?? '—'}/100)
Função Recomendada: ${analysis.topRecommendedRole || '—'}

💡 RESUMO EXECUTIVO:
${analysis.executiveSummary || '—'}

🎯 ADERÊNCIA POR FUNÇÃO:
${(analysis.roleMatches || [])
  .map((r) => `• ${r.roleLabel}: ${r.score}% (${r.reason || ''})`)
  .join('\n')}

⭐ PONTOS FORTES:
${(analysis.strengths || []).map((s) => `• ${s}`).join('\n')}

⚠️ PONTOS DE ATENÇÃO:
${(analysis.developmentPoints || []).map((d) => `• ${d}`).join('\n')}

💬 PERGUNTAS SUGERIDAS PARA A ENTREVISTA:
${(analysis.interviewQuestions || []).map((q, i) => `${i + 1}. ${q}`).join('\n')}

➡️ PRÓXIMO PASSO SUGERIDO:
${analysis.suggestedNextStep || '—'}
`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Parecer copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-6 flex flex-col max-h-[92vh] overflow-hidden border border-slate-100">
        {/* Top Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-start justify-between relative shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {candidate.full_name}
                </h3>
                {candidate.resume_url && (
                  <a
                    href={candidate.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-200 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-md transition-colors"
                    title="Abrir currículo original"
                  >
                    <FileText className="w-3 h-3" /> CV Anexo
                  </a>
                )}
              </div>
              <p className="text-xs text-indigo-200 flex items-center gap-2 mt-0.5">
                <span>{candidate.course || 'Formação geral'}</span>
                <span>•</span>
                <span>{candidate.desired_area || 'Área não informada'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm font-medium text-slate-700">
                Analisando currículo, perfil DISC e competências com IA...
              </p>
              <p className="text-xs text-slate-400 max-w-sm text-center">
                Cruzando formação técnica, experiência descrita e aderência aos perfis de recepção, clínica e administração.
              </p>
            </div>
          ) : !analysis ? (
            <div className="py-12 text-center space-y-3">
              <BrainCircuit className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-600">Nenhuma análise de IA gerada ainda para este candidato.</p>
              <button
                type="button"
                onClick={() => onReanalyze?.(candidate)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Gerar Análise Preditiva Agora
              </button>
            </div>
          ) : (
            <>
              {/* Score e Status Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80 items-center">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center shrink-0 ${getScoreColor(
                      score || 0
                    )}`}
                  >
                    <span className="text-xl font-black leading-none">{score ?? '—'}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">Score</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                      Aderência Geral
                    </span>
                    <div className="text-xs font-semibold text-slate-700 mt-0.5">
                      Baseado em competências e perfil
                    </div>
                  </div>
                </div>

                <div className="sm:border-l sm:border-slate-200 sm:pl-4 space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                    Classificação
                  </span>
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border ${badgeStyle}`}
                    >
                      <Award className="w-3.5 h-3.5 shrink-0" />
                      {level}
                    </span>
                  </div>
                </div>

                <div className="sm:border-l sm:border-slate-200 sm:pl-4 space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                    Função mais Aderente
                  </span>
                  <div className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                    <span>{analysis.topRecommendedRole || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Resumo Executivo */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                  Parecer Executivo
                </h4>
                <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 text-sm text-slate-700 leading-relaxed font-normal">
                  {analysis.executiveSummary}
                </div>
              </div>

              {/* Match por Função na Clínica */}
              {Array.isArray(analysis.roleMatches) && analysis.roleMatches.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <BrainCircuit className="w-3.5 h-3.5 text-indigo-600" />
                    Compatibilidade com Funções do Grupo IB / Porto Terapia
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {analysis.roleMatches.map((m) => (
                      <div
                        key={m.roleId || m.roleLabel}
                        className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{m.roleLabel}</span>
                          <span
                            className={`text-xs font-black px-1.5 py-0.5 rounded ${
                              m.score >= 80
                                ? 'text-emerald-700 bg-emerald-50'
                                : m.score >= 60
                                ? 'text-blue-700 bg-blue-50'
                                : 'text-slate-600 bg-slate-100'
                            }`}
                          >
                            {m.score}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getProgressBarColor(m.score)}`}
                            style={{ width: `${Math.max(m.score, 4)}%` }}
                          />
                        </div>
                        {m.reason && (
                          <p className="text-[11px] text-slate-500 line-clamp-2">{m.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pontos Fortes e Pontos de Atenção */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/40 space-y-2">
                  <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Pontos Fortes Identificados
                  </h5>
                  <ul className="space-y-1.5">
                    {(analysis.strengths || []).map((s, idx) => (
                      <li key={idx} className="text-xs text-slate-700 flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold shrink-0">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/40 space-y-2">
                  <h5 className="text-xs font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Pontos de Atenção no Perfil
                  </h5>
                  <ul className="space-y-1.5">
                    {(analysis.developmentPoints || []).map((d, idx) => (
                      <li key={idx} className="text-xs text-slate-700 flex items-start gap-1.5">
                        <span className="text-amber-500 font-bold shrink-0">•</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Perguntas Sugeridas para a Entrevista */}
              {Array.isArray(analysis.interviewQuestions) && analysis.interviewQuestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                    Perguntas Estratégicas para o Entrevistador
                  </h4>
                  <div className="space-y-2">
                    {analysis.interviewQuestions.map((q, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5"
                      >
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{q}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Próximo Passo */}
              {analysis.suggestedNextStep && (
                <div className="p-3 rounded-xl bg-slate-900 text-white flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="text-slate-300">Próximo passo sugerido:</span>
                    <span className="font-semibold text-white">{analysis.suggestedNextStep}</span>
                  </div>
                </div>
              )}

              {/* Data da Análise */}
              {analysis.analyzed_at && (
                <div className="text-[10px] text-slate-400 text-right">
                  Análise gerada em {new Date(analysis.analyzed_at).toLocaleString('pt-BR')} via {analysis.model === 'deepseek-chat' ? 'DeepSeek AI' : (analysis.model || 'DeepSeek AI')}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyAnalysisToClipboard}
              disabled={!analysis || loading}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors inline-flex items-center gap-1.5 disabled:opacity-40"
              title="Copiar texto formatado do parecer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              {copied ? 'Copiado!' : 'Copiar Parecer'}
            </button>
            <button
              type="button"
              onClick={() => onReanalyze?.(candidate)}
              disabled={loading}
              className="px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl transition-colors inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Reanalisar com IA
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
