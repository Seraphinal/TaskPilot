<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'
import type { Run, Task } from '../shared/types'
import PageHeader from '../components/PageHeader.vue'

/** 与 IPC 约定的「全部任务」取值，勿与真实任务 id 冲突 */
const ALL_TASKS = '__all__'

const route = useRoute()

const tasks = ref<Task[]>([])
const selectedTaskId = ref<string>(ALL_TASKS)
const runs = ref<Run[]>([])
const runsTotal = ref(0)
const page = ref(1)
const pageSize = ref(20)
/** 筛选 startedAt（本地选完转成毫秒传给主进程） */
const dateTimeRange = ref<[Date, Date] | null>(null)
const loading = ref(false)

const isAllTasks = computed(() => selectedTaskId.value === ALL_TASKS)

const selectedTask = computed(() =>
  tasks.value.find((t) => t.id === selectedTaskId.value) ?? null,
)

const drawerOpen = ref(false)
const activeTab = ref<'stdout' | 'stderr'>('stdout')
const logText = ref('')
const logLoading = ref(false)
const currentRun = ref<Run | null>(null)

const tableWrapRef = ref<HTMLElement | null>(null)
const colWidth = ref(160)
let ro: ResizeObserver | null = null
let dateRangeDeb: ReturnType<typeof setTimeout> | null = null

function taskName(taskId: string) {
  return tasks.value.find((t) => t.id === taskId)?.name ?? taskId.slice(0, 8) + '…'
}

function statusMeta(status: string) {
  if (status === 'success') return { label: '成功', type: 'success' as const }
  if (status === 'running') return { label: '运行中', type: 'warning' as const }
  if (status === 'timeout') return { label: '超时', type: 'danger' as const }
  if (status === 'killed') return { label: '已终止', type: 'info' as const }
  return { label: '失败', type: 'danger' as const }
}

async function refreshTasks() {
  tasks.value = (await window.api.listTasks()) as any
  const fromQuery = typeof route.query.taskId === 'string' ? route.query.taskId : ''
  if (fromQuery && tasks.value.some((t) => t.id === fromQuery)) {
    selectedTaskId.value = fromQuery
    return
  }
}

async function refreshRuns() {
  loading.value = true
  try {
    let startedAtMin: number | undefined
    let startedAtMax: number | undefined
    if (dateTimeRange.value && dateTimeRange.value.length === 2) {
      const [a, b] = dateTimeRange.value
      startedAtMin = a.getTime()
      startedAtMax = b.getTime()
    }
    const res = (await window.api.listRunsPaged(
      selectedTaskId.value,
      page.value,
      pageSize.value,
      startedAtMin,
      startedAtMax,
    )) as {
      total: number
      rows: Run[]
    }
    runs.value = res.rows
    runsTotal.value = res.total
  } finally {
    loading.value = false
  }
}

async function openRun(r: Run, tab: 'stdout' | 'stderr') {
  currentRun.value = r
  activeTab.value = tab
  drawerOpen.value = true
  await loadActiveLog()
}

async function loadActiveLog() {
  if (!currentRun.value) return
  logLoading.value = true
  try {
    const p = activeTab.value === 'stdout' ? currentRun.value.stdoutPath : currentRun.value.stderrPath
    logText.value = await window.api.readLogText(p, 400_000)
  } finally {
    logLoading.value = false
  }
}

