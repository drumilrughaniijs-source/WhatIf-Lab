import { createContext, useContext, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { ParamMap, ParamValue, SummaryItem } from './storage'

/**
 * Each simulation declares its inputs with `useSimParam` instead of `useState`.
 * The provider can seed them from a saved experiment, and can read their
 * current values back out when the user saves.
 */

interface Registered {
  value: ParamValue
  label?: string
  display?: string
}

interface Ctx {
  initial: ParamMap
  current: Map<string, Registered>
}

const SimParamsContext = createContext<Ctx | null>(null)

export function SimParamsProvider({
  initial,
  registryRef,
  children,
}: {
  initial: ParamMap
  registryRef: { current: Map<string, Registered> }
  children: ReactNode
}) {
  const value = useRef<Ctx>({ initial, current: registryRef.current }).current
  return <SimParamsContext.Provider value={value}>{children}</SimParamsContext.Provider>
}

export function useParamRegistry() {
  return useRef(new Map<string, Registered>())
}

export function snapshotParams(reg: Map<string, Registered>): { params: ParamMap; summary: SummaryItem[] } {
  const params: ParamMap = {}
  const summary: SummaryItem[] = []
  for (const [k, r] of reg) {
    params[k] = r.value
    if (r.label) summary.push({ label: r.label, value: r.display ?? String(r.value) })
  }
  return { params, summary }
}

interface Options<T> {
  /** Human-readable label shown in "My Experiments". Omit to hide (e.g. random seeds). */
  label?: string
  format?: (v: T) => string
  min?: number
  max?: number
  oneOf?: readonly T[]
}

function sanitize<T extends ParamValue>(raw: unknown, def: T, o?: Options<T>): T {
  if (raw === undefined || typeof raw !== typeof def) return def
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return def
    let n = raw
    if (o?.min !== undefined) n = Math.max(o.min, n)
    if (o?.max !== undefined) n = Math.min(o.max, n)
    return n as T
  }
  if (o?.oneOf && !o.oneOf.includes(raw as T)) return def
  return raw as T
}

export function useSimParam(key: string, def: number | (() => number), options?: Options<number>): [number, Dispatch<SetStateAction<number>>]
export function useSimParam(key: string, def: boolean, options?: Options<boolean>): [boolean, Dispatch<SetStateAction<boolean>>]
export function useSimParam<T extends string>(key: string, def: T | (() => T), options?: Options<T>): [T, Dispatch<SetStateAction<T>>]
export function useSimParam<T extends ParamValue>(
  key: string,
  def: T | (() => T),
  options?: Options<T>,
): [T, Dispatch<SetStateAction<T>>] {
  const ctx = useContext(SimParamsContext)
  const [value, setValue] = useState<T>(() => {
    const d = typeof def === 'function' ? (def as () => T)() : def
    return sanitize(ctx?.initial[key], d, options)
  })
  // Record the live value so the page can snapshot it on save.
  ctx?.current.set(key, {
    value,
    label: options?.label,
    display: options?.label ? (options.format ? options.format(value) : String(value)) : undefined,
  })
  return [value, setValue]
}
