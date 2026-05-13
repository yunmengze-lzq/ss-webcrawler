import http from 'node:http'

const rows = Array.from({ length: 23 }, (_, index) => {
  const id = index + 1
  return {
    id,
    station: {
      code: `TS-${String(id).padStart(3, '0')}`,
      name: `测试台区${id}`,
      region: {
        city: '广州',
        district: id % 2 === 0 ? '天河' : '越秀',
      },
    },
    metrics: {
      loadRate: Number((58 + id * 1.7).toFixed(2)),
      voltage: Number((219 + (id % 5) * 1.4).toFixed(1)),
    },
    date: `2026-05-${String((id % 13) + 1).padStart(2, '0')}`,
  }
})

const readBody = req => new Promise(resolve => {
  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', () => {
    try {
      resolve(body ? JSON.parse(body) : {})
    } catch {
      resolve({})
    }
  })
})

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.url?.startsWith('/api/stations')) {
    const body = await readBody(req)
    const pageNo = Math.max(1, Number(body.pageNo || 1))
    const pageSize = Math.max(1, Number(body.pageSize || 10))
    const district = String(body.district || '').trim()
    const filtered = district ? rows.filter(item => item.station.region.district === district) : rows
    const start = (pageNo - 1) * pageSize
    const records = filtered.slice(start, start + pageSize)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({
      success: true,
      data: {
        pageNo,
        pageSize,
        total: filtered.length,
        records,
      },
    }, null, 2))
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ success: false, message: 'Not found' }))
})

server.listen(5188, '127.0.0.1', () => {
  console.log('Mock crawler API: http://127.0.0.1:5188/api/stations')
})
