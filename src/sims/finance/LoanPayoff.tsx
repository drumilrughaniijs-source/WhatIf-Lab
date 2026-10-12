import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SimLayout } from '../../components/SimLayout'
import { ChartTooltip, Controls, Insight, Legend, Panel, Segmented, Slider, Stat, StatGrid } from '../../components/ui'
import { SERIES, axisProps } from '../../lib/chart'
import { fmt } from '../../lib/format'
import type { SimProps } from '../registry'
import { useSimParam } from '../../lib/simParams'

interface Schedule {
  months: number
  totalInterest: number
  balanceByMonth: number[]
  yearly: { year: number; interest: number; principal: number }[]
}

function payment(principal: number, annualRate: number, years: number) {
  const r = annualRate / 100 / 12
  const n = years * 12
  return r === 0 ? principal / n : (principal * r) / (1 - (1 + r) ** -n)
}

function amortise(principal: number, annualRate: number, pmt: number, extra: number): Schedule {
  const r = annualRate / 100 / 12
  let bal = principal
  let totalInterest = 0
  const balanceByMonth = [bal]
  const yearly: Schedule['yearly'] = []
  let m = 0
  while (bal > 0.005 && m < 1200) {
    const interest = bal * r
    const princ = Math.min(bal, pmt + extra - interest)
    bal -= princ
    totalInterest += interest
    m++
    balanceByMonth.push(Math.max(0, bal))
    const y = Math.ceil(m / 12)
    if (!yearly[y - 1]) yearly[y - 1] = { year: y, interest: 0, principal: 0 }
    yearly[y - 1].interest += interest
    yearly[y - 1].principal += princ
  }
  return { months: m, totalInterest, balanceByMonth, yearly }
}

const yearsMonths = (m: number) => {
  const y = Math.floor(m / 12)
  const mo = m % 12
  return `${y}y${mo ? ` ${mo}m` : ''}`
}

export default function LoanPayoff({ accent }: SimProps) {
  const [principal, setPrincipal] = useSimParam('principal', 300000, { label: 'Loan', format: fmt.money, min: 10000, max: 1000000 })
  const [rate, setRate] = useSimParam('rate', 6.5, { label: 'APR', format: (v) => `${v}%`, min: 0, max: 15 })
  const [years, setYears] = useSimParam<'15' | '20' | '30'>('years', '30', { label: 'Term', oneOf: ['15', '20', '30'], format: (v) => `${v} years` })
  const [extra, setExtra] = useSimParam('extra', 200, { label: 'Extra / month', format: fmt.money, min: 0, max: 3000 })

  const pmt = payment(principal, rate, Number(years))
  const base = useMemo(() => amortise(principal, rate, pmt, 0), [principal, rate, pmt])
  const plan = useMemo(() => amortise(principal, rate, pmt, extra), [principal, rate, pmt, extra])

  const balance = useMemo(
    () =>
      base.balanceByMonth
        .map((b, i) => ({ month: i, Standard: Math.round(b), 'With extra': i <= plan.months ? Math.round(plan.balanceByMonth[i]) : null }))
        .filter((_, i) => i % 3 === 0 || i === base.months),
    [base, plan],
  )

  const yearly = plan.yearly.map((y) => ({ year: y.year, Interest: Math.round(y.interest), Principal: Math.round(y.principal) }))

  const saved = base.totalInterest - plan.totalInterest
  const monthsSaved = base.months - plan.months
  const firstInterestShare = (principal * (rate / 100 / 12)) / pmt

  const insight =
    extra > 0
      ? `Paying ${fmt.money(extra)} extra each month clears the loan ${yearsMonths(monthsSaved)} sooner and saves ${fmt.money(saved)} in interest, a return of ${fmt.pct((saved / (extra * plan.months)) * 100, 0)} on the extra ${fmt.money(extra * plan.months)} you paid in. It's a guaranteed, risk-free return equal to the loan's interest rate.`
      : `With no extra payments, ${fmt.pct(firstInterestShare * 100, 0)} of your first payment is pure interest. Over the full term you pay ${fmt.money(base.totalInterest)} in interest on a ${fmt.money(principal)} loan. Try adding a small extra payment.`

  const money = (v: number | string) => fmt.money(Number(v))

  return (
    <SimLayout
      controls={
        <Controls>
          <Slider label="Loan amount" value={principal} min={10000} max={1000000} step={5000} onChange={setPrincipal} accent={accent} format={fmt.money} />
          <Slider label="Interest rate (APR)" value={rate} min={0} max={15} step={0.125} onChange={setRate} accent={accent} format={(v) => fmt.pct(v, 3)} />
          <Segmented
            label="Term"
            value={years}
            onChange={setYears}
            accent={accent}
            options={[
              { value: '15', label: '15 years' },
              { value: '20', label: '20 years' },
              { value: '30', label: '30 years' },
            ]}
          />
          <Slider label="Extra payment / month" value={extra} min={0} max={3000} step={25} onChange={setExtra} accent={accent} format={fmt.money} />
        </Controls>
      }
      stats={
        <StatGrid>
          <Stat label="Monthly payment" value={fmt.money(pmt)} sub={extra ? `+ ${fmt.money(extra)} extra` : 'standard'} accent={accent} />
          <Stat label="Paid off in" value={yearsMonths(plan.months)} sub={monthsSaved ? `${yearsMonths(monthsSaved)} sooner` : 'full term'} />
          <Stat label="Total interest" value={fmt.moneyCompact(plan.totalInterest)} sub={`vs ${fmt.moneyCompact(base.totalInterest)}`} />
          <Stat label="Interest saved" value={<span className={saved > 0 ? 'text-emerald-300' : ''}>{fmt.moneyCompact(saved)}</span>} />
        </StatGrid>
      }
      insight={<Insight accent={accent}>{insight}</Insight>}
    >
      <Panel
        title="Remaining balance"
        actions={<Legend items={[{ label: 'Standard', color: SERIES[1], dashed: true }, { label: 'With extra', color: SERIES[0] }]} />}
      >
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={balance} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                type="number"
                domain={[0, base.months]}
                ticks={Array.from({ length: Math.floor(base.months / 60) + 1 }, (_, i) => i * 60)}
                tickFormatter={(v: number) => `Yr ${v / 12}`}
                {...axisProps}
              />
              <YAxis {...axisProps} axisLine={false} tickFormatter={(v: number) => fmt.moneyCompact(v)} width={60} />
              <Tooltip content={<ChartTooltip labelFormat={(l) => `Month ${l} (${yearsMonths(Number(l))})`} valueFormat={money} />} />
              <Line dataKey="Standard" stroke={SERIES[1]} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              <Line dataKey="With extra" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel
        title="Where each year's payments go (with extra)"
        actions={<Legend items={[{ label: 'Interest', color: SERIES[1] }, { label: 'Principal', color: SERIES[2] }]} />}
      >
        <div className="h-60">
          <ResponsiveContainer>
            <BarChart data={yearly} margin={{ top: 8, right: 12, bottom: 0, left: 4 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="year" {...axisProps} tickFormatter={(v: number) => `${v}`} minTickGap={12} />
              <YAxis {...axisProps} axisLine={false} tickFormatter={(v: number) => fmt.moneyCompact(v)} width={60} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip labelFormat={(l) => `Year ${l}`} valueFormat={money} />} />
              <Bar dataKey="Interest" stackId="a" fill={SERIES[1]} stroke="#0b0f1a" strokeWidth={1} isAnimationActive={false} />
              <Bar dataKey="Principal" stackId="a" fill={SERIES[2]} stroke="#0b0f1a" strokeWidth={1} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </SimLayout>
  )
}
