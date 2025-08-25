#!/usr/bin/env tsx

import { execSync } from 'node:child_process'

const args = process.argv.slice(2)

const commands = {
  'generate:types': 'tsx scripts/generate-types.ts',
  'generate:models': 'tsx scripts/generate-models.ts',
  'generate:stores': 'tsx scripts/generate-stores.ts',
  'generate:all': 'npm run generate:all',
}

const command = commands[args[0]]

if (!command) {
  console.error(`❌ Command not found: ${args[0]}`)
  process.exit(1)
}

execSync(command, { stdio: 'inherit', shell: true })
