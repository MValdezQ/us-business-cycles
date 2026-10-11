# ICIO dashboard snapshot

This directory is a self-contained source snapshot of the ICIO dashboard prepared for the
existing EconLab Cloudflare Pages publication at `/icio/`. The analytical source is the external
`ICIO` repository in the working workspace; the five derived dashboard JSON files are
checked in under `public/data/` so CI and Pages builds do not depend on that source tree.

The snapshot deliberately contains no raw ICIO download and no browser-side Leontief calculation.
The browser reshapes only the published derived indicators. The `verify:data` script checks the
copied package and `npm run build` runs that check before typechecking and building.

```sh
npm ci
npm run verify:data
npm run build
```

The build is path-independent (`base: './'`) and produces `dist/`. The production packaging in
the repository root copies that output to `site/icio/` alongside `site/us-business-cycles/`.
