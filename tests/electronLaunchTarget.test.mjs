import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveMainWindowTarget } from '../electron/windowTarget.ts'

test('start.cmd mode loads local dist file when no dev server is explicitly provided', () => {
  const target = resolveMainWindowTarget({
    isPackaged: false,
    viteDevServerUrl: undefined,
    distIndexPath: 'C:/app/dist/index.html',
  })

  assert.deepEqual(target, {
    mode: 'file',
    value: 'C:/app/dist/index.html',
    openDevTools: false,
  })
})

test('development mode loads Vite dev server only when url is explicitly provided', () => {
  const target = resolveMainWindowTarget({
    isPackaged: false,
    viteDevServerUrl: 'http://127.0.0.1:5178',
    distIndexPath: 'C:/app/dist/index.html',
  })

  assert.deepEqual(target, {
    mode: 'url',
    value: 'http://127.0.0.1:5178',
    openDevTools: true,
  })
})

test('packaged mode always loads local dist file', () => {
  const target = resolveMainWindowTarget({
    isPackaged: true,
    viteDevServerUrl: 'http://127.0.0.1:5178',
    distIndexPath: 'C:/app/dist/index.html',
  })

  assert.deepEqual(target, {
    mode: 'file',
    value: 'C:/app/dist/index.html',
    openDevTools: false,
  })
})
