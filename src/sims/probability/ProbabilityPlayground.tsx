import { useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Dices, Play, RotateCcw } from 'lucide-react'
import { SimLayout } from '../../components/SimLayout'
import { Button, ChartTooltip, Controls, EmptyState, Insight, Legend, Panel, Segmented, Slider, Stat, StatGrid, Toggle } from '../../components/ui'
import { SERIES, axisProps } from '../../lib/chart'
import { cryptoUniform } from '../../lib/random'
import { useSimParam } from '../../lib/simParams'
import { EXPERIMENTS, chiSquare, expectedValue, runExperiment, theoretical, type ExperimentId, type RunResult } from '../../models/probability'
import type { SimProps } from '../registry'

const TRIALS = [10, 50, 100, 500, 1000, 5000, 10000, 100000, 1000000]
const MAX_RUNS = 100
const OBS = SERIES[0]
const THEORY = SERIES[1]

export default function ProbabilityPlayground({ accent }: SimProps) {
  const [experiment, setExperiment] = useSimParam<ExperimentId>('experiment', 'coin', {
    label: 'Experiment',
    oneOf: ['coin', 'die', 'two-dice'],
    format: (v) => EXPERIMENTS[v].name,
  })
  const [trialsIdx, setTrialsIdx] = useSimParam('trialsIdx', 4, { label: 'Trials per run', format: (v) => TRIALS[v].toLocaleString(), min: 0, max: TRIALS.length - 1 })
  const [pHeadsPct, setPHeadsPct] = useSimParam('pHeads', 50, { label: 'Chance of heads', format: (v) => `${v}%`, min: 1, max: 99 })
  const [combine, setCombine] = useState(false)
  const [allRuns, setRuns] = useState<(RunResult & { pHeads: number })[]>([])
  const rand = useRef(cryptoUniform())

  const def = EXPERIMENTS[experiment]
  const trials = TRIALS[trialsIdx]
  const pHeads = pHeadsPct / 100
  const probs = theoretical(experiment, pHeads)
  const expected = expectedValue(experiment, pHeads)

  // Only show runs made with the current settings, so results from different experiments are never mixed.
  const runs = useMemo(() => allRuns.filter((r) => r.id === experiment && (experiment !== 'coin' || r.pHeads === pHeads)), [allRuns, experiment, pHeads])

  const run = () => setRuns((rs) => [...rs.filter((r) => r.id === experiment && (experiment !== 'coin' || r.pHeads === pHeads)), { ...runExperiment(experiment, trials, rand.current, pHeads), pHeads }].slice(-MAX_RUNS))

  const latest = runs[runs.length - 1]
  const view = useMemo(() => {
    if (!latest) return null
    if (!combine) return { counts: latest.counts, n: latest.trials }
    const counts = Array(def.outcomes.length).fill(0)
    let n = 0
    for (const r of runs) {
      r.counts.forEach((c, i) => (counts[i] += c))
      n += r.trials
    }
    return { counts, n }
  }, [runs, latest, combine, def.outcomes.length])

  const rows =
    view &&
    def.outcomes.map((o, i) => {
      const obs = view.counts[i] / view.n
      return {
        outcome: o,
        count: view.counts[i],
        expectedCount: view.n * probs[i],
        Observed: Number((obs * 100).toFixed(3)),
        Theoretical: Number((probs[i] * 100).toFixed(3)),
        diff: (obs - probs[i]) * 100,
      }
    })

  const chi = view ? chiSquare(view.counts, probs) : null
  const maxDev = rows ? Math.max(...rows.map((r) => Math.abs(r.diff))) : 0
  const statistic = view ? view.counts.reduce((s, c, i) => s + c * def.values[i], 0) / view.n : 0
  const statLabel = experiment === 'coin' ? 'Share of heads' : 'Average result'
  const formatStat = (v: number) => (experiment === 'coin' ? `${(v * 100).toFixed(2)}%` : v.toFixed(3))

  const insight = !view
    ? `Choose an experiment and press Run. Each run draws ${trials.toLocaleString()} fresh random outcomes in your browser.`
    : `${combine ? `Across ${runs.length} runs (${view.n.toLocaleString()} trials)` : `In this run of ${view.n.toLocaleString()} trials`}, the largest gap between observed and theoretical frequency is ${maxDev.toFixed(2)} percentage points. ${
        chi && chi.pValue < 0.05
          ? `The chi-square test gives p = ${chi.pValue.toFixed(3)}, which is unusual for a fair ${experiment === 'coin' ? 'coin' : 'die'}. Run again: about 1 run in 20 crosses this line purely by chance.`
          : `The chi-square p-value is ${chi?.pValue.toFixed(3)}, so the deviation is consistent with chance. ${view.n < 1000 ? 'Try more trials and watch the gap shrink.' : ''}`
      }`

  return (
    <SimLayout
      controls={
        <Controls>
          <Segmented
            label="Experiment"
            value={experiment}
            onChange={setExperiment}
            accent={accent}
            options={[
              { value: 'coin', label: 'Coin' },
              { value: 'die', label: 'Die' },
              { value: 'two-dice', label: 'Two dice' },
            ]}
          />
          <Slider label="Trials per run" value={trialsIdx} min={0} max={TRIALS.length - 1} onChange={setTrialsIdx} accent={accent} format={(i) => TRIALS[i].toLocaleString()} />
          {experiment === 'coin' && (
            <Slider
              label="Chance of heads"
              value={pHeadsPct}
              min={1}
              max={99}
              onChange={setPHeadsPct}
              accent={accent}
              format={(v) => `${v}%`}
              hint="Set to 50% for a fair coin. Any other value makes a biased coin; can the statistics detect it?"
            />
          )}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button variant="primary" accent={accent} onClick={run}>
              <Play size={16} /> Run experiment
            </Button>
            <Button onClick={() => setRuns([])} disabled={!runs.length}>
              <RotateCcw size={16} /> Reset
            </Button>
          </div>
          <Toggle label="Combine all runs" checked={combine} onChange={setCombine} accent={accent} hint="Pool the counts from every run so far instead of showing only the latest run." />
          <p className="border-t border-white/[0.06] pt-4 text-xs leading-relaxed text-fg-subtle">
            {runs.length} run{runs.length === 1 ? '' : 's'} recorded. Outcomes use your browser’s cryptographic random number generator.
          </p>
        </Controls>
      }
      stats={
        view && (
          <StatGrid>
            <Stat label="Trials" value={view.n.toLocaleString()} sub={combine ? `${runs.length} runs pooled` : `run #${runs.length}`} accent={accent} />
            <Stat label={statLabel} value={formatStat(statistic)} sub={`expected ${formatStat(expected)}`} />
            <Stat label="Largest deviation" value={`${maxDev.toFixed(2)} pp`} sub="observed − theoretical" hint="Largest absolute difference between observed and theoretical percentage for any single outcome, in percentage points." />
            <Stat
              label="Chi-square"
              value={`p = ${chi!.pValue < 0.001 ? '<0.001' : chi!.pValue.toFixed(3)}`}
              sub={`χ² = ${chi!.stat.toFixed(2)}, df = ${chi!.df}`}
              hint="Goodness-of-fit test. Small p-values (below 0.05) mean the observed counts would be surprising if the theoretical probabilities were true."
            />
          </StatGrid>
        )
      }
      insight={<Insight accent={accent}>{insight}</Insight>}
    >
      {!view || !rows ? (
        <EmptyState icon={<Dices size={20} />} title="No results yet" action={<Button variant="primary" accent={accent} onClick={run}><Play size={16} /> Run experiment</Button>}>
          Run the experiment to see observed frequencies next to the theoretical probabilities.
        </EmptyState>
      ) : (
        <>
          <Panel title="Observed vs theoretical frequency" actions={<Legend items={[{ label: 'Observed', color: OBS, swatch: 'box' }, { label: 'Theoretical', color: THEORY, swatch: 'box' }]} />}>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barGap={2}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="outcome" {...axisProps} />
                  <YAxis {...axisProps} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip valueFormat={(v) => `${Number(v).toFixed(2)}%`} />} />
                  <Bar dataKey="Observed" fill={OBS} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="Theoretical" fill={THEORY} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-[13px]">
                <caption className="sr-only">Observed and expected outcome counts</caption>
                <thead>
                  <tr className="text-left text-[11px] tracking-wider text-fg-subtle uppercase">
                    <th scope="col" className="py-2 pr-3 font-medium">Outcome</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Count</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Expected</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Observed</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Theoretical</th>
                    <th scope="col" className="py-2 pl-3 text-right font-medium">Difference</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {rows.map((r) => (
                    <tr key={r.outcome} className="border-t border-white/[0.05]">
                      <td className="py-1.5 pr-3 font-sans">{r.outcome}</td>
                      <td className="px-3 py-1.5 text-right">{r.count.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right text-fg-muted">{r.expectedCount.toLocaleString('en-US', { maximumFractionDigits: 1 })}</td>
                      <td className="px-3 py-1.5 text-right">{r.Observed.toFixed(2)}%</td>
                      <td className="px-3 py-1.5 text-right text-fg-muted">{r.Theoretical.toFixed(2)}%</td>
                      <td className="py-1.5 pl-3 text-right">
                        {r.diff >= 0 ? '+' : '−'}
                        {Math.abs(r.diff).toFixed(2)} pp
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title={`Running ${experiment === 'coin' ? 'share of heads' : 'average'} · latest run`}>
              <div className="h-52">
                <ResponsiveContainer>
                  <LineChart data={latest.running} margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="trial" type="number" domain={[1, latest.trials]} {...axisProps} tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                    <YAxis {...axisProps} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v: number) => (experiment === 'coin' ? `${Math.round(v * 100)}%` : v.toFixed(1))} />
                    <Tooltip content={<ChartTooltip labelFormat={(l) => `After ${Number(l).toLocaleString()} trials`} valueFormat={(v) => formatStat(Number(v))} />} />
                    <ReferenceLine y={expected} stroke="rgba(255,255,255,0.45)" strokeDasharray="4 4" label={{ value: 'expected', position: 'insideTopRight', fill: '#a3acc2', fontSize: 11 }} />
                    <Line dataKey="value" name={statLabel} stroke={OBS} strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Repeated experiments" actions={<span className="text-xs text-fg-subtle">one dot per run</span>}>
              <div className="h-52">
                <ResponsiveContainer>
                  <LineChart data={runs.map((r, i) => ({ run: i + 1, value: r.statistic, trials: r.trials }))} margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="run" type="number" domain={[1, Math.max(5, runs.length)]} allowDecimals={false} {...axisProps} />
                    <YAxis {...axisProps} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v: number) => (experiment === 'coin' ? `${Math.round(v * 100)}%` : v.toFixed(2))} />
                    <Tooltip content={<ChartTooltip labelFormat={(l) => `Run ${l}`} valueFormat={(v) => formatStat(Number(v))} />} />
                    <ReferenceLine y={expected} stroke="rgba(255,255,255,0.45)" strokeDasharray="4 4" />
                    <Line dataKey="value" name={statLabel} stroke={SERIES[2]} strokeWidth={1.5} strokeOpacity={0.5} dot={{ r: 4, fill: SERIES[2], stroke: '#0a0e18', strokeWidth: 2 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-fg-subtle">Change the trial count between runs to see how the spread narrows with larger samples.</p>
            </Panel>
          </div>

          <Panel title="Outcome sequence · latest run" actions={<span className="text-xs text-fg-subtle">first {latest.sequence.length} of {latest.trials.toLocaleString()}</span>}>
            <div className="flex flex-wrap gap-1 font-mono text-xs" aria-label="First outcomes of the latest run">
              {latest.sequence.map((k, i) => (
                <span
                  key={i}
                  className="grid h-6 min-w-6 place-items-center rounded px-1"
                  style={{ background: experiment === 'coin' && k === 0 ? `${accent}30` : 'rgba(255,255,255,0.06)', color: '#e8ecf4' }}
                >
                  {experiment === 'coin' ? (k === 0 ? 'H' : 'T') : def.outcomes[k]}
                </span>
              ))}
            </div>
          </Panel>
        </>
      )}
    </SimLayout>
  )
}
