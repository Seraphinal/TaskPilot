import crypto from 'node:crypto'
import { getDbOrThrow, flushDb } from './db'
import type { Run, RunStatus, Task } from '../src/shared/types'

function now() {
  return Date.now()
}

function toInt(b: boolean) {
  return b ? 1 : 0
}

function fromInt(i: any) {
  return Number(i) === 1
}

function oneRowToTask(row: any): Task {
  return {
    id: String(row.id),
    name: String(row.name),
    enabled: fromInt(row.enabled),
    pythonPath: String(row.pythonPath),
    scriptPath: String(row.scriptPath),
    argsJson: String(row.argsJson),
    cwd: String(row.cwd),
    scheduleType: row.scheduleType,
    scheduleExpr: String(row.scheduleExpr),
    timeoutMs: Number(row.timeoutMs),
    concurrencyPolicy: row.concurrencyPolicy,
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
  }
}

function all(sql: string, params: any[] = []): any[] {
  const db = getDbOrThrow()
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows: any[] = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function run(sql: string, params: any[] = []) {
  const db = getDbOrThrow()
  const stmt = db.prepare(sql)
  stmt.run(params)
  stmt.free()
}

export async function listEnabledTasks(): Promise<Task[]> {
  const rows = all('SELECT * FROM tasks WHERE enabled = 1 ORDER BY updatedAt DESC')
  return rows.map(oneRowToTask)
}

export async function listTasks(): Promise<Task[]> {
  const rows = all('SELECT * FROM tasks ORDER BY updatedAt DESC')
  return rows.map(oneRowToTask)
}

export async function getTaskById(id: string): Promise<Task | null> {
  const rows = all('SELECT * FROM tasks WHERE id = ? LIMIT 1', [id])
  return rows.length ? oneRowToTask(rows[0]) : null
}

export async function upsertTask(input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
  const t = now()
  const id = input.id ?? crypto.randomUUID()

  const existing = all('SELECT id FROM tasks WHERE id = ?', [id])
  if (existing.length === 0) {
    run(
      `INSERT INTO tasks (
        id,name,enabled,pythonPath,scriptPath,argsJson,cwd,
        scheduleType,scheduleExpr,timeoutMs,concurrencyPolicy,createdAt,updatedAt
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        input.name,
        toInt(input.enabled),
        input.pythonPath,
        input.scriptPath,
        input.argsJson,
        input.cwd,
        input.scheduleType,
        input.scheduleExpr,
        input.timeoutMs,
        input.concurrencyPolicy,
        t,
        t,
      ],
    )
  } else {
    run(
      `UPDATE tasks SET
        name=?, enabled=?, pythonPath=?, scriptPath=?, argsJson=?, cwd=?,
        scheduleType=?, scheduleExpr=?, timeoutMs=?, concurrencyPolicy=?, updatedAt=?
      WHERE id=?`,
      [
        input.name,
        toInt(input.enabled),
        input.pythonPath,
        input.scriptPath,
        input.argsJson,
        input.cwd,
        input.scheduleType,
        input.scheduleExpr,
        input.timeoutMs,
        input.concurrencyPolicy,
        t,
        id,
      ],
    )
  }

  await flushDb()
  return id
}

export async function createRun(input: Omit<Run, 'id' | 'endedAt' | 'exitCode' | 'status'> & { status?: RunStatus }) {
  const id = crypto.randomUUID()
  run(
    `INSERT INTO runs (
      id, taskId, startedAt, endedAt, exitCode, status, stdoutPath, stderrPath
    ) VALUES (?,?,?,?,?,?,?,?)`,
    [
      id,
      input.taskId,
      input.startedAt,
      null,
      null,
      input.status ?? 'running',
      input.stdoutPath,
      input.stderrPath,
    ],
  )
  await flushDb()
  return id
}

export async function finishRun(params: {
  id: string
  endedAt: number
  exitCode: number | null
  status: RunStatus
}) {
  run(`UPDATE runs SET endedAt=?, exitCode=?, status=? WHERE id=?`, [
    params.endedAt,
    params.exitCode,
    params.status,
    params.id,
  ])
  await flushDb()
}

function rowToRun(r: any): Run {
  return {
    id: String(r.id),
    taskId: String(r.taskId),
    startedAt: Number(r.startedAt),
    endedAt: r.endedAt == null ? null : Number(r.endedAt),
    exitCode: r.exitCode == null ? null : Number(r.exitCode),
    status: r.status,
    stdoutPath: String(r.stdoutPath),
    stderrPath: String(r.stderrPath),
  }
}

export async function listRunsByTask(taskId: string, limit = 50): Promise<Run[]> {
  const rows = all(
    'SELECT * FROM runs WHERE taskId = ? ORDER BY startedAt DESC LIMIT ?',
    [taskId, Math.max(1, Math.min(500, limit))],
  )
  return rows.map(rowToRun)
}

/** 全局按开始时间倒序的最近 N 条运行（概览用） */
export async function listRunsRecent(limit = 10): Promise<Run[]> {
  const n = Math.max(1, Math.min(100, Math.floor(Number(limit) || 10)))
  const rows = all('SELECT * FROM runs ORDER BY startedAt DESC LIMIT ?', [n])
  return rows.map(rowToRun)
}

/** 按 status 聚合条数 */
export async function countRunsByStatus(): Promise<Partial<Record<RunStatus, number>>> {
  const rows = all('SELECT status, COUNT(*) as c FROM runs GROUP BY status')
  const out: Partial<Record<RunStatus, number>> = {}
  for (const row of rows) {
    const k = String(row.status) as RunStatus
    out[k] = Number(row.c)
  }
  return out
}

export async function countRunsTotal(): Promise<number> {
  const rows = all('SELECT COUNT(*) as c FROM runs')
  return Number(rows[0]?.c ?? 0)
}

/** 分页筛选用：taskId 缺省 / null 表示全部任务；时间为毫秒；未传时间则不限 */
export type RunsPageFilter = {
  taskId?: string | null
  startedAtMin?: number | null
  startedAtMax?: number | null
}

function buildRunsWhereSql(f: RunsPageFilter): { sql: string; binds: unknown[] } {
  const parts: string[] = []
  const binds: unknown[] = []
  const tid = typeof f.taskId === 'string' ? f.taskId.trim() : ''
  if (tid) {
    parts.push('taskId = ?')
    binds.push(tid)
  }
  if (f.startedAtMin != null && Number.isFinite(Number(f.startedAtMin))) {
    parts.push('startedAt >= ?')
    binds.push(Math.floor(Number(f.startedAtMin)))
  }
  if (f.startedAtMax != null && Number.isFinite(Number(f.startedAtMax))) {
    parts.push('startedAt <= ?')
    binds.push(Math.floor(Number(f.startedAtMax)))
  }
  if (!parts.length) return { sql: '', binds: [] }
  return { sql: ' WHERE ' + parts.join(' AND '), binds }
}

export async function countRunsFiltered(filter: RunsPageFilter): Promise<number> {
  const { sql, binds } = buildRunsWhereSql(filter)
  const rows = all(`SELECT COUNT(*) as c FROM runs${sql}`, binds as any[])
  return Number(rows[0]?.c ?? 0)
}

/** page 从 1 开始；pageSize 建议 10–500 */
export async function listRunsFilteredPage(
  filter: RunsPageFilter,
  page: number,
  pageSize: number,
): Promise<Run[]> {
  const ps = Math.max(1, Math.min(500, Math.floor(Number(pageSize) || 20)))
  const p = Math.max(1, Math.floor(Number(page) || 1))
  const offset = (p - 1) * ps
  const { sql, binds } = buildRunsWhereSql(filter)
  const rows = all(
    `SELECT * FROM runs${sql} ORDER BY startedAt DESC LIMIT ? OFFSET ?`,
    [...binds, ps, offset] as any[],
  )
  return rows.map(rowToRun)
}

export async function deleteAllRunsForTask(taskId: string) {
  run('DELETE FROM runs WHERE taskId = ?', [taskId])
  await flushDb()
}

export async function deleteAllRuns() {
  run('DELETE FROM runs')
  await flushDb()
}

