import { useCallback, useEffect, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { SimLayout } from '../../components/SimLayout'
import { Button, ChartTooltip, Controls, Insight, Panel, Slider, Stat, StatGrid } from '../../components/ui'
import { SERIES, axisProps } from '../../lib/chart'
import { useSimParam } from '../../lib/simParams'
import {
  COLLISION_RADIUS,
  circularSpeed,
  elements,
  escapeSpeed,
  initialState,
  separation,
  step,
  totalEnergy,
  type OrbitState,
} from '../../models/orbit'
import type { SimProps } from '../registry'

const DT = 0.0005 // years per integration step
const ESCAPE_DISTANCE = 30 // AU
const MAX_TRAIL = 3000
const STAR_COLOR = '#fde68a'

type Status = 'running' | 'paused' | 'collision' | 'escaped'

const KIND_LABEL = { circular: 'Circular', elliptical: 'Elliptical', parabolic: 'Parabolic (escape)', hyperbolic: 'Hyperbolic (escape)', radial: 'Radial fall' }

export default function OrbitalGravity({ accent }: SimProps) {
  const [distance, setDistance] = useSimParam('distance', 1, { label: 'Distance', format: (v) => `${v.toFixed(2)} AU`, min: 0.3, max: 4 })
  const [speed, setSpeed] = useSimParam('speed', 5.2, { label: 'Initial speed', format: (v) => `${v.toFixed(2)} AU/yr`, min: 0, max: 25 })
  const [logQ, setLogQ] = useSimParam('logMass', -3, { label: 'Relative mass', format: (v) => (10 ** v).toPrecision(2), min: -3, max: 0 })
  const [timeScale, setTimeScale] = useSimParam('timeScale', 0.6, { label: 'Playback', format: (v) => `${v.toFixed(1)} yr/s`, min: 0.1, max: 5 })

  const q = 10 ** logQ
  const input = { distance, speed, massRatio: q }
  const el = elements(input)
  const vc = circularSpeed(distance, q)
  const ve = escapeSpeed(distance, q)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sim = useRef<OrbitState>(initialState(input))
  const e0 = useRef(totalEnergy(sim.current))
  const trails = useRef<{ star: [number, number][]; planet: [number, number][] }>({ star: [], planet: [] })
  const samples = useRef<{ t: number; r: number }[]>([])
  const timeScaleRef = useRef(timeScale)
  timeScaleRef.current = timeScale

  const [status, setStatus] = useState<Status>('running')
  const [live, setLive] = useState({ t: 0, r: distance, v: speed, drift: 0 })
  const [chart, setChart] = useState<{ t: number; r: number }[]>([])

  const viewRadius = el.apoapsis !== null && el.kind !== 'radial' ? Math.max(el.apoapsis, distance) * 1.15 : distance * 4

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const s = sim.current
    const scale = (Math.min(w, h) / 2 - 18) / viewRadius
    const cx = w / 2
    const cy = h / 2
    const X = (x: number) => cx + x * scale
    const Y = (y: number) => cy - y * scale

    // distance rings (scale reference)
    const ringStep = viewRadius > 8 ? 5 : viewRadius > 3 ? 1 : 0.5
    ctx.lineWidth = 1
    ctx.font = '10px "JetBrains Mono Variable", monospace'
    for (let r = ringStep; r <= viewRadius * 1.5; r += ringStep) {
      ctx.strokeStyle = 'rgba(148,163,184,0.08)'
      ctx.beginPath()
      ctx.arc(cx, cy, r * scale, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = 'rgba(148,163,184,0.4)'
      ctx.fillText(`${r} AU`, cx + r * scale + 3, cy - 3)
    }

    const drawTrail = (pts: [number, number][], color: string) => {
      if (pts.length < 2) return
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.7
      ctx.beginPath()
      ctx.moveTo(X(pts[0][0]), Y(pts[0][1]))
      for (let i = 1; i < pts.length; i++) ctx.lineTo(X(pts[i][0]), Y(pts[i][1]))
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    drawTrail(trails.current.star, STAR_COLOR)
    drawTrail(trails.current.planet, accent)

    // barycentre
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.moveTo(cx - 4, cy)
    ctx.lineTo(cx + 4, cy)
    ctx.moveTo(cx, cy - 4)
    ctx.lineTo(cx, cy + 4)
    ctx.stroke()

    // star
    ctx.shadowColor = STAR_COLOR
    ctx.shadowBlur = 18
    ctx.fillStyle = STAR_COLOR
    ctx.beginPath()
    ctx.arc(X(s.star.x), Y(s.star.y), 8, 0, Math.PI * 2)
    ctx.fill()
    // companion (size grows with mass)
    ctx.shadowColor = accent
    ctx.shadowBlur = 10
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(X(s.planet.x), Y(s.planet.y), 3.5 + 4.5 * Math.cbrt(q), 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // initial velocity arrow before launch
    if (s.t === 0) {
      const len = Math.min(90, 14 * s.planet.vy)
      const px = X(s.planet.x)
      const py = Y(s.planet.y)
      ctx.strokeStyle = '#e8ecf4'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px, py - len)
      ctx.lineTo(px - 4, py - len + 6)
      ctx.moveTo(px, py - len)
      ctx.lineTo(px + 4, py - len + 6)
      ctx.stroke()
    }
  }, [accent, viewRadius, q])

  const reset = useCallback(() => {
    sim.current = initialState({ distance, speed, massRatio: q })
    e0.current = totalEnergy(sim.current)
    trails.current = { star: [], planet: [] }
    samples.current = [{ t: 0, r: distance }]
    setChart([{ t: 0, r: distance }])
    setLive({ t: 0, r: distance, v: speed, drift: 0 })
    setStatus('running')
    draw()
  }, [distance, speed, q, draw])

  useEffect(reset, [reset])

  useEffect(() => {
    if (status !== 'running') {
      draw()
      return
    }
    let raf = 0
    let last = performance.now()
    let lastUi = 0
    const loop = (now: number) => {
      const elapsed = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = sim.current
      const steps = Math.min(5000, Math.max(1, Math.round((elapsed * timeScaleRef.current) / DT)))
      let ended: Status | null = null
      for (let i = 0; i < steps; i++) {
        step(s, DT)
        const r = separation(s)
        if (i % 8 === 0) {
          const tr = trails.current
          tr.star.push([s.star.x, s.star.y])
          tr.planet.push([s.planet.x, s.planet.y])
          if (tr.planet.length > MAX_TRAIL) {
            tr.star.shift()
            tr.planet.shift()
          }
        }
        if (r < COLLISION_RADIUS) {
          ended = 'collision'
          break
        }
        if (r > ESCAPE_DISTANCE) {
          ended = 'escaped'
          break
        }
      }
      draw()
      if (now - lastUi > 120 || ended) {
        lastUi = now
        const r = separation(s)
        const smp = samples.current
        smp.push({ t: Number(s.t.toFixed(3)), r: Number(r.toFixed(4)) })
        if (smp.length > 600) samples.current = smp.filter((_, i) => i % 2 === 0)
        setChart(samples.current.slice())
        setLive({
          t: s.t,
          r,
          v: Math.hypot(s.planet.vx - s.star.vx, s.planet.vy - s.star.vy),
          drift: Math.abs((totalEnergy(s) - e0.current) / e0.current),
        })
      }
      if (ended) {
        setStatus(ended)
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [status, draw])

  useEffect(() => {
    const onResize = () => draw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [draw])

  const ratio = speed / vc
  const insight =
    status === 'collision'
      ? 'The bodies collided. With too little sideways speed, the companion falls almost straight into the star.'
      : el.kind === 'hyperbolic' || el.kind === 'parabolic'
        ? `At ${ratio.toFixed(2)}× the circular speed the companion has more kinetic energy than gravity can hold back (escape speed here is ${ve.toFixed(2)} AU/yr), so it leaves on an open ${el.kind} path and never returns.`
        : el.kind === 'circular'
          ? `At the circular speed (${vc.toFixed(2)} AU/yr) gravity bends the path exactly as fast as the body moves sideways, so the distance stays constant. One orbit takes ${el.periodYears!.toFixed(2)} years.`
          : `An elliptical orbit with eccentricity ${el.eccentricity.toFixed(2)}: the distance swings between ${el.periapsis.toFixed(2)} and ${el.apoapsis!.toFixed(2)} AU, and the body moves fastest at the closest point (Kepler’s second law).${q > 0.1 ? ' Because the masses are comparable, the star visibly orbits the shared centre of mass (+) too.' : ''}`

  return (
    <SimLayout
      controls={
        <Controls>
          <Slider label="Initial speed" value={speed} min={0} max={25} step={0.05} onChange={setSpeed} accent={accent} format={(v) => `${v.toFixed(2)} AU/yr`} hint="Sideways speed of the companion relative to the star. Earth moves at about 6.28 AU/yr (≈ 30 km/s)." />
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setSpeed(Number(vc.toFixed(2)))} className="py-1.5 text-xs" title="Set the speed for a circular orbit">
              Circular {vc.toFixed(2)}
            </Button>
            <Button onClick={() => setSpeed(Math.min(25, Math.ceil(ve * 100) / 100))} className="py-1.5 text-xs" title="Set the minimum speed to escape">
              Escape {ve.toFixed(2)}
            </Button>
          </div>
          <Slider label="Distance" value={distance} min={0.3} max={4} step={0.05} onChange={setDistance} accent={accent} format={(v) => `${v.toFixed(2)} AU`} hint="Starting separation between the two bodies. 1 AU is the Earth–Sun distance." />
          <Slider
            label="Relative mass"
            value={logQ}
            min={-3}
            max={0}
            step={0.05}
            onChange={setLogQ}
            accent={accent}
            format={() => (q < 0.01 ? q.toFixed(4) : q.toFixed(2))}
            hint="Companion mass as a fraction of the star’s mass (logarithmic). Jupiter ≈ 0.001; 1 means two equal stars."
          />
          <Slider label="Playback speed" value={timeScale} min={0.1} max={5} step={0.1} onChange={setTimeScale} accent={accent} format={(v) => `${v.toFixed(1)} yr/s`} />
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              accent={accent}
              disabled={status === 'collision' || status === 'escaped'}
              onClick={() => setStatus((s) => (s === 'running' ? 'paused' : 'running'))}
            >
              {status === 'running' ? <Pause size={16} /> : <Play size={16} />}
              {status === 'running' ? 'Pause' : 'Resume'}
            </Button>
            <Button onClick={reset}>
              <RotateCcw size={16} /> Reset
            </Button>
          </div>
        </Controls>
      }
      stats={
        <StatGrid>
          <Stat label="Orbit type" value={KIND_LABEL[el.kind]} sub={`e = ${el.eccentricity.toFixed(3)}`} accent={accent} />
          <Stat label="Period" value={el.periodYears ? `${el.periodYears.toFixed(2)} yr` : 'none'} sub={el.semiMajorAxis && el.kind !== 'radial' ? `a = ${el.semiMajorAxis.toFixed(2)} AU` : 'unbound'} />
          <Stat label="Separation" value={`${live.r.toFixed(2)} AU`} sub={`speed ${live.v.toFixed(2)} AU/yr`} />
          <Stat
            label="Elapsed"
            value={`${live.t.toFixed(2)} yr`}
            sub={`energy drift ${live.drift < 1e-9 ? '<1e-9' : live.drift.toExponential(1)}`}
            hint="Energy drift is the relative change in total energy since the start. A good integrator keeps it tiny; large values mean the time step is too coarse (e.g. very close approaches)."
          />
        </StatGrid>
      }
      insight={<Insight accent={accent}>{insight}</Insight>}
    >
      <Panel
        title="Simulation"
        actions={
          <span className="flex items-center gap-3 text-xs text-fg-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: STAR_COLOR }} /> Star (1 M☉)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} /> Companion
            </span>
            <span className="font-mono text-fg-subtle">+ centre of mass</span>
          </span>
        }
        bodyClassName="p-0"
      >
        <div className="relative">
          <canvas ref={canvasRef} className="block h-[340px] w-full sm:h-[440px]" aria-label="Animated two-body orbit" />
          {(status === 'collision' || status === 'escaped' || status === 'paused') && (
            <div className="absolute top-3 left-3 rounded-md border border-white/10 bg-ink-900/90 px-2.5 py-1 text-xs text-fg-muted">
              {status === 'collision' ? 'Collision: run stopped' : status === 'escaped' ? `Escaped beyond ${ESCAPE_DISTANCE} AU: run stopped` : 'Paused'}
            </div>
          )}
        </div>
      </Panel>
      <Panel title="Separation over time">
        <div className="h-48">
          <ResponsiveContainer>
            <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="t" type="number" domain={[0, 'dataMax']} {...axisProps} tickFormatter={(v: number) => `${Number(v.toFixed(1))} yr`} />
              <YAxis {...axisProps} axisLine={false} domain={[0, 'auto']} tickFormatter={(v: number) => `${Number(v.toFixed(1))}`} />
              <Tooltip content={<ChartTooltip labelFormat={(l) => `t = ${Number(l).toFixed(2)} yr`} valueFormat={(v) => `${Number(v).toFixed(3)} AU`} />} />
              <Line dataKey="r" name="Separation" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </SimLayout>
  )
}
