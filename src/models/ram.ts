/**
 * RAM pressure model. A deliberately simple, documented model, not a
 * measurement of any real machine.
 *
 *   demand       = OS reserve + apps × memory per app
 *   used         = min(demand, capacity)
 *   overflow     = max(0, demand − capacity)          → paged out to swap
 *   utilisation  = demand / capacity                   (can exceed 100%)
 *
 * Responsiveness (1 = full speed):
 *   u ≤ 70%       1.0
 *   70% < u ≤ 100% 1 − 0.15·((u − 0.7)/0.3)²           (OS evicts file cache)
 *   u > 100%      0.85 × t_ram / EAT
 *                 EAT = (1 − p)·t_ram + p·t_swap,  p = HOT_SWAP_SHARE × overflow/demand
 */

export const OS_RESERVED_GB = 1.5
export const RAM_LATENCY_US = 0.1 // ~100 ns DRAM access
export const SWAP_LATENCY_US = { ssd: 80, hdd: 8000 } as const
/** Share of swapped-out memory that is still actively accessed (OS swaps cold pages first). */
export const HOT_SWAP_SHARE = 0.1
export const COMFORT_LIMIT = 0.7

export type SwapDevice = keyof typeof SWAP_LATENCY_US
export type Pressure = 'normal' | 'elevated' | 'high' | 'critical'

export interface RamInput {
  capacityGB: number
  perAppMB: number
  apps: number
  swap: SwapDevice
}

export interface RamResult {
  osGB: number
  appsGB: number
  demandGB: number
  usedGB: number
  availableGB: number
  overflowGB: number
  utilization: number
  pressure: Pressure
  /** Relative responsiveness, 0–1. */
  performance: number
  /** Probability that a memory access hits swapped-out memory. */
  faultShare: number
}

export function simulateRam({ capacityGB, perAppMB, apps, swap }: RamInput): RamResult {
  const appsGB = (apps * perAppMB) / 1024
  const demandGB = OS_RESERVED_GB + appsGB
  const usedGB = Math.min(demandGB, capacityGB)
  const availableGB = Math.max(0, capacityGB - demandGB)
  const overflowGB = Math.max(0, demandGB - capacityGB)
  const utilization = demandGB / capacityGB

  let performance = 1
  let faultShare = 0
  if (utilization > 1) {
    faultShare = HOT_SWAP_SHARE * (overflowGB / demandGB)
    const eat = (1 - faultShare) * RAM_LATENCY_US + faultShare * SWAP_LATENCY_US[swap]
    performance = 0.85 * (RAM_LATENCY_US / eat)
  } else if (utilization > COMFORT_LIMIT) {
    performance = 1 - 0.15 * ((utilization - COMFORT_LIMIT) / (1 - COMFORT_LIMIT)) ** 2
  }

  const pressure: Pressure =
    utilization > 1 ? 'critical' : utilization > 0.9 ? 'high' : utilization > COMFORT_LIMIT ? 'elevated' : 'normal'

  return { osGB: OS_RESERVED_GB, appsGB, demandGB, usedGB, availableGB, overflowGB, utilization, pressure, performance, faultShare }
}

/** Largest number of apps that fit without swapping. */
export function maxAppsWithoutSwap(capacityGB: number, perAppMB: number): number {
  return Math.max(0, Math.floor(((capacityGB - OS_RESERVED_GB) * 1024) / perAppMB))
}
