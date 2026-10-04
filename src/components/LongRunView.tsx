import { useState } from 'react';
import type { Artifact } from '../lib/artifact-types';
import { quarterLabel, fmtAuto } from '../lib/format';
import {
  getLongRunSlices,
  LONGRUN_PANELS,
  LONGRUN_SPECS,
  summarize,
  type LongRunPanel,
} from '../lib/longrun';
import TimeSeriesChart from './TimeSeriesChart';

export function isLongRunPanel(x: string | null | undefined): x is LongRunPanel {
  return !!x && (LONGRUN_PANELS as readonly string[]).includes(x);
}

function PanelBody({ artifact, panel, height }: { artifact: Artifact; panel: LongRunPanel; height: number }) {
  const spec = LONGRUN_SPECS[panel];
  const slices = getLongRunSlices(artifact, panel);
  const rows = summarize(slices);
  const isIndex = spec.unit.startsWith('index');
  return (
    <>
      <TimeSeriesChart slices={slices} unitLabel={spec.unit} height={height} lineStyles={spec.dashed?.map((d) => (d ? 'dashed' : 'solid'))} />
      <div className="table-scroll">
        <table className="moments compact">
          <thead>
            <tr>
              <th>Series</th>
              <th>First</th>
              <th>Latest</th>
              <th>Min</th>
              <th>Max</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td>{fmtAuto(r.first)}</td>
                <td>{fmtAuto(r.last)}</td>
                <td>{fmtAuto(r.min)}</td>
                <td>{fmtAuto(r.max)}</td>
                <td>
                  {quarterLabel(r.start)}–{quarterLabel(r.end)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isIndex && <p className="footnote">Growth since the first observation is the ratio of Latest to First.</p>}
    </>
  );
}

export default function LongRunView({
  artifact,
  panel: initial,
  onPanelChange,
}: {
  artifact: Artifact;
  panel?: LongRunPanel;
  onPanelChange?: (p: LongRunPanel) => void;
}) {
  const [panel, setPanelState] = useState<LongRunPanel>(initial ?? 'great-ratios');
  const setPanel = (p: LongRunPanel) => {
    setPanelState(p);
    onPanelChange?.(p);
  };
  const spec = LONGRUN_SPECS[panel];
  return (
    <section>
      <div className="controls">
        <fieldset className="selector">
          <legend>Long-run fact</legend>
          <div className="chips">
            {LONGRUN_PANELS.map((p) => (
              <button key={p} type="button" className={`chip ${panel === p ? 'on' : ''}`} onClick={() => setPanel(p)}>
                {LONGRUN_SPECS[p].tab}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="panel chart-panel">
        <div className="panel-head">
          <h3>{spec.title}</h3>
          <p className="muted">{spec.note}</p>
        </div>
        <PanelBody artifact={artifact} panel={panel} height={360} />
        <p className="footnote">{spec.caveat}</p>
      </div>
    </section>
  );
}

export function LongRunEmbed({ artifact, panel }: { artifact: Artifact; panel: LongRunPanel }) {
  const spec = LONGRUN_SPECS[panel];
  const href = `${window.location.href.split('#')[0]}#/longrun?panel=${panel}`;
  return (
    <div className="embed-container">
      <header className="embed-header">
        <div className="embed-title-block">
          <h2 className="embed-title">{spec.title}</h2>
        </div>
      </header>
      <p className="embed-finding">{spec.note}</p>
      <div className="embed-chart-wrapper">
        <PanelBody artifact={artifact} panel={panel} height={260} />
      </div>
      <footer className="embed-footer">
        <span className="embed-caveat">{spec.caveat}</span>
        <a href={href} target="_blank" rel="noopener noreferrer" className="embed-open-link">
          Open full analysis ↗
        </a>
      </footer>
    </div>
  );
}
