/** Overview: country comparison first, then the existing composition anchor. */

import { StackLegend, StackedBarChart } from '../charts/StackedBarChart'
import type { StackBar, StackSegment } from '../charts/StackedBarChart'
import { Figure } from '../components/Figure'
import { ControlRow, EconomyPicker, Select, ToggleGroup } from '../components/controls'
import { WorldFigure } from '../figures'
import { groupColour } from '../lib/chart-utils'
import { countryIndex, economiesForYear } from '../lib/data'
import {
  FOCUS_ECONOMIES,
  MAX_TREND_ECONOMIES,
  TREND_DEFAULT_ECONOMIES,
  decompositionBar,
  decompositionSegments,
  economyName,
} from '../lib/derived'
import { fmtUsd, fmtPct, projectedNote } from '../lib/format'
import { parseAllowedList, parseList, parseYear } from '../lib/router'
import type { ViewProps } from '../lib/view'
import { useEffect } from 'react'

export function OverviewView({ data, params, setParams }: ViewProps) {
  const years = data.metadata.coverage.years
  const year = parseYear(params.get('year'), years, 2022)
  const projectedFrom = data.metadata.coverage.projected_years[0] ?? null
  const selected = parseList(params.get('economies'))
  const economies = selected.length > 0 ? selected : FOCUS_ECONOMIES
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
  }, [params.toString(), trendAllowed.join(','), trendMeasure, setParams])

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
        title="Compare manufacturing exports: current prices and domestic content"
        lede="Follow nominal export values for the world and up to four selected economies, then compare the domestic value added share. These are descriptive co-movements, not causal estimates."
        source={false}
        controls={
          <ControlRow>
            <EconomyPicker
              label="Comparison economies"
              values={trendAllowed.map((code) => ({
                value: code,
                label: `${economyName(data, code)} (${code})`,
              }))}
              selected={trendEconomies}
              resetValues={trendDefaults.length > 0 ? trendDefaults : trendAllowed}
              onChange={(values) => setParams({ trend_economies: values.join(',') })}
              max={MAX_TREND_ECONOMIES}
              resetLabel="Reset to three comparison economies"
            />
            <ToggleGroup
              label="First plot"
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
            The world series remains in both plots as the dark reference. The USD-level option is
            in current prices and is not a volume measure. The shaded 2023&ndash;2024 interval is
            labelled OECD projections, not observations.
          </>
        }
      >
        <WorldFigure data={data} economies={trendEconomies} measure={trendMeasure} />
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
