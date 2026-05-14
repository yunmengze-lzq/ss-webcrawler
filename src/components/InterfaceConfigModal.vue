<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <section class="config-drawer">
      <header class="modal-head">
        <div>
          <p class="eyebrow">{{ draft.id ? '编辑接口' : '新建接口' }}</p>
          <h2>{{ draft.name || '未命名接口' }}</h2>
        </div>
        <button class="icon-button" @click="$emit('close')" aria-label="关闭">×</button>
      </header>

      <div class="drawer-body">
        <nav class="drawer-steps">
          <button
            v-for="step in steps"
            :key="step.key"
            :class="{ active: activeStep === step.key }"
            @click="activeStep = step.key"
          >
            <strong>{{ step.title }}</strong>
            <span>{{ step.caption }}</span>
          </button>
        </nav>

        <section class="drawer-form">
          <section v-if="activeStep === 'source'" class="step-panel">
            <h3>接口来源</h3>
            <p>先填最关键的 URL 和方法，确保这个接口是可以被主进程访问的。</p>
            <label class="hero-field">
              API URL
              <input v-model="draft.url" placeholder="https://example.com/api/query 或 http://10.x.x.x/query" />
            </label>
            <div class="form-grid">
              <label>
                接口名称
                <input v-model="draft.name" placeholder="负载率日数据接口" />
              </label>
              <label>
                请求方法
                <select v-model="draft.method">
                  <option>GET</option>
                  <option>POST</option>
                </select>
              </label>
              <label>
                系统
                <select v-model="draft.system">
                  <option value="load_meter">计量负载率</option>
                  <option value="voltage">电压监测</option>
                  <option value="asset">资产台账</option>
                  <option value="gis">GIS 坐标</option>
                  <option value="marketing">营销报装</option>
                  <option value="custom">自定义</option>
                </select>
              </label>
              <label>
                分类
                <input v-model="draft.category" placeholder="基础台账 / 运行监测 / 问题库" />
              </label>
            </div>
            <label>
              说明
              <input v-model="draft.description" placeholder="这个接口给智能体提供什么数据" />
            </label>
          </section>

          <section v-if="activeStep === 'request'" class="step-panel">
            <h3>请求参数</h3>
            <p>Headers、Cookie 和 Payload 会直接参与取数。Cookie 只保存在本机配置中。</p>
            <label>
              Headers
              <textarea v-model="draft.headersText" spellcheck="false" placeholder='{"Accept":"application/json"} 或复制浏览器 Headers 行'></textarea>
            </label>
            <label>
              Payload JSON
              <textarea v-model="draft.payloadText" class="tall" spellcheck="false"></textarea>
            </label>
            <details class="cookie-box" open>
              <summary>Cookie 与登录辅助</summary>
              <label>
                Cookie
                <textarea v-model="draft.cookie" spellcheck="false" placeholder="从 Fetch/XHR 请求标头复制 Cookie"></textarea>
              </label>
              <div class="form-grid">
                <label>
                  Cookie 更新方式
                  <select v-model="draft.cookieRefreshMode">
                    <option value="manual">手动粘贴</option>
                    <option value="rpa-login">打开登录页辅助更新</option>
                  </select>
                </label>
                <label>
                  有效期提醒（小时）
                  <input v-model.number="draft.cookieExpireHours" type="number" min="1" />
                </label>
                <label>
                  登录页 URL
                  <input v-model="draft.loginUrl" placeholder="留空则按接口域名打开" />
                </label>
                <label>
                  Cookie 更新时间
                  <div class="path-row">
                    <input :value="draft.cookieUpdatedAt || '尚未标记'" disabled />
                    <button type="button" @click="markCookieUpdated">标记</button>
                  </div>
                </label>
              </div>
            </details>
          </section>

          <section v-if="activeStep === 'payload'" class="step-panel">
            <h3>筛选与翻页</h3>
            <p>把需要运行时填写的筛选条件从 Payload 中提出来，例如日期、单位、台区、状态。</p>
            <div class="payload-summary">
              <strong>{{ payloadStatus }}</strong>
              <button type="button" @click="addPayloadField">添加载荷字段</button>
            </div>
            <div class="payload-field-list">
              <div class="payload-field" v-for="(field, index) in draft.payloadFields" :key="field.id">
                <input v-model="field.label" placeholder="显示名，如开始日期" />
                <input v-model="field.path" placeholder="Payload路径，如 query.startDate" />
                <select v-model="field.type">
                  <option value="text">文本</option>
                  <option value="number">数字</option>
                  <option value="date">日期</option>
                  <option value="select">下拉</option>
                </select>
                <input v-model="field.defaultValue" placeholder="默认值" />
                <label class="inline-check">
                  <input v-model="field.required" type="checkbox" />
                  必填
                </label>
                <button type="button" @click="removePayloadField(index)">删除</button>
                <textarea
                  v-if="field.type === 'select'"
                  v-model="field.optionsText"
                  placeholder="下拉选项，每行一个"
                ></textarea>
              </div>
            </div>

            <div class="pagination-box">
              <label class="inline-check">
                <input v-model="draft.paginationEnabled" type="checkbox" />
                启用自动翻页，提取所有页数据
              </label>
              <div class="form-grid" v-if="draft.paginationEnabled">
                <label>
                  页码字段
                  <input v-model="draft.pageField" placeholder="pageNo / current" />
                </label>
                <label>
                  每页数量字段
                  <input v-model="draft.pageSizeField" placeholder="pageSize / size" />
                </label>
                <label>
                  每页数量
                  <input v-model.number="draft.pageSize" type="number" min="1" />
                </label>
                <label>
                  总数字段路径
                  <input v-model="draft.totalPath" placeholder="data.total" />
                </label>
                <label>
                  最大页数
                  <input v-model.number="draft.maxPages" type="number" min="1" />
                </label>
                <label>
                  停止条件
                  <select v-model="draft.stopMode">
                    <option value="empty-list">空列表停止</option>
                    <option value="total-count">达到 total 停止</option>
                    <option value="max-pages">达到最大页数停止</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section v-if="activeStep === 'parse'" class="step-panel">
            <h3>数据解析</h3>
            <p>接口返回会先保存为 raw.json，再按列表路径和字段映射生成标准 rows.json。</p>
            <div class="form-grid">
              <label>
                列表路径
                <input v-model="draft.listPath" placeholder="data.list；根数组可留空" />
              </label>
              <label>
                字段状态
                <input :value="fieldStatus" disabled />
              </label>
            </div>
            <label>
              字段映射 JSON
              <textarea v-model="draft.fieldsText" class="tall" spellcheck="false"></textarea>
            </label>
          </section>

          <section v-if="activeStep === 'storage'" class="step-panel">
            <h3>存储输出</h3>
            <p>内置 SQLite 通过 Python 标准库写入，不需要内网安装额外数据库包。</p>
            <div class="storage-options">
              <button
                v-for="option in storageOptions"
                :key="option.value"
                type="button"
                :class="{ selected: draft.storageTarget === option.value }"
                @click="setStorageTarget(option.value)"
              >
                <strong>{{ option.label }}</strong>
                <span>{{ option.description }}</span>
              </button>
            </div>

            <div class="form-grid">
              <label>
                运行留痕目录 raw/rows
                <div class="path-row">
                  <input v-model="draft.outputDir" placeholder="留空则使用应用默认目录" />
                  <button type="button" @click="pickDir('outputDir')">选择</button>
                </div>
              </label>
              <label>
                本地数据库 SQLite 文件路径
                <div class="path-row">
                  <input v-model="draft.databasePath" placeholder="留空则使用默认 ts_agent.db" />
                  <button type="button" @click="pickDir('databasePath')">目录</button>
                </div>
              </label>
              <label>
                数据库表名
                <input v-model="draft.tableName" placeholder="load_meter_daily" />
              </label>
              <label>
                主键字段
                <input v-model="draft.primaryKey" placeholder="ts_id 或 文章ID" />
              </label>
              <label>
                写入策略
                <select v-model="draft.writeMode">
                  <option value="append">追加</option>
                  <option value="overwrite">覆盖表</option>
                  <option value="upsert">按主键更新</option>
                </select>
              </label>
            </div>
          </section>
        </section>
      </div>

      <footer class="modal-actions">
        <button :disabled="stepIndex === 0" @click="goStep(-1)">上一步</button>
        <button :disabled="stepIndex === steps.length - 1" @click="goStep(1)">下一步</button>
        <button @click="$emit('close')">取消</button>
        <button class="primary" @click="submit">保存接口</button>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { CrawlerConfig, StorageTarget } from '../types'

