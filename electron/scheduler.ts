import { CronExpressionParser } from 'cron-parser'

/**
 * UI 与 cron-parser 使用标准 5 段 crontab（分 时 日 月 周）。
 * `cron` npm 包使用 6 段（秒 分 时…）；缺省秒为 0，与 Unix 行为一致。
 */
export function toNodeCronSixFields(exprRaw: string): string {
  const expr = exprRaw.trim().replace(/\s+/g, ' ')
  if (!expr) throw new Error('Cron 表达式为空')
  const parts = expr.split(' ')
  if (parts.length === 5) return `0 ${expr}`
  if (parts.length === 6) return expr
  throw new Error(`Cron 表达式需为 5 段（Unix）或含秒的 6 段，当前 ${parts.length} 段`)
}

export type CronPreview = {
  ok: boolean
  error?: string
  next?: number
  nextN?: number[]
}

export function previewCron5(expr: string, n = 5, baseDate = new Date()): CronPreview {
  try {
    const normalized = toNodeCronSixFields(expr)
    const it = CronExpressionParser.parse(normalized, { currentDate: baseDate })
    const nextN: number[] = []
    for (let i = 0; i < n; i++) nextN.push(it.next().toDate().getTime())
    return { ok: true, next: nextN[0], nextN }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}

