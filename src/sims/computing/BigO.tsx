import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SimLayout } from '../../components/SimLayout'
import { ChartTooltip, Controls, Insight, Legend, Panel, Segmented, Slider, Stat, StatGrid } from '../../components/ui'
import { SERIES, axisProps } from '../../lib/chart'
import type { SimProps } from '../registry'
import { useSimParam } from '../../lib/simParams'

type ClassId = 'O(1)' | 'O(log n)' | 'O(n)' | 'O(n log n)' | 'O(n²)' | 'O(2ⁿ)'

/** log10 of the operation count for each complexity class. */
const LOG_OPS: Record<ClassId, (n: number) => number> = {
  'O(1)': () => 0,
  'O(log n)': (n) => Math.log10(Math.max(1, Math.log2(Math.max(n, 2)))),
  'O(n)': (n) => Math.log10(n),
  'O(n log n)': (n) => Math.log10(n) + Math.log10(Math.max(1, Math.log2(Math.max(n, 2)))),
  'O(n²)': (n) => 2 * Math.log10(n),
  'O(2ⁿ)': (n) => n * Math.LOG10E * Math.LN2,
}
const CLASSES = Object.keys(LOG_OPS) as ClassId[]

const EXAMPLES: Record<ClassId, string> = {
  'O(1)': 'Array index, hash lookup',
  'O(log n)': 'Binary search',
  'O(n)': 'Scan a list',
  'O(n log n)': 'Merge sort',
  'O(n²)': 'Compare every pair',
  'O(2ⁿ)': 'Brute-force all subsets',
}

const AGE_OF_UNIVERSE_S = 4.35e17

/** Format a duration given as log10(seconds). */
function formatDuration(log10s: number): string {
  if (!isFinite(log10s)) return '∞'
  if (log10s > Math.log10(AGE_OF_UNIVERSE_S)) {
    const ratio = log10s - Math.log10(AGE_OF_UNIVERSE_S)
    return ratio < 6 ? `${Math.round(10 ** ratio).toLocaleString()}× age of universe` : `10^${ratio.toFixed(0)}× age of universe`
  }
  const s = 10 ** log10s
  if (s < 1e-6) return `${(s * 1e9).toFixed(s * 1e9 < 10 ? 2 : 0)} ns`
  if (s < 1e-3) return `${(s * 1e6).toFixed(1)} µs`
  if (s < 1) return `${(s * 1e3).toFixed(1)} ms`
  if (s < 60) return `${s.toFixed(1)} s`
  if (s < 3600) return `${(s / 60).toFixed(1)} min`
  if (s < 86400) return `${(s / 3600).toFixed(1)} h`
  if (s < 3.156e7) return `${(s / 86400).toFixed(1)} days`
  const years = s / 3.156e7
  return years < 1e6 ? `${Math.round(years).toLocaleString()} years` : `${years.toExponential(1)} years`
}

function formatLogCount(l: number): string {
  if (l < 6) return Math.round(10 ** l).toLocaleString()
  return `10^${l.toFixed(l < 100 ? 1 : 0)}`
}

/** Largest n solvable within `budget` operations (log10). */
function maxN(c: ClassId, logBudget: number): string {
  if (c === 'O(1)') return '∞'
  // log₂ n ≤ 10^budget  ⇒  n ≤ 2^(10^budget): astronomically large for any real budget
  if (c === 'O(log n)') return '∞ (practically)'
  if (c === 'O(n)') return formatLogCount(logBudget)
  if (c === 'O(n²)') return formatLogCount(logBudget / 2)
  if (c === 'O(2ⁿ)') return Math.floor(logBudget / (Math.LOG10E * Math.LN2)).toLocaleString()
  // n log n: bisection in log space
  let lo = 0
  let hi = logBudget
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (LOG_OPS['O(n log n)'](10 ** mid) > logBudget) hi = mid
    else lo = mid
  }
  return formatLogCount(lo)
}

