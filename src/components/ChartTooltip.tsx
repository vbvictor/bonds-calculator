type Item = {
  dataKey?: string | number
  value?: number | string | Array<number | string>
  color?: string
}

export type ChartTooltipProps = {
  active?: boolean
  payload?: Item[]
  label?: number | string
  /** Заголовок подсказки по значению оси X. */
  head: (label: number) => string
  /** Как показать значение ряда. */
  format: (value: number, key: string) => string
  /** Человеческое имя ряда по его ключу. */
  nameOf: (key: string) => string
}

/**
 * Своя подсказка: дефолтная в Recharts не умеет русскую локаль чисел
 * и печатает 1575.518 вместо 1 575,52.
 */
export function ChartTooltip({ active, payload, label, head, format, nameOf }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const x = typeof label === 'number' ? label : Number(label)

  return (
    <div className="tip">
      <div className="tip-head num">{head(Number.isFinite(x) ? x : 0)}</div>
      {payload.map((item, i) => {
        const key = String(item.dataKey ?? '')
        const value = typeof item.value === 'number' ? item.value : Number(item.value)
        if (!Number.isFinite(value)) return null
        return (
          <div className="tip-row" key={`${key}-${i}`}>
            <i className="sw" style={{ background: item.color }} />
            <span>{nameOf(key)}</span>
            <b className="num">{format(value, key)}</b>
          </div>
        )
      })}
    </div>
  )
}
