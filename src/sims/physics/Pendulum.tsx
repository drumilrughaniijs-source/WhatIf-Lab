import { useEffect, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { SimLayout } from '../../components/SimLayout'
import { Button, ChartTooltip, Controls, Insight, Legend, Panel, Segmented, Slider, Stat, StatGrid } from '../../components/ui'
import { SERIES, axisProps } from '../../lib/chart'
import type { SimProps } from '../registry'
import { useSimParam } from '../../lib/simParams'

const GRAVITY = { Earth: 9.81, Moon: 1.62, Mars: 3.72, Jupiter: 24.79 } as const
type Planet = keyof typeof GRAVITY

const MASS = 1
const MAX_L = 5
const WINDOW_S = 12

/** Arithmetic–geometric mean, used for the exact large-amplitude period. */
function agm(a: number, b: number) {
  for (let i = 0; i < 20; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)]
  return a
}

interface Sample {
  t: number
  angle: number
  ke: number
  pe: number
  total: number
}

export default function Pendulum({ accent }: SimProps) {
  const [length, setLength] = useSimParam('length', 2, { label: 'Length', format: (v) => `${v.toFixed(2)} m`, min: 0.25, max: 5 })
  const [planet, setPlanet] = useSimParam<Planet>('planet', 'Earth', { label: 'Gravity', oneOf: ['Earth', 'Moon', 'Mars', 'Jupiter'] })
  const [amp, setAmp] = useSimParam('amp', 30, { label: 'Release angle', format: (v) => `${v}°`, min: 1, max: 175 })
  const [damping, setDamping] = useSimParam('damping', 0, { label: 'Damping', format: (v) => v.toFixed(2), min: 0, max: 1 })
  const [running, setRunning] = useState(true)
  const [samples, setSamples] = useState<Sample[]>([])
  const [measured, setMeasured] = useState<number | null>(null)
  const [resetKey, setResetKey] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const params = useRef({ length, g: GRAVITY[planet], damping })
  params.current = { length, g: GRAVITY[planet], damping }
  const state = useRef({ theta: 0, omega: 0, t: 0 })
  const history = useRef<Sample[]>([])
  const crossings = useRef<number[]>([])
  const trail = useRef<{ x: number; y: number }[]>([])

  // reset on amplitude change or explicit reset
  useEffect(() => {
    state.current = { theta: (amp * Math.PI) / 180, omega: 0, t: 0 }
    history.current = []
    crossings.current = []
    trail.current = []
    setSamples([])
    setMeasured(null)
  }, [amp, resetKey])

  // period measurement depends on L and g, so restart measuring when they change
  useEffect(() => {
    crossings.current = []
    setMeasured(null)
  }, [length, planet])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let last = performance.now()
    let lastSample = 0

    const accel = (th: number, om: number) => {
      const { length: L, g, damping: c } = params.current
      return -(g / L) * Math.sin(th) - c * om
    }

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const { length: L } = params.current
      const { theta } = state.current
      const scale = Math.min((h - 60) / MAX_L, (w / 2 - 30) / MAX_L)
      const px = w / 2
      const py = 26
      const bx = px + Math.sin(theta) * L * scale
      const by = py + Math.cos(theta) * L * scale

      // swing arc guide
      ctx.strokeStyle = 'rgba(148,163,184,0.12)'
      ctx.setLineDash([3, 5])
      ctx.beginPath()
      ctx.arc(px, py, L * scale, Math.PI / 2 - Math.PI, Math.PI / 2 + Math.PI)
      ctx.stroke()
      ctx.setLineDash([])

      // vertical reference
      ctx.strokeStyle = 'rgba(148,163,184,0.15)'
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px, py + L * scale + 20)
      ctx.stroke()

      // trail
      trail.current.push({ x: bx, y: by })
      if (trail.current.length > 60) trail.current.shift()
      trail.current.forEach((p, i) => {
        ctx.fillStyle = accent
        ctx.globalAlpha = (i / trail.current.length) * 0.35
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.globalAlpha = 1

      // ceiling + rod
      ctx.fillStyle = '#2c3757'
      ctx.fillRect(px - 50, py - 8, 100, 6)
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(bx, by)
      ctx.stroke()
      ctx.fillStyle = '#cbd5e1'
      ctx.beginPath()
      ctx.arc(px, py, 4, 0, Math.PI * 2)
      ctx.fill()

      // bob
      const grad = ctx.createRadialGradient(bx - 5, by - 5, 2, bx, by, 18)
      grad.addColorStop(0, '#ffffff')
      grad.addColorStop(1, accent)
      ctx.fillStyle = grad
      ctx.shadowColor = accent
      ctx.shadowBlur = 20
      ctx.beginPath()
      ctx.arc(bx, by, 16, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }

    const loop = (now: number) => {
      const elapsed = Math.min(0.05, (now - last) / 1000)
      last = now
      if (running) {
        const steps = Math.ceil(elapsed / 0.001)
        const dt = elapsed / steps
        const s = state.current
        for (let i = 0; i < steps; i++) {
          // RK4
          const k1t = s.omega
          const k1o = accel(s.theta, s.omega)
          const k2t = s.omega + (dt / 2) * k1o
          const k2o = accel(s.theta + (dt / 2) * k1t, s.omega + (dt / 2) * k1o)
          const k3t = s.omega + (dt / 2) * k2o
          const k3o = accel(s.theta + (dt / 2) * k2t, s.omega + (dt / 2) * k2o)
          const k4t = s.omega + dt * k3o
          const k4o = accel(s.theta + dt * k3t, s.omega + dt * k3o)
          const prev = s.theta
          s.theta += (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t)
          s.omega += (dt / 6) * (k1o + 2 * k2o + 2 * k3o + k4o)
          s.t += dt
          // upward zero-crossing → one full period between consecutive ones
          if (prev < 0 && s.theta >= 0) {
            const tc = s.t - dt * (s.theta / (s.theta - prev))
            crossings.current.push(tc)
            if (crossings.current.length >= 2) {
              const c = crossings.current
              setMeasured(c[c.length - 1] - c[c.length - 2])
            }
          }
        }
        if (s.t - lastSample > 0.08 || s.t < lastSample) {
          lastSample = s.t
          const { length: L, g } = params.current
          const ke = 0.5 * MASS * (L * s.omega) ** 2
          const pe = MASS * g * L * (1 - Math.cos(s.theta))
          history.current.push({
            t: Number(s.t.toFixed(2)),
            angle: Number(((s.theta * 180) / Math.PI).toFixed(2)),
            ke: Number(ke.toFixed(3)),
            pe: Number(pe.toFixed(3)),
            total: Number((ke + pe).toFixed(3)),
          })
          while (history.current.length && history.current[0].t < s.t - WINDOW_S) history.current.shift()
          setSamples([...history.current])
        }
      }
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, accent])

  const g = GRAVITY[planet]
  const t0 = 2 * Math.PI * Math.sqrt(length / g)
  const exact = t0 / agm(1, Math.cos((amp * Math.PI) / 360))
  const err = ((exact - t0) / t0) * 100

  const insight =
    amp > 60
      ? `At ${amp}° the small-angle formula underestimates the period by ${err.toFixed(1)}%. The real pendulum spends extra time near the top of its swing, where gravity's restoring pull is weaker than the linear approximation assumes.`
      : damping > 0
        ? 'Damping drains energy exponentially; watch total energy (green) fall while kinetic and potential keep trading places. The rhythm stays almost the same as the swing shrinks.'
        : `At small angles the period is ≈ 2π√(L/g) = ${t0.toFixed(2)} s no matter the amplitude. Quadruple the length and the period only doubles.`

  return (
    <SimLayout
      controls={
        <Controls>
          <Slider label="Length L" value={length} min={0.25} max={MAX_L} step={0.05} onChange={setLength} accent={accent} format={(v) => `${v.toFixed(2)} m`} />
          <Segmented
            label="Gravity"
            value={planet}
            onChange={setPlanet}
            accent={accent}
            options={(Object.keys(GRAVITY) as Planet[]).map((p) => ({ value: p, label: p }))}
          />
          <Slider label="Release angle" value={amp} min={1} max={175} onChange={setAmp} accent={accent} format={(v) => `${v}°`} />
          <Slider label="Damping" value={damping} min={0} max={1} step={0.01} onChange={setDamping} accent={accent} format={(v) => v.toFixed(2)} hint="Friction / air resistance coefficient (1/s)." />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" accent={accent} onClick={() => setRunning((r) => !r)}>
              {running ? <Pause size={16} /> : <Play size={16} />}
              {running ? 'Pause' : 'Play'}
            </Button>
            <Button onClick={() => setResetKey((k) => k + 1)}>
              <RotateCcw size={16} /> Release
            </Button>
          </div>
        </Controls>
      }
      stats={
        <StatGrid>
          <Stat label="Small-angle T" value={`${t0.toFixed(3)} s`} sub="2π√(L/g)" accent={accent} />
          <Stat label="Exact T" value={`${exact.toFixed(3)} s`} sub={`+${err.toFixed(2)}% vs formula`} />
          <Stat label="Measured T" value={measured ? `${measured.toFixed(3)} s` : '…'} sub="from simulation" />
          <Stat label="g" value={`${g} m/s²`} sub={planet} />
        </StatGrid>
      }
      insight={<Insight accent={accent}>{insight}</Insight>}
    >
      <Panel title="Live simulation" bodyClassName="p-0">
        <canvas ref={canvasRef} className="block h-[340px] w-full" aria-label="Animated pendulum" />
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Angle over time">
          <div className="h-48">
            <ResponsiveContainer>
              <LineChart data={samples} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} {...axisProps} tickFormatter={(v: number) => `${Number(v.toFixed(1))}s`} />
                <YAxis {...axisProps} axisLine={false} domain={[-amp, amp]} tickFormatter={(v: number) => `${Math.round(v)}°`} />
                <Tooltip content={<ChartTooltip labelFormat={(l) => `t = ${Number(l).toFixed(2)} s`} valueFormat={(v) => `${Number(v).toFixed(1)}°`} />} />
                <Line dataKey="angle" name="Angle" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel
          title="Energy (J, 1 kg bob)"
          actions={
            <Legend
              items={[
                { label: 'Kinetic', color: SERIES[0] },
                { label: 'Potential', color: SERIES[1] },
                { label: 'Total', color: SERIES[2] },
              ]}
            />
          }
        >
          <div className="h-48">
            <ResponsiveContainer>
              <LineChart data={samples} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} {...axisProps} tickFormatter={(v: number) => `${Number(v.toFixed(1))}s`} />
                <YAxis {...axisProps} axisLine={false} />
                <Tooltip content={<ChartTooltip labelFormat={(l) => `t = ${Number(l).toFixed(2)} s`} valueFormat={(v) => `${Number(v).toFixed(2)} J`} />} />
                <Line dataKey="ke" name="Kinetic" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="pe" name="Potential" stroke={SERIES[1]} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="total" name="Total" stroke={SERIES[2]} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </SimLayout>
  )
}
