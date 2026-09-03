import path from 'node:path'
import { exists, readText } from './io.js'

export function loadDatabaseMetadata(currentWorkingDirectory, config) {
	const configuredPath = config?.paths?.metadata
	if (!configuredPath) return null
	const metadataPath = path.resolve(currentWorkingDirectory, configuredPath)
	if (!exists(metadataPath)) return null

	const metadata = JSON.parse(readText(metadataPath))
	if (metadata?.version !== 1 || !metadata.tables || typeof metadata.tables !== 'object') {
		throw new Error(`[nsdb] Invalid database metadata file: ${metadataPath}`)
	}
	return metadata
}

export function getTableMetadata(metadata, tableName) {
	return metadata?.tables?.[tableName] ?? null
}
