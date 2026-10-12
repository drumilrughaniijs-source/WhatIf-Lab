import { forwardRef, useId, useMemo, useRef, useState } from 'react'
import { ArrowRight, Coins, Cpu, MemoryStick, TrendingUp } from 'lucide-react'
import { SERIES } from '../lib/chart'
import { fmt } from '../lib/format'
import { cryptoUniform } from '../lib/random'
import { href } from '../lib/router'
import { simulateCompound } from '../models/compound'
import { simulateCpu } from '../models/cpu'
import { runExperiment } from '../models/probability'
import { simulateRam } from '../models/ram'
import { Button, Slider, cn } from './ui'

/**
 * Four miniature, fully working experiments for the home page. Each uses the
 * same model as its full simulation.
 */

type TabId = 'ram' | 'cpu' | 'compound' | 'coins'
const TABS: { id: TabId; label: string; icon: typeof Cpu; sim: string }[] = [
  { id: 'ram', label: 'Memory', icon: MemoryStick, sim: 'ram-pressure' },
  { id: 'cpu', label: 'CPU', icon: Cpu, sim: 'cpu-performance' },
  { id: 'compound', label: 'Interest', icon: TrendingUp, sim: 'compound-interest-lab' },
  { id: 'coins', label: 'Coins', icon: Coins, sim: 'probability-playground' },
]

function RamMini() {
  const [apps, setApps] = useState(9)
  const r = simulateRam({ capacityGB: 8, perAppMB: 700, apps, swap: 'ssd' })
  const scale = Math.max(8, r.demandGB)
  const color = r.pressure === 'critical' ? '#f87171' : r.pressure === 'high' ? '#fbbf24' : '#34d399'
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-fg-muted">What if you kept opening 700 MB apps on an 8 GB laptop?</p>
      <Slider label="Running apps" value={apps} min={0} max={16} onChange={setApps} />
      <div className="relative h-8 overflow-hidden rounded-md bg-ink-950 ring-1 ring-white/10">
        <div className="absolute inset-y-0 left-0 bg-[#8b93a7]" style={{ width: `${(r.osGB / scale) * 100}%` }} />
        <div className="absolute inset-y-0 bg-brand/90" style={{ left: `${(r.osGB / scale) * 100}%`, width: `${(Math.min(r.appsGB, 8 - r.osGB) / scale) * 100}%` }} />
        {r.overflowGB > 0 && <div className="hatch-crit absolute inset-y-0" style={{ left: `${(8 / scale) * 100}%`, right: 0 }} />}
        <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${(8 / scale) * 100}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Mini label="Utilisation" value={`${(r.utilization * 100).toFixed(0)}%`} />
        <Mini label="In swap" value={`${r.overflowGB.toFixed(1)} GB`} />
        <Mini label="Responsiveness" value={`${(r.performance * 100).toFixed(r.performance < 0.1 ? 1 : 0)}%`} color={color} />
      </div>
    </div>
  )
}

function CpuMini() {
  const [cores, setCores] = useState(8)
  const r = simulateCpu({ ghz: 3.5, cores, workG: 1000, parallel: 0.9 })
  const pts = useMemo(
    () => Array.from({ length: 64 }, (_, i) => simulateCpu({ ghz: 3.5, cores: i + 1, workG: 1000, parallel: 0.9 }).speedup),
    [],
  )
  const max = Math.max(...pts)
  const d = pts.map((s, i) => `${i ? 'L' : 'M'}${(i / 63) * 300},${70 - (s / max) * 62}`).join(' ')
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-fg-muted">What if a 90% parallel task got more cores?</p>
      <Slider label="Cores" value={cores} min={1} max={64} onChange={setCores} />
      <svg viewBox="0 0 300 74" className="h-16 w-full" aria-label="Speed-up curve">
        <path d={d} fill="none" stroke={SERIES[0]} strokeWidth={2} />
        <circle cx={((cores - 1) / 63) * 300} cy={70 - (r.speedup / max) * 62} r={4.5} fill={SERIES[0]} stroke="#0a0e18" strokeWidth={2} />
      </svg>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Mini label="Speed-up" value={`${r.speedup.toFixed(2)}×`} />
        <Mini label="Efficiency" value={`${(r.efficiency * 100).toFixed(0)}%`} />
        <Mini label="Run time" value={`${r.totalS.toFixed(1)} s`} />
      </div>
    </div>
  )
}

