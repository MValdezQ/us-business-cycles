/** Overview: composition first, with the existing time view folded below it. */

import { Figure } from '../components/Figure'
import { ControlRow, EconomyPicker, Select, ToggleGroup } from '../components/controls'
import { WorldFigure } from '../figures'
import { economiesForYear } from '../lib/data'
import {
  FOCUS_ECONOMIES,
  MAX_TREND_ECONOMIES,
  TREND_DEFAULT_ECONOMIES,
  economyName,
  mainCompositionBar,
  mainCompositionSegments,
} from '../lib/derived'
import type { MainCompositionBar } from '../lib/derived'
import { fmtPct, fmtUsd, projectedNote } from '../lib/format'
import { buildHash, parseAllowedList, parseList, parseYear } from '../lib/router'
import type { ViewProps } from '../lib/view'
import { useEffect } from 'react'

const MAX_MAIN_ECONOMIES = 6

function exactUsd(value: number): string {
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} million USD`
}

function OverviewCompositionChart({ bars, year }: { bars: MainCompositionBar[]; year: number }) {
  const segments = mainCompositionSegments()
  return (
    <div className="overview-stack" role="list" aria-label={`Six-part value-added composition in ${year}`}>
      {bars.map((bar) => {
        const positiveTotal = bar.available
          ? segments.reduce((sum, segment) => {
              const value = bar.values[segment.key]
              return sum + (value !== null && value > 0 ? value : 0)
            }, 0)
          : 0
        return (
          <div key={bar.key} className={`overview-stack-row${bar.available ? '' : ' is-unavailable'}`} role="listitem">
            <div className="overview-stack-label">
              <span className="overview-stack-label-main">{bar.label}</span>
              <span className="overview-stack-label-sub">
                {bar.available ? `Exports: ${fmtUsd(bar.denominator)}` : 'Composition unavailable'}
              </span>
            </div>
            <div
              className="overview-stack-track"
              aria-label={
                bar.available
                  ? `${bar.label}: six published components of ${exactUsd(bar.denominator!)}`
                  : `${bar.label}: composition unavailable for ${year}`
              }
            >
              {bar.available ? (
                segments.map((segment) => {
                  const value = bar.values[segment.key]
                  if (value === null || value <= 0 || positiveTotal <= 0) return null
                  const share = value / bar.denominator!
                  const width = (value / positiveTotal) * 100
                  const description = `${bar.label}: ${segment.label}, ${exactUsd(value)} of ${exactUsd(bar.denominator!)} (${fmtPct(share, 2)} of gross exports)`
                  return (
                    <span
                      key={segment.key}
                      className="overview-stack-segment"
                      style={{ width: `${width}%`, background: segment.colour }}
                      title={description}
                      aria-label={description}
                    />
                  )
                })
              ) : (
                <span className="overview-stack-unavailable">Unavailable for this country-year</span>
              )}
            </div>
            <div className="overview-stack-total">{bar.available ? fmtUsd(bar.denominator) : 'Unavailable'}</div>
          </div>
        )
      })}
    </div>
  )
}

export function OverviewView({ data, params, setParams }: ViewProps) {
  const years = data.metadata.coverage.years
  const year = parseYear(params.get('year'), years, 2022)
  const projectedFrom = data.metadata.coverage.projected_years[0] ?? null
  const mainAllowed = economiesForYear(data, year)
  const mainDefaults = FOCUS_ECONOMIES.filter((code) => mainAllowed.includes(code))
  const mainEconomies = parseAllowedList(
    params.get('economies'),
    mainAllowed,
    mainDefaults.length > 0 ? mainDefaults : mainAllowed,
    MAX_MAIN_ECONOMIES,
  )
  const trendAllowed = economiesForYear(data, years[0] ?? 2016)
  const trendDefaults = TREND_DEFAULT_ECONOMIES.filter((code) => trendAllowed.includes(code))
  const trendEconomies = parseAllowedList(
    params.get('trend_economies'),
    trendAllowed,
    trendDefaults.length > 0 ? trendDefaults : trendAllowed,
    MAX_TREND_ECONOMIES,
  )
  const trendMeasure = params.get('trend_measure') === 'level' ? 'level' : 'index'

  useEffect(() => {
    const updates: Record<string, string | null> = {}
    if (params.has('economies')) {
      const valid = parseList(params.get('economies'))
        .filter((code) => mainAllowed.includes(code))
        .slice(0, MAX_MAIN_ECONOMIES)
      const canonical = valid.join(',')
      if (canonical !== params.get('economies')) updates.economies = canonical || null
    }
    if (params.has('trend_economies')) {
      const valid = parseList(params.get('trend_economies'))
        .filter((code) => trendAllowed.includes(code))
        .slice(0, MAX_TREND_ECONOMIES)
      const raw = params.get('trend_economies')
      if (valid.length === 0) updates.trend_economies = null
      else if (valid.join(',') !== raw) updates.trend_economies = valid.join(',')
    }
    if (params.has('trend_measure') && params.get('trend_measure') !== trendMeasure) {
      updates.trend_measure = trendMeasure
    }
    if (Object.keys(updates).length > 0) setParams(updates)
  }, [
    mainAllowed.join(','),
    params.toString(),
    trendAllowed.join(','),
    trendMeasure,
    setParams,
  ])

  const mainBars = mainEconomies.map((code) => mainCompositionBar(data, code, year))
  const preserved = { year, economies: mainEconomies.join(',') }

  return (
    <>
      <section className="prose overview-intro">
        <p>
          Manufacturing exports contain value produced by many industries, at home and abroad. Explore their composition across countries, with particular attention to service inputs.
        </p>
      </section>

      <Figure
        title="Value added in manufacturing exports"
        lede="Six published components show where the value in each country’s manufacturing exports was produced."
        controls={
          <div className="overview-main-controls">
            <ControlRow>
              <Select
                label="Year"
                value={year}
                options={years.map((y) => ({
                  value: y,
                  label: projectedNote(y, data.metadata.coverage.projected_years.includes(y)),
                }))}
                onChange={(value) => setParams({ year: value })}
                hint={projectedFrom !== null && year >= projectedFrom ? 'projected' : undefined}
              />
              <EconomyPicker
                label="Countries"
                values={mainAllowed.map((code) => ({
                  value: code,
                  label: `${economyName(data, code)} (${code})`,
                }))}
                selected={mainEconomies}
                resetValues={mainDefaults.length > 0 ? mainDefaults : mainAllowed}
                onChange={(values) => setParams({ economies: values.join(',') })}
                max={MAX_MAIN_ECONOMIES}
                resetLabel="Reset to six focus countries"
              />
            </ControlRow>
          </div>
        }
        note={
          <>
            Shares use published gross exports as the denominator. Manufacturing and services are
            basic-price value added; domestic and foreign net taxes on products appear only in
            their respective other-content segments. Small closure differences from published
            component rounding are normalized in the bar geometry. Projected years are marked.
          </>
        }
      >
        <OverviewCompositionChart bars={mainBars} year={year} />
        <div className="legend overview-stack-legend">
          {mainCompositionSegments().map((segment) => (
            <span key={segment.key} className="legend-item">
              <span className="legend-swatch" style={{ background: segment.colour }} />
              {segment.label}
            </span>
          ))}
          <span className="legend-note">Other content includes agriculture, mining, utilities, construction, and the relevant net taxes.</span>
        </div>
      </Figure>

      <section className="next-steps" aria-label="Continue exploring">
        <a className="next-step" href={buildHash('economies', preserved)}>
          <span className="next-step-kicker">Compare economies</span>
          <strong>See all 80 economies</strong>
          <span>Rank export size, domestic share, foreign share, and services content.</span>
        </a>
        <a className="next-step" href={buildHash('services', { ...preserved, focus: mainEconomies[0] })}>
          <span className="next-step-kicker">Explore service inputs</span>
          <strong>Intensity versus domestic supply</strong>
          <span>See how much service input manufacturing exports carry and where it was produced.</span>
        </a>
        <a className="next-step" href={buildHash('growth', preserved)}>
          <span className="next-step-kicker">Compare value and volume</span>
          <strong>Price-adjusted growth</strong>
          <span>Separate current-price export growth from the chain-linked volume measure.</span>
        </a>
      </section>

      <details className="overview-trend-details">
        <summary>Changes over time</summary>
        <Figure
          title="Manufacturing exports and domestic content over time"
          lede="Use the controls to compare nominal export paths and domestic value added shares."
          source={false}
          controls={
            <ControlRow>
              <EconomyPicker
                label="Comparison countries"
                values={trendAllowed.map((code) => ({
                  value: code,
                  label: `${economyName(data, code)} (${code})`,
                }))}
                selected={trendEconomies}
                resetValues={trendDefaults.length > 0 ? trendDefaults : trendAllowed}
                onChange={(values) => setParams({ trend_economies: values.join(',') })}
                max={MAX_TREND_ECONOMIES}
                resetLabel="Reset to three comparison countries"
              />
              <ToggleGroup
                label="Export plot"
                value={trendMeasure}
                options={[
                  { value: 'index', label: 'Index (2016 = 100)' },
                  { value: 'level', label: 'USD levels' },
                ]}
                onChange={(value) => setParams({ trend_measure: value })}
              />
            </ControlRow>
          }
          note={
            <>
              The world series remains in both plots as the reference. USD levels are current
              prices, not a volume measure. Projected years are shaded and labelled.
            </>
          }
        >
          <WorldFigure data={data} economies={trendEconomies} measure={trendMeasure} />
        </Figure>
      </details>
    </>
  )
}
