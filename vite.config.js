import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { WORKSPACES } from './src/config/branding.js';

// Roda em Node (não passa pelo bundler), por isso lê VITE_WORKSPACE_ID via
// loadEnv/process.env em vez de import.meta.env — ver src/config/branding.js.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const branding = WORKSPACES[env.VITE_WORKSPACE_ID] || WORKSPACES['porto-terapia'];

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true
        },
        // Modelos do face-api.js (public/models) não têm extensão de arquivo reconhecida
        // pelo glob padrão do workbox, então precisam ser incluídos explicitamente.
        includeAssets: ['models/**/*'],
        workbox: {
          cleanupOutdatedCaches: true,
          navigateFallbackDenylist: [/^\/assets\//],
          maximumFileSizeToCacheInBytes: 5000000,
        },
        manifest: {
          name: branding.appTitle,
          short_name: branding.shortName,
          description: 'Sistema de Ponto e Controle para RH',
          theme_color: branding.themeColor,
          background_color: branding.themeColor,
          display: 'standalone',
          icons: [
            {
              src: branding.logoPath,
              sizes: '192x192',
              type: 'image/jpeg'
            },
            {
              src: branding.logoPath,
              sizes: '512x512',
              type: 'image/jpeg'
            }
          ]
        }
      })
    ],
    server: {
      host: true,
      port: 8080,
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            recharts: ['recharts'],
            vendor: ['react', 'react-dom', 'lucide-react', 'cmdk', 'sonner']
          }
        }
      }
    },
    test: {
      environment: 'node',
      include: ['src/**/__tests__/**/*.test.js'],
    }
  };
});
