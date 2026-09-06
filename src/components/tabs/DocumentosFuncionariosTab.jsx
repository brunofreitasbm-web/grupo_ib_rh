import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Printer, Download, Archive, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';
import { mapEmployeeFromDb, EMPLOYEE_SELECT_FIELDS, mapDependentFromDb } from '../../utils/mappings';
import { BRANDING } from '../../config/branding';
import { GENERATED_DOCUMENT_TYPES } from '../../config/cltConstants';
import { getEmployeeDocumentHtml } from '../../utils/cltDocuments';
import { openPrintWindow, downloadPdf } from '../../utils/documentPrint';
import { toast } from 'sonner';

// Geração e arquivamento de contratos/termos do módulo CLT. Templates ficam
// em cltDocuments.js (fora do App.jsx de propósito, ver getDocumentHtml de
// estagiários para o padrão original que este módulo não deve inflar mais).
const NEEDS_NO_EXTRA = new Set([
  'contrato_experiencia', 'prorrogacao_experiencia', 'contrato_indeterminado', 'ficha_registro',
  'acordo_compensacao', 'acordo_banco_horas', 'opcao_vt', 'declaracao_dependentes_ir',
  'termo_biometria_lgpd', 'termo_confidencialidade', 'declaracao_vinculo',
]);

export default function DocumentosFuncionariosTab({ filterUnit, restrictedUnitIds = [], units = [] }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [docType, setDocType] = useState(GENERATED_DOCUMENT_TYPES[0].key);
  const [dependents, setDependents] = useState([]);
  const [saving, setSaving] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('employees').select(EMPLOYEE_SELECT_FIELDS).order('name');
      if (error) throw error;
      setEmployees((data || []).map(mapEmployeeFromDb).filter((e) => !restrictedUnitIds.includes(e.unitId)));
    } catch (err) {
      console.error('Erro ao carregar funcionários:', err);
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  useEffect(() => {
    if (!selectedId) { setDependents([]); return; }
    supabase.from('employee_dependents').select('*').eq('employee_id', selectedId).then(({ data }) => {
      setDependents((data || []).map(mapDependentFromDb));
    });
  }, [selectedId]);

  const filteredEmployees = employees.filter((e) => filterUnit === 'all' || e.unitId === filterUnit);
  const selectedEmployee = employees.find((e) => e.id === selectedId) || null;
  const unit = units.find((u) => u.id === selectedEmployee?.unitId) || null;
  const showsPreview = !!selectedEmployee && NEEDS_NO_EXTRA.has(docType);

  const ctx = useMemo(() => ({
    employee: selectedEmployee, unit, branding: BRANDING, dependents, extra: {},
  }), [selectedEmployee, unit, dependents]);

  const html = showsPreview ? getEmployeeDocumentHtml(docType, ctx) : '';
  const docLabel = GENERATED_DOCUMENT_TYPES.find((d) => d.key === docType)?.label || docType;

  const handlePrint = () => {
    if (!html) { toast.error('Este documento depende de dados específicos (férias, ocorrência, encerramento) gerados nas respectivas abas.'); return; }
    openPrintWindow(html, `${docLabel} - ${selectedEmployee?.name || ''}`);
  };

  const handleDownload = () => {
    if (!html) { toast.error('Este documento depende de dados específicos gerados nas respectivas abas.'); return; }
    downloadPdf(html, `${docLabel.replace(/\s+/g, '_')}_${(selectedEmployee?.name || '').replace(/\s+/g, '_')}.pdf`);
  };

  const handleArchive = async () => {
    if (!html || !selectedId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('employee_documents').upsert({
        employee_id: selectedId,
        doc_key: `gerado-${docType}-${Date.now()}`,
        content: `data:text/html;base64,${btoa(unescape(encodeURIComponent(html)))}`,
        meta: { name: docLabel, type: 'gerado', generatedFrom: docType, uploadedAt: new Date().toISOString() },
      });
      if (error) throw error;
      toast.success('Documento arquivado no dossiê do funcionário.');
    } catch (err) {
      console.error('Erro ao arquivar documento:', err);
      toast.error('Erro ao arquivar documento.');
    } finally {
      setSaving(false);
    }
  };

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
          <FileText size={20} className="text-indigo-600" /> Contratos &amp; Termos
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Funcionário</label>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-xs">
              <option value="">Selecione um funcionário...</option>
              {filteredEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Documento</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-xs">
              {GENERATED_DOCUMENT_TYPES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>
        </div>

        {selectedEmployee ? (
          <>
            {!showsPreview && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                Este documento depende de dados lançados nas abas de Férias, Ocorrências, Ponto ou Encerramento — gere-o
                a partir do botão de impressão disponível naquelas telas.
              </p>
            )}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
              <iframe title="preview" srcDoc={html || '<p style="font-family:sans-serif;color:#999;padding:20px;">Selecione um documento sem dependências externas para pré-visualizar aqui.</p>'} className="w-full h-[420px] bg-white" />
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <button onClick={handlePrint} disabled={!showsPreview} className="px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 disabled:opacity-40">
                <Printer size={13} /> Imprimir
              </button>
              <button onClick={handleDownload} disabled={!showsPreview} className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1.5 disabled:opacity-40">
                <Download size={13} /> PDF
              </button>
              <button onClick={handleArchive} disabled={!showsPreview || saving} className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 disabled:opacity-40">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />} Arquivar no dossiê
              </button>
            </div>
          </>
        ) : (
          <div className="bg-slate-50 rounded-xl p-8 border border-slate-100 text-center text-slate-400 text-sm">
            <FileText size={40} className="mx-auto text-slate-300 mb-2" />
            Selecione um funcionário acima para gerar documentos.
          </div>
        )}
      </div>
    </div>
  );
}
