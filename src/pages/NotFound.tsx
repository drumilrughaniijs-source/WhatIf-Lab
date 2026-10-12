import { FlaskConicalOff } from 'lucide-react'
import { LinkButton } from '../components/ui'
import { href } from '../lib/router'

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 pt-24 text-center">
      <FlaskConicalOff size={40} className="text-fg-subtle" aria-hidden />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">What if this page existed?</h1>
      <p className="mt-2 text-fg-muted">It doesn’t. The link may be mistyped or the experiment may have moved.</p>
      <div className="mt-8 flex gap-2">
        <LinkButton href={href.explore()} variant="primary">
          Explore simulations
        </LinkButton>
        <LinkButton href={href.home()}>Go home</LinkButton>
      </div>
    </div>
  )
}
