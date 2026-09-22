// The Express app for the public HTTP API: the retirement engine over HTTP.
// This module only DEFINES the app and exports it. Starting it is done elsewhere:
// src/api-server.js starts it locally, and api/index.js hands it to Vercel.

import { join } from 'node:path'

import express from 'express'

import { computeProjection, computeOnTrack, estimateSocialSecurity } from './calc.js'
import { getCurrentInflation, getEconomicAssumptions } from './fred.js'
import portalHtml from './portal.js'

// Locally, load secrets from .env. On Vercel there is no .env file (the variables are
// provided by the platform), so this throws and we simply ignore it.
try {
  process.loadEnvFile(join(import.meta.dirname, '..', '.env'))
} catch {
  // No .env file; process.env is already populated by the host (e.g. Vercel).
}

const app = express()

// Middleware: parse JSON request bodies into req.body on every request.
app.use(express.json())

// Serve the developer portal at the site root. We send the HTML string directly
// (rather than a static file) so it works identically locally and on Vercel.
app.get('/', (req, res) => {
  res.type('html').send(portalHtml)
})

// Health check as JSON at /health. Stays public (no key needed).
app.get('/health', (req, res) => {
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

// Simple in-memory rate limiter: at most RATE_LIMIT_MAX requests per key per window.
// (In production this counter would live in a shared store like Redis so it survives
// restarts and works across multiple server instances. The logic is the same.)
const RATE_LIMIT_MAX = 5
const RATE_WINDOW_MS = 15000
const hits = new Map() // apiKey -> { count, resetAt }

function rateLimit(req, res, next) {
  const key = req.get('x-api-key') // auth already ran, so a valid key is present
  const now = Date.now()

  let record = hits.get(key)
  if (!record || now >= record.resetAt) {
    // First request, or the previous window has expired: start a fresh window.
    record = { count: 0, resetAt: now + RATE_WINDOW_MS }
    hits.set(key, record)
  }
  record.count++

  // Tell the caller their limit and how many requests they have left.
  res.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX))
  res.set('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT_MAX - record.count)))

  if (record.count > RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000)
    res.set('Retry-After', String(retryAfter))
    return res
      .status(429)
      .json({ error: `Rate limit exceeded. Try again in ${retryAfter}s.` })
  }
  next()
}

app.use('/v1', rateLimit)

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

export default app
