#!/usr/bin/env node
/**
 * Generate NSDB Schemas from Supabase types
 * - Reads:  types/database.types.ts
 * - Emits:  nsdb/schemas/<table>.ts + nsdb/schemas/index.ts
 * - Uses:   templates/schema.template.ts
 *
 * Responsibilities are split per function:
 *  - validateEnvironment
 *  - loadProject
 *  - getDatabaseTypeAlias
 *  - getPublicSchemaTypes
 *  - buildEnumMap
 *  - parseRelationships
 *  - detectFieldRequired
 *  - guessFieldKind
 *  - extractEnumNameFromTypeText
 *  - findEnumInType
 *  - buildSchemaForTable
 *  - renderSchemaFromTemplate
 *  - writeSchemaFile
 *  - writeBarrel
 *  - main
 */

import fs from 'fs'
import path from 'path'
import { Project } from 'ts-morph'
import { fileURLToPath } from 'url'
import { toPascal } from '../helpers/names.js'

/* ------------------------- paths & constants ------------------------- */

const currentWorkingDirectory = process.cwd()
const typesFilePath = path.resolve(currentWorkingDirectory, 'types/database.types.ts')
const outputDirectory = path.resolve(currentWorkingDirectory, 'nsdb/schemas')
const barrelFilePath = path.join(outputDirectory, 'index.ts')
const templateFilePath = path.resolve(currentWorkingDirectory, 'node_modules/@lucashw68/nsdb/templates/schema.template.ts')

/* ------------------------------ helpers ------------------------------ */

function validateEnvironment() {
	if (!fs.existsSync(typesFilePath)) {
		console.error(`❌ Missing types file: ${typesFilePath}`)
		process.exit(1)
	}
	if (!fs.existsSync(templateFilePath)) {
		console.error(`❌ Missing template: ${templateFilePath}`)
		process.exit(1)
	}
	fs.mkdirSync(outputDirectory, { recursive: true })
}

function loadProject() {
	return new Project({ skipAddingFilesFromTsConfig: true })
}

function getDatabaseTypeAlias(project) {
	const sourceFile = project.addSourceFileAtPath(typesFilePath)
	try {
		return sourceFile.getTypeAliasOrThrow('Database')
	} catch {
		console.error('❌ Type alias "Database" not found in types/database.types.ts')
		process.exit(1)
	}
}

function getPublicSchemaTypes(databaseAlias) {
	const dbType = databaseAlias.getType()
	const publicSchema = dbType.getProperty('public')?.getTypeAtLocation(databaseAlias)
	if (!publicSchema) {
		console.error(`❌ Can't resolve Database["public"]`)
		process.exit(1)
	}
	const tables = publicSchema.getProperty('Tables')?.getTypeAtLocation(databaseAlias)
	if (!tables) {
		console.error(`❌ Can't resolve Database["public"]["Tables"]`)
		process.exit(1)
	}
	const enums = publicSchema.getProperty('Enums')?.getTypeAtLocation(databaseAlias) || null
	return { tables, enums }
}

function buildEnumMap(enumsType) {
	// enumName -> { pascal }
	const map = {}
	if (!enumsType) return map
	for (const property of enumsType.getProperties()) {
		const enumName = property.getName()
		map[enumName] = { pascal: toPascal(enumName) }
	}
	return map
}

function parseArrayTypeTextLiteralToArray(text) {
	// expects a literal like: ["profile_id"] or ["id"]
	// returns ['profile_id'] or null
	const matches = String(text || '').match(/\["([^"]*)"\]/g) || []
	const values = []
	for (const segment of matches) {
		const found = segment.match(/\["([^"]*)"\]/)?.[1]
		if (found) values.push(found)
	}
	return values.length ? values : null
}

