/**
 * Long-run facts: great ratios, growth, productivity, labour share, hours per capita.
 * Everything is computed in the browser from raw_series already in the artifact,
 * mirroring src/usa/empirical/usa_core.py in the research repository.
 */
import type { Artifact } from './artifact-types';
import type { ChartPoint, SeriesSlice } from './artifact';

export const LONGRUN_PANELS = [
  'great-ratios',
  'growth',
  'productivity-wages',
  'productivity-tfp',
  'labour-share',
  'hours-per-capita',
] as const;
export type LongRunPanel = (typeof LONGRUN_PANELS)[number];

export interface LongRunSpec {
  id: LongRunPanel;
  tab: string;
  title: string;
  unit: string;
  note: string;
  caveat: string;
  dashed?: boolean[];
}

export const LONGRUN_SPECS: Record<LongRunPanel, LongRunSpec> = {
  'great-ratios': {
    id: 'great-ratios',
    tab: 'Great ratios',
    title: 'Consumption and investment as shares of output',
    unit: 'percent of nominal GDP',
    note: 'Both ratios fluctuate within a band for over seventy years, with no strong trend.',
    caveat:
      'Consumption is nondurables plus services; investment is fixed investment plus consumer durables. Government spending and net exports make up the remainder.',
  },
  growth: {
    id: 'growth',
    tab: 'Real GDP',
    title: 'Real GDP, total and per capita (log scale)',
    unit: 'log real GDP (2017 dollars)',
    note: 'On a log scale, the slope reads as the growth rate. The gap between the lines is population growth.',
    caveat: 'Per-capita series starts in 1948 because the population series (civilian, 16+) does not cover 1947.',
  },
  'productivity-wages': {
    id: 'productivity-wages',
    tab: 'Output, productivity, pay',
    title: 'Output per capita, output per hour, and real compensation per hour',
    unit: 'index, first valid observation = 100',
    note: 'Each series is indexed to 100 at its first observation, so the chart shows cumulative growth, not levels.',
    caveat:
      'Output per hour and compensation per hour refer to the nonfarm business sector; GDP per capita covers the whole economy.',
  },
  'productivity-tfp': {
    id: 'productivity-tfp',
    tab: 'Productivity vs. TFP',
    title: 'Labour productivity, measured TFP, and utilization-adjusted TFP',
    unit: 'index, first valid observation = 100',
    note: 'Fernald TFP is built from quarterly growth rates; the utilization-adjusted series removes variation in factor utilization.',
    caveat: 'Indexed to each series\u2019 first valid observation. Index levels of different series are not comparable beyond growth.',
    dashed: [false, false, true],
  },
  'labour-share': {
    id: 'labour-share',
    tab: 'Labour share',
    title: 'Labour share of income',
    unit: 'percent',
    note: 'The two measures differ in scope: the nonfarm business sector versus the whole economy.',
    caveat:
      'The BLS measure covers the nonfarm business sector. The second line divides economy-wide compensation of employees by nominal GDP.',
  },
  'hours-per-capita': {
    id: 'hours-per-capita',
    tab: 'Hours per capita',
    title: 'Hours per capita (log level)',
    unit: 'log hours index per million persons',
    note: 'Hours worked per adult show no sustained trend over the postwar period, while output per person grew several-fold.',
    caveat: 'Nonfarm business hours divided by civilian noninstitutional population aged 16+, so a normalized index, not hours per person.',
  },
};

type Raw = Record<string, number>;

function rawMap(a: Artifact, id: string): Raw {
  const out: Raw = {};
  for (const o of a.raw_series[id].observations) if (o.value !== null) out[o.date] = o.value;
  return out;
}

function build(dates: string[], f: (d: string) => number | null): ChartPoint[] {
  return dates.map((date) => {
    const v = f(date);
    return { date, value: v !== null && Number.isFinite(v) ? v : null };
  });
}

/** Rescale so the first non-missing value equals 100. */
function indexTo100(points: ChartPoint[]): ChartPoint[] {
  const base = points.find((p) => p.value !== null)?.value;
  if (!base) return points;
  return points.map((p) => ({ date: p.date, value: p.value === null ? null : (p.value / base) * 100 }));
}

