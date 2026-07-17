import React, { useState, useEffect, useCallback } from 'react';
import { FileText, AlertTriangle, Check, Eye, Trash, Upload, Loader2, X, Download } from 'lucide-react';
import { supabase } from '../../supabase';
import { mapInternFromDb, mapUnitFromDb, fileToBase64 } from '../../utils/mappings';
import { formatDate } from '../../utils/helpers';

export default function DossieTab({ filterUnit }) {
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);

  // States
  const [selectedAdmissionalIntern, setSelectedAdmissionalIntern] = useState('');
  const [uploadDocType, setUploadDocType] = useState('tce');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Modal State
  const [viewDocBase64, setViewDocBase64] = useState(null);
  const [viewDocName, setViewDocName] = useState('');
  const [viewDocType, setViewDocType] = useState('');

  const ADMISSIONAL_DOCUMENTS = [
    { key: 'tce', label: 'Termo de Compromisso (TCE)', desc: 'Contrato de estágio assinado de 3 vias.' },
    { key: 'pae', label: 'Plano de Atividades (PAE)', desc: 'Plano detalhado de atividades do estágio.' },
    { key: 'matricula', label: 'Comprovante de Matrícula', desc: 'Comprovante atualizado do semestre letivo.' },
    { key: 'documentos', label: 'RG e CPF', desc: 'Documentos de identidade civil do estagiário.' },
    { key: 'seguro', label: 'Apólice de Seguro', desc: 'Seguro de acidentes pessoais obrigatório por lei.' },
    { key: 'ficha', label: 'Ficha Cadastral', desc: 'Ficha com dados bancários e contatos preenchida.' },
  ];

  const fetchData = useCallback(async () => {
    try {
      const { data: internsData } = await supabase
        .from('interns')
        .select('*')
        .order('name', { ascending: true });

      if (internsData) setInterns(internsData.map(mapInternFromDb));
    } catch (err) {
      console.error('Erro ao buscar dados do dossiê:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const internsChannel = supabase
      .channel('dossie-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interns' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(internsChannel);
    };
  }, [fetchData]);

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
      
      const updatedDocs = {
        ...currentDocs,
        [uploadDocType]: {
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          uploadedAt: new Date().toISOString()
        }
      };

      const { error } = await supabase
        .from('interns')
        .update({ documents: updatedDocs })
        .eq('id', intern.id);
      if (error) throw error;

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
      fetchData();
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

      const { error } = await supabase
        .from('interns')
        .update({ documents: currentDocs })
        .eq('id', intern.id);
      if (error) throw error;

      const { error: contentError } = await supabase
        .from('document_contents')
        .delete()
        .eq('intern_id', intern.id)
        .eq('doc_key', docKey);
      if (contentError) throw contentError;

      alert('Documento removido com sucesso!');
      fetchData();
    } catch (err) {
      console.error("Erro ao deletar documento:", err);
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

  const selectedInternData = interns.find(i => i.id === selectedAdmissionalIntern);
  const documentsMap = selectedInternData?.documents || {};
  const uploadedDocsCount = Object.keys(documentsMap).filter(key => !key.startsWith('ocorrencia_')).length;
  const progressPercent = Math.round((uploadedDocsCount / ADMISSIONAL_DOCUMENTS.length) * 100);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
                                onClick={() => handleViewDocumentContent(selectedAdmissionalIntern, doc.key, fileInfo.name, doc.label)}
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

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 h-fit">
              <h3 className="font-semibold text-slate-700 flex items-center gap-1 text-xs">
                <Upload size={14} className="text-blue-500" /> Anexar Novo Documento
              </h3>

              <form onSubmit={handleUploadDocument} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Tipo do Documento</label>
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

      {/* Document View Modal */}
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
    </div>
  );
}
