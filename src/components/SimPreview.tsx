import { memo, type ReactElement, type ReactNode } from 'react'
import { SERIES } from '../lib/chart'
import { mulberry32 } from '../lib/random'
import { simulateRam } from '../models/ram'
import { amdahl } from '../models/cpu'
import { simulateCompound } from '../models/compound'
import { theoretical } from '../models/probability'

/**
 * Small preview thumbnails for simulation cards. Each one is drawn from the
 * same model the simulation uses, at its default settings.
 */

const W = 240
const H = 120
const GRID = 'rgba(148,163,184,0.10)'

function path(points: [number, number][]) {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      {[30, 60, 90].map((y) => (
        <line key={y} x1={0} x2={W} y1={y} y2={y} stroke={GRID} />
      ))}
      {children}
    </svg>
  )
}

function Ram({ accent }: { accent: string }) {
  const r = simulateRam({ capacityGB: 16, perAppMB: 900, apps: 12, swap: 'ssd' })
  const total = Math.max(16, r.demandGB)
  const x = (gb: number) => 16 + (gb / total) * (W - 32)
  const appW = x(0.9 * 1) - x(0) // ~0.88 GB per app
  return (
    <Frame label="Memory allocation bar">
      <rect x={16} y={44} width={W - 32} height={32} rx={4} fill="#05070d" stroke="rgba(255,255,255,0.1)" />
      <rect x={16} y={44} width={x(r.osGB) - 16} height={32} rx={3} fill="#8b93a7" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={x(r.osGB) + i * appW + 1} y={44} width={appW - 2} height={32} fill={accent} opacity={i % 2 ? 0.7 : 0.95} />
      ))}
      <line x1={x(16)} x2={x(16)} y1={34} y2={86} stroke="#e8ecf4" strokeWidth={1.5} />
      <text x={x(16) - 4} y={30} textAnchor="end" fontSize={10} fill="#a3acc2" fontFamily="var(--font-mono)">
        16 GB
      </text>
    </Frame>
  )
}

function Cpu() {
  const pts = (p: number) => Array.from({ length: 33 }, (_, i): [number, number] => [12 + (i / 32) * (W - 24), H - 12 - (amdahl(p, i * 2 + 1) / 42) * (H - 24)])
  return (
    <Frame label="Speed-up curves for different parallel fractions">
      <path d={path(pts(0.99))} fill="none" stroke={SERIES[0]} strokeWidth={2} />
      <path d={path(pts(0.9))} fill="none" stroke={SERIES[0]} strokeWidth={2} opacity={0.6} />
      <path d={path(pts(0.5))} fill="none" stroke={SERIES[0]} strokeWidth={2} opacity={0.35} />
    </Frame>
  )
}

function Neural({ accent }: { accent: string }) {
  const rand = mulberry32(4)
  const L = [44, 120, 196]
  const ys = [[45, 75], [24, 48, 72, 96], [60]]
  const edges: { x1: number; y1: number; x2: number; y2: number; w: number }[] = []
  for (let l = 0; l < 2; l++)
    for (const a of ys[l]) for (const b of ys[l + 1]) edges.push({ x1: L[l], y1: a, x2: L[l + 1], y2: b, w: rand() * 2 - 1 })
  return (
    <Frame label="Small neural network">
      {edges.map((e, i) => (
        <line key={i} {...e} stroke={e.w > 0 ? SERIES[0] : SERIES[1]} strokeWidth={0.6 + Math.abs(e.w) * 2.6} opacity={0.35 + Math.abs(e.w) * 0.6} />
      ))}
      {ys.map((col, l) => col.map((y) => <circle key={`${l}-${y}`} cx={L[l]} cy={y} r={8} fill="#0f1422" stroke={l === 1 ? accent : '#a3acc2'} strokeWidth={1.5} />))}
    </Frame>
  )
}

function Compound() {
  const r = simulateCompound({ initial: 10000, monthly: 300, ratePct: 7, years: 30, frequency: 'monthly', timing: 'end' })
  const max = r.finalBalance
  const X = (y: number) => 12 + (y / 30) * (W - 24)
  const Y = (v: number) => H - 10 - (v / max) * (H - 20)
  const contrib: [number, number][] = [[X(0), Y(10000)], ...r.rows.map((row): [number, number] => [X(row.year), Y(row.totalContributions)])]
  const total: [number, number][] = [[X(0), Y(10000)], ...r.rows.map((row): [number, number] => [X(row.year), Y(row.endBalance)])]
  return (
    <Frame label="Compound growth curve">
      <path d={`${path(total)} L${X(30)},${H - 10} L${X(0)},${H - 10} Z`} fill={SERIES[2]} opacity={0.3} />
      <path d={`${path(contrib)} L${X(30)},${H - 10} L${X(0)},${H - 10} Z`} fill={SERIES[0]} opacity={0.35} />
      <path d={path(total)} fill="none" stroke={SERIES[2]} strokeWidth={2} />
    </Frame>
  )
}

