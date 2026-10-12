import { useEffect, useMemo, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Rocket } from 'lucide-react'
import { SimLayout } from '../../components/SimLayout'
import { Button, ChartTooltip, Controls, Insight, Legend, Panel, Slider, Stat, StatGrid, Toggle } from '../../components/ui'
import { SERIES, axisProps } from '../../lib/chart'
import type { SimProps } from '../registry'
import { useSimParam } from '../../lib/simParams'

type World = 'Earth' | 'Moon' | 'Mars' | 'Jupiter' | 'Venus'
const WORLDS: Record<World, { g: number; rho: number }> = {
  Earth: { g: 9.81, rho: 1.225 },
  Moon: { g: 1.62, rho: 0 },
  Mars: { g: 3.72, rho: 0.02 },
  Jupiter: { g: 24.79, rho: 0.16 },
  Venus: { g: 8.87, rho: 65 },
}
const WORLD_IDS = Object.keys(WORLDS) as World[]

// A baseball: m = 0.145 kg, r = 3.66 cm, Cd ≈ 0.47
const MASS = 0.145
const AREA = Math.PI * 0.0366 ** 2
const CD = 0.47

interface Flight {
  pts: { x: number; y: number; t: number }[]
  range: number
  apex: number
  time: number
}

function simulate(world: World, v0: number, angleDeg: number, h0: number, drag: boolean): Flight {
  const { g, rho } = WORLDS[world]
  const k = drag ? (0.5 * rho * CD * AREA) / MASS : 0
  const a = (angleDeg * Math.PI) / 180
  let x = 0
  let y = h0
  let vx = v0 * Math.cos(a)
  let vy = v0 * Math.sin(a)
  let t = 0
  const dt = 0.002
  const pts = [{ x, y, t }]
  let apex = y
  let n = 0
  while (t < 2000) {
    const v = Math.hypot(vx, vy)
    // semi-implicit Euler: plenty accurate at this timestep for a visual sim
    vx += -k * v * vx * dt
    vy += (-g - k * v * vy) * dt
    const nx = x + vx * dt
    const ny = y + vy * dt
    t += dt
    if (ny < 0) {
      const f = y / (y - ny) // interpolate landing point
      x = x + (nx - x) * f
      y = 0
      pts.push({ x, y, t })
      break
    }
    x = nx
    y = ny
    apex = Math.max(apex, y)
    if (++n % 10 === 0) pts.push({ x, y, t })
  }
  return { pts, range: x, apex, time: t }
}

function bestAngle(world: World, v0: number, h0: number, drag: boolean) {
  let best = 45
  let bestR = -1
  for (let a = 5; a <= 85; a += 1) {
    const r = simulate(world, v0, a, h0, drag).range
    if (r > bestR) {
      bestR = r
      best = a
    }
  }
  return best
}

