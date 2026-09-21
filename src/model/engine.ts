import { ksAt } from './rates'
import { FACE, type Bond, type CalcContext, type CalcResult, type Coupon } from './types'

/**
 * Шаг купона в месяцах. step = round(12 / freq).
 * Снизу ограничен единицей: шаг ноль дал бы бесконечный цикл, а помесячная
 * модель всё равно не различает выплаты чаще раза в месяц.
 */
export function couponStep(freq: number): number {
  const step = Math.round(12 / freq)
  return Number.isFinite(step) && step >= 1 ? step : 1
}

/** Ставка денежного рынка на месяце t, доля: ключевая плюс спред реинвестирования. */
export function rMM(t: number, ctx: CalcContext): number {
  return ksAt(ctx.path, t, ctx.shift, ctx.mode) / 100 + ctx.reinvSpread
}

/**
 * Помесячные множители наращения, длина H: f[t] = 1 + rMM(t) / 12.
 *
 * Капитализация номинальная — годовая ставка делится на 12, корень двенадцатой
 * степени не извлекается. Так работают фонды денежного рынка.
 *
 * Это только кэш: значения и порядок умножений те же, что в grow, поэтому
 * результат побитово совпадает. Нужен, чтобы не пересчитывать ksAt по разу
 * на каждый купон на каждом узле сценарного свипа.
 */
export function monthlyFactors(ctx: CalcContext): number[] {
  const f = new Array<number>(Math.max(0, ctx.H))
  for (let t = 0; t < ctx.H; t++) f[t] = 1 + rMM(t, ctx) / 12
  return f
}

function growWith(amount: number, from: number, H: number, f: readonly number[]): number {
  let v = amount
  for (let t = from; t < H; t++) v *= f[t]!
  return v
}

/**
 * Наращение суммы по ставке денежного рынка от месяца from до погашения.
 *
 * Цикл идёт до H - 1 включительно: купон, пришедший ровно в месяц H,
 * не растёт вообще.
 */
export function grow(amount: number, from: number, ctx: CalcContext): number {
  let v = amount
  for (let t = from; t < ctx.H; t++) {
    v *= 1 + rMM(t, ctx) / 12
  }
  return v
}

/** Купон, выпадающий на месяц m. Для флоатера ставка берётся на начало периода с лагом. */
function couponAt(bond: Bond, m: number, step: number, ctx: CalcContext): number {
  if (bond.kind === 'floater') {
    const setMonth = Math.max(0, m - step - bond.lag)
    const rate = ksAt(ctx.path, setMonth, ctx.shift, ctx.mode) / 100 + bond.spread
    return (FACE * rate) / bond.freq
  }
  return (FACE * bond.couponRate) / bond.freq
}

/** Выплаты в месяцы step, 2*step, ... включительно до H. */
export function couponSchedule(bond: Bond, ctx: CalcContext): Coupon[] {
  const step = couponStep(bond.freq)
  const out: Coupon[] = []
  for (let m = step; m <= ctx.H; m += step) {
    out.push({ month: m, amount: couponAt(bond, m, step, ctx) })
  }
  return out
}

/** Цена в рублях на номинал 1000. */
export function priceOf(bond: Bond): number {
  return (bond.pricePct / 100) * FACE
}

export function calcBond(bond: Bond, ctx: CalcContext, factors?: readonly number[]): CalcResult {
  const f = factors ?? monthlyFactors(ctx)
  const coupons = couponSchedule(bond, ctx)

  let pot = 0
  for (const c of coupons) pot += growWith(c.amount, c.month, ctx.H, f)

  const fv = FACE + pot
  const price = priceOf(bond)
  const annualReturn = Math.pow(fv / price, 12 / ctx.H) - 1

  return {
    bondId: bond.id,
    price,
    coupons,
    firstCoupon: coupons[0]?.amount ?? 0,
    pot,
    fv,
    annualReturn,
  }
}

/**
 * Помесячный ряд «стоимость позиции / вложенная сумма», длина H + 1.
 * Одним проходом, а не повторными вызовами grow.
 * Последний элемент обязан совпадать с fv / price — это проверяется тестом.
 */
export function calcSeries(bond: Bond, ctx: CalcContext, factors?: readonly number[]): number[] {
  const f = factors ?? monthlyFactors(ctx)
  const coupons = couponSchedule(bond, ctx)
  const price = priceOf(bond)
  const out = new Array<number>(ctx.H + 1)

  let pot = 0
  let i = 0
  for (let t = 0; t <= ctx.H; t++) {
    if (t > 0) pot *= f[t - 1]!
    while (i < coupons.length && coupons[i]!.month === t) {
      pot += coupons[i]!.amount
      i++
    }
    out[t] = (FACE + pot) / price
  }
  return out
}

export function calcAll(bonds: readonly Bond[], ctx: CalcContext): CalcResult[] {
  const f = monthlyFactors(ctx)
  return bonds.map((b) => calcBond(b, ctx, f))
}
