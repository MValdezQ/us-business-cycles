import { useState } from 'react';
import { SERIES_ORDER } from '../lib/artifact';
import type { Artifact, Moment, SampleId, SeriesId } from '../lib/artifact-types';
import { fmt } from '../lib/format';

type SortKey = keyof Omit<Moment, 'series_id'> | 'series_id';

const COLS: { key: SortKey; label: string; help: string }[] = [
  { key: 'series_id', label: 'Series', help: 'Analysis series identifier' },
  { key: 'std_dev', label: 'SD', help: 'Sample standard deviation of the HP cycle (ddof = 1)' },
  { key: 'rel_std_dev', label: 'SD / SD(Y)', help: 'Volatility relative to output' },
  { key: 'corr_y', label: 'Corr(x, Y)', help: 'Contemporaneous correlation with the output cycle' },
  { key: 'autocorr', label: 'AR(1)', help: 'First-order autocorrelation, corr(x_t, x_{t-1})' },
  { key: 'corr_y_lag4', label: 'Corr(x_t, Y_{t-4})', help: 'Output four quarters earlier' },
  { key: 'corr_y_lead4', label: 'Corr(x_t, Y_{t+4})', help: 'Output four quarters later' },
];

export default function MomentsTable({
  artifact,
  sampleId,
  highlight,
  onPickSeries,
}: {
  artifact: Artifact;
  sampleId: SampleId;
  highlight: SeriesId[];
  onPickSeries?: (id: SeriesId) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'series_id', dir: 1 });
  const moments = artifact.sample_results[sampleId].moments;
  const def = artifact.sample_definitions[sampleId];

  const rows = [...moments].sort((a, b) => {
    if (sort.key === 'series_id') {
      return (SERIES_ORDER.indexOf(a.series_id) - SERIES_ORDER.indexOf(b.series_id)) * sort.dir;
    }
    return ((a[sort.key] as number) - (b[sort.key] as number)) * sort.dir;
  });

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Benchmark moments — {def.name}</h3>
        <p className="muted">
          HP cycles, lambda = {artifact.sample_results[sampleId].hp_lambda}, re-filtered within this
          sample. {def.n_quarters} quarters. Values are read directly from the artifact.
        </p>
      </div>
      <div className="table-scroll">
        <table className="moments">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  title={c.help}
                  aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                >
                  <button
                    type="button"
                    className="th-btn"
                    onClick={() =>
                      setSort((s) =>
                        s.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: -1 },
                      )
                    }
                  >
                    {c.label}
                    {sort.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const s = artifact.series[m.series_id];
              const isRate = m.series_id === 'real_rate';
              return (
                <tr
                  key={m.series_id}
                  className={highlight.includes(m.series_id) ? 'hl' : ''}
                  onClick={() => onPickSeries?.(m.series_id)}
                >
                  <th scope="row">
                    <span className="series-name">{s.label}</span>
                    <code className="series-id">{m.series_id}</code>
                  </th>
                  <td>{fmt(m.std_dev, 4)}</td>
                  <td className="emph">
                    {fmt(m.rel_std_dev, 2)}
                    {isRate && <sup title="Decimal-rate units, not comparable to logged quantities">†</sup>}
                  </td>
                  <td className="emph">{fmt(m.corr_y, 2)}</td>
                  <td>{fmt(m.autocorr, 2)}</td>
                  <td>{fmt(m.corr_y_lag4, 2)}</td>
                  <td>{fmt(m.corr_y_lead4, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="footnote">
        † The real rate is in quarterly decimal-rate units. Its standard deviation and relative
        volatility are not comparable with logged quantities; read its correlation column, not its
        SD ratio.
      </p>
      <p className="footnote">{artifact.moments_definition}</p>
    </div>
  );
}
