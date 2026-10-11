/**
 * Self-contained figure components used by the article embeds.
 *
 * The main pages build their figures inline so they can carry their own framing. Embeds need
 * a single figure with no page around it, so the same chart wiring is repeated here. Both
 * sides read every number through the shared helpers in `lib/`, so the two can never show
 * different values — only different amounts of surrounding text.
 */

import { useMemo } from 'react'
import {
  GroupedBarChart,
  GroupedBarLegend,
  growthDomain,
  growthRows,
} from './charts/GroupedBarChart'
import { ScatterPlot, type ScatterPoint } from './charts/ScatterPlot'
import { StackLegend, StackedBarChart, type StackBar } from './charts/StackedBarChart'
import { TimeSeriesChart, type TimeSeries } from './charts/TimeSeriesChart'
import { economyColour, groupColour, tint } from './lib/chart-utils'
import { countryIndex, economiesForYear, industryRows } from './lib/data'
import {
  decompositionBar,
  decompositionSegments,
  economyName,
  industryName,
  latestObservedWorld,
  TREND_DEFAULT_ECONOMIES,
  type TrendMeasure,
  worldTrendSeries,
} from './lib/derived'
import { fmtPct, fmtSignedPct, fmtUsd } from './lib/format'
import type { DashboardData } from './lib/types'

const SOURCE =
  'Source: OECD Inter-Country Input-Output tables, 2026 release; author\u2019s calculations.'

export function WorldFigure({
  data,
  economies = TREND_DEFAULT_ECONOMIES,
  measure = 'index',
}: {
  data: DashboardData
  economies?: string[]
  measure?: TrendMeasure
}) {
  const years = data.metadata.coverage.years
  const projectedFrom = data.metadata.coverage.projected_years[0] ?? null
  const level: TimeSeries[] = worldTrendSeries(data, economies, measure)
  const domesticShare: TimeSeries[] = worldTrendSeries(data, economies, 'share')
  const latestObserved = latestObservedWorld(data)
  const latestHeadline =
    latestObserved.value === null
      ? 'not available'
      : `$${(latestObserved.value / 1_000_000).toFixed(2)}tn`
  return (
    <>
      <p className="current-price-callout">CURRENT PRICES · NOT VOLUME</p>
      <p className="figure-note world-headline">
        World manufacturing exports were {latestHeadline} in {latestObserved.year}, the latest
        observed year in this release.
      </p>
      <section className="world-plot" aria-label="Nominal manufacturing export trend">
        <h4>{measure === 'index' ? 'Nominal export value index (2016 = 100)' : 'Nominal export value levels'}</h4>
        <TimeSeriesChart
          years={years}
          series={level}
          mode="line"
          format={measure === 'index' ? (value) => `${value.toFixed(0)}` : fmtUsd}
          ariaLabel={`${measure === 'index' ? 'Nominal manufacturing export value index, 2016 equals 100' : 'Nominal manufacturing export value levels'} by year`}
          projectedFrom={projectedFrom}
          fromZero={measure === 'level'}
          height={220}
          yLabel={measure === 'index' ? '2016 = 100' : 'Million USD'}
        />
      </section>
      <section className="world-plot" aria-label="Domestic content trend">
        <h4>Domestic value added share of manufacturing exports</h4>
        <TimeSeriesChart
          years={years}
          series={domesticShare}
          mode="line"
          format={(value) => fmtPct(value, 0)}
          ariaLabel="Domestic value added percentage of manufacturing exports by country and world"
          projectedFrom={projectedFrom}
          yDomain={[0, 1]}
          height={220}
          yLabel="Share of export value"
        />
      </section>
      <p className="figure-note">
        Both plots are descriptive co-movements, not causal estimates. The shaded 2023&ndash;2024
        interval is labelled OECD projections, not observations. Domestic value added is the
        share produced in the exporting economy, including domestic net taxes on products.
        {measure === 'level' ? ' In USD levels, the world line sets the scale; the index view is better for comparing country paths.' : ''}
      </p>
      <p className="figure-source">{SOURCE}</p>
    </>
  )
}

