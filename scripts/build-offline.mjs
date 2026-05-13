import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const sourceRoot = process.cwd()
const buildRoot = path.join(os.tmpdir(), 'ts-agent-offline-build')

const copyRecursive = (src, dst) => {
  if (!fs.existsSync(src)) return
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true })
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dst, item))
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    fs.copyFileSync(src, dst)
  }
}

const run = (cmd, args, cwd) => {
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: false })
  if (res.status !== 0) process.exit(res.status ?? 1)
}

fs.rmSync(buildRoot, { recursive: true, force: true })
fs.mkdirSync(buildRoot, { recursive: true })

for (const file of ['index.html', 'package.json', 'package-lock.json', 'vite.config.mjs']) {
  copyRecursive(path.join(sourceRoot, file), path.join(buildRoot, file))
}

for (const dir of ['src', 'electron', 'python', 'storage']) {
  copyRecursive(path.join(sourceRoot, dir), path.join(buildRoot, dir))
}

const nodeModules = path.join(sourceRoot, 'node_modules')
const buildNodeModules = path.join(buildRoot, 'node_modules')
if (!fs.existsSync(nodeModules)) {
  console.error('node_modules is missing. Do not install packages on the intranet; use the complete offline bundle.')
  process.exit(1)
}
fs.symlinkSync(nodeModules, buildNodeModules, 'junction')

run(process.execPath, [path.join(buildNodeModules, 'vite', 'bin', 'vite.js'), 'build', '--config', 'vite.config.mjs'], buildRoot)

copyRecursive(path.join(buildRoot, 'dist'), path.join(sourceRoot, 'dist'))
copyRecursive(path.join(buildRoot, 'dist-electron'), path.join(sourceRoot, 'dist-electron'))

if (process.env.TS_AGENT_BUILD_APP === '1') {
  const electronBuilder = path.join(buildNodeModules, 'electron-builder', 'cli.js')
  if (!fs.existsSync(electronBuilder)) {
    console.error('electron-builder is missing; cannot package the app.')
    process.exit(1)
  }
  run(process.execPath, [electronBuilder], buildRoot)
  copyRecursive(path.join(buildRoot, 'dist'), path.join(sourceRoot, 'dist'))
} else {
  console.log('Offline compile finished. Skipped electron-builder by default to avoid intranet downloads.')
}

console.log(`Build temp directory: ${buildRoot}`)
