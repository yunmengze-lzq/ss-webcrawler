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

      <nav class="toolbox-nav">
        <button
          v-for="tool in toolboxItems"
          :key="tool.key"
          :class="{ active: activeTool === tool.key }"
          :disabled="tool.disabled"
          @click="activeTool = tool.key"
        >
          <span class="tool-icon">{{ tool.icon }}</span>
          <span>
            <strong>{{ tool.name }}</strong>
            <small>{{ tool.caption }}</small>
          </span>
        </button>
      </nav>

      <div class="rail-note">
        <strong>工具箱原则</strong>
        <span>接口资产优先沉淀；RPA 只处理登录、Cookie 更新和文件导出兜底。</span>
      </div>
    </aside>

    <section class="workspace">
      <header class="page-head">
        <div>
          <p class="eyebrow">Crawler Toolbox</p>
          <h2>接口取数工作台</h2>
          <p>管理可复用接口，完成真实取数、字段解析、Excel/SQLite 落盘和实验验证。</p>
        </div>
        <button class="primary" @click="openCreate">新建接口</button>
      </header>

      <section class="toolbox-status">
        <div v-for="item in toolboxStats" :key="item.label">
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
        </div>
      </section>

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
        <div v-for="step in pipelineSteps" :key="step.title">
          <strong>{{ step.title }}</strong>
          <span>{{ step.caption }}</span>
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
import { blankConfig, normalizeConfig, selectInitialConfig, toIpcSafe, withBuiltInConfigs } from './crawlerConfigUtils'
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
const activeTool = ref('interfaces')
const modalOpen = ref(false)
const runModalOpen = ref(false)
const running = ref(false)
const runningId = ref<string | undefined>()
const result = ref<RunResult | null>(null)
const pendingRunConfig = ref<CrawlerConfig | null>(null)
const keyword = ref('')
const systemFilter = ref('all')
const storageFilter = ref<'all' | StorageTarget>('all')

const toolboxItems = [
  { key: 'interfaces', name: '接口取数', caption: '配置与运行', icon: 'I', disabled: false },
  { key: 'parser', name: '数据解析', caption: '字段映射', icon: 'P', disabled: true },
  { key: 'storage', name: '存储管理', caption: 'Excel / SQLite', icon: 'S', disabled: true },
  { key: 'cookie', name: 'Cookie/RPA', caption: '登录兜底', icon: 'C', disabled: true },
  { key: 'lab', name: '实验测试', caption: '真实案例', icon: 'T', disabled: true },
  { key: 'tasks', name: '任务记录', caption: '定时与日志', icon: 'L', disabled: true },
]

const pipelineSteps = [
  { title: '1. 原始响应', caption: '保留 raw.json，便于追溯和复盘' },
  { title: '2. 字段映射', caption: '按列表路径和嵌套字段生成 rows.json' },
  { title: '3. 数据落盘', caption: '按配置写入 Excel、SQLite 或两者' },
]

const toolboxStats = computed(() => {
  const total = configs.value.length
  const reusable = configs.value.filter(item => item.url).length
  const withPayload = configs.value.filter(item => item.payloadFields?.length).length
  const withDatabase = configs.value.filter(item => item.storageTarget === 'database' || item.storageTarget === 'both').length
  return [
    { label: '接口资产', value: total },
    { label: '可运行接口', value: reusable },
    { label: '运行时载荷', value: withPayload },
    { label: '数据库写入', value: withDatabase },
  ]
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

const refreshConfigs = async () => {
  let savedConfigs: CrawlerConfig[] = []
  try {
    if (window.ipcApi?.listCrawlerConfigs) {
      savedConfigs = await window.ipcApi.listCrawlerConfigs()
    } else {
      savedConfigs = JSON.parse(localStorage.getItem(previewStorageKey) || '[]')
    }
  } catch (error) {
    console.warn('读取接口配置失败，已使用内置真实网站案例。', error)
  }
  configs.value = withBuiltInConfigs(Array.isArray(savedConfigs) ? savedConfigs : [])
  activeConfig.value = selectInitialConfig(configs.value, activeConfig.value)
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
  const res = await window.ipcApi.refreshCrawlerCookie(toIpcSafe(config))
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
    const res = await window.ipcApi.saveCrawlerConfig(toIpcSafe(saved))
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
  pendingRunConfig.value = normalizeConfig(toIpcSafe(config))
  if (pendingRunConfig.value.payloadFields?.length) {
    runModalOpen.value = true
    return
  }
  await executeRun({})
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
    result.value = await window.ipcApi.runCrawlerConfig(toIpcSafe(config), toIpcSafe(runtimeParams))
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
