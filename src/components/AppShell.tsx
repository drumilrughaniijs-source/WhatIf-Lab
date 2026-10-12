import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, Compass, FlaskConical, Home, Info, Menu, Search, X } from 'lucide-react'
import { CATEGORIES } from '../lib/categories'
import { href, navigate, type Route } from '../lib/router'
import { useRecent, useSaved } from '../lib/storage'
import { SIMS, simById } from '../sims/registry'
import { cn } from './ui'

/* ------------------------------------------------------------------- Logo */

export function Logo() {
  return (
    <a href={href.home()} className="flex items-center gap-2.5" aria-label="WhatIf Lab home">
      <span className="grid h-8 w-8 place-items-center rounded-lg border border-brand/30 bg-brand/10">
        <FlaskConical size={16} className="text-brand" aria-hidden />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">
        WhatIf <span className="text-brand">Lab</span>
      </span>
    </a>
  )
}

/* ---------------------------------------------------------------- Sidebar */

function NavItem({ to, icon, label, active, badge }: { to: string; icon: ReactNode; label: string; active: boolean; badge?: number }) {
  return (
    <a
      href={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
        active ? 'bg-white/[0.06] text-fg' : 'text-fg-muted hover:bg-white/[0.03] hover:text-fg',
      )}
    >
      {active && <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-brand" />}
      {icon}
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">{badge}</span>
      )}
    </a>
  )
}

