/**
 * Loading and shaping the published dashboard data package.
 *
 * Two rules are enforced here rather than left to the views:
 *   1. The package is read-only. Nothing in the dashboard recomputes a Leontief result;
 *      it only reshapes published numbers, so the browser can never drift from Python.
 *   2. Projected years are carried as a flag, never silently mixed with observed years.
 */

import type {
  ColumnarPayload,
  CountryTable,
  DashboardData,
  GroupId,
  IndustryTable,
  Metadata,
  Numeric,
  ServicesTable,
  WorldTable,
} from './types'

const DATA_BASE = `${import.meta.env.BASE_URL}data/`

async function fetchJson<T>(file: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${DATA_BASE}${file}`, { signal })
  if (!response.ok) {
    throw new Error(`Could not load ${file} (HTTP ${response.status}).`)
  }
  return (await response.json()) as T
}

/** Decode one columnar payload into parallel arrays, resolving dimension codes to labels. */
function decode(payload: ColumnarPayload): {
  n: number
  columns: Record<string, (string | number | boolean | null)[]>
} {
  // Every column must have exactly `count` entries. A ragged file would otherwise show up
  // as a silently short chart rather than an error, which is the worst of both worlds.
  for (const [name, values] of Object.entries(payload.columns)) {
    if (values.length !== payload.count) {
      throw new Error(`Data package is ragged: column "${name}" has ${values.length} of ${payload.count} rows.`)
    }
  }

  const columns: Record<string, (string | number | boolean | null)[]> = {}

  for (const [dim, labels] of Object.entries(payload.dims)) {
    const codes = payload.columns[dim] as number[]
    columns[dim] = codes.map((code) => {
      const label = labels[code]
      if (label === undefined) throw new Error(`Unknown ${dim} code ${code}.`)
      return label
    })
  }

  for (const [name, values] of Object.entries(payload.columns)) {
    if (name in payload.dims) continue
    columns[name] = values as (string | number | boolean | null)[]
  }

  return { n: payload.count, columns }
}

/** `null` for anything that is not a finite number, so charts can break lines honestly. */
export function num(value: string | number | boolean | null | undefined): Numeric {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function strings(column: (string | number | boolean | null)[]): string[] {
  return column.map((value) => String(value))
}

function numbers(column: (string | number | boolean | null)[]): Numeric[] {
  return column.map(num)
}

function flags(column: (string | number | boolean | null)[]): boolean[] {
  return column.map((value) => value === true)
}

function ints(column: (string | number | boolean | null)[]): number[] {
  return column.map((value) => Number(value))
}

function toWorld(columns: Record<string, (string | number | boolean | null)[]>): WorldTable {
  return {
    n: columns.year!.length,
    year: ints(columns.year!),
    projected: flags(columns.projected!),
    mfg_exports: numbers(columns.mfg_exports!),
    dva_share_incl_tax: numbers(columns.dva_share_incl_tax!),
    fva_share_incl_tax: numbers(columns.fva_share_incl_tax!),
    services_total: numbers(columns.services_total!),
    services_share: numbers(columns.services_share!),
    services_domestic_share: numbers(columns.services_domestic_share!),
    export_growth_nominal: numbers(columns.export_growth_nominal!),
  }
}

const GROUPS: GroupId[] = [
  'agriculture',
  'mining',
  'manufacturing',
  'utilities',
  'construction',
  'services',
]

function toCountry(columns: Record<string, (string | number | boolean | null)[]>): CountryTable {
  const dvaFrom = {} as Record<GroupId, Numeric[]>
  const fvaFrom = {} as Record<GroupId, Numeric[]>
  for (const group of GROUPS) {
    dvaFrom[group] = numbers(columns[`dva_from_${group}`]!)
    fvaFrom[group] = numbers(columns[`fva_from_${group}`]!)
  }
  return {
    n: columns.year!.length,
    economy: strings(columns.economy!),
    year: ints(columns.year!),
    projected: flags(columns.projected!),
    mfg_exports: numbers(columns.mfg_exports!),
    mfg_value_added: numbers(columns.mfg_value_added!),
    dva_share_incl_tax: numbers(columns.dva_share_incl_tax!),
    fva_share_incl_tax: numbers(columns.fva_share_incl_tax!),
    dva_share_excl_tax: numbers(columns.dva_share_excl_tax!),
    dva_exports_incl_tax: numbers(columns.dva_exports_incl_tax!),
    fva_exports_incl_tax: numbers(columns.fva_exports_incl_tax!),
    tax_content: numbers(columns.tax_content!),
    tax_content_domestic: numbers(columns.tax_content_domestic!),
    tax_content_foreign: numbers(columns.tax_content_foreign!),
    services_domestic: numbers(columns.services_domestic!),
    services_foreign: numbers(columns.services_foreign!),
    services_total: numbers(columns.services_total!),
    services_share: numbers(columns.services_share!),
    services_domestic_share: numbers(columns.services_domestic_share!),
    export_index: numbers(columns.export_index!),
    export_growth_volume: numbers(columns.export_growth_volume!),
    export_growth_nominal: numbers(columns.export_growth_nominal!),
    export_growth_volume_cumulative: numbers(columns.export_growth_volume_cumulative!),
    export_growth_nominal_cumulative: numbers(columns.export_growth_nominal_cumulative!),
    dva_from: dvaFrom,
    fva_from: fvaFrom,
  }
}

function toIndustry(columns: Record<string, (string | number | boolean | null)[]>): IndustryTable {
  return {
    n: columns.industry!.length,
    economy: strings(columns.economy!),
    year: ints(columns.year!),
    industry: strings(columns.industry!),
    projected: flags(columns.projected!),
    active: flags(columns.active!),
    exports: numbers(columns.exports!),
    value_added: numbers(columns.value_added!),
    dva_share_incl_tax: numbers(columns.dva_share_incl_tax!),
    tax_content: numbers(columns.tax_content!),
    services_domestic: numbers(columns.services_domestic!),
    services_foreign: numbers(columns.services_foreign!),
    services_total: numbers(columns.services_total!),
    services_share: numbers(columns.services_share!),
    export_index: numbers(columns.export_index!),
    export_growth_volume: numbers(columns.export_growth_volume!),
  }
}

function toServices(columns: Record<string, (string | number | boolean | null)[]>): ServicesTable {
  return {
    n: columns.source_industry!.length,
    economy: strings(columns.economy!),
    year: ints(columns.year!),
    source_industry: strings(columns.source_industry!),
    projected: flags(columns.projected!),
    dva: numbers(columns.dva!),
    fva: numbers(columns.fva!),
  }
}

/** Load the whole package. ~600 kB gzipped in total; the industry tier is fetched with the rest. */
export async function loadDashboardData(signal?: AbortSignal): Promise<DashboardData> {
  const [metadata, world, country, industry, services] = await Promise.all([
    fetchJson<Metadata>('metadata.json', signal),
    fetchJson<ColumnarPayload>('world.json', signal),
    fetchJson<ColumnarPayload>('country.json', signal),
    fetchJson<ColumnarPayload>('industry.json', signal),
    fetchJson<ColumnarPayload>('services_country.json', signal),
  ])

  const data: DashboardData = {
    metadata,
    world: toWorld(decode(world).columns),
    country: toCountry(decode(country).columns),
    industry: toIndustry(decode(industry).columns),
    services: toServices(decode(services).columns),
  }

  assertShape(data)
  return data
}

/**
 * Fail loudly on a package that would render as a plausible but wrong chart. These are the
 * assumptions the views are built on; if a future release breaks one, better to say so than
 * to draw a shorter bar.
 */
function assertShape(data: DashboardData): void {
  const years = data.metadata.coverage.years
  if (data.world.n !== years.length) {
    throw new Error(`world.json has ${data.world.n} years, expected ${years.length}.`)
  }
  if (data.country.n !== years.length * data.metadata.coverage.economies) {
    throw new Error('country.json does not cover every economy-year.')
  }
  const projected = new Set(data.metadata.coverage.projected_years)
  for (let i = 0; i < data.country.n; i += 1) {
    if (data.country.projected[i] !== projected.has(data.country.year[i]!)) {
      throw new Error('country.json projected flag disagrees with metadata.coverage.')
    }
  }
  if (data.metadata.group_order.length !== GROUPS.length) {
    throw new Error('metadata.group_order is not the expected six-sector grouping.')
  }
}

/* ------------------------------------------------------------------ *
 * Accessors
 *
 * The country table is one row per (economy, year); the industry and services tables are
 * long. Views want both, so provide both rather than letting each view re-derive its own
 * (and get the projected-year handling subtly different).
 * ------------------------------------------------------------------ */

/** Row index of one economy-year in the country table, or -1. */
export function countryIndex(data: DashboardData, economy: string, year: number): number {
  return data.country.economy.findIndex((code, i) => code === economy && data.country.year[i] === year)
}

/** Row index of one year in the world table, or -1. */
export function worldIndex(data: DashboardData, year: number): number {
  return data.world.year.indexOf(year)
}

/** Every economy row for one year, as `[economyCode, rowIndex]` pairs. Excludes "rest of world". */
export function economiesForYear(data: DashboardData, year: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (let i = 0; i < data.country.n; i += 1) {
    if (data.country.year[i] !== year) continue
    const code = data.country.economy[i]!
    if (code === 'ROW' || seen.has(code)) continue
    seen.add(code)
    out.push(code)
  }
  return out
}

/** Industry rows for one economy-year, in the metadata's manufacturing order. */
export function industryRows(data: DashboardData, economy: string, year: number): number[] {
  const out: number[] = []
  for (let i = 0; i < data.industry.n; i += 1) {
    if (data.industry.economy[i] === economy && data.industry.year[i] === year) out.push(i)
  }
  return out
}

/** Services rows for one economy-year, in the metadata's source-industry order. */
export function servicesRows(data: DashboardData, economy: string, year: number): number[] {
  const out: number[] = []
  for (let i = 0; i < data.services.n; i += 1) {
    if (data.services.economy[i] === economy && data.services.year[i] === year) out.push(i)
  }
  return out
}

/** A complete time series for one economy, read through a country-table accessor. */
export function countrySeries(
  data: DashboardData,
  economy: string,
  field: (row: number) => Numeric,
): { year: number; value: Numeric; projected: boolean }[] {
  return data.metadata.coverage.years.map((year) => {
    const i = countryIndex(data, economy, year)
    return {
      year,
      value: i >= 0 ? field(i) : null,
      projected: data.metadata.coverage.projected_years.includes(year),
    }
  })
}

/** Economy codes sorted by one field, descending. */
export function rankEconomies(
  data: DashboardData,
  year: number,
  value: (i: number) => Numeric,
): { code: string; value: number }[] {
  const rows: { code: string; value: number }[] = []
  for (const code of economiesForYear(data, year)) {
    const i = countryIndex(data, code, year)
    const v = i >= 0 ? value(i) : null
    if (v !== null) rows.push({ code, value: v })
  }
  return rows.sort((a, b) => b.value - a.value)
}
