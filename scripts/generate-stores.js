#!/usr/bin/env node
import path from 'path'
import { parseArgs } from '../helpers/args.js'
import { exists, listFiles, writeText, ensureDir } from '../helpers/io.js'
import { toPascal, storeName } from '../helpers/names.js'

function loadTableNames(modelsDirectoryPath) {
	if (!exists(modelsDirectoryPath)) {
		console.error(`❌ Missing models directory: ${modelsDirectoryPath}`)
		process.exit(1)
	}

	const entries = listFiles(modelsDirectoryPath)
	return entries
		.filter((entry) => entry.endsWith('.ts') && entry !== 'index.ts')
		.map((entry) => entry.replace(/\.ts$/, ''))
		.sort()
}

function renderStoreFile({ tableName, storeIdentifier, rowTypeName, typesImportPath }) {
	return `import { createDbStore } from '@lucashw68/nsdb/createDbStore'
import type { Tables } from '${typesImportPath}'

export type ${rowTypeName} = Tables<'${tableName}'>

export const ${storeIdentifier} = createDbStore<${rowTypeName}>('${tableName}', {
	key: 'id',
	orderBy: 'updated_at',
	defaultSort: 'desc',
})
`
}

function main() {
	const parsedArguments = parseArgs()
	const currentWorkingDirectory = process.cwd()
	const modelsDirectoryPath = path.resolve(currentWorkingDirectory, parsedArguments.get('models-dir', 'nsdb/models'))
	const storesDirectoryPath = path.resolve(currentWorkingDirectory, parsedArguments.get('stores-dir', 'stores'))
	const typesImportPath = parsedArguments.get('types-import-path', '~/types/database.types')
	const shouldOverwriteExisting = parsedArguments.getBool('force', false)

	const tableNames = loadTableNames(modelsDirectoryPath)
	if (!tableNames.length) {
		console.warn('⚠️ No model files found. Run generate:models first.')
		return
	}

	ensureDir(storesDirectoryPath)

	for (const tableName of tableNames) {
		const pascalName = toPascal(tableName)
		const rowTypeName = `${pascalName}Row`
		const storeIdentifier = storeName(tableName)
		const storeFilePath = path.join(storesDirectoryPath, `${storeIdentifier}.ts`)

		if (exists(storeFilePath) && !shouldOverwriteExisting) {
			console.log(`⚠️  ${path.relative(currentWorkingDirectory, storeFilePath)} already exists, skipping.`)
			continue
		}

		const fileContent = renderStoreFile({ tableName, storeIdentifier, rowTypeName, typesImportPath })
		writeText(storeFilePath, fileContent)
		console.log(`✅ store: ${path.relative(currentWorkingDirectory, storeFilePath)}`)
	}
}

if (import.meta.url === `file://${process.argv[1]}`) main()
