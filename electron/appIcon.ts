import { app, nativeImage, type NativeImage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

let cached: NativeImage | null = null

export function getAppIcon(): NativeImage {
  if (cached) return cached
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.png')
    : path.join(process.cwd(), 'assets', 'generated', 'app.png')

  try {
    const buf = fs.readFileSync(iconPath)
    cached = nativeImage.createFromBuffer(buf)
  } catch {
    cached = nativeImage.createEmpty()
  }
  return cached
}

