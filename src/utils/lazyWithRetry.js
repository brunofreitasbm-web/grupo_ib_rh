import { lazy } from 'react';

/**
 * Utilitário para envolver `React.lazy` com um mecanismo de tentativa de recarregamento
 * da página caso o módulo dinâmico falhe ao ser carregado (ex.: após um novo deploy no Netlify
 * onde os hashes dos arquivos estáticos mudaram).
 *
 * @param {Function} componentImport - Função que retorna uma Promise de importação ex: () => import('./MyComponent')
 * @returns {React.LazyExoticComponent}
 */
export function lazyWithRetry(componentImport) {
  return lazy(async () => {
    const pageHasBeenRefreshed = JSON.parse(
      window.sessionStorage.getItem('page_has_been_refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page_has_been_refreshed', 'false');
      return component;
    } catch (error) {
      console.warn('Falha ao carregar módulo dinâmico (chunk load error):', error);

      if (!pageHasBeenRefreshed) {
        window.sessionStorage.setItem('page_has_been_refreshed', 'true');
        window.location.reload();
        return new Promise(() => {}); // Manter estado pendente enquanto a página recarrega
      }

      // Se já recarregou uma vez e o erro persiste, lança o erro para ser capturado pelo ErrorBoundary
      throw error;
    }
  });
}

export default lazyWithRetry;
