import { useEffect, useMemo, useRef, useState } from 'react';
import type { SeriesSlice } from '../lib/artifact';
import { fmtAuto, quarterLabel } from '../lib/format';

export const PALETTE = [
  '#1f4ea1', // deep blue
  '#c2461f', // rust / orange-red
  '#2f7a4f', // forest green
  '#8a4fa8', // purple
  '#b08900', // mustard
  '#0f7c8c', // teal
  '#a03060', // berry
  '#5a6472', // slate
];

interface Props {
  slices: SeriesSlice[];
  unitLabel: string;
  zeroLine?: boolean;
  height?: number;
  lineStyles?: ('solid' | 'dashed')[];
}

interface Scale {
  x: (t: number) => number;
  y: (v: number) => number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const M = { top: 16, right: 18, bottom: 32, left: 68 };

function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo === hi) return [lo];
  const span = hi - lo;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const start = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + step * 1e-9; v += step) out.push(v);
  return out;
}

export default function TimeSeriesChart({
  slices,
  unitLabel,
  zeroLine,
  height = 320,
  lineStyles,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(880);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [brush, setBrush] = useState<{ a: number; b: number } | null>(null);
  const [zoom, setZoom] = useState<{ t0: number; t1: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth((prev) => (Math.abs(w - prev) > 1 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    return slices.map((s) => ({
      ...s,
      pts: s.points
        .map((p) => ({ t: Date.parse(p.date), v: p.value, date: p.date }))
        .filter((p) => Number.isFinite(p.t)),
    }));
  }, [slices]);

  const domain = useMemo(() => {
    let t0 = Infinity;
    let t1 = -Infinity;
    for (const s of data)
      for (const p of s.pts) {
        if (p.t < t0) t0 = p.t;
        if (p.t > t1) t1 = p.t;
      }
    if (!Number.isFinite(t0)) return null;
    const vt0 = zoom ? Math.max(t0, zoom.t0) : t0;
    const vt1 = zoom ? Math.min(t1, zoom.t1) : t1;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (const s of data)
      for (const p of s.pts) {
        if (p.v === null || !Number.isFinite(p.v)) continue;
        if (p.t < vt0 || p.t > vt1) continue;
        if (p.v < v0) v0 = p.v;
        if (p.v > v1) v1 = p.v;
      }
    if (!Number.isFinite(v0)) return null;
    if (zeroLine) {
      v0 = Math.min(v0, 0);
      v1 = Math.max(v1, 0);
    }
    const pad = (v1 - v0) * 0.08 || Math.abs(v1 || 1) * 0.1;
    return { t0: vt0, t1: vt1, v0: v0 - pad, v1: v1 + pad };
  }, [data, zoom, zeroLine]);

  const xTicks = useMemo(() => {
    if (!domain) return [];
    const y0 = new Date(domain.t0).getUTCFullYear();
    const y1 = new Date(domain.t1).getUTCFullYear();
    const span = y1 - y0;
    const step = span > 60 ? 20 : span > 30 ? 10 : span > 12 ? 5 : span > 5 ? 2 : 1;
    const out: number[] = [];
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) out.push(Date.UTC(y, 0, 1));
    return out;
  }, [domain]);

  if (!domain) {
    return (
      <div className="chart-empty" role="status">
        No plottable values for this selection.
      </div>
    );
  }

  const innerW = Math.max(120, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const sc: Scale = {
    x: (t) => M.left + ((t - domain.t0) / (domain.t1 - domain.t0 || 1)) * innerW,
    y: (v) => M.top + innerH - ((v - domain.v0) / (domain.v1 - domain.v0 || 1)) * innerH,
    x0: M.left,
    x1: M.left + innerW,
    y0: M.top,
    y1: M.top + innerH,
  };

  const yTicks = niceTicks(domain.v0, domain.v1, 5);

  const hoverIdx = (() => {
    if (hoverX === null || data.length === 0) return null;
    const t = domain.t0 + ((hoverX - M.left) / innerW) * (domain.t1 - domain.t0);
    const ref = data[0].pts.filter((p) => p.t >= domain.t0 && p.t <= domain.t1);
    if (ref.length === 0) return null;
    let best = ref[0];
    for (const p of ref) if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
    return best.t;
  })();

  const pathFor = (pts: { t: number; v: number | null }[]) => {
    let d = '';
    let pen = false;
    for (const p of pts) {
      if (p.v === null || !Number.isFinite(p.v) || p.t < domain.t0 || p.t > domain.t1) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${sc.x(p.t).toFixed(2)},${sc.y(p.v).toFixed(2)}`;
      pen = true;
    }
    return d;
  };

  const onDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setBrush({ a: e.clientX - r.left, b: e.clientX - r.left });
  };
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    setHoverX(px);
    if (brush) setBrush({ ...brush, b: px });
  };
  const onUp = () => {
    if (brush && Math.abs(brush.a - brush.b) > 12) {
      const lo = Math.min(brush.a, brush.b);
      const hi = Math.max(brush.a, brush.b);
      const inv = (px: number) =>
        domain.t0 + ((px - M.left) / innerW) * (domain.t1 - domain.t0);
      setZoom({ t0: inv(lo), t1: inv(hi) });
    }
    setBrush(null);
  };

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        className="chart"
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Time series chart, ${unitLabel}`}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={() => {
          setHoverX(null);
          setBrush(null);
        }}
        onDoubleClick={() => setZoom(null)}
      >
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line className="grid" x1={sc.x0} x2={sc.x1} y1={sc.y(v)} y2={sc.y(v)} />
            <text className="tick" x={sc.x0 - 8} y={sc.y(v)} textAnchor="end" dominantBaseline="middle">
              {fmtAuto(v)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line className="grid grid-v" x1={sc.x(t)} x2={sc.x(t)} y1={sc.y0} y2={sc.y1} />
            <text className="tick" x={sc.x(t)} y={sc.y1 + 18} textAnchor="middle">
              {new Date(t).getUTCFullYear()}
            </text>
          </g>
        ))}

        {zeroLine && domain.v0 <= 0 && domain.v1 >= 0 && (
          <line className="zero" x1={sc.x0} x2={sc.x1} y1={sc.y(0)} y2={sc.y(0)} />
        )}

        {data.map((s, i) => {
          const isDashed = lineStyles?.[i] === 'dashed';
          return (
            <path
              key={s.key}
              className="line"
              d={pathFor(s.pts)}
              stroke={PALETTE[i % PALETTE.length]}
              strokeDasharray={isDashed ? '5 4' : undefined}
              strokeWidth={isDashed ? 2.2 : 1.8}
            />
          );
        })}

        {hoverIdx !== null && (
          <line className="crosshair" x1={sc.x(hoverIdx)} x2={sc.x(hoverIdx)} y1={sc.y0} y2={sc.y1} />
        )}
        {hoverIdx !== null &&
          data.map((s, i) => {
            const p = s.pts.find((q) => q.t === hoverIdx);
            if (!p || p.v === null || !Number.isFinite(p.v)) return null;
            return (
              <circle
                key={`m${s.key}`}
                cx={sc.x(p.t)}
                cy={sc.y(p.v)}
                r={3.5}
                fill={PALETTE[i % PALETTE.length]}
              />
            );
          })}

        {brush && Math.abs(brush.a - brush.b) > 2 && (
          <rect
            className="brush"
            x={Math.min(brush.a, brush.b)}
            width={Math.abs(brush.a - brush.b)}
            y={sc.y0}
            height={innerH}
          />
        )}

        <line className="axis" x1={sc.x0} x2={sc.x1} y1={sc.y1} y2={sc.y1} />
        <line className="axis" x1={sc.x0} x2={sc.x0} y1={sc.y0} y2={sc.y1} />
      </svg>

      <div className="chart-foot">
        <div className="legend">
          {data.map((s, i) => {
            const isDashed = lineStyles?.[i] === 'dashed';
            return (
              <span key={s.key} className="legend-item">
                <i
                  style={{
                    background: PALETTE[i % PALETTE.length],
                    borderTop: isDashed ? '2px dashed' : undefined,
                  }}
                />
                {s.label}
              </span>
            );
          })}
        </div>
        <div className="chart-readout">
          {hoverIdx !== null ? (
            <>
              <strong>{quarterLabel(new Date(hoverIdx).toISOString().slice(0, 10))}</strong>
              {data.map((s) => {
                const p = s.pts.find((q) => q.t === hoverIdx);
                return (
                  <span key={`r${s.key}`} className="readout-item">
                    {s.label}: <b>{fmtAuto(p?.v ?? null)}</b>
                  </span>
                );
              })}
            </>
          ) : (
            <span className="muted">
              Hover to inspect · drag to zoom · double-click to reset
              {zoom ? ' (zoomed)' : ''}
            </span>
          )}
        </div>
      </div>
      <p className="axis-note">Vertical axis: {unitLabel}</p>
    </div>
  );
}