function SidebarContent({ route }: { route: Route }) {
  const saved = useSaved()
  const recent = useRecent()
  const activeCategory = route.name === 'explore' ? route.category : route.name === 'sim' ? simById(route.id)?.category : undefined
  const recentSims = recent
    .map((r) => simById(r.id))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .slice(0, 4)

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6" aria-label="Main">
        <div className="space-y-0.5">
          <NavItem to={href.home()} icon={<Home size={16} aria-hidden />} label="Home" active={route.name === 'home'} />
          <NavItem
            to={href.explore()}
            icon={<Compass size={16} aria-hidden />}
            label="Explore simulations"
            active={route.name === 'explore' && !route.category}
            badge={SIMS.length}
          />
          <NavItem to={href.saved()} icon={<Bookmark size={16} aria-hidden />} label="My Experiments" active={route.name === 'saved'} badge={saved.items.length} />
          <NavItem to={href.about()} icon={<Info size={16} aria-hidden />} label="About" active={route.name === 'about'} />
        </div>

        <div>
          <div className="px-3 pb-2 text-[10px] font-semibold tracking-[0.14em] text-fg-subtle uppercase">Categories</div>
          <div className="space-y-0.5">
            {CATEGORIES.map((c) => (
              <a
                key={c.id}
                href={href.explore({ category: c.id })}
                aria-current={activeCategory === c.id ? 'true' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors',
                  activeCategory === c.id ? 'bg-white/[0.06] text-fg' : 'text-fg-muted hover:bg-white/[0.03] hover:text-fg',
                )}
              >
                <c.icon size={15} style={{ color: c.accent }} aria-hidden />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="font-mono text-[10px] text-fg-subtle">{SIMS.filter((s) => s.category === c.id).length}</span>
              </a>
            ))}
          </div>
        </div>

        {recentSims.length > 0 && (
          <div>
            <div className="px-3 pb-2 text-[10px] font-semibold tracking-[0.14em] text-fg-subtle uppercase">Recently opened</div>
            <div className="space-y-0.5">
              {recentSims.map((s) => (
                <a
                  key={s.id}
                  href={href.sim(s.id)}
                  className={cn(
                    'block truncate rounded-lg px-3 py-1.5 text-[13px] transition-colors',
                    route.name === 'sim' && route.id === s.id ? 'bg-white/[0.06] text-fg' : 'text-fg-muted hover:bg-white/[0.03] hover:text-fg',
                  )}
                >
                  {s.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </nav>
      <div className="border-t border-white/[0.06] px-5 py-4 text-[11px] leading-relaxed text-fg-subtle">
        All calculations run in your browser. No account, no server.
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- Search */

function SearchBox() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const listId = 'global-search-results'

  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    return SIMS.filter((s) => [s.title, s.question, s.summary, ...s.tags, s.category].join(' ').toLowerCase().includes(t)).slice(0, 6)
  }, [q])

  useEffect(() => setActive(0), [q])

  // "/" focuses search from anywhere (except while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (to: string) => {
    navigate(to)
    setQ('')
    setOpen(false)
    input.current?.blur()
  }

  const total = results.length + (q.trim() ? 1 : 0) // + "see all results"

  return (
    <div className="relative w-full max-w-md">
      <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle" aria-hidden />
      <input
        ref={input}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(total - 1, a + 1)))
          if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(0, a - 1)))
          if (e.key === 'Escape') (setQ(''), input.current?.blur())
          if (e.key === 'Enter' && q.trim()) {
            e.preventDefault()
            if (active < results.length) go(href.sim(results[active].id))
            else go(href.explore({ q: q.trim() }))
          }
        }}
        placeholder="Search simulations…"
        aria-label="Search simulations"
        role="combobox"
        aria-expanded={open && !!q.trim()}
        aria-controls={listId}
        aria-activedescendant={open && q.trim() ? `search-opt-${active}` : undefined}
        className="h-9 w-full rounded-lg border border-white/[0.08] bg-ink-900 pr-10 pl-9 text-[13px] placeholder:text-fg-subtle focus:border-brand/50 focus:ring-2 focus:ring-brand/15 focus:outline-none"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-white/10 px-1.5 font-mono text-[10px] text-fg-subtle sm:block">/</kbd>
      <AnimatePresence>
        {open && q.trim() && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full right-0 left-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-white/10 bg-ink-850 py-1 shadow-2xl shadow-black/50"
          >
            {results.map((s, i) => (
              <li
                key={s.id}
                id={`search-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => (e.preventDefault(), go(href.sim(s.id)))}
                onMouseEnter={() => setActive(i)}
                className={cn('cursor-pointer px-3 py-2', i === active && 'bg-white/[0.06]')}
              >
                <div className="text-[13px] font-medium">{s.title}</div>
                <div className="truncate text-xs text-fg-subtle">{s.question}</div>
              </li>
            ))}
            {!results.length && <li className="px-3 py-2 text-[13px] text-fg-muted">No simulations match “{q.trim()}”.</li>}
            <li
              id={`search-opt-${results.length}`}
              role="option"
              aria-selected={active === results.length}
              onMouseDown={(e) => (e.preventDefault(), go(href.explore({ q: q.trim() })))}
              onMouseEnter={() => setActive(results.length)}
              className={cn('cursor-pointer border-t border-white/[0.06] px-3 py-2 text-xs text-brand', active === results.length && 'bg-white/[0.06]')}
            >
              Show all results in the explorer →
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

/* --------------------------------------------------------------- AppShell */

export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  const [drawer, setDrawer] = useState(false)
  const saved = useSaved()

  useEffect(() => setDrawer(false), [route])
  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [drawer])

  return (
    <div className="min-h-screen lg:pl-64">
      <a
        href="#main"
        onClick={(e) => (e.preventDefault(), document.getElementById('main')?.focus())}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-ink-950"
      >
        Skip to content
      </a>

      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/[0.06] bg-ink-950 lg:block">
        <SidebarContent route={route} />
      </aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
              aria-hidden
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-[61] w-72 max-w-[85vw] border-r border-white/[0.08] bg-ink-950 lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              aria-label="Navigation"
            >
              <button
                type="button"
                onClick={() => setDrawer(false)}
                className="absolute top-4 right-3 rounded-lg p-2 text-fg-muted hover:bg-white/5"
                aria-label="Close navigation"
                autoFocus
              >
                <X size={18} />
              </button>
              <SidebarContent route={route} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <button type="button" className="-ml-1 rounded-lg p-2 text-fg-muted hover:bg-white/5 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open navigation" aria-expanded={drawer}>
            <Menu size={20} />
          </button>
          <div className="lg:hidden">
            <a href={href.home()} aria-label="WhatIf Lab home" className="grid h-8 w-8 place-items-center rounded-lg border border-brand/30 bg-brand/10">
              <FlaskConical size={16} className="text-brand" aria-hidden />
            </a>
          </div>
          <SearchBox />
          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Quick links">
            <a href={href.explore()} className={cn('rounded-lg px-3 py-2 text-[13px] transition-colors', route.name === 'explore' ? 'text-fg' : 'text-fg-muted hover:text-fg')}>
              Explore
            </a>
            <a href={href.saved()} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] transition-colors', route.name === 'saved' ? 'text-fg' : 'text-fg-muted hover:text-fg')}>
              My Experiments
              {saved.items.length > 0 && <span className="rounded bg-brand/15 px-1.5 font-mono text-[10px] text-brand">{saved.items.length}</span>}
            </a>
          </nav>
          <a href={href.saved()} className="ml-auto rounded-lg p-2 text-fg-muted hover:bg-white/5 md:hidden" aria-label={`My Experiments (${saved.items.length})`}>
            <Bookmark size={18} />
          </a>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>

      <footer className="mt-24 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>WhatIf Lab · Simulations are simplified models for learning, not measurements or advice.</span>
          <span>No backend · No tracking · Data stays in this browser</span>
        </div>
      </footer>
    </div>
  )
}
