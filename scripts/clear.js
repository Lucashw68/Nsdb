#!/usr/bin/env node
import path from 'path'
import { parseArgs } from '../helpers/args.js'
import { removeDirIfExists, removeFileIfExists, listFiles } from '../helpers/io.js'

function main() {
	const { getBool } = parseArgs()
	const verboseOutput = getBool('verbose', false)
	const shouldDeleteStores = !getBool('no-stores', false)

	const currentWorkingDirectory = process.cwd()
	const nsdbDirectoryPath = path.resolve(currentWorkingDirectory, 'nsdb')
	const storesDirectoryPath = path.resolve(currentWorkingDirectory, 'stores')
	const legacyModelsFilePath = path.resolve(nsdbDirectoryPath, 'models.ts')

	let removedAnyFile = false
	const deletedStoreFiles = []

	removedAnyFile = removeDirIfExists(nsdbDirectoryPath, verboseOutput) || removedAnyFile
	removedAnyFile = removeFileIfExists(legacyModelsFilePath, verboseOutput) || removedAnyFile

	if (shouldDeleteStores) {
		for (const fileName of listFiles(storesDirectoryPath)) {
			if (fileName.startsWith('use') && fileName.endsWith('Store.ts')) {
				const storeFilePath = path.join(storesDirectoryPath, fileName)
				if (removeFileIfExists(storeFilePath, verboseOutput)) {
					deletedStoreFiles.push(fileName)
					removedAnyFile = true
				}
			}
		}
	}

	if (removedAnyFile) {
		console.log('✅ Cleanup completed.')
		if (deletedStoreFiles.length && !verboseOutput) {
			console.log(`🗑️  Removed ${deletedStoreFiles.length} generated store file(s).`)
		}
	} else {
		console.log('✅ Nothing to clean, generated files already removed.')
	}
}

if (import.meta.url === `file://${process.argv[1]}`) main()
