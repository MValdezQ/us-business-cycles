import type { Artifact, Moment, SampleId, SeriesId } from '../lib/artifact-types';
import { fmt } from '../lib/format';

export interface Claim {
  id: string;
  claim: string;
  focus: SeriesId[];
  statLabel: string;
  evidence: (m: Record<SeriesId, Moment>) => { stat: string; value: string; verdict: string; holds: boolean | null };
  caveat?: string;
}

export const CLAIMS: Claim[] = [
  {
    id: 'consumption-smoother',
    claim: 'Consumption is smoother than output.',
    focus: ['log_C_pc', 'log_Y_pc'],
    statLabel: 'SD(C cycle) / SD(Y cycle)',
    evidence: (m) => {
      const r = m.log_C_pc.rel_std_dev;
      return {
        stat: 'SD(C cycle) / SD(Y cycle)',
        value: fmt(r, 2),
        verdict:
          r < 1
            ? `Holds: the consumption cycle is ${fmt(r, 2)}x as volatile as the output cycle, about ${Math.round((1 - r) * 100)}% smoother`
            : 'Does not hold in this sample',
        holds: r < 1,
      };
    },
    caveat:
      'Consumption here is nondurables plus services, not total PCE. Durables are grouped with investment, which is what makes the smoothness result as sharp as it is.',
  },
  {
    id: 'investment-volatile',
    claim: 'Investment is much more volatile than output.',
    focus: ['log_I_pc', 'log_Y_pc'],
    statLabel: 'SD(I cycle) / SD(Y cycle)',
    evidence: (m) => {
      const r = m.log_I_pc.rel_std_dev;
      return {
        stat: 'SD(I cycle) / SD(Y cycle)',
        value: fmt(r, 2),
        verdict: r > 2 ? `Holds: investment is about ${fmt(r, 1)}x as volatile as output` : r > 1 ? 'Partly: more volatile, but less than twice' : 'Does not hold in this sample',
        holds: r > 2,
      };
    },
    caveat: 'Investment is fixed investment plus consumer durables, so it is broader than NIPA fixed investment alone.',
  },
  {
    id: 'hours-cyclical',
    claim: 'Hours are highly cyclical.',
    focus: ['log_hours_pc', 'log_Y_pc'],
    statLabel: 'Corr(hours, Y) · Relative SD',
    evidence: (m) => {
      const c = m.log_hours_pc.corr_y;
      const r = m.log_hours_pc.rel_std_dev;
      return {
        stat: 'Corr(hours, Y) and SD ratio',
        value: `${fmt(c, 2)} · ${fmt(r, 2)}`,
        verdict:
          c > 0.7
            ? `Holds: strongly procyclical (corr ${fmt(c, 2)}) and nearly as volatile as output (${fmt(r, 2)}x)`
            : 'Weaker than claimed in this sample',
        holds: c > 0.7,
      };
    },
    caveat: 'Hours is a normalized index per capita, not hours per person.',
  },
  {
    id: 'factor-prices',
    claim: 'Factor prices move less than quantities.',
    focus: ['log_wage', 'log_productivity', 'log_hours_pc', 'log_I_pc'],
    statLabel: 'SD(wage)/SD(Y) vs SD(hours)/SD(Y)',
    evidence: (m) => {
      const w = m.log_wage.rel_std_dev;
      const h = m.log_hours_pc.rel_std_dev;
      return {
        stat: 'SD(wage)/SD(Y) vs SD(hours)/SD(Y)',
        value: `${fmt(w, 2)} vs ${fmt(h, 2)}`,
        verdict:
          w < h
            ? `Holds: the wage moves ${fmt(h / w, 1)}x less than hours relative to output`
            : 'Does not hold in this sample',
        holds: w < h,
      };
    },
    caveat:
      'The wage is a compensation index, not a dollar wage, and is measured for the nonfarm business sector. Composition effects over the cycle are not removed.',
  },
  {
    id: 'real-rate-weak',
    claim: 'Real rates are only weakly correlated with output.',
    focus: ['real_rate', 'log_Y_pc'],
    statLabel: 'Corr(real rate, Y)',
    evidence: (m) => {
      const c = m.real_rate.corr_y;
      return {
        stat: 'Corr(real rate, Y)',
        value: fmt(c, 2),
        verdict:
          Math.abs(c) < 0.3
            ? `Holds: contemporaneous correlation is only ${fmt(c, 2)}`
            : `Stronger than "weak" here: ${fmt(c, 2)}`,
        holds: Math.abs(c) < 0.3,
      };
    },
    caveat:
      'The real rate is an ex-post 3-month bill rate less realized deflator inflation, in quarterly decimal units. Its SD ratio is not comparable to logged quantities, and the underlying TB3MS aggregation convention is undocumented.',
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
              <span className={`verdict ${e.holds === true ? 'ok' : e.holds === false ? 'no' : 'na'}`}>
                {e.holds === true ? 'supported' : e.holds === false ? 'not supported' : 'see data'}
              </span>
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
      <p className="footnote wide">
        Verdicts are mechanical readings of the artifact's moments for the selected sample
        ({artifact.sample_definitions[sampleId].name}). They are thresholds chosen for exposition,
        not statistical tests: no standard errors, and no inference about whether a difference is
        significant.
      </p>
    </div>
  );
}
