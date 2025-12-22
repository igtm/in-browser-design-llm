import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import zipPack from 'vite-plugin-zip-pack'
import manifest from './manifest.config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    react(),
    crx({ manifest }),
    tailwindcss(),
    zipPack({
      outDir: 'release',
      outFileName: 'bundle.zip',
    }),
  ],
  server: {
    port: 5180,
    strictPort: true,
    hmr: {
      port: 5180,
    },
  },
})
