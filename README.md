# Planner Platform

One retirement calculation engine, served through three interfaces. The same
pure-math core powers a consumer web app, an [MCP](https://modelcontextprotocol.io)
server for AI clients, and a public HTTP API for developers.

The idea is to treat a single domain engine as a product and expose it the way each
audience actually wants to consume it: a UI for end users, tools for AI assistants,
and an API for other developers. One engine, three front doors.

- **Web app** (Future Planner) — the retirement calculator for end users.
- **MCP server** — the engine as tools any AI client can call.
- **Public HTTP API** — the engine over HTTP for developers, with API-key auth and
  rate limiting. Live at **https://planner-platform-opal.vercel.app**.

See [CASE-STUDY.md](CASE-STUDY.md) for the story and the decisions behind it.

## Public HTTP API

Live at **https://planner-platform-opal.vercel.app** (open it in a browser for a
docs / try-it page). Every `/v1` endpoint needs an API key in an `x-api-key` header
and is rate limited per key.

| Method | Endpoint | What it does |
| --- | --- | --- |
| `POST` | `/v1/projection` | Nest egg needed to retire. `inflationPct` optional (live from FRED if omitted). |
| `POST` | `/v1/on-track` | Whether current savings are on track, close, or short. |
| `POST` | `/v1/social-security` | Estimated monthly Social Security benefit. |
| `GET` | `/v1/economic-assumptions` | Live inflation (CPI) and 10-year Treasury yield from FRED. |
| `GET` | `/health` | Public health check. |

Example:

```bash
curl -X POST https://planner-platform-opal.vercel.app/v1/projection \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"monthlySpendToday":4000,"yearsToRetirement":20,"returnPct":6,"withdrawalPct":4}'
```

A ready-to-import Postman collection is in [postman/](postman/).

## MCP server

Exposes the same engine as four tools any MCP-compatible client (Claude Desktop,
Cursor, the MCP Inspector) can call over stdio.

| Tool | What it does |
| --- | --- |
| `retirement_projection` | Nest egg needed to retire. Inflation pulled live from FRED if omitted. |
| `social_security_estimate` | Monthly Social Security benefit from career-average income, claim age, and household. |
| `retirement_on_track` | Projection vs current savings: on track, close, or short. |
| `economic_assumptions` | Live inflation (CPI) and 10-year Treasury yield from FRED, with as-of dates. |

## The shared engine

The math lives in `src/calc.js` as pure functions with no UI, so every interface runs
the exact same logic. `src/fred.js` grounds projections in live economic data from the
FRED API. Each front door (MCP tools, HTTP routes) is a thin layer over these.

## Run it locally

```bash
npm install

# Set up your keys (both are free). .env is gitignored, so keys never enter the repo.
cp .env.example .env
# FRED key:  https://fredaccount.stlouisfed.org/apikeys
# API key:   node -e "console.log('plnr_' + require('crypto').randomBytes(24).toString('hex'))"
# paste both into .env

npm run api        # start the HTTP API at http://localhost:3000
npm run inspect    # explore the MCP tools in the MCP Inspector
node scripts/try-it.mjs   # a minimal MCP client that calls each tool
```

## Project structure

```
src/calc.js         Pure retirement math (the shared engine)
src/fred.js         Live economic data client (FRED API)
src/mcp-server.js   MCP server exposing the engine as tools (stdio)
src/app.js          The Express HTTP API (routes, auth, rate limiting)
src/api-server.js   Local starter for the HTTP API
src/portal.js       The developer portal / try-it page
api/index.js        Vercel serverless entry point
scripts/try-it.mjs  A minimal MCP client for local testing
postman/            A Postman collection for the HTTP API
```

## Tech

Node.js, Express, the
[`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol), zod for input
schemas, the [FRED API](https://fred.stlouisfed.org/docs/api/fred/) for live economic
data, and Vercel for deployment.
