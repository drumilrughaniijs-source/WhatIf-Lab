import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Pause, Play, RotateCcw, Shuffle, Trophy } from 'lucide-react'
import { SimLayout } from '../../components/SimLayout'
import { Button, ChartTooltip, Controls, Insight, Panel, Segmented, Slider, cn } from '../../components/ui'
import { mulberry32, newSeed } from '../../lib/random'
import { SERIES, axisProps } from '../../lib/chart'
import type { SimProps } from '../registry'
import { useSimParam } from '../../lib/simParams'

type Op = { t: 'cmp'; i: number; j: number } | { t: 'swap'; i: number; j: number } | { t: 'set'; i: number; v: number }
type Algo = 'Bubble' | 'Insertion' | 'Merge' | 'Quick'
type InputKind = 'random' | 'nearly' | 'reversed' | 'few'

const ALGOS: Algo[] = ['Bubble', 'Insertion', 'Merge', 'Quick']
const BIG_O: Record<Algo, string> = {
  Bubble: 'O(n²)',
  Insertion: 'O(n²)',
  Merge: 'O(n log n)',
  Quick: 'O(n log n) avg',
}

/* ---------------------------------------------------- op-recording sorts */

function bubble(src: number[]): Op[] {
  const a = [...src]
  const ops: Op[] = []
  for (let end = a.length - 1; end > 0; end--) {
    let swapped = false
    for (let i = 0; i < end; i++) {
      ops.push({ t: 'cmp', i, j: i + 1 })
      if (a[i] > a[i + 1]) {
        ;[a[i], a[i + 1]] = [a[i + 1], a[i]]
        ops.push({ t: 'swap', i, j: i + 1 })
        swapped = true
      }
    }
    if (!swapped) break
  }
  return ops
}

function insertion(src: number[]): Op[] {
  const a = [...src]
  const ops: Op[] = []
  for (let i = 1; i < a.length; i++) {
    let j = i
    while (j > 0) {
      ops.push({ t: 'cmp', i: j - 1, j })
      if (a[j - 1] <= a[j]) break
      ;[a[j - 1], a[j]] = [a[j], a[j - 1]]
      ops.push({ t: 'swap', i: j - 1, j })
      j--
    }
  }
  return ops
}

function merge(src: number[]): Op[] {
  const a = [...src]
  const ops: Op[] = []
  const sort = (lo: number, hi: number) => {
    if (hi - lo < 1) return
    const mid = (lo + hi) >> 1
    sort(lo, mid)
    sort(mid + 1, hi)
    const left = a.slice(lo, mid + 1)
    const right = a.slice(mid + 1, hi + 1)
    let i = 0
    let j = 0
    let k = lo
    while (i < left.length && j < right.length) {
      ops.push({ t: 'cmp', i: lo + i, j: mid + 1 + j })
      a[k] = left[i] <= right[j] ? left[i++] : right[j++]
      ops.push({ t: 'set', i: k, v: a[k] })
      k++
    }
    while (i < left.length) {
      a[k] = left[i++]
      ops.push({ t: 'set', i: k, v: a[k] })
      k++
    }
    while (j < right.length) {
      a[k] = right[j++]
      ops.push({ t: 'set', i: k, v: a[k] })
      k++
    }
  }
  sort(0, a.length - 1)
  return ops
}

/** Lomuto partition with last-element pivot — deliberately naive. */
function quick(src: number[]): Op[] {
  const a = [...src]
  const ops: Op[] = []
  const stack: [number, number][] = [[0, a.length - 1]]
  while (stack.length) {
    const [lo, hi] = stack.pop()!
    if (lo >= hi) continue
    const pivot = a[hi]
    let p = lo
    for (let i = lo; i < hi; i++) {
      ops.push({ t: 'cmp', i, j: hi })
      if (a[i] < pivot) {
        if (i !== p) {
          ;[a[i], a[p]] = [a[p], a[i]]
          ops.push({ t: 'swap', i, j: p })
        }
        p++
      }
    }
    if (p !== hi) {
      ;[a[p], a[hi]] = [a[hi], a[p]]
      ops.push({ t: 'swap', i: p, j: hi })
    }
    stack.push([lo, p - 1], [p + 1, hi])
  }
  return ops
}

