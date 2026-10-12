import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Dices, Pause, Play, RotateCcw, Shuffle, StepForward } from 'lucide-react'
import { SimLayout } from '../../components/SimLayout'
import { Button, ChartTooltip, Controls, Insight, Panel, Segmented, Slider, Stat, StatGrid } from '../../components/ui'
import { gaussian, mulberry32, newSeed } from '../../lib/random'
import { SERIES, axisProps } from '../../lib/chart'
import type { SimProps } from '../registry'
import { useSimParam } from '../../lib/simParams'

/** Validated dark-mode categorical palette (fixed order), paired with shapes for non-colour identity. */
const CLUSTER_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9']
type Pt = { x: number; y: number }
type Init = 'random' | 'plusplus'

const SIZE = 100

function makeBlobs(count: number, blobs: number, spread: number, seed: number): Pt[] {
  const rand = mulberry32(seed)
  const centers = Array.from({ length: blobs }, () => ({ x: 15 + rand() * 70, y: 15 + rand() * 70 }))
  return Array.from({ length: count }, (_, i) => {
    const c = centers[i % blobs]
    return {
      x: Math.min(SIZE, Math.max(0, c.x + gaussian(rand) * spread)),
      y: Math.min(SIZE, Math.max(0, c.y + gaussian(rand) * spread)),
    }
  })
}

const d2 = (a: Pt, b: Pt) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2

