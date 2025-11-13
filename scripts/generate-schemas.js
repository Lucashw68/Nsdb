#!/usr/bin/env node
import path from 'path'
import { exists, readText, writeText, ensureDir } from '../helpers/io.js'
import { parseArgs } from '../helpers/args.js'
import { createTsProject, addSourceFile, loadDatabaseAlias, getPublicTablesType } from '../helpers/ts.js'
import { toPascal } from '../helpers/names.js'

function parseArrayLiteralFromTypeText(typeText) {
	const matches = String(typeText || '').match(/\["([^"]*)"\]/g) || []
	return matches.map(s => s.match(/\["([^"]*)"\]/)?.[1]).filter(Boolean)
}

function guessFieldKindFromTypeText(typeText) {
	const n = String(typeText).toLowerCase()
	const q = n.replace(/'/g, '"')
	if (q.includes('database["public"]["enums"]')) return 'enum'
	if (n.includes('uuid')) return 'uuid'
	if (n.includes('timestamp') || n.includes('date')) return 'timestamp'
	if (n.includes('bool')) return 'boolean'
	if (n.includes('int') || n.includes('number') || n.includes('float') || n.includes('numeric')) return 'number'
	if (n.includes('json')) return 'json'
	if (n.includes('string') || n.includes('text') || n.includes('char') || n.includes('varchar')) return 'string'
	return 'unknown'
}

function extractEnumNameFromTypeText(typeText) {
	const m = String(typeText).replace(/'/g, '"').match(/Database\["public"\]\["Enums"\]\["([^"]+)"\]/)
	return m?.[1] ?? null
}

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
		const fkName = member.getProperty('foreignKeyName')?.getTypeAtLocation(locationNode).getLiteralValue?.()
		const colsText = member.getProperty('columns')?.getTypeAtLocation(locationNode).getText()
		const refRel = member.getProperty('referencedRelation')?.getTypeAtLocation(locationNode).getLiteralValue?.()
		const refColsText = member.getProperty('referencedColumns')?.getTypeAtLocation(locationNode).getText()

		const columns = parseArrayLiteralFromTypeText(colsText)
		const refCols = parseArrayLiteralFromTypeText(refColsText)
		const primaryRef = refCols[0] || 'id'

		for (const col of columns) {
			mapByColumn[col] = { table: refRel || null, column: primaryRef, fk: fkName || null }
		}
	}
	return mapByColumn
}

function isFieldRequired(insertType, fieldName) {
	const insertProperty = insertType.getProperty(fieldName)
	if (!insertProperty) return false
	const decl = insertProperty.getDeclarations()?.[0]
	const isOptional = decl?.hasQuestionToken?.() ?? false
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
	const relByColumn = buildRelationshipsByColumn(tableType, locationNode)

	const fieldLines = []
	for (const rowField of rowType.getProperties()) {
		const fieldName = rowField.getName()
		const fieldType = rowField.getTypeAtLocation(locationNode)
		const fieldTypeText = fieldType.getText()

		const required = isFieldRequired(insertType, fieldName)
		let kind = guessFieldKindFromTypeText(fieldTypeText)
		const enumName = extractEnumNameFromTypeText(fieldTypeText)
		if (enumName) kind = 'enum'

		const isPk = fieldName === 'id'
		const isReadonly = isPk || ['created_at', 'updated_at', 'inserted_at'].includes(fieldName)

		const relationMeta = relByColumn[fieldName]
			? `, relation: { table: '${relByColumn[fieldName].table}', column: '${relByColumn[fieldName].column}', fk: '${relByColumn[fieldName].fk}' }`
			: ''

		const enumAttachment = enumName ? `, enum: Enums.${toPascal(enumName)}Values` : ''

		fieldLines.push(`\t${fieldName}: { type: '${kind}', required: ${required}${isPk ? ', pk: true' : ''}${isReadonly ? ', readonly: true' : ''}${enumAttachment}${relationMeta} },`)
	}

	return { tableName, pascalTableName, rowTypeAliasName, fieldLines }
}

function renderTemplate(tpl, { tableName, pascalTableName, rowTypeAliasName, fieldLines }) {
	return tpl
		.replace(/__TABLE__/g, tableName)
		.replace(/__PASCAL__/g, pascalTableName)
		.replace(/__ROW__/g, rowTypeAliasName)
		.replace('// __FIELDS__', fieldLines.join('\n'))
}

function main() {
	const { get } = parseArgs()
	const cwd = process.cwd()
	const typesPath = path.resolve(cwd, get('types', 'types/database.types.ts'))
	const outDir = path.resolve(cwd, get('outDir', 'nsdb/schemas'))
	const barrel = path.join(outDir, 'index.ts')
	const templatePath = path.resolve(cwd, get('template', 'node_modules/@lucashw68/nsdb/templates/schema.template.ts'))

	if (!exists(typesPath)) {
		console.error(`❌ Missing types file: ${typesPath}`)
		process.exit(1)
	}
	if (!exists(templatePath)) {
		console.error(`❌ Missing template: ${templatePath}`)
		process.exit(1)
	}
	ensureDir(outDir)

	const project = createTsProject()
	const sf = addSourceFile(project, typesPath)
	const db = loadDatabaseAlias(sf)
	if (!db) {
		console.error('❌ Type alias "Database" not found')
		process.exit(1)
	}
	const tablesType = getPublicTablesType(db)
	if (!tablesType) {
		console.error('❌ Database["public"]["Tables"] not found')
		process.exit(1)
	}

	const tpl = readText(templatePath)
	const exports = []

	for (const tableProp of tablesType.getProperties()) {
		const schema = buildSchemaForTable(tableProp, db)
		if (!schema || !schema.fieldLines.length) continue

		const code = renderTemplate(tpl, schema)
		const file = path.join(outDir, `${schema.tableName}.ts`)
		writeText(file, code)
		console.log('✅ schema:', path.relative(cwd, file))
		exports.push(`export * from './${schema.tableName}' // ${schema.pascalTableName}Schema`)
	}

	writeText(barrel, exports.join('\n') + '\n')
	console.log('✅ schemas barrel:', path.relative(cwd, barrel))
}

if (import.meta.url === `file://${process.argv[1]}`) main()
