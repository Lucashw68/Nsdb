#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Project } from 'ts-morph'

const cwd = process.cwd()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const typesPath = path.resolve(cwd, 'types/database.types.ts')

const nsdbDir = path.resolve(cwd, 'nsdb')
if (!existsSync(nsdbDir)) {
	mkdirSync(nsdbDir, { recursive: true })
}
const outputPath = path.join(nsdbDir, 'models.ts')
const tsconfigPath = path.resolve(cwd, 'tsconfig.json')

if (!fs.existsSync(typesPath)) {
	console.error(`❌ Fichier introuvable : ${typesPath}`)
	process.exit(1)
}
if (!fs.existsSync(tsconfigPath)) {
	console.error(`❌ tsconfig.json introuvable à la racine du projet.`)
	process.exit(1)
}

const project = new Project({
	tsConfigFilePath: tsconfigPath,
	skipAddingFilesFromTsConfig: true
})

const sourceFile = project.addSourceFileAtPath(typesPath)

let dbType
try {
	dbType = sourceFile.getTypeAliasOrThrow('Database')
} catch (err) {
	console.error(`❌ Type alias "Database" introuvable dans ${typesPath}`)
	process.exit(1)
}

const publicType = dbType.getType().getProperty('public')?.getTypeAtLocation(dbType)
const tablesType = publicType?.getProperty('Tables')?.getTypeAtLocation(dbType)

if (!tablesType) {
	console.error('❌ Impossible de trouver Database["public"]["Tables"]')
	process.exit(1)
}

const tableNames = tablesType.getProperties().map(p => p.getName())

// Génération des imports
const imports =
	tableNames
		.map(name => {
			const composableName = `use${capitalize(singular(name))}Store`
			return `import { ${composableName} } from './use${capitalize(singular(name))}Store'`
		})
		.join('\n') + '\n\n'

// Interface ModelTypes
const modelTypes =
	`import type { Tables } from '~/types/database.types'\n\n` +
	'export interface ModelTypes {\n' +
	tableNames.map(name => `  ${name}: Tables<'${name}'>`).join('\n') +
	'\n}\n\n'

// modelMap
const modelMap =
	'export const modelMap = {\n' +
	tableNames
		.map(name => `  ${name}: ${`use${capitalize(singular(name))}Store`}`)
		.join(',\n') +
	'\n} as const\n'

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, imports + modelTypes + modelMap)

console.log(`✅ Fichier models.ts généré avec ${tableNames.length} tables.`)

// Helpers
function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1)
}

function singular(str) {
	return str.endsWith('s') ? str.slice(0, -1) : str
}