const SORTERS: Record<Algo, (a: number[]) => Op[]> = { Bubble: bubble, Insertion: insertion, Merge: merge, Quick: quick }

function makeInput(n: number, kind: InputKind, seed: number): number[] {
  const rand = mulberry32(seed)
  const base = Array.from({ length: n }, (_, i) => i + 1)
  if (kind === 'reversed') return base.reverse()
  if (kind === 'few') return base.map(() => 1 + Math.floor(rand() * 5) * Math.ceil(n / 5))
  const a = [...base]
  if (kind === 'random') {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
  } else {
    // nearly sorted: a handful of local swaps
    for (let k = 0; k < Math.max(1, Math.floor(n / 12)); k++) {
      const i = Math.floor(rand() * (n - 2))
      ;[a[i], a[i + 2]] = [a[i + 2], a[i]]
    }
  }
  return a
}

/* ------------------------------------------------------------- component */

interface Lane {
  arr: number[]
  ops: Op[]
  pos: number
  cmps: number
  writes: number
  active: [number, number] | null
  finishedAt: number | null
}

export default function SortingRace({ accent }: SimProps) {
  const [n, setN] = useSimParam('n', 40, { label: 'Array size', min: 10, max: 120 })
  const [kind, setKind] = useSimParam<InputKind>('kind', 'random', { label: 'Input order', oneOf: ['random', 'nearly', 'reversed', 'few'] })
  const [seed, setSeed] = useSimParam('seed', () => newSeed())
  const [speed, setSpeed] = useSimParam('speed', 4, { label: 'Speed', format: (v) => `${v} ops/frame`, min: 1, max: 40 })
  const [running, setRunning] = useState(false)
  const [, setFrame] = useState(0)

  const input = useMemo(() => makeInput(n, kind, seed), [n, kind, seed])
  const lanes = useRef<Record<Algo, Lane>>({} as Record<Algo, Lane>)
  const tick = useRef(0)

  const reset = useCallback(() => {
    tick.current = 0
    lanes.current = Object.fromEntries(
      ALGOS.map((a) => [
        a,
        { arr: [...input], ops: SORTERS[a](input), pos: 0, cmps: 0, writes: 0, active: null, finishedAt: null },
      ]),
    ) as Record<Algo, Lane>
    setRunning(false)
    setFrame((f) => f + 1)
  }, [input])

  useEffect(reset, [reset])

  const allDone = ALGOS.every((a) => lanes.current[a]?.finishedAt != null)

  useEffect(() => {
    if (!running) return
    let raf = 0
    const step = () => {
      tick.current++
      let done = true
      for (const a of ALGOS) {
        const L = lanes.current[a]
        for (let s = 0; s < speed && L.pos < L.ops.length; s++) {
          const op = L.ops[L.pos++]
          if (op.t === 'cmp') {
            L.cmps++
            L.active = [op.i, op.j]
          } else if (op.t === 'swap') {
            ;[L.arr[op.i], L.arr[op.j]] = [L.arr[op.j], L.arr[op.i]]
            L.writes += 2
            L.active = [op.i, op.j]
          } else {
            L.arr[op.i] = op.v
            L.writes++
            L.active = [op.i, op.i]
          }
        }
        if (L.pos >= L.ops.length) {
          if (L.finishedAt === null) L.finishedAt = tick.current
          L.active = null
        } else done = false
      }
      setFrame((f) => f + 1)
      if (done) setRunning(false)
      else raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [running, speed])

  const ranking = ALGOS.filter((a) => lanes.current[a]?.finishedAt != null).sort(
    (x, y) => lanes.current[x].ops.length - lanes.current[y].ops.length,
  )

  const chartData = ALGOS.map((a) => ({
    algo: a,
    Comparisons: lanes.current[a]?.cmps ?? 0,
    Writes: lanes.current[a]?.writes ?? 0,
  }))

  const winner = ranking[0]
  const insight = allDone
    ? kind === 'nearly'
      ? `${winner} sort won. On nearly-sorted input Insertion sort only has to nudge a few elements, so it beats the "fast" divide-and-conquer sorts.`
      : kind === 'reversed' || kind === 'few'
        ? `${winner} sort won. Notice how the naive Quick sort (last-element pivot) struggles on ${kind === 'reversed' ? 'reversed' : 'repetitive'} data: its partitions become lopsided and it degrades toward O(n²).`
        : `${winner} sort won. On random data the O(n log n) algorithms pull away, and the gap widens dramatically as n grows.`
    : 'Press Race to start. Every algorithm performs the same number of operations per frame, so finishing order reflects total work.'

  return (
    <SimLayout
      controls={
        <Controls>
          <Slider label="Array size" value={n} min={10} max={120} step={5} onChange={setN} accent={accent} />
          <Segmented
            label="Input order"
            value={kind}
            onChange={setKind}
            accent={accent}
            options={[
              { value: 'random', label: 'Random' },
              { value: 'nearly', label: 'Nearly sorted' },
              { value: 'reversed', label: 'Reversed' },
              { value: 'few', label: 'Few unique' },
            ]}
          />
          <Slider
            label="Speed"
            value={speed}
            min={1}
            max={40}
            onChange={setSpeed}
            accent={accent}
            format={(v) => `${v} ops/frame`}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              accent={accent}
              onClick={() => (allDone ? (reset(), setTimeout(() => setRunning(true), 0)) : setRunning((r) => !r))}
            >
              {running ? <Pause size={16} /> : <Play size={16} />}
              {running ? 'Pause' : allDone ? 'Replay' : 'Race'}
            </Button>
            <Button onClick={reset}>
              <RotateCcw size={16} /> Reset
            </Button>
          </div>
          <Button className="w-full" onClick={() => setSeed(newSeed())}>
            <Shuffle size={16} /> New data
          </Button>
        </Controls>
      }
      insight={<Insight accent={accent}>{insight}</Insight>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {ALGOS.map((a) => {
          const L = lanes.current[a]
          if (!L) return null
          const max = Math.max(...L.arr)
          const progress = L.ops.length ? L.pos / L.ops.length : 1
          const place = ranking.indexOf(a)
          return (
            <Panel
              key={a}
              title={
                <span className="flex items-center gap-2">
                  {a} sort <span className="font-mono text-xs font-normal text-fg-subtle">{BIG_O[a]}</span>
                </span>
              }
              actions={
                place >= 0 ? (
                  <span
                    className={cn(
                      'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                      place === 0 ? 'bg-yellow-400/15 text-yellow-300' : 'bg-white/5 text-fg-muted',
                    )}
                  >
                    {place === 0 && <Trophy size={12} />}#{place + 1}
                  </span>
                ) : null
              }
              bodyClassName="p-4"
            >
              <div className="flex h-36 items-end gap-px" aria-label={`${a} sort bars`}>
                {L.arr.map((v, i) => {
                  const hot = L.active && (i === L.active[0] || i === L.active[1])
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t-[2px]"
                      style={{
                        height: `${(v / max) * 100}%`,
                        background: L.finishedAt !== null ? '#199e70' : hot ? '#fafafa' : accent,
                        opacity: hot || L.finishedAt !== null ? 1 : 0.55,
                      }}
                    />
                  )
                })}
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink-700">
                <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: accent }} />
              </div>
              <div className="mt-2 flex justify-between font-mono text-xs text-fg-muted tabular-nums">
                <span>{L.cmps.toLocaleString()} comparisons</span>
                <span>{L.writes.toLocaleString()} writes</span>
              </div>
            </Panel>
          )
        })}
      </div>

      <Panel title="Work done so far">
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }} barGap={2}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="algo" {...axisProps} />
              <YAxis {...axisProps} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip />} />
              <Bar dataKey="Comparisons" fill={SERIES[0]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Writes" fill={SERIES[1]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex gap-4 text-xs text-fg-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[0] }} /> Comparisons
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[1] }} /> Writes
          </span>
        </div>
      </Panel>
    </SimLayout>
  )
}
