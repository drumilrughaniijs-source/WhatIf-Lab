import { test } from 'node:test'
import assert from 'node:assert/strict'
import { OS_RESERVED_GB, maxAppsWithoutSwap, simulateRam } from './ram.ts'
import { amdahl, bestCoreCount, simulateCpu } from './cpu.ts'
import { futureValue, simulateCompound } from './compound.ts'
import { chiSquare, expectedValue, gammaQ, runExperiment, theoretical } from './probability.ts'
import { circularSpeed, elements, escapeSpeed, initialState, separation, step, totalEnergy } from './orbit.ts'
import { evaluate, gradients, initNet, makeDataset, trainStep } from './nn.ts'
import { mulberry32 } from '../lib/random.ts'

const close = (a: number, b: number, tol: number, msg?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b}, got ${a} (tol ${tol})`)

/* -------------------------------------------------------------------- RAM */

test('RAM: accounting adds up and no swap below capacity', () => {
  const r = simulateRam({ capacityGB: 16, perAppMB: 1024, apps: 4, swap: 'ssd' })
  close(r.demandGB, OS_RESERVED_GB + 4, 1e-9)
  close(r.usedGB + r.availableGB, 16, 1e-9)
  assert.equal(r.overflowGB, 0)
  assert.equal(r.performance, 1)
  assert.equal(r.pressure, 'normal')
})

test('RAM: overflow goes to swap and performance collapses', () => {
  const r = simulateRam({ capacityGB: 8, perAppMB: 2048, apps: 6, swap: 'ssd' })
  close(r.overflowGB, OS_RESERVED_GB + 12 - 8, 1e-9)
  assert.equal(r.usedGB, 8)
  assert.equal(r.availableGB, 0)
  assert.equal(r.pressure, 'critical')
  assert.ok(r.performance < 0.2, `perf ${r.performance}`)
  const hdd = simulateRam({ capacityGB: 8, perAppMB: 2048, apps: 6, swap: 'hdd' })
  assert.ok(hdd.performance < r.performance, 'HDD swap must be slower than SSD swap')
})

test('RAM: performance never increases as more apps are opened', () => {
  let prev = 1
  for (let n = 0; n <= 40; n++) {
    const p = simulateRam({ capacityGB: 16, perAppMB: 700, apps: n, swap: 'ssd' }).performance
    assert.ok(p <= prev + 1e-12, `n=${n}`)
    prev = p
  }
  assert.equal(maxAppsWithoutSwap(16, 1024), 14)
})

/* -------------------------------------------------------------------- CPU */

test('CPU: single core equals work / (IPC × f)', () => {
  const r = simulateCpu({ ghz: 3, cores: 1, workG: 900, parallel: 0.9 })
  close(r.totalS, 900 / (3 * 3), 1e-9)
  close(r.speedup, 1, 1e-12)
})

test('CPU: fully serial work does not benefit from more cores', () => {
  const r = simulateCpu({ ghz: 3, cores: 32, workG: 100, parallel: 0 })
  close(r.speedup, 1, 1e-12)
})

test('CPU: speed-up stays below plain Amdahl and has diminishing returns', () => {
  for (const p of [0.5, 0.9, 0.99]) {
    for (const n of [2, 8, 32, 64]) {
      const s = simulateCpu({ ghz: 4, cores: n, workG: 100, parallel: p }).speedup
      assert.ok(s <= amdahl(p, n) + 1e-12, `p=${p} n=${n}`)
    }
  }
  const best = bestCoreCount({ ghz: 4, workG: 100, parallel: 0.95 })
  assert.ok(best > 1 && best < 64, `best=${best}`)
})

/* --------------------------------------------------------------- Compound */

test('Compound: loop matches the closed-form future value', () => {
  for (const timing of ['start', 'end'] as const)
    for (const frequency of ['daily', 'monthly', 'quarterly', 'annually'] as const) {
      const input = { initial: 10000, monthly: 250, ratePct: 7, years: 30, frequency, timing }
      const r = simulateCompound(input)
      close(r.finalBalance, futureValue(input), 1e-6 * r.finalBalance, `${timing}/${frequency}`)
      close(r.totalContributions + r.totalInterest, r.finalBalance, 1e-6)
    }
})

test('Compound: textbook value — $1000 at 12% compounded monthly for 1 year', () => {
  const r = simulateCompound({ initial: 1000, monthly: 0, ratePct: 12, years: 1, frequency: 'monthly', timing: 'end' })
  close(r.finalBalance, 1126.825, 0.001)
  const annual = simulateCompound({ initial: 1000, monthly: 0, ratePct: 12, years: 1, frequency: 'annually', timing: 'end' })
  close(annual.finalBalance, 1120, 1e-6)
})

test('Compound: zero rate just sums contributions', () => {
  const r = simulateCompound({ initial: 500, monthly: 100, ratePct: 0, years: 10, frequency: 'monthly', timing: 'end' })
  close(r.finalBalance, 500 + 100 * 120, 1e-9)
  assert.equal(r.rows.length, 10)
})

/* ------------------------------------------------------------ Probability */

test('Probability: theoretical distributions sum to 1 and have the right means', () => {
  for (const id of ['coin', 'die', 'two-dice'] as const) close(theoretical(id).reduce((s, p) => s + p, 0), 1, 1e-12)
  close(expectedValue('die'), 3.5, 1e-12)
  close(expectedValue('two-dice'), 7, 1e-12)
  close(theoretical('two-dice')[5], 6 / 36, 1e-12)
})

test('Probability: sampling converges (law of large numbers)', () => {
  const rand = mulberry32(42)
  const r = runExperiment('two-dice', 200000, rand)
  assert.equal(r.counts.reduce((s, c) => s + c, 0), 200000)
  close(r.statistic, 7, 0.03)
  const coin = runExperiment('coin', 200000, mulberry32(7), 0.3)
  close(coin.statistic, 0.3, 0.01)
})

test('Probability: chi-square p-values match known table values', () => {
  close(gammaQ(0.5, 3.841 / 2), 0.05, 0.0005) // df=1 critical value
  close(gammaQ(2.5, 11.07 / 2), 0.05, 0.0005) // df=5
  close(gammaQ(5, 18.307 / 2), 0.05, 0.0005) // df=10
  const perfect = chiSquare([100, 100], [0.5, 0.5])
  assert.equal(perfect.stat, 0)
  close(perfect.pValue, 1, 1e-9)
})

/* ------------------------------------------------------------------ Orbit */

test('Orbit: circular orbit at 1 AU has a 1-year period and returns to start', () => {
  const input = { distance: 1, speed: circularSpeed(1, 1e-6), massRatio: 1e-6 }
  const el = elements(input)
  assert.equal(el.kind, 'circular')
  close(el.periodYears!, 1, 1e-3)
  const s = initialState(input)
  const e0 = totalEnergy(s)
  const dt = 0.0005
  for (let i = 0; i < 2000; i++) step(s, dt)
  close(s.planet.x, 1, 0.01, 'x after one year')
  close(s.planet.y, 0, 0.02, 'y after one year')
  close(totalEnergy(s), e0, Math.abs(e0) * 1e-6, 'energy')
})

test('Orbit: escape speed is unbound, elliptical orbit stays bounded', () => {
  assert.notEqual(elements({ distance: 1, speed: escapeSpeed(1, 0.001) * 1.01, massRatio: 0.001 }).kind, 'elliptical')
  const input = { distance: 1, speed: 5, massRatio: 0.001 }
  const el = elements(input)
  assert.equal(el.kind, 'elliptical')
  const s = initialState(input)
  let maxR = 0
  for (let i = 0; i < 4000; i++) {
    step(s, 0.0005)
    maxR = Math.max(maxR, separation(s))
  }
  close(maxR, el.apoapsis!, 0.01, 'apoapsis')
})

/* ----------------------------------------------------------------- Neural */

test('NN: analytic gradients match numerical gradients', () => {
  const data = makeDataset('xor', 40, 3)
  const net = initNet(3, 11)
  const g = gradients(net, data)
  const eps = 1e-6
  for (const idx of [0, 1, 3, 5]) {
    const orig = net.W1[idx]
    net.W1[idx] = orig + eps
    const lp = evaluate(net, data).loss
    net.W1[idx] = orig - eps
    const lm = evaluate(net, data).loss
    net.W1[idx] = orig
    close(g.W1[idx], (lp - lm) / (2 * eps), 1e-5, `dW1[${idx}]`)
  }
})

test('NN: gradient descent actually learns XOR', () => {
  const data = makeDataset('xor', 200, 1)
  const net = initNet(4, 5)
  const before = evaluate(net, data)
  for (let i = 0; i < 3000; i++) trainStep(net, data, 0.5)
  const after = evaluate(net, data)
  assert.ok(after.loss < before.loss * 0.5, `loss ${before.loss} → ${after.loss}`)
  assert.ok(after.accuracy > 0.9, `accuracy ${after.accuracy}`)
})
