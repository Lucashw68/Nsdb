#!/usr/bin/env node
import path from 'path'
import { exists, readText, writeText, ensureDir } from '../helpers/io.js'
import { parseArgs } from '../helpers/args.js'
import { getOption, loadNsdbConfig } from '../helpers/config.js'
import {
	createTsProject,
	addSourceFile,
	loadDatabaseAlias,
	getPublicTablesType
} from '../helpers/ts.js'
import { toPascal } from '../helpers/names.js'
import { markGenerated, removeStaleGeneratedFiles } from '../helpers/generated.js'
import { getColumnPolicies, selectTableProperties } from '../helpers/tables.js'
import { getTableMetadata, loadDatabaseMetadata } from '../helpers/metadata.js'
import { buildRelationCatalog } from '../helpers/relations.js'

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
function guessFieldTypeForUi(typeText, columnMetadata = null) {
	const databaseType = String(columnMetadata?.dataType ?? '').toLowerCase()
	if (databaseType.endsWith('[]')) return 'array'
	if (databaseType === 'json' || databaseType === 'jsonb') return 'json'
	if (databaseType === 'date') return 'date'
	if (databaseType.includes('timestamp')) return 'datetime'
	if (databaseType.includes('bool')) return 'checkbox'
	if (/^(smallint|integer|bigint|numeric|decimal|real|double precision)/.test(databaseType)) return 'number'

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
	if (normalized.includes('json')) return 'json'
	if (normalized.includes('[]')) return 'array'
	// Pour le reste, on part sur du 'text' par défaut
	return 'text'
}

