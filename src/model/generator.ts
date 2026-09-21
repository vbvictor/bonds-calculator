import { CBR_CADENCE_MONTHS, isConfirmedMeeting, upcomingMeetings } from './cbrCalendar'
import { addMonths } from './rates'
import type { RatePoint } from './types'

/**
 * Ритм генератора: 'cbr' — как у ЦБ, восемь заседаний в год с неравными
 * интервалами; число — каждые N месяцев.
 */
export type Cadence = 'cbr' | number

export type GridOptions = {
  /** Дата старта расчёта, ISO. */
  startIso: string
  /** Ставка в нулевой точке, проценты. */
  startRate: number
  cadence: Cadence
  /** Сколько точек сгенерировать после нулевой. */
  count: number
  /** Изменение ставки на каждом шаге, п.п. Отрицательное — снижение. */
  stepPct: number
  /** Пол при снижении, потолок при росте, проценты. */
  limit: number
}

let seq = 0
export function newId(prefix = 'p'): string {
  seq += 1
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}`
}

/** Даты предполагаемых заседаний: сначала подтверждённые, дальше — ритм ЦБ. */
function cbrDates(startIso: string, count: number): string[] {
  const confirmed = upcomingMeetings(startIso, count)
  const out = [...confirmed]
  let cursor = out[out.length - 1] ?? startIso
  let k = 0
  while (out.length < count) {
    const gap = CBR_CADENCE_MONTHS[k % CBR_CADENCE_MONTHS.length] ?? 2
    cursor = addMonths(cursor, gap)
    out.push(cursor)
    k += 1
  }
  return out
}

/**
 * Сетка точек прогноза. Возвращает обычные строки траектории:
 * после генерации их можно править поштучно, генератор о них больше не знает.
 */
export function generateGrid(o: GridOptions): RatePoint[] {
  const count = Math.max(0, Math.min(60, Math.round(o.count)))
  const clamp = (r: number): number =>
    o.stepPct < 0 ? Math.max(o.limit, r) : o.stepPct > 0 ? Math.min(o.limit, r) : r

  const head: RatePoint = {
    id: newId(),
    anchor: { kind: 'offset', months: 0 },
    rate: round2(o.startRate),
    confidence: 'confirmed',
  }

  const dates = o.cadence === 'cbr' ? cbrDates(o.startIso, count) : []
  const out: RatePoint[] = [head]

  for (let k = 1; k <= count; k++) {
    const rate = round2(clamp(o.startRate + o.stepPct * k))
    if (o.cadence === 'cbr') {
      const value = dates[k - 1]
      if (!value) break
      out.push({
        id: newId(),
        anchor: { kind: 'date', value },
        rate,
        confidence: isConfirmedMeeting(value) ? 'confirmed' : 'estimated',
      })
    } else {
      const months = Math.max(1, Math.round(o.cadence)) * k
      out.push({
        id: newId(),
        anchor: { kind: 'offset', months },
        rate,
        confidence: 'estimated',
      })
    }
  }
  return out
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}
