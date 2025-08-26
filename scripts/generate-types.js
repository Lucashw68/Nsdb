#!/usr/bin/env node

import { execSync } from 'node:child_process'
import path from 'path'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync } from 'fs'

// Récupère le répertoire courant (du projet utilisateur)
const cwd = process.cwd()

// Tente de charger .env à la racine du projet
const envPath = path.resolve(cwd, '.env')
if (existsSync(envPath)) {
	dotenv.config({ path: envPath })
}

const projectId = process.env.SUPABASE_PROJECT_ID
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

if (!projectId) {
	console.error('❌ SUPABASE_PROJECT_ID is not defined in .env (or environment)')
	process.exit(1)
}

if (!supabaseUrl || !supabaseKey) {
	console.error('❌ SUPABASE_URL and SUPABASE_KEY must be defined in .env (or environment)')
	process.exit(1)
}

try {
	execSync('npx supabase --version', { stdio: 'ignore' })
} catch {
	console.error('❌ Le CLI Supabase n\'est pas installé. Veuillez exécuter : npm install -D supabase')
	process.exit(1)
}

// Prépare le chemin de sortie
const typesDir = path.resolve(cwd, 'types')
const outputPath = path.join(typesDir, 'database.types.ts')

// Crée le dossier types/ s'il n'existe pas
if (!existsSync(typesDir)) {
	mkdirSync(typesDir, { recursive: true })
}

const command = `npx supabase gen types typescript --project-id ${projectId} > "${outputPath}"`

try {
	console.log('🔄 Génération des types Supabase...')
	execSync(command, { stdio: 'inherit', shell: true })
	console.log(`✅ Types générés avec succès dans : ${outputPath}`)
} catch (err) {
	console.error('❌ Échec de la génération des types Supabase.', err)
	process.exit(1)
}
