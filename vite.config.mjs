import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const electronExternal = ['electron', 'exceljs']
const preloadEntries = []

const scanPreload = (dir) => {
  if (!fs.existsSync(dir)) return
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item)
    if (item === 'index.ts') {
      const outDir = path
        .dirname(full)
        .replace(path.join(rootDir, 'electron'), 'dist-electron')
      preloadEntries.push({
        entry: full,
        vite: {
          build: {
            outDir,
            rollupOptions: { external: electronExternal },
          },
        },
      })
    } else if (fs.statSync(full).isDirectory() && item !== 'utils') {
      scanPreload(full)
    }
  }
}

scanPreload(path.join(rootDir, 'electron/preload'))

export default defineConfig({
  cacheDir: path.join(rootDir, '.vite-cache'),
  resolve: { alias: { '@': path.resolve(rootDir, 'src') } },
  plugins: [
    vue(),
    electron([
      {
        entry: 'electron/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: { external: electronExternal },
          },
        },
      },
      ...preloadEntries,
    ]),
  ],
})