async function clearRuns() {
  if (runsTotal.value === 0) return
  if (isAllTasks.value) {
    await ElMessageBox.confirm(
      '将删除「所有任务」的全部运行记录（数据库中的全部历史与磁盘上已保存的全部 stdout/stderr 日志文件），不可恢复。',
      '清空全部运行记录',
      { type: 'warning', confirmButtonText: '全部清空', cancelButtonText: '取消' },
    )
    loading.value = true
    try {
      await window.api.clearAllRuns()
      ElMessage.success('已清空全部运行记录')
      page.value = 1
      await refreshRuns()
      if (drawerOpen.value) {
        drawerOpen.value = false
        currentRun.value = null
      }
    } catch (e: any) {
      if (e !== 'cancel') ElMessage.error(e?.message ?? '清空失败')
    } finally {
      loading.value = false
    }
    return
  }
  await ElMessageBox.confirm(
    `将删除「${selectedTask.value?.name ?? '该任务'}」的全部运行记录（数据库中的历史与磁盘上的 stdout/stderr 日志文件），不可恢复。`,
    '清空运行记录',
    { type: 'warning', confirmButtonText: '清空', cancelButtonText: '取消' },
  )
  loading.value = true
  try {
    await window.api.clearRunsForTask(selectedTaskId.value)
    ElMessage.success('已清空运行记录')
    page.value = 1
    await refreshRuns()
    if (drawerOpen.value) {
      drawerOpen.value = false
      currentRun.value = null
    }
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message ?? '清空失败')
  } finally {
    loading.value = false
  }
}

async function copyLog() {
  try {
    await navigator.clipboard.writeText(logText.value || '')
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败（可能是权限限制）')
  }
}

const emptyDescription = computed(() => {
  if (tasks.value.length === 0) return '请先创建任务'
  return '暂无运行记录'
})

function recomputeColWidth() {
  const el = tableWrapRef.value
  if (!el) return
  const w = el.clientWidth
  if (!w || w < 1) return
  /** 任务 + 开始时间 + 状态 + 耗时 + 退出码 + 操作 */
  const n = 6
  const min = 120
  colWidth.value = Math.max(min, Math.floor((w - 2) / n))
}

watch(selectedTaskId, async () => {
  page.value = 1
  await refreshRuns()
})

watch(dateTimeRange, () => {
  if (dateRangeDeb) clearTimeout(dateRangeDeb)
  dateRangeDeb = setTimeout(async () => {
    page.value = 1
    await refreshRuns()
  }, 320)
})

watch(activeTab, loadActiveLog)
watch(
  () => route.query.taskId,
  async () => {
    await refreshTasks()
    page.value = 1
    await refreshRuns()
  },
)

async function onRunsPageSizeChange() {
  page.value = 1
  await refreshRuns()
}

onMounted(async () => {
  await refreshTasks()
  await refreshRuns()
  await nextTick()
  recomputeColWidth()
  if (tableWrapRef.value) {
    ro = new ResizeObserver(() => recomputeColWidth())
    ro.observe(tableWrapRef.value)
  }
})

onBeforeUnmount(() => {
  if (dateRangeDeb) clearTimeout(dateRangeDeb)
  ro?.disconnect()
  ro = null
})
</script>

