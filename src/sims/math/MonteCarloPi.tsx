import { useCallback, useEffect, useRef, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { SimLayout } from '../../components/SimLayout'
import { Button, ChartTooltip, Controls, Insight, Legend, Panel, Slider, Stat, StatGrid } from '../../components/ui'
import { mulberry32, newSeed } from '../../lib/random'
import { SERIES, axisProps } from '../../lib/chart'
import type { SimProps } from '../registry'
import { useSimParam } from '../../lib/simParams'

const INSIDE = SERIES[0]
const OUTSIDE = SERIES[1]

interface Point {
  n: number
  estimate: number
  band: [number, number]
}

function correctDigits(est: number) {
  const a = est.toFixed(10)
  const b = Math.PI.toFixed(10)
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  return Math.max(0, i - 1) // don't count the decimal point
}

export default function MonteCarloPi({ accent }: SimProps) {
  const [rate, setRate] = useSimParam('rate', 200, { label: 'Darts per frame', min: 1, max: 5000 })
  const [target, setTarget] = useSimParam('target', 5, { label: 'Total darts', format: (v) => Math.round(10 ** v).toLocaleString(), min: 2, max: 7 }) // log10 of darts
  const [running, setRunning] = useState(true)
  const [stats, setStats] = useState({ n: 0, inside: 0 })
  const [history, setHistory] = useState<Point[]>([])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sim = useRef({ n: 0, inside: 0, rand: mulberry32(newSeed()), nextLog: 0 })
  const rateRef = useRef(rate)
  rateRef.current = rate
  const targetN = Math.round(10 ** target)

  const prepareCanvas = useCallback(() => {
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const size = c.clientWidth
    c.width = size * dpr
    c.height = size * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0b0f1a'
    ctx.fillRect(0, 0, size, size)
    return { ctx, size }
  }, [])

  const drawOverlay = useCallback((ctx: CanvasRenderingContext2D, size: number) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, size, size, -Math.PI / 2, 0)
    ctx.stroke()
  }, [])

  const reset = useCallback(() => {
    sim.current = { n: 0, inside: 0, rand: mulberry32(newSeed()), nextLog: 0 }
    setStats({ n: 0, inside: 0 })
    setHistory([])
    const { ctx, size } = prepareCanvas()
    drawOverlay(ctx, size)
    setRunning(true)
  }, [prepareCanvas, drawOverlay])

  useEffect(reset, [reset])

  useEffect(() => {
    if (!running) return
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    const size = c.clientWidth
    let raf = 0
    const loop = () => {
      const s = sim.current
      const batch = Math.min(rateRef.current, targetN - s.n)
      const pts: Point[] = []
      for (let i = 0; i < batch; i++) {
        const x = s.rand()
        const y = s.rand()
        const inside = x * x + y * y <= 1
        if (inside) s.inside++
        s.n++
        // drawing every dart beyond ~200k adds nothing visually
        if (s.n < 200_000) {
          ctx.fillStyle = inside ? INSIDE : OUTSIDE
          ctx.globalAlpha = s.n < 5000 ? 0.9 : 0.5
          ctx.fillRect(x * size - 1, (1 - y) * size - 1, s.n < 5000 ? 2.5 : 1.5, s.n < 5000 ? 2.5 : 1.5)
        }
        // log-spaced checkpoints for the convergence chart
        if (Math.log10(s.n) >= s.nextLog) {
          const est = (4 * s.inside) / s.n
          const sd = 4 * Math.sqrt((Math.PI / 4) * (1 - Math.PI / 4) / s.n)
          pts.push({ n: s.n, estimate: est, band: [Math.PI - 2 * sd, Math.PI + 2 * sd] })
          s.nextLog += 0.05
        }
      }
      ctx.globalAlpha = 1
      drawOverlay(ctx, size)
      if (pts.length) setHistory((h) => [...h, ...pts])
      setStats({ n: s.n, inside: s.inside })
      if (s.n >= targetN) {
        setRunning(false)
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, targetN, drawOverlay])

  const est = stats.n ? (4 * stats.inside) / stats.n : 0
  const err = Math.abs(est - Math.PI)
  const done = stats.n >= targetN

  return (
    <SimLayout
      controls={
        <Controls>
          <Slider label="Darts per frame" value={rate} min={1} max={5000} step={1} onChange={setRate} accent={accent} format={(v) => v.toLocaleString()} />
          <Slider
            label="Total darts"
            value={target}
            min={2}
            max={7}
            step={0.5}
            onChange={setTarget}
            accent={accent}
            format={() => targetN.toLocaleString()}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" accent={accent} disabled={done} onClick={() => setRunning((r) => !r)}>
              {running ? <Pause size={16} /> : <Play size={16} />}
              {running ? 'Pause' : 'Throw'}
            </Button>
            <Button onClick={reset}>
              <RotateCcw size={16} /> New run
            </Button>
          </div>
          <div className="rounded-xl bg-ink-850/60 p-3 font-mono text-xs leading-relaxed text-fg-muted">
            π ≈ 4 × <span style={{ color: INSIDE }}>inside</span> / total
            <br />= 4 × {stats.inside.toLocaleString()} / {stats.n.toLocaleString()}
          </div>
        </Controls>
      }
      stats={
        <StatGrid>
          <Stat label="Darts thrown" value={stats.n.toLocaleString()} accent={accent} />
          <Stat label="Estimate of π" value={stats.n ? est.toFixed(6) : '—'} />
          <Stat label="Error" value={stats.n ? err.toExponential(2) : '—'} sub={stats.n ? `expected ≈ ${(1.64 / Math.sqrt(stats.n)).toExponential(1)}` : undefined} />
          <Stat label="Correct digits" value={stats.n ? correctDigits(est) : 0} sub="3.14159…" />
        </StatGrid>
      }
      insight={
        <Insight accent={accent}>
          {done
            ? `After ${targetN.toLocaleString()} darts the estimate is ${est.toFixed(5)}. The shaded band shows ±2 standard errors, which shrinks like 1/√N, so each extra correct digit costs about 100× more darts. Monte Carlo is slow for π but unbeatable for high-dimensional problems where grids are impossible.`
            : 'Every dart is a uniformly random (x, y) in the unit square. The share landing inside the quarter circle approaches its area, π/4.'}
        </Insight>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Panel title="Dartboard" actions={<Legend items={[{ label: 'Inside', color: INSIDE }, { label: 'Outside', color: OUTSIDE }]} />} bodyClassName="p-3">
          <canvas ref={canvasRef} className="aspect-square w-full rounded-lg" aria-label="Random points in a unit square" />
        </Panel>
        <Panel title="Convergence toward π">
          <div className="h-[340px]">
            <ResponsiveContainer>
              <ComposedChart data={history} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="n"
                  type="number"
                  scale="log"
                  domain={[1, Math.max(100, targetN)]}
                  {...axisProps}
                  tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000 >= 1000 ? `${v / 1e6}M` : `${v / 1000}k`}` : String(v))}
                  ticks={[1, 10, 100, 1000, 10000, 100000, 1000000, 10000000].filter((t) => t <= Math.max(100, targetN))}
                  allowDataOverflow
                />
                <YAxis domain={[2.6, 3.7]} {...axisProps} axisLine={false} tickFormatter={(v: number) => v.toFixed(1)} allowDataOverflow />
                <Tooltip content={<ChartTooltip labelFormat={(l) => `${Number(l).toLocaleString()} darts`} valueFormat={(v) => (Array.isArray(v) ? '' : Number(v).toFixed(5))} />} />
                <Area dataKey="band" name="±2σ band" stroke="none" fill={SERIES[2]} fillOpacity={0.15} isAnimationActive={false} tooltipType="none" />
                <ReferenceLine y={Math.PI} stroke="rgba(255,255,255,0.5)" strokeDasharray="4 4" label={{ value: 'π', position: 'right', fill: '#eef1f8', fontSize: 13 }} />
                <Line dataKey="estimate" name="Estimate" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </SimLayout>
  )
}
