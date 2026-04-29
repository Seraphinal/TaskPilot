import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'
import { Resvg, initWasm } from '@resvg/resvg-wasm'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const root = path.resolve(__dirname, '..')
const svgPath = path.join(root, 'assets', 'app-icon.svg')
const outDir = path.join(root, 'assets', 'generated')

const sizes = [16, 32, 48, 256]

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true })
}

async function renderPng(svg, size) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: false },
  })
  const pngData = r.render().asPng()
  return Buffer.from(pngData)
}

async function main() {
  await ensureDir(outDir)
  const svg = await fs.readFile(svgPath, 'utf-8')
  const wasmPath = path.join(root, 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm')
  const wasmBytes = await fs.readFile(wasmPath)
  await initWasm(wasmBytes)

  const pngPaths = []
  for (const s of sizes) {
    const png = await renderPng(svg, s)
    const p = path.join(outDir, `app-icon-${s}.png`)
    await fs.writeFile(p, png)
    pngPaths.push(p)
  }

  // Use multiple PNGs to generate a multi-size .ico
  const icoBuf = await pngToIco(pngPaths)
  await fs.writeFile(path.join(outDir, 'app.ico'), icoBuf)

  // Convenience: main PNG for runtime use
  await fs.copyFile(path.join(outDir, 'app-icon-256.png'), path.join(outDir, 'app.png'))

  console.log('[gen-icons] ok:', outDir)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

