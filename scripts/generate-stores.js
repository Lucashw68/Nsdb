#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Project, SyntaxKind } from 'ts-morph'

// 📌 Résolution depuis le projet utilisateur
const cwd = process.cwd()
const modelsPath = path.resolve(cwd, 'stores/entities/models.ts')
const outputDir = path.resolve(cwd, 'stores/entities')

if (!fs.existsSync(modelsPath)) {
	console.error(`❌ Fichier introuvable : ${modelsPath}`)
	process.exit(1)
}

const tsconfigPath = path.resolve(cwd, 'tsconfig.json')
if (!fs.existsSync(tsconfigPath)) {
	console.error(`❌ tsconfig.json introuvable à la racine du projet.`)
	process.exit(1)
}

// ✅ Initialisation de ts-morph
const project = new Project({
	tsConfigFilePath: tsconfigPath,
	skipAddingFilesFromTsConfig: true
})

const sourceFile = project.addSourceFileAtPath(modelsPath)

// 🎯 Récupère l'initialiseur brut de modelMap
const modelMapVar = sourceFile.getVariableDeclarationOrThrow('modelMap')
const initializer = modelMapVar.getInitializer()

if (!initializer) {
	console.error('❌ modelMap n’a pas d\'initialiseur.')
	process.exit(1)
}

// 🧠 Supporte modelMap = { ... } ou modelMap = { ... } as const
let obj

if (initializer.getKind() === SyntaxKind.AsExpression) {
	obj = initializer.getExpression()
} else {
	obj = initializer
}

if (!obj || !obj.isObjectLiteralExpression()) {
	console.error('❌ modelMap doit être un objet, avec ou sans "as const"')
	process.exit(1)
}

const entries = obj.getProperties().map(prop => {
	const name = prop.getName().replace(/['"]/g, '')
	return { name }
})

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

// 🔤 Helpers
function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1)
}
