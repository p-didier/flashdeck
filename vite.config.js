import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Date of the last commit = when the app was last updated. Falls back to build
// time if git isn't available (e.g. a tarball build).
function lastUpdated() {
  try {
    return execSync('git log -1 --format=%cI').toString().trim()
  } catch {
    return new Date().toISOString()
  }
}

// GitHub Pages serves the app under /<repo-name>/. deploy.yml sets BASE from the
// repo name, so a fork under another name works without editing this file.
const base = process.env.BASE ?? '/flashdeck/'

export default defineConfig({
  base,
  define: {
    __LAST_UPDATED__: JSON.stringify(lastUpdated()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
      manifest: {
        name: 'flashdeck',
        short_name: 'flashdeck',
        description: 'Flashcards with spaced repetition, for any subject',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
    }),
  ],
})
