import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, ArrowRightLeft, Archive, ArchiveRestore, Send, MessageCircle, Mail, StickyNote } from 'lucide-react';
import { CANDIDATE_STATUSES, statusLabel } from '../../constants/talentBank';

// Menu de ações rápidas por candidato, na linha da tabela. O repo não usa
// Radix/shadcn — dropdown feito à mão com listener de clique fora, no mesmo
// espírito dos demais menus/modais bespoke do app (ver NfseUploadModal.jsx).
export default function CandidateActionsMenu({
  candidate,
  effectiveStatus,
  busy,
  onChangeStatus,
  onSendDisc,
  onOpenNotes,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const phoneDigits = (candidate.phone || '').replace(/\D/g, '');
  const waHref = phoneDigits ? `https://wa.me/55${phoneDigits}` : null;
  const isArchived = effectiveStatus === 'ARQUIVADO';

  const act = (fn) => (e) => {
    e.stopPropagation();
    setOpen(false);
    fn();
  };

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        disabled={busy}
        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
        title="Ações"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 text-sm">
          <div className="px-3 pt-1 pb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            Mudar status
          </div>
          {CANDIDATE_STATUSES.filter((s) => s.value !== effectiveStatus).map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={act(() => onChangeStatus(s.value))}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
              {s.label}
            </button>
          ))}

          <div className="my-1 border-t border-slate-100" />

          <button
            type="button"
            onClick={act(() => onChangeStatus(isArchived ? 'CONTATADO' : 'ARQUIVADO'))}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
          >
            {isArchived ? (
              <><ArchiveRestore className="w-3.5 h-3.5 text-slate-400" /> Desarquivar</>
            ) : (
              <><Archive className="w-3.5 h-3.5 text-slate-400" /> Arquivar</>
            )}
          </button>

          <div className="my-1 border-t border-slate-100" />

          <button
            type="button"
            onClick={act(onSendDisc)}
            disabled={!candidate.email}
            className="w-full flex items-start gap-2 px-3 py-1.5 text-left text-blue-700 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:text-slate-400"
            title={!candidate.email ? 'Candidato sem e-mail' : undefined}
          >
            <Send className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">
                {candidate.hasDiscToken ? 'Reenviar Levantamento' : 'Enviar Levantamento de Perfil'}
              </div>
              {candidate.hasDiscToken && (
                <div className="text-[10px] text-amber-600 font-semibold mt-0.5">
                  ⚠️ Já enviado anteriormente
                </div>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={act(onOpenNotes)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
          >
            <StickyNote className="w-3.5 h-3.5 text-slate-400" />
            Notas internas
          </button>

          <div className="my-1 border-t border-slate-100" />

          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
            >
              <MessageCircle className="w-3.5 h-3.5 text-slate-400" />
              WhatsApp
            </a>
          ) : (
            <span className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-300 cursor-not-allowed">
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </span>
          )}

          {candidate.email ? (
            <a
              href={`mailto:${candidate.email}`}
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
            >
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              Enviar e-mail
            </a>
          ) : (
            <span className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-300 cursor-not-allowed">
              <Mail className="w-3.5 h-3.5" /> Enviar e-mail
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export { statusLabel };
