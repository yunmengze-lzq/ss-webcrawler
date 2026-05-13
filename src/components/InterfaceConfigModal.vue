<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <section class="config-modal">
      <header class="modal-head">
        <div>
          <p class="eyebrow">{{ draft.id ? '编辑接口' : '新建接口' }}</p>
          <h2>{{ draft.name || '未命名接口' }}</h2>
        </div>
        <button class="icon-button" @click="$emit('close')" aria-label="关闭">×</button>
      </header>

      <div class="modal-body">
        <section class="modal-section">
          <h3>基础信息</h3>
          <div class="form-grid">
            <label>
              接口名称
              <input v-model="draft.name" placeholder="计量负载率日数据" />
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
            <label>
              请求方法
              <select v-model="draft.method">
                <option>POST</option>
                <option>GET</option>
              </select>
            </label>
          </div>
          <label>
            说明
            <input v-model="draft.description" placeholder="用于智能体低压台区负载率分析" />
          </label>
        </section>

        <section class="modal-section">
          <h3>请求配置</h3>
          <label>
            API URL
            <input v-model="draft.url" placeholder="http://10.x.x.x/.../query" />
          </label>
          <label>
            Headers
            <textarea v-model="draft.headersText" spellcheck="false"></textarea>
          </label>
          <label>
            Cookie
            <textarea v-model="draft.cookie" spellcheck="false" placeholder="从 Fetch/XHR 请求标头复制 Cookie，只保存在本机配置中"></textarea>
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
          <label>
            Payload JSON
            <textarea v-model="draft.payloadText" class="tall" spellcheck="false"></textarea>
          </label>
        </section>

        <section class="modal-section">
          <h3>解析配置</h3>
          <div class="section-hint">
            接口返回先完整保存为 JSON，再按列表路径取数组，并按字段映射生成标准行数据，最后填充到 Excel 或数据库。
          </div>
          <div class="form-grid">
            <label>
              列表路径
              <input v-model="draft.listPath" placeholder="data.list 或 list" />
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

        <section class="modal-section">
          <h3>载荷字段与翻页</h3>
          <div class="section-hint">
            从 Payload JSON 中挑出需要运行时填写的筛选字段，比如日期、单位、台区、状态，以及不同系统各自的分页字段。
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
          <button type="button" @click="addPayloadField">添加载荷字段</button>

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

        <section class="modal-section">
          <h3>存储配置</h3>
          <div class="storage-options">
            <label :class="{ selected: draft.storageTarget === 'excel' }">
              <input v-model="draft.storageTarget" type="radio" value="excel" />
              <span>只存 Excel</span>
            </label>
            <label :class="{ selected: draft.storageTarget === 'database' }">
              <input v-model="draft.storageTarget" type="radio" value="database" />
              <span>只入数据库</span>
            </label>
            <label :class="{ selected: draft.storageTarget === 'both' }">
              <input v-model="draft.storageTarget" type="radio" value="both" />
              <span>Excel + 数据库</span>
            </label>
          </div>

          <div class="form-grid">
            <label>
              Excel / JSON 保存目录
              <div class="path-row">
                <input v-model="draft.outputDir" placeholder="留空则使用应用默认目录" />
                <button type="button" @click="pickDir('outputDir')">选择</button>
              </div>
            </label>
            <label>
              SQLite 文件路径
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
              <input v-model="draft.primaryKey" placeholder="ts_id 或 event_id" />
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
      </div>

      <footer class="modal-actions">
        <button @click="$emit('close')">取消</button>
        <button class="primary" @click="submit">保存接口</button>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { CrawlerConfig } from '../types'

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

const pickDir = async (target: 'outputDir' | 'databasePath') => {
  const selected = await window.ipcApi?.selectDirectory?.()
  if (!selected) return
  draft[target] = target === 'databasePath'
    ? `${selected}\\ts_agent.db`
    : selected
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
