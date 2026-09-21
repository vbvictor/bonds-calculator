import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SWEEP_FROM, SWEEP_TO } from '../model/scenarios'
import type { Computed } from '../state/selectors'
import type { AppState } from '../state/types'
import { num, pctRaw, pp } from './format'
import { ChartTooltip } from './ChartTooltip'
import { seriesToken, useThemeTokens } from './useThemeTokens'

type Props = { state: AppState; computed: Computed }

// Деления выводятся из границ свипа, чтобы не разъехаться с ними при правке.
const TICKS = Array.from(
  { length: Math.round(SWEEP_TO - SWEEP_FROM) + 1 },
  (_, i) => SWEEP_FROM + i,
)

export function SensitivityChart({ state, computed }: Props) {
  const tokens = useThemeTokens()
  const nameOf = (key: string) => state.bonds.find((b) => b.id === key)?.name ?? key
  const axis = { fill: tokens['--ink-faint'], fontSize: 11 }
  const cross = computed.switchPoint

  return (
    <>
      <div className="chartbox">
        <div className="chart-inner">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={computed.sweepRows}
              margin={{ top: 22, right: 12, bottom: 24, left: 0 }}
            >
              <CartesianGrid stroke={tokens['--rule']} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="shift"
                type="number"
                domain={[SWEEP_FROM, SWEEP_TO]}
                ticks={TICKS}
                tick={axis}
                tickLine={false}
                stroke={tokens['--rule']}
                tickFormatter={(v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`}
                label={{
                  value: 'параллельный сдвиг всей траектории, п.п.',
                  position: 'insideBottom',
                  offset: -16,
                  fill: tokens['--ink-faint'],
                  fontSize: 12,
                }}
              />
              <YAxis
                tick={axis}
                tickLine={false}
                axisLine={false}
                width={52}
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => num(v, 1)}
              />
              <Tooltip
                cursor={{ stroke: tokens['--rule'] }}
                content={
                  <ChartTooltip
                    head={(s) => `сдвиг ${pp(s, 1)}`}
                    nameOf={nameOf}
                    format={(v) => pctRaw(v)}
                  />
                }
              />

              <ReferenceLine
                x={0}
                stroke={tokens['--ink-faint']}
                strokeDasharray="2 3"
                label={{
                  value: 'ваш прогноз',
                  position: 'insideTopLeft',
                  fill: tokens['--ink-faint'],
                  fontSize: 11,
                }}
              />

              {cross ? (
                <ReferenceLine
                  x={cross.shift}
                  stroke={tokens['--ink']}
                  strokeDasharray="3 3"
                  label={{
                    value: `смена лидера ${pp(cross.shift)}`,
                    position: 'top',
                    fill: tokens['--ink'],
                    fontSize: 12,
                  }}
                />
              ) : null}

              {state.bonds.map((b) => (
                <Line
                  key={b.id}
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
      </div>
    </>
  )
}
