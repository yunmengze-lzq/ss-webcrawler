/**
 * 定时爬取调度
 *
 * 修复：
 * - 移除对 getDb()（better-sqlite3）的引用，改用 logCrawlStart/End
 * - runCrawlTask 改为直接调用 spawnPython，不再依赖 ipcMain.emit 内部触发
 * - 问题扫描后同步写入 crawl_log
 */
import schedule from 'node-schedule'
import { log } from './log/log'
import { spawnPython } from './pythonBridge'
import { logCrawlStart, logCrawlEnd, DB_PATH } from './db'

const DAILY_TASKS  = ['load_meter', 'marketing', 'voltage']
const WEEKLY_TASKS = ['gis', 'asset']

export const startSchedule = () => {
  if (process.env.TS_AGENT_ENABLE_SCHEDULE !== '1') {
    log.warn('[Schedule] 默认禁用定时爬取。接口、文件格式、入库策略确认后设置 TS_AGENT_ENABLE_SCHEDULE=1。')
    return
  }
  // 每日 02:00
  schedule.scheduleJob('0 2 * * *', async () => {
    log.info('[Schedule] 每日爬取开始')
    for (const sys of DAILY_TASKS) await runCrawl(sys)
    await runProblemScan()
    log.info('[Schedule] 每日爬取结束')
  })

  // 每周一 03:00
  schedule.scheduleJob('0 3 * * 1', async () => {
    log.info('[Schedule] 每周爬取开始')
    for (const sys of WEEKLY_TASKS) await runCrawl(sys)
    log.info('[Schedule] 每周爬取结束')
  })

  // 每月1日 04:00 压缩历史数据
  schedule.scheduleJob('0 4 1 * *', async () => {
    const res = await spawnPython('db_compress', { db_path: DB_PATH })
    log.info(res.success ? '[Schedule] 历史数据压缩完成' : `[Schedule] 压缩失败: ${res.error}`)
  })

  log.info('[Schedule] 定时任务已注册（每日 02:00 / 每周一 03:00 / 每月1日 04:00）')
}

/**
 * 调用 Python 脚本执行单个系统的爬取逻辑
 * （爬取的核心逻辑在 Preload 脚本里通过 Electron 子窗口运行，
 *   定时任务版直接调 Python 脚本做纯接口爬取，不打开浏览器窗口）
 * TODO：等内网接口抓包完成后，把各系统 API 调用逻辑搬到对应的 python/crawl_<sys>.py
 */
const runCrawl = async (system: string) => {
  const logId = `${system}_${Date.now()}`
  await logCrawlStart(logId, system)
  log.info(`[Schedule] 爬取: ${system}`)

  const res = await spawnPython(`crawl_${system}`, { db_path: DB_PATH })
  const count = res.data?.count ?? 0

  await logCrawlEnd(logId, res.success ? 'success' : 'failed', count, res.error)
  if (!res.success) log.warn(`[Schedule] ${system} 爬取失败: ${res.error}`)
}

const runProblemScan = async () => {
  const res = await spawnPython('problem_scan', { db_path: DB_PATH })
  if (res.success) {
    log.info(`[Schedule] 问题扫描完成，新增 ${res.data?.new_count ?? 0} 条`)
  } else {
    log.warn(`[Schedule] 问题扫描失败: ${res.error}`)
  }
}
