import { useEffect, useId, useState } from 'react'

type Props = {
  label?: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  /** Сообщение, когда введённое не проходит проверку. */
  invalidHint?: string
  className?: string
  ariaLabel?: string
}

/**
 * Числовое поле с черновиком.
 *
 * Пересчёт немедленный, без кнопки, поэтому наверх уходит только валидное
 * значение. Промежуточные состояния ввода — пустая строка, один минус,
 * «12.» — живут в локальном черновике и модель не трогают. Значение вне
 * допустимого диапазона не применяется: так цена ≤ 0 блокируется на вводе
 * и в расчёт не попадает вовсе.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  invalidHint,
  className,
  ariaLabel,
}: Props) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const [bad, setBad] = useState(false)

  // Значение переехало снаружи (сброс, ссылка, генератор) — черновик больше не актуален.
  useEffect(() => {
    setDraft(null)
    setBad(false)
  }, [value])

  const shown = draft ?? String(value)

  const handle = (raw: string) => {
    setDraft(raw)
    const parsed = Number(raw.replace(',', '.'))
    const ok =
      raw.trim() !== '' &&
      Number.isFinite(parsed) &&
      (min === undefined || parsed >= min) &&
      (max === undefined || parsed <= max)
    setBad(!ok)
    if (ok && parsed !== value) onChange(parsed)
  }

  return (
    <div className={className ?? 'f'}>
      {label ? <label htmlFor={id}>{label}</label> : null}
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={shown}
        step={step ?? 'any'}
        min={min}
        max={max}
        aria-label={ariaLabel ?? label}
        aria-invalid={bad}
        onChange={(e) => handle(e.target.value)}
        onBlur={() => {
          setDraft(null)
          setBad(false)
        }}
      />
      {bad && invalidHint ? <span className="err">{invalidHint}</span> : null}
    </div>
  )
}
