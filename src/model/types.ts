/**
 * Типы модели. Ни одного импорта React, ни одного обращения к DOM —
 * это условие тестируемости всего каталога src/model.
 */

/** Номинал. Всегда 1000, во всех расчётах. */
export const FACE = 1000

/**
 * Режим интерполяции траектории ключевой ставки.
 * 'step'   — ступенчато: ставка держится до следующего заседания. Так и работает ЦБ.
 * 'linear' — линейная интерполяция. Физически неверно, оставлено опцией.
 */
export type InterpMode = 'step' | 'linear'

/** Привязка точки траектории: либо календарная дата, либо сдвиг «через N месяцев». */
export type RateAnchor =
  | { kind: 'date'; value: string } // ISO, YYYY-MM-DD
  | { kind: 'offset'; months: number }

export type Confidence = 'confirmed' | 'estimated'

/** Точка прогноза в пользовательском представлении. */
export type RatePoint = {
  id: string
  anchor: RateAnchor
  /** Ключевая ставка в процентах: 14.0, не 0.14. */
  rate: number
  confidence: Confidence
}

export type RatePath = RatePoint[]

/**
 * Точка траектории, приведённая к индексу месяца от даты старта.
 * Внутреннее представление модели, всегда отсортировано по m.
 */
export type ResolvedPoint = { m: number; r: number }

export type BondKind = 'floater' | 'fixed'

/**
 * Бумага. Обратите внимание на единицы: цена и «купонов в год» — как в стакане,
 * а ставочные поля (spread, couponRate) — в долях, ровно как в reference/ref.py.
 * Преобразование процентов в доли живёт на границе состояния UI, не здесь.
 */
export type Bond = {
  id: string
  name: string
  kind: BondKind
  /** Цена в процентах от номинала: 100.2. Строго больше нуля. */
  pricePct: number
  /** Купонов в год: 12, 4, 2. */
  freq: number
  /** Флоатер: спред к ключевой, доля. 0.015 — это КС + 1.5 п.п. */
  spread: number
  /** Флоатер: лаг установления купона в месяцах. */
  lag: number
  /** Фикс: купон годовых, доля. 0.155 — это 15.5%. Ноль — дисконтная бумага. */
  couponRate: number
}

/*
 * Цвета здесь сознательно нет. Оформление — дело UI: цвет серии хранится
 * в BondInput как индекс и разворачивается в токен темы через useThemeTokens.
 * Строка вида 'var(--series-1)' в модели однажды доехала бы до пропса Recharts,
 * который var() не понимает, и линия просто исчезла бы.
 */

/** Всё, что нужно движку помимо самой бумаги. */
export type CalcContext = {
  /** Отсортированная по m траектория. Пустой быть не может. */
  path: ResolvedPoint[]
  /** Срок до погашения в месяцах, общий для всех бумаг. */
  H: number
  /** Спред денежного рынка к ключевой, доля. 0.01 — это КС + 1 п.п. */
  reinvSpread: number
  /** Параллельный сдвиг всей траектории в п.п. Для сценарного анализа. */
  shift: number
  mode: InterpMode
}

export type Coupon = { month: number; amount: number }

export type CalcResult = {
  bondId: string
  /** Цена в рублях на номинал 1000. */
  price: number
  coupons: Coupon[]
  /** Первый купон. Ноль, если купонов нет вовсе. */
  firstCoupon: number
  /** Накопленные и реинвестированные купоны на момент H. */
  pot: number
  /** FACE + pot. */
  fv: number
  /** Доходность годовых, доля. 0.163611 — это 16.3611%. */
  annualReturn: number
}
