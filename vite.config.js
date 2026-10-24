// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0', // <-- ESTO ES CLAVE: Permite conexiones desde la red local
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Opcional: si tu backend no tiene el prefijo /api, puedes reescribir la ruta
        // rewrite: (path) => path.replace(/^\/api/, '')
      },
      // NUEVO: Proxy para las imágenes
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})