import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyRuntimeParams,
  builtInConfigs,
  buildGetUrl,
  extractRowsFromResponse,
  parseHeaders,
  parseJsonObject,
  parseNetworkCapture,
  isSignatureKey,
  normalizeConfig,
  toIpcSafe,
  selectInitialConfig,
  withBuiltInConfigs,
} from '../src/crawlerConfigUtils.ts'

test('built-in examples include runnable real website cases', () => {
  const names = builtInConfigs().map(item => item.name)

  assert.deepEqual(names, [
    '真实网站案例-JSONPlaceholder文章',
    '真实网站案例-GitHub仓库搜索',
    '真实网站案例-用户嵌套数据',
  ])
})

test('built-in real website example is always available before saved configs', () => {
  const saved = [{
    id: 'custom_saved',
    name: '已保存内网接口',
    system: 'custom',
    category: '内网',
    description: '',
    method: 'POST',
    url: 'http://example.local/api',
    headersText: '{}',
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
    listPath: 'data',
    fieldsText: '{}',
    storageTarget: 'excel',
    outputDir: '',
    databasePath: '',
    tableName: 'custom_saved',
    primaryKey: '',
    writeMode: 'append',
  }]

  const configs = withBuiltInConfigs(saved)

  assert.equal(configs[0].id, 'real_jsonplaceholder_posts')
  assert.equal(configs[1].id, 'real_github_repo_search')
  assert.equal(configs[2].id, 'real_jsonplaceholder_users')
  assert.equal(configs[3].id, 'custom_saved')
})

test('selectInitialConfig chooses the built-in case when active config is missing', () => {
  const configs = withBuiltInConfigs([])

  const active = selectInitialConfig(configs, { id: 'deleted_config' })

  assert.equal(active?.id, 'real_jsonplaceholder_posts')
})

test('extractRowsFromResponse maps nested json fields to flat rows', () => {
  const response = {
    data: {
      list: [
        {
          id: 1,
          owner: { login: 'octo' },
          metrics: { stars: 128 },
        },
      ],
    },
  }
  const rows = extractRowsFromResponse(response, {
    listPath: 'data.list',
    fieldsText: JSON.stringify({
      仓库名: 'id',
      作者: 'owner.login',
      Star数: 'metrics.stars',
    }),
  })

  assert.deepEqual(rows, [{ 仓库名: 1, 作者: 'octo', Star数: 128 }])
})

test('buildGetUrl writes payload fields into query string', () => {
  const url = buildGetUrl('https://api.github.com/search/repositories?sort=updated', {
    q: 'web crawler language:TypeScript',
    per_page: 10,
  })

  assert.equal(url, 'https://api.github.com/search/repositories?sort=updated&q=web+crawler+language%3ATypeScript&per_page=10')
})

test('parseHeaders keeps json headers and injects cookie', () => {
  const headers = parseHeaders('{\n  "Accept": "application/json",\n  "X-Token": "abc"\n}', 'sid=123; theme=dark')

  assert.deepEqual(headers, {
    Accept: 'application/json',
    'X-Token': 'abc',
    Cookie: 'sid=123; theme=dark',
  })
})

test('parseHeaders supports copied browser header lines', () => {
  const headers = parseHeaders('Accept: application/json\nX-Requested-With: XMLHttpRequest', '')

  assert.deepEqual(headers, {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  })
})

test('parseJsonObject supports PowerShell escaped newlines from saved configs', () => {
  const parsed = parseJsonObject('{`n  "Accept": "application/json"`n}', 'Headers')

  assert.deepEqual(parsed, { Accept: 'application/json' })
})

test('parseJsonObject reports a field-specific json format error', () => {
  assert.throws(
    () => parseJsonObject('{ pageNo: }', 'Payload JSON'),
    /Payload JSON format error/,
  )
})

test('parseJsonObject repairs common copied object formats', () => {
  assert.deepEqual(parseJsonObject("pageNo: 1, pageSize: '100',", 'Payload JSON'), {
    pageNo: 1,
    pageSize: '100',
  })
})

test('parseHeaders rejects malformed copied header lines', () => {
  assert.throws(
    () => parseHeaders('Accept application/json', ''),
    /Headers format error/,
  )
})

test('parseNetworkCapture extracts request parts and response mapping', () => {
  const parsed = parseNetworkCapture(`
Request URL: https://example.com/api/list
Request Method: POST
accept: application/json
content-type: application/json;charset=UTF-8
cookie: sid=abc; theme=dark

Query String Parameters
area: gz

Request Payload
{ pageNo: 1, pageSize: 20, status: 'active', }

Response
{
  "data": {
    "list": [
      { "id": 1, "name": "A", "owner": { "login": "octo" } }
    ],
    "total": 1
  }
}
  `)

  assert.equal(parsed.url, 'https://example.com/api/list')
  assert.equal(parsed.method, 'POST')
  assert.equal(parsed.cookie, 'sid=abc; theme=dark')
  assert.equal(parsed.headers.Accept, 'application/json')
  assert.equal(parsed.headers['Content-Type'], 'application/json;charset=UTF-8')
  assert.deepEqual(parsed.payload, { pageNo: 1, pageSize: 20, status: 'active', area: 'gz' })
  assert.equal(parsed.listPath, 'data.list')
  assert.deepEqual(parsed.fields, { id: 'id', name: 'name', login: 'owner.login' })
})

