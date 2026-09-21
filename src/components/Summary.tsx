import type { Computed } from '../state/selectors'
import type { AppState } from '../state/types'
import { money, monthsAway, pct, pctRaw, pp } from './format'
import { seriesToken, useThemeTokens } from './useThemeTokens'

type Props = { state: AppState; computed: Computed }

/**
 * Сводка идёт сразу под шапкой, до всех форм: пользователь должен видеть ответ,
 * а не анкету.
 */
export function Summary({ state, computed }: Props) {
  const tokens = useThemeTokens()
  const { results, byId, ranking, leaderId, switchPoint, switchToId, indifference, avgKS } =
    computed

  const bondOf = (id: string | null | undefined) =>
    id ? state.bonds.find((b) => b.id === id) : undefined
  const retOf = (id: string | undefined) => {
    const r = id ? byId.get(id)?.annualReturn : undefined
    return Number.isFinite(r) ? (r as number) : Number.NaN
  }

  // Порядок берём из селектора, чтобы сводка и подсветка лидера не разъезжались.
  const leader = bondOf(ranking[0])
  const runnerUp = bondOf(ranking[1])
  const gap = (retOf(leader?.id) - retOf(runnerUp?.id)) * 100
  const tie = results.length > 1 && Math.abs(gap) < 0.03

  const nearest = indifference[0]
  const nearestBond = bondOf(nearest?.bondId)
  const switchTo = bondOf(switchToId)

  return (
    <div className="verdict">
      <div className="vtop">
        {state.bonds.map((b) => {
          const r = byId.get(b.id)
          const isLeader = b.id === leaderId && state.bonds.length > 1 && !tie
          return (
            <div key={b.id} className={`vcell${isLeader ? ' is-leader' : ''}`}>
              <div className="nm">
                <i style={{ background: tokens[seriesToken(b.colorIndex)] }} />
                {b.name}
                {isLeader ? <span className="crown">лидер</span> : null}
              </div>
              <div className="v num">{pct(r?.annualReturn ?? Number.NaN)}</div>
              <div className="sub num">
                итого {money(r?.fv ?? Number.NaN)} на 1000 номинала, вложено{' '}
                {money(r?.price ?? Number.NaN)}
              </div>
            </div>
          )
        })}
      </div>

      <div className="vbot">
        При вашей траектории средняя ключевая ставка за {monthsAway(state.horizon)} —{' '}
        <b className="num">{pctRaw(avgKS)}</b>.{' '}
        {!leader || !runnerUp ? (
          <>Добавьте вторую бумагу, чтобы появилось сравнение.</>
        ) : tie ? (
          <>
            <b>{leader.name}</b> и <b>{runnerUp.name}</b> практически равны — разница меньше
            3 базисных пунктов.
          </>
        ) : (
          <>
            Выигрывает <b className="w">{leader.name}</b>, преимущество над{' '}
            <b>{runnerUp.name}</b> — <b className="num">{pp(gap)}</b> годовых.
          </>
        )}
      </div>

      <div className="vbot">
        {switchPoint && switchTo ? (
          <>
            Победитель меняется, если вся траектория сдвинется на{' '}
            <b className="num">{pp(switchPoint.shift)}</b> — тогда впереди окажется{' '}
            <b>{switchTo.name}</b>.
            {nearest && nearestBond && switchTo.id !== nearestBond.id ? (
              <>
                {' '}
                Ближайшая точка безразличия с бумагой «{nearestBond.name}» —{' '}
                <b className="num">{pp(nearest.shift)}</b>.
              </>
            ) : null}
          </>
        ) : nearest && nearestBond ? (
          <>
            Точка безразличия с бумагой «{nearestBond.name}» —{' '}
            <b className="num">{pp(nearest.shift)}</b>.
          </>
        ) : (
          <>
            На всём диапазоне сдвигов от −6 до +2 п.п. победитель не меняется. Выбор
            устойчив к вашему прогнозу.
          </>
        )}
      </div>
    </div>
  )
}
