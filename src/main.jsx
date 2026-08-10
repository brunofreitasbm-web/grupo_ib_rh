import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { Toaster } from 'sonner';
import './index.css';

// Tratamento global para erros de carregamento de módulos dinâmicos (ex: novos deploys no Netlify)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Detectada falha ao pré-carregar módulo estático/dinâmico. Recarregando a aplicação...');
  const reloadKey = 'vite_preload_error_reload';
  if (!sessionStorage.getItem(reloadKey)) {
    sessionStorage.setItem(reloadKey, Date.now().toString());
    window.location.reload();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = String(event?.reason || '');
  if (
    reason.includes('Failed to fetch dynamically imported module') ||
    reason.includes('Failed to load module script') ||
    reason.includes('Importing a module script failed')
  ) {
    console.warn('Detectado erro de importação de módulo dinâmico desatualizado. Recarregando...');
    const reloadKey = 'chunk_load_error_reload';
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, Date.now().toString());
      window.location.reload();
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster position="top-right" richColors />
  </React.StrictMode>
);
