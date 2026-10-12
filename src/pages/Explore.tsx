import { useMemo, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownUp, Search, SearchX, X } from 'lucide-react'
import { SimCard } from '../components/SimCard'
import { Button, EmptyState, cn } from '../components/ui'
import { CATEGORIES, LEVELS, type Level } from '../lib/categories'
import { href, replaceHash, type ExploreQuery } from '../lib/router'
import { useRecent } from '../lib/storage'
import { SIMS } from '../sims/registry'

const SORTS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'easy', label: 'Difficulty: easiest first' },
  { value: 'hard', label: 'Difficulty: hardest first' },
  { value: 'recent', label: 'Recently opened' },
] as const
type Sort = (typeof SORTS)[number]['value']

const isSort = (v?: string): v is Sort => SORTS.some((s) => s.value === v)
const isLevel = (v?: string): v is Level => (LEVELS as readonly string[]).includes(v ?? '')
const levelRank = (l: Level) => LEVELS.indexOf(l)

function Chip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: ReactNode; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs whitespace-nowrap transition-colors',
        active ? 'border-brand/50 bg-brand/10 text-fg' : 'border-white/[0.08] text-fg-muted hover:border-white/20 hover:text-fg',
      )}
    >
      {color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />}
      {children}
    </button>
  )
}

export function Explore(props: ExploreQuery) {
  // The URL is the single source of truth for filters, so links are shareable
  // and sidebar/search navigation can never fight with local state.
  const q = props.q ?? ''
  const category = CATEGORIES.some((c) => c.id === props.category) ? props.category : undefined
  const level: Level | undefined = isLevel(props.level) ? props.level : undefined
  const sort: Sort = isSort(props.sort) ? props.sort : 'recommended'
  const recent = useRecent()

  const update = (patch: { q?: string; category?: string; level?: Level; sort?: Sort }) => {
    const next = { q, category, level, sort, ...patch }
    replaceHash(href.explore({ q: next.q || undefined, category: next.category, level: next.level, sort: next.sort === 'recommended' ? undefined : next.sort }))
  }
  const setQ = (v: string) => update({ q: v })
  const setCategory = (v?: string) => update({ category: v })
  const setLevel = (v?: Level) => update({ level: v })
  const setSort = (v: Sort) => update({ sort: v })

  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = SIMS.filter(
      (s) =>
        (!category || s.category === category) &&
        (!level || s.level === level) &&
        (!t || [s.title, s.question, s.summary, ...s.tags].join(' ').toLowerCase().includes(t)),
    )
    const order = new Map(SIMS.map((s, i) => [s.id, i]))
    const recentAt = new Map(recent.map((r) => [r.id, r.at]))
    const sorted = [...list]
    if (sort === 'name') sorted.sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'easy') sorted.sort((a, b) => levelRank(a.level) - levelRank(b.level) || order.get(a.id)! - order.get(b.id)!)
    if (sort === 'hard') sorted.sort((a, b) => levelRank(b.level) - levelRank(a.level) || order.get(a.id)! - order.get(b.id)!)
    if (sort === 'recent') sorted.sort((a, b) => (recentAt.get(b.id) ?? 0) - (recentAt.get(a.id) ?? 0) || order.get(a.id)! - order.get(b.id)!)
    return sorted
  }, [q, category, level, sort, recent])

  const filtered = !!(q.trim() || category || level)
  const clear = () => update({ q: '', category: undefined, level: undefined })
  const activeCat = CATEGORIES.find((c) => c.id === category)

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-brand uppercase">Simulation library</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{activeCat ? activeCat.name : 'Explore simulations'}</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-fg-muted">
          {activeCat ? activeCat.blurb : 'Search, filter and sort every experiment. Each one runs entirely on your device.'}
        </p>
      </motion.header>

      <div className="mt-8 space-y-4 rounded-xl border border-white/[0.07] bg-ink-900 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative block flex-1">
            <span className="sr-only">Search simulations</span>
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, topic or question…"
              className="h-9 w-full rounded-lg border border-white/[0.08] bg-ink-950 pr-9 pl-9 text-[13px] placeholder:text-fg-subtle focus:border-brand/50 focus:ring-2 focus:ring-brand/15 focus:outline-none"
            />
            {q && (
              <button type="button" onClick={() => setQ('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-fg-subtle hover:text-fg" aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </label>
          <label className="relative flex items-center gap-2 text-xs text-fg-muted">
            <ArrowDownUp size={14} aria-hidden />
            <span className="sr-only">Sort by</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-9 rounded-lg border border-white/[0.08] bg-ink-950 px-3 text-[13px] text-fg focus:border-brand/50 focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:pb-0" role="group" aria-label="Filter by category">
            <Chip active={!category} onClick={() => setCategory(undefined)}>
              All categories
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c.id} active={category === c.id} onClick={() => setCategory(category === c.id ? undefined : c.id)} color={c.accent}>
                {c.name}
              </Chip>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Filter by difficulty">
            <Chip active={!level} onClick={() => setLevel(undefined)}>
              Any level
            </Chip>
            {LEVELS.map((l) => (
              <Chip key={l} active={level === l} onClick={() => setLevel(level === l ? undefined : l)}>
                {l}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between text-[13px] text-fg-muted" aria-live="polite">
        <span>
          Showing <span className="font-medium text-fg">{results.length}</span> of {SIMS.length} simulations
        </span>
        {filtered && (
          <button type="button" onClick={clear} className="text-brand hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {results.length ? (
        <motion.div layout className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {results.map((s, i) => (
              <SimCard key={s.id} sim={s} index={i} />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="mt-4">
          <EmptyState icon={<SearchX size={20} />} title="No simulations match these filters" action={<Button onClick={clear}>Clear filters</Button>}>
            {q.trim() ? `Nothing matches “${q.trim()}”` : 'No experiments match this combination'}
            {category || level ? ' with the selected filters.' : '.'} Try a broader search.
          </EmptyState>
        </div>
      )}
    </div>
  )
}
