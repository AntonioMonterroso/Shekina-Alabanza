import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// En desarrollo la app vive en "/". En GitHub Pages vive en "/Shekina-Alabanza/" (lo fija el workflow con VITE_BASE).
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Ministerio de Alabanza',
        short_name: 'Alabanza',
        description: 'Servicios, cancionero, turnos y ensayos del ministerio de alabanza.',
        lang: 'es-GT',
        theme_color: '#3D6B4A',
        background_color: '#F2F7EE',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [new RegExp(`^${base}proyeccion`)],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Recibe las notificaciones push (public/push-sw.js)
        importScripts: ['push-sw.js'],
      },
    }),
  ],
})
