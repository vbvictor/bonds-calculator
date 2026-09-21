import { describe, expect, it } from 'vitest'
import { FREQS, defaultState, normalizeFreq, priceRub, toBond } from './defaults'
import { anchorToMonth, resolvePath } from '../model/rates'
import { CALENDAR_CHECKED_AT } from '../model/cbrCalendar'

describe('дефолтная траектория', () => {
  it('на дату сверки календаря подхватывает подтверждённые заседания', () => {
    const s = defaultState(new Date('2026-09-21T12:00:00'))
    const dates = s.points.filter((p) => p.anchor.kind === 'date')
    expect(dates.length).toBe(2)
    expect(dates.every((p) => p.confidence === 'confirmed')).toBe(true)
  })

  it('когда календарь ЦБ исчерпан, точки не уезжают в отрицательные месяцы', () => {
    // календарь сверен на 2026-09-21 и кончается 2026-12-18; берём заведомо позже
    for (const iso of ['2027-03-05', '2028-11-30', '2031-01-01']) {
      const s = defaultState(new Date(`${iso}T12:00:00`))
      const months = s.points.map((p) => anchorToMonth(p.anchor, s.startDate))
      expect(months.every((m) => m >= 0), `${iso}: ${months.join(',')}`).toBe(true)
      expect(months[0]).toBe(0)
    }
  })

  it('траектория всегда строго возрастает по месяцам и снижается по ставке', () => {
    for (const iso of [CALENDAR_CHECKED_AT, '2026-11-01', '2029-06-15']) {
      const s = defaultState(new Date(`${iso}T12:00:00`))
      const path = resolvePath(s.points, s.startDate)
      for (let i = 1; i < path.length; i++) {
        expect(path[i]!.m, iso).toBeGreaterThan(path[i - 1]!.m)
        expect(path[i]!.r, iso).toBeLessThanOrEqual(path[i - 1]!.r)
      }
      expect(path.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('дефолт даёт флоатер и фикс с разными цветами', () => {
    const s = defaultState(new Date('2026-09-21T12:00:00'))
    expect(s.bonds.map((b) => b.kind)).toEqual(['floater', 'fixed'])
    expect(new Set(s.bonds.map((b) => b.colorIndex)).size).toBe(2)
  })
})

describe('нормализация частоты купона', () => {
  it('принимает только значения из FREQS', () => {
    for (const f of FREQS) expect(normalizeFreq(f)).toBe(f)
  })

  it('всё остальное откатывает на дефолт', () => {
    for (const bad of [0, 3, 5, 7, 13, -2, Number.NaN, Infinity]) {
      expect(FREQS as readonly number[]).toContain(normalizeFreq(bad))
    }
  })
})

describe('перевод в модель', () => {
  it('проценты становятся долями ровно один раз', () => {
    const b = toBond({
      id: 'b',
      name: 'X',
      kind: 'floater',
      pricePct: 100.2,
      freq: 4,
      spreadPct: 1.5,
      lag: 1,
      couponPct: 15.5,
      colorIndex: 1,
    })
    expect(b.spread).toBeCloseTo(0.015, 12)
    expect(b.couponRate).toBeCloseTo(0.155, 12)
    expect(b.pricePct).toBe(100.2)
  })

  it('цена в рублях считается от номинала 1000', () => {
    expect(priceRub({ pricePct: 99 } as never)).toBe(990)
  })
})
