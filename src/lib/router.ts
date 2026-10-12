import { useEffect, useState } from 'react'

/**
 * Tiny hash router. Hash URLs keep the site fully static: it works on any
 * file host (Vercel, Netlify, GitHub Pages) without server rewrite rules.
 */
export interface ExploreQuery {
  q?: string
  category?: string
  level?: string
  sort?: string
}

export type Route =
  | { name: 'home' }
  | ({ name: 'explore' } & ExploreQuery)
  | { name: 'sim'; id: string; restore?: string }
  | { name: 'saved' }
  | { name: 'about' }
  | { name: 'notfound' }

const ROUTE_EVENT = 'whatiflab:route'

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '').replace(/^\/+/, '')
  const [path, qs = ''] = raw.split('?')
  const [first, second] = path.split('/')
  const query = new URLSearchParams(qs)
  const get = (k: string) => query.get(k) ?? undefined
  if (!first) return { name: 'home' }
  if ((first === 'lab' || first === 'experiment') && second) return { name: 'sim', id: second, restore: get('restore') }
  // "/lab" was the explorer's original address; keep it working.
  if (first === 'explore' || first === 'lab')
    return { name: 'explore', q: get('q'), category: get('category'), level: get('level'), sort: get('sort') }
  if (first === 'saved') return { name: 'saved' }
  if (first === 'about') return { name: 'about' }
  return { name: 'notfound' }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash(window.location.hash))
      window.scrollTo({ top: 0 })
      // Move keyboard/screen-reader focus to the new page's content.
      requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }))
    }
    const onSilent = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    window.addEventListener(ROUTE_EVENT, onSilent)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener(ROUTE_EVENT, onSilent)
    }
  }, [])
  return route
}

export function navigate(to: string) {
  window.location.hash = to.replace(/^#/, '')
}

/** Update the URL without adding a history entry or scrolling (used by live filters). */
export function replaceHash(to: string) {
  if (window.location.hash === to) return
  window.history.replaceState(null, '', to)
  window.dispatchEvent(new Event(ROUTE_EVENT))
}

function withQuery(path: string, params: Record<string, string | undefined>) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v)
  const s = q.toString()
  return s ? `${path}?${s}` : path
}

export const href = {
  home: () => '#/',
  explore: (query: ExploreQuery = {}) => withQuery('#/explore', { ...query }),
  sim: (id: string, restore?: string) => withQuery(`#/lab/${id}`, { restore }),
  saved: () => '#/saved',
  about: () => '#/about',
}
