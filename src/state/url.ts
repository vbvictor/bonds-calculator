import {
  confidenceFor,
  defaultState,
  LIMITS,
  MAX_HORIZON,
  MIN_HORIZON,
  normalizeFreq,
  SERIES_COUNT,
  STATE_VERSION,
} from './defaults'
import { newId } from '../model/generator'
import type { InterpMode, RateAnchor, RatePoint } from '../model/types'
import type { AppState, BondInput } from './types'

/**
 * Сериализация всего состояния в query string.
 *
 * Разделители выбраны из символов, которые не требуют процентного кодирования
 * в query: ';' между записями, '~' между полями. Имя бумаги кодируется
 * encodeURIComponent, а '~' в нём — вручную, потому что его-то как раз
 * encodeURIComponent не трогает.
 *
 * Любая ошибка разбора — молчаливый откат на дефолт по этому полю.
 * Битый URL обязан поднимать приложение, а не ронять его.
 */

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Свой разбор query вместо URLSearchParams.
 *
 * URLSearchParams.get() процентно декодирует значение целиком, и '%7E' внутри
 * имени бумаги успевает превратиться обратно в '~' — то есть в разделитель полей —
 * раньше, чем мы дойдём до split. Поэтому значения здесь остаются сырыми,
 * а decodeURIComponent применяется по месту, к одному листовому полю.
 */
function parseQuery(query: string): Map<string, string> {
  const out = new Map<string, string>()
  const clean = query.startsWith('?') ? query.slice(1) : query
  if (!clean) return out
  for (const pair of clean.split('&')) {
    if (!pair) continue
    const eq = pair.indexOf('=')
    const key = eq === -1 ? pair : pair.slice(0, eq)
    const value = eq === -1 ? '' : pair.slice(eq + 1)
    if (key) out.set(key, value)
  }
  return out
}

function decodeField(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function num(x: number): string {
  const r = Math.round(x * 1e6) / 1e6
  return String(r)
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

function finite(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback
  const v = Number(raw.replace(',', '.'))
  return Number.isFinite(v) ? v : fallback
}

function encodeName(name: string): string {
  return encodeURIComponent(name).replace(/~/g, '%7E')
}

function encodeAnchor(a: RateAnchor): string {
  return a.kind === 'date' ? a.value : `m${Math.round(a.months)}`
}

function decodeAnchor(raw: string): RateAnchor | null {
  if (ISO_RE.test(raw)) return { kind: 'date', value: raw }
  if (raw.startsWith('m')) {
    const months = Number(raw.slice(1))
    if (Number.isFinite(months)) return { kind: 'offset', months: Math.round(months) }
  }
  return null
}

export function encodeState(s: AppState): string {
  const points = s.points
    .map((p) => `${encodeAnchor(p.anchor)}~${num(p.rate)}`)
    .join(';')

  const bonds = s.bonds
    .map((b) =>
      [
        b.kind === 'floater' ? 'f' : 'x',
        encodeName(b.name),
        num(b.pricePct),
        num(b.freq),
        num(b.spreadPct),
        num(b.lag),
        num(b.couponPct),
        num(b.colorIndex),
      ].join('~'),
    )
    .join(';')

  return [
    `v=${STATE_VERSION}`,
    `s=${s.startDate}`,
    `h=${num(s.horizon)}`,
    `r=${num(s.reinvSpreadPct)}`,
    `m=${s.mode === 'linear' ? 'l' : 's'}`,
    `p=${points}`,
    `b=${bonds}`,
  ].join('&')
}

function parsePoints(raw: string | undefined): RatePoint[] | null {
  if (!raw) return null
  const out: RatePoint[] = []
  for (const chunk of raw.split(';')) {
    if (!chunk) continue
    const parts = chunk.split('~')
    const anchor = decodeAnchor(parts[0] ?? '')
    if (!anchor) continue
    const rate = finite(parts[1], Number.NaN)
    if (!Number.isFinite(rate)) continue
    out.push({
      id: newId(),
      anchor,
      rate: clamp(rate, LIMITS.rate.min, LIMITS.rate.max),
      confidence: confidenceFor(anchor),
    })
  }
  return out.length ? out : null
}

function parseBonds(raw: string | undefined): BondInput[] | null {
  if (!raw) return null
  const out: BondInput[] = []
  for (const chunk of raw.split(';')) {
    if (!chunk) continue
    const p = chunk.split('~')
    const kind = p[0] === 'f' ? 'floater' : p[0] === 'x' ? 'fixed' : null
    if (!kind) continue

    const name = decodeField(p[1] ?? '')

    const pricePct = clamp(finite(p[2], 100), LIMITS.pricePct.min, LIMITS.pricePct.max)
    const freq = normalizeFreq(Math.round(finite(p[3], 4)))

    out.push({
      id: newId('b'),
      name: name.slice(0, 40) || (kind === 'floater' ? 'Флоатер' : 'Фикс'),
      kind,
      pricePct,
      freq,
      spreadPct: clamp(finite(p[4], 0), LIMITS.spreadPct.min, LIMITS.spreadPct.max),
      lag: clamp(Math.round(finite(p[5], 0)), LIMITS.lag.min, LIMITS.lag.max),
      couponPct: clamp(finite(p[6], 0), LIMITS.couponPct.min, LIMITS.couponPct.max),
      colorIndex: clamp(Math.round(finite(p[7], 1)), 1, SERIES_COUNT),
    })
  }
  return out.length ? out : null
}

export function decodeState(query: string, fallback: AppState = defaultState()): AppState {
  const q = parseQuery(query)

  // Версия читается, но пока единственная. Чужая версия — полный откат на дефолт:
  // угадывать чужую раскладку хуже, чем показать рабочее состояние.
  const v = q.get('v')
  if (v !== undefined && v !== String(STATE_VERSION)) return fallback

  const startRaw = q.get('s')
  const startDate = startRaw && ISO_RE.test(startRaw) ? startRaw : fallback.startDate

  const modeRaw = q.get('m')
  const mode: InterpMode = modeRaw === 'l' ? 'linear' : modeRaw === 's' ? 'step' : fallback.mode

  return {
    startDate,
    horizon: clamp(Math.round(finite(q.get('h'), fallback.horizon)), MIN_HORIZON, MAX_HORIZON),
    reinvSpreadPct: clamp(
      finite(q.get('r'), fallback.reinvSpreadPct),
      LIMITS.reinvSpreadPct.min,
      LIMITS.reinvSpreadPct.max,
    ),
    mode,
    points: parsePoints(q.get('p')) ?? fallback.points,
    bonds: parseBonds(q.get('b')) ?? fallback.bonds,
  }
}

/** Разобранный query — для тестов и отладки. */
export { parseQuery }

/** Пустой query — это первый заход, а не битое состояние. */
export function hasState(query: string): boolean {
  const clean = query.startsWith('?') ? query.slice(1) : query
  return clean.length > 0
}
