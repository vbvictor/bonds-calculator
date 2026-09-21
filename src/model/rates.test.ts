import { describe, expect, it } from 'vitest'
import { anchorToMonth, avgKS, dateToMonth, ksAt, ksSeries, resolvePath } from './rates'
import type { RatePoint, ResolvedPoint } from './types'

const p = (id: string, months: number, rate: number): RatePoint => ({
  id,
  anchor: { kind: 'offset', months },
  rate,
  confidence: 'estimated',
})

const d = (id: string, value: string, rate: number): RatePoint => ({
  id,
  anchor: { kind: 'date', value },
  rate,
  confidence: 'confirmed',
})

describe('dateToMonth', () => {
  it('считает разницу в календарных месяцах', () => {
    expect(dateToMonth('2026-09-21', '2026-09-21')).toBe(0)
    expect(dateToMonth('2026-10-23', '2026-09-21')).toBe(1)
    expect(dateToMonth('2026-12-18', '2026-09-21')).toBe(3)
    expect(dateToMonth('2027-09-01', '2026-09-21')).toBe(12)
  })

  it('отбрасывает день: 1 и 23 октября дают один индекс', () => {
    expect(dateToMonth('2026-10-01', '2026-09-21')).toBe(dateToMonth('2026-10-23', '2026-09-21'))
  })

  it('дата до старта даёт отрицательный индекс', () => {
    expect(dateToMonth('2026-02-13', '2026-09-21')).toBe(-7)
  })

  it('битая дата даёт NaN, а не ноль: недописанная дата не должна означать «месяц 0»', () => {
    expect(dateToMonth('', '2026-09-21')).toBeNaN()
    expect(dateToMonth('завтра', '2026-09-21')).toBeNaN()
    expect(dateToMonth('2026-13-01', '2026-09-21')).toBeNaN()
    expect(dateToMonth('2026-10-23', 'не дата')).toBeNaN()
  })
})

describe('resolvePath', () => {
  it('сортирует по месяцу и поддерживает оба вида привязки', () => {
    const path = resolvePath([p('a', 12, 11), d('b', '2026-10-23', 13.5), p('c', 0, 14)], '2026-09-21')
    expect(path).toEqual([
      { m: 0, r: 14 },
      { m: 1, r: 13.5 },
      { m: 12, r: 11 },
    ])
  })

  it('при совпадении месяцев внутри траектории выигрывает последняя введённая точка', () => {
    const path = resolvePath([p('z', 0, 14), p('a', 6, 13), p('b', 6, 9), p('y', 12, 8)], '2026-09-21')
    expect(ksAt(path, 6)).toBe(9)
  })

  it('на краю траектории дубль разрешается в пользу крайней точки — как в ref.py', () => {
    const path = resolvePath([p('a', 6, 13), p('b', 6, 9)], '2026-09-21')
    expect(ksAt(path, 6)).toBe(13)
  })

  it('выбрасывает точки с нечисловой ставкой', () => {
    expect(resolvePath([p('a', 0, 14), p('b', 6, Number.NaN)], '2026-09-21')).toEqual([
      { m: 0, r: 14 },
    ])
  })

  it('точка с недописанной датой не участвует, пока её не дозаполнят', () => {
    const path = resolvePath([p('a', 0, 14), d('b', '', 12), d('c', '2026-12-18', 11)], '2026-09-21')
    expect(path).toEqual([
      { m: 0, r: 14 },
      { m: 3, r: 11 },
    ])
  })
})

describe('anchorToMonth', () => {
  it('округляет дробный сдвиг', () => {
    expect(anchorToMonth({ kind: 'offset', months: 6.4 }, '2026-09-21')).toBe(6)
  })
})

describe('ksAt и производные', () => {
  const path: ResolvedPoint[] = [
    { m: 0, r: 14 },
    { m: 6, r: 13.5 },
  ]

  it('пустая траектория не роняет расчёт', () => {
    expect(ksAt([], 5)).toBe(0)
    expect(ksAt([], 5, 2)).toBe(2)
  })

  it('ksSeries имеет длину H + 1 и согласован с ksAt', () => {
    const s = ksSeries(path, 12)
    expect(s).toHaveLength(13)
    expect(s[0]).toBe(14)
    expect(s[12]).toBe(13.5)
  })

  it('avgKS усредняет по месяцам 0..H включительно', () => {
    // шесть месяцев по 14 и семь по 13.5
    expect(avgKS(path, 12)).toBeCloseTo((6 * 14 + 7 * 13.5) / 13, 12)
  })

  it('сдвиг входит в среднюю линейно', () => {
    expect(avgKS(path, 12, 1.5) - avgKS(path, 12)).toBeCloseTo(1.5, 12)
  })
})
