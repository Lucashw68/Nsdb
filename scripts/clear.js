#!/usr/bin/env node
import path from 'path'
import { parseArgs } from '../helpers/args.js'
import { removeDirIfExists, removeFileIfExists, listFiles } from '../helpers/io.js'

function main() {
	const { getBool } = parseArgs()
	const verbose = getBool('verbose', false)
	const deleteStores = !getBool('no-stores', false)

	const cwd = process.cwd()
	const nsdbDir = path.resolve(cwd, 'nsdb')
	const storesDir = path.resolve(cwd, 'stores')
	const legacyModelFile = path.resolve(nsdbDir, 'models.ts')

	let removed = false
	const deletedStores = []

	removed = removeDirIfExists(nsdbDir, verbose) || removed
	removed = removeFileIfExists(legacyModelFile, verbose) || removed

	if (deleteStores) {
		for (const f of listFiles(storesDir)) {
			if (f.startsWith('use') && f.endsWith('Store.ts')) {
				const p = path.join(storesDir, f)
				if (removeFileIfExists(p, verbose)) {
					deletedStores.push(f)
					removed = true
				}
			}
		}
	}

	if (removed) {
		console.log('✅ Nettoyage terminé.')
		if (deletedStores.length && !verbose) {
			console.log(`🗑️  ${deletedStores.length} fichier(s) de store supprimé(s).`)
		}
	} else {
		console.log('✅ Aucun fichier généré à supprimer.')
	}
}

if (import.meta.url === `file://${process.argv[1]}`) main()
