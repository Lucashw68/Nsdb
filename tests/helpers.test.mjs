import test from 'node:test'
import assert from 'node:assert/strict'
import { parseArgs } from '../helpers/args.js'
import { modelHookName, singular, storeName, toPascal } from '../helpers/names.js'

test('parseArgs reads string and boolean options', () => {
	const args = parseArgs(['generate:types', '--schema', 'private', '--linked', '--force', 'false'])

	assert.equal(args.get('schema'), 'private')
	assert.equal(args.getBool('linked'), true)
	assert.equal(args.getBool('force', true), false)
	assert.deepEqual(args.rest(), ['generate:types', 'private', 'false'])
})

test('name helpers generate stable model and store names', () => {
	assert.equal(toPascal('user_profiles'), 'UserProfiles')
	assert.equal(singular('playlists'), 'playlist')
	assert.equal(modelHookName('playlists'), 'usePlaylists')
	assert.equal(storeName('playlists'), 'usePlaylistStore')
})
