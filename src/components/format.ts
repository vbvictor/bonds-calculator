/**
 * Форматирование чисел по-русски. Дефолтный Tooltip Recharts русскую локаль
 * не умеет, поэтому всё числовое в приложении проходит через эти функции.
 */

export function num(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return '—'
  return x.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** Доля → проценты: 0.163611 → «16,36%». */
export function pct(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return '—'
  return `${num(x * 100, digits)}%`
}

/** Уже проценты → проценты: 12.2027 → «12,20%». */
export function pctRaw(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return '—'
  return `${num(x, digits)}%`
}

/** Пункты со знаком: 1.4216 → «+1,42 п.п.». */
export function pp(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return '—'
  return `${x > 0 ? '+' : x < 0 ? '−' : ''}${num(Math.abs(x), digits)} п.п.`
}

export function money(x: number): string {
  if (!Number.isFinite(x)) return '—'
  return `${Math.round(x).toLocaleString('ru-RU')} ₽`
}

const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
]

/** Месяц N от даты старта → «мар 2028». Разбор ручной, без Date и часовых поясов. */
export function monthLabel(m: number, startIso: string): string {
  const mt = /^(\d{4})-(\d{2})-\d{2}$/.exec(startIso)
  if (!mt) return `${m} мес.`
  const total = Number(mt[1]) * 12 + (Number(mt[2]) - 1) + Math.round(m)
  const year = Math.floor(total / 12)
  const month = total % 12
  return `${MONTHS_SHORT[month] ?? '?'} ${year}`
}

/** «через 18 мес.» с правильным склонением. */
export function monthsAway(m: number): string {
  const n = Math.abs(Math.round(m))
  const last = n % 10
  const tens = n % 100
  const word = tens >= 11 && tens <= 14 ? 'месяцев' : last === 1 ? 'месяц' : last >= 2 && last <= 4 ? 'месяца' : 'месяцев'
  return `${n} ${word}`
}
