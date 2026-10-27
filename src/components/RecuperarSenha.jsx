import React, { useState } from 'react';
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react';
import { pedirCodigo, redefinirSenha, senhaForte } from '../utils/recuperarSenha';

// "Esqueci minha senha" do supervisor: código de 6 dígitos no e-mail da conta e nova senha.
// `email` e `nome` vêm da conta escolhida na tela de login (BRANDING.adminUsers).
export default function RecuperarSenha({ email, nome, onVoltar }) {
  const [etapa, setEtapa] = useState('pedir'); // pedir | codigo | pronto
  const [challengeId, setChallengeId] = useState('');
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);

  const recomecar = () => {
    setEtapa('pedir');
    setChallengeId('');
    setCodigo('');
    setSenha('');
    setConfirma('');
  };

  const pedir = async (e) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    const r = await pedirCodigo(email);
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    setChallengeId(r.challenge_id);
    setAviso(r.mensagem || 'Se os dados conferem, enviamos um código para o e-mail cadastrado.');
    setEtapa('codigo');
  };

  const redefinir = async (e) => {
    e.preventDefault();
    setErro('');
    setAviso('');
    setEnviando(true);
    const r = await redefinirSenha(challengeId, codigo, senha);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro);
      if (r.reiniciar) recomecar();
      return;
    }
    setEtapa('pronto');
  };

  const classeInput =
    'w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs';
  const classeBotao =
    'w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-xs shadow-md disabled:opacity-50';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-2">
        <button type="button" onClick={onVoltar} aria-label="Voltar ao login" className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={16} />
        </button>
        <span className="text-xs font-semibold text-gray-600">Esqueci minha senha</span>
      </div>

      {etapa === 'pronto' ? (
        <>
          <p className="text-emerald-700 text-xs text-center font-semibold">Senha alterada. Entre com a nova senha.</p>
          <button type="button" onClick={onVoltar} className={classeBotao}>Ir para o login</button>
        </>
      ) : etapa === 'pedir' ? (
        <form onSubmit={pedir} className="space-y-4">
          <p className="text-xs text-gray-600">
            Enviamos um código de 6 dígitos para o e-mail cadastrado de <strong>{nome}</strong>. Se a conta não tiver
            e-mail cadastrado, fale com o owner.
          </p>
          {erro && <p className="text-red-500 text-xs text-center font-semibold">{erro}</p>}
          <button type="submit" disabled={enviando} className={classeBotao}>
            {enviando ? <><Loader2 size={15} className="animate-spin" /> Enviando...</> : <><KeyRound size={15} /> Enviar código</>}
          </button>
        </form>
      ) : (
        <form onSubmit={redefinir} className="space-y-4">
          {aviso && <p className="text-emerald-700 text-xs">{aviso}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="rs-codigo">Código de 6 dígitos</label>
            <input id="rs-codigo" type="text" inputMode="numeric" maxLength={6} autoFocus required value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              className={`${classeInput} text-center text-base tracking-widest font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="rs-senha">Nova senha</label>
            <input id="rs-senha" type="password" autoComplete="new-password" required value={senha}
              onChange={(e) => setSenha(e.target.value)} className={classeInput} />
            <p className={`mt-1 text-[11px] ${senhaForte(senha) ? 'text-emerald-600' : 'text-gray-400'}`}>
              Pelo menos 6 caracteres, uma letra maiúscula e um caractere especial.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="rs-confirma">Confirmar nova senha</label>
            <input id="rs-confirma" type="password" autoComplete="new-password" required value={confirma}
              onChange={(e) => setConfirma(e.target.value)} className={classeInput} />
            {confirma.length > 0 && confirma !== senha && <p className="mt-1 text-[11px] text-red-500">As senhas não conferem.</p>}
          </div>
          {erro && <p className="text-red-500 text-xs text-center font-semibold">{erro}</p>}
          <button type="submit" disabled={enviando || codigo.length !== 6 || !senhaForte(senha) || senha !== confirma} className={classeBotao}>
            {enviando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Salvar nova senha'}
          </button>
        </form>
      )}
    </div>
  );
}
