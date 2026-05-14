import type { CrawlerConfig } from './types'

export const blankConfig = (): CrawlerConfig => ({
  name: '计量负载率接口',
  system: 'load_meter',
  category: '运行监测',
  description: '',
  method: 'POST',
  url: '',
  headersText: '{\n  "Accept": "application/json, text/javascript, */*; q=0.01",\n  "Content-Type": "application/json;charset=UTF-8"\n}',
  cookie: '',
  cookieRefreshMode: 'manual',
  cookieExpireHours: 4,
  cookieUpdatedAt: '',
  loginUrl: '',
  payloadText: '{\n  "pageNo": 1,\n  "pageSize": 100\n}',
  payloadFields: [],
  paginationEnabled: true,
  pageField: 'pageNo',
  pageSizeField: 'pageSize',
  pageSize: 100,
  totalPath: 'data.total',
  maxPages: 100,
  stopMode: 'empty-list',
  listPath: 'data.list',
  fieldsText: '{\n  "ts_id": "stationId",\n  "record_date": "date",\n  "value": "value"\n}',
  storageTarget: 'excel',
  outputDir: '',
  databasePath: '',
  tableName: 'load_meter_daily',
  primaryKey: 'ts_id',
  writeMode: 'append',
})

export const normalizeConfig = (config: Partial<CrawlerConfig>): CrawlerConfig => ({
  ...blankConfig(),
  ...config,
})

export const builtInConfigs = (): CrawlerConfig[] => [
  normalizeConfig({
    id: 'real_jsonplaceholder_posts',
    name: '真实网站案例-JSONPlaceholder文章',
    system: 'custom',
    category: '真实网站测试',
    description: '调用 JSONPlaceholder 公开文章 API，返回根数组，适合作为第一条真实取数跑通案例。',
    method: 'GET',
    url: 'https://jsonplaceholder.typicode.com/posts',
    headersText: '{\n  "Accept": "application/json"\n}',
    cookie: '',
    cookieRefreshMode: 'manual',
    cookieExpireHours: 4,
    cookieUpdatedAt: '',
    loginUrl: '',
    payloadText: '{}',
    payloadFields: [],
    paginationEnabled: false,
    pageField: '',
    pageSizeField: '',
    pageSize: 100,
    totalPath: '',
    maxPages: 1,
    stopMode: 'max-pages',
    listPath: '',
    fieldsText: '{\n  "文章ID": "id",\n  "用户ID": "userId",\n  "标题": "title",\n  "正文": "body"\n}',
    storageTarget: 'excel',
    outputDir: 'C:\\Users\\61081\\Documents\\New project\\output\\real-site-test',
    databasePath: '',
    tableName: 'public_posts',
    primaryKey: '文章ID',
    writeMode: 'append',
  }),
  normalizeConfig({
    id: 'real_github_repo_search',
    name: '真实网站案例-GitHub仓库搜索',
    system: 'custom',
    category: '真实网站测试',
    description: '调用 GitHub 公开搜索 API，搜索 TypeScript 爬虫相关仓库，验证真实网站取数、嵌套字段映射和 Excel 保存。',
    method: 'GET',
    url: 'https://api.github.com/search/repositories',
    headersText: '{\n  "Accept": "application/vnd.github+json",\n  "User-Agent": "ss-webcrawler-test"\n}',
    cookie: '',
    cookieRefreshMode: 'manual',
    cookieExpireHours: 4,
    cookieUpdatedAt: '',
    loginUrl: '',
    payloadText: '{\n  "q": "web crawler language:TypeScript",\n  "sort": "stars",\n  "order": "desc",\n  "per_page": 10\n}',
    payloadFields: [],
    paginationEnabled: false,
    pageField: '',
    pageSizeField: '',
    pageSize: 10,
    totalPath: 'total_count',
    maxPages: 1,
    stopMode: 'max-pages',
    listPath: 'items',
    fieldsText: '{\n  "仓库名": "full_name",\n  "作者": "owner.login",\n  "地址": "html_url",\n  "描述": "description",\n  "Star数": "stargazers_count",\n  "语言": "language",\n  "更新时间": "updated_at"\n}',
    storageTarget: 'excel',
    outputDir: 'C:\\Users\\61081\\Documents\\New project\\output\\real-site-test',
    databasePath: '',
    tableName: 'github_repo_search',
    primaryKey: '仓库名',
    writeMode: 'append',
  }),
  normalizeConfig({
    id: 'real_jsonplaceholder_users',
    name: '真实网站案例-用户嵌套数据',
    system: 'custom',
    category: '真实网站测试',
    description: '调用 JSONPlaceholder 公开 API，验证根数组、address/company 嵌套字段解析。',
    method: 'GET',
    url: 'https://jsonplaceholder.typicode.com/users',
    headersText: '{\n  "Accept": "application/json"\n}',
    cookie: '',
    cookieRefreshMode: 'manual',
    cookieExpireHours: 4,
    cookieUpdatedAt: '',
    loginUrl: '',
    payloadText: '{}',
    payloadFields: [],
    paginationEnabled: false,
    pageField: '',
    pageSizeField: '',
    pageSize: 100,
    totalPath: '',
    maxPages: 1,
    stopMode: 'max-pages',
    listPath: '',
    fieldsText: '{\n  "用户ID": "id",\n  "姓名": "name",\n  "用户名": "username",\n  "邮箱": "email",\n  "城市": "address.city",\n  "街道": "address.street",\n  "经度": "address.geo.lng",\n  "纬度": "address.geo.lat",\n  "公司": "company.name"\n}',
    storageTarget: 'excel',
    outputDir: 'C:\\Users\\61081\\Documents\\New project\\output\\real-site-test',
    databasePath: '',
    tableName: 'public_users',
    primaryKey: '用户ID',
    writeMode: 'append',
  }),
]

