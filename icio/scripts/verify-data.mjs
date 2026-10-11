// Verifies that the data package sitting in public/data is the real thing.
//
// Publishes nothing and recomputes nothing: it only checks that the numbers the dashboard
// displays are the numbers the analysis produced. A stale or half-copied package is the most
// likely way for this site to be quietly wrong, so the known values are pinned here.
//
// Run:  npm run verify:data

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DATA = join(import.meta.dirname, '..', 'public', 'data')
const FILES = ['metadata.json', 'world.json', 'country.json', 'industry.json', 'services_country.json']

let checks = 0
const failures = []

function check(name, ok, detail = '') {
  checks += 1
  if (!ok) failures.push(`${name} ${detail}`)
}

function readJson(name) {
  const path = join(DATA, name)
  if (!existsSync(path)) throw new Error(`Missing checked-in dashboard data file: ${path}`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** Same contract as the Python encoder: numeric dims are integer codes into dims[name]. */
function decode(payload) {
  const { dims, count, columns } = payload
  const out = { count, columns: {}, dims }
  for (const [name, values] of Object.entries(columns)) {
    check(`${name} length matches count`, values.length === count, `${values.length} != ${count}`)
    out.columns[name] = values
  }
  for (const [name, labels] of Object.entries(dims)) {
    const codes = out.columns[name]
    if (!codes) continue
    for (const code of codes) {
      if (code !== null && (code < 0 || code >= labels.length)) {
        check(`${name} codes resolve`, false, `code ${code} out of range`)
        break
      }
    }
  }
  return out
}

function label(table, column, i) {
  const labels = table.dims[column]
  return labels ? labels[table.columns[column][i]] : table.columns[column][i]
}

function rowIndex(table, dimColumns, wanted) {
  for (let i = 0; i < table.count; i += 1) {
    if (dimColumns.every(([column, value]) => label(table, column, i) === value)) return i
  }
  return -1
}

function close(actual, expected, tolerance) {
  return actual !== null && actual !== undefined && Math.abs(actual - expected) <= tolerance
}

const metadata = readJson('metadata.json')
const world = decode(readJson('world.json'))
const country = decode(readJson('country.json'))
const industry = decode(readJson('industry.json'))
const services = decode(readJson('services_country.json'))

// ------------------------------------------------------------------ shape
const years = metadata.coverage.years
const projected = metadata.coverage.projected_years
check('metadata covers 2016-2024', years.length === 9 && years[0] === 2016 && years[8] === 2024, `years=${years}`)
check('projections are 2023-2024 only', projected.join(',') === '2023,2024', `projected=${projected}`)
check('81 economies', metadata.coverage.economies === 81, `economies=${metadata.coverage.economies}`)
check(
  'attribution names the OECD publication',
  typeof metadata.attribution === 'string' && metadata.attribution.includes('10.1787/8217c2ff-en'),
  metadata.attribution,
)
check(
  'licensing note withholds a raw download',
  typeof metadata.licensing_note === 'string' && metadata.licensing_note.includes('not redistributed'),
  metadata.licensing_note,
)

check('world rows = years', world.count === years.length, `count=${world.count}`)
check('country rows = years x economies', country.count === years.length * 81, `count=${country.count}`)
check('industry rows = years x economies x 19', industry.count === years.length * 81 * 19, `count=${industry.count}`)
check(
  'services rows = years x economies x 20',
  services.count === years.length * 81 * 20,
  `count=${services.count}`,
)

// ------------------------------------------------------------------ pinned values
const MEX_2022 = rowIndex(country, [['economy', 'MEX'], ['year', 2022]])
check('MEX 2022 row exists', MEX_2022 >= 0)
if (MEX_2022 >= 0) {
  const c = country.columns
  check('MEX 2022 mfg exports', close(c.mfg_exports[MEX_2022], 409155.4, 0.05), `${c.mfg_exports[MEX_2022]}`)
  check('MEX 2022 domestic share', close(c.dva_share_incl_tax[MEX_2022], 0.60187, 1e-6), `${c.dva_share_incl_tax[MEX_2022]}`)
  check('MEX 2022 foreign share', close(c.fva_share_incl_tax[MEX_2022], 0.39813, 1e-6), `${c.fva_share_incl_tax[MEX_2022]}`)
  check('MEX 2022 services share', close(c.services_share[MEX_2022], 0.333206, 1e-6), `${c.services_share[MEX_2022]}`)
  check(
    'MEX 2022 domestic services share',
    close(c.services_domestic_share[MEX_2022], 0.506581, 1e-6),
    `${c.services_domestic_share[MEX_2022]}`,
  )
  check('MEX 2022 volume index', close(c.export_index[MEX_2022], 127.93685, 1e-4), `${c.export_index[MEX_2022]}`)
  check(
    'MEX 2022 cumulative value growth',
    close(c.export_growth_nominal_cumulative[MEX_2022], 0.5128, 0.001),
    `${c.export_growth_nominal_cumulative[MEX_2022]}`,
  )
  check(
    'MEX 2022 cumulative volume growth',
    close(c.export_growth_volume_cumulative[MEX_2022], 0.279369, 0.001),
    `${c.export_growth_volume_cumulative[MEX_2022]}`,
  )
  check(
    'MEX shares sum to one',
    close(c.dva_share_incl_tax[MEX_2022] + c.fva_share_incl_tax[MEX_2022], 1, 1e-6),
    `${c.dva_share_incl_tax[MEX_2022] + c.fva_share_incl_tax[MEX_2022]}`,
  )
}

const USA_2022 = rowIndex(country, [['economy', 'USA'], ['year', 2022]])
check('USA 2022 volume index is flat', close(country.columns.export_index[USA_2022], 100.038879, 1e-4), `${country.columns.export_index[USA_2022]}`)
check(
  'USA 2022 cumulative value growth',
  close(country.columns.export_growth_nominal_cumulative[USA_2022], 0.2257, 0.001),
  `${country.columns.export_growth_nominal_cumulative[USA_2022]}`,
)

const world2022 = rowIndex(world, [['year', 2022]])
check('world 2022 domestic share', close(world.columns.dva_share_incl_tax[world2022], 0.6950, 0.001), `${world.columns.dva_share_incl_tax[world2022]}`)
check('world 2022 exports', close(world.columns.mfg_exports[world2022], 14191000, 20000), `${world.columns.mfg_exports[world2022]}`)

// The base year of a cumulative series must be exactly zero for everyone, or the chart lies.
let baseYearBad = 0
for (let i = 0; i < country.count; i += 1) {
  if (country.columns.year[i] !== 2016) continue
  if (Math.abs(country.columns.export_growth_volume_cumulative[i]) > 1e-9) baseYearBad += 1
  if (Math.abs(country.columns.export_growth_nominal_cumulative[i]) > 1e-9) baseYearBad += 1
}
check('cumulative growth is zero in 2016', baseYearBad === 0, `${baseYearBad} non-zero cells`)

// Projected flags must agree with the metadata for every table that carries them.
for (const [name, table] of [['world', world], ['country', country], ['industry', industry], ['services', services]]) {
  let mismatch = 0
  for (let i = 0; i < table.count; i += 1) {
    const year = table.columns.year ? label(table, 'year', i) : null
    const flag = table.columns.projected ? table.columns.projected[i] : null
    if (year === null || flag === null) continue
    if (Boolean(flag) !== projected.includes(year)) mismatch += 1
  }
  check(`${name} projected flags agree with metadata`, mismatch === 0, `${mismatch} mismatches`)
}

// Services detail must sum back to the country totals it was built from.
let worstServicesGap = 0
for (let i = 0; i < country.count; i += 1) {
  const code = label(country, 'economy', i)
  const year = label(country, 'year', i)
  const published = country.columns.services_total[i]
  if (published === null) continue
  let summed = 0
  let seen = 0
  for (let j = 0; j < services.count; j += 1) {
    if (label(services, 'economy', j) !== code || label(services, 'year', j) !== year) continue
    const dva = services.columns.dva[j]
    const fva = services.columns.fva[j]
    if (dva === null || fva === null) continue
    summed += dva + fva
    seen += 1
  }
  if (seen === 0) continue
  worstServicesGap = Math.max(worstServicesGap, Math.abs(summed - published))
}
// Every component is rounded to 0.01 and there are twenty of them, plus the housekeeping
// residual, so a couple of hundred thousand dollars of drift over a country-year is expected.
check('services detail sums to country totals', worstServicesGap < 1.0, `worst gap = ${worstServicesGap}`)

// ------------------------------------------------------------------ report
if (failures.length > 0) {
  console.error(`verify:data FAILED (${failures.length} of ${checks} checks)`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log(`verify:data passed (${checks} checks)`)