export function DecomposerFigure({
  data,
  year,
  economies,
  compact = false,
}: {
  data: DashboardData
  year: number
  economies: string[]
  compact?: boolean
}) {
  const segments = decompositionSegments(data)
  const summary = [
    {
      key: 'domestic',
      label: 'Domestic value added',
      colour: groupColour('manufacturing'),
    },
    {
      key: 'foreign',
      label: 'Foreign value added',
      colour: groupColour('services'),
    },
  ]

  const bars: StackBar[] = economies.map((code) => {
    const i = countryIndex(data, code, year)
    return {
      key: code,
      label: economyName(data, code),
      values: {
        domestic: i < 0 ? null : data.country.dva_exports_incl_tax[i],
        foreign: i < 0 ? null : data.country.fva_exports_incl_tax[i],
      },
      totalText: fmtUsd(i < 0 ? null : data.country.mfg_exports[i]),
    }
  })

  const detailed: StackBar[] = economies
    .map((code) => decompositionBar(data, code, year))
    .filter((bar): bar is StackBar => bar !== null)

  return (
    <>
      <StackedBarChart
        bars={bars}
        segments={summary}
        mode="share"
        format={fmtUsd}
        ariaLabel={`Domestic and foreign value added in manufacturing exports, ${year}`}
        labelWidth={160}
      />
      <StackLegend segments={summary} note="Net taxes are included in both halves." />
      {compact ? null : (
        <details className="details">
          <summary>Full sector breakdown</summary>
          <StackedBarChart
            bars={detailed}
            segments={segments}
            mode="share"
            format={fmtUsd}
            ariaLabel={`Manufacturing export value by source sector, ${year}`}
            labelWidth={160}
          />
          <StackLegend segments={segments} />
        </details>
      )}
      <p className="figure-source">{SOURCE}</p>
    </>
  )
}

export function CompareFigure({
  data,
  year,
  economies,
}: {
  data: DashboardData
  year: number
  economies: string[]
}) {
  const segments = decompositionSegments(data)
  const bars = economies
    .map((code) => decompositionBar(data, code, year))
    .filter((bar): bar is StackBar => bar !== null)

  return (
    <>
      <StackedBarChart
        bars={bars}
        segments={segments}
        mode="share"
        format={fmtUsd}
        ariaLabel={`Manufacturing export value by source sector, ${year}`}
        labelWidth={160}
        barHeight={30}
      />
      <StackLegend
        segments={segments}
        note="Solid is domestic, lighter is the same sector abroad."
      />
      <p className="figure-source">{SOURCE}</p>
    </>
  )
}

export function ServicesQuadrantFigure({
  data,
  year,
  economies,
}: {
  data: DashboardData
  year: number
  economies: string[]
}) {
  const { points, medianX, medianY } = useMemo(() => {
    const all = economiesForYear(data, year)
      .map((code) => {
        const i = countryIndex(data, code, year)
        if (i < 0) return null
        const x = data.country.services_share[i]
        const y = data.country.services_domestic_share[i]
        if (x === null || y === null) return null
        return { code, x, y }
      })
      .filter((entry): entry is { code: string; x: number; y: number } => entry !== null)

    const xs = all.map((e) => e.x).sort((a, b) => a - b)
    const ys = all.map((e) => e.y).sort((a, b) => a - b)
    const mid = (v: number[]) => (v.length ? v[Math.floor(v.length / 2)]! : 0)

    const points: ScatterPoint[] = all.map((entry) => {
      const index = economies.indexOf(entry.code)
      return {
        key: entry.code,
        label: economyName(data, entry.code),
        x: entry.x,
        y: entry.y,
        highlight: index >= 0,
        colour: index >= 0 ? economyColour(index) : undefined,
      }
    })
    return { points, medianX: mid(xs), medianY: mid(ys) }
  }, [data, year, economies])

  return (
    <>
      <ScatterPlot
        points={points}
        xLabel="Services share of manufacturing export value"
        yLabel="Share supplied domestically"
        xFormat={(value) => fmtPct(value, 0)}
        yFormat={(value) => fmtPct(value, 0)}
        ariaLabel={`Services intensity against domestic self-supply, ${year}`}
        quadrants={{ x: medianX, y: medianY }}
        height={340}
      />
      <p className="figure-note">
        Lines are the medians across the 80 economies in the table. The two axes measure
        different things: how much services value an export carries, and how much of it the
        country supplies itself.
      </p>
      <p className="figure-source">{SOURCE}</p>
    </>
  )
}

