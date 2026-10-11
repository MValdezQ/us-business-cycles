/**
 * Overview: the world picture, then the anchor figure.
 *
 * The sequence is deliberate — establish the global trend, then show that the interesting
 * variation is in the composition of a country's exports, not in their size.
 */

import { StackLegend, StackedBarChart } from '../charts/StackedBarChart'
import type { StackBar, StackSegment } from '../charts/StackedBarChart'
import { TimeSeriesChart, type TimeSeries } from '../charts/TimeSeriesChart'
import { Figure } from '../components/Figure'
import { ControlRow, Select } from '../components/controls'
import { groupColour } from '../lib/chart-utils'
import { countryIndex } from '../lib/data'
import {
  FOCUS_ECONOMIES,
  decompositionBar,
  decompositionSegments,
  economyName,
} from '../lib/derived'
import { fmtUsd, fmtPct, projectedNote } from '../lib/format'
import { parseList, parseYear } from '../lib/router'
import type { ViewProps } from '../lib/view'

export function OverviewView({ data, params, setParams }: ViewProps) {
  const years = data.metadata.coverage.years
  const year = parseYear(params.get('year'), years, 2022)
  const selected = parseList(params.get('economies'))
  const economies = selected.length > 0 ? selected : FOCUS_ECONOMIES
  const projectedFrom = data.metadata.coverage.projected_years[0] ?? null

  const levelSeries: TimeSeries[] = [
    {
      key: 'mfg_exports',
      label: 'World manufacturing exports',
      colour: groupColour('manufacturing'),
      values: data.world.mfg_exports,
      dashed: false,
    },
  ]

  const domesticShareSeries: TimeSeries[] = [
    {
      key: 'dva',
      label: 'Domestic content',
      colour: groupColour('manufacturing'),
      values: data.world.dva_share_incl_tax,
    },
  ]

  const segments: StackSegment[] = decompositionSegments(data)
  const bars: StackBar[] = economies
    .map((code) => decompositionBar(data, code, year))
    .filter((bar): bar is StackBar => bar !== null)

  // A compact legend: six domestic groups, six foreign groups and taxes is too many swatches
  // to read at a glance, so the anchor figure groups them into the three things that matter.
  const summarySegments: StackSegment[] = [
    { key: 'domestic', label: 'Domestic value added (incl. domestic taxes)', colour: groupColour('manufacturing') },
    { key: 'foreign', label: 'Foreign value added (incl. foreign taxes)', colour: groupColour('services') },
  ]

  const summaryBars: StackBar[] = economies.map((code) => {
    const full = decompositionBar(data, code, year)
    const i = countryIndex(data, code, year)
    const domestic = i < 0 ? null : data.country.dva_exports_incl_tax[i]
    const foreign = i < 0 ? null : data.country.fva_exports_incl_tax[i]
    return {
      key: code,
      label: economyName(data, code),
      values: { domestic: domestic ?? null, foreign: foreign ?? null },
      totalText: full?.totalText,
    }
  })

  const worldShare = data.world.dva_share_incl_tax[years.indexOf(year)] ?? null
  const firstYear = years[0]!
  const lastYear = years[years.length - 1]!
  const firstWorldShare = data.world.dva_share_incl_tax[0] ?? null
  const lastWorldShare = data.world.dva_share_incl_tax[years.length - 1] ?? null
  const endpointText = (share: number | null) =>
    share === null ? 'not available' : `${fmtPct(share, 1)} domestic, ${fmtPct(1 - share, 1)} foreign`

  return (
    <>
      <section className="prose">
        <h2>Manufactured exports are often a team effort</h2>
        <p>
          A manufactured export often brings together people and firms in several countries.
          Each step contributes a portion of the value, from inputs and design to transport and
          finance. The ICIO tables trace those portions back to source industries and separate
          domestic from foreign value added.
        </p>
        <p>
          The focus here is the <em>mix</em>: how much export value was created domestically and
          how much came from abroad.
        </p>
      </section>

      <Figure
        title="World manufacturing exports and domestic content"
        lede="The level series shows the value of world manufacturing exports. The percentage line shows the domestic share of that value."
        note={
          <>
            The shaded 2023&ndash;2024 interval is labelled OECD projections, not observations.
            Foreign content is the complement of domestic content. {firstYear}:{' '}
            {endpointText(firstWorldShare)}; {lastYear}: {endpointText(lastWorldShare)}.
          </>
        }
      >
        <TimeSeriesChart
          years={years}
          series={levelSeries}
          mode="line"
          format={fmtUsd}
          ariaLabel="World manufacturing exports by year"
          projectedFrom={projectedFrom}
          fromZero
          yLabel="Manufacturing exports"
        />
        <TimeSeriesChart
          years={years}
            series={domesticShareSeries}
            mode="line"
          format={(value) => fmtPct(value, 0)}
            ariaLabel="Domestic content percentage of world manufacturing exports by year"
          projectedFrom={projectedFrom}
          yLabel="Share of export value"
          yDomain={[0, 1]}
          height={220}
        />
      </Figure>

      <Figure
        title="Manufacturing exports by source of value added"
        lede="Each bar splits manufacturing export value between domestic and foreign sources. Both include net taxes on products, matching the OECD tax-inclusive convention."
        controls={
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
          </ControlRow>
        }
        note={
          <>
            Read this as composition, not as level: every bar is a full 100% of that
            country&rsquo;s export value, and the number on the right is the size of the
            exports being divided. In {year} the world domestic share was{' '}
            {worldShare === null ? 'not available' : fmtPct(worldShare, 1)}.
          </>
        }
      >
        <StackedBarChart
          bars={summaryBars}
          segments={summarySegments}
          mode="share"
          format={fmtUsd}
          ariaLabel={`Domestic and foreign value added in manufacturing exports, ${year}`}
          labelWidth={170}
        />
        <StackLegend
          segments={summarySegments}
          note="Taxes less subsidies on products are folded into the domestic and foreign halves here. The full sector split is on the Economies page."
        />
        <details className="details">
          <summary>Show the full sector breakdown</summary>
          <StackedBarChart
            bars={bars}
            segments={segments}
            mode="share"
            format={fmtUsd}
            ariaLabel={`Manufacturing export value by source sector, ${year}`}
            labelWidth={170}
          />
          <StackLegend segments={segments} />
        </details>
      </Figure>

      <section className="prose">
        <h2>What to look for</h2>
        <p>
          Manufacturing exports carry <em>services</em> value from distribution, transport,
          finance, and professional work. The{' '}
          <a href="#/services">services page</a> plots that against how much of it each country
          supplies itself.
        </p>
        <p>
          These are current-price values, so a rise in exports need not mean more physical output.
          The <a href="#/growth">prices versus volume page</a> separates price effects from the
          chain-linked volume measure.
        </p>
      </section>
    </>
  )
}
