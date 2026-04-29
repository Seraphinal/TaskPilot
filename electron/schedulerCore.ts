import { CronExpressionParser } from 'cron-parser'
import type { Task } from '../src/shared/types'
import { listEnabledTasks } from './repo'
import { toNodeCronSixFields } from './scheduler'

/** 仅用 cron-parser（与界面预览同源），定时轮询，避免 cron/luxon 被打进 Electron 主进程 bundle 后与真实 node_modules 行为不一致的问题。 */

let scheduledRun: ((task: Task) => void) | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

/** taskId → 下一次应触发时间（毫秒） */
const nextDueAt = new Map<string, number>()

const POLL_MS = 5000
const SAFETY_GUARD = 500

function getNextFireAfterMs(scheduleExpr: string, afterMs: number): number | null {
  try {
    const normalized = toNodeCronSixFields(scheduleExpr)
    const it = CronExpressionParser.parse(normalized, { currentDate: new Date(afterMs) })
    return it.next().toDate().getTime()
  } catch {
    return null
  }
}

export function setSchedulerHandler(handler: (task: Task) => void) {
  scheduledRun = handler
}

async function pollTick() {
  if (!scheduledRun) return

  const tasks = await listEnabledTasks()
  const now = Date.now()

  const seenIds = new Set<string>()

  for (const t of tasks) {
    if (!t.enabled || t.scheduleType !== 'cron') continue
    seenIds.add(t.id)

    let due = nextDueAt.get(t.id)
    if (due === undefined) {
      const first = getNextFireAfterMs(t.scheduleExpr, now - SAFETY_GUARD)
      if (first === null) {
        // eslint-disable-next-line no-console
        console.warn('[scheduler] invalid cron, skip task:', t.id, t.scheduleExpr)
        continue
      }
      nextDueAt.set(t.id, first)
      due = first
    }

    // 补跑：睡眠/暂停后可能积压多次「应触发」时刻
    let guard = 0
    while (due <= now && guard < 64) {
      guard++
      scheduledRun(t)
      const next = getNextFireAfterMs(t.scheduleExpr, due)
      if (next === null) {
        nextDueAt.delete(t.id)
        break
      }
      if (next <= due) {
        // eslint-disable-next-line no-console
        console.error('[scheduler] next not advancing, backoff +60s', t.id, t.scheduleExpr)
        nextDueAt.set(t.id, due + 60_000)
        break
      }
      nextDueAt.set(t.id, next)
      due = next
    }
  }

  // 已删除或停用的任务从内存表移除
  for (const id of nextDueAt.keys()) {
    if (!seenIds.has(id)) nextDueAt.delete(id)
  }
}

export async function reloadSchedulerFromDb() {
  if (!scheduledRun) return
  await stopScheduler()
  nextDueAt.clear()

  pollTimer = setInterval(() => {
    void pollTick().catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[scheduler] pollTick', e)
    })
  }, POLL_MS)

  await pollTick()
}

export async function startScheduler(onDue: (task: Task) => void) {
  setSchedulerHandler(onDue)
  await reloadSchedulerFromDb()
}

export async function stopScheduler() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  nextDueAt.clear()
}

export function getNextRuns() {
  return [...nextDueAt.entries()].map(([taskId, nextAt]) => ({ taskId, nextAt }))
}
