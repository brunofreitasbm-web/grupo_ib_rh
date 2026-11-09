// Recadastro de identidade do supervisor: o Hub de Gestão diz se há recadastro pendente e, se houver,
// o supervisor é levado à página do Hub. Tudo aqui é fail-open: qualquer falha (rede, timeout de 3 s,
// status != 200, JSON inválido, chave desligada) devolve null/'seguir' e nunca impede o login.

export const CHAVE_VISTO = 'fa_recad_visto';
const TIMEOUT_MS = 3000;
const HUB_URL_PADRAO = 'https://ivjvpdzsfjdpyabbzzuj.supabase.co/functions/v1/gestao-hub';
const HUB_HOST_PADRAO = 'gestao.institutofacaamigos.com.br';

// Entram no build: o Vite só troca pelo valor quando o acesso é direto (import.meta.env.VITE_X, sem ?.).
// Padrão desligado; ligar ou desligar exige novo build.
export function recadastroLigado() {
  return import.meta.env.VITE_GESTAO_RECADASTRO === '1';
}
const hubUrl = () => import.meta.env.VITE_GESTAO_HUB_URL || HUB_URL_PADRAO;
const hubHost = () => String(import.meta.env.VITE_GESTAO_HUB_HOST || HUB_HOST_PADRAO).trim().toLowerCase();

// Chama uma ação do Hub; devolve o JSON ou null. O token vai só no header Authorization.
async function chamarHub(action, accessToken, fetchImpl, extra = {}) {
  if (!recadastroLigado() || !accessToken) return null;
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  let timer;
  const limite = new Promise((resolve) => {
    timer = setTimeout(() => { ctrl?.abort(); resolve(null); }, TIMEOUT_MS);
  });
  const requisicao = (async () => {
    try {
      const res = await fetchImpl(hubUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action, sistema: 'rh', ...extra }),
        signal: ctrl?.signal,
      });
      if (!res || res.status !== 200) return null;
      return await res.json();
    } catch {
      return null;
    }
  })();
  try {
    return await Promise.race([requisicao, limite]);
  } finally {
    clearTimeout(timer);
  }
}

export async function consultarStatusRecadastro(accessToken, fetchImpl = fetch) {
  const d = await chamarHub('recadastro_status', accessToken, fetchImpl);
  if (!d || typeof d.pendente !== 'boolean' || typeof d.bloquear !== 'boolean') return null;
  return {
    pendente: d.pendente,
    bloquear: d.bloquear,
    dias_restantes: Number.isFinite(d.dias_restantes) ? d.dias_restantes : 0,
  };
}

// O mesmo app roda em mais de um endereço (Grupo IB e Porto Terapia): o Hub usa voltar_host, se estiver
// na lista dele, para montar o botão "Voltar ao sistema" da página de recadastro.
function hostAtual() {
  try { return typeof window !== 'undefined' ? String(window.location?.host ?? '') : ''; } catch { return ''; }
}

export async function pedirTicketRecadastro(accessToken, fetchImpl = fetch, voltarHost = hostAtual()) {
  const extra = voltarHost ? { voltar_host: voltarHost } : {};
  const d = await chamarHub('recadastro_ticket', accessToken, fetchImpl, extra);
  return d && typeof d.url === 'string' && d.url ? d.url : null;
}

export function decidirRecadastro(status, jaVisto) {
  if (!status) return 'seguir';
  if (status.bloquear) return 'ir';
  return status.pendente && !jaVisto ? 'ir' : 'seguir';
}

// Só https, hostname exato do Hub, sem usuário/senha. Devolve a URL normalizada ou null.
export function destinoRecadastro(url) {
  if (typeof url !== 'string' || !url) return null;
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  if (u.hostname.toLowerCase() !== hubHost()) return null;
  return u.href;
}

function lerVisto(storage) {
  try { return storage?.getItem(CHAVE_VISTO) === '1'; } catch { return false; }
}
function marcarVisto(storage) {
  try { storage?.setItem(CHAVE_VISTO, '1'); } catch { /* storage indisponível: segue */ }
}

// Retorna 'ir' só quando de fato redirecionou. Nunca lança.
export async function verificarRecadastro(accessToken, deps = {}) {
  try {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const storage = deps.storage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    const assign = deps.assign ?? ((u) => window.location.assign(u));
    const status = await consultarStatusRecadastro(accessToken, fetchImpl);
    if (decidirRecadastro(status, lerVisto(storage)) !== 'ir') return 'seguir';
    const destino = destinoRecadastro(await pedirTicketRecadastro(accessToken, fetchImpl, deps.host ?? hostAtual()));
    if (!destino) return 'seguir';
    marcarVisto(storage);
    assign(destino);
    return 'ir';
  } catch {
    return 'seguir';
  }
}
