import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Package the independent explorer at its durable public URL. Keep dist/ unchanged
// so npm run preview still serves the standalone build locally.
const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
const site = new URL('site/', root);
const product = new URL('us-business-cycles/', site);
const icioRoot = new URL('icio/', root);
const icioDist = new URL('dist/', icioRoot);
const icioProduct = new URL('icio/', site);

// Fail before replacing the publication directory if the expected build is absent.
await readFile(new URL('index.html', dist));
const artifact = JSON.parse(await readFile(new URL('data/us-business-cycles-v1.json', dist), 'utf8'));
if (artifact.artifact_id !== 'us-business-cycles-v1') throw new Error('Unexpected publication artifact');
await readFile(new URL('index.html', icioDist));
await readFile(new URL('data/metadata.json', icioDist));

await rm(site, { recursive: true, force: true });
await mkdir(product, { recursive: true });
await mkdir(icioProduct, { recursive: true });
await cp(dist, product, { recursive: true });
await cp(icioDist, icioProduct, { recursive: true });

// Cloudflare Pages reads these at the publication root. Hash routes share the
// same HTML response, so the policy applies to standalone and embed views alike.
await writeFile(new URL('_headers', site), `/*
  Content-Security-Policy: frame-ancestors https://mvaldez.de https://www.mvaldez.de
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`);

// The publication root is the EconLab product index. It replaces the earlier
// /  ->  /us-business-cycles/ redirect so the domain can host several tools.
// Self-contained: inline CSS only, no external requests, no build step.
await writeFile(new URL('index.html', site), landingPage());

console.log(`Cloudflare Pages publication ready: ${fileURLToPath(site)}`);
console.log('Output directory: site; landing page plus product paths /us-business-cycles/ and /icio/');

function landingPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>EconLab — interactive economic data</title>
<meta name="description" content="Interactive, source-documented tools for reading economic data closely: U.S. business cycles and global value chains in manufacturing exports." />
<style>
:root{
  --ink:#1a1d21; --ink-soft:#4a5158; --muted:#6b7280;
  --line:#dfe3e8; --line-soft:#eef1f4;
  --bg:#f7f8fa; --card:#ffffff; --accent:#1f4ea1; --radius:10px;
  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
}
*{box-sizing:border-box;}
body{
  margin:0; background:var(--bg); color:var(--ink);
  font:16px/1.6 var(--sans); -webkit-font-smoothing:antialiased;
}
.page{max-width:1000px; margin:0 auto; padding:72px 24px 64px;}
header{max-width:60ch;}
h1{margin:0; font-size:2.15rem; line-height:1.15; letter-spacing:-0.02em;}
.lede{margin:14px 0 0; font-size:1.08rem; color:var(--ink-soft);}
.cards{
  display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr));
  gap:20px; margin:44px 0 0; padding:0; list-style:none;
}
.card{
  display:flex; flex-direction:column; height:100%;
  background:var(--card); border:1px solid var(--line); border-radius:var(--radius);
  padding:24px 24px 22px; text-decoration:none; color:inherit;
  transition:border-color .15s ease, box-shadow .15s ease, transform .15s ease;
}
.card:hover{border-color:var(--accent); box-shadow:0 6px 20px rgba(31,78,161,.10); transform:translateY(-2px);}
.card:focus-visible{outline:3px solid var(--accent); outline-offset:2px;}
.card h2{margin:0; font-size:1.2rem; line-height:1.3; color:var(--accent);}
.card p{margin:12px 0 0; color:var(--ink-soft); font-size:.96rem;}
.card .meta{
  margin-top:auto; padding-top:18px; border-top:1px solid var(--line-soft);
  font-size:.82rem; color:var(--muted);
  font-family:ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace;
}
footer{margin:56px 0 0; padding-top:20px; border-top:1px solid var(--line); font-size:.9rem; color:var(--muted);}
footer a{color:var(--accent);}
@media (max-width:560px){
  .page{padding:48px 18px 48px;}
  h1{font-size:1.8rem;}
}
</style>
</head>
<body>
<main class="page">
  <header>
    <h1>EconLab</h1>
    <p class="lede">Interactive, source-documented tools for reading economic data closely. Each tool ships the data with the chart, so every figure can be traced, re-sliced and checked.</p>
  </header>
  <ul class="cards">
    <li style="display:flex">
      <a class="card" href="./us-business-cycles/">
        <h2>U.S. Business Cycles Explorer</h2>
        <p>An interactive look at U.S. business-cycle facts — how consumption, investment, hours, factor prices and real rates move over the cycle, alongside long-run growth and the great ratios.</p>
        <span class="meta">U.S. data &middot; 1948&ndash;2026 &middot; 10 series &middot; HP filter</span>
      </a>
    </li>
    <li style="display:flex">
      <a class="card" href="./icio/">
        <h2>Global Value Chains &amp; Manufacturing Exports</h2>
        <p>How much domestic value added, foreign content and services content is embodied in each economy&rsquo;s manufacturing exports, and how that has changed.</p>
        <span class="meta">OECD ICIO &middot; 81 economies &middot; 2016&ndash;2022 &middot; projections to 2024</span>
      </a>
    </li>
  </ul>
  <footer>
    <p>Built by Martín Valdez &middot; <a href="https://mvaldez.de">mvaldez.de</a><br />
    Data from the U.S. Bureau of Economic Analysis, Bureau of Labor Statistics and Federal Reserve, and the OECD Inter-Country Input&ndash;Output tables.</p>
  </footer>
</main>
</body>
</html>
`;
}