function CompoundMini() {
  const [years, setYears] = useState(30)
  const r = simulateCompound({ initial: 0, monthly: 200, ratePct: 7, years, frequency: 'monthly', timing: 'end' })
  const max = r.finalBalance || 1
  const d = [0, ...r.rows.map((row) => row.endBalance)].map((v, i) => `${i ? 'L' : 'M'}${(i / years) * 300},${70 - (v / max) * 62}`).join(' ')
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-fg-muted">What if you invested $200 a month at 7%?</p>
      <Slider label="Years" value={years} min={5} max={45} onChange={setYears} format={(v) => `${v} yr`} />
      <svg viewBox="0 0 300 74" className="h-16 w-full" aria-label="Balance growth curve">
        <path d={`${d} L300,72 L0,72 Z`} fill={SERIES[2]} opacity={0.2} />
        <path d={d} fill="none" stroke={SERIES[2]} strokeWidth={2} />
      </svg>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Mini label="You invest" value={fmt.moneyCompact(r.totalContributions)} />
        <Mini label="Interest" value={fmt.moneyCompact(r.totalInterest)} />
        <Mini label="Balance" value={fmt.moneyCompact(r.finalBalance)} />
      </div>
    </div>
  )
}

function CoinsMini() {
  const rand = useRef(cryptoUniform())
  const [results, setResults] = useState<number[]>([])
  const flip = () => setResults((rs) => [...rs, runExperiment('coin', 1000, rand.current).counts[0]].slice(-24))
  const last = results[results.length - 1]
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-fg-muted">What if you flipped 1,000 coins? Is it ever exactly 500 heads?</p>
      <Button variant="primary" onClick={flip} className="w-full">
        <Coins size={15} /> Flip 1,000 coins
      </Button>
      <div className="flex h-16 items-end gap-1" aria-label="Heads per batch">
        {results.length === 0 && <span className="m-auto text-xs text-fg-subtle">Each batch will appear here.</span>}
        {results.map((h, i) => (
          <div key={i} className="relative flex-1" title={`${h} heads`}>
            <div className="w-full rounded-t-sm" style={{ height: `${Math.max(4, ((h - 440) / 120) * 64)}px`, background: SERIES[0], opacity: i === results.length - 1 ? 1 : 0.5 }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Mini label="Last batch" value={last !== undefined ? `${last} H` : '—'} />
        <Mini label="Off by" value={last !== undefined ? `${Math.abs(last - 500)}` : '—'} />
        <Mini label="Batches" value={String(results.length)} />
      </div>
    </div>
  )
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-ink-950/60 px-2 py-2">
      <div className="text-[10px] tracking-wider text-fg-subtle uppercase">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  )
}

export const LivePreview = forwardRef<HTMLDivElement>(function LivePreview(_, ref) {
  const [tab, setTab] = useState<TabId>('ram')
  const baseId = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const current = TABS.find((t) => t.id === tab)!
  const idx = TABS.indexOf(current)

  return (
    <div ref={ref} tabIndex={-1} className="rounded-xl border border-white/[0.08] bg-ink-900 outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden /> Live preview
        </span>
        <span className="text-[11px] text-fg-subtle">real model, runs locally</span>
      </div>
      <div
        role="tablist"
        aria-label="Preview experiments"
        className="flex gap-1 border-b border-white/[0.06] px-2 py-2"
        onKeyDown={(e) => {
          const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
          if (!d) return
          e.preventDefault()
          const n = (idx + d + TABS.length) % TABS.length
          setTab(TABS[n].id)
          tabRefs.current[n]?.focus()
        }}
      >
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`${baseId}-panel`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              tab === t.id ? 'bg-white/[0.07] text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            <t.icon size={14} aria-hidden />
            {t.label}
          </button>
        ))}
      </div>
      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${tab}`} className="p-4">
        {tab === 'ram' && <RamMini />}
        {tab === 'cpu' && <CpuMini />}
        {tab === 'compound' && <CompoundMini />}
        {tab === 'coins' && <CoinsMini />}
        <a href={href.sim(current.sim)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
          Open the full experiment <ArrowRight size={13} />
        </a>
      </div>
    </div>
  )
})
