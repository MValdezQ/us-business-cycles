import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Package the independent explorer at its durable public URL. Keep dist/ unchanged
// so npm run preview still serves the standalone build locally.
const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
const site = new URL('site/', root);
const product = new URL('us-business-cycles/', site);

// Fail before replacing the publication directory if the expected build is absent.
await readFile(new URL('index.html', dist));
const artifact = JSON.parse(await readFile(new URL('data/us-business-cycles-v1.json', dist), 'utf8'));
if (artifact.artifact_id !== 'us-business-cycles-v1') throw new Error('Unexpected publication artifact');

await rm(site, { recursive: true, force: true });
await mkdir(product, { recursive: true });
await cp(dist, product, { recursive: true });

// Cloudflare Pages reads these at the publication root. Hash routes share the
// same HTML response, so the policy applies to standalone and embed views alike.
await writeFile(new URL('_headers', site), `/*
  Content-Security-Policy: frame-ancestors https://mvaldez.de https://www.mvaldez.de
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`);
await writeFile(new URL('_redirects', site), `/ /us-business-cycles/ 302
`);
console.log(`Cloudflare Pages publication ready: ${fileURLToPath(site)}`);
console.log('Output directory: site; product path: /us-business-cycles/');
