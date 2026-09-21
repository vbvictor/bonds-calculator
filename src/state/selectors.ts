import { calcAll, calcSeries, monthlyFactors } from '../model/engine'
import { avgKS, ksSeries, resolvePath } from '../model/rates'
import {
  nearestLeaderChange,
  sweep,
  type LeaderChange,
  type SweepPoint,
  crossings,
} from '../model/scenarios'
import type { Bond, CalcContext, CalcResult } from '../model/types'
import { toBond } from './defaults'
import type { AppState } from './types'

export type AccrualRow = { m: number; ks: number } & Record<string, number>
export type SweepRow = { shift: number } & Record<string, number>

export type Computed = {
  bonds: Bond[]
  ctx: CalcContext
  results: CalcResult[]
  byId: Map<string, CalcResult>
  accrual: AccrualRow[]
  avgKS: number
  sweepRows: SweepRow[]
  sweepPoints: SweepPoint[]
  /** Id бумаг от лучшей к худшей. Непосчитавшиеся — в конце. */
  ranking: string[]
  leaderId: string | null
  /** Ближайший сдвиг траектории, на котором победитель меняется. */
  switchPoint: LeaderChange | null
  /**
   * Кто выходит вперёд после этой смены. Сторона зависит от того, с какой
   * стороны от пересечения стоит текущий сценарий: пересечение ниже нуля —
   * значит новый лидер слева от него, то есть fromId.
   */
  switchToId: string | null
  /** Точки безразличия каждой бумаги против лидера. */
  indifference: Array<{ bondId: string; shift: number }>
}

export function buildContext(state: AppState): CalcContext {
  return {
    path: resolvePath(state.points, state.startDate),
    H: state.horizon,
    reinvSpread: state.reinvSpreadPct / 100,
    shift: 0,
    mode: state.mode,
  }
}

export function compute(state: AppState): Computed {
  const bonds = state.bonds.map(toBond)
  const ctx = buildContext(state)

  const results = calcAll(bonds, ctx)
  const byId = new Map(results.map((r) => [r.bondId, r]))

  const factors = monthlyFactors(ctx)
  const ks = ksSeries(ctx.path, ctx.H, ctx.shift, ctx.mode)
  const series = bonds.map((b) => [b.id, calcSeries(b, ctx, factors)] as const)

  const accrual: AccrualRow[] = []
  for (let m = 0; m <= ctx.H; m++) {
    const row = { m, ks: ks[m] ?? 0 } as AccrualRow
    for (const [id, s] of series) row[id] = s[m] ?? 0
    accrual.push(row)
  }

  const sweepPoints = sweep(bonds, ctx)
  const sweepRows: SweepRow[] = sweepPoints.map((p) => {
    const row = { shift: p.shift } as SweepRow
    for (const b of bonds) row[b.id] = (p.returns[b.id] ?? 0) * 100
    return row
  })

  // Непосчитавшаяся бумага (например, с настолько отрицательным спредом, что
  // FV уходит ниже нуля) не должна всплывать наверх из-за NaN в сравнении.
  const ranking = results
    .map((r) => ({ id: r.bondId, ret: Number.isFinite(r.annualReturn) ? r.annualReturn : -Infinity }))
    .sort((a, b) => b.ret - a.ret)
  const leaderId = ranking[0] && ranking[0].ret > -Infinity ? ranking[0].id : null

  const indifference: Array<{ bondId: string; shift: number }> = []
  if (leaderId) {
    for (const b of bonds) {
      if (b.id === leaderId) continue
      const all = crossings(sweepPoints, leaderId, b.id)
      if (!all.length) continue
      let nearest = all[0]!
      for (const s of all) if (Math.abs(s) < Math.abs(nearest)) nearest = s
      indifference.push({ bondId: b.id, shift: nearest })
    }
    indifference.sort((a, b) => Math.abs(a.shift) - Math.abs(b.shift))
  }

  const switchPoint = nearestLeaderChange(sweepPoints)

  return {
    bonds,
    ctx,
    results,
    byId,
    accrual,
    avgKS: avgKS(ctx.path, ctx.H, ctx.shift, ctx.mode),
    sweepRows,
    sweepPoints,
    ranking: ranking.map((r) => r.id),
    leaderId,
    switchPoint,
    switchToId: switchPoint ? (switchPoint.shift >= 0 ? switchPoint.toId : switchPoint.fromId) : null,
    indifference,
  }
}
