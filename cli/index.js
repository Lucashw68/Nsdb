#!/usr/bin/env node

import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentFilePath = fileURLToPath(import.meta.url)
const currentDirectoryPath = path.dirname(currentFilePath)

const commands = {
	'clear': path.resolve(currentDirectoryPath, '../scripts/clear.js'),
	'init': path.resolve(currentDirectoryPath, '../scripts/init.js'),
	'generate:types': path.resolve(currentDirectoryPath, '../scripts/generate-types.js'),
	'generate:enums': path.resolve(currentDirectoryPath, '../scripts/generate-enums.js'),
	'generate:schemas': path.resolve(currentDirectoryPath, '../scripts/generate-schemas.js'),
	'generate:models': path.resolve(currentDirectoryPath, '../scripts/generate-models.js'),
	'generate:composables': path.resolve(currentDirectoryPath, '../scripts/generate-composables.js'),
	'generate:stores': path.resolve(currentDirectoryPath, '../scripts/generate-stores.js'),
	'generate:all': [
		path.resolve(currentDirectoryPath, '../scripts/generate-types.js'),
		path.resolve(currentDirectoryPath, '../scripts/generate-enums.js'),
		path.resolve(currentDirectoryPath, '../scripts/generate-schemas.js'),
		path.resolve(currentDirectoryPath, '../scripts/generate-models.js'),
		path.resolve(currentDirectoryPath, '../scripts/generate-stores.js'),
		path.resolve(currentDirectoryPath, '../scripts/generate-models.js'),
		path.resolve(currentDirectoryPath, '../scripts/generate-composables.js'),
	],
}

const command = commands[process.argv[2]]
const forwardedArguments = process.argv.slice(3)

function quoteShellArgument(argument) {
	return `"${String(argument).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

function buildCommandLine(command) {
	const forwardedCommandLine = forwardedArguments.map(quoteShellArgument).join(' ')

	if (Array.isArray(command)) {
		return command
			.map(scriptPath => {
				const baseCommandLine = `node "${scriptPath}"`
				return forwardedCommandLine ? `${baseCommandLine} ${forwardedCommandLine}` : baseCommandLine
			})
			.join(' && ')
	}

	const baseCommandLine = `node "${command}"`
	return forwardedCommandLine ? `${baseCommandLine} ${forwardedCommandLine}` : baseCommandLine
}

if (!command) {
	console.error(`❌ Command not found: ${process.argv[2]}`)
	process.exit(1)
}

try {
	execSync(buildCommandLine(command), {
		stdio: 'inherit',
		shell: true
	})
} catch (err) {
	console.error(`❌ Failed to execute command: ${process.argv[2]}`)
	process.exit(1)
}
