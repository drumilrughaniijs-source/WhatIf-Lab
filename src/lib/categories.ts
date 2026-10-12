import { Atom, BrainCircuit, Cpu, Dices, Sigma, type LucideIcon } from 'lucide-react'

export type CategoryId = 'computing' | 'ai' | 'finance-math' | 'physics' | 'probability'

export interface Category {
  id: CategoryId
  name: string
  short: string
  blurb: string
  icon: LucideIcon
  /** UI accent (sliders, badges, icons). Not used for chart series. */
  accent: string
}

export const CATEGORIES: Category[] = [
  {
    id: 'computing',
    name: 'Computing',
    short: 'Computing',
    blurb: 'Memory, processors, algorithms and the cost of scale.',
    icon: Cpu,
    accent: '#22d3ee',
  },
  {
    id: 'ai',
    name: 'Artificial Intelligence',
    short: 'AI',
    blurb: 'Watch models learn, converge and occasionally fail.',
    icon: BrainCircuit,
    accent: '#a78bfa',
  },
  {
    id: 'finance-math',
    name: 'Finance and Mathematics',
    short: 'Finance & Math',
    blurb: 'Compounding, debt, series and the shape of functions.',
    icon: Sigma,
    accent: '#34d399',
  },
  {
    id: 'physics',
    name: 'Physics',
    short: 'Physics',
    blurb: 'Change the laws of motion and see what follows.',
    icon: Atom,
    accent: '#60a5fa',
  },
  {
    id: 'probability',
    name: 'Probability',
    short: 'Probability',
    blurb: 'Randomness, sampling and the law of large numbers.',
    icon: Dices,
    accent: '#e879f9',
  },
]

export const categoryById = (id: string): Category | undefined => CATEGORIES.find((c) => c.id === id)

export const LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const
export type Level = (typeof LEVELS)[number]
