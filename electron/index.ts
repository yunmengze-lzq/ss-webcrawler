import { app, BrowserWindow, dialog, ipcMain, session } from 'electron'
import type { DownloadItem, Event, WebContents } from 'electron'
import path from 'path'
import fs from 'fs'
import { DB_PATH } from './db'
import { log } from './log/log'
import { spawnPython } from './pythonBridge'
import ExcelJS from 'exceljs'

const USER_DATA_DIR = path.join(app.getPath('appData'), 'ts-agent')
app.setName('ts-agent')
app.setPath('userData', USER_DATA_DIR)

const isDev = !app.isPackaged
const VITE_DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5178'

const resolvePreload = (name: string) => {
  const compiled = path.join(__dirname, 'preload', name, 'index.js')
  if (fs.existsSync(compiled)) return compiled
  const packaged = path.join(__dirname, '..', 'dist-electron', 'preload', name, 'index.js')
  if (fs.existsSync(packaged)) return packaged
  return compiled
}

// ── Token 存储（两套内网域）──────────────────────────────────────
export const tokens: Record<string, string> = {
  asset:   '',   // 资产域
  finance: '',   // 计财域
}

// ── 子窗口池 ──────────────────────────────────────────────────────
const winPool = new Map<string, BrowserWindow>()

// ── 创建子窗口（RPA 用）───────────────────────────────────────────
export const createSubWindow = (
  winName: string,
  url: string,
  tokenDomain: 'asset' | 'finance',
  opts: { show?: boolean } = {}
): string => {
  const preloadJs = resolvePreload(winName)

  const win = new BrowserWindow({
    width: 1920, height: 1080,
    show: opts.show ?? false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // preload 只在文件存在时注入，不存在则跳过（方便逐步调试）
      ...(fs.existsSync(preloadJs) ? { preload: preloadJs } : {}),
    },
  })

  const key = `${winName}_${Date.now()}`
  winPool.set(key, win)
  setupDownloadCapture(win, key, winName)

  // Cookie 注入（内网免密登录核心）
  const domainMap: Record<string, string> = {
    asset:   'http://10.10.21.28',
    finance: 'https://fms.gmp.cloud.hq.iv.csg',
  }
  const token = tokens[tokenDomain]

  const load = () => win.loadURL(url)

  if (token) {
    session.defaultSession.cookies
      .set({ url: domainMap[tokenDomain], name: 'access-token', value: token })
      .then(load)
      .catch(() => { log.warn(`Cookie 注入失败 [${winName}]，直接加载`); load() })
  } else {
    log.warn(`[${winName}] Token 为空，直接加载`)
    load()
  }

  win.on('closed', () => { winPool.delete(key) })
  log.info(`子窗口创建: ${key}`)
  return key
}

// ── 主窗口 ────────────────────────────────────────────────────────
let mainWin: BrowserWindow | null = null

