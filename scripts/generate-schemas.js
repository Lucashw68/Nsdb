#!/usr/bin/env node
/**
 * Generate NSDB Schemas from Supabase types
 *
 * This generator:
 *  - Reads Supabase types from:     types/database.types.ts
 *  - Emits per-table schemas to:    nsdb/schemas/<table>.ts
 *  - Emits a barrel file:           nsdb/schemas/index.ts
 *  - Uses a template:               node_modules/@lucashw68/nsdb/templates/schema.template.ts
 *
 * Design goals:
 *  - Single-responsibility functions
 *  - No cryptic abbreviations for variables
 *  - Robust, simple enum detection (regex on Database["public"]["Enums"]["X"])
 *  - Clear logs and early failure when prerequisites are missing
 */

import fs from 'fs'
import path from 'path'
import { Project } from 'ts-morph'
import { toPascal } from '../helpers/names.js'

/* -------------------------------------------------------------------------- */
/* Paths & Constants                                                           */
/* -------------------------------------------------------------------------- */

const currentWorkingDirectory = process.cwd()
const typesFileAbsolutePath = path.resolve(currentWorkingDirectory, 'types/database.types.ts')
const outputDirectoryAbsolutePath = path.resolve(currentWorkingDirectory, 'nsdb/schemas')
const barrelFileAbsolutePath = path.join(outputDirectoryAbsolutePath, 'index.ts')
const templateFileAbsolutePath = path.resolve(
	currentWorkingDirectory,
	'node_modules/@lucashw68/nsdb/templates/schema.template.ts'
)

/* -------------------------------------------------------------------------- */
/* Environment & Project Loading                                               */
/* -------------------------------------------------------------------------- */

/**
 * Ensures required files exist and prepares the output directory.
 * Exits the process with code 1 if a prerequisite is missing.
 */
function validateEnvironment() {
	if (!fs.existsSync(typesFileAbsolutePath)) {
		console.error(`❌ Missing types file: ${typesFileAbsolutePath}`)
		process.exit(1)
	}
	if (!fs.existsSync(templateFileAbsolutePath)) {
		console.error(`❌ Missing template: ${templateFileAbsolutePath}`)
		process.exit(1)
	}
	fs.mkdirSync(outputDirectoryAbsolutePath, { recursive: true })
}

/**
 * Creates a lightweight ts-morph project (we do not load tsconfig or add all files).
 */
function createTypeScriptProject() {
	return new Project({ skipAddingFilesFromTsConfig: true })
}

/**
 * Loads the "Database" type alias from the Supabase types file.
 * @param {Project} project
 * @returns {import('ts-morph').TypeAliasDeclaration}
 */
function loadDatabaseTypeAlias(project) {
	const sourceFile = project.addSourceFileAtPath(typesFileAbsolutePath)
	try {
		return sourceFile.getTypeAliasOrThrow('Database')
	} catch {
		console.error('❌ Type alias "Database" not found in types/database.types.ts')
		process.exit(1)
	}
}

/**
 * From the "Database" alias, extracts the "public" schema types,
 * then returns the "Tables" type (mandatory).
 * @param {import('ts-morph').TypeAliasDeclaration} databaseAlias
 */
function getPublicTablesType(databaseAlias) {
	const databaseType = databaseAlias.getType()
	const publicSchemaType = databaseType.getProperty('public')?.getTypeAtLocation(databaseAlias)
	if (!publicSchemaType) {
		console.error('❌ Database["public"] not found.')
		process.exit(1)
	}
	const tablesType = publicSchemaType.getProperty('Tables')?.getTypeAtLocation(databaseAlias)
	if (!tablesType) {
		console.error('❌ Database["public"]["Tables"] not found.')
		process.exit(1)
	}
	return tablesType
}

/* -------------------------------------------------------------------------- */
/* Type Parsing Helpers                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Parses a TypeScript literal array type text into a string array.
 * Example: '["profile_id"]' -> ['profile_id']
 * @param {string} typeText
 * @returns {string[]}
 */
