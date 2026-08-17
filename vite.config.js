import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
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
        name: 'Controle de Estagiários',
        short_name: 'PontoRH',
        description: 'Sistema de Ponto e Controle para RH',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        icons: [
          {
            src: '/logo.jpg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: '/logo.jpg',
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
});
