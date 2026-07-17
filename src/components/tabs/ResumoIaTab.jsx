import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Loader2, Sparkles, Users } from 'lucide-react';
import { supabase } from '../../supabase';
import { mapInternFromDb, mapRecordFromDb, mapUnitFromDb } from '../../utils/mappings';
import { formatDate } from '../../utils/helpers';

export default function ResumoIaTab({ filterUnit }) {
  const [interns, setInterns] = useState([]);
  const [records, setRecords] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSummary, setAiSummary] = useState('');

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

  const fetchData = useCallback(async () => {
    try {
      const { data: internsData } = await supabase
        .from('interns')
        .select('*')
        .order('name', { ascending: true });

      const { data: recordsData } = await supabase
        .from('records')
        .select('*')
        .order('timestamp', { ascending: false });

      const { data: unitsData } = await supabase
        .from('units')
        .select('*');

      if (internsData) setInterns(internsData.map(mapInternFromDb));
      if (recordsData) setRecords(recordsData.map(mapRecordFromDb));
      if (unitsData) setUnits(unitsData.map(mapUnitFromDb));
    } catch (err) {
      console.error('Erro ao buscar dados para a IA:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const internsChannel = supabase
      .channel('resumo-ia-interns-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interns' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(internsChannel);
    };
  }, [fetchData]);

  const unitName = (id) => units.find(u => u.id === id)?.name || '—';

  const filteredInterns = interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit);
  const sortedInterns = [...filteredInterns].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const filteredRecords = records.filter(r => {
    if (filterUnit === 'all') return true;
    const intern = interns.find(i => i.id === r.internId);
    return intern && intern.unitId === filterUnit;
  });

  const fetchWithRetry = async (url, options, retries = 5) => {
    const delays = [1000, 2000, 4000, 8000, 16000];
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise((res) => setTimeout(res, delays[i]));
      }
    }
  };

  const handleAnalyzeRecords = async () => {
    if (filteredRecords.length === 0) return;
    if (!apiKey) {
      setAiSummary('Recurso de IA não configurado (defina VITE_GEMINI_API_KEY no arquivo .env).');
      return;
    }
    setIsAnalyzing(true);
    try {
      const recordsText = JSON.stringify(
        filteredRecords.slice(0, 50).map((r) => ({
          nome: r.internName, acao: r.action, dataHora: r.timestamp,
          unidade: r.geo?.unitName, justificativa: r.justification,
        }))
      );
      const prompt = `Analise os seguintes registros de ponto de estagiários de uma clínica (2 unidades). Faça um breve resumo gerencial destacando padrões, anomalias ou justificativas notáveis. Seja conciso e profissional. Registros: ${recordsText}`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const result = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const analysis = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (analysis) setAiSummary(analysis);
    } catch (error) {
      console.error('Erro ao analisar registros:', error);
      setAiSummary('Não foi possível gerar a análise no momento.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
            <Bot size={22} className="text-blue-600" /> Resumo Gerencial (IA)
          </h2>
          <button
            onClick={handleAnalyzeRecords}
            disabled={isAnalyzing || filteredRecords.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            ✨ Gerar Insights Gerenciais
          </button>
        </div>
        <div className="bg-white rounded-lg p-4 text-gray-700 text-sm whitespace-pre-line min-h-[80px] border border-blue-50">
          {isAnalyzing ? (
            <div className="flex items-center justify-center h-full text-blue-500 gap-2">
              <Loader2 size={20} className="animate-spin" /> Analisando padrões de estágio...
            </div>
          ) : aiSummary ? aiSummary : (
            <span className="text-gray-400 italic">Clique no botão para gerar uma análise inteligente com dados de frequência, relatórios e contratos dos estagiários.</span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <Users size={20} className="text-blue-600" /> Estagiários (ordem alfabética)
          </h2>
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
            {sortedInterns.length} cadastros
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600 uppercase tracking-wider border-b border-gray-100">
                <th className="p-3 font-semibold">Nome</th>
                <th className="p-3 font-semibold">Curso / Instituição</th>
                <th className="p-3 font-semibold">Unidade</th>
                <th className="p-3 font-semibold">Vigência</th>
                <th className="p-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedInterns.length === 0 ? (
                <tr><td colSpan="5" className="p-4 text-center text-gray-400">Nenhum estagiário cadastrado.</td></tr>
              ) : sortedInterns.map(intern => (
                <tr key={intern.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-bold text-gray-800">
                    {intern.name}
                    {intern.cpf && <div className="text-[10px] text-gray-400 font-normal">CPF: {intern.cpf}</div>}
                  </td>
                  <td className="p-3 text-slate-600">
                    <div>{intern.course || '—'}</div>
                    <div className="text-[10px] text-gray-400">{intern.institution || ''}</div>
                  </td>
                  <td className="p-3 text-slate-600">{intern.unitId ? unitName(intern.unitId) : '—'}</td>
                  <td className="p-3 text-slate-600">
                    {formatDate(intern.startDate)} a {formatDate(intern.endDate)}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      intern.active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {intern.active !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
