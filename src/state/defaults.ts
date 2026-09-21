import { newId } from '../model/generator'
import { todayIso } from '../model/rates'
import { isConfirmedMeeting, upcomingMeetings } from '../model/cbrCalendar'
import { FACE, type Bond, type RateAnchor, type Confidence, type RatePoint } from '../model/types'
import type { AppState, BondInput } from './types'

export const STATE_VERSION = 1
export const STORAGE_KEY = 'bond-rate-calculator:v1'

export const MIN_HORIZON = 3
export const MAX_HORIZON = 240
/** Допустимые частоты купона. Единственный источник правды: и select, и разбор URL. */
export const FREQS = [12, 4, 2, 1] as const

export function normalizeFreq(v: number, fallback = 4): number {
  return (FREQS as readonly number[]).includes(v) ? v : fallback
}
export const SERIES_COUNT = 6

export const LIMITS = {
  pricePct: { min: 0.01, max: 1000 },
  couponPct: { min: 0, max: 200 },
  spreadPct: { min: -20, max: 50 },
  lag: { min: 0, max: 12 },
  rate: { min: -10, max: 100 },
  reinvSpreadPct: { min: -20, max: 20 },
}

/** Доверие к точке выводится из привязки: подтверждена только реальная дата заседания. */
export function confidenceFor(anchor: RateAnchor): Confidence {
  if (anchor.kind === 'date') return isConfirmedMeeting(anchor.value) ? 'confirmed' : 'estimated'
  return anchor.months === 0 ? 'confirmed' : 'estimated'
}

export function defaultState(now: Date = new Date()): AppState {
  const start = todayIso(now)

  const points: RatePoint[] = [point({ kind: 'offset', months: 0 }, 14)]

  // Ближайшие подтверждённые заседания — но только те, что ещё впереди.
  // Прибивать дефолт к конкретным датам нельзя: когда они пройдут, точки уедут
  // в отрицательные месяцы и стартовая траектория выродится в плоскую.
  const nearRates = [13.5, 13]
  upcomingMeetings(start, 2).forEach((value, i) => {
    points.push(point({ kind: 'date', value }, nearRates[i] ?? 13))
  })

  // Дальний хвост всегда сдвигами: он не устаревает.
  for (const [months, rate] of [
    [6, 12.5],
    [12, 11.5],
    [24, 10],
  ] as const) {
    points.push(point({ kind: 'offset', months }, rate))
  }

  return {
    startDate: start,
    horizon: 36,
    reinvSpreadPct: 1,
    mode: 'step',
    points,
    bonds: [defaultFloater(), defaultFixed()],
  }
}

function point(anchor: RateAnchor, rate: number): RatePoint {
  return { id: newId(), anchor, rate, confidence: confidenceFor(anchor) }
}

export function defaultFloater(): BondInput {
  return {
    id: newId('b'),
    name: 'Флоатер',
    kind: 'floater',
    pricePct: 100.2,
    freq: 4,
    spreadPct: 1.5,
    lag: 1,
    couponPct: 0,
    colorIndex: 1,
  }
}

export function defaultFixed(): BondInput {
  return {
    id: newId('b'),
    name: 'Фикс',
    kind: 'fixed',
    pricePct: 99,
    freq: 2,
    spreadPct: 0,
    lag: 0,
    couponPct: 15.5,
    colorIndex: 2,
  }
}

/** Проценты → доли. Единственное место перевода. */
export function toBond(b: BondInput): Bond {
  return {
    id: b.id,
    name: b.name,
    kind: b.kind,
    pricePct: b.pricePct,
    freq: b.freq,
    spread: b.spreadPct / 100,
    lag: b.lag,
    couponRate: b.couponPct / 100,
  }
}

export function priceRub(b: BondInput): number {
  return (b.pricePct / 100) * FACE
}
