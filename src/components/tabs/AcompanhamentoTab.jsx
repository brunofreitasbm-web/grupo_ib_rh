import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Save, Loader2, Upload, Eye, Trash, X, Download } from 'lucide-react';
import { supabase } from '../../supabase';
import { mapInternFromDb, mapUnitFromDb, fileToBase64 } from '../../utils/mappings';

export default function AcompanhamentoTab({ filterUnit }) {
  const [interns, setInterns] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form & Selection States
  const [selectedActivityIntern, setSelectedActivityIntern] = useState('');
  const [activityReportDate, setActivityReportDate] = useState('');
  const [activityRecessDays, setActivityRecessDays] = useState(0);
  const [activitySupervisorName, setActivitySupervisorName] = useState('');
  const [uploadingSemestralReport, setUploadingSemestralReport] = useState(false);
  const [semestralReportPeriod, setSemestralReportPeriod] = useState('1');

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

      const { data: unitsData } = await supabase
        .from('units')
        .select('*');

      if (internsData) setInterns(internsData.map(mapInternFromDb));
      if (unitsData) setUnits(unitsData.map(mapUnitFromDb));
    } catch (err) {
      console.error('Erro ao carregar dados de acompanhamento:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const internsChannel = supabase
      .channel('acompanhamento-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interns' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(internsChannel);
    };
  }, [fetchData]);

  // Sync state when intern is selected
  useEffect(() => {
    const intern = interns.find(i => i.id === selectedActivityIntern);
    if (intern) {
      setActivityReportDate(intern.lastReportDate || '');
      setActivityRecessDays(Number(intern.recessDaysTaken) || 0);
      setActivitySupervisorName(intern.supervisorName || '');
    } else {
      setActivityReportDate('');
      setActivityRecessDays(0);
      setActivitySupervisorName('');
    }
  }, [selectedActivityIntern, interns]);

  const selectedInternData = interns.find(i => i.id === selectedActivityIntern);
  const semestralReports = selectedInternData?.semestralReports || {};
  const report1 = semestralReports['1'];
  const report2 = semestralReports['2'];
  const report3 = semestralReports['3'];
  const report4 = semestralReports['4'];
  const deliveredCount = [report1, report2, report3, report4].filter(Boolean).length;
  const progressPercent = deliveredCount * 25;

  const handleSaveActivitiesData = async (e) => {
    e.preventDefault();
    if (!selectedInternData) return;
    try {
      const { error } = await supabase
        .from('interns')
        .update({
          last_report_date: activityReportDate || null,
          recess_days_taken: Number(activityRecessDays) || 0,
          supervisor_name: activitySupervisorName || null
        })
        .eq('id', selectedInternData.id);
      if (error) throw error;
      alert('Dados de acompanhamento atualizados com sucesso!');
      fetchData();
    } catch (err) {
      console.error('Erro ao salvar dados de acompanhamento:', err);
      alert('Erro ao salvar alterações.');
    }
  };

  const handleUploadSemestral = async (e) => {
    e.preventDefault();
    if (!selectedInternData) return;
    const fileInput = document.getElementById('semestral-file-input');
    const file = fileInput?.files?.[0];
    if (!file) {
      alert('Por favor, selecione um arquivo.');
      return;
    }
    if (file.type !== 'application/pdf') {
      alert('Apenas arquivos no formato PDF são permitidos para o Relatório Semestral.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('O arquivo excede o limite de 5MB.');
      return;
    }
    setUploadingSemestralReport(true);
    try {
      const base64 = await fileToBase64(file);
      const updatedReports = {
        ...semestralReports,
        [semestralReportPeriod]: {
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          uploadedAt: new Date().toISOString()
        }
      };

      const { error } = await supabase
        .from('interns')
        .update({ semestral_reports: updatedReports })
        .eq('id', selectedInternData.id);
      if (error) throw error;

      const { error: contentError } = await supabase
        .from('document_contents')
        .upsert({
          intern_id: selectedInternData.id,
          doc_key: `semestral_report_${semestralReportPeriod}`,
          content: base64
        });
      if (contentError) throw contentError;

      if (fileInput) fileInput.value = '';
      alert(`Relatório Semestral do ${semestralReportPeriod}º período anexado com sucesso!`);
      fetchData();
    } catch (err) {
      console.error("Erro no upload do relatório semestral:", err);
      alert('Erro ao enviar relatório semestral.');
    } finally {
      setUploadingSemestralReport(false);
    }
  };

  const handleDeleteSemestral = async (period) => {
    if (!selectedInternData) return;
    const ok = window.confirm(`Deseja realmente remover o Relatório Semestral do ${period}º período?`);
    if (!ok) return;

    try {
      const updatedReports = { ...semestralReports };
      delete updatedReports[period];

      const { error } = await supabase
        .from('interns')
        .update({ semestral_reports: updatedReports })
        .eq('id', selectedInternData.id);
      if (error) throw error;

      await supabase
        .from('document_contents')
        .delete()
        .eq('intern_id', selectedInternData.id)
        .eq('doc_key', `semestral_report_${period}`);

      alert('Relatório removido com sucesso!');
      fetchData();
    } catch (err) {
      console.error("Erro ao deletar relatório semestral:", err);
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
          <FileText size={20} className="text-blue-600" /> Acompanhamento de Atividades Diárias
        </h2>
        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
          Desempenho & Recesso
        </span>
      </div>

      <div className="p-4 space-y-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Selecione o Estagiário</label>
          <select
            value={selectedActivityIntern}
            onChange={(e) => setSelectedActivityIntern(e.target.value)}
            className="w-full md:w-1/2 p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
          >
            <option value="">Selecione um estagiário para acompanhamento...</option>
            {interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit).map(i => (
              <option key={i.id} value={i.id}>{i.name} ({i.active !== false ? 'Ativo' : 'Inativo'})</option>
            ))}
          </select>
        </div>

        {selectedInternData ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                Atividades & Recesso
              </h3>
              <form onSubmit={handleSaveActivitiesData} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1 font-semibold">Profissional Supervisor</label>
                  <input
                    type="text"
                    required
                    placeholder="Nome do Supervisor"
                    value={activitySupervisorName}
                    onChange={(e) => setActivitySupervisorName(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Último Relatório de Atividades</label>
                  <input
                    type="date"
                    value={activityReportDate}
                    onChange={(e) => setActivityReportDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Dias de Recesso Gozados (Tirados)</label>
                  <input
                    type="number"
                    min="0"
                    value={activityRecessDays}
                    onChange={(e) => setActivityRecessDays(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow"
                >
                  <Save size={14} /> Salvar Informações
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
                <div className="flex justify-between items-center text-xs text-slate-700 mb-2">
                  <span className="font-semibold">Progresso de Relatórios Semestrais</span>
                  <span className="font-bold text-emerald-700">{deliveredCount} de 4 ({progressPercent}%)</span>
                </div>
                <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden border border-gray-100 shadow-inner">
                  <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-semibold text-slate-800 text-xs">Anexar Novo Relatório Semestral</h4>
                  <form onSubmit={handleUploadSemestral} className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Período Relativo</label>
                      <select
                        value={semestralReportPeriod}
                        onChange={(e) => setSemestralReportPeriod(e.target.value)}
                        className="w-full p-2 border border-gray-300 bg-white rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="1">1º Relatório Semestral</option>
                        <option value="2">2º Relatório Semestral</option>
                        <option value="3">3º Relatório Semestral</option>
                        <option value="4">4º Relatório Semestral</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Arquivo (Apenas PDF)</label>
                      <input
                        id="semestral-file-input"
                        type="file"
                        required
                        accept=".pdf"
                        className="w-full text-xs p-1.5 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={uploadingSemestralReport}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1 shadow-sm"
                    >
                      {uploadingSemestralReport ? (
                        <><Loader2 size={12} className="animate-spin" /> Carregando...</>
                      ) : (
                        <><Upload size={12} /> Enviar Relatório</>
                      )}
                    </button>
                  </form>
                </div>

                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-semibold text-slate-800 text-xs">Relatórios Entregues</h4>
                  <div className="space-y-2">
                    {['1', '2', '3', '4'].map(period => {
                      const rep = semestralReports[period];
                      return (
                        <div key={period} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg p-2.5 shadow-sm text-xs">
                          <div>
                            <div className="font-bold text-gray-800">{period}º Semestre</div>
                            {rep ? (
                              <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[150px]" title={rep.name}>
                                {rep.name} ({rep.size})
                              </div>
                            ) : (
                              <span className="text-[10px] text-amber-600 font-medium">Pendente de Entrega</span>
                            )}
                          </div>
                          {rep && (
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleViewDocumentContent(selectedInternData.id, `semestral_report_${period}`, rep.name, `Relatório Semestral ${period}º Sem.`)}
                                className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded"
                                title="Visualizar PDF"
                              >
                                <Eye size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSemestral(period)}
                                className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded"
                                title="Remover"
                              >
                                <Trash size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>

          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-8 border border-slate-100 text-center text-slate-400 text-sm">
            <FileText size={40} className="mx-auto text-slate-300 mb-2" />
            Selecione um estagiário acima para visualizar e gerenciar o Acompanhamento de Atividades.
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
