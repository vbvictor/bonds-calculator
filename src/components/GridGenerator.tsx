import { useState } from 'react'
import { generateGrid } from '../model/generator'
import { CALENDAR_CHECKED_AT } from '../model/cbrCalendar'
import type { AppState } from '../state/types'
import type { AppActions } from '../state/useAppState'
import { NumberField } from './NumberField'

type Props = { state: AppState; actions: AppActions }

/**
 * Генератор сетки точек. Результат — обычные строки таблицы: после применения
 * генератор о них ничего не помнит, каждую можно править поштучно.
 */
export function GridGenerator({ state, actions }: Props) {
  const [rhythm, setRhythm] = useState<'cbr' | 'every'>('cbr')
  const [every, setEvery] = useState(3)
  const [count, setCount] = useState(8)
  const [stepPct, setStepPct] = useState(-0.5)
  const [limit, setLimit] = useState(8)

  const startRate = state.points[0]?.rate ?? 14

  const apply = () => {
    actions.replacePoints(
      generateGrid({
        startIso: state.startDate,
        startRate,
        cadence: rhythm === 'cbr' ? 'cbr' : every,
        count,
        stepPct,
        limit,
      }),
    )
  }

  return (
    <details className="panel generator">
      <summary>Сгенерировать сетку точек</summary>

      <div className="gen-grid">
        <div className="f">
          <label htmlFor="gen-cadence">Ритм</label>
          <select
            id="gen-cadence"
            value={rhythm}
            onChange={(e) => setRhythm(e.target.value === 'cbr' ? 'cbr' : 'every')}
          >
            <option value="cbr">Как у ЦБ, 8 раз в год</option>
            <option value="every">Каждые N месяцев</option>
          </select>
        </div>

        {rhythm === 'cbr' ? null : (
          <NumberField
            label="N месяцев"
            value={every}
            min={1}
            max={24}
            step={1}
            onChange={(v) => setEvery(Math.round(v))}
          />
        )}

        <NumberField label="Точек" value={count} min={0} max={40} step={1} onChange={(v) => setCount(Math.round(v))} />
        <NumberField label="Шаг ставки, п.п." value={stepPct} min={-10} max={10} step={0.25} onChange={setStepPct} />
        <NumberField
          label={stepPct > 0 ? 'Потолок, %' : 'Пол, %'}
          value={limit}
          min={-10}
          max={100}
          step={0.5}
          onChange={setLimit}
        />
      </div>

      <div className="row-actions">
        <button type="button" className="pill" onClick={apply}>
          Заменить траекторию
        </button>
        <span className="badge">
          старт {startRate}% · календарь ЦБ сверен {CALENDAR_CHECKED_AT}
        </span>
      </div>
    </details>
  )
}