function slice(key: string, label: string, unit: string, points: ChartPoint[]): SeriesSlice {
  return { key, label, unit, points };
}

export function getLongRunSlices(a: Artifact, panel: LongRunPanel): SeriesSlice[] {
  const dates = a.raw_series.GDP.observations.map((o) => o.date);
  const g = (id: string) => rawMap(a, id);
  const GDP = g('GDP'), PCND = g('PCND'), PCESV = g('PCESV'), FPI = g('FPI'), PCDG = g('PCDG');
  const DEF = g('GDPDEF'), POP = g('CNP16OV'), HRS = g('HOANBS');
  const unit = LONGRUN_SPECS[panel].unit;
  const realGdp = (d: string) => (GDP[d] !== undefined && DEF[d] ? GDP[d] / (DEF[d] / 100) : null);
  const realGdpPc = (d: string) => {
    const r = realGdp(d);
    return r !== null && POP[d] ? r / (POP[d] / 1000) : null;
  };

  switch (panel) {
    case 'great-ratios':
      return [
        slice('c_y', 'Consumption / output', unit, build(dates, (d) => (GDP[d] && PCND[d] !== undefined && PCESV[d] !== undefined ? (100 * (PCND[d] + PCESV[d])) / GDP[d] : null))),
        slice('i_y', 'Investment / output', unit, build(dates, (d) => (GDP[d] && FPI[d] !== undefined && PCDG[d] !== undefined ? (100 * (FPI[d] + PCDG[d])) / GDP[d] : null))),
      ];
    case 'growth':
      return [
        slice('gdp', 'Real GDP, total', unit, build(dates, (d) => { const r = realGdp(d); return r === null ? null : Math.log(r); })),
        slice('gdp_pc', 'Real GDP per capita', unit, build(dates, (d) => { const r = realGdpPc(d); return r === null ? null : Math.log(r); })),
      ];
    case 'productivity-wages':
      return [
        slice('gdp_pc', 'Real GDP per capita', unit, indexTo100(build(dates, realGdpPc))),
        slice('oph', 'Output per hour', unit, indexTo100(build(dates, (d) => g('OPHNFB')[d] ?? null))),
        slice('comp', 'Real compensation per hour', unit, indexTo100(build(dates, (d) => g('COMPRNFB')[d] ?? null))),
      ];
    case 'productivity-tfp':
      return [
        slice('oph', 'Labour productivity (output per hour)', unit, indexTo100(build(dates, (d) => g('OPHNFB')[d] ?? null))),
        slice('tfp', 'Measured TFP', unit, indexTo100(build(dates, (d) => g('dtfp_level')[d] ?? null))),
        slice('tfp_util', 'Utilization-adjusted TFP', unit, indexTo100(build(dates, (d) => g('dtfp_util_level')[d] ?? null))),
      ];
    case 'labour-share':
      return [
        slice('bls', 'BLS nonfarm business labour share', unit, build(dates, (d) => g('LABSHR_BLS')[d] ?? null)),
        slice('gdi', 'Compensation of employees / GDP', unit, build(dates, (d) => (GDP[d] && g('GDICOMP')[d] !== undefined ? (100 * g('GDICOMP')[d]) / GDP[d] : null))),
      ];
    case 'hours-per-capita':
      return [
        slice('hpc', 'Log hours per capita', unit, build(dates, (d) => (HRS[d] && POP[d] ? Math.log(HRS[d] / (POP[d] / 1000)) : null))),
      ];
  }
}

/** Plain-language summary numbers shown beside each chart (first and last valid value, range). */
export function summarize(slices: SeriesSlice[]): { label: string; first: number; last: number; min: number; max: number; start: string; end: string }[] {
  return slices.map((s) => {
    const v = s.points.filter((p) => p.value !== null) as { date: string; value: number }[];
    const values = v.map((p) => p.value);
    return {
      label: s.label,
      first: v[0].value,
      last: v[v.length - 1].value,
      min: Math.min(...values),
      max: Math.max(...values),
      start: v[0].date,
      end: v[v.length - 1].date,
    };
  });
}
