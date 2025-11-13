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

function guessFieldKindFromTypeText(typeText) {
	const normalizedText = String(typeText || '').toLowerCase()
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
	const enumMatch = String(typeText || '')
		.replace(/'/g, '"')
		.match(/Database\["public"\]\["Enums"\]\["([^"]+)"\]/)

	return enumMatch?.[1] ?? null
}

function isFieldRequired(insertType, fieldName) {
	const insertPropertySymbol = insertType.getProperty(fieldName)
	if (!insertPropertySymbol) return false

	const declaration = insertPropertySymbol.getDeclarations()?.[0]
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

	const fieldLines = []

	for (const rowField of rowType.getProperties()) {
		const fieldName = rowField.getName()
		const fieldType = rowField.getTypeAtLocation(locationNode)
		const rowFieldTypeText = fieldType.getText()

		const insertPropertySymbol = insertType.getProperty(fieldName)
		const insertFieldTypeText = insertPropertySymbol
			?.getTypeAtLocation(locationNode)
			.getText()

		const fieldIsRequired = isFieldRequired(insertType, fieldName)

		// Kind: prefer Insert type (closer to what we actually write) and fall back to Row
		const inferredKind = guessFieldKindFromTypeText(
			insertFieldTypeText || rowFieldTypeText
		)

		// Enum detection MUST come from Insert type
		const enumName = extractEnumNameFromTypeText(insertFieldTypeText)

		const isPrimaryKey = fieldName === 'id'
		const isReadOnlyField =
			isPrimaryKey || ['created_at', 'updated_at', 'inserted_at'].includes(fieldName)

		const enumAttachment = enumName
			? `, enum: Enums.${toPascal(enumName)}Values`
			: ''

		fieldLines.push(
			`\t${fieldName}: { type: '${inferredKind}', required: ${fieldIsRequired}` +
				`${isPrimaryKey ? ', primaryKey: true' : ''}` +
				`${isReadOnlyField ? ', readOnly: true' : ''}` +
				`${enumAttachment} },`
		)
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

	const typesFilePath = path.resolve(
		currentWorkingDirectory,
		parsedArguments.get('types', 'types/database.types.ts')
	)

	const outputDirectory = path.resolve(
		currentWorkingDirectory,
		parsedArguments.get('outDir', 'nsdb/schemas')
	)

	const barrelFilePath = path.join(outputDirectory, 'index.ts')

	const templateFilePath = path.resolve(
		currentWorkingDirectory,
		parsedArguments.get(
			'template',
			'node_modules/@lucashw68/nsdb/templates/schema.template.ts'
		)
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
		const schemaFilePath = path.join(
			outputDirectory,
			`${schemaDescriptor.tableName}.ts`
		)

		writeText(schemaFilePath, fileContent)
		console.log('✅ schema:', path.relative(currentWorkingDirectory, schemaFilePath))

		exportStatements.push(
			`export * from './${schemaDescriptor.tableName}' // ${schemaDescriptor.pascalTableName}Schema`
		)
	}

	writeText(barrelFilePath, exportStatements.join('\n') + '\n')
	console.log('✅ schemas barrel:', path.relative(currentWorkingDirectory, barrelFilePath))
}

if (import.meta.url === `file://${process.argv[1]}`) main()
