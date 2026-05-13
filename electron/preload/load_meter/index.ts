/**
 * 计量自动化系统 · 台区负荷数据爬取
 *
 * 使用方式：
 * 1. 在内网 DevTools Console 执行 hookRequests() 观察接口
 * 2. 把抓到的 URL 和字段名填入下方 CONFIG（替换 TODO 部分）
 * 3. 重启子窗口，触发爬取测试
 */
import { ipcRenderer } from 'electron'
import { catchFun, reportComplete, waitForElement, getCookie, hookRequests, yesterday, today, isConfiguredUrl, runDiscoveryMode } from '../utils'

// ═══════════════════════════════════════════════════════════════
//  ⬇️  内网调试时填写此处（抓包后替换 TODO）
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  /** 台区列表接口 */
  LIST_URL:  'TODO: http://10.x.x.x/api/station/list',
  /** 日负载率查询接口 */
  LOAD_URL:  'TODO: http://10.x.x.x/api/load/daily-rate',
  /** 鉴权 header 名（如果用 Cookie 鉴权则留空，会自动带 Cookie） */
  AUTH_HEADER: 'access-token',   // 常见值：access-token / Authorization / token

  /** 返回数据字段映射（根据实际返回体修改） */
  fields: {
    list: {
      tsId:   'stationId',   // TODO 台区ID字段名
      tsName: 'stationName', // TODO 台区名称字段名
    },
    load: {
      tsId:        'stationId',  // TODO
      date:        'checkDate',  // TODO  格式 YYYY-MM-DD
      loadRateMax: 'maxLoadRate',// TODO  数字，单位 %
      loadRateAvg: 'avgLoadRate',// TODO
      loadKwMax:   'maxLoadKw',  // TODO
    },
    /** 列表接口返回数组的路径，例如 data.list 则填 ['data','list'] */
    listPath: ['data', 'list'],
    loadPath: ['data', 'list'],
  },

  /** 每批请求的台区数量（避免单次请求过大） */
  BATCH_SIZE: 50,
  /** 批次间隔（毫秒），避免对系统造成压力 */
  BATCH_DELAY: 500,
}
// ═══════════════════════════════════════════════════════════════

catchFun('startCrawl', async (args) => {
  const { winKey, lastSyncDate = yesterday() } = args

  if (!isConfiguredUrl(CONFIG.LIST_URL) || !isConfiguredUrl(CONFIG.LOAD_URL)) {
    console.warn('[load_meter] 接口未确认，进入 RPA 发现/导出文件模式')
    await runDiscoveryMode(winKey, 'load_meter', args)
    return
  }

  // 调试模式：开启请求监听，方便抓包（找到接口后注释掉这行）
  hookRequests()

  console.log(`[load_meter] 开始，增量起始: ${lastSyncDate}`)

  // 等待页面特征元素（根据实际页面修改选择器）
  try { await waitForElement('body', 10_000) } catch { /* 忽略 */ }

  const token = getCookie(CONFIG.AUTH_HEADER) || getCookie('access-token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { [CONFIG.AUTH_HEADER]: token } : {}),
  }

  // Step 1: 获取台区列表
  const tsList = await fetchTsList(headers)
  if (!tsList.length) {
    reportComplete(winKey, { success: false, error: '台区列表为空，请检查接口或鉴权' })
    return
  }
  console.log(`[load_meter] 台区数: ${tsList.length}`)

  // Step 2: 分批拉取负荷数据
  const allRecords: any[] = []
  for (let i = 0; i < tsList.length; i += CONFIG.BATCH_SIZE) {
    const batch = tsList.slice(i, i + CONFIG.BATCH_SIZE)
    const records = await fetchLoadBatch(batch.map((t: any) => t.tsId), lastSyncDate, today(), headers)
    allRecords.push(...records)
    console.log(`[load_meter] 进度 ${Math.min(i + CONFIG.BATCH_SIZE, tsList.length)}/${tsList.length}，已取 ${allRecords.length} 条`)
    if (i + CONFIG.BATCH_SIZE < tsList.length) await sleep(CONFIG.BATCH_DELAY)
  }

  console.log(`[load_meter] 爬取完成，共 ${allRecords.length} 条`)
  reportComplete(winKey, { success: true, records: allRecords, count: allRecords.length })
}, 5_000)

// ── API 调用 ────────────────────────────────────────────────────

const fetchTsList = async (headers: Record<string, string>): Promise<any[]> => {
  try {
    const res = await fetch(CONFIG.LIST_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ pageSize: 9999, pageNo: 1 }),  // TODO 字段名
    })
    const data = await res.json()
    const list = getNestedValue(data, CONFIG.fields.listPath) ?? []
    return list.map((item: any) => ({
      tsId:   item[CONFIG.fields.list.tsId],
      tsName: item[CONFIG.fields.list.tsName],
    }))
  } catch (e: any) {
    console.error('[load_meter] 台区列表获取失败:', e.message)
    return []
  }
}

const fetchLoadBatch = async (
  tsIds: string[],
  startDate: string,
  endDate: string,
  headers: Record<string, string>
): Promise<any[]> => {
  try {
    const res = await fetch(CONFIG.LOAD_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        stationIds: tsIds,  // TODO 字段名
        startDate,
        endDate,
        dataType: 'daily',  // TODO
      }),
    })
    const data = await res.json()
    const list = getNestedValue(data, CONFIG.fields.loadPath) ?? []
    return list.map((item: any) => ({
      ts_id:         item[CONFIG.fields.load.tsId],
      record_date:   item[CONFIG.fields.load.date],
      load_rate_max: Number(item[CONFIG.fields.load.loadRateMax] ?? 0),
      load_rate_avg: Number(item[CONFIG.fields.load.loadRateAvg] ?? 0),
      load_kw_max:   Number(item[CONFIG.fields.load.loadKwMax]   ?? 0),
    })).filter((r: any) => r.ts_id && r.record_date)
  } catch (e: any) {
    console.error('[load_meter] 负荷数据获取失败:', e.message)
    return []
  }
}

// ── 工具 ──────────────────────────────────────────────────────────
/** 按路径取嵌套值，如 ['data','list'] 取 obj.data.list */
const getNestedValue = (obj: any, path: string[]): any =>
  path.reduce((cur, key) => cur?.[key], obj)

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
