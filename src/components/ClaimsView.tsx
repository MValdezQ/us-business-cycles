import type { Artifact, Moment, SampleId, SeriesId } from '../lib/artifact-types';
import { fmt } from '../lib/format';

export interface Claim {
  id: string;
  claim: string;
  focus: SeriesId[];
  statLabel: string;
  evidence: (m: Record<SeriesId, Moment>) => { stat: string; value: string; verdict: string };
  caveat?: string;
}

export const CLAIMS: Claim[] = [
  {
    id: 'consumption-smoother',
    claim: "Consumption's cyclical volatility relative to output",
    focus: ['log_C_pc', 'log_Y_pc'],
    statLabel: 'SD(C cycle) / SD(Y cycle)',
    evidence: (m) => {
      const r = m.log_C_pc.rel_std_dev;
      return {
        stat: 'SD(C cycle) / SD(Y cycle)',
        value: fmt(r, 2),
        verdict: `In this sample, the consumption cycle's standard deviation is ${fmt(r, 2)} times the output cycle's, so it fluctuates ${r < 1 ? 'less' : r > 1 ? 'more' : 'as much'} than output.`,
      };
    },
    caveat:
      'This is constructed nominal nondurables plus services deflated with the GDP deflator, not official BEA real consumption. Durables are grouped with investment; this construction does not by itself establish that the exclusions cause the observed difference.',
  },
  {
    id: 'investment-volatile',
    claim: "Investment's cyclical volatility relative to output",
    focus: ['log_I_pc', 'log_Y_pc'],
    statLabel: 'SD(I cycle) / SD(Y cycle)',
    evidence: (m) => {
      const r = m.log_I_pc.rel_std_dev;
      return {
        stat: 'SD(I cycle) / SD(Y cycle)',
        value: fmt(r, 2),
        verdict: `In this sample, the investment cycle's standard deviation is ${fmt(r, 2)} times the output cycle's.`,
      };
    },
    caveat: 'Investment is fixed investment plus consumer durables, so it is broader than NIPA fixed investment alone.',
  },
  {
    id: 'hours-cyclical',
    claim: "Hours' comovement and volatility relative to output",
    focus: ['log_hours_pc', 'log_Y_pc'],
    statLabel: 'Corr(hours, Y) · Relative SD',
    evidence: (m) => {
      const c = m.log_hours_pc.corr_y;
      const r = m.log_hours_pc.rel_std_dev;
      return {
        stat: 'Corr(hours, Y) and SD ratio',
        value: `${fmt(c, 2)} · ${fmt(r, 2)}`,
        verdict: `In this sample, hours have a ${fmt(c, 2)} correlation with output and a cyclical standard deviation ${fmt(r, 2)} times output's.`,
      };
    },
    caveat: 'Hours is a normalized index per capita, not hours per person.',
  },
  {
    id: 'factor-prices',
    claim: 'Real compensation and hours',
    focus: ['log_wage', 'log_productivity', 'log_hours_pc', 'log_I_pc'],
    statLabel: 'SD(wage)/SD(Y) vs SD(hours)/SD(Y)',
    evidence: (m) => {
      const w = m.log_wage.rel_std_dev;
      const h = m.log_hours_pc.rel_std_dev;
      return {
        stat: 'SD(wage)/SD(Y) vs SD(hours)/SD(Y)',
        value: `${fmt(w, 2)} vs ${fmt(h, 2)}`,
        verdict: `Real compensation fluctuates ${w < h ? 'less' : w > h ? 'more' : 'as much'} than hours in this sample: its cyclical standard deviation relative to output is ${fmt(w, 2)}, versus ${fmt(h, 2)} for hours.`,
      };
    },
    caveat:
      'The measure is a compensation index, not a dollar wage, and is measured for the nonfarm business sector. Composition effects over the cycle are not removed.',
  },
  {
    id: 'real-rate-weak',
    claim: "Real rate's comovement with output",
    focus: ['real_rate', 'log_Y_pc'],
    statLabel: 'Corr(real rate, Y)',
    evidence: (m) => {
      const c = m.real_rate.corr_y;
      return {
        stat: 'Corr(real rate, Y)',
        value: fmt(c, 2),
        verdict: `In this sample, the real rate's contemporaneous correlation with output is ${fmt(c, 2)}.`,
      };
    },
    caveat:
      'This is a provisional measurement using a quarterly Treasury input whose original aggregation has not been verified, minus realized next-quarter GDP-deflator inflation. It is not a new empirical result.',
  },
];

export default function ClaimsView({
  artifact,
  sampleId,
  onInspect,
}: {
  artifact: Artifact;
  sampleId: SampleId;
  onInspect: (focus: SeriesId[]) => void;
}) {
  const byId = Object.fromEntries(
    artifact.sample_results[sampleId].moments.map((m) => [m.series_id, m]),
  ) as Record<SeriesId, Moment>;

  return (
    <div className="claims">
      {CLAIMS.map((c) => {
        const e = c.evidence(byId);
        return (
          <article className="claim-card" key={c.id}>
            <header>
              <h3>{c.claim}</h3>
            </header>
            <p className="stat-line">
              <span className="stat-name">{e.stat}</span>
              <span className="stat-value">{e.value}</span>
            </p>
            <p className="verdict-text">{e.verdict}</p>
            {c.caveat && <p className="footnote">{c.caveat}</p>}
            <button type="button" className="inspect" onClick={() => onInspect(c.focus)}>
              Inspect the cycles →
            </button>
          </article>
        );
      })}
      <p className="footnote wide">These are descriptive comparisons for the selected sample, not statistical tests. No standard errors or significance claims are provided.</p>
    </div>
  );
}
