export type StorageTarget = 'excel' | 'database' | 'both'
export type DatabaseWriteMode = 'append' | 'overwrite' | 'upsert'
export type CookieRefreshMode = 'manual' | 'rpa-login'
export type PayloadFieldType = 'text' | 'number' | 'date' | 'select'
export type PaginationStopMode = 'empty-list' | 'total-count' | 'max-pages'

export type PayloadField = {
  id: string
  label: string
  path: string
  type: PayloadFieldType
  defaultValue: string
  required: boolean
  optionsText: string
}

export type RuntimeParams = Record<string, string | number | boolean>

export type CrawlerConfig = {
  id?: string
  name: string
  system: string
  category: string
  description: string
  method: 'GET' | 'POST'
  url: string
  headersText: string
  cookie: string
  cookieRefreshMode: CookieRefreshMode
  cookieExpireHours: number
  cookieUpdatedAt: string
  loginUrl: string
  payloadText: string
  payloadFields: PayloadField[]
  paginationEnabled: boolean
  pageField: string
  pageSizeField: string
  pageSize: number
  totalPath: string
  maxPages: number
  stopMode: PaginationStopMode
  listPath: string
  fieldsText: string
  storageTarget: StorageTarget
  outputDir: string
  databasePath: string
  tableName: string
  primaryKey: string
  writeMode: DatabaseWriteMode
  updatedAt?: string
  lastRunAt?: string
  lastCount?: number
}

export type RunResult = {
  success?: boolean
  status?: number
  count?: number
  message?: string
  error?: string
  files?: Record<string, string>
  sample?: unknown[]
  storageAdvice?: string
}
