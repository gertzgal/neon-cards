import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'dev',
  plugins: [react()],
  server: { port: 5199, host: true },
})
