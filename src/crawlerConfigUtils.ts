import type { CrawlerConfig, NetworkCaptureParseResult } from './types'

export const blankConfig = (): CrawlerConfig => ({
  name: '新建数据接口',
  system: 'custom',
  category: '未分类',
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
  paginationEnabled: false,
  pageField: '',
  pageSizeField: '',
  pageSize: 100,
  totalPath: 'data.total',
  maxPages: 100,
  stopMode: 'empty-list',
  listPath: '',
  fieldsText: '{\n  "ts_id": "stationId",\n  "record_date": "date",\n  "value": "value"\n}',
  storageTarget: 'excel',
  outputDir: '',
  databasePath: '',
  tableName: 'crawler_rows',
  primaryKey: 'ts_id',
  writeMode: 'append',
})

const storageTargets = new Set(['excel', 'database', 'both'])

export const normalizeStorageTarget = (target: unknown): CrawlerConfig['storageTarget'] =>
  storageTargets.has(String(target)) ? target as CrawlerConfig['storageTarget'] : 'excel'

export const normalizeConfig = (config: Partial<CrawlerConfig>): CrawlerConfig => ({
  ...blankConfig(),
  ...config,
  storageTarget: normalizeStorageTarget(config.storageTarget),
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
  const trimmed = normalizeJsonText(text)
  if (trimmed) {
    if (trimmed.startsWith('{')) {
      Object.assign(headers, parseJsonObject(trimmed, 'Headers'))
    } else {
      for (const line of trimmed.split(/\r?\n/)) {
        if (!line.trim()) continue
        const idx = line.indexOf(':')
        if (idx <= 0) {
          throw new Error(`Headers format error: cannot parse "${line.trim()}". Use JSON or one Header: Value per line.`)
        }
        headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
      }
    }
  }
  if (cookie.trim()) headers.Cookie = cookie.trim()
  return headers
}

export const normalizeJsonText = (text = '') => text
  .replace(/^\uFEFF/, '')
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/`r/g, '\r')
  .replace(/`n/g, '\n')
  .trim()

