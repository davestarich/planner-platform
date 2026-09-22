// The public HTTP API: the same retirement engine, exposed over HTTP for developers.
// Step 2: all four capabilities, matching the MCP server. Auth comes next.

import { join } from 'node:path'

import express from 'express'

import { computeProjection, computeOnTrack, estimateSocialSecurity } from './calc.js'
import { getCurrentInflation, getEconomicAssumptions } from './fred.js'

// Load the FRED API key from .env, the same way the MCP server does. Wrapped in
// try/catch so the server still starts without it; FRED-backed endpoints will then
// report a clear error only when they are actually called.
try {
  process.loadEnvFile(join(import.meta.dirname, '..', '.env'))
} catch {
  // No .env file found; that's fine unless a FRED-backed endpoint gets called.
}

const app = express()

// Middleware: parse JSON request bodies into req.body on every request.
app.use(express.json())

// Health check. A GET here confirms the server is up. This one stays public.
app.get('/', (req, res) => {
  res.json({ name: 'planner-platform API', status: 'ok' })
})

// The set of API keys we accept, loaded from the environment (never hard-coded).
const validApiKeys = new Set(
  (process.env.PLANNER_API_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
)

// Auth middleware: a function that runs before the endpoint. Every /v1 request must
// present a valid key in the x-api-key header, or we stop here with 401 Unauthorized
// and never run the engine.
function requireApiKey(req, res, next) {
  const key = req.get('x-api-key')
  if (!key) {
    return res
      .status(401)
      .json({ error: 'Missing API key. Send it in the x-api-key header.' })
  }
  if (!validApiKeys.has(key)) {
    return res.status(401).json({ error: 'Invalid API key.' })
  }
  next() // key is valid, so continue on to the actual endpoint
}

// Protect everything under /v1. The health check above is not affected.
app.use('/v1', requireApiKey)

// Retirement projection. inflationPct is optional: if omitted, we fetch it live from
// FRED, exactly like the MCP tool, so both front doors behave the same.
app.post('/v1/projection', async (req, res) => {
  try {
    const { monthlySpendToday, yearsToRetirement, inflationPct, returnPct, withdrawalPct } =
      req.body || {}

    let inflation = inflationPct
    let inflationSource = 'provided by caller'
    if (inflation == null) {
      const live = await getCurrentInflation()
      inflation = live.inflationPct
      inflationSource = `live from FRED (CPIAUCSL) as of ${live.asOf}`
    }

    const result = computeProjection({
      monthlySpendToday,
      yearsToRetirement,
      inflationPct: inflation,
      returnPct,
      withdrawalPct,
    })
    res.json({ ...result, inflationPct: inflation, inflationSource })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// On-track check. Self-contained: works out the target internally, then compares.
app.post('/v1/on-track', (req, res) => {
  const args = req.body || {}
  const { targetNominal } = computeProjection(args)
  const onTrack = computeOnTrack({ ...args, targetNominal })
  res.json({ targetNominal, ...onTrack })
})

// Social Security estimate.
app.post('/v1/social-security', (req, res) => {
  const monthlyBenefit = estimateSocialSecurity(req.body || {})
  res.json({ monthlyBenefit })
})

// Current economic assumptions from FRED. This is a GET because it only READS data
// and takes no input, unlike the POSTs above which accept a JSON body.
app.get('/v1/economic-assumptions', async (req, res) => {
  try {
    const data = await getEconomicAssumptions()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Start listening. The server stays up until you stop it with Ctrl+C.
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`planner-platform API listening on http://localhost:${PORT}`)
})
