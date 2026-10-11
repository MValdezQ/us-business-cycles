/**
 * Scatter plot with optional trails, quadrants and labelled points.
 *
 * One component covers three figures that look different but are the same object:
 * the services quadrant (points only), economy trajectories (points with a 2016 trail)
 * and nominal-versus-volume growth (points with a 45-degree reference line).
 *
 * Every mark is a real observation; unhighlighted points are context, not a second series.
 */

import { useState } from 'react'
import { linearScale, niceTicks, paddedDomain, useElementWidth } from '../lib/chart-utils'
import type { Numeric } from '../lib/types'

export interface ScatterPoint {
  key: string
  label: string
  x: Numeric
  y: Numeric
  colour?: string
  highlight?: boolean
  /** Optional starting position, drawn as a light trail behind the point. */
  trail?: { x: Numeric; y: Numeric } | null
  radius?: number
}

interface Props {
  points: ScatterPoint[]
  xLabel: string
  yLabel: string
  xFormat: (value: number) => string
  yFormat: (value: number) => string
  ariaLabel: string
  quadrants?: { x: number; y: number; labels?: [string, string, string, string] }
  diagonal?: boolean | { from?: number; to?: number }
  height?: number
  onPointClick?: (key: string) => void
  xDomain?: [number, number] | null
  yDomain?: [number, number] | null
  /** Labelling every highlighted point at once produces overlapping text as soon as two
   *  economies are close together, so the default is to label on hover and print their
   *  exact values in a table underneath. */
  labelMode?: 'always' | 'hover'
  highlightTable?: boolean
  /** Column heading for x minus y. Pass null where subtracting the two axes would compare
   *  shares that are not on the same footing (services intensity versus self-supply). */
  diffLabel?: string | null
}

const M = { top: 18, right: 18, bottom: 46, left: 62 }

