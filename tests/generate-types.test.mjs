import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCommand } from '../scripts/generate-types.js'

test('buildCommand supports project id mode', () => {
	const command = buildCommand({
		projectId: 'project_ref',
		outputPath: 'types/database.types.ts',
		schemaName: 'public',
		useLinkedProject: false,
	})

	assert.equal(
		command,
		'npx supabase gen types typescript --schema public --project-id project_ref > "types/database.types.ts"'
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
		'npx supabase gen types typescript --schema public --linked > "types/database.types.ts"'
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
		'npx supabase gen types typescript --schema public --db-url "postgresql://postgres:password@localhost:5432/postgres" > "types/database.types.ts"'
	)
})
