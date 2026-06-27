#!/usr/bin/env node
import path from 'path'
import { parseArgs } from '../helpers/args.js'
import { getOption, loadNsdbConfig } from '../helpers/config.js'
import { exists, readText, writeText, ensureDir } from '../helpers/io.js'
import {
	createTsProject,
	addSourceFile,
	loadDatabaseAlias,
	getPublicTablesType
} from '../helpers/ts.js'
import { modelHookName } from '../helpers/names.js'

async function main() {
	const parsedArguments = parseArgs()
	const currentWorkingDirectory = process.cwd()
	const { config } = await loadNsdbConfig(currentWorkingDirectory, parsedArguments.get('config', ''))

	const typesFilePath = path.resolve(
		currentWorkingDirectory,
		getOption(parsedArguments, config, 'types', 'paths.types')
	)

	const outputDirectory = path.resolve(
		currentWorkingDirectory,
		getOption(parsedArguments, config, 'outDir', 'paths.composables')
	)

	const outputFilePath = path.join(outputDirectory, 'useNsdbModels.ts')

	const templateFilePath = path.resolve(
		currentWorkingDirectory,
		getOption(parsedArguments, config, 'template', 'templates.useNsdbModel')
	)

	if (!exists(typesFilePath)) {
		console.error(`❌ Missing types file: ${typesFilePath}`)
		process.exit(1)
	}

	if (!exists(templateFilePath)) {
		console.error(`❌ Missing template: ${templateFilePath}`)
		process.exit(1)
	}

	ensureDir(outputDirectory)

	const project = createTsProject()
	const sourceFile = addSourceFile(project, typesFilePath)
	const databaseAlias = loadDatabaseAlias(sourceFile)

	if (!databaseAlias) {
		console.error('❌ Type alias "Database" not found')
		process.exit(1)
	}

	const tablesType = getPublicTablesType(databaseAlias)
	if (!tablesType) {
		console.error('❌ Database["public"]["Tables"] not found')
		process.exit(1)
	}

	const templateContent = readText(templateFilePath)

	const importLines = []
	const caseLines = []

	for (const tableProperty of tablesType.getProperties()) {
		const tableName = tableProperty.getName()
		const hookName = modelHookName(tableName) // ex: playlists -> usePlaylists

		importLines.push(
			`import { ${hookName} } from '~~/nsdb/models/${tableName}'`
		)

		caseLines.push(
			`\t\tcase '${tableName}':\n\t\t\treturn ${hookName}(opts)`
		)
	}

	const finalContent =
		templateContent
			.replace('// __IMPORTS__', importLines.join('\n'))
			.replace('// __CASES__', caseLines.join('\n')) + '\n'

	writeText(outputFilePath, finalContent)
	console.log('✅ useNsdbModels:', path.relative(currentWorkingDirectory, outputFilePath))
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error('❌ Unexpected error while generating composables.')
		console.error(error)
		process.exit(1)
	})
}
