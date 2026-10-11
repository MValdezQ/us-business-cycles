import { useState } from 'react'
import { fmt, fmtPct, fmtUsd } from '../lib/format'
import type { Numeric } from '../lib/types'

export interface PieDatum {
  key: string
  label: string
  value: Numeric
  colour: string
}

interface Props {
  slices: PieDatum[]
  denominator: Numeric
  ariaLabel: string
}

const CX = 130
const CY = 130
const RADIUS = 106

function polarPoint(angle: number): { x: number; y: number } {
  const radians = (angle - 90) * (Math.PI / 180)
  return {
    x: CX + RADIUS * Math.cos(radians),
    y: CY + RADIUS * Math.sin(radians),
  }
}

function sectorPath(startAngle: number, endAngle: number): string {
  const start = polarPoint(endAngle)
  const end = polarPoint(startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${CX} ${CY} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 0 ${end.x} ${end.y} Z`
}

function publishedShare(value: Numeric, denominator: Numeric): Numeric {
  if (
    value === null ||
    denominator === null ||
    !Number.isFinite(value) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) return null
  return value / denominator
}

function sliceDetail(slice: PieDatum, denominator: Numeric): string {
  const share = publishedShare(slice.value, denominator)
  const value = typeof slice.value === 'number' && Number.isFinite(slice.value) ? slice.value : null
  return `${slice.label}: ${fmtUsd(value)}; ${fmtPct(share, 1)} of published gross manufacturing exports (${fmtUsd(denominator)}).`
}

function exactValue(value: Numeric): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${fmt(value, 2)} million USD` : '—'
}

export function PieChart({ slices, denominator, ariaLabel }: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const values = slices.map((slice) => slice.value)
  const hasUnavailableComponent = values.some((value) => value === null || !Number.isFinite(value))
  const hasNegativeComponent = values.some(
    (value) => typeof value === 'number' && Number.isFinite(value) && value < 0,
  )
  const positiveSlices = slices.filter((slice) => slice.value !== null && slice.value > 0)
  const positiveTotal = positiveSlices.reduce((total, slice) => total + (slice.value as number), 0)
  const denominatorValue = typeof denominator === 'number' && Number.isFinite(denominator) ? denominator : null
  const canDraw =
    denominatorValue !== null &&
    denominatorValue > 0 &&
    !hasUnavailableComponent &&
    !hasNegativeComponent &&
    positiveTotal > 0
  const canDrawSignedBars = hasNegativeComponent && !hasUnavailableComponent
  const componentTotal = hasUnavailableComponent
    ? null
    : values.reduce<number>((total, value) => total + (value as number), 0)
  const closureResidual =
    denominatorValue !== null && denominatorValue > 0 && componentTotal !== null
      ? denominatorValue - componentTotal
      : null
  const hasMaterialResidual = closureResidual !== null && Math.abs(closureResidual) > 0.05
  const signedScale = canDrawSignedBars
    ? Math.max(...values.map((value) => Math.abs(value as number)), 1)
    : 1

  let angle = 0

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18, width: '100%' }}
    >
      <svg
        viewBox="0 0 260 260"
        role="img"
        aria-label={ariaLabel}
        style={{ display: 'block', flex: '0 1 260px', width: 'min(100%, 260px)', height: 'auto', minWidth: 0 }}
      >
        <title>{ariaLabel}</title>
        <desc>
          {canDraw
            ? slices.map((slice) => sliceDetail(slice, denominator)).join(' ')
            : canDrawSignedBars
              ? 'A published component is negative, so signed horizontal bars centered on zero show the values without changing their sign.'
              : 'The composition is unavailable because the published values cannot form a positive pie.'}
        </desc>
        {canDraw ? (
          positiveSlices.length === 1 ? (
            <circle
              cx={CX}
              cy={CY}
              r={RADIUS}
              fill={positiveSlices[0]!.colour}
              stroke="white"
              strokeWidth="2"
              tabIndex={0}
              role="img"
              aria-label={sliceDetail(positiveSlices[0]!, denominator)}
              onMouseEnter={() => setActiveKey(positiveSlices[0]!.key)}
              onMouseLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(positiveSlices[0]!.key)}
              onBlur={() => setActiveKey(null)}
            >
              <title>{sliceDetail(positiveSlices[0]!, denominator)}</title>
            </circle>
          ) : (
            positiveSlices.map((slice) => {
              const startAngle = angle
              angle += ((slice.value as number) / positiveTotal) * 360
              return (
                <path
                  key={slice.key}
                  d={sectorPath(startAngle, angle)}
                  fill={slice.colour}
                  stroke="white"
                  strokeWidth="2"
                  tabIndex={0}
                  role="img"
                  aria-label={sliceDetail(slice, denominator)}
                  onMouseEnter={() => setActiveKey(slice.key)}
                  onMouseLeave={() => setActiveKey(null)}
                  onFocus={() => setActiveKey(slice.key)}
                  onBlur={() => setActiveKey(null)}
                >
                  <title>{sliceDetail(slice, denominator)}</title>
                </path>
              )
            })
          )
        ) : canDrawSignedBars ? (
          <text x={CX} y={CY - 4} textAnchor="middle" fill="currentColor" fontSize="13">
            <tspan x={CX} dy="0">Signed values</tspan>
            <tspan x={CX} dy="18">shown below</tspan>
          </text>
        ) : (
          <text x={CX} y={CY - 4} textAnchor="middle" fill="currentColor" fontSize="13">
            <tspan x={CX} dy="0">Composition</tspan>
            <tspan x={CX} dy="18">unavailable</tspan>
          </text>
        )}
      </svg>

      <div style={{ flex: '1 1 220px', minWidth: 0, color: 'var(--ink-soft)' }}>
        {canDrawSignedBars ? (
          <>
            <p style={{ margin: 0, color: 'var(--ink)', fontWeight: 600 }}>Signed bar fallback</p>
            <p style={{ margin: '4px 0 10px', fontSize: '0.84rem' }}>
              A negative published component cannot form a pie. Bars share one common scale centered on zero; values are unchanged.
            </p>
            <div role="img" aria-label={`${ariaLabel}; signed horizontal bars centered on zero`} style={{ display: 'grid', gap: 8 }}>
              {slices.map((slice) => {
                const value = typeof slice.value === 'number' && Number.isFinite(slice.value) ? slice.value : null
                const width = value === null ? 0 : (Math.abs(value) / signedScale) * 50
                return (
                  <div key={slice.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(92px, 1fr) minmax(130px, 2fr)', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.84rem' }}>{slice.label}</span>
                    <span aria-hidden="true" style={{ position: 'relative', height: 14, background: 'var(--line-soft)', borderRadius: 3 }}>
                      <span style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--muted)' }} />
                      {value !== null && value !== 0 ? (
                        <span
                          style={{
                            position: 'absolute',
                            top: 2,
                            bottom: 2,
                            left: value > 0 ? '50%' : `${50 - width}%`,
                            width: `${width}%`,
                            background: slice.colour,
                            borderRadius: 2,
                          }}
                        />
                      ) : null}
                    </span>
                  </div>
                )
              })}
            </div>
            <table className="kv" style={{ marginTop: 12 }}>
              <caption style={{ textAlign: 'left', marginBottom: 6 }}>Published signed component values</caption>
              <tbody>
                {slices.map((slice) => (
                  <tr key={slice.key}>
                    <th>{slice.label}</th>
                    <td>{exactValue(slice.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
            {slices.map((slice) => {
              const detail = sliceDetail(slice, denominator)
              const share = publishedShare(slice.value, denominator)
              const value = typeof slice.value === 'number' && Number.isFinite(slice.value) ? slice.value : null
              return (
                <li key={slice.key}>
                  <button
                    type="button"
                    aria-label={detail}
                    onMouseEnter={() => setActiveKey(slice.key)}
                    onMouseLeave={() => setActiveKey(null)}
                    onFocus={() => setActiveKey(slice.key)}
                    onBlur={() => setActiveKey(null)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '12px minmax(0, 1fr)',
                      gap: 8,
                      width: '100%',
                      padding: '2px 4px',
                      border: 0,
                      borderRadius: 4,
                      background: activeKey === slice.key ? 'var(--line-soft)' : 'transparent',
                      color: 'inherit',
                      font: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span aria-hidden="true" style={{ width: 12, height: 12, marginTop: 3, borderRadius: 2, background: slice.colour }} />
                    <span>
                      <strong style={{ color: 'var(--ink)' }}>{slice.label}</strong>
                      <br />
                      {fmtUsd(value)} · {fmtPct(share, 1)} of published gross manufacturing exports
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontSize: '0.84rem' }}>
          Denominator: published gross manufacturing exports {fmtUsd(denominator)}. Positive components are normalized only for pie geometry; labels retain their published shares.
          {hasMaterialResidual ? ` Accounting residual: ${closureResidual! > 0 ? '+' : '-'}$${fmt(Math.abs(closureResidual!), 1)}m.` : ''}
          {!canDraw && !canDrawSignedBars
            ? hasUnavailableComponent
              ? ' Pie unavailable: one or more published components are missing or non-finite; no chart was drawn.'
              : ' Pie unavailable: the published total is not positive or the components provide no positive composition.'
            : canDrawSignedBars
              ? ' Pie unavailable because a published component is negative; the signed bar fallback preserves the published values.'
              : ''}
        </p>
        {activeKey ? (
          <p aria-live="polite" style={{ margin: '8px 0 0', color: 'var(--ink)', fontSize: '0.88rem' }}>
            {sliceDetail(slices.find((slice) => slice.key === activeKey)!, denominator)}
          </p>
        ) : null}
      </div>
    </div>
  )
}
