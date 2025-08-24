import { execSync } from 'node:child_process'
import * as dotenv from 'dotenv'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

// Recrée __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Charge les variables d’environnement
dotenv.config()

const projectId = process.env.SUPABASE_PROJECT_ID

if (!projectId) {
	console.error('❌ SUPABASE_PROJECT_ID is not defined in .env')
	process.exit(1)
}

const outputPath = path.resolve(__dirname, '../types/database.types.ts')
const command = `npx supabase gen types typescript --project-id ${projectId} > ${outputPath}`

try {
	console.log('🔄 Génération des types Supabase...')
	execSync(command, { stdio: 'inherit', shell: true })
	console.log('✅ Types Supabase générés avec succès.')
} catch (err) {
	console.error('❌ Échec de la génération des types Supabase.')
	process.exit(1)
}
