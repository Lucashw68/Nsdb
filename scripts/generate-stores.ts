import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Project } from 'ts-morph'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const modelsPath = path.resolve(__dirname, '../stores/entities/models.ts')
const outputDir = path.resolve(__dirname, '../stores/entities')

const project = new Project({
	tsConfigFilePath: path.resolve(__dirname, '../tsconfig.json'),
	skipAddingFilesFromTsConfig: true
})

const sourceFile = project.addSourceFileAtPath(modelsPath)

const modelMapVar = sourceFile.getVariableDeclarationOrThrow('modelMap')
const modelMap = modelMapVar.getInitializerIfKindOrThrow(
	tsm => tsm.isObjectLiteralExpression()
)

const entries = modelMap.getProperties().map(prop => {
	const name = prop.getName().replace(/['"]/g, '')
	const storeName = prop.getInitializerOrThrow().getText().replace(/['"]/g, '')
	return { name, storeName }
})

entries.forEach(({ name, storeName }) => {
	const composableName = `use${capitalize(name)}Store`
	const fileName = `${composableName}.ts`
	const filePath = path.resolve(outputDir, fileName)

	// Ne pas écraser un store existant
	if (fs.existsSync(filePath)) {
		console.log(`⚠️  ${fileName} existe déjà, ignoré.`)
		return
	}

	const content = `import { createDbStore } from '@/stores/createDbStore'
import type { Tables } from '@/types/database.types'

type ${capitalize(name)} = Tables<'${name}'>

const baseStore = createDbStore<${capitalize(name)}>('${name}', {
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

function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1)
}
