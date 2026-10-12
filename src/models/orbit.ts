/**
 * Two-body gravity in astronomical units.
 *   distance: AU · time: years · mass: solar masses → G·M☉ = 4π² AU³/yr²
 *
 * Integrated with velocity Verlet (kick–drift–kick), a symplectic method:
 *   v ← v + a(x)·dt/2
 *   x ← x + v·dt
 *   v ← v + a(x)·dt/2
 * It conserves energy well over long runs, unlike forward Euler.
 */

export const G = 4 * Math.PI ** 2
export const STAR_MASS = 1
export const COLLISION_RADIUS = 0.02 // AU; far larger than real radii but keeps dt stable

export interface Body {
  x: number
  y: number
  vx: number
  vy: number
  ax: number
  ay: number
  m: number
}

export interface OrbitState {
  star: Body
  planet: Body
  t: number
}

export interface OrbitInput {
  /** Initial separation (AU). */
  distance: number
  /** Initial relative speed, perpendicular to the separation (AU/yr). */
  speed: number
  /** Companion mass relative to the star. */
  massRatio: number
}

function accelerate(s: OrbitState) {
  const dx = s.planet.x - s.star.x
  const dy = s.planet.y - s.star.y
  const r2 = dx * dx + dy * dy
  const inv = G / (r2 * Math.sqrt(r2))
  s.star.ax = inv * s.planet.m * dx
  s.star.ay = inv * s.planet.m * dy
  s.planet.ax = -inv * s.star.m * dx
  s.planet.ay = -inv * s.star.m * dy
}

/** Both bodies start on the x-axis in the centre-of-mass frame. */
export function initialState({ distance, speed, massRatio }: OrbitInput): OrbitState {
  const m1 = STAR_MASS
  const m2 = STAR_MASS * massRatio
  const M = m1 + m2
  const s: OrbitState = {
    star: { x: (-m2 / M) * distance, y: 0, vx: 0, vy: (-m2 / M) * speed, ax: 0, ay: 0, m: m1 },
    planet: { x: (m1 / M) * distance, y: 0, vx: 0, vy: (m1 / M) * speed, ax: 0, ay: 0, m: m2 },
    t: 0,
  }
  accelerate(s)
  return s
}

export function step(s: OrbitState, dt: number) {
  for (const b of [s.star, s.planet]) {
    b.vx += 0.5 * b.ax * dt
    b.vy += 0.5 * b.ay * dt
    b.x += b.vx * dt
    b.y += b.vy * dt
  }
  accelerate(s)
  for (const b of [s.star, s.planet]) {
    b.vx += 0.5 * b.ax * dt
    b.vy += 0.5 * b.ay * dt
  }
  s.t += dt
}

export function separation(s: OrbitState) {
  return Math.hypot(s.planet.x - s.star.x, s.planet.y - s.star.y)
}

export function totalEnergy(s: OrbitState) {
  const ke = 0.5 * s.star.m * (s.star.vx ** 2 + s.star.vy ** 2) + 0.5 * s.planet.m * (s.planet.vx ** 2 + s.planet.vy ** 2)
  return ke - (G * s.star.m * s.planet.m) / separation(s)
}

export type OrbitKind = 'circular' | 'elliptical' | 'parabolic' | 'hyperbolic' | 'radial'

export interface Elements {
  mu: number
  energy: number
  eccentricity: number
  semiMajorAxis: number | null
  periodYears: number | null
  periapsis: number
  apoapsis: number | null
  kind: OrbitKind
}

/** Analytic orbit of the relative motion, from the initial conditions. */
export function elements({ distance: r, speed: v, massRatio }: OrbitInput): Elements {
  const mu = G * STAR_MASS * (1 + massRatio)
  const energy = (v * v) / 2 - mu / r
  const h = r * v
  const eccentricity = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (mu * mu)))
  if (v === 0) return { mu, energy, eccentricity: 1, semiMajorAxis: r / 2, periodYears: null, periapsis: 0, apoapsis: r, kind: 'radial' }
  if (energy < 0) {
    const a = -mu / (2 * energy)
    return {
      mu,
      energy,
      eccentricity,
      semiMajorAxis: a,
      periodYears: 2 * Math.PI * Math.sqrt(a ** 3 / mu),
      periapsis: a * (1 - eccentricity),
      apoapsis: a * (1 + eccentricity),
      kind: eccentricity < 0.02 ? 'circular' : 'elliptical',
    }
  }
  const periapsis = (h * h) / (mu * (1 + eccentricity))
  return {
    mu,
    energy,
    eccentricity,
    semiMajorAxis: null,
    periodYears: null,
    periapsis,
    apoapsis: null,
    kind: Math.abs(eccentricity - 1) < 0.005 ? 'parabolic' : 'hyperbolic',
  }
}

export const circularSpeed = (r: number, massRatio: number) => Math.sqrt((G * STAR_MASS * (1 + massRatio)) / r)
export const escapeSpeed = (r: number, massRatio: number) => Math.sqrt((2 * G * STAR_MASS * (1 + massRatio)) / r)
