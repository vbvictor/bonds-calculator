import { FREQS, LIMITS } from '../state/defaults'
import type { AppState, BondInput } from '../state/types'
import type { AppActions } from '../state/useAppState'
import { useThemeTokens, seriesToken } from './useThemeTokens'
import { NumberField } from './NumberField'

type Props = { state: AppState; actions: AppActions }

export function BondsEditor({ state, actions }: Props) {
  const tokens = useThemeTokens()

  return (
    <>
      <div className="cards">
        {state.bonds.map((b) => (
          <BondCard
            key={b.id}
            bond={b}
            color={tokens[seriesToken(b.colorIndex)]}
            canRemove={state.bonds.length > 1}
            actions={actions}
          />
        ))}
      </div>

      <div className="row-actions">
        <button type="button" className="pill" onClick={() => actions.addBond('floater')}>
          Добавить флоатер
        </button>
        <button type="button" className="pill" onClick={() => actions.addBond('fixed')}>
          Добавить фикс
        </button>
      </div>
    </>
  )
}

function BondCard({
  bond,
  color,
  canRemove,
  actions,
}: {
  bond: BondInput
  color: string
  canRemove: boolean
  actions: AppActions
}) {
  const set = (p: Partial<BondInput>) => actions.setBond(bond.id, p)

  return (
    <div className="card">
      <h3>
        <i style={{ background: color }} />
        <input
          className="name"
          value={bond.name}
          maxLength={40}
          aria-label="название бумаги"
          onChange={(e) => set({ name: e.target.value })}
        />
        {canRemove ? (
          <button
            type="button"
            className="rm"
            aria-label={`удалить ${bond.name}`}
            onClick={() => actions.removeBond(bond.id)}
          >
            ×
          </button>
        ) : null}
      </h3>

      <div className="f">
        <label htmlFor={`kind-${bond.id}`}>Тип</label>
        <select
          id={`kind-${bond.id}`}
          value={bond.kind}
          onChange={(e) => set({ kind: e.target.value === 'floater' ? 'floater' : 'fixed' })}
        >
          <option value="floater">Флоатер — купон по ключевой</option>
          <option value="fixed">Фикс — постоянный купон</option>
        </select>
      </div>

      {bond.kind === 'floater' ? (
        <div className="two">
          <NumberField
            label="Спред к КС, п.п."
            value={bond.spreadPct}
            min={LIMITS.spreadPct.min}
            max={LIMITS.spreadPct.max}
            step={0.1}
            invalidHint={`от ${LIMITS.spreadPct.min} до ${LIMITS.spreadPct.max}`}
            onChange={(spreadPct) => set({ spreadPct })}
          />
          <NumberField
            label="Лаг купона, мес."
            value={bond.lag}
            min={LIMITS.lag.min}
            max={LIMITS.lag.max}
            step={1}
            invalidHint={`от 0 до ${LIMITS.lag.max}`}
            onChange={(v) => set({ lag: Math.round(v) })}
          />
        </div>
      ) : (
        <NumberField
          label="Купон, % годовых (0 — дисконтная)"
          value={bond.couponPct}
          min={LIMITS.couponPct.min}
          max={LIMITS.couponPct.max}
          step={0.1}
          invalidHint="купон не может быть отрицательным"
          onChange={(couponPct) => set({ couponPct })}
        />
      )}

      <div className="two">
        <NumberField
          label="Цена, % номинала"
          value={bond.pricePct}
          min={LIMITS.pricePct.min}
          max={LIMITS.pricePct.max}
          step={0.05}
          invalidHint="цена должна быть больше нуля"
          onChange={(pricePct) => set({ pricePct })}
        />
        <div className="f">
          <label htmlFor={`freq-${bond.id}`}>Купонов в год</label>
          <select
            id={`freq-${bond.id}`}
            value={bond.freq}
            onChange={(e) => set({ freq: Number(e.target.value) })}
          >
            {FREQS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
