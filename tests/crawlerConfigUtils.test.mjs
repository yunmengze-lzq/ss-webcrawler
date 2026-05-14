import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildGetUrl,
  extractRowsFromResponse,
  selectInitialConfig,
  withBuiltInConfigs,
} from '../src/crawlerConfigUtils.ts'

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

  assert.equal(configs[0].id, 'real_github_repo_search')
  assert.equal(configs[0].name, '真实网站案例-GitHub仓库搜索')
  assert.equal(configs[1].id, 'custom_saved')
})

test('selectInitialConfig chooses the built-in case when active config is missing', () => {
  const configs = withBuiltInConfigs([])

  const active = selectInitialConfig(configs, { id: 'deleted_config' })

  assert.equal(active?.id, 'real_github_repo_search')
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
