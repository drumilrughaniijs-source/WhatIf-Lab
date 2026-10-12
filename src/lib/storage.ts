import { useSyncExternalStore } from 'react'

/**
 * Browser-only persistence. Everything lives in this browser's localStorage:
 * nothing is sent anywhere and nothing syncs between devices.
 */

const SAVED_KEY = 'whatiflab:saved:v1'
const RECENT_KEY = 'whatiflab:recent:v1'
const CHANGE_EVENT = 'whatiflab:storage'
const MAX_RECENT = 8
const MAX_SAVED = 200

export type ParamValue = number | string | boolean
export type ParamMap = Record<string, ParamValue>

export interface SummaryItem {
  label: string
  value: string
}

export interface SavedExperiment {
  id: string
  name: string
  simId: string
  params: ParamMap
  summary: SummaryItem[]
  createdAt: number
}

export interface SavedState {
  items: SavedExperiment[]
  /** Entries that existed but failed validation and were skipped. */
  invalid: number
  /** The whole stored value could not be parsed. */
  corrupted: boolean
  /** localStorage is unavailable (private mode, disabled, sandboxed). */
  unavailable: boolean
}

/* ---------------------------------------------------------------- helpers */

function storageAvailable(): boolean {
  try {
    const k = '__whatiflab_probe__'
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

function readString(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeString(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value)
    window.dispatchEvent(new Event(CHANGE_EVENT))
    return true
  } catch {
    return false
  }
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === SAVED_KEY || e.key === RECENT_KEY || e.key === null) cb()
  }
  window.addEventListener(CHANGE_EVENT, cb)
  window.addEventListener('storage', onStorage) // other tabs
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb)
    window.removeEventListener('storage', onStorage)
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isParam = (v: unknown): v is ParamValue =>
  (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'string' || typeof v === 'boolean'

function validateExperiment(v: unknown): SavedExperiment | null {
  if (!isRecord(v)) return null
  const { id, name, simId, params, summary, createdAt } = v
  if (typeof id !== 'string' || !id) return null
  if (typeof name !== 'string' || !name.trim()) return null
  if (typeof simId !== 'string' || !simId) return null
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null
  if (!isRecord(params)) return null
  const cleanParams: ParamMap = {}
  for (const [k, pv] of Object.entries(params)) {
    if (!isParam(pv)) return null
    cleanParams[k] = pv
  }
  const cleanSummary: SummaryItem[] = Array.isArray(summary)
    ? summary.filter((s): s is SummaryItem => isRecord(s) && typeof s.label === 'string' && typeof s.value === 'string')
    : []
  return { id, name: name.slice(0, 120), simId, params: cleanParams, summary: cleanSummary, createdAt }
}

/* ------------------------------------------------------ saved experiments */

let savedCache: { raw: string | null; state: SavedState } | null = null

function parseSaved(raw: string | null): SavedState {
  const unavailable = !storageAvailable()
  if (raw === null) return { items: [], invalid: 0, corrupted: false, unavailable }
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { items: [], invalid: 0, corrupted: true, unavailable }
  }
  if (!Array.isArray(data)) return { items: [], invalid: 0, corrupted: true, unavailable }
  const items: SavedExperiment[] = []
  let invalid = 0
  for (const entry of data) {
    const ok = validateExperiment(entry)
    if (ok) items.push(ok)
    else invalid++
  }
  items.sort((a, b) => b.createdAt - a.createdAt)
  return { items, invalid, corrupted: false, unavailable }
}

export function getSaved(): SavedState {
  const raw = readString(SAVED_KEY)
  if (savedCache && savedCache.raw === raw) return savedCache.state
  savedCache = { raw, state: parseSaved(raw) }
  return savedCache.state
}

export function useSaved(): SavedState {
  return useSyncExternalStore(subscribe, getSaved, getSaved)
}

function newId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

export function saveExperiment(input: Omit<SavedExperiment, 'id' | 'createdAt'>): SavedExperiment | null {
  const entry: SavedExperiment = { ...input, name: input.name.trim().slice(0, 120), id: newId(), createdAt: Date.now() }
  const items = [entry, ...getSaved().items].slice(0, MAX_SAVED)
  return writeString(SAVED_KEY, JSON.stringify(items)) ? entry : null
}

export function deleteExperiment(id: string): boolean {
  return writeString(SAVED_KEY, JSON.stringify(getSaved().items.filter((e) => e.id !== id)))
}

export function renameExperiment(id: string, name: string): boolean {
  const clean = name.trim().slice(0, 120)
  if (!clean) return false
  return writeString(SAVED_KEY, JSON.stringify(getSaved().items.map((e) => (e.id === id ? { ...e, name: clean } : e))))
}

/** Rewrites storage with only the entries that passed validation. */
export function repairSaved(): boolean {
  return writeString(SAVED_KEY, JSON.stringify(getSaved().items))
}

export function clearSaved(): boolean {
  return writeString(SAVED_KEY, '[]')
}

export function findSaved(id: string): SavedExperiment | undefined {
  return getSaved().items.find((e) => e.id === id)
}

/* -------------------------------------------------------- recently opened */

export interface RecentEntry {
  id: string
  at: number
}

let recentCache: { raw: string | null; items: RecentEntry[] } | null = null

export function getRecent(): RecentEntry[] {
  const raw = readString(RECENT_KEY)
  if (recentCache && recentCache.raw === raw) return recentCache.items
  let items: RecentEntry[] = []
  try {
    const data: unknown = raw ? JSON.parse(raw) : []
    if (Array.isArray(data))
      items = data
        .filter((r): r is RecentEntry => isRecord(r) && typeof r.id === 'string' && typeof r.at === 'number')
        .slice(0, MAX_RECENT)
  } catch {
    items = []
  }
  recentCache = { raw, items }
  return items
}

export function useRecent(): RecentEntry[] {
  return useSyncExternalStore(subscribe, getRecent, getRecent)
}

export function markRecent(id: string) {
  const items = [{ id, at: Date.now() }, ...getRecent().filter((r) => r.id !== id)].slice(0, MAX_RECENT)
  writeString(RECENT_KEY, JSON.stringify(items))
}

export function clearRecent() {
  writeString(RECENT_KEY, '[]')
}