export const repairJsonText = (text = '') => {
  let next = normalizeJsonText(text)
  if (!next) return next
  if (!/^[{\[]/.test(next) && next.includes(':')) next = '{' + next + '}'
  return next
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_all, value) => '"' + String(value).replace(/"/g, '\\"') + '"')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([{,]\s*)([A-Za-z_$][\w$.-]*|[\u4e00-\u9fa5][^:\r\n,{]*?)\s*:/g, (_all, prefix, key) => prefix + '"' + String(key).trim() + '":')
}

export const parseJsonObject = (text = '', label = 'JSON'): Record<string, unknown> => {
  const trimmed = normalizeJsonText(text)
  if (!trimmed) return {}
  const candidates = Array.from(new Set([trimmed, repairJsonText(trimmed)]))
  let lastError: any = null
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch (error: any) {
      lastError = error
    }
  }
  throw new Error(label + ' format error: ' + (lastError?.message || String(lastError)) + '. Use an object like {"pageNo":1}; quote property names and string values.')
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

const headerNameMap: Record<string, string> = {
  ':authority': 'Host',
  accept: 'Accept',
  'accept-encoding': 'Accept-Encoding',
  'accept-language': 'Accept-Language',
  'content-type': 'Content-Type',
  authorization: 'Authorization',
  cookie: 'Cookie',
  referer: 'Referer',
  origin: 'Origin',
  'user-agent': 'User-Agent',
  'x-requested-with': 'X-Requested-With',
}

export const isSignatureKey = (key = '') => /(^|[-_.])(sign|signature|timestamp|nonce|appkey|appid|token|csrf|xsrf)([-_.]|$)/i.test(key)

const normalizeHeaderName = (name: string) => {
  const key = name.trim().toLowerCase()
  return headerNameMap[key] || name.trim().split('-').map(part =>
    part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part,
  ).join('-')
}

const looksLikeJsonStart = (line: string) => /^[{\[]/.test(line.trim())

const chromeMetaLabels: Record<string, string> = {
  '请求网址': 'request url',
  '请求方法': 'request method',
  '状态代码': 'status code',
  '远程地址': 'remote address',
  '引荐来源网址政策': 'referrer policy',
  'request url': 'request url',
  'request method': 'request method',
  'status code': 'status code',
  'remote address': 'remote address',
  'referrer policy': 'referrer policy',
}

const ignoredResponseHeaderNames = new Set([
  'alt-svc',
  'cf-cache-status',
  'cf-ray',
  'content-encoding',
  'content-security-policy',
  'content-security-policy-report-only',
  'date',
  'nel',
  'report-to',
  'reporting-endpoints',
  'server',
  'strict-transport-security',
  'vary',
  'via',
  'x-content-type-options',
  'x-discord-features',
])

const requestHeaderNames = new Set([
  ':authority',
  ':method',
  ':path',
  ':scheme',
  'accept',
  'accept-encoding',
  'accept-language',
  'authorization',
  'content-type',
  'cookie',
  'origin',
  'priority',
  'referer',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'user-agent',
  'x-debug-options',
  'x-discord-locale',
  'x-discord-timezone',
  'x-installation-id',
  'x-requested-with',
  'x-super-properties',
])

const extractBalancedJson = (text: string) => {
  const start = text.search(/[{\[]/)
  if (start < 0) return ''
  const open = text[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let quote = ''
  let escaped = false
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === quote) {
        inString = false
      }
      continue
    }
    if (ch === '"' || ch === "'") {
      inString = true
      quote = ch
      continue
    }
    if (ch === open) depth += 1
    if (ch === close) depth -= 1
    if (depth === 0) return text.slice(start, i + 1)
  }
  return text.slice(start)
}

const sectionAfter = (text: string, labels: string[]) => {
  const lines = text.split(/\r?\n/)
  const lowerLabels = labels.map(label => label.toLowerCase())
  const start = lines.findIndex(line => lowerLabels.includes(line.trim().toLowerCase()))
  if (start < 0) return ''
  const out: string[] = []
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim()
    if (
      out.length
      && /^[A-Za-z][A-Za-z\s-]{2,40}$/.test(trimmed)
      && !trimmed.includes(':')
      && !looksLikeJsonStart(trimmed)
    ) break
    out.push(line)
  }
  return out.join('\n').trim()
}

const parseKeyValueBlock = (text: string) => {
  const out: Record<string, string> = {}
  const lines = text.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()
    if (!trimmed || looksLikeJsonStart(trimmed)) continue
    const idx = trimmed.indexOf(':')
    if (idx > 0 && !/^https?:\/\//i.test(trimmed)) {
      out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
      continue
    }

    const key = trimmed.toLowerCase()
    const next = lines[index + 1]?.trim()
    if (!next) continue
    if (chromeMetaLabels[key] || requestHeaderNames.has(key) || ignoredResponseHeaderNames.has(key)) {
      out[trimmed] = next
      index += 1
    }
  }
  return out
}

const parseSearchParamsBlock = (text: string) => {
  const out: Record<string, unknown> = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^\?/, '')
    if (!line || looksLikeJsonStart(line) || !line.includes('=')) continue
    const params = new URLSearchParams(line)
    for (const [key, value] of params.entries()) out[key] = coerceScalar(value)
  }
  return out
}

