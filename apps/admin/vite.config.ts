import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { apiProxyOptions } from '../../vite-api-proxy.mjs';
import {
  readThemePreference,
  resolveTheme,
  themeStorageKey,
} from './src/theme/theme-preference.ts';

export default defineConfig(() => ({
  base: '/admin/',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'admin-theme-bootstrap',
      transformIndexHtml: {
        order: 'pre',
        handler: () => [
          {
            tag: 'script',
            injectTo: 'head-prepend',
            children: `(() => {
            const preference = (${readThemePreference.toString()})(${JSON.stringify(themeStorageKey)});
            const theme = (${resolveTheme.toString()})(preference, window.matchMedia('(prefers-color-scheme: dark)').matches);
            document.documentElement.dataset.theme = theme;
            document.documentElement.style.colorScheme = theme;
          })();`,
          },
        ],
      },
    },
  ],
  server: { proxy: { '/api': apiProxyOptions() } },
}));
