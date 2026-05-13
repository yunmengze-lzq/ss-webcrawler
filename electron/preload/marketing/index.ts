/**
 * 营销系统 · 报装负荷爬取
 * 主要数据：已报装容量、意向报装、用户类型
 */
import { catchFun, reportComplete, getCookie, hookRequests, yesterday, isConfiguredUrl, runDiscoveryMode } from '../utils'

const CONFIG = {
  LIST_URL:    'TODO: http://10.x.x.x/api/marketing/declare/list',
  AUTH_HEADER: 'access-token',
  fields: {
    declareId:    'applyId',      // TODO 报装申请 ID（唯一键）
    tsId:         'stationId',   // TODO 关联台区 ID
    userName:     'userName',    // TODO 用电用户名
    capacityKw:   'applyCapacity',// TODO 申请容量 kW
    status:       'status',      // TODO 状态字段
    // 状态值映射：把系统状态值 → 'confirmed'/'intent'
    statusMap: {
      '已接入': 'confirmed',
      '已批准': 'confirmed',
      '审核中': 'intent',
      '意向':   'intent',
    } as Record<string, string>,
    expectedDate: 'expectedDate', // TODO 预计接入时间
    listPath:     ['data', 'list'] as string[],
  },
}

catchFun('startCrawl', async (args) => {
  const { winKey, lastSyncDate = yesterday() } = args
  if (!isConfiguredUrl(CONFIG.LIST_URL)) {
    console.warn('[marketing] 接口未确认，进入 RPA 发现/导出文件模式')
    await runDiscoveryMode(winKey, 'marketing', args)
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

    const records = list.map(item => {
      const rawStatus = item[CONFIG.fields.status] ?? ''
      const status = CONFIG.fields.statusMap[rawStatus] ?? 'intent'
      return {
        declare_id:    item[CONFIG.fields.declareId],
        ts_id:         item[CONFIG.fields.tsId],
        user_name:     item[CONFIG.fields.userName] ?? '',
        capacity_kw:   Number(item[CONFIG.fields.capacityKw] ?? 0),
        status,
        expected_date: item[CONFIG.fields.expectedDate] ?? '',
        updated_at:    new Date().toISOString(),
      }
    }).filter((r: any) => r.declare_id && r.ts_id)

    console.log('[marketing] 报装记录:', records.length, '条')
    reportComplete(winKey, { success: true, records, count: records.length })
  } catch (e: any) {
    reportComplete(winKey, { success: false, error: e.message })
  }
}, 3_000)

const getNestedValue = (obj: any, path: string[]): any =>
  path.reduce((cur, key) => cur?.[key], obj)
