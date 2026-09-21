import { MAX_HORIZON, MIN_HORIZON, LIMITS } from '../state/defaults'
import type { AppState } from '../state/types'
import type { AppActions } from '../state/useAppState'
import { monthLabel } from './format'
import { NumberField } from './NumberField'

type Props = { state: AppState; actions: AppActions }

export function CommonParams({ state, actions }: Props) {
  return (
    <div className="cards">
      <div className="card">
        <h3>Горизонт</h3>
        <NumberField
          label="Срок до погашения, месяцев"
          value={state.horizon}
          min={MIN_HORIZON}
          max={MAX_HORIZON}
          step={1}
          invalidHint={`от ${MIN_HORIZON} до ${MAX_HORIZON}`}
          onChange={(v) => actions.patch({ horizon: Math.round(v) })}
        />
        <div className="f">
          <label htmlFor="start-date">Дата старта расчёта — это месяц 0</label>
          <input
            id="start-date"
            type="date"
            value={state.startDate}
            onChange={(e) => actions.patch({ startDate: e.target.value })}
          />
          <span className="hint">погашение: {monthLabel(state.horizon, state.startDate)}</span>
        </div>
      </div>

      <div className="card">
        <h3>Реинвестирование</h3>
        <NumberField
          label="Ключевая плюс, п.п."
          value={state.reinvSpreadPct}
          min={LIMITS.reinvSpreadPct.min}
          max={LIMITS.reinvSpreadPct.max}
          step={0.1}
          invalidHint={`от ${LIMITS.reinvSpreadPct.min} до ${LIMITS.reinvSpreadPct.max}`}
          onChange={(v) => actions.patch({ reinvSpreadPct: v })}
        />
        <p className="note">
          Ставка, под которую кладётся каждый пришедший купон. Помесячная номинальная
          капитализация — как в фондах денежного рынка.
        </p>
      </div>

      <div className="card">
        <h3>Между точками</h3>
        <div className="f">
          <label htmlFor="mode">Как ведёт себя ставка</label>
          <select
            id="mode"
            value={state.mode}
            onChange={(e) => actions.patch({ mode: e.target.value === 'linear' ? 'linear' : 'step' })}
          >
            <option value="step">Ступенчато — держится до заседания</option>
            <option value="linear">Линейно — плавный переход</option>
          </select>
        </div>
        <p className="note">
          Ступенчатый режим соответствует тому, как ставка меняется на самом деле:
          скачком, в день заседания. Линейный оставлен как опция и обычно завышает
          преимущество фикса.
        </p>
      </div>
    </div>
  )
}
