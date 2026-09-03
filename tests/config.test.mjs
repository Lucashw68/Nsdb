import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadNsdbConfig } from '../helpers/config.js'

async function createTempProject() {
	return await mkdtemp(path.join(tmpdir(), 'nsdb-config-'))
}

test('loadNsdbConfig merges defaults with nsdb.config.ts', async () => {
	const projectDirectory = await createTempProject()
	await writeFile(
		path.join(projectDirectory, 'nsdb.config.ts'),
		`export default {
			supabase: { schema: 'private', projectId: 'project_ref' },
			paths: { types: 'custom/database.types.ts' }
		}`,
		'utf8'
	)

	const result = await loadNsdbConfig(projectDirectory)

	assert.equal(result.configFilePath, path.join(projectDirectory, 'nsdb.config.ts'))
	assert.equal(result.config.supabase.schema, 'private')
	assert.equal(result.config.supabase.projectId, 'project_ref')
	assert.equal(result.config.supabase.dbUrl, '')
	assert.equal(result.config.supabase.linked, false)
	assert.equal(result.config.paths.types, 'custom/database.types.ts')
	assert.equal(result.config.paths.models, 'nsdb/models')
})

test('loadNsdbConfig supports explicit json config path', async () => {
	const projectDirectory = await createTempProject()
	await writeFile(
		path.join(projectDirectory, 'custom.nsdb.json'),
		JSON.stringify({
			supabase: { linked: true },
			imports: { databaseTypes: '~/types/supabase' },
		}),
		'utf8'
	)

	const result = await loadNsdbConfig(projectDirectory, 'custom.nsdb.json')

	assert.equal(result.config.supabase.linked, true)
	assert.equal(result.config.supabase.schema, 'public')
	assert.equal(result.config.imports.databaseTypes, '~/types/supabase')
})

test('loadNsdbConfig merges table exposure without losing defaults', async () => {
	const projectDirectory = await createTempProject()
	await writeFile(
		path.join(projectDirectory, 'nsdb.config.mjs'),
		`export default { tables: { include: ['playlists'] } }`,
		'utf8',
	)

	const result = await loadNsdbConfig(projectDirectory)

	assert.deepEqual(result.config.tables.include, ['playlists'])
	assert.deepEqual(result.config.tables.exclude, [])
})
