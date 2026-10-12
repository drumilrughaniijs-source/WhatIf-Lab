import { useMemo } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SimLayout } from '../../components/SimLayout'
import { ChartTooltip, Controls, Insight, Legend, Panel, Slider, Stat, StatGrid, Toggle } from '../../components/ui'
import { SERIES, axisProps } from '../../lib/chart'
import { fmt } from '../../lib/format'
import type { SimProps } from '../registry'
import { useSimParam } from '../../lib/simParams'

const END_AGE = 65
const CONTRIB = '#8b93a7'

interface Investor {
  start: number
  monthly: number
}

/** Month-by-month simulation; returns end-of-year balances indexed by age, plus totals. */
function grow({ start, monthly }: Investor, annualReturn: number, inflation: number, from: number) {
  const r = (1 + annualReturn / 100) ** (1 / 12) - 1
  const inf = (1 + inflation / 100) ** (1 / 12) - 1
  let bal = 0
  let contributed = 0
  let deflator = 1
  const byAge = new Map<number, { nominal: number; real: number }>()
  for (let age = from; age <= END_AGE; age++) {
    byAge.set(age, { nominal: bal, real: bal / deflator })
    if (age === END_AGE) break
    for (let m = 0; m < 12; m++) {
      bal *= 1 + r
      if (age >= start) {
        bal += monthly
        contributed += monthly
      }
      deflator *= 1 + inf
    }
  }
  return { byAge, final: bal, real: bal / deflator, contributed }
}

