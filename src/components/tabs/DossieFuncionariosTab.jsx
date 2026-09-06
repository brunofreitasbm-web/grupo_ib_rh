import React, { useState, useEffect, useCallback } from 'react';
import { FolderOpen, Eye, Trash, Upload, Loader2, X, Download, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../supabase';
import { mapEmployeeFromDb, EMPLOYEE_LIST_FIELDS, fileToBase64, getFriendlyDbErrorMessage } from '../../utils/mappings';
import { ADMISSIONAL_DOCUMENTS } from '../../config/cltConstants';
import { toast } from 'sonner';

// Checklist de documentos admissionais dos Funcionários CLT — mesmo padrão de
// employee_documents (base64 + meta jsonb) usado por employee_documents,
// espelhando document_contents (estagiários) e professional_documents (PJ).
export default function DossieFuncionariosTab({ filterUnit, restrictedUnitIds = [] }) {
  const [employees, setEmployees] = useState([]);
  const [dependentsByEmployee, setDependentsByEmployee] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDocKey, setUploadDocKey] = useState(ADMISSIONAL_DOCUMENTS[0].key);
  const [viewDoc, setViewDoc] = useState(null);

  const fetchEmployees = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('employees').select(EMPLOYEE_LIST_FIELDS).order('name');
      if (error) throw error;
      setEmployees((data || []).map(mapEmployeeFromDb).filter((e) => !restrictedUnitIds.includes(e.unitId)));
    } catch (err) {
      console.error('Erro ao carregar funcionários:', err);
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds]);

  const fetchDependents = useCallback(async (employeeId) => {
    if (!employeeId || dependentsByEmployee[employeeId]) return;
    try {
      const { data, error } = await supabase.from('employee_dependents').select('birthdate').eq('employee_id', employeeId);
      if (error) throw error;
      setDependentsByEmployee((prev) => ({ ...prev, [employeeId]: data || [] }));
    } catch (err) {
      console.error('Erro ao carregar dependentes:', err);
    }
  }, [dependentsByEmployee]);

  const fetchDocs = useCallback(async (employeeId) => {
    if (!employeeId) { setDocs([]); return; }
    try {
      const { data, error } = await supabase
        .from('employee_documents')
        .select('doc_key, meta, created_at')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocs(data || []);
    } catch (err) {
      console.error('Erro ao carregar documentos do funcionário:', err);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { fetchDocs(selectedId); fetchDependents(selectedId); }, [selectedId, fetchDocs, fetchDependents]);

  const filteredEmployees = employees.filter((e) => filterUnit === 'all' || e.unitId === filterUnit);
  const selectedEmployee = employees.find((e) => e.id === selectedId) || null;
  const dependents = dependentsByEmployee[selectedId] || [];

  const requiredDocs = ADMISSIONAL_DOCUMENTS.filter((d) => d.required(selectedEmployee, dependents));
  const uploadedKeys = new Set(docs.map((d) => d.doc_key));
  const completedCount = requiredDocs.filter((d) => uploadedKeys.has(d.key)).length;
  const completionPct = requiredDocs.length ? Math.round((completedCount / requiredDocs.length) * 100) : 0;

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedId) return;
    const fileInput = document.getElementById('clt-doc-file-input');
    const file = fileInput?.files?.[0];
    if (!file) { toast.error('Selecione um arquivo.'); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error('Arquivo excede 3MB.'); return; }

    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const meta = { name: file.name, size: (file.size / 1024).toFixed(1) + ' KB', uploadedAt: new Date().toISOString() };
      const { error } = await supabase.from('employee_documents').upsert({
        employee_id: selectedId, doc_key: uploadDocKey, content: base64, meta,
      });
      if (error) throw error;
      toast.success('Documento salvo com sucesso.');
      if (fileInput) fileInput.value = '';
      fetchDocs(selectedId);
    } catch (err) {
      console.error('Erro ao enviar documento:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (docKey, meta) => {
    try {
      const { data, error } = await supabase.from('employee_documents').select('content').eq('employee_id', selectedId).eq('doc_key', docKey).single();
      if (error || !data) throw new Error('Não foi possível obter o conteúdo do documento.');
      setViewDoc({ base64: data.content, name: meta?.name || docKey });
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    }
  };

  const handleDelete = async (docKey) => {
    if (!window.confirm('Remover este documento?')) return;
    try {
      const { error } = await supabase.from('employee_documents').delete().eq('employee_id', selectedId).eq('doc_key', docKey);
      if (error) throw error;
      toast.success('Documento removido.');
      fetchDocs(selectedId);
    } catch (err) {
      console.error(err);
      toast.error(getFriendlyDbErrorMessage(err));
    }
  };

  const docLabel = (docKey) => ADMISSIONAL_DOCUMENTS.find((d) => d.key === docKey)?.label || docKey;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <FolderOpen size={20} className="text-indigo-600" /> Documentos Admissionais
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Selecione o Funcionário</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-xs">
            <option value="">Selecione um funcionário...</option>
            {filteredEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        {selectedId ? (
          <>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1">
                  <span>Completude do dossiê admissional</span>
                  <span>{completedCount}/{requiredDocs.length} ({completionPct}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${completionPct}%` }} />
                </div>
              </div>
              {completionPct === 100 ? <CheckCircle2 size={20} className="text-emerald-500" /> : <AlertCircle size={20} className="text-amber-500" />}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 overflow-x-auto border border-gray-100 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
                      <th className="p-3 font-semibold">Documento</th>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {requiredDocs.map((docDef) => {
                      const uploaded = docs.find((d) => d.doc_key === docDef.key);
                      return (
                        <tr key={docDef.key} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-semibold text-gray-800">{docDef.label}</td>
                          <td className="p-3">
                            {uploaded ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Enviado</span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Pendente</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {uploaded && (
                              <div className="flex justify-end gap-1.5">
                                <button onClick={() => handleView(docDef.key, uploaded.meta)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded" title="Visualizar"><Eye size={13} /></button>
                                <button onClick={() => handleDelete(docDef.key)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded" title="Remover"><Trash size={13} /></button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 h-fit">
                <h3 className="font-semibold text-slate-700 flex items-center gap-1 text-xs">
                  <Upload size={14} className="text-indigo-600" /> Anexar Documento
                </h3>
                <form onSubmit={handleUpload} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Documento</label>
                    <select value={uploadDocKey} onChange={(e) => setUploadDocKey(e.target.value)} className="w-full p-2 border border-gray-300 bg-white rounded-lg text-xs">
                      {ADMISSIONAL_DOCUMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Arquivo PDF ou Imagem</label>
                    <input id="clt-doc-file-input" type="file" required accept=".pdf,.png,.jpg,.jpeg" className="w-full text-xs p-1.5 bg-white border border-gray-300 rounded-lg" />
                    <p className="text-[8px] text-gray-400 mt-1">Permitidos: PDF, PNG, JPG de até 3MB.</p>
                  </div>
                  <button type="submit" disabled={uploading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 rounded-lg text-xs disabled:opacity-50 flex items-center justify-center gap-1">
                    {uploading ? <><Loader2 size={12} className="animate-spin" /> Enviando...</> : <><Plus size={12} /> Salvar</>}
                  </button>
                </form>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-slate-50 rounded-xl p-8 border border-slate-100 text-center text-slate-400 text-sm">
            <FolderOpen size={40} className="mx-auto text-slate-300 mb-2" />
            Selecione um funcionário acima para gerenciar seu dossiê admissional.
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
            <a href={viewDoc.base64} download={viewDoc.name} className="self-end bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs inline-flex items-center gap-1">
              <Download size={13} /> Baixar Arquivo
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
