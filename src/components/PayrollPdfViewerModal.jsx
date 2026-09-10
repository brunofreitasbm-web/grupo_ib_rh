import React from 'react';
import { X, Download, FileText, ExternalLink, Calendar, Building2, DollarSign } from 'lucide-react';

export default function PayrollPdfViewerModal({ isOpen, onClose, document: doc }) {
  if (!isOpen || !doc) return null;

  const getTipoFolhaLabel = (tipo) => {
    switch (tipo) {
      case 'mensal': return 'Folha Mensal Regular';
      case 'decimo_terceiro': return '13º Salário';
      case 'adiantamento': return 'Adiantamento Salarial';
      case 'rescisao': return 'Rescisão contratual';
      case 'encargos': return 'Encargos / FGTS / INSS';
      default: return 'Folha de Pagamento';
    }
  };

  const handleDownload = () => {
    if (!doc.content) return;
    const link = document.createElement('a');
    link.href = doc.content;
    link.download = doc.file_name || `folha-${doc.unit_id || 'unidade'}-${doc.competencia || 'pdf'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-white w-full max-w-5xl h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/30 text-indigo-400 rounded-lg">
              <FileText size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                {doc.file_name || 'Folha_de_Pagamento.pdf'}
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-indigo-500/30 text-indigo-300 rounded font-mono">
                  {doc.competencia}
                </span>
              </h2>
              <p className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1">
                  <Building2 size={12} className="text-slate-400" />
                  {doc.unit_name || doc.unit_id}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <DollarSign size={12} className="text-emerald-400" />
                  {typeof doc.valor === 'number'
                    ? doc.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    : doc.valor}
                </span>
                <span>•</span>
                <span>{getTipoFolhaLabel(doc.tipo_folha)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm"
              title="Baixar Arquivo PDF"
            >
              <Download size={14} />
              Baixar PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Informações detalhadas da folha */}
        {doc.observacoes && (
          <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 text-xs text-indigo-900 flex items-center gap-2 shrink-0">
            <span className="font-semibold text-indigo-700">Nota da Contabilidade:</span>
            <span>{doc.observacoes}</span>
          </div>
        )}

        {/* PDF Frame */}
        <div className="flex-1 bg-slate-200 relative overflow-hidden flex items-center justify-center">
          {doc.content ? (
            <iframe
              src={doc.content}
              title="Visualizador de PDF da Folha de Pagamento"
              className="w-full h-full border-0"
            />
          ) : (
            <div className="text-center p-8 text-slate-500">
              <FileText size={48} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">Conteúdo do arquivo não disponível para pré-visualização.</p>
              <p className="text-xs text-slate-400 mt-1">Faça o download para abrir localmente no leitor de PDF.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
