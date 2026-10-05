import { useEffect, useState } from 'react';
import { getCycleSlice, loadArtifact } from './lib/artifact';
import { fmt, quarterLabel } from './lib/format';
import TimeSeriesChart from './components/TimeSeriesChart';
import { SAMPLE_IDS, SERIES_IDS, type Artifact, type SampleId, type SeriesId } from './lib/artifact-types';
import VisualizationsView from './components/VisualizationsView';
import MomentsTable from './components/MomentsTable';
import LeadLagView from './components/LeadLagView';
import MethodologyPanel from './components/MethodologyPanel';
import ClaimsView from './components/ClaimsView';
import EmbedView from './components/EmbedView';
import LongRunView, { LongRunEmbed, isLongRunPanel } from './components/LongRunView';
import type { LongRunPanel } from './lib/longrun';
import { SampleSelector, SeriesSelector } from './components/Selectors';

type Route = 'overview' | 'visualizations' | 'facts' | 'longrun' | 'moments' | 'leadlag' | 'methodology' | 'embed';

const ROUTES: { id: Route; label: string }[] = [
  { id: 'overview', label: 'Start Here' },
  { id: 'visualizations', label: 'Visualizations' },
  { id: 'facts', label: 'Stylized Facts' },
  { id: 'longrun', label: 'Long Run' },
  { id: 'moments', label: 'Moments Table' },
  { id: 'leadlag', label: 'Lead / Lag Dynamics' },
  { id: 'methodology', label: 'Methodology & Provenance' },
];

interface RouteInfo {
  route: Route;
  isEmbed: boolean;
  embedType?: 'claim' | 'explore' | 'longrun';
  panel?: LongRunPanel;
  claimId?: string;
  seriesId?: SeriesId;
  sampleId?: SampleId;
  scale?: 'per_capita' | 'aggregate';
  rep?: 'cycle' | 'detrend' | 'level';
}

function parseHashLocation(): RouteInfo {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [path, queryStr] = hash.split('?');
  const params = new URLSearchParams(queryStr || '');

  // Embed routing: #/embed/claim/<claim-id> or #/embed/explore
  if (path.startsWith('embed')) {
    const parts = path.split('/');
    // parts[0] is 'embed'
    if (parts[1] === 'longrun') {
      return { route: 'embed', isEmbed: true, embedType: 'longrun', panel: isLongRunPanel(parts[2]) ? parts[2] : 'great-ratios' };
    }
    if (parts[1] === 'claim') {
      const claimId = parts[2] || 'consumption-smoother';
      return {
        route: 'embed',
        isEmbed: true,
        embedType: 'claim',
        claimId,
        sampleId: (params.get('sample') as SampleId) || 'full',
      };
    }
    // generic explore embed
    return {
      route: 'embed',
      isEmbed: true,
      embedType: 'explore',
      seriesId: (params.get('series') as SeriesId) || 'log_C_pc',
      sampleId: (params.get('sample') as SampleId) || 'full',
      scale: (params.get('scale') as 'per_capita' | 'aggregate') || 'per_capita',
      rep: (params.get('rep') as 'cycle' | 'detrend' | 'level') || 'detrend',
    };
  }

  // Standalone app routing
  if (path === 'explore') {
    return { route: 'visualizations', isEmbed: false };
  }
  if (path === 'claims') {
    return { route: 'facts', isEmbed: false };
  }

  const matched = ROUTES.find((r) => r.id === path);
  const panelParam = params.get('panel');
  return {
    route: (matched?.id ?? 'overview') as Route,
    isEmbed: false,
    panel: isLongRunPanel(panelParam) ? panelParam : undefined,
  };
}

