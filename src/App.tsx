import { useMemo } from 'react'
import { AccrualChart } from './components/AccrualChart'
import { BondsEditor } from './components/BondsEditor'
import { CommonParams } from './components/CommonParams'
import { Disclaimer } from './components/Disclaimer'
import { GridGenerator } from './components/GridGenerator'
import { RatePathEditor } from './components/RatePathEditor'
import { SensitivityChart } from './components/SensitivityChart'
import { Summary } from './components/Summary'
import { compute } from './state/selectors'
import { useAppState, useTheme, type ThemeChoice } from './state/useAppState'

const THEMES: Array<{ id: ThemeChoice; label: string }> = [
  { id: 'system', label: 'авто' },
  { id: 'light', label: 'светлая' },
  { id: 'dark', label: 'тёмная' },
]

export default function App() {
  const [state, actions] = useAppState()
  const [theme, setTheme] = useTheme()

  // Пересчёт немедленный, без кнопки «Рассчитать»: состояние поменялось — цифры новые.
  const computed = useMemo(() => compute(state), [state])

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <h1>Флоатер против фикса при вашей траектории ставки</h1>
          <p>
            Задайте, как по-вашему пойдёт ключевая ставка. Модель начислит купоны по каждой
            бумаге, переложит каждый купон под ставку денежного рынка и посчитает, кто в итоге
            дал больше.
          </p>
        </div>
        <div className="theme-toggle" role="group" aria-label="тема оформления">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={theme === t.id}
              onClick={() => setTheme(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <Summary state={state} computed={computed} />

      <section className="b">
        <h2>Траектория ключевой ставки</h2>
        <p className="sub">
          Опорные точки вашего прогноза. Ставка держится на полке и меняется скачком в дату
          точки. Дату можно ввести любую — совпадение с реальным заседанием ЦБ не требуется,
          пометка рядом просто подсказывает, что такое заседание действительно назначено.
        </p>
        <RatePathEditor state={state} actions={actions} />
        <GridGenerator state={state} actions={actions} />
      </section>

      <section className="b">
        <h2>Параметры бумаг</h2>
        <p className="sub">
          Цены в процентах от номинала, как в стакане. Срок до погашения общий для всех —
          сравнение идёт до погашения.
        </p>
        <BondsEditor state={state} actions={actions} />
      </section>

      <section className="b">
        <h2>Общие параметры</h2>
        <p className="sub">Действуют сразу на все бумаги.</p>
        <CommonParams state={state} actions={actions} />
        <div className="row-actions">
          <button type="button" className="pill ghost" onClick={actions.reset}>
            Сбросить всё к исходному
          </button>
        </div>
      </section>

      <section className="b">
        <h2>Как накапливается результат</h2>
        <p className="sub">
          Стоимость позиции, делённая на вложенную сумму. Старт выше или ниже единицы — это
          эффект покупки с дисконтом или премией.
        </p>
        <AccrualChart state={state} computed={computed} />
      </section>

      <section className="b">
        <h2>Где проходит граница</h2>
        <p className="sub">
          Вся ваша траектория сдвигается параллельно вверх или вниз. Точка пересечения — тот
          сценарий, при котором бумаги дают одинаковый результат.
        </p>
        <SensitivityChart state={state} computed={computed} />
      </section>

      <Disclaimer />
    </div>
  )
}
