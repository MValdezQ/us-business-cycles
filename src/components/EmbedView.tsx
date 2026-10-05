import { useEffect, useMemo, useState } from 'react';
import type { Artifact, Moment, SampleId, SeriesId } from '../lib/artifact-types';
import {
  getCycleSlice,
  getDetrendingSlices,
  getLevelSlice,
  SAMPLE_ORDER,
  type ScaleMode,
  SERIES_LABELS_FULL,
  SERIES_ORDER,
} from '../lib/artifact';
import { CLAIMS, type Claim } from './ClaimsView';
import TimeSeriesChart from './TimeSeriesChart';

interface Props {
  artifact: Artifact;
  embedType: 'claim' | 'explore';
  claimId?: string;
  initialSeries?: SeriesId;
  initialSample?: SampleId;
  initialScale?: ScaleMode;
  initialRep?: 'cycle' | 'detrend' | 'level';
}

export default function EmbedView({
  artifact,
  embedType,
  claimId,
  initialSeries = 'log_C_pc',
  initialSample = 'full',
  initialScale = 'per_capita',
  initialRep = 'cycle',
}: Props) {
  const [sampleId, setSampleId] = useState<SampleId>(initialSample);
  const [seriesId, setSeriesId] = useState<SeriesId>(initialSeries);
  const [scale, setScale] = useState<ScaleMode>(initialScale);
  const [rep, setRep] = useState<'cycle' | 'detrend' | 'level'>(initialRep);

  useEffect(() => {
    setSampleId(initialSample);
  }, [initialSample]);

  useEffect(() => {
    setSeriesId(initialSeries);
  }, [initialSeries]);

  useEffect(() => {
    setScale(initialScale);
  }, [initialScale]);

  useEffect(() => {
    setRep(initialRep);
  }, [initialRep]);

  const claim: Claim | undefined = useMemo(() => {
    if (embedType !== 'claim') return undefined;
    return CLAIMS.find((c) => c.id === claimId) ?? CLAIMS[0];
  }, [embedType, claimId]);

  const momentsById = useMemo(() => {
    return Object.fromEntries(
      artifact.sample_results[sampleId].moments.map((m) => [m.series_id, m]),
    ) as Record<SeriesId, Moment>;
  }, [artifact, sampleId]);

  // Compute full standalone URL for link
  const fullAppUrl = useMemo(() => {
    const base = window.location.href.split('#')[0];
    const params = new URLSearchParams({ sample: sampleId, series: seriesId, scale, rep });
    if (embedType === 'claim' && claim) {
      params.set('series', claim.focus[0]);
      params.set('compare', claim.focus.join(','));
      params.set('mode', 'compare_cycles');
    } else if (rep === 'cycle') {
      params.set('compare', seriesId);
    }
    return `${base}#/visualizations?${params}`;
  }, [embedType, claim, sampleId, seriesId, scale, rep]);

  // Render Claim Embed
  if (embedType === 'claim' && claim) {
    const evidence = claim.evidence(momentsById);
    const slices = claim.focus.map((id) => getCycleSlice(artifact, id, sampleId));
    const hasRate = claim.focus.includes('real_rate');

    return (
      <div className="embed-container">
        {/* Header: Title + Sample Selector */}
        <header className="embed-header">
          <div className="embed-title-block">
            <h2 className="embed-title">{claim.claim}</h2>
            <div className="embed-stat-badge">
              <span className="embed-stat-label">{evidence.stat}:</span>{' '}
              <strong className="embed-stat-val">{evidence.value}</strong>
            </div>
          </div>

          <div className="embed-sample-picker">
            {SAMPLE_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip chip-sm ${sampleId === s ? 'on' : ''}`}
                onClick={() => setSampleId(s)}
                title={artifact.sample_definitions[s].name}
              >
                {artifact.sample_definitions[s].name.replace('Sample ', '').replace('Sample', '')}
              </button>
            ))}
          </div>
        </header>

        {/* Dynamic Empirical Finding Callout */}
        <p className="embed-finding">
          {evidence.verdict}
        </p>

        {/* Warning if Real Rate is mixed with logged quantities */}
        {hasRate && (
          <p className="callout warn embed-warn">
            The Real Rate is a quarterly decimal rate. Its amplitude is not directly comparable with log deviations.
          </p>
        )}

        {/* Interactive Chart */}
        <div className="embed-chart-wrapper">
          <TimeSeriesChart
            slices={slices}
            unitLabel="Cyclical deviation (log points / decimal rate)"
            zeroLine
            height={260}
          />
        </div>

        {/* Footer: Caveat + Standalone Link */}
        <footer className="embed-footer">
          {claim.caveat && <span className="embed-caveat">{claim.caveat}</span>}
          <span className="embed-caveat">HP endpoint note: two-sided estimates are sensitive at sample endpoints; latest observations can change with new data; this is not a recession chronology.</span>
          <a
            href={fullAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="embed-open-link"
          >
            Open full analysis ↗
          </a>
        </footer>
      </div>
    );
  }

  // Render Generic Explore Embed (Level / Detrend / Cycle)
  const meta = SERIES_LABELS_FULL[seriesId];
  const isRate = seriesId === 'real_rate';

  let slices: ReturnType<typeof getLevelSlice>[] = [];
  let unitLabel = '';
  let lineStyles: ('solid' | 'dashed')[] | undefined = undefined;

  if (rep === 'cycle') {
    slices = [getCycleSlice(artifact, seriesId, sampleId)];
    unitLabel = isRate ? 'quarterly rate deviation' : 'log deviation from HP trend';
  } else if (rep === 'detrend') {
    const det = getDetrendingSlices(artifact, seriesId, sampleId, scale);
    slices = [det.dataSlice, det.trendSlice];
    unitLabel = det.dataSlice.unit;
    lineStyles = ['solid', 'dashed'];
  } else {
    slices = [getLevelSlice(artifact, seriesId, sampleId, scale)];
    unitLabel = slices[0].unit;
  }

  return (
    <div className="embed-container">
      {/* Header with Series, Representation, and Sample Selectors */}
      <header className="embed-header flex-col">
        <div className="embed-title-block">
          <h2 className="embed-title">
            {meta.full}
          </h2>
          <span className="embed-unit-tag">{unitLabel}</span>
        </div>

        <div className="embed-controls-row">
          {/* Representation Selector */}
          <div className="chips">
            <button
              type="button"
              className={`chip chip-sm ${rep === 'detrend' ? 'on' : ''}`}
              onClick={() => setRep('detrend')}
            >
              Trend Overlay
            </button>
            <button
              type="button"
              className={`chip chip-sm ${rep === 'cycle' ? 'on' : ''}`}
              onClick={() => setRep('cycle')}
            >
              HP Cycle
            </button>
            <button
              type="button"
              className={`chip chip-sm ${rep === 'level' ? 'on' : ''}`}
              onClick={() => setRep('level')}
            >
              Level
            </button>
          </div>

          {/* Scale Toggle (if quantity) */}
          {meta.perCapitaApplicable && rep !== 'cycle' && (
            <div className="chips">
              <button
                type="button"
                className={`chip chip-sm ${scale === 'per_capita' ? 'on' : ''}`}
                onClick={() => setScale('per_capita')}
              >
                Per-Capita
              </button>
              <button
                type="button"
                className={`chip chip-sm ${scale === 'aggregate' ? 'on' : ''}`}
                onClick={() => setScale('aggregate')}
              >
                Aggregate
              </button>
            </div>
          )}

          {/* Sample Selector */}
          <div className="chips">
            {SAMPLE_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip chip-sm ${sampleId === s ? 'on' : ''}`}
                onClick={() => setSampleId(s)}
              >
                {artifact.sample_definitions[s].name.replace('Sample ', '').replace('Sample', '')}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Series Picker Quick Bar */}
      <div className="embed-series-bar">
        {SERIES_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className={`chip chip-xs ${seriesId === id ? 'on' : ''}`}
            onClick={() => setSeriesId(id)}
          >
            {SERIES_LABELS_FULL[id].short}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="embed-chart-wrapper">
        <TimeSeriesChart
          slices={slices}
          unitLabel={unitLabel}
          zeroLine={rep === 'cycle'}
          lineStyles={lineStyles}
          height={270}
        />
      </div>

      {/* Footer */}
      <footer className="embed-footer">
        <span className="embed-caveat">
          HP filter &lambda; = 1600 · Source: BEA, BLS, FRED, Fernald. Two-sided estimates are sensitive at sample endpoints; latest observations can change with new data; this is not a recession chronology.
        </span>
        <a
          href={fullAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="embed-open-link"
        >
          Open full analysis ↗
        </a>
      </footer>
    </div>
  );
}