export const withBuiltInConfigs = (items: Partial<CrawlerConfig>[]): CrawlerConfig[] => {
  const normalized = items.map(normalizeConfig)
  const existing = new Set(normalized.map(item => item.id).filter(Boolean))
  return [
    ...builtInConfigs().filter(item => !existing.has(item.id)),
    ...normalized,
  ]
}

export const selectInitialConfig = (
  configs: CrawlerConfig[],
  activeConfig: Partial<CrawlerConfig> | null | undefined,
) => {
  const activeExists = configs.some(item => item.id === activeConfig?.id)
  return activeConfig && activeExists
    ? configs.find(item => item.id === activeConfig.id) || configs[0] || null
    : configs[0] || null
}

export const getByPath = (source: unknown, path = ''): unknown => {
  if (!path.trim()) return source
  return path
    .split('.')
    .filter(Boolean)
    .reduce<unknown>((current, key) => {
      if (current == null || typeof current !== 'object') return undefined
      return (current as Record<string, unknown>)[key]
    }, source)
}

export const setByPath = (source: Record<string, unknown>, path = '', value: unknown) => {
  const parts = path.split('.').filter(Boolean)
  if (!parts.length) return source

  let current: Record<string, unknown> = source
  for (const part of parts.slice(0, -1)) {
    const next = current[part]
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
  return source
}

export const applyRuntimeParams = (
  payload: Record<string, unknown>,
  runtimeParams: Record<string, unknown> = {},
) => {
  const next = JSON.parse(JSON.stringify(payload || {}))
  for (const [path, value] of Object.entries(runtimeParams)) {
    if (!path || value === undefined || value === null || value === '') continue
    setByPath(next, path, value)
  }
  return next
}

export const parseHeaders = (text = '', cookie = ''): Record<string, string> => {
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

export const parseJsonObject = (text = ''): Record<string, unknown> => {
  const trimmed = text.trim()
  if (!trimmed) return {}
  const parsed = JSON.parse(trimmed)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

export const extractRowsFromResponse = (
  response: unknown,
  config: Pick<CrawlerConfig, 'listPath' | 'fieldsText'>,
) => {
  const list = getByPath(response, config.listPath)
  const rows = Array.isArray(list) ? list : []
  const fields = parseJsonObject(config.fieldsText)
  const entries = Object.entries(fields)

  if (!entries.length) return rows

  return rows.map(row => {
    const mapped: Record<string, unknown> = {}
    for (const [label, path] of entries) {
      mapped[label] = getByPath(row, String(path))
    }
    return mapped
  })
}

export const buildGetUrl = (url: string, payload: Record<string, unknown>) => {
  const next = new URL(url)
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null || value === '') continue
    next.searchParams.set(key, String(value))
  }
  return next.toString()
}

export const toIpcSafe = <T>(value: T): T => JSON.parse(JSON.stringify(value))
