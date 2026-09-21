import { calcAll } from './engine'
import type { Bond, CalcContext } from './types'

/** Границы сценарного свипа: сдвиг траектории от -6.0 до +2.0 п.п., 71 узел. */
export const SWEEP_FROM = -6
export const SWEEP_TO = 2
export const SWEEP_COUNT = 71

export type SweepOptions = { from?: number; to?: number; count?: number }

export type SweepPoint = {
  /** Параллельный сдвиг всей траектории, п.п. */
  shift: number
  /** Доходность годовых по id бумаги, доля. */
  returns: Record<string, number>
}

/** Доходности всех бумаг на сетке параллельных сдвигов траектории. */
export function sweep(
  bonds: readonly Bond[],
  ctx: CalcContext,
  opts: SweepOptions = {},
): SweepPoint[] {
  const from = opts.from ?? SWEEP_FROM
  const to = opts.to ?? SWEEP_TO
  const count = Math.max(2, Math.round(opts.count ?? SWEEP_COUNT))

  const out: SweepPoint[] = []
  for (let i = 0; i < count; i++) {
    const shift = from + ((to - from) * i) / (count - 1)
    const results = calcAll(bonds, { ...ctx, shift })
    const returns: Record<string, number> = {}
    for (const r of results) returns[r.bondId] = r.annualReturn
    out.push({ shift, returns })
  }
  return out
}

function diffAt(p: SweepPoint, aId: string, bId: string): number | null {
  const a = p.returns[aId]
  const b = p.returns[bId]
  if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b)) return null
  return a - b
}

function lerpZero(s0: number, d0: number, s1: number, d1: number): number {
  if (d1 === d0) return s0
  return s0 + ((s1 - s0) * (0 - d0)) / (d1 - d0)
}

/**
 * Все точки безразличия пары бумаг: сдвиги, при которых доходности равны.
 * Смена знака разности уточняется линейной интерполяцией между соседними узлами.
 */
export function crossings(points: readonly SweepPoint[], aId: string, bId: string): number[] {
  const out: number[] = []
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1]!
    const p1 = points[i]!
    const d0 = diffAt(p0, aId, bId)
    const d1 = diffAt(p1, aId, bId)
    if (d0 === null || d1 === null) continue

    if (d0 === 0) {
      if (out[out.length - 1] !== p0.shift) out.push(p0.shift)
      continue
    }
    if (d1 === 0) {
      out.push(p1.shift)
      continue
    }
    if (d0 < 0 !== d1 < 0) out.push(lerpZero(p0.shift, d0, p1.shift, d1))
  }
  return out
}

/** Первая точка безразличия пары, слева направо. null — бумаги не пересекаются на сетке. */
export function findIndifference(
  points: readonly SweepPoint[],
  aId: string,
  bId: string,
): number | null {
  return crossings(points, aId, bId)[0] ?? null
}

/** Кто выигрывает в данном узле свипа. */
export function leaderAt(p: SweepPoint): string | null {
  let bestId: string | null = null
  let best = -Infinity
  for (const [id, r] of Object.entries(p.returns)) {
    if (Number.isFinite(r) && r > best) {
      best = r
      bestId = id
    }
  }
  return bestId
}

export type LeaderChange = {
  /** Сдвиг, при котором победитель меняется, п.п. */
  shift: number
  fromId: string
  toId: string
}

/** Все сдвиги, на которых меняется победитель. Уточнены интерполяцией по паре. */
export function leaderChanges(points: readonly SweepPoint[]): LeaderChange[] {
  const out: LeaderChange[] = []
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1]!
    const p1 = points[i]!
    const a = leaderAt(p0)
    const b = leaderAt(p1)
    if (!a || !b || a === b) continue

    const d0 = diffAt(p0, a, b)
    const d1 = diffAt(p1, a, b)
    const shift = d0 === null || d1 === null ? p1.shift : lerpZero(p0.shift, d0, p1.shift, d1)
    out.push({ shift, fromId: a, toId: b })
  }
  return out
}

/**
 * Ближайшая к текущему сценарию смена победителя — главный ответ пользователю:
 * насколько должна сдвинуться траектория, чтобы выиграла другая бумага.
 */
export function nearestLeaderChange(
  points: readonly SweepPoint[],
  around = 0,
): LeaderChange | null {
  let best: LeaderChange | null = null
  for (const c of leaderChanges(points)) {
    if (!best || Math.abs(c.shift - around) < Math.abs(best.shift - around)) best = c
  }
  return best
}
