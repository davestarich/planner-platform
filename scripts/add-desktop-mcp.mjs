// Adds our planner-platform MCP server to Claude Desktop's config, safely.
// Run this while Claude Desktop is FULLY QUIT, from a normal PowerShell window:
//   node "C:\Users\stari\Projects\planner-platform\scripts\add-desktop-mcp.mjs"
// It preserves every existing setting and just adds (or updates) our server entry.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'

const configPath =
  'C:\\Users\\stari\\AppData\\Roaming\\Claude\\claude_desktop_config.json'

if (!existsSync(configPath)) {
  console.error('Could not find the config at:', configPath)
  process.exit(1)
}

// Back up first, timestamped, so nothing is ever lost.
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupPath = configPath.replace('.json', `.backup-${stamp}.json`)
copyFileSync(configPath, backupPath)

const config = JSON.parse(readFileSync(configPath, 'utf8'))

config.mcpServers = config.mcpServers || {}
config.mcpServers['planner-platform'] = {
  command: 'C:\\Program Files\\nodejs\\node.exe',
  args: ['C:\\Users\\stari\\Projects\\planner-platform\\src\\mcp-server.js'],
}

writeFileSync(configPath, JSON.stringify(config, null, 2))

console.log('Added planner-platform to Claude Desktop config.')
console.log('Backup saved at:', backupPath)
console.log('Now relaunch Claude Desktop and check a new chat for the tools.')
