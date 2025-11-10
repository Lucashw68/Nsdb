#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { Project } from 'ts-morph'
import { fileURLToPath } from 'url'
import { toPascal } from './helpers/names.js'

const cwd = process.cwd()
const typesPath = path.resolve(cwd, 'types/database.types.ts')
const outDir = path.resolve(cwd, 'nsdb/schemas')
const barrel = path.join(outDir, 'index.ts')
const tplPath = path.resolve(cwd, 'node_modules/@lucashw68/nsdb/templates/schema.tpl.ts')

if (!fs.existsSync(typesPath)) {
	console.error(`❌ Missing ${typesPath}`); process.exit(1)
}
if (!fs.existsSync(tplPath)) {
	console.error(`❌ Missing template ${tplPath}`); process.exit(1)
}
fs.mkdirSync(outDir, { recursive: true })

const project = new Project({ skipAddingFilesFromTsConfig: true })
const sf = project.addSourceFileAtPath(typesPath)

let db
try { db = sf.getTypeAliasOrThrow('Database') }
catch { console.error('❌ Type alias "Database" not found'); process.exit(1) }

const publicType = db.getType().getProperty('public')?.getTypeAtLocation(db)
const tablesType = publicType?.getProperty('Tables')?.getTypeAtLocation(db)
if (!tablesType) { console.error('❌ Database["public"]["Tables"] not found'); process.exit(1) }

const tables = tablesType.getProperties()

// map TS type → EntityField.type
const guessFieldType = (tStr) => {
	const t = String(tStr).toLowerCase()
	if (t.includes('uuid')) return 'uuid'
	if (t.includes('timestamp') || t.includes('date')) return 'timestamp'
	if (t.includes('boolean') || t.includes('bool')) return 'boolean'
	if (t.includes('number') || t.includes('int') || t.includes('numeric') || t.includes('float') || t.includes('double')) return 'number'
	if (t.includes('json')) return 'json'
	// supabase text/varchar
	if (t.includes('string') || t.includes('text') || t.includes('varchar') || t.includes('char')) return 'string'
	return 'unknown'
}

const readTemplate = () => fs.readFileSync(tplPath, 'utf8')

const barrelLines = []

for (const prop of tables) {
	const table = prop.getName()
	const pascal = toPascal(table)
	const row = `${pascal}Row`

	// columns: Database['public']['Tables'][table]['Row']
	const tableType = prop.getTypeAtLocation(sf)
	const rowProp = tableType.getProperty('Row')
	if (!rowProp) continue
	const rowType = rowProp.getTypeAtLocation(sf)

	// collect fields
	const fields = rowType.getProperties().map(p => {
		const name = p.getName()
		const t = p.getTypeAtLocation(sf).getText()
		return { name, t, kind: guessFieldType(t) }
	})

	// build schema object literal
	const schemaLines = fields.map(({ name, kind }) => {
		// heuristic for id/readonly/default
		const pk = name === 'id'
		const readonly = pk || name === 'created_at' || name === 'inserted_at'
		const required = !name.endsWith('?') // not reliable here; leave false by default
		const base = [`type: '${kind}'`]
		if (pk) base.push('pk: true')
		if (readonly) base.push('readonly: true')
		// you can enrich further: label, min/max, enum, etc.
		return `\t${name}: { ${base.join(', ')} },`
	}).join('\n')

	let code = readTemplate()
	code = code
		.replace(/__TABLE__/g, table)
		.replace(/__PASCAL__/g, pascal)
		.replace(/__ROW__/g, row)
		.replace('// __FIELDS__', schemaLines || '\t// (no columns detected)')

	const file = path.join(outDir, `${table}.ts`)
	fs.writeFileSync(file, code, 'utf8')
	barrelLines.push(`export * from './${table}' // ${pascal}Schema`)
	console.log('✅ schema:', path.relative(cwd, file))
}

fs.writeFileSync(barrel, barrelLines.join('\n') + '\n', 'utf8')
console.log('✅ schemas barrel:', path.relative(cwd, barrel))
