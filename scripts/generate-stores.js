#!/usr/bin/env node
import path from 'path'
import { parseArgs } from '../helpers/args.js'
import { getBoolOption, getOption, loadNsdbConfig } from '../helpers/config.js'
import { exists, listFiles, writeText, ensureDir } from '../helpers/io.js'
import { toPascal, storeName } from '../helpers/names.js'
import { markGenerated, removeStaleGeneratedFiles } from '../helpers/generated.js'
import { isNsdbGeneratedFile } from '../helpers/generated.js'
import { getTableMetadata, loadDatabaseMetadata } from '../helpers/metadata.js'

function loadTableNames(modelsDirectoryPath) {
	if (!exists(modelsDirectoryPath)) {
		console.error(`❌ Missing models directory: ${modelsDirectoryPath}`)
		process.exit(1)
	}

	const entries = listFiles(modelsDirectoryPath)
	return entries
		.filter((entry) => entry.endsWith('.ts') && entry !== 'index.ts')
		.filter((entry) => isNsdbGeneratedFile(path.join(modelsDirectoryPath, entry)))
		.map((entry) => entry.replace(/\.ts$/, ''))
		.sort()
}

function renderStoreFile({ tableName, storeIdentifier, rowTypeName, typesImportPath, primaryKey }) {
	return `import { createDbStore } from '@lucashw68/nsdb/createDbStore'
import type { Tables } from '${typesImportPath}'

type ${rowTypeName} = Tables<'${tableName}'>

export const ${storeIdentifier} = createDbStore<${rowTypeName}>('${tableName}', {
	key: '${primaryKey}',
	orderBy: '${primaryKey}',
	defaultSort: 'desc',
})
`
}

export async function main() {
	const parsedArguments = parseArgs()
	const currentWorkingDirectory = process.cwd()
	const { config } = await loadNsdbConfig(currentWorkingDirectory, parsedArguments.get('config', ''))
	const modelsDirectoryPath = path.resolve(currentWorkingDirectory, getOption(parsedArguments, config, 'models-dir', 'paths.models'))
	const storesDirectoryPath = path.resolve(currentWorkingDirectory, getOption(parsedArguments, config, 'stores-dir', 'paths.stores'))
	const typesImportPath = getOption(parsedArguments, config, 'types-import-path', 'imports.databaseTypes')
	const shouldOverwriteExisting = getBoolOption(parsedArguments, config, 'force', 'generators.force', false)
	const databaseMetadata = loadDatabaseMetadata(currentWorkingDirectory, config)

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
		const primaryKeyColumns = getTableMetadata(databaseMetadata, tableName)?.primaryKey ?? ['id']
		if (primaryKeyColumns.length !== 1) {
			throw new Error(`[nsdb] ${tableName} requires exactly one primary key for a generated store.`)
		}
		const primaryKey = primaryKeyColumns[0]
		const storeFilePath = path.join(storesDirectoryPath, `${storeIdentifier}.ts`)

		if (exists(storeFilePath) && !shouldOverwriteExisting) {
			console.log(`⚠️  ${path.relative(currentWorkingDirectory, storeFilePath)} already exists, skipping.`)
			continue
		}

		const fileContent = renderStoreFile({ tableName, storeIdentifier, rowTypeName, typesImportPath, primaryKey })
		writeText(storeFilePath, markGenerated(fileContent))
		console.log(`✅ store: ${path.relative(currentWorkingDirectory, storeFilePath)}`)
	}

	removeStaleGeneratedFiles(
		storesDirectoryPath,
		tableNames.map(tableName => `${storeName(tableName)}.ts`),
	)
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error('❌ Unexpected error while generating stores.')
		console.error(error)
		process.exit(1)
	})
}
