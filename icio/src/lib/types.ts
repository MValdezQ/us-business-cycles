/**
 * Types for the published dashboard data package.
 *
 * The Python side (`uv run python -m icio.publish`) writes columnar JSON: a dictionary per
 * dimension plus integer-coded dimension columns and one array per value column. Nothing
 * here is derived on the client — every number is read straight from the package, so the
 * dashboard and the Python analysis can never disagree.
 */

/** A value that may legitimately be absent (inactive cell, undefined growth, no services). */
export type Numeric = number | null

/** The raw shape of every published `.json` file except `metadata.json`. */
export interface ColumnarPayload {
  dims: Record<string, string[]>
  count: number
  columns: Record<string, number[] | Numeric[] | boolean[]>
}

export interface Metadata {
  dataset: string
  release_vintage: string
  coverage: {
    years: number[]
    economies: number
    industries: number
    projected_years: number[]
    note: string
  }
  definitions: Record<string, string>
  labels: {
    economies: Record<string, string>
    industries: Record<string, string>
  }
  industry_groups: Record<string, GroupId>
  group_order: GroupId[]
  services_source_industries: string[]
  manufacturing_industries: string[]
  attribution: string
  licensing_note: string
}

export type GroupId =
  | 'agriculture'
  | 'mining'
  | 'manufacturing'
  | 'utilities'
  | 'construction'
  | 'services'

/** One row per year: world manufacturing totals. */
export interface WorldTable {
  n: number
  year: number[]
  projected: boolean[]
  mfg_exports: Numeric[]
  dva_share_incl_tax: Numeric[]
  fva_share_incl_tax: Numeric[]
  services_total: Numeric[]
  services_share: Numeric[]
  services_domestic_share: Numeric[]
  export_growth_nominal: Numeric[]
}

/** One row per economy-year: headline manufacturing export indicators. */
export interface CountryTable {
  n: number
  economy: string[]
  year: number[]
  projected: boolean[]
  mfg_exports: Numeric[]
  mfg_value_added: Numeric[]
  dva_share_incl_tax: Numeric[]
  fva_share_incl_tax: Numeric[]
  dva_share_excl_tax: Numeric[]
  dva_exports_incl_tax: Numeric[]
  fva_exports_incl_tax: Numeric[]
  tax_content: Numeric[]
  tax_content_domestic: Numeric[]
  tax_content_foreign: Numeric[]
  services_domestic: Numeric[]
  services_foreign: Numeric[]
  services_total: Numeric[]
  services_share: Numeric[]
  services_domestic_share: Numeric[]
  export_index: Numeric[]
  export_growth_volume: Numeric[]
  export_growth_nominal: Numeric[]
  export_growth_volume_cumulative: Numeric[]
  export_growth_nominal_cumulative: Numeric[]
  dva_from: Record<GroupId, Numeric[]>
  fva_from: Record<GroupId, Numeric[]>
}

/** One row per economy-year-manufacturing-industry. */
export interface IndustryTable {
  n: number
  economy: string[]
  year: number[]
  industry: string[]
  projected: boolean[]
  active: boolean[]
  exports: Numeric[]
  value_added: Numeric[]
  dva_share_incl_tax: Numeric[]
  tax_content: Numeric[]
  services_domestic: Numeric[]
  services_foreign: Numeric[]
  services_total: Numeric[]
  services_share: Numeric[]
  export_index: Numeric[]
  export_growth_volume: Numeric[]
}

/** One row per economy-year-source-service-industry (services embodied in all manufacturing exports). */
export interface ServicesTable {
  n: number
  economy: string[]
  year: number[]
  source_industry: string[]
  projected: boolean[]
  dva: Numeric[]
  fva: Numeric[]
}

export interface DashboardData {
  metadata: Metadata
  world: WorldTable
  country: CountryTable
  industry: IndustryTable
  services: ServicesTable
}
