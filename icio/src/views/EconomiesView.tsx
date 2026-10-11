/**
 * Economies: where a country sits in the field, and what its own decomposition looks like.
 *
 * The figure is the same decomposer as the overview, but for all 80 economies and with the
 * level/share switch exposed, so a reader can see both "how big" and "how foreign".
 */

import { useMemo, useState } from 'react'
import { PieChart } from '../charts/PieChart'
import { StackLegend, StackedBarChart } from '../charts/StackedBarChart'
import type { StackBar } from '../charts/StackedBarChart'
import { Figure } from '../components/Figure'
import { ControlRow, Select, ToggleGroup } from '../components/controls'
import { groupColour } from '../lib/chart-utils'
import { countryIndex, economiesForYear } from '../lib/data'
import {
  FOCUS_ECONOMIES,
  decompositionBar,
  decompositionSegments,
  economyName,
  groupName,
} from '../lib/derived'
import { fmt, fmtPct, fmtUsd, projectedNote } from '../lib/format'
import { parseList, parseYear } from '../lib/router'
import type { Numeric } from '../lib/types'
import type { ViewProps } from '../lib/view'

type SortKey = 'exports' | 'dva' | 'fva' | 'services'
type Mode = 'share' | 'level'
type Breakdown = 'summary' | 'detailed'
type PieMode = 'sector' | 'origin'

function publishedSum(left: Numeric, right: Numeric): Numeric {
  if (left === null || right === null) return null
  const sum = left + right
  return Number.isFinite(sum) ? sum : null
}