function parseRelationships(tableType, typeLocationNode) {
	// Returns a map by column: colName -> { table, column, fk }
	const relationshipsProperty = tableType.getProperty('Relationships')
	if (!relationshipsProperty) return {}

	const relationshipsType = relationshipsProperty.getTypeAtLocation(typeLocationNode)
	const arrayMembers = relationshipsType.isArray()
		? [relationshipsType.getArrayElementTypeOrThrow()]
		: relationshipsType.isUnion()
			? relationshipsType.getUnionTypes()
			: []

	const mapByColumn = {}

	for (const member of arrayMembers) {
		const foreignKeyName = member.getProperty('foreignKeyName')?.getTypeAtLocation(typeLocationNode).getLiteralValue?.()
		const columnsText = member.getProperty('columns')?.getTypeAtLocation(typeLocationNode).getText()
		const referencedRelation = member.getProperty('referencedRelation')?.getTypeAtLocation(typeLocationNode).getLiteralValue?.()
		const referencedColumnsText = member.getProperty('referencedColumns')?.getTypeAtLocation(typeLocationNode).getText()

		const columns = parseArrayTypeTextLiteralToArray(columnsText) || []
		const referencedColumns = parseArrayTypeTextLiteralToArray(referencedColumnsText) || ['id']

		for (const column of columns) {
			mapByColumn[column] = {
				table: referencedRelation || null,
				column: referencedColumns[0] || 'id',
				fk: foreignKeyName || null
			}
		}
	}

	return mapByColumn
}

function detectFieldRequired(insertType, fieldName) {
	// Required if appears in Insert without question token
	const insertProperty = insertType.getProperty(fieldName)
	if (!insertProperty) return false // often auto/readonly such as id, created_at
	const declaration = insertProperty.getDeclarations()?.[0]
	const isOptional = declaration?.hasQuestionToken?.() ?? false
	return !isOptional
}

