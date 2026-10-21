import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { fileToBase64 } from '../utils/mappings';
import { Upload, FileText, CheckCircle2, AlertCircle, Building2, User, Calendar, DollarSign, Hash, Loader2 } from 'lucide-react';

const fmtBRL = (val) => (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PjInvoiceUploadPage() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');

  // Campos do formulário (mês e valor vêm pré-preenchidos automaticamente, mas são editáveis pelo prestador)
  const [competencia, setCompetencia] = useState('');
  const [valor, setValor] = useState('');
  const [numeroNf, setNumeroNf] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      if (!token) {
        setError('Link de envio de nota fiscal inválido ou incompleto.');
        setLoading(false);
        return;
      }

      try {
        const { data, error: rpcError } = await supabase.rpc('get_pj_invoice_session', { p_token: token });

        if (!active) return;

        if (rpcError) throw rpcError;

        if (!data || !data.ok) {
          const errCode = data?.error;
          if (errCode === 'token_expirado') {
            setError('Este link expirou. Por favor, solicite ao RH o reenvio do link de envio da NFSe.');
          } else if (errCode === 'token_invalido') {
            setError('Link inválido ou já revogado. Verifique se o endereço do link está correto.');
          } else {
            setError('Não foi possível validar o link de envio de NFSe.');
          }
          return;
        }

        setSession(data);
        setCompetencia(data.competencia || new Date().toISOString().substring(0, 7));

        // Formata valor inicial sugerido da apuração
        const initVal = Number(data.calculated_amount) || 0;
        setValor(initVal > 0 ? (initVal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
      } catch (err) {
        if (!active) return;
        console.error('Erro ao verificar sessão de envio de NFSe:', err);
        setError('Erro ao carregar a página de envio de Nota Fiscal. Tente novamente mais tarde.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSession();
    return () => { active = false; };
  }, [token]);

  const handleValorChange = (e) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setValor('');
      return;
    }
    const numeric = (parseInt(raw, 10) / 100).toFixed(2);
    setValor(numeric.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
  };

  const parseValorNumeric = (valStr) => {
    if (!valStr) return 0;
    const cleaned = String(valStr).replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    setSubmitError('');
    if (!selectedFile) return;

    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setSubmitError('Por favor, selecione um arquivo no formato PDF.');
      setFile(null);
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setSubmitError('O arquivo excede o tamanho limite de 5MB.');
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!competencia) {
      setSubmitError('Informe o mês de apuração (competência).');
      return;
    }

    const valorNum = parseValorNumeric(valor);
    if (!valorNum || valorNum <= 0) {
      setSubmitError('Informe o valor total da Nota Fiscal (maior que zero).');
      return;
    }

    if (!file) {
      setSubmitError('Anexe o arquivo em formato PDF da sua Nota Fiscal.');
      return;
    }

    setSubmitting(true);
    try {
      const base64 = await fileToBase64(file);
      const fileSize = (file.size / 1024).toFixed(1) + ' KB';

      const { data, error: rpcErr } = await supabase.rpc('submit_pj_invoice', {
        p_token: token,
        p_competencia: competencia,
        p_numero_nf: numeroNf.trim() || null,
        p_valor: valorNum,
        p_pdf_content: base64,
        p_file_name: file.name,
        p_file_size: fileSize,
      });

      if (rpcErr) throw rpcErr;

      if (!data || !data.ok) {
        throw new Error(data?.error || 'Falha ao processar o envio.');
      }

      setSuccess({
        competencia,
        valor: valorNum,
        numeroNf: numeroNf.trim() || '—',
        fileName: file.name,
      });
    } catch (err) {
      console.error('Erro ao enviar NFSe:', err);
      setSubmitError(err?.message || 'Erro ao enviar a Nota Fiscal. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Loading Skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f1ea] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-lg p-8 animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/2 mx-auto"></div>
          <div className="h-4 bg-slate-100 rounded w-3/4 mx-auto"></div>
          <div className="h-24 bg-slate-50 rounded-2xl"></div>
          <div className="h-12 bg-slate-200 rounded-xl"></div>
          <div className="h-12 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  // 2. Erro no Token
  if (error) {
    return (
      <div className="min-h-screen bg-[#f4f1ea] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center border-t-8 border-rose-500">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Link Indisponível</h1>
          <p className="text-sm text-slate-600 mb-6">{error}</p>
          <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-500 text-left">
            Caso precise emitir sua nota ou solicitar um novo link, entre em contato direto com a equipe de Recursos Humanos / Gestão de Pessoas do FaçaAmigos.
          </div>
        </div>
      </div>
    );
  }

  // 3. Sucesso após envio
  if (success) {
    return (
      <div className="min-h-screen bg-[#f4f1ea] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-8 text-center border-t-8 border-emerald-500">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={36} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Nota Fiscal Enviada!</h1>
          <p className="text-sm text-slate-600 mb-6">
            Sua NFSe foi recebida com sucesso e incluída na Apuração de Produção para conferência do RH.
          </p>

          <div className="bg-slate-50 rounded-2xl p-5 text-left text-xs space-y-2 border border-slate-100 mb-6">
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">Prestador:</span>
              <span className="font-semibold text-slate-800">{session?.professional_name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">Unidade:</span>
              <span className="font-semibold text-slate-800">{session?.unit_name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">Competência informada:</span>
              <span className="font-semibold text-slate-800">{success.competencia}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">Valor da Nota:</span>
              <span className="font-bold text-emerald-700 text-sm">{fmtBRL(success.valor)}</span>
            </div>
            {success.numeroNf && success.numeroNf !== '—' && (
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Número da NF:</span>
                <span className="font-semibold text-slate-800">{success.numeroNf}</span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Arquivo:</span>
              <span className="font-medium text-slate-700 truncate max-w-[200px]">{success.fileName}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-4">
            Assim que validada pelo operador de RH, a nota seguirá automaticamente para a programação de pagamento pelo Financeiro.
          </p>
        </div>
      </div>
    );
  }

  // 4. Formulário de Upload
  const valorApurado = Number(session?.calculated_amount) || 0;
  const valorDigitado = parseValorNumeric(valor);
  const temDivergencia = valorApurado > 0 && valorDigitado > 0 && Math.abs(valorApurado - valorDigitado) > 0.05;

  return (
    <div className="min-h-screen bg-[#f4f1ea] py-10 px-4 flex flex-col justify-center items-center">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        {/* Faixa decorativa FaçaAmigos */}
        <div className="h-2.5 bg-[#FFE234] w-full" />

        <div className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800">
              Envio de Nota Fiscal de Serviços (NFSe)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              FaçaAmigos • Gestão de Pessoas & Produção PJ
            </p>
          </div>

          {/* Card Resumo do Prestador e Apuração */}
          <div className="bg-[#f0fdf4] border border-[#0d9488]/30 rounded-2xl p-4 sm:p-5 mb-6 text-xs text-slate-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <User size={16} className="text-teal-700 shrink-0" />
                <div>
                  <div className="text-[10px] text-teal-800 uppercase font-semibold">Prestador / PJ</div>
                  <div className="font-bold text-slate-800 text-sm">{session?.professional_name}</div>
                  {session?.cnpj && <div className="text-[11px] text-slate-500">{session.cnpj}</div>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-teal-700 shrink-0" />
                <div>
                  <div className="text-[10px] text-teal-800 uppercase font-semibold">Unidade de Atendimento</div>
                  <div className="font-bold text-slate-800">{session?.unit_name}</div>
                </div>
              </div>
            </div>

            {valorApurado > 0 && (
              <div className="mt-3 pt-3 border-t border-teal-200/60 flex items-center justify-between">
                <span className="text-teal-900 font-medium">Valor Apurado pelo Sistema:</span>
                <span className="text-base font-extrabold text-teal-800">{fmtBRL(valorApurado)}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {submitError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Mês de Apuração (Editável, vem automático) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Calendar size={14} className="text-teal-600" /> Mês de Apuração (Competência)
                </label>
                <input
                  type="month"
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all outline-none"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Pré-preenchido automaticamente. Altere se necessário.
                </span>
              </div>

              {/* Valor da Nota Fiscal (Editável, vem automático) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-teal-600" /> Valor da Nota Fiscal (R$)
                </label>
                <input
                  type="text"
                  value={valor}
                  onChange={handleValorChange}
                  placeholder="0,00"
                  className={`w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 transition-all outline-none ${
                    temDivergencia ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500' : 'border-slate-200 focus:border-teal-500 focus:ring-teal-500'
                  }`}
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Informe o valor emitido na NFSe.
                </span>
              </div>
            </div>

            {temDivergencia && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 text-amber-600 mt-0.5" />
                <span>
                  <strong>Atenção:</strong> O valor digitado (<strong>{fmtBRL(valorDigitado)}</strong>) é diferente do valor apurado no sistema (<strong>{fmtBRL(valorApurado)}</strong>). O operador do RH analisará a divergência durante a validação.
                </span>
              </div>
            )}

            {/* Número da Nota Fiscal */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Hash size={14} className="text-teal-600" /> Número da NFSe (Opcional)
              </label>
              <input
                type="text"
                value={numeroNf}
                onChange={(e) => setNumeroNf(e.target.value)}
                placeholder="Ex: 2026/00142"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all outline-none"
              />
            </div>

            {/* Upload do Arquivo PDF */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <FileText size={14} className="text-teal-600" /> Anexar Arquivo da Nota Fiscal (PDF)
              </label>
              <div className="relative border-2 border-dashed border-slate-200 hover:border-teal-500 rounded-2xl p-6 text-center transition-colors bg-slate-50 hover:bg-teal-50/20">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  id="pdf-upload"
                />
                <Upload size={28} className="mx-auto text-slate-400 mb-2" />
                {file ? (
                  <div>
                    <div className="text-xs font-bold text-teal-700 truncate max-w-xs mx-auto">{file.name}</div>
                    <div className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(1)} KB — Clique para trocar</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-semibold text-slate-700">Clique para selecionar o PDF da NFSe</div>
                    <div className="text-[10px] text-slate-400 mt-1">Limite máximo: 5MB • Formato PDF</div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || !file}
                className="w-full py-3.5 px-6 bg-[#F0196B] hover:bg-[#d6135c] text-white font-extrabold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Enviando Nota Fiscal...</span>
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    <span>Enviar Nota Fiscal para o RH</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
