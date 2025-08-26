#!/usr/bin/env node

const { execSync } = require('node:child_process')

const args = process.argv.slice(2)

const commands = {
  'generate:types': 'node scripts/generate-types.js',
  'generate:models': 'node scripts/generate-models.js',
  'generate:stores': 'node scripts/generate-stores.js',
  'generate:all': 'npm run generate:all'
}

const command = commands[args[0]]

if (!command) {
  console.error(`❌ Command not found: ${args[0]}`)
  process.exit(1)
}

execSync(command, { stdio: 'inherit', shell: true })
