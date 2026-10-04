import {
  type Artifact,
  type SampleId,
  type SeriesId,
  SERIES_IDS,
} from './artifact-types';

export const ARTIFACT_URL = `${import.meta.env.BASE_URL}data/us-business-cycles-v1.json`;
export const SCHEMA_URL = `${import.meta.env.BASE_URL}data/us-business-cycles-v1.schema.json`;

/** Fetch + structural validation. */
export async function loadArtifact(signal?: AbortSignal): Promise<Artifact> {
  const res = await fetch(ARTIFACT_URL, { signal });
  if (!res.ok) {
    throw new Error(`Could not load artifact (HTTP ${res.status}) from ${ARTIFACT_URL}`);
  }
  const json = (await res.json()) as Artifact;
  assertArtifactShape(json);
  return json;
}

function assertArtifactShape(a: Artifact): void {
  if (a?.artifact_id !== 'us-business-cycles-v1') {
    throw new Error(`Unexpected artifact_id: ${String(a?.artifact_id)}`);
  }
  for (const id of SERIES_IDS) {
    if (!a.series?.[id]) throw new Error(`Artifact is missing analysis series "${id}"`);
  }
  for (const s of ['full', 'pre_1984', 'post_1984'] as SampleId[]) {
    const r = a.sample_results?.[s];
    if (!r) throw new Error(`Artifact is missing sample_results."${s}"`);
    if (r.hp_lambda !== 1600) {
      throw new Error(`Sample "${s}" was filtered with lambda ${r.hp_lambda}, expected 1600`);
    }
    if (r.dates.length !== a.sample_definitions[s].n_quarters) {
      throw new Error(`Sample "${s}" date count disagrees with its definition`);
    }
  }
}

/** Display order */
export const SERIES_ORDER: SeriesId[] = [
  'log_Y_pc',
  'log_C_pc',
  'log_I_pc',
  'log_hours_pc',
  'log_wage',
  'log_productivity',
  'real_rate',
  'log_price',
  'log_tfp',
  'log_tfp_util',
];

export const SERIES_LABELS_FULL: Record<SeriesId, { short: string; full: string; category: string; perCapitaApplicable: boolean }> = {
  log_Y_pc: {
    short: 'Output',
    full: 'Real GDP',
    category: 'Per-Capita Quantities',
    perCapitaApplicable: true,
  },
  log_C_pc: {
    short: 'Consumption',
    full: 'Real Consumption (Nondurables + Services)',
    category: 'Per-Capita Quantities',
    perCapitaApplicable: true,
  },
  log_I_pc: {
    short: 'Investment',
    full: 'Real Investment (Fixed Investment + Durables)',
    category: 'Per-Capita Quantities',
    perCapitaApplicable: true,
  },
  log_hours_pc: {
    short: 'Hours',
    full: 'Hours Worked (Nonfarm Business)',
    category: 'Per-Capita Quantities',
    perCapitaApplicable: true,
  },
  log_wage: {
    short: 'Real Wage',
    full: 'Real Compensation per Hour',
    category: 'Factor Prices & Rates',
    perCapitaApplicable: false,
  },
  log_productivity: {
    short: 'Labor Productivity',
    full: 'Output per Hour (Labor Productivity)',
    category: 'Factor Prices & Rates',
    perCapitaApplicable: false,
  },
  real_rate: {
    short: 'Real Interest Rate',
    full: 'Ex-Post Real 3-Month Treasury Bill Rate',
    category: 'Factor Prices & Rates',
    perCapitaApplicable: false,
  },
  log_price: {
    short: 'Price Level',
    full: 'GDP Implicit Price Deflator',
    category: 'Prices & Technology',
    perCapitaApplicable: false,
  },
  log_tfp: {
    short: 'TFP (measured)',
    full: 'Total Factor Productivity (Fernald, Measured)',
    category: 'Prices & Technology',
    perCapitaApplicable: false,
  },
  log_tfp_util: {
    short: 'TFP (util-adj)',
    full: 'Total Factor Productivity (Utilization-Adjusted)',
    category: 'Prices & Technology',
    perCapitaApplicable: false,
  },
};

export const SAMPLE_ORDER: SampleId[] = ['full', 'pre_1984', 'post_1984'];

export type ScaleMode = 'per_capita' | 'aggregate';

export interface ChartPoint {
  date: string;
  value: number | null;
}

export interface SeriesSlice {
  key: string;
  label: string;
  unit: string;
  points: ChartPoint[];
  sampleSpecific?: boolean;
}

const toTime = (iso: string) => Date.parse(iso);

