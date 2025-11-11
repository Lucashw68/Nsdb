#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { Project } from 'ts-morph'
import { fileURLToPath } from 'url'

const cwd = process.cwd()
const typesPath = path.resolve(cwd, 'types/database.types.ts')
const outDir = path.resolve(cwd, 'nsdb/schemas')
const barrel = path.join(outDir, 'index.ts')
const tplPath = path.resolve(cwd, 'node_modules/@lucashw68/nsdb/templates/schema.template.ts')

if (!fs.existsSync(typesPath)) { console.error(`❌ Missing ${typesPath}`); process.exit(1) }
if (!fs.existsSync(tplPath)) { console.error(`❌ Missing template ${tplPath}`); process.exit(1) }
fs.mkdirSync(outDir, { recursive: true })

const project = new Project({ skipAddingFilesFromTsConfig: true })
const sf = project.addSourceFileAtPath(typesPath)

let db
try { db = sf.getTypeAliasOrThrow('Database') }
catch { console.error('❌ Type alias "Database" not found'); process.exit(1) }

const extractEnumName = (typeText) => {
	// make it robust to single/double quotes and case, e.g. Database["public"]["Enums"]["STATUS"]
	// or Database['public']['Enums']['status']
	const re = /Database\[\s*['"]public['"]\s*\]\s*\[\s*['"]Enums['"]\s*\]\s*\[\s*['"]([^'"]+)['"]\s*\]/i
	const m = String(typeText).match(re)
	return m?.[1] || null
}

const publicType = db.getType().getProperty('public')?.getTypeAtLocation(sf)
const tablesType = publicType?.getProperty('Tables')?.getTypeAtLocation(sf)
const enumsType = publicType?.getProperty('Enums')?.getTypeAtLocation(sf)
if (!tablesType) { console.error('❌ Database["public"]["Tables"] not found'); process.exit(1) }

const enumMap = {} // enumName -> Pascal + values exist? (for name resolution)
if (enumsType) {
	for (const e of enumsType.getProperties()) {
		const name = e.getName()
		const pascal = name.replace(/(^|[_-]\w)/g, m => m.replace(/[_-]/,'').toUpperCase())
		enumMap[name] = { pascal }
	}
}

const guessFieldType = (tStr) => {
	const t = String(tStr).toLowerCase().replace(/"/g, "'")
	if (t.includes("database['public']['enums']")) return 'enum'
	if (t.includes('uuid')) return 'uuid'
	if (t.includes('timestamp') || t.includes('date')) return 'timestamp'
	if (t.includes('boolean') || t.includes('bool')) return 'boolean'
	if (t.includes('number') || t.includes('int') || t.includes('numeric') || t.includes('float') || t.includes('double')) return 'number'
	if (t.includes('json')) return 'json'
	if (t.includes('string') || t.includes('text') || t.includes('varchar') || t.includes('char')) return 'string'
	return 'unknown'
}

const readTpl = () => fs.readFileSync(tplPath, 'utf8')
const linesBarrel = []

for (const prop of tablesType.getProperties()) {
	const table = prop.getName()
	const pascal = table.replace(/(^|[_-]\w)/g, m => m.replace(/[_-]/,'').toUpperCase())
	const rowName = `${pascal}Row`

	const tableType = prop.getTypeAtLocation(sf)
	const rowProp = tableType.getProperty('Row')
	const insProp = tableType.getProperty('Insert')
	const relProp = tableType.getProperty('Relationships')

	if (!rowProp || !insProp) continue

	const rowType = rowProp.getTypeAtLocation(sf)
	const insertType = insProp.getTypeAtLocation(sf)

	// relationships: array of literal objects; we’ll build a per-column map
	let relationsByColumn = {}
	if (relProp) {
		const relType = relProp.getTypeAtLocation(sf)
		const arrTypes = relType.isArray() ? [relType.getArrayElementTypeOrThrow()] : relType.isUnion() ? relType.getUnionTypes() : []
		for (const t of arrTypes) {
			// we expect properties like 'foreignKeyName', 'columns', 'referencedRelation', 'referencedColumns'
			const fkName = t.getProperty('foreignKeyName')?.getTypeAtLocation(sf).getLiteralValue?.()
			const cols = t.getProperty('columns')?.getTypeAtLocation(sf).getText() // like '["profile_id"]'
			const refRel = t.getProperty('referencedRelation')?.getTypeAtLocation(sf).getLiteralValue?.()
			const refCols = t.getProperty('referencedColumns')?.getTypeAtLocation(sf).getText()

			// quick parse arrays from type text when literals
			const parseArr = (txt) => {
				const m = String(txt || '').match(/\["([^"]*)"\]/g) || []
				const out = []
				for (const seg of m) {
					const s = seg.match(/\["([^"]*)"\]/)?.[1]
					if (s) out.push(s)
				}
				return out.length ? out : null
			}
			const colList = parseArr(cols) || []
			const refColList = parseArr(refCols) || ['id']

			for (const c of colList) {
				relationsByColumn[c] = {
					table: refRel || null,
					column: refColList[0] || 'id',
					fk: fkName || null
				}
			}
		}
	}

	const schemaFields = []

	for (const p of rowType.getProperties()) {
		const name = p.getName()
		const rowT = p.getTypeAtLocation(sf)
		const rowTText = rowT.getText()

		// required? from Insert optionality
		const insertProp = insertType.getProperty(name)
		let required = true
		if (!insertProp) {
			// if it's absent in Insert, it's likely auto/readonly (id/created_at)
			required = false
		} else {
			const d = insertProp.getDeclarations()?.[0]
			const isOptional = d?.hasQuestionToken?.() ?? false
			required = !isOptional
		}

		// detect enum
		let enumAttach = ''
		const enumName = extractEnumName(rowTText)
		if (enumName && enumMap[enumName]) {
			enumAttach = `, enum: Enums.${enumMap[enumName].pascal}Values`
		}

		// type guess
		const kind = guessFieldType(rowTText)

		// pk/readonly heuristics
		const pk = name === 'id'
		const readonly = pk || name === 'created_at' || name === 'inserted_at' || name === 'updated_at'

		// relation (if any)
		const rel = relationsByColumn[name]
			? `, relation: { table: '${relationsByColumn[name].table}', column: '${relationsByColumn[name].column}', fk: '${relationsByColumn[name].fk}' }`
			: ``

		schemaFields.push(
			`\t${name}: { type: '${kind}', required: ${required}${pk ? ', pk: true' : ''}${readonly ? ', readonly: true' : ''}${enumAttach}${rel} },`
		)
	}

	let code = readTpl()
	code = code
		.replace(/__TABLE__/g, table)
		.replace(/__PASCAL__/g, pascal)
		.replace(/__ROW__/g, rowName)
		.replace('// __FIELDS__', schemaFields.join('\n'))

	const outFile = path.join(outDir, `${table}.ts`)
	fs.writeFileSync(outFile, code, 'utf8')
	linesBarrel.push(`export * from './${path.basename(outFile, '.ts')}' // ${pascal}Schema`)
	console.log('✅ schema:', path.relative(cwd, outFile))
}

fs.writeFileSync(barrel, linesBarrel.join('\n') + '\n', 'utf8')
console.log('✅ schemas barrel:', path.relative(cwd, barrel))
