import type { BondKind, InterpMode, RatePoint } from '../model/types'

/**
 * Бумага в пользовательском представлении: все ставочные поля в процентах,
 * ровно как их вводят. В доли перевод один раз, в toBond.
 */
export type BondInput = {
  id: string
  name: string
  kind: BondKind
  /** Цена в процентах от номинала. Строго больше нуля, проверяется на вводе. */
  pricePct: number
  freq: number
  /** Флоатер: спред к ключевой, п.п. */
  spreadPct: number
  /** Флоатер: лаг установления купона, месяцев. */
  lag: number
  /** Фикс: купон годовых, проценты. Ноль — дисконтная бумага. */
  couponPct: number
  /** Индекс цвета серии, 1..6. Токен --series-N. */
  colorIndex: number
}

export type AppState = {
  /** Дата старта расчёта, ISO. Месяц 0. */
  startDate: string
  /** Срок до погашения в месяцах, общий для всех бумаг. */
  horizon: number
  /** Реинвестирование: ключевая плюс, п.п. */
  reinvSpreadPct: number
  mode: InterpMode
  points: RatePoint[]
  bonds: BondInput[]
}