const props = defineProps<{
  modelValue: CrawlerConfig
}>()

const emit = defineEmits<{
  save: [config: CrawlerConfig]
  close: []
}>()

declare global {
  interface Window {
    ipcApi?: {
      selectDirectory?: () => Promise<string | null>
    }
  }
}

const clone = (value: CrawlerConfig) => JSON.parse(JSON.stringify(value)) as CrawlerConfig
const draft = reactive<CrawlerConfig>(clone(props.modelValue))
const steps = [
  { key: 'source', title: '接口来源', caption: '名称、方法、URL' },
  { key: 'request', title: '请求参数', caption: 'Headers、Cookie、Payload' },
  { key: 'payload', title: '筛选翻页', caption: '运行时字段、分页' },
  { key: 'parse', title: '数据解析', caption: '列表路径、字段映射' },
  { key: 'storage', title: '存储输出', caption: 'Excel、SQLite、主键' },
]
const activeStep = ref(steps[0].key)
const stepIndex = computed(() => steps.findIndex(step => step.key === activeStep.value))
const storageOptions: Array<{ value: StorageTarget; label: string; description: string }> = [
  { value: 'database', label: '只入本地数据库', description: '推荐给智能体后续查询调用，不生成 Excel。' },
  { value: 'excel', label: '只导出 Excel', description: '适合人工查看、交付和复核。' },
  { value: 'both', label: '数据库 + Excel', description: '智能体调用和人工复核同时保留。' },
]

