import { useEffect } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { AppShell } from './components/AppShell'
import { Toaster } from './components/ui'
import { useRoute, type Route } from './lib/router'
import { simById } from './sims/registry'
import { About } from './pages/About'
import { Explore } from './pages/Explore'
import { Home } from './pages/Home'
import { NotFound } from './pages/NotFound'
import { Saved } from './pages/Saved'
import { SimPage } from './pages/SimPage'

function routeKey(r: Route) {
  return r.name === 'sim' ? `sim-${r.id}` : r.name
}

function routeTitle(r: Route) {
  switch (r.name) {
    case 'home':
      return 'WhatIf Lab · Interactive simulations'
    case 'explore':
      return 'Explore simulations · WhatIf Lab'
    case 'sim':
      return `${simById(r.id)?.title ?? 'Not found'} · WhatIf Lab`
    case 'saved':
      return 'My Experiments · WhatIf Lab'
    case 'about':
      return 'About · WhatIf Lab'
    default:
      return 'Page not found · WhatIf Lab'
  }
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <Home />
    case 'explore':
      return <Explore q={route.q} category={route.category} level={route.level} sort={route.sort} />
    case 'sim':
      return <SimPage id={route.id} restore={route.restore} />
    case 'saved':
      return <Saved />
    case 'about':
      return <About />
    default:
      return <NotFound />
  }
}

export default function App() {
  const route = useRoute()
  useEffect(() => {
    document.title = routeTitle(route)
  }, [route])

  return (
    <MotionConfig reducedMotion="user">
      <AppShell route={route}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={routeKey(route)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <Page route={route} />
          </motion.div>
        </AnimatePresence>
      </AppShell>
      <Toaster />
    </MotionConfig>
  )
}
