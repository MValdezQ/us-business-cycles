/**
 * App shell: hash routing, data loading, and the shared masthead.
 *
 * Selection lives in the URL rather than in component state, so every view is linkable and an
 * embedded figure can hand the reader a deep link into the full analysis at the same year,
 * economies and industry they were already looking at.
 */

import { useEffect, useMemo, useState } from 'react'
import { EmbedView } from './EmbedView'
import { loadDashboardData } from './lib/data'
import { buildHash, parseHash, ROUTES } from './lib/router'
import type { RouteInfo } from './lib/router'
import type { DashboardData } from './lib/types'
import { EconomiesView } from './views/EconomiesView'
import { GrowthView } from './views/GrowthView'
import { IndustriesView } from './views/IndustriesView'
import { MethodView } from './views/MethodView'
import { OverviewView } from './views/OverviewView'
import { ServicesView } from './views/ServicesView'
import type { ViewProps } from './lib/view'

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [route, setRoute] = useState<RouteInfo>(() => parseHash(window.location.hash))

  useEffect(() => {
    const controller = new AbortController()
    loadDashboardData(controller.signal)
      .then(setData)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof Error ? cause.message : String(cause))
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const setParams = useMemo(
    () => (updates: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(route.params)
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === '') next.delete(key)
        else next.set(key, String(value))
      }
      const query = next.toString()
      const base = ROUTES.find((entry) => entry.name === route.route)?.hash ?? '#/'
      window.location.hash = query ? `${base}?${query}` : base
    },
    [route],
  )

  if (error) {
    return (
      <main className="app-shell">
        <div className="panel error-panel">
          <h1>The data did not load</h1>
          <p>{error}</p>
          <p>
            This site is a static bundle. It expects the published data files to sit next to
            <code> index.html</code> under <code>data/</code>. If you opened the file directly
            from disk, the browser will have blocked the request. Serve the folder over HTTP
            instead.
          </p>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="app-shell">
        <div className="panel">
          <p>Loading the ICIO indicators&hellip;</p>
        </div>
      </main>
    )
  }

  if (route.embed) {
    return <EmbedView data={data} embed={route.embed} params={route.params} />
  }

  const viewProps: ViewProps = { data, params: route.params, setParams }

  return (
    <main className="app-shell">
      <header className="masthead">
        <div>
          <h1>Manufacturing Export Content</h1>
          <p className="subtitle">
            Domestic, foreign, and services content in manufacturing exports, from the OECD ICIO
            tables.
          </p>
        </div>
        <div className="badges">
          <span className="badge">OECD ICIO, 2026 release</span>
          <span className="badge">
            {data.metadata.coverage.years[0]}&ndash;
            {data.metadata.coverage.years[data.metadata.coverage.years.length - 1]}
          </span>
          <span className="badge">{data.metadata.coverage.economies} economies</span>
        </div>
      </header>

      <p className="figure-note" role="note">
        Working draft: analysis and presentation subject to revision.
      </p>

      <nav className="tabs" aria-label="Sections">
        {ROUTES.map((entry) => (
          <a
            key={entry.name}
            href={buildHash(entry.name, {})}
            className={`tab${entry.name === route.route ? ' is-active' : ''}`}
            aria-current={entry.name === route.route ? 'page' : undefined}
          >
            {entry.label}
          </a>
        ))}
      </nav>

      <div className="view">
        {route.route === 'overview' ? <OverviewView {...viewProps} /> : null}
        {route.route === 'economies' ? <EconomiesView {...viewProps} /> : null}
        {route.route === 'services' ? <ServicesView {...viewProps} /> : null}
        {route.route === 'growth' ? <GrowthView {...viewProps} /> : null}
        {route.route === 'industries' ? <IndustriesView {...viewProps} /> : null}
        {route.route === 'method' ? <MethodView {...viewProps} /> : null}
      </div>

      <footer className="footer">
        <p>{data.metadata.attribution}</p>
        <p className="footer-note">
          Value added is attributed by where production happened, not by firm ownership. 2023
          and 2024 are OECD projections. All values are current prices in US dollars unless a
          figure says otherwise.
        </p>
          <p className="footer-note">
            Indicator definitions and known limitations are on the{' '}
            <a href="#/method">method page</a>.
          </p>
      </footer>
    </main>
  )
}
