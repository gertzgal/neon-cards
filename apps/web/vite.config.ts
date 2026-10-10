import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const workerPort = process.env['WORKER_PORT'] ?? '8787'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': `http://127.0.0.1:${workerPort}` },
  },
})