export default function CompoundInterest({ accent }: SimProps) {
  const [earlyAge, setEarlyAge] = useSimParam('earlyAge', 25, { label: 'Early start age', min: 18, max: 60 })
  const [lateAge, setLateAge] = useSimParam('lateAge', 35, { label: 'Late start age', min: 18, max: 60 })
  const [earlyMonthly, setEarlyMonthly] = useSimParam('earlyMonthly', 300, { label: 'Early monthly', format: fmt.money, min: 25, max: 3000 })
  const [lateMonthly, setLateMonthly] = useSimParam('lateMonthly', 300, { label: 'Late monthly', format: fmt.money, min: 25, max: 3000 })
  const [ret, setRet] = useSimParam('ret', 7, { label: 'Return', format: (v) => `${v}%`, min: 0, max: 12 })
  const [inflation, setInflation] = useSimParam('inflation', 2.5, { label: 'Inflation', format: (v) => `${v}%`, min: 0, max: 8 })
  const [real, setReal] = useSimParam('real', false, { label: "Today's money", format: (v) => (v ? 'Yes' : 'No') })

  const from = Math.min(earlyAge, lateAge)
  const e = useMemo(() => grow({ start: earlyAge, monthly: earlyMonthly }, ret, inflation, from), [earlyAge, earlyMonthly, ret, inflation, from])
  const l = useMemo(() => grow({ start: lateAge, monthly: lateMonthly }, ret, inflation, from), [lateAge, lateMonthly, ret, inflation, from])

  const data = useMemo(
    () =>
      [...e.byAge.keys()].map((age) => ({
        age,
        Early: Math.round(real ? e.byAge.get(age)!.real : e.byAge.get(age)!.nominal),
        Late: Math.round(real ? l.byAge.get(age)!.real : l.byAge.get(age)!.nominal),
      })),
    [e, l, real],
  )

  const eFinal = real ? e.real : e.final
  const lFinal = real ? l.real : l.final
  const deflate = real ? e.real / e.final : 1

  const breakdown = [
    { who: 'Early starter', Contributed: Math.round(e.contributed * deflate), Growth: Math.round(eFinal - e.contributed * deflate) },
    { who: 'Late starter', Contributed: Math.round(l.contributed * deflate), Growth: Math.round(lFinal - l.contributed * deflate) },
  ]

  // How much would the late starter need to invest monthly to match?
  const unit = grow({ start: lateAge, monthly: 1 }, ret, inflation, from).final
  const neededMonthly = e.final / unit

  const diff = eFinal - lFinal
  const insight =
    diff > 0
      ? `Starting ${Math.abs(lateAge - earlyAge)} years earlier leaves the early investor ${fmt.money(diff)} ahead${real ? " in today's money" : ''}, even though they contributed only ${fmt.money(e.contributed - l.contributed)} more. To catch up, the late starter would need to invest ${fmt.money(neededMonthly)} every month, ${(neededMonthly / earlyMonthly).toFixed(1)}× as much.`
      : `The late starter is ahead by ${fmt.money(-diff)}. Higher contributions can beat time, but look at how much more they had to put in: ${fmt.money(l.contributed)} vs ${fmt.money(e.contributed)}.`

  const money = (v: number | string) => fmt.money(Number(v))

  return (
    <SimLayout
      controls={
        <Controls>
          <div className="space-y-4 rounded-xl border p-3" style={{ borderColor: `${SERIES[0]}55` }}>
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[0] }} /> Early starter
            </div>
            <Slider label="Starts at age" value={earlyAge} min={18} max={60} onChange={setEarlyAge} accent={SERIES[0]} />
            <Slider label="Monthly investment" value={earlyMonthly} min={25} max={3000} step={25} onChange={setEarlyMonthly} accent={SERIES[0]} format={fmt.money} />
          </div>
          <div className="space-y-4 rounded-xl border p-3" style={{ borderColor: `${SERIES[1]}55` }}>
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[1] }} /> Late starter
            </div>
            <Slider label="Starts at age" value={lateAge} min={18} max={60} onChange={setLateAge} accent={SERIES[1]} />
            <Slider label="Monthly investment" value={lateMonthly} min={25} max={3000} step={25} onChange={setLateMonthly} accent={SERIES[1]} format={fmt.money} />
          </div>
          <Slider label="Annual return" value={ret} min={0} max={12} step={0.25} onChange={setRet} accent={accent} format={(v) => fmt.pct(v, 2)} hint="Long-run global stock markets have returned roughly 5–7% after inflation, with large swings year to year." />
          <Slider label="Inflation" value={inflation} min={0} max={8} step={0.25} onChange={setInflation} accent={accent} format={(v) => fmt.pct(v, 2)} />
          <Toggle label="Show in today's money" checked={real} onChange={setReal} accent={accent} />
        </Controls>
      }
      stats={
        <StatGrid>
          <Stat label={`Early · at ${END_AGE}`} value={fmt.moneyCompact(eFinal)} sub={`${fmt.moneyCompact(e.contributed)} invested`} accent={SERIES[0]} />
          <Stat label={`Late · at ${END_AGE}`} value={fmt.moneyCompact(lFinal)} sub={`${fmt.moneyCompact(l.contributed)} invested`} accent={SERIES[1]} />
          <Stat label="Difference" value={fmt.moneyCompact(Math.abs(diff))} sub={diff >= 0 ? 'early leads' : 'late leads'} />
          <Stat label="Late needs" value={`${fmt.money(neededMonthly)}/mo`} sub="to match early" />
        </StatGrid>
      }
      insight={<Insight accent={accent}>{insight}</Insight>}
    >
      <Panel
        title={`Portfolio value by age${real ? " (today's money)" : ''}`}
        actions={<Legend items={[{ label: 'Early starter', color: SERIES[0] }, { label: 'Late starter', color: SERIES[1] }]} />}
      >
        <div className="h-80">
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
              <defs>
                {[0, 1].map((i) => (
                  <linearGradient key={i} id={`ci-g${i}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={SERIES[i]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={SERIES[i]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="age" {...axisProps} minTickGap={20} />
              <YAxis {...axisProps} axisLine={false} tickFormatter={(v: number) => fmt.moneyCompact(v)} width={60} />
              <Tooltip content={<ChartTooltip labelFormat={(l) => `Age ${l}`} valueFormat={money} />} />
              <Area type="monotone" dataKey="Early" name="Early starter" stroke={SERIES[0]} strokeWidth={2} fill="url(#ci-g0)" isAnimationActive={false} />
              <Area type="monotone" dataKey="Late" name="Late starter" stroke={SERIES[1]} strokeWidth={2} fill="url(#ci-g1)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel
        title={`Where the money came from at ${END_AGE}`}
        actions={<Legend items={[{ label: 'Your contributions', color: CONTRIB }, { label: 'Investment growth', color: SERIES[2] }]} />}
      >
        <div className="h-40">
          <ResponsiveContainer>
            <BarChart data={breakdown} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }} barSize={22}>
              <CartesianGrid horizontal={false} vertical />
              <XAxis type="number" {...axisProps} tickFormatter={(v: number) => fmt.moneyCompact(v)} />
              <YAxis type="category" dataKey="who" {...axisProps} axisLine={false} width={92} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip valueFormat={money} />} />
              <Bar dataKey="Contributed" name="Contributions" stackId="a" fill={CONTRIB} stroke="#0b0f1a" strokeWidth={2} isAnimationActive={false} />
              <Bar dataKey="Growth" name="Growth" stackId="a" fill={SERIES[2]} stroke="#0b0f1a" strokeWidth={2} radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </SimLayout>
  )
}
