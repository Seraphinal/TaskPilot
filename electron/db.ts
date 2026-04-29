import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import initSqlJs from 'sql.js'

type DbState = {
  SQL: any
  db: any
  dbFilePath: string
}

let state: DbState | null = null

async function loadFileIfExists(filePath: string): Promise<Uint8Array | null> {
  try {
    const buf = await fs.readFile(filePath)
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  } catch {
    return null
  }
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

function migrate(db: any) {
  db.exec(`
    PRAGMA journal_mode=MEMORY;
    PRAGMA foreign_keys=ON;

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      pythonPath TEXT NOT NULL,
      scriptPath TEXT NOT NULL,
      argsJson TEXT NOT NULL,
      cwd TEXT NOT NULL,
      scheduleType TEXT NOT NULL,
      scheduleExpr TEXT NOT NULL,
      timeoutMs INTEGER NOT NULL,
      concurrencyPolicy TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL,
      startedAt INTEGER NOT NULL,
      endedAt INTEGER,
      exitCode INTEGER,
      status TEXT NOT NULL,
      stdoutPath TEXT NOT NULL,
      stderrPath TEXT NOT NULL,
      FOREIGN KEY(taskId) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_runs_taskId_startedAt ON runs(taskId, startedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_runs_startedAt ON runs(startedAt DESC);
  `)
}

export async function initDb() {
  if (state) return state

  const userData = app.getPath('userData')
  const dataDir = path.join(userData, 'data')
  await ensureDir(dataDir)

  const dbFilePath = path.join(dataDir, 'app.sqlite')
  const wasmPath = app.isPackaged
    ? path.join(process.resourcesPath, 'sql-wasm.wasm')
    : path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')

  const SQL = await initSqlJs({
    locateFile: (file: string) => (file === 'sql-wasm.wasm' ? wasmPath : file),
  })

  const fileData = await loadFileIfExists(dbFilePath)
  const db = fileData ? new SQL.Database(fileData) : new SQL.Database()
  migrate(db)

  state = { SQL, db, dbFilePath }
  await flushDb()
  return state
}

export async function flushDb() {
  if (!state) return
  const data = state.db.export()
  await fs.writeFile(state.dbFilePath, Buffer.from(data))
}

export function getDbOrThrow(): any {
  if (!state) throw new Error('DB not initialized. Call initDb() first.')
  return state.db
}

