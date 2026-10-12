import { useEffect, useMemo, useRef } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SimLayout } from '../../components/SimLayout'
import { ChartTooltip, Controls, Insight, Legend, Panel, Segmented, Slider, Stat, StatGrid } from '../../components/ui'
import { SERIES, axisProps } from '../../lib/chart'
import type { SimProps } from '../registry'
import { useSimParam } from '../../lib/simParams'

type Wave = 'square' | 'sawtooth' | 'triangle'

/** Fourier sine-series coefficients: returns [harmonic n, amplitude b_n] for the first `terms` non-zero terms. */
function coefficients(wave: Wave, terms: number): [number, number][] {
  const out: [number, number][] = []
  for (let n = 1; out.length < terms; n++) {
    if (wave === 'square' && n % 2 === 1) out.push([n, 4 / (Math.PI * n)])
    if (wave === 'sawtooth') out.push([n, ((n % 2 ? 1 : -1) * 2) / (Math.PI * n)])
    if (wave === 'triangle' && n % 2 === 1) out.push([n, ((((n - 1) / 2) % 2 ? -1 : 1) * 8) / (Math.PI * Math.PI * n * n)])
  }
  return out
}

function target(wave: Wave, t: number) {
  const x = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) // 0..2π
  if (wave === 'square') return x < Math.PI ? 1 : -1
  if (wave === 'sawtooth') return x < Math.PI ? x / Math.PI : x / Math.PI - 2
  // triangle with sin-like phase
  if (x < Math.PI / 2) return (2 * x) / Math.PI
  if (x < (3 * Math.PI) / 2) return 2 - (2 * x) / Math.PI
  return (2 * x) / Math.PI - 4
}

const synth = (cs: [number, number][], t: number) => cs.reduce((s, [n, b]) => s + b * Math.sin(n * t), 0)

