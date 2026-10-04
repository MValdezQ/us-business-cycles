import { useEffect, useState } from 'react';
import { loadArtifact } from './lib/artifact';
import { SAMPLE_IDS, SERIES_IDS, type Artifact, type SampleId, type SeriesId } from './lib/artifact-types';
import VisualizationsView from './components/VisualizationsView';
import MomentsTable from './components/MomentsTable';
import LeadLagView from './components/LeadLagView';
import MethodologyPanel from './components/MethodologyPanel';
import ClaimsView from './components/ClaimsView';
import EmbedView from './components/EmbedView';
import { SampleSelector, SeriesSelector } from './components/Selectors';

type Route = 'visualizations' | 'facts' | 'moments' | 'leadlag' | 'methodology' | 'embed';

const ROUTES: { id: Route; label: string }[] = [
  { id: 'visualizations', label: 'Visualizations' },
  { id: 'facts', label: 'Stylized Facts' },
  { id: 'moments', label: 'Moments Table' },
  { id: 'leadlag', label: 'Lead / Lag Dynamics' },
  { id: 'methodology', label: 'Methodology & Provenance' },
];

interface RouteInfo {
  route: Route;
  isEmbed: boolean;
  embedType?: 'claim' | 'explore';
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
  return {
    route: (matched?.id ?? 'visualizations') as Route,
    isEmbed: false,
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
  if (routeInfo.isEmbed) {
    return (
      <div className="embed-root">
        <EmbedView
          artifact={artifact}
          embedType={routeInfo.embedType || 'claim'}
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
        {/* Route 1: Visualizations (Flagship default) */}
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
                go('visualizations');
              }}
            />
          </section>
        )}

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
          Built strictly from <code>{artifact.artifact_id}</code>. Client-side static rendering: no server, no LLM, no external database. All values are read directly or computed in the browser from public macroeconomic data.
        </p>
        <p className="footnote">{artifact.provenance.vintage_caveat}</p>
      </footer>
    </div>
  );
}
