import React, { useState, useEffect } from 'react';
import { Upload, X, FileText, CheckCircle2, Loader2, DollarSign, Calendar, User, Hash, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';
import { mapProfessionalFromDb, PROFESSIONAL_SELECT_FIELDS, fileToBase64, getFriendlyDbErrorMessage } from '../utils/mappings';
import { toast } from 'sonner';

export default function NfseUploadModal({ isOpen, onClose, branding, initialUnitId = '', initialProfessionalId = '' }) {
  const [professionals, setProfessionals] = useState([]);
  const [loadingProfs, setLoadingProfs] = useState(true);

  const [selectedId, setSelectedId] = useState(initialProfessionalId || '');
  const [competencia, setCompetencia] = useState(() => new Date().toISOString().substring(0, 7));
  const [numeroNf, setNumeroNf] = useState('');
  const [valor, setValor] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialProfessionalId) {
      setSelectedId(initialProfessionalId);
    } else {
      setSelectedId('');
    }

    const fetchProfessionals = async () => {
      setLoadingProfs(true);
      try {
        let query = supabase
          .from('professionals')
          .select(PROFESSIONAL_SELECT_FIELDS)
          .eq('active', true)
          .order('name', { ascending: true });

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        let list = (data || []).map(mapProfessionalFromDb);
        if (initialUnitId) {
          list = list.filter(p => p.unitId === initialUnitId);
        }
        setProfessionals(list);
      } catch (err) {
        console.error('Erro ao carregar prestadores para envio de NFSe:', err);
        toast.error('Erro ao carregar lista de prestadores.');
      } finally {
        setLoadingProfs(false);
      }
    };

    fetchProfessionals();
    setError('');
    setSuccessData(null);
  }, [isOpen, initialUnitId, initialProfessionalId]);

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

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('O arquivo PDF excede o limite máximo de 5MB.');
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleFormatValor = (e) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setValor('');
      return;
    }
    const numeric = (parseInt(raw, 10) / 100).toFixed(2);
    setValor(numeric.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
  };

  const parseValorNumeric = (valStr) => {
    if (!valStr) return 0;
    const cleaned = valStr.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedId) {
      setError('Selecione seu nome na lista de prestadores.');
      return;
    }

    if (!competencia) {
      setError('Selecione a competência (mês/ano) de referência.');
      return;
    }

    const valorNum = parseValorNumeric(valor);
    if (!valorNum || valorNum <= 0) {
      setError('Informe o valor total da NFSe (maior que zero).');
      return;
    }

    if (!file) {
      setError('Anexe o arquivo em PDF da NFSe.');
      return;
    }

    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const docKey = `nf-${competencia}-${Date.now()}`;
      const selectedProfessional = professionals.find(p => p.id === selectedId);

      const meta = {
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: 'nf',
        competencia,
        numeroNf: numeroNf.trim() || null,
        valor: valorNum,
        unitId: selectedProfessional?.unitId || initialUnitId || null,
        uploadedAt: new Date().toISOString(),
        status: 'pendente', // 'pendente' | 'aprovado' | 'rejeitado'
      };

      const { error: dbError } = await supabase
        .from('professional_documents')
        .upsert({
          professional_id: selectedId,
          doc_key: docKey,
          content: base64,
          meta,
        });

      if (dbError) throw dbError;

      const protocol = `NFSE-${Date.now().toString().slice(-6)}`;
      setSuccessData({
        protocol,
        professionalName: selectedProfessional?.name || '',
        competencia,
        valorFormatted: valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        uploadedAt: new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR'),
      });
      toast.success('NFSe enviada com sucesso para validação do financeiro!');
    } catch (err) {
      console.error('Erro ao enviar NFSe:', err);
      setError(getFriendlyDbErrorMessage(err));
      toast.error('Erro ao realizar o upload da NFSe.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedId('');
    setNumeroNf('');
    setValor('');
    setFile(null);
    setError('');
    setSuccessData(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative my-8">
        {/* Header */}
        <div className="bg-teal-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-teal-200" />
            <div>
              <h2 className="text-lg font-bold">Enviar NFSe (Prestador PJ)</h2>
              <p className="text-xs text-teal-100">Comprovação de serviços prestados para pagamento</p>
            </div>
          </div>
          <button
            onClick={() => { handleReset(); onClose(); }}
            className="p-1.5 hover:bg-teal-800 rounded-lg text-teal-100 transition-colors"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {successData ? (
            <div className="py-6 text-center space-y-4 animate-fade-in">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
              <div>
                <h3 className="text-xl font-bold text-gray-800">NFSe Enviada com Sucesso!</h3>
                <p className="text-xs text-gray-500 mt-1">Sua nota fiscal foi recebida e está pendente de validação pelo financeiro.</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs space-y-2 text-slate-700">
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500">Protocolo:</span>
                  <span className="font-mono font-bold text-teal-700">{successData.protocol}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500">Prestador:</span>
                  <span className="font-semibold text-slate-800">{successData.professionalName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500">Competência:</span>
                  <span className="font-semibold">{successData.competencia}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500">Valor Declarado:</span>
                  <span className="font-bold text-emerald-700">{successData.valorFormatted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Data de Envio:</span>
                  <span>{successData.uploadedAt}</span>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
                >
                  Enviar Outra NFSe
                </button>
                <button
                  type="button"
                  onClick={() => { handleReset(); onClose(); }}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-xs transition-colors"
                >
                  Concluir
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Prestador */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                  <User size={14} className="text-teal-600" /> Selecione seu Nome (Prestador PJ) *
                </label>
                {loadingProfs ? (
                  <div className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-lg text-xs text-gray-400 bg-gray-50">
                    <Loader2 size={14} className="animate-spin text-teal-600" /> Carregando lista de prestadores...
                  </div>
                ) : (
                  <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    required
                  >
                    <option value="">Selecione seu nome na lista...</option>
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.cnpj ? `(CNPJ: ${p.cnpj})` : p.cpf ? `(CPF: ${p.cpf})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Competência e Número da Nota */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Calendar size={14} className="text-teal-600" /> Competência (Mês/Ano) *
                  </label>
                  <input
                    type="month"
                    value={competencia}
                    onChange={(e) => setCompetencia(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Hash size={14} className="text-teal-600" /> Nº da NFSe (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 2026-0012"
                    value={numeroNf}
                    onChange={(e) => setNumeroNf(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Valor da NFSe */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-teal-600" /> Valor Total da NFSe (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-semibold">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={valor}
                    onChange={handleFormatValor}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-xs bg-white font-semibold text-gray-800 focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>

              {/* Upload do PDF */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                  <Upload size={14} className="text-teal-600" /> Arquivo da NFSe em PDF *
                </label>
                <div className="border-2 border-dashed border-gray-300 hover:border-teal-500 rounded-xl p-4 text-center bg-gray-50 hover:bg-teal-50/50 transition-colors cursor-pointer relative">
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {file ? (
                    <div className="flex items-center justify-center gap-2 text-teal-800 text-xs font-medium">
                      <FileText className="w-5 h-5 text-teal-600" />
                      <span className="truncate max-w-[240px] font-semibold">{file.name}</span>
                      <span className="text-[10px] text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-6 h-6 text-gray-400 mx-auto" />
                      <p className="text-xs text-gray-600 font-medium">Clique para selecionar ou arraste o arquivo PDF aqui</p>
                      <p className="text-[10px] text-gray-400">Formatos aceitos: <strong>PDF</strong> (máx. 5MB)</p>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2 animate-fade-in">
                  <AlertCircle size={16} className="shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { handleReset(); onClose(); }}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg text-xs hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Enviando NFSe...
                    </>
                  ) : (
                    <>
                      <Upload size={15} /> Confirmar Envio
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
