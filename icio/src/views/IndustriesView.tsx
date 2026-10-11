/**
 * Inside manufacturing: the sector drill-down.
 *
 * The figure shows total services embodied in manufacturing exports and the domestic/foreign
 * split. It does not imply a per-industry breakdown of the source service industries.
 */

import { useEffect, useMemo, useState } from 'react'
import { StackLegend, StackedBarChart, type StackBar } from '../charts/StackedBarChart'
import { Figure } from '../components/Figure'
import { ControlRow, Select, ToggleGroup } from '../components/controls'
import { groupColour, tint } from '../lib/chart-utils'
import { countryIndex, economiesForYear, industryRows } from '../lib/data'
import { economyName, industryName } from '../lib/derived'
import { fmtPct, fmtUsd, projectedNote } from '../lib/format'
import { parseYear } from '../lib/router'
import type { Numeric } from '../lib/types'
import type { ViewProps } from '../lib/view'

type Measure = 'services' | 'share'

interface IndustryRow {
  code: string
  exports: Numeric
  services: Numeric
  servicesDomestic: Numeric
  servicesForeign: Numeric
  share: Numeric
  active: boolean
}

export function IndustriesView({ data, params, setParams }: ViewProps) {
  const years = data.metadata.coverage.years
  const year = parseYear(params.get('year'), years, 2022)
  const availableEconomies = economiesForYear(data, year)
  const requestedEconomy = params.get('focus')?.toUpperCase() ?? ''
  const economy = availableEconomies.includes(requestedEconomy)
    ? requestedEconomy
    : availableEconomies.includes('MEX')
      ? 'MEX'
      : availableEconomies[0] ?? 'MEX'
  const measure: Measure = params.get('measure') === 'share' ? 'share' : 'services'
  const [openIndustry, setOpenIndustry] = useState<string | null>(null)

  useEffect(() => {
    const updates: Record<string, string> = {}
    if (params.has('focus') && params.get('focus') !== economy) updates.focus = economy
    if (params.has('measure') && params.get('measure') !== measure) updates.measure = measure
    // Keep old rank links valid, but canonicalise them to the only supported ranking: measure.
    if (params.has('sort') && params.get('sort') !== measure) updates.sort = measure
    if (Object.keys(updates).length > 0) setParams(updates)
  }, [economy, measure, params.toString(), setParams])

  const allRows = useMemo<IndustryRow[]>(
    () =>
      industryRows(data, economy, year)
        .map((i) => ({
          code: data.industry.industry[i]!,
          exports: data.industry.exports[i] ?? null,
          services: data.industry.services_total[i] ?? null,
          servicesDomestic: data.industry.services_domestic[i] ?? null,
          servicesForeign: data.industry.services_foreign[i] ?? null,
          share: data.industry.services_share[i] ?? null,
          active: data.industry.active[i] === true,
        }))
        .filter((row) => row.active && row.exports !== null && row.exports > 0),
    [data, economy, year],
  )

  const rows = useMemo(
    () =>
      allRows
        .filter((row) => (measure === 'share' ? row.share : row.services) !== null)
        .sort((a, b) => {
          const aValue = measure === 'share' ? a.share : a.services
          const bValue = measure === 'share' ? b.share : b.services
          return (bValue ?? -Infinity) - (aValue ?? -Infinity)
        }),
    [allRows, measure],
  )

  const segments = [
    { key: 'domestic', label: 'Domestic services', colour: groupColour('services') },
    { key: 'foreign', label: 'Foreign services', colour: tint(groupColour('services')) },
  ]

  const bars: StackBar[] = rows.map((row) => ({
    key: row.code,
    label: industryName(data, row.code),
    sublabel: row.code,
    values: {
      domestic:
        measure === 'share'
          ? row.servicesDomestic !== null && row.exports !== null
            ? row.servicesDomestic / row.exports
            : null
          : row.servicesDomestic,
      foreign:
        measure === 'share'
          ? row.servicesForeign !== null && row.exports !== null
            ? row.servicesForeign / row.exports
            : null
          : row.servicesForeign,
    },
    totalText: measure === 'share' ? fmtPct(row.share, 1) : fmtUsd(row.services),
  }))

  const economyIndex = countryIndex(data, economy, year)
  const totalServices = allRows.every((row) => row.services !== null)
    ? allRows.reduce((sum, row) => sum + (row.services ?? 0), 0)
    : null
  const selectedRow = allRows.find((row) => row.code === openIndustry) ?? null
  const projected = data.metadata.coverage.projected_years.includes(year)

  return (
    <>
      <section className="prose">
        <h2>Service inputs across manufacturing industries</h2>
        <p>
          Compare the service inputs embodied in each manufacturing industry&rsquo;s exports. The
          data show total services and their domestic/foreign split, not a breakdown by source
          service industry.
        </p>
      </section>

      <Figure
        title={`Service inputs across manufacturing industries, ${economyName(data, economy)}, ${projectedNote(year, projected)}`}
        lede={
          measure === 'share'
            ? 'Each bar shows services embodied as a share of that industry’s export value, split between domestic and foreign production.'
            : 'Each bar shows total services embodied in one manufacturing industry’s exports, split between domestic and foreign production.'
        }
        controls={
          <ControlRow>
            <Select
              label="Economy"
              value={economy}
              options={availableEconomies.map((code) => ({
                value: code,
                label: economyName(data, code),
              }))}
              onChange={(value) => setParams({ focus: value })}
            />
            <Select
              label="Year"
              value={year}
              options={years.map((y) => ({
                value: y,
                label: projectedNote(y, data.metadata.coverage.projected_years.includes(y)),
              }))}
              onChange={(value) => setParams({ year: value })}
              hint={projected ? 'projected' : undefined}
            />
            <ToggleGroup
              label="Measure"
              value={measure}
              options={[
                { value: 'services', label: 'Services value' },
                { value: 'share', label: 'Services share of exports' },
              ]}
              onChange={(value) => setParams({ measure: value, sort: value })}
            />
          </ControlRow>
        }
        note={
          <>
            {rows.length} active manufacturing industries. Services here total{' '}
            {fmtUsd(totalServices)} against {fmtUsd(data.country.mfg_exports[economyIndex] ?? null)}{' '}
            of manufacturing exports from this economy. Ranking follows the selected measure.
            Click a bar for the industry&rsquo;s own figures.{' '}
            {projected ? `${year} is an OECD projection, not an observation.` : ''}
          </>
        }
      >
        <StackedBarChart
          bars={bars}
          segments={segments}
          mode="level"
          format={measure === 'share' ? (value) => fmtPct(value, 1) : fmtUsd}
          ariaLabel={`${measure === 'share' ? 'Services share of exports' : 'Services value'} by manufacturing industry in ${economyName(data, economy)}, ${year}`}
          labelWidth={250}
          barHeight={20}
          onBarClick={(key) => setOpenIndustry((current) => (current === key ? null : key))}
          activeBar={openIndustry}
        />
        <StackLegend
          segments={segments}
          note={
            measure === 'share'
              ? 'Bar length is the services share of exports; colours split domestic and foreign service production.'
              : 'Bar length is services value, not export value: a short bar can mean a small industry or less service input per dollar.'
          }
        />
      </Figure>

      {selectedRow ? (
        <Figure
          title={industryName(data, selectedRow.code)}
          lede={`${economyName(data, economy)}, ${year}: ISIC ${selectedRow.code}`}
          source={false}
        >
          <table className="kv">
            <tbody>
              <tr>
                <th>Gross exports</th>
                <td>{fmtUsd(selectedRow.exports)}</td>
              </tr>
              <tr>
                <th>Services embodied in those exports</th>
                <td>
                  {fmtUsd(selectedRow.services)} ({fmtPct(selectedRow.share, 1)})
                </td>
              </tr>
              <tr>
                <th>Domestic services</th>
                <td>{fmtUsd(selectedRow.servicesDomestic)}</td>
              </tr>
              <tr>
                <th>Foreign services</th>
                <td>{fmtUsd(selectedRow.servicesForeign)}</td>
              </tr>
            </tbody>
          </table>
        </Figure>
      ) : null}
    </>
  )
}
