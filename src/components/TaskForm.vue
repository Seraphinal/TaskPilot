<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { Task } from '../shared/types'

const props = defineProps<{
  modelValue: boolean
  task?: Partial<Task> | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'saved'): void
}>()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const formRef = ref()
const form = reactive({
  id: '',
  name: '',
  enabled: true,
  pythonPath: 'python',
  scriptPath: '',
  argsJson: '[]',
  cwd: '',
  scheduleType: 'cron' as const,
  scheduleExpr: '0 9 * * *',
  timeoutMs: 0,
  concurrencyPolicy: 'skip' as const,
})

const cronPreview = ref<{ ok: boolean; error?: string; nextN?: number[] } | null>(null)
const previewLoading = ref(false)

const concurrencySegments = [
  { label: '跳过', value: 'skip' },
  { label: '排队', value: 'queue' },
  { label: '并行', value: 'parallel' },
] as const

watch(
  () => props.task,
  (t) => {
    const src = t ?? {}
    form.id = src.id ?? ''
    form.name = src.name ?? ''
    form.enabled = src.enabled ?? true
    form.pythonPath = src.pythonPath ?? 'python'
    form.scriptPath = src.scriptPath ?? ''
    form.argsJson = src.argsJson ?? '[]'
    form.cwd = src.cwd ?? ''
    form.scheduleType = (src.scheduleType as any) ?? 'cron'
    form.scheduleExpr = src.scheduleExpr ?? '0 9 * * *'
    form.timeoutMs = src.timeoutMs ?? 0
    form.concurrencyPolicy = (src.concurrencyPolicy as any) ?? 'skip'
    cronPreview.value = null
  },
  { immediate: true },
)

watch(
  () => form.scheduleExpr,
  async () => {
    if (!open.value) return
    previewLoading.value = true
    try {
      cronPreview.value = await window.api.previewCron(form.scheduleExpr, 5)
    } finally {
      previewLoading.value = false
    }
  },
  { immediate: true },
)

const rules = {
  name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  pythonPath: [{ required: true, message: '请输入 Python 解释器路径', trigger: 'blur' }],
  scriptPath: [{ required: true, message: '请选择/输入脚本路径', trigger: 'blur' }],
  scheduleExpr: [{ required: true, message: '请输入 Cron 表达式', trigger: 'blur' }],
}

async function save() {
  await formRef.value?.validate?.()
  await window.api.upsertTask({ ...form, id: form.id || undefined })
  emit('saved')
  open.value = false
}

async function pickPython() {
  const p = await window.api.pickFile({
    title: '选择 Python 解释器',
    filters: [{ name: 'Python', extensions: ['exe'] }],
  })
  if (p) form.pythonPath = p
}

async function pickScript() {
  const p = await window.api.pickFile({
    title: '选择脚本文件',
    filters: [{ name: 'Python Script', extensions: ['py'] }],
  })
  if (p) form.scriptPath = p
}

async function pickCwd() {
  const p = await window.api.pickDirectory({ title: '选择工作目录' })
  if (p) form.cwd = p
}
</script>

