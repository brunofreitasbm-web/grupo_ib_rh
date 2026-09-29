import { supabase } from '../supabase';

// Porta de entrada do Hub de Gestão (gestao.institutofacaamigos.com.br).
// O hub gera, com a service role do projeto, um magic link que nunca é
// enviado por e-mail e abre `/sso?token_hash=…` aqui; verifyOtp troca esse
// token (uso único) por uma sessão normal, e o handleSession do App.jsx leva
// o supervisor direto para o painel. Roda antes do primeiro render.
export async function consumeHubSsoTicket() {
  if (window.location.pathname !== '/sso') return;
  const tokenHash = new URLSearchParams(window.location.search).get('token_hash');
  // Tira o token da barra de endereço e do histórico antes de qualquer coisa.
  window.history.replaceState(null, '', '/');
  if (!tokenHash) return;

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
  if (error) console.error('[sso] ticket do Hub de Gestão recusado:', error.message);
}
