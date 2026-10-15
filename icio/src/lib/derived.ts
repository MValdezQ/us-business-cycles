/**
 * Derived views of the published package.
 *
 * "Derived" here means reshaped, never recomputed: these helpers pick numbers out of the
 * package and arrange them for a chart. No Leontief arithmetic happens in the browser, so
 * the dashboard cannot disagree with the Python analysis.
 */

import { economyColour, groupColour, tint } from './chart-utils'
import type { StackBar, StackSegment } from '../charts/StackedBarChart'
import { countryIndex, economiesForYear, num, countrySeries } from './data'
import { fmtUsd } from './format'
import type { DashboardData, Numeric } from './types'

/** The six economies the piece argues through. Others remain selectable everywhere. */
export const FOCUS_ECONOMIES = ['MEX', 'CHN', 'DEU', 'FRA', 'USA', 'CAN']

/** The opening comparison has its own selection, separate from the six-country decomposer. */
export const TREND_DEFAULT_ECONOMIES = ['MEX', 'CHN', 'DEU']
export const MAX_TREND_ECONOMIES = 4
export type TrendMeasure = 'index' | 'level'

export type MainCompositionKey =
  | 'domestic_manufacturing'
  | 'domestic_services'
  | 'other_domestic'
  | 'foreign_manufacturing'
  | 'foreign_services'
  | 'other_foreign'

export interface MainCompositionSegment {
  key: MainCompositionKey
  label: string
  colour: string
}

export interface MainCompositionBar {
  key: string
  label: string
  denominator: Numeric
  values: Record<MainCompositionKey, Numeric>
  available: boolean
}

export interface WorldTrendSeries {
  key: string
  label: string
  colour: string
  values: Numeric[]
}

const WORLD_REFERENCE_COLOUR = '#252a31'
const BASE_YEAR = 2016

/** A stable colour lookup: adding/removing a country never recolours another country. */
export function economySeriesColour(data: DashboardData, code: string): string {
  const focusIndex = FOCUS_ECONOMIES.indexOf(code)
  if (focusIndex >= 0) return economyColour(focusIndex)
  const firstYear = data.metadata.coverage.years[0]
  const otherCodes = economiesForYear(data, firstYear).filter((entry) => !FOCUS_ECONOMIES.includes(entry))
  return economyColour(FOCUS_ECONOMIES.length + Math.max(otherCodes.indexOf(code), 0))
}

function indexed(values: Numeric[], years: number[]): Numeric[] {
  const base = values[years.indexOf(BASE_YEAR)] ?? null
  if (base === null || !Number.isFinite(base) || base === 0) return years.map(() => null)
  return values.map((value) =>
    value === null || !Number.isFinite(value) ? null : (value / base) * 100,
  )
}

/**
 * Shared read-only series for the two opening plots. The first series is always world, followed
 * by the selected countries. Index mode is nominal current-price exports rebased to 2016 = 100;
 * it deliberately does not use the published chain-linked volume index.
 */
export function worldTrendSeries(
  data: DashboardData,
  economies: string[],
  measure: TrendMeasure | 'share',
): WorldTrendSeries[] {
  const years = data.metadata.coverage.years
  const worldValues =
    measure === 'index'
      ? indexed(data.world.mfg_exports, years)
      : measure === 'share'
        ? data.world.dva_share_incl_tax
        : data.world.mfg_exports
  const world: WorldTrendSeries = {
    key: 'world',
    label: 'World',
    colour: WORLD_REFERENCE_COLOUR,
    values: worldValues,
  }
  const countries = economies.slice(0, MAX_TREND_ECONOMIES).map((code) => {
    const exports = countrySeries(data, code, (row) => data.country.mfg_exports[row]).map((entry) => entry.value)
    const shares = countrySeries(data, code, (row) => data.country.dva_share_incl_tax[row]).map((entry) => entry.value)
    const values = measure === 'index' ? indexed(exports, years) : exports
    return {
      key: code,
      label: `${economyName(data, code)} (${code})`,
      colour: economySeriesColour(data, code),
      values: measure === 'share' ? shares : values,
    }
  })
  return [world, ...countries]
}

