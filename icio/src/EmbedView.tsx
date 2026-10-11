/**
 * Embed route: one figure, no masthead, no tabs, no footer.
 *
 * Also responsible for telling the parent page how tall the figure is, so the host can size
 * the iframe without either side guessing. The measurement is posted to the parent's origin
 * only when the parent is an allowed host — an unknown parent gets no message at all.
 */

import { useEffect, useRef } from 'react'
import { Figure } from './components/Figure'
import { Chips, ControlRow, EconomyPicker, Select, ToggleGroup } from './components/controls'
import {
  CompareFigure,
  DecomposerFigure,
  GrowthFigure,
  IndustriesFigure,
  ServicesQuadrantFigure,
  WorldFigure,
} from './figures'
import { FOCUS_ECONOMIES, economyName } from './lib/derived'
import { economiesForYear } from './lib/data'
import { buildHash, buildEmbedHash, parseAllowedList, parseList, parseYear } from './lib/router'
import type { RouteName } from './lib/router'
import { projectedNote } from './lib/format'
import type { DashboardData } from './lib/types'

interface Props {
  data: DashboardData
  embed: string
  params: URLSearchParams
}

const EMBED_TITLES: Record<string, string> = {
  world: 'World manufacturing exports and domestic content',
  decomposer: 'Where the value in manufacturing exports comes from',
  compare: 'Manufacturing exports by source of value added',
  services: 'Services intensity against domestic self-supply',
  growth: 'Export growth in value against growth in volume',
  industries: 'Services content by manufacturing industry',
}

/** Where "open the full analysis" lands for each embed: the page that carries the same figure. */
const ROUTE_FOR_EMBED: Record<string, RouteName> = {
  world: 'overview',
  decomposer: 'overview',
  compare: 'economies',
  services: 'services',
  growth: 'growth',
  industries: 'industries',
}

