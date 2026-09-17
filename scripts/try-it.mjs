// A tiny MCP client, standing in for Claude Desktop. It launches our server,
// asks what tools it has (discovery), then calls one and prints the result.
// Run with: node scripts/try-it.mjs

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

// Launch the server as a subprocess and talk to it over stdio.
const transport = new StdioClientTransport({
  command: 'node',
  args: ['src/mcp-server.js'],
})

const client = new Client({ name: 'try-it', version: '0.0.0' })
await client.connect(transport)

// Discovery: what tools does the server offer?
const { tools } = await client.listTools()
console.log('Tools the server advertises:')
for (const t of tools) console.log('  -', t.name, '->', t.description.slice(0, 60) + '...')

// Call each tool with a realistic example and print what comes back.
async function call(name, args) {
  console.log(`\nCalling ${name}...`)
  const res = await client.callTool({ name, arguments: args })
  console.log(res.content[0].text)
}

await call('retirement_projection', {
  monthlySpendToday: 4000,
  yearsToRetirement: 20,
  inflationPct: 3,
  returnPct: 6,
  withdrawalPct: 4,
})

await call('social_security_estimate', {
  careerAvgIncome: 65000,
  claimAge: 67,
  isCouple: false,
})

await call('retirement_on_track', {
  monthlySpendToday: 4000,
  yearsToRetirement: 20,
  inflationPct: 3,
  returnPct: 6,
  withdrawalPct: 4,
  currentAssets: 150000,
  monthlyContribution: 1500,
})

await client.close()
