import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, BookmarkPlus, ChevronRight, FlaskRound, History, Loader2, RotateCcw, Ruler } from 'lucide-react'
import { CategoryBadge, LevelBadge, SimCard } from '../components/SimCard'
import { Button, Callout, Modal, Panel, toast } from '../components/ui'
import { categoryById } from '../lib/categories'
import { href, navigate } from '../lib/router'
import { SimParamsProvider, snapshotParams } from '../lib/simParams'
import { findSaved, markRecent, saveExperiment, type SavedExperiment } from '../lib/storage'
import { SIMS, simById } from '../sims/registry'
import { NotFound } from './NotFound'

class SimErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error)
      return (
        <Callout kind="crit" title="This simulation failed to load">
          <p>{this.state.error.message}</p>
          <button type="button" className="mt-2 text-brand hover:underline" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </Callout>
      )
    return this.props.children
  }
}

function Loading() {
  return (
    <div className="grid h-96 place-items-center rounded-xl border border-white/[0.06] bg-ink-900" role="status">
      <span className="flex items-center gap-2 text-sm text-fg-muted">
        <Loader2 size={16} className="animate-spin" aria-hidden /> Loading experiment…
      </span>
    </div>
  )
}

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function SimPage({ id, restore }: { id: string; restore?: string }) {
  const sim = simById(id)
  const [nonce, setNonce] = useState(0)
  const [saveOpen, setSaveOpen] = useState(false)
  const [name, setName] = useState('')
  const nameInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (sim) markRecent(sim.id)
  }, [sim])

  // Resolve the saved experiment (if any) once per restore id.
  const restored: SavedExperiment | null | undefined = useMemo(() => {
    if (!restore) return undefined
    const e = findSaved(restore)
    return e && e.simId === id ? e : null
  }, [restore, id])

  const providerKey = `${id}|${restore ?? ''}|${nonce}`
  const registry = useMemo(() => ({ current: new Map() }), [providerKey])

  if (!sim) return <NotFound />

  const cat = categoryById(sim.category)!
  const SimComponent = sim.component
  const idx = SIMS.indexOf(sim)
  const prev = SIMS[(idx - 1 + SIMS.length) % SIMS.length]
  const next = SIMS[(idx + 1) % SIMS.length]
  const related = SIMS.filter((s) => s.category === sim.category && s.id !== sim.id).slice(0, 3)

  const openSave = () => {
    setName(`${sim.title} · ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date())}`)
    setSaveOpen(true)
  }

  const doSave = () => {
    const clean = name.trim()
    if (!clean) return
    const { params, summary } = snapshotParams(registry.current)
    const saved = saveExperiment({ name: clean, simId: sim.id, params, summary })
    setSaveOpen(false)
    if (saved)
      toast(
        <span>
          Saved “{saved.name}”.{' '}
          <a href={href.saved()} className="text-brand hover:underline">
            View My Experiments
          </a>
        </span>,
      )
    else toast('Could not save: browser storage is unavailable or full.', 'crit')
  }

  const resetDefaults = () => {
    if (restore) navigate(href.sim(sim.id))
    setNonce((n) => n + 1)
    toast('Parameters reset to their defaults.', 'info')
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
      <nav className="flex items-center gap-1.5 text-[13px] text-fg-subtle" aria-label="Breadcrumb">
        <a href={href.explore()} className="hover:text-fg">
          Simulations
        </a>
        <ChevronRight size={13} aria-hidden />
        <a href={href.explore({ category: cat.id })} className="hover:text-fg">
          {cat.short}
        </a>
        <ChevronRight size={13} aria-hidden />
        <span className="truncate text-fg-muted" aria-current="page">
          {sim.title}
        </span>
      </nav>

      <header className="mt-5 mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <CategoryBadge id={sim.category} />
            <LevelBadge level={sim.level} />
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{sim.title}</h1>
          <p className="mt-2 max-w-3xl text-[15px] text-fg-muted sm:text-base">{sim.question}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={resetDefaults} title="Reset all parameters to their defaults">
            <RotateCcw size={15} /> Defaults
          </Button>
          <Button variant="primary" onClick={openSave}>
            <BookmarkPlus size={15} /> Save experiment
          </Button>
        </div>
      </header>

      {restored && (
        <Callout kind="ok" className="mb-5" title={`Restored “${restored.name}”`}>
          Saved {dateFmt.format(restored.createdAt)}.{' '}
          <a href={href.sim(sim.id)} className="text-brand hover:underline">
            Start fresh instead
          </a>
        </Callout>
      )}
      {restored === null && (
        <Callout kind="warn" className="mb-5" title="Saved experiment not found">
          It may have been deleted or saved in a different browser. The simulation opened with default settings.
        </Callout>
      )}

      <SimErrorBoundary key={providerKey}>
        <Suspense fallback={<Loading />}>
          <SimParamsProvider key={providerKey} initial={restored?.params ?? {}} registryRef={registry}>
            <SimComponent accent={cat.accent} />
          </SimParamsProvider>
        </Suspense>
      </SimErrorBoundary>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Panel title="The idea" icon={<BookOpen size={15} style={{ color: cat.accent }} aria-hidden />}>
          <p className="text-[14px] leading-relaxed text-fg-muted">{sim.concept}</p>
        </Panel>
        <Panel title="Try this" icon={<FlaskRound size={15} style={{ color: cat.accent }} aria-hidden />}>
          <ol className="space-y-3">
            {sim.tryThis.map((t, i) => (
              <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-fg-muted">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-white/10 font-mono text-[11px] text-fg">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="Model & assumptions" icon={<Ruler size={15} style={{ color: cat.accent }} aria-hidden />} className="lg:col-span-2">
          <ul className="space-y-2.5">
            {sim.model.map((m, i) => (
              <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-fg-muted">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-fg-subtle" aria-hidden />
                {m}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <nav className="mt-8 grid gap-3 sm:grid-cols-2" aria-label="Other experiments">
        <a href={href.sim(prev.id)} className="group rounded-xl border border-white/[0.07] bg-ink-900 p-4 transition-colors hover:border-white/15">
          <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <ArrowLeft size={13} aria-hidden /> Previous
          </span>
          <span className="mt-1 block text-sm font-medium">{prev.title}</span>
        </a>
        <a href={href.sim(next.id)} className="group rounded-xl border border-white/[0.07] bg-ink-900 p-4 text-right transition-colors hover:border-white/15">
          <span className="flex items-center justify-end gap-1.5 text-xs text-fg-subtle">
            Next <ArrowRight size={13} aria-hidden />
          </span>
          <span className="mt-1 block text-sm font-medium">{next.title}</span>
        </a>
      </nav>

      {related.length > 0 && (
        <section className="mt-16" aria-labelledby="related-title">
          <h2 id="related-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <History size={17} className="text-fg-subtle" aria-hidden /> More in {cat.name}
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {related.map((s, i) => (
              <SimCard key={s.id} sim={s} index={i} />
            ))}
          </div>
        </section>
      )}

      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Save experiment" initialFocus={nameInput}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            doSave()
          }}
          className="space-y-4"
        >
          <label className="block space-y-1.5">
            <span className="text-[13px] text-fg-muted">Name</span>
            <input
              ref={nameInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              className="h-9 w-full rounded-lg border border-white/10 bg-ink-950 px-3 text-[13px] focus:border-brand/50 focus:ring-2 focus:ring-brand/15 focus:outline-none"
            />
          </label>
          <p className="text-xs leading-relaxed text-fg-subtle">
            Saves the current parameters of this simulation. It is stored only in this browser (localStorage) and is not synchronised to other devices.
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!name.trim()}>
              <BookmarkPlus size={15} /> Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
