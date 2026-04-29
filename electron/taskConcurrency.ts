import type { Task } from '../src/shared/types'
import { getTaskById } from './repo'

/** 仅调度触发使用：同一时间多次触发但未结束时，skip / queue / parallel 行为不同。 */
export function dispatchScheduledRun(snapshot: Task, run: (task: Task) => Promise<unknown>): void {
  void dispatchScheduledRunAsync(snapshot, run)
}

async function dispatchScheduledRunAsync(snapshot: Task, run: (task: Task) => Promise<unknown>): Promise<void> {
  const task = await getTaskById(snapshot.id)
  if (!task?.enabled) return

  const policy = task.concurrencyPolicy ?? 'skip'

  if (policy === 'parallel') {
    await runSafely(run, task)
    return
  }

  if (policy === 'skip') {
    if (busySkip.has(task.id)) return
    busySkip.add(task.id)
    try {
      await runSafely(run, task)
    } finally {
      busySkip.delete(task.id)
    }
    return
  }

  // queue
  if (!busyQueue.has(task.id)) {
    busyQueue.add(task.id)
    try {
      await drainQueue(run, task.id)
    } finally {
      busyQueue.delete(task.id)
    }
  } else {
    queuedCount.set(task.id, (queuedCount.get(task.id) ?? 0) + 1)
  }
}

const busySkip = new Set<string>()
const busyQueue = new Set<string>()
const queuedCount = new Map<string, number>()

async function drainQueue(run: (task: Task) => Promise<unknown>, taskId: string): Promise<void> {
  for (;;) {
    const task = await getTaskById(taskId)
    if (!task?.enabled) {
      queuedCount.delete(taskId)
      return
    }
    await runSafely(run, task)
    const left = queuedCount.get(taskId) ?? 0
    if (left <= 0) {
      queuedCount.delete(taskId)
      return
    }
    queuedCount.set(taskId, left - 1)
  }
}

async function runSafely(run: (task: Task) => Promise<unknown>, task: Task): Promise<void> {
  try {
    await run(task)
  } catch {
    // eslint-disable-next-line no-console
    console.error('scheduled run failed', task.id)
  }
}
