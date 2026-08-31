import { loadEnv } from 'vite';
import { WORKSPACES } from './src/config/branding.js';

// Roda em Node (fora do bundler), por isso lê VITE_WORKSPACE_ID via
// process.env (Vercel/Netlify injetam as env vars do dashboard assim) com
// fallback pro .env local — mesmo padrão de vite.config.js.
const fileEnv = loadEnv('production', process.cwd(), '');
const workspaceId = process.env.VITE_WORKSPACE_ID || fileEnv.VITE_WORKSPACE_ID || 'porto-terapia';
const branding = WORKSPACES[workspaceId] || WORKSPACES['porto-terapia'];

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      // Sobrescreve (não adiciona) a paleta "blue" quando o workspace define
      // uma — o app inteiro usa bg-blue-*/text-blue-*/border-blue-* etc. como
      // cor de marca, então isso recolore a UI toda sem editar componentes.
      colors: branding.tailwindBlueOverride ? { blue: branding.tailwindBlueOverride } : {},
    },
  },
  plugins: [],
};
