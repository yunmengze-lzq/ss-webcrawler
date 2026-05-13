/**
 * Python 计算引擎桥接
 * 通信协议：stdin 传 JSON 参数 → stdout 返回 JSON 结果
 *
 * 修复点：
 * - 超时后 resolve 与 close 事件竞争，加 resolved 标记防止二次 resolve
 * - Windows 路径含空格时 spawn 参数需用数组，不用 shell
 * - PYTHON_BIN 支持自定义（内网 embeddable 版路径）
 */
import { spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'
import { log } from './log/log'

const isDev = !app.isPackaged

const PYTHON_DIR = isDev
  ? path.join(__dirname, '../python')
  : path.join(process.resourcesPath, 'python')

// 内网若用 embeddable 版，把此处改为完整路径
// 例：'C:\\python310\\python.exe'
const PYTHON_BIN = 'python'

const TIMEOUT_MS = 60_000

export const spawnPython = (
  script: string,
  params: Record<string, any>
): Promise<{ success: boolean; data?: any; error?: string }> => {
  return new Promise((resolve) => {
    let resolved = false
    const done = (val: { success: boolean; data?: any; error?: string }) => {
      if (resolved) return
      resolved = true
      resolve(val)
    }

    const scriptPath = path.join(PYTHON_DIR, `${script}.py`)
    const input = JSON.stringify(params)
    log.info(`[Python] ${script} ← ${input.slice(0, 120)}`)

    const child = spawn(PYTHON_BIN, [scriptPath], {
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',           // Windows 强制 UTF-8 输出
      },
      // 不用 shell:true，避免路径含空格时出问题
    })

    child.stdin.write(input)
    child.stdin.end()

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c: Buffer) => { stdout += c.toString('utf8') })
    child.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8') })

    const timer = setTimeout(() => {
      child.kill()
      log.error(`[Python] ${script} 超时（${TIMEOUT_MS / 1000}s）`)
      done({ success: false, error: `Python 脚本超时（${TIMEOUT_MS / 1000}s）` })
    }, TIMEOUT_MS)

    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        log.error(`[Python] ${script} 退出码=${code} stderr=${stderr.slice(0, 200)}`)
        done({ success: false, error: stderr.trim() || `Python 退出码 ${code}` })
        return
      }
      try {
        const result = JSON.parse(stdout.trim())
        if (result.error) {
          log.warn(`[Python] ${script} 业务错误: ${result.error}`)
          done({ success: false, error: result.error })
        } else {
          log.info(`[Python] ${script} 完成`)
          done({ success: true, data: result })
        }
      } catch {
        log.error(`[Python] ${script} JSON 解析失败: ${stdout.slice(0, 200)}`)
        done({ success: false, error: `输出格式错误: ${stdout.slice(0, 200)}` })
      }
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      log.error(`[Python] spawn 失败: ${err.message}（检查 Python 是否已安装，PYTHON_BIN=${PYTHON_BIN}）`)
      done({ success: false, error: `无法启动 Python: ${err.message}` })
    })
  })
}
