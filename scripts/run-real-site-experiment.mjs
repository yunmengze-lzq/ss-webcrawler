import fs from 'node:fs'
import path from 'node:path'

import ExcelJS from 'exceljs'

import {
  buildGetUrl,
  builtInConfigs,
  extractRowsFromResponse,
  parseJsonObject,
} from '../src/crawlerConfigUtils.ts'

const config = builtInConfigs().find(item => item.id === 'real_github_repo_search')

if (!config) {
  throw new Error('缺少真实网站案例-GitHub仓库搜索')
}

const payload = parseJsonObject(config.payloadText)
const headers = parseJsonObject(config.headersText)
const requestUrl = config.method === 'GET' ? buildGetUrl(config.url, payload) : config.url
const runDir = path.join(process.cwd(), 'output', 'experiments', 'github-repo-search', String(Date.now()))

fs.mkdirSync(runDir, { recursive: true })

const response = await fetch(requestUrl, {
  method: config.method,
  headers,
  body: config.method === 'GET' ? undefined : JSON.stringify(payload),
  signal: AbortSignal.timeout(60_000),
})

const text = await response.text()
let raw
try {
  raw = JSON.parse(text)
} catch {
  raw = { text }
}

const rows = extractRowsFromResponse(raw, config)
const rawPath = path.join(runDir, 'raw.json')
const rowsPath = path.join(runDir, 'rows.json')
const excelPath = path.join(runDir, 'rows.xlsx')
const metaPath = path.join(runDir, 'meta.json')

fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2), 'utf-8')
fs.writeFileSync(rowsPath, JSON.stringify(rows, null, 2), 'utf-8')

const workbook = new ExcelJS.Workbook()
const sheet = workbook.addWorksheet('data')
const headersRow = Array.from(rows.reduce((keys, row) => {
  Object.keys(row || {}).forEach(key => keys.add(key))
  return keys
}, new Set()))

sheet.addRow(headersRow)
for (const row of rows) {
  sheet.addRow(headersRow.map(key => row?.[key] ?? ''))
}
await workbook.xlsx.writeFile(excelPath)

const meta = {
  name: config.name,
  requestUrl,
  status: response.status,
  ok: response.ok,
  count: rows.length,
  rawPath,
  rowsPath,
  excelPath,
  createdAt: new Date().toISOString(),
}

fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
console.log(JSON.stringify(meta, null, 2))
