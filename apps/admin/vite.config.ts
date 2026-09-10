import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { apiProxyOptions } from '../../vite-api-proxy.mjs';

export default defineConfig(() => ({
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': apiProxyOptions() } },
}));
