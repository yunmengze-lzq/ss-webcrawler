/**
 * 数据库层
 * 所有 SQLite 操作由 Python 脚本执行（sqlite3 是 Python 标准库，零安装）
 * 本文件只负责：确保目录存在 + 暴露 DB_PATH 常量 + 封装常用查询
 *
 * 修复：移除对 better-sqlite3 的任何引用
 */
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { spawnPython } from './pythonBridge'
import { log } from './log/log'

const USER_DATA_DIR = path.join(app.getPath('appData'), 'ts-agent')
app.setName('ts-agent')
app.setPath('userData', USER_DATA_DIR)

const DATA_DIR = path.join(app.getPath('userData'), 'data')
export const DB_PATH = path.join(DATA_DIR, 'ts_agent.db')
const ENABLE_LOCAL_DB = process.env.TS_AGENT_ENABLE_LOCAL_DB === '1'

/** 确保目录存在，调用 Python 建表（幂等） */
export const initDb = async (): Promise<void> => {
  if (!ENABLE_LOCAL_DB) {
    log.warn('[DB] 默认不创建内网本地数据库。确认数据格式后设置 TS_AGENT_ENABLE_LOCAL_DB=1 再初始化。')
    return
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  const res = await spawnPython('db_init', { db_path: DB_PATH })
  if (!res.success) throw new Error(`数据库初始化失败: ${res.error}`)
  log.info(`[DB] 就绪: ${DB_PATH}`)
}

/** SELECT，返回行数组 */
export const dbQuery = async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  if (!ENABLE_LOCAL_DB) {
    log.warn('[DB] 本地数据库未启用，跳过 query')
    return []
  }
  const res = await spawnPython('db_exec', { db_path: DB_PATH, mode: 'query', sql, params })
  if (!res.success) { log.error(`[DB] query 失败: ${res.error}`); return [] }
  return res.data.rows as T[]
}

/** INSERT / UPDATE / DELETE */
export const dbRun = async (sql: string, params: any[] = []): Promise<number> => {
  if (!ENABLE_LOCAL_DB) {
    log.warn('[DB] 本地数据库未启用，跳过 run')
    return 0
  }
  const res = await spawnPython('db_exec', { db_path: DB_PATH, mode: 'run', sql, params })
  if (!res.success) { log.error(`[DB] run 失败: ${res.error}`); return 0 }
  return res.data.affected as number
}

/** 事务批量写入（同一条 SQL，多组参数） */
export const dbBatch = async (sql: string, rows: any[][]): Promise<number> => {
  if (!ENABLE_LOCAL_DB) {
    log.warn('[DB] 本地数据库未启用，跳过 batch')
    return 0
  }
  if (!rows.length) return 0
  const res = await spawnPython('db_exec', { db_path: DB_PATH, mode: 'batch', sql, rows })
  if (!res.success) { log.error(`[DB] batch 失败: ${res.error}`); return 0 }
  return res.data.count as number
}

// ── 常用查询快捷方式 ────────────────────────────────────────────

export const getOpenProblems = () => dbQuery(`
  SELECT p.*, t.lat, t.lng, t.capacity_kva, t.wire_type
  FROM   problem_records p
  LEFT JOIN transformer_stations t ON p.ts_id = t.ts_id
  WHERE  p.status = 'open'
  ORDER  BY p.severity DESC, p.created_at DESC
`)

export const getTsInfo = (tsId: string) =>
  dbQuery('SELECT * FROM transformer_stations WHERE ts_id = ?', [tsId])
    .then(rows => rows[0] ?? null)

/** 写入爬取日志 */
export const logCrawlStart = (logId: string, system: string) =>
  dbRun(
    `INSERT OR IGNORE INTO crawl_log (log_id, system_name, start_time, status) VALUES (?,?,?,?)`,
    [logId, system, new Date().toISOString(), 'running']
  )

export const logCrawlEnd = (
  logId: string,
  status: 'success' | 'failed',
  count: number,
  errMsg?: string
) =>
  dbRun(
    `UPDATE crawl_log SET end_time=?, status=?, records_count=?, error_msg=? WHERE log_id=?`,
    [new Date().toISOString(), status, count, errMsg ?? null, logId]
  )
