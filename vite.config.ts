import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: { port: 4173 },
  define: { 'import.meta.env.VITE_BITGET_API_BASE': JSON.stringify('/api/bitget/api/v2/mix/market') },
  server: {
    port: 4173,
    proxy: {
      '/api/bitget': { target: 'https://api.bitget.com', changeOrigin: true, rewrite: (path) => path.replace(/^\/api\/bitget/, '') },
      '/api/workspace': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
})
