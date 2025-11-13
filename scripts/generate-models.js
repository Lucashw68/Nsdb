#!/usr/bin/env node
import path from 'path'
import { parseArgs } from '../helpers/args.js'
import { exists, readText, writeText, ensureDir } from '../helpers/io.js'
import {
	createTsProject,
	addSourceFile,
	loadDatabaseAlias,
	getPublicTablesType
} from '../helpers/ts.js'
import { toPascal, modelHookName, storeName } from '../helpers/names.js'

function buildModelCode(tableName, templateContent, currentWorkingDirectory) {
	const pascalName = toPascal(tableName)
	const rowTypeName = `${pascalName}Row`
	const hookName = modelHookName(tableName)
	const storeIdentifier = storeName(tableName)
	const storeFileRelativePath = `stores/${storeIdentifier}.ts`
	const storeAbsolutePath = path.resolve(currentWorkingDirectory, storeFileRelativePath)
	const storeExists = exists(storeAbsolutePath)

	const code = templateContent
		.replace(/__TABLE__/g, tableName)
		.replace(/__PASCAL__/g, pascalName)
		.replace(/__ROW__/g, rowTypeName)
		.replace(/__HOOK__/g, hookName)
		.replace(/__STORE_IMPORT__/g, storeExists ? `import { ${storeIdentifier} } from '~/stores/${storeIdentifier}'` : '')
		.replace(/__STORE_CREATOR__/g, storeExists ? `(() => ${storeIdentifier}())` : 'undefined')

	return { code, hookName }
}

function main() {
	const parsedArguments = parseArgs()
	const currentWorkingDirectory = process.cwd()
	const typesFilePath = path.resolve(currentWorkingDirectory, parsedArguments.get('types', 'types/database.types.ts'))
	const outputDirectory = path.resolve(currentWorkingDirectory, parsedArguments.get('outDir', 'nsdb/models'))
	const barrelFilePath = path.join(outputDirectory, 'index.ts')
	const templateFilePath = path.resolve(
		currentWorkingDirectory,
		parsedArguments.get('template', 'node_modules/@lucashw68/nsdb/templates/model.template.ts')
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
	const exportStatements = []

	for (const tableProperty of tablesType.getProperties()) {
		const tableName = tableProperty.getName()
		const { code, hookName } = buildModelCode(tableName, templateContent, currentWorkingDirectory)
		const modelFilePath = path.join(outputDirectory, `${tableName}.ts`)
		writeText(modelFilePath, code)
		console.log('✅ model:', path.relative(currentWorkingDirectory, modelFilePath))
		exportStatements.push(`export * from './${tableName}' // ${hookName}`)
	}

	writeText(barrelFilePath, exportStatements.join('\n') + '\n')
	console.log('✅ models barrel:', path.relative(currentWorkingDirectory, barrelFilePath))
}

if (import.meta.url === `file://${process.argv[1]}`) main()
