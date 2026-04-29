<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { Task } from '../shared/types'
import TaskForm from '../components/TaskForm.vue'
import PageHeader from '../components/PageHeader.vue'

const router = useRouter()

const search = ref('')
const loading = ref(false)
const tasks = ref<Task[]>([])

const formOpen = ref(false)
const editing = ref<Partial<Task> | null>(null)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return tasks.value
  return tasks.value.filter((t) => {
    return (
      t.name.toLowerCase().includes(q) ||
      t.scriptPath.toLowerCase().includes(q) ||
      t.pythonPath.toLowerCase().includes(q) ||
      String(t.scheduleExpr ?? '')
        .toLowerCase()
        .includes(q)
    )
  })
})

async function refresh() {
  loading.value = true
  try {
    tasks.value = (await window.api.listTasks()) as any
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  formOpen.value = true
}

function openEdit(t: Task) {
  editing.value = t
  formOpen.value = true
}

async function runNow(t: Task) {
  try {
    await window.api.runNow(t.id)
    ElMessage.success('已触发运行')
  } catch (e: any) {
    ElMessage.error(e?.message ?? '运行失败')
  }
}

function goLogs(t: Task) {
  router.push({ path: '/logs', query: { taskId: t.id } })
}

onMounted(refresh)
</script>

<template>
  <div class="page">
    <PageHeader title="任务" subtitle="管理脚本、Python 环境与 Cron 计划。">
      <template #extra>
        <el-input
          v-model="search"
          placeholder="搜索名称、脚本、Python 路径或 Cron…"
          clearable
          style="width: 280px"
        />
        <el-button @click="refresh">刷新</el-button>
        <el-button type="primary" @click="openCreate">新建任务</el-button>
      </template>
    </PageHeader>

    <el-card class="card">
      <el-table v-loading="loading" :data="filtered" style="width: 100%" size="default">
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="enabled" label="启用" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="pythonPath" label="Python" min-width="220" show-overflow-tooltip />
        <el-table-column prop="scriptPath" label="脚本" min-width="240" show-overflow-tooltip />
        <el-table-column prop="scheduleExpr" label="Cron" min-width="170" show-overflow-tooltip />
        <el-table-column label="操作" width="140" align="center" fixed="right">
          <template #default="{ row }">
            <div class="op-cell">
              <el-link type="primary" :underline="false" @click="openEdit(row)">编辑</el-link>
              <el-dropdown trigger="click" class="op-dropdown">
                <el-link type="primary" class="op-more-trigger" :underline="false">更多</el-link>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="runNow(row)">立即运行</el-dropdown-item>
                    <el-dropdown-item @click="goLogs(row)">查看日志</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!loading && filtered.length === 0" style="padding: 24px">
        <el-empty description="还没有任务，点击右上角“新建任务”开始" />
      </div>
    </el-card>
  </div>

  <TaskForm v-model="formOpen" :task="editing" @saved="refresh" />
</template>

<style scoped>
.page {
  max-width: 1180px;
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

/* link 按钮在表格里易带浅色底/hover 底；用 el-link + 强制透明底色与表格调一致 */
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
</style>

