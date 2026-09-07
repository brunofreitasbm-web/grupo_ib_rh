import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Printer, Download, Upload } from 'lucide-react';
import { supabase } from '../../supabase';
import {
  mapProfessionalFromDb,
  mapProfessionalPresenceFromDb,
  PROFESSIONAL_SELECT_FIELDS,
  PROFESSIONAL_PRESENCE_SELECT_FIELDS,
} from '../../utils/mappings';
import { calculateProfessionalProduction } from '../../utils/hoursCalculations';
import { BRANDING } from '../../config/branding';
import NfseUploadModal from '../NfseUploadModal';

// Apuração mensal de produção de Profissionais PJ: dias com presença e total
// de horas na competência, apresentado como base de conferência para a Nota
// Fiscal — nunca como "folha de pagamento" (ver plano do módulo PJ, seção 1).
export default function ProducaoProfissionaisTab({ filterUnit, restrictedUnitIds = [], branding }) {
  const [professionals, setProfessionals] = useState([]);
  const [presence, setPresence] = useState([]);
  const [nfDocs, setNfDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthKey, setMonthKey] = useState(new Date().toISOString().substring(0, 7));
  const [showNfseModal, setShowNfseModal] = useState(false);

  const labels = BRANDING.professionalLabels || { production: 'Apuração de Produção' };

  const fetchData = useCallback(async () => {
    try {
      const { data: profData } = await supabase.from('professionals').select(PROFESSIONAL_SELECT_FIELDS);
      const { data: presData } = await supabase
        .from('professional_presence')
        .select(PROFESSIONAL_PRESENCE_SELECT_FIELDS)
        .gte('timestamp', `${monthKey}-01T00:00:00`)
        .order('timestamp', { ascending: true });
      const { data: docsData } = await supabase
        .from('professional_documents')
        .select('professional_id, doc_key, meta, created_at');

      if (profData) setProfessionals(profData.map(mapProfessionalFromDb).filter((p) => !restrictedUnitIds.includes(p.unitId)));
      if (presData) setPresence(presData.map(mapProfessionalPresenceFromDb).filter((r) => !restrictedUnitIds.includes(r.unitId)));
      if (docsData) setNfDocs(docsData || []);
    } catch (err) {
      console.error('Erro ao carregar apuração de produção PJ:', err);
    } finally {
      setLoading(false);
    }
  }, [monthKey, restrictedUnitIds]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const production = useMemo(
    () => calculateProfessionalProduction(presence, professionals, monthKey, filterUnit),
    [presence, professionals, monthKey, filterUnit]
  );

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = 'Prestador,Dias com Presença,Total de Horas\n';
    const rows = production
      .map((row) => `"${row.professional.name}",${row.daysPresent},${row.totalHours.toFixed(2)}`)
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `producao_pj_${monthKey}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <FileText size={20} className="text-teal-600" /> {labels.production || 'Apuração de Produção'}
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="p-2 border border-gray-300 rounded-lg text-xs bg-white"
          />
          <button
            onClick={() => setShowNfseModal(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors shadow-sm"
          >
            <Upload size={14} /> Enviar NFSe (PDF)
          </button>
          <button onClick={handleExportCSV} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700" title="Exportar CSV">
            <Download size={14} />
          </button>
          <button onClick={handlePrint} className="p-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg" title="Imprimir relatório de conferência">
            <Printer size={14} />
          </button>
        </div>
      </div>

      <p className="px-4 pt-3 text-[11px] text-gray-500">
        Base de conferência para as Notas Fiscais da competência. Não representa folha de pagamento nem controle de jornada.
      </p>

      <div className="overflow-x-auto p-4">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <th className="p-3 font-semibold">Prestador</th>
              <th className="p-3 font-semibold">Dias com Presença</th>
              <th className="p-3 font-semibold">Total de Horas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {production.length === 0 ? (
              <tr><td colSpan={3} className="p-8 text-center text-gray-400">Nenhum prestador nesta unidade.</td></tr>
            ) : (
              production.map((row) => (
                <tr key={row.professional.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-semibold text-gray-800">{row.professional.name}</td>
                  <td className="p-3 text-gray-600">{row.daysPresent}</td>
                  <td className="p-3 text-gray-600">{row.totalHours.toFixed(1)}h</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <NfseUploadModal
        isOpen={showNfseModal}
        onClose={() => {
          setShowNfseModal(false);
          fetchData();
        }}
        branding={branding}
      />
    </div>
  );
}