const unquote = (value = '') => value.trim().replace(/^['"]|['"]$/g, '')

const parseCurlCapture = (text: string) => {
  if (!/\bcurl\b/i.test(text)) return { url: '', method: '', headers: {}, payloadText: '' }
  const oneLine = text.replace(/\\\r?\n/g, ' ')
  const url = oneLine.match(/\bcurl\s+(?:--location\s+)?['"]([^'"]+)['"]/i)?.[1]
    || oneLine.match(/\bcurl\s+(https?:\/\/\S+)/i)?.[1]
    || ''
  const headers: Record<string, string> = {}
  for (const match of oneLine.matchAll(/(?:-H|--header)\s+['"]([^'"]+)['"]/gi)) {
    const idx = match[1].indexOf(':')
    if (idx > 0) headers[match[1].slice(0, idx).trim()] = match[1].slice(idx + 1).trim()
  }
  const method = oneLine.match(/(?:-X|--request)\s+['"]?([A-Z]+)['"]?/i)?.[1]?.toUpperCase() || ''
  const payloadText = oneLine.match(/(?:--data-raw|--data|--data-binary|-d)\s+(['"])(.*?)\1/i)?.[2] || ''
  return { url, method, headers, payloadText }
}

const parseFetchCapture = (text: string) => {
  if (!/\bfetch\s*\(/i.test(text)) return { url: '', method: '', headers: {}, payloadText: '' }
  const url = text.match(/\bfetch\s*\(\s*['"]([^'"]+)['"]/i)?.[1] || ''
  const method = text.match(/["']?method["']?\s*:\s*['"]([A-Z]+)['"]/i)?.[1]?.toUpperCase() || ''
  const headersText = text.match(/["']?headers["']?\s*:\s*(\{[\s\S]*?\})\s*,?\s*(?:"?(?:body|credentials|mode|cache|referrer|referrerPolicy|integrity|keepalive|signal)"?\s*:|\})/i)?.[1] || ''
  let headers: Record<string, string> = {}
  if (headersText) {
    try {
      headers = Object.fromEntries(Object.entries(parseJsonObject(headersText, 'Fetch headers')).map(([key, value]) => [key, String(value)]))
    } catch {
      headers = {}
    }
  }
  const payloadText = unquote(text.match(/["']?body["']?\s*:\s*(`[\s\S]*?`|'[\s\S]*?'|"[\s\S]*?")/i)?.[1] || '')
  return { url, method, headers, payloadText }
}

const parsePayloadLoose = (text: string, warnings: string[]) => {
  const jsonText = extractBalancedJson(text)
  if (jsonText) {
    try {
      return parseJsonObject(jsonText, 'Payload JSON')
    } catch (error: any) {
      warnings.push(error?.message || String(error))
    }
  }
  return parseSearchParamsBlock(text)
}

const coerceScalar = (value: string): unknown => {
  const trimmed = value.trim()
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  return trimmed
}

const parsePayloadFromText = (text: string, warnings: string[]) => {
  const payloadSection = sectionAfter(text, ['Request Payload', 'Payload', 'Form Data'])
  const payloadParams = parsePayloadLoose(payloadSection, warnings)
  if (Object.keys(payloadParams).length) return payloadParams
  const querySection = sectionAfter(text, ['Query String Parameters', 'Query Parameters'])
  const params = {
    ...Object.fromEntries(Object.entries(parseKeyValueBlock(querySection)).map(([key, value]) => [key, coerceScalar(value)])),
    ...parseSearchParamsBlock(querySection),
  }
  return params
}

const findFirstArrayPath = (value: unknown, prefix = '', depth = 0): { path: string; rows: unknown[] } | null => {
  if (Array.isArray(value)) return { path: prefix, rows: value }
  if (!value || typeof value !== 'object' || depth > 5) return null
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const result = findFirstArrayPath(child, prefix ? `${prefix}.${key}` : key, depth + 1)
    if (result) return result
  }
  return null
}

const flattenFieldPaths = (value: unknown, prefix = '', out: Record<string, string> = {}, depth = 0) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 2) return out
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child) && depth < 2) {
      flattenFieldPaths(child, path, out, depth + 1)
    } else if (!Array.isArray(child)) {
      out[key] = path
    }
  }
  return out
}

const parseDevtoolsPreviewFields = (text: string) => {
  const fields: Record<string, string> = {}
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const inlineObjectKeys = (value: string) => {
    if (!/^\{.*\}$/.test(value)) return []
    return Array.from(value.matchAll(/(?:^|[,{]\s*)([A-Za-z_$][\w$]*)\s*:/g))
      .map(match => match[1])
      .filter(key => !/^\d+$/.test(key))
  }

  for (let index = 0; index < lines.length - 2; index += 1) {
    const key = lines[index]
    if (!/^[A-Za-z_$][\w$]*$/.test(key)) continue
    if (lines[index + 1] !== ':') continue
    if (/^\d+$/.test(key)) continue
    const childKeys = inlineObjectKeys(lines[index + 2] || '')
    if (childKeys.length) {
      for (const childKey of childKeys) fields[`${key}_${childKey}`] = `${key}.${childKey}`
      continue
    }
    fields[key] = key
  }
  return fields
}

const requestUrlFromPath = (source: string, rawHeaders: Record<string, string>) => {
  const authority = rawHeaders[':authority'] || rawHeaders[':Authority']
  const path = rawHeaders[':path'] || rawHeaders[':Path']
  const scheme = rawHeaders[':scheme'] || rawHeaders[':Scheme'] || 'https'
  return authority && path ? `${scheme}://${authority}${path}` : ''
}

export const parseNetworkCapture = (text = ''): NetworkCaptureParseResult => {
  const source = normalizeJsonText(text)
  const warnings: string[] = []
  const curlCapture = parseCurlCapture(source)
  const fetchCapture = parseFetchCapture(source)
  const rawHeaders = parseKeyValueBlock(source)
  const requestUrlKey = Object.keys(rawHeaders).find(key => chromeMetaLabels[key.toLowerCase()] === 'request url')
  const requestMethodKey = Object.keys(rawHeaders).find(key => chromeMetaLabels[key.toLowerCase()] === 'request method')
  const url = curlCapture.url
    || fetchCapture.url
    || (requestUrlKey ? rawHeaders[requestUrlKey] : '')
    || source.match(/(?:Request URL|url)\s*:\s*(https?:\/\/\S+)/i)?.[1]
    || source.match(/\bhttps?:\/\/[^\s"'<>]+/)?.[0]
    || requestUrlFromPath(source, rawHeaders)
    || ''
  const methodText = curlCapture.method
    || fetchCapture.method
    || (requestMethodKey ? rawHeaders[requestMethodKey] : '')
    || rawHeaders[':method']
    || rawHeaders[':Method']
    || source.match(/(?:Request Method|method)\s*:\s*(GET|POST)/i)?.[1]
  const method = methodText === 'GET' || (!methodText && !curlCapture.payloadText && !fetchCapture.payloadText) ? 'GET' : 'POST'

  const headers: Record<string, string> = {}
  let cookie = ''
  for (const [key, value] of Object.entries({ ...rawHeaders, ...curlCapture.headers, ...fetchCapture.headers })) {
    const lower = key.toLowerCase()
    const canonicalMeta = chromeMetaLabels[lower]
    if (canonicalMeta || ['url', 'method'].includes(lower)) continue
    if (ignoredResponseHeaderNames.has(lower)) continue
    if (lower.startsWith(':') && ![':authority'].includes(lower)) continue
    if (!requestHeaderNames.has(lower) && !lower.startsWith('x-')) continue
    if (lower === 'cookie') {
      cookie = value
      continue
    }
    headers[normalizeHeaderName(key)] = value
  }

  const queryPayload = Object.fromEntries(Object.entries(parseKeyValueBlock(sectionAfter(source, ['Query String Parameters', 'Query Parameters']))).map(
    ([key, value]) => [key, coerceScalar(value)],
  ))
  const bodyPayload = {
    ...parsePayloadLoose(curlCapture.payloadText, warnings),
    ...parsePayloadLoose(fetchCapture.payloadText, warnings),
    ...parsePayloadFromText(source, warnings),
  }
  const payload = { ...queryPayload, ...bodyPayload }
  const signatureKeys = [
    ...Object.keys(headers).filter(isSignatureKey),
    ...Object.keys(payload).filter(isSignatureKey),
  ]
  if (signatureKeys.length) {
    warnings.push(`Detected signed request fields: ${Array.from(new Set(signatureKeys)).join(', ')}. Keep URL, payload and signed headers unchanged, or refresh them from the browser before running.`)
  }

  let response: unknown = {}
  const responseSection = sectionAfter(source, ['Response', 'Preview', 'Response Body'])
  if ((responseSection || source).includes('…')) {
    warnings.push('DevTools preview contains ellipsis; paste the raw Response body for complete JSON and accurate fields.')
  }
  const responseJson = extractBalancedJson(responseSection || source)
  if (responseJson) {
    try {
      response = JSON.parse(repairJsonText(responseJson).replace(/,\s*…/g, '').replace(/…/g, ''))
    } catch (error: any) {
      warnings.push(`Response JSON parse failed: ${error?.message || String(error)}`)
    }
  }

  const arrayResult = findFirstArrayPath(response)
  const firstRow = arrayResult?.rows.find(item => item && typeof item === 'object' && !Array.isArray(item))
  const previewFields = {
    ...parseDevtoolsPreviewFields(responseSection),
    ...parseDevtoolsPreviewFields(source),
  }
  const fields = firstRow ? { ...previewFields, ...flattenFieldPaths(firstRow) } : previewFields
  if (!url) warnings.push('No request URL found.')
  if (!arrayResult && !Object.keys(previewFields).length) warnings.push('No array found in response JSON; listPath and fields were not generated.')
  if (!arrayResult && Object.keys(previewFields).length) warnings.push('Response preview is not raw JSON; fields were inferred from DevTools preview. Paste the raw Response body for more accurate mapping.')

  return {
    url,
    method,
    headers,
    cookie,
    payload,
    response,
    listPath: arrayResult?.path || '',
    fields,
    warnings,
  }
}
