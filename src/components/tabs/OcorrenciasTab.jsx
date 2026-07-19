import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Upload, Calendar, X, FileText, Download, Trash, Eye } from 'lucide-react';
import { supabase } from '../../supabase';
import { mapInternFromDb, mapRecordFromDb, mapRecordToDb, fileToBase64 } from '../../utils/mappings';
import { formatDate } from '../../utils/helpers';

export default function OcorrenciasTab({ filterUnit }) {
  const [interns, setInterns] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedOcorrenciaIntern, setSelectedOcorrenciaIntern] = useState('');
  const [ocorrenciaStartDate, setOcorrenciaStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [ocorrenciaEndDate, setOcorrenciaEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [ocorrenciaType, setOcorrenciaType] = useState('atestado');
  const [ocorrenciaDays, setOcorrenciaDays] = useState(1);
  const [ocorrenciaDesc, setOcorrenciaDesc] = useState('');
  const [ocorrenciaLoading, setOcorrenciaLoading] = useState(false);
  const [ocorrenciaFilterIntern, setOcorrenciaFilterIntern] = useState('all');

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

      const { data: recordsData } = await supabase
        .from('records')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(300);

      if (internsData) setInterns(internsData.map(mapInternFromDb));
      if (recordsData) setRecords(recordsData.map(mapRecordFromDb));
    } catch (err) {
      console.error('Erro ao buscar dados das ocorrências:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const internsChannel = supabase
      .channel('ocorrencias-interns-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interns' }, () => {
        fetchData();
      })
      .subscribe();

    const recordsChannel = supabase
      .channel('ocorrencias-records-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(internsChannel);
      supabase.removeChannel(recordsChannel);
    };
  }, [fetchData]);

  // Handle start and end date calculation for days
  useEffect(() => {
    if (ocorrenciaStartDate && ocorrenciaEndDate) {
      const start = new Date(ocorrenciaStartDate);
      const end = new Date(ocorrenciaEndDate);
      const diffTime = end - start;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      setOcorrenciaDays(isNaN(diffDays) || diffDays < 0 ? 1 : diffDays);
    }
  }, [ocorrenciaStartDate, ocorrenciaEndDate]);

  const handleSaveOcorrencia = async (e) => {
    e.preventDefault();
    if (!selectedOcorrenciaIntern) return alert('Selecione um estagiário.');
    const intern = interns.find(i => i.id === selectedOcorrenciaIntern);
    if (!intern) return alert('Estagiário não encontrado.');
    if (!ocorrenciaDesc.trim()) return alert('Justificativa/Descrição é obrigatória.');

    const docInput = document.getElementById('ocorrencia-file-input');
    const justFile = docInput?.files?.[0];
    let justDoc = null;

    setOcorrenciaLoading(true);
    try {
      if (justFile) {
        if (justFile.size > 2 * 1024 * 1024) {
          alert('O arquivo de comprovante excede o limite de 2MB.');
          setOcorrenciaLoading(false);
          return;
        }
        const base64 = await fileToBase64(justFile);
        justDoc = {
          name: justFile.name,
          size: (justFile.size / 1024).toFixed(1) + ' KB',
          type: ocorrenciaType,
          content: base64,
          uploadedAt: new Date().toISOString()
        };
      }

      const newRecord = {
        internId: intern.id,
        internName: intern.name,
        action: 'ocorrencia',
        justification: ocorrenciaDesc,
        timestamp: new Date(ocorrenciaStartDate + 'T12:00:00').toISOString(),
        photo: null,
        isManual: true,
        justificationDoc: justDoc,
        daysAway: Number(ocorrenciaDays) || 0,
        geo: {
          lat: 0,
          lng: 0,
          accuracy: 0,
          distanceKm: 0,
          distanceM: 0,
          unitId: intern.unitId || '',
          unitName: 'Lançado pela Gestão'
        }
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('records')
        .insert([mapRecordToDb(newRecord)])
        .select();

      if (insertError) throw insertError;

      const recordId = insertedData?.[0]?.id || Math.random().toString(36).substring(2, 9);

      if (justDoc) {
        const justDocMetadata = { ...justDoc };
        delete justDocMetadata.content;

        const currentDocs = intern.documents || {};
        const updatedDocs = {
          ...currentDocs,
          [`ocorrencia_${recordId}`]: {
            ...justDocMetadata,
            occurrenceId: recordId,
            period: `${ocorrenciaStartDate} a ${ocorrenciaEndDate}`,
            daysAway: Number(ocorrenciaDays) || 0,
            desc: ocorrenciaDesc
          }
        };

        const { error: updateError } = await supabase
          .from('interns')
          .update({ documents: updatedDocs })
          .eq('id', intern.id);

        if (updateError) throw updateError;

        const { error: contentError } = await supabase
          .from('document_contents')
          .upsert({
            intern_id: intern.id,
            doc_key: `ocorrencia_${recordId}`,
            content: justDoc.content
          });
        if (contentError) throw contentError;
      }

      alert('Ocorrência registrada com sucesso!');
      setOcorrenciaDesc('');
      if (docInput) docInput.value = '';
      fetchData();
    } catch (err) {
      console.error('Erro ao salvar ocorrência:', err);
      alert('Erro ao registrar ocorrência.');
    } finally {
      setOcorrenciaLoading(false);
    }
  };

  const handleDeleteOcorrencia = async (recordId, internId) => {
    const ok = window.confirm('Deseja realmente remover esta ocorrência?');
    if (!ok) return;

    try {
      const { error: deleteError } = await supabase
        .from('records')
        .delete()
        .eq('id', recordId);

      if (deleteError) throw deleteError;

      const intern = interns.find(i => i.id === internId);
      if (intern && intern.documents && intern.documents[`ocorrencia_${recordId}`]) {
        const currentDocs = { ...intern.documents };
        delete currentDocs[`ocorrencia_${recordId}`];

        const { error: updateError } = await supabase
          .from('interns')
          .update({ documents: currentDocs })
          .eq('id', intern.id);

        if (updateError) throw updateError;

        await supabase
          .from('document_contents')
          .delete()
          .eq('intern_id', intern.id)
          .eq('doc_key', `ocorrencia_${recordId}`);
      }

      alert('Ocorrência removida com sucesso!');
      fetchData();
    } catch (err) {
      console.error('Erro ao deletar ocorrência:', err);
      alert('Erro ao excluir ocorrência.');
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

  const handleExportOcorrenciasJSON = () => {
    if (ocorrenciasList.length === 0) {
      alert('Nenhuma ocorrência para exportar.');
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ocorrenciasList, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    const filename = ocorrenciaFilterIntern !== 'all' 
      ? `Ocorrencias_${interns.find(i => i.id === ocorrenciaFilterIntern)?.name.replace(/\s+/g, '_')}.json`
      : "Ocorrencias_Todos_Estagiarios.json";
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleDownloadOrOpenDoc = (base64, filename) => {
    const link = document.createElement('a');
    link.href = base64;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const ocorrenciasList = records.filter(r => {
    const isOcorrencia = r.action === 'ocorrencia' || (r.justificationDoc && Object.keys(r.justificationDoc).length > 0);
    if (!isOcorrencia) return false;
    if (ocorrenciaFilterIntern !== 'all' && r.internId !== ocorrenciaFilterIntern) return false;
    if (filterUnit !== 'all') {
      const intern = interns.find(i => i.id === r.internId);
      if (!intern || intern.unitId !== filterUnit) return false;
    }
    return true;
  });

  const internOccurrenceDocs = [];
  const filteredInternsForDocs = interns.filter(i => {
    if (ocorrenciaFilterIntern !== 'all' && i.id !== ocorrenciaFilterIntern) return false;
    if (filterUnit !== 'all' && i.unitId !== filterUnit) return false;
    return true;
  });

  filteredInternsForDocs.forEach(i => {
    if (i.documents) {
      Object.keys(i.documents).forEach(key => {
        if (key.startsWith('ocorrencia_')) {
          internOccurrenceDocs.push({
            key,
            internName: i.name,
            internId: i.id,
            ...i.documents[key]
          });
        }
      });
    }
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LADO ESQUERDO: FORMULÁRIO DE CADASTRO */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden lg:col-span-1 animate-fade-in">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
            <Plus className="text-blue-600" size={18} />
            <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wider">Nova Ocorrência</h3>
          </div>
          
          <form onSubmit={handleSaveOcorrencia} className="p-4 space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Estagiário</label>
              <select
                value={selectedOcorrenciaIntern}
                onChange={(e) => setSelectedOcorrenciaIntern(e.target.value)}
                required
                className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Selecione um estagiário...</option>
                {interns
                  .filter(i => filterUnit === 'all' || i.unitId === filterUnit)
                  .map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.active !== false ? 'Ativo' : 'Inativo'})</option>
                  ))}
              </select>
            </div>

            {/* CALENDÁRIO DOS AFASTAMENTOS */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Calendar size={13} className="text-blue-500" /> Calendário dos Afastamentos
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Data de Início</label>
                  <input
                    type="date"
                    value={ocorrenciaStartDate}
                    onChange={(e) => setOcorrenciaStartDate(e.target.value)}
                    required
                    className="w-full p-1.5 border border-gray-300 bg-white rounded-lg focus:ring-1 focus:ring-blue-500 text-[10px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Data de Fim</label>
                  <input
                    type="date"
                    value={ocorrenciaEndDate}
                    onChange={(e) => setOcorrenciaEndDate(e.target.value)}
                    required
                    className="w-full p-1.5 border border-gray-300 bg-white rounded-lg focus:ring-1 focus:ring-blue-500 text-[10px]"
                  />
                </div>
              </div>
            </div>

            {/* TIPO COMPROVANTE & DIAS AFASTADOS */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 space-y-3">
              <span className="font-semibold text-blue-700 flex items-center gap-1">
                <Upload size={13} /> Comprovante de Ocorrência (Faltas/Atrasos)
              </span>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Tipo do Comprovante</label>
                  <select
                    value={ocorrenciaType}
                    onChange={(e) => setOcorrenciaType(e.target.value)}
                    className="w-full p-1.5 border border-gray-300 bg-white rounded-lg focus:ring-1 focus:ring-blue-500 text-[10px]"
                  >
                    <option value="atestado">Atestado Médico</option>
                    <option value="falta">Falta Injustificada</option>
                    <option value="atraso">Atraso</option>
                    <option value="curso">Inscrição em Curso</option>
                    <option value="academico">Atividade Acadêmica</option>
                    <option value="outros">Outro Comprovante</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Dias Afastados</label>
                  <input
                    type="number"
                    min="0"
                    value={ocorrenciaDays}
                    onChange={(e) => setOcorrenciaDays(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full p-1.5 border border-gray-300 bg-white rounded-lg focus:ring-1 focus:ring-blue-500 text-[10px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Arquivo (PDF/PNG/JPG)</label>
                <input
                  id="ocorrencia-file-input"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="w-full text-[10px] p-1 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Justificativa / Descrição</label>
              <textarea
                value={ocorrenciaDesc}
                onChange={(e) => setOcorrenciaDesc(e.target.value)}
                required
                placeholder="Ex: Apresentou atestado médico relativo ao período..."
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 resize-none h-16"
              />
            </div>

            <button
              type="submit"
              disabled={ocorrenciaLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow border-none cursor-pointer"
            >
              {ocorrenciaLoading ? 'Registrando...' : 'Registrar Ocorrência'}
            </button>
          </form>
        </div>

        {/* LADO DIREITO: LISTA DE OCORRÊNCIAS & COMPROVANTES */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b pb-3 mb-4 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-700">Filtrar por Estagiário:</span>
                <select
                  value={ocorrenciaFilterIntern}
                  onChange={(e) => setOcorrenciaFilterIntern(e.target.value)}
                  className="p-1 border border-gray-300 bg-white rounded focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">Todos</option>
                  {interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit).map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleExportOcorrenciasJSON}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-1 px-2 border border-blue-200 rounded text-[10px] transition-colors self-end sm:self-auto"
              >
                Exportar Histórico (JSON)
              </button>
            </div>

            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Linha do Tempo das Ocorrências</h4>
              {ocorrenciasList.length === 0 ? (
                <div className="p-8 text-center text-gray-400 italic text-xs">Nenhuma ocorrência encontrada para este filtro.</div>
              ) : (
                ocorrenciasList.map((record) => (
                  <div key={record.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 hover:bg-slate-50 transition-all flex justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-gray-800 text-[13px]">{record.internName}</strong>
                        <span className="text-[10px] text-slate-400 font-semibold">{formatDate(record.timestamp)}</span>
                      </div>
                      <p className="text-gray-600 text-xs leading-normal font-medium">{record.justification}</p>
                      {record.daysAway > 0 && (
                        <div className="text-[10px] text-amber-700 font-bold">
                          ⚠️ Afastamento: {record.daysAway} {record.daysAway === 1 ? 'dia' : 'dias'}
                        </div>
                      )}
                      {record.justificationDoc && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => handleViewDocumentContent(record.internId, `ocorrencia_${record.id}`, record.justificationDoc.name, 'Comprovante')}
                            className="inline-flex items-center gap-1 text-[9px] text-indigo-600 hover:text-indigo-800 font-semibold bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 transition-colors"
                          >
                            <FileText size={10} />
                            Anexo: {record.justificationDoc.type.toUpperCase()} ({record.justificationDoc.size})
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteOcorrencia(record.id, record.internId)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded self-start shrink-0 border-none cursor-pointer"
                      title="Excluir Ocorrência"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* LISTA DE ANEXOS GERAIS DE COMPROVANTES */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Comprovantes e Atestados Arquivados</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {internOccurrenceDocs.length === 0 ? (
                <div className="col-span-full p-4 text-center text-gray-400 italic text-xs">Nenhum documento arquivado.</div>
              ) : (
                internOccurrenceDocs.map((doc, idx) => (
                  <div key={idx} className="border border-slate-100 rounded-xl p-3 bg-white hover:shadow-sm transition-all flex items-center justify-between text-xs">
                    <div className="space-y-1 truncate pr-2">
                      <div className="font-bold text-gray-800 truncate" title={doc.name}>{doc.name}</div>
                      <div className="text-[9px] text-gray-400">{doc.internName} • {doc.size}</div>
                      <div className="text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold w-fit">{doc.type?.toUpperCase()}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleViewDocumentContent(doc.internId, doc.key, doc.name, 'Comprovante Arquivado')}
                        className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded"
                        title="Visualizar"
                      >
                        <Eye size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

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
