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

/**
 * Ancien helper (conservé au cas où tu en aurais besoin plus tard).
 * Il n'est plus utilisé pour générer le schema UI, mais je le laisse
 * pour ne pas "perdre" la fonctionnalité.
 */
function guessFieldKindFromTypeText(typeText) {
	const normalizedText = String(typeText || '').toLowerCase()

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

/**
 * Nouveau helper : mappe le type TS (textuel) vers ton FieldType UI
 * ('text' | 'number' | 'checkbox' | 'datetime' | 'textarea' | ...).
 * Les enums seront forcés plus bas à 'select'.
 */
function guessFieldTypeForUi(typeText) {
	const normalized = String(typeText || '').toLowerCase()

	if (normalized.includes('bool')) return 'checkbox'
	if (
		normalized.includes('int') ||
		normalized.includes('number') ||
		normalized.includes('float') ||
		normalized.includes('numeric')
	) {
		return 'number'
	}
	if (normalized.includes('timestamp') || normalized.includes('date')) {
		return 'datetime'
	}
	if (normalized.includes('json')) return 'textarea'
	// Pour le reste, on part sur du 'text' par défaut
	return 'text'
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

// Récupère le texte brut du type tel qu'il est écrit dans `Insert`
// (ex: `Database["public"]["Enums"]["PROVIDERS"] | null`)
function getInsertPropertyTypeNodeText(insertType, fieldName) {
	const insertPropertySymbol = insertType.getProperty(fieldName)
	if (!insertPropertySymbol) return null

	const declaration = insertPropertySymbol.getDeclarations()?.[0]
	if (!declaration) return null

	const typeNode = declaration.getTypeNode()
	if (!typeNode) return null

	return typeNode.getText()
}

/**
 * Lit la propriété `Relationships` d'une table Supabase
 * et renvoie une liste d'objets JS :
 * {
 *   foreignKeyName,
 *   columns: string[],
 *   isOneToOne: boolean,
 *   referencedRelation: string,
 *   referencedColumns: string[]
 * }
 *
 * ⚠️ IMPORTANT : on lit les TYPES (getTypeAtLocation + getText),
 * pas des initializers (il n'y en a pas dans les déclarations de type).
 */
function getRelationshipsForTable(tableType, locationNode) {
	const relProperty = tableType.getProperty('Relationships')
	if (!relProperty) return []

	const relType = relProperty.getTypeAtLocation(locationNode)
	const tupleElements = relType.isTuple() ? relType.getTupleElements() : []

	return tupleElements.map((elType) => {
		const t = elType.getApparentType()

		function getLiteralFromType(propName) {
			const prop = t.getProperty(propName)
			if (!prop) return undefined
			const type = prop.getTypeAtLocation(locationNode)
			const text = type.getText() // ex: '"songs_profile_id_fkey"' ou 'false'
			return text.replace(/['"`]/g, '')
		}

		function getArrayFromType(propName) {
			const prop = t.getProperty(propName)
			if (!prop) return []
			const type = prop.getTypeAtLocation(locationNode)
			const text = type.getText() // ex: '["playlist_id"]' ou '["id"]'

			const matches = []
			const regex = /"([^"]+)"/g
			let m
			while ((m = regex.exec(text)) !== null) {
				matches.push(m[1])
			}
			return matches
		}

		const foreignKeyName = getLiteralFromType('foreignKeyName')
		const columns = getArrayFromType('columns')
		const referencedRelation = getLiteralFromType('referencedRelation')
		const referencedColumns = getArrayFromType('referencedColumns')
		const isOneToOneText = getLiteralFromType('isOneToOne')
		const isOneToOne = isOneToOneText === 'true'

		return {
			foreignKeyName,
			columns,
			isOneToOne,
			referencedRelation,
			referencedColumns,
		}
	})
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

	// 🔥 On lit les relations pour cette table
	const relationships = getRelationshipsForTable(tableType, locationNode)
	console.log(`🔍 Table "${tableName}" - found ${relationships.length} relationships.`)

	// Map: nom de colonne locale -> descriptor de relation
	const relationByColumn = new Map()
	for (const rel of relationships) {
		for (const col of rel.columns) {
			relationByColumn.set(col, rel)
		}
	}

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

		// Texte du type tel qu'il est écrit dans Insert
		// => ex: Database["public"]["Enums"]["PROVIDERS"] | null
		const insertRawTypeReferenceText = getInsertPropertyTypeNodeText(
			insertType,
			fieldName
		)

		const enumName = extractEnumNameFromTypeText(insertRawTypeReferenceText)

		// Type UI par défaut (FieldType)
		let uiFieldType = guessFieldTypeForUi(
			insertFieldTypeText || rowFieldTypeText
		)

		// Si on a trouvé un enum sur Insert, on force le type à 'select'
		let optionsAttachment = ''
		if (enumName) {
			uiFieldType = 'select'
			optionsAttachment =
				`, options: Enums.${toPascal(enumName)}Values.map(v => ({ label: String(v), value: v }))`
		}

		const isPrimaryKey = fieldName === 'id'
		const isReadOnlyField =
			isPrimaryKey || ['created_at', 'updated_at', 'inserted_at'].includes(fieldName)

		// 🔗 Relation éventuelle pour ce champ
		const relationDescriptor = relationByColumn.get(fieldName)
		let relationAttachment = ''

		if (relationDescriptor) {
			// kind simple: si isOneToOne => 'hasOne', sinon 'belongsTo'
			const kind = relationDescriptor.isOneToOne ? 'hasOne' : 'belongsTo'

			uiFieldType = 'relation' // on force le type UI pour les FK

			relationAttachment =
				`, relation: {` +
				` kind: '${kind}',` +
				` referencedTable: '${relationDescriptor.referencedRelation}',` +
				` localColumns: [${relationDescriptor.columns.map((c) => `'${c}'`).join(', ')}],` +
				` referencedColumns: [${relationDescriptor.referencedColumns
					.map((c) => `'${c}'`)
					.join(', ')}],` +
				` foreignKeyName: '${relationDescriptor.foreignKeyName}'` +
				` }`
		}

		fieldLines.push(
			`\t${fieldName}: {` +
				` label: '${fieldName}',` +
				` type: '${uiFieldType}',` +
				` required: ${fieldIsRequired}` +
				`${isReadOnlyField ? ', readonly: true' : ''}` +
				`${optionsAttachment}` +
				`${relationAttachment}` +
			` },`
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
