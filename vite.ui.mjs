import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  cacheDir: path.join(rootDir, '.vite-cache-ui'),
  resolve: { alias: { '@': path.resolve(rootDir, 'src') } },
  server: {
    host: '127.0.0.1',
    port: 5178,
    strictPort: true,
  },
  plugins: [vue()],
})
