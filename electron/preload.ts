import { contextBridge, ipcRenderer } from 'electron'
import type { DashboardSnapshot, Task, Run } from '../src/shared/types'

export type Api = {
  ping: () => Promise<string>
  getDashboardSnapshot: () => Promise<DashboardSnapshot>
  listTasks: () => Promise<Task[]>
  upsertTask: (task: Partial<Task>) => Promise<{ id: string }>
  runNow: (taskId: string) => Promise<any>
  listRunsPaged: (
    taskId: string,
    page: number,
    pageSize: number,
    startedAtMin?: number | null,
    startedAtMax?: number | null,
  ) => Promise<{ total: number; rows: Run[] }>
  clearRunsForTask: (taskId: string) => Promise<{ ok: boolean }>
  clearAllRuns: () => Promise<{ ok: boolean }>
  previewCron: (expr: string, n?: number) => Promise<{ ok: boolean; error?: string; next?: number; nextN?: number[] }>
  readLogText: (filePath: string, maxBytes?: number) => Promise<string>
  getSettings: () => Promise<{ openAtLogin: boolean; minimizeToTray: boolean }>
  setSettings: (next: Partial<{ openAtLogin: boolean; minimizeToTray: boolean }>) => Promise<{
    openAtLogin: boolean
    minimizeToTray: boolean
  }>
  pickFile: (opts: { title?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>
  pickDirectory: (opts: { title?: string }) => Promise<string | null>
}

const api: Api = {
  ping: async () => 'pong',
  getDashboardSnapshot: () => ipcRenderer.invoke('dashboard:snapshot'),
  listTasks: () => ipcRenderer.invoke('tasks:list'),
  upsertTask: (task) => ipcRenderer.invoke('tasks:upsert', task),
  runNow: (taskId) => ipcRenderer.invoke('tasks:runNow', taskId),
  listRunsPaged: (taskId, page, pageSize, startedAtMin, startedAtMax) =>
    ipcRenderer.invoke('runs:listPaged', taskId, page, pageSize, startedAtMin ?? null, startedAtMax ?? null),
  clearRunsForTask: (taskId) => ipcRenderer.invoke('runs:clearForTask', taskId),
  clearAllRuns: () => ipcRenderer.invoke('runs:clearAll'),
  previewCron: (expr, n) => ipcRenderer.invoke('cron:preview', expr, n),
  readLogText: (filePath, maxBytes) => ipcRenderer.invoke('logs:readText', filePath, maxBytes),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (next) => ipcRenderer.invoke('settings:set', next),
  pickFile: async (opts) => {
    const res = await ipcRenderer.invoke('dialog:open', { ...opts, properties: ['openFile'] })
    if (res?.canceled) return null
    return res?.filePaths?.[0] ?? null
  },
  pickDirectory: async (opts) => {
    const res = await ipcRenderer.invoke('dialog:open', { ...opts, properties: ['openDirectory'] })
    if (res?.canceled) return null
    return res?.filePaths?.[0] ?? null
  },
}

contextBridge.exposeInMainWorld('api', api)