<template>
  <div class="page">
    <PageHeader title="日志" subtitle="分页查看运行历史与 stdout/stderr。">
      <template #extra>
        <el-select v-model="selectedTaskId" placeholder="选择任务范围" filterable style="width: 200px">
          <el-option label="全部任务日志" :value="ALL_TASKS" />
          <el-option v-for="t in tasks" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
        <el-date-picker
          v-model="dateTimeRange"
          type="datetimerange"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          format="YYYY-MM-DD HH:mm:ss"
          class="logsDateRange"
          clearable
        />
        <el-button @click="refreshRuns">刷新</el-button>
        <el-button type="danger" plain :disabled="runsTotal === 0" @click="clearRuns">清空记录</el-button>
      </template>
    </PageHeader>

    <el-card class="card">
      <div ref="tableWrapRef" class="tableWrap">
        <el-table v-loading="loading" :data="runs" style="width: 100%" size="default" table-layout="fixed">
          <template #empty>
            <el-empty :description="emptyDescription" />
          </template>

          <el-table-column label="任务" :width="colWidth" show-overflow-tooltip>
            <template #default="{ row }">{{ taskName(row.taskId) }}</template>
          </el-table-column>
          <el-table-column label="开始时间" :width="colWidth" show-overflow-tooltip>
            <template #default="{ row }">{{ new Date(row.startedAt).toLocaleString() }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" :width="colWidth" align="center" header-align="center">
            <template #default="{ row }">
              <el-tag :type="statusMeta(row.status).type">{{ statusMeta(row.status).label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="耗时" :width="colWidth" align="center" header-align="center">
            <template #default="{ row }">
              <span v-if="row.endedAt">{{ Math.max(0, row.endedAt - row.startedAt) }} ms</span>
              <span v-else style="color: rgba(0, 0, 0, 0.45)">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="exitCode" label="退出码" :width="colWidth" align="center" header-align="center" />
          <el-table-column label="操作" :width="colWidth" align="center" header-align="center">
            <template #default="{ row }">
              <div class="op-cell">
                <el-link type="primary" :underline="false" @click="openRun(row, 'stdout')">查看</el-link>
                <el-dropdown trigger="click" class="op-dropdown">
                  <el-link type="primary" class="op-more-trigger" :underline="false">更多</el-link>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="openRun(row, 'stdout')">查看 stdout</el-dropdown-item>
                      <el-dropdown-item @click="openRun(row, 'stderr')">查看 stderr</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="runsTotal > 0" class="pager">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            :total="runsTotal"
            :page-sizes="[10, 20, 50, 100, 200]"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @current-change="refreshRuns"
            @size-change="onRunsPageSizeChange"
          />
        </div>
      </div>
    </el-card>
  </div>

  <el-drawer v-model="drawerOpen" size="720px">
    <template #header>
      <div class="drawerHeader">
        <div>
          <div class="drawerTitle">日志查看</div>
          <div class="drawerSub">
            {{ currentRun ? taskName(currentRun.taskId) : '' }} ·
            {{ currentRun ? new Date(currentRun.startedAt).toLocaleString() : '' }}
            <template v-if="currentRun"> · {{ statusMeta(currentRun.status).label }}</template>
          </div>
        </div>
        <div class="drawerActions">
          <el-button @click="copyLog" :disabled="logLoading" plain>
            <el-icon><CopyDocument /></el-icon>
            复制
          </el-button>
        </div>
      </div>
    </template>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="stdout" name="stdout" />
      <el-tab-pane label="stderr" name="stderr" />
    </el-tabs>
    <el-skeleton :loading="logLoading" animated>
      <template #default>
        <pre class="logBox">{{ logText || '（空）' }}</pre>
      </template>
    </el-skeleton>
  </el-drawer>
</template>

<style scoped>
.page {
  max-width: 1180px;
}
.tableWrap {
  width: 100%;
}
.logsDateRange {
  width: 360px;
  max-width: 100%;
}
@media (max-width: 1100px) {
  .logsDateRange {
    width: min(360px, 100%);
  }
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--app-border, rgba(5, 5, 5, 0.06));
}
.drawerHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.drawerTitle {
  font-weight: 800;
}
.drawerSub {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
  margin-top: 4px;
}
.drawerActions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.op-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: nowrap;
  line-height: 22px;
  vertical-align: middle;
}
.op-cell :deep(.el-link) {
  margin: 0;
  padding: 0;
  font-size: inherit;
  line-height: inherit;
  vertical-align: baseline;
  background: transparent !important;
  border-radius: 0;
}
.op-cell :deep(.el-link:hover),
.op-cell :deep(.el-link:focus-visible),
.op-cell :deep(.el-link:active) {
  background: transparent !important;
}
.op-cell :deep(.el-link__inner) {
  line-height: inherit;
}
.op-dropdown {
  vertical-align: middle;
}

.logBox {
  white-space: pre-wrap;
  word-break: break-word;
  padding: 12px;
  border-radius: 12px;
  background: #0b1220;
  color: #e8edf7;
  border: 1px solid rgba(16, 24, 40, 0.18);
  min-height: 360px;
  font-size: 12px;
  line-height: 1.55;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>
