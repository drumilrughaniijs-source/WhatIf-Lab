/**
 * Compound interest with regular monthly contributions.
 *
 * The nominal annual rate r, compounded m times per year, is converted to an
 * equivalent monthly growth rate  i = (1 + r/m)^(m/12) − 1, so the effective
 * annual yield is exact for every compounding frequency. Contributions are
 * made monthly, at either the start or the end of each month.
 */

export const FREQUENCIES = { daily: 365, monthly: 12, quarterly: 4, annually: 1 } as const
export type Frequency = keyof typeof FREQUENCIES
export type Timing = 'start' | 'end'

export interface CompoundInput {
  initial: number
  monthly: number
  ratePct: number
  years: number
  frequency: Frequency
  timing: Timing
}

export interface YearRow {
  year: number
  startBalance: number
  contributions: number
  interest: number
  endBalance: number
  totalContributions: number
  totalInterest: number
}

export interface CompoundResult {
  rows: YearRow[]
  finalBalance: number
  totalContributions: number
  totalInterest: number
  monthlyRate: number
  effectiveAnnualRate: number
}

export function monthlyRateFor(ratePct: number, frequency: Frequency) {
  const m = FREQUENCIES[frequency]
  return (1 + ratePct / 100 / m) ** (m / 12) - 1
}

export function simulateCompound(input: CompoundInput): CompoundResult {
  const { initial, monthly, ratePct, years, frequency, timing } = input
  const i = monthlyRateFor(ratePct, frequency)
  let balance = initial
  let totalContributions = initial
  let totalInterest = 0
  const rows: YearRow[] = []
  for (let y = 1; y <= years; y++) {
    const startBalance = balance
    let contributions = 0
    let interest = 0
    for (let mo = 0; mo < 12; mo++) {
      if (timing === 'start') {
        balance += monthly
        contributions += monthly
      }
      const earned = balance * i
      balance += earned
      interest += earned
      if (timing === 'end') {
        balance += monthly
        contributions += monthly
      }
    }
    totalContributions += contributions
    totalInterest += interest
    rows.push({ year: y, startBalance, contributions, interest, endBalance: balance, totalContributions, totalInterest })
  }
  return {
    rows,
    finalBalance: balance,
    totalContributions,
    totalInterest,
    monthlyRate: i,
    effectiveAnnualRate: (1 + i) ** 12 - 1,
  }
}

/** Closed-form future value (used to cross-check the month-by-month loop). */
export function futureValue(input: CompoundInput) {
  const i = monthlyRateFor(input.ratePct, input.frequency)
  const n = input.years * 12
  if (i === 0) return input.initial + input.monthly * n
  const growth = (1 + i) ** n
  const annuity = (input.monthly * (growth - 1)) / i
  return input.initial * growth + (input.timing === 'start' ? annuity * (1 + i) : annuity)
}