function extractEnumNameFromTypeText(typeText) {
	const enumMatch = String(typeText || '')
		.replace(/'/g, '"')
		.match(/Database\["public"\]\["Enums"\]\["([^"]+)"\]/)

	return enumMatch?.[1] ?? null
}

function extractLiteralOptions(typeText) {
	return [...String(typeText || '').matchAll(/["']([^"']+)["']/g)]
		.map(match => match[1])
		.filter((value, index, values) => values.indexOf(value) === index)
}

function humanizeIdentifier(identifier) {
	const words = String(identifier).replace(/_/g, ' ').trim()
	return words ? `${words[0].toUpperCase()}${words.slice(1)}` : identifier
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

function buildSchemaForTable(tableProperty, locationNode, exposedTableNames, config, databaseMetadata, tableRelations) {
	const tableName = tableProperty.getName()
	const pascalTableName = toPascal(tableName)
	const rowTypeAliasName = `${pascalTableName}Row`

	const tableType = tableProperty.getTypeAtLocation(locationNode)
	const rowProperty = tableType.getProperty('Row')
	const insertProperty = tableType.getProperty('Insert')
	const updateProperty = tableType.getProperty('Update')

	if (!rowProperty || !insertProperty || !updateProperty) return null

	const rowType = rowProperty.getTypeAtLocation(locationNode)
	const insertType = insertProperty.getTypeAtLocation(locationNode)
	const updateType = updateProperty.getTypeAtLocation(locationNode)

	// 🔥 On lit les relations pour cette table
	const tableMetadata = getTableMetadata(databaseMetadata, tableName)
	const relationships = (tableMetadata?.relationships ?? getRelationshipsForTable(tableType, locationNode))
		.filter(relation => exposedTableNames.has(relation.referencedRelation))
	console.log(`🔍 Table "${tableName}" - found ${relationships.length} relationships.`)

	// Map: nom de colonne locale -> descriptor de relation
	const relationByColumn = new Map()
	for (const rel of relationships) {
		if (rel.columns.length !== 1) continue
		for (const col of rel.columns) {
			relationByColumn.set(col, rel)
		}
	}

	const fieldLines = []
	const rowFields = rowType.getProperties()
	const columnPolicies = getColumnPolicies(config.tables, tableName, rowFields.map(field => field.getName()))

	for (const rowField of rowFields) {
		const fieldName = rowField.getName()
		const columnMetadata = tableMetadata?.columns?.[fieldName] ?? null
		const columnPolicy = columnPolicies[fieldName]
		if (columnPolicy.serverOnly) continue
		const fieldType = rowField.getTypeAtLocation(locationNode)
		const rowFieldTypeText = fieldType.getText()
		const fallbackNullable = /(^|\s)null(\s|$)/.test(rowFieldTypeText.replace(/\|/g, ' '))

		const insertPropertySymbol = insertType.getProperty(fieldName)
		const insertFieldTypeText = insertPropertySymbol
			?.getTypeAtLocation(locationNode)
			.getText()

		const fieldIsRequired = columnMetadata
			? Boolean(columnMetadata.insertable && !columnMetadata.nullable && !columnMetadata.hasDefault)
			: isFieldRequired(insertType, fieldName)

		// Texte du type tel qu'il est écrit dans Insert
		// => ex: Database["public"]["Enums"]["PROVIDERS"] | null
		const insertRawTypeReferenceText = getInsertPropertyTypeNodeText(
			insertType,
			fieldName
		)

		const enumName = extractEnumNameFromTypeText(insertRawTypeReferenceText)
		const literalOptions = enumName ? [] : extractLiteralOptions(insertRawTypeReferenceText)

		// Type UI par défaut (FieldType)
		let uiFieldType = guessFieldTypeForUi(
			insertFieldTypeText || rowFieldTypeText,
			columnMetadata,
		)

		// Si on a trouvé un enum sur Insert, on force le type à 'select'
		let optionsAttachment = ''
		if (enumName) {
			uiFieldType = 'select'
			optionsAttachment =
				`, options: Enums.${toPascal(enumName)}Values.map(v => ({ label: String(v), value: v }))`
		}
		else if (literalOptions.length > 1) {
			uiFieldType = 'select'
			optionsAttachment = `, options: ${JSON.stringify(literalOptions)}.map(v => ({ label: String(v), value: v }))`
		}

		const isPrimaryKey = columnMetadata
			? Boolean(columnMetadata.primaryKey)
			: fieldName === 'id'
		const policyAllowsEditing = columnPolicy.editable !== false
		const isConventionallyReadonly = isPrimaryKey || ['created_at', 'updated_at', 'inserted_at'].includes(fieldName)
		const isInsertable = policyAllowsEditing && (columnMetadata
			? Boolean(columnMetadata.insertable)
			: Boolean(insertType.getProperty(fieldName)) && !isConventionallyReadonly)
		const isUpdatable = policyAllowsEditing && (columnMetadata
			? Boolean(columnMetadata.updatable)
			: Boolean(updateType.getProperty(fieldName)) && !isConventionallyReadonly)
		const isEditable = isInsertable || isUpdatable
		const isReadOnlyField = !isEditable
		const fallbackHasDefault = !columnMetadata && isInsertable && !fieldIsRequired && !fallbackNullable

		// 🔗 Relation éventuelle pour ce champ
		const relationDescriptor = relationByColumn.get(fieldName)
		let relationAttachment = ''

		if (relationDescriptor) {
			// kind simple: si isOneToOne => 'hasOne', sinon 'belongsTo'
			const kind = relationDescriptor.isOneToOne ? 'hasOne' : 'belongsTo'
			const catalogRelation = tableRelations.find(
				relation => relation.foreignKeyName === relationDescriptor.foreignKeyName && relation.direction === 'forward',
			)

			uiFieldType = 'relation' // on force le type UI pour les FK

			relationAttachment =
				`, relation: {` +
				` alias: '${catalogRelation?.alias ?? relationDescriptor.referencedRelation}',` +
				` kind: '${kind}',` +
				` direction: '${catalogRelation?.direction ?? 'forward'}',` +
				` referencedTable: '${relationDescriptor.referencedRelation}',` +
				` embedResource: '${catalogRelation?.embedResource ?? relationDescriptor.referencedRelation}',` +
				` localColumns: [${relationDescriptor.columns.map((c) => `'${c}'`).join(', ')}],` +
				` referencedColumns: [${relationDescriptor.referencedColumns
					.map((c) => `'${c}'`)
					.join(', ')}],` +
				` foreignKeyName: '${relationDescriptor.foreignKeyName}',` +
				` nullable: ${catalogRelation?.nullable ?? false},` +
				` composite: ${catalogRelation?.composite ?? false}` +
				` }`
		}

		fieldLines.push(
			`\t${fieldName}: {` +
				` label: '${humanizeIdentifier(fieldName)}',` +
				` type: '${uiFieldType}',` +
				` required: ${fieldIsRequired}` +
				`, selectable: ${columnPolicy.selectable}` +
				`, editable: ${isEditable}` +
				`, insertable: ${isInsertable}` +
				`, updatable: ${isUpdatable}` +
				`${columnPolicy.hidden ? ', hidden: true' : ''}` +
				`${isReadOnlyField ? ', readonly: true' : ''}` +
				`${isPrimaryKey ? ', primaryKey: true' : ''}` +
				`${columnMetadata ? `, nullable: ${columnMetadata.nullable}, hasDefault: ${columnMetadata.hasDefault}, databaseType: ${JSON.stringify(columnMetadata.dataType)}, defaultExpression: ${JSON.stringify(columnMetadata.defaultExpression)}` : `, nullable: ${fallbackNullable}, hasDefault: ${fallbackHasDefault}`}` +
				`${optionsAttachment}` +
				`${relationAttachment}` +
			` },`
		)
	}

	return { tableName, pascalTableName, rowTypeAliasName, fieldLines, relations: tableRelations }
}

function renderTemplate(templateContent, descriptor) {
	return templateContent
		.replace(/__TABLE__/g, descriptor.tableName)
		.replace(/__PASCAL__/g, descriptor.pascalTableName)
		.replace(/__ROW__/g, descriptor.rowTypeAliasName)
		.replace('__RELATIONS__', JSON.stringify(descriptor.relations, null, 2))
		.replace('// __FIELDS__', descriptor.fieldLines.join('\n'))
}

export async function main() {
	const parsedArguments = parseArgs()
	const currentWorkingDirectory = process.cwd()
	const { config } = await loadNsdbConfig(currentWorkingDirectory, parsedArguments.get('config', ''))

	const typesFilePath = path.resolve(
		currentWorkingDirectory,
		getOption(parsedArguments, config, 'types', 'paths.types')
	)

	const outputDirectory = path.resolve(
		currentWorkingDirectory,
		getOption(parsedArguments, config, 'outDir', 'paths.schemas')
	)

	const barrelFilePath = path.join(outputDirectory, 'index.ts')

	const templateFilePath = path.resolve(
		currentWorkingDirectory,
		getOption(parsedArguments, config, 'template', 'templates.schema')
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
	const exposedTableNames = new Set(tableProperties.map(tableProperty => tableProperty.getName()))
	const relationCatalog = buildRelationCatalog(databaseMetadata, exposedTableNames)
	for (const tableProperty of tableProperties) {
		const tableName = tableProperty.getName()
		const schemaDescriptor = buildSchemaForTable(
			tableProperty,
			databaseAlias,
			exposedTableNames,
			config,
			databaseMetadata,
			relationCatalog[tableName] ?? [],
		)
		if (!schemaDescriptor || !schemaDescriptor.fieldLines.length) continue

		const fileContent = renderTemplate(templateContent, schemaDescriptor)
		const schemaFilePath = path.join(
			outputDirectory,
			`${schemaDescriptor.tableName}.ts`
		)

		writeText(schemaFilePath, markGenerated(fileContent))
		console.log('✅ schema:', path.relative(currentWorkingDirectory, schemaFilePath))

		exportStatements.push(
			`export * from './${schemaDescriptor.tableName}' // ${schemaDescriptor.pascalTableName}Schema`
		)
		generatedFileNames.push(`${schemaDescriptor.tableName}.ts`)
	}

	writeText(barrelFilePath, markGenerated(exportStatements.join('\n') + '\n'))
	removeStaleGeneratedFiles(outputDirectory, ['index.ts', ...generatedFileNames])
	console.log('✅ schemas barrel:', path.relative(currentWorkingDirectory, barrelFilePath))
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error('❌ Unexpected error while generating schemas.')
		console.error(error)
		process.exit(1)
	})
}
