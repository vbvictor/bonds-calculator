import { describe, expect, it } from 'vitest'
import { calcBond, calcSeries, couponSchedule, priceOf } from './engine'
import { avgKS, ksAt } from './rates'
import type { Bond, CalcContext, InterpMode, ResolvedPoint } from './types'

/**
 * Приёмочные тесты. Эталоны получены reference/ref.py.
 * Допуск 1e-6 по доходности, 1e-3 по суммам.
 * Расхождение — ошибка в реализации, не в эталоне.
 */

const TOL_RETURN = 1e-6
const TOL_SUM = 1e-3

function near(actual: number, expected: number, tol: number): void {
  expect(
    Math.abs(actual - expected),
    `получено ${actual}, эталон ${expected}, допуск ${tol}`,
  ).toBeLessThanOrEqual(tol)
}

function ctxOf(
  path: ResolvedPoint[],
  H: number,
  reinvSpread: number,
  mode: InterpMode = 'step',
  shift = 0,
): CalcContext {
  return { path, H, reinvSpread, shift, mode }
}

function floater(over: Partial<Bond> = {}): Bond {
  return {
    id: 'f',
    name: 'Флоатер',
    kind: 'floater',
    pricePct: 100,
    freq: 4,
    spread: 0.015,
    lag: 0,
    couponRate: 0,
    ...over,
  }
}

function fixed(over: Partial<Bond> = {}): Bond {
  return {
    id: 'x',
    name: 'Фикс',
    kind: 'fixed',
    pricePct: 99,
    freq: 2,
    spread: 0,
    lag: 0,
    couponRate: 0.155,
    ...over,
  }
}

const PATH_FLAT: ResolvedPoint[] = [{ m: 0, r: 14 }]
const PATH_DOWN: ResolvedPoint[] = [
  { m: 0, r: 14 },
  { m: 6, r: 13.5 },
  { m: 12, r: 12.5 },
  { m: 24, r: 10.5 },
]
const PATH_CALENDAR: ResolvedPoint[] = [
  { m: 0, r: 14 },
  { m: 1, r: 13.5 },
  { m: 3, r: 13 },
  { m: 5, r: 12.5 },
  { m: 6, r: 12 },
  { m: 7, r: 11.5 },
  { m: 9, r: 11 },
  { m: 10, r: 10.5 },
  { m: 12, r: 10 },
]

describe('A. Плоская ставка', () => {
  const ctx = ctxOf(PATH_FLAT, 36, 0.01)

  it('флоатер КС+1.5%, цена 100, freq 4, lag 0', () => {
    const r = calcBond(floater(), ctx)
    near(r.fv, 1575.518, TOL_SUM)
    near(r.annualReturn, 0.163611, TOL_RETURN)
  })

  it('первый купон флоатера ровно 38.75', () => {
    near(calcBond(floater(), ctx).firstCoupon, 38.75, TOL_SUM)
  })

  it('фикс 15.5%, цена 99, freq 2', () => {
    const r = calcBond(fixed(), ctx)
    near(r.fv, 1564.7952, TOL_SUM)
    near(r.annualReturn, 0.164861, TOL_RETURN)
  })
})

