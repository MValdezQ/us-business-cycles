# U.S. business-cycle publication artifact

The publication files are `us-business-cycles-v1.json` and `us-business-cycles-v1.schema.json`. They are self-contained for downstream consumers; the JSON Schema has no external references.

Generate and test from the repository root:

```sh
uv run python src/usa/empirical/export_us_business_cycles.py
uv run python -m unittest discover -s tests -v
```

Generation requires the local U.S. source files and derived CSVs, which are not tracked by Git. The artifact can be consumed without them.

## Contents

Ten stable analysis series: output, consumption, investment, hours, wage, productivity, real rate, price level, measured TFP and utilization-adjusted TFP. The artifact includes source values, derived economic levels where meaningful, transformed series, HP trends/cycles, labels, units, transformation descriptions, coverage and provenance.

The canonical benchmark is 1948Q1–2026Q1 (313 quarters). The artifact also defines pre-1984 (1948Q1–1983Q4) and post-1984 (1984Q1–2026Q1) samples. Each is independently HP-filtered with lambda 1600 and includes moments, four-quarter lead/lag correlations and HP-cycle TFP AR(1) estimates. Full-sample linear-detrended and HP-cycle TFP estimates are also included. They are empirical estimates, not selected model calibration values.

Current coverage is about 78 years. Hours, wages and productivity are indices. Real-rate moments are quarterly decimal-rate units and are not directly comparable to logged-quantity volatility. Utilization-adjusted TFP is normalized to 1 at 1947Q1. The real rate has no separate economic level representation. Native source series have different coverage; missing values are not imputed.

## Provenance and limitations

Source names, provider links, local modification dates and SHA-256 hashes are included. Local modification dates are not official release vintages. The local TB3MS source contains quarter-start observations, and its monthly-to-quarterly aggregation convention is undocumented. Redistribution clearance for originating providers, Fernald and BLS has not been verified; check source terms before public redistribution or downloadable raw values.
