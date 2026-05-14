import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyRuntimeParams,
  builtInConfigs,
  buildGetUrl,
  extractRowsFromResponse,
  parseHeaders,
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
