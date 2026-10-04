/**
 * Reproducibility check: confirms the shipped artifact is internally consistent and that
 * the estimators the browser uses reproduce the artifact's published moments exactly.
 *
 * Run: npm run verify:artifact
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const artifact = JSON.parse(
  readFileSync(join(here, '..', 'public', 'data', 'us-business-cycles-v1.json'), 'utf8'),
);

const TOL = 1e-12;
let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) {
    failures++;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`ok    ${name}`);
  }
};

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const stdDev = (a) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
const corr = (a, b) => {
  const n = Math.min(a.length, b.length);
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const u = a[i] - ma;
    const v = b[i] - mb;
    num += u * v;
    da += u * u;
    db += v * v;
  }
  return num / (Math.sqrt(da) * Math.sqrt(db));
};
const crossCorrAt = (x, y, k) => {
  const n = Math.min(x.length, y.length);
  return k >= 0 ? corr(x.slice(0, n - k), y.slice(k, n)) : corr(x.slice(-k, n), y.slice(0, n + k));
};

check('artifact_id', artifact.artifact_id === 'us-business-cycles-v1', artifact.artifact_id);
check('frequency is quarterly', artifact.frequency === 'quarterly');
check('canonical sample is 313 quarters', artifact.canonical_sample.n_quarters === 313);
check('dates length matches canonical sample', artifact.dates.length === 313);

const outputId = artifact.canonical_sample.output_series_id;

for (const sampleId of ['full', 'pre_1984', 'post_1984']) {
  const r = artifact.sample_results[sampleId];
  const def = artifact.sample_definitions[sampleId];
  check(`[${sampleId}] hp_lambda = 1600`, r.hp_lambda === 1600);
  check(`[${sampleId}] dates length = ${def.n_quarters}`, r.dates.length === def.n_quarters);
  check(`[${sampleId}] moments cover 10 series`, r.moments.length === 10);

  const y = r.series[outputId].hp_cycle;
  let worst = 0;
  let worstWhat = '';
  for (const m of r.moments) {
    const x = r.series[m.series_id].hp_cycle;
    check(
      `[${sampleId}] ${m.series_id} cycle length`,
      x.length === def.n_quarters,
      `${x.length} vs ${def.n_quarters}`,
    );
    const got = {
      std_dev: stdDev(x),
      corr_y: corr(x, y),
      autocorr: corr(x.slice(1), x.slice(0, -1)),
      corr_y_lag4: crossCorrAt(x, y, -4),
      corr_y_lead4: crossCorrAt(x, y, 4),
      rel_std_dev: stdDev(x) / stdDev(y),
    };
    for (const [k, v] of Object.entries(got)) {
      const d = Math.abs(v - m[k]);
      if (d > worst) {
        worst = d;
        worstWhat = `${m.series_id}.${k}`;
      }
    }
  }
  check(
    `[${sampleId}] browser estimators reproduce published moments`,
    worst < TOL,
    `max |diff| = ${worst.toExponential(3)} at ${worstWhat}`,
  );
}

const rr = artifact.series.real_rate.observations;
check(
  'real_rate has no economic level (by construction)',
  rr.every((o) => o.economic_level === null),
);
for (const [id, s] of Object.entries(artifact.series)) {
  if (id === 'real_rate') continue;
  check(
    `${id} publishes an economic level`,
    s.observations.every((o) => typeof o.economic_level === 'number'),
  );
}

for (const [, s] of Object.entries(artifact.series)) {
  for (const src of s.source_series_ids) {
    check(`source input ${src} is published in raw_series`, Boolean(artifact.raw_series[src]));
  }
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
