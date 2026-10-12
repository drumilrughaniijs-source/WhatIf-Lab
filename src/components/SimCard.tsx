import { motion } from 'framer-motion'
import { ArrowRight, Signal, SignalHigh, SignalMedium } from 'lucide-react'
import { categoryById, type Level } from '../lib/categories'
import { href } from '../lib/router'
import type { SimMeta } from '../sims/registry'
import { SimPreview } from './SimPreview'

export function CategoryBadge({ id, size = 'sm' }: { id: string; size?: 'sm' | 'xs' }) {
  const c = categoryById(id)
  if (!c) return null
  const Icon = c.icon
  return (
    <span
      className={
        size === 'xs'
          ? 'inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-1.5 py-0.5 text-[11px] text-fg-muted'
          : 'inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-xs text-fg-muted'
      }
    >
      <Icon size={size === 'xs' ? 12 : 13} style={{ color: c.accent }} aria-hidden />
      {c.short}
    </span>
  )
}

const LEVEL_ICON: Record<Level, typeof Signal> = { Beginner: SignalMedium, Intermediate: SignalHigh, Advanced: Signal }

export function LevelBadge({ level }: { level: Level }) {
  const Icon = LEVEL_ICON[level]
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-fg-subtle">
      <Icon size={13} aria-hidden />
      {level}
    </span>
  )
}

export function SimCard({ sim, index = 0, note }: { sim: SimMeta; index?: number; note?: string }) {
  const c = categoryById(sim.category)
  const accent = c?.accent ?? '#22d3ee'
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.2) }}
      className="group flex flex-col rounded-xl border border-white/[0.07] bg-ink-900 p-4 transition-colors hover:border-white/[0.14]"
    >
      <a href={href.sim(sim.id)} tabIndex={-1} aria-hidden className="block">
        <SimPreview id={sim.id} accent={accent} />
      </a>
      <div className="mt-4 flex items-center justify-between gap-2">
        <CategoryBadge id={sim.category} />
        <LevelBadge level={sim.level} />
      </div>
      <h3 className="mt-3 text-[15px] font-semibold tracking-tight">{sim.title}</h3>
      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-fg-muted">{sim.summary}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="truncate text-[11px] text-fg-subtle">{note ?? sim.tags.slice(0, 2).join(' · ')}</span>
        <a
          href={href.sim(sim.id)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:border-brand/50 hover:bg-brand/10"
          aria-label={`Open experiment: ${sim.title}`}
        >
          Open experiment <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>
    </motion.article>
  )
}
