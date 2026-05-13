<template>
  <main class="app-shell">
    <aside class="nav-rail">
      <div class="brand">
        <div class="brand-mark">A</div>
        <div>
          <h1>接口管理台</h1>
          <p>面向智能体的数据源资产</p>
        </div>
      </div>

      <nav>
        <button class="active">接口取数</button>
        <button disabled>数据校验</button>
        <button disabled>智能体调用</button>
        <button disabled>定时任务</button>
      </nav>

      <div class="rail-note">
        <strong>主流程</strong>
        <span>接口爬虫优先，RPA 只作为导出 Excel/PDF 的兜底能力。</span>
      </div>
    </aside>

    <section class="workspace">
      <header class="page-head">
        <div>
          <p class="eyebrow">Interface Assets</p>
          <h2>已保存接口</h2>
          <p>选择已有接口直接运行，或新建接口沉淀为可复用的数据源。</p>
        </div>
        <button class="primary" @click="openCreate">新建接口</button>
      </header>

      <section class="toolbar">
        <input v-model="keyword" placeholder="搜索接口名称、系统、分类" />
        <select v-model="systemFilter">
          <option value="all">全部系统</option>
          <option v-for="item in systems" :key="item.key" :value="item.key">{{ item.name }}</option>
        </select>
        <select v-model="storageFilter">
          <option value="all">全部存储</option>
          <option value="excel">Excel</option>
          <option value="database">数据库</option>
          <option value="both">Excel + 数据库</option>
        </select>
      </section>

      <section class="pipeline-strip">
        <div>
          <strong>1. JSON 原始响应</strong>
          <span>每次运行都保留 raw.json</span>
        </div>
        <div>
          <strong>2. 字段映射</strong>
          <span>按列表路径和映射生成 rows.json</span>
        </div>
        <div>
          <strong>3. 结果填充</strong>
          <span>按配置写入 Excel、SQLite 或两者</span>
        </div>
      </section>

      <div class="content-grid">
        <section class="interface-board">
          <div class="empty-state" v-if="!filteredConfigs.length">
            <h3>还没有可复用接口</h3>
            <p>点击“新建接口”，把 Fetch/XHR 的 URL、Headers、Payload 和字段映射保存下来。</p>
            <button class="primary" @click="openCreate">新建第一个接口</button>
          </div>

          <article
            v-for="item in filteredConfigs"
            :key="item.id"
            :class="['interface-card', { active: item.id === activeConfig?.id }]"
            @click="selectConfig(item)"
          >
            <div class="card-main">
              <div>
                <h3>{{ item.name }}</h3>
                <p>{{ item.description || '未填写说明' }}</p>
              </div>
              <span class="method">{{ item.method }}</span>
            </div>

            <div class="meta-row">
              <span>{{ systemName(item.system) }}</span>
              <span>{{ item.category || '未分类' }}</span>
              <span>{{ storageName(item.storageTarget) }}</span>
              <span :class="cookieClass(item)">{{ cookieLabel(item) }}</span>
              <span v-if="item.paginationEnabled">自动翻页</span>
            </div>

            <div class="path-summary">
              <p><b>Excel/JSON</b>{{ item.outputDir || '默认应用目录' }}</p>
              <p><b>SQLite</b>{{ item.databasePath || '默认 ts_agent.db' }}</p>
            </div>

            <div class="card-actions" @click.stop>
              <button @click="runConfig(item)" :disabled="running">{{ runningId === item.id ? '运行中...' : '运行' }}</button>
              <button @click="refreshCookie(item)">更新Cookie</button>
              <button @click="openEdit(item)">编辑</button>
              <button @click="duplicateConfig(item)">复制</button>
            </div>
          </article>
        </section>

        <RunResultPanel :result="result" :active-name="activeConfig?.name" />
      </div>
    </section>

    <InterfaceConfigModal
      v-if="modalOpen"
      :model-value="editingConfig"
      @close="modalOpen = false"
      @save="saveConfig"
    />
    <RunParamsModal
      v-if="runModalOpen && pendingRunConfig"
      :config="pendingRunConfig"
      @close="runModalOpen = false"
      @run="executeRun"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import InterfaceConfigModal from './components/InterfaceConfigModal.vue'
