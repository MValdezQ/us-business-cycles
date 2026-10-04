/** Formatting helpers. Quarter labels follow the artifact's quarter-start date convention. */

export function quarterLabel(iso: string): string {
  const [y, m] = iso.split('-');
  const q = { '01': 1, '04': 2, '07': 3, '10': 4 }[m] ?? 1;
  return `${y}Q${q}`;
}

export function fmt(x: number | null | undefined, digits = 3): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return x.toFixed(digits);
}

/** Readable across the artifact's very different magnitudes (0.0164 to 23,000). */
export function fmtAuto(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const a = Math.abs(x);
  if (a < 1e-9) return '0.0000';
  if (a >= 10000) return x.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (a >= 100) return x.toFixed(1);
  if (a >= 1) return x.toFixed(3);
  if (a >= 0.01) return x.toFixed(4);
  return x.toExponential(2);
}

export function fmtPct(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(digits)}%`;
}

export function shortHash(h: string): string {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}
