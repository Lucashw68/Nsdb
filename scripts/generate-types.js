#!/usr/bin/env node
import path from 'path'
import { parseArgs } from '../helpers/args.js'
import { ensureDir } from '../helpers/io.js'
import { run, isAvailable } from '../helpers/shell.js'

function buildCommand({ projectId, outputPath, schema, useLinked }) {
	const base = ['npx supabase gen types typescript']
	const schemaPart = schema ? `--schema ${schema}` : ''
	if (useLinked) return `${base.join(' ')} ${schemaPart} --linked > "${outputPath}"`
	return `${base.join(' ')} ${schemaPart} --project-id ${projectId} > "${outputPath}"`
}

function main() {
	const { get, getBool } = parseArgs()
	const cwd = process.cwd()
	const dotenvPath = path.resolve(cwd, get('dotenv', '.env'))
	// charge .env si présent
	try { (await import('dotenv')).config({ path: dotenvPath }) } catch {}

	const outFile = path.resolve(cwd, get('out', 'types/database.types.ts'))
	const projectId = get('project-id', process.env.SUPABASE_PROJECT_ID || '')
	const schema = get('schema', 'public')
	const useLinked = getBool('linked', false)

	if (!useLinked && !projectId) {
		console.error('❌ SUPABASE_PROJECT_ID manquant (utilisez --project-id ou --linked)')
		process.exit(1)
	}

	if (!isAvailable('npx supabase --version')) {
		console.error('❌ CLI Supabase absent. Exécute : npm i -D supabase')
		process.exit(1)
	}

	ensureDir(path.dirname(outFile))
	const cmd = buildCommand({ projectId, outputPath: outFile, schema, useLinked })

	console.log(`📦 Projet: ${useLinked ? '(linked)' : projectId}`)
	console.log(`📁 Sortie: ${path.relative(cwd, outFile)}`)
	console.log(`📚 Schéma: ${schema}`)
	if (useLinked) console.log('🔗 Mode linked: ON')
	console.log('🔄 Génération des types Supabase...')

	try {
		run(cmd, { inherit: true })
		console.log('✅ Types générés avec succès.')
	} catch (e) {
		console.error('❌ Échec de la génération des types.')
		process.exit(1)
	}
}

if (import.meta.url === `file://${process.argv[1]}`) main()
