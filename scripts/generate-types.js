#!/usr/bin/env node
import path from 'path'
import { parseArgs } from '../helpers/args.js'
import { ensureDir } from '../helpers/io.js'
import { run, isAvailable } from '../helpers/shell.js'
import { getBoolOption, getOption, loadNsdbConfig } from '../helpers/config.js'

/**
 * Build the Supabase CLI command that dumps the database types to disk.
 */
function quoteShellArgument(value) {
	return `'${String(value).replaceAll("'", "'\\''")}'`
}

function quoteRemoteShellArgument(value) {
	return `"${String(value)
		.replaceAll('\\', '\\\\')
		.replaceAll('"', '\\"')
		.replaceAll('`', '\\`')}"`
}

export function buildCommand({
	projectId,
	dbUrl,
	outputPath,
	schemaName,
	useLinkedProject,
	supabaseCommand = 'npx supabase',
	argumentQuoter = quoteShellArgument,
}) {
	const parts = [`${supabaseCommand} gen types typescript`]
	if (schemaName) parts.push(`--schema ${schemaName}`)
	if (dbUrl) {
		parts.push(`--db-url ${argumentQuoter(dbUrl)}`)
	} else {
		parts.push(useLinkedProject ? '--linked' : `--project-id ${projectId}`)
	}
	parts.push(`> ${argumentQuoter(outputPath)}`)
	return parts.join(' ')
}

export function buildRemoteTypesCommands({
	sshHost,
	projectPath,
	dbUrl,
	remoteOutput = '/tmp/database.types.ts',
	localOutputPath,
	schemaName = 'public',
	beforeCommand = '',
	supabaseCommand = 'npx supabase',
}) {
	const remoteGenerateCommand = [
		projectPath ? `cd ${quoteShellArgument(projectPath)}` : '',
		beforeCommand,
		buildCommand({
			dbUrl,
			outputPath: remoteOutput,
			schemaName,
			useLinkedProject: false,
			supabaseCommand,
			argumentQuoter: quoteRemoteShellArgument,
		}),
	]
		.filter(Boolean)
		.join(' && ')

	return {
		generateCommand: `ssh ${quoteShellArgument(sshHost)} ${quoteShellArgument(remoteGenerateCommand)}`,
		copyCommand: `scp ${quoteShellArgument(`${sshHost}:${remoteOutput}`)} ${quoteShellArgument(localOutputPath)}`,
	}
}

async function loadDotenvIfAvailable(dotenvFilePath) {
	try {
		const dotenvModule = await import('dotenv')
		dotenvModule.config({ path: dotenvFilePath })
	} catch (error) {
		const errorCode = error?.code || error?.cause?.code
		if (errorCode !== 'ERR_MODULE_NOT_FOUND') {
			console.warn(`⚠️  Unable to load dotenv file at ${dotenvFilePath}:`, error?.message || error)
		}
	}
}

