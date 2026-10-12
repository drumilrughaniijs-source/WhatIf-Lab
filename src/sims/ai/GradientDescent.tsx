import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Pause, Play, RotateCcw, StepForward } from 'lucide-react'
import { SimLayout } from '../../components/SimLayout'
import { Button, ChartTooltip, Controls, Insight, Panel, Segmented, Slider, Stat, StatGrid } from '../../components/ui'
import { SERIES, axisProps } from '../../lib/chart'
import type { SimProps } from '../registry'
import { useSimParam } from '../../lib/simParams'

type Landscape = 'bowl' | 'valleys' | 'bumpy'

const LANDSCAPES: Record<Landscape, { f: (x: number) => number; df: (x: number) => number; label: string }> = {
  bowl: { f: (x) => x * x, df: (x) => 2 * x, label: 'Bowl' },
  valleys: {
    f: (x) => 0.25 * x ** 4 - x * x + 0.3 * x + 1.5,
    df: (x) => x ** 3 - 2 * x + 0.3,
    label: 'Two valleys',
  },
  bumpy: {
    f: (x) => 0.3 * x * x - 0.5 * Math.cos(5 * x) + 0.5,
    df: (x) => 0.6 * x + 2.5 * Math.sin(5 * x),
    label: 'Bumpy',
  },
}

const X_MIN = -3
const X_MAX = 3
const MAX_STEPS = 150
const W = 640
const H = 300
const PAD = 24

type Status = 'converged' | 'diverged' | 'running'

function run(land: Landscape, lr: number, momentum: number, x0: number) {
  const { f, df } = LANDSCAPES[land]
  const path = [{ step: 0, x: x0, loss: f(x0) }]
  let x = x0
  let v = 0
  let status: Status = 'running'
  for (let i = 1; i <= MAX_STEPS; i++) {
    v = momentum * v - lr * df(x)
    x = x + v
    if (!isFinite(x) || Math.abs(x) > 50) {
      status = 'diverged'
      break
    }
    path.push({ step: i, x, loss: f(x) })
    if (Math.abs(df(x)) < 1e-3 && Math.abs(v) < 1e-3) {
      status = 'converged'
      break
    }
  }
  return { path, status }
}

