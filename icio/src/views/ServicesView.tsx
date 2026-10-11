/**
 * Services: the part of manufacturing exports that is not manufacturing.
 *
 * Two figures on the same two axes. The quadrant shows where economies sit; the trajectory
 * shows which way they moved. Plotting both on identical axes is the point — a reader can
 * read a position off one and a direction off the other without rescaling.
 */

import { useMemo } from 'react'
import { ScatterPlot, type ScatterPoint } from '../charts/ScatterPlot'
import { Figure } from '../components/Figure'
import { ControlRow, Select } from '../components/controls'
import { economyColour } from '../lib/chart-utils'
import { countryIndex, economiesForYear, servicesRows } from '../lib/data'
import { FOCUS_ECONOMIES, economyName, industryName } from '../lib/derived'
import { fmtPct, fmtUsd, projectedNote } from '../lib/format'
import { parseList, parseYear } from '../lib/router'
import type { ViewProps } from '../lib/view'

const BASE_YEAR = 2016

export function ServicesView({ data, params, setParams }: ViewProps) {
  const years = data.metadata.coverage.years
  const year = parseYear(params.get('year'), years, 2022)
  const selected = parseList(params.get('economies'))
  const focus = selected.length > 0 ? selected : FOCUS_ECONOMIES
  const breakdownCode = params.get('focus')?.toUpperCase() ?? focus[0] ?? 'MEX'

  const { points, medianX, medianY, domainX, domainY } = useMemo(() => {
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

    const starts = focus
      .map((code) => {
        const i = countryIndex(data, code, BASE_YEAR)
        if (i < 0) return null
        const x = data.country.services_share[i]
        const y = data.country.services_domestic_share[i]
        return x === null || y === null ? null : { x, y }
      })
      .filter((entry): entry is { x: number; y: number } => entry !== null)
    const xs = [...all.map((entry) => entry.x), ...starts.map((entry) => entry.x)].sort((a, b) => a - b)
    const ys = [...all.map((entry) => entry.y), ...starts.map((entry) => entry.y)].sort((a, b) => a - b)
    const mid = (values: number[]) =>
      values.length === 0 ? 0 : values[Math.floor(values.length / 2)]!

    const scatter: ScatterPoint[] = all.map((entry) => {
      const index = focus.indexOf(entry.code)
      const highlight = index >= 0
      return {
        key: entry.code,
        label: economyName(data, entry.code),
        x: entry.x,
        y: entry.y,
        highlight,
        colour: highlight ? economyColour(index) : undefined,
      }
    })

    // One explicit domain for both figures on this page. Without it the quadrant would be
    // padded out to the full 80-economy range while the trajectories were padded to the six,
    // and the claim that the two share a scale would be false.
    const domainX: [number, number] = [
      Math.max(0, Math.floor((xs[0] ?? 0) * 20) / 20 - 0.02),
      Math.ceil((xs[xs.length - 1] ?? 1) * 20) / 20 + 0.02,
    ]
    const domainY: [number, number] = [
      Math.max(0, Math.floor((ys[0] ?? 0) * 20) / 20 - 0.02),
      Math.ceil((ys[ys.length - 1] ?? 1) * 20) / 20 + 0.02,
    ]

    return { points: scatter, medianX: mid(xs), medianY: mid(ys), domainX, domainY }
  }, [data, year, focus])

  const trajectories: ScatterPoint[] = useMemo(() => {
    return focus
      .map((code, index) => {
        const now = countryIndex(data, code, year)
        const before = countryIndex(data, code, BASE_YEAR)
        if (now < 0 || before < 0) return null
        const x = data.country.services_share[now]
        const y = data.country.services_domestic_share[now]
        const x0 = data.country.services_share[before]
        const y0 = data.country.services_domestic_share[before]
        if (x === null || y === null || x0 === null || y0 === null) return null
        const point: ScatterPoint = {
          key: code,
          label: economyName(data, code),
          x,
          y,
          trail: year === BASE_YEAR ? null : { x: x0, y: y0 },
          highlight: true,
          colour: economyColour(index),
        }
        return point
      })
      .filter((entry): entry is ScatterPoint => entry !== null)
  }, [data, year, focus])

  const services = servicesRows(data, breakdownCode, year)
    .map((i) => ({
      industry: data.services.source_industry[i]!,
      domestic: data.services.dva[i] ?? 0,
      foreign: data.services.fva[i] ?? 0,
    }))
    .sort((a, b) => b.domestic + b.foreign - (a.domestic + a.foreign))

  const breakdownIndex = countryIndex(data, breakdownCode, year)
  const maxServices = Math.max(...services.map((row) => row.domestic + row.foreign), 1)

  return (
    <>
      <section className="prose">
        <h2>Services embedded in manufacturing exports</h2>
        <p>
          Finance, insurance, transport, distribution, and administrative support can all be
          inputs to manufacturing exports. In the ICIO tables these are source industries with
          domestic and foreign roles, not services performed inside manufacturing firms.
        </p>
        <p>
          Manufacturing exports may also be intermediates, so they do not necessarily represent
          final physical output. The figures show how much service input they carry and where
          that input was produced.
        </p>
      </section>

      <Figure
        title="Services intensity against self-supply"
        lede="High services content does not imply that the country supplies those services. These two measure different things."
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
          </ControlRow>
        }
        note={
          <>
            The lines are the medians across the 80 economies in the table. The upper-right
            quadrant is service-intensive <em>and</em> self-supplied; the lower-right is
            service-intensive but reliant on foreign services. Small pale dots are the other
            economies, shown for context.
          </>
        }
      >
        <ScatterPlot
          points={points}
          xLabel="Services share of manufacturing export value"
          yLabel="Share of that services value supplied domestically"
          xFormat={(value) => fmtPct(value, 0)}
          yFormat={(value) => fmtPct(value, 0)}
          ariaLabel={`Services intensity against domestic self-supply, ${year}`}
          xDomain={domainX}
          yDomain={domainY}
          diffLabel={null}
          quadrants={{
            x: medianX,
            y: medianY,
            labels: [
              'self-supplied, less service-intensive',
              'self-supplied and service-intensive',
              'imported services, less service-intensive',
              'imported services, service-intensive',
            ],
          }}
          height={420}
        />
      </Figure>

      <Figure
        title={`Trajectories from ${BASE_YEAR} to ${projectedNote(year, data.metadata.coverage.projected_years.includes(year))}`}
        lede={
          year === BASE_YEAR
            ? '2016 is the explicit base year, so there is no movement to draw.'
            : 'Pale dots mark the 2016 starts; arrows end at the selected year.'
        }
        note={
          <>
            Both axes carry the same scale as the figure above, including the full current-year
            field and the selected economies&rsquo; 2016 starts. {year === BASE_YEAR
              ? '2016 is the base year; choose a later year to see arrows.'
              : 'Each arrow connects a 2016 start to the selected-year endpoint.'}{' '}
            These are current-price composition measures, not a measure of real activity.
          </>
        }
      >
        <ScatterPlot
          points={trajectories}
          xLabel="Services share of manufacturing export value"
          yLabel="Share of that services value supplied domestically"
          xFormat={(value) => fmtPct(value, 0)}
          yFormat={(value) => fmtPct(value, 0)}
          ariaLabel={`Change in services intensity and self-supply, ${BASE_YEAR} to ${year}`}
          xDomain={domainX}
          yDomain={domainY}
          highlightTable={false}
          height={420}
        />
      </Figure>

      <Figure
        title={`Service inputs to ${economyName(data, breakdownCode)}'s manufacturing exports`}
        lede="Services embodied in these manufacturing exports, grouped by the ICIO source industry that produced them."
        controls={
          <ControlRow>
            <Select
              label="Economy"
              value={breakdownCode}
              options={focus.map((code) => ({ value: code, label: economyName(data, code) }))}
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
              hint={data.metadata.coverage.projected_years.includes(year) ? 'projected' : undefined}
            />
          </ControlRow>
        }
        note={
          <>
            Bars run left to right from the largest source industry. Solid is domestic, lighter
            is foreign. Total services here:{' '}
            {fmtUsd(data.country.services_total[breakdownIndex] ?? null)} (
            {fmtPct(data.country.services_share[breakdownIndex] ?? null, 1)} of manufacturing
            exports), of which{' '}
            {fmtPct(data.country.services_domestic_share[breakdownIndex] ?? null, 1)} is
            domestic.
          </>
        }
      >
        <div className="table-scroll">
          <table className="table services-table">
            <thead>
              <tr>
                <th scope="col">Service industry</th>
                <th scope="col">Domestic</th>
                <th scope="col">Foreign</th>
                <th scope="col">Total</th>
                <th scope="col" className="bar-column">Share of the largest source</th>
              </tr>
            </thead>
            <tbody>
              {services.map((row) => {
                const total = row.domestic + row.foreign
                return (
                  <tr key={row.industry}>
                    <th scope="row">{industryName(data, row.industry)}</th>
                    <td>{fmtUsd(row.domestic)}</td>
                    <td>{fmtUsd(row.foreign)}</td>
                    <td>{fmtUsd(total)}</td>
                    <td className="bar-column">
                      <span className="inline-bar">
                        <span
                          className="inline-bar-fill domestic"
                          style={{ width: `${(row.domestic / maxServices) * 100}%` }}
                        />
                        <span
                          className="inline-bar-fill foreign"
                          style={{ width: `${(row.foreign / maxServices) * 100}%` }}
                        />
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Figure>
    </>
  )
}
