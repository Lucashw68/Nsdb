#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { Project } from 'ts-morph'

const cwd = process.cwd()
const typesPath = path.resolve(cwd, 'types/database.types.ts')
const outFile = path.resolve(cwd, 'nsdb/enums.ts')

if (!fs.existsSync(typesPath)) {
	console.error(`❌ Missing ${typesPath}`)
	process.exit(1)
}

const project = new Project({ skipAddingFilesFromTsConfig: true })
const sf = project.addSourceFileAtPath(typesPath)

let db
try { db = sf.getTypeAliasOrThrow('Database') }
catch { console.error('❌ Type alias "Database" not found'); process.exit(1) }

const publicType = db.getType().getProperty('public')?.getTypeAtLocation(sf)
const enumsType = publicType?.getProperty('Enums')?.getTypeAtLocation(sf)
if (!enumsType) {
	console.warn('⚠️ No Database["public"]["Enums"] found — writing empty enums.ts')
	fs.mkdirSync(path.dirname(outFile), { recursive: true })
	fs.writeFileSync(outFile, `// auto-generated\nexport {}\n`, 'utf8')
	process.exit(0)
}

const entries = enumsType.getProperties()

const lines = [
	`// auto-generated from Supabase enums`,
	`import type { Database } from '~/types/database.types'`,
	``,
]

const mapEntries = []

for (const prop of entries) {
	const enumName = prop.getName() // e.g., 'my_enum'
	const pascal = enumName.replace(/(^|[_-]\w)/g, m => m.replace(/[_-]/,'').toUpperCase())
	const typeText = prop.getTypeAtLocation(sf).getText()

	// try to get literal values from union
	const type = prop.getTypeAtLocation(sf)
	const union = type.isUnion() ? type.getUnionTypes() : []
	const values = union
		.map(t => t.getLiteralValue?.())
		.filter(v => typeof v === 'string')

	lines.push(
		`export type ${pascal} = Database['public']['Enums']['${enumName}']`,
		values.length
			? `export const ${pascal}Values = ${JSON.stringify(values)} as const`
			: `export const ${pascal}Values = [] as const`,
		``
	)
	mapEntries.push(`\t'${enumName}': ${pascal}Values`)
}

lines.push(
	`export const Enums = {`,
	mapEntries.join(',\n'),
	`} as const`,
	``
)

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, lines.join('\n'), 'utf8')
console.log(`✅ enums: ${path.relative(cwd, outFile)}`)
