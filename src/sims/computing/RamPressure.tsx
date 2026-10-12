import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CheckCircle2, Gauge, OctagonAlert } from 'lucide-react'
import { SimLayout } from '../../components/SimLayout'
import { Callout, ChartTooltip, Controls, Insight, Panel, Segmented, Slider, Stat, StatGrid } from '../../components/ui'
import { SERIES, axisProps } from '../../lib/chart'
import { useSimParam } from '../../lib/simParams'
import { COMFORT_LIMIT, maxAppsWithoutSwap, simulateRam, type Pressure, type SwapDevice } from '../../models/ram'
import type { SimProps } from '../registry'

const MAX_APPS = 40
const OS_COLOR = '#8b93a7'
const SWAPS: SwapDevice[] = ['ssd', 'hdd']

const gb = (v: number) => (v >= 10 ? v.toFixed(1) : v.toFixed(2)).replace(/\.?0+$/, '') + ' GB'

const PRESSURE: Record<Pressure, { label: string; color: string; icon: typeof Gauge }> = {
  normal: { label: 'Normal', color: '#34d399', icon: CheckCircle2 },
  elevated: { label: 'Elevated', color: '#a3e635', icon: Gauge },
  high: { label: 'High', color: '#fbbf24', icon: AlertTriangle },
  critical: { label: 'Swapping', color: '#f87171', icon: OctagonAlert },
}

