import React, { useState, useEffect, useCallback } from 'react';
import { Printer } from 'lucide-react';
import { supabase } from '../../supabase';
import { mapInternFromDb } from '../../utils/mappings';

export default function DocumentosTab({ filterUnit, onPrintDocument }) {
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrintIntern, setSelectedPrintIntern] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const { data: internsData } = await supabase
        .from('interns')
        .select('*')
        .order('name', { ascending: true });

      if (internsData) setInterns(internsData.map(mapInternFromDb));
    } catch (err) {
      console.error('Erro ao buscar estagiários para documentos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const internsChannel = supabase
      .channel('documentos-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interns' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(internsChannel);
    };
  }, [fetchData]);

  const selectedInternData = interns.find(i => i.id === selectedPrintIntern);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-4">
      <div className="border-b border-gray-200 bg-gray-50 -mx-4 -mt-4 p-4 mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <Printer size={20} className="text-blue-600" /> Gerador de Documentos & Impressão
        </h2>
        <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Porto Terapia</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">Selecione o estagiário abaixo para gerar e imprimir os documentos regulamentares preenchidos com os dados cadastrais completos.</p>

      <div className="mb-6 max-w-md">
        <label className="block text-xs font-medium text-gray-500 mb-1">Selecione o Estagiário</label>
        <select
          value={selectedPrintIntern}
          onChange={(e) => setSelectedPrintIntern(e.target.value)}
          className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
        >
          <option value="">Selecione um estagiário para gerar documentos...</option>
          {interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit).map(i => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
      </div>

      {selectedInternData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Declaração de Vínculo */}
          <div className="border border-gray-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between h-40 shadow-sm">
            <div>
              <h3 className="font-bold text-gray-800 text-xs mb-1">Declaração de Vínculo</h3>
              <p className="text-[10px] text-gray-400 leading-snug">Declaração oficial que comprova o vínculo ativo do estagiário com a clínica Porto Terapia.</p>
            </div>
            <button
              type="button"
              onClick={() => onPrintDocument('declaracao', selectedInternData)}
              className="w-full mt-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1 shadow transition-colors"
            >
              <Printer size={13} /> Imprimir Declaração
            </button>
          </div>

          {/* Contrato de Estágio TCE */}
          <div className="border border-gray-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between h-40 shadow-sm">
            <div>
              <h3 className="font-bold text-gray-800 text-xs mb-1">Contrato de Estágio (TCE)</h3>
              {selectedInternData.documents?.tce ? (
                <>
                  <p className="text-[10px] text-green-600 font-semibold leading-snug">✓ Disponível para impressão</p>
                  <p className="text-[9px] text-gray-400 leading-none mt-1 truncate">{selectedInternData.documents.tce.name}</p>
                </>
              ) : (
                <p className="text-[10px] text-red-500 font-semibold leading-snug">⚠️ Não disponível (Pendente no Dossiê)</p>
              )}
            </div>
            {selectedInternData.documents?.tce ? (
              <div className="flex gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    const doc = selectedInternData.documents.tce;
                    const printWindow = window.open('', '_blank');
                    const isPdf = doc.content.startsWith('data:application/pdf');
                    printWindow.document.write(`
                      <html>
                        <head><title>Imprimir Contrato - ${selectedInternData.name}</title></head>
                        <body style="margin:0;padding:0;">
                          ${isPdf ? 
                            `<iframe src="${doc.content}" width="100%" height="100%" style="border:none;"></iframe>` : 
                            `<img src="${doc.content}" style="max-width:100%;height:auto;display:block;margin:0 auto;" />`
                          }
                          <script>
                            window.onload = function() {
                              setTimeout(() => {
                                window.print();
                              }, 1000);
                            };
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  className="flex-1 py-2 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-[10px] flex items-center justify-center gap-1 shadow transition-colors"
                >
                  <Printer size={12} /> Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const doc = selectedInternData.documents.tce;
                    const viewWindow = window.open('', '_blank');
                    viewWindow.document.write(`
                      <html>
                        <head><title>Contrato - ${selectedInternData.name}</title></head>
                        <body style="margin:0;padding:0;display:flex;justify-content:center;align-items:center;background:#1e293b;">
                          ${doc.content.startsWith('data:application/pdf') ? 
                            `<iframe src="${doc.content}" width="100%" height="100%" style="border:none;"></iframe>` : 
                            `<img src="${doc.content}" style="max-width:100%;max-height:100%;object-fit:contain;" />`
                          }
                        </body>
                      </html>
                    `);
                    viewWindow.document.close();
                  }}
                  className="py-2 px-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold text-[10px] transition-colors"
                >
                  Ver
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled
                className="w-full mt-2 py-2 px-3 bg-gray-300 text-gray-500 rounded-lg font-semibold text-xs flex items-center justify-center gap-1 cursor-not-allowed"
              >
                <Printer size={13} /> Indisponível
              </button>
            )}
          </div>

          {/* Minuta TCE */}
          <div className="border border-gray-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between h-40 shadow-sm">
            <div>
              <h3 className="font-bold text-gray-800 text-xs mb-1">Minuta de TCE</h3>
              <p className="text-[10px] text-gray-400 leading-snug">Termo de Compromisso de Estágio preenchido com dados pessoais, vigência e bolsa-auxílio.</p>
            </div>
            <button
              type="button"
              onClick={() => onPrintDocument('tce', selectedInternData)}
              className="w-full mt-2 py-2 px-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1 shadow transition-colors"
            >
              <Printer size={13} /> Imprimir Minuta TCE
            </button>
          </div>

          {/* PAE */}
          <div className="border border-gray-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between h-40 shadow-sm">
            <div>
              <h3 className="font-bold text-gray-800 text-xs mb-1">Plano de Atividades (PAE)</h3>
              <p className="text-[10px] text-gray-400 leading-snug">Plano de atividades regulamentar anexo ao TCE preenchido com dados de vínculo.</p>
            </div>
            <button
              type="button"
              onClick={() => onPrintDocument('pae', selectedInternData)}
              className="w-full mt-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1 shadow transition-colors"
            >
              <Printer size={13} /> Imprimir PAE
            </button>
          </div>

          {/* Ficha Cadastral */}
          <div className="border border-gray-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between h-40 shadow-sm">
            <div>
              <h3 className="font-bold text-gray-800 text-xs mb-1">Ficha Cadastral</h3>
              <p className="text-[10px] text-gray-400 leading-snug">Ficha de cadastro contendo dados pessoais, acadêmicos, bancários e de emergência.</p>
            </div>
            <button
              type="button"
              onClick={() => onPrintDocument('ficha', selectedInternData)}
              className="w-full mt-2 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1 shadow transition-colors"
            >
              <Printer size={13} /> Imprimir Ficha Cadastral
            </button>
          </div>

          {/* Relatório Individual Consolidado */}
          <div className="border border-gray-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between h-40 shadow-sm">
            <div>
              <h3 className="font-bold text-gray-800 text-xs mb-1">Relatório Individual</h3>
              <p className="text-[10px] text-gray-400 leading-snug">Relatório consolidado contendo dados cadastrais, foto, acompanhamentos e ocorrências desde o início.</p>
            </div>
            <div className="flex gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => onPrintDocument('relatorio_individual', selectedInternData)}
                className="flex-1 py-2 px-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-[10px] flex items-center justify-center gap-1 shadow transition-colors"
              >
                <Printer size={12} /> Imprimir
              </button>
              <button
                type="button"
                onClick={() => onPrintDocument('download_relatorio_individual', selectedInternData)}
                className="flex-1 py-2 px-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-[10px] flex items-center justify-center gap-1 shadow transition-colors"
              >
                📥 PDF
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center text-slate-400 text-xs italic">
          Aguardando seleção do estagiário para liberar a emissão dos documentos preenchidos.
        </div>
      )}
    </div>
  );
}