export function EmbedView({ data, embed, params }: Props) {
  const years = data.metadata.coverage.years
  const year = parseYear(params.get('year'), years, 2022)
  const allowedEconomies = economiesForYear(data, year)
  const requested = parseList(params.get('economies'))
  const defaultEconomies = FOCUS_ECONOMIES.filter((code) => allowedEconomies.includes(code))
  const economies = parseAllowedList(
    params.get('economies'),
    allowedEconomies,
    defaultEconomies.length > 0 ? defaultEconomies : allowedEconomies,
    8,
  )
  const requestedEconomy = params.get('economy')?.toUpperCase() ?? ''
  const economy = allowedEconomies.includes(requestedEconomy)
    ? requestedEconomy
    : economies[0] ?? allowedEconomies[0] ?? 'MEX'
  const measure = params.get('measure') === 'share' ? 'share' : 'services'
  // `sort` remains in old links, but ranking is now always the selected measure.
  const sortKey = measure

  const setEmbedParams = (updates: Record<string, string | number | null | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined || value === '') next.delete(key)
      else next.set(key, String(value))
    }
    const nextHash = buildEmbedHash(embed, Object.fromEntries(next.entries()))
    if (window.location.hash !== nextHash) window.location.hash = nextHash
  }

  // Invalid URL selections are never allowed to remain as an apparently valid figure state.
  // Keep the useful valid subset, or remove the parameter so the visible default is explicit.
  useEffect(() => {
    const updates: Record<string, string | number | null> = {}
    const rawYear = params.get('year')
    if (params.has('year') && rawYear !== String(year)) updates.year = year
    const rawEconomies = params.get('economies')
    if (params.has('economies')) {
      const valid = requested.filter((code) => allowedEconomies.includes(code)).slice(0, 8)
      if (valid.join(',') !== rawEconomies || valid.length === 0) updates.economies = valid.join(',') || null
    }
    if (embed === 'industries' && params.has('economy') && requestedEconomy !== economy) {
      updates.economy = economy
    }
    if (embed === 'industries' && params.has('sort') && params.get('sort') !== sortKey) updates.sort = sortKey
    if (embed === 'industries' && params.has('measure') && params.get('measure') !== measure) updates.measure = measure
    if (Object.keys(updates).length > 0) setEmbedParams(updates)
  }, [embed, params.toString(), allowedEconomies.join(','), requestedEconomy, economy])

  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    let last = 0
    const observer = new ResizeObserver(() => {
      const height = Math.ceil(element.getBoundingClientRect().height)
      if (height > 0 && height !== last) {
        last = height
        postHeight(height)
      }
    })
    observer.observe(element)
    const receiveMeasure = (event: MessageEvent) => {
      const origin = allowedOrigin()
      if (
        event.origin !== origin ||
        event.source !== window.parent ||
        event.data?.type !== 'econlab:measure'
      ) return
      postHeight(Math.ceil(element.getBoundingClientRect().height))
    }
    window.addEventListener('message', receiveMeasure)
    return () => {
      observer.disconnect()
      window.removeEventListener('message', receiveMeasure)
    }
  }, [embed, year, economies.join(','), economy, sortKey, measure])

  const fullParams = embed === 'world'
    ? {}
    : embed === 'industries'
      ? { year, focus: economy, sort: sortKey, measure }
      : embed === 'services'
        ? { year, economies: economies.join(','), focus: economy }
        : { year, economies: economies.join(',') }
  const fullHash = buildHash(ROUTE_FOR_EMBED[embed] ?? 'overview', fullParams)

  const yearControl = embed === 'world' ? null : (
    <Select
      label="Year"
      value={year}
      options={years.map((value) => ({
        value,
        label: projectedNote(value, data.metadata.coverage.projected_years.includes(value)),
      }))}
      onChange={(value) => setEmbedParams({ year: value })}
      hint={data.metadata.coverage.projected_years.includes(year) ? 'projected' : undefined}
    />
  )
  const compareControl = ['decomposer', 'compare', 'services'].includes(embed) ? (
    <details className="picker">
      <summary>
        Choose economies <span className="picker-count">({economies.length} of 8)</span>
      </summary>
      <Chips
        label="Economies"
        values={allowedEconomies.map((code) => ({ value: code, label: economyName(data, code) }))}
        selected={economies}
        onToggle={(code) => {
          const next = economies.includes(code)
            ? economies.length > 1 ? economies.filter((entry) => entry !== code) : economies
            : [...economies, code].slice(-8)
          setEmbedParams({ economies: next.join(',') })
        }}
        max={8}
        min={1}
      />
    </details>
  ) : null
  const growthEconomyControl = embed === 'growth' ? (
    <EconomyPicker
      label="Economies"
      values={allowedEconomies.map((code) => ({
        value: code,
        label: `${economyName(data, code)} (${code})`,
      }))}
      selected={economies}
      resetValues={defaultEconomies.length > 0 ? defaultEconomies : allowedEconomies}
      onChange={(values) => setEmbedParams({ economies: values.join(',') })}
      max={8}
    />
  ) : null
  const industryControls = embed === 'industries' ? (
    <>
      <Select
        label="Economy"
        value={economy}
        options={allowedEconomies.map((code) => ({ value: code, label: economyName(data, code) }))}
        onChange={(value) => setEmbedParams({ economy: value })}
      />
      <ToggleGroup
        label="Measure"
        value={measure}
        options={[
          { value: 'services', label: 'Services value' },
          { value: 'share', label: 'Services share of exports' },
        ]}
        onChange={(value) => setEmbedParams({ measure: value, sort: value })}
      />
    </>
  ) : null

  const growthControls = embed === 'growth' ? (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
        alignItems: 'start',
        gap: '18px',
      }}
    >
      {yearControl}
      {growthEconomyControl}
    </div>
  ) : null

  const controls = growthControls ?? (yearControl || compareControl || industryControls ? (
    <ControlRow>
      {yearControl}
      {compareControl}
      {growthEconomyControl}
      {industryControls}
    </ControlRow>
  ) : null)

  return (
    <div className="embed-root" ref={containerRef}>
      <Figure
        title={
          embed === 'growth'
            ? `Manufacturing export growth, 2016–${projectedNote(year, data.metadata.coverage.projected_years.includes(year))}`
            : embed === 'industries'
              ? 'Service inputs across manufacturing industries'
              : EMBED_TITLES[embed] ?? EMBED_TITLES.world!
        }
        source={false}
        controls={controls}
      >
        {embed === 'world' ? <WorldFigure data={data} /> : null}
        {embed === 'decomposer' ? (
          <DecomposerFigure data={data} year={year} economies={economies} />
        ) : null}
        {embed === 'compare' ? (
          <CompareFigure data={data} year={year} economies={economies} />
        ) : null}
        {embed === 'services' ? (
          <ServicesQuadrantFigure data={data} year={year} economies={economies} />
        ) : null}
        {embed === 'growth' ? (
          <GrowthFigure data={data} year={year} economies={economies} />
        ) : null}
        {embed === 'industries' ? (
          <IndustriesFigure data={data} year={year} economy={economy} measure={measure} />
        ) : null}
      </Figure>

      <p className="embed-footer">
        {embed !== 'world' && year >= (data.metadata.coverage.projected_years[0] ?? Infinity)
          ? `${year} is an OECD projection. `
          : ''}
        {embed === 'compare' || embed === 'decomposer'
          ? `Manufacturing exports shown: ${economies
              .map((code) => data.metadata.labels.economies[code] ?? code)
              .join(', ')}. `
          : ''}
        <a href={fullHash} target="_blank" rel="noreferrer">
          Open the full analysis ↗
        </a>
      </p>
    </div>
  )
}

/** Allowed parents for the resize handshake. Everything else gets silence, not an error. */
function allowedOrigin(): string | null {
  const referrer = document.referrer
  if (!referrer) return null
  try {
    const url = new URL(referrer)
    const appIsLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    const parentIsLocal = ['localhost', '127.0.0.1'].includes(url.hostname)
    const parentIsWebsite = url.hostname === 'mvaldez.de' || url.hostname === 'www.mvaldez.de'
    if ((appIsLocal && parentIsLocal) || (!appIsLocal && parentIsWebsite)) return url.origin
  } catch {
    return null
  }
  return null
}

function postHeight(height: number) {
  if (window.parent === window) return
  if (!Number.isFinite(height) || height < 100 || height > 10000) return
  const origin = allowedOrigin()
  if (!origin) return
  window.parent.postMessage({ type: 'econlab:resize', height }, origin)
}
