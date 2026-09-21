// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ChartTooltip } from './ChartTooltip'
import { monthLabel, num, pctRaw } from './format'

afterEach(cleanup)

/**
 * Графики в jsdom не размечаются (ширина нулевая), поэтому подсказку
 * проверяем отдельно: она и есть то место, ради которого дефолтный
 * Tooltip Recharts был заменён своим.
 */
describe('своя подсказка графика', () => {
  const props = {
    head: (m: number) => `${m} мес. · ${monthLabel(m, '2026-09-21')}`,
    nameOf: (key: string) => (key === 'ks' ? 'Ключевая ставка' : 'Флоатер'),
    format: (v: number, key: string) => (key === 'ks' ? pctRaw(v) : num(v, 3)),
  }

  it('печатает числа по-русски, с запятой', () => {
    render(
      <ChartTooltip
        {...props}
        active
        label={18}
        payload={[
          { dataKey: 'f', value: 1.234567, color: '#2b7a8c' },
          { dataKey: 'ks', value: 12.5, color: '#9aa9ac' },
        ]}
      />,
    )
    expect(screen.getByText('18 мес. · мар 2028')).toBeTruthy()
    expect(screen.getByText('1,235')).toBeTruthy()
    expect(screen.getByText('12,50%')).toBeTruthy()
    expect(screen.getByText('Ключевая ставка')).toBeTruthy()
  })

  it('молчит, пока курсор не на графике', () => {
    const { container } = render(<ChartTooltip {...props} payload={[{ dataKey: 'f', value: 1 }]} />)
    expect(container.firstChild).toBeNull()
  })

  it('пустой payload ничего не рисует', () => {
    const { container } = render(<ChartTooltip {...props} active payload={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('нечисловое значение ряда пропускается, а не печатается как NaN', () => {
    render(
      <ChartTooltip
        {...props}
        active
        label={0}
        payload={[
          { dataKey: 'f', value: undefined },
          { dataKey: 'ks', value: 14 },
        ]}
      />,
    )
    expect(screen.queryByText(/NaN/)).toBeNull()
    expect(screen.getByText('14,00%')).toBeTruthy()
  })
})