function parseArrayLiteralFromTypeText(typeText) {
	const matches = String(typeText || '').match(/\["([^"]*)"\]/g) || []
	return matches
		.map(segment => segment.match(/\["([^"]*)"\]/)?.[1])
		.filter(Boolean)
}

/**
 * Heuristic to guess the field kind for UI/validation meta.
 * Uses the raw type text string (lowercased).
 * @param {string} typeText
 * @returns {'enum'|'uuid'|'timestamp'|'boolean'|'number'|'json'|'string'|'unknown'}
 */
function guessFieldKindFromTypeText(typeText) {
	const normalized = String(typeText).toLowerCase()
	if (normalized.includes('database["public"]["enums"]')) return 'enum'
	if (normalized.includes('uuid')) return 'uuid'
	if (normalized.includes('timestamp') || normalized.includes('date')) return 'timestamp'
	if (normalized.includes('bool')) return 'boolean'
	if (
		normalized.includes('int') ||
		normalized.includes('number') ||
		normalized.includes('float') ||
		normalized.includes('numeric')
	) return 'number'
	if (normalized.includes('json')) return 'json'
	if (normalized.includes('string') || normalized.includes('text') || normalized.includes('char') || normalized.includes('varchar')) return 'string'
	return 'unknown'
}

/**
 * Extracts the enum name from a type text that contains:
 *   Database["public"]["Enums"]["YOUR_ENUM"]
 * @param {string} typeText
 * @returns {string|null}
 */
function extractEnumNameFromTypeText(typeText) {
	const match = String(typeText).match(/Database\["public"\]\["Enums"\]\["([^"]+)"\]/)
	return match?.[1] ?? null
}

/* -------------------------------------------------------------------------- */
/* Relationship & Required Detection                                           */
/* -------------------------------------------------------------------------- */

/**
 * Builds a map of relationships by column for a table type.
 * @param {import('ts-morph').Type} tableType
 * @param {import('ts-morph').Node} locationNode
 * @returns {Record<string, { table: string|null, column: string, fk: string|null }>}
 */
function buildRelationshipsByColumn(tableType, locationNode) {
	const relationshipsProperty = tableType.getProperty('Relationships')
	if (!relationshipsProperty) return {}

	const relationshipsType = relationshipsProperty.getTypeAtLocation(locationNode)
	const members = relationshipsType.isArray()
		? [relationshipsType.getArrayElementTypeOrThrow()]
		: relationshipsType.isUnion()
			? relationshipsType.getUnionTypes()
			: []

	const mapByColumn = {}

	for (const member of members) {
		const foreignKeyName = member.getProperty('foreignKeyName')?.getTypeAtLocation(locationNode).getLiteralValue?.()
		const columnsText = member.getProperty('columns')?.getTypeAtLocation(locationNode).getText()
		const referencedRelation = member.getProperty('referencedRelation')?.getTypeAtLocation(locationNode).getLiteralValue?.()
		const referencedColumnsText = member.getProperty('referencedColumns')?.getTypeAtLocation(locationNode).getText()

		const columns = parseArrayLiteralFromTypeText(columnsText)
		const referencedColumns = parseArrayLiteralFromTypeText(referencedColumnsText)
		const primaryReferencedColumn = referencedColumns[0] || 'id'

		for (const columnName of columns) {
			mapByColumn[columnName] = {
				table: referencedRelation || null,
				column: primaryReferencedColumn,
				fk: foreignKeyName || null
			}
		}
	}

	return mapByColumn
}

/**
 * Determines whether a field is required by checking the Insert type.
 * If the field is missing from Insert, it is treated as not required (likely auto/readonly).
 * @param {import('ts-morph').Type} insertType
 * @param {string} fieldName
 * @returns {boolean}
 */
function isFieldRequired(insertType, fieldName) {
	const insertProperty = insertType.getProperty(fieldName)
	if (!insertProperty) return false
	const declaration = insertProperty.getDeclarations()?.[0]
	const isOptional = declaration?.hasQuestionToken?.() ?? false
	return !isOptional
}

/* -------------------------------------------------------------------------- */
/* Schema Construction                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Builds the schema (fields metadata) for a given table property.
 * @param {import('ts-morph').Symbol} tableProperty
 * @param {import('ts-morph').Node} locationNode
 */
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

		const required = isFieldRequired(insertType, fieldName)
		let kind = guessFieldKindFromTypeText(fieldTypeText)
		const enumName = extractEnumNameFromTypeText(fieldTypeText)
		if (enumName) kind = 'enum'

		const isPrimaryKey = fieldName === 'id'
		const isReadonly =
			isPrimaryKey ||
			fieldName === 'created_at' ||
			fieldName === 'updated_at' ||
			fieldName === 'inserted_at'

		const relationMeta = relationshipsByColumn[fieldName]
			? `, relation: { table: '${relationshipsByColumn[fieldName].table}', column: '${relationshipsByColumn[fieldName].column}', fk: '${relationshipsByColumn[fieldName].fk}' }`
			: ''

		const enumAttachment = enumName ? `, enum: Enums.${toPascal(enumName)}Values` : ''

		fieldLines.push(
			`\t${fieldName}: { type: '${kind}', required: ${required}${isPrimaryKey ? ', pk: true' : ''}${isReadonly ? ', readonly: true' : ''}${enumAttachment}${relationMeta} },`
		)
	}

	return {
		tableName,
		pascalTableName,
		rowTypeAliasName,
		fieldLines
	}
}

