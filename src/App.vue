<template>
  <main class="app-shell">
    <section class="workspace">
      <header class="app-topbar">
        <div>
          <div class="brand-line">
            <span class="brand-mark">A</span>
            <span>智能体数据工具箱</span>
          </div>
          <h1>{{ activeTool === 'home' ? '工具箱工作台' : currentTool.title }}</h1>
          <p>{{ activeTool === 'home' ? '选择一个小工具进入配置。接口资产负责沉淀可复用数据源，后续再联动智能体、RPA 和分析模块。' : currentTool.description }}</p>
        </div>
        <div v-if="activeTool !== 'home'" class="top-actions">
          <button @click="backHome">返回工具箱</button>
        </div>
      </header>

      <section v-if="activeTool === 'home'" class="tool-app-grid">
        <button
          v-for="item in toolboxApps"
          :key="item.key"
          class="tool-app-card"
          @click="openTool(item.key)"
        >
          <span>{{ item.code }}</span>
          <strong>{{ item.title }}</strong>
          <small>{{ item.description }}</small>
          <em>{{ item.status }}</em>
        </button>
      </section>

      <section v-if="activeTool === 'interface_asset'" class="toolbox-status">
        <div v-for="item in toolboxStats" :key="item.label">
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
        </div>
      </section>

      <section v-if="activeTool === 'interface_asset'" class="section-title-row">
        <div>
          <p class="eyebrow">Interface Assets</p>
          <h2>接口资产</h2>
          <span>接口取数内置数据库存储、Cookie 更新、Payload 筛选和字段解析。</span>
          <small v-if="storagePaths.configDir">配置目录：{{ storagePaths.configDir }}</small>
        </div>
        <button class="primary" @click="openCreate">新建接口</button>
      </section>

      <section v-if="activeTool !== 'home' && activeTool !== 'interface_asset'" class="tool-placeholder">
        <strong>{{ currentTool.title }}</strong>
        <p>{{ currentTool.description }}</p>
        <span>{{ currentTool.status }}</span>
      </section>

      <div v-if="activeTool === 'interface_asset'" class="asset-layout">
        <section class="asset-list-panel">
          <div class="asset-list-head">
            <div>
              <h2>已保存接口</h2>
              <p>选择接口后在右侧查看配置、编辑、运行和输出。</p>
            </div>
          </div>

          <section class="toolbar">
            <input v-model="keyword" placeholder="搜索接口名称、系统、分类" />
            <select v-model="systemFilter">
              <option value="all">全部系统</option>
              <option v-for="item in systems" :key="item.key" :value="item.key">{{ item.name }}</option>
            </select>
            <select v-model="storageFilter">
              <option value="all">全部存储</option>
              <option value="excel">Excel 文件</option>
              <option value="database">本地数据库</option>
              <option value="both">Excel + 本地数据库</option>
            </select>
          </section>

          <div class="empty-state compact" v-if="!filteredConfigs.length">
            <h3>还没有可复用接口</h3>
            <p>点击“新建接口”，保存 URL、Headers、Payload、字段映射和存储规则。</p>
            <button class="primary" @click="openCreate">新建第一个接口</button>
          </div>

          <div class="interface-table" v-else>
            <button
              v-for="item in filteredConfigs"
              :key="item.id"
              :class="['interface-row', { active: item.id === activeConfig?.id }]"
              @click="selectConfig(item)"
            >
              <span class="row-main">
                <strong>{{ item.name }}</strong>
                <small>{{ item.description || item.url || '未填写说明' }}</small>
              </span>
              <span class="method">{{ item.method }}</span>
              <span>{{ storageName(item.storageTarget) }}</span>
              <span :class="['cookie-chip', cookieClass(item)]">{{ cookieLabel(item) }}</span>
              <span>{{ item.lastCount ?? '-' }}</span>
            </button>
          </div>
        </section>

        <section class="asset-detail-panel">
          <div v-if="activeConfig" class="detail-card">
            <div class="detail-head">
              <div>
                <p class="eyebrow">接口详情</p>
                <h2>{{ activeConfig.name }}</h2>
                <p>{{ activeConfig.description || '未填写说明' }}</p>
              </div>
              <span class="method">{{ activeConfig.method }}</span>
            </div>

            <div class="detail-actions">
              <button class="primary" @click="runConfig(activeConfig)" :disabled="running">
                {{ runningId === activeConfig.id ? '运行中...' : '运行接口' }}
              </button>
              <button @click="openEdit(activeConfig)">编辑</button>
              <button @click="duplicateConfig(activeConfig)">复制</button>
              <button class="danger" @click="deleteConfig(activeConfig)">删除</button>
              <button @click="refreshCookie(activeConfig)">更新 Cookie</button>
            </div>

            <div class="detail-grid">
              <div>
                <span>请求地址</span>
                <strong>{{ activeConfig.url || '未填写' }}</strong>
              </div>
              <div>
                <span>系统 / 分类</span>
                <strong>{{ systemName(activeConfig.system) }} / {{ activeConfig.category || '未分类' }}</strong>
              </div>
              <div>
                <span>Payload</span>
                <strong>{{ activeConfig.payloadFields?.length ? `${activeConfig.payloadFields.length} 个运行时字段` : '固定 Payload' }}</strong>
              </div>
              <div>
                <span>解析路径</span>
                <strong>{{ activeConfig.listPath || '根数组' }}</strong>
              </div>
              <div>
                <span>存储方式</span>
                <strong>{{ storageName(activeConfig.storageTarget) }}</strong>
              </div>
              <div>
                <span>SQLite 表</span>
                <strong>{{ activeConfig.tableName || '未设置' }}</strong>
              </div>
            </div>

            <div class="path-summary">
              <p><b>运行留痕 raw/rows</b>{{ activeConfig.outputDir || '默认应用目录' }}</p>
              <p><b>本地数据库 SQLite</b>{{ activeConfig.databasePath || '默认 ts_agent.db' }}</p>
            </div>
          </div>

          <div v-else class="detail-card empty-state compact">
            <h3>选择一个接口</h3>
            <p>左侧选中接口后，可以查看配置摘要、运行结果和保存位置。</p>
          </div>

          <RunResultPanel :result="result" :active-name="activeConfig?.name" />
        </section>
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
      deleteCrawlerConfig?: (id: string) => Promise<{ success: boolean }>
      getCrawlerConfigPaths?: () => Promise<{ configDir: string; dataDir: string; databasePath: string }>
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
const deletedStorageKey = 'ts-agent-crawler-deleted-configs'
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
const activeTool = ref('home')
const storagePaths = reactive({
  configDir: '',
  dataDir: '',
  databasePath: '',
})

