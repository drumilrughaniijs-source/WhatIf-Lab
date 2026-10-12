import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SimLayout } from '../../components/SimLayout'
import { ChartTooltip, Controls, Insight, Legend, Panel, Slider, Stat, StatGrid } from '../../components/ui'
import { SERIES, axisProps } from '../../lib/chart'
import { useSimParam } from '../../lib/simParams'
import { amdahl, bestCoreCount, simulateCpu } from '../../models/cpu'
import type { SimProps } from '../registry'

const MAX_CORES = 64
const NEUTRAL = '#4b5675'

const REFERENCE = [
  { name: '4 × 4.8 GHz', cores: 4, ghz: 4.8 },
  { name: '8 × 4.2 GHz', cores: 8, ghz: 4.2 },
  { name: '16 × 3.6 GHz', cores: 16, ghz: 3.6 },
  { name: '32 × 3.0 GHz', cores: 32, ghz: 3.0 },
  { name: '64 × 2.4 GHz', cores: 64, ghz: 2.4 },
]

function seconds(s: number) {
  if (s < 1e-3) return `${(s * 1e6).toFixed(0)} µs`
  if (s < 1) return `${(s * 1e3).toFixed(s < 0.01 ? 2 : 0)} ms`
  if (s < 120) return `${s.toFixed(s < 10 ? 2 : 1)} s`
  if (s < 7200) return `${(s / 60).toFixed(1)} min`
  return `${(s / 3600).toFixed(1)} h`
}

