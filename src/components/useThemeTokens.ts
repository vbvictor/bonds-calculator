import { useSyncExternalStore } from 'react'

/**
 * Токены темы, прочитанные из CSS-переменных.
 *
 * Recharts не понимает var(--x) в пропсах — цвет надо отдавать вычисленным
 * значением. Читаем через getComputedStyle и перечитываем при смене темы:
 * и системной (matchMedia), и ручной (атрибут data-theme).
 *
 * Хранилище одно на всё приложение, а не по копии на компонент: иначе каждый
 * график заводил бы свой MutationObserver и свою подписку на matchMedia, и все
 * они читали бы одни и те же переменные. Плюс так графики и легенды гарантированно
 * перекрашиваются одним кадром.
 */

export const TOKEN_NAMES = [
  '--ink',
  '--ink-soft',
  '--ink-faint',
  '--rule',
  '--panel',
  '--ground',
  '--ks',
  '--win',
  '--lose',
  '--series-1',
  '--series-2',
  '--series-3',
  '--series-4',
  '--series-5',
  '--series-6',
] as const

export type TokenName = (typeof TOKEN_NAMES)[number]
export type ThemeTokens = Record<TokenName, string>

const FALLBACK: ThemeTokens = {
  '--ink': '#0e2a33',
  '--ink-soft': '#4f6b74',
  '--ink-faint': '#7e969d',
  '--rule': '#cbd5d4',
  '--panel': '#ffffff',
  '--ground': '#eef1f0',
  '--ks': '#9aa9ac',
  '--win': '#1f7a4d',
  '--lose': '#b0432c',
  '--series-1': '#2b7a8c',
  '--series-2': '#b5731a',
  '--series-3': '#6b4e9b',
  '--series-4': '#1f7a4d',
  '--series-5': '#b0432c',
  '--series-6': '#3b6ea5',
}

function readTokens(): ThemeTokens {
  if (typeof window === 'undefined') return FALLBACK
  const cs = getComputedStyle(document.documentElement)
  const out = { ...FALLBACK }
  for (const name of TOKEN_NAMES) {
    const v = cs.getPropertyValue(name).trim()
    if (v) out[name] = v
  }
  return out
}

function same(a: ThemeTokens, b: ThemeTokens): boolean {
  return TOKEN_NAMES.every((n) => a[n] === b[n])
}

// Ссылка на снимок должна меняться только когда поменялись сами значения:
// useSyncExternalStore сравнивает снимки по ссылке и иначе зациклится.
let snapshot: ThemeTokens = FALLBACK
const listeners = new Set<() => void>()
let teardown: (() => void) | null = null

function refresh(): void {
  const next = readTokens()
  if (same(next, snapshot)) return
  snapshot = next
  for (const l of listeners) l()
}

function start(): void {
  // matchMedia есть не везде (jsdom, старые вебвью) — без него просто
  // не подписываемся на смену системной темы, всё остальное работает.
  const mq =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null
  mq?.addEventListener('change', refresh)

  const observer = new MutationObserver(refresh)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })

  // Шрифты и стили могут доехать позже первого кадра.
  const settle = window.setTimeout(refresh, 60)

  teardown = () => {
    mq?.removeEventListener('change', refresh)
    observer.disconnect()
    window.clearTimeout(settle)
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  if (listeners.size === 1) {
    start()
    refresh()
  }
  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0) {
      teardown?.()
      teardown = null
    }
  }
}

export function useThemeTokens(): ThemeTokens {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => FALLBACK,
  )
}

export function seriesToken(index: number): TokenName {
  const clamped = Math.min(6, Math.max(1, Math.round(index)))
  return `--series-${clamped}` as TokenName
}
