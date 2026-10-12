/** Mulberry32: small, fast, seedable PRNG so simulations are reproducible. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Standard normal sample via Box–Muller. */
export function gaussian(rand: () => number) {
  let u = 0
  while (u === 0) u = rand()
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export const newSeed = () => Math.floor(Math.random() * 1e9)

/**
 * Non-reproducible uniform [0, 1) source backed by the Web Crypto API
 * (falls back to Math.random). Values are buffered for speed.
 */
export function cryptoUniform(): () => number {
  const hasCrypto = typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
  if (!hasCrypto) return Math.random
  const buf = new Uint32Array(4096)
  let i = buf.length
  return () => {
    if (i >= buf.length) {
      crypto.getRandomValues(buf)
      i = 0
    }
    return buf[i++] / 4294967296
  }
}
