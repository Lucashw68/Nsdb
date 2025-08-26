#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Project, SyntaxKind } from 'ts-morph'

// Résolution depuis le projet utilisateur
const cwd = process.cwd()
const modelsPath = path.resolve(cwd, 'stores/entities/models.ts')
const outputDir = path.resolve(cwd, 'stores/entities')
const tsconfigPath = path.resolve(cwd, 'tsconfig.json')

if (!fs.existsSync(modelsPath)) {
	console.error(`❌ Fichier introuvable : ${modelsPath}`)
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

const sourceFile = project.addSourceFileAtPath(modelsPath)

let modelMapVar
try {
	modelMapVar = sourceFile.getVariableDeclarationOrThrow('modelMap')
} catch (err) {
	console.error('❌ Variable "modelMap" introuvable dans models.ts')
	process.exit(1)
}

const initializer = modelMapVar.getInitializer()

if (!initializer || !initializer.isAsExpression?.()) {
	console.error('❌ modelMap doit être un objet, avec ou sans "as const"')
	process.exit(1)
}

const objectLiteral = initializer.getExpression()

if (!objectLiteral || !objectLiteral.isObjectLiteralExpression()) {
	console.error('❌ modelMap n\'est pas un objet littéral valide')
	process.exit(1)
}

const entries = objectLiteral.getProperties().map(prop => {
	if (!prop.isPropertyAssignment()) return null

	const name = prop.getName().replace(/['"]/g, '')
	return { name }
}).filter(Boolean)

if (entries.length === 0) {
	console.error('❌ Aucun élément trouvé dans modelMap')
	process.exit(1)
}

entries.forEach(({ name }) => {
	const composableName = `use${capitalize(name)}Store`
	const fileName = `${composableName}.ts`
	const filePath = path.resolve(outputDir, fileName)

	if (fs.existsSync(filePath)) {
		console.log(`⚠️  ${fileName} existe déjà, ignoré.`)
		return
	}

	const typeName = capitalize(name)
	const content = `import { createDbStore } from '@/stores/createDbStore'
import type { Tables } from '@/types/database.types'

type ${typeName} = Tables<'${name}'>

const baseStore = createDbStore<${typeName}>('${name}', {
	key: 'id',
	orderBy: 'updated_at',
	defaultSort: 'desc',
})

export const ${composableName} = defineStore('${name}', () => {
	const store = baseStore()
	return { ...store }
})
`

	fs.writeFileSync(filePath, content)
	console.log(`✅ ${fileName} généré.`)
})

function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1)
}
