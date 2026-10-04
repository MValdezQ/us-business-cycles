import type { Artifact, SampleId, SeriesId } from './artifact-types';
import { crossCorrAt } from './stats';

export interface LeadLagPoint {
  k: number;
  corr: number;
  /** True at k = -4, 0, +4, where the artifact publishes its own value. */
  reported: boolean;
  /** Artifact value at a reported horizon, for reconciliation. */
  artifactValue?: number;
}

export interface LeadLagProfile {
  seriesId: SeriesId;
  label: string;
  points: LeadLagPoint[];
  peakK: number;
  peakCorr: number;
  /** Largest absolute gap between browser-computed and artifact-reported values. */
  maxReconciliationGap: number;
}

export const MAX_HORIZON = 8;

/**
 * Lead/lag profile of a series against output, on HP cycles of the selected sample.
 *
 * The artifact reports three horizons (corr_y_lag4, corr_y, corr_y_lead4). To draw a
 * profile we extend to k = -8..+8 in the browser using the same estimator, then check
 * the three published horizons reproduce. `maxReconciliationGap` is surfaced in the UI
 * so a silent methodology drift cannot pass as a result.
 */
export function leadLagProfile(
  artifact: Artifact,
  seriesId: SeriesId,
  sampleId: SampleId,
): LeadLagProfile {
  const result = artifact.sample_results[sampleId];
  const outputId = artifact.canonical_sample.output_series_id;
  const x = result.series[seriesId].hp_cycle;
  const y = result.series[outputId].hp_cycle;
  const m = result.moments.find((mm) => mm.series_id === seriesId);

  const points: LeadLagPoint[] = [];
  let gap = 0;
  for (let k = -MAX_HORIZON; k <= MAX_HORIZON; k++) {
    const c = crossCorrAt(x, y, k);
    let artifactValue: number | undefined;
    if (m) {
      if (k === -4) artifactValue = m.corr_y_lag4;
      else if (k === 0) artifactValue = m.corr_y;
      else if (k === 4) artifactValue = m.corr_y_lead4;
    }
    if (artifactValue !== undefined && Number.isFinite(c)) {
      gap = Math.max(gap, Math.abs(c - artifactValue));
    }
    points.push({
      k,
      corr: c,
      reported: artifactValue !== undefined,
      artifactValue,
    });
  }

  let peak = points[0];
  for (const p of points) {
    if (Number.isFinite(p.corr) && Math.abs(p.corr) > Math.abs(peak.corr)) peak = p;
  }

  return {
    seriesId,
    label: artifact.series[seriesId].label,
    points,
    peakK: peak.k,
    peakCorr: peak.corr,
    maxReconciliationGap: gap,
  };
}

/** Plain-language reading of where the profile peaks. */
export function timingVerdict(profile: LeadLagProfile): string {
  const { peakK, peakCorr } = profile;
  const strength =
    Math.abs(peakCorr) >= 0.7
      ? 'strongly'
      : Math.abs(peakCorr) >= 0.4
        ? 'moderately'
        : Math.abs(peakCorr) >= 0.2
          ? 'weakly'
          : 'very weakly';
  const sign = peakCorr >= 0 ? 'procyclical' : 'countercyclical';
  if (peakK === 0) return `${strength} ${sign}, coincident with output`;
  if (peakK > 0) return `${strength} ${sign}, leads output by ${peakK} quarter${peakK === 1 ? '' : 's'}`;
  return `${strength} ${sign}, lags output by ${-peakK} quarter${peakK === -1 ? '' : 's'}`;
}
