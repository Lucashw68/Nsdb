#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { Project } from 'ts-morph'
import { toPascal, singular, modelHookName, storeName } from './helpers/names.js'

const cwd = process.cwd()
const typesPath = path.resolve(cwd, 'types/database.types.ts')
const outDir = path.resolve(cwd, 'nsdb/models')
const barrel = path.join(outDir, 'index.ts')
const tplPath = path.resolve(cwd, 'node_modules/@lucashw68/nsdb/templates/model.tpl.ts')

if (!fs.existsSync(typesPath)) {
	console.error(`❌ Missing: ${typesPath}`); process.exit(1)
}
if (!fs.existsSync(tplPath)) {
	console.error(`❌ Missing template: ${tplPath}`); process.exit(1)
}
fs.mkdirSync(outDir, { recursive: true })

const project = new Project({ skipAddingFilesFromTsConfig: true })
const sf = project.addSourceFileAtPath(typesPath)

let db
try { db = sf.getTypeAliasOrThrow('Database') }
catch { console.error('❌ "Database" type not found'); process.exit(1) }

const publicType = db.getType().getProperty('public')?.getTypeAtLocation(db)
const tablesType = publicType?.getProperty('Tables')?.getTypeAtLocation(db)
if (!tablesType) { console.error('❌ Database["public"]["Tables"] missing'); process.exit(1) }

const tables = tablesType.getProperties().map(p => p.getName())
const tpl = fs.readFileSync(tplPath, 'utf8')

const lines = []

for (const table of tables) {
	const pascal = toPascal(table)
	const row = `${pascal}Row`
	const hook = modelHookName(table) // e.g., useProfiles
	const storeC = storeName(table)   // e.g., useProfileStore
	const storeFile = `stores/${storeC}.ts`
	const storeExists = fs.existsSync(path.resolve(cwd, storeFile))

	const code = tpl
		.replace(/__TABLE__/g, table)
		.replace(/__PASCAL__/g, pascal)
		.replace(/__ROW__/g, row)
		.replace(/__HOOK__/g, hook)
		.replace(/__STORE_IMPORT__/g, storeExists ? `import { ${storeC} } from '~/stores/${storeC}'` : '')
		.replace(/__STORE_CREATOR__/g, storeExists ? `(() => ${storeC}())` : `undefined`)

	const file = path.join(outDir, `${table}.ts`)
	fs.writeFileSync(file, code, 'utf8')
	lines.push(`export * from './${path.basename(file, '.ts')}' // ${hook}`)
	console.log('✅ model:', path.relative(cwd, file))
}

fs.writeFileSync(barrel, lines.join('\n') + '\n', 'utf8')
console.log('✅ models barrel:', path.relative(cwd, barrel))