function WorldPicker({ value, onChange, color, label }: { value: World; onChange: (w: World) => void; color: string; label: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[13px] text-fg-muted">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <div className="grid grid-cols-5 gap-1" role="group" aria-label={label}>
        {WORLD_IDS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => onChange(w)}
            title={`${w}: g = ${WORLDS[w].g} m/s², air density ${WORLDS[w].rho} kg/m³`}
            aria-pressed={w === value}
            className="flex flex-col items-center gap-0.5 rounded-md border py-1.5 text-[10px] transition-colors"
            style={{
              borderColor: w === value ? color : 'rgba(255,255,255,0.08)',
              background: w === value ? `${color}22` : 'transparent',
              color: w === value ? '#e8ecf4' : '#a3acc2',
            }}
          >
            <span className="font-medium">{w}</span>
            <span className="font-mono text-[9px] opacity-70">{WORLDS[w].g}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Projectile({ accent }: SimProps) {
  const [a, setA] = useSimParam<World>('a', 'Earth', { label: 'World A', oneOf: WORLD_IDS })
  const [b, setB] = useSimParam<World>('b', 'Moon', { label: 'World B', oneOf: WORLD_IDS })
  const [v0, setV0] = useSimParam('v0', 30, { label: 'Launch speed', format: (v) => `${v} m/s`, min: 5, max: 80 })
  const [angle, setAngle] = useSimParam('angle', 45, { label: 'Angle', format: (v) => `${v}°`, min: 1, max: 89 })
  const [h0, setH0] = useSimParam('h0', 1.5, { label: 'Height', format: (v) => `${v} m`, min: 0, max: 50 })
  const [drag, setDrag] = useSimParam('drag', false, { label: 'Air resistance', format: (v) => (v ? 'On' : 'Off') })
  const [progress, setProgress] = useState(1)
  const raf = useRef(0)

  const fa = useMemo(() => simulate(a, v0, angle, h0, drag), [a, v0, angle, h0, drag])
  const fb = useMemo(() => simulate(b, v0, angle, h0, drag), [b, v0, angle, h0, drag])
  const opt = useMemo(() => bestAngle(a, v0, h0, drag), [a, v0, h0, drag])

  const tMax = Math.max(fa.time, fb.time)

  const launch = () => {
    cancelAnimationFrame(raf.current)
    const duration = Math.min(5000, Math.max(1800, tMax * 250))
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setProgress(p)
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  // replay automatically when the experiment changes
  useEffect(launch, [a, b, v0, angle, h0, drag])

  const tNow = progress * tMax
  const visible = (f: Flight) => f.pts.filter((p) => p.t <= tNow)
  const head = (f: Flight) => {
    const v = visible(f)
    return v[v.length - 1] ?? f.pts[0]
  }
  const ha = head(fa)
  const hb = head(fb)

  const xMax = Math.max(fa.range, fb.range) * 1.04
  const yMax = Math.max(fa.apex, fb.apex) * 1.12

  const ratio = fb.range / fa.range
  const insight = drag
    ? `With air resistance, the best launch angle on ${a} is about ${opt}°, not 45°: drag punishes long, high flights. ${WORLDS[b].rho > 10 ? `${b}'s crushing atmosphere (${WORLDS[b].rho} kg/m³) makes the ball behave like it's thrown through water.` : ''}`
    : `In a vacuum, range scales with 1/g. ${b} (g = ${WORLDS[b].g}) vs ${a} (g = ${WORLDS[a].g}) predicts a ${(WORLDS[a].g / WORLDS[b].g).toFixed(2)}× ratio; the simulation measured ${ratio.toFixed(2)}×${h0 > 0 ? ' (launch height nudges it slightly)' : ''}.`

  return (
    <SimLayout
      controls={
        <Controls>
          <WorldPicker label="World A" value={a} onChange={setA} color={SERIES[0]} />
          <WorldPicker label="World B" value={b} onChange={setB} color={SERIES[1]} />
          <Slider label="Launch speed" value={v0} min={5} max={80} onChange={setV0} accent={accent} format={(v) => `${v} m/s`} />
          <Slider label="Launch angle" value={angle} min={1} max={89} onChange={setAngle} accent={accent} format={(v) => `${v}°`} />
          <Slider label="Launch height" value={h0} min={0} max={50} step={0.5} onChange={setH0} accent={accent} format={(v) => `${v} m`} />
          <Toggle label="Air resistance (baseball)" checked={drag} onChange={setDrag} accent={accent} />
          <Button variant="primary" accent={accent} className="w-full" onClick={launch}>
            <Rocket size={16} /> Launch
          </Button>
        </Controls>
      }
      stats={
        <StatGrid>
          <Stat label={`Range · ${a}`} value={`${fa.range.toFixed(1)} m`} sub={`${fa.time.toFixed(2)} s flight`} accent={SERIES[0]} />
          <Stat label={`Range · ${b}`} value={`${fb.range.toFixed(1)} m`} sub={`${fb.time.toFixed(2)} s flight`} accent={SERIES[1]} />
          <Stat label="Peak height" value={`${fa.apex.toFixed(1)} / ${fb.apex.toFixed(1)} m`} sub="A / B" />
          <Stat label={`Best angle · ${a}`} value={`${opt}°`} sub={drag ? 'with drag' : 'vacuum'} />
        </StatGrid>
      }
      insight={<Insight accent={accent}>{insight}</Insight>}
    >
      <Panel
        title="Trajectories"
        actions={<Legend items={[{ label: a, color: SERIES[0] }, { label: b, color: SERIES[1] }]} />}
      >
        <div className="h-80">
          <ResponsiveContainer>
            <LineChart margin={{ top: 10, right: 16, bottom: 0, left: -4 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                type="number"
                dataKey="x"
                domain={[0, xMax]}
                {...axisProps}
                tickFormatter={(v: number) => `${Math.round(v)} m`}
                allowDataOverflow
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[0, yMax]}
                {...axisProps}
                axisLine={false}
                tickFormatter={(v: number) => `${Math.round(v)}`}
                allowDataOverflow
              />
              <Tooltip
                content={
                  <ChartTooltip labelFormat={(l) => `x = ${Number(l).toFixed(1)} m`} valueFormat={(v) => `${Number(v).toFixed(2)} m`} />
                }
              />
              {/* full ghost paths */}
              <Line data={fa.pts} dataKey="y" stroke={SERIES[0]} strokeOpacity={0.18} strokeDasharray="4 4" dot={false} isAnimationActive={false} tooltipType="none" />
              <Line data={fb.pts} dataKey="y" stroke={SERIES[1]} strokeOpacity={0.18} strokeDasharray="4 4" dot={false} isAnimationActive={false} tooltipType="none" />
              {/* flown so far */}
              <Line data={visible(fa)} dataKey="y" name={`${a} height`} stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line data={visible(fb)} dataKey="y" name={`${b} height`} stroke={SERIES[1]} strokeWidth={2} dot={false} isAnimationActive={false} />
              <ReferenceDot x={ha.x} y={ha.y} r={7} fill={SERIES[0]} stroke="#0b0f1a" strokeWidth={2} />
              <ReferenceDot x={hb.x} y={hb.y} r={7} fill={SERIES[1]} stroke="#0b0f1a" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 font-mono text-xs text-fg-subtle tabular-nums">
          <span>t = {tNow.toFixed(2)} s</span>
          <span>height (m) vs distance (m) · axes not to equal scale</span>
        </div>
      </Panel>
    </SimLayout>
  )
}
