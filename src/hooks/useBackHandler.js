import { useEffect, useRef } from 'react';

// Botão/gesto "voltar" do celular dentro de uma SPA que navega por estado.
//
// useBackHandler(depth, onBack):
//   depth  = quantos passos de "voltar" internos existem agora (0 = raiz).
//   onBack = desfaz UM passo (chamado quando o usuário aperta voltar).
//
// Mecanismo central e único: cada nível vira 1 entrada no histórico do
// navegador (pushState, mesma URL). Um único listener de popstate descobre
// qual entrada saiu e chama o onBack do dono dela. Na raiz (depth 0) nada é
// empilhado, então "voltar" sai do site normalmente.

const MARK = '__backHandler';

const owners = new Set(); // { depth, onBack }
let entries = []; // pilha global: { id, owner } — ordem de empilhar = ordem de desfazer
let suppress = 0; // popstates que nós mesmos causamos (history.go) e devem ser ignorados
let dirty = false; // houve mudança de depth enquanto aguardávamos um popstate suprimido
let suppressTimer = null;
let seq = 0;
let listening = false;

const newId = () => `${Date.now()}-${++seq}`;
const ownedBy = (owner) => entries.reduce((n, e) => n + (e.owner === owner ? 1 : 0), 0);

function armSuppress() {
  suppress += 1;
  clearTimeout(suppressTimer);
  // Rede de segurança: se o navegador não emitir o popstate esperado
  // (ex.: go() além do início do histórico), não travamos para sempre.
  suppressTimer = setTimeout(() => {
    suppress = 0;
    syncAll();
  }, 500);
}

function consumeSuppress() {
  suppress -= 1;
  if (suppress > 0) return;
  suppress = 0;
  clearTimeout(suppressTimer);
  if (dirty) syncAll();
}

// Remove `n` entradas do dono. As que estão no topo saem do histórico com
// history.go(-k); as que estão enterradas sob outro dono viram "órfãs" (ficam
// no histórico, mas o popstate delas é pulado).
function shrink(owner, n) {
  let k = 0;
  while (k < n && entries[entries.length - 1 - k]?.owner === owner) k += 1;
  if (k > 0) entries.splice(entries.length - k, k);
  let rest = n - k;
  for (let i = entries.length - 1; i >= 0 && rest > 0; i -= 1) {
    if (entries[i].owner === owner) {
      entries[i].owner = null;
      rest -= 1;
    }
  }
  if (k > 0) {
    armSuppress();
    window.history.go(-k);
  }
}

function syncAll() {
  if (suppress > 0) {
    dirty = true;
    return;
  }
  dirty = false;
  for (const owner of owners) {
    const owned = ownedBy(owner);
    if (owner.depth > owned) {
      for (let i = owned; i < owner.depth; i += 1) {
        const id = newId();
        window.history.pushState({ ...(window.history.state || {}), [MARK]: id }, '');
        entries.push({ id, owner });
      }
    } else if (owner.depth < owned) {
      shrink(owner, owned - owner.depth);
      if (suppress > 0) {
        dirty = true; // o restante é reconciliado quando o popstate suprimido chegar
        return;
      }
    }
  }
}

function handlePopState(event) {
  if (suppress > 0) {
    consumeSuppress();
    return;
  }
  const dest = event.state?.[MARK] ?? null; // null = entrada-base (a raiz do app)
  let popCount;
  if (dest === null) {
    popCount = entries.length;
  } else {
    const idx = entries.findIndex((e) => e.id === dest);
    if (idx < 0) {
      // Entrada que não conhecemos: sobrou de um reload ou veio de "avançar".
      // Não há tela correspondente, então pula para a anterior.
      window.history.back();
      return;
    }
    popCount = entries.length - 1 - idx;
  }
  if (popCount === 0) return;

  const popped = entries.splice(entries.length - popCount, popCount);
  const handler = [...popped].reverse().find((e) => e.owner)?.owner;
  if (handler) {
    handler.onBack();
  } else if (dest !== null) {
    window.history.back(); // só órfãs saíram: o usuário não deve sentir um "voltar" morto
  }
  // Se o onBack não reduziu o depth, o histórico ficou com uma entrada a menos
  // que o estado: ressincroniza depois que o React aplicar o setState.
  setTimeout(syncAll, 0);
}

function ensureListener() {
  if (listening || typeof window === 'undefined') return;
  window.addEventListener('popstate', handlePopState);
  listening = true;
}

export function useBackHandler(depth, onBack) {
  const ownerRef = useRef(null);
  if (!ownerRef.current) ownerRef.current = { depth: 0, onBack };
  const owner = ownerRef.current;

  // Sempre o closure mais recente, sem depender de re-registrar.
  useEffect(() => {
    owner.onBack = onBack;
  });

  useEffect(() => {
    ensureListener();
    owner.depth = Math.max(0, depth | 0);
    owners.add(owner);
    syncAll();
  }, [depth, owner]);

  useEffect(() => () => {
    owner.depth = 0;
    syncAll();
    owners.delete(owner);
  }, [owner]);
}

// Só para testes: zera o estado do módulo.
export function __resetBackHandlerForTests() {
  if (listening) window.removeEventListener('popstate', handlePopState);
  listening = false;
  owners.clear();
  entries = [];
  suppress = 0;
  dirty = false;
  clearTimeout(suppressTimer);
}

// Açúcar para telas com várias camadas (modais, formulários, sub-abas):
// `layers` vai da camada mais interna para a mais externa; só as ativas contam.
// O voltar do celular desfaz a primeira ativa.
export function useBackLayers(layers) {
  const active = layers.filter((layer) => layer.active);
  useBackHandler(active.length, () => active[0]?.back());
}
