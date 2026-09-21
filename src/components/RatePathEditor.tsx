import { LIMITS, MAX_HORIZON } from '../state/defaults'
import type { AppActions } from '../state/useAppState'
import type { AppState } from '../state/types'
import { addMonths, anchorToMonth } from '../model/rates'
import { monthLabel } from './format'
import { NumberField } from './NumberField'

type Props = {
  state: AppState
  actions: AppActions
}

/**
 * Таблица опорных точек прогноза.
 *
 * Даты вводятся свободно: любая дата допустима, включая несовпадающую
 * с реальным заседанием. Не исправляем и не подсвечиваем как ошибку —
 * пометка «заседание» это просто справка, а не валидация.
 */
export function RatePathEditor({ state, actions }: Props) {
  return (
    <>
      <div className="panel">
        <table className="path">
          <thead>
            <tr>
              <th style={{ width: '52%' }}>Когда</th>
              <th style={{ width: '32%' }}>Ключевая ставка, %</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {state.points.map((p) => {
              const m = anchorToMonth(p.anchor, state.startDate)
              const known = Number.isFinite(m)
              return (
                <tr key={p.id}>
                  <td>
                    <div className="anchor-cell">
                      <div className="mini-toggle" role="group" aria-label="вид привязки">
                        <button
                          type="button"
                          aria-pressed={p.anchor.kind === 'date'}
                          onClick={() =>
                            actions.setPoint(p.id, {
                              anchor: {
                                kind: 'date',
                                // Позиция сохраняется: сдвиг переводится в дату
                                // того же месяца, а не сбрасывается на старт.
                                value:
                                  p.anchor.kind === 'date'
                                    ? p.anchor.value
                                    : addMonths(state.startDate, p.anchor.months),
                              },
                            })
                          }
                        >
                          дата
                        </button>
                        <button
                          type="button"
                          aria-pressed={p.anchor.kind === 'offset'}
                          onClick={() =>
                            actions.setPoint(p.id, {
                              anchor: { kind: 'offset', months: known ? Math.max(0, m) : 0 },
                            })
                          }
                        >
                          через N мес.
                        </button>
                      </div>

                      {p.anchor.kind === 'date' ? (
                        <input
                          type="date"
                          value={p.anchor.value}
                          aria-label="дата заседания"
                          onChange={(e) =>
                            actions.setPoint(p.id, {
                              anchor: { kind: 'date', value: e.target.value },
                            })
                          }
                        />
                      ) : (
                        <NumberField
                          className="anchor-num"
                          value={p.anchor.months}
                          min={-120}
                          max={MAX_HORIZON}
                          step={1}
                          ariaLabel="месяцев от старта"
                          onChange={(v) =>
                            actions.setPoint(p.id, {
                              anchor: { kind: 'offset', months: Math.round(v) },
                            })
                          }
                        />
                      )}

                      <span
                        className={`badge${p.confidence === 'confirmed' ? ' confirmed' : ''}`}
                        title={
                          p.confidence === 'confirmed'
                            ? 'Подтверждённая дата заседания ЦБ'
                            : 'Ваша оценка'
                        }
                      >
                        {p.confidence === 'confirmed' ? 'заседание' : 'оценка'}
                      </span>
                      <span className="badge">
                        {known ? `м. ${m} · ${monthLabel(m, state.startDate)}` : 'дата не задана'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <NumberField
                      value={p.rate}
                      min={LIMITS.rate.min}
                      max={LIMITS.rate.max}
                      step={0.25}
                      ariaLabel="ключевая ставка"
                      onChange={(rate) => actions.setPoint(p.id, { rate })}
                    />
                  </td>
                  <td>
                    {state.points.length > 1 ? (
                      <button
                        type="button"
                        className="rm"
                        aria-label="удалить точку"
                        onClick={() => actions.removePoint(p.id)}
                      >
                        ×
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="row-actions">
        <button type="button" className="pill" onClick={actions.addPoint}>
          Добавить точку
        </button>
      </div>
    </>
  )
}
