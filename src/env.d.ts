/// <reference types="vite/client" />

declare global {
  interface Window {
    api: {
      ping: () => Promise<string>
      getDashboardSnapshot: () => Promise<import('./shared/types').DashboardSnapshot>
      listTasks: () => Promise<any[]>
      upsertTask: (task: any) => Promise<{ id: string }>
      runNow: (taskId: string) => Promise<any>
      listRunsPaged: (
        taskId: string,
        page: number,
        pageSize: number,
        startedAtMin?: number | null,
        startedAtMax?: number | null,
      ) => Promise<{ total: number; rows: any[] }>
      clearRunsForTask: (taskId: string) => Promise<{ ok: boolean }>
      clearAllRuns: () => Promise<{ ok: boolean }>
      previewCron: (
        expr: string,
        n?: number,
      ) => Promise<{ ok: boolean; error?: string; next?: number; nextN?: number[] }>
      readLogText: (filePath: string, maxBytes?: number) => Promise<string>
      getSettings: () => Promise<{ openAtLogin: boolean; minimizeToTray: boolean }>
      setSettings: (
        next: Partial<{ openAtLogin: boolean; minimizeToTray: boolean }>,
      ) => Promise<{ openAtLogin: boolean; minimizeToTray: boolean }>
      pickFile: (opts: { title?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>
      pickDirectory: (opts: { title?: string }) => Promise<string | null>
    }
  }
}

export {}

