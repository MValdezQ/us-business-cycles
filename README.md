# U.S. Business-Cycle Facts — interactive companion (v0.1)

Standalone static explorer for the `us-business-cycles-v1` publication artifact produced by the
separate Macro/RBC repository. It lets a reader inspect the evidence behind the stylised facts in
the companion post: consumption smoothness, investment volatility, the cyclicality of hours, the
relative quiescence of factor prices, and the weak correlation between real rates and output.

**This is an educational / technical study artifact, not original research.** No new empirical
claim, no statistical inference, no standard errors. Source redistribution clearance is
unverified — check originating providers' terms before republishing the underlying data.

## Running it

```sh
npm install
npm run dev              # local dev server
npm run build            # type-check + production build into dist/
npm run preview          # serve the production build
npm run verify:artifact  # reproducibility checks on the shipped artifact
```

The app is pure client-side: no backend, no database, no DuckDB, no LLM. It fetches
`data/us-business-cycles-v1.json` at runtime. Because browsers block `fetch` over `file://`,
serve `dist/` over HTTP rather than opening `index.html` directly.

## Updating the artifact

The artifact is vendored into `public/data/`. To refresh it from the research repo:

```sh
cp ../../macro_project/dist/publication/us-business-cycles-v1.json        public/data/
cp ../../macro_project/dist/publication/us-business-cycles-v1.schema.json public/data/
cp ../../macro_project/dist/publication/README.md                         public/data/ARTIFACT_README.md
npm run verify:artifact
```

`verify:artifact` fails the refresh if the artifact is internally inconsistent or if the
estimators used in the browser no longer reproduce the published moments.

## Deployment

`vite.config.ts` sets `base: './'`, so `dist/` is path-independent: it works at a domain root,
under a GitHub Pages project path, or in any subdirectory. Deploy by publishing `dist/` to any
static host (Netlify, Cloudflare Pages, GitHub Pages, S3). No server configuration is required
beyond serving `.json` with the usual content type.

Routing is hash-based (`#/overview`, `#/facts`, `#/visualizations`, …), so no SPA rewrite rules are needed.
The default `Start Here` view shows three sample-dependent descriptive findings and a cycle
comparison in approximate percentage deviations (100 × log cycles). Detailed views and all
existing embed URLs remain available. Real-rate findings are provisional until the Treasury
input's upstream monthly-to-quarterly convention is verified; reproducibility does not establish
that convention. No published observations or moments were changed for this presentation update.

## Cloudflare Pages deployment (prepared, not deployed)

Create a separate GitHub repository for this project and connect it to a new Cloudflare
Pages project (suggested project name: `econlab`). Do not change the website's existing project.

| Cloudflare setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | None |
| Root directory | Repository root (leave blank) |
| Build command | `npm run build:pages` |
| Build output directory | `site` |
| Build environment variable | `NODE_VERSION=22` |

Cloudflare installs the npm dependencies from this repository. The publication command checks
artifact consistency, type-checks and builds the app, then packages it under
`site/us-business-cycles/`. Generated output is excluded from Git.
The root URL redirects to `/us-business-cycles/`; it is not an EconLab landing page yet.

Test the initial `https://<project>.pages.dev/us-business-cycles/` URL. Then add
`econlab.mvaldez.de` in the new Pages project's Custom domains section, and follow its DNS
instructions. Do not replace the records for `mvaldez.de` or `www`.

The generated root `_headers` file restricts framing to `https://mvaldez.de` and
`https://www.mvaldez.de`. It applies to all paths, including the HTML used for hash routes.
No `X-Frame-Options` header is set: SAMEORIGIN would block this cross-origin integration.
These headers do not limit direct browsing or downloading the public artifact.
Website preview domains are not on the production framing allowlist.

Before considering deployment complete, inspect the live HTML response headers and test an
iframe on the permitted website and on a different origin. Local file packaging tests do not
establish that Cloudflare is applying the headers. Test the custom domain as well as pages.dev.
Check charts, data loading, links, and automatic iframe height after deployment.

## Article integration (local, not deployed)

The website repository is `/Users/martin/Developer/website`. Its unpublished outline is
`src/content/posts/us-business-cycle-facts.md`, visible only in the Astro development server.
Production builds exclude draft post routes and listings.

Markdown embeds use `<econlab-embed claim="consumption-smoother"></econlab-embed>`.
The reusable website component is `src/components/EconLabEmbed.astro`. Supported claim IDs:
`consumption-smoother`, `investment-volatile`, `hours-cyclical`, `factor-prices`, `real-rate-weak`.
The generic explorer remains available at `#/embed/explore`.

For local integration, serve this explorer on port 4317, then run in the website repository:

```sh
PUBLIC_ECONLAB_URL=http://localhost:4317/ npm run dev -- --port 4321
```

Visit `http://localhost:4321/posts/us-business-cycle-facts/`.
Without the environment override, the website targets
`https://econlab.mvaldez.de/us-business-cycles/` (planned deployment).

Iframe height is measured from `.embed-root` and sent using `econlab:resize` messages.
The website validates both the exact origin and iframe window, and bounds the height.
The explorer permits resize communication only with `https://mvaldez.de` and
`https://www.mvaldez.de`; localhost parents are permitted only for local testing.
Do not suppress the iframe referrer: it is used to establish the parent origin.
A provisional loading height is replaced by the measured content height.

“Open full analysis” links carry the sample and relevant chart selections into the standalone
explorer. Chart calculations and artifact values are shared, not reimplemented by the website.

No hosting changes have been made. `npm run build:pages` now generates the production
framing policy described above; it takes effect only when Cloudflare serves that publication.
Resize-message validation alone does not prevent third-party framing.

## Layout

```
index.html
public/data/            vendored artifact, schema, and artifact README
scripts/verify-artifact.mjs
src/
  App.tsx               shell, routing, selection state
  lib/artifact-types.ts data contract mirroring the JSON Schema
  lib/artifact.ts       loading, validation, representation availability, slicing
  lib/leadlag.ts        lead/lag profiles + reconciliation against the artifact
  lib/stats.ts          SD / correlation estimators matching the research pipeline
  components/           chart, selectors, moments table, lead/lag, methodology, claims
```