const toolboxApps = [
  {
    key: 'interface_asset',
    code: 'IF',
    title: '接口资产',
    description: 'Fetch/XHR 取数、Payload、Cookie、字段映射',
    status: '已启用',
  },
  {
    key: 'agent_asset',
    code: 'AG',
    title: '智能体资产',
    description: '后续接入提示词、工具调用和知识配置',
    status: '规划中',
  },
  {
    key: 'rpa_asset',
    code: 'RP',
    title: 'RPA资产',
    description: '处理登录、按钮下载、Excel/PDF 兜底取数',
    status: '预留',
  },
  {
    key: 'analysis_asset',
    code: 'DA',
    title: '数据分析',
    description: '面向月报、校验、趋势和问题扫描',
    status: '预留',
  },
]

const currentTool = computed(() =>
  toolboxApps.find(item => item.key === activeTool.value) || toolboxApps[0]
)

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
const deletedConfigIds = () => new Set(JSON.parse(localStorage.getItem(deletedStorageKey) || '[]') as string[])

const saveDeletedConfigIds = (ids: Set<string>) => {
  localStorage.setItem(deletedStorageKey, JSON.stringify([...ids]))
}

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
  const deleted = deletedConfigIds()
  configs.value = withBuiltInConfigs(Array.isArray(savedConfigs) ? savedConfigs : [])
    .filter(item => !item.id || !deleted.has(item.id))
  activeConfig.value = selectInitialConfig(configs.value, activeConfig.value)
}

const refreshStoragePaths = async () => {
  if (!window.ipcApi?.getCrawlerConfigPaths) return
  try {
    Object.assign(storagePaths, await window.ipcApi.getCrawlerConfigPaths())
  } catch (error) {
    console.warn('读取配置目录失败。', error)
  }
}

const persistPreview = (saved: CrawlerConfig) => {
  const next = [saved, ...configs.value.filter(item => item.id !== saved.id)]
  localStorage.setItem(previewStorageKey, JSON.stringify(next))
}

const removePreview = (id: string) => {
  const next = configs.value.filter(item => item.id !== id)
  localStorage.setItem(previewStorageKey, JSON.stringify(next))
}

const openTool = (key: string) => {
  activeTool.value = key
}

const backHome = () => {
  activeTool.value = 'home'
}

const openCreate = () => {
  Object.assign(editingConfig, blankConfig())
  modalOpen.value = true
}

const openEdit = (config: CrawlerConfig) => {
  Object.assign(editingConfig, normalizeConfig(clone(config)))
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
  const normalized = normalizeConfig(toIpcSafe(config))
  const saved = {
    ...normalized,
    id: normalized.id || `${normalized.system || 'custom'}_${Date.now()}`,
    updatedAt: new Date().toISOString(),
  }

  try {
    if (window.ipcApi?.saveCrawlerConfig) {
      const res = await window.ipcApi.saveCrawlerConfig(toIpcSafe(saved))
      if (!res?.success || !res.config) throw new Error('主进程未返回保存后的接口配置')
      activeConfig.value = normalizeConfig(res.config)
      result.value = {
        success: true,
        message: `接口已保存。配置文件目录：${storagePaths.configDir || '应用数据目录/crawler-configs'}`,
      }
    } else {
      persistPreview(saved)
      activeConfig.value = saved
      result.value = { success: true, message: '预览模式已保存到浏览器本地。' }
    }
  } catch (error: any) {
    result.value = { success: false, error: `保存失败：${error?.message ?? String(error)}` }
    return
  }

  const deleted = deletedConfigIds()
  if (saved.id) {
    deleted.delete(saved.id)
    saveDeletedConfigIds(deleted)
  }

  modalOpen.value = false
  await refreshConfigs()
}

const deleteConfig = async (config: CrawlerConfig) => {
  if (!config.id) return
  const confirmed = window.confirm(`删除接口「${config.name}」？`)
  if (!confirmed) return

  if (window.ipcApi?.deleteCrawlerConfig) {
    await window.ipcApi.deleteCrawlerConfig(config.id)
  } else {
    removePreview(config.id)
  }

  const deleted = deletedConfigIds()
  deleted.add(config.id)
  saveDeletedConfigIds(deleted)
  activeConfig.value = null
  result.value = { success: true, message: '接口已删除。' }
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
  excel: 'Excel 文件',
  database: '本地数据库',
  both: 'Excel + 本地数据库',
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

onMounted(async () => {
  await refreshStoragePaths()
  await refreshConfigs()
})
</script>
