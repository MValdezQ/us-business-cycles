/**
 * Derived views of the published package.
 *
 * "Derived" here means reshaped, never recomputed: these helpers pick numbers out of the
 * package and arrange them for a chart. No Leontief arithmetic happens in the browser, so
 * the dashboard cannot disagree with the Python analysis.
 */

import { groupColour, tint } from './chart-utils'
import type { StackBar, StackSegment } from '../charts/StackedBarChart'
import { countryIndex, num } from './data'
import { fmtUsd } from './format'
import type { DashboardData, Numeric } from './types'

/** The six economies the piece argues through. Others remain selectable everywhere. */
export const FOCUS_ECONOMIES = ['MEX', 'CHN', 'DEU', 'FRA', 'USA', 'CAN']

/** Default drill-down industry: motor vehicles, the sector readers arrive with priors about. */
export const DEFAULT_INDUSTRY = 'C29'

/**
 * The decomposer's segments: where the value in a country's manufacturing exports came from.
 *
 * Domestic groups first, then the same groups abroad, then net taxes. Foreign content is
 * split by source sector but never by source country — the panel deliberately has no
 * bilateral dimension, and a chart must not imply one.
 */
export function decompositionSegments(data: DashboardData): StackSegment[] {
  const segments: StackSegment[] = []
  for (const group of data.metadata.group_order) {
    segments.push({
      key: `dva_from_${group}`,
      label: `Domestic ${group}`,
      colour: groupColour(group),
    })
  }
  for (const group of data.metadata.group_order) {
    segments.push({
      key: `fva_from_${group}`,
      label: `Foreign ${group}`,
      colour: tint(groupColour(group)),
    })
  }
  segments.push({ key: 'tax_content', label: 'Net taxes on products', colour: groupColour('taxes') })
  return segments
}

/** One decomposer bar for an economy-year, with the export total shown at the right. */
export function decompositionBar(
  data: DashboardData,
  economy: string,
  year: number,
): StackBar | null {
  const i = countryIndex(data, economy, year)
  if (i < 0) return null
  const values: Record<string, Numeric> = {}
  for (const group of data.metadata.group_order) {
    values[`dva_from_${group}`] = data.country.dva_from[group][i] ?? null
    values[`fva_from_${group}`] = data.country.fva_from[group][i] ?? null
  }
  values.tax_content = data.country.tax_content[i] ?? null
  return {
    key: economy,
    label: economyName(data, economy),
    values,
    totalText: fmtUsd(data.country.mfg_exports[i] ?? null),
  }
}

export function economyName(data: DashboardData, code: string): string {
  return data.metadata.labels.economies[code] ?? code
}

export function industryName(data: DashboardData, code: string): string {
  return data.metadata.labels.industries[code] ?? code
}

export function groupName(group: string): string {
  return group.charAt(0).toUpperCase() + group.slice(1)
}

/** Domestic and foreign content shares including taxes, which is the OECD-comparable split. */
export function contentSplit(
  data: DashboardData,
  economy: string,
  year: number,
): { domestic: Numeric; foreign: Numeric; taxes: Numeric } | null {
  const i = countryIndex(data, economy, year)
  if (i < 0) return null
  return {
    domestic: data.country.dva_exports_incl_tax[i] ?? null,
    foreign: data.country.fva_exports_incl_tax[i] ?? null,
    taxes: data.country.tax_content[i] ?? null,
  }
}

/** Total services embodied in manufacturing exports, domestic + foreign. */
export function servicesLevel(
  data: DashboardData,
  economy: string,
  year: number,
): { domestic: Numeric; foreign: Numeric } | null {
  const i = countryIndex(data, economy, year)
  if (i < 0) return null
  return {
    domestic: data.country.services_domestic[i] ?? null,
    foreign: data.country.services_foreign[i] ?? null,
  }
}

/** Growth in current prices over the period, as a share. */
export function nominalGrowth(data: DashboardData, economy: string, year: number): Numeric {
  const i = countryIndex(data, economy, year)
  return i < 0 ? null : num(data.country.export_growth_nominal[i])
}

/** True when a year is an OECD projection, so every view can label it the same way. */
export function isProjected(data: DashboardData, year: number): boolean {
  return data.metadata.coverage.projected_years.includes(year)
}
