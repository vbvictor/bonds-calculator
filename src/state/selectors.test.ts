import { describe, expect, it } from 'vitest'
import { compute } from './selectors'
import { defaultState, defaultFixed, defaultFloater } from './defaults'
import type { AppState } from './types'

function stateWith(bonds: AppState['bonds'], over: Partial<AppState> = {}): AppState {
  const s = defaultState(new Date('2026-09-21T12:00:00'))
  return {
    ...s,
    horizon: 36,
    reinvSpreadPct: 1,
    mode: 'step',
    points: [
      { id: 'a', anchor: { kind: 'offset', months: 0 }, rate: 14, confidence: 'confirmed' },
      { id: 'b', anchor: { kind: 'offset', months: 6 }, rate: 13.5, confidence: 'estimated' },
      { id: 'c', anchor: { kind: 'offset', months: 12 }, rate: 12.5, confidence: 'estimated' },
      { id: 'd', anchor: { kind: 'offset', months: 24 }, rate: 10.5, confidence: 'estimated' },
    ],
    bonds,
    ...over,
  }
}

const FLOAT = { ...defaultFloater(), id: 'f', name: 'Флоатер' }
const FIX = { ...defaultFixed(), id: 'x', name: 'Фикс' }

describe('смена лидера показывает правильную бумагу', () => {
  it('пересечение выше текущего сценария: вперёд выходит бумага справа', () => {
    const c = compute(stateWith([FLOAT, FIX]))
    expect(c.leaderId).toBe('x')
    expect(c.switchPoint!.shift).toBeGreaterThan(0)
    expect(c.switchToId).toBe('f')
    expect(c.switchToId).not.toBe(c.leaderId)
  })

  it('пересечение ниже текущего сценария: вперёд выходит бумага слева', () => {
    // спред 4 п.п. — флоатер выигрывает уже сейчас, догнать его фикс может
    // только на падении ставки, то есть пересечение лежит в минусе
    const c = compute(stateWith([{ ...FLOAT, spreadPct: 4 }, FIX]))
    expect(c.leaderId).toBe('f')
    expect(c.switchPoint!.shift).toBeLessThan(0)
    // до правки здесь возвращался сам текущий лидер — «впереди окажется тот,
    // кто и так впереди»
    expect(c.switchToId).toBe('x')
    expect(c.switchToId).not.toBe(c.leaderId)
  })

  it('без пересечения лидер не меняется', () => {
    const c = compute(stateWith([{ ...FIX, id: 'rich', couponPct: 50 }, { ...FIX, id: 'poor', couponPct: 1 }]))
    expect(c.switchPoint).toBeNull()
    expect(c.switchToId).toBeNull()
  })
})

describe('ранжирование', () => {
  it('лидер совпадает с первым в ranking', () => {
    const c = compute(stateWith([FLOAT, FIX]))
    expect(c.ranking[0]).toBe(c.leaderId)
    expect(c.ranking).toHaveLength(2)
  })

  /**
   * Нарочно вырожденный вход: нулевая ставка, спред −20 п.п. и десять лет.
   * Купоны отрицательные, накопленный минус перебивает номинал, FV уходит ниже
   * нуля — и корень из отрицательного даёт NaN. Единственный способ получить
   * непосчитавшуюся бумагу, поэтому им и проверяем поведение сортировки.
   */
  const degenerate = (id: string, spreadPct: number) => ({ ...FLOAT, id, spreadPct })
  const flatZero: Partial<AppState> = {
    horizon: 120,
    reinvSpreadPct: 0,
    points: [{ id: 'z', anchor: { kind: 'offset', months: 0 }, rate: 0, confidence: 'confirmed' }],
  }

  it('непосчитавшаяся бумага уходит в конец, а не всплывает наверх', () => {
    const c = compute(stateWith([degenerate('broken', -20), FIX], flatZero))
    expect(c.byId.get('broken')!.fv).toBeLessThan(0)
    expect(Number.isFinite(c.byId.get('broken')!.annualReturn)).toBe(false)
    expect(c.ranking).toEqual(['x', 'broken'])
    expect(c.leaderId).toBe('x')
  })

  it('когда не посчиталась ни одна бумага, лидера нет', () => {
    const c = compute(
      stateWith([degenerate('b1', -20), degenerate('b2', -19)], flatZero),
    )
    expect(c.ranking).toHaveLength(2)
    expect(c.leaderId).toBeNull()
  })
})

describe('ряды для графиков', () => {
  it('accrual имеет длину H + 1 и содержит ставку и все бумаги', () => {
    const c = compute(stateWith([FLOAT, FIX], { horizon: 24 }))
    expect(c.accrual).toHaveLength(25)
    expect(c.accrual[0]).toMatchObject({ m: 0, ks: 14 })
    expect(c.accrual[24]!['f']).toBeCloseTo(c.byId.get('f')!.fv / c.byId.get('f')!.price, 9)
  })

  it('sweepRows покрывают весь диапазон сдвигов', () => {
    const c = compute(stateWith([FLOAT, FIX]))
    expect(c.sweepRows).toHaveLength(71)
    expect(c.sweepRows[0]!.shift).toBeCloseTo(-6, 9)
    expect(c.sweepRows[70]!.shift).toBeCloseTo(2, 9)
  })
})
