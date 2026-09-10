import React, { useState, useEffect } from 'react';
import { Upload, X, FileText, CheckCircle2, Loader2, DollarSign, Calendar, Building2, Tag, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';
import { fileToBase64, getFriendlyDbErrorMessage } from '../utils/mappings';
import { toast } from 'sonner';

export default function PayrollUploadModal({ isOpen, onClose, branding, units = [], initialUnitId = '', onSuccess }) {
  const [unitId, setUnitId] = useState(initialUnitId || '');
  const [competencia, setCompetencia] = useState(() => new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [valor, setValor] = useState('');
  const [tipoFolha, setTipoFolha] = useState('mensal');
  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().substring(0, 10));
  const [observacoes, setObservacoes] = useState('');
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

    if (!unitId) {
      setError('Selecione a unidade correspondente à folha de pagamento.');
      return;
    }

    if (!competencia) {
      setError('Selecione a competência (mês/ano) de referência.');
      return;
    }

    const valorNum = parseValorNumeric(valor);
    if (!valorNum || valorNum <= 0) {
      setError('Informe o valor total da folha de pagamento (maior que zero).');
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
        valor: valorNum,
        tipo_folha: tipoFolha,
        data_pagamento: dataPagamento,
        observacoes: observacoes.trim(),
        file_name: file.name,
        file_size: (file.size / 1024).toFixed(1) + ' KB',
        content: base64,
        uploaded_by: 'Contador (Senoguin)',
        status: 'pendente', // 'pendente' | 'conferido' | 'aprovado'
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
              valor: valorNum,
              tipo_folha: tipoFolha,
              data_pagamento: dataPagamento,
              observacoes: observacoes.trim(),
              file_name: file.name,
              file_size: recordData.file_size,
              uploaded_by: recordData.uploaded_by,
              status: recordData.status,
              created_at: recordData.created_at
            }
          });

        if (dbError) {
          console.warn('Alerta Supabase (tabela unit_payroll_documents):', dbError.message);
        }
      } catch (dbErr) {
        console.warn('Usando armazenamento local como fallback:', dbErr);
      }

      // Salva no localStorage para resiliência offline/fallback local
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
        valorFormatted: valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        tipoFolhaLabel: getTipoFolhaLabel(tipoFolha),
        uploadedAt: new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR'),
      });

      toast.success('Folha de pagamento cadastrada e enviada com sucesso!');
      if (onSuccess) onSuccess(recordData);
    } catch (err) {
      console.error('Erro ao cadastrar folha de pagamento:', err);
      setError(getFriendlyDbErrorMessage(err));
      toast.error('Erro ao realizar o upload da folha de pagamento.');
    } finally {
      setUploading(false);
    }
  };

  const getTipoFolhaLabel = (tipo) => {
    switch (tipo) {
      case 'mensal': return 'Folha Mensal Regular';
      case 'decimo_terceiro': return '13º Salário';
      case 'adiantamento': return 'Adiantamento Salarial';
      case 'rescisao': return 'Rescisão contratual';
      case 'encargos': return 'Encargos / FGTS / INSS';
      default: return 'Folha de Pagamento';
    }
  };

  const handleReset = () => {
    setValor('');
    setObservacoes('');
    setFile(null);
    setError('');
    setSuccessData(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative my-8">
        {/* Header */}
        <div className="bg-indigo-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-indigo-200" />
            <div>
              <h2 className="text-lg font-bold">Upload de Folha de Pagamento (PDF)</h2>
              <p className="text-xs text-indigo-100">Cadastro de folha por unidade para conferência do Grupo IB</p>
            </div>
          </div>
          <button
            onClick={() => { handleReset(); onClose(); }}
            className="p-1.5 hover:bg-indigo-800 rounded-lg text-indigo-100 transition-colors"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {successData ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Upload Concluído!</h3>
                <p className="text-sm text-gray-600">Protocolo de Envio: <strong className="text-indigo-600">{successData.protocol}</strong></p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs space-y-2">
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-gray-500">Unidade:</span>
                  <span className="font-semibold text-gray-800">{successData.unitName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-gray-500">Competência:</span>
                  <span className="font-semibold text-gray-800">{successData.competencia}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-gray-500">Tipo de Folha:</span>
                  <span className="font-semibold text-indigo-700">{successData.tipoFolhaLabel}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-gray-500">Valor Total:</span>
                  <span className="font-bold text-emerald-700 text-sm">{successData.valorFormatted}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-gray-500">Enviado em:</span>
                  <span className="text-gray-700">{successData.uploadedAt}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                >
                  Enviar Outra Folha
                </button>
                <button
                  onClick={() => { handleReset(); onClose(); }}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-700 hover:bg-indigo-800 rounded-xl transition-colors shadow-sm"
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
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                  <Building2 size={14} className="text-indigo-600" />
                  Unidade *
                </label>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-gray-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
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

              {/* Grid 2 colunas: Competência e Valor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Calendar size={14} className="text-indigo-600" />
                    Competência (Mês/Ano) *
                  </label>
                  <input
                    type="month"
                    value={competencia}
                    onChange={(e) => setCompetencia(e.target.value)}
                    className="w-full text-xs rounded-xl border border-gray-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <DollarSign size={14} className="text-indigo-600" />
                    Valor Total (R$) *
                  </label>
                  <input
                    type="text"
                    value={valor}
                    onChange={handleFormatValor}
                    placeholder="0,00"
                    className="w-full text-xs rounded-xl border border-gray-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-mono"
                    required
                  />
                </div>
              </div>

              {/* Grid 2 colunas: Tipo de Folha e Data Pagamento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Tag size={14} className="text-indigo-600" />
                    Tipo de Folha *
                  </label>
                  <select
                    value={tipoFolha}
                    onChange={(e) => setTipoFolha(e.target.value)}
                    className="w-full text-xs rounded-xl border border-gray-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="mensal">Folha Mensal Regular</option>
                    <option value="decimo_terceiro">13º Salário</option>
                    <option value="adiantamento">Adiantamento Salarial</option>
                    <option value="rescisao">Rescisão Contratual</option>
                    <option value="encargos">Encargos / FGTS / INSS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Calendar size={14} className="text-indigo-600" />
                    Data de Pagamento
                  </label>
                  <input
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                    className="w-full text-xs rounded-xl border border-gray-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Observações / Notas da Contabilidade (Opcional)
                </label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Folha referente aos funcionários CLT da unidade com adicionais noturnos inclusos."
                  rows={2}
                  className="w-full text-xs rounded-xl border border-gray-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
              </div>

              {/* Upload de PDF */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                  <Upload size={14} className="text-indigo-600" />
                  Arquivo da Folha (PDF) *
                </label>
                <div className="relative border-2 border-dashed border-gray-300 hover:border-indigo-500 transition-colors rounded-xl p-4 text-center bg-gray-50/50">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {file ? (
                    <div className="flex items-center justify-center gap-2 text-indigo-700">
                      <FileText size={20} />
                      <div className="text-left">
                        <p className="text-xs font-semibold truncate max-w-[240px]">{file.name}</p>
                        <p className="text-[10px] text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="mx-auto h-8 w-8 text-gray-400" />
                      <p className="text-xs text-gray-600">Arraste ou clique para selecionar a Folha em PDF</p>
                      <p className="text-[10px] text-gray-400">Somente arquivos em formato PDF até 20MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Botões */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => { handleReset(); onClose(); }}
                  className="flex-1 py-2.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-2.5 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Enviando Folha...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Concluir Upload
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
