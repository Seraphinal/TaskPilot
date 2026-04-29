<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CircleCheckFilled, Loading, WarningFilled } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'
import type { DashboardSnapshot, RunStatus } from '../shared/types'

const router = useRouter()

const ping = ref('')
const pingBusy = ref(false)
const lastPingAt = ref<number | null>(null)
const loading = ref(false)
const snap = ref<DashboardSnapshot | null>(null)

/** 概览数据自动拉取间隔（毫秒） */
const REFRESH_MS = 30_000
let refreshTimer: ReturnType<typeof setInterval> | null = null

const pingOk = computed(() => ping.value === 'pong')

const lastPingText = computed(() => {
  if (!lastPingAt.value) return ''
  try {
    return new Date(lastPingAt.value).toLocaleString()
  } catch {
    return ''
  }
})

/** 连通性自检（不写库，仅 ping；用于卡片内按钮或整页加载） */
async function pingOnce(forButton = false) {
  if (forButton) pingBusy.value = true
  try {
    ping.value = await window.api.ping()
    lastPingAt.value = Date.now()
  } catch (e: any) {
    ping.value = e?.message ? String(e.message) : 'unreachable'
  } finally {
    if (forButton) pingBusy.value = false
  }
}

function statusLabel(s: RunStatus): string {
  if (s === 'success') return '成功'
  if (s === 'running') return '运行中'
  if (s === 'timeout') return '超时'
  if (s === 'killed') return '已终止'
  return '失败'
}

function statusTagType(s: RunStatus): 'success' | 'warning' | 'danger' | 'info' {
  if (s === 'success') return 'success'
  if (s === 'running') return 'warning'
  if (s === 'timeout') return 'danger'
  if (s === 'killed') return 'info'
  return 'danger'
}

function pickCount(m: Partial<Record<RunStatus, number>>, key: RunStatus) {
  return Math.max(0, Number(m[key] ?? 0))
}

/** 已结束运行中「非成功」占比（不含运行中） */
function failureRateText(m: Partial<Record<RunStatus, number>>) {
  const ok = pickCount(m, 'success')
  const run = pickCount(m, 'running')
  const bad = pickCount(m, 'failed') + pickCount(m, 'timeout') + pickCount(m, 'killed')
  const denom = ok + bad
  if (denom <= 0) return run > 0 ? '仅有运行中记录，尚无结果' : '暂无已结束记录'
  const pct = Math.round((bad / denom) * 1000) / 10
  return `非成功 ${bad} / 已结束 ${denom}（约 ${pct}%）`
}

