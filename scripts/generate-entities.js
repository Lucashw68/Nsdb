#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Project, SyntaxKind, Node } from 'ts-morph'

// 📍 Get current working directory
const cwd = process.cwd()

// 📄 Input: models.ts
const modelsPath = path.resolve(cwd, 'nsdb/models.ts')
// 📂 Output: entities/
const outputDir = path.resolve(cwd, 'nsdb/entities')

if (!fs.existsSync(modelsPath)) {
	console.error(`❌ Fichier introuvable : ${modelsPath}`)
	process.exit(1)
}

const tsconfigPath = path.resolve(cwd, 'tsconfig.json')
if (!fs.existsSync(tsconfigPath)) {
	console.error(`❌ tsconfig.json introuvable à la racine du projet.`)
	process.exit(1)
}

const project = new Project({
	tsConfigFilePath: tsconfigPath,
	skipAddingFilesFromTsConfig: true
})

const sourceFile = project.addSourceFileAtPath(modelsPath)
const modelMapVar = sourceFile.getVariableDeclarationOrThrow('modelMap')
const initializer = modelMapVar.getInitializer()

if (!initializer) {
	console.error('❌ modelMap n’a pas d\'initialiseur.')
	process.exit(1)
}

let obj
if (initializer.getKind() === SyntaxKind.AsExpression) {
	obj = initializer.getExpression()
} else {
	obj = initializer
}

if (!Node.isObjectLiteralExpression(obj)) {
	console.error('❌ modelMap doit être un objet littéral, avec ou sans "as const".')
	process.exit(1)
}

if (!fs.existsSync(outputDir)) {
	fs.mkdirSync(outputDir)
}

const entries = obj.getProperties().map(prop => {
	const name = prop.getName().replace(/['"]/g, '')
	return { name }
})

// 🧠 Template for each Entity file
const generateEntityFile = (name) => {
	const entityName = `${capitalize(name)}Entity`
	const typeName = capitalize(name)
	const fileName = `${entityName}.ts`
	const filePath = path.resolve(outputDir, fileName)

	if (fs.existsSync(filePath)) {
		console.log(`⚠️  ${fileName} existe déjà, ignoré.`)
		return
	}

	const content = `import type { Tables } from '~/types/database.types'
import type { EntityField } from './types'

type ${typeName} = Tables<'${name}'>

export const ${entityName}: Record<keyof ${typeName}, EntityField> = {
	// TODO: Fill with correct field metadata
} as const
`

	fs.writeFileSync(filePath, content)
	console.log(`✅ ${fileName} généré.`)
}

entries.forEach(({ name }) => generateEntityFile(name))

function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1)
}
