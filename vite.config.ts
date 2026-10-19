/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative asset URLs, so the build works under the GitHub Pages project path.
  base: './',
  // Shown in Settings.
  define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync('package.json', 'utf8')).version) },
  plugins: [
    react(),
    // Installable and offline. The service worker only exists in the build, never under `vite dev`.
    VitePWA({
      // A new version waits for Reload in the top bar, or the next launch: a reload mid-edit would drop MIDI.
      registerType: 'prompt',
      // main.tsx registers it, through the app store.
      injectRegister: false,
      manifest: {
        name: 'Chroma Console Editor',
        short_name: 'Chroma',
        description: 'Unofficial, free and open-source preset editor for the Chroma Console.',
        start_url: './',
        scope: './',
        display: 'standalone',
        // The light theme's --paper.
        theme_color: '#f3efe6',
        background_color: '#f3efe6',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // woff2 only: every browser with Web MIDI reads it, so the .woff fallbacks are never fetched.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Only the source of the maskable PNG.
        globIgnores: ['icon-maskable.svg'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
