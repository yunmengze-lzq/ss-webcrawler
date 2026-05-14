import http from 'node:http'
import net from 'node:net'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const port = Number(process.env.SS_WEBCRAWLER_DEBUG_PORT || 9333)
const bat = `${root}\\启动-智能体取数工具.bat`

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const getJson = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => {
    let body = ''
    res.setEncoding('utf8')
    res.on('data', chunk => { body += chunk })
    res.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(error)
      }
    })
  }).on('error', reject)
})

const pollTargets = async () => {
  for (let i = 0; i < 30; i += 1) {
    try {
      const targets = await getJson(`http://127.0.0.1:${port}/json`)
      const page = targets.find(item =>
        item.type === 'page'
        && item.webSocketDebuggerUrl
        && !String(item.url || '').startsWith('devtools://')
      )
      if (page) return page
    } catch {
      // Electron is still starting.
    }
    await wait(500)
  }
  throw new Error(`Electron debug endpoint did not open on ${port}`)
}

const encodeFrame = (text) => {
  const payload = Buffer.from(text)
  const length = payload.length
  let header
  if (length < 126) {
    header = Buffer.alloc(6)
    header[0] = 0x81
    header[1] = 0x80 | length
    crypto.randomBytes(4).copy(header, 2)
  } else if (length < 65536) {
    header = Buffer.alloc(8)
    header[0] = 0x81
    header[1] = 0x80 | 126
    header.writeUInt16BE(length, 2)
    crypto.randomBytes(4).copy(header, 4)
  } else {
    throw new Error('WebSocket payload too large')
  }
  const mask = header.subarray(header.length - 4)
  const masked = Buffer.alloc(payload.length)
  for (let i = 0; i < payload.length; i += 1) masked[i] = payload[i] ^ mask[i % 4]
  return Buffer.concat([header, masked])
}

const decodeFrames = (buffer) => {
  const frames = []
  let offset = 0
  while (offset + 2 <= buffer.length) {
    const second = buffer[offset + 1]
    let length = second & 0x7f
    let headerLength = 2
    if (length === 126) {
      if (offset + 4 > buffer.length) break
      length = buffer.readUInt16BE(offset + 2)
      headerLength = 4
    } else if (length === 127) {
      throw new Error('Large WebSocket frames are not supported by this smoke test')
    }
    const masked = Boolean(second & 0x80)
    const maskLength = masked ? 4 : 0
    const frameLength = headerLength + maskLength + length
    if (offset + frameLength > buffer.length) break
    let payload = buffer.subarray(offset + headerLength + maskLength, offset + frameLength)
    if (masked) {
      const mask = buffer.subarray(offset + headerLength, offset + headerLength + 4)
      payload = Buffer.from(payload.map((byte, i) => byte ^ mask[i % 4]))
    }
    frames.push(payload.toString('utf8'))
    offset += frameLength
  }
  return { frames, rest: buffer.subarray(offset) }
}

const connectCdp = (wsUrl) => new Promise((resolve, reject) => {
  const parsed = new URL(wsUrl)
  const socket = net.createConnection(Number(parsed.port), parsed.hostname)
  const key = crypto.randomBytes(16).toString('base64')
  let handshaken = false
  let buffer = Buffer.alloc(0)
  let nextId = 1
  const pending = new Map()

  socket.on('connect', () => {
    socket.write([
      `GET ${parsed.pathname}${parsed.search} HTTP/1.1`,
      `Host: ${parsed.host}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Key: ${key}`,
      'Sec-WebSocket-Version: 13',
      '',
      '',
    ].join('\r\n'))
  })

  socket.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk])
    if (!handshaken) {
      const end = buffer.indexOf('\r\n\r\n')
      if (end === -1) return
      handshaken = true
      buffer = buffer.subarray(end + 4)
      resolve({
        send(method, params = {}) {
          const id = nextId++
          socket.write(encodeFrame(JSON.stringify({ id, method, params })))
          return new Promise((res, rej) => pending.set(id, { res, rej }))
        },
        close() {
          socket.end()
        },
      })
    }

    const decoded = decodeFrames(buffer)
    buffer = decoded.rest
    for (const frame of decoded.frames) {
      if (!frame.trim()) continue
      const message = JSON.parse(frame)
      if (!message.id || !pending.has(message.id)) continue
      const item = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) item.rej(new Error(message.error.message))
      else item.res(message.result)
    }
  })
  socket.on('error', reject)
})

const electron = spawn('cmd.exe', ['/c', bat], {
  cwd: root,
  env: { ...process.env, SS_WEBCRAWLER_DEBUG_PORT: String(port) },
  detached: false,
  stdio: 'ignore',
})

let cdp
try {
  const page = await pollTargets()
  cdp = await connectCdp(page.webSocketDebuggerUrl)
  const id = `smoke_${Date.now()}`
  const expression = `
    (async () => {
      const config = {
        id: ${JSON.stringify(id)},
        name: 'Smoke 保存测试接口',
        system: 'custom',
        category: '自动测试',
        description: 'Electron smoke test',
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/posts',
        headersText: '{"Accept":"application/json"}',
        cookie: '',
        cookieRefreshMode: 'manual',
        cookieExpireHours: 4,
        cookieUpdatedAt: '',
        loginUrl: '',
        payloadText: '{}',
        payloadFields: [],
        paginationEnabled: false,
        pageField: '',
        pageSizeField: '',
        pageSize: 100,
        totalPath: '',
        maxPages: 1,
        stopMode: 'max-pages',
        listPath: '',
        fieldsText: '{"文章ID":"id","标题":"title"}',
        storageTarget: 'database',
        outputDir: '',
        databasePath: '',
        tableName: 'smoke_posts',
        primaryKey: '文章ID',
        writeMode: 'append'
      };
      const saved = await window.ipcApi.saveCrawlerConfig(config);
      const configs = await window.ipcApi.listCrawlerConfigs();
      const paths = await window.ipcApi.getCrawlerConfigPaths();
      return {
        id: config.id,
        saved,
        found: configs.some(item => item.id === config.id && item.storageTarget === 'database'),
        paths
      };
    })()
  `
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  console.log(JSON.stringify(result, null, 2))
  const configPath = path.join(
    process.env.APPDATA || '',
    'ts-agent',
    'crawler-configs',
    `${id}.json`,
  )
  if (!fs.existsSync(configPath)) {
    throw new Error(`Saved config file was not created: ${configPath}`)
  }
  const savedFile = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  if (savedFile.storageTarget !== 'database') {
    throw new Error(`Saved config storageTarget mismatch: ${savedFile.storageTarget}`)
  }
  console.log(JSON.stringify({ fileExists: true, configPath, storageTarget: savedFile.storageTarget }, null, 2))
  await cdp.send('Runtime.evaluate', {
    expression: `window.ipcApi.deleteCrawlerConfig(${JSON.stringify(id)})`,
    awaitPromise: true,
    returnByValue: true,
  })
  cdp.send('Browser.close').catch(() => {})
} finally {
  cdp?.close()
  electron.kill()
}
