import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { List, AlertTriangle, LogIn, LogOut, MapPin, FileText, Timer, Camera, X, Download } from 'lucide-react';
import { supabase } from '../../supabase';
import { mapInternFromDb, mapRecordFromDb, mapUnitFromDb } from '../../utils/mappings';
import { startOfWeek, formatDistance, formatDate, formatTime } from '../../utils/helpers';

export default function FrequenciaTab({ filterUnit }) {
  const [interns, setInterns] = useState([]);
  const [records, setRecords] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedRecordPhoto, setSelectedRecordPhoto] = useState(null);
  const [viewDocBase64, setViewDocBase64] = useState(null);
  const [viewDocName, setViewDocName] = useState('');
  const [viewDocType, setViewDocType] = useState('');

  const LABOR = {
    maxDailyHours: 6,
    maxWeeklyHours: 30,
  };

  const fetchData = useCallback(async () => {
    try {
      const { data: internsData } = await supabase
        .from('interns')
        .select('*')
        .order('name', { ascending: true });

      const { data: unitsData } = await supabase
        .from('units')
        .select('*')
        .order('name', { ascending: true });

      const { data: recordsData } = await supabase
        .from('records')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(250); // limit to recent records for speed

      if (internsData) setInterns(internsData.map(mapInternFromDb));
      if (unitsData) setUnits(unitsData.map(mapUnitFromDb));
      if (recordsData) setRecords(recordsData.map(mapRecordFromDb));
    } catch (err) {
      console.error('Erro ao carregar frequencias:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const recordsChannel = supabase
      .channel('frequencia-records-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, () => {
        fetchData();
      })
      .subscribe();

    const internsChannel = supabase
      .channel('frequencia-interns-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interns' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(recordsChannel);
      supabase.removeChannel(internsChannel);
    };
  }, [fetchData]);

  const unitName = (id) => units.find((u) => u.id === id)?.name || '—';

  const filteredRecords = useMemo(() => {
    return filterUnit === 'all'
      ? records
      : records.filter((r) => r.geo?.unitId === filterUnit);
  }, [records, filterUnit]);

  // Calulate Hours Summary
  const hoursSummary = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const wStart = startOfWeek();

    const filteredInterns = interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit);
    const filteredInternNames = new Set(filteredInterns.map(i => i.name));

    const daily = {};
    records.forEach((r) => {
      const matchesUnit = filterUnit === 'all' || r.geo?.unitId === filterUnit || filteredInternNames.has(r.internName);
      if (!matchesUnit) return;

      const d = new Date(r.timestamp);
      const dateKey = d.toLocaleDateString('pt-BR');
      const key = `${r.internName}|${dateKey}`;
      if (!daily[key]) daily[key] = { name: r.internName, day: new Date(d), events: [] };
      daily[key].events.push({ action: r.action, time: d.getTime() });
    });

    const per = {};
    Object.values(daily).forEach((g) => {
      g.events.sort((a, b) => a.time - b.time);
      let totalMs = 0;
      let lastEntradaTime = null;
      g.events.forEach((e) => {
        if (e.action === 'entrada') {
          if (lastEntradaTime === null) {
            lastEntradaTime = e.time;
          }
        } else if (e.action === 'saida') {
          if (lastEntradaTime !== null) {
            totalMs += (e.time - lastEntradaTime);
            lastEntradaTime = null;
          }
        }
      });
      const hrs = totalMs / (1000 * 60 * 60);
      if (hrs <= 0) return;
      const dayStart = new Date(g.day);
      dayStart.setHours(0, 0, 0, 0);
      if (!per[g.name]) per[g.name] = { today: 0, week: 0 };
      if (dayStart.getTime() === todayStart.getTime()) per[g.name].today += hrs;
      if (dayStart >= wStart) per[g.name].week += hrs;
    });

    const rows = filteredInterns.map((i) => ({
      name: i.name,
      today: per[i.name]?.today || 0,
      week: per[i.name]?.week || 0,
    }));
    
    if (filterUnit === 'all') {
      Object.keys(per).forEach((name) => {
        if (!rows.find((r) => r.name === name)) {
          rows.push({ name, today: per[name].today, week: per[name].week, removed: true });
        }
      });
    }
    rows.sort((a, b) => b.week - a.week);
    return rows;
  }, [records, interns, filterUnit]);

  const handleExportCSV = () => {
    const headers = 'Data,Hora,Estagiário,Unidade,Movimentação,Distância (km),Justificativa\n';
    const csvContent = filteredRecords
      .map((r) => {
        const d = new Date(r.timestamp);
        const data = d.toLocaleDateString('pt-BR');
        const hora = d.toLocaleTimeString('pt-BR');
        const unidade = r.geo?.unitName ? `"${r.geo.unitName}"` : '';
        const dist = r.geo?.distanceKm != null ? r.geo.distanceKm : '';
        const just = r.justification ? `"${r.justification.replace(/"/g, '""')}"` : '';
        return `${data},${hora},"${r.internName}",${unidade},${r.action},${dist},${just}`;
      })
      .join('\n');

    const blob = new Blob([headers + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const unitSuffix = filterUnit === 'all' ? 'todas' : filterUnit;
    link.download = `frequencia_portoterapia_${unitSuffix}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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

  const renderHoursSummary = () => (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <Timer size={20} /> Horas Acumuladas por Estagiário
        </h2>
        <span className="text-xs text-gray-500">Limites: {LABOR.maxDailyHours}h/dia • {LABOR.maxWeeklyHours}h/semana</span>
      </div>
      <div className="overflow-x-auto">
        {hoursSummary.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Sem dados de horas ainda.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider border-b border-gray-200">
                <th className="p-4 font-medium">Estagiário</th>
                <th className="p-4 font-medium">Hoje</th>
                <th className="p-4 font-medium">Esta semana</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {hoursSummary.map((row, idx) => {
                const overDay = row.today > LABOR.maxDailyHours;
                const overWeek = row.week > LABOR.maxWeeklyHours;
                return (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-gray-800">
                      {row.name}
                      {row.removed && <span className="ml-2 text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">removido</span>}
                    </td>
                    <td className={`p-4 text-sm font-semibold ${overDay ? 'text-red-600' : 'text-gray-700'}`}>
                      {row.today.toFixed(1)}h {overDay && <AlertTriangle size={12} className="inline mb-0.5" />}
                    </td>
                    <td className={`p-4 text-sm font-semibold ${overWeek ? 'text-red-600' : 'text-gray-700'}`}>
                      {row.week.toFixed(1)}h / {LABOR.maxWeeklyHours}h
                      {overWeek && <AlertTriangle size={12} className="inline mb-0.5 ml-1" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {renderHoursSummary()}

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <List size={20} /> Histórico Sincronizado
            {filterUnit !== 'all' && (
              <span className="text-xs font-normal text-gray-500">• {unitName(filterUnit)}</span>
            )}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition-colors inline-flex items-center gap-1.5"
            >
              <Download size={15} /> Exportar CSV
            </button>
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded flex items-center">
              {filteredRecords.length} {filterUnit === 'all' ? 'registros na nuvem' : 'registros'}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          {filteredRecords.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhum registro de frequência encontrado.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                  <th className="p-3 font-semibold text-center w-14">Identificação</th>
                  <th className="p-3 font-semibold">Data / Hora</th>
                  <th className="p-3 font-semibold">Estagiário</th>
                  <th className="p-3 font-semibold">Unidade</th>
                  <th className="p-3 font-semibold">Movimentação</th>
                  <th className="p-3 font-semibold">Local</th>
                  <th className="p-3 font-semibold">Justificativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors text-xs">
                    <td className="p-3 whitespace-nowrap text-center">
                      {record.photo ? (
                        <button
                          type="button"
                          onClick={() => setSelectedRecordPhoto(record)}
                          className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 hover:ring-2 hover:ring-blue-500 transition-all flex items-center justify-center bg-slate-100 mx-auto"
                          title="Clique para ampliar foto de biometria"
                        >
                          <img src={record.photo} alt="Face check" className="w-full h-full object-cover" />
                        </button>
                      ) : record.isManual ? (
                        <span
                          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-amber-50 text-amber-700 border border-dashed border-amber-300 text-[8px] font-bold mx-auto leading-none"
                          title="Bateu ponto sem Controle Facial (Manual)"
                        >
                          MANUAL
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">sem foto</span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap text-gray-700">
                      <div className="font-semibold">{formatDate(record.timestamp)}</div>
                      <div className="text-gray-500">{formatTime(record.timestamp)}</div>
                    </td>
                    <td className="p-3 font-medium text-gray-800">{record.internName}</td>
                    <td className="p-3 text-gray-600">{record.geo?.unitName || '—'}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                        record.action === 'ocorrencia' 
                          ? 'bg-amber-100 text-amber-800' 
                          : record.action === 'entrada' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {record.action === 'ocorrencia' 
                          ? <AlertTriangle size={10} /> 
                          : record.action === 'entrada' ? <LogIn size={10} /> : <LogOut size={10} />}
                        {record.action === 'ocorrencia' 
                          ? 'Ocorrência' 
                          : record.action === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="p-3">
                      {record.geo ? (
                        <span
                          className="inline-flex items-center gap-1 text-emerald-700 font-medium"
                          title={`Lat ${record.geo.lat}, Lng ${record.geo.lng} (precisão ~${record.geo.accuracy}m)`}
                        >
                          <MapPin size={10} />
                          {record.geo.distanceM != null ? `${Math.round(record.geo.distanceM)} m` : formatDistance(record.geo.distanceKm)}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-[10px]">sem GPS</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-600 max-w-xs">
                      <div className="truncate font-medium text-gray-800" title={record.justification}>
                        {record.justification || <span className="text-gray-400 italic">Sem anotações</span>}
                      </div>
                      {record.justificationDoc && (
                        <button
                          type="button"
                          onClick={() => {
                            setViewDocBase64(record.justificationDoc.content);
                            setViewDocName(record.justificationDoc.name);
                            setViewDocType(`Comprovante: ${record.justificationDoc.type.toUpperCase()}`);
                          }}
                          className="inline-flex items-center gap-1 text-[9px] text-indigo-600 hover:text-indigo-800 font-semibold mt-1 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 transition-colors shadow-sm"
                          title="Clique para abrir comprovante de ocorrência"
                        >
                          <FileText size={10} />
                          Anexo: {record.justificationDoc.type.toUpperCase()} ({record.justificationDoc.size})
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Local Photo Modal */}
      {selectedRecordPhoto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in animate-once">
          <div className={`bg-white rounded-2xl shadow-2xl p-6 w-full ${interns.find(i => i.id === selectedRecordPhoto.internId)?.photo ? 'max-w-2xl' : 'max-w-sm'} relative transition-all duration-300`}>
            <button
              onClick={() => setSelectedRecordPhoto(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 rounded-full p-1 border border-gray-100"
            >
              <X size={18} />
            </button>
            <div className="text-center mb-4">
              <h3 className="text-base font-bold text-gray-800 flex items-center justify-center gap-1.5">
                <Camera size={18} className="text-blue-500" /> Biometria de Reconhecimento
              </h3>
            </div>

            {interns.find(i => i.id === selectedRecordPhoto.internId)?.photo ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
                <div className="flex flex-col items-center">
                  <span className="text-[11px] font-semibold text-slate-500 mb-1.5">Foto do Cadastro</span>
                  <div className="aspect-[3/4] w-36 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm flex items-center justify-center">
                    <img
                      src={interns.find(i => i.id === selectedRecordPhoto.internId)?.photo}
                      alt="Cadastro"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[11px] font-semibold text-slate-500 mb-1.5">Biometria do Ponto</span>
                  <div className="aspect-[3/4] w-36 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm flex items-center justify-center">
                    <img
                      src={selectedRecordPhoto.photo}
                      alt="Reconhecimento"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="aspect-[4/3] w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 mb-4 flex items-center justify-center">
                <img
                  src={selectedRecordPhoto.photo}
                  alt="Reconhecimento"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="bg-slate-50 rounded-xl p-3 text-[11px] space-y-1.5 text-slate-600 border border-gray-100">
              <p><strong>Estagiário:</strong> {selectedRecordPhoto.internName}</p>
              <p><strong>Data/Hora:</strong> {formatDate(selectedRecordPhoto.timestamp)} às {formatTime(selectedRecordPhoto.timestamp)}</p>
              <p><strong>Operação:</strong> {selectedRecordPhoto.action === 'entrada' ? 'Entrada' : 'Saída'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Local Document View Modal */}
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
