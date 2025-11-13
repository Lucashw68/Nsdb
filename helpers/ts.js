// helpers/ts.js
import { Project } from 'ts-morph'

export function createTsProject() {
	return new Project({ skipAddingFilesFromTsConfig: true })
}

export function addSourceFile(project, absPath) {
	return project.addSourceFileAtPath(absPath)
}

export function loadDatabaseAlias(sourceFile) {
	try {
		return sourceFile.getTypeAliasOrThrow('Database')
	} catch {
		return null
	}
}

export function getPublicEnumsType(databaseAlias) {
	const databaseType = databaseAlias.getType()
	const publicType = databaseType.getProperty('public')?.getTypeAtLocation(databaseAlias)
	if (!publicType) return null
	return publicType.getProperty('Enums')?.getTypeAtLocation(databaseAlias) ?? null
}

export function getPublicTablesType(databaseAlias) {
	const databaseType = databaseAlias.getType()
	const publicType = databaseType.getProperty('public')?.getTypeAtLocation(databaseAlias)
	if (!publicType) return null
	return publicType.getProperty('Tables')?.getTypeAtLocation(databaseAlias) ?? null
}
