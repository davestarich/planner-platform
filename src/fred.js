// A small FRED (Federal Reserve Economic Data) client. It fetches live economic
// series and turns them into the numbers our retirement engine cares about.
// The API key is read from the environment, never hard-coded. Get a free key at
// https://fredaccount.stlouisfed.org/apikeys

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations'

function apiKey() {
  const key = process.env.FRED_API_KEY
  if (!key) {
    throw new Error(
      'FRED_API_KEY is not set. Copy .env.example to .env and add your free FRED key.'
    )
  }
  return key
}

function round2(n) {
  return Math.round(n * 100) / 100
}

// Fetch the most recent observations for a FRED series, newest first.
async function fetchObservations(seriesId, limit) {
  const url = new URL(FRED_BASE)
  url.searchParams.set('series_id', seriesId)
  url.searchParams.set('api_key', apiKey())
  url.searchParams.set('file_type', 'json')
  url.searchParams.set('sort_order', 'desc')
  url.searchParams.set('limit', String(limit))

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`FRED request for ${seriesId} failed with status ${res.status}`)
  }
  const data = await res.json()
  return data.observations || []
}

// Current inflation as the trailing 12-month change in the Consumer Price Index.
// CPIAUCSL is monthly, and the newest month is often not published yet (FRED marks
// missing values as "."). So we fetch a few extra months, take the latest month that
// actually has a value, and compare it to the same month one year earlier.
export async function getCurrentInflation() {
  const obs = await fetchObservations('CPIAUCSL', 16)
  const valid = obs
    .filter((o) => o.value !== '.')
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))

  if (valid.length < 2) {
    throw new Error('Not enough CPI data returned from FRED to compute inflation.')
  }
  const latest = valid[0]
  // The same calendar month a year earlier, e.g. "2026-08-01" -> "2025-08".
  const [year, month] = latest.date.split('-')
  const yearAgoKey = `${Number(year) - 1}-${month}`
  const yearAgo = valid.find((o) => o.date.startsWith(yearAgoKey))

  if (!yearAgo) {
    throw new Error('Could not find CPI data from 12 months ago to compare against.')
  }
  const inflationPct = (latest.value / yearAgo.value - 1) * 100
  return { inflationPct: round2(inflationPct), asOf: latest.date }
}

// Latest 10-year Treasury yield (DGS10 is daily, so weekends/holidays are ".").
export async function getTreasuryYield10y() {
  const obs = await fetchObservations('DGS10', 10)
  const latest = obs.find((o) => o.value !== '.')
  if (!latest) {
    throw new Error('No recent 10-year Treasury value returned from FRED.')
  }
  return { yieldPct: parseFloat(latest.value), asOf: latest.date }
}

// Both figures together, fetched in parallel.
export async function getEconomicAssumptions() {
  const [inflation, treasury] = await Promise.all([
    getCurrentInflation(),
    getTreasuryYield10y(),
  ])
  return {
    inflationPct: inflation.inflationPct,
    inflationAsOf: inflation.asOf,
    tenYearTreasuryPct: treasury.yieldPct,
    treasuryAsOf: treasury.asOf,
    source: 'FRED: CPIAUCSL (inflation), DGS10 (10-year Treasury)',
  }
}
