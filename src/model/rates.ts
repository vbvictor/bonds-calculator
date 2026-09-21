import type { InterpMode, RateAnchor, RatePoint, ResolvedPoint } from './types'

/**
 * Индекс месяца даты относительно даты старта.
 *
 *   m = (year(date) - year(start)) * 12 + (month(date) - month(start))
 *
 * Дробная часть отбрасывается сознательно: шаг модели — месяц, поэтому
 * 1 и 23 октября дают один и тот же индекс. Дата до старта даёт отрицательный m.
 *
 * Разбор строки ручной, без Date: конструктор Date трактует 'YYYY-MM-DD' как UTC
 * и в минусовых поясах сдвигает день на сутки назад.
 *
 * Неразобранная дата даёт NaN, а не ноль. Поле ввода даты отдаёт пустую строку,
 * пока дату не дописали до конца; ноль означал бы «месяц 0», и точка на глазах
 * у пользователя прыгала бы в начало траектории, переворачивая всю кривую.
 * NaN же отфильтровывается в resolvePath — точка просто ждёт, пока её дозаполнят.
 */
export function dateToMonth(iso: string, startIso: string): number {
  const a = parseIso(iso)
  const b = parseIso(startIso)
  if (!a || !b) return Number.NaN
  return (a.year - b.year) * 12 + (a.month - b.month)
}

function parseIso(iso: string): { year: number; month: number; day: number } | null {
  const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!mt) return null
  const year = Number(mt[1])
  const month = Number(mt[2])
  const day = Number(mt[3])
  if (!Number.isFinite(year) || month < 1 || month > 12) return null
  return { year, month, day }
}

/** Привязка точки, приведённая к индексу месяца. */
export function anchorToMonth(anchor: RateAnchor, startIso: string): number {
  return anchor.kind === 'date'
    ? dateToMonth(anchor.value, startIso)
    : Math.round(anchor.months)
}

/**
 * Пользовательская траектория → внутреннее представление.
 * Сортировка стабильная: при совпадении месяцев последняя введённая точка
 * оказывается правее и в режиме 'step' выигрывает.
 */
export function resolvePath(points: readonly RatePoint[], startIso: string): ResolvedPoint[] {
  const out = points
    .filter((p) => Number.isFinite(p.rate))
    .map((p) => ({ m: anchorToMonth(p.anchor, startIso), r: p.rate }))
    .filter((p) => Number.isFinite(p.m))
  out.sort((a, b) => a.m - b.m)
  return out
}

/**
 * Ключевая ставка на месяце m, в процентах, с параллельным сдвигом shift (п.п.).
 * За пределами траектории — плоское продолжение крайними точками.
 * Кусочно-постоянна и непрерывна справа.
 */
export function ksAt(
  path: readonly ResolvedPoint[],
  m: number,
  shift = 0,
  mode: InterpMode = 'step',
): number {
  const first = path[0]
  const last = path[path.length - 1]
  if (!first || !last) return shift
  if (m <= first.m) return first.r + shift
  if (m >= last.m) return last.r + shift

  if (mode === 'step') {
    let cur = first.r
    for (const p of path) {
      if (p.m <= m) cur = p.r
      else break
    }
    return cur + shift
  }

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    if (!a || !b) break
    if (a.m <= m && m <= b.m) {
      if (b.m === a.m) return b.r + shift
      const w = (m - a.m) / (b.m - a.m)
      return a.r + (b.r - a.r) * w + shift
    }
  }
  return first.r + shift
}

/** Средняя ключевая ставка за период, в процентах: Σ ksAt(t) по t от 0 до H включительно. */
export function avgKS(
  path: readonly ResolvedPoint[],
  H: number,
  shift = 0,
  mode: InterpMode = 'step',
): number {
  let s = 0
  for (let t = 0; t <= H; t++) s += ksAt(path, t, shift, mode)
  return s / (H + 1)
}

/** Помесячный ряд ключевой ставки для графика, длина H + 1. */
export function ksSeries(
  path: readonly ResolvedPoint[],
  H: number,
  shift = 0,
  mode: InterpMode = 'step',
): number[] {
  const out: number[] = []
  for (let t = 0; t <= H; t++) out.push(ksAt(path, t, shift, mode))
  return out
}

/** Прибавить месяцы к ISO-дате. День сохраняется, при переполнении месяца — последний день. */
export function addMonths(iso: string, months: number): string {
  const p = parseIso(iso)
  if (!p) return iso
  const total = p.year * 12 + (p.month - 1) + Math.round(months)
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  const day = Math.min(p.day, daysInMonth(year, month))
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0')
}

/** Сегодняшняя дата в ISO по местному календарю, без сдвига часовым поясом. */
export function todayIso(now: Date = new Date()): string {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`
}