const createMainWindow = () => {
  const preloadJs = resolvePreload('main')

  mainWin = new BrowserWindow({
    width: 1400, height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      ...(fs.existsSync(preloadJs) ? { preload: preloadJs } : {}),
    },
  })
  if (isDev) {
    mainWin.loadURL(VITE_DEV_URL)
    mainWin.webContents.openDevTools()
  } else {
    mainWin.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// ── App 启动 ──────────────────────────────────────────────────────
app.whenReady().then(async () => {
  loadSavedTokens()
  createMainWindow()
  log.info('应用启动完成，默认不初始化数据库')
})

const setupDownloadCapture = (win: BrowserWindow, winKey: string, system: string) => {
  const downloadDir = path.join(app.getPath('userData'), 'rpa-downloads', system)
  const ses = win.webContents.session
  const webContentsId = win.webContents.id
  fs.mkdirSync(downloadDir, { recursive: true })

  const onWillDownload = (_event: Event, item: DownloadItem, webContents: WebContents) => {
    if (webContents.id !== webContentsId) return

    const safeName = item.getFilename().replace(/[\\/:*?"<>|]/g, '_')
    const savePath = path.join(downloadDir, `${Date.now()}_${safeName}`)
    item.setSavePath(savePath)

    item.once('done', (_e, state) => {
      const payload = { winKey, system, state, path: savePath, filename: safeName }
      log.info(`[RPA] 下载结束: ${system} ${state} ${savePath}`)
      if (!win.isDestroyed()) win.webContents.send('rpa:downloaded', payload)
      mainWin?.webContents.send('rpa:downloaded', payload)
    })
  }

  ses.on('will-download', onWillDownload)
  win.once('closed', () => {
    ses.off('will-download', onWillDownload)
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── IPC 处理器 ────────────────────────────────────────────────────

// 触发单个系统 RPA 爬取
ipcMain.handle('rpa:crawl', async (_e, args: { system: string; params?: any }) => {
  const { system, params = {} } = args

  // 各系统对应的 URL 和 Token 域（内网调试时按实际修改）
  const systemConfig: Record<string, { url: string; domain: 'asset' | 'finance' }> = {
    gis:        { url: 'http://10.10.21.28/gis/',          domain: 'asset'   },
    asset:      { url: 'http://10.10.21.28/asset/',        domain: 'asset'   },
    load_meter: { url: 'https://fms.gmp.cloud.hq.iv.csg/load/', domain: 'finance' },
    marketing:  { url: 'https://fms.gmp.cloud.hq.iv.csg/mkt/',  domain: 'finance' },
    voltage:    { url: 'https://fms.gmp.cloud.hq.iv.csg/volt/', domain: 'finance' },
  }

  const cfg = systemConfig[system]
  if (!cfg) return { success: false, error: `未知系统: ${system}` }

  const winKey = createSubWindow(system, cfg.url, cfg.domain, { show: isDev })

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      winPool.get(winKey)?.close()
      resolve({ success: false, error: '超时（5分钟）' })
    }, 5 * 60_000)

    ipcMain.once(`rpa:complete:${winKey}`, (_e, result) => {
      clearTimeout(timer)
      winPool.get(winKey)?.close()
      resolve(result)
    })

    // 延迟 3 秒后通知 Preload 开始（等待页面初始化）
    setTimeout(() => {
      winPool.get(winKey)?.webContents.send('startCrawl', { ...params, winKey })
    }, 3000)
  })
})

type CrawlerConfig = {
  id?: string
  name: string
  system: string
  category?: string
  description?: string
  method: 'GET' | 'POST'
  url: string
  headersText?: string
  cookie?: string
  cookieRefreshMode?: 'manual' | 'rpa-login'
  cookieExpireHours?: number
  cookieUpdatedAt?: string
  loginUrl?: string
  payloadText?: string
  payloadFields?: Array<{
    id: string
    label: string
    path: string
    type: 'text' | 'number' | 'date' | 'select'
    defaultValue: string
    required: boolean
    optionsText: string
  }>
  paginationEnabled?: boolean
  pageField?: string
  pageSizeField?: string
  pageSize?: number
  totalPath?: string
  maxPages?: number
  stopMode?: 'empty-list' | 'total-count' | 'max-pages'
  listPath?: string
  fieldsText?: string
  storageTarget?: 'excel' | 'database' | 'both'
  outputDir?: string
  databasePath?: string
  tableName?: string
  primaryKey?: string
  writeMode?: 'append' | 'overwrite' | 'upsert'
  updatedAt?: string
  lastRunAt?: string
  lastCount?: number
}

const crawlerConfigDir = () => path.join(configDir(), 'crawler-configs')
const crawlerDataDir = () => path.join(configDir(), 'crawler-data')

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|]/g, '_')

const parseJsonObject = (text = '', fallback: Record<string, any> = {}) => {
  const trimmed = text.trim()
  if (!trimmed) return fallback
  return JSON.parse(trimmed)
}

const parseHeaders = (text = '', cookie = '') => {
  const headers: Record<string, string> = {}
  const trimmed = text.trim()
  if (trimmed) {
    if (trimmed.startsWith('{')) {
      Object.assign(headers, JSON.parse(trimmed))
    } else {
      for (const line of trimmed.split(/\r?\n/)) {
        const idx = line.indexOf(':')
        if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
      }
    }
  }
  if (cookie.trim()) headers.Cookie = cookie.trim()
  return headers
}

const getByPath = (obj: any, pathText = '') => {
  if (!pathText.trim()) return obj
  return pathText.split('.').filter(Boolean).reduce((cur, key) => cur?.[key], obj)
}

