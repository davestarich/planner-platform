# Case study: one engine, three front doors

## Summary

I took a single retirement-planning calculation engine and served it three ways: a
consumer web app, an MCP server for AI clients, and a public HTTP API for developers.
The goal was to treat a domain engine as a product and expose it in the form each
audience actually consumes, while keeping one source of truth for the math.

## The thesis

Most small apps couple their logic to one interface. But the *value* of a good engine
is independent of how it's accessed. A retirement projection is useful to a person
clicking a slider, to an AI assistant answering "can I retire in 20 years?", and to a
developer integrating it into their own product. Those are three different customers
with three different expectations, served by the same computation.

So the engine (`calc.js`, a set of pure functions with no UI) stays constant, and each
surface is a thin adapter over it.

## What I built

**1. The shared engine.** Pure functions for the projection, an on-track check, a
Social Security estimate, and a safe-withdrawal calculation. No UI, no I/O, easy to
reason about and reuse.

**2. Live data grounding.** I added a FRED (Federal Reserve Economic Data) client so
projections can use the current inflation rate (from CPI) and the 10-year Treasury
yield instead of hand-typed guesses. This changed the engine's character from a
calculator into a tool grounded in real, current data, something a model or a
developer can't produce on their own.

**3. The MCP server.** Publishes the engine as four tools any AI client can call. The
interesting design work here is that a tool's description and input schema are
simultaneously its API contract and its documentation: the model reads them to decide
when and how to call the tool. I made the tools self-contained (each does one complete
job, so the model never has to chain calls) and let inflation auto-fill from live data
when omitted.

**4. The public HTTP API.** The same engine over HTTP, with versioned endpoints
(`/v1/...`), API-key authentication, per-key rate limiting, a developer portal with a
live try-it page, and a Postman collection. Deployed to Vercel as a serverless
function, with secrets stored in the platform's encrypted settings rather than in code.

## Decisions and tradeoffs

**Developer experience as a first-class concern.** For both the MCP tools and the HTTP
API, the "customer" is another developer (or a model). That shaped concrete choices:
descriptive input schemas, self-contained operations, clear error messages
(`401` for a missing key, `429` when rate limited), and standard headers
(`X-RateLimit-Remaining`, `Retry-After`) so callers can behave well.

**Versioning from day one.** Endpoints live under `/v1` so a future `/v2` can change
behavior without breaking existing integrations. Cheap to do now, expensive to retrofit.

**Auth before routing.** The request pipeline checks the API key before the router
looks for a matching endpoint, so an unauthenticated request never reveals anything
about what does or doesn't exist. You can observe this: the same URL returns `401`
without a key and `404` with one.

**Honest about the "shared engine."** Right now the engine is shared by *copying* it
between projects, not by a single hosted backend. Each front door also has its own
copy of the live-data client. That's a deliberate, acceptable stage for a small
project, and the natural next step is to make the HTTP API the one backend the web app
and other developers both call, so there's truly one engine and one data integration.

**In-memory rate limiting is a demo, not production.** The limiter counts requests in
memory. On serverless, each instance has its own memory, so the counter isn't shared
or durable. The logic is correct; a production version would use a shared store like
Redis. Naming that limitation is part of understanding the design.

## A debugging story

The first deploy "succeeded" but the portal page returned `Cannot GET /`. Rather than
guess, I isolated it: `/health` and every `/v1` endpoint returned `200`, so the API
itself worked and the environment (env vars, routing) was fine. Only static file
serving was broken. The cause: on a serverless platform, files read from disk at
runtime aren't reliably bundled with the function, so `express.static` couldn't find
the page. The fix was to serve the page's HTML directly from code instead of from a
file, which behaves identically locally and deployed. The lesson: when something works
locally but not in a new environment, isolate what still works, then reason about how
the environment differs.

## What I'd do next

- Consolidate the copied engines into the HTTP API as a single shared backend.
- Replace in-memory rate limiting with a durable, shared store.
- Move API keys into a real datastore, one per customer, with issuance and revocation.
- Add request validation with clear `400` errors and per-field messages.

## What I took away

Building the same engine three ways made the difference between *logic* and *interface*
concrete. The engine barely changed; almost all the work was in the adapters and in
respecting each audience. That separation, plus treating the developer as the customer,
is the core of platform thinking.
