#!/usr/bin/env node

import { execSync } from 'node:child_process'
import path from 'path'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

// Récupère le répertoire courant (du projet utilisateur)
const cwd = process.cwd()

// Tente de charger .env à la racine du projet
const envPath = path.resolve(cwd, '.env')
if (existsSync(envPath)) {
	dotenv.config({ path: envPath })
}

const projectId = process.env.SUPABASE_PROJECT_ID

if (!projectId) {
	console.error('❌ SUPABASE_PROJECT_ID is not defined in .env (or environment)')
	process.exit(1)
}

const outputPath = path.resolve(cwd, 'types/database.types.ts')
const command = `npx supabase gen types typescript --project-id ${projectId} > ${outputPath}`

try {
	console.log('🔄 Génération des types Supabase...')
	execSync(command, { stdio: 'inherit', shell: true })
	console.log(`✅ Types générés avec succès dans : ${outputPath}`)
} catch (err) {
	console.error('❌ Échec de la génération des types Supabase.')
	process.exit(1)
}
