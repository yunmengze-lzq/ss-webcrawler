<template>
  <section :class="['import-panel', { embedded }]">
    <header class="import-panel-head">
      <div>
        <p class="eyebrow">Network Parser</p>
        <h2>导入解析</h2>
        <span>从浏览器 Network 复制请求信息，自动填充 URL、Headers、Cookie、Payload 和字段映射。</span>
      </div>
      <button v-if="showClose" class="icon-button" @click="$emit('close')" aria-label="Close">x</button>
    </header>

    <div class="import-body inline">
      <section class="capture-grid">
        <label class="capture-card primary-card">
          <span class="capture-card-head">
            <i v-html="iconSvg('headers')"></i>
            <strong>1. 请求标头</strong>
            <em>必填</em>
          </span>
          <small>支持中文 Chrome Network：请求网址、请求方法、authorization、cookie、referer 等两行格式。</small>
          <textarea
            v-model="headersText"
            spellcheck="false"
            placeholder="请求网址&#10;https://example.com/api/list?limit=10&#10;请求方法&#10;GET&#10;authorization&#10;...&#10;cookie&#10;..."
          ></textarea>
        </label>

        <label class="capture-card">
          <span class="capture-card-head">
            <i v-html="iconSvg('payload')"></i>
            <strong>2. 载荷 / 筛选</strong>
            <em>可选</em>
          </span>
          <small>支持 JSON、Form Data、Query String，例如 limit=10 或 pageNo=1&pageSize=100。</small>
          <textarea
            v-model="payloadText"
            spellcheck="false"
            placeholder="limit=10&#10;&#10;或&#10;{ pageNo: 1, pageSize: 100 }"
          ></textarea>
        </label>

        <label class="capture-card">
          <span class="capture-card-head">
            <i v-html="iconSvg('fields')"></i>
            <strong>3. 响应数据</strong>
            <em>建议</em>
          </span>
          <small>优先粘贴原始 Response JSON；如果只有 Preview 展开视图，会降级推断字段。</small>
          <textarea
            v-model="responseText"
            spellcheck="false"
            placeholder='[{"id":"1","content":"hello","author":{"id":"u1","username":"user"}}]&#10;&#10;或粘贴 Preview 展开内容'
          ></textarea>
        </label>

        <label class="capture-card compact-card">
          <span class="capture-card-head">
            <i v-html="iconSvg('fallback')"></i>
            <strong>整段兜底</strong>
            <em>可选</em>
          </span>
          <small>如果复制出来的内容分不清区域，可以整段放这里，系统会尝试识别。</small>
          <textarea
            v-model="fullText"
            spellcheck="false"
            placeholder="完整复制的 Network 内容..."
          ></textarea>
        </label>
      </section>

      <section class="parse-preview">
        <div class="parse-preview-head">
          <div>
            <p class="eyebrow">Parse Result</p>
            <h3>{{ parsed.url ? '已识别请求' : '等待粘贴请求' }}</h3>
          </div>
          <span :class="['parse-state', parsed.url ? 'ok' : 'idle']">{{ parsed.url ? '可填充' : '待解析' }}</span>
        </div>

        <div class="parse-summary">
          <div>
            <span>URL</span>
            <strong>{{ parsed.url || '-' }}</strong>
          </div>
          <div>
            <span>Method</span>
            <strong>{{ parsed.method }}</strong>
          </div>
          <div>
            <span>Headers</span>
            <strong>{{ Object.keys(parsed.headers).length }}</strong>
          </div>
          <div>
            <span>Payload</span>
            <strong>{{ Object.keys(parsed.payload).length }}</strong>
          </div>
          <div>
            <span>listPath</span>
            <strong>{{ parsed.listPath || '-' }}</strong>
          </div>
          <div>
            <span>Fields</span>
            <strong>{{ Object.keys(parsed.fields).length }}</strong>
          </div>
        </div>

        <div class="import-effect-list">
          <span :class="{ done: Boolean(parsed.url) }">
            <i v-html="iconSvg(parsed.url ? 'check' : 'dot')"></i>
            填充接口来源
          </span>
          <span :class="{ done: Object.keys(parsed.headers).length > 0 || Boolean(parsed.cookie) }">
            <i v-html="iconSvg(Object.keys(parsed.headers).length > 0 || parsed.cookie ? 'check' : 'dot')"></i>
            填充 Headers / Cookie
          </span>
          <span :class="{ done: Object.keys(parsed.payload).length > 0 }">
            <i v-html="iconSvg(Object.keys(parsed.payload).length > 0 ? 'check' : 'dot')"></i>
            生成运行时载荷字段
          </span>
          <span :class="{ done: Object.keys(parsed.fields).length > 0 }">
            <i v-html="iconSvg(Object.keys(parsed.fields).length > 0 ? 'check' : 'dot')"></i>
            生成字段映射
          </span>
        </div>

        <div class="parse-warning" v-if="parsed.warnings.length">
          <p v-for="item in parsed.warnings" :key="item">{{ item }}</p>
        </div>

        <div class="import-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="preview-columns">
          <label v-show="activeTab === 'headers'">
            解析后的 Headers
            <textarea :value="previewHeaders" readonly spellcheck="false"></textarea>
          </label>
          <label v-show="activeTab === 'payload'">
            解析后的 Payload
            <textarea :value="previewPayload" readonly spellcheck="false"></textarea>
          </label>
          <label v-show="activeTab === 'fields'">
            解析后的字段映射
            <textarea :value="previewFields" readonly spellcheck="false"></textarea>
          </label>
        </div>
      </section>
    </div>

    <footer class="modal-actions import-actions">
      <button v-if="showClose" @click="$emit('close')">Collapse</button>
      <button @click="clearText">Clear</button>
      <button v-if="showCreate" :disabled="!parsed.url" @click="$emit('create', buildConfig(true))">Save As New</button>
      <button class="primary" :disabled="!parsed.url" @click="$emit('apply', buildConfig(false))">{{ applyLabel }}</button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CrawlerConfig, PayloadField, PayloadFieldType } from '../types'
