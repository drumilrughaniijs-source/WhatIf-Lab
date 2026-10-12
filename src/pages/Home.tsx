import { useRef, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Bookmark, Clock, Compass, FlaskConical } from 'lucide-react'
import { LivePreview } from '../components/LivePreview'
import { SimCard } from '../components/SimCard'
import { EmptyState, LinkButton } from '../components/ui'
import { CATEGORIES } from '../lib/categories'
import { href } from '../lib/router'
import { useRecent, useSaved } from '../lib/storage'
import { CORE_SIMS, SIMS, simById } from '../sims/registry'

function timeAgo(t: number) {
  const s = (Date.now() - t) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

export function SectionHeading({ eyebrow, title, action, id }: { eyebrow: string; title: string; action?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-brand uppercase">{eyebrow}</p>
        <h2 id={id} className="mt-2 text-2xl font-semibold tracking-tight sm:text-[28px]">
          {title}
        </h2>
      </div>
      {action}
    </div>
  )
}

export function Home() {
  const previewRef = useRef<HTMLDivElement>(null)
  const recent = useRecent()
  const saved = useSaved()
  const recentSims = recent.map((r) => ({ sim: simById(r.id), at: r.at })).filter((r) => r.sim) as { sim: NonNullable<ReturnType<typeof simById>>; at: number }[]

  const startExperimenting = () => {
    const el = previewRef.current
    if (!el) return
    el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    el.focus({ preventScroll: true })
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* ------------------------------------------------------------ Hero */}
      <section className="grid items-center gap-10 pt-12 pb-16 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-24" aria-labelledby="hero-title">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-1 font-mono text-[11px] text-fg-muted">
            <FlaskConical size={12} className="text-brand" aria-hidden />
            {SIMS.length} simulations · {CATEGORIES.length} categories · runs in your browser
          </span>
          <h1 id="hero-title" className="mt-6 text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[56px]">
            What if you could <span className="text-brand">experiment</span> with reality?
          </h1>
          <p className="mt-5 text-lg text-fg-muted sm:text-xl">Change one variable. Discover another reality.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startExperimenting}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:brightness-110"
            >
              Start Experimenting <ArrowRight size={16} aria-hidden />
            </button>
            <a
              href={href.explore()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-5 py-2.5 text-sm font-medium text-fg transition hover:border-white/20 hover:bg-white/[0.05]"
            >
              <Compass size={16} aria-hidden /> Explore Simulations
            </a>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }}>
          <LivePreview ref={previewRef} />
        </motion.div>
      </section>

      {/* ------------------------------------------------------ Categories */}
      <section className="scroll-mt-24" aria-labelledby="categories-title">
        <SectionHeading id="categories-title" eyebrow="Categories" title="Choose a field to explore" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CATEGORIES.map((c) => {
            const count = SIMS.filter((s) => s.category === c.id).length
            return (
              <a
                key={c.id}
                href={href.explore({ category: c.id })}
                className="group flex flex-col rounded-xl border border-white/[0.07] bg-ink-900 p-4 transition-colors hover:border-white/[0.15]"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08]" style={{ color: c.accent }}>
                  <c.icon size={18} aria-hidden />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{c.name}</h3>
                <p className="mt-1 flex-1 text-[13px] leading-relaxed text-fg-muted">{c.blurb}</p>
                <span className="mt-4 flex items-center gap-1 text-xs text-fg-subtle transition-colors group-hover:text-fg">
                  {count} simulation{count === 1 ? '' : 's'} <ArrowRight size={12} aria-hidden />
                </span>
              </a>
            )
          })}
        </div>
      </section>

      {/* --------------------------------------------------------- Featured */}
      <section className="mt-20" aria-labelledby="featured-title">
        <SectionHeading
          id="featured-title"
          eyebrow="Featured"
          title="Core experiments"
          action={
            <a href={href.explore()} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">
              Browse all {SIMS.length} <ArrowRight size={14} aria-hidden />
            </a>
          }
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {CORE_SIMS.map((s, i) => (
            <SimCard key={s.id} sim={s} index={i} />
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- Recent */}
      <section className="mt-20" aria-labelledby="recent-title">
        <SectionHeading
          id="recent-title"
          eyebrow="Continue"
          title="Recently used experiments"
          action={
            saved.items.length > 0 ? (
              <a href={href.saved()} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline">
                <Bookmark size={14} aria-hidden /> {saved.items.length} saved experiment{saved.items.length === 1 ? '' : 's'}
              </a>
            ) : undefined
          }
        />
        <div className="mt-8">
          {recentSims.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recentSims.slice(0, 3).map((r, i) => (
                <SimCard key={r.sim.id} sim={r.sim} index={i} note={`Opened ${timeAgo(r.at)}`} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Clock size={20} />}
              title="Nothing here yet"
              action={
                <LinkButton href={href.explore()} variant="primary">
                  Find an experiment
                </LinkButton>
              }
            >
              Experiments you open will appear here so you can pick up where you left off. This history is stored only in this browser.
            </EmptyState>
          )}
        </div>
      </section>
    </div>
  )
}
