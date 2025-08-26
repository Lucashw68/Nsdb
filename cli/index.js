#!/usr/bin/env node

const { execSync } = require('node:child_process')
const path = require('path')

const commands = {
	'generate:types': path.resolve(__dirname, '../scripts/generate-types.js'),
	'generate:models': path.resolve(__dirname, '../scripts/generate-models.js'),
	'generate:stores': path.resolve(__dirname, '../scripts/generate-stores.js'),
	'generate:all': [
		path.resolve(__dirname, '../scripts/generate-types.js'),
		path.resolve(__dirname, '../scripts/generate-models.js'),
		path.resolve(__dirname, '../scripts/generate-stores.js'),
	]
		.map(p => `node "${p}"`)
		.join(' && ')
}

const command = commands[process.argv[2]]

if (!command) {
	console.error(`❌ Command not found: ${process.argv[2]}`)
	process.exit(1)
}

try {
	execSync(typeof command === 'string' ? `node "${command}"` : command, {
		stdio: 'inherit',
		shell: true
	})
} catch (err) {
	console.error(`❌ Failed to execute command: ${process.argv[2]}`)
	process.exit(1)
}
