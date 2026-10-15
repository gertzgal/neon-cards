import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const workerPort = process.env['WORKER_PORT'] ?? '8787'

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: {
        index: fileURLToPath(new URL('index.html', import.meta.url)),
        gallery: fileURLToPath(new URL('ui-gallery.html', import.meta.url)),
        faces: fileURLToPath(new URL('card-faces.html', import.meta.url)),
      },
    },
  },
  server: {
    proxy: { '/api': `http://127.0.0.1:${workerPort}` },
  },
})
