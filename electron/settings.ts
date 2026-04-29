import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

export type AppSettings = {
  openAtLogin: boolean
  minimizeToTray: boolean
}

const defaultSettings: AppSettings = {
  openAtLogin: true,
  minimizeToTray: true,
}

let cache: AppSettings | null = null

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

export async function loadSettings(): Promise<AppSettings> {
  if (cache) return cache
  try {
    const raw = await fs.readFile(settingsPath(), 'utf-8')
    const parsed = JSON.parse(raw)
    cache = { ...defaultSettings, ...parsed }
    return cache!
  } catch {
    cache = { ...defaultSettings }
    return cache!
  }
}

export async function saveSettings(next: Partial<AppSettings>): Promise<AppSettings> {
  const cur = await loadSettings()
  cache = { ...cur, ...next }
  await fs.writeFile(settingsPath(), JSON.stringify(cache, null, 2), 'utf-8')
  return cache!
}

export function getSettingsSnapshot(): AppSettings {
  return cache ?? { ...defaultSettings }
}

