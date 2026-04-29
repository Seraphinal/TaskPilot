import { app, BrowserWindow, Menu } from 'electron'
import path from 'node:path'
import { initDb } from './db'
import { reloadSchedulerFromDb, setSchedulerHandler } from './schedulerCore'
import { runTask } from './pythonRunner'
import { dispatchScheduledRun } from './taskConcurrency'
import { registerIpc } from './ipc'
import { initTray } from './tray'
import { loadSettings } from './settings'
import { getAppIcon } from './appIcon'

// Reduce Windows cache permission noise in dev.
try {
  const base = app.getPath('userData')
  app.setPath('sessionData', path.join(base, 'session'))
  app.setPath('cache', path.join(base, 'cache'))
  app.commandLine.appendSwitch('disk-cache-dir', path.join(base, 'cache'))
  app.commandLine.appendSwitch('gpu-disk-cache-dir', path.join(base, 'gpu-cache'))
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
} catch {
  // ignore
}

async function applyAutoStartSetting() {
  const s = await loadSettings()
  try {
    app.setLoginItemSettings({ openAtLogin: !!s.openAtLogin })
  } catch {
    // ignore
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Use same app icon for window and tray.
  try {
    win.setIcon(getAppIcon())
  } catch {
    // ignore
  }

  // Hide native menu bar (File/Edit/View/Window/Help) on Windows/Linux.
  win.setMenuBarVisibility(false)
  win.setAutoHideMenuBar(true)

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    win.loadURL(devUrl)
    if (process.env.OPEN_DEVTOOLS === '1') {
      win.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    // In packaged apps, cwd may be the install directory; resolve relative to dist-electron.
    const indexHtml = app.isPackaged
      ? path.join(__dirname, '..', 'dist-renderer', 'index.html')
      : path.join(process.cwd(), 'dist-renderer', 'index.html')
    win.loadFile(indexHtml)
  }

  return win
}

app.whenReady().then(() => {
  // Helps Windows use the correct taskbar icon (paired with build.win.icon).
  try {
    app.setAppUserModelId('com.taskscheduler.console')
  } catch {
    // ignore
  }

  // Ensure app menu is removed as well.
  Menu.setApplicationMenu(null)

  registerIpc()
  applyAutoStartSetting().catch(() => {})

  setSchedulerHandler((task) => {
    dispatchScheduledRun(task, runTask)
  })
  initDb()
    .then(() => reloadSchedulerFromDb())
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('init failed', err)
    })

  const win = createWindow()
  initTray(win).catch(() => {})

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