/* -------------------------------------------------------------------------- */
/* File Rendering & Writing                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Fills the schema template with computed values.
 * @param {string} templateContent
 * @param {string} tableName
 * @param {string} pascalTableName
 * @param {string} rowTypeAliasName
 * @param {string[]} fieldLines
 */
function renderSchemaTemplate(templateContent, tableName, pascalTableName, rowTypeAliasName, fieldLines) {
	return templateContent
		.replace(/__TABLE__/g, tableName)
		.replace(/__PASCAL__/g, pascalTableName)
		.replace(/__ROW__/g, rowTypeAliasName)
		.replace('// __FIELDS__', fieldLines.join('\n'))
}

/**
 * Writes a single schema file to disk.
 * @param {string} tableName
 * @param {string} code
 * @returns {string} absolute file path
 */
function writeSchemaFile(tableName, code) {
	const schemaFileAbsolutePath = path.join(outputDirectoryAbsolutePath, `${tableName}.ts`)
	fs.writeFileSync(schemaFileAbsolutePath, code, 'utf8')
	console.log('✅ schema:', path.relative(currentWorkingDirectory, schemaFileAbsolutePath))
	return schemaFileAbsolutePath
}

/**
 * Writes the barrel file that re-exports all generated schemas.
 * @param {{ fileAbsolutePath: string, pascalTableName: string }[]} exportedSchemas
 */
function writeBarrelFile(exportedSchemas) {
	const lines = exportedSchemas.map(({ fileAbsolutePath, pascalTableName }) => {
		const baseName = path.basename(fileAbsolutePath, '.ts')
		return `export * from './${baseName}' // ${pascalTableName}Schema`
	})
	fs.writeFileSync(barrelFileAbsolutePath, lines.join('\n') + '\n', 'utf8')
	console.log('✅ schemas barrel:', path.relative(currentWorkingDirectory, barrelFileAbsolutePath))
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

function main() {
	validateEnvironment()

	const project = createTypeScriptProject()
	const databaseAlias = loadDatabaseTypeAlias(project)
	const publicTablesType = getPublicTablesType(databaseAlias)
	const templateContent = fs.readFileSync(templateFileAbsolutePath, 'utf8')

	const exportedSchemas = []

	for (const tableProperty of publicTablesType.getProperties()) {
		const schema = buildSchemaForTable(tableProperty, databaseAlias)
		if (!schema || !schema.fieldLines.length) continue

		const renderedCode = renderSchemaTemplate(
			templateContent,
			schema.tableName,
			schema.pascalTableName,
			schema.rowTypeAliasName,
			schema.fieldLines
		)

		const fileAbsolutePath = writeSchemaFile(schema.tableName, renderedCode)
		exportedSchemas.push({ fileAbsolutePath, pascalTableName: schema.pascalTableName })
	}

	writeBarrelFile(exportedSchemas)
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main()
}