const setByPath = (obj: any, pathText: string, value: any) => {
  const parts = pathText.split('.').filter(Boolean)
  if (!parts.length) return
  let cur = obj
  for (const part of parts.slice(0, -1)) {
    if (!cur[part] || typeof cur[part] !== 'object') cur[part] = {}
    cur = cur[part]
  }
  cur[parts[parts.length - 1]] = value
}

const applyRuntimeParams = (payload: Record<string, any>, runtimeParams: Record<string, any> = {}) => {
  for (const [pathText, value] of Object.entries(runtimeParams)) {
    if (!pathText || value === undefined || value === null || value === '') continue
    setByPath(payload, pathText, value)
  }
  return payload
}

const flattenParams = (obj: Record<string, any>, prefix = ''): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj || {})) {
    const nextKey = prefix ? `${prefix}.${key}` : key
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value) || typeof value !== 'object') {
      out[nextKey] = String(value)
    } else {
      Object.assign(out, flattenParams(value, nextKey))
    }
  }
  return out
}

const buildRequestUrl = (url: string, method: string, payload: Record<string, any>) => {
  if (method !== 'GET') return url
  const parsed = new URL(url)
  for (const [key, value] of Object.entries(flattenParams(payload))) {
    parsed.searchParams.set(key, value)
  }
  return parsed.toString()
}

const normalizeRows = (raw: any, config: CrawlerConfig) => {
  const list = getByPath(raw, config.listPath || '')
  const rows = Array.isArray(list) ? list : []
  const fields = parseJsonObject(config.fieldsText, {})
  if (!Object.keys(fields).length) return rows

  return rows.map((item) => {
    const mapped: Record<string, any> = {}
    for (const [targetKey, sourcePath] of Object.entries(fields)) {
      mapped[targetKey] = getByPath(item, String(sourcePath))
    }
    return mapped
  })
}

const writeRowsToExcel = async (filePath: string, rows: any[]) => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('data')
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row || {}).forEach(key => set.add(key))
    return set
  }, new Set<string>()))
  sheet.addRow(headers)
  for (const row of rows) sheet.addRow(headers.map(key => row?.[key] ?? ''))
  await workbook.xlsx.writeFile(filePath)
}

const defaultDbPath = () => path.join(configDir(), 'data', 'ts_agent.db')

const resolveRunDir = (config: CrawlerConfig, runId: string) => {
  const baseDir = config.outputDir?.trim() || crawlerDataDir()
  return path.join(baseDir, safeFileName(config.system || config.name), runId)
}

const writeRowsToDatabase = async (config: CrawlerConfig, rows: any[]) => {
  const dbPath = config.databasePath?.trim() || defaultDbPath()
  const tableName = config.tableName?.trim() || safeFileName(config.system || config.name)
  const res = await spawnPython('crawler_store', {
    db_path: dbPath,
    table_name: tableName,
    primary_key: config.primaryKey?.trim() || '',
    write_mode: config.writeMode || 'append',
    rows,
  })
  if (!res.success) throw new Error(res.error || '数据库写入失败')
  return res.data
}

const saveCrawlerConfig = (config: CrawlerConfig) => {
  ensureDir(crawlerConfigDir())
  const id = config.id || `${safeFileName(config.system || config.name)}_${Date.now()}`
  const saved = { ...config, id, updatedAt: new Date().toISOString() }
  fs.writeFileSync(path.join(crawlerConfigDir(), `${id}.json`), JSON.stringify(saved, null, 2), 'utf-8')
  return saved
}

const inferLoginUrl = (config: CrawlerConfig) => {
  const target = config.loginUrl?.trim() || config.url
  const parsed = new URL(target)
  return config.loginUrl?.trim() || parsed.origin
}

const collectCookieHeader = async (url: string) => {
  const cookies = await session.defaultSession.cookies.get({ url })
  return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
}

ipcMain.handle('app:select-directory', async () => {
  const res = await dialog.showOpenDialog(mainWin || undefined, {
    title: '选择保存目录',
    properties: ['openDirectory', 'createDirectory'],
  })
  return res.canceled ? null : res.filePaths[0]
})

