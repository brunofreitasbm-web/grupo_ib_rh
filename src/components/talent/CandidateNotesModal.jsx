import React, { useState, useEffect } from 'react';
import { X, Loader2, StickyNote } from 'lucide-react';
import { supabase } from '../../supabase';
import { toast } from 'sonner';

// Anotações internas do gestor sobre um candidato do Banco de Talentos.
// Persistidas na camada local de overlay (talent_candidates_meta.notes —
// ver migração 20260915_talent_bank_overlay_disc), já que os candidatos em
// si vêm somente-leitura do projeto Faça Amigos.
export default function CandidateNotesModal({ candidate, initialNotes, onClose, onSaved }) {
  const [notes, setNotes] = useState(initialNotes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotes(initialNotes || '');
  }, [candidate?.id, initialNotes]);

  if (!candidate) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('talent_candidates_meta').upsert({
        candidate_id: candidate.id,
        notes: notes.trim() || null,
        snapshot: { full_name: candidate.full_name, email: candidate.email, phone: candidate.phone },
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success('Notas salvas.');
      onSaved?.(notes.trim());
      onClose();
    } catch (err) {
      console.error('Erro ao salvar notas do candidato:', err);
      toast.error('Não foi possível salvar as notas.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">Notas internas</h3>
              <p className="text-xs text-slate-500">{candidate.full_name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          placeholder="Observações da entrevista, próximos passos, feedback interno..."
          className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
        />
        <p className="text-[11px] text-slate-400 mt-1">Visível apenas para gestores neste sistema.</p>

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