export default function CpuPerformance({ accent }: SimProps) {
  const [ghz, setGhz] = useSimParam('ghz', 3.6, { label: 'Clock', format: (v) => `${v.toFixed(1)} GHz`, min: 1, max: 6 })
  const [cores, setCores] = useSimParam('cores', 8, { label: 'Cores', min: 1, max: MAX_CORES })
  const [logWork, setLogWork] = useSimParam('logWork', 3, { label: 'Workload', format: (v) => `${Math.round(10 ** v).toLocaleString()} G instr.`, min: 0, max: 5 })
  const [parallelPct, setParallelPct] = useSimParam('parallel', 80, { label: 'Parallelisable', format: (v) => `${v}%`, min: 0, max: 100 })

  const workG = Math.round(10 ** logWork)
  const p = parallelPct / 100
  const r = simulateCpu({ ghz, cores, workG, parallel: p })
  const best = bestCoreCount({ ghz, workG, parallel: p }, MAX_CORES)
  const ceiling = p < 1 ? 1 / (1 - p) : Infinity

  const curve = useMemo(
    () =>
      Array.from({ length: MAX_CORES }, (_, i) => {
        const n = i + 1
        return {
          cores: n,
          model: Number(simulateCpu({ ghz, cores: n, workG: 1, parallel: p }).speedup.toFixed(3)),
          amdahl: Number(amdahl(p, n).toFixed(3)),
        }
      }),
    [ghz, p],
  )

  const comparison = [
    { name: `You: ${cores} × ${ghz.toFixed(1)}`, mine: true, gips: r.throughputGIPS },
    ...REFERENCE.map((c) => ({ name: c.name, mine: false, gips: simulateCpu({ ghz: c.ghz, cores: c.cores, workG, parallel: p }).throughputGIPS })),
  ].map((d) => ({ ...d, gips: Number(d.gips.toFixed(1)) }))

  const utilization = r.coreUtilization.map((u, i) => ({ core: i + 1, busy: Number((u * 100).toFixed(1)) }))
  const parts = [
    { label: 'Serial (1 core)', value: r.serialS, color: SERIES[1] },
    { label: 'Parallel', value: r.parallelS, color: SERIES[0] },
    { label: 'Coordination overhead', value: r.overheadS, color: SERIES[2] },
  ]

  const insight =
    cores > best
      ? `Past ${best} cores this workload gets slower: coordination overhead and the lower all-core clock outweigh the extra parallelism. With ${cores} cores, ${(r.overheadS / r.totalS * 100).toFixed(0)}% of the run is spent coordinating.`
      : p < 1 && r.speedup > ceiling * 0.6
        ? `With ${parallelPct}% parallel work, Amdahl’s law caps the speed-up at ${ceiling.toFixed(1)}× no matter how many cores you add. You’re already at ${r.speedup.toFixed(1)}×; the serial part now dominates the run time.`
        : `${cores} cores give a ${r.speedup.toFixed(1)}× speed-up over one core (${(r.efficiency * 100).toFixed(0)}% efficiency). For this workload the model’s best core count is ${best}.`

  return (
    <SimLayout
      controls={
        <Controls>
          <Slider label="Clock frequency" value={ghz} min={1} max={6} step={0.1} onChange={setGhz} accent={accent} format={(v) => `${v.toFixed(1)} GHz`} />
          <Slider label="Core count" value={cores} min={1} max={MAX_CORES} onChange={setCores} accent={accent} />
          <Slider
            label="Workload intensity"
            value={logWork}
            min={0}
            max={5}
            step={0.05}
            onChange={setLogWork}
            accent={accent}
            format={() => `${workG.toLocaleString()} G instr.`}
            hint="Total work in billions of instructions. Roughly: a web page script ≈ 1, compressing a large file ≈ 100, rendering a 3D animation frame ≈ 10,000. Logarithmic slider."
          />
          <Slider
            label="Parallelisable work"
            value={parallelPct}
            min={0}
            max={100}
            onChange={setParallelPct}
            accent={accent}
            format={(v) => `${v}%`}
            hint="Share of the work that can be split across cores. Video encoding and rendering are often 95%+; many everyday apps are 30–70%."
          />
          <p className="border-t border-white/[0.06] pt-4 text-xs leading-relaxed text-fg-subtle">
            Simulated estimates from a simplified model. Not a benchmark of real hardware.
          </p>
        </Controls>
      }
      stats={
        <StatGrid>
          <Stat label="Est. run time" value={seconds(r.totalS)} sub={`all-core clock ${r.allCoreGHz.toFixed(2)} GHz`} accent={accent} />
          <Stat label="Est. throughput" value={`${r.throughputGIPS.toFixed(1)}`} sub="billion instr. / s" hint="Effective instructions per second over the whole run, including the serial part and overhead." />
          <Stat label="Speed-up" value={`${r.speedup.toFixed(2)}×`} sub={`ceiling ${isFinite(ceiling) ? ceiling.toFixed(1) + '×' : 'none'}`} hint="Compared with the same workload on one core at the same base clock." />
          <Stat label="Efficiency" value={`${(r.efficiency * 100).toFixed(0)}%`} sub={`best: ${best} core${best === 1 ? '' : 's'}`} hint="Speed-up divided by the number of cores. 100% would mean perfect scaling." />
        </StatGrid>
      }
      insight={<Insight accent={accent}>{insight}</Insight>}
    >
      <Panel
        title="Speed-up as cores are added"
        actions={<Legend items={[{ label: 'This model', color: SERIES[0] }, { label: 'Amdahl’s law only', color: SERIES[1], dashed: true }]} />}
      >
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={curve} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="cores" type="number" domain={[1, MAX_CORES]} ticks={[1, 8, 16, 24, 32, 40, 48, 56, 64]} {...axisProps} />
              <YAxis {...axisProps} axisLine={false} tickFormatter={(v: number) => `${v}×`} />
              <Tooltip content={<ChartTooltip labelFormat={(l) => `${l} cores`} valueFormat={(v) => `${Number(v).toFixed(2)}×`} />} />
              <Line dataKey="amdahl" name="Amdahl only" stroke={SERIES[1]} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              <Line dataKey="model" name="This model" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
              <ReferenceDot x={cores} y={Number(r.speedup.toFixed(3))} r={6} fill={SERIES[0]} stroke="#0a0e18" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Comparison with reference configurations" actions={<span className="text-xs text-fg-subtle">same workload · simulated</span>}>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={comparison} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }} barSize={18}>
              <CartesianGrid horizontal={false} vertical />
              <XAxis type="number" {...axisProps} tickFormatter={(v: number) => `${v}`} />
              <YAxis type="category" dataKey="name" {...axisProps} axisLine={false} width={104} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip valueFormat={(v) => `${Number(v).toFixed(1)} G instr./s`} />} />
              <Bar dataKey="gips" name="Throughput" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {comparison.map((d) => (
                  <Cell key={d.name} fill={d.mine ? SERIES[0] : NEUTRAL} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-fg-subtle">Cores × clock. Bars show estimated throughput (billions of instructions per second); higher is better.</p>
      </Panel>

      <Panel title="Workload distribution" actions={<Legend items={parts.map((x) => ({ label: x.label, color: x.color, swatch: 'box' as const }))} />}>
        <div className="mb-1 text-xs text-fg-subtle">Where the run time goes</div>
        <div className="flex h-7 overflow-hidden rounded-md bg-ink-950 ring-1 ring-white/10" role="img" aria-label={parts.map((x) => `${x.label} ${seconds(x.value)}`).join(', ')}>
          {parts.map((x) =>
            x.value > 0 ? (
              <div
                key={x.label}
                className="h-full border-r-2 border-ink-900 last:border-r-0"
                style={{ width: `${(x.value / r.totalS) * 100}%`, background: x.color }}
                title={`${x.label}: ${seconds(x.value)} (${((x.value / r.totalS) * 100).toFixed(1)}%)`}
              />
            ) : null,
          )}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-xs text-fg-muted tabular-nums">
          {parts.map((x) => (
            <span key={x.label}>
              {seconds(x.value)} <span className="text-fg-subtle">({((x.value / r.totalS) * 100).toFixed(0)}%)</span>
            </span>
          ))}
        </div>

        <div className="mt-6 mb-1 text-xs text-fg-subtle">Busy time per core</div>
        <div className="h-44">
          <ResponsiveContainer>
            <BarChart data={utilization} margin={{ top: 4, right: 8, bottom: 0, left: -16 }} barCategoryGap={cores > 32 ? 1 : 3}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="core" {...axisProps} interval={cores > 16 ? Math.ceil(cores / 16) - 1 : 0} />
              <YAxis domain={[0, 100]} {...axisProps} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip labelFormat={(l) => `Core ${l}`} valueFormat={(v) => `${v}% busy`} />} />
              <Bar dataKey="busy" name="Busy" fill={SERIES[0]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-fg-subtle">Core 1 also runs the serial part, so the other cores sit idle while it does.</p>
      </Panel>
    </SimLayout>
  )
}
