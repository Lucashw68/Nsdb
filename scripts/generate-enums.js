#!/usr/bin/env node
import path from 'path'
import { exists, ensureDir, writeText } from '../helpers/io.js'
import { parseArgs } from '../helpers/args.js'
import { getOption, loadNsdbConfig } from '../helpers/config.js'
import {
	createTsProject,
	addSourceFile,
	loadDatabaseAlias,
	getPublicEnumsType
} from '../helpers/ts.js'
import { toPascal } from '../helpers/names.js'

/**
 * Build the metadata needed to emit strongly typed enums derived from Database["public"]["Enums"].
 */
function extractEnumDescriptors(sourceFile, enumsType) {
	const enumProperties = enumsType.getProperties()
	return enumProperties.map((enumProperty) => {
		const enumName = enumProperty.getName()
		const pascalName = toPascal(enumName)
		const enumType = enumProperty.getTypeAtLocation(sourceFile)
		const unionMembers = enumType.isUnion() ? enumType.getUnionTypes() : []
		const literalValues = unionMembers
			.map((unionMember) => (
				typeof unionMember.getLiteralValue === 'function'
					? unionMember.getLiteralValue()
					: undefined
			))
			.filter((literalValue) => typeof literalValue === 'string')

		return { enumName, pascalName, literalValues }
	})
}

function buildContent(databaseImportPath, descriptors) {
	const headerLines = [
		`// ⚠️ auto-generated`,
		`// Source: Database["public"]["Enums"]`,
		`// ${new Date().toISOString()}`,
		``,
		`import type { Database } from '${databaseImportPath}'`,
		``,
	]

	const enumBlocks = descriptors.flatMap((descriptor) => ([
		`// Enum: ${descriptor.enumName}`,
		`export type ${descriptor.pascalName} = Database['public']['Enums']['${descriptor.enumName}']`,
		descriptor.literalValues.length
			? `export const ${descriptor.pascalName}Values = ${JSON.stringify(descriptor.literalValues)} as const`
			: `export const ${descriptor.pascalName}Values = [] as const`,
		``,
	]))

	const enumMapLines = [
		`export const Enums = {`,
		...descriptors.map((descriptor) => `\t'${descriptor.enumName}': ${descriptor.pascalName}Values`),
		`} as const`,
		``,
	]

	return [...headerLines, ...enumBlocks, ...enumMapLines].join('\n')
}

async function main() {
	const parsedArguments = parseArgs()
	const currentWorkingDirectory = process.cwd()
	const { config } = await loadNsdbConfig(currentWorkingDirectory, parsedArguments.get('config', ''))
	const typesFilePath = path.resolve(currentWorkingDirectory, getOption(parsedArguments, config, 'types', 'paths.types'))
	const outputFilePath = path.resolve(currentWorkingDirectory, getOption(parsedArguments, config, 'out', 'paths.enums'))
	const databaseImportPath = getOption(parsedArguments, config, 'db-import-path', 'imports.databaseTypes')

	if (!exists(typesFilePath)) {
		console.error(`❌ Missing types file: ${typesFilePath}`)
		process.exit(1)
	}

	const project = createTsProject()
	const sourceFile = addSourceFile(project, typesFilePath)
	const databaseAlias = loadDatabaseAlias(sourceFile)
	if (!databaseAlias) {
		console.error(`❌ Type alias "Database" not found in ${typesFilePath}`)
		process.exit(1)
	}
	const enumsType = getPublicEnumsType(databaseAlias)
	if (!enumsType) {
		console.warn('⚠️ Database["public"]["Enums"] not found — writing an empty file.')
		ensureDir(path.dirname(outputFilePath))
		writeText(outputFilePath, `// auto-generated\nexport {}\n`)
		console.log(`✅ enums: ${path.relative(currentWorkingDirectory, outputFilePath)}`)
		return
	}

	const descriptors = extractEnumDescriptors(sourceFile, enumsType)
	const fileContent = buildContent(databaseImportPath, descriptors)
	writeText(outputFilePath, fileContent)
	console.log(`✅ enums: ${path.relative(currentWorkingDirectory, outputFilePath)} — ${descriptors.length} enum(s)`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error('❌ Unexpected error while generating enums.')
		console.error(error)
		process.exit(1)
	})
}
