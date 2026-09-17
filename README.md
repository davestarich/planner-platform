# Planner Platform

One retirement calculation engine, served through multiple interfaces. The same
pure-math core powers a consumer web app, an [MCP](https://modelcontextprotocol.io)
server for AI clients, and (next) a public HTTP API for developers.

The idea is to treat a single domain engine as a product and expose it the way each
audience actually wants to consume it: a UI for end users, tools for AI assistants,
and an API for other developers.

## What's here today

An MCP server that exposes the retirement engine as four tools any MCP-compatible
client (Claude Desktop, Cursor, the MCP Inspector, etc.) can call over stdio.

| Tool | What it does |
| --- | --- |
| `retirement_projection` | Estimates the nest egg needed to retire, from desired monthly spending and assumptions about inflation, return, and withdrawal rate. If inflation is omitted, it is pulled live from FRED. |
| `social_security_estimate` | Estimates a monthly Social Security benefit from career-average income, claim age, and household. |
| `retirement_on_track` | Combines a projection with current savings and contributions to report whether someone is on track, close, or short. |
| `economic_assumptions` | Fetches current real-world figures from FRED: the latest annual inflation rate (CPI) and the 10-year Treasury yield, each with an as-of date. |

The math lives in `src/calc.js` as pure functions with no UI, so the same engine can
back every interface. The MCP server (`src/mcp-server.js`) is a thin layer that
advertises the tools, validates their inputs, and runs the engine.

## Run it locally

```bash
npm install

# Set up your FRED API key (free: https://fredaccount.stlouisfed.org/apikeys)
cp .env.example .env
# then edit .env and paste your key after FRED_API_KEY=

# Explore the tools in a browser with the official MCP Inspector
npm run inspect

# Or run a small test client that connects, lists tools, and calls each one
node scripts/try-it.mjs
```

The FRED key lives only in `.env`, which is gitignored, so it never enters the repo.
Tools that don't need live data work without a key; the FRED-backed calls report a
clear error if the key is missing.

## How it works

An MCP server advertises a menu of tools to a client. The client's model decides when
to call a tool, sends the arguments as JSON, and the server runs the actual code and
returns a structured result. There is no AI in this server; it is pure computation
exposed through a standard protocol. Each tool's input schema (built with
[zod](https://zod.dev)) doubles as its contract and its documentation.

## Project structure

```
src/calc.js         Pure retirement math (the shared engine)
src/fred.js         Live economic data client (FRED API)
src/mcp-server.js   MCP server exposing the engine as tools
scripts/try-it.mjs  A minimal MCP client for local testing
```

## Roadmap

- A public HTTP API for the same engine, with API-key auth and simple developer docs.

## Tech

Node.js, the [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol),
zod for input schemas, and the [FRED API](https://fred.stlouisfed.org/docs/api/fred/)
for live economic data.
