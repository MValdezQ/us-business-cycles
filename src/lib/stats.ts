/**
 * Browser-side statistics.
 *
 * Only used to extend the lead/lag profile beyond the three horizons the artifact
 * reports (k = -4, 0, +4). The estimators below are deliberately identical to the
 * research pipeline's, so the three artifact-reported horizons are reproduced exactly;
 * `src/lib/leadlag.ts` checks that reconciliation at runtime and surfaces any mismatch.
 */

export function mean(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Sample standard deviation with ddof = 1, matching the artifact's convention. */
export function stdDev(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return Math.sqrt(s / (xs.length - 1));
}

/** Pearson correlation over equal-length, positionally aligned arrays. */
export function corr(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return NaN;
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
  const den = Math.sqrt(da) * Math.sqrt(db);
  return den === 0 ? NaN : num / den;
}

/**
 * corr(x_t, y_{t+k}) on the overlapping window.
 *
 * k > 0 compares today's x with future output: a profile peaking at k > 0 means x
 * leads output. k < 0 means x lags output. k = 0 is the contemporaneous correlation.
 */
export function crossCorrAt(x: number[], y: number[], k: number): number {
  const n = Math.min(x.length, y.length);
  if (k >= 0) {
    if (n - k < 2) return NaN;
    return corr(x.slice(0, n - k), y.slice(k, n));
  }
  const j = -k;
  if (n - j < 2) return NaN;
  return corr(x.slice(j, n), y.slice(0, n - j));
}

/** First-order autocorrelation, corr(x_t, x_{t-1}). */
export function autocorr1(x: number[]): number {
  return corr(x.slice(1), x.slice(0, -1));
}
