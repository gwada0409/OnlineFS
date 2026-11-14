import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    clearMocks: true
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.png', 'logo.png', 'app_icon.png', 'apple-touch-icon.png', 'offline.html'],
      manifest: {
        id: '/',
        name: 'Online Filing System',
        short_name: 'OnlineFS',
        description: 'Secure online leave filing, approval, and request tracking for HIBLOW Philippines Inc.',
        start_url: '/', scope: '/', display: 'standalone',
        background_color: '#081120', theme_color: '#2563eb',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          { name: 'File Leave', short_name: 'File Leave', url: '/file-leave', icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }] },
          { name: 'My Requests', short_name: 'Requests', url: '/my-requests', icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Approvals', short_name: 'Approvals', url: '/approvals', icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }] }
        ]
      },
      injectManifest: { globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'] },
      devOptions: { enabled: true, type: 'module' }
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:5000',
      '/hubs': { target: 'http://127.0.0.1:5000', ws: true }
    }
  }
})