export function EconomiesView({ data, params, setParams }: ViewProps) {
  const years = data.metadata.coverage.years
  const year = parseYear(params.get('year'), years, 2022)
  const mode = (params.get('mode') === 'level' ? 'level' : 'share') as Mode
  const sortParam = params.get('sort')
  const sort: SortKey =
    sortParam === 'dva' || sortParam === 'fva' || sortParam === 'services' ? sortParam : 'exports'
  const breakdown: Breakdown = params.get('breakdown') === 'detailed' ? 'detailed' : 'summary'
  const selected = parseList(params.get('economies'))
  const [showAll, setShowAll] = useState(false)

  const segments = useMemo(() => decompositionSegments(data), [data])
  const summarySegments = useMemo(
    () => [
      {
        key: 'domestic',
        label: 'Domestic content (incl. tax)',
        colour: groupColour('manufacturing'),
      },
      {
        key: 'foreign',
        label: 'Foreign content (incl. tax)',
        colour: groupColour('services'),
      },
    ],
    [],
  )

  const ranked = useMemo(() => {
    const rows = economiesForYear(data, year).map((code) => {
      const i = countryIndex(data, code, year)
      return {
        code,
        exports: i >= 0 ? data.country.mfg_exports[i] : null,
        dva: i >= 0 ? data.country.dva_share_incl_tax[i] : null,
        fva: i >= 0 ? data.country.fva_share_incl_tax[i] : null,
        services: i >= 0 ? data.country.services_share[i] : null,
      }
    })
    return rows.sort((a, b) => {
      const av = a[sort]
      const bv = b[sort]
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return bv - av
    })
  }, [data, year, sort])

  const visibleRanked = showAll ? ranked : ranked.slice(0, 15)
  const bars: StackBar[] = visibleRanked
    .map((row) => {
      if (breakdown === 'detailed') return decompositionBar(data, row.code, year)
      const i = countryIndex(data, row.code, year)
      if (i < 0) return null
      return {
        key: row.code,
        label: economyName(data, row.code),
        values: {
          domestic: data.country.dva_exports_incl_tax[i] ?? null,
          foreign: data.country.fva_exports_incl_tax[i] ?? null,
        },
        totalText: fmtUsd(data.country.mfg_exports[i] ?? null),
      }
    })
    .filter((bar): bar is StackBar => bar !== null)

  const highlighted = selected.length > 0 ? selected : FOCUS_ECONOMIES
  const detailYear = parseYear(params.get('detail_year'), years, year)
  const detailEconomies = economiesForYear(data, detailYear)
  const requestedFocus = params.get('focus')?.toUpperCase()
  const detailCode =
    (requestedFocus && detailEconomies.includes(requestedFocus) ? requestedFocus : null) ??
    highlighted.find((code) => detailEconomies.includes(code)) ??
    detailEconomies[0] ??
    'MEX'
  const detailIndex = countryIndex(data, detailCode, detailYear)
  const pieMode: PieMode = params.get('pie') === 'origin' ? 'origin' : 'sector'
  const pieSlices =
    detailIndex < 0
      ? []
      : pieMode === 'origin'
        ? [
            {
              key: 'domestic',
              label: 'Domestic content (incl. tax)',
              value: data.country.dva_exports_incl_tax[detailIndex] ?? null,
              colour: groupColour('manufacturing'),
            },
            {
              key: 'foreign',
              label: 'Foreign content (incl. tax)',
              value: data.country.fva_exports_incl_tax[detailIndex] ?? null,
              colour: groupColour('services'),
            },
          ]
        : [
            ...data.metadata.group_order.map((group) => ({
              key: group,
              label: groupName(group),
              value: publishedSum(data.country.dva_from[group][detailIndex] ?? null, data.country.fva_from[group][detailIndex] ?? null),
              colour: groupColour(group),
            })),
            {
              key: 'taxes',
              label: 'Net taxes on products',
              value: data.country.tax_content[detailIndex] ?? null,
              colour: groupColour('taxes'),
            },
          ]

  return (
    <>
      <section className="prose">
        <h2>Every economy in the table, decomposed</h2>
        <p>
          Low domestic shares are not necessarily a weakness. They usually mean a country sits
          inside a supply chain, assembling, processing or re-exporting, rather than that it
          adds little. The question worth asking is which kind of economy a country is.
        </p>
      </section>

      <Figure
        title="Domestic and foreign value added, by economy"
        lede="Start with the top 15 under the selected sort. Use the controls to compare share or USD value, or open the detailed sector view."
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
              hint={data.metadata.coverage.projected_years.includes(year) ? 'projected' : undefined}
            />
            <Select
              label="Sort by"
              value={sort}
              options={[
                { value: 'exports', label: 'Export size' },
                { value: 'dva', label: 'Domestic share (high to low)' },
                { value: 'fva', label: 'Foreign share (high to low)' },
                { value: 'services', label: 'Services share (high to low)' },
              ]}
              onChange={(value) => setParams({ sort: value })}
            />
            <ToggleGroup
              label="Breakdown"
              value={breakdown}
              options={[
                { value: 'summary', label: 'Domestic / foreign' },
                { value: 'detailed', label: 'Detailed sectors' },
              ]}
              onChange={(value) => setParams({ breakdown: value })}
            />
            <ToggleGroup
              label="Scale"
              value={mode}
              options={[
                { value: 'share', label: 'Share of exports' },
                { value: 'level', label: 'USD value' },
              ]}
              onChange={(value) => setParams({ mode: value })}
            />
            <button type="button" className="toggle" onClick={() => setShowAll((current) => !current)}>
              {showAll ? 'Show top 15 only' : ['Show all ', ranked.length].join('')}
            </button>
          </ControlRow>
        }
        note={
          <>
            Showing {visibleRanked.length} of {ranked.length} economies. Bars are ordered by the
            sort you pick; the number on the right is gross manufacturing exports in {year}. {mode === 'share'
              ? 'Every bar is normalised to 100% of that country\u2019s export value, so the comparison is composition.'
              : 'Bars share one dollar scale, so the comparison is size.'}{' '}
            {breakdown === 'summary'
              ? 'The default summary combines domestic and foreign value added with their respective net taxes on products.'
              : 'Detailed sector value added is shown at basic prices, with net taxes separated; the summary is the inclusive domestic and foreign split.'}{' '}
            Click a bar to open that economy&rsquo;s detail below.
          </>
        }
      >
        <div className="long-list">
          <StackedBarChart
            bars={bars}
            segments={breakdown === 'summary' ? summarySegments : segments}
            mode={mode === 'share' ? 'share' : 'level'}
            format={fmtUsd}
            ariaLabel={`Manufacturing export value by source sector for every economy, ${year}`}
            labelWidth={190}
            barHeight={18}
            onBarClick={(key) => setParams({ focus: key })}
            activeBar={detailCode}
          />
        </div>
        <StackLegend
          segments={breakdown === 'summary' ? summarySegments : segments}
          note={
            breakdown === 'summary'
              ? 'Domestic and foreign content include net taxes on products.'
              : 'Domestic groups are solid, the same groups abroad are lighter. Net taxes on products sit last.'
          }
        />
      </Figure>

      {detailIndex >= 0 ? (
        <Figure
          title={economyName(data, detailCode) + ' in detail, ' + projectedNote(detailYear, data.metadata.coverage.projected_years.includes(detailYear))}
          lede="The selected economy and year are independent of the ranking controls. The source-sector view uses the published value-added components; the alternate view keeps the published inclusive domestic-foreign split."
          controls={
            <ControlRow>
              <Select
                label="Economy"
                value={detailCode}
                options={detailEconomies.map((code) => ({
                  value: code,
                  label: economyName(data, code),
                }))}
                onChange={(value) => setParams({ focus: value })}
              />
              <Select
                label="Detail year"
                value={detailYear}
                options={years.map((y) => ({
                  value: y,
                  label: projectedNote(y, data.metadata.coverage.projected_years.includes(y)),
                }))}
                onChange={(value) => setParams({ detail_year: value })}
                hint={data.metadata.coverage.projected_years.includes(detailYear) ? 'projected' : undefined}
              />
              <ToggleGroup
                label="Composition"
                value={pieMode}
                options={[
                  { value: 'sector', label: 'Source sector' },
                  { value: 'origin', label: 'Domestic-foreign origin' },
                ]}
                onChange={(value) => setParams({ pie: value })}
              />
            </ControlRow>
          }
          note={
            <>
              {pieMode === 'sector'
                ? 'Source sectors are basic-price value added summed across domestic and foreign sources; net product taxes are separate. No Leontief recomputation is performed in the browser.'
                : '&ldquo;Domestic share&rdquo; includes net taxes on products, matching the OECD definition of domestic value added content in gross exports.'}
            </>
          }
        >
          <PieChart
            slices={pieSlices}
            denominator={data.country.mfg_exports[detailIndex] ?? null}
            ariaLabel={`${economyName(data, detailCode)} ${pieMode === 'sector' ? 'source-sector' : 'domestic-foreign'} value-added composition in ${detailYear}`}
          />

          <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
            <table className="kv">
              <tbody>
                <tr>
                  <th>Published source-sector split</th>
                  <td>Basic-price value added, domestic and foreign</td>
                </tr>
                {data.metadata.group_order.map((group) => (
                  <tr key={group}>
                    <th>{groupName(group)} value added</th>
                    <td>
                      Domestic {fmtUsd(data.country.dva_from[group][detailIndex] ?? null)}; foreign{' '}
                      {fmtUsd(data.country.fva_from[group][detailIndex] ?? null)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <th>Manufacturing exports</th>
                  <td>{fmtUsd(data.country.mfg_exports[detailIndex] ?? null)}</td>
                </tr>
                <tr>
                  <th>Domestic value added content</th>
                  <td>{fmtPct(data.country.dva_share_incl_tax[detailIndex] ?? null, 1)}</td>
                </tr>
                <tr>
                  <th>Foreign value added content</th>
                  <td>{fmtPct(data.country.fva_share_incl_tax[detailIndex] ?? null, 1)}</td>
                </tr>
                <tr>
                  <th>Net taxes on products</th>
                  <td>{fmtUsd(data.country.tax_content[detailIndex] ?? null)}</td>
                </tr>
                <tr>
                  <th>Services embodied in these exports</th>
                  <td>
                    {fmtUsd(data.country.services_total[detailIndex] ?? null)} (
                    {fmtPct(data.country.services_share[detailIndex] ?? null, 1)} of exports)
                  </td>
                </tr>
                <tr>
                  <th>Of which domestic</th>
                  <td>{fmtPct(data.country.services_domestic_share[detailIndex] ?? null, 1)}</td>
                </tr>
                <tr>
                  <th>Export volume index (2016 = 100)</th>
                  <td>{fmt(data.country.export_index[detailIndex] ?? null, 1)}</td>
                </tr>
                <tr>
                  <th>Export growth, current prices</th>
                  <td>{fmtPct(data.country.export_growth_nominal[detailIndex] ?? null, 1)}</td>
                </tr>
                <tr>
                  <th>Export growth, volume</th>
                  <td>{fmtPct(data.country.export_growth_volume[detailIndex] ?? null, 1)}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </Figure>
      ) : null}
    </>
  )
}