function guessFieldKind(typeText) {
	const normalized = String(typeText).toLowerCase().replace(/"/g, "'")
	if (normalized.includes("database['public']['enums']")) return 'enum'
	if (normalized.includes('uuid')) return 'uuid'
	if (normalized.includes('timestamp') || normalized.includes('date')) return 'timestamp'
	if (normalized.includes('boolean') || normalized.includes('bool')) return 'boolean'
	if (normalized.includes('number') || normalized.includes('int') || normalized.includes('numeric') || normalized.includes('float') || normalized.includes('double')) return 'number'
	if (normalized.includes('json')) return 'json'
	if (normalized.includes('string') || normalized.includes('text') || normalized.includes('varchar') || normalized.includes('char')) return 'string'
	return 'unknown'
}

function extractEnumNameFromTypeText(typeText) {
	// robust to quotes/spacing/case: Database["public"]["Enums"]["PROVIDERS"]
	const enumPattern = /Database\[\s*['"]public['"]\s*\]\s*\[\s*['"]Enums['"]\s*\]\s*\[\s*['"]([^'"]+)['"]\s*\]/i
	const match = String(typeText).match(enumPattern)
	return match?.[1] || null
}

function findEnumInType(tsType, typeLocationNode, enumMap) {
	const candidates = tsType.isUnion() ? tsType.getUnionTypes() : [tsType]
	for (const candidate of candidates) {
		const textsToCheck = [
			candidate.getText(),
			candidate.getApparentType().getText?.() ?? ''
		]
		for (const text of textsToCheck) {
			const fullMatch = extractEnumNameFromTypeText(text)
			if (fullMatch && enumMap[fullMatch]) return fullMatch
			for (const knownEnumName of Object.keys(enumMap)) {
				const token = new RegExp(`\\b${knownEnumName}\\b`)
				if (token.test(String(text))) return knownEnumName
			}
		}
	}
	return null
}

function buildSchemaForTable(tableProperty, sourceFile, enumMap) {
	const tableName = tableProperty.getName()
	const pascalTableName = toPascal(tableName)
	const rowTypeAlias = `${pascalTableName}Row`

	const tableType = tableProperty.getTypeAtLocation(sourceFile)
	const rowProperty = tableType.getProperty('Row')
	const insertProperty = tableType.getProperty('Insert')

	if (!rowProperty || !insertProperty) {
		return { tableName, pascalTableName, rowTypeAlias, fields: [], relationshipsByColumn: {} }
	}

	const rowType = rowProperty.getTypeAtLocation(sourceFile)
	const insertType = insertProperty.getTypeAtLocation(sourceFile)
	const relationshipsByColumn = parseRelationships(tableType, sourceFile)

	const fields = []

	for (const rowField of rowType.getProperties()) {
		const fieldName = rowField.getName()
		const fieldTsType = rowField.getTypeAtLocation(sourceFile)
		const fieldTypeText = fieldTsType.getText()

		const required = detectFieldRequired(insertType, fieldName)

		// enum detection + kind forcing
		let fieldKind = guessFieldKind(fieldTypeText)
		let enumAttachment = ''
		const enumName = findEnumInType(fieldTsType, sourceFile, enumMap)
		if (enumName && enumMap[enumName]) {
			fieldKind = 'enum'
			enumAttachment = `, enum: Enums.${enumMap[enumName].pascal}Values`
		}

		const isPrimaryKey = fieldName === 'id'
		const isReadonly = isPrimaryKey || fieldName === 'created_at' || fieldName === 'inserted_at' || fieldName === 'updated_at'

		const relation = relationshipsByColumn[fieldName]
			? `, relation: { table: '${relationshipsByColumn[fieldName].table}', column: '${relationshipsByColumn[fieldName].column}', fk: '${relationshipsByColumn[fieldName].fk}' }`
			: ``

		fields.push(
			`\t${fieldName}: { type: '${fieldKind}', required: ${required}${isPrimaryKey ? ', pk: true' : ''}${isReadonly ? ', readonly: true' : ''}${enumAttachment}${relation} },`
		)
	}

	return { tableName, pascalTableName, rowTypeAlias, fields, relationshipsByColumn }
}

function renderSchemaFromTemplate(templateContent, tableName, pascalTableName, rowTypeAlias, fieldsLines) {
	return templateContent
		.replace(/__TABLE__/g, tableName)
		.replace(/__PASCAL__/g, pascalTableName)
		.replace(/__ROW__/g, rowTypeAlias)
		.replace('// __FIELDS__', fieldsLines.join('\n'))
}

function writeSchemaFile(tableName, renderedCode) {
	const schemaFilePath = path.join(outputDirectory, `${tableName}.ts`)
	fs.writeFileSync(schemaFilePath, renderedCode, 'utf8')
	console.log('✅ schema:', path.relative(currentWorkingDirectory, schemaFilePath))
	return schemaFilePath
}

function writeBarrel(exportedFiles) {
	const lines = exportedFiles.map(({ filePath, pascalTableName }) => {
		const base = path.basename(filePath, '.ts')
		return `export * from './${base}' // ${pascalTableName}Schema`
	})
	fs.writeFileSync(barrelFilePath, lines.join('\n') + '\n', 'utf8')
	console.log('✅ schemas barrel:', path.relative(currentWorkingDirectory, barrelFilePath))
}

/* --------------------------------- main -------------------------------- */

function main() {
	validateEnvironment()

	const project = loadProject()
	const databaseAlias = getDatabaseTypeAlias(project)
	const { tables: tablesType, enums: enumsType } = getPublicSchemaTypes(databaseAlias)
	const enumMap = buildEnumMap(enumsType)

	const templateContent = fs.readFileSync(templateFilePath, 'utf8')
	const exportsForBarrel = []

	for (const tableProperty of tablesType.getProperties()) {
		const schema = buildSchemaForTable(tableProperty, databaseAlias, enumMap)
		if (!schema.fields.length) continue

		const code = renderSchemaFromTemplate(
			templateContent,
			schema.tableName,
			schema.pascalTableName,
			schema.rowTypeAlias,
			schema.fields
		)

		const filePath = writeSchemaFile(schema.tableName, code)
		exportsForBarrel.push({ filePath, pascalTableName: schema.pascalTableName })
	}

	writeBarrel(exportsForBarrel)
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main()
}