import { isSignatureKey, normalizeConfig, parseNetworkCapture } from '../crawlerConfigUtils'

const props = defineProps<{
  baseConfig: CrawlerConfig
  embedded?: boolean
  showClose?: boolean
  showCreate?: boolean
  applyLabel?: string
}>()

defineEmits<{
  close: []
  apply: [config: CrawlerConfig]
  create: [config: CrawlerConfig]
}>()

const tabs = [
  { key: 'headers', label: 'Headers' },
  { key: 'payload', label: 'Payload' },
  { key: 'fields', label: '字段映射' },
]

const icons: Record<string, string> = {
  headers: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v2H4V5zm0 6h10v2H4v-2zm0 6h16v2H4v-2zm13-7l4 3-4 3v-2h-5v-2h5v-2z"/></svg>',
  payload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 3h8v2H8V9zm0 4h5v2H8v-2z"/></svg>',
  fields: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v4H5V4zm0 6h6v10H5V10zm8 0h6v10h-6V10zM7 6v1h10V6H7zm0 6v6h2v-6H7zm8 0v6h2v-6h-2z"/></svg>',
  fallback: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l5 5v13H6V3zm8 2H8v14h10V9h-4V5zM4 7h2v14h10v2H4V7z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 16.2L5.8 12.5 4.4 13.9l5.1 5.1L20 8.5 18.6 7.1 9.5 16.2z"/></svg>',
  dot: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/></svg>',
}

const iconSvg = (name: string) => icons[name] || icons.dot

const activeTab = ref('headers')
const embedded = computed(() => props.embedded ?? false)
const showClose = computed(() => props.showClose ?? true)
const showCreate = computed(() => props.showCreate ?? true)
const applyLabel = computed(() => props.applyLabel || 'Apply To Current')
const headersText = ref('')
const payloadText = ref('')
const responseText = ref('')
const fullText = ref('')
const sourceText = computed(() => [
  headersText.value,
  payloadText.value ? `\nRequest Payload\n${payloadText.value}` : '',
  responseText.value ? `\nResponse\n${responseText.value}` : '',
  fullText.value,
].filter(Boolean).join('\n\n'))

const parsed = computed(() => parseNetworkCapture(sourceText.value))
const previewHeaders = computed(() => JSON.stringify(parsed.value.headers, null, 2))
const previewPayload = computed(() => JSON.stringify(parsed.value.payload, null, 2))
const previewFields = computed(() => JSON.stringify(parsed.value.fields, null, 2))

const inferFieldType = (value: unknown): PayloadFieldType => {
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return 'date'
  return 'text'
}

const payloadFields = () => Object.entries(parsed.value.payload)
  .filter(([key, value]) => !isSignatureKey(key) && ['string', 'number', 'boolean'].includes(typeof value))
  .map(([key, value]) => ({
    id: `payload_${key.replace(/[^\w]/g, '_')}`,
    label: key,
    path: key,
    type: inferFieldType(value),
    defaultValue: String(value),
    required: false,
    optionsText: '',
  } as PayloadField))

const inferPageField = () => Object.keys(parsed.value.payload).find(key => /(^|\.|_)(pageNo|page|current|pageIndex)$/i.test(key)) || ''
const inferPageSizeField = () => Object.keys(parsed.value.payload).find(key => /(^|\.|_)(pageSize|size|limit|perPage|per_page)$/i.test(key)) || ''

const buildConfig = (asNew: boolean) => normalizeConfig({
  ...props.baseConfig,
  id: asNew ? undefined : props.baseConfig.id,
  name: asNew ? `${props.baseConfig.name || 'interface'} import copy` : props.baseConfig.name,
  url: parsed.value.url || props.baseConfig.url,
  method: parsed.value.method,
  headersText: previewHeaders.value,
  cookie: parsed.value.cookie || props.baseConfig.cookie,
  payloadText: previewPayload.value,
  payloadFields: payloadFields(),
  paginationEnabled: Boolean(inferPageField()),
  pageField: inferPageField(),
  pageSizeField: inferPageField() ? inferPageSizeField() : '',
  pageSize: Number(parsed.value.payload[inferPageSizeField()] || props.baseConfig.pageSize || 100),
  maxPages: inferPageField() ? props.baseConfig.maxPages : 1,
  stopMode: inferPageField() ? props.baseConfig.stopMode : 'max-pages',
  listPath: Object.keys(parsed.value.fields).length ? parsed.value.listPath : props.baseConfig.listPath,
  fieldsText: previewFields.value,
})

const clearText = () => {
  headersText.value = ''
  payloadText.value = ''
  responseText.value = ''
  fullText.value = ''
}
</script>
