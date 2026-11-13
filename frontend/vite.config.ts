import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': process.env.VITE_API_PROXY || 'http://127.0.0.1:8000', '/media': process.env.VITE_API_PROXY || 'http://127.0.0.1:8000' },
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
})
