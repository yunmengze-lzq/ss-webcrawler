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
const prettyResult = computed(() => JSON.stringify(props.result?.sample ?? props.result ?? {}, null, 2))
</script>
