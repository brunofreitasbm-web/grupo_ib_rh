// "Esqueci minha senha" do supervisor. O código de 6 dígitos e a troca da senha são feitos pela função
// `recuperar-senha` (projeto A), que fala com o login deste sistema. Aqui só há a chamada e a leitura
// da resposta: limite de tentativas, validade do código e quem pode recuperar ficam no servidor
// (que recusa, por exemplo, as contas de unidade do quiosque).

const URL_PADRAO = 'https://ivjvpdzsfjdpyabbzzuj.supabase.co/functions/v1/recuperar-senha';

export function urlRecuperarSenha() {
  return import.meta.env?.VITE_RECUPERAR_SENHA_URL || URL_PADRAO;
}

// Regra de senha da Clínica (a conta é a mesma): 6+ caracteres, uma maiúscula e um caractere especial.
export function senhaForte(senha) {
  return typeof senha === 'string' && senha.length >= 6 && /[A-Z]/.test(senha) && /[^A-Za-z0-9]/.test(senha);
}

async function chamar(corpo, fetchImpl) {
  try {
    const res = await fetchImpl(urlRecuperarSenha(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const dados = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        erro: typeof dados.error === 'string' ? dados.error : 'Não foi possível concluir agora. Tente de novo.',
        reiniciar: dados.reiniciar === true,
      };
    }
    return { ok: true, ...dados };
  } catch {
    return { ok: false, erro: 'Sem conexão. Confira a internet e tente de novo.', reiniciar: false };
  }
}

// A resposta é a mesma exista a conta ou não; sem e-mail real cadastrado nada chega.
export function pedirCodigo(email, fetchImpl = fetch) {
  return chamar({ action: 'pedir', sistema: 'rh', identificador: String(email || '').trim() }, fetchImpl);
}

export function redefinirSenha(challengeId, codigo, novaSenha, fetchImpl = fetch) {
  return chamar(
    { action: 'redefinir', challenge_id: challengeId, code: String(codigo || '').replace(/\D/g, ''), new_password: novaSenha },
    fetchImpl,
  );
}
