<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <section class="run-modal">
      <header class="modal-head">
        <div>
          <p class="eyebrow">运行接口</p>
          <h2>{{ config.name }}</h2>
        </div>
        <button class="icon-button" @click="$emit('close')" aria-label="关闭">×</button>
      </header>

      <div class="modal-body">
        <section class="modal-section">
          <h3>筛选载荷</h3>
          <div class="section-hint">
            运行时填写的值会填充到 Payload JSON 对应字段里，再执行接口请求。
          </div>
          <div class="form-grid" v-if="config.payloadFields?.length">
            <label v-for="field in config.payloadFields" :key="field.id">
              {{ field.label || field.path }}
              <select v-if="field.type === 'select'" v-model="params[field.path]">
                <option v-for="option in options(field.optionsText)" :key="option" :value="option">{{ option }}</option>
              </select>
              <input v-else v-model="params[field.path]" :type="inputType(field.type)" :required="field.required" />
            </label>
          </div>
          <div class="empty-inline" v-else>
            未配置运行时载荷字段，将直接使用 Payload JSON 模板运行。
          </div>
        </section>

        <section class="modal-section" v-if="config.paginationEnabled">
          <h3>分页取数</h3>
          <div class="run-summary">
            <span>页码字段：{{ config.pageField }}</span>
            <span>页大小字段：{{ config.pageSizeField }}</span>
            <span>每页：{{ config.pageSize }}</span>
            <span>停止：{{ stopModeText }}</span>
          </div>
        </section>
      </div>

      <footer class="modal-actions">
        <button @click="$emit('close')">取消</button>
        <button class="primary" @click="$emit('run', params)">开始取数</button>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { CrawlerConfig, PayloadFieldType, RuntimeParams } from '../types'

const props = defineProps<{
  config: CrawlerConfig
}>()

defineEmits<{
  close: []
  run: [params: RuntimeParams]
}>()

const params = reactive<RuntimeParams>({})

const hydrate = () => {
  for (const key of Object.keys(params)) delete params[key]
  for (const field of props.config.payloadFields || []) {
    params[field.path] = field.defaultValue
  }
}

watch(() => props.config, hydrate, { deep: true, immediate: true })

const inputType = (type: PayloadFieldType) => {
  if (type === 'number') return 'number'
  if (type === 'date') return 'date'
  return 'text'
}

const options = (text: string) => text.split(/\r?\n/).map(item => item.trim()).filter(Boolean)

const stopModeText = computed(() => ({
  'empty-list': '空列表停止',
  'total-count': `达到总数 ${props.config.totalPath || '未配置'}`,
  'max-pages': `最大 ${props.config.maxPages} 页`,
}[props.config.stopMode]))
</script>
