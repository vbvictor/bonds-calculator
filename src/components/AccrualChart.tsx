import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Computed } from '../state/selectors'
import type { AppState } from '../state/types'
import { monthLabel, num, pctRaw } from './format'
import { ChartTooltip } from './ChartTooltip'
import { seriesToken, useThemeTokens } from './useThemeTokens'

type Props = { state: AppState; computed: Computed }

export function AccrualChart({ state, computed }: Props) {
  const tokens = useThemeTokens()
  const nameOf = (key: string) =>
    key === 'ks' ? 'Ключевая ставка' : (state.bonds.find((b) => b.id === key)?.name ?? key)

  const axis = { fill: tokens['--ink-faint'], fontSize: 11 }

  return (
    <>
      <div className="chartbox">
        {/* ResponsiveContainer внутри overflow-x:auto зацикливается на измерении,
            поэтому обёртка с явными min-width и height в пикселях. */}
        <div className="chart-inner">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={computed.accrual} margin={{ top: 12, right: 12, bottom: 24, left: 0 }}>
              <CartesianGrid stroke={tokens['--rule']} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="m"
                type="number"
                domain={[0, state.horizon]}
                tick={axis}
                tickLine={false}
                stroke={tokens['--rule']}
                tickFormatter={(v: number) => `${v}м`}
                label={{
                  value: 'месяцев от даты старта',
                  position: 'insideBottom',
                  offset: -16,
                  fill: tokens['--ink-faint'],
                  fontSize: 12,
                }}
              />
              <YAxis
                yAxisId="left"
                tick={axis}
                tickLine={false}
                axisLine={false}
                width={52}
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => num(v, 2)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={axis}
                tickLine={false}
                axisLine={false}
                width={46}
                domain={['dataMin - 1', 'dataMax + 1']}
                tickFormatter={(v: number) => num(v, 1)}
              />
              <Tooltip
                cursor={{ stroke: tokens['--rule'] }}
                content={
                  <ChartTooltip
                    head={(m) => `${m} мес. · ${monthLabel(m, state.startDate)}`}
                    nameOf={nameOf}
                    format={(v, key) => (key === 'ks' ? pctRaw(v) : num(v, 3))}
                  />
                }
              />

              {/* Ставка рисуется stepAfter: на полке она стоит, а не едет наклоном. */}
              <Line
                yAxisId="right"
                dataKey="ks"
                type="stepAfter"
                stroke={tokens['--ks']}
                strokeWidth={1.8}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />

              {state.bonds.map((b) => (
                <Line
                  key={b.id}
                  yAxisId="left"
                  dataKey={b.id}
                  type="monotone"
                  stroke={tokens[seriesToken(b.colorIndex)]}
                  strokeWidth={2.4}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="legend">
        {state.bonds.map((b) => (
          <span key={b.id}>
            <i className="sw" style={{ background: tokens[seriesToken(b.colorIndex)] }} />
            {b.name}
          </span>
        ))}
        <span>
          <i className="sw dash" style={{ borderTopColor: tokens['--ks'] }} />
          Ключевая ставка (правая шкала)
        </span>
      </div>
    </>
  )
}
