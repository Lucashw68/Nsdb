#!/usr/bin/env node
import path from 'path'
import { exists } from '../helpers/io.js'
import { parseArgs } from '../helpers/args.js'
import { createTsProject, addSourceFile, loadDatabaseAlias, getPublicEnumsType } from '../helpers/ts.js'
import { writeText, ensureDir } from '../helpers/io.js'
import { toPascal } from '../helpers/names.js'

function toPascalCase(s) {
	return toPascal(s)
}

function extractEnumDescriptors(sourceFile, enumsType) {
	const properties = enumsType.getProperties()
	return properties.map((prop) => {
		const enumName = prop.getName()
		const pascalName = toPascalCase(enumName)
		const t = prop.getTypeAtLocation(sourceFile)
		const union = t.isUnion() ? t.getUnionTypes() : []
		const literals = union
			.map(u => typeof u.getLiteralValue === 'function' ? u.getLiteralValue() : undefined)
			.filter(v => typeof v === 'string')
		return { enumName, pascalName, literalValues: literals }
	})
}

function buildContent(databaseImportPath, descriptors) {
	const header = [
		`// ⚠️ auto-generated`,
		`// Source: Database["public"]["Enums"]`,
		`// ${new Date().toISOString()}`,
		``,
		`import type { Database } from '${databaseImportPath}'`,
		``,
	].join('\n')

	const blocks = descriptors.flatMap(d => ([
		`// Enum: ${d.enumName}`,
		`export type ${d.pascalName} = Database['public']['Enums']['${d.enumName}']`,
		d.literalValues.length
			? `export const ${d.pascalName}Values = ${JSON.stringify(d.literalValues)} as const`
			: `export const ${d.pascalName}Values = [] as const`,
		``,
	]))

	const map = [
		`export const Enums = {`,
		...descriptors.map(d => `\t'${d.enumName}': ${d.pascalName}Values`),
		`} as const`,
		``,
	].join('\n')

	return [header, ...blocks, map].join('\n')
}

function main() {
	const { get } = parseArgs()
	const cwd = process.cwd()
	const typesPath = path.resolve(cwd, get('types', 'types/database.types.ts'))
	const outFile = path.resolve(cwd, get('out', 'nsdb/enums.ts'))
	const dbImport = get('db-import-path', '~/types/database.types')

	if (!exists(typesPath)) {
		console.error(`❌ Missing types file: ${typesPath}`)
		process.exit(1)
	}

	const project = createTsProject()
	const sf = addSourceFile(project, typesPath)
	const db = loadDatabaseAlias(sf)
	if (!db) {
		console.error(`❌ Type alias "Database" not found in ${typesPath}`)
		process.exit(1)
	}
	const enumsType = getPublicEnumsType(db)
	if (!enumsType) {
		console.warn(`⚠️ No Database["public"]["Enums"] — writing empty file`)
		ensureDir(path.dirname(outFile))
		writeText(outFile, `// auto-generated\nexport {}\n`)
		console.log(`✅ enums: ${path.relative(cwd, outFile)}`)
		return
	}

	const descriptors = extractEnumDescriptors(sf, enumsType)
	const content = buildContent(dbImport, descriptors)
	writeText(outFile, content)
	console.log(`✅ enums: ${path.relative(cwd, outFile)} — ${descriptors.length} enum(s)`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