ipcMain.handle('crawler-config:list', async () => {
  ensureDir(crawlerConfigDir())
  return fs.readdirSync(crawlerConfigDir())
    .filter(file => file.endsWith('.json'))
    .map(file => JSON.parse(fs.readFileSync(path.join(crawlerConfigDir(), file), 'utf-8')))
})

ipcMain.handle('crawler-config:save', async (_e, config: CrawlerConfig) => {
  const saved = saveCrawlerConfig(config)
  return { success: true, config: saved }
})

ipcMain.handle('crawler-config:refresh-cookie', async (_e, config: CrawlerConfig) => {
  let loginUrl = ''
  try {
    loginUrl = inferLoginUrl(config)
  } catch {
    return { success: false, error: '请先填写接口 URL 或登录页 URL' }
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  await win.loadURL(loginUrl)

  return new Promise((resolve) => {
    win.on('closed', async () => {
      try {
        const cookie = await collectCookieHeader(loginUrl)
        if (!cookie) {
          resolve({ success: false, error: '未读取到 Cookie，请确认已在登录页完成登录' })
          return
        }
        const saved = saveCrawlerConfig({
          ...config,
          cookie,
          cookieUpdatedAt: new Date().toISOString(),
          cookieRefreshMode: 'rpa-login',
          loginUrl,
        })
        resolve({ success: true, config: saved })
      } catch (err: any) {
        resolve({ success: false, error: err?.message || String(err) })
      }
    })
  })
})

ipcMain.handle('crawler-config:run', async (_e, config: CrawlerConfig, runtimeParams: Record<string, any> = {}) => {
  if (!config.url || !/^https?:\/\//i.test(config.url)) {
    return { success: false, error: '请填写完整的 http/https 接口 URL' }
  }

  const method = config.method || 'POST'
  const headers = parseHeaders(config.headersText, config.cookie)
  const basePayload = applyRuntimeParams(parseJsonObject(config.payloadText, {}), runtimeParams)
  const requestHeaders = {
      'Content-Type': 'application/json;charset=UTF-8',
      ...headers,
  }

  const requestOnce = async (payload: Record<string, any>) => {
    const response = await fetch(buildRequestUrl(config.url, method, payload), {
      method,
      headers: requestHeaders,
      ...(method === 'GET' ? {} : { body: JSON.stringify(payload) }),
      signal: AbortSignal.timeout(60_000),
    })
    const responseText = await response.text()
    let raw: any
    try {
      raw = JSON.parse(responseText)
    } catch {
      raw = { text: responseText }
    }
    return { response, raw }
  }

  const allRows: any[] = []
  const rawPages: any[] = []
  let lastStatus = 0
  let lastOk = false
  let fetchedTotal = 0
  const maxPages = Math.max(1, Number(config.maxPages || 1))

  if (config.paginationEnabled) {
    for (let page = 1; page <= maxPages; page += 1) {
      const payload = JSON.parse(JSON.stringify(basePayload))
      if (config.pageField) setByPath(payload, config.pageField, page)
      if (config.pageSizeField) setByPath(payload, config.pageSizeField, Number(config.pageSize || 100))
      const { response, raw } = await requestOnce(payload)
      lastStatus = response.status
      lastOk = response.ok
      rawPages.push({ page, payload, raw })
      const pageRows = normalizeRows(raw, config)
      allRows.push(...pageRows)
      fetchedTotal += pageRows.length

      const total = Number(getByPath(raw, config.totalPath || ''))
      if (config.stopMode === 'total-count' && total && fetchedTotal >= total) break
      if (config.stopMode === 'empty-list' && pageRows.length === 0) break
      if (config.stopMode === 'max-pages') continue
    }
  } else {
    const { response, raw } = await requestOnce(basePayload)
    lastStatus = response.status
    lastOk = response.ok
    rawPages.push({ payload: basePayload, raw })
    allRows.push(...normalizeRows(raw, config))
  }

  const raw = config.paginationEnabled ? { pages: rawPages } : rawPages[0]?.raw
  const rows = allRows
  const runId = `${safeFileName(config.system || config.name)}_${Date.now()}`
  const dir = resolveRunDir(config, runId)
  ensureDir(dir)

  const rawPath = path.join(dir, 'raw.json')
  const rowsPath = path.join(dir, 'rows.json')
  const excelPath = path.join(dir, 'rows.xlsx')
  const metaPath = path.join(dir, 'meta.json')

  fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2), 'utf-8')
  fs.writeFileSync(rowsPath, JSON.stringify(rows, null, 2), 'utf-8')

  const storageTarget = config.storageTarget || 'excel'
  const files: Record<string, string> = { rawPath, rowsPath, metaPath }
  let databaseResult: any = null

  if (storageTarget === 'excel' || storageTarget === 'both') {
    await writeRowsToExcel(excelPath, rows)
    files.excelPath = excelPath
  }

  if (storageTarget === 'database' || storageTarget === 'both') {
    databaseResult = await writeRowsToDatabase(config, rows)
    files.databasePath = databaseResult.db_path
  }

  fs.writeFileSync(metaPath, JSON.stringify({
    configId: config.id,
    name: config.name,
    system: config.system,
    url: config.url,
    method,
    storageTarget,
    outputDir: config.outputDir,
    databasePath: config.databasePath || defaultDbPath(),
    tableName: config.tableName,
    primaryKey: config.primaryKey,
    writeMode: config.writeMode,
    status: lastStatus,
    ok: lastOk,
    count: rows.length,
    paginationEnabled: config.paginationEnabled,
    pages: rawPages.length,
    database: databaseResult,
    createdAt: new Date().toISOString(),
  }, null, 2), 'utf-8')

  if (config.id) {
    ensureDir(crawlerConfigDir())
    const saved = { ...config, lastRunAt: new Date().toISOString(), lastCount: rows.length }
    fs.writeFileSync(path.join(crawlerConfigDir(), `${config.id}.json`), JSON.stringify(saved, null, 2), 'utf-8')
  }

  return {
    success: lastOk,
    status: lastStatus,
    count: rows.length,
    files,
    sample: rows.slice(0, 5),
    storageAdvice: storageTarget === 'database'
      ? '已写入数据库，并保留 raw.json/rows.json 用于追溯。'
      : storageTarget === 'both'
        ? '已同时保存 Excel 和写入数据库。'
        : '已保存 Excel，并保留 raw.json/rows.json 用于追溯。',
  }
})

