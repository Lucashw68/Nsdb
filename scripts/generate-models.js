#!/usr/bin/env node
import path from 'path'
import { parseArgs } from '../helpers/args.js'
import { exists, readText, writeText, ensureDir } from '../helpers/io.js'
import { createTsProject, addSourceFile, loadDatabaseAlias, getPublicTablesType } from '../helpers/ts.js'
import { toPascal, modelHookName, storeName } from '../helpers/names.js'

function buildModelCode(tableName, tpl, cwd) {
	const pascal = toPascal(tableName)
	const row = `${pascal}Row`
	const hook = modelHookName(tableName)
	const storeClass = storeName(tableName)
	const storeFileRel = `stores/${storeClass}.ts`
	const storeAbs = path.resolve(cwd, storeFileRel)
	const hasStore = exists(storeAbs)

	const code = tpl
		.replace(/__TABLE__/g, tableName)
		.replace(/__PASCAL__/g, pascal)
		.replace(/__ROW__/g, row)
		.replace(/__HOOK__/g, hook)
		.replace(/__STORE_IMPORT__/g, hasStore ? `import { ${storeClass} } from '~/stores/${storeClass}'` : '')
		.replace(/__STORE_CREATOR__/g, hasStore ? `(() => ${storeClass}())` : `undefined`)

	return { code, hook }
}

function main() {
	const { get } = parseArgs()
	const cwd = process.cwd()
	const typesPath = path.resolve(cwd, get('types', 'types/database.types.ts'))
	const outDir = path.resolve(cwd, get('outDir', 'nsdb/models'))
	const barrel = path.join(outDir, 'index.ts')
	const templatePath = path.resolve(cwd, get('template', 'node_modules/@lucashw68/nsdb/templates/model.template.ts'))

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

	for (const prop of tablesType.getProperties()) {
		const table = prop.getName()
		const { code, hook } = buildModelCode(table, tpl, cwd)
		const file = path.join(outDir, `${table}.ts`)
		writeText(file, code)
		console.log('✅ model:', path.relative(cwd, file))
		exports.push(`export * from './${table}' // ${hook}`)
	}

	writeText(barrel, exports.join('\n') + '\n')
	console.log('✅ models barrel:', path.relative(cwd, barrel))
}

if (import.meta.url === `file://${process.argv[1]}`) main()