export default function Fourier({ accent }: SimProps) {
  const [wave, setWave] = useSimParam<Wave>('wave', 'square', { label: 'Shape', oneOf: ['square', 'sawtooth', 'triangle'] })
  const [terms, setTerms] = useSimParam('terms', 5, { label: 'Terms', min: 1, max: 60 })
  const [speed, setSpeed] = useSimParam('speed', 1, { label: 'Speed', format: (v) => `${v.toFixed(1)}×`, min: 0.1, max: 3 })

  const cs = useMemo(() => coefficients(wave, terms), [wave, terms])
  const csRef = useRef(cs)
  csRef.current = cs
  const speedRef = useRef(speed)
  speedRef.current = speed
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const traceRef = useRef<number[]>([])

  useEffect(() => {
    traceRef.current = []
  }, [wave, terms])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let t = 0
    let last = performance.now()

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt * speedRef.current * 1.6

      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const R = Math.min(h * 0.28, w * 0.11)
      const cx = R * 1.9 + 16
      const cy = h / 2
      const waveX = cx + R * 1.9 + 24

      // epicycles
      let x = cx
      let y = cy
      for (const [n, b] of csRef.current) {
        const r = Math.abs(b) * R
        const phase = n * t + (b < 0 ? Math.PI : 0)
        const nx = x + r * Math.cos(phase)
        const ny = y - r * Math.sin(phase)
        ctx.strokeStyle = 'rgba(148,163,184,0.22)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(238,241,248,0.75)'
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(nx, ny)
        ctx.stroke()
        x = nx
        y = ny
      }

      // trace
      const trace = traceRef.current
      trace.unshift(y)
      const maxLen = Math.max(10, Math.floor(w - waveX - 10))
      if (trace.length > maxLen) trace.length = maxLen

      ctx.strokeStyle = 'rgba(52,211,153,0.35)'
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(waveX, y)
      ctx.stroke()
      ctx.setLineDash([])

      // midline
      ctx.strokeStyle = 'rgba(148,163,184,0.12)'
      ctx.beginPath()
      ctx.moveTo(waveX, cy)
      ctx.lineTo(w - 10, cy)
      ctx.stroke()

      ctx.strokeStyle = accent
      ctx.lineWidth = 2
      ctx.beginPath()
      trace.forEach((ty, i) => (i ? ctx.lineTo(waveX + i, ty) : ctx.moveTo(waveX, ty)))
      ctx.stroke()

      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [accent])

  const series = useMemo(() => {
    const N = 400
    return Array.from({ length: N + 1 }, (_, i) => {
      const t = (2 * Math.PI * i) / N
      return { t, approx: synth(cs, t), target: target(wave, t) }
    })
  }, [cs, wave])

  const peak = Math.max(...series.map((p) => p.approx))
  const rms = Math.sqrt(
    series.filter((_, i) => i % 50 !== 0).reduce((s, p) => s + (p.approx - p.target) ** 2, 0) / series.length,
  )
  const overshoot = (peak - 1) * 100

  const insight =
    wave === 'square'
      ? terms >= 15
        ? `With ${terms} terms the edges are sharp, yet the peak still overshoots by ${overshoot.toFixed(1)}%. That is the Gibbs phenomenon: adding terms squeezes the ripple closer to the jump but never shrinks it below ~9%.`
        : `A square wave uses only odd harmonics (1, 3, 5, …) with amplitudes 4/(πn). With ${terms} term${terms > 1 ? 's' : ''} the shape is still wavy; add more and watch the corners form.`
      : wave === 'triangle'
        ? `Triangle-wave coefficients fall off like 1/n², much faster than the square wave's 1/n, so only a handful of terms give a near-perfect match. Smooth shapes need fewer sine waves.`
        : 'The sawtooth needs every harmonic, odd and even, and its sudden drop shows the same Gibbs overshoot as the square wave.'

  return (
    <SimLayout
      controls={
        <Controls>
          <Segmented
            label="Target shape"
            value={wave}
            onChange={setWave}
            accent={accent}
            options={[
              { value: 'square', label: 'Square' },
              { value: 'sawtooth', label: 'Sawtooth' },
              { value: 'triangle', label: 'Triangle' },
            ]}
          />
          <Slider label="Number of terms" value={terms} min={1} max={60} onChange={setTerms} accent={accent} />
          <Slider label="Rotation speed" value={speed} min={0.1} max={3} step={0.1} onChange={setSpeed} accent={accent} format={(v) => `${v.toFixed(1)}×`} />
          <div className="rounded-xl bg-ink-850/60 p-3">
            <div className="mb-2 text-xs font-medium tracking-wider text-fg-subtle uppercase">Harmonics used</div>
            <div className="flex flex-wrap gap-1 font-mono text-[11px]">
              {cs.slice(0, 16).map(([n, b]) => (
                <span key={n} className="rounded bg-ink-700 px-1.5 py-0.5 text-fg-muted" title={`b${n} = ${b.toFixed(4)}`}>
                  {n}
                </span>
              ))}
              {cs.length > 16 && <span className="px-1 text-fg-subtle">+{cs.length - 16} more</span>}
            </div>
          </div>
        </Controls>
      }
      stats={
        <StatGrid>
          <Stat label="Terms" value={terms} accent={accent} />
          <Stat label="Highest harmonic" value={cs[cs.length - 1][0]} />
          <Stat label="Peak overshoot" value={`${Math.max(0, overshoot).toFixed(1)}%`} sub="vs target height 1" />
          <Stat label="RMS error" value={rms.toFixed(4)} />
        </StatGrid>
      }
      insight={<Insight accent={accent}>{insight}</Insight>}
    >
      <Panel title="Epicycles: each circle is one sine wave" bodyClassName="p-0">
        <canvas ref={canvasRef} className="block h-[300px] w-full" aria-label="Rotating epicycles drawing a wave" />
      </Panel>
      <Panel
        title="One period: approximation vs target"
        actions={<Legend items={[{ label: 'Fourier sum', color: SERIES[0] }, { label: 'Target', color: SERIES[1], dashed: true }]} />}
      >
        <div className="h-60">
          <ResponsiveContainer>
            <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={[0, 2 * Math.PI]}
                ticks={[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 2 * Math.PI]}
                tickFormatter={(v: number) => ['0', 'π/2', 'π', '3π/2', '2π'][Math.round(v / (Math.PI / 2))]}
                {...axisProps}
              />
              <YAxis domain={[-1.4, 1.4]} ticks={[-1, 0, 1]} {...axisProps} axisLine={false} />
              <Tooltip content={<ChartTooltip labelFormat={(l) => `t = ${Number(l).toFixed(2)}`} valueFormat={(v) => Number(v).toFixed(3)} />} />
              <Line dataKey="target" name="Target" stroke={SERIES[1]} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              <Line dataKey="approx" name="Fourier sum" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </SimLayout>
  )
}
