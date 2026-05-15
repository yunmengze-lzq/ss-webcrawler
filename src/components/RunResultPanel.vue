<template>
  <aside class="result-panel">
    <div class="panel-head">
      <div>
        <p class="eyebrow">运行结果</p>
        <h2>{{ title }}</h2>
      </div>
      <span :class="['status-pill', result?.success ? 'ok' : result ? 'fail' : 'idle']">
        {{ resultLabel }}
      </span>
    </div>

    <div class="metric-grid">
      <div>
        <strong>{{ result?.count ?? 0 }}</strong>
        <span>标准行数</span>
      </div>
      <div>
        <strong>{{ result?.status ?? '-' }}</strong>
        <span>HTTP 状态</span>
      </div>
    </div>

    <div class="file-list" v-if="result?.files">
      <h3>保存位置</h3>
      <p v-for="(value, key) in result.files" :key="key">
        <b>{{ key }}</b>
        <span>{{ value }}</span>
      </p>
    </div>

    <div class="run-error-box" v-if="result?.error || result?.message">
      <h3>{{ result?.success ? '运行提示' : '失败原因' }}</h3>
      <p>{{ result?.error || result?.message }}</p>
    </div>

    <div class="file-list" v-if="result?.diagnostics">
      <h3>请求诊断</h3>
      <p v-if="diagnostics.lastRequestUrl">
        <b>最终请求</b>
        <span>{{ diagnostics.lastRequestUrl }}</span>
      </p>
      <p v-if="diagnostics.lastStatus">
        <b>HTTP</b>
        <span>{{ diagnostics.lastStatus }} / {{ diagnostics.lastContentType || '-' }}</span>
      </p>
      <p v-if="diagnostics.payloadKeys">
        <b>Payload</b>
        <span>{{ diagnostics.payloadKeys.join(', ') || '-' }}</span>
      </p>
      <p v-if="diagnostics.headerKeys">
        <b>Headers</b>
        <span>{{ diagnostics.headerKeys.join(', ') || '-' }}</span>
      </p>
    </div>

    <div class="preview-box">
      <h3>样例数据</h3>
      <pre>{{ prettyResult }}</pre>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RunResult } from '../types'

const props = defineProps<{
  result: RunResult | null
  activeName?: string
}>()

const title = computed(() => props.activeName || '等待选择接口')
const resultLabel = computed(() => {
  if (!props.result) return '未运行'
  return props.result.success ? '成功' : '失败'
})
const diagnostics = computed(() => props.result?.diagnostics || {})
const prettyResult = computed(() => JSON.stringify(props.result?.sample ?? props.result ?? {}, null, 2))
</script>
