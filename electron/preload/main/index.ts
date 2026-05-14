/**
 * 主窗口 Preload
 * 把主进程 IPC 方法暴露给 Vue 渲染进程
 * contextIsolation: false 时直接挂 window.ipcApi
 */
import { ipcRenderer } from 'electron'

const ipcApi = {
  // ── RPA 爬取 ───────────────────────────────────────────────────
  /** 手动触发单个系统爬取，返回 {success, count, error} */
  crawl: (system: string, params?: Record<string, any>) =>
    ipcRenderer.invoke('rpa:crawl', { system, params }),

  listCrawlerConfigs: () =>
    ipcRenderer.invoke('crawler-config:list'),

  saveCrawlerConfig: (config: Record<string, any>) =>
    ipcRenderer.invoke('crawler-config:save', config),

  deleteCrawlerConfig: (id: string) =>
    ipcRenderer.invoke('crawler-config:delete', id),

  getCrawlerConfigPaths: () =>
    ipcRenderer.invoke('crawler-config:paths'),

  runCrawlerConfig: (config: Record<string, any>, runtimeParams?: Record<string, any>) =>
    ipcRenderer.invoke('crawler-config:run', config, runtimeParams),

  refreshCrawlerCookie: (config: Record<string, any>) =>
    ipcRenderer.invoke('crawler-config:refresh-cookie', config),

  selectDirectory: () =>
    ipcRenderer.invoke('app:select-directory'),

  // ── Python 计算引擎 ────────────────────────────────────────────
  /** 调用 Python 脚本，script 为文件名（不含.py） */
  python: (script: string, params: Record<string, any>) =>
    ipcRenderer.invoke('python:run', { script, params }),

  // ── LLM ────────────────────────────────────────────────────────
  /** 调用内网 LLM API */
  llm: (prompt: string, system?: string) =>
    ipcRenderer.invoke('llm:call', { prompt, system }),

  // ── Token 管理 ─────────────────────────────────────────────────
  setToken: (domain: 'asset' | 'finance', value: string) =>
    ipcRenderer.send('token:update', { domain, value }),

  // ── 快捷业务方法（组合调用）────────────────────────────────────
  /** 扫描问题库（调用 problem_scan.py） */
  scanProblems: () =>
    ipcRenderer.invoke('python:run', { script: 'problem_scan', params: {} }),

  /** 负荷预测（单台区） */
  forecast: (tsId: string) =>
    ipcRenderer.invoke('python:run', { script: 'forecast', params: { ts_id: tsId } }),

  /** 布点方案推荐 */
  layout: (tsId: string, forecastKw: number, landList: any[]) =>
    ipcRenderer.invoke('python:run', { script: 'layout', params: { ts_id: tsId, forecast_kw: forecastKw, land_list: landList } }),

  /** 仿真校验 */
  simulate: (params: Record<string, any>) =>
    ipcRenderer.invoke('python:run', { script: 'simulate', params }),

  /** 投资评估 */
  evaluate: (params: Record<string, any>) =>
    ipcRenderer.invoke('python:run', { script: 'evaluate', params }),
}

// 挂载到 window（contextIsolation: false 模式）
;(window as any).ipcApi = ipcApi

// Expose IPC methods to the renderer. The app uses contextIsolation: false.
;(window as any).ipcApi = ipcApi

// 类型声明（在 src/ 里使用时有 TypeScript 提示）
export type IpcApi = typeof ipcApi