function Probability() {
  const p = theoretical('two-dice')
  const rand = mulberry32(9)
  const bw = (W - 40) / 11
  return (
    <Frame label="Histogram of two-dice sums">
      {p.map((v, i) => {
        const obs = v * (0.85 + rand() * 0.3)
        const h = (obs / 0.2) * (H - 24)
        return <rect key={i} x={20 + i * bw + 2} y={H - 10 - h} width={bw - 4} height={h} rx={2} fill={SERIES[0]} />
      })}
      <path d={path(p.map((v, i): [number, number] => [20 + i * bw + bw / 2, H - 10 - (v / 0.2) * (H - 24)]))} fill="none" stroke={SERIES[1]} strokeWidth={2} strokeDasharray="4 3" />
    </Frame>
  )
}

function Orbit({ accent }: { accent: string }) {
  const e = 0.45
  const a = 70
  const b = a * Math.sqrt(1 - e * e)
  const cx = W / 2 - a * e + 10
  const pts = Array.from({ length: 81 }, (_, i): [number, number] => {
    const t = (i / 80) * Math.PI * 2
    return [cx + a * Math.cos(t), H / 2 + b * Math.sin(t) * 0.82]
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Elliptical orbit">
      <path d={path(pts)} fill="none" stroke={accent} strokeWidth={1.5} opacity={0.8} />
      <circle cx={cx + a * e} cy={H / 2} r={7} fill="#fde68a" />
      <circle cx={pts[12][0]} cy={pts[12][1]} r={4} fill={accent} />
    </svg>
  )
}

function Bars({ accent }: { accent: string }) {
  const rand = mulberry32(3)
  const vals = Array.from({ length: 28 }, (_, i) => i + 1).sort(() => rand() - 0.5)
  const bw = (W - 24) / vals.length
  return (
    <Frame label="Bars being sorted">
      {vals.map((v, i) => (
        <rect key={i} x={12 + i * bw + 1} y={H - 8 - (v / 28) * (H - 20)} width={bw - 2} height={(v / 28) * (H - 20)} rx={1} fill={i === 9 || i === 10 ? '#e8ecf4' : accent} opacity={0.85} />
      ))}
    </Frame>
  )
}

function Curves() {
  const f = [(n: number) => n * Math.log2(n + 1), (n: number) => n * n, (n: number) => 2 ** n]
  return (
    <Frame label="Growth curves">
      {f.map((fn, k) => (
        <path
          key={k}
          d={path(Array.from({ length: 40 }, (_, i): [number, number] => [12 + (i / 39) * (W - 24), Math.max(4, H - 10 - (fn((i / 39) * 10) / 100) * (H - 20))]))}
          fill="none"
          stroke={k === 2 ? SERIES[1] : SERIES[0]}
          strokeWidth={2}
          opacity={k === 0 ? 0.5 : 1}
        />
      ))}
    </Frame>
  )
}

function Descent({ accent }: { accent: string }) {
  const f = (x: number) => 0.25 * x ** 4 - x * x + 0.3 * x + 1.5
  const X = (x: number) => 12 + ((x + 2.6) / 5.2) * (W - 24)
  const Y = (y: number) => H - 10 - (y / 5) * (H - 20)
  const pts = Array.from({ length: 60 }, (_, i): [number, number] => {
    const x = -2.6 + (i / 59) * 5.2
    return [X(x), Y(f(x))]
  })
  const steps = [2.4, 1.9, 1.55, 1.38]
  return (
    <Frame label="Ball descending a loss curve">
      <path d={path(pts)} fill="none" stroke={accent} strokeWidth={2} />
      {steps.map((s, i) => (
        <circle key={i} cx={X(s)} cy={Y(f(s)) - 5} r={i === steps.length - 1 ? 6 : 3} fill="#e8ecf4" opacity={0.3 + i * 0.23} />
      ))}
    </Frame>
  )
}

function Clusters() {
  const rand = mulberry32(12)
  const centers = [
    [60, 40],
    [170, 45],
    [115, 88],
  ]
  return (
    <Frame label="Clustered points">
      {centers.flatMap(([cx, cy], k) =>
        Array.from({ length: 24 }, (_, i) => {
          const a = rand() * Math.PI * 2
          const r = Math.sqrt(rand()) * 22
          return <circle key={`${k}-${i}`} cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r * 0.75} r={2.4} fill={SERIES[k]} />
        }),
      )}
    </Frame>
  )
}

function Parabolas() {
  const arc = (range: number, height: number): [number, number][] =>
    Array.from({ length: 30 }, (_, i) => {
      const t = i / 29
      return [14 + t * range, H - 10 - 4 * height * t * (1 - t)]
    })
  return (
    <Frame label="Projectile arcs">
      <path d={path(arc(60, 30))} fill="none" stroke={SERIES[0]} strokeWidth={2} />
      <path d={path(arc(210, 92))} fill="none" stroke={SERIES[1]} strokeWidth={2} />
    </Frame>
  )
}

