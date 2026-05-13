/**
 * Preload 公共工具
 * 所有 RPA 爬取脚本共用
 *
 * 修复：
 * - waitForElement 返回类型精确为 Element，调用方无需强转
 * - reportComplete 参数类型统一
 * - 新增 hookXHR / hookFetch 调试工具（内网抓包用）
 */
import { ipcRenderer } from 'electron'
import fs from 'fs'
import path from 'path'

// ── Cookie ──────────────────────────────────────────────────────
export const getCookie = (name: string): string => {
  for (const part of document.cookie.split(';')) {
    const [k, v] = part.split('=')
    if (k?.trim() === name) return v?.trim() ?? ''
  }
  return ''
}

export const setCookie = (name: string, value: string) => {
  document.cookie = `${name}=${value};path=/`
}

// ── 等待元素就绪 ────────────────────────────────────────────────
export const waitForElement = (selector: string, timeout = 30_000): Promise<Element> =>
  new Promise((resolve, reject) => {
    const t0 = Date.now()
    const tick = () => {
      const el = document.querySelector(selector)
      if (el) { resolve(el); return }
      if (Date.now() - t0 > timeout) {
        reject(new Error(`等待元素超时: "${selector}"（${timeout / 1000}s）`))
        return
      }
      setTimeout(tick, 500)
    }
    tick()
  })

// ── iframe 内等待 ────────────────────────────────────────────────
export const waitForIframeElement = async (
  iframeId: string,
  selector: string,
  timeout = 30_000
): Promise<Element> => {
  await waitForElement(`#${iframeId}`, timeout)
  const iframe = document.getElementById(iframeId) as HTMLIFrameElement
  const doc = iframe?.contentDocument ?? iframe?.contentWindow?.document
  if (!doc) throw new Error(`无法访问 iframe#${iframeId}，可能跨域`)

  return new Promise((resolve, reject) => {
    const t0 = Date.now()
    const tick = () => {
      const el = doc.querySelector(selector)
      if (el) { resolve(el); return }
      if (Date.now() - t0 > timeout) {
        reject(new Error(`iframe 内等待超时: "${selector}"`))
        return
      }
      setTimeout(tick, 500)
    }
    tick()
  })
}

// ── 文件写入 ─────────────────────────────────────────────────────
export const writeResponseToFile = async (
  filePath: string,
  response: Response
): Promise<void> => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const buf = await response.arrayBuffer()
  fs.writeFileSync(filePath, Buffer.from(buf))
}

// ── IPC 安全包装 ─────────────────────────────────────────────────
/** 监听 IPC 事件，自动捕获异步异常，支持可选延迟（等页面就绪） */
export const catchFun = (
  eventName: string,
  handler: (args: any) => Promise<void>,
  delayMs = 5_000
) => {
  ipcRenderer.on(eventName, async (_event, args) => {
    if (delayMs > 0) await sleep(delayMs)
    try {
      await handler(args)
    } catch (err: any) {
      console.error(`[${eventName}] 未捕获异常:`, err)
      ipcRenderer.send(`rpa:complete:${args?.winKey}`, {
        success: false,
        error: err?.message ?? String(err),
      })
    }
  })
}

export const reportComplete = (winKey: string, result: {
  success: boolean
  records?: any[]
  count?: number
  error?: string
}) => {
  ipcRenderer.send(`rpa:complete:${winKey}`, result)
}

export const isConfiguredUrl = (url: string): boolean =>
  /^https?:\/\//i.test(url) && !url.startsWith('TODO:')

export const findDownloadCandidates = () =>
  Array.from(document.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"]'))
    .map((el, index) => ({
      index,
      tag: el.tagName.toLowerCase(),
      text: ((el as HTMLInputElement).value || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
      href: (el as HTMLAnchorElement).href || '',
    }))
    .filter((item) => /导出|下载|excel|xls|xlsx|pdf|报表|明细|查询|搜索/i.test(`${item.text} ${item.href}`))

export const collectPageSnapshot = () => ({
  url: location.href,
  title: document.title,
  text: (document.body?.innerText ?? '').slice(0, 8000),
  tables: Array.from(document.querySelectorAll('table')).slice(0, 5).map((table) =>
    Array.from(table.querySelectorAll('tr')).slice(0, 20).map((tr) =>
      Array.from(tr.querySelectorAll('th,td')).slice(0, 20).map((cell) =>
        (cell.textContent ?? '').trim()
      )
    )
  ),
  candidates: findDownloadCandidates(),
})

export const clickDownloadCandidate = (keyword = '导出|下载|excel|xls|xlsx|pdf|报表'): boolean => {
  const re = new RegExp(keyword, 'i')
  const el = Array.from(document.querySelectorAll<HTMLElement>('button,a,[role="button"],input[type="button"],input[type="submit"]'))
    .find((item) => {
      const text = ((item as HTMLInputElement).value || item.textContent || '').trim()
      const href = (item as HTMLAnchorElement).href || ''
      return re.test(`${text} ${href}`)
    })

  if (!el) return false
  el.click()
  return true
}

export const runDiscoveryMode = async (winKey: string, system: string, args: any = {}) => {
  hookRequests(args?.requestFilter)
  await waitForElement('body', 30_000)

  const downloads: any[] = []
  const onDownloaded = (_event: any, item: any) => {
    if (item?.winKey === winKey || item?.system === system) downloads.push(item)
  }
  ipcRenderer.on('rpa:downloaded', onDownloaded)

  if (args?.clickDownload !== false) {
    clickDownloadCandidate(args?.downloadKeyword)
  }

  await sleep(args?.waitAfterClickMs ?? 5000)
  ipcRenderer.removeListener('rpa:downloaded', onDownloaded)

  reportComplete(winKey, {
    success: true,
    count: downloads.length,
    records: [{ mode: 'discovery', system, downloads, snapshot: collectPageSnapshot() }],
  })
}

// ── Vue 响应式输入填充 ────────────────────────────────────────────
export const setInputValue = (el: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input',  { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

// ── 调试：Hook XHR / fetch（内网抓包用，调试完注释掉）────────────
export const hookRequests = (filter?: string) => {
  const log = (label: string, url: string) => {
    if (!filter || url.includes(filter)) {
      console.log(`[HOOK] ${label}`, url)
    }
  }

  const origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method: string, url: string) {
    log('XHR', url)
    return origOpen.apply(this, arguments as any)
  }

  const origFetch = window.fetch
  window.fetch = function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
    log('fetch', url)
    return origFetch.apply(this, args)
  }

  console.log('[HOOK] 请求监听已启动', filter ? `过滤: ${filter}` : '全量')
}

// ── 工具 ──────────────────────────────────────────────────────────
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
export const today = () => new Date().toISOString().split('T')[0]
export const yesterday = () => {
  const d = new Date(); d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}