async function main() {
	const parsedArguments = parseArgs()
	const currentWorkingDirectory = process.cwd()
	const { config } = await loadNsdbConfig(currentWorkingDirectory, parsedArguments.get('config', ''))
	const dotenvFilePath = path.resolve(currentWorkingDirectory, parsedArguments.get('dotenv', '.env'))
	await loadDotenvIfAvailable(dotenvFilePath)

	const outputFilePath = path.resolve(currentWorkingDirectory, getOption(parsedArguments, config, 'out', 'paths.types'))
	const projectId = getOption(parsedArguments, config, 'project-id', 'supabase.projectId', process.env.SUPABASE_PROJECT_ID || '')
	const dbUrl = getOption(parsedArguments, config, 'db-url', 'supabase.dbUrl', process.env.SUPABASE_DB_URL || '')
	const schemaName = getOption(parsedArguments, config, 'schema', 'supabase.schema', 'public')
	const useLinkedProject = getBoolOption(parsedArguments, config, 'linked', 'supabase.linked', false)
	const remoteSshHost = getOption(parsedArguments, config, 'remote-ssh-host', 'supabase.remoteTypes.sshHost', process.env.SUPABASE_REMOTE_SSH_HOST || '')
	const remoteProjectPath = getOption(parsedArguments, config, 'remote-project-path', 'supabase.remoteTypes.projectPath', process.env.SUPABASE_REMOTE_PROJECT_PATH || '')
	const remoteDbUrl = getOption(parsedArguments, config, 'remote-db-url', 'supabase.remoteTypes.dbUrl', process.env.SUPABASE_REMOTE_DB_URL || '')
	const remoteOutputPath = getOption(parsedArguments, config, 'remote-output', 'supabase.remoteTypes.remoteOutput', '/tmp/database.types.ts')
	const remoteBeforeCommand = getOption(parsedArguments, config, 'remote-before-command', 'supabase.remoteTypes.beforeCommand', process.env.SUPABASE_REMOTE_BEFORE_COMMAND || '')
	const remoteSupabaseCommand = getOption(parsedArguments, config, 'remote-supabase-command', 'supabase.remoteTypes.supabaseCommand', process.env.SUPABASE_REMOTE_SUPABASE_COMMAND || 'npx supabase')
	const useRemoteTypes = Boolean(remoteSshHost)

	if (useRemoteTypes && !remoteDbUrl) {
		console.error('❌ Missing remote DB URL (pass --remote-db-url or set supabase.remoteTypes.dbUrl).')
		process.exit(1)
	}

	if (!useRemoteTypes && !dbUrl && !useLinkedProject && !projectId) {
		console.error('❌ Missing Supabase source (pass --remote-ssh-host, --db-url, --project-id or --linked).')
		process.exit(1)
	}

	if (!useRemoteTypes && !isAvailable('npx supabase --version')) {
		console.error('❌ Supabase CLI not available. Install it with: npm i -D supabase')
		process.exit(1)
	}

	ensureDir(path.dirname(outputFilePath))
	if (useRemoteTypes) {
		const { generateCommand, copyCommand } = buildRemoteTypesCommands({
			sshHost: remoteSshHost,
			projectPath: remoteProjectPath,
			dbUrl: remoteDbUrl,
			remoteOutput: remoteOutputPath,
			localOutputPath: outputFilePath,
			schemaName,
			beforeCommand: remoteBeforeCommand,
			supabaseCommand: remoteSupabaseCommand,
		})

		console.log(`📦 Project: ${remoteSshHost} (remote ssh)`)
		console.log(`📁 Output: ${path.relative(currentWorkingDirectory, outputFilePath)}`)
		console.log(`📚 Schema: ${schemaName}`)
		console.log(`🗄️  Remote output: ${remoteOutputPath}`)
		console.log('🔄 Generating Supabase types remotely...')

		try {
			run(generateCommand, { inherit: true })
			run(copyCommand, { inherit: true })
			console.log('✅ Types generated and copied successfully.')
		} catch (error) {
			console.error('❌ Failed to generate Supabase types remotely.')
			process.exit(1)
		}

		return
	}

	const commandLine = buildCommand({
		projectId,
		dbUrl,
		outputPath: outputFilePath,
		schemaName,
		useLinkedProject
	})

	console.log(`📦 Project: ${dbUrl ? '(db-url)' : useLinkedProject ? '(linked)' : projectId}`)
	console.log(`📁 Output: ${path.relative(currentWorkingDirectory, outputFilePath)}`)
	console.log(`📚 Schema: ${schemaName}`)
	if (dbUrl) console.log('🗄️  DB URL mode enabled')
	if (useLinkedProject) console.log('🔗 Linked project mode enabled')
	console.log('🔄 Generating Supabase types...')

	try {
		run(commandLine, { inherit: true })
		console.log('✅ Types generated successfully.')
	} catch (error) {
		console.error('❌ Failed to generate Supabase types.')
		process.exit(1)
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error('❌ Unexpected error while generating types.')
		console.error(error)
		process.exit(1)
	})
}
