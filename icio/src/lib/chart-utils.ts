/** Scales, ticks and path helpers shared by the hand-rolled SVG charts. */

import { useEffect, useRef, useState } from 'react'

export interface Scale {
  (value: number): number
  domain: [number, number]
  range: [number, number]
}

export function linearScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0 || 1
  const scale = ((value: number) => r0 + ((value - d0) / span) * (r1 - r0)) as Scale
  scale.domain = domain
  scale.range = range
  return scale
}

/** Round tick values at 1/2/5 x 10^n, the usual readable set. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  if (min === max) return [min]
  const raw = (max - min) / Math.max(count, 1)
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const residual = raw / magnitude
  const step = (residual >= 5 ? 5 : residual >= 2 ? 2 : 1) * magnitude
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let value = start; value <= max + step * 1e-9; value += step) {
    ticks.push(Math.abs(value) < step * 1e-9 ? 0 : value)
  }
  return ticks
}

/** Pad a domain so marks do not sit on the frame, and so a zero baseline stays visible. */
export function paddedDomain(
  values: number[],
  options: { padding?: number; includeZero?: boolean } = {},
): [number, number] {
  const { padding = 0.08, includeZero = false } = options
  const finite = values.filter((value) => Number.isFinite(value))
  if (finite.length === 0) return [0, 1]
  let min = Math.min(...finite)
  let max = Math.max(...finite)
  if (includeZero) {
    min = Math.min(min, 0)
    max = Math.max(max, 0)
  }
  if (min === max) return [min - 1, max + 1]
  const span = max - min
  return [min - span * padding, max + span * padding]
}

export function extent(values: number[]): [number, number] {
  const finite = values.filter((value) => Number.isFinite(value))
  if (finite.length === 0) return [0, 1]
  return [Math.min(...finite), Math.max(...finite)]
}

/** SVG path through points, breaking the line at nulls instead of interpolating across them. */
export function linePath(points: { x: number; y: number | null }[]): string {
  let path = ''
  let pen = false
  for (const point of points) {
    if (point.y === null || !Number.isFinite(point.y)) {
      pen = false
      continue
    }
    path += `${pen ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`
    pen = true
  }
  return path
}

/** Responsive width for an SVG that must fill its container without a layout library. */
export function useElementWidth<T extends HTMLElement>(fallback = 720) {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(fallback)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    // ResizeObserver lives in an effect, never in render: keeping it out of useMemo is what
    // stops this component from changing its hook count between renders.
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width
      if (next && next > 0) setWidth(next)
    })
    observer.observe(element)
    setWidth(element.getBoundingClientRect().width || fallback)
    return () => observer.disconnect()
  }, [fallback])

  return { ref, width }
}

/** One colour per sector group, fixed across every figure so a colour always means the same thing. */
export const GROUP_COLOURS: Record<string, string> = {
  agriculture: '#4c7a3f',
  mining: '#8a6d3b',
  manufacturing: '#1f4ea1',
  utilities: '#3f8f9c',
  construction: '#b06a2c',
  services: '#7a4f9e',
  taxes: '#9aa3ad',
}

export function groupColour(group: string): string {
  return GROUP_COLOURS[group] ?? '#6b7280'
}

/** Blend a hex colour towards white. Used to render the foreign half of a stack in lighter
 *  tints of the same sector colours, so a colour still means one thing across the figure. */
export function tint(hex: string, amount = 0.45): string {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount)
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/** Categorical palette for economies in comparison figures. */
export const ECONOMY_COLOURS = [
  '#1f4ea1',
  '#c2410c',
  '#0f766e',
  '#7a4f9e',
  '#a16207',
  '#be123c',
  '#2563eb',
  '#4d7c0f',
]

export function economyColour(index: number): string {
  return ECONOMY_COLOURS[index % ECONOMY_COLOURS.length]!
}