describe('B. Снижение ставки, режим step', () => {
  const ctx = ctxOf(PATH_DOWN, 36, 0.01)
  const f = floater({ pricePct: 100.2, lag: 1 })

  it('флоатер КС+1.5%, цена 100.2, freq 4, lag 1', () => {
    const r = calcBond(f, ctx)
    near(r.fv, 1507.5118, TOL_SUM)
    near(r.annualReturn, 0.145859, TOL_RETURN)
  })

  it('фикс 15.5%, цена 99, freq 2', () => {
    const r = calcBond(fixed(), ctx)
    near(r.fv, 1545.5842, TOL_SUM)
    near(r.annualReturn, 0.160074, TOL_RETURN)
  })

  it('разрыв -1.4216 п.п., avgKS 12.2027%', () => {
    const gap = (calcBond(f, ctx).annualReturn - calcBond(fixed(), ctx).annualReturn) * 100
    near(gap, -1.4216, 1e-4)
    near(avgKS(PATH_DOWN, 36), 12.2027, 1e-4)
  })

  it('режим linear на тех же данных даёт -1.88 п.п. и 11.80% — то есть step действительно ступенчатый', () => {
    const lin = ctxOf(PATH_DOWN, 36, 0.01, 'linear')
    const gap = (calcBond(f, lin).annualReturn - calcBond(fixed(), lin).annualReturn) * 100
    near(gap, -1.8823, 1e-4)
    near(avgKS(PATH_DOWN, 36, 0, 'linear'), 11.804, 1e-3)
    expect(Math.abs(gap + 1.4216)).toBeGreaterThan(0.4)
  })
})

describe('C. Ступенчатость', () => {
  it('режим step: месяц 5 даёт 14.00, месяц 6 уже 13.50', () => {
    const expected: Array<[number, number]> = [
      [0, 14],
      [5, 14],
      [6, 13.5],
      [11, 13.5],
      [12, 12.5],
      [23, 12.5],
      [24, 10.5],
      [36, 10.5],
    ]
    for (const [m, r] of expected) expect(ksAt(PATH_DOWN, m)).toBe(r)
  })

  it('режим linear на той же траектории', () => {
    const expected: Array<[number, number]> = [
      [3, 13.75],
      [9, 13],
      [18, 11.5],
    ]
    for (const [m, r] of expected) near(ksAt(PATH_DOWN, m, 0, 'linear'), r, 1e-12)
  })
})

describe('D. Дисконтная бумага', () => {
  it('купон 0, цена 75, H 36, ставка 0, реинвест 0', () => {
    const ctx = ctxOf([{ m: 0, r: 0 }], 36, 0)
    const r = calcBond(fixed({ couponRate: 0, pricePct: 75 }), ctx)
    near(r.fv, 1000, TOL_SUM)
    near(r.annualReturn, Math.pow(1 / 0.75, 1 / 3) - 1, 1e-12)
    near(r.annualReturn, 0.100642, TOL_RETURN)
  })
})

