/** Coin and dice experiments with a chi-square goodness-of-fit test. */

export type ExperimentId = 'coin' | 'die' | 'two-dice'

export interface ExperimentDef {
  id: ExperimentId
  name: string
  outcomes: string[]
  /** Numeric value of each outcome (heads = 1 for coins). */
  values: number[]
}

export const EXPERIMENTS: Record<ExperimentId, ExperimentDef> = {
  coin: { id: 'coin', name: 'Coin flip', outcomes: ['Heads', 'Tails'], values: [1, 0] },
  die: { id: 'die', name: 'Die roll', outcomes: ['1', '2', '3', '4', '5', '6'], values: [1, 2, 3, 4, 5, 6] },
  'two-dice': {
    id: 'two-dice',
    name: 'Sum of two dice',
    outcomes: ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
    values: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },
}

export function theoretical(id: ExperimentId, pHeads = 0.5): number[] {
  if (id === 'coin') return [pHeads, 1 - pHeads]
  if (id === 'die') return Array(6).fill(1 / 6)
  return EXPERIMENTS['two-dice'].values.map((s) => (6 - Math.abs(s - 7)) / 36)
}

export function expectedValue(id: ExperimentId, pHeads = 0.5) {
  const probs = theoretical(id, pHeads)
  return probs.reduce((s, p, i) => s + p * EXPERIMENTS[id].values[i], 0)
}

export interface RunResult {
  id: ExperimentId
  trials: number
  counts: number[]
  /** First outcomes (indices into `outcomes`), for display. */
  sequence: number[]
  /** Running statistic: proportion of heads (coin) or running mean (dice). */
  running: { trial: number; value: number }[]
  /** Final value of the running statistic. */
  statistic: number
}

/** Draw one outcome index. `rand` must return uniform values in [0, 1). */
function draw(id: ExperimentId, rand: () => number, pHeads: number): number {
  if (id === 'coin') return rand() < pHeads ? 0 : 1
  const d1 = Math.floor(rand() * 6)
  if (id === 'die') return d1
  const d2 = Math.floor(rand() * 6)
  return d1 + d2 // index 0 ↔ sum 2
}

export function runExperiment(id: ExperimentId, trials: number, rand: () => number, pHeads = 0.5): RunResult {
  const def = EXPERIMENTS[id]
  const counts = Array(def.outcomes.length).fill(0)
  const sequence: number[] = []
  const running: RunResult['running'] = []
  const samplePoints = Math.min(trials, 300)
  const every = trials / samplePoints
  let nextSample = every
  let sum = 0
  for (let t = 1; t <= trials; t++) {
    const k = draw(id, rand, pHeads)
    counts[k]++
    sum += def.values[k]
    if (sequence.length < 120) sequence.push(k)
    if (t >= nextSample || t === trials) {
      running.push({ trial: t, value: sum / t })
      nextSample += every
    }
  }
  return { id, trials, counts, sequence, running, statistic: sum / trials }
}

/* ---------------------------------------------------- chi-square p-value */

function lnGamma(z: number): number {
  // Lanczos approximation (g = 7, n = 9)
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z)
  z -= 1
  let x = c[0]
  for (let i = 1; i < 9; i++) x += c[i] / (z + i)
  const t = z + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

/** Regularised upper incomplete gamma Q(a, x). */
export function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1
  if (x < a + 1) {
    // series for P, then Q = 1 − P
    let sum = 1 / a
    let term = sum
    for (let n = 1; n < 500; n++) {
      term *= x / (a + n)
      sum += term
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - lnGamma(a))
  }
  // continued fraction for Q (modified Lentz)
  let b = x + 1 - a
  let c = 1 / 1e-300
  let d = 1 / b
  let h = d
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < 1e-300) d = 1e-300
    c = b + an / c
    if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-14) break
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h
}

export function chiSquare(counts: number[], probs: number[]) {
  const n = counts.reduce((s, c) => s + c, 0)
  let stat = 0
  let df = -1
  counts.forEach((c, i) => {
    const e = n * probs[i]
    if (e > 0) {
      stat += (c - e) ** 2 / e
      df++
    }
  })
  return { stat, df, pValue: df > 0 ? gammaQ(df / 2, stat / 2) : 1 }
}
