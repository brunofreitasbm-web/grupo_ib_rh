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
    const lastRefreshTime = parseInt(
      window.sessionStorage.getItem('page_last_chunk_refresh_time') || '0',
      10
    );
    const now = Date.now();
    // Permite recarregar automaticamente se a última tentativa foi há mais de 15 segundos
    const canReload = now - lastRefreshTime > 15000;

    try {
      const component = await componentImport();
      return component;
    } catch (error) {
      console.warn('Falha ao carregar módulo dinâmico (chunk load error):', error);

      if (canReload) {
        window.sessionStorage.setItem('page_last_chunk_refresh_time', now.toString());
        window.location.reload();
        return new Promise(() => {}); // Manter estado pendente enquanto a página recarrega
      }

      // Se recarregou recentemente e ainda assim o erro persiste, lança para o ErrorBoundary
      throw error;
    }
  });
}

export default lazyWithRetry;
