/**
 * CPU performance model: Amdahl's law extended with two sources of
 * diminishing returns. These are simulated estimates, not benchmarks.
 *
 *   f_all(N) = f × (1 − min(0.25, 0.004·(N − 1)))     all-core clock drops with active cores
 *   T_serial   = W·(1 − p) / (IPC · f)                 serial part on one core at full clock
 *   T_parallel = W·p / (IPC · f_all · N)               parallel part split evenly
 *   T_overhead = W·p · c·(N − 1) / (IPC · f_all)        synchronisation / communication cost
 *   T          = T_serial + T_parallel + T_overhead
 *   throughput = W / T
 */

export const IPC = 3 // instructions per cycle per core (assumed constant)
export const CLOCK_DROP_PER_CORE = 0.004
export const MAX_CLOCK_DROP = 0.25
export const SYNC_OVERHEAD = 0.0005

export interface CpuInput {
  ghz: number
  cores: number
  /** Total work, in billions of instructions. */
  workG: number
  /** Parallelisable fraction, 0–1. */
  parallel: number
}

export interface CpuResult {
  allCoreGHz: number
  serialS: number
  parallelS: number
  overheadS: number
  totalS: number
  /** Effective throughput in billions of instructions per second. */
  throughputGIPS: number
  /** Speed-up over a single core at the same base clock. */
  speedup: number
  /** speedup / cores. */
  efficiency: number
  /** Busy fraction of each core over the run (core 0 also runs the serial part). */
  coreUtilization: number[]
}

export function allCoreClock(ghz: number, cores: number) {
  return ghz * (1 - Math.min(MAX_CLOCK_DROP, CLOCK_DROP_PER_CORE * (cores - 1)))
}

export function simulateCpu({ ghz, cores, workG, parallel }: CpuInput): CpuResult {
  const N = Math.max(1, Math.round(cores))
  const p = Math.min(1, Math.max(0, parallel))
  const fAll = allCoreClock(ghz, N)
  const serialS = (workG * (1 - p)) / (IPC * ghz)
  const parallelS = (workG * p) / (IPC * fAll * N)
  const overheadS = N > 1 ? (workG * p * SYNC_OVERHEAD * (N - 1)) / (IPC * fAll) : 0
  const totalS = serialS + parallelS + overheadS
  const singleS = workG / (IPC * ghz)
  const speedup = singleS / totalS
  const coreUtilization = Array.from({ length: N }, (_, i) =>
    i === 0 ? 1 : totalS > 0 ? (parallelS + overheadS) / totalS : 0,
  )
  return {
    allCoreGHz: fAll,
    serialS,
    parallelS,
    overheadS,
    totalS,
    throughputGIPS: workG / totalS,
    speedup,
    efficiency: speedup / N,
    coreUtilization,
  }
}

/** Plain Amdahl speed-up with no clock drop or overhead, for comparison. */
export function amdahl(parallel: number, cores: number) {
  return 1 / (1 - parallel + parallel / cores)
}

/** Core count (1..maxCores) that minimises run time for this workload. */
export function bestCoreCount(input: Omit<CpuInput, 'cores'>, maxCores = 64) {
  let best = 1
  let bestT = Infinity
  for (let n = 1; n <= maxCores; n++) {
    const t = simulateCpu({ ...input, cores: n }).totalS
    if (t < bestT - 1e-12) {
      bestT = t
      best = n
    }
  }
  return best
}
