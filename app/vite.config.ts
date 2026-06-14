import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Dev: si VITE_API_BASE queda vacío, las llamadas a /api/* van mismo-origen y
  // este proxy las reenvía al backend Node local (cookies de admin sin líos
  // cross-site). En deploy aparte se usa VITE_API_BASE y este proxy se ignora.
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
