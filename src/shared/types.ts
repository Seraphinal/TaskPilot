export type TaskScheduleType = 'daily' | 'weekly' | 'cron'

export type ConcurrencyPolicy = 'skip' | 'queue' | 'parallel'

export type Task = {
  id: string
  name: string
  enabled: boolean
  pythonPath: string
  scriptPath: string
  argsJson: string
  cwd: string
  scheduleType: TaskScheduleType
  scheduleExpr: string
  timeoutMs: number
  concurrencyPolicy: ConcurrencyPolicy
  createdAt: number
  updatedAt: number
}

export type RunStatus = 'running' | 'success' | 'failed' | 'timeout' | 'killed'

export type Run = {
  id: string
  taskId: string
  startedAt: number
  endedAt: number | null
  exitCode: number | null
  status: RunStatus
  stdoutPath: string
  stderrPath: string
}

/** 概览页一次拉取 */
export type DashboardSnapshot = {
  tasks: { total: number; enabled: number; disabled: number }
  /** 各状态条数（无记录的状态可缺省） */
  runsByStatus: Partial<Record<RunStatus, number>>
  runsTotal: number
  /** 最近若干次执行，含任务名称与耗时 ms */
  recentRuns: Array<
    Run & {
      taskName: string
      durationMs: number | null
    }
  >
  /** 调度器中的下次触发（仅已纳入轮询的 Cron 任务；按时间升序） */
  nextSchedules: Array<{ taskId: string; taskName: string; nextAt: number }>
}

