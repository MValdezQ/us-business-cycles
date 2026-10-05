import { ARTIFACT_URL, SCHEMA_URL } from '../lib/artifact';
import type { Artifact } from '../lib/artifact-types';
import { fmt, shortHash } from '../lib/format';

export default function MethodologyPanel({ artifact }: { artifact: Artifact }) {
  const p = artifact.provenance;
  const tfp = artifact.tfp_process;

  return (
    <div className="stack">
      <div className="panel">
        <h3>What this artifact is</h3>
        <p>{artifact.title}</p>
        <dl className="kv">
          <dt>Artifact id</dt>
          <dd>
            <code>{artifact.artifact_id}</code> (schema v{artifact.schema_version})
          </dd>
          <dt>Frequency</dt>
          <dd>{artifact.frequency}</dd>
          <dt>Date convention</dt>
          <dd>{artifact.date_convention}</dd>
          <dt>Canonical sample</dt>
          <dd>
            {artifact.canonical_sample.name} — {artifact.canonical_sample.n_quarters} quarters;
            output reference series <code>{artifact.canonical_sample.output_series_id}</code>
          </dd>
          <dt>Filter</dt>
          <dd>
            Hodrick–Prescott, lambda = {artifact.hp_filter.lambda}. {artifact.hp_filter.application}
          </dd>
          <dt>Moments</dt>
          <dd>{artifact.moments_definition}</dd>
        </dl>
        <p className="links">
          <a href={ARTIFACT_URL} download>
            Download the artifact JSON
          </a>
          {' · '}
          <a href={SCHEMA_URL} download>
            JSON Schema
          </a>
        </p>
      </div>

      <div className="panel">
        <h3>Samples</h3>
        <div className="table-scroll">
        <table className="moments compact">
          <thead>
            <tr>
              <th>Sample</th>
              <th>Start</th>
              <th>End</th>
              <th>Quarters</th>
              <th>HP lambda</th>
            </tr>
          </thead>
          <tbody>
            {(['full', 'pre_1984', 'post_1984'] as const).map((s) => (
              <tr key={s}>
                <th scope="row">{artifact.sample_definitions[s].name}</th>
                <td>{artifact.sample_definitions[s].start}</td>
                <td>{artifact.sample_definitions[s].end}</td>
                <td>{artifact.sample_definitions[s].n_quarters}</td>
                <td>{artifact.sample_results[s].hp_lambda}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <p className="footnote">
          Subsamples are independently HP-filtered. A subsample cycle is not a slice of the
          full-sample cycle, so moments change with the window by construction as well as by
          economics.
        </p>
      </div>

      <div className="panel">
        <h3>How to interpret HP-filtered cycles</h3>
        <p>The HP filter is a descriptive way to separate a smooth trend from shorter-run movements, not a model of potential output or a causal decomposition. Its two-sided trend uses observations before and after each date.</p>
        <p>Near sample endpoints, especially the latest quarters, the estimated trend and cycle are particularly sensitive to the available observations. Adding new data can change past estimates even if the underlying observations are unchanged. Read recent deviations cautiously.</p>
        <p>Results also depend on the smoothing parameter and sample window. An HP-filtered cycle is not an official recession chronology, and these comparisons do not provide statistical tests.</p>
      </div>

      <div className="panel">
        <h3>Constructed consumption measure</h3>
        <p>Consumption is nominal personal consumption expenditures on nondurables plus services (PCND + PCESV), deflated using the GDP deflator (GDPDEF / 100), then divided by civilian noninstitutional population age 16+. It is not the official BEA real-consumption series. Consumer durables are included in investment instead.</p>
      </div>

      <div className="panel">
        <h3>Real interest rate: reproducible calculation, unresolved input convention</h3>
        <p className="callout warn">The Treasury input contains quarter-start observations, but its original monthly-to-quarterly convention is unverified. Real-rate correlations remain conditional on that input; they should not be read as a fully verified measurement result.</p>
        <p>The implemented rate at quarter t is TB3MS(t) / 400 minus [ln GDPDEF(t+1) − ln GDPDEF(t)]. The nominal annualized percent rate is converted to a quarterly decimal and compared with realized next-quarter inflation. This is an ex-post measure, not an expected real rate.</p>
        <p>The pipeline performs no monthly aggregation. Quarter-start dates do not identify whether the values were averages or selected months. Verifying that choice requires the original monthly observations or download metadata; numerical reproducibility alone does not resolve it.</p>
      </div>

      <div className="panel">
        <h3>Series definitions and transformations</h3>
        <div className="table-scroll">
          <table className="moments compact">
            <thead>
              <tr>
                <th>Series</th>
                <th>Transformation</th>
                <th>Transformed unit</th>
                <th>Source inputs</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(artifact.series).map(([id, s]) => (
                <tr key={id}>
                  <th scope="row">
                    {s.label}
                    <code className="series-id">{id}</code>
                  </th>
                  <td className="mono-sm">{s.transformation}</td>
                  <td>{s.transformed_unit}</td>
                  <td className="mono-sm">{s.source_series_ids.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h3>Representation notes from the artifact</h3>
        <ul className="notes">
          {artifact.representation_notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h3>TFP AR(1) estimates</h3>
        <p className="muted">
          Sample: {tfp.sample}. {tfp.linear_detrend}.
        </p>
        <div className="table-scroll">
        <table className="moments compact">
          <thead>
            <tr>
              <th>Series</th>
              <th>Detrending</th>
              <th>rho</th>
              <th>Innovation SD</th>
            </tr>
          </thead>
          <tbody>
            {(['log_tfp', 'log_tfp_util'] as const).flatMap((id) => [
              <tr key={`${id}-hp`}>
                <th scope="row">{artifact.series[id].label}</th>
                <td>HP cycle, AR(1) without constant</td>
                <td>{fmt(tfp.estimates[id].hp_cycle_ar1_no_constant.rho, 4)}</td>
                <td>{fmt(tfp.estimates[id].hp_cycle_ar1_no_constant.innovation_sd, 5)}</td>
              </tr>,
              <tr key={`${id}-lin`}>
                <th scope="row" className="sub">
                  {artifact.series[id].label}
                </th>
                <td>Linear detrend, AR(1) without constant</td>
                <td>{fmt(tfp.estimates[id].linear_detrend_ar1_no_constant.rho, 4)}</td>
                <td>{fmt(tfp.estimates[id].linear_detrend_ar1_no_constant.innovation_sd, 5)}</td>
              </tr>,
            ])}
          </tbody>
        </table>
        </div>
        <p className="callout warn">
          <strong>{tfp.model_calibration_status}</strong> These are empirical estimates. They are not
          a selected RBC calibration, and persistence differs sharply between the two detrending
          choices — the comparison is the point, not a single preferred number.
        </p>
      </div>

      <div className="panel">
        <h3>Provenance</h3>
        <dl className="kv">
          <dt>Sources</dt>
          <dd>{p.sources}</dd>
          <dt>Lineage check</dt>
          <dd>{p.source_lineage_check}</dd>
          <dt>Vintage caveat</dt>
          <dd>{p.vintage_caveat}</dd>
          <dt>Digest algorithm</dt>
          <dd>{p.digest_algorithm}</dd>
        </dl>

        <h4>Native source series</h4>
        <div className="table-scroll">
          <table className="moments compact">
            <thead>
              <tr>
                <th>Id</th>
                <th>Description</th>
                <th>Provider</th>
                <th>Unit</th>
                <th>Coverage (non-missing)</th>
                <th>Local file date</th>
                <th>SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(artifact.raw_series).map(([id, r]) => (
                <tr key={id}>
                  <th scope="row">
                    <a href={r.source_url} target="_blank" rel="noreferrer noopener">
                      {id}
                    </a>
                  </th>
                  <td>{r.label}</td>
                  <td>{r.provider}</td>
                  <td className="mono-sm">{r.unit}</td>
                  <td className="mono-sm">
                    {r.sample_coverage.nonmissing_start} → {r.sample_coverage.nonmissing_end} (
                    {r.sample_coverage.n_nonmissing}/{r.sample_coverage.n_rows})
                  </td>
                  <td>{r.local_file_modified_date}</td>
                  <td className="mono-sm" title={p.source_file_sha256[r.source_file]}>
                    {p.source_file_sha256[r.source_file]
                      ? shortHash(p.source_file_sha256[r.source_file])
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4>Code and input digests</h4>
        <div className="table-scroll">
          <table className="moments compact">
            <tbody>
              {Object.entries({ ...p.research_code_sha256, ...p.research_input_sha256 }).map(
                ([k, v]) => (
                  <tr key={k}>
                    <th scope="row">
                      <code>{k}</code>
                    </th>
                    <td className="mono-sm" title={v}>
                      {shortHash(v)}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h3>Licensing and redistribution</h3>
        <p className="callout warn">{artifact.source_licensing.warning}</p>
        <dl className="kv">
          <dt>Redistribution clearance</dt>
          <dd>{artifact.source_licensing.redistribution_clearance}</dd>
          <dt>Official vintage available</dt>
          <dd>{artifact.source_licensing.official_vintage_available ? 'yes' : 'no'}</dd>
        </dl>
      </div>
    </div>
  );
}
