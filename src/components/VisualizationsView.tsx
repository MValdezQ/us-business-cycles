import { useState } from 'react';
import type { Artifact, SampleId, SeriesId } from '../lib/artifact-types';
import {
  SERIES_LABELS_FULL,
  SERIES_ORDER,
  SAMPLE_ORDER,
  type ScaleMode,
  getDetrendingSlices,
  getLevelSlice,
  getCycleSlice,
} from '../lib/artifact';
import TimeSeriesChart from './TimeSeriesChart';
import MomentsTable from './MomentsTable';

export type VisualizationMode = 'detrend' | 'levels' | 'compare_cycles';

interface Props {
  artifact: Artifact;
  sampleId: SampleId;
  onSampleChange: (s: SampleId) => void;
  selectedSeries: SeriesId;
  onSeriesChange: (s: SeriesId) => void;
  compareList: SeriesId[];
  onCompareToggle: (s: SeriesId) => void;
}

export default function VisualizationsView({
  artifact,
  sampleId,
  onSampleChange,
  selectedSeries,
  onSeriesChange,
  compareList,
  onCompareToggle,
}: Props) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const requestedMode = params.get('mode') || (params.get('rep') === 'level' ? 'levels' : params.get('rep') === 'cycle' ? 'compare_cycles' : 'detrend');
  const [mode, setMode] = useState<VisualizationMode>(['detrend', 'levels', 'compare_cycles'].includes(requestedMode) ? requestedMode as VisualizationMode : 'detrend');
  const [scale, setScale] = useState<ScaleMode>(params.get('scale') === 'aggregate' ? 'aggregate' : 'per_capita');

  const meta = SERIES_LABELS_FULL[selectedSeries];
  const sampleDef = artifact.sample_definitions[sampleId];

  // Group series by category for cleaner display
  const categories = ['Per-Capita Quantities', 'Factor Prices & Rates', 'Prices & Technology'];

  return (
    <div className="viz-container">
      {/* Visualizations Controls Toolbar */}
      <div className="viz-toolbar">
        {/* View Mode Switcher */}
        <div className="selector mode-selector">
          <legend>View Mode</legend>
          <div className="chips">
            <button
              type="button"
              className={`chip ${mode === 'detrend' ? 'on' : ''}`}
              onClick={() => setMode('detrend')}
            >
              Detrending & Cycles
            </button>
            <button
              type="button"
              className={`chip ${mode === 'levels' ? 'on' : ''}`}
              onClick={() => setMode('levels')}
            >
              Economic Levels
            </button>
            <button
              type="button"
              className={`chip ${mode === 'compare_cycles' ? 'on' : ''}`}
              onClick={() => setMode('compare_cycles')}
            >
              Compare Cycles
            </button>
          </div>
        </div>

        {/* Sample Switcher */}
        <div className="selector sample-selector">
          <legend>Sample</legend>
          <div className="chips">
            {SAMPLE_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip ${sampleId === s ? 'on' : ''}`}
                onClick={() => onSampleChange(s)}
              >
                {artifact.sample_definitions[s].name.replace('Sample ', '')}
              </button>
            ))}
          </div>
        </div>

        {/* Per-Capita vs Aggregate Scale Toggle (only relevant in detrend and levels for quantities) */}
        {mode !== 'compare_cycles' && meta.perCapitaApplicable && (
          <div className="selector scale-selector">
            <legend>Scale</legend>
            <div className="chips">
              <button
                type="button"
                className={`chip ${scale === 'per_capita' ? 'on' : ''}`}
                onClick={() => setScale('per_capita')}
                title="Divided by civilian population 16+"
              >
                Per Capita (theory standard)
              </button>
              <button
                type="button"
                className={`chip ${scale === 'aggregate' ? 'on' : ''}`}
                onClick={() => setScale('aggregate')}
                title="Aggregate total real level"
              >
                Aggregate (non-per capita)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Series Selection Bar */}
      <div className="selector series-selector-bar">
        <legend>
          {mode === 'compare_cycles'
            ? 'Select up to 4 series to compare HP cycles'
            : 'Select Analysis Series'}
        </legend>
        <div className="series-categories-grid">
          {categories.map((cat) => (
            <div key={cat} className="series-category-col">
              <span className="group-label">{cat}</span>
              <div className="chips">
                {SERIES_ORDER.filter((id) => SERIES_LABELS_FULL[id].category === cat).map((id) => {
                  const isSelected =
                    mode === 'compare_cycles' ? compareList.includes(id) : selectedSeries === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`chip ${isSelected ? 'on' : ''}`}
                      onClick={() =>
                        mode === 'compare_cycles' ? onCompareToggle(id) : onSeriesChange(id)
                      }
                    >
                      {SERIES_LABELS_FULL[id].short}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* View 1: Detrending & Cycles (Dual Panel: Log Data + Trend, then Cycle) */}
      {mode === 'detrend' && (() => {
        const { dataSlice, trendSlice, cycleSlice } = getDetrendingSlices(
          artifact,
          selectedSeries,
          sampleId,
          scale,
        );
        const isRate = selectedSeries === 'real_rate';

        return (
          <div className="stack">
            <div className="panel chart-panel">
              <div className="panel-head">
                <h3>
                  {meta.full} — {isRate ? 'Quarterly Rate' : scale === 'aggregate' ? 'Aggregate Log Level' : 'Per-Capita Log Level'} &amp; Trend
                </h3>
                <p className="muted">
                  {sampleDef.name} ({sampleDef.start} to {sampleDef.end}) · {scale === 'aggregate' ? 'Secular trend (HP trend + population trend)' : 'HP filter λ = 1600 re-estimated within sample'}.
                </p>
              </div>

              <TimeSeriesChart
                slices={[dataSlice, trendSlice]}
                unitLabel={dataSlice.unit}
                lineStyles={['solid', 'dashed']}
                height={260}
              />
            </div>

            <div className="panel chart-panel">
              <div className="panel-head">
                <h3>{meta.short} — Business-Cycle Component</h3>
                <p className="muted">
                  Cycle = {isRate ? 'Rate deviation from trend' : 'ln(Level) minus HP trend'}. Centered around mean 0.
                </p>
              </div>

              <TimeSeriesChart
                slices={[cycleSlice]}
                unitLabel={cycleSlice.unit}
                zeroLine
                height={240}
              />

              <p className="footnote">
                <strong>Empirical construction:</strong> {artifact.series[selectedSeries].transformation}
              </p>
            </div>
          </div>
        );
      })()}

      {/* View 2: Economic Levels (Dollars per person vs Billions) */}
      {mode === 'levels' && (() => {
        const slice = getLevelSlice(artifact, selectedSeries, sampleId, scale);
        const isRate = selectedSeries === 'real_rate';

        return (
          <div className="panel chart-panel">
            <div className="panel-head">
              <h3>
                {meta.full} — {isRate ? 'Real Rate Level' : 'Economic Level'}
              </h3>
              <p className="muted">
                {sampleDef.name} · Units: <strong>{slice.unit}</strong>
              </p>
            </div>

            {!meta.perCapitaApplicable && (
              <p className="footnote callout" style={{ margin: '0 0 12px 0' }}>
                Note: {meta.short} is an intensive rate / index (independent of population). The per-capita vs aggregate toggle is disabled for this series.
              </p>
            )}

            <TimeSeriesChart slices={[slice]} unitLabel={slice.unit} height={340} />

            <p className="footnote">
              <strong>Source lineage:</strong>{' '}
              {artifact.series[selectedSeries].source_series_ids.join(' + ')} from FRED / BLS / Fernald.
            </p>
          </div>
        );
      })()}

      {/* View 3: Compare Cycles (Multi-series overlay) */}
      {mode === 'compare_cycles' && (() => {
        const slices = compareList.map((id) => getCycleSlice(artifact, id, sampleId));
        const hasRate = compareList.includes('real_rate');

        return (
          <div className="panel chart-panel">
            <div className="panel-head">
              <h3>Comparative Business Cycles ({compareList.length} series)</h3>
              <p className="muted">
                HP cyclical deviations around trend for {sampleDef.name}. All cycles are centered at zero.
              </p>
            </div>

            {hasRate && (
              <p className="callout warn" style={{ margin: '0 0 12px 0' }}>
                The Real Rate is in quarterly decimal rate units (e.g. 0.01 = 1% / quarter). It is plotted alongside log deviations for timing comparison, but its amplitude scale is not directly comparable with logged quantities.
              </p>
            )}

            <TimeSeriesChart
              slices={slices}
              unitLabel="Cyclical deviation (log points / decimal rate)"
              zeroLine
              height={360}
            />

            <p className="footnote">
              Click series in the selector above to add or remove them from the overlay (up to 4 series).
            </p>
          </div>
        );
      })()}

      <p className="footnote">
        HP trends and cycles are sensitive to the sample window, especially near endpoints. Recent deviations can change as new observations arrive. These estimates are not a recession chronology or a causal decomposition.
      </p>
      {(selectedSeries === 'real_rate' || (mode === 'compare_cycles' && compareList.includes('real_rate'))) && (
        <p className="callout warn">Real-rate results are provisional: the Treasury input’s original monthly-to-quarterly convention is unverified. The ex-post rate uses realized next-quarter GDP-deflator inflation. See Methodology &amp; Provenance for the exact construction.</p>
      )}

      {/* Relevant Moments for the selected series */}
      <MomentsTable
        artifact={artifact}
        sampleId={sampleId}
        highlight={mode === 'compare_cycles' ? compareList : [selectedSeries]}
        onPickSeries={(id) => onSeriesChange(id)}
      />
    </div>
  );
}
