import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { newId } from '../model/generator'
import { anchorToMonth } from '../model/rates'
import type { RatePoint } from '../model/types'
import {
  STORAGE_KEY,
  confidenceFor,
  defaultFixed,
  defaultFloater,
  defaultState,
  SERIES_COUNT,
} from './defaults'
import type { AppState, BondInput } from './types'
import { decodeState, encodeState, hasState } from './url'

/**
 * Единственный источник состояния. URL приоритетнее localStorage,
 * localStorage — дубль на случай, если ссылку открыли без параметров.
 * Обращения к хранилищу обёрнуты в try/catch: приватный режим Safari
 * бросает на записи, и это не повод ронять приложение.
 */

function readStorage(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return decodeState(raw, defaultState())
  } catch {
    return null
  }
}

function writeStorage(query: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, query)
  } catch {
    /* приватный режим, переполненное хранилище — молча живём дальше */
  }
}

function initialState(): AppState {
  const fallback = defaultState()
  if (typeof window === 'undefined') return fallback
  if (hasState(window.location.search)) return decodeState(window.location.search, fallback)
  return readStorage() ?? fallback
}

export type AppActions = {
  patch: (p: Partial<AppState>) => void
  setPoint: (id: string, p: Partial<RatePoint>) => void
  addPoint: () => void
  removePoint: (id: string) => void
  replacePoints: (points: RatePoint[]) => void
  setBond: (id: string, p: Partial<BondInput>) => void
  addBond: (kind: BondInput['kind']) => void
  removeBond: (id: string) => void
  reset: () => void
}

export function useAppState(): [AppState, AppActions] {
  const [state, setState] = useState<AppState>(initialState)
  const first = useRef(true)

  // Состояние в URL и в localStorage. replaceState, а не pushState:
  // каждое нажатие на стрелку в поле ввода не должно плодить запись в истории.
  useEffect(() => {
    const query = encodeState(state)
    writeStorage(query)
    if (first.current) {
      first.current = false
      if (hasState(window.location.search)) return
    }
    const url = `${window.location.pathname}?${query}${window.location.hash}`
    window.history.replaceState(null, '', url)
  }, [state])

  const actions = useMemo<AppActions>(() => {
    const patch: AppActions['patch'] = (p) => setState((s) => ({ ...s, ...p }))

    return {
      patch,

      setPoint: (id, p) =>
        setState((s) => ({
          ...s,
          points: s.points.map((pt) => {
            if (pt.id !== id) return pt
            const next = { ...pt, ...p }
            // Пометка «подтверждено» выводится из привязки, руками её не ставят.
            return { ...next, confidence: confidenceFor(next.anchor) }
          }),
        })),

      // Новая точка встаёт за самой поздней по месяцу, а не за последней строкой
      // таблицы: строки не отсортированы, и последняя вполне может оказаться
      // раньше других — тогда добавленная точка втыкалась бы в середину
      // траектории со ставкой, списанной у случайного соседа.
      addPoint: () =>
        setState((s) => {
          let latest: RatePoint | null = null
          let latestMonth = -Infinity
          for (const p of s.points) {
            const m = anchorToMonth(p.anchor, s.startDate)
            if (Number.isFinite(m) && m >= latestMonth) {
              latestMonth = m
              latest = p
            }
          }
          const base = Number.isFinite(latestMonth) ? latestMonth : 0
          const anchor = { kind: 'offset' as const, months: Math.max(0, base) + 6 }
          return {
            ...s,
            points: [
              ...s.points,
              {
                id: newId(),
                anchor,
                rate: Math.max(0, (latest?.rate ?? 14) - 0.5),
                confidence: confidenceFor(anchor),
              },
            ],
          }
        }),

      removePoint: (id) =>
        setState((s) =>
          s.points.length <= 1 ? s : { ...s, points: s.points.filter((p) => p.id !== id) },
        ),

      replacePoints: (points) => setState((s) => ({ ...s, points })),

      setBond: (id, p) =>
        setState((s) => ({
          ...s,
          bonds: s.bonds.map((b) => (b.id === id ? { ...b, ...p } : b)),
        })),

      addBond: (kind) =>
        setState((s) => {
          const used = new Set(s.bonds.map((b) => b.colorIndex))
          let colorIndex = 1
          for (let i = 1; i <= SERIES_COUNT; i++) {
            if (!used.has(i)) {
              colorIndex = i
              break
            }
          }
          const base = kind === 'floater' ? defaultFloater() : defaultFixed()
          const sameKind = s.bonds.filter((b) => b.kind === kind).length
          return {
            ...s,
            bonds: [
              ...s.bonds,
              { ...base, colorIndex, name: sameKind ? `${base.name} ${sameKind + 1}` : base.name },
            ],
          }
        }),

      removeBond: (id) =>
        setState((s) =>
          s.bonds.length <= 1 ? s : { ...s, bonds: s.bonds.filter((b) => b.id !== id) },
        ),

      reset: () => setState(defaultState()),
    }
  }, [])

  return [state, actions]
}

/** Тема: системная по умолчанию, ручной выбор живёт в data-theme и localStorage. */
export type ThemeChoice = 'system' | 'light' | 'dark'
const THEME_KEY = 'bond-rate-calculator:theme'

export function useTheme(): [ThemeChoice, (t: ThemeChoice) => void] {
  const [theme, setThemeState] = useState<ThemeChoice>(() => {
    try {
      const raw = localStorage.getItem(THEME_KEY)
      return raw === 'light' || raw === 'dark' ? raw : 'system'
    } catch {
      return 'system'
    }
  })

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* не критично */
    }
  }, [theme])

  const setTheme = useCallback((t: ThemeChoice) => setThemeState(t), [])
  return [theme, setTheme]
}