export function latestObservedWorld(data: DashboardData): { year: number; value: Numeric } {
  for (let i = data.world.year.length - 1; i >= 0; i -= 1) {
    if (data.world.projected[i] !== true && data.world.mfg_exports[i] !== null) {
      return { year: data.world.year[i]!, value: data.world.mfg_exports[i] ?? null }
    }
  }
  return { year: data.world.year[data.world.year.length - 1] ?? BASE_YEAR, value: null }
}

/** The six published components used by the overview's first-read figure. */
export function mainCompositionSegments(): MainCompositionSegment[] {
  return [
    { key: 'domestic_manufacturing', label: 'Domestic manufacturing', colour: groupColour('manufacturing') },
    { key: 'domestic_services', label: 'Domestic services', colour: groupColour('services') },
    { key: 'other_domestic', label: 'Other domestic', colour: groupColour('construction') },
    { key: 'foreign_manufacturing', label: 'Foreign manufacturing', colour: tint(groupColour('manufacturing')) },
    { key: 'foreign_services', label: 'Foreign services', colour: tint(groupColour('services')) },
    { key: 'other_foreign', label: 'Other foreign', colour: tint(groupColour('construction')) },
  ]
}

const NON_MAIN_GROUPS = ['agriculture', 'mining', 'utilities', 'construction'] as const

function publishedOtherContent(
  data: DashboardData,
  side: 'dva' | 'fva',
  taxField: 'tax_content_domestic' | 'tax_content_foreign',
  row: number,
): Numeric {
  let total = 0
  for (const group of NON_MAIN_GROUPS) {
    const value = data.country[side === 'dva' ? 'dva_from' : 'fva_from'][group][row]
    if (value === null || !Number.isFinite(value)) return null
    total += value
  }
  const tax = data.country[taxField][row]
  if (tax === null || !Number.isFinite(tax)) return null
  total += tax
  return Number.isFinite(total) ? total : null
}

/**
 * Read the six first-read components from the published country table.
 * Manufacturing and services stay at basic prices; domestic and foreign net taxes enter only
 * their respective "other" bucket. A signed or incomplete component makes the bar unavailable
 * rather than silently turning it into a plausible positive stack.
 */
export function mainCompositionBar(
  data: DashboardData,
  economy: string,
  year: number,
): MainCompositionBar {
  const row = countryIndex(data, economy, year)
  const emptyValues: Record<MainCompositionKey, Numeric> = {
    domestic_manufacturing: null,
    domestic_services: null,
    other_domestic: null,
    foreign_manufacturing: null,
    foreign_services: null,
    other_foreign: null,
  }
  if (row < 0) {
    return { key: economy, label: economyName(data, economy), denominator: null, values: emptyValues, available: false }
  }

  const values: Record<MainCompositionKey, Numeric> = {
    domestic_manufacturing: data.country.dva_from.manufacturing[row] ?? null,
    domestic_services: data.country.dva_from.services[row] ?? null,
    other_domestic: publishedOtherContent(data, 'dva', 'tax_content_domestic', row),
    foreign_manufacturing: data.country.fva_from.manufacturing[row] ?? null,
    foreign_services: data.country.fva_from.services[row] ?? null,
    other_foreign: publishedOtherContent(data, 'fva', 'tax_content_foreign', row),
  }
  const denominator = data.country.mfg_exports[row] ?? null
  const available =
    denominator !== null && Number.isFinite(denominator) && denominator > 0 &&
    Object.values(values).every((value) => value !== null && Number.isFinite(value) && value >= 0)
  return { key: economy, label: economyName(data, economy), denominator, values, available }
}

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
