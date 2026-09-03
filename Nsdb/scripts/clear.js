#!/usr/bin/env node
import path from 'node:path'
import { parseArgs } from '../helpers/args.js'
import { loadNsdbConfig } from '../helpers/config.js'
import {
	isNsdbGeneratedFile,
	listGeneratedFiles,
	removeGeneratedFile,
} from '../helpers/generated.js'

function configuredTargets(currentWorkingDirectory, config, shouldDeleteStores) {
	const fileTargets = [config.paths.enums]
	const directoryTargets = [
		config.paths.schemas,
		config.paths.models,
		config.paths.composables,
	]

	if (shouldDeleteStores) directoryTargets.push(config.paths.stores)

	return {
		fileTargets: fileTargets.map(target => path.resolve(currentWorkingDirectory, target)),
		directoryTargets: [...new Set(directoryTargets.map(target => path.resolve(currentWorkingDirectory, target)))],
	}
}

export async function clearGeneratedFiles({
	currentWorkingDirectory = process.cwd(),
	parsedArguments = parseArgs(),
} = {}) {
	const verbose = parsedArguments.getBool('verbose', false)
	const dryRun = parsedArguments.getBool('dry-run', false)
	const shouldDeleteStores = !parsedArguments.getBool('no-stores', false)
	const { config } = await loadNsdbConfig(
		currentWorkingDirectory,
		parsedArguments.get('config', ''),
	)
	const targets = configuredTargets(currentWorkingDirectory, config, shouldDeleteStores)
	const candidates = [
		...targets.fileTargets.filter(isNsdbGeneratedFile),
		...targets.directoryTargets.flatMap(listGeneratedFiles),
	]
	const uniqueCandidates = [...new Set(candidates)]

	for (const filePath of uniqueCandidates) {
		removeGeneratedFile(filePath, { dryRun, verbose })
	}

	if (dryRun) {
		console.log(`Cleanup preview: ${uniqueCandidates.length} generated file(s) would be removed.`)
	} else {
		console.log(`Cleanup completed: ${uniqueCandidates.length} generated file(s) removed.`)
	}

	return uniqueCandidates
}

if (import.meta.url === `file://${process.argv[1]}`) {
	clearGeneratedFiles().catch((error) => {
		console.error('Failed to clear NSDB generated files.')
		console.error(error)
		process.exit(1)
	})
}
