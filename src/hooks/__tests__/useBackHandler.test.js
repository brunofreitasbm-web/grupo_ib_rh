// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useBackHandler, __resetBackHandlerForTests } from '../useBackHandler';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const tick = (ms = 20) => act(() => new Promise((r) => setTimeout(r, ms)));
const back = async () => {
  await act(async () => { window.history.back(); await new Promise((r) => setTimeout(r, 20)); });
  await tick();
};

let api;
function Screen() {
  const [stack, setStack] = useState([]); // telas empilhadas (0 = raiz)
  useBackHandler(stack.length, () => setStack((s) => s.slice(0, -1)));
  api = { push: (n) => setStack((s) => [...s, n]), pop: () => setStack((s) => s.slice(0, -1)), stack };
  return null;
}
let root;
let container;
const mount = async () => {
  container = document.createElement('div');
  root = createRoot(container);
  await act(async () => root.render(React.createElement(Screen)));
};

beforeEach(async () => {
  __resetBackHandlerForTests();
  window.history.replaceState(null, '', '/');
  await mount();
});
afterEach(async () => {
  await act(async () => root.unmount());
});

describe('useBackHandler', () => {
  it('voltar desfaz um nível por vez', async () => {
    const base = window.history.length;
    await act(async () => { api.push('a'); });
    await act(async () => { api.push('b'); });
    expect(window.history.length).toBe(base + 2);
    await back();
    expect(api.stack).toEqual(['a']);
    await back();
    expect(api.stack).toEqual([]);
  });

  it('sair da subtela por botão da tela remove as entradas e não dispara onBack', async () => {
    await act(async () => { api.push('a'); });
    await act(async () => { api.push('b'); });
    await act(async () => { api.pop(); api.pop(); });
    await tick(60);
    expect(api.stack).toEqual([]);
    // histórico limpo: o próximo "voltar" não mexe no app (sairia do site)
    await act(async () => { api.push('c'); });
    await back();
    expect(api.stack).toEqual([]);
  });

  it('na raiz não empilha nada', async () => {
    const base = window.history.length;
    await tick();
    expect(window.history.length).toBe(base);
  });

  it('ressincroniza quando o onBack não reduz o depth', async () => {
    let blocked = true;
    function Stubborn() {
      const [d, setD] = useState(1);
      useBackHandler(d, () => { if (!blocked) setD(0); });
      return null;
    }
    await act(async () => root.unmount());
    root = createRoot(document.createElement('div'));
    await act(async () => root.render(React.createElement(Stubborn)));
    await back(); // onBack ignora -> entrada reposta
    await tick(30);
    blocked = false;
    await back();
    expect(window.history.state?.__backHandler).toBeUndefined();
  });

  it('ao desmontar limpa as entradas', async () => {
    await act(async () => { api.push('a'); });
    await act(async () => root.unmount());
    await tick(60);
    expect(window.history.state?.__backHandler).toBeUndefined();
    await mount();
  });
});
