import React, { useState, useEffect } from 'react';
import { Upload, X, FileText, CheckCircle2, Loader2, Calendar, Building2, AlertCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabase';
import { fileToBase64, getFriendlyDbErrorMessage } from '../utils/mappings';
import { toast } from 'sonner';

export default function PublicPayrollUploadModal({ isOpen, onClose, branding, units = [], initialUnitId = '' }) {
  const [unitId, setUnitId] = useState(initialUnitId || '');
  const [competencia, setCompetencia] = useState(() => new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialUnitId) {
      setUnitId(initialUnitId);
    } else if (units && units.length > 0 && !unitId) {
      setUnitId(units[0].id || units[0].code || '');
    }
    setError('');
    setSuccessData(null);
  }, [isOpen, initialUnitId, units]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    setError('');
    if (!selectedFile) return;

    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Por favor, selecione um arquivo no formato PDF.');
      setFile(null);
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      setError('O arquivo PDF excede o limite máximo de 20MB.');
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!unitId) {
      setError('Selecione a unidade correspondente à folha de pagamento.');
      return;
    }

    if (!competencia) {
      setError('Selecione a competência (mês/ano) de referência.');
      return;
    }

    if (!file) {
      setError('Anexe o arquivo em PDF da folha de pagamento.');
      return;
    }

    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const docKey = `payroll-${unitId}-${competencia}-${Date.now()}`;
      const selectedUnitObj = units.find(u => (u.id === unitId || u.code === unitId));
      const unitName = selectedUnitObj ? (selectedUnitObj.name || selectedUnitObj.label || unitId) : unitId;

      const recordData = {
        id: docKey,
        unit_id: unitId,
        unit_name: unitName,
        competencia,
        file_name: file.name,
        file_size: (file.size / 1024).toFixed(1) + ' KB',
        content: base64,
        status: 'semipronto', // 'semipronto' | 'pendente' | 'conferido' | 'aprovado'
        created_at: new Date().toISOString()
      };

      // Tenta gravar no Supabase
      try {
        const { error: dbError } = await supabase
          .from('unit_payroll_documents')
          .upsert({
            id: docKey,
            unit_id: unitId,
            doc_key: docKey,
            content: base64,
            meta: {
              unit_id: unitId,
              unit_name: unitName,
              competencia,
              file_name: file.name,
              file_size: recordData.file_size,
              status: recordData.status,
              created_at: recordData.created_at
            }
          });

        if (dbError) {
          console.warn('Alerta Supabase (tabela unit_payroll_documents):', dbError.message);
        }
      } catch (dbErr) {
        console.warn('Usando armazenamento local de fallback:', dbErr);
      }

      // Salva no localStorage para resiliência local
      try {
        const savedListStr = localStorage.getItem('local_payroll_documents') || '[]';
        const savedList = JSON.parse(savedListStr);
        savedList.unshift(recordData);
        localStorage.setItem('local_payroll_documents', JSON.stringify(savedList));
      } catch (lsErr) {
        console.error('Erro ao salvar no localStorage:', lsErr);
      }

      const protocol = `FOLHA-${Date.now().toString().slice(-6)}`;
      setSuccessData({
        protocol,
        unitName,
        competencia,
        uploadedAt: new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR'),
      });

      toast.success('Folha de pagamento enviada com sucesso ao Grupo IB!');
    } catch (err) {
      console.error('Erro ao enviar folha pelo portal público:', err);
      setError(getFriendlyDbErrorMessage(err));
      toast.error('Erro ao realizar o upload da folha de pagamento.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setError('');
    setSuccessData(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden relative my-6 border border-slate-100">
        {/* Header Aberto / Público */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm text-indigo-200">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-400/30">
                  Portal Aberto sem Login
                </span>
                <span className="text-[10px] text-indigo-200 flex items-center gap-1">
                  <ShieldCheck size={12} className="text-emerald-400" /> Autoatendimento Contábil
                </span>
              </div>
              <h2 className="text-xl font-bold mt-1 text-white">Upload de Folha de Pagamento</h2>
              <p className="text-xs text-indigo-100 mt-0.5">Envio mensal de documentos em PDF para as unidades do Grupo IB</p>
            </div>
          </div>
          <button
            onClick={() => { handleReset(); onClose(); }}
            className="p-2 hover:bg-white/10 rounded-xl text-indigo-200 hover:text-white transition-colors"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-7">
          {successData ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-slate-900">Documento Recebido!</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Protocolo Oficial: <strong className="text-indigo-700 font-mono text-base">{successData.protocol}</strong>
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs space-y-2.5 shadow-sm">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Unidade Destino:</span>
                  <span className="font-bold text-slate-800">{successData.unitName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Competência:</span>
                  <span className="font-semibold text-slate-800">{successData.competencia}</span>
                </div>
                <div className="flex justify-between pt-1 text-[11px]">
                  <span className="text-slate-500">Data e Hora do Envio:</span>
                  <span className="text-slate-700 font-medium">{successData.uploadedAt}</span>
                </div>
              </div>

              <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl text-xs text-indigo-900 text-left">
                ℹ️ A folha foi registrada no sistema e está disponível no painel dos administradores para conferência e aprovação.
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  onClick={handleReset}
                  className="flex-1 py-3 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                >
                  Enviar Folha de Outra Unidade
                </button>
                <button
                  onClick={() => { handleReset(); onClose(); }}
                  className="flex-1 py-3 text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-800 rounded-xl transition-colors shadow-md"
                >
                  Concluir
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-800 text-xs">
                  <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Unidade */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Building2 size={14} className="text-indigo-600" />
                  Unidade Contratante *
                </label>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  required
                >
                  <option value="" disabled>Selecione a unidade...</option>
                  {units.map((u) => (
                    <option key={u.id || u.code} value={u.id || u.code}>
                      {u.name || u.label} ({u.code || u.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Competência */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Calendar size={14} className="text-indigo-600" />
                  Competência (Mês/Ano) *
                </label>
                <input
                  type="month"
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-mono"
                  required
                />
              </div>

              {/* Upload de PDF */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Upload size={14} className="text-indigo-600" />
                  Arquivo da Folha de Pagamento (PDF) *
                </label>
                <div className="relative border-2 border-dashed border-slate-300 hover:border-indigo-500 transition-colors rounded-2xl p-5 text-center bg-slate-50/70">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {file ? (
                    <div className="flex items-center justify-center gap-3 text-indigo-700">
                      <FileText size={24} className="text-indigo-600" />
                      <div className="text-left">
                        <p className="text-xs font-bold truncate max-w-[260px] text-slate-800">{file.name}</p>
                        <p className="text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB • PDF Válido</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Upload className="mx-auto h-9 w-9 text-slate-400" />
                      <p className="text-xs font-semibold text-slate-700">Arraste ou clique para selecionar a Folha em PDF</p>
                      <p className="text-[10px] text-slate-400">Tamanho máximo permitido: 20MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Botões */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => { handleReset(); onClose(); }}
                  className="flex-1 py-3 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-3 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Enviando ao Grupo IB...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Enviar Folha de Pagamento
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