// 调用 Python 计算引擎
ipcMain.handle('python:run', (_e, args: { script: string; params: any }) =>
  spawnPython(args.script, { ...args.params, db_path: DB_PATH })
)

// 调用内网 LLM API（主进程发请求，绕过渲染进程 CORS）
ipcMain.handle('llm:call', async (_e, args: { prompt: string; system?: string }) => {
  const cfg = readLlmConfig()
  try {
    const res = await fetch(`${cfg.base_url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.api_key}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 600,
        messages: [
          ...(args.system ? [{ role: 'system', content: args.system }] : []),
          { role: 'user', content: args.prompt },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })
    const data = await res.json() as any
    return { success: true, text: data.choices?.[0]?.message?.content ?? '' }
  } catch (err: any) {
    log.warn(`LLM 调用失败: ${err.message}，使用兜底文字`)
    return { success: false, text: '[LLM 暂不可用]' }
  }
})

// Token 更新
ipcMain.on('token:update', (_e, { domain, value }: { domain: string; value: string }) => {
  tokens[domain] = value
  saveToken(domain, value)
  log.info(`Token 已更新: ${domain}`)
})

// ── 本地配置工具函数 ──────────────────────────────────────────────
const configDir = () => app.getPath('userData')

const readLlmConfig = () => {
  const p = path.join(configDir(), 'llm-config.json')
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'))
  return { base_url: 'http://localhost:11434', api_key: '', model: 'deepseek-r1' }
}

const tokenFile = () => path.join(configDir(), 'tokens.json')

const loadSavedTokens = () => {
  if (!fs.existsSync(tokenFile())) return
  try {
    const saved = JSON.parse(fs.readFileSync(tokenFile(), 'utf-8'))
    Object.assign(tokens, saved)
    log.info('Token 已从文件加载')
  } catch { /* 忽略解析失败 */ }
}

const saveToken = (domain: string, value: string) => {
  const existing = fs.existsSync(tokenFile())
    ? JSON.parse(fs.readFileSync(tokenFile(), 'utf-8'))
    : {}
  fs.writeFileSync(tokenFile(), JSON.stringify({ ...existing, [domain]: value }, null, 2))
}
