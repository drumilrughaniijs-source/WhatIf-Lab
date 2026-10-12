import { Code2, Cpu, GraduationCap, Lock } from 'lucide-react'
import { Callout, LinkButton } from '../components/ui'
import { href } from '../lib/router'

const PRINCIPLES = [
  {
    icon: GraduationCap,
    title: 'Learn by experimenting',
    text: 'Every simulation starts from a question you can answer by changing one variable and watching what happens.',
  },
  {
    icon: Cpu,
    title: 'Real calculations',
    text: 'Physics is numerically integrated, the neural network is trained with real backpropagation, and finance uses exact compounding. The core models are covered by automated tests.',
  },
  {
    icon: Lock,
    title: 'Private by design',
    text: 'There is no backend, database, account, analytics or API key. Saved experiments live only in your browser’s local storage.',
  },
  {
    icon: Code2,
    title: 'Open web technology',
    text: 'Built with React, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts and Lucide. It deploys as a plain static site.',
  },
]

export function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-brand uppercase">About</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">A laboratory for curiosity</h1>
      <p className="mt-5 text-[15px] leading-relaxed text-fg-muted">
        WhatIf Lab turns abstract ideas into experiments you can run. What if your computer ran out of memory? What if a planet moved faster? What if you invested a decade earlier? Instead of reading the answer, you change the variable and see the result.
      </p>
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {PRINCIPLES.map((p) => (
          <div key={p.title} className="rounded-xl border border-white/[0.07] bg-ink-900 p-5">
            <p.icon size={18} className="text-brand" aria-hidden />
            <h2 className="mt-3 text-sm font-semibold">{p.title}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{p.text}</p>
          </div>
        ))}
      </div>
      <Callout kind="warn" className="mt-10" title="Models, not measurements">
        Every simulation is a simplified model with stated assumptions (see “Model & assumptions” on each experiment). Hardware results are simulated estimates, not benchmarks; nothing reads your device’s memory or processor. Finance projections are hypothetical, not guarantees or financial advice.
      </Callout>
      <h2 className="mt-10 text-sm font-semibold">Keyboard shortcuts</h2>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px] text-fg-muted">
        <dt>
          <kbd className="rounded border border-white/15 px-1.5 font-mono text-xs">/</kbd>
        </dt>
        <dd>Focus the search bar</dd>
        <dt>
          <kbd className="rounded border border-white/15 px-1.5 font-mono text-xs">↑ ↓</kbd> <kbd className="rounded border border-white/15 px-1.5 font-mono text-xs">Enter</kbd>
        </dt>
        <dd>Move through search results and open one</dd>
        <dt>
          <kbd className="rounded border border-white/15 px-1.5 font-mono text-xs">← →</kbd>
        </dt>
        <dd>Adjust a focused slider or switch between options</dd>
        <dt>
          <kbd className="rounded border border-white/15 px-1.5 font-mono text-xs">Esc</kbd>
        </dt>
        <dd>Close dialogs, menus and search</dd>
      </dl>
      <LinkButton href={href.explore()} variant="primary" className="mt-10">
        Browse the simulations
      </LinkButton>
    </div>
  )
}
