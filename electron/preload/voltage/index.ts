/**
 * 电压监测系统 · 低电压事件爬取
 */
import { catchFun, reportComplete, getCookie, hookRequests, yesterday, isConfiguredUrl, runDiscoveryMode } from '../utils'

const CONFIG = {
  LIST_URL:    'TODO: http://10.x.x.x/api/voltage/event/list',
  AUTH_HEADER: 'access-token',
  fields: {
    eventId:     'eventId',     // TODO 事件唯一 ID
    tsId:        'stationId',  // TODO
    startTime:   'startTime',  // TODO 格式 YYYY-MM-DD HH:mm:ss
    durationMin: 'duration',   // TODO 持续时间（分钟）
    voltageMin:  'minVoltage', // TODO 最低电压 V
    nodeDesc:    'location',   // TODO 发生位置描述
    listPath:    ['data', 'list'] as string[],
  },
  // 只保存电压低于此值的事件（204.6V = 220 × 93%）
  VOLTAGE_THRESHOLD: 204.6,
}

catchFun('startCrawl', async (args) => {
  const { winKey, lastSyncDate = yesterday() } = args
  if (!isConfiguredUrl(CONFIG.LIST_URL)) {
    console.warn('[voltage] 接口未确认，进入 RPA 发现/导出文件模式')
    await runDiscoveryMode(winKey, 'voltage', args)
    return
  }
  hookRequests()

  const token = getCookie(CONFIG.AUTH_HEADER) || getCookie('access-token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { [CONFIG.AUTH_HEADER]: token } : {}),
  }

  try {
    const res = await fetch(CONFIG.LIST_URL, {
      method: 'POST', headers,
      body: JSON.stringify({ startDate: lastSyncDate, pageSize: 9999, pageNo: 1 }),
    })
    const data = await res.json()
    const list: any[] = getNestedValue(data, CONFIG.fields.listPath) ?? []

    const records = list
      .map(item => ({
        event_id:    item[CONFIG.fields.eventId],
        ts_id:       item[CONFIG.fields.tsId],
        start_time:  item[CONFIG.fields.startTime],
        duration_min:Number(item[CONFIG.fields.durationMin] ?? 0),
        voltage_min: Number(item[CONFIG.fields.voltageMin] ?? 0),
        node_desc:   item[CONFIG.fields.nodeDesc] ?? '',
      }))
      .filter((r: any) =>
        r.event_id && r.ts_id &&
        r.voltage_min > 0 && r.voltage_min < CONFIG.VOLTAGE_THRESHOLD
      )

    console.log('[voltage] 低电压事件:', records.length, '条')
    reportComplete(winKey, { success: true, records, count: records.length })
  } catch (e: any) {
    reportComplete(winKey, { success: false, error: e.message })
  }
}, 3_000)

const getNestedValue = (obj: any, path: string[]): any =>
  path.reduce((cur, key) => cur?.[key], obj)
