// helpers/ts.js
import { Project } from 'ts-morph'

export function createTsProject() {
	// Supabase's Row/Insert distinction depends on preserving `null` in unions.
	// The in-memory generator project must not inherit TypeScript's loose default.
	return new Project({
		skipAddingFilesFromTsConfig: true,
		compilerOptions: { strictNullChecks: true },
	})
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
