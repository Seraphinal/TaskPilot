import { app, BrowserWindow, Menu, Tray } from 'electron'
import { getSettingsSnapshot, loadSettings } from './settings'
import { getAppIcon } from './appIcon'

let tray: Tray | null = null
let allowQuit = false

export async function initTray(win: BrowserWindow) {
  if (tray) return tray

  tray = new Tray(getAppIcon())
  tray.setToolTip('任务调度台')

  const menu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        win.show()
        win.focus()
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        allowQuit = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(menu)

  tray.on('double-click', () => {
    win.show()
    win.focus()
  })

  await loadSettings()
  win.on('close', (e) => {
    if (allowQuit) return
    if (!getSettingsSnapshot().minimizeToTray) return
    e.preventDefault()
    win.hide()
  })

  return tray
}

export function isQuitAllowed() {
  return allowQuit
}

