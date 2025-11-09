#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { Project } from 'ts-morph'

const cwd 			= process.cwd()
const typesPath   	= path.resolve(cwd, 'types/database.types.ts')
const modelsDir   	= path.resolve(cwd, 'nsdb/models')
const modelsBarrel	= path.resolve(cwd, 'nsdb/models.ts')
const schemasDir  	= path.resolve(cwd, 'nsdb/schemas')
const schemasBarrel = path.resolve(cwd, 'nsdb/schemas.ts')

// adjust these paths if you ship templates from your module
const tplModelPath  = path.resolve(cwd, 'node_modules/@lucashw68/nsdb/templates/model.tpl.ts')
const tplSchemaPath = path.resolve(cwd, 'node_modules/@lucashw68/nsdb/templates/schema.tpl.ts')

if (!fs.existsSync(typesPath)) {
	console.error(`❌ Missing: ${typesPath}`); process.exit(1)
}

const project = new Project({ skipAddingFilesFromTsConfig: true })
const sf = project.addSourceFileAtPath(typesPath)

let db
try { db = sf.getTypeAliasOrThrow('Database') }
catch { console.error(`❌ Type alias "Database" not found in ${typesPath}`); process.exit(1) }

const publicType = db.getType().getProperty('public')?.getTypeAtLocation(db)
const tablesType = publicType?.getProperty('Tables')?.getTypeAtLocation(db)
if (!tablesType) { console.error('❌ Cannot find Database["public"]["Tables"]'); process.exit(1) }

const tables 	= tablesType.getProperties().map(p => p.getName())
const tplModel  = fs.readFileSync(tplModelPath, 'utf8')
const tplSchema = fs.readFileSync(tplSchemaPath, 'utf8')

fs.mkdirSync(modelsDir, { recursive: true })
fs.mkdirSync(schemasDir, { recursive: true })

const toPascal = s => s.replace(/(^|[_-]\w)/g, m => m.replace(/[_-]/,'').toUpperCase())
const singular = s => s.endsWith('s') ? s.slice(0, -1) : s

const modelExports = []
const schemaExports = []

for (const table of tables) {
	const pascal = toPascal(table)
	const row = `${pascal}Row`

	// If a store exists, we wire it; otherwise API mode only
	const storeName = `use${toPascal(singular(table))}Store`
	const storePath = `~/stores/use${toPascal(singular(table))}Store`
	const storeExists = fs.existsSync(path.resolve(cwd, `stores/use${toPascal(singular(table))}Store.ts`))

	// ---- schema file
	const schemaCode = tplSchema
		.replace(/__TABLE__/g, table)
		.replace(/__PASCAL__/g, pascal)
		.replace(/__ROW__/g, row)

	fs.writeFileSync(path.join(schemasDir, `${table}.ts`), schemaCode, 'utf8')
	schemaExports.push(`export * from './schemas/${table}' // ${pascal}Schema`)

	// ---- model module
	const modelCode = tplModel
		.replace(/__TABLE__/g, table)
		.replace(/__PASCAL__/g, pascal)
		.replace(/__ROW__/g, row)
		.replace(/__STORE_IMPORT__/g, storeExists ? `import { ${storeName} } from '${storePath}'` : '')
		.replace(/__STORE_CREATOR__/g, storeExists ? `(() => ${storeName}())` : `undefined`)

	fs.writeFileSync(path.join(modelsDir, `${table}.ts`), modelCode, 'utf8')
	modelExports.push(`export * from './models/${table}' // use${pascal}, ${pascal}Schema`)
}

// barrels
fs.writeFileSync(modelsBarrel, modelExports.join('\n') + '\n', 'utf8')
fs.writeFileSync(schemasBarrel, schemaExports.join('\n') + '\n', 'utf8')

console.log(`✅ Generated ${tables.length} model modules in nsdb/models/ and schemas in nsdb/schemas/`)
