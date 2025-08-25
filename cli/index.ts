#!/usr/bin/env tsx

const command = process.argv[2]

switch (command) {
  case 'generate:types':
    await import('../scripts/generate-types.ts')
    break
  case 'generate:models':
    await import('../scripts/generate-models.ts')
    break
  case 'generate:stores':
    await import('../scripts/generate-stores.ts')
    break
  default:
    console.log('❌ Unknown command')
    process.exit(1)
}
