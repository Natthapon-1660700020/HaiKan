import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const serverDir = fileURLToPath(new URL('../server/', import.meta.url))
  const { PORT = '4000' } = loadEnv(mode, serverDir, 'PORT')
  return {
    plugins: [react(), tailwind()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': 'http://127.0.0.1:' + PORT },
    },
  }
})