/**
 * Returns the economic level for a series, either per-capita or aggregate.
 */
export function getLevelSlice(
  artifact: Artifact,
  seriesId: SeriesId,
  sampleId: SampleId,
  scale: ScaleMode,
): SeriesSlice {
  const s = artifact.series[seriesId];
  const def = artifact.sample_definitions[sampleId];
  const lo = toTime(def.start);
  const hi = toTime(def.end);

  if (seriesId === 'real_rate') {
    return {
      key: `${seriesId}_rate`,
      label: 'Real Interest Rate',
      unit: 'quarterly decimal rate (e.g. 0.01 = 1%/qtr)',
      points: s.observations
        .filter((o) => toTime(o.date) >= lo && toTime(o.date) <= hi)
        .map((o) => ({ date: o.date, value: o.transformed })),
    };
  }

  // If per-capita is not applicable (wage, productivity, price, tfp), scale is ignored.
  const isPcApplicable = SERIES_LABELS_FULL[seriesId].perCapitaApplicable;
  const effectiveScale = isPcApplicable ? scale : 'per_capita';

  if (effectiveScale === 'per_capita') {
    return {
      key: `${seriesId}_pc`,
      label: `${SERIES_LABELS_FULL[seriesId].short} (per capita)`,
      unit: s.economic_level_unit ?? s.transformed_unit,
      points: s.observations
        .filter((o) => toTime(o.date) >= lo && toTime(o.date) <= hi)
        .map((o) => ({ date: o.date, value: o.economic_level })),
    };
  }

  // Aggregate scale calculation from raw series
  const raw = artifact.raw_series;
  const pMap = new Map(raw['GDPDEF'].observations.map((o) => [o.date, o.value]));

  let unit = 'billions of 2017 dollars (SAAR)';
  let label = `${SERIES_LABELS_FULL[seriesId].short} (aggregate real level)`;

  let calc: (date: string) => number | null = () => null;

  if (seriesId === 'log_Y_pc') {
    const gdpMap = new Map(raw['GDP'].observations.map((o) => [o.date, o.value]));
    calc = (dt) => {
      const gdp = gdpMap.get(dt);
      const defl = pMap.get(dt);
      if (gdp == null || defl == null || defl === 0) return null;
      return gdp / (defl / 100);
    };
  } else if (seriesId === 'log_C_pc') {
    const pcndMap = new Map(raw['PCND'].observations.map((o) => [o.date, o.value]));
    const pcesvMap = new Map(raw['PCESV'].observations.map((o) => [o.date, o.value]));
    calc = (dt) => {
      const c1 = pcndMap.get(dt);
      const c2 = pcesvMap.get(dt);
      const defl = pMap.get(dt);
      if (c1 == null || c2 == null || defl == null || defl === 0) return null;
      return (c1 + c2) / (defl / 100);
    };
  } else if (seriesId === 'log_I_pc') {
    const fpiMap = new Map(raw['FPI'].observations.map((o) => [o.date, o.value]));
    const pcdgMap = new Map(raw['PCDG'].observations.map((o) => [o.date, o.value]));
    calc = (dt) => {
      const i1 = fpiMap.get(dt);
      const i2 = pcdgMap.get(dt);
      const defl = pMap.get(dt);
      if (i1 == null || i2 == null || defl == null || defl === 0) return null;
      return (i1 + i2) / (defl / 100);
    };
  } else if (seriesId === 'log_hours_pc') {
    const hMap = new Map(raw['HOANBS'].observations.map((o) => [o.date, o.value]));
    unit = 'index, 2017=100 (total nonfarm business hours)';
    label = 'Total Hours Worked (index)';
    calc = (dt) => hMap.get(dt) ?? null;
  }

  return {
    key: `${seriesId}_agg`,
    label,
    unit,
    points: s.observations
      .filter((o) => toTime(o.date) >= lo && toTime(o.date) <= hi)
      .map((o) => ({ date: o.date, value: calc(o.date) })),
  };
}

/**
 * Returns log level (transformed) vs HP trend for detrending analysis.
 */
