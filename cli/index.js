#!/usr/bin/env node
/**
 * NSDB CLI (ESM)
 * --------------
 * Available commands:
 *   - clear
 *   - generate:types
 *   - generate:enums
 *   - generate:schemas
 *   - generate:models
 *   - generate:stores
 *   - generate (runs every generate:* command sequentially)
 */

import { execSync } from 'node:child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseArgs } from '../helpers/args.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const resolveScript = (relativePath) => path.resolve(__dirname, '../scripts', relativePath)

const COMMAND_PATHS = {
	clear: resolveScript('clear.js'),
	'generate:types': resolveScript('generate-types.js'),
	'generate:enums': resolveScript('generate-enums.js'),
	'generate:schemas': resolveScript('generate-schemas.js'),
	'generate:models': resolveScript('generate-models.js'),
	'generate:stores': resolveScript('generate-stores.js')
}

const GENERATE_SEQUENCE = [
	'generate:types',
	'generate:enums',
	'generate:schemas',
	'generate:models',
	'generate:stores'
]

function printHelp() {
	const commandNames = Object.keys(COMMAND_PATHS).sort()
	console.log(
		`NSDB CLI

Usage:
  nsdb <command> [--options]

Commands:
  ${commandNames.join('\n  ')}
  generate            Runs: ${GENERATE_SEQUENCE.join(' → ')}

Examples:
  nsdb generate:types --schema public
  nsdb generate
  nsdb clear --verbose
`
	)
}

function ensureKnownCommand(commandName) {
	if (!commandName || commandName === '--help' || commandName === '-h') {
		printHelp()
		process.exit(0)
	}
	const isKnown = commandName === 'generate' || COMMAND_PATHS[commandName]
	if (!isKnown) {
		console.error(`❌ Unknown command: ${commandName}\n`)
		printHelp()
		process.exit(1)
	}
}

function runNodeScript(absolutePath, extraArgs) {
	const command = `node "${absolutePath}"${extraArgs.length ? ' ' + extraArgs.map(escapeArgument).join(' ') : ''}`
	execSync(command, { stdio: 'inherit', shell: true })
}

function escapeArgument(value) {
	if (/[\s"]/g.test(value)) {
		return `"${value.replace(/"/g, '\\"')}"`
	}
	return value
}

function parseCommandLine() {
	const { raw } = parseArgs(process.argv.slice(2))
	const [commandName = '', ...rest] = raw
	return { commandName, rest }
}

function main() {
	const { commandName, rest } = parseCommandLine()
	ensureKnownCommand(commandName)

	try {
		if (commandName === 'generate') {
			for (const subCommand of GENERATE_SEQUENCE) {
				const scriptPath = COMMAND_PATHS[subCommand]
				console.log(`\n▶ ${subCommand}`)
				runNodeScript(scriptPath, rest)
			}
			console.log('\n✅ generate: completed.')
			return
		}

		const scriptPath = COMMAND_PATHS[commandName]
		runNodeScript(scriptPath, rest)
	} catch (error) {
		console.error(`\n❌ Failed to execute command: ${commandName}`)
		process.exit(1)
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main()
}
