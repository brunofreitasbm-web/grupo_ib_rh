// @vitest-environment jsdom
// Regressão do erro #310 do React ("Rendered more hooks than during the
// previous render"): o early return de `loading` do FinanceiroTab estava antes
// do useMemo de `pjApprovedPayrolls`, então a transição loading true -> false
// renderizava mais hooks do que no render anterior e o ErrorBoundary do App
// capturava o crash (aba Financeiro em branco).
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Supabase fake: toda query resolve vazia. O alvo aqui não é a regra de negócio
// do financeiro (coberta em utils/__tests__), e sim a ORDEM dos hooks.
vi.mock('../../supabase', () => {
  const makeQuery = () => {
    const result = { data: [], error: null };
    const query = {
      select: () => query,
      order: () => query,
      gte: () => query,
      lt: () => query,
      eq: () => query,
      update: () => query,
      delete: () => query,
      range: () => Promise.resolve(result),
      single: () => Promise.resolve({ data: null, error: null }),
      then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
    };
    return query;
  };
  const channel = () => {
    const ch = { on: () => ch, subscribe: () => ch };
    return ch;
  };
  return {
    supabase: {
      from: () => makeQuery(),
      channel,
      removeChannel: () => {},
      rpc: () => Promise.resolve({ data: null, error: null }),
    },
  };
});

vi.mock('sonner', () => ({ toast: { success: () => {}, error: () => {}, info: () => {} } }));
vi.mock('../PayrollPdfViewerModal', () => ({ default: () => null }));
vi.mock('../PublicPayrollUploadModal', () => ({ default: () => null }));

import FinanceiroTab from '../tabs/FinanceiroTab';

// ErrorBoundary mínima: é exatamente o que o App faz com as abas. Se o
// componente violar a ordem dos hooks, o erro aparece aqui em vez de derrubar
// a tela inteira silenciosamente.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch() {}
  render() {
    if (this.state.error) {
      return React.createElement('div', { 'data-testid': 'erro' }, String(this.state.error.message));
    }
    return this.props.children;
  }
}

let root;
let container;
let boundaryRef;
let consoleError;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  boundaryRef = React.createRef();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  consoleError.mockRestore();
});

describe('FinanceiroTab', () => {
  it('termina o carregamento sem violar a ordem dos hooks (React #310)', async () => {
    await act(async () => {
      root.render(
        React.createElement(
          ErrorBoundary,
          { ref: boundaryRef },
          React.createElement(FinanceiroTab, { filterUnit: 'all', restrictedUnitIds: [] })
        )
      );
      // Deixa as promises do fetchData resolverem e o setLoading(false) rodar.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(boundaryRef.current.state.error).toBeNull();
    // Conteúdo real da aba (não o spinner, não a tela de erro do boundary).
    expect(container.textContent).toContain('Gestão Financeira');
    expect(container.textContent).not.toContain('Rendered more hooks');
  });
});
