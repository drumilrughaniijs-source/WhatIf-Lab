import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download } from 'lucide-react'
import { SimLayout } from '../../components/SimLayout'
import { Button, Callout, Controls, Insight, Legend, Panel, Segmented, Slider, Stat, StatGrid } from '../../components/ui'
import { SERIES, axisProps } from '../../lib/chart'
import { fmt } from '../../lib/format'
import { useSimParam } from '../../lib/simParams'
import { simulateCompound, type Frequency, type Timing } from '../../models/compound'
import type { SimProps } from '../registry'

const FREQS: Frequency[] = ['daily', 'monthly', 'quarterly', 'annually']
const CONTRIB = SERIES[0]
const INTEREST = SERIES[2]

export default function CompoundInterestLab({ accent }: SimProps) {
  const [initial, setInitial] = useSimParam('initial', 10000, { label: 'Initial investment', format: fmt.money, min: 0, max: 1_000_000 })
  const [monthly, setMonthly] = useSimParam('monthly', 300, { label: 'Monthly contribution', format: fmt.money, min: 0, max: 20_000 })
  const [rate, setRate] = useSimParam('rate', 7, { label: 'Annual rate', format: (v) => `${v.toFixed(1)}%`, min: 0, max: 20 })
  const [years, setYears] = useSimParam('years', 30, { label: 'Duration', format: (v) => `${v} years`, min: 1, max: 60 })
  const [frequency, setFrequency] = useSimParam<Frequency>('frequency', 'monthly', { label: 'Compounding', oneOf: FREQS })
  const [timing, setTiming] = useSimParam<Timing>('timing', 'end', { label: 'Contributions at', oneOf: ['start', 'end'], format: (v) => `${v} of month` })

  const r = useMemo(
    () => simulateCompound({ initial, monthly, ratePct: rate, years, frequency, timing }),
    [initial, monthly, rate, years, frequency, timing],
  )

  const chart = useMemo(
    () => [
      { year: 0, Contributions: initial, Interest: 0 },
      ...r.rows.map((row) => ({ year: row.year, Contributions: Math.round(row.totalContributions), Interest: Math.round(row.totalInterest) })),
    ],
    [r, initial],
  )

  const crossover = r.rows.find((row) => row.interest > row.contributions && row.contributions > 0)
  const doubling = rate > 0 ? Math.log(2) / Math.log(1 + r.effectiveAnnualRate) : null
  const lastDecadeShare = years >= 20 ? (r.finalBalance - r.rows[years - 11].endBalance) / r.finalBalance : null

  const insight =
    rate === 0
      ? 'At 0% interest the balance is just the sum of your contributions. Increase the rate to see compounding take over.'
      : `Interest makes up ${((r.totalInterest / Math.max(1, r.finalBalance)) * 100).toFixed(0)}% of the final balance. ${
          crossover ? `From year ${crossover.year}, the interest earned each year exceeds what you contribute that year. ` : ''
        }${lastDecadeShare !== null ? `The last 10 years alone account for ${(lastDecadeShare * 100).toFixed(0)}% of the final balance.` : doubling ? `At this rate money doubles about every ${doubling.toFixed(1)} years.` : ''}`

  const downloadCsv = () => {
    const header = 'Year,Start balance,Contributions,Interest,End balance,Total contributions,Total interest'
    const lines = r.rows.map((row) =>
      [row.year, row.startBalance, row.contributions, row.interest, row.endBalance, row.totalContributions, row.totalInterest]
        .map((v, i) => (i === 0 ? v : v.toFixed(2)))
        .join(','),
    )
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compound-interest-${years}y.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <SimLayout
      controls={
        <Controls>
          <Slider label="Initial investment" value={initial} min={0} max={100000} step={500} onChange={setInitial} accent={accent} format={fmt.money} />
          <Slider label="Monthly contribution" value={monthly} min={0} max={5000} step={25} onChange={setMonthly} accent={accent} format={fmt.money} />
          <Slider
            label="Annual interest rate"
            value={rate}
            min={0}
            max={15}
            step={0.1}
            onChange={setRate}
            accent={accent}
            format={(v) => `${v.toFixed(1)}%`}
            hint="Nominal annual rate, assumed constant for the whole period. Real investment returns vary from year to year."
          />
          <Slider label="Investment duration" value={years} min={1} max={50} onChange={setYears} accent={accent} format={(v) => `${v} yr`} />
          <Segmented
            label="Compounding"
            value={frequency}
            onChange={setFrequency}
            accent={accent}
            hint="How often interest is credited. We convert the rate to an equivalent monthly rate, so the effective annual yield is exact."
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'quarterly', label: 'Quarterly' },
              { value: 'annually', label: 'Yearly' },
            ]}
          />
          <Segmented
            label="Contribute at"
            value={timing}
            onChange={setTiming}
            accent={accent}
            hint="Contributions at the start of the month earn one extra month of interest each time."
            options={[
              { value: 'start', label: 'Start of month' },
              { value: 'end', label: 'End of month' },
            ]}
          />
        </Controls>
      }
      stats={
        <StatGrid>
          <Stat label="Final balance" value={fmt.moneyCompact(r.finalBalance)} sub={fmt.money(r.finalBalance)} accent={accent} />
          <Stat label="Total contributions" value={fmt.moneyCompact(r.totalContributions)} sub={`${fmt.money(initial)} + ${years * 12} × ${fmt.money(monthly)}`} accent={CONTRIB} />
          <Stat label="Projected interest" value={fmt.moneyCompact(r.totalInterest)} sub={fmt.money(r.totalInterest)} accent={INTEREST} />
          <Stat label="Effective annual rate" value={`${(r.effectiveAnnualRate * 100).toFixed(3)}%`} sub={doubling ? `doubles in ~${doubling.toFixed(1)} yr` : 'no growth'} hint="The yearly growth rate after compounding: (1 + r/m)^m − 1." />
        </StatGrid>
      }
      insight={
        <div className="space-y-3">
          <Insight accent={accent}>{insight}</Insight>
          <Callout kind="info">
            Projections are hypothetical and assume a constant rate with no taxes, fees or inflation. They do not guarantee future returns and are not financial advice.
          </Callout>
        </div>
      }
    >
      <Panel
        title="Growth over time"
        actions={<Legend items={[{ label: 'Contributions', color: CONTRIB, swatch: 'box' }, { label: 'Interest', color: INTEREST, swatch: 'box' }]} />}
      >
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={chart} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="year" {...axisProps} tickFormatter={(v: number) => `Yr ${v}`} minTickGap={24} />
              <YAxis {...axisProps} axisLine={false} tickFormatter={(v: number) => fmt.moneyCompact(v)} width={64} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-lg border border-white/10 bg-ink-850/95 px-3 py-2 text-xs shadow-xl">
                      <div className="mb-1 font-medium">End of year {label}</div>
                      {payload.map((p) => (
                        <div key={String(p.dataKey)} className="flex items-center gap-2 text-fg-muted">
                          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
                          {p.name}
                          <span className="ml-auto pl-4 font-mono text-fg">{fmt.money(Number(p.value))}</span>
                        </div>
                      ))}
                      <div className="mt-1 flex border-t border-white/10 pt-1 text-fg">
                        Balance
                        <span className="ml-auto pl-4 font-mono">{fmt.money(payload.reduce((s, p) => s + Number(p.value), 0))}</span>
                      </div>
                    </div>
                  ) : null
                }
              />
              <Area type="monotone" dataKey="Contributions" stackId="a" stroke={CONTRIB} strokeWidth={2} fill={CONTRIB} fillOpacity={0.25} isAnimationActive={false} />
              <Area type="monotone" dataKey="Interest" stackId="a" stroke={INTEREST} strokeWidth={2} fill={INTEREST} fillOpacity={0.3} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel
        title="Year-by-year breakdown"
        bodyClassName="p-0"
        actions={
          <Button variant="ghost" onClick={downloadCsv} className="px-2.5 py-1.5 text-xs">
            <Download size={14} /> CSV
          </Button>
        }
      >
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <caption className="sr-only">Year-by-year compound interest breakdown</caption>
            <thead className="sticky top-0 bg-ink-900">
              <tr className="text-left text-[11px] tracking-wider text-fg-subtle uppercase">
                <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Year</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Start balance</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Contributions</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Interest</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium sm:px-5">End balance</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {r.rows.map((row) => (
                <tr key={row.year} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                  <td className="px-4 py-2 text-fg-muted sm:px-5">{row.year}</td>
                  <td className="px-3 py-2 text-right text-fg-muted">{fmt.money(row.startBalance)}</td>
                  <td className="px-3 py-2 text-right">{fmt.money(row.contributions)}</td>
                  <td className="px-3 py-2 text-right" style={{ color: row.interest > row.contributions ? '#6ee7b7' : undefined }}>
                    {fmt.money(row.interest)}
                  </td>
                  <td className="px-4 py-2 text-right font-medium sm:px-5">{fmt.money(row.endBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </SimLayout>
  )
}
