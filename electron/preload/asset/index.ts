/**
 * 电网管理平台 · 资产台账爬取
 * 主要数据：配变容量、线路型号、线路长度、投运年份
 */
import { catchFun, reportComplete, getCookie, hookRequests, isConfiguredUrl, runDiscoveryMode } from '../utils'

const CONFIG = {
  LIST_URL:    'TODO: http://10.x.x.x/api/asset/transformer/list',
  AUTH_HEADER: 'access-token',
  fields: {
    tsId:        'stationId',   // TODO
    capacityKva: 'capacity',    // TODO 配变容量 kVA
    wireType:    'wireType',    // TODO 主干线路型号（LGJ-70 等）
    wireLen:     'wireLength',  // TODO 主干线路长度 m
    installYear: 'installYear', // TODO
    listPath:    ['data', 'list'] as string[],
  },
}

catchFun('startCrawl', async (args) => {
  const { winKey } = args
  if (!isConfiguredUrl(CONFIG.LIST_URL)) {
    console.warn('[asset] 接口未确认，进入 RPA 发现/导出文件模式')
    await runDiscoveryMode(winKey, 'asset', args)
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
      body: JSON.stringify({ pageSize: 99999, pageNo: 1 }),
    })
    const data = await res.json()
    const list: any[] = getNestedValue(data, CONFIG.fields.listPath) ?? []

    // 只更新有变化的字段，ts_id 必须与 GIS 爬取的一致
    const records = list.map(item => ({
      ts_id:         item[CONFIG.fields.tsId],
      capacity_kva:  Number(item[CONFIG.fields.capacityKva] ?? 0),
      wire_type:     item[CONFIG.fields.wireType] ?? '',
      wire_length_m: Number(item[CONFIG.fields.wireLen] ?? 0),
      install_year:  Number(item[CONFIG.fields.installYear] ?? 0),
      updated_at:    new Date().toISOString(),
    })).filter((r: any) => r.ts_id)

    console.log('[asset] 资产台账:', records.length, '条')
    reportComplete(winKey, { success: true, records, count: records.length })
  } catch (e: any) {
    reportComplete(winKey, { success: false, error: e.message })
  }
}, 3_000)

const getNestedValue = (obj: any, path: string[]): any =>
  path.reduce((cur, key) => cur?.[key], obj)
