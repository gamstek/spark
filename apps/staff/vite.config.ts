import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { apiProxyTarget } from '../../vite-api-proxy.mjs';

export default defineConfig(() => ({
  base: '/staff/',
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': apiProxyTarget() } },
}));
