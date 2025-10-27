#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const cwd = process.cwd()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const nsdbDir = path.resolve(cwd, 'nsdb')
const storesDir = path.resolve(cwd, 'stores')
const modelFile = path.resolve(nsdbDir, 'models.ts')

if (!fs.existsSync(nsdbDir)) {
	console.log('ℹ️  Le dossier nsdb/ n\'existe pas.')
	process.exit(0)
}

// Supprime les fichiers useXStore.ts
const deleted = []
fs.readdirSync(storesDir).forEach(file => {
	if (file.startsWith('use') && file.endsWith('Store.ts')) {
		const fullPath = path.join(entitiesDir, file)
		fs.unlinkSync(fullPath)
		deleted.push(file)
	}
})

// Supprime models.ts s'il existe
if (fs.existsSync(modelFile)) {
	fs.unlinkSync(modelFile)
	deleted.push('models.ts')
}

if (deleted.length > 0) {
	console.log(`🗑️  Fichiers supprimés :\n- ${deleted.join('\n- ')}`)
} else {
	console.log('✅ Aucun fichier généré à supprimer.')
}