async function load() {
  if (loading.value) return
  loading.value = true
  try {
    await pingOnce(false)
    snap.value = await window.api.getDashboardSnapshot()
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await load()
  refreshTimer = setInterval(() => void load(), REFRESH_MS)
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<template>
  <div class="page">
    <PageHeader
      title="概览"
      subtitle="了解界面与后台是否正常、任务与运行情况，以及计划中下次执行任务的大致时间。"
    />

    <div v-loading="loading" class="body">
      <el-row :gutter="14" class="cardsRow">
        <el-col :xs="24" :sm="12" :md="8" class="cardCol">
          <el-card shadow="never" class="card cardConn">
            <template #header>与本程序的后台连接</template>
            <div class="connBand" :class="{ connBandOk: pingOk, connBandFail: ping && !pingOk }">
              <div class="connMain">
                <div class="connIconWrap">
                  <el-icon v-if="loading && !ping" class="connIcon spinning" color="var(--el-color-primary)"><Loading /></el-icon>
                  <el-icon v-else-if="pingOk" class="connIcon" color="var(--el-color-success)"><CircleCheckFilled /></el-icon>
                  <el-icon v-else-if="ping" class="connIcon" color="var(--el-color-danger)"><WarningFilled /></el-icon>
                  <el-icon v-else class="connIcon connIconMuted"><WarningFilled /></el-icon>
                </div>
                <div class="connCopy">
                  <div class="connTitleRow">
                    <span class="connTitle">{{
                      loading && !ping
                        ? '正在检测…'
                        : pingOk
                          ? '与后台连接正常'
                          : ping
                            ? '暂时连不上后台'
                            : '尚未检测'
                    }}</span>
                    <template v-if="ping">
                      <el-tag v-if="pingOk" size="small" type="success" effect="light">正常</el-tag>
                      <el-tag v-else size="small" type="danger" effect="light">异常</el-tag>
                    </template>
                  </div>
                  <p v-if="pingOk" class="connSub">
                    界面和本机上的后台服务已成功握手，执行任务、读写日志等功能可以正常使用。
                  </p>
                  <p v-else-if="ping" class="connSub connSubWarn">
                    自检未成功。可先点右侧「检测连接」多试几次，仍不行请重启软件；若经常出现，请把下面「详细信息」发给开发者以便排查。
                  </p>
                  <div v-if="ping && !pingOk" class="connMeta connErrHint">详细信息：{{ ping }}</div>
                  <p v-if="loading && !ping" class="connSub">
                    进入页面后会自动检测一次；您也可以随时点右侧「检测连接」。
                  </p>
                  <div v-if="lastPingText" class="connMeta">上次检测 {{ lastPingText }}</div>
                </div>
                <div class="connActions">
                  <el-button
                    size="small"
                    :loading="pingBusy"
                    :disabled="loading && !pingBusy"
                    @click="pingOnce(true)"
                  >
                    检测连接
                  </el-button>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :xs="24" :sm="12" :md="8" class="cardCol">
          <el-card shadow="never" class="card">
            <template #header>
              <div class="paneSectionHdr">
                <span>任务与运行</span>
                <el-button size="small" plain class="hdrActionBtn" @click="router.push('/tasks')">管理任务</el-button>
              </div>
            </template>
            <template v-if="snap">
              <div class="statLine">
                <span class="label">任务</span>
                <span class="value"
                  >共 {{ snap.tasks.total }} 个 · 启用 {{ snap.tasks.enabled }} · 停用
                  {{ snap.tasks.disabled }}</span
                >
              </div>
              <div class="statLine">
                <span class="label">运行记录</span>
                <span class="value">共 {{ snap.runsTotal }} 条</span>
              </div>
              <div class="statLine">
                <span class="label">按状态</span>
                <span class="value chips">
                  <el-tag size="small" type="success" effect="plain">成功 {{ pickCount(snap.runsByStatus, 'success') }}</el-tag>
                  <el-tag size="small" type="danger" effect="plain">失败 {{ pickCount(snap.runsByStatus, 'failed') }}</el-tag>
                  <el-tag size="small" type="warning" effect="plain">超时 {{ pickCount(snap.runsByStatus, 'timeout') }}</el-tag>
                  <el-tag size="small" type="info" effect="plain">终止 {{ pickCount(snap.runsByStatus, 'killed') }}</el-tag>
                  <el-tag size="small" type="warning" effect="plain">运行中 {{ pickCount(snap.runsByStatus, 'running') }}</el-tag>
                </span>
              </div>
              <p class="hintLine">{{ failureRateText(snap.runsByStatus) }}</p>
            </template>
            <div v-else class="hint">加载中…</div>
          </el-card>
        </el-col>

        <el-col :xs="24" :sm="24" :md="8" class="cardCol">
          <el-card shadow="never" class="card cardTall">
            <template #header>
              <div class="paneSectionHdr">
                <span>最近 10 次运行</span>
                <el-button size="small" plain class="hdrActionBtn" @click="router.push('/logs')">打开日志</el-button>
              </div>
            </template>
            <template v-if="snap && snap.recentRuns.length">
              <el-table :data="snap.recentRuns" size="small" class="miniTable" :show-header="true">
                <el-table-column prop="taskName" label="任务" min-width="100" show-overflow-tooltip />
                <el-table-column label="时间" width="155">
                  <template #default="{ row }">{{ new Date(row.startedAt).toLocaleString() }}</template>
                </el-table-column>
                <el-table-column label="状态" width="78" align="center">
                  <template #default="{ row }">
                    <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="耗时" width="86" align="right">
                  <template #default="{ row }">
                    <span v-if="row.durationMs != null">{{ row.durationMs }} ms</span>
                    <span v-else class="muted">-</span>
                  </template>
                </el-table-column>
              </el-table>
            </template>
            <div v-else-if="snap" class="hint">暂无运行记录。可在「任务」中创建并执行。</div>
            <div v-else class="hint">加载中…</div>
          </el-card>
        </el-col>
      </el-row>

      <el-card shadow="never" class="nextCard">
        <template #header>
          <div class="cardHead">
            <span>预计下次触发（Cron 调度器）</span>
            <span class="sub">仅统计已启用且表达式有效的 Cron 任务。</span>
          </div>
        </template>
        <template v-if="snap && snap.nextSchedules.length">
          <el-table :data="snap.nextSchedules" size="default" class="nextTable">
            <el-table-column prop="taskName" label="任务" min-width="160" show-overflow-tooltip />
            <el-table-column label="预计时间" min-width="200">
              <template #default="{ row }">{{ new Date(row.nextAt).toLocaleString() }}</template>
            </el-table-column>
          </el-table>
        </template>
        <div v-else-if="snap" class="hint">
          暂无调度中的下次时间。请确认至少有一个任务已启用、计划类型为 Cron，且表达式可被解析。
        </div>
        <div v-else class="hint">加载中…</div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: 1180px;
}
.body {
  min-height: 120px;
}
.cardsRow {
  align-items: stretch;
}
.cardCol {
  display: flex;
  margin-bottom: 14px;
}
.card {
  width: 100%;
}
.cardTall {
  min-height: 280px;
}
.paneSectionHdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  font-weight: inherit;
}
/** 卡片标题区按钮去掉主色投影光晕（仍保留 plain 边框样式） */
.paneSectionHdr :deep(.hdrActionBtn.el-button) {
  box-shadow: none;
}
.paneSectionHdr :deep(.hdrActionBtn.el-button:hover),
.paneSectionHdr :deep(.hdrActionBtn.el-button:focus-visible) {
  box-shadow: none;
}
.cardHead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  width: 100%;
}
.sub {
  font-size: 12px;
  font-weight: 400;
  color: var(--app-text-muted);
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.cardConn :deep(.el-card__body) {
  padding-top: 12px;
}
.connBand {
  border-radius: 12px;
  padding: 12px;
  border: 1px solid rgba(5, 5, 5, 0.06);
  background: rgba(0, 0, 0, 0.02);
  transition:
    border-color 0.2s,
    background 0.2s;
}
.connBandOk {
  background: rgba(103, 194, 58, 0.1);
  border-color: rgba(103, 194, 58, 0.28);
}
.connBandFail {
  background: rgba(245, 108, 108, 0.08);
  border-color: rgba(245, 108, 108, 0.28);
}
.connMain {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.connIconWrap {
  flex-shrink: 0;
  padding-top: 2px;
}
.connIcon {
  font-size: 28px;
}
.connIconMuted {
  opacity: 0.42;
}
.spinning {
  animation: connSpin 0.9s linear infinite;
}
@keyframes connSpin {
  to {
    transform: rotate(360deg);
  }
}
.connCopy {
  flex: 1;
  min-width: 0;
}
.connTitleRow {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.connTitle {
  font-weight: 650;
  font-size: 15px;
}
.connSub {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--app-text-muted);
}
.connSubWarn {
  color: rgba(0, 0, 0, 0.7);
}
.connMeta {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}
.connActions {
  flex-shrink: 0;
  align-self: center;
}
@media (max-width: 560px) {
  .connMain {
    flex-wrap: wrap;
  }
  .connActions {
    width: 100%;
    display: flex;
    justify-content: flex-end;
  }
}
.statLine {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 13px;
  line-height: 1.45;
}
.statLine .label {
  flex: 0 0 4.5em;
  color: var(--app-text-muted);
}
.statLine .value {
  flex: 1;
  min-width: 0;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.hintLine {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--app-text-muted);
}
.hint {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 1.55;
}
.miniTable {
  width: 100%;
}
.miniTable :deep(.el-table__cell) {
  padding: 6px 0;
}
.muted {
  color: rgba(0, 0, 0, 0.35);
}
.nextCard {
  margin-bottom: 14px;
}
.nextTable {
  width: 100%;
}
</style>
