import { app } from 'electron'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import type { Task } from '../src/shared/types'
import { createRun, finishRun } from './repo'

type RunResult = {
  runId: string
  status: 'success' | 'failed' | 'timeout' | 'killed'
  exitCode: number | null
  startedAt: number
  endedAt: number
  stdoutPath: string
  stderrPath: string
}

async function ensureDir(dir: string) {
  await fsp.mkdir(dir, { recursive: true })
}

async function killProcessTree(pid: number) {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/t', '/f'], { windowsHide: true })
    return
  }
  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    // ignore
  }
}

export async function runTask(task: Task): Promise<RunResult> {
  const startedAt = Date.now()
  const userData = app.getPath('userData')
  const logDir = path.join(userData, 'logs', task.id)
  await ensureDir(logDir)

  const runStamp = new Date(startedAt).toISOString().replace(/[:.]/g, '-')
  const stdoutPath = path.join(logDir, `${runStamp}.out.log`)
  const stderrPath = path.join(logDir, `${runStamp}.err.log`)

  const runId = await createRun({
    taskId: task.id,
    startedAt,
    stdoutPath,
    stderrPath,
  })

  const out = fs.createWriteStream(stdoutPath, { flags: 'a' })
  const err = fs.createWriteStream(stderrPath, { flags: 'a' })

  const child = spawn(task.pythonPath, [task.scriptPath, ...safeParseArgs(task.argsJson)], {
    cwd: task.cwd || undefined,
    windowsHide: true,
    env: { ...process.env },
  })

  child.stdout?.pipe(out)
  child.stderr?.pipe(err)

  let finished = false
  let timeoutHandle: NodeJS.Timeout | null = null

  const timeoutMs = Math.max(0, Number(task.timeoutMs || 0))
  if (timeoutMs > 0) {
    timeoutHandle = setTimeout(() => {
      if (finished) return
      killProcessTree(child.pid ?? -1)
    }, timeoutMs)
  }

  const result: RunResult = await new Promise((resolve) => {
    const done = async (status: RunResult['status'], exitCode: number | null) => {
      if (finished) return
      finished = true
      if (timeoutHandle) clearTimeout(timeoutHandle)
      out.end()
      err.end()

      const endedAt = Date.now()
      await finishRun({
        id: runId,
        endedAt,
        exitCode,
        status,
      })
      resolve({ runId, status, exitCode, startedAt, endedAt, stdoutPath, stderrPath })
    }

    child.on('error', () => done('failed', null))
    child.on('exit', (code, signal) => {
      if (signal) return done('killed', code ?? null)
      if (timeoutMs > 0 && Date.now() - startedAt >= timeoutMs) return done('timeout', code ?? null)
      return done(code === 0 ? 'success' : 'failed', code ?? null)
    })
  })

  return result
}

function safeParseArgs(argsJson: string): string[] {
  try {
    const v = JSON.parse(argsJson || '[]')
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v
    return []
  } catch {
    return []
  }
}

