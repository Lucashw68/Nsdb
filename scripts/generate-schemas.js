#!/usr/bin/env node
import path from 'path'
import { exists, readText, writeText, ensureDir } from '../helpers/io.js'
import { parseArgs } from '../helpers/args.js'
import {
	createTsProject,
	addSourceFile,
	loadDatabaseAlias,
	getPublicTablesType
} from '../helpers/ts.js'
import { toPascal } from '../helpers/names.js'

function parseArrayLiteralFromTypeText(typeText) {
	const literalMatches = String(typeText || '').match(/\["([^"]*)"\]/g) || []
	return literalMatches
		.map((matchValue) => matchValue.match(/\["([^"]*)"\]/)?.[1])
		.filter(Boolean)
}

function guessFieldKindFromTypeText(typeText) {
	const normalizedText = String(typeText).toLowerCase()
	const normalizedQuotes = normalizedText.replace(/'/g, '"')

	if (normalizedQuotes.includes('database["public"]["enums"]')) return 'enum'
	if (normalizedText.includes('uuid')) return 'uuid'
	if (normalizedText.includes('timestamp') || normalizedText.includes('date')) return 'timestamp'
	if (normalizedText.includes('bool')) return 'boolean'
	if (
		normalizedText.includes('int') ||
		normalizedText.includes('number') ||
		normalizedText.includes('float') ||
		normalizedText.includes('numeric')
	) {
		return 'number'
	}
	if (normalizedText.includes('json')) return 'json'
	if (
		normalizedText.includes('string') ||
		normalizedText.includes('text') ||
		normalizedText.includes('char') ||
		normalizedText.includes('varchar')
	) {
		return 'string'
	}
	return 'unknown'
}

function extractEnumNameFromTypeText(typeText) {
	const enumMatch = String(typeText).replace(/'/g, '"').match(/Database\["public"\]\["Enums"\]\["([^"]+)"\]/)
	return enumMatch?.[1] ?? null
}

function buildRelationshipsByColumn(tableType, locationNode) {
	const relationshipsProperty = tableType.getProperty('Relationships')
	if (!relationshipsProperty) return {}

	const relationshipsType = relationshipsProperty.getTypeAtLocation(locationNode)
	const relationshipMembers = relationshipsType.isArray()
		? [relationshipsType.getArrayElementTypeOrThrow()]
		: relationshipsType.isUnion()
			? relationshipsType.getUnionTypes()
			: []

	const relationshipsByColumn = {}
	for (const memberType of relationshipMembers) {
		const foreignKeyName = memberType.getProperty('foreignKeyName')?.getTypeAtLocation(locationNode).getLiteralValue?.()
		const columnDefinitionText = memberType.getProperty('columns')?.getTypeAtLocation(locationNode).getText()
		const referencedTable = memberType.getProperty('referencedRelation')?.getTypeAtLocation(locationNode).getLiteralValue?.()
		const referencedColumnsText = memberType.getProperty('referencedColumns')?.getTypeAtLocation(locationNode).getText()

		const columns = parseArrayLiteralFromTypeText(columnDefinitionText)
		const referencedColumns = parseArrayLiteralFromTypeText(referencedColumnsText)
		const primaryReferencedColumn = referencedColumns[0] || 'id'

		for (const columnName of columns) {
			relationshipsByColumn[columnName] = {
				table: referencedTable || null,
				column: primaryReferencedColumn,
				foreignKeyName: foreignKeyName || null
			}
		}
	}
	return relationshipsByColumn
}

function isFieldRequired(insertType, fieldName) {
	const insertProperty = insertType.getProperty(fieldName)
	if (!insertProperty) return false

	const declaration = insertProperty.getDeclarations()?.[0]
	const isOptional = declaration?.hasQuestionToken?.() ?? false
	return !isOptional
}

function buildSchemaForTable(tableProperty, locationNode) {
	const tableName = tableProperty.getName()
	const pascalTableName = toPascal(tableName)
	const rowTypeAliasName = `${pascalTableName}Row`

	const tableType = tableProperty.getTypeAtLocation(locationNode)
	const rowProperty = tableType.getProperty('Row')
	const insertProperty = tableType.getProperty('Insert')
	if (!rowProperty || !insertProperty) return null

	const rowType = rowProperty.getTypeAtLocation(locationNode)
	const insertType = insertProperty.getTypeAtLocation(locationNode)
	const relationshipsByColumn = buildRelationshipsByColumn(tableType, locationNode)

	const fieldLines = []
	for (const rowField of rowType.getProperties()) {
		const fieldName = rowField.getName()
		const fieldType = rowField.getTypeAtLocation(locationNode)
		const fieldTypeText = fieldType.getText()

		const fieldIsRequired = isFieldRequired(insertType, fieldName)
		let inferredKind = guessFieldKindFromTypeText(fieldTypeText)
		const enumName = extractEnumNameFromTypeText(fieldTypeText)
		if (enumName) inferredKind = 'enum'

		const isPrimaryKey = fieldName === 'id'
		const isReadonlyField = isPrimaryKey || ['created_at', 'updated_at', 'inserted_at'].includes(fieldName)

		const relationship = relationshipsByColumn[fieldName]
		const relationshipMeta = relationship
			? `, relation: { table: '${relationship.table}', column: '${relationship.column}', fk: '${relationship.foreignKeyName}' }`
			: ''

		const enumAttachment = enumName ? `, enum: Enums.${toPascal(enumName)}Values` : ''

		fieldLines.push(`\t${fieldName}: { type: '${inferredKind}', required: ${fieldIsRequired}${isPrimaryKey ? ', pk: true' : ''}${isReadonlyField ? ', readonly: true' : ''}${enumAttachment}${relationshipMeta} },`)
	}

	return { tableName, pascalTableName, rowTypeAliasName, fieldLines }
}

function renderTemplate(templateContent, descriptor) {
	return templateContent
		.replace(/__TABLE__/g, descriptor.tableName)
		.replace(/__PASCAL__/g, descriptor.pascalTableName)
		.replace(/__ROW__/g, descriptor.rowTypeAliasName)
		.replace('// __FIELDS__', descriptor.fieldLines.join('\n'))
}

function main() {
	const parsedArguments = parseArgs()
	const currentWorkingDirectory = process.cwd()
	const typesFilePath = path.resolve(currentWorkingDirectory, parsedArguments.get('types', 'types/database.types.ts'))
	const outputDirectory = path.resolve(currentWorkingDirectory, parsedArguments.get('outDir', 'nsdb/schemas'))
	const barrelFilePath = path.join(outputDirectory, 'index.ts')
	const templateFilePath = path.resolve(
		currentWorkingDirectory,
		parsedArguments.get('template', 'node_modules/@lucashw68/nsdb/templates/schema.template.ts')
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
		const schemaDescriptor = buildSchemaForTable(tableProperty, databaseAlias)
		if (!schemaDescriptor || !schemaDescriptor.fieldLines.length) continue

		const fileContent = renderTemplate(templateContent, schemaDescriptor)
		const schemaFilePath = path.join(outputDirectory, `${schemaDescriptor.tableName}.ts`)
		writeText(schemaFilePath, fileContent)
		console.log('✅ schema:', path.relative(currentWorkingDirectory, schemaFilePath))
		exportStatements.push(`export * from './${schemaDescriptor.tableName}' // ${schemaDescriptor.pascalTableName}Schema`)
	}

	writeText(barrelFilePath, exportStatements.join('\n') + '\n')
	console.log('✅ schemas barrel:', path.relative(currentWorkingDirectory, barrelFilePath))
}

if (import.meta.url === `file://${process.argv[1]}`) main()
