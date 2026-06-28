#!/usr/bin/env node
import path from 'node:path'
import { parseArgs } from '../helpers/args.js'
import { ensureDir, exists, readText, writeText } from '../helpers/io.js'

const DEFAULT_PATHS = {
	types: 'types/database.types.ts',
	enums: 'nsdb/enums.ts',
	schemas: 'nsdb/schemas',
	models: 'nsdb/models',
	composables: 'nsdb/composables',
	stores: 'stores',
}

const NSDB_SCRIPTS = {
	'nsdb:init': 'nsdb init',
	'nsdb:types': 'nsdb generate:types',
	'nsdb:enums': 'nsdb generate:enums',
	'nsdb:schemas': 'nsdb generate:schemas',
	'nsdb:models': 'nsdb generate:models',
	'nsdb:composables': 'nsdb generate:composables',
	'nsdb:stores': 'nsdb generate:stores',
	'nsdb:all': 'nsdb generate:all',
}

function quoteString(value) {
	return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}

export function buildNsdbConfigTemplate({
	schemaName = 'public',
	projectIdExpression = 'process.env.SUPABASE_PROJECT_ID',
	linked = false,
	paths = DEFAULT_PATHS,
} = {}) {
	const projectIdLine = linked
		? ''
		: `\n\t\tprojectId: ${projectIdExpression},`

	return `import type { NsdbConfig } from '@lucashw68/nsdb/types/config'

export default {
\tsupabase: {
\t\tschema: ${quoteString(schemaName)},${projectIdLine}
\t\tlinked: ${linked ? 'true' : 'false'},
\t},
\tpaths: {
\t\ttypes: ${quoteString(paths.types)},
\t\tenums: ${quoteString(paths.enums)},
\t\tschemas: ${quoteString(paths.schemas)},
\t\tmodels: ${quoteString(paths.models)},
\t\tcomposables: ${quoteString(paths.composables)},
\t\tstores: ${quoteString(paths.stores)},
\t},
\timports: {
\t\tdatabaseTypes: '~~/types/database.types',
\t},
} satisfies NsdbConfig
`
}

export function mergePackageScripts(packageJson, scriptsToAdd = NSDB_SCRIPTS) {
	const nextPackageJson = {
		...packageJson,
		scripts: {
			...(packageJson.scripts ?? {}),
		},
	}

	for (const [scriptName, scriptCommand] of Object.entries(scriptsToAdd)) {
		if (!nextPackageJson.scripts[scriptName]) {
			nextPackageJson.scripts[scriptName] = scriptCommand
		}
	}

	return nextPackageJson
}

function buildEnvExample() {
	return `SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_PROJECT_ID=your-project-id
`
}

function writeFileIfAllowed(filePath, content, { force = false, label }) {
	if (exists(filePath) && !force) {
		console.log(`↷ ${label} already exists, skipped: ${path.relative(process.cwd(), filePath)}`)
		return false
	}

	writeText(filePath, content)
	console.log(`✓ ${label}: ${path.relative(process.cwd(), filePath)}`)
	return true
}

function ensureConfiguredDirectories(currentWorkingDirectory, paths = DEFAULT_PATHS) {
	const directories = [
		path.dirname(paths.types),
		path.dirname(paths.enums),
		paths.schemas,
		paths.models,
		paths.composables,
		paths.stores,
	]

	for (const directoryPath of directories) {
		const absoluteDirectoryPath = path.resolve(currentWorkingDirectory, directoryPath)
		ensureDir(absoluteDirectoryPath)
		console.log(`✓ Directory: ${path.relative(currentWorkingDirectory, absoluteDirectoryPath)}`)
	}
}

function updatePackageJson(currentWorkingDirectory) {
	const packageJsonPath = path.resolve(currentWorkingDirectory, 'package.json')

	if (!exists(packageJsonPath)) {
		console.log('↷ package.json not found, skipped scripts setup')
		return false
	}

	const packageJson = JSON.parse(readText(packageJsonPath))
	const nextPackageJson = mergePackageScripts(packageJson)
	writeText(packageJsonPath, `${JSON.stringify(nextPackageJson, null, 2)}\n`)
	console.log('✓ package.json scripts')
	return true
}

function printNextSteps({ linked }) {
	console.log('')
	console.log('Next steps:')
	console.log('1. Add @lucashw68/nsdb to modules in nuxt.config.ts.')
	console.log('2. Configure @nuxtjs/supabase with SUPABASE_URL and SUPABASE_KEY.')
	if (!linked) console.log('3. Set SUPABASE_PROJECT_ID in .env.')
	console.log(`${linked ? '3' : '4'}. Run: npm run nsdb:all`)
}

export async function initNsdb({
	currentWorkingDirectory = process.cwd(),
	parsedArguments = parseArgs(),
} = {}) {
	const force = parsedArguments.getBool('force', false)
	const linked = parsedArguments.getBool('linked', false)
	const schemaName = parsedArguments.get('schema', 'public')
	const projectId = parsedArguments.get('project-id', '')
	const projectIdExpression = projectId ? quoteString(projectId) : 'process.env.SUPABASE_PROJECT_ID'
	const configFileName = parsedArguments.get('config', 'nsdb.config.ts')
	const configFilePath = path.resolve(currentWorkingDirectory, configFileName)
	const envExampleFilePath = path.resolve(currentWorkingDirectory, '.env.example')

	console.log('🧬 Initializing NSDB...')

	writeFileIfAllowed(
		configFilePath,
		buildNsdbConfigTemplate({
			schemaName,
			projectIdExpression,
			linked,
			paths: DEFAULT_PATHS,
		}),
		{ force, label: 'Config' }
	)

	writeFileIfAllowed(envExampleFilePath, buildEnvExample(), {
		force: false,
		label: 'Env example',
	})

	ensureConfiguredDirectories(currentWorkingDirectory, DEFAULT_PATHS)
	updatePackageJson(currentWorkingDirectory)
	printNextSteps({ linked })
}

if (import.meta.url === `file://${process.argv[1]}`) {
	initNsdb().catch((error) => {
		console.error('❌ Failed to initialize NSDB.')
		console.error(error)
		process.exit(1)
	})
}
