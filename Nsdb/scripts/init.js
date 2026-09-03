#!/usr/bin/env node
import path from 'node:path'
import { parseArgs } from '../helpers/args.js'
import { ensureDir, exists, readText, writeText } from '../helpers/io.js'

const DEFAULT_PATHS = {
	types: 'types/database.types.ts',
	metadata: 'nsdb/database.metadata.json',
	enums: 'nsdb/enums.ts',
	schemas: 'nsdb/schemas',
	models: 'nsdb/models',
	composables: 'nsdb/composables',
	stores: 'stores',
}

const NSDB_SCRIPTS = {
	'nsdb:init': 'nsdb init',
	'nsdb:types': 'nsdb generate:types',
	'nsdb:metadata': 'nsdb generate:metadata',
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
	dbUrlExpression = '',
	remoteTypes = null,
	linked = false,
	paths = DEFAULT_PATHS,
} = {}) {
	const usesDefaultPaths = Object.entries(DEFAULT_PATHS).every(([key, value]) => paths[key] === value)
	const projectIdLine = linked || dbUrlExpression || remoteTypes
		? ''
		: `\n\t\tprojectId: ${projectIdExpression},`
	const dbUrlLine = dbUrlExpression
		? `\n\t\tdbUrl: ${dbUrlExpression},`
		: ''
	const remoteTypesLine = remoteTypes
		? `\n\t\tremoteTypes: {
\t\t\tsshHost: ${remoteTypes.sshHost},
\t\t\tprojectPath: ${remoteTypes.projectPath},
\t\t\tdbUrl: ${remoteTypes.dbUrl},
\t\t\tremoteOutput: ${remoteTypes.remoteOutput},
\t\t\tbeforeCommand: ${remoteTypes.beforeCommand},
\t\t\tsupabaseCommand: ${remoteTypes.supabaseCommand},
\t\t},`
		: ''
	const pathsBlock = usesDefaultPaths
		? ''
		: `
	paths: {
${Object.entries(paths).map(([key, value]) => `\t\t${key}: ${quoteString(value)},`).join('\n')}
	},
	imports: {
		databaseTypes: '~~/types/database.types',
	},`

	return `import type { NsdbConfig } from '@lucashw68/nsdb/types/config'

export default {
\tsupabase: {
\t\tschema: ${quoteString(schemaName)},${projectIdLine}${dbUrlLine}${remoteTypesLine}
\t\tlinked: ${linked ? 'true' : 'false'},
\t},${pathsBlock}
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
SUPABASE_DB_URL=postgresql://postgres:password@localhost:5432/postgres
SUPABASE_REMOTE_SSH_HOST=vps
SUPABASE_REMOTE_PROJECT_PATH=/opt/supabase-projects/mysic
SUPABASE_REMOTE_DB_URL=postgresql://postgres:$POSTGRES_PASSWORD@db:5432/postgres
SUPABASE_REMOTE_BEFORE_COMMAND=source ~/.nvm/nvm.sh
SUPABASE_REMOTE_SUPABASE_COMMAND=npx supabase
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
		path.dirname(paths.metadata),
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

function printNextSteps({ linked, usesDbUrl }) {
	console.log('')
	console.log('Next steps:')
	console.log('1. Add @lucashw68/nsdb to modules in nuxt.config.ts.')
	console.log('2. Configure @nuxtjs/supabase with SUPABASE_URL and SUPABASE_KEY.')
	if (!linked && !usesDbUrl) console.log('3. Set SUPABASE_PROJECT_ID in .env.')
	if (usesDbUrl) console.log('3. Set SUPABASE_DB_URL or SUPABASE_REMOTE_* variables in .env.')
	console.log(`${linked && !usesDbUrl ? '3' : '4'}. Run: npm run nsdb:all`)
}

export async function initNsdb({
	currentWorkingDirectory = process.cwd(),
	parsedArguments = parseArgs(),
} = {}) {
	const force = parsedArguments.getBool('force', false)
	const linked = parsedArguments.getBool('linked', false)
	const schemaName = parsedArguments.get('schema', 'public')
	const projectId = parsedArguments.get('project-id', '')
	const dbUrl = parsedArguments.get('db-url', '')
	const remoteSshHost = parsedArguments.get('remote-ssh-host', '')
	const remoteProjectPath = parsedArguments.get('remote-project-path', '')
	const remoteDbUrl = parsedArguments.get('remote-db-url', '')
	const remoteOutput = parsedArguments.get('remote-output', '/tmp/database.types.ts')
	const remoteBeforeCommand = parsedArguments.get('remote-before-command', '')
	const remoteSupabaseCommand = parsedArguments.get('remote-supabase-command', '')
	const projectIdExpression = projectId ? quoteString(projectId) : 'process.env.SUPABASE_PROJECT_ID'
	const dbUrlExpression = dbUrl ? quoteString(dbUrl) : parsedArguments.getBool('self-hosted', false) ? 'process.env.SUPABASE_DB_URL' : ''
	const useRemoteTypes = Boolean(remoteSshHost) || parsedArguments.getBool('remote-types', false)
	const remoteTypes = useRemoteTypes
		? {
			sshHost: remoteSshHost ? quoteString(remoteSshHost) : 'process.env.SUPABASE_REMOTE_SSH_HOST',
			projectPath: remoteProjectPath ? quoteString(remoteProjectPath) : 'process.env.SUPABASE_REMOTE_PROJECT_PATH',
			dbUrl: remoteDbUrl ? quoteString(remoteDbUrl) : 'process.env.SUPABASE_REMOTE_DB_URL',
			remoteOutput: quoteString(remoteOutput),
			beforeCommand: remoteBeforeCommand ? quoteString(remoteBeforeCommand) : 'process.env.SUPABASE_REMOTE_BEFORE_COMMAND',
			supabaseCommand: remoteSupabaseCommand ? quoteString(remoteSupabaseCommand) : 'process.env.SUPABASE_REMOTE_SUPABASE_COMMAND',
		}
		: null
	const configFileName = parsedArguments.get('config', 'nsdb.config.ts')
	const configFilePath = path.resolve(currentWorkingDirectory, configFileName)
	const envExampleFilePath = path.resolve(currentWorkingDirectory, '.env.example')

	console.log('🧬 Initializing NSDB...')

	writeFileIfAllowed(
		configFilePath,
		buildNsdbConfigTemplate({
			schemaName,
			projectIdExpression,
			dbUrlExpression,
			remoteTypes,
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
	printNextSteps({ linked, usesDbUrl: Boolean(dbUrlExpression || remoteTypes) })
}

if (import.meta.url === `file://${process.argv[1]}`) {
	initNsdb().catch((error) => {
		console.error('❌ Failed to initialize NSDB.')
		console.error(error)
		process.exit(1)
	})
}