<template>
  <el-drawer v-model="open" size="560px" :with-header="false">
    <div class="drawerHeader">
      <div>
        <div class="drawerTitle">{{ form.id ? '编辑任务' : '新建任务' }}</div>
        <div class="drawerSub">为每个脚本绑定独立 Python 环境（含 uv venv 的 python.exe）。</div>
      </div>
      <div class="drawerActions">
        <el-button @click="open = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </div>
    </div>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-form-item label="任务名称" prop="name">
        <el-input v-model="form.name" placeholder="例如：每天备份数据库" />
      </el-form-item>

      <el-form-item label="启用" prop="enabled">
        <el-switch v-model="form.enabled" />
      </el-form-item>

      <el-form-item label="Python 解释器路径" prop="pythonPath">
        <el-input v-model="form.pythonPath" placeholder="例如：C:\\path\\to\\.venv\\Scripts\\python.exe 或 python">
          <template #append>
            <el-button @click="pickPython">选择…</el-button>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item label="脚本路径" prop="scriptPath">
        <el-input v-model="form.scriptPath" placeholder="例如：D:\\scripts\\job.py">
          <template #append>
            <el-button @click="pickScript">选择…</el-button>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item label="脚本参数（JSON 数组）" prop="argsJson">
        <el-input v-model="form.argsJson" placeholder='例如：["--foo","bar"]' />
      </el-form-item>

      <el-form-item label="工作目录（可选）" prop="cwd">
        <el-input v-model="form.cwd" placeholder="例如：D:\\scripts">
          <template #append>
            <el-button @click="pickCwd">选择…</el-button>
          </template>
        </el-input>
      </el-form-item>

      <el-divider content-position="left">计划（Cron）</el-divider>

      <el-form-item label="Crontab 表达式（5 段：分 时 日 月 周）" prop="scheduleExpr">
        <el-input v-model="form.scheduleExpr" placeholder="例如：0 9 * * 1-5（工作日 09:00）" />
        <div class="cronPreview">
          <el-skeleton :loading="previewLoading" animated>
            <template #template>
              <el-skeleton-item variant="text" style="width: 80%" />
              <el-skeleton-item variant="text" style="width: 65%" />
            </template>
            <template #default>
              <template v-if="cronPreview?.ok && cronPreview.nextN?.length">
                <div class="previewTitle">未来 5 次触发：</div>
                <div class="previewList">
                  <div v-for="t in cronPreview.nextN" :key="t" class="previewItem">
                    {{ new Date(t).toLocaleString() }}
                  </div>
                </div>
              </template>
              <template v-else>
                <el-text type="danger">Cron 无效：{{ cronPreview?.error || '未知错误' }}</el-text>
              </template>
            </template>
          </el-skeleton>
        </div>
      </el-form-item>

      <el-form-item label="超时（毫秒，0 表示不超时）" prop="timeoutMs">
        <el-input-number v-model="form.timeoutMs" :min="0" :step="1000" style="width: 220px" />
      </el-form-item>

      <el-form-item label="并发策略" prop="concurrencyPolicy">
        <div class="concurrencyBlk">
          <el-segmented v-model="form.concurrencyPolicy" :options="[...concurrencySegments]" />
          <div class="concurrencyHint">
            <div class="concurrencyScope">仅作用于<strong>计划/Cron 定时触发</strong>；任务列表「<strong>立即运行</strong>」不受影响。</div>
            <div><strong>跳过</strong>：上一次执行<strong>仍未结束</strong>时，本次定时触发<strong>丢弃</strong>。</div>
            <div><strong>排队</strong>：若在跑则记下次数，上一轮<strong>结束后按次数补跑</strong>（先入先跑）。</div>
            <div><strong>并行</strong>：允许多次定时<strong>同时进行</strong>（多个子进程）。</div>
          </div>
        </div>
      </el-form-item>
    </el-form>
  </el-drawer>
</template>

<style scoped>
.drawerHeader {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.drawerTitle {
  font-size: 18px;
  font-weight: 800;
}
.drawerSub {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 6px;
}
.drawerActions {
  display: flex;
  gap: 10px;
}
.concurrencyBlk {
  display: grid;
  gap: 10px;
  width: 100%;
}
.concurrencyHint {
  font-size: 12px;
  line-height: 1.65;
  color: rgba(0, 0, 0, 0.62);
}
.concurrencyHint strong {
  color: rgba(0, 0, 0, 0.78);
}
.concurrencyScope {
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.12);
}
.concurrencyHint > div + div {
  margin-top: 4px;
}
.cronPreview {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fafafa;
  border: 1px solid var(--app-border);
}
.previewTitle {
  font-weight: 700;
  margin-bottom: 6px;
}
.previewList {
  display: grid;
  gap: 4px;
}
.previewItem {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  opacity: 0.92;
  font-size: 12px;
}
</style>

