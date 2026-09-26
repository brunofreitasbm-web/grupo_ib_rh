import React, { useState, useEffect } from 'react';
import { Star, X, Send, HeartHandshake, CheckCircle2, MessageSquare, ShieldCheck, ThumbsUp, Frown, Meh, Smile } from 'lucide-react';

export default function NpsModal({
  isOpen,
  onClose,
  onSubmit,
  supervisorName = '',
  internName = '',
  internId = '',
  sessionDuration = 15,
}) {
  const [score, setScore] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setScore(null);
      setFeedback('');
      setSubmitting(false);
      setSuccessMessage(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getScoreCategory = (val) => {
    if (val === null) return null;
    if (val <= 6) return { key: 'detractor', label: 'Detrator', color: 'bg-rose-500 text-white', border: 'border-rose-400', text: 'text-rose-600', bgSoft: 'bg-rose-50 border-rose-200', icon: Frown, desc: 'Pontos a melhorar no atendimento' };
    if (val <= 8) return { key: 'neutral', label: 'Neutro', color: 'bg-amber-500 text-white', border: 'border-amber-400', text: 'text-amber-600', bgSoft: 'bg-amber-50 border-amber-200', icon: Meh, desc: 'Atendimento atendeu às expectativas' };
    return { key: 'promoter', label: 'Promotor', color: 'bg-emerald-500 text-white', border: 'border-emerald-400', text: 'text-emerald-600', bgSoft: 'bg-emerald-50 border-emerald-200', icon: Smile, desc: 'Atendimento excelente! Altamente recomendado' };
  };

  const selectedCategory = getScoreCategory(score);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (score === null) return;

    setSubmitting(true);
    try {
      const evaluationData = {
        score,
        category: selectedCategory.key,
        feedback: feedback.trim(),
        supervisorName,
        internName,
        internId,
        sessionDuration,
        createdAt: new Date().toISOString(),
      };
      await onSubmit(evaluationData);
      setSuccessMessage(true);
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Erro ao enviar NPS:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden bg-white shadow-2xl rounded-2xl border border-slate-100">
        
        {/* Header Decorativo */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-5 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            title="Fechar"
          >
            <X size={18} />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
              <HeartHandshake size={24} className="text-amber-300" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-blue-200 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
                Pesquisa de Satisfação NPS
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">Avaliação de Atendimento</h3>
            </div>
          </div>
          <p className="text-xs text-blue-100/90 leading-relaxed">
            Fim do tempo da sessão de acompanhamento do responsável. Por favor, avalie a qualidade do atendimento prestado.
          </p>
        </div>

        {/* Informações da Sessão */}
        {(supervisorName || internName) && (
          <div className="bg-slate-50 border-b border-slate-100 px-5 py-2.5 flex items-center justify-between text-xs text-slate-600">
            {supervisorName && (
              <span className="truncate">
                <strong>Responsável:</strong> {supervisorName}
              </span>
            )}
            {internName && (
              <span className="truncate">
                <strong>Atendido:</strong> {internName}
              </span>
            )}
          </div>
        )}

        {/* Conteúdo do Formulário */}
        {successMessage ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 size={32} />
            </div>
            <h4 className="text-lg font-bold text-slate-800">Obrigado pelo seu Feedback!</h4>
            <p className="text-xs text-slate-500">Sua avaliação do atendimento foi registrada com sucesso.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-3 text-center">
                Em uma escala de 0 a 10, como você avalia o <span className="text-blue-600 font-bold">atendimento</span> recebido nesta sessão?
              </label>

              {/* Botões de 0 a 10 */}
              <div className="grid grid-cols-11 gap-1.5 sm:gap-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                  const isSelected = score === num;
                  let colorClass = 'hover:border-rose-400 hover:bg-rose-50 text-slate-700';
                  if (num >= 7 && num <= 8) colorClass = 'hover:border-amber-400 hover:bg-amber-50 text-slate-700';
                  if (num >= 9) colorClass = 'hover:border-emerald-400 hover:bg-emerald-50 text-slate-700';

                  if (isSelected) {
                    if (num <= 6) colorClass = 'bg-rose-600 text-white font-bold ring-2 ring-rose-400 ring-offset-1 border-rose-600';
                    else if (num <= 8) colorClass = 'bg-amber-500 text-white font-bold ring-2 ring-amber-400 ring-offset-1 border-amber-500';
                    else colorClass = 'bg-emerald-600 text-white font-bold ring-2 ring-emerald-400 ring-offset-1 border-emerald-600';
                  }

                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setScore(num)}
                      className={`h-10 border rounded-lg text-xs transition-all flex items-center justify-center ${colorClass}`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>

              {/* Legenda dos Extremos */}
              <div className="flex justify-between text-[10px] text-slate-400 mt-2 px-1 font-medium">
                <span>0 = Ruim (Insatisfeito)</span>
                <span>5 = Razoável</span>
                <span>10 = Excelente (Muito Satisfeito)</span>
              </div>
            </div>

            {/* Categoria Selecionada */}
            {selectedCategory && (
              <div className={`p-3 rounded-xl border ${selectedCategory.bgSoft} flex items-center gap-3 transition-all`}>
                <selectedCategory.icon size={22} className={selectedCategory.text} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${selectedCategory.color}`}>
                      Nota {score} • {selectedCategory.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 font-medium">{selectedCategory.desc}</p>
                </div>
              </div>
            )}

            {/* Campo de Comentário Opcional */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
                <MessageSquare size={14} className="text-blue-600" />
                Comentário sobre o atendimento <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <textarea
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Conte-nos mais sobre os aspectos positivos ou pontos a melhorar no atendimento..."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50/50 resize-none"
              />
            </div>

            {/* Rodapé e Ações */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={score === null || submitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md flex items-center gap-1.5"
              >
                {submitting ? 'Enviando...' : (
                  <>
                    <Send size={13} /> Registrar NPS
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
