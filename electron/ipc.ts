import { app, ipcMain } from 'electron'
import type { DashboardSnapshot, Task } from '../src/shared/types'
import {
  countRunsByStatus,
  countRunsFiltered,
  countRunsTotal,
  deleteAllRuns,
  deleteAllRunsForTask,
  listRunsFilteredPage,
  listRunsRecent,
  listTasks,
  upsertTask,
} from './repo'
import { previewCron5 } from './scheduler'
import { getNextRuns, reloadSchedulerFromDb } from './schedulerCore'
import { runTask } from './pythonRunner'
import fs from 'node:fs/promises'
import path from 'node:path'
import { loadSettings, saveSettings } from './settings'
import { dialog, BrowserWindow } from 'electron'

export function registerIpc() {
  ipcMain.handle('tasks:list', async () => listTasks())

  ipcMain.handle('dashboard:snapshot', async (): Promise<DashboardSnapshot> => {
    const taskRows = await listTasks()
    const enabled = taskRows.filter((x) => x.enabled).length
    const nameById = new Map(taskRows.map((t) => [t.id, t.name] as const))

    const [runsByStatus, runsTotal, recentRaw] = await Promise.all([
      countRunsByStatus(),
      countRunsTotal(),
      listRunsRecent(10),
    ])

    const recentRuns = recentRaw.map((r) => ({
      ...r,
      taskName: nameById.get(r.taskId) ?? '（任务已删除）',
      durationMs: r.endedAt == null ? null : Math.max(0, r.endedAt - r.startedAt),
    }))

    const nextSchedules = getNextRuns()
      .slice()
      .sort((a, b) => a.nextAt - b.nextAt)
      .slice(0, 20)
      .map(({ taskId, nextAt }) => ({
        taskId,
        taskName: nameById.get(taskId) ?? `${taskId.slice(0, 8)}…`,
        nextAt,
      }))

    return {
      tasks: { total: taskRows.length, enabled, disabled: taskRows.length - enabled },
      runsByStatus,
      runsTotal,
      recentRuns,
      nextSchedules,
    }
  })

  ipcMain.handle('tasks:upsert', async (_evt, task: Partial<Task>) => {
    const filled = fillTaskDefaults(task)
    const id = await upsertTask(filled)
    await reloadSchedulerFromDb()
    return { id }
  })

  ipcMain.handle('tasks:runNow', async (_evt, taskId: string) => {
    const tasks = await listTasks()
    const t = tasks.find((x) => x.id === taskId)
    if (!t) throw new Error('task not found')
    const r = await runTask(t)
    return r
  })

  ipcMain.handle(
    'runs:listPaged',
    async (
      _evt,
      taskId: string,
      page: number,
      pageSize: number,
      startedAtMin?: number | null,
      startedAtMax?: number | null,
    ) => {
      const tidRaw = typeof taskId === 'string' ? taskId.trim() : ''
      const allTasks = tidRaw === '' || /^__all__$/i.test(tidRaw)
      const filter = {
        taskId: allTasks ? undefined : tidRaw || undefined,
        startedAtMin: toOptionalFloorMs(startedAtMin),
        startedAtMax: toOptionalFloorMs(startedAtMax),
      }
      const total = await countRunsFiltered(filter)
      const rows = await listRunsFilteredPage(filter, page, pageSize)
      return { total, rows }
    },
  )

  ipcMain.handle('runs:clearForTask', async (_evt, taskId: string) => {
    if (!taskId) throw new Error('task id required')
    const userData = app.getPath('userData')
    const logsDir = path.join(userData, 'logs', taskId)
    await fs.rm(logsDir, { recursive: true, force: true })
    await deleteAllRunsForTask(taskId)
    return { ok: true }
  })

  ipcMain.handle('runs:clearAll', async () => {
    const userData = app.getPath('userData')
    const logsRoot = path.join(userData, 'logs')
    await fs.rm(logsRoot, { recursive: true, force: true })
    await deleteAllRuns()
    return { ok: true }
  })

  ipcMain.handle('cron:preview', async (_evt, expr: string, n?: number) => previewCron5(expr, n ?? 5))

  ipcMain.handle('logs:readText', async (_evt, filePath: string, maxBytes?: number) => {
    const userData = app.getPath('userData')
    const logsRoot = path.join(userData, 'logs')
    const resolved = path.resolve(filePath)
    if (!resolved.startsWith(path.resolve(logsRoot))) throw new Error('invalid log path')
    const buf = await fs.readFile(resolved)
    const limited = buf.subarray(0, Math.max(1, Math.min(1024 * 1024, maxBytes ?? 200_000)))
    return limited.toString('utf-8')
  })

  ipcMain.handle('settings:get', async () => loadSettings())
  ipcMain.handle('settings:set', async (_evt, next: any) => {
    const s = await saveSettings(next)
    try {
      app.setLoginItemSettings({ openAtLogin: !!s.openAtLogin })
    } catch {
      // ignore
    }
    return s
  })

  ipcMain.handle(
    'dialog:open',
    async (
      _evt,
      opts: {
        title?: string
        properties: Array<'openFile' | 'openDirectory'>
        filters?: Array<{ name: string; extensions: string[] }>
      },
    ) => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const res = await dialog.showOpenDialog(win, {
        title: opts.title,
        properties: opts.properties,
        filters: opts.filters,
      })
      return { canceled: res.canceled, filePaths: res.filePaths }
    },
  )
}

function toOptionalFloorMs(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.floor(n) : null
}

function fillTaskDefaults(task: Partial<Task>) {
  return {
    id: task.id,
    name: task.name ?? '未命名任务',
    enabled: task.enabled ?? true,
    pythonPath: task.pythonPath ?? 'python',
    scriptPath: task.scriptPath ?? '',
    argsJson: task.argsJson ?? '[]',
    cwd: task.cwd ?? '',
    scheduleType: task.scheduleType ?? 'cron',
    scheduleExpr: task.scheduleExpr ?? '* * * * *',
    timeoutMs: task.timeoutMs ?? 0,
    concurrencyPolicy: task.concurrencyPolicy ?? 'skip',
  }
}

