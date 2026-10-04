/**
 * Data contract for `us-business-cycles-v1`.
 *
 * These types are a hand-written mirror of `public/data/us-business-cycles-v1.schema.json`
 * ($id: urn:macro-project:us-business-cycles:v1). The app reads the artifact and never
 * mutates it. Anything the app derives in the browser is marked as derived at the call
 * site and is reconciled against artifact-reported values where the artifact reports them.
 */

export const SERIES_IDS = [
  'log_Y_pc',
  'log_C_pc',
  'log_I_pc',
  'log_hours_pc',
  'log_productivity',
  'log_wage',
  'real_rate',
  'log_price',
  'log_tfp',
  'log_tfp_util',
] as const;

export type SeriesId = (typeof SERIES_IDS)[number];

export const SAMPLE_IDS = ['full', 'pre_1984', 'post_1984'] as const;
export type SampleId = (typeof SAMPLE_IDS)[number];

/** The four representations the UI exposes. */
export const REPRESENTATIONS = ['source', 'level', 'transformed', 'cycle', 'trend'] as const;
export type Representation = (typeof REPRESENTATIONS)[number];

export interface SampleCoverage {
  start: string;
  end: string;
  n_quarters: number;
  sample_id: string;
}

export interface RawSeriesCoverage {
  start: string;
  end: string;
  n_rows: number;
  n_nonmissing: number;
  nonmissing_start: string;
  nonmissing_end: string;
}

export interface Observation {
  date: string;
  /** exp(transformed); `null` for `real_rate`, which is already a level rate. */
  economic_level: number | null;
  transformed: number | null;
  /** Full-canonical-sample HP components. Subsample components live in `sample_results`. */
  hp_trend: number | null;
  hp_cycle: number | null;
}

export interface AnalysisSeries {
  label: string;
  observations: Observation[];
  source_series_ids: string[];
  transformation: string;
  transformed_unit: string;
  hp_component_unit: string;
  economic_level_unit?: string;
  economic_level_definition?: string;
  pipeline_unit_label: string;
  sample_coverage: SampleCoverage;
}

export interface RawObservation {
  date: string;
  value: number | null;
}

export interface RawSeries {
  label: string;
  observations: RawObservation[];
  provider: string;
  source_file: string;
  source_url: string;
  unit: string;
  pipeline_unit_label: string;
  local_file_modified_date: string;
  sample_coverage: RawSeriesCoverage;
}

export interface Moment {
  series_id: SeriesId;
  std_dev: number;
  rel_std_dev: number;
  corr_y: number;
  autocorr: number;
  /** corr(x_t, Y_{t-4}) */
  corr_y_lag4: number;
  /** corr(x_t, Y_{t+4}) */
  corr_y_lead4: number;
}

export interface Ar1Estimate {
  rho: number;
  innovation_sd: number;
}

export interface SampleDefinition {
  name: string;
  start: string;
  end: string;
  n_quarters: number;
}

export interface SampleResult {
  dates: string[];
  hp_lambda: 1600;
  /** Sample-specific HP trend/cycle, re-estimated inside the window. */
  series: Record<SeriesId, { hp_trend: number[]; hp_cycle: number[] }>;
  moments: Moment[];
  tfp_hp_ar1_no_constant: Record<'log_tfp' | 'log_tfp_util', Ar1Estimate>;
}

export interface Provenance {
  digest_algorithm: string;
  sources: string;
  source_lineage_check: string;
  vintage_caveat: string;
  source_file_sha256: Record<string, string>;
  research_code_sha256: Record<string, string>;
  research_input_sha256: Record<string, string>;
}

export interface Artifact {
  artifact_id: 'us-business-cycles-v1';
  schema_version: number;
  title: string;
  frequency: 'quarterly';
  date_convention: string;
  dates: string[];
  canonical_sample: SampleDefinition & { output_series_id: SeriesId };
  sample_definitions: Record<SampleId, SampleDefinition>;
  sample_results: Record<SampleId, SampleResult>;
  hp_filter: { lambda: number; application: string };
  series: Record<SeriesId, AnalysisSeries>;
  raw_series: Record<string, RawSeries>;
  moments: Moment[];
  moments_definition: string;
  representation_notes: string[];
  tfp_process: {
    sample: string;
    linear_detrend: string;
    model_calibration_status: string;
    estimates: Record<
      'log_tfp' | 'log_tfp_util',
      {
        hp_cycle_ar1_no_constant: Ar1Estimate;
        linear_detrend_ar1_no_constant: Ar1Estimate;
      }
    >;
  };
  source_licensing: {
    redistribution_clearance: string;
    official_vintage_available: boolean;
    warning: string;
  };
  provenance: Provenance;
}
