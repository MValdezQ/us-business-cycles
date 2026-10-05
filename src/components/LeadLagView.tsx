import { useMemo } from 'react';
import type { Artifact, SampleId, SeriesId } from '../lib/artifact-types';
import { MAX_HORIZON, leadLagProfile, timingVerdict } from '../lib/leadlag';
import { fmt } from '../lib/format';
import { PALETTE } from './TimeSeriesChart';

const W = 760;
const H = 300;
const M = { top: 18, right: 16, bottom: 46, left: 56 };

export default function LeadLagView({
  artifact,
  sampleId,
  seriesIds,
}: {
  artifact: Artifact;
  sampleId: SampleId;
  seriesIds: SeriesId[];
}) {
  const outputId = artifact.canonical_sample.output_series_id;
  const profiles = useMemo(
    () => seriesIds.map((id) => leadLagProfile(artifact, id, sampleId)),
    [artifact, sampleId, seriesIds],
  );

  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const x = (k: number) => M.left + ((k + MAX_HORIZON) / (2 * MAX_HORIZON)) * innerW;
  const y = (c: number) => M.top + innerH - ((c + 1) / 2) * innerH;

  const worstGap = Math.max(0, ...profiles.map((p) => p.maxReconciliationGap));

  return (
    <div className="panel">
      {seriesIds.includes('real_rate') && (
        <p className="callout warn">Real-rate correlations are provisional: the Treasury input’s original monthly-to-quarterly convention is unverified. The ex-post rate uses next-quarter realized inflation; timing is partly determined by that construction.</p>
      )}
      <div className="panel-head">
        <h3>Lead/lag correlation with output</h3>
        <p className="muted">
          corr(x<sub>t</sub>, Y<sub>t+k</sub>) on HP cycles of the{' '}
          {artifact.sample_definitions[sampleId].name} sample. k &gt; 0 means the series moves
          <em> before</em> output (it leads); k &lt; 0 means it moves after (it lags).
        </p>
      </div>

      <svg className="leadlag" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Lead/lag correlation profile">
        {[-1, -0.5, 0, 0.5, 1].map((c) => (
          <g key={c}>
            <line className={c === 0 ? 'zero' : 'grid'} x1={M.left} x2={M.left + innerW} y1={y(c)} y2={y(c)} />
            <text className="tick" x={M.left - 8} y={y(c)} textAnchor="end" dominantBaseline="middle">
              {c.toFixed(1)}
            </text>
          </g>
        ))}
        {Array.from({ length: 2 * MAX_HORIZON + 1 }, (_, i) => i - MAX_HORIZON)
          .filter((k) => k % 2 === 0)
          .map((k) => (
            <text key={k} className="tick" x={x(k)} y={M.top + innerH + 18} textAnchor="middle">
              {k > 0 ? `+${k}` : k}
            </text>
          ))}
        <line className="axis" x1={x(0)} x2={x(0)} y1={M.top} y2={M.top + innerH} />

        {profiles.map((p, i) => {
          const color = PALETTE[i % PALETTE.length];
          const d = p.points
            .filter((pt) => Number.isFinite(pt.corr))
            .map((pt, j) => `${j === 0 ? 'M' : 'L'}${x(pt.k).toFixed(1)},${y(pt.corr).toFixed(1)}`)
            .join('');
          return (
            <g key={p.seriesId}>
              <path className="line" d={d} stroke={color} />
              {p.points
                .filter((pt) => pt.reported && Number.isFinite(pt.corr))
                .map((pt) => (
                  <circle
                    key={`${p.seriesId}-${pt.k}`}
                    cx={x(pt.k)}
                    cy={y(pt.corr)}
                    r={4.5}
                    fill="#fff"
                    stroke={color}
                    strokeWidth={2}
                  >
                    <title>
                      k = {pt.k}: artifact-reported value {fmt(pt.artifactValue, 4)}
                    </title>
                  </circle>
                ))}
            </g>
          );
        })}

        <text className="axis-title" x={M.left + innerW / 2} y={H - 8} textAnchor="middle">
          k (quarters) — left: series lags output · right: series leads output
        </text>
      </svg>

      <div className="legend">
        {profiles.map((p, i) => (
          <span key={p.seriesId} className="legend-item">
            <i style={{ background: PALETTE[i % PALETTE.length] }} />
            {p.label}
          </span>
        ))}
      </div>

      <div className="table-scroll">
      <table className="moments compact">
        <thead>
          <tr>
            <th>Series</th>
            <th>Peak |corr| at k</th>
            <th>Peak corr</th>
            <th>Reading</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.seriesId}>
              <th scope="row">{p.label}</th>
              <td>{p.peakK > 0 ? `+${p.peakK}` : p.peakK}</td>
              <td className="emph">{fmt(p.peakCorr, 2)}</td>
              <td className="reading">
                {p.seriesId === outputId ? 'output itself (reference series)' : timingVerdict(p)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <p className="footnote">
        Hollow markers at k = −4, 0, +4 are the horizons the artifact itself publishes
        (<code>corr_y_lag4</code>, <code>corr_y</code>, <code>corr_y_lead4</code>). The rest of the
        curve is computed in your browser from the artifact's HP cycles with the same estimator.
        Largest disagreement at the published horizons:{' '}
        <strong>{worstGap < 1e-9 ? 'exact match (< 1e-9)' : worstGap.toExponential(2)}</strong>.
      </p>
    </div>
  );
}
