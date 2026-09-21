import { describe, expect, it } from 'vitest'
import { defaultState } from './defaults'
import { decodeState, encodeState, hasState, parseQuery } from './url'
import type { AppState } from './types'

const base = (): AppState => defaultState(new Date('2026-09-21T12:00:00'))

/** id пересоздаются при разборе, поэтому сравниваем всё кроме них. */
function stripIds(s: AppState) {
  return {
    ...s,
    points: s.points.map(({ id: _id, ...rest }) => rest),
    bonds: s.bonds.map(({ id: _id, ...rest }) => rest),
  }
}

describe('URL-сериализация', () => {
  it('круговой рейс сохраняет состояние', () => {
    const s = base()
    expect(stripIds(decodeState(encodeState(s), s))).toEqual(stripIds(s))
  })

  it('переживает дробные ставки, отрицательный спред и оба вида привязки', () => {
    const s = base()
    s.reinvSpreadPct = -0.25
    s.mode = 'linear'
    s.horizon = 57
    s.points = [
      { id: 'a', anchor: { kind: 'offset', months: 0 }, rate: 14.25, confidence: 'confirmed' },
      { id: 'b', anchor: { kind: 'date', value: '2026-10-23' }, rate: 13.75, confidence: 'confirmed' },
      { id: 'c', anchor: { kind: 'offset', months: 18 }, rate: 9.5, confidence: 'estimated' },
    ]
    const back = decodeState(encodeState(s), s)
    expect(back.reinvSpreadPct).toBe(-0.25)
    expect(back.mode).toBe('linear')
    expect(back.horizon).toBe(57)
    expect(back.points.map((p) => p.anchor)).toEqual(s.points.map((p) => p.anchor))
    expect(back.points.map((p) => p.rate)).toEqual([14.25, 13.75, 9.5])
  })

  it('доверие к точке выводится из привязки, а не берётся из URL', () => {
    const s = base()
    s.points = [
      { id: 'a', anchor: { kind: 'date', value: '2026-10-23' }, rate: 13, confidence: 'estimated' },
      { id: 'b', anchor: { kind: 'date', value: '2027-04-02' }, rate: 12, confidence: 'confirmed' },
    ]
    const back = decodeState(encodeState(s), s)
    expect(back.points.map((p) => p.confidence)).toEqual(['confirmed', 'estimated'])
  })

  it('имя бумаги с разделителями и кириллицей возвращается целым', () => {
    const s = base()
    s.bonds[0]!.name = 'ОФЗ~26238; серия «А»'
    const url = encodeState(s)
    expect(url).not.toContain('«')
    expect(decodeState(url, s).bonds[0]!.name).toBe('ОФЗ~26238; серия «А»')
  })

  it('результат разбирается как один параметр на поле', () => {
    const q = parseQuery(encodeState(base()))
    expect(q.get('v')).toBe('1')
    expect(q.get('m')).toBe('s')
    expect(q.get('p')?.split(';')).toHaveLength(6)
  })

  it('разделители внутри имени не ломают соседние поля', () => {
    const s = base()
    s.bonds[0]!.name = 'A~B;C=D&E'
    s.bonds[1]!.name = 'обычное'
    const back = decodeState(encodeState(s), s)
    expect(back.bonds).toHaveLength(2)
    expect(back.bonds[0]!.name).toBe('A~B;C=D&E')
    expect(back.bonds[1]!.name).toBe('обычное')
    expect(back.bonds[0]!.pricePct).toBe(s.bonds[0]!.pricePct)
  })
})

describe('битый URL', () => {
  const fallback = base()

  it('мусор целиком — поднимаемся на дефолтах', () => {
    for (const bad of ['', '?', '???', 'p=&b=&h=', 'p=;;;&b=;;;', '%%%', 'v=1&p=abc~def&b=zzz']) {
      const s = decodeState(bad, fallback)
      expect(s.points.length).toBeGreaterThan(0)
      expect(s.bonds.length).toBeGreaterThan(0)
      expect(s.horizon).toBeGreaterThanOrEqual(3)
    }
  })

  it('чужая версия — полный откат на дефолт', () => {
    expect(stripIds(decodeState('v=99&h=120', fallback))).toEqual(stripIds(fallback))
  })

  it('цена ноль или отрицательная в модель не попадает', () => {
    expect(decodeState('v=1&b=x~Фикс~0~2~0~0~15.5~2', fallback).bonds[0]!.pricePct).toBeGreaterThan(0)
    expect(decodeState('v=1&b=x~Фикс~-50~2~0~0~15.5~2', fallback).bonds[0]!.pricePct).toBeGreaterThan(0)
  })

  it('срок и частота купона зажимаются в допустимое', () => {
    expect(decodeState('v=1&h=9999', fallback).horizon).toBe(240)
    expect(decodeState('v=1&h=0', fallback).horizon).toBe(3)
    expect(decodeState('v=1&b=f~Ф~100~7~1.5~1~0~1', fallback).bonds[0]!.freq).toBe(4)
  })

  it('битая дата старта заменяется дефолтной', () => {
    expect(decodeState('v=1&s=вчера', fallback).startDate).toBe(fallback.startDate)
    expect(decodeState('v=1&s=2027-01-15', fallback).startDate).toBe('2027-01-15')
  })

  it('NaN и Infinity в числах не проходят', () => {
    const s = decodeState('v=1&h=NaN&r=Infinity&b=f~Ф~NaN~4~NaN~NaN~NaN~NaN', fallback)
    expect(Number.isFinite(s.horizon)).toBe(true)
    expect(Number.isFinite(s.reinvSpreadPct)).toBe(true)
    for (const v of Object.values(s.bonds[0]!)) {
      if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true)
    }
  })
})

describe('hasState', () => {
  it('отличает первый заход от сохранённой ссылки', () => {
    expect(hasState('')).toBe(false)
    expect(hasState('?')).toBe(false)
    expect(hasState('?v=1')).toBe(true)
  })
})
