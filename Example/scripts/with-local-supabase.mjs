import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'

const action = process.argv[2]
const extraArgs = process.argv.slice(3)
const supabaseBin = path.resolve('node_modules/.bin/supabase')
const status = JSON.parse(execFileSync(
	supabaseBin,
	['status', '--workdir', '..', '-o', 'json'],
	{ encoding: 'utf8' },
))

const env = {
	...process.env,
	SUPABASE_URL: status.API_URL,
	SUPABASE_KEY: status.ANON_KEY,
	NSDB_PLAYGROUND_ENV: 'local',
}

let command
let args

if (action === 'dev') {
	command = path.resolve('node_modules/.bin/nuxt')
	args = ['dev', ...extraArgs]
} else if (action === 'generate') {
	command = path.resolve('node_modules/@lucashw68/nsdb/cli/index.js')
	args = ['generate:all', '--db-url', status.DB_URL, ...extraArgs]
} else {
	console.error('Usage: node scripts/with-local-supabase.mjs <dev|generate> [...args]')
	process.exit(1)
}

const result = spawnSync(command, args, { env, stdio: 'inherit' })
process.exit(result.status ?? 1)