test('parseNetworkCapture warns about signed request fields', () => {
  const parsed = parseNetworkCapture(`
Request URL: https://example.com/api/list
Request Method: POST
x-sign: abc
x-timestamp: 1778750000

Request Payload
{ pageNo: 1, nonce: 'n1', signature: 's1' }
  `)

  assert.equal(isSignatureKey('x-sign'), true)
  assert.equal(isSignatureKey('pageNo'), false)
  assert.equal(parsed.warnings.some(item => item.includes('signed request fields')), true)
})

test('parseNetworkCapture supports Chinese Chrome network copy with split key value lines', () => {
  const parsed = parseNetworkCapture(`
请求网址
https://discord.com/api/v9/channels/1493652464828682403/messages?limit=10
请求方法
GET
状态代码
200 OK
远程地址
127.0.0.1:7890
content-type
application/json
server
cloudflare
:authority
discord.com
:method
GET
:path
/api/v9/channels/1493652464828682403/messages?limit=10
:scheme
https
accept
*/*
accept-language
zh-CN,zh;q=0.9
authorization
redacted-token
cookie
sid=redacted; cf_clearance=redacted
referer
https://discord.com/channels/1493652464312778763/1493652464828682403
user-agent
Mozilla/5.0
x-discord-locale
zh-CN

Request Payload
limit=10

Response
[{type: 0, content: "hello",…}]
0
:
{type: 0, content: "hello",…}
author
:
{id: "1049593878686208040", username: "user"}
channel_id
:
"1493652464828682403"
content
:
"hello"
id
:
"1502254453238005830"
timestamp
:
"2026-05-08T10:22:52.190000+00:00"
  `)

  assert.equal(parsed.url, 'https://discord.com/api/v9/channels/1493652464828682403/messages?limit=10')
  assert.equal(parsed.method, 'GET')
  assert.equal(parsed.cookie, 'sid=redacted; cf_clearance=redacted')
  assert.equal(parsed.headers.Authorization, 'redacted-token')
  assert.equal(parsed.headers.Accept, '*/*')
  assert.equal(parsed.headers.Server, undefined)
  assert.deepEqual(parsed.payload, { limit: 10 })
  assert.equal(parsed.fields.content, 'content')
  assert.equal(parsed.fields.author_id, 'author.id')
  assert.equal(parsed.fields.author_username, 'author.username')
  assert.equal(parsed.warnings.some(item => item.includes('DevTools preview')), true)
})

test('parseNetworkCapture supports curl and fetch copied formats', () => {
  const curlParsed = parseNetworkCapture(`curl 'https://example.com/api/list?limit=10' \\
    -H 'accept: application/json' \\
    -H 'authorization: Bearer redacted' \\
    --data-raw '{"pageNo":1,"pageSize":20}'`)

  assert.equal(curlParsed.url, 'https://example.com/api/list?limit=10')
  assert.equal(curlParsed.method, 'POST')
  assert.equal(curlParsed.headers.Accept, 'application/json')
  assert.equal(curlParsed.payload.pageNo, 1)
  assert.equal(curlParsed.payload.pageSize, 20)

  const fetchParsed = parseNetworkCapture(`
fetch("https://example.com/api/items", {
  "headers": {
    "accept": "application/json",
    "x-requested-with": "XMLHttpRequest"
  },
  "body": "limit=10&status=active",
  "method": "POST"
});
  `)

  assert.equal(fetchParsed.url, 'https://example.com/api/items')
  assert.equal(fetchParsed.method, 'POST')
  assert.equal(fetchParsed.headers.Accept, 'application/json')
  assert.equal(fetchParsed.headers['X-Requested-With'], 'XMLHttpRequest')
  assert.deepEqual(fetchParsed.payload, { limit: 10, status: 'active' })
})

test('applyRuntimeParams overwrites nested payload filters before running', () => {
  const payload = applyRuntimeParams({
    query: {
      date: '2026-05-01',
      area: { city: '广州', district: '越秀' },
    },
    pageNo: 1,
  }, {
    'query.date': '2026-05-14',
    'query.area.district': '天河',
    pageNo: 3,
  })

  assert.deepEqual(payload, {
    query: {
      date: '2026-05-14',
      area: { city: '广州', district: '天河' },
    },
    pageNo: 3,
  })
})

test('normalizeConfig preserves database-only storage target', () => {
  const config = normalizeConfig({
    name: '数据库接口',
    storageTarget: 'database',
  })

  assert.equal(config.storageTarget, 'database')
})

test('toIpcSafe converts non-cloneable values to plain json', () => {
  const safe = toIpcSafe({
    ok: true,
    fn: () => 'drop',
    nested: {
      value: undefined,
      error: new Error('boom'),
    },
  })

  assert.deepEqual(safe, {
    ok: true,
    nested: {
      error: {},
    },
  })
})

test('toIpcSafe unwraps proxy-like crawler config before ipc invoke', () => {
  const config = new Proxy({
    id: 'proxy_config',
    payloadFields: [{ id: 'date', label: '日期' }],
  }, {})

  const safe = toIpcSafe(config)

  assert.deepEqual(safe, {
    id: 'proxy_config',
    payloadFields: [{ id: 'date', label: '日期' }],
  })
  assert.notEqual(safe, config)
})
