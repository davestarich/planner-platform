// The MCP server: it exposes our retirement engine as tools any AI client can call.
// There is no AI in this file. It just advertises tools and runs the math when asked.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import { computeProjection, computeOnTrack, estimateSocialSecurity } from './calc.js'

// 1. Create the server. The name and version are what the client sees on discovery.
const server = new McpServer({
  name: 'planner-platform',
  version: '0.1.0',
})

// 2. Register a tool. Three parts: a name, the contract (description + input schema),
//    and the handler that actually runs. The .describe() text on each input is what
//    the model reads to know how to fill in the arguments, so it doubles as the docs.
server.registerTool(
  'retirement_projection',
  {
    title: 'Retirement projection',
    description:
      'Estimate the nest egg someone needs to retire, from their desired monthly ' +
      'spending, years until retirement, and assumptions about inflation, investment ' +
      'return, and safe withdrawal rate. Returns figures in both future and today dollars.',
    inputSchema: {
      monthlySpendToday: z
        .number()
        .describe('Desired monthly spending in today dollars, e.g. 4000'),
      yearsToRetirement: z
        .number()
        .describe('Whole years until retirement, e.g. 20'),
      inflationPct: z
        .number()
        .describe('Assumed annual inflation as a percent, e.g. 3 for 3%'),
      returnPct: z
        .number()
        .describe('Assumed annual investment return as a percent, e.g. 6 for 6%'),
      withdrawalPct: z
        .number()
        .describe('Safe annual withdrawal rate as a percent, e.g. 4 for the 4% rule'),
    },
  },
  // 3. The handler. The client passes validated arguments; we run the engine and
  //    return the result. MCP results are a list of "content" items; here we hand
  //    back the numbers as JSON text so the model can read and explain them.
  async (args) => {
    const result = computeProjection(args)
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

// Tool 2: estimate a monthly Social Security benefit from career-average income.
server.registerTool(
  'social_security_estimate',
  {
    title: 'Social Security estimate',
    description:
      'Estimate a monthly Social Security benefit in today dollars from a career-average ' +
      'income, the age the person plans to claim, and whether they are a couple. A ballpark; ' +
      'the exact figure comes from ssa.gov.',
    inputSchema: {
      careerAvgIncome: z
        .number()
        .describe('Career-average annual income in today dollars, e.g. 65000'),
      claimAge: z
        .number()
        .describe('Age benefits start: 62 (early), 67 (full), or 70 (delayed)'),
      isCouple: z
        .boolean()
        .describe('True to include a rough spousal benefit for a couple'),
    },
  },
  async (args) => {
    const monthly = estimateSocialSecurity(args)
    return {
      content: [{ type: 'text', text: JSON.stringify({ monthlyBenefit: monthly }, null, 2) }],
    }
  }
)

// Tool 3: are they on track? Self-contained: it takes the projection inputs plus their
// current savings, works out the target internally, then compares projected vs target.
server.registerTool(
  'retirement_on_track',
  {
    title: 'Retirement on-track check',
    description:
      'Check whether someone is on track to retire. Combines a retirement projection with ' +
      'their current savings and monthly contributions, then reports projected assets at ' +
      'retirement, the gap vs the target, and a status of on-track, close, or shortfall.',
    inputSchema: {
      monthlySpendToday: z
        .number()
        .describe('Desired monthly spending in today dollars, e.g. 4000'),
      yearsToRetirement: z
        .number()
        .describe('Whole years until retirement, e.g. 20'),
      inflationPct: z.number().describe('Assumed annual inflation as a percent, e.g. 3'),
      returnPct: z.number().describe('Assumed annual investment return as a percent, e.g. 6'),
      withdrawalPct: z.number().describe('Safe annual withdrawal rate as a percent, e.g. 4'),
      currentAssets: z
        .number()
        .describe('Amount already invested today in dollars, e.g. 150000'),
      monthlyContribution: z
        .number()
        .describe('Amount added to savings each month in dollars, e.g. 1500'),
    },
  },
  async (args) => {
    // First get the target nest egg, then measure current trajectory against it.
    const { targetNominal } = computeProjection(args)
    const onTrack = computeOnTrack({ ...args, targetNominal })
    return {
      content: [
        { type: 'text', text: JSON.stringify({ targetNominal, ...onTrack }, null, 2) },
      ],
    }
  }
)

// 4. Connect over stdio (standard input/output). This is the transport: the client
//    launches this file as a subprocess and talks to it through that pipe.
const transport = new StdioServerTransport()
await server.connect(transport)