watch(
  () => props.modelValue,
  value => Object.assign(draft, clone(value)),
  { deep: true },
)

const fieldStatus = computed(() => {
  try {
    const fields = JSON.parse(draft.fieldsText || '{}')
    return `${Object.keys(fields).length} 个字段`
  } catch {
    return '字段映射 JSON 格式错误'
  }
})

const payloadStatus = computed(() => {
  const count = draft.payloadFields?.length || 0
  if (!count) return '没有运行时筛选字段，运行时直接使用 Payload JSON。'
  return `${count} 个运行时筛选字段会在运行前覆盖 Payload 对应路径。`
})

const goStep = (offset: number) => {
  const next = Math.min(steps.length - 1, Math.max(0, stepIndex.value + offset))
  activeStep.value = steps[next].key
}

const pickDir = async (target: 'outputDir' | 'databasePath') => {
  const selected = await window.ipcApi?.selectDirectory?.()
  if (!selected) return
  draft[target] = target === 'databasePath'
    ? `${selected}\\ts_agent.db`
    : selected
}

const setStorageTarget = (target: StorageTarget) => {
  draft.storageTarget = target
}

const markCookieUpdated = () => {
  draft.cookieUpdatedAt = new Date().toISOString()
}

const addPayloadField = () => {
  draft.payloadFields.push({
    id: `field_${Date.now()}`,
    label: '',
    path: '',
    type: 'text',
    defaultValue: '',
    required: false,
    optionsText: '',
  })
}

const removePayloadField = (index: number) => {
  draft.payloadFields.splice(index, 1)
}

const submit = () => {
  if (draft.cookie && !draft.cookieUpdatedAt) markCookieUpdated()
  emit('save', clone(draft))
}
</script>
