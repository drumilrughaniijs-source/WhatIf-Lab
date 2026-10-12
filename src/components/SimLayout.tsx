import type { ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Panel } from './ui'

/**
 * Standard two-column simulation layout: controls on the left (sticky on
 * desktop), visualisation + readouts on the right. Stacks on mobile.
 */
export function SimLayout({
  controls,
  stats,
  children,
  insight,
  controlsTitle = 'Parameters',
}: {
  controls: ReactNode
  stats?: ReactNode
  children: ReactNode
  insight?: ReactNode
  controlsTitle?: string
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-20 lg:self-start">
        <Panel title={controlsTitle} icon={<SlidersHorizontal size={15} className="text-fg-subtle" />}>
          {controls}
        </Panel>
      </div>
      <div className="min-w-0 space-y-5">
        {stats}
        {children}
        {insight}
      </div>
    </div>
  )
}