export function GrowthFigure({
  data,
  year,
  economies,
}: {
  data: DashboardData
  year: number
  economies: string[]
}) {
  const rows = growthRows(data, year, economies)

  return (
    <>
      <GroupedBarChart
        rows={rows}
        domain={growthDomain(rows)}
        formatValue={(value) => fmtSignedPct(value, 0)}
      />
      <GroupedBarLegend bars={rows[0]?.bars ?? []} />
      <p className="figure-note">
        Cumulative from 2016. Current-price growth combines price and volume changes; the
        chain-linked volume series uses previous-year prices. Volume is an index-based measure,
        not a literal count of physical units.
      </p>
      <p className="figure-source">{SOURCE}</p>
    </>
  )
}

export function IndustriesFigure({
  data,
  year,
  economy,
  measure = 'services',
}: {
  data: DashboardData
  year: number
  economy: string
  measure?: 'services' | 'share'
}) {
  const sortKey = measure === 'share' ? 'share' : 'services'
  const rows = useMemo(() => {
    const built = industryRows(data, economy, year)
      .map((i) => ({
        code: data.industry.industry[i]!,
        exports: data.industry.exports[i] ?? null,
        services: data.industry.services_total[i] ?? null,
        domestic: data.industry.services_domestic[i] ?? null,
        foreign: data.industry.services_foreign[i] ?? null,
        share: data.industry.services_share[i] ?? null,
        active: data.industry.active[i] === true,
      }))
      .filter(
        (row) =>
          row.active &&
          row.exports !== null &&
          row.exports > 0 &&
          (measure === 'share' ? row.share : row.services) !== null,
      )
    return built.sort((a, b) => {
      const aValue = a[sortKey]
      const bValue = b[sortKey]
      return (bValue ?? -Infinity) - (aValue ?? -Infinity)
    })
  }, [data, economy, measure, sortKey, year])

  const segments = [
    { key: 'domestic', label: 'Domestic services', colour: groupColour('services') },
    { key: 'foreign', label: 'Foreign services', colour: tint(groupColour('services')) },
  ]

  const bars: StackBar[] = rows.map((row) => ({
    key: row.code,
    label: industryName(data, row.code),
    values: {
      domestic:
        measure === 'share'
          ? row.domestic !== null && row.exports !== null
            ? row.domestic / row.exports
            : null
          : row.domestic,
      foreign:
        measure === 'share'
          ? row.foreign !== null && row.exports !== null
            ? row.foreign / row.exports
            : null
          : row.foreign,
    },
    totalText: measure === 'share' ? fmtPct(row.share, 1) : fmtUsd(row.services),
  }))

  return (
    <>
      <StackedBarChart
        bars={bars}
        segments={segments}
        mode="level"
        format={measure === 'share' ? (value) => fmtPct(value, 1) : fmtUsd}
        ariaLabel={`${measure === 'share' ? 'Services share of exports' : 'Services value'} by manufacturing industry in ${economyName(data, economy)}, ${year}`}
        labelWidth={230}
        barHeight={20}
      />
      <StackLegend
        segments={segments}
        note={
          measure === 'share'
            ? 'Bar length is the services share of exports; colours split domestic and foreign service production.'
            : 'Bar length is services value, not export value.'
        }
      />
      <p className="figure-note">
        {economyName(data, economy)}&rsquo;s manufacturing industries, ranked by{' '}
        {measure === 'share' ? 'services share of exports' : 'services value'}.
      </p>
      <p className="figure-source">{SOURCE}</p>
    </>
  )
}
