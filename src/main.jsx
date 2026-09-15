import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import { Toaster } from 'sonner';
import './index.css';
import { BRANDING } from './config/branding';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Única rota pública do sistema: o link temporário do Levantamento de Perfil
// DISC (Banco de Talentos), enviado por e-mail ao candidato. O resto do app
// continua navegando por estado (App.jsx), sem react-router — ver
// src/components/tabs/BancoTalentosTab.jsx e src/components/DiscAssessmentPage.jsx.
const DiscAssessmentPage = lazyWithRetry(() => import('./components/DiscAssessmentPage.jsx'));

document.title = BRANDING.appTitle;
document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BRANDING.themeColor);

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
    <BrowserRouter>
      <Routes>
        <Route
          path="/disc/:token"
          element={(
            <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
              <DiscAssessmentPage />
            </Suspense>
          )}
        />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
    <Toaster position="top-right" richColors />
  </React.StrictMode>
);