export default function RamPressure({ accent }: SimProps) {
  const [capacity, setCapacity] = useSimParam('capacity', 16, { label: 'RAM capacity', format: (v) => `${v} GB`, min: 2, max: 64 })
  const [perApp, setPerApp] = useSimParam('perAppMB', 900, { label: 'Memory per app', format: (v) => `${v} MB`, min: 50, max: 4000 })
  const [apps, setApps] = useSimParam('apps', 12, { label: 'Running apps', min: 0, max: MAX_APPS })
  const [swap, setSwap] = useSimParam<SwapDevice>('swap', 'ssd', { label: 'Swap device', oneOf: SWAPS, format: (v) => v.toUpperCase() })

  const r = simulateRam({ capacityGB: capacity, perAppMB: perApp, apps, swap })
  const fit = maxAppsWithoutSwap(capacity, perApp)
  const pressure = PRESSURE[r.pressure]
  const PressureIcon = pressure.icon

  const curve = useMemo(
    () =>
      Array.from({ length: MAX_APPS + 1 }, (_, n) => ({
        apps: n,
        perf: Number((simulateRam({ capacityGB: capacity, perAppMB: perApp, apps: n, swap }).performance * 100).toFixed(2)),
      })),
    [capacity, perApp, swap],
  )

  // Allocation diagram: everything is drawn on a scale of max(capacity, demand).
  const scale = Math.max(capacity, r.demandGB)
  const pct = (v: number) => `${(v / scale) * 100}%`
  const appGB = perApp / 1024
  const slowdown = 1 / Math.max(r.performance, 1e-9)

  const insight =
    r.pressure === 'critical'
      ? `Demand is ${gb(r.overflowGB)} over capacity, so that much memory is paged out to the ${swap.toUpperCase()}. Only ${(r.faultShare * 100).toFixed(2)}% of memory accesses now hit swap, but each one takes ${swap === 'ssd' ? '~800×' : '~80,000×'} longer than RAM, so the model estimates everything runs about ${slowdown.toFixed(slowdown < 10 ? 1 : 0)}× slower.`
      : r.pressure === 'high'
        ? `Memory is almost full. Nothing is swapped yet, but the OS has little room left for its file cache, so the model estimates a ${((1 - r.performance) * 100).toFixed(0)}% slowdown. ${fit - apps > 0 ? `${fit - apps} more app${fit - apps === 1 ? '' : 's'} of this size will fit before swapping starts.` : 'One more app will start swapping.'}`
        : `${gb(r.availableGB)} is free. With ${perApp} MB per app you could run ${fit} apps before anything is paged out to swap.`

  return (
    <SimLayout
      controls={
        <Controls>
          <Slider label="RAM capacity" value={capacity} min={2} max={64} step={2} onChange={setCapacity} accent={accent} format={(v) => `${v} GB`} />
          <Slider
            label="Memory per app"
            value={perApp}
            min={50}
            max={4000}
            step={50}
            onChange={setPerApp}
            accent={accent}
            format={(v) => (v >= 1024 ? `${(v / 1024).toFixed(2)} GB` : `${v} MB`)}
            hint="Average resident memory of each running application. A browser with many tabs can use several GB; a text editor might use 100–300 MB."
          />
          <Slider label="Running apps" value={apps} min={0} max={MAX_APPS} onChange={setApps} accent={accent} />
          <Segmented
            label="Swap device"
            value={swap}
            onChange={setSwap}
            accent={accent}
            hint="Where overflow memory is paged to. Assumed access times: SSD ≈ 80 µs, HDD ≈ 8 ms, versus ≈ 100 ns for RAM."
            options={[
              { value: 'ssd', label: 'SSD' },
              { value: 'hdd', label: 'Hard disk' },
            ]}
          />
          <p className="border-t border-white/[0.06] pt-4 text-xs leading-relaxed text-fg-subtle">
            Simulated model only. This lab does not read or measure your computer’s memory.
          </p>
        </Controls>
      }
      stats={
        <div className="space-y-3">
          <StatGrid>
            <Stat label="Used memory" value={gb(r.usedGB)} sub={`of ${capacity} GB installed`} accent={accent} />
            <Stat label="Available" value={gb(r.availableGB)} sub={r.overflowGB > 0 ? `${gb(r.overflowGB)} in swap` : 'free for new apps'} />
            <Stat label="Utilisation" value={`${(r.utilization * 100).toFixed(0)}%`} sub={`demand ${gb(r.demandGB)}`} hint="Demand divided by capacity. Above 100% means part of the demand cannot fit in RAM." />
            <Stat
              label="Responsiveness"
              value={`${(r.performance * 100).toFixed(r.performance < 0.1 ? 1 : 0)}%`}
              sub={
                <span className="flex items-center gap-1" style={{ color: pressure.color }}>
                  <PressureIcon size={12} aria-hidden /> {pressure.label} pressure
                </span>
              }
              hint="Modelled speed relative to a system with plenty of free memory. See Model & assumptions below."
            />
          </StatGrid>
          {r.pressure === 'critical' && (
            <Callout kind="crit" title={`Memory demand exceeds capacity by ${gb(r.overflowGB)}`}>
              The overflow is paged out to {swap === 'ssd' ? 'the SSD' : 'the hard disk'}. Close apps, reduce memory per app, or add RAM.
            </Callout>
          )}
          {r.pressure === 'high' && (
            <Callout kind="warn" title="Memory is over 90% full">
              The next app may push the system into swapping.
            </Callout>
          )}
        </div>
      }
      insight={<Insight accent={accent}>{insight}</Insight>}
    >
      <Panel title="Memory allocation" actions={<span className="font-mono text-xs text-fg-subtle">1 block = 1 app ({gb(appGB)})</span>}>
        <div className="relative pt-6 pb-1">
          {/* capacity marker */}
          <div className="absolute top-0 bottom-0 z-10 flex flex-col items-end" style={{ left: pct(capacity), transform: 'translateX(-100%)' }}>
            <span className="mb-1 font-mono text-[11px] whitespace-nowrap text-fg-muted">capacity {capacity} GB</span>
          </div>
          <div className="relative flex h-14 overflow-hidden rounded-lg bg-ink-950 ring-1 ring-white/10" role="img" aria-label={`OS ${gb(r.osGB)}, apps ${gb(r.appsGB)}, free ${gb(r.availableGB)}, swapped ${gb(r.overflowGB)}`}>
            <div className="h-full shrink-0 border-r-2 border-ink-950" style={{ width: pct(r.osGB), background: OS_COLOR }} title={`Operating system · ${gb(r.osGB)}`} />
            {Array.from({ length: apps }, (_, i) => {
              const start = r.osGB + i * appGB
              const inRam = Math.max(0, Math.min(appGB, capacity - start))
              const swapped = appGB - inRam
              return (
                <div key={i} className="flex h-full shrink-0" style={{ width: pct(appGB) }} title={`App ${i + 1} · ${gb(appGB)}${swapped > 0 ? ` (${gb(swapped)} swapped)` : ''}`}>
                  {inRam > 0 && (
                    <div className="h-full border-r-2 border-ink-950" style={{ width: `${(inRam / appGB) * 100}%`, background: accent, opacity: i % 2 ? 0.7 : 0.95 }} />
                  )}
                  {swapped > 0 && <div className="hatch-crit h-full border-r-2 border-ink-950" style={{ width: `${(swapped / appGB) * 100}%` }} />}
                </div>
              )
            })}
            {r.availableGB > 0 && (
              <div
                className="h-full flex-1"
                style={{ background: 'repeating-linear-gradient(135deg, rgba(148,163,184,0.06) 0 6px, transparent 6px 12px)' }}
                title={`Free · ${gb(r.availableGB)}`}
              />
            )}
          </div>
          {/* capacity line drawn over the bar */}
          <div className="pointer-events-none absolute top-5 bottom-0 w-0.5 bg-white/80" style={{ left: pct(capacity), transform: 'translateX(-1px)' }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-fg-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: OS_COLOR }} /> OS & services {gb(r.osGB)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: accent }} /> Apps {gb(r.appsGB)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-white/15" /> Free {gb(r.availableGB)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="hatch-crit h-2.5 w-2.5 rounded-sm" /> Swapped {gb(r.overflowGB)}
          </span>
        </div>

        {/* pressure meter */}
        <div className="mt-6">
          <div className="mb-1.5 flex justify-between text-xs text-fg-subtle">
            <span>Memory pressure</span>
            <span className="flex items-center gap-1 font-medium" style={{ color: pressure.color }}>
              <PressureIcon size={12} aria-hidden /> {pressure.label}
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-ink-700">
            {[
              { from: 0, to: COMFORT_LIMIT, c: '#34d399' },
              { from: COMFORT_LIMIT, to: 0.9, c: '#a3e635' },
              { from: 0.9, to: 1, c: '#fbbf24' },
              { from: 1, to: 1.5, c: '#f87171' },
            ].map((z) => (
              <div key={z.from} className="absolute top-0 h-full opacity-35 first:rounded-l-full last:rounded-r-full" style={{ left: `${(z.from / 1.5) * 100}%`, width: `${((z.to - z.from) / 1.5) * 100}%`, background: z.c }} />
            ))}
            <div
              className="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-[left] duration-300"
              style={{ left: `${(Math.min(r.utilization, 1.5) / 1.5) * 100}%` }}
            />
          </div>
          <div className="relative mt-1 h-4 font-mono text-[10px] text-fg-subtle">
            {[
              { v: 0, t: '0%' },
              { v: COMFORT_LIMIT, t: '70%' },
              { v: 1, t: '100%' },
              { v: 1.5, t: '150%+' },
            ].map((m) => (
              <span
                key={m.t}
                className="absolute"
                style={{ left: `${(m.v / 1.5) * 100}%`, transform: m.v === 0 ? 'none' : m.v === 1.5 ? 'translateX(-100%)' : 'translateX(-50%)' }}
              >
                {m.t}
              </span>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Responsiveness as apps are added" actions={<span className="text-xs text-fg-subtle">model output for 0–{MAX_APPS} apps</span>}>
        <div className="h-60">
          <ResponsiveContainer>
            <LineChart data={curve} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="apps" type="number" domain={[0, MAX_APPS]} {...axisProps} tickCount={9} />
              <YAxis domain={[0, 100]} {...axisProps} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip content={<ChartTooltip labelFormat={(l) => `${l} apps`} valueFormat={(v) => `${Number(v).toFixed(1)}%`} />} />
              {fit <= MAX_APPS && (
                <ReferenceLine x={fit} stroke="rgba(248,113,113,0.6)" strokeDasharray="4 4" label={{ value: 'swap starts', position: 'insideTopRight', fill: '#f87171', fontSize: 11 }} />
              )}
              <Line dataKey="perf" name="Responsiveness" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
              <ReferenceDot x={apps} y={Number((r.performance * 100).toFixed(2))} r={6} fill={SERIES[0]} stroke="#0a0e18" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </SimLayout>
  )
}
