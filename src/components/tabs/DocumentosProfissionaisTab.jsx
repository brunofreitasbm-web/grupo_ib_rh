import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Eye, Trash, Upload, Loader2, X, Download, Plus, ScrollText, Printer, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../../supabase';
import { mapProfessionalFromDb, PROFESSIONAL_SELECT_FIELDS, fileToBase64, getFriendlyDbErrorMessage } from '../../utils/mappings';
import { getProfessionalContractHtml, getMissingContractFields } from '../../utils/professionalContract';
import { toast } from 'sonner';

import NfseUploadModal from '../NfseUploadModal';

// Documentos de Profissionais PJ: contrato de prestação de serviços, dados de
// CNPJ/conselho e Notas Fiscais por competência. Tabela própria
// (professional_documents), independente de document_contents (estagiários).
const FIXED_DOC_TYPES = [
  { key: 'contrato', label: 'Contrato de Prestação de Serviços' },
  { key: 'cnpj', label: 'Comprovante de CNPJ' },
  { key: 'conselho', label: 'Registro no Conselho Profissional' },
];

export default function DocumentosProfissionaisTab({ filterUnit, restrictedUnitIds = [], units = [], branding }) {
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [docs, setDocs] = useState([]); // [{doc_key, meta, created_at}]
  const [uploading, setUploading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('contrato');
  const [nfMonth, setNfMonth] = useState(new Date().toISOString().substring(0, 7));
  const [nfNumero, setNfNumero] = useState('');
  const [nfValor, setNfValor] = useState('');
  const [showNfseModal, setShowNfseModal] = useState(false);

  const [viewDoc, setViewDoc] = useState(null); // { base64, name, type }
  const [contractPreview, setContractPreview] = useState(null); // { html } | null
  const [savingContract, setSavingContract] = useState(false);

  const fetchProfessionals = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('professionals').select(PROFESSIONAL_SELECT_FIELDS).order('name');
      if (error) throw error;
      setProfessionals((data || []).map(mapProfessionalFromDb).filter((p) => !restrictedUnitIds.includes(p.unitId)));
    } catch (err) {
      console.error('Erro ao carregar prestadores:', err);
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds]);

  const fetchDocs = useCallback(async (professionalId) => {
    if (!professionalId) { setDocs([]); return; }
    try {
      const { data, error } = await supabase
        .from('professional_documents')
        .select('doc_key, meta, created_at')
        .eq('professional_id', professionalId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocs(data || []);
    } catch (err) {
      console.error('Erro ao carregar documentos do prestador:', err);
    }
  }, []);

  useEffect(() => { fetchProfessionals(); }, [fetchProfessionals]);
  useEffect(() => { fetchDocs(selectedId); }, [selectedId, fetchDocs]);

  const filteredProfessionals = professionals.filter((p) => filterUnit === 'all' || p.unitId === filterUnit);

  const nfDocKey = `nf-${nfMonth}`;
  const isNf = uploadDocType === 'nf';
  const docKeyToSave = isNf ? nfDocKey : uploadDocType;

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedId) return;
    const fileInput = document.getElementById('pj-doc-file-input');
    const file = fileInput?.files?.[0];
    if (!file) { toast.error('Selecione um arquivo.'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Arquivo excede 2MB.'); return; }

    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const meta = {
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: isNf ? 'nf' : uploadDocType,
        competencia: isNf ? nfMonth : null,
        numeroNf: isNf ? (nfNumero || null) : null,
        valor: isNf ? (nfValor || null) : null,
        uploadedAt: new Date().toISOString(),
      };
      const { error } = await supabase.from('professional_documents').upsert({
        professional_id: selectedId,
        doc_key: docKeyToSave,
        content: base64,
        meta,
      });
      if (error) throw error;
      toast.success('Documento salvo com sucesso.');
      if (fileInput) fileInput.value = '';
      setNfNumero(''); setNfValor('');
      fetchDocs(selectedId);
    } catch (err) {
      console.error('Erro ao enviar documento PJ:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (docKey, meta) => {
    try {
      const { data, error } = await supabase
        .from('professional_documents')
        .select('content')
        .eq('professional_id', selectedId)
        .eq('doc_key', docKey)
        .single();
      if (error || !data) throw new Error('Não foi possível obter o conteúdo do documento.');
      setViewDoc({ base64: data.content, name: meta?.name || docKey, type: meta?.type || 'Documento' });
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    }
  };

  const handleDelete = async (docKey) => {
    if (!window.confirm('Remover este documento?')) return;
    try {
      const { error } = await supabase.from('professional_documents').delete().eq('professional_id', selectedId).eq('doc_key', docKey);
      if (error) throw error;
      toast.success('Documento removido.');
      fetchDocs(selectedId);
    } catch (err) {
      console.error(err);
      toast.error(getFriendlyDbErrorMessage(err));
    }
  };

  const handleApproveNf = async (docKey, meta) => {
    if (!selectedId) return;
    const valorFormatted = meta?.valor ? Number(meta.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
    if (!window.confirm(`Aprovar a NFSe de competência ${meta?.competencia || ''} (Valor: ${valorFormatted})? O valor será liberado para o repasse.`)) return;

    try {
      const updatedMeta = {
        ...meta,
        status: 'aprovado',
        validatedAt: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('professional_documents')
        .update({ meta: updatedMeta })
        .eq('professional_id', selectedId)
        .eq('doc_key', docKey);

      if (error) throw error;
      toast.success('NFSe APROVADA com sucesso! Valor liberado para o repasse.');
      fetchDocs(selectedId);
    } catch (err) {
      console.error('Erro ao aprovar NFSe:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    }
  };

  const handleRejectNf = async (docKey, meta) => {
    if (!selectedId) return;
    const reason = window.prompt('Informe a justificativa/motivo para a rejeição da NFSe:');
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error('A justificativa de rejeição é obrigatória.');
      return;
    }

    try {
      const updatedMeta = {
        ...meta,
        status: 'rejeitado',
        rejectionReason: reason.trim(),
        validatedAt: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('professional_documents')
        .update({ meta: updatedMeta })
        .eq('professional_id', selectedId)
        .eq('doc_key', docKey);

      if (error) throw error;
      toast.error(`NFSe REJEITADA. Motivo: ${reason}`);
      fetchDocs(selectedId);
    } catch (err) {
      console.error('Erro ao rejeitar NFSe:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    }
  };

  const docLabel = (docKey, meta) => {
    const fixed = FIXED_DOC_TYPES.find((d) => d.key === docKey);
    if (fixed) return fixed.label;
    if (docKey.startsWith('nf-')) return `Nota Fiscal — ${meta?.competencia || docKey.replace('nf-', '')}`;
    return docKey;
  };

  const selectedProfessional = professionals.find((p) => p.id === selectedId) || null;

  // Emissão do contrato pré-pronto (ver ./utils/professionalContract). Só
  // habilitado para cadastro já validado pelo RH e sem pendências de campo —
  // evita gerar um documento com lacunas.
  const handleEmitContract = () => {
    if (!selectedProfessional) return;
    if (selectedProfessional.registrationStatus && selectedProfessional.registrationStatus !== 'validated') {
      toast.error('Este cadastro ainda não foi validado. Valide o cadastro em Profissionais PJ antes de emitir o contrato.');
      return;
    }
    const missing = getMissingContractFields(selectedProfessional);
    if (missing.length > 0) {
      toast.error(`Complete os dados antes de emitir o contrato: ${missing.join(', ')}.`);
      return;
    }
    const unit = units.find((u) => u.id === selectedProfessional.unitId) || null;
    const html = getProfessionalContractHtml(selectedProfessional, unit, branding);
    setContractPreview({ html });
  };

  const handlePrintContract = () => {
    if (!contractPreview) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.'); return; }
    printWindow.document.write(`<html><head><title>Contrato de Prestação de Serviços</title></head><body>${contractPreview.html}</body></html>`);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => printWindow.close(), 500);
    };
  };

  // Arquiva a minuta emitida em professional_documents (doc_key 'contrato'),
  // para histórico — mesma tabela usada pelo upload manual do RH.
  const handleSaveContractToDossie = async () => {
    if (!contractPreview || !selectedId) return;
    setSavingContract(true);
    try {
      const { error } = await supabase.from('professional_documents').upsert({
        professional_id: selectedId,
        doc_key: 'contrato',
        content: `data:text/html;charset=utf-8;base64,${btoa(unescape(encodeURIComponent(contractPreview.html)))}`,
        meta: { name: 'Contrato de Prestação de Serviços.html', type: 'contrato', emitidoEm: new Date().toISOString() },
      });
      if (error) throw error;
      toast.success('Minuta arquivada no dossiê do prestador.');
      fetchDocs(selectedId);
    } catch (err) {
      console.error('Erro ao arquivar contrato:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setSavingContract(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  const getUnitName = (unitId) => {
    const found = units.find((u) => u.id === unitId);
    return found ? found.name : 'Unidade não identificada';
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <FileText size={20} className="text-teal-600" /> Contratos &amp; Notas Fiscais (NFSe)
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNfseModal(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors shadow-sm"
          >
            <Upload size={14} /> Enviar NFSe (PDF)
          </button>
          {selectedId && (
            <button
              onClick={handleEmitContract}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-3 rounded-lg text-xs"
            >
              <ScrollText size={14} /> Emitir Contrato
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Selecione o Prestador PJ</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-xs font-medium text-slate-800"
          >
            <option value="">Selecione um prestador...</option>
            {filteredProfessionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} • [{getUnitName(p.unitId)}] {p.active === false ? '(Inativo)' : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedId ? (
          <div>
            {selectedProfessional && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">{selectedProfessional.name}</span>
                <span className="bg-teal-100 text-teal-800 font-semibold px-2.5 py-0.5 rounded-full text-[10px]">
                  Unidade: {getUnitName(selectedProfessional.unitId)}
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 overflow-x-auto border border-gray-100 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
                    <th className="p-3 font-semibold">Documento</th>
                    <th className="p-3 font-semibold">Arquivo</th>
                    <th className="p-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {docs.length === 0 ? (
                    <tr><td colSpan={3} className="p-6 text-center text-gray-400">Nenhum documento anexado.</td></tr>
                  ) : (
                    docs.map((d) => {
                      const isNfDoc = d.meta?.type === 'nf' || d.doc_key.startsWith('nf-');
                      const status = d.meta?.status || (isNfDoc ? 'pendente' : null);

                      return (
                        <tr key={d.doc_key} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-semibold text-gray-800">
                            <div className="flex items-center gap-2">
                              <span>{docLabel(d.doc_key, d.meta)}</span>
                              {isNfDoc && (
                                status === 'aprovado' ? (
                                  <span className="bg-green-100 text-green-800 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <CheckCircle2 size={10} /> Aprovada
                                  </span>
                                ) : status === 'rejeitado' ? (
                                  <span className="bg-red-100 text-red-800 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" title={d.meta?.rejectionReason || 'Rejeitada'}>
                                    <XCircle size={10} /> Rejeitada
                                  </span>
                                ) : (
                                  <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded-full">
                                    ⏳ Pendente de Validação
                                  </span>
                                )
                              )}
                            </div>
                            {d.meta?.numeroNf && (
                              <span className="block text-[9px] text-gray-400 font-normal">
                                Nº {d.meta.numeroNf} {d.meta?.valor ? `• ${Number(d.meta.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}
                              </span>
                            )}
                            {status === 'rejeitado' && d.meta?.rejectionReason && (
                              <span className="block text-[9px] text-red-600 font-normal italic mt-0.5">
                                Motivo: {d.meta.rejectionReason}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-gray-500">{d.meta?.name} ({d.meta?.size})</td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end items-center gap-1.5">
                              {isNfDoc && (
                                <>
                                  <button
                                    onClick={() => handleApproveNf(d.doc_key, d.meta)}
                                    className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[10px] font-bold flex items-center gap-1"
                                    title="Aprovar NFSe para repasse"
                                  >
                                    <CheckCircle2 size={13} /> Aprovar
                                  </button>
                                  <button
                                    onClick={() => handleRejectNf(d.doc_key, d.meta)}
                                    className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-[10px] font-bold flex items-center gap-1"
                                    title="Rejeitar NFSe"
                                  >
                                    <XCircle size={13} /> Rejeitar
                                  </button>
                                </>
                              )}
                              <button onClick={() => handleView(d.doc_key, d.meta)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded" title="Visualizar">
                                <Eye size={13} />
                              </button>
                              <button onClick={() => handleDelete(d.doc_key)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded" title="Remover">
                                <Trash size={13} />
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

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 h-fit">
              <h3 className="font-semibold text-slate-700 flex items-center gap-1 text-xs">
                <Upload size={14} className="text-teal-600" /> Anexar Documento
              </h3>
              <form onSubmit={handleUpload} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Tipo</label>
                  <select value={uploadDocType} onChange={(e) => setUploadDocType(e.target.value)} className="w-full p-2 border border-gray-300 bg-white rounded-lg text-xs">
                    {FIXED_DOC_TYPES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                    <option value="nf">Nota Fiscal (por competência)</option>
                  </select>
                </div>

                {isNf && (
                  <>
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">Competência</label>
                      <input type="month" value={nfMonth} onChange={(e) => setNfMonth(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1">Nº da NF</label>
                        <input type="text" value={nfNumero} onChange={(e) => setNfNumero(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1">Valor (R$)</label>
                        <input type="text" value={nfValor} onChange={(e) => setNfValor(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-xs" />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Arquivo PDF ou Imagem</label>
                  <input id="pj-doc-file-input" type="file" required accept=".pdf,.png,.jpg,.jpeg" className="w-full text-xs p-1.5 bg-white border border-gray-300 rounded-lg" />
                  <p className="text-[8px] text-gray-400 mt-1">Permitidos: PDF, PNG, JPG de até 2MB.</p>
                </div>

                <button type="submit" disabled={uploading} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-3 rounded-lg text-xs disabled:opacity-50 flex items-center justify-center gap-1">
                  {uploading ? <><Loader2 size={12} className="animate-spin" /> Enviando...</> : <><Plus size={12} /> Salvar</>}
                </button>
              </form>
            </div>
          </div>
        </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-8 border border-slate-100 text-center text-slate-400 text-sm">
            <FileText size={40} className="mx-auto text-slate-300 mb-2" />
            Selecione um prestador acima para gerenciar seus documentos.
          </div>
        )}
      </div>

      {viewDoc && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-2xl relative h-[85vh] flex flex-col">
            <button onClick={() => setViewDoc(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-white rounded-full p-1.5 border border-gray-200">
              <X size={18} />
            </button>
            <h3 className="text-base font-bold text-gray-800 mb-4">{viewDoc.name}</h3>
            <div className="flex-1 w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 mb-4">
              {viewDoc.base64.startsWith('data:application/pdf') ? (
                <iframe src={viewDoc.base64} className="w-full h-full border-none" title={viewDoc.name} />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-2 bg-slate-200">
                  <img src={viewDoc.base64} alt={viewDoc.name} className="max-w-full max-h-full object-contain rounded shadow" />
                </div>
              )}
            </div>
            <a
              href={viewDoc.base64}
              download={viewDoc.name}
              className="self-end bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs inline-flex items-center gap-1"
            >
              <Download size={13} /> Baixar Arquivo
            </a>
          </div>
        </div>
      )}

      {contractPreview && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-3xl relative h-[90vh] flex flex-col">
            <button onClick={() => setContractPreview(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-white rounded-full p-1.5 border border-gray-200">
              <X size={18} />
            </button>
            <h3 className="text-base font-bold text-gray-800 mb-1">Contrato de Prestação de Serviços — Minuta</h3>
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-3">
              Documento gerado automaticamente a partir do cadastro do prestador. Revise com o jurídico antes de qualquer assinatura.
            </p>
            <div className="flex-1 w-full bg-white rounded-xl overflow-y-auto border border-slate-200 mb-4 p-2">
              <div dangerouslySetInnerHTML={{ __html: contractPreview.html }} />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleSaveContractToDossie}
                disabled={savingContract}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-1.5 px-3 rounded-lg text-xs inline-flex items-center gap-1 disabled:opacity-50"
              >
                {savingContract ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Arquivar no Dossiê
              </button>
              <button
                onClick={handlePrintContract}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs inline-flex items-center gap-1"
              >
                <Printer size={13} /> Imprimir / Salvar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <NfseUploadModal
        isOpen={showNfseModal}
        onClose={() => {
          setShowNfseModal(false);
          if (selectedId) fetchDocs(selectedId);
        }}
        branding={branding}
        initialProfessionalId={selectedId}
      />
    </div>
  );
}
