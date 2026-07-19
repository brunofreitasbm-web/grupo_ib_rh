import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Save, FileText, Printer, Upload, Eye, Trash, Loader2, X, Download } from 'lucide-react';
import { supabase } from '../../supabase';
import { mapInternFromDb, fileToBase64 } from '../../utils/mappings';

export default function EncerramentoTab({ filterUnit, onPrintDocument }) {
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);

  // States
  const [selectedTerminationIntern, setSelectedTerminationIntern] = useState('');
  const [terminationMotive, setTerminationMotive] = useState('Desligamento (conforme Lei)');
  const [terminationDate, setTerminationDate] = useState(new Date().toISOString().split('T')[0]);
  const [uploadingTerminationLetter, setUploadingTerminationLetter] = useState(false);

  // Modal State
  const [viewDocBase64, setViewDocBase64] = useState(null);
  const [viewDocName, setViewDocName] = useState('');
  const [viewDocType, setViewDocType] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const { data: internsData } = await supabase
        .from('interns')
        .select('*')
        .order('name', { ascending: true });

      if (internsData) setInterns(internsData.map(mapInternFromDb));
    } catch (err) {
      console.error('Erro ao buscar estagiários para encerramento:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const internsChannel = supabase
      .channel('encerramento-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interns' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(internsChannel);
    };
  }, [fetchData]);

  // Sync details when selected intern changes
  useEffect(() => {
    const intern = interns.find(i => i.id === selectedTerminationIntern);
    if (intern && intern.contractTermination) {
      setTerminationMotive(intern.contractTermination.motive || 'Desligamento (conforme Lei)');
      setTerminationDate(intern.contractTermination.date || new Date().toISOString().split('T')[0]);
    } else {
      setTerminationMotive('Desligamento (conforme Lei)');
      setTerminationDate(new Date().toISOString().split('T')[0]);
    }
  }, [selectedTerminationIntern, interns]);

  const selectedInternData = interns.find(i => i.id === selectedTerminationIntern);
  const contractTermination = selectedInternData?.contractTermination || {};
  const hasSignedLetter = !!contractTermination.signedLetter;

  const handleSaveTermination = async (e) => {
    e.preventDefault();
    if (!selectedInternData) return;
    try {
      const updatedTermination = {
        ...contractTermination,
        motive: terminationMotive,
        date: terminationDate
      };
      const { error } = await supabase
        .from('interns')
        .update({ 
          contract_termination: updatedTermination,
          active: false
        })
        .eq('id', selectedInternData.id);
      if (error) throw error;
      alert('Informações de desligamento salvas com sucesso! Estagiário foi marcado como Inativo.');
      fetchData();
    } catch (err) {
      console.error('Erro ao salvar encerramento de vínculo:', err);
      alert('Erro ao salvar alterações.');
    }
  };

  const handleUploadTerminationLetter = async (e) => {
    e.preventDefault();
    if (!selectedInternData) return;
    const fileInput = document.getElementById('termination-file-input');
    const file = fileInput?.files?.[0];
    if (!file) {
      alert('Por favor, selecione um arquivo.');
      return;
    }
    setUploadingTerminationLetter(true);
    try {
      const base64 = await fileToBase64(file);
      const updatedTermination = {
        ...contractTermination,
        motive: terminationMotive,
        date: terminationDate,
        signedLetter: {
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          uploadedAt: new Date().toISOString(),
          content: base64
        }
      };

      const { error } = await supabase
        .from('interns')
        .update({ 
          contract_termination: updatedTermination,
          active: false
        })
        .eq('id', selectedInternData.id);
      if (error) throw error;
      if (fileInput) fileInput.value = '';
      alert('Carta de encerramento de vínculo assinada anexada com sucesso! Estagiário foi marcado como Inativo.');
      fetchData();
    } catch (err) {
      console.error("Erro no upload da carta de encerramento de vínculo:", err);
      alert('Erro ao enviar documento.');
    } finally {
      setUploadingTerminationLetter(false);
    }
  };

  const handleDeleteTerminationLetter = async () => {
    if (!selectedInternData) return;
    const ok = window.confirm('Deseja realmente excluir a carta de encerramento de vínculo assinada arquivada?');
    if (!ok) return;

    try {
      const updatedTermination = { ...contractTermination };
      delete updatedTermination.signedLetter;

      const { error } = await supabase
        .from('interns')
        .update({ contract_termination: updatedTermination })
        .eq('id', selectedInternData.id);
      if (error) throw error;
      alert('Documento excluído com sucesso!');
      fetchData();
    } catch (err) {
      console.error("Erro ao deletar documento de encerramento de vínculo:", err);
      alert('Erro ao excluir documento.');
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
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <Lock size={20} className="text-blue-600" /> Encerramento de Vínculo & Desligamento
        </h2>
        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
          Rescisão & Legislação
        </span>
      </div>

      <div className="p-4 space-y-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Selecione o Estagiário</label>
          <select
            value={selectedTerminationIntern}
            onChange={(e) => setSelectedTerminationIntern(e.target.value)}
            className="w-full md:w-1/2 p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
          >
            <option value="">Selecione um estagiário...</option>
            {interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit).map(i => (
              <option key={i.id} value={i.id}>{i.name} ({i.active !== false ? 'Ativo' : 'Inativo'})</option>
            ))}
          </select>
        </div>

        {selectedInternData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                Dados de Rescisão / Encerramento
              </h3>
              <form onSubmit={handleSaveTermination} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Motivo do Desligamento</label>
                  <select
                    value={terminationMotive}
                    onChange={(e) => setTerminationMotive(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Desligamento (conforme Lei)">Desligamento (conforme Lei)</option>
                    <option value="Pedido Próprio">Pedido Próprio</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Data Efetiva de Encerramento</label>
                  <input
                    type="date"
                    value={terminationDate}
                    onChange={(e) => setTerminationDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow"
                >
                  <Save size={14} /> Salvar Parâmetros
                </button>
              </form>
            </div>

            <div className="space-y-4">
              
              {terminationMotive === 'Pedido Próprio' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-semibold text-blue-900 text-xs flex items-center gap-1.5">
                    <FileText size={16} className="text-blue-600" /> Carta de Resignação de Estágio
                  </h4>
                  <p className="text-[11px] text-blue-700 leading-normal">
                    Gere a minuta da Carta de Encerramento de Vínculo preenchida automaticamente com os dados acadêmicos e do termo de compromisso para que o estagiário assine.
                  </p>
                  <button
                    type="button"
                    onClick={() => onPrintDocument('carta_desligamento', selectedInternData)}
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition-colors"
                  >
                    <Printer size={13} /> Imprimir Minuta
                  </button>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-slate-800 text-xs">Upload da Carta Assinada / Documento de Encerramento</h4>
                {hasSignedLetter ? (
                  <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs flex items-center justify-between shadow-sm">
                    <div className="truncate pr-2">
                      <span className="text-green-700 font-semibold block">✓ Arquivado com sucesso</span>
                      <span className="text-[10px] text-gray-400 block truncate" title={contractTermination.signedLetter.name}>
                        {contractTermination.signedLetter.name} ({contractTermination.signedLetter.size})
                      </span>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setViewDocBase64(contractTermination.signedLetter.content);
                          setViewDocName(contractTermination.signedLetter.name);
                          setViewDocType('Carta de Encerramento de Vínculo Assinada');
                        }}
                        className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded"
                        title="Visualizar documento"
                      >
                        <Eye size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteTerminationLetter}
                        className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded"
                        title="Excluir"
                      >
                        <Trash size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUploadTerminationLetter} className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Selecionar Imagem ou PDF</label>
                      <input
                        id="termination-file-input"
                        type="file"
                        required
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="w-full text-xs p-1.5 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={uploadingTerminationLetter}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1 shadow"
                    >
                      {uploadingTerminationLetter ? (
                        <><Loader2 size={12} className="animate-spin" /> Carregando...</>
                      ) : (
                        <><Upload size={12} /> Fazer Arquivamento</>
                      )}
                    </button>
                  </form>
                )}
              </div>

            </div>

          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-8 border border-slate-100 text-center text-slate-400 text-sm">
            <Lock size={40} className="mx-auto text-slate-300 mb-2" />
            Selecione um estagiário acima para exibir o painel de encerramento de vínculo.
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
