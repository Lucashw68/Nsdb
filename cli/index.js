#!/usr/bin/env node
/**
 * NSDB CLI (JS, ESM)
 * ------------------
 * Commandes disponibles :
 *   - clear
 *   - generate:types
 *   - generate:enums
 *   - generate:schemas
 *   - generate:models
 *   - generate:stores
 *   - generate          (enchaîne toutes les commandes generate:* dans l'ordre)
 *
 * Caractéristiques :
 *   - ESM + chemins robustes (__dirname polyfill)
 *   - Aide intégrée (--help)
 *   - Transmission des arguments supplémentaires au(x) script(s)
 *   - Logs et erreurs cohérents
 */

import { execSync } from 'node:child_process'
import path from 'path'
import { fileURLToPath } from 'url'

/* -------------------------------------------------------------------------- */
/* Résolution des chemins                                                      */
/* -------------------------------------------------------------------------- */

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const resolveScript = (rel) => path.resolve(__dirname, '../scripts', rel)

/* -------------------------------------------------------------------------- */
/* Définition des commandes                                                    */
/* -------------------------------------------------------------------------- */

const COMMAND_PATHS = {
	'clear':            resolveScript('clear.js'),
	'generate:types':   resolveScript('generate-types.js'),
	'generate:enums':   resolveScript('generate-enums.js'),
	'generate:schemas': resolveScript('generate-schemas.js'),
	'generate:models':  resolveScript('generate-models.js'),
	// 'generate:stores':  resolveScript('generate-stores.js'),
}

const GENERATE_SEQUENCE = [
	'generate:types',
	'generate:enums',
	'generate:schemas',
	'generate:models',
	// 'generate:stores',
]

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function printHelp() {
	const cmds = Object.keys(COMMAND_PATHS).sort()
	console.log(
		`NSDB CLI

		Usage:
		nsdb <command> [--options]

		Commands:
		${cmds.join('\n  ')}
		generate            Enchaîne : ${GENERATE_SEQUENCE.join(' → ')}

		Examples:
		nsdb generate:types --schema public
		nsdb generate
		nsdb clear --verbose
	`)
}

function ensureKnownCommand(name) {
	if (!name || name === '--help' || name === '-h') {
		printHelp()
		process.exit(0)
	}
	const known = name === 'generate' || COMMAND_PATHS[name]
	if (!known) {
		console.error(`❌ Unknown command: ${name}\n`)
		printHelp()
		process.exit(1)
	}
}

function runNodeScript(absolutePath, extraArgs) {
	const cmd = `node "${absolutePath}"${extraArgs.length ? ' ' + extraArgs.map(escapeArg).join(' ') : ''}`
	execSync(cmd, { stdio: 'inherit', shell: true })
}

function escapeArg(arg) {
	// Simple échappement pour shell : on met entre guillemets si espace
	if (/[\s"]/g.test(arg)) {
		// échappe les guillemets existants
		return `"${arg.replace(/"/g, '\\"')}"`
	}
	return arg
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

function main() {
	const [, , rawCommand, ...restArgs] = process.argv
	ensureKnownCommand(rawCommand)

	try {
		if (rawCommand === 'generate') {
			for (const sub of GENERATE_SEQUENCE) {
				const script = COMMAND_PATHS[sub]
				console.log(`\n▶ ${sub}`)
				runNodeScript(script, restArgs)
			}
			console.log('\n✅ generate: completed.')
			return
		}

		const scriptPath = COMMAND_PATHS[rawCommand]
		runNodeScript(scriptPath, restArgs)
	} catch (error) {
		console.error(`\n❌ Failed to execute command: ${rawCommand}`)
		process.exit(1)
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main()
}
