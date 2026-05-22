import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// =============================================================================
//  WALIDA — Vite Configuration
// -----------------------------------------------------------------------------
//  Bundles React and registers the app as an installable PWA. The PWA
//  manifest is injected at build time so the entire storefront + admin
//  can be added to the home screen on iOS / Android and run offline-first.
// =============================================================================

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'براءة — Baraa Kids',
        short_name: 'Baraa Kids',
        description: 'متجركم الإلكتروني لملابس الأطفال الراقية بتقنية 3D.',
        theme_color: '#FFB4A2',
        background_color: '#FFF6F0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        lang: 'ar',
        dir: 'rtl',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Cache static assets and Firebase Storage so the storefront keeps
        // feeling premium even on flaky networks.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2,mp4}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'walida-storage',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'walida-fonts' }
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    port: 4280,
    strictPort: true,
    open: true
  },
  preview: {
    host: true,
    port: 4281,
    strictPort: true
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split heavy vendor libs so the initial paint stays fast.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          motion: ['framer-motion']
        }
      }
    }
  }
});