import RunParamsModal from './components/RunParamsModal.vue'
import RunResultPanel from './components/RunResultPanel.vue'
import type { CrawlerConfig, RunResult, RuntimeParams, StorageTarget } from './types'

declare global {
  interface Window {
    ipcApi?: {
      crawl: (system: string, params?: Record<string, unknown>) => Promise<unknown>
      listCrawlerConfigs: () => Promise<CrawlerConfig[]>
      saveCrawlerConfig: (config: CrawlerConfig) => Promise<{ success: boolean; config: CrawlerConfig }>
      runCrawlerConfig: (config: CrawlerConfig, runtimeParams?: RuntimeParams) => Promise<RunResult>
      refreshCrawlerCookie?: (config: CrawlerConfig) => Promise<{ success: boolean; config?: CrawlerConfig; error?: string }>
      selectDirectory?: () => Promise<string | null>
    }
  }
}

const systems = [
  { key: 'load_meter', name: '计量负载率' },
  { key: 'voltage', name: '电压监测' },
  { key: 'asset', name: '资产台账' },
  { key: 'gis', name: 'GIS 坐标' },
  { key: 'marketing', name: '营销报装' },
  { key: 'custom', name: '自定义' },
]

const previewStorageKey = 'ts-agent-crawler-configs'
const configs = ref<CrawlerConfig[]>([])
const activeConfig = ref<CrawlerConfig | null>(null)
const modalOpen = ref(false)
const runModalOpen = ref(false)
const running = ref(false)
const runningId = ref<string | undefined>()
const result = ref<RunResult | null>(null)
const pendingRunConfig = ref<CrawlerConfig | null>(null)
const keyword = ref('')
const systemFilter = ref('all')
const storageFilter = ref<'all' | StorageTarget>('all')

const blankConfig = (): CrawlerConfig => ({
  name: '计量负载率接口',
  system: 'load_meter',
  category: '运行监测',
  description: '',
  method: 'POST',
  url: '',
  headersText: '{\n  "Accept": "application/json, text/javascript, */*; q=0.01",\n  "Content-Type": "application/json;charset=UTF-8"\n}',
  cookie: '',
  cookieRefreshMode: 'manual',
  cookieExpireHours: 4,
  cookieUpdatedAt: '',
  loginUrl: '',
  payloadText: '{\n  "pageNo": 1,\n  "pageSize": 100\n}',
  payloadFields: [
    {
      id: 'query_date',
      label: '查询日期',
      path: 'queryDate',
      type: 'date',
      defaultValue: '',
      required: false,
      optionsText: '',
    },
  ],
  paginationEnabled: true,
  pageField: 'pageNo',
  pageSizeField: 'pageSize',
  pageSize: 100,
  totalPath: 'data.total',
  maxPages: 100,
  stopMode: 'empty-list',
  listPath: 'data.list',
  fieldsText: '{\n  "ts_id": "stationId",\n  "record_date": "date",\n  "value": "value"\n}',
  storageTarget: 'excel',
  outputDir: '',
  databasePath: '',
  tableName: 'load_meter_daily',
  primaryKey: 'ts_id',
  writeMode: 'append',
})

const editingConfig = reactive<CrawlerConfig>(blankConfig())

const filteredConfigs = computed(() => {
  const key = keyword.value.trim().toLowerCase()
  return configs.value.filter(item => {
    const matchesKeyword = !key || [item.name, item.system, item.category, item.description]
      .some(value => (value || '').toLowerCase().includes(key))
    const matchesSystem = systemFilter.value === 'all' || item.system === systemFilter.value
    const matchesStorage = storageFilter.value === 'all' || item.storageTarget === storageFilter.value
    return matchesKeyword && matchesSystem && matchesStorage
  })
})

const clone = (config: CrawlerConfig) => JSON.parse(JSON.stringify(config)) as CrawlerConfig
const normalizeConfig = (config: CrawlerConfig): CrawlerConfig => ({ ...blankConfig(), ...config })

const refreshConfigs = async () => {
  if (window.ipcApi?.listCrawlerConfigs) {
    configs.value = (await window.ipcApi.listCrawlerConfigs()).map(normalizeConfig)
  } else {
    configs.value = JSON.parse(localStorage.getItem(previewStorageKey) || '[]').map(normalizeConfig)
  }
  if (!activeConfig.value && configs.value.length) activeConfig.value = configs.value[0]
}