export function ScatterPlot({
  points,
  xLabel,
  yLabel,
  xFormat,
  yFormat,
  ariaLabel,
  quadrants,
  diagonal = false,
  height = 380,
  onPointClick,
  xDomain = null,
  yDomain = null,
  labelMode = 'hover',
  highlightTable = true,
  diffLabel = 'Difference',
}: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const [hovered, setHovered] = useState<string | null>(null)

  const usable = points.filter((p) => p.x !== null && p.y !== null)
  const innerWidth = Math.max(width - M.left - M.right, 120)
  const innerHeight = height - M.top - M.bottom

  const xs = usable.map((p) => p.x as number)
  const ys = usable.map((p) => p.y as number)
  if (diagonal && typeof diagonal === 'object') {
    if (diagonal.from !== undefined) {
      xs.push(diagonal.from)
      ys.push(diagonal.from)
    }
    if (diagonal.to !== undefined) {
      xs.push(diagonal.to)
      ys.push(diagonal.to)
    }
  }

  // A 45-degree reference line is only meaningful on a shared domain, so when `diagonal`
  // is on, both axes take one combined range rather than two independently padded ones.
  const shared = diagonal ? paddedDomain([...xs, ...ys]) : null
  const domainX = xDomain ?? shared ?? paddedDomain(xs)
  const domainY = yDomain ?? shared ?? paddedDomain(ys)

  const x = linearScale(domainX, [0, innerWidth])
  const y = linearScale(domainY, [innerHeight, 0])

  const xTicks = niceTicks(domainX[0], domainX[1], 6)
  const yTicks = niceTicks(domainY[0], domainY[1], 5)

  const hoveredPoint = usable.find((p) => p.key === hovered) ?? null

  if (usable.length === 0) return <p className="chart-empty">No observations to plot.</p>

  return (
    <div className="chart-shell" ref={ref}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        className="scatter"
      >
        <defs>
          <marker
            id="scatter-trail-arrow"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="#c8ccd4" />
          </marker>
        </defs>
        <g transform={`translate(${M.left},${M.top})`}>
          {yTicks.map((tick) => (
            <g key={`y${tick}`}>
              <line x1={0} x2={innerWidth} y1={y(tick)} y2={y(tick)} className="grid-line" />
              <text x={-10} y={y(tick)} className="axis-text" textAnchor="end" dominantBaseline="middle">
                {yFormat(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <g key={`x${tick}`}>
              <line x1={x(tick)} x2={x(tick)} y1={0} y2={innerHeight} className="grid-line faint" />
              <text x={x(tick)} y={innerHeight + 18} className="axis-text" textAnchor="middle">
                {xFormat(tick)}
              </text>
            </g>
          ))}

          {quadrants ? (
            <g className="quadrant-guides">
              <line x1={x(quadrants.x)} x2={x(quadrants.x)} y1={0} y2={innerHeight} className="quadrant-line" />
              <line x1={0} x2={innerWidth} y1={y(quadrants.y)} y2={y(quadrants.y)} className="quadrant-line" />
              {quadrants.labels ? (
                <g className="quadrant-labels">
                  <text x={6} y={14}>{quadrants.labels[0]}</text>
                  <text x={innerWidth - 6} y={14} textAnchor="end">{quadrants.labels[1]}</text>
                  <text x={6} y={innerHeight - 8}>{quadrants.labels[2]}</text>
                  <text x={innerWidth - 6} y={innerHeight - 8} textAnchor="end">{quadrants.labels[3]}</text>
                </g>
              ) : null}
            </g>
          ) : null}

          {diagonal ? (
            <line
              x1={x(domainX[0])}
              x2={x(domainX[1])}
              y1={y(domainX[0])}
              y2={y(domainX[1])}
              className="reference-line"
            />
          ) : null}

          {usable.map((point) => {
            if (!point.trail) return null
            const { x: tx, y: ty } = point.trail
            if (tx === null || ty === null) return null
            return (
              <g key={`trail-${point.key}`} className="trail">
                <line
                  x1={x(tx)}
                  y1={y(ty)}
                  x2={x(point.x as number)}
                  y2={y(point.y as number)}
                  markerEnd="url(#scatter-trail-arrow)"
                />
                <circle cx={x(tx)} cy={y(ty)} r={2.5} />
              </g>
            )
          })}

          {usable.map((point) => {
            const cx = x(point.x as number)
            const cy = y(point.y as number)
            const isHovered = hovered === point.key
            const radius = point.radius ?? (point.highlight ? 6 : 4)
            return (
              <g key={point.key}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? radius + 2 : radius}
                  fill={point.colour ?? (point.highlight ? '#1f4ea1' : '#c8ccd4')}
                  className={`scatter-point${onPointClick ? ' is-clickable' : ''}`}
                  onMouseEnter={() => setHovered(point.key)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={onPointClick ? () => onPointClick(point.key) : undefined}
                />
                {point.highlight && (labelMode === 'always' || isHovered) ? (
                  <text x={cx} y={cy - radius - 6} className="point-label" textAnchor="middle">
                    {point.label}
                  </text>
                ) : null}
              </g>
            )
          })}

          <text x={innerWidth / 2} y={innerHeight + 40} className="axis-title" textAnchor="middle">
            {xLabel}
          </text>
          <text
            transform={`translate(${-M.left + 16},${innerHeight / 2}) rotate(-90)`}
            className="axis-title"
            textAnchor="middle"
          >
            {yLabel}
          </text>
        </g>
      </svg>

      {hoveredPoint ? (
        <div className="chart-readout">
          <strong>{hoveredPoint.label}</strong>
          <span>
            {xLabel}: {xFormat(hoveredPoint.x as number)}
          </span>
          <span>
            {yLabel}: {yFormat(hoveredPoint.y as number)}
          </span>
        </div>
      ) : null}

      {highlightTable && labelMode === 'hover' ? (
        <div className="table-scroll">
        <table className="table readout-table">
          <thead>
            <tr>
              <th scope="col">Economy</th>
              <th scope="col">{xLabel}</th>
              <th scope="col">{yLabel}</th>
              {diffLabel ? <th scope="col">{diffLabel}</th> : null}
            </tr>
          </thead>
          <tbody>
            {usable
              .filter((point) => point.highlight)
              .map((point) => {
                const xv = point.x as number
                const yv = point.y as number
                const diff = xv - yv
                return (
                  <tr key={point.key}>
                    <th scope="row">{point.label}</th>
                    <td>{xFormat(xv)}</td>
                    <td>{yFormat(yv)}</td>
                    {diffLabel ? (
                      <td>
                        {diff >= 0 ? '+' : ''}
                        {yFormat(diff).replace('%', 'pp')}
                      </td>
                    ) : null}
                  </tr>
                )
              })}
          </tbody>
        </table>
        </div>
      ) : null}
    </div>
  )
}