export default function App() {
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo>(parseHashLocation);

  // Active selections for standalone explorer
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const requestedSeries = params.get('series') as SeriesId;
  const requestedSample = params.get('sample') as SampleId;
  const requestedCompare = [...new Set((params.get('compare') || '').split(',').filter((id) => SERIES_IDS.includes(id as SeriesId)))] as SeriesId[];
  const [seriesId, setSeriesId] = useState<SeriesId>(SERIES_IDS.includes(requestedSeries) ? requestedSeries : 'log_C_pc');
  const [compare, setCompare] = useState<SeriesId[]>(requestedCompare.length ? requestedCompare.slice(0, 4) : ['log_Y_pc', 'log_C_pc', 'log_I_pc']);
  const [sampleId, setSampleId] = useState<SampleId>(SAMPLE_IDS.includes(requestedSample) ? requestedSample : 'full');

  useEffect(() => {
    const ac = new AbortController();
    loadArtifact(ac.signal)
      .then(setArtifact)
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setError((e as Error).message);
      });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const onHash = () => setRouteInfo(parseHashLocation());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Size the iframe to its content; never trust an arbitrary message sender.
  useEffect(() => {
    if (!routeInfo.isEmbed || window.parent === window) return;
    let parentOrigin: string;
    try { parentOrigin = new URL(document.referrer).origin; } catch { return; }
    const allowed = ['https://mvaldez.de', 'https://www.mvaldez.de'];
    if (import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      const host = new URL(parentOrigin).hostname;
      if (['localhost', '127.0.0.1'].includes(host)) allowed.push(parentOrigin);
    }
    if (!allowed.includes(parentOrigin)) return;
    const root = document.querySelector('.embed-root');
    if (!root) return;
    const report = () => window.parent.postMessage({ type: 'econlab:resize', height: Math.ceil(root.getBoundingClientRect().height) }, parentOrigin);
    const receive = (event: MessageEvent) => {
      if (event.origin === parentOrigin && event.source === window.parent && event.data?.type === 'econlab:measure') report();
    };
    const observer = new ResizeObserver(report);
    observer.observe(root);
    window.addEventListener('message', receive);
    report();
    return () => { observer.disconnect(); window.removeEventListener('message', receive); };
  }, [routeInfo.isEmbed, artifact, error]);

  const go = (r: Route) => {
    window.location.hash = `#/${r}`;
    setRouteInfo({ route: r, isEmbed: false });
  };

  if (error) {
    return (
      <div className={routeInfo.isEmbed ? 'embed-root' : 'app'}>
        <div className="panel error">
          <h2>The artifact could not be loaded</h2>
          <p>{error}</p>
          <p className="footnote">
            Static artifact loading error. Verify <code>data/us-business-cycles-v1.json</code> exists.
          </p>
        </div>
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className={routeInfo.isEmbed ? 'embed-root' : 'app'}>
        <p className="loading" role="status">
          Loading the U.S. business-cycle artifact…
        </p>
      </div>
    );
  }

  // --- EMBED MODE (No Masthead, No Shell, No Navigation Tabs) ---
  if (routeInfo.isEmbed && routeInfo.embedType === 'longrun') {
    return (
      <div className="embed-root">
        <LongRunEmbed artifact={artifact} panel={routeInfo.panel ?? 'great-ratios'} />
      </div>
    );
  }
  if (routeInfo.isEmbed) {
    return (
      <div className="embed-root">
        <EmbedView
          artifact={artifact}
          embedType={routeInfo.embedType === 'explore' ? 'explore' : 'claim'}
          claimId={routeInfo.claimId}
          initialSeries={routeInfo.seriesId}
          initialSample={routeInfo.sampleId}
          initialScale={routeInfo.scale}
          initialRep={routeInfo.rep}
        />
      </div>
    );
  }

  // --- STANDALONE FULL PRODUCT MODE ---
  const route = routeInfo.route;
  const sample = artifact.sample_definitions[sampleId];
  const moments = artifact.sample_results[sampleId].moments;
  const consumption = moments.find((m) => m.series_id === 'log_C_pc')!;
  const investment = moments.find((m) => m.series_id === 'log_I_pc')!;
  const hours = moments.find((m) => m.series_id === 'log_hours_pc')!;

  return (
    <div className="app">
      {/* Header */}
      <header className="masthead">
        <div className="masthead-top">
          <div>
            <h1>What the U.S. Business Cycle Looks Like</h1>
            <p className="subtitle">
              An interactive look at U.S. Business Cycle facts
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="tabs" aria-label="Sections">
          {ROUTES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`tab${route === r.id ? ' on' : ''}`}
              aria-current={route === r.id ? 'page' : undefined}
              onClick={() => go(r.id)}
            >
              {r.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Views */}
      <main>
        {route === 'overview' && (
          <section className="stack">
            <div className="panel">
              <h2>Three patterns in the U.S. business cycle</h2>
              <p>Start with how spending and hours move around their trends. Change the sample to see how the patterns differ across periods.</p>
              <SampleSelector artifact={artifact} value={sampleId} onChange={setSampleId} />
            </div>
            <div className="claims">
              <article className="claim-card">
                <h3>Consumption and output</h3>
                <p className="stat-line"><span className="stat-name">Relative cyclical volatility</span><strong className="stat-value">{fmt(consumption.rel_std_dev, 2)}×</strong></p>
                <p>Consumption fluctuates {consumption.rel_std_dev < 1 ? 'less' : consumption.rel_std_dev > 1 ? 'more' : 'as much'} than output in this sample. Its cyclical standard deviation is {fmt(consumption.rel_std_dev, 2)} times output’s.</p>
              </article>
              <article className="claim-card">
                <h3>Investment and output</h3>
                <p className="stat-line"><span className="stat-name">Relative cyclical volatility</span><strong className="stat-value">{fmt(investment.rel_std_dev, 2)}×</strong></p>
                <p>Investment fluctuates {investment.rel_std_dev > 1 ? 'more' : investment.rel_std_dev < 1 ? 'less' : 'as much'} than output in this sample. Its cyclical standard deviation is {fmt(investment.rel_std_dev, 2)} times output’s.</p>
              </article>
              <article className="claim-card">
                <h3>Hours and output</h3>
                <p className="stat-line"><span className="stat-name">Correlation of cyclical deviations</span><strong className="stat-value">{fmt(hours.corr_y, 2)}</strong></p>
                <p>Hours and output have a {hours.corr_y > 0 ? 'positive' : hours.corr_y < 0 ? 'negative' : 'zero'} correlation in this sample. Hours have {fmt(hours.rel_std_dev, 2)} times output’s cyclical standard deviation.</p>
              </article>
            </div>
            <div className="panel chart-panel">
              <h3>Output, consumption, and investment around their trends</h3>
              <p className="muted">{sample.name} · {quarterLabel(sample.start)}–{quarterLabel(sample.end)}. Above zero means above the estimated trend; below zero means below it.</p>
              <TimeSeriesChart
                slices={(['log_Y_pc', 'log_C_pc', 'log_I_pc'] as const).map((id) => {
                  const slice = getCycleSlice(artifact, id, sampleId);
                  return { ...slice, unit: 'Approximate percent deviation from trend', points: slice.points.map((p) => ({ ...p, value: p.value === null ? null : p.value * 100 })) };
                })}
                unitLabel="Approximate percent deviation from trend (100 × log deviation)"
                zeroLine
                height={320}
              />
              <p className="footnote">Quantities are per civilian adult (age 16+). Consumption is a constructed measure: nominal nondurables and services deflated with the GDP deflator, not official BEA real consumption. Investment includes consumer durables. These are descriptive comparisons, not statistical tests or causal evidence.</p>
              <p className="footnote">HP trends are estimated separately within each sample. They are especially sensitive near the endpoints; recent deviations can change as new data arrive. The estimated cycle is not a recession chronology.</p>
              <button type="button" className="inspect" onClick={() => go('visualizations')}>Explore log levels, trends, and cycles →</button>
              {' · '}
              <button type="button" className="inspect" onClick={() => go('moments')}>See all moments →</button>
            </div>
          </section>
        )}
        {/* Route 1: Detailed visualizations */}
        {route === 'visualizations' && (
          <VisualizationsView
            artifact={artifact}
            sampleId={sampleId}
            onSampleChange={setSampleId}
            selectedSeries={seriesId}
            onSeriesChange={setSeriesId}
            compareList={compare}
            onCompareToggle={(id) =>
              setCompare((c) =>
                c.includes(id) ? (c.length > 1 ? c.filter((x) => x !== id) : c) : c.length >= 4 ? c : [...c, id],
              )
            }
          />
        )}

        {/* Route 2: Stylized Facts */}
        {route === 'facts' && (
          <section>
            <div className="controls narrow">
              <SampleSelector
                artifact={artifact}
                value={sampleId}
                onChange={setSampleId}
                note="Subsamples are independently HP-filtered, so the empirical moments behind each fact adapt to the chosen historical window."
              />
            </div>
            <ClaimsView
              artifact={artifact}
              sampleId={sampleId}
              onInspect={(focus) => {
                setCompare(focus.slice(0, 4));
                setSeriesId(focus[0]);
                window.location.hash = `#/visualizations?mode=compare_cycles&sample=${sampleId}&series=${focus[0]}&compare=${focus.slice(0, 4).join(',')}`;
                setRouteInfo(parseHashLocation());
              }}
            />
          </section>
        )}

        {route === 'longrun' && <LongRunView key={routeInfo.panel ?? 'default'} artifact={artifact} panel={routeInfo.panel} />}

        {/* Route 3: Moments Table */}
        {route === 'moments' && (
          <section>
            <div className="controls narrow">
              <SampleSelector artifact={artifact} value={sampleId} onChange={setSampleId} />
            </div>
            <MomentsTable artifact={artifact} sampleId={sampleId} highlight={compare} />
            <div className="panel">
              <h3>Interpreting the Moments Table</h3>
              <ul className="notes">
                <li>
                  <strong>SD / SD(Y) &lt; 1:</strong> smoother than output (e.g. consumption at ~0.66).
                </li>
                <li>
                  <strong>SD / SD(Y) &gt; 1:</strong> more volatile than output (e.g. investment at ~2.62).
                </li>
                <li>
                  <strong>Corr(x, Y) &gt; 0:</strong> procyclical comovement with GDP.
                </li>
                <li>
                  <strong>AR(1):</strong> persistence of cyclical deviations across consecutive quarters.
                </li>
                <li>
                  Compare the <em>Pre-1984</em> vs <em>Post-1984</em> samples to see the volatility moderation ("Great Moderation").
                </li>
              </ul>
            </div>
          </section>
        )}

        {/* Route 4: Lead / Lag Dynamics */}
        {route === 'leadlag' && (
          <section>
            <div className="controls">
              <SeriesSelector
                artifact={artifact}
                value={seriesId}
                onChange={setSeriesId}
                multi
                selected={compare}
                onToggle={(id) =>
                  setCompare((c) =>
                    c.includes(id) ? (c.length > 1 ? c.filter((x) => x !== id) : c) : c.length >= 4 ? c : [...c, id],
                  )
                }
              />
              <SampleSelector artifact={artifact} value={sampleId} onChange={setSampleId} />
            </div>
            <LeadLagView artifact={artifact} sampleId={sampleId} seriesIds={compare} />
          </section>
        )}

        {/* Route 5: Methodology & Provenance */}
        {route === 'methodology' && <MethodologyPanel artifact={artifact} />}
      </main>

      {/* Footer */}
      <footer className="site-foot">
        <p>
          Sources: BEA, BLS, Federal Reserve/Treasury via FRED, and Fernald. Business-cycle sample: {quarterLabel(artifact.canonical_sample.start)}–{quarterLabel(artifact.canonical_sample.end)}; long-run figures show their own coverage.
        </p>
        <p className="footnote">Latest observations reflect the bundled data, not a live feed. Official release vintages are not recorded. <a href="#/methodology">Definitions, sources, and limitations →</a></p>
      </footer>
    </div>
  );
}