describe('E. Инвариант ряда', () => {
  /** mulberry32 — детерминированный PRNG, чтобы падение теста воспроизводилось. */
  function rng(seed: number): () => number {
    let a = seed >>> 0
    return () => {
      a = (a + 0x6d2b79f5) >>> 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  it('последний элемент помесячного ряда = FV / price на 200 случайных входах', () => {
    const rand = rng(20260921)
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!
    const between = (lo: number, hi: number) => lo + rand() * (hi - lo)

    for (let i = 0; i < 200; i++) {
      const H = 3 + Math.floor(rand() * 118)
      const n = 1 + Math.floor(rand() * 6)
      const path: ResolvedPoint[] = []
      for (let k = 0; k < n; k++) {
        path.push({ m: Math.floor(between(0, H)), r: between(0, 30) })
      }
      path.sort((a, b) => a.m - b.m)

      const ctx = ctxOf(path, H, between(-0.02, 0.05), pick<InterpMode>(['step', 'linear']))
      const kind = pick<Bond['kind']>(['floater', 'fixed'])
      const bond: Bond = {
        id: 'p',
        name: 'random',
        kind,
        pricePct: between(30, 160),
        freq: pick([2, 4, 12]),
        spread: between(-0.01, 0.05),
        lag: Math.floor(between(0, 7)),
        couponRate: between(0, 0.3),
          }

      const res = calcBond(bond, ctx)
      const series = calcSeries(bond, ctx)
      expect(series).toHaveLength(H + 1)

      const last = series[H]!
      const expected = res.fv / priceOf(bond)
      const err = Math.abs(last - expected) / Math.max(1, Math.abs(expected))
      expect(err, `вход #${i}: ряд ${last}, FV/price ${expected}`).toBeLessThanOrEqual(1e-9)
    }
  })

  it('ряд стартует с (FACE / price) — эффект покупки с дисконтом или премией', () => {
    const ctx = ctxOf(PATH_DOWN, 36, 0.01)
    const b = floater({ pricePct: 100.2, lag: 1 })
    near(calcSeries(b, ctx)[0]!, 1000 / priceOf(b), 1e-12)
  })
})

describe('F. Границы', () => {
  it('H не кратен шагу купона: H=35, freq 2 — последний купон на месяце 30', () => {
    const ctx = ctxOf(PATH_DOWN, 35, 0.01)
    const sched = couponSchedule(fixed(), ctx)
    expect(sched.map((c) => c.month)).toEqual([6, 12, 18, 24, 30])
    const r = calcBond(fixed(), ctx)
    near(r.fv, 1463.641, TOL_SUM)
    near(r.annualReturn, 0.143449, TOL_RETURN)
    // номинал приходит на месяце 35, купона там нет
    expect(calcSeries(fixed(), ctx)).toHaveLength(36)
  })

  it('одна точка в траектории — ставка постоянна везде', () => {
    for (const m of [-12, 0, 1, 7, 240]) {
      expect(ksAt(PATH_FLAT, m)).toBe(14)
      expect(ksAt(PATH_FLAT, m, 0, 'linear')).toBe(14)
    }
  })

  it('lag больше купонного периода — setMonth не уходит ниже нуля', () => {
    const ctx = ctxOf(PATH_DOWN, 36, 0.01)
    const r = calcBond(floater({ pricePct: 100.2, lag: 9 }), ctx)
    near(r.firstCoupon, 38.75, TOL_SUM)
    near(r.fv, 1527.001, TOL_SUM)
    near(r.annualReturn, 0.150775, TOL_RETURN)
    expect(Number.isFinite(r.annualReturn)).toBe(true)
  })

  it('сдвиг применяется и за пределами траектории', () => {
    expect(ksAt(PATH_DOWN, -5, 2)).toBe(16)
    expect(ksAt(PATH_DOWN, 99, -0.5)).toBe(10)
  })
})

describe('G. Реальный календарь', () => {
  const ctx = ctxOf(PATH_CALENDAR, 36, 0.01)

  it('неравномерные интервалы 1,2,2,1,1,2,1,2 месяца', () => {
    const f = calcBond(floater({ pricePct: 100.2, lag: 1 }), ctx)
    const x = calcBond(fixed(), ctx)
    near(f.annualReturn, 0.129296, TOL_RETURN)
    near(x.annualReturn, 0.157705, TOL_RETURN)
    near((f.annualReturn - x.annualReturn) * 100, -2.8409, 1e-4)
  })

  it('поиск последней применимой точки на неравномерной сетке', () => {
    const expected: Array<[number, number]> = [
      [0, 14],
      [1, 13.5],
      [2, 13.5],
      [3, 13],
      [4, 13],
      [5, 12.5],
      [6, 12],
      [8, 11.5],
      [11, 10.5],
      [12, 10],
      [36, 10],
    ]
    for (const [m, r] of expected) expect(ksAt(PATH_CALENDAR, m)).toBe(r)
  })
})

describe('H. Эквивалентность режимов', () => {
  it('при одной точке step и linear дают побитово одинаковый результат', () => {
    const step = ctxOf(PATH_FLAT, 36, 0.01, 'step')
    const lin = ctxOf(PATH_FLAT, 36, 0.01, 'linear')

    for (const bond of [floater(), fixed(), fixed({ couponRate: 0, pricePct: 75 })]) {
      const a = calcBond(bond, step)
      const b = calcBond(bond, lin)
      expect(Object.is(a.fv, b.fv)).toBe(true)
      expect(Object.is(a.annualReturn, b.annualReturn)).toBe(true)
      expect(calcSeries(bond, step)).toEqual(calcSeries(bond, lin))
    }
  })
})
