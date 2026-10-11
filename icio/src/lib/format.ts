/** Formatting helpers. One place, so a number means the same thing in every figure. */

import type { Numeric } from './types'

/** 1,234.5 */
export function fmt(value: Numeric, decimals = 1): string {
  if (value === null) return '—'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Values in the package are million USD. Readers of a globalisation piece think in
 * billions and trillions, so scale up and relabel rather than showing "2,744,377".
 */
export function fmtUsd(millions: Numeric): string {
  if (millions === null) return '—'
  const abs = Math.abs(millions)
  if (abs >= 1_000_000) return `$${fmt(millions / 1_000_000, 1)}tn`
  if (abs >= 1_000) return `$${fmt(millions / 1_000, 1)}bn`
  return `$${fmt(millions, 0)}m`
}

/** Signed, for gaps and growth rates expressed as shares. */
export function fmtPct(value: Numeric, decimals = 1): string {
  if (value === null) return '—'
  return `${fmt(value * 100, decimals)}%`
}

export function fmtSignedPct(value: Numeric, decimals = 1): string {
  if (value === null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${fmt(value * 100, decimals)}%`
}

/** Percentage-point differences, for decompositions and share gaps. */
export function fmtPp(value: Numeric, decimals = 1): string {
  if (value === null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${fmt(value, decimals)}pp`
}

/** Short label for a projection that must never be mistaken for an observation. */
export function projectedNote(year: number, projected: boolean): string {
  return projected ? `${year} (projected)` : String(year)
}