function Pendulum({ accent }: { accent: string }) {
  const px = W / 2
  const L = 80
  const angles = [-0.6, -0.3, 0, 0.3, 0.6]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Swinging pendulum">
      <rect x={px - 30} y={10} width={60} height={4} rx={2} fill="#2a3450" />
      {angles.map((a, i) => (
        <g key={i} opacity={i === 4 ? 1 : 0.2}>
          <line x1={px} y1={14} x2={px + Math.sin(a) * L} y2={14 + Math.cos(a) * L} stroke="#cbd5e1" strokeWidth={1.5} />
          <circle cx={px + Math.sin(a) * L} cy={14 + Math.cos(a) * L} r={8} fill={accent} />
        </g>
      ))}
    </svg>
  )
}

function Darts() {
  const rand = mulberry32(5)
  const s = 100
  const ox = (W - s) / 2
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Random points in a quarter circle">
      {Array.from({ length: 260 }, (_, i) => {
        const x = rand()
        const y = rand()
        return <rect key={i} x={ox + x * s} y={10 + (1 - y) * s} width={2} height={2} fill={x * x + y * y <= 1 ? SERIES[0] : SERIES[1]} />
      })}
      <path d={`M${ox},${10} A${s},${s} 0 0 1 ${ox + s},${10 + s}`} fill="none" stroke="#e8ecf4" strokeWidth={1.5} />
    </svg>
  )
}

function Square() {
  const sum = (t: number) => [1, 3, 5, 7, 9].reduce((s, n) => s + (4 / (Math.PI * n)) * Math.sin(n * t), 0)
  const pts = Array.from({ length: 120 }, (_, i): [number, number] => {
    const t = (i / 119) * Math.PI * 4
    return [12 + (i / 119) * (W - 24), H / 2 - sum(t) * 34]
  })
  return (
    <Frame label="Fourier approximation of a square wave">
      <path d={path(pts)} fill="none" stroke={SERIES[0]} strokeWidth={2} />
    </Frame>
  )
}

function TwoCurves() {
  const g = (start: number) =>
    Array.from({ length: 41 }, (_, i): [number, number] => {
      const age = 25 + i
      const yrs = Math.max(0, age - start)
      const v = yrs ? ((1.07 ** yrs - 1) / 0.07) * 3600 : 0
      return [12 + (i / 40) * (W - 24), H - 10 - (v / 760000) * (H - 20)]
    })
  return (
    <Frame label="Early and late investor balances">
      <path d={path(g(25))} fill="none" stroke={SERIES[0]} strokeWidth={2} />
      <path d={path(g(35))} fill="none" stroke={SERIES[1]} strokeWidth={2} />
    </Frame>
  )
}

function Loan() {
  const bal = (extra: number) => {
    const r = 0.065 / 12
    const pmt = (300000 * r) / (1 - (1 + r) ** -360)
    let b = 300000
    const pts: [number, number][] = []
    for (let m = 0; m <= 360 && b > 0; m += 6) {
      pts.push([12 + (m / 360) * (W - 24), H - 10 - (b / 300000) * (H - 20)])
      for (let k = 0; k < 6 && b > 0; k++) b = Math.max(0, b * (1 + r) - pmt - extra)
    }
    pts.push([pts[pts.length - 1][0] + 4, H - 10])
    return pts
  }
  return (
    <Frame label="Loan balance with and without extra payments">
      <path d={path(bal(0))} fill="none" stroke={SERIES[1]} strokeWidth={2} strokeDasharray="4 3" />
      <path d={path(bal(400))} fill="none" stroke={SERIES[0]} strokeWidth={2} />
    </Frame>
  )
}

const PREVIEWS: Record<string, (p: { accent: string }) => ReactElement> = {
  'ram-pressure': Ram,
  'cpu-performance': Cpu,
  'neural-network': Neural,
  'compound-interest-lab': Compound,
  'probability-playground': Probability,
  'orbital-gravity': Orbit,
  'sorting-race': Bars,
  'big-o': Curves,
  'gradient-descent': Descent,
  kmeans: Clusters,
  projectile: Parabolas,
  pendulum: Pendulum,
  'monte-carlo-pi': Darts,
  fourier: Square,
  'compound-interest': TwoCurves,
  'loan-payoff': Loan,
}

export const SimPreview = memo(function SimPreview({ id, accent }: { id: string; accent: string }) {
  const P = PREVIEWS[id]
  return (
    <div className="aspect-[2/1] w-full overflow-hidden rounded-lg border border-white/[0.06] bg-ink-950">
      {P && <P accent={accent} />}
    </div>
  )
})