const persistPreview = (saved: CrawlerConfig) => {
  const next = [saved, ...configs.value.filter(item => item.id !== saved.id)]
  localStorage.setItem(previewStorageKey, JSON.stringify(next))
}

const openCreate = () => {
  Object.assign(editingConfig, blankConfig())
  modalOpen.value = true
}

const openEdit = (config: CrawlerConfig) => {
  Object.assign(editingConfig, clone(config))
  modalOpen.value = true
}

const duplicateConfig = async (config: CrawlerConfig) => {
  const copied = {
    ...clone(config),
    id: undefined,
    name: `${config.name} 副本`,
    updatedAt: undefined,
  }
  await saveConfig(copied)
}

const refreshCookie = async (config: CrawlerConfig) => {
  activeConfig.value = config
  if (!window.ipcApi?.refreshCrawlerCookie) {
    openEdit(config)
    result.value = { success: false, message: '预览模式无法打开内网登录页。请在弹窗中手动粘贴 Cookie。' }
    return
  }
  result.value = { message: '请在弹出的登录窗口完成登录，关闭窗口后会自动回写 Cookie。' }
  const res = await window.ipcApi.refreshCrawlerCookie(config)
  if (!res.success || !res.config) {
    result.value = { success: false, error: res.error || 'Cookie 更新失败' }
    return
  }
  activeConfig.value = res.config
  result.value = { success: true, message: 'Cookie 已更新并保存。' }
  await refreshConfigs()
}

const selectConfig = (config: CrawlerConfig) => {
  activeConfig.value = config
}

const saveConfig = async (config: CrawlerConfig) => {
  const saved = {
    ...config,
    id: config.id || `${config.system || 'custom'}_${Date.now()}`,
    updatedAt: new Date().toISOString(),
  }

  if (window.ipcApi?.saveCrawlerConfig) {
    const res = await window.ipcApi.saveCrawlerConfig(saved)
    activeConfig.value = res.config
  } else {
    persistPreview(saved)
    activeConfig.value = saved
    result.value = { success: true, message: '预览模式已保存到浏览器本地。' }
  }

  modalOpen.value = false
  await refreshConfigs()
}

const runConfig = async (config: CrawlerConfig) => {
  pendingRunConfig.value = normalizeConfig(config)
  runModalOpen.value = true
}

const executeRun = async (runtimeParams: RuntimeParams) => {
  if (!pendingRunConfig.value) return
  const config = pendingRunConfig.value
  runModalOpen.value = false
  running.value = true
  runningId.value = config.id
  activeConfig.value = config
  result.value = { message: '正在运行接口...' }
  try {
    if (!window.ipcApi?.runCrawlerConfig) {
      result.value = { success: false, message: '当前是浏览器预览模式。真实取数、Excel 和数据库写入需要 Electron 版。' }
      return
    }
    result.value = await window.ipcApi.runCrawlerConfig(config, runtimeParams)
    await refreshConfigs()
  } catch (error: any) {
    result.value = { success: false, error: error?.message ?? String(error) }
  } finally {
    running.value = false
    runningId.value = undefined
  }
}

const systemName = (key: string) => systems.find(item => item.key === key)?.name || key
const storageName = (target: StorageTarget) => ({
  excel: 'Excel',
  database: '数据库',
  both: 'Excel + 数据库',
}[target] || 'Excel')

const cookieAgeHours = (config: CrawlerConfig) => {
  if (!config.cookieUpdatedAt) return Number.POSITIVE_INFINITY
  return (Date.now() - new Date(config.cookieUpdatedAt).getTime()) / 3_600_000
}

const cookieLabel = (config: CrawlerConfig) => {
  if (!config.cookie) return 'Cookie 未配置'
  const hours = cookieAgeHours(config)
  if (hours > (config.cookieExpireHours || 4)) return 'Cookie 需更新'
  return `Cookie ${Math.max(0, Math.floor(hours))}h`
}

const cookieClass = (config: CrawlerConfig) => ({
  stale: !config.cookie || cookieAgeHours(config) > (config.cookieExpireHours || 4),
})

onMounted(refreshConfigs)
</script>
