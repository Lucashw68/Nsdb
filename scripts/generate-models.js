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
import { toPascal, modelHookName, storeName, schemaName } from '../helpers/names.js'
import { markGenerated, removeStaleGeneratedFiles } from '../helpers/generated.js'
import { selectTableProperties } from '../helpers/tables.js'
import { getColumnPolicies } from '../helpers/tables.js'
import { getTableMetadata, loadDatabaseMetadata } from '../helpers/metadata.js'
import { buildRelationCatalog } from '../helpers/relations.js'

function asKeyUnion(keys) {
	return keys.length ? keys.map(key => `'${key}'`).join(' | ') : 'never'
}

function relationRowsType(relations, config, tableColumnsByName) {
	if (!relations.length) return '{}'
	const lines = relations.map(relation => {
		const targetColumns = tableColumnsByName.get(relation.referencedTable) ?? []
		const targetPolicies = getColumnPolicies(config.tables, relation.referencedTable, targetColumns)
		const omitted = targetColumns.filter(column => targetPolicies[column].serverOnly || !targetPolicies[column].selectable)
		const rowType = `Omit<Tables<'${relation.referencedTable}'>, ${asKeyUnion(omitted)}>`
		const valueType = relation.kind === 'hasMany' || relation.kind === 'manyToMany'
			? `${rowType}[]`
			: `${rowType}${relation.nullable ? ' | null' : ''}`
		return `\t'${relation.alias}': ${valueType}`
	})
	return `{\n${lines.join('\n')}\n}`
}

function buildModelCode(tableProperty, templateContent, currentWorkingDirectory, config, databaseMetadata, locationNode, tableRelations, tableColumnsByName) {
	const tableName = tableProperty.getName()
	const pascalName = toPascal(tableName)
	const rowTypeName = `${pascalName}Row`
	const hookName = modelHookName(tableName)
	const storeIdentifier = storeName(tableName)
	const storeFileRelativePath = `stores/${storeIdentifier}.ts`
	const storeAbsolutePath = path.resolve(currentWorkingDirectory, storeFileRelativePath)
	const storeExists = exists(storeAbsolutePath)
	const tableType = tableProperty.getTypeAtLocation(locationNode)
	const rowType = tableType.getProperty('Row')?.getTypeAtLocation(locationNode)
	const columnNames = rowType?.getProperties().map(property => property.getName()) ?? []
	const policies = getColumnPolicies(config.tables, tableName, columnNames)
	const tableMetadata = getTableMetadata(databaseMetadata, tableName)
	const primaryKeyColumns = tableMetadata?.primaryKey ?? (columnNames.includes('id') ? ['id'] : [])
	if (primaryKeyColumns.length !== 1) {
		throw new Error(`[nsdb] ${tableName} requires exactly one primary key for generated CRUD; found ${primaryKeyColumns.length}.`)
	}
	const primaryKey = primaryKeyColumns[0]
	const conventionalReadonly = ['id', 'created_at', 'updated_at', 'inserted_at']
	const rowOmit = columnNames.filter(column => policies[column].serverOnly || !policies[column].selectable)
	const insertOmit = columnNames.filter(column => {
		if (policies[column].serverOnly || policies[column].editable === false) return true
		if (tableMetadata) return !tableMetadata.columns[column]?.insertable
		return conventionalReadonly.includes(column)
	})
	const updateOmit = columnNames.filter(column => {
		if (policies[column].serverOnly || policies[column].editable === false) return true
		if (tableMetadata) return !tableMetadata.columns[column]?.updatable
		return conventionalReadonly.includes(column)
	})

	const code = templateContent
		.replace(/__TABLE__/g, tableName)
		.replace(/__PASCAL__/g, pascalName)
		.replace(/__ROW__/g, rowTypeName)
		.replace(/__HOOK__/g, hookName)
		.replace(/__PRIMARY_KEY__/g, primaryKey)
		.replace(/__ROW_OMIT__/g, asKeyUnion(rowOmit))
		.replace(/__INSERT_OMIT__/g, asKeyUnion(insertOmit))
		.replace(/__UPDATE_OMIT__/g, asKeyUnion(updateOmit))
		.replace(/__RELATION_ROWS__/g, relationRowsType(tableRelations, config, tableColumnsByName))
		.replace(/__STORE_IMPORT__/g, storeExists ? `import { ${storeIdentifier} } from '~~/stores/${storeIdentifier}'` : '')
		.replace(/__STORE_CREATOR__/g, storeExists ? `(() => ${storeIdentifier}() as any)` : 'undefined')

	return { code, hookName }
}

export async function main() {
	const parsedArguments = parseArgs()
	const currentWorkingDirectory = process.cwd()
	const { config } = await loadNsdbConfig(currentWorkingDirectory, parsedArguments.get('config', ''))
	const typesFilePath = path.resolve(currentWorkingDirectory, getOption(parsedArguments, config, 'types', 'paths.types'))
	const outputDirectory = path.resolve(currentWorkingDirectory, getOption(parsedArguments, config, 'outDir', 'paths.models'))
	const barrelFilePath = path.join(outputDirectory, 'index.ts')
	const templateFilePath = path.resolve(
		currentWorkingDirectory,
		getOption(parsedArguments, config, 'template', 'templates.model')
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
	const databaseMetadata = loadDatabaseMetadata(currentWorkingDirectory, config)
	const exportStatements = []
	const generatedFileNames = []

	const tableProperties = selectTableProperties(tablesType, config.tables)
	const exposedTableNames = new Set(tableProperties.map(property => property.getName()))
	const relationCatalog = buildRelationCatalog(databaseMetadata, exposedTableNames)
	const tableColumnsByName = new Map(tableProperties.map(property => {
		const tableType = property.getTypeAtLocation(databaseAlias)
		const rowType = tableType.getProperty('Row')?.getTypeAtLocation(databaseAlias)
		return [property.getName(), rowType?.getProperties().map(column => column.getName()) ?? []]
	}))
	for (const tableProperty of tableProperties) {
		const tableName = tableProperty.getName()
		const { code, hookName } = buildModelCode(
			tableProperty,
			templateContent,
			currentWorkingDirectory,
			config,
			databaseMetadata,
			databaseAlias,
			relationCatalog[tableName] ?? [],
			tableColumnsByName,
		)
		const modelFilePath = path.join(outputDirectory, `${tableName}.ts`)
		writeText(modelFilePath, markGenerated(code))
		console.log('✅ model:', path.relative(currentWorkingDirectory, modelFilePath))
		exportStatements.push(`export * from './${tableName}' // ${hookName}`)
		generatedFileNames.push(`${tableName}.ts`)
	}

	writeText(barrelFilePath, markGenerated(exportStatements.join('\n') + '\n'))
	removeStaleGeneratedFiles(outputDirectory, ['index.ts', ...generatedFileNames])
	console.log('✅ models barrel:', path.relative(currentWorkingDirectory, barrelFilePath))
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error('❌ Unexpected error while generating models.')
		console.error(error)
		process.exit(1)
	})
}
