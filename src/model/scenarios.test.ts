import { describe, expect, it } from 'vitest'
import { calcBond } from './engine'
import {
  SWEEP_COUNT,
  SWEEP_FROM,
  SWEEP_TO,
  crossings,
  findIndifference,
  leaderAt,
  leaderChanges,
  nearestLeaderChange,
  sweep,
} from './scenarios'
import type { Bond, CalcContext, ResolvedPoint } from './types'

const PATH_DOWN: ResolvedPoint[] = [
  { m: 0, r: 14 },
  { m: 6, r: 13.5 },
  { m: 12, r: 12.5 },
  { m: 24, r: 10.5 },
]

const ctx: CalcContext = { path: PATH_DOWN, H: 36, reinvSpread: 0.01, shift: 0, mode: 'step' }

const FLOAT: Bond = {
  id: 'f',
  name: 'Флоатер',
  kind: 'floater',
  pricePct: 100.2,
  freq: 4,
  spread: 0.015,
  lag: 1,
  couponRate: 0,
}
const FIX: Bond = {
  id: 'x',
  name: 'Фикс',
  kind: 'fixed',
  pricePct: 99,
  freq: 2,
  spread: 0,
  lag: 0,
  couponRate: 0.155,
}

describe('sweep', () => {
  it('сетка от -6.0 до +2.0 п.п., 71 точка', () => {
    const pts = sweep([FLOAT, FIX], ctx)
    expect(pts).toHaveLength(SWEEP_COUNT)
    expect(pts[0]!.shift).toBeCloseTo(SWEEP_FROM, 12)
    expect(pts[SWEEP_COUNT - 1]!.shift).toBeCloseTo(SWEEP_TO, 12)
  })

  it('доходности в узлах совпадают с прямым расчётом', () => {
    const pts = sweep([FLOAT, FIX], ctx)
    const node = pts[17]!
    expect(node.returns['f']).toBe(calcBond(FLOAT, { ...ctx, shift: node.shift }).annualReturn)
    expect(node.returns['x']).toBe(calcBond(FIX, { ...ctx, shift: node.shift }).annualReturn)
  })

  it('от роста ставки выигрывают обе бумаги, но флоатер заметно сильнее', () => {
    const pts = sweep([FLOAT, FIX], ctx)
    const lo = pts[0]!
    const hi = pts[SWEEP_COUNT - 1]!
    // фикс тоже растёт: купон у него постоянный, но реинвестируется он дороже
    expect(hi.returns['x']!).toBeGreaterThan(lo.returns['x']!)
    const dFloat = hi.returns['f']! - lo.returns['f']!
    const dFixed = hi.returns['x']! - lo.returns['x']!
    expect(dFloat).toBeGreaterThan(dFixed * 2)
  })
})

describe('точка безразличия', () => {
  const pts = sweep([FLOAT, FIX], ctx)

  it('находится и симметрична по порядку аргументов', () => {
    const s = findIndifference(pts, 'f', 'x')
    expect(s).not.toBeNull()
    expect(findIndifference(pts, 'x', 'f')).toBeCloseTo(s!, 12)
  })

  it('в найденной точке доходности действительно равны', () => {
    const s = findIndifference(pts, 'f', 'x')!
    const a = calcBond(FLOAT, { ...ctx, shift: s }).annualReturn
    const b = calcBond(FIX, { ...ctx, shift: s }).annualReturn
    // уточнение линейное, кривые слегка выпуклые — остаток меньше 1 б.п.
    expect(Math.abs(a - b) * 100).toBeLessThan(0.01)
  })

  it('при базовой траектории выигрывает фикс, для разворота ставку надо поднять', () => {
    expect(leaderAt({ shift: 0, returns: { f: 0.1458, x: 0.1601 } })).toBe('x')
    const s = findIndifference(pts, 'f', 'x')!
    expect(s).toBeGreaterThan(0)
  })

  it('непересекающиеся бумаги дают null', () => {
    const rich: Bond = { ...FIX, id: 'rich', couponRate: 0.5 }
    const poor: Bond = { ...FIX, id: 'poor', couponRate: 0.01 }
    expect(findIndifference(sweep([rich, poor], ctx), 'rich', 'poor')).toBeNull()
    expect(crossings(sweep([rich, poor], ctx), 'rich', 'poor')).toEqual([])
  })
})

describe('смена победителя', () => {
  it('leaderChanges находит переход и называет обе стороны', () => {
    const pts = sweep([FLOAT, FIX], ctx)
    const changes = leaderChanges(pts)
    expect(changes).toHaveLength(1)
    expect(changes[0]!.fromId).toBe('x')
    expect(changes[0]!.toId).toBe('f')
    expect(changes[0]!.shift).toBeCloseTo(findIndifference(pts, 'f', 'x')!, 2)
  })

  it('nearestLeaderChange выбирает ближайший к текущему сценарию переход', () => {
    const pts = sweep([FLOAT, FIX], ctx)
    expect(nearestLeaderChange(pts)!.toId).toBe('f')
  })

  it('без смены лидера возвращается null', () => {
    const rich: Bond = { ...FIX, id: 'rich', couponRate: 0.5 }
    const poor: Bond = { ...FIX, id: 'poor', couponRate: 0.01 }
    expect(nearestLeaderChange(sweep([rich, poor], ctx))).toBeNull()
  })

  it('три бумаги: победитель определяется максимумом в каждом узле', () => {
    const mid: Bond = { ...FIX, id: 'mid', couponRate: 0.16 }
    const pts = sweep([FLOAT, FIX, mid], ctx)
    for (const node of pts) {
      const best = Object.entries(node.returns).sort((a, b) => b[1] - a[1])[0]![0]
      expect(leaderAt(node)).toBe(best)
    }
    expect(leaderAt(pts[0]!)).toBe('mid')
  })

  it('три бумаги: широкий спред флоатера отбирает лидерство на верхних сдвигах', () => {
    const hot: Bond = { ...FLOAT, id: 'hot', spread: 0.04 }
    const pts = sweep([hot, FIX, { ...FIX, id: 'mid', couponRate: 0.16 }], ctx)
    expect(leaderAt(pts[0]!)).toBe('mid')
    expect(leaderAt(pts[SWEEP_COUNT - 1]!)).toBe('hot')

    const changes = leaderChanges(pts)
    expect(changes.length).toBeGreaterThan(0)
    for (const c of changes) {
      expect(c.fromId).not.toBe(c.toId)
      expect(c.shift).toBeGreaterThanOrEqual(SWEEP_FROM)
      expect(c.shift).toBeLessThanOrEqual(SWEEP_TO)
    }
  })
})
