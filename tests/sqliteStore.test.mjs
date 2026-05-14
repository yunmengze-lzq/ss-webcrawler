import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

test('crawler_store writes rows with built-in sqlite3 without installing packages', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ss-webcrawler-sqlite-'))
  const dbPath = path.join(dir, 'crawler.db')
  const input = {
    db_path: dbPath,
    table_name: 'crawler_rows',
    primary_key: '文章ID',
    write_mode: 'upsert',
    rows: [
      { 文章ID: 1, 标题: '第一条', Cookie状态: '已带入' },
      { 文章ID: 2, 标题: '第二条', Cookie状态: '已带入' },
    ],
  }

  const result = spawnSync('python', ['python/crawler_store.py'], {
    cwd: process.cwd(),
    input: JSON.stringify(input),
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  })

  assert.equal(result.status, 0, result.stderr || result.stdout)
  const output = JSON.parse(result.stdout)
  assert.equal(output.db_path, dbPath)
  assert.equal(output.table, 'crawler_rows')
  assert.equal(output.count, 2)

  const query = spawnSync('python', ['-c', [
    'import json, sqlite3, sys',
    'conn = sqlite3.connect(sys.argv[1])',
    'rows = conn.execute("select * from crawler_rows").fetchall()',
    'print(json.dumps(rows, ensure_ascii=False))',
  ].join('; ') , dbPath], {
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  })

  assert.equal(query.status, 0, query.stderr)
  assert.deepEqual(JSON.parse(query.stdout), [
    ['1', '第一条', '已带入'],
    ['2', '第二条', '已带入'],
  ])
})