export default function GradientDescent({ accent }: SimProps) {
  const [land, setLand] = useSimParam<Landscape>('land', 'valleys', { label: 'Landscape', oneOf: ['bowl', 'valleys', 'bumpy'] })
  const [logLr, setLogLr] = useSimParam('logLr', Math.log10(0.05), { label: 'Learning rate', format: (v) => (10 ** v).toFixed(3), min: -3, max: 0.1 })
  const [momentum, setMomentum] = useSimParam('momentum', 0, { label: 'Momentum', format: (v) => v.toFixed(2), min: 0, max: 0.95 })
  const [x0, setX0] = useSimParam('x0', 2.5, { label: 'Start x₀', format: (v) => v.toFixed(1), min: -2.9, max: 2.9 })
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)

  const lr = 10 ** logLr
  const { path, status } = useMemo(() => run(land, lr, momentum, x0), [land, lr, momentum, x0])

  // restart whenever the experiment changes
  useEffect(() => {
    setIdx(0)
    setPlaying(true)
  }, [land, lr, momentum, x0])

  useEffect(() => {
    if (!playing) return
    if (idx >= path.length - 1) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setIdx((i) => i + 1), 70)
    return () => clearTimeout(t)
  }, [playing, idx, path.length])

  const { f } = LANDSCAPES[land]
  const curve = useMemo(() => {
    const pts = Array.from({ length: 241 }, (_, i) => {
      const x = X_MIN + ((X_MAX - X_MIN) * i) / 240
      return { x, y: f(x) }
    })
    const ys = pts.map((p) => p.y)
    return { pts, yMin: Math.min(...ys), yMax: Math.max(...ys) }
  }, [f])

  const sx = (x: number) => PAD + ((x - X_MIN) / (X_MAX - X_MIN)) * (W - 2 * PAD)
  const sy = (y: number) => {
    const yy = Math.min(curve.yMax, Math.max(curve.yMin, y))
    return H - PAD - ((yy - curve.yMin) / (curve.yMax - curve.yMin)) * (H - 2 * PAD)
  }
  const d = curve.pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')

  const shown = path.slice(0, idx + 1)
  const cur = shown[shown.length - 1]
  const inView = cur.x >= X_MIN && cur.x <= X_MAX
  const finished = idx >= path.length - 1

  const verdict: { text: string; tone: string } =
    finished && status === 'diverged'
      ? { text: 'Diverged', tone: 'text-red-300' }
      : finished && status === 'converged'
        ? { text: 'Converged', tone: 'text-emerald-300' }
        : finished
          ? { text: 'Still moving', tone: 'text-yellow-300' }
          : { text: 'Training…', tone: 'text-fg' }

  const insight = !finished
    ? 'The ball always steps in the direction that lowers the loss fastest, scaled by the learning rate η. Watch whether it settles, overshoots, or flies off.'
    : status === 'diverged'
      ? `With η = ${lr.toFixed(3)} each step overshoots the minimum by more than it corrects, so the error grows instead of shrinking. This is the classic "loss went to NaN" bug in deep learning.`
      : status === 'converged' && path.length < 15
        ? `Converged in just ${path.length - 1} steps. A well-tuned learning rate is a huge speed-up, but on bumpier landscapes the same η might overshoot.`
        : status === 'converged'
          ? `Converged after ${path.length - 1} steps to x ≈ ${path[path.length - 1].x.toFixed(3)}. ${land !== 'bowl' ? 'Is this the global minimum, or just the nearest valley? Try momentum or a different start.' : 'Try increasing the learning rate to converge faster.'}`
          : `After ${MAX_STEPS} steps the optimiser is still moving. Either the learning rate is too small, or it is oscillating around a minimum. Adding momentum or tuning η helps.`

  return (
    <SimLayout
      controls={
        <Controls>
          <Segmented
            label="Loss landscape"
            value={land}
            onChange={setLand}
            accent={accent}
            options={(Object.keys(LANDSCAPES) as Landscape[]).map((k) => ({ value: k, label: LANDSCAPES[k].label }))}
          />
          <Slider
            label="Learning rate η"
            value={logLr}
            min={-3}
            max={0.1}
            step={0.01}
            onChange={setLogLr}
            accent={accent}
            format={() => lr.toFixed(lr < 0.01 ? 4 : 3)}
            hint="Logarithmic slider: each notch multiplies the step size."
          />
          <Slider label="Momentum β" value={momentum} min={0} max={0.95} step={0.01} onChange={setMomentum} accent={accent} format={(v) => v.toFixed(2)} />
          <Slider label="Starting point x₀" value={x0} min={-2.9} max={2.9} step={0.1} onChange={setX0} accent={accent} format={(v) => v.toFixed(1)} />
          <div className="grid grid-cols-3 gap-2">
            <Button variant="primary" accent={accent} onClick={() => (finished ? (setIdx(0), setPlaying(true)) : setPlaying((p) => !p))} title="Play / pause">
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <Button onClick={() => (setPlaying(false), setIdx((i) => Math.min(i + 1, path.length - 1)))} title="Step once">
              <StepForward size={16} />
            </Button>
            <Button onClick={() => (setPlaying(false), setIdx(0))} title="Rewind">
              <RotateCcw size={16} />
            </Button>
          </div>
        </Controls>
      }
      stats={
        <StatGrid>
          <Stat label="Step" value={cur.step} accent={accent} />
          <Stat label="Position x" value={cur.x.toFixed(3)} />
          <Stat label="Loss L(x)" value={cur.loss.toFixed(4)} />
          <Stat label="Status" value={<span className={verdict.tone}>{verdict.text}</span>} />
        </StatGrid>
      }
      insight={<Insight accent={accent}>{insight}</Insight>}
    >
      <Panel title="Loss landscape" bodyClassName="p-3 sm:p-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Loss curve with optimiser position">
          <defs>
            <linearGradient id="gd-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${d} L${sx(X_MAX)},${H - PAD} L${sx(X_MIN)},${H - PAD} Z`} fill="url(#gd-fill)" />
          <path d={d} fill="none" stroke={accent} strokeWidth={2} />
          {/* trail */}
          {shown.slice(0, -1).map((p, i) =>
            p.x >= X_MIN && p.x <= X_MAX ? (
              <circle key={i} cx={sx(p.x)} cy={sy(p.loss)} r={3} fill="#fafafa" opacity={0.15 + (0.5 * i) / shown.length} />
            ) : null,
          )}
          {shown.length > 1 && (
            <polyline
              points={shown.filter((p) => p.x >= X_MIN && p.x <= X_MAX).map((p) => `${sx(p.x)},${sy(p.loss)}`).join(' ')}
              fill="none"
              stroke="#fafafa"
              strokeOpacity={0.2}
              strokeDasharray="3 4"
            />
          )}
          {inView ? (
            <motion.circle
              r={9}
              fill="#fafafa"
              stroke={accent}
              strokeWidth={3}
              animate={{ cx: sx(cur.x), cy: sy(cur.loss) - 9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            />
          ) : (
            <text x={W / 2} y={40} textAnchor="middle" fill="#fca5a5" fontSize={14}>
              Optimiser has left the chart (x = {cur.x.toExponential(1)})
            </text>
          )}
          <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} stroke="rgba(148,163,184,0.25)" />
          {[-3, -2, -1, 0, 1, 2, 3].map((t) => (
            <text key={t} x={sx(t)} y={H - 6} textAnchor="middle" fill="#737d99" fontSize={11}>
              {t}
            </text>
          ))}
        </svg>
      </Panel>

      <Panel title="Loss per step">
        <div className="h-52">
          <ResponsiveContainer>
            <LineChart data={shown} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="step" type="number" domain={[0, Math.max(10, path.length - 1)]} {...axisProps} />
              <YAxis {...axisProps} axisLine={false} tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? v.toExponential(0) : v.toFixed(1))} />
              <Tooltip content={<ChartTooltip labelFormat={(l) => `Step ${l}`} valueFormat={(v) => Number(v).toFixed(4)} />} />
              <Line type="monotone" dataKey="loss" name="Loss" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </SimLayout>
  )
}
