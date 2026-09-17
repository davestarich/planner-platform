# Planner Platform

One retirement calculation engine, served through multiple interfaces. The same
pure-math core powers a consumer web app, an [MCP](https://modelcontextprotocol.io)
server for AI clients, and (next) a public HTTP API for developers.

The idea is to treat a single domain engine as a product and expose it the way each
audience actually wants to consume it: a UI for end users, tools for AI assistants,
and an API for other developers.

## What's here today

An MCP server that exposes the retirement engine as three tools any MCP-compatible
client (Claude Desktop, Cursor, the MCP Inspector, etc.) can call over stdio.

| Tool | What it does |
| --- | --- |
| `retirement_projection` | Estimates the nest egg needed to retire, from desired monthly spending and assumptions about inflation, return, and withdrawal rate. |
| `social_security_estimate` | Estimates a monthly Social Security benefit from career-average income, claim age, and household. |
| `retirement_on_track` | Combines a projection with current savings and contributions to report whether someone is on track, close, or short. |

The math lives in `src/calc.js` as pure functions with no UI, so the same engine can
back every interface. The MCP server (`src/mcp-server.js`) is a thin layer that
advertises the tools, validates their inputs, and runs the engine.

## Run it locally

```bash
npm install

# Explore the tools in a browser with the official MCP Inspector
npm run inspect

# Or run a small test client that connects, lists tools, and calls each one
node scripts/try-it.mjs
```

## How it works

An MCP server advertises a menu of tools to a client. The client's model decides when
to call a tool, sends the arguments as JSON, and the server runs the actual code and
returns a structured result. There is no AI in this server; it is pure computation
exposed through a standard protocol. Each tool's input schema (built with
[zod](https://zod.dev)) doubles as its contract and its documentation.

## Project structure

```
src/calc.js         Pure retirement math (the shared engine)
src/mcp-server.js   MCP server exposing the engine as tools
scripts/try-it.mjs  A minimal MCP client for local testing
```

## Roadmap

- Ground projections in live economic data (inflation and Treasury yields) from the
  FRED API, so estimates use current real-world numbers.
- A public HTTP API for the same engine, with API-key auth and simple developer docs.

## Tech

Node.js, the [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol),
and zod for input schemas.
