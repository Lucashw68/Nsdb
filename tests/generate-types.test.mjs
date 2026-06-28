import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCommand, buildRemoteTypesCommands } from '../scripts/generate-types.js'

test('buildCommand supports project id mode', () => {
	const command = buildCommand({
		projectId: 'project_ref',
		outputPath: 'types/database.types.ts',
		schemaName: 'public',
		useLinkedProject: false,
	})

	assert.equal(
		command,
		"npx supabase gen types typescript --schema public --project-id project_ref > 'types/database.types.ts'"
	)
})

test('buildCommand supports linked mode', () => {
	const command = buildCommand({
		outputPath: 'types/database.types.ts',
		schemaName: 'public',
		useLinkedProject: true,
	})

	assert.equal(
		command,
		"npx supabase gen types typescript --schema public --linked > 'types/database.types.ts'"
	)
})

test('buildCommand supports db url mode for self-hosted Supabase', () => {
	const command = buildCommand({
		projectId: 'ignored_project_ref',
		dbUrl: 'postgresql://postgres:password@localhost:5432/postgres',
		outputPath: 'types/database.types.ts',
		schemaName: 'public',
		useLinkedProject: false,
	})

	assert.equal(
		command,
		"npx supabase gen types typescript --schema public --db-url 'postgresql://postgres:password@localhost:5432/postgres' > 'types/database.types.ts'"
	)
})

test('buildRemoteTypesCommands builds ssh and scp commands', () => {
	const commands = buildRemoteTypesCommands({
		sshHost: 'vps',
		projectPath: '/opt/supabase-projects/mysic',
		dbUrl: 'postgresql://postgres:$POSTGRES_PASSWORD@db:5432/postgres',
		remoteOutput: '/tmp/database.types.ts',
		localOutputPath: 'src/types/database.types.ts',
		schemaName: 'public',
	})

	assert.equal(
		commands.generateCommand,
		'ssh \'vps\' \'cd \'\\\'\'/opt/supabase-projects/mysic\'\\\'\' && npx supabase gen types typescript --schema public --db-url "postgresql://postgres:$POSTGRES_PASSWORD@db:5432/postgres" > "/tmp/database.types.ts"\''
	)
	assert.equal(
		commands.copyCommand,
		"scp 'vps:/tmp/database.types.ts' 'src/types/database.types.ts'"
	)
})

test('buildRemoteTypesCommands supports remote setup and custom supabase command', () => {
	const commands = buildRemoteTypesCommands({
		sshHost: 'vps',
		projectPath: '/opt/supabase-projects/mysic',
		dbUrl: 'postgresql://postgres:$POSTGRES_PASSWORD@db:5432/postgres',
		remoteOutput: '/tmp/database.types.ts',
		localOutputPath: 'types/database.types.ts',
		schemaName: 'public',
		beforeCommand: 'source ~/.nvm/nvm.sh',
		supabaseCommand: './node_modules/.bin/supabase',
	})

	assert.match(commands.generateCommand, /cd .* && source ~\/\.nvm\/nvm\.sh &&/)
	assert.match(commands.generateCommand, /\.\/node_modules\/\.bin\/supabase gen types typescript/)
})