export default function BigO({ accent }: SimProps) {
  const [logN, setLogN] = useSimParam('logN', 2, { label: 'Input size n', format: (v) => Math.round(10 ** v).toLocaleString(), min: 0, max: 9 })
  const [logSpeed, setLogSpeed] = useSimParam('logSpeed', 9, { label: 'Computer speed', format: (v) => `10^${v} ops/s`, min: 3, max: 15 })
  const [a, setA] = useSimParam<ClassId>('a', 'O(n log n)', { label: 'Series A', oneOf: CLASSES })
  const [b, setB] = useSimParam<ClassId>('b', 'O(n²)', { label: 'Series B', oneOf: CLASSES })

  const n = Math.round(10 ** logN)

  const rows = CLASSES.map((c) => {
    const lops = LOG_OPS[c](n)
    return { c, lops, time: lops - logSpeed }
  })

  const chart = useMemo(() => {
    const pts = 80
    const CAP = 60
    const xs = [...new Set(Array.from({ length: pts }, (_, i) => Math.max(1, Math.round(10 ** ((logN * i) / (pts - 1))))))]
    return xs.map((x) => {
      const va = LOG_OPS[a](x)
      const vb = LOG_OPS[b](x)
      return { n: x, [a]: va <= CAP ? va : null, [b]: vb <= CAP ? vb : null }
    })
  }, [logN, a, b])

  const optionList = CLASSES.map((c) => ({ value: c, label: c }))
  const ratio = LOG_OPS[b](n) - LOG_OPS[a](n)
  const maxLog = Math.max(...rows.map((r) => Math.min(r.lops, 60)), 1)

  return (
    <SimLayout
      controls={
        <Controls>
          <Slider
            label="Input size n"
            value={logN}
            min={0}
            max={9}
            step={0.05}
            onChange={setLogN}
            accent={accent}
            format={() => n.toLocaleString()}
          />
          <Slider
            label="Computer speed"
            value={logSpeed}
            min={3}
            max={15}
            step={0.5}
            onChange={setLogSpeed}
            accent={accent}
            format={(v) => `10^${v} ops/s`}
            hint="A modern CPU core does roughly 10^9 simple operations per second."
          />
          <div className="space-y-3 rounded-xl bg-ink-850/60 p-3">
            <div className="text-xs font-medium tracking-wider text-fg-subtle uppercase">Compare on chart</div>
            <select
              value={a}
              onChange={(e) => setA(e.target.value as ClassId)}
              className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 font-mono text-sm"
              style={{ borderLeft: `4px solid ${SERIES[0]}` }}
              aria-label="Series A"
            >
              {optionList.map((o) => (
                <option key={o.value}>{o.value}</option>
              ))}
            </select>
            <select
              value={b}
              onChange={(e) => setB(e.target.value as ClassId)}
              className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 font-mono text-sm"
              style={{ borderLeft: `4px solid ${SERIES[1]}` }}
              aria-label="Series B"
            >
              {optionList.map((o) => (
                <option key={o.value}>{o.value}</option>
              ))}
            </select>
          </div>
          <Segmented
            label="Quick presets"
            value={'' as string}
            onChange={(v) => setLogN(Number(v))}
            accent={accent}
            options={[
              { value: '1', label: 'n=10' },
              { value: '1.78', label: 'n=60' },
              { value: '6', label: '1M' },
              { value: '9', label: '1B' },
            ]}
          />
        </Controls>
      }
      stats={
        <StatGrid>
          <Stat label="n" value={n.toLocaleString()} accent={accent} />
          <Stat label={`${a} time`} value={formatDuration(LOG_OPS[a](n) - logSpeed)} accent={SERIES[0]} />
          <Stat label={`${b} time`} value={formatDuration(LOG_OPS[b](n) - logSpeed)} accent={SERIES[1]} />
          <Stat
            label="B ÷ A"
            value={Math.abs(ratio) < 6 ? `${(10 ** ratio).toLocaleString('en-US', { maximumFractionDigits: 1 })}×` : `10^${ratio.toFixed(0)}×`}
            sub="ratio of operations"
          />
        </StatGrid>
      }
      insight={
        <Insight accent={accent}>
          {n >= 50
            ? `At n = ${n.toLocaleString()}, an O(2ⁿ) algorithm would need ${formatDuration(rows[5].time)}, even at 10^${logSpeed} operations per second. Faster hardware adds only a constant to the n an exponential algorithm can handle; better algorithms change the game entirely.`
            : `For small inputs every class feels instant. Slide n upward: somewhere around n ≈ 40–60, exponential growth explodes past anything hardware can fix.`}
        </Insight>
      }
    >
      <Panel title="Operations as n grows (log scale)" actions={<Legend items={[{ label: a, color: SERIES[0] }, { label: b, color: SERIES[1] }]} />}>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 0, left: -4 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="n"
                {...axisProps}
                tickFormatter={(v: number) => (v >= 1e4 ? v.toExponential(0) : v.toLocaleString())}
                minTickGap={30}
              />
              <YAxis {...axisProps} axisLine={false} tickFormatter={(v: number) => `10^${v.toFixed(0)}`} width={52} />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormat={(l) => `n = ${Number(l).toLocaleString()}`}
                    valueFormat={(v) => `${formatLogCount(Number(v))} ops`}
                  />
                }
              />
              <Line type="monotone" dataKey={a} name={a} stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey={b} name={b} stroke={SERIES[1]} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-fg-subtle">Lines stop at 10^60 operations; beyond that the curve leaves the chart.</p>
      </Panel>

      <Panel title={`Every class at n = ${n.toLocaleString()}`} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-wider text-fg-subtle uppercase">
                <th className="px-5 py-3 font-medium">Class</th>
                <th className="px-3 py-3 font-medium">Operations</th>
                <th className="px-3 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Max n in 1 s</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.c} className="border-t border-white/[0.05]">
                  <td className="px-5 py-3">
                    <div className="font-mono font-medium">{r.c}</div>
                    <div className="text-xs text-fg-subtle">{EXAMPLES[r.c]}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-mono tabular-nums">{formatLogCount(r.lops)}</div>
                    <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-ink-700">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(2, (Math.min(r.lops, 60) / maxLog) * 100)}%`, background: accent }}
                      />
                    </div>
                  </td>
                  <td className={`px-3 py-3 font-mono tabular-nums ${r.time > 0 ? 'text-orange-300' : 'text-fg'}`}>
                    {formatDuration(r.time)}
                  </td>
                  <td className="px-5 py-3 font-mono text-fg-muted tabular-nums">{maxN(r.c, logSpeed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </SimLayout>
  )
}
