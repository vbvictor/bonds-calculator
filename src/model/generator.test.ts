import { describe, expect, it } from 'vitest'
import { generateGrid } from './generator'
import { addMonths, dateToMonth, resolvePath, todayIso } from './rates'

const START = '2026-09-21'

describe('addMonths', () => {
  it('сдвигает по календарю', () => {
    expect(addMonths('2026-09-21', 1)).toBe('2026-10-21')
    expect(addMonths('2026-12-18', 2)).toBe('2027-02-18')
    expect(addMonths('2026-09-21', -12)).toBe('2025-09-21')
  })

  it('подрезает день до последнего в месяце', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
  })
})

describe('todayIso', () => {
  it('берёт местную дату, а не UTC', () => {
    expect(todayIso(new Date(2026, 8, 21, 0, 30))).toBe('2026-09-21')
    expect(todayIso(new Date(2026, 0, 1, 23, 45))).toBe('2026-01-01')
  })
})

describe('generateGrid', () => {
  it('ритм ЦБ начинается с подтверждённых заседаний', () => {
    const pts = generateGrid({
      startIso: START,
      startRate: 14,
      cadence: 'cbr',
      count: 4,
      stepPct: -0.5,
      limit: 8,
    })
    expect(pts).toHaveLength(5)
    expect(pts[0]!.anchor).toEqual({ kind: 'offset', months: 0 })
    expect(pts[1]!.anchor).toEqual({ kind: 'date', value: '2026-10-23' })
    expect(pts[1]!.confidence).toBe('confirmed')
    expect(pts[2]!.anchor).toEqual({ kind: 'date', value: '2026-12-18' })
    // календарь исчерпан — дальше ритм, такие точки только предполагаемые
    expect(pts[3]!.confidence).toBe('estimated')
    expect(pts.map((p) => p.rate)).toEqual([14, 13.5, 13, 12.5, 12])
  })

  it('неравные интервалы ритма ЦБ дают строго возрастающие месяцы', () => {
    const pts = generateGrid({
      startIso: START,
      startRate: 14,
      cadence: 'cbr',
      count: 12,
      stepPct: -0.25,
      limit: 6,
    })
    const months = resolvePath(pts, START).map((p) => p.m)
    for (let i = 1; i < months.length; i++) expect(months[i]!).toBeGreaterThan(months[i - 1]!)
    expect(new Set(months.slice(1).map((m, i) => m - months[i]!)).size).toBeGreaterThan(1)
  })

  it('ритм «каждые N месяцев» даёт ровную сетку сдвигов', () => {
    const pts = generateGrid({
      startIso: START,
      startRate: 14,
      cadence: 3,
      count: 4,
      stepPct: -1,
      limit: 0,
    })
    expect(pts.map((p) => p.anchor)).toEqual([
      { kind: 'offset', months: 0 },
      { kind: 'offset', months: 3 },
      { kind: 'offset', months: 6 },
      { kind: 'offset', months: 9 },
      { kind: 'offset', months: 12 },
    ])
  })

  it('пол при снижении не пробивается', () => {
    const pts = generateGrid({
      startIso: START,
      startRate: 14,
      cadence: 6,
      count: 6,
      stepPct: -2,
      limit: 8,
    })
    expect(pts.map((p) => p.rate)).toEqual([14, 12, 10, 8, 8, 8, 8])
  })

  it('потолок при росте не пробивается', () => {
    const pts = generateGrid({
      startIso: START,
      startRate: 14,
      cadence: 6,
      count: 4,
      stepPct: 1.5,
      limit: 17,
    })
    expect(pts.map((p) => p.rate)).toEqual([14, 15.5, 17, 17, 17])
  })

  it('нулевое число точек даёт одну нулевую', () => {
    const pts = generateGrid({
      startIso: START,
      startRate: 14,
      cadence: 'cbr',
      count: 0,
      stepPct: -1,
      limit: 8,
    })
    expect(pts).toHaveLength(1)
    expect(dateToMonth(START, START)).toBe(0)
  })
})
