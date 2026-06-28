#!/usr/bin/env node
import path from 'path'
import { parseArgs } from '../helpers/args.js'
import { ensureDir } from '../helpers/io.js'
import { run, isAvailable } from '../helpers/shell.js'
import { getBoolOption, getOption, loadNsdbConfig } from '../helpers/config.js'

/**
 * Build the Supabase CLI command that dumps the database types to disk.
 */
export function buildCommand({ projectId, dbUrl, outputPath, schemaName, useLinkedProject }) {
	const parts = ['npx supabase gen types typescript']
	if (schemaName) parts.push(`--schema ${schemaName}`)
	if (dbUrl) {
		parts.push(`--db-url "${dbUrl}"`)
	} else {
		parts.push(useLinkedProject ? '--linked' : `--project-id ${projectId}`)
	}
	parts.push(`> "${outputPath}"`)
	return parts.join(' ')
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

	if (!dbUrl && !useLinkedProject && !projectId) {
		console.error('❌ Missing Supabase source (pass --db-url, --project-id or --linked).')
		process.exit(1)
	}

	if (!isAvailable('npx supabase --version')) {
		console.error('❌ Supabase CLI not available. Install it with: npm i -D supabase')
		process.exit(1)
	}

	ensureDir(path.dirname(outputFilePath))
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
