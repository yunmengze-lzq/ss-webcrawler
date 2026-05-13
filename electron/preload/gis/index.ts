/**
 * GIS 设备中心 · 台区地理信息爬取
 * 填写 CONFIG 后可用，模式与 load_meter 完全一致
 */
import { catchFun, reportComplete, getCookie, hookRequests, isConfiguredUrl, runDiscoveryMode } from '../utils'

const CONFIG = {
  LIST_URL:    'TODO: http://10.x.x.x/api/gis/station/list',
  AUTH_HEADER: 'access-token',
  fields: {
    tsId:       'stationId',    // TODO
    tsName:     'stationName',  // TODO
    feederName: 'feederName',   // TODO
    lat:        'lat',          // TODO 纬度字段名
    lng:        'lng',          // TODO 经度字段名
    capacityKva:'capacity',     // TODO
    wireType:   'mainWireType', // TODO
    wireLen:    'mainWireLength',// TODO 单位 m
    installYear:'installYear',  // TODO
    listPath:   ['data', 'list'] as string[], // TODO 返回数组路径
  },
  /**
   * 坐标系（抓包拿到坐标后，在百度地图上标注确认）
   * 'WGS84' - GPS 标准   'GCJ02' - 火星坐标（国内多数）  'BD09' - 百度
   * WGS84 与 GCJ02 在广州约差 300-500m，必须确认！
   */
  CRS: 'GCJ02' as 'WGS84' | 'GCJ02' | 'BD09',
}

catchFun('startCrawl', async (args) => {
  const { winKey } = args
  if (!isConfiguredUrl(CONFIG.LIST_URL)) {
    console.warn('[gis] 接口未确认，进入 RPA 发现/导出文件模式')
    await runDiscoveryMode(winKey, 'gis', args)
    return
  }
  hookRequests() // 找到接口后注释此行

  const token = getCookie(CONFIG.AUTH_HEADER) || getCookie('access-token')
  const headers: Record<string, string> = {
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

    const records = list.map(item => {
      let lat = Number(item[CONFIG.fields.lat] ?? 0)
      let lng = Number(item[CONFIG.fields.lng] ?? 0)
      // 统一转为 WGS84 存储，布点算法使用
      if (CONFIG.CRS === 'GCJ02' && lat && lng) [lat, lng] = gcj02ToWgs84(lat, lng)

      return {
        ts_id:         item[CONFIG.fields.tsId],
        ts_name:       item[CONFIG.fields.tsName],
        feeder_name:   item[CONFIG.fields.feederName],
        lat:           lat || null,
        lng:           lng || null,
        capacity_kva:  Number(item[CONFIG.fields.capacityKva] ?? 0),
        wire_type:     item[CONFIG.fields.wireType] ?? '',
        wire_length_m: Number(item[CONFIG.fields.wireLen] ?? 0),
        install_year:  Number(item[CONFIG.fields.installYear] ?? 0),
        updated_at:    new Date().toISOString(),
      }
    }).filter((r: any) => r.ts_id)

    console.log('[gis] 台区数:', records.length)
    reportComplete(winKey, { success: true, records, count: records.length })
  } catch (e: any) {
    console.error('[gis] 失败:', e.message)
    reportComplete(winKey, { success: false, error: e.message })
  }
}, 3_000)

// ── GCJ02 → WGS84 ──────────────────────────────────────────────
function gcj02ToWgs84(lat: number, lng: number): [number, number] {
  const a = 6378245.0, ee = 0.00669342162296594323
  const dLat = transformLat(lng - 105, lat - 35)
  const dLng = transformLng(lng - 105, lat - 35)
  const radLat = lat / 180 * Math.PI
  let magic = Math.sin(radLat)
  magic = 1 - ee * magic * magic
  const sq = Math.sqrt(magic)
  return [
    lat - dLat * 180 / (a * (1 - ee) / (magic * sq) * Math.PI),
    lng - dLng * 180 / (a / sq * Math.cos(radLat) * Math.PI),
  ]
}
function transformLat(x: number, y: number) {
  let r = -100 + 2*x + 3*y + 0.2*y*y + 0.1*x*y + 0.2*Math.sqrt(Math.abs(x))
  r += (20*Math.sin(6*x*Math.PI) + 20*Math.sin(2*x*Math.PI)) * 2/3
  r += (20*Math.sin(y*Math.PI) + 40*Math.sin(y/3*Math.PI)) * 2/3
  r += (160*Math.sin(y/12*Math.PI) + 320*Math.sin(y*Math.PI/30)) * 2/3
  return r
}
function transformLng(x: number, y: number) {
  let r = 300 + x + 2*y + 0.1*x*x + 0.1*x*y + 0.1*Math.sqrt(Math.abs(x))
  r += (20*Math.sin(6*x*Math.PI) + 20*Math.sin(2*x*Math.PI)) * 2/3
  r += (20*Math.sin(x*Math.PI) + 40*Math.sin(x/3*Math.PI)) * 2/3
  r += (150*Math.sin(x/12*Math.PI) + 300*Math.sin(x*Math.PI/30)) * 2/3
  return r
}
const getNestedValue = (obj: any, path: string[]): any =>
  path.reduce((cur, key) => cur?.[key], obj)
