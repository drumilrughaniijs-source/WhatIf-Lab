import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Dices, Pause, Play, RotateCcw, StepForward } from 'lucide-react'
import { SimLayout } from '../../components/SimLayout'
import { Button, ChartTooltip, Controls, Insight, Legend, Panel, Segmented, Slider, Stat, StatGrid } from '../../components/ui'
import { SERIES, axisProps } from '../../lib/chart'
import { newSeed } from '../../lib/random'
import { useSimParam } from '../../lib/simParams'
import { evaluate, initNet, makeDataset, predict, trainStep, type DatasetId, type Net } from '../../models/nn'
import type { SimProps } from '../registry'

const DATASETS: { value: DatasetId; label: string }[] = [
  { value: 'xor', label: 'XOR' },
  { value: 'circle', label: 'Circle' },
  { value: 'blobs', label: 'Two blobs' },
]
const DATA_SEED = 7
const POINTS = 200
const POS = SERIES[0] // class 1 and positive weights
const NEG = SERIES[1] // class 0 and negative weights
const GRID = 56

type Status = 'ready' | 'training' | 'paused' | 'done'

function hexToRgb(h: string) {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const POS_RGB = hexToRgb(POS)
const NEG_RGB = hexToRgb(NEG)

export default function NeuralNetwork({ accent }: SimProps) {
  const [dataset, setDataset] = useSimParam<DatasetId>('dataset', 'xor', { label: 'Dataset', oneOf: ['xor', 'circle', 'blobs'] })
  const [hidden, setHidden] = useSimParam('hidden', 4, { label: 'Hidden neurons', min: 2, max: 8 })
  const [logLr, setLogLr] = useSimParam('logLr', Math.log10(0.5), { label: 'Learning rate', format: (v) => (10 ** v).toFixed(3), min: -2, max: 1 })
  const [iterations, setIterations] = useSimParam('iterations', 2000, { label: 'Iterations', min: 100, max: 10000 })
  const [seed, setSeed] = useSimParam('seed', () => newSeed())

  const lr = 10 ** logLr
  const data = useMemo(() => makeDataset(dataset, POINTS, DATA_SEED), [dataset])

  const net = useRef<Net>(initNet(hidden, seed))
  const epoch = useRef(0)
  const history = useRef<{ epoch: number; loss: number }[]>([])
  const lrRef = useRef(lr)
  lrRef.current = lr
  const itersRef = useRef(iterations)
  itersRef.current = iterations
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [status, setStatus] = useState<Status>('ready')
  const [, setFrame] = useState(0)
  const [metrics, setMetrics] = useState(() => evaluate(net.current, data))

  const drawBoundary = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const size = c.clientWidth
    const dpr = window.devicePixelRatio || 1
    if (c.width !== Math.round(size * dpr)) {
      c.width = Math.round(size * dpr)
      c.height = Math.round(size * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#05070d'
    ctx.fillRect(0, 0, size, size)
    const cell = size / GRID
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const x = -1 + (2 * (i + 0.5)) / GRID
        const y = 1 - (2 * (j + 0.5)) / GRID
        const p = predict(net.current, x, y)
        const [r, g, b] = p >= 0.5 ? POS_RGB : NEG_RGB
        ctx.fillStyle = `rgba(${r},${g},${b},${(Math.abs(p - 0.5) * 2 * 0.5).toFixed(3)})`
        ctx.fillRect(i * cell, j * cell, cell + 0.5, cell + 0.5)
      }
    }
    const toPx = (v: number) => ((v + 1) / 2) * size
    for (let k = 0; k < data.x.length; k++) {
      const px = toPx(data.x[k][0])
      const py = size - toPx(data.x[k][1])
      ctx.lineWidth = 1.5
      ctx.strokeStyle = '#05070d'
      if (data.y[k] === 1) {
        ctx.fillStyle = POS
        ctx.beginPath()
        ctx.arc(px, py, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      } else {
        ctx.fillStyle = NEG
        ctx.fillRect(px - 3.5, py - 3.5, 7, 7)
        ctx.strokeRect(px - 3.5, py - 3.5, 7, 7)
      }
    }
  }, [data])

  const reset = useCallback(() => {
    net.current = initNet(hidden, seed)
    epoch.current = 0
    const m = evaluate(net.current, data)
    history.current = [{ epoch: 0, loss: m.loss }]
    setMetrics(m)
    setStatus('ready')
    setFrame((f) => f + 1)
    drawBoundary()
  }, [hidden, seed, data, drawBoundary])

  useEffect(reset, [reset])

  useEffect(() => {
    const onResize = () => drawBoundary()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [drawBoundary])

  const runSteps = useCallback(
    (n: number) => {
      const sampleEvery = Math.max(1, Math.floor(itersRef.current / 250))
      for (let s = 0; s < n && epoch.current < itersRef.current; s++) {
        trainStep(net.current, data, lrRef.current)
        epoch.current++
        if (epoch.current % sampleEvery === 0 || epoch.current === itersRef.current) {
          history.current.push({ epoch: epoch.current, loss: evaluate(net.current, data).loss })
        }
      }
      const m = evaluate(net.current, data)
      setMetrics(m)
      drawBoundary()
      setFrame((f) => f + 1)
      return m
    },
    [data, drawBoundary],
  )

  useEffect(() => {
    if (status !== 'training') return
    let raf = 0
    const loop = () => {
      const perFrame = Math.max(1, Math.ceil(itersRef.current / 360))
      const m = runSteps(perFrame)
      if (!Number.isFinite(m.loss) || epoch.current >= itersRef.current) {
        setStatus('done')
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [status, runSteps])

  // If the user lowers the iteration budget below the current epoch, finish.
  useEffect(() => {
    if (epoch.current >= iterations && epoch.current > 0) setStatus((s) => (s === 'training' ? 'done' : s))
    else setStatus((s) => (s === 'done' ? 'paused' : s))
  }, [iterations])

  const onPrimary = () => {
    if (status === 'training') setStatus('paused')
    else if (status === 'done') {
      reset()
      setTimeout(() => setStatus('training'), 0)
    } else setStatus('training')
  }

  /* ----------------------------------------------------- network diagram */
  const W = 420
  const H = 260
  const layerX = [50, W / 2, W - 50]
  const nodeY = (i: number, n: number) => (n === 1 ? H / 2 : 28 + (i * (H - 56)) / (n - 1))
  const n = net.current
  const edges: { x1: number; y1: number; x2: number; y2: number; w: number; label: string }[] = []
  for (let j = 0; j < n.H; j++) {
    for (let k = 0; k < 2; k++)
      edges.push({ x1: layerX[0], y1: nodeY(k, 2), x2: layerX[1], y2: nodeY(j, n.H), w: n.W1[j * 2 + k], label: `x${k + 1} → h${j + 1}` })
    edges.push({ x1: layerX[1], y1: nodeY(j, n.H), x2: layerX[2], y2: nodeY(0, 1), w: n.w2[j], label: `h${j + 1} → output` })
  }
  const maxW = Math.max(1, ...edges.map((e) => Math.abs(e.w)))

  const progress = epoch.current / iterations
  const statusLabel = { ready: 'Ready', training: 'Training', paused: 'Paused', done: 'Finished' }[status]

  const insight =
    status === 'ready'
      ? 'The network starts with random weights, so its decision boundary (the coloured background) is meaningless. Press Train and watch gradient descent reshape it.'
      : metrics.accuracy >= 0.97
        ? `The network separates ${(metrics.accuracy * 100).toFixed(1)}% of the points correctly after ${epoch.current.toLocaleString()} iterations. Thick blue edges push the output towards the blue class; thick orange edges push it towards orange.`
        : lr > 3
          ? `The learning rate is very high (${lr.toFixed(2)}), so steps can overshoot and the loss may jump around instead of falling smoothly.`
          : dataset === 'xor' && hidden <= 2
            ? 'XOR cannot be solved by a single straight line. With only 2 hidden neurons the network often gets stuck; try 3 or more.'
            : `Loss is ${metrics.loss.toFixed(3)} after ${epoch.current.toLocaleString()} iterations. ${status === 'done' ? 'Increase the iteration count to keep training, or raise the learning rate.' : ''}`

  return (
    <SimLayout
      controls={
        <Controls>
          <Segmented label="Dataset" value={dataset} onChange={setDataset} accent={accent} options={DATASETS} />
          <Slider label="Hidden neurons" value={hidden} min={2} max={8} onChange={setHidden} accent={accent} hint="Neurons in the single hidden layer. More neurons can draw more complex boundaries." />
          <Slider
            label="Learning rate η"
            value={logLr}
            min={-2}
            max={1}
            step={0.01}
            onChange={setLogLr}
            accent={accent}
            format={() => lr.toFixed(lr < 0.1 ? 3 : 2)}
            hint="Size of each gradient-descent step. Logarithmic slider; changes apply immediately, even mid-training."
          />
          <Slider label="Iterations" value={iterations} min={100} max={10000} step={100} onChange={setIterations} accent={accent} format={(v) => v.toLocaleString()} hint="Number of full-batch gradient-descent updates to run." />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button variant="primary" accent={accent} onClick={onPrimary}>
              {status === 'training' ? <Pause size={16} /> : <Play size={16} />}
              {status === 'training' ? 'Pause' : status === 'paused' ? 'Resume' : status === 'done' ? 'Train again' : 'Train'}
            </Button>
            <Button
              onClick={() => {
                if (epoch.current < iterations) runSteps(1)
                if (status === 'ready') setStatus('paused')
              }}
              disabled={status === 'training' || epoch.current >= iterations}
              title="Run one iteration"
            >
              <StepForward size={16} />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={reset} title="Reset to the same starting weights">
              <RotateCcw size={16} /> Reset
            </Button>
            <Button onClick={() => setSeed(newSeed())} title="Draw a new random starting point">
              <Dices size={16} /> New weights
            </Button>
          </div>
        </Controls>
      }
      stats={
        <div className="space-y-3">
          <StatGrid>
            <Stat label="Iteration" value={`${epoch.current.toLocaleString()}`} sub={`of ${iterations.toLocaleString()}`} accent={accent} />
            <Stat label="Loss" value={Number.isFinite(metrics.loss) ? metrics.loss.toFixed(4) : '—'} sub="binary cross-entropy" />
            <Stat label="Accuracy" value={`${(metrics.accuracy * 100).toFixed(1)}%`} sub={`${POINTS} training points`} />
            <Stat label="Status" value={statusLabel} sub={`η = ${lr.toFixed(lr < 0.1 ? 3 : 2)}`} />
          </StatGrid>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-label="Training progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${progress * 100}%`, background: accent }} />
          </div>
        </div>
      }
      insight={<Insight accent={accent}>{insight}</Insight>}
    >
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Network" actions={<Legend items={[{ label: 'positive weight', color: POS }, { label: 'negative weight', color: NEG }]} />}>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Neural network with 2 inputs, ${n.H} hidden neurons and 1 output`}>
            {edges.map((e, i) => (
              <line
                key={i}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                stroke={e.w >= 0 ? POS : NEG}
                strokeWidth={0.6 + (Math.abs(e.w) / maxW) * 5}
                strokeOpacity={0.25 + (Math.abs(e.w) / maxW) * 0.7}
                strokeLinecap="round"
              >
                <title>{`${e.label}: ${e.w.toFixed(3)}`}</title>
              </line>
            ))}
            {[0, 1].map((k) => (
              <g key={`in${k}`}>
                <circle cx={layerX[0]} cy={nodeY(k, 2)} r={15} fill="#0f1422" stroke="#6f7a96" strokeWidth={1.5} />
                <text x={layerX[0]} y={nodeY(k, 2) + 4} textAnchor="middle" fontSize={11} fill="#e8ecf4" fontFamily="var(--font-mono)">
                  x{k + 1}
                </text>
              </g>
            ))}
            {Array.from({ length: n.H }, (_, j) => (
              <g key={`h${j}`}>
                <circle cx={layerX[1]} cy={nodeY(j, n.H)} r={13} fill="#0f1422" stroke={accent} strokeWidth={1.5}>
                  <title>{`Hidden neuron ${j + 1} · bias ${n.b1[j].toFixed(3)}`}</title>
                </circle>
                <text x={layerX[1]} y={nodeY(j, n.H) + 4} textAnchor="middle" fontSize={10} fill="#a3acc2" fontFamily="var(--font-mono)" pointerEvents="none">
                  h{j + 1}
                </text>
              </g>
            ))}
            <circle cx={layerX[2]} cy={H / 2} r={17} fill="#0f1422" stroke="#e8ecf4" strokeWidth={1.5}>
              <title>{`Output neuron · bias ${n.b2.toFixed(3)}`}</title>
            </circle>
            <text x={layerX[2]} y={H / 2 + 4} textAnchor="middle" fontSize={11} fill="#e8ecf4" fontFamily="var(--font-mono)" pointerEvents="none">
              ŷ
            </text>
            <text x={layerX[0]} y={H - 4} textAnchor="middle" fontSize={10} fill="#6f7a96">inputs</text>
            <text x={layerX[1]} y={H - 4} textAnchor="middle" fontSize={10} fill="#6f7a96">hidden (tanh)</text>
            <text x={layerX[2]} y={H - 4} textAnchor="middle" fontSize={10} fill="#6f7a96">output (sigmoid)</text>
          </svg>
          <details className="mt-2 text-xs text-fg-muted">
            <summary className="cursor-pointer text-fg-subtle hover:text-fg">Show all weights</summary>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono tabular-nums sm:grid-cols-3">
              {edges.map((e) => (
                <span key={e.label}>
                  {e.label}: <span style={{ color: e.w >= 0 ? POS : NEG }}>{e.w.toFixed(3)}</span>
                </span>
              ))}
            </div>
          </details>
        </Panel>
        <Panel title="Decision boundary" actions={<Legend items={[{ label: 'class 1 ●', color: POS, swatch: 'box' }, { label: 'class 0 ■', color: NEG, swatch: 'box' }]} />} bodyClassName="p-3 sm:p-4">
          <canvas ref={canvasRef} className="mx-auto aspect-square w-full max-w-[360px] rounded-lg" aria-label="Network prediction over the input space with training points" />
          <p className="mt-2 text-center text-xs text-fg-subtle">Background shows the network’s prediction; stronger colour = more confident.</p>
        </Panel>
      </div>

      <Panel title="Training loss">
        <div className="h-56">
          <ResponsiveContainer>
            <LineChart data={history.current.slice()} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="epoch" type="number" domain={[0, iterations]} {...axisProps} tickFormatter={(v: number) => v.toLocaleString()} />
              <YAxis {...axisProps} axisLine={false} domain={[0, 'auto']} tickFormatter={(v: number) => v.toFixed(2)} />
              <Tooltip content={<ChartTooltip labelFormat={(l) => `Iteration ${Number(l).toLocaleString()}`} valueFormat={(v) => Number(v).toFixed(4)} />} />
              <Line dataKey="loss" name="Loss" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </SimLayout>
  )
}