function initCentroids(pts: Pt[], k: number, mode: Init, seed: number): Pt[] {
  const rand = mulberry32(seed)
  if (mode === 'random') {
    // sample k distinct points (partial Fisher–Yates)
    const idx = pts.map((_, i) => i)
    for (let i = 0; i < Math.min(k, idx.length); i++) {
      const j = i + Math.floor(rand() * (idx.length - i))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    return idx.slice(0, k).map((i) => ({ ...pts[i] }))
  }
  // k-means++: pick each new centroid with probability ∝ squared distance to nearest existing one
  const cs: Pt[] = [{ ...pts[Math.floor(rand() * pts.length)] }]
  while (cs.length < k) {
    const ds = pts.map((p) => Math.min(...cs.map((c) => d2(p, c))))
    const total = ds.reduce((s, v) => s + v, 0)
    let r = rand() * total
    let i = 0
    while (i < ds.length - 1 && (r -= ds[i]) > 0) i++
    cs.push({ ...pts[i] })
  }
  return cs
}

interface Iter {
  centroids: Pt[]
  assign: number[]
  inertia: number
}

function lloyd(pts: Pt[], start: Pt[]): Iter[] {
  const iters: Iter[] = []
  let cs = start
  for (let it = 0; it < 40; it++) {
    const assign = pts.map((p) => {
      let best = 0
      let bd = Infinity
      cs.forEach((c, j) => {
        const dd = d2(p, c)
        if (dd < bd) {
          bd = dd
          best = j
        }
      })
      return best
    })
    const inertia = pts.reduce((s, p, i) => s + d2(p, cs[assign[i]]), 0)
    iters.push({ centroids: cs, assign, inertia })
    const next = cs.map((c, j) => {
      const mine = pts.filter((_, i) => assign[i] === j)
      if (!mine.length) return c
      return { x: mine.reduce((s, p) => s + p.x, 0) / mine.length, y: mine.reduce((s, p) => s + p.y, 0) / mine.length }
    })
    const moved = next.reduce((s, c, j) => s + d2(c, cs[j]), 0)
    cs = next
    if (moved < 1e-6) break
  }
  return iters
}

function Marker({ shape, x, y, r, fill, stroke }: { shape: number; x: number; y: number; r: number; fill: string; stroke?: string }) {
  const common = { fill, stroke, strokeWidth: stroke ? 1.5 : 0 }
  switch (shape % 4) {
    case 1:
      return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={0.4} {...common} />
    case 2:
      return <polygon points={`${x},${y - r * 1.2} ${x + r * 1.1},${y + r * 0.8} ${x - r * 1.1},${y + r * 0.8}`} {...common} />
    case 3:
      return <polygon points={`${x},${y - r * 1.3} ${x + r * 1.3},${y} ${x},${y + r * 1.3} ${x - r * 1.3},${y}`} {...common} />
    default:
      return <circle cx={x} cy={y} r={r} {...common} />
  }
}

export default function KMeans({ accent }: SimProps) {
  const [blobs, setBlobs] = useSimParam('blobs', 4, { label: 'True blobs', min: 1, max: 6 })
  const [spread, setSpread] = useSimParam('spread', 7, { label: 'Spread', min: 2, max: 18 })
  const [count, setCount] = useSimParam('count', 300, { label: 'Points', min: 50, max: 800 })
  const [k, setK] = useSimParam('k', 4, { label: 'k', min: 1, max: 6 })
  const [init, setInit] = useSimParam<Init>('init', 'random', { label: 'Initialisation', oneOf: ['random', 'plusplus'], format: (v) => (v === 'random' ? 'Random' : 'k-means++') })
  const [dataSeed, setDataSeed] = useSimParam('dataSeed', () => newSeed())
  const [initSeed, setInitSeed] = useSimParam('initSeed', () => newSeed())
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)

  const pts = useMemo(() => makeBlobs(count, blobs, spread, dataSeed), [count, blobs, spread, dataSeed])
  const iters = useMemo(() => lloyd(pts, initCentroids(pts, k, init, initSeed)), [pts, k, init, initSeed])

  useEffect(() => {
    setIdx(0)
    setPlaying(false)
  }, [iters])

  useEffect(() => {
    if (!playing) return
    if (idx >= iters.length - 1) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setIdx((i) => i + 1), 550)
    return () => clearTimeout(t)
  }, [playing, idx, iters.length])

  const cur = iters[Math.min(idx, iters.length - 1)]
  const done = idx >= iters.length - 1
  const sizes = Array.from({ length: k }, (_, j) => cur.assign.filter((a) => a === j).length)
  const chartData = iters.slice(0, idx + 1).map((it, i) => ({ iter: i, inertia: Math.round(it.inertia) }))

  const insight = !done
    ? 'Each iteration does two things: colour every point by its nearest centroid (✕), then move each centroid to the centre of its points. Press play or step through it.'
    : k > blobs
      ? `Converged in ${iters.length - 1} iterations. You asked for ${k} clusters but the data has ${blobs} blobs, so K-means happily splits real groups apart. It always returns exactly k clusters, whether or not they are meaningful.`
      : k < blobs
        ? `Converged with ${k} clusters for ${blobs} blobs, so some groups were merged. Choosing k is up to you; the "elbow" in inertia across different k is one common heuristic.`
        : `Converged in ${iters.length - 1} iterations with inertia ${Math.round(cur.inertia).toLocaleString()}. Re-roll the starting centroids: with random initialisation you may occasionally land in a worse local optimum. k-means++ makes that much rarer.`

  const toSvg = (v: number) => 4 + (v / SIZE) * 392

  return (
    <SimLayout
      controls={
        <Controls>
          <Slider label="Clusters to find (k)" value={k} min={1} max={6} onChange={setK} accent={accent} />
          <Segmented
            label="Initialisation"
            value={init}
            onChange={setInit}
            accent={accent}
            options={[
              { value: 'random', label: 'Random' },
              { value: 'plusplus', label: 'k-means++' },
            ]}
          />
          <div className="border-t border-white/[0.06] pt-4 text-xs font-medium tracking-wider text-fg-subtle uppercase">Dataset</div>
          <Slider label="True blobs" value={blobs} min={1} max={6} onChange={setBlobs} accent={accent} />
          <Slider label="Spread" value={spread} min={2} max={18} step={0.5} onChange={setSpread} accent={accent} />
          <Slider label="Points" value={count} min={50} max={800} step={50} onChange={setCount} accent={accent} />
          <div className="grid grid-cols-3 gap-2">
            <Button variant="primary" accent={accent} onClick={() => (done ? (setIdx(0), setPlaying(true)) : setPlaying((p) => !p))} title="Play / pause">
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <Button onClick={() => (setPlaying(false), setIdx((i) => Math.min(i + 1, iters.length - 1)))} title="One iteration">
              <StepForward size={16} />
            </Button>
            <Button onClick={() => (setPlaying(false), setIdx(0))} title="Rewind">
              <RotateCcw size={16} />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setInitSeed(newSeed())}>
              <Dices size={16} /> Re-init
            </Button>
            <Button onClick={() => setDataSeed(newSeed())}>
              <Shuffle size={16} /> New data
            </Button>
          </div>
        </Controls>
      }
      stats={
        <StatGrid>
          <Stat label="Iteration" value={`${idx} / ${iters.length - 1}`} accent={accent} />
          <Stat label="Inertia" value={Math.round(cur.inertia).toLocaleString()} sub="lower = tighter" />
          <Stat label="Points" value={count} />
          <Stat label="State" value={done ? 'Converged' : 'Iterating'} />
        </StatGrid>
      }
      insight={<Insight accent={accent}>{insight}</Insight>}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
        <Panel title="Feature space" bodyClassName="p-3 sm:p-4">
          <svg viewBox="0 0 400 400" className="mx-auto w-full max-w-[560px]" role="img" aria-label="Scatter plot of points coloured by cluster">
            <rect x={0} y={0} width={400} height={400} rx={10} fill="rgba(255,255,255,0.015)" />
            {pts.map((p, i) => {
              const c = cur.assign[i]
              return (
                <Marker key={i} shape={c} x={toSvg(p.x)} y={toSvg(SIZE - p.y)} r={3} fill={CLUSTER_COLORS[c % CLUSTER_COLORS.length]} />
              )
            })}
            {cur.centroids.map((c, j) => (
              <motion.g key={j} initial={false} animate={{ x: toSvg(c.x), y: toSvg(SIZE - c.y) }} transition={{ type: 'spring', stiffness: 160, damping: 20 }}>
                <circle r={11} fill="#06080f" stroke={CLUSTER_COLORS[j % CLUSTER_COLORS.length]} strokeWidth={2.5} />
                <path d="M-4.5,-4.5 L4.5,4.5 M4.5,-4.5 L-4.5,4.5" stroke="#fafafa" strokeWidth={2.2} strokeLinecap="round" />
              </motion.g>
            ))}
          </svg>
        </Panel>
        <Panel title="Cluster sizes">
          <ul className="space-y-2.5">
            {sizes.map((s, j) => (
              <li key={j} className="flex items-center gap-3 text-sm">
                <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden>
                  <Marker shape={j} x={0} y={0} r={5} fill={CLUSTER_COLORS[j % CLUSTER_COLORS.length]} />
                </svg>
                <span className="text-fg-muted">Cluster {j + 1}</span>
                <span className="ml-auto font-mono tabular-nums">{s}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Inertia per iteration">
        <div className="h-48">
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="iter" type="number" domain={[0, Math.max(3, iters.length - 1)]} allowDecimals={false} {...axisProps} />
              <YAxis {...axisProps} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
              <Tooltip content={<ChartTooltip labelFormat={(l) => `Iteration ${l}`} />} />
              <Line type="monotone" dataKey="inertia" name="Inertia" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, fill: SERIES[0], stroke: '#0b0f1a', strokeWidth: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </SimLayout>
  )
}