export function getDetrendingSlices(
  artifact: Artifact,
  seriesId: SeriesId,
  sampleId: SampleId,
  scale: ScaleMode,
): { dataSlice: SeriesSlice; trendSlice: SeriesSlice; cycleSlice: SeriesSlice } {
  const s = artifact.series[seriesId];
  const def = artifact.sample_definitions[sampleId];
  const sampleRes = artifact.sample_results[sampleId];
  const lo = toTime(def.start);
  const hi = toTime(def.end);

  const isPcApplicable = SERIES_LABELS_FULL[seriesId].perCapitaApplicable;
  const effectiveScale = isPcApplicable ? scale : 'per_capita';

  // Per-capita is the canonical research pipeline filtering
  if (effectiveScale === 'per_capita' || seriesId === 'real_rate') {
    const dataPoints = s.observations
      .filter((o) => toTime(o.date) >= lo && toTime(o.date) <= hi)
      .map((o) => ({ date: o.date, value: o.transformed }));

    const trendPoints = sampleRes.dates.map((d, i) => ({
      date: d,
      value: sampleRes.series[seriesId].hp_trend[i] ?? null,
    }));

    const cyclePoints = sampleRes.dates.map((d, i) => ({
      date: d,
      value: sampleRes.series[seriesId].hp_cycle[i] ?? null,
    }));

    const shortName = SERIES_LABELS_FULL[seriesId].short;
    const isRate = seriesId === 'real_rate';

    return {
      dataSlice: {
        key: `${seriesId}_data`,
        label: isRate ? 'Real Rate (quarterly rate)' : `${shortName} (natural log, per capita)`,
        unit: s.transformed_unit,
        points: dataPoints,
      },
      trendSlice: {
        key: `${seriesId}_trend`,
        label: `HP Trend (lambda = 1600)`,
        unit: s.hp_component_unit,
        points: trendPoints,
        sampleSpecific: true,
      },
      cycleSlice: {
        key: `${seriesId}_cycle`,
        label: `${shortName} Cycle (data minus trend)`,
        unit: isRate ? 'quarterly rate deviation' : 'log deviation from trend',
        points: cyclePoints,
        sampleSpecific: true,
      },
    };
  }

  // Aggregate log series: ln(Aggregate Real Level)
  // For aggregate HP trend, since the artifact canonical filter is per-capita,
  // ln(Aggregate Level) = ln(Per Capita Level) + ln(Population).
  // Note: Business-cycle moments are computed on the per-capita series.
  const aggLevelSlice = getLevelSlice(artifact, seriesId, sampleId, 'aggregate');
  const popMap = new Map(artifact.raw_series['CNP16OV'].observations.map((o) => [o.date, o.value]));

  const dataPoints = aggLevelSlice.points.map((p) => {
    if (p.value == null || p.value <= 0) return { date: p.date, value: null };
    return { date: p.date, value: Math.log(p.value) };
  });

  // HP trend on aggregate log level: per-capita trend + ln(population/1000)
  // This allows visualizing the aggregate secular growth path directly.
  const trendPoints = sampleRes.dates.map((d, i) => {
    const pcTrend = sampleRes.series[seriesId].hp_trend[i];
    const pop = popMap.get(d);
    if (pcTrend == null || pop == null || pop <= 0) return { date: d, value: null };
    const logPop = Math.log(pop / 1000.0);
    return { date: d, value: pcTrend + logPop };
  });

  const cyclePoints = sampleRes.dates.map((d, i) => ({
    date: d,
    value: sampleRes.series[seriesId].hp_cycle[i] ?? null,
  }));

  const shortName = SERIES_LABELS_FULL[seriesId].short;

  return {
    dataSlice: {
      key: `${seriesId}_agg_log`,
      label: `${shortName} (natural log, aggregate level)`,
      unit: 'natural log of aggregate level',
      points: dataPoints,
    },
    trendSlice: {
      key: `${seriesId}_agg_trend`,
      label: `Secular Trend (HP trend + population trend)`,
      unit: 'natural log of aggregate level',
      points: trendPoints,
      sampleSpecific: true,
    },
    cycleSlice: {
      key: `${seriesId}_agg_cycle`,
      label: `${shortName} Business-Cycle Component`,
      unit: 'log deviation from trend',
      points: cyclePoints,
      sampleSpecific: true,
    },
  };
}

/**
 * Returns HP cycles for comparison across multiple series.
 */
export function getCycleSlice(
  artifact: Artifact,
  seriesId: SeriesId,
  sampleId: SampleId,
): SeriesSlice {
  const sampleRes = artifact.sample_results[sampleId];
  const isRate = seriesId === 'real_rate';

  return {
    key: `${seriesId}_cycle`,
    label: `${SERIES_LABELS_FULL[seriesId].short} cycle`,
    unit: isRate ? 'quarterly rate deviation' : 'log deviation from HP trend',
    points: sampleRes.dates.map((d, i) => ({
      date: d,
      value: sampleRes.series[seriesId].hp_cycle[i] ?? null,
    })),
    sampleSpecific: true,
  };
}
