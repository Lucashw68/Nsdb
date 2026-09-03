import assert from 'node:assert/strict'
import test from 'node:test'
import { getColumnPolicies, selectTableNames } from '../helpers/tables.js'

const tables = ['profiles', 'internal_logs', 'playlists']

test('table exposure is stable and defaults to all tables', () => {
	assert.deepEqual(selectTableNames(tables), ['internal_logs', 'playlists', 'profiles'])
})

test('table exposure supports an explicit allowlist', () => {
	assert.deepEqual(selectTableNames(tables, { include: ['playlists', 'profiles'] }), [
		'playlists',
		'profiles',
	])
})

test('table exposure supports an explicit denylist', () => {
	assert.deepEqual(selectTableNames(tables, { exclude: ['internal_logs'] }), [
		'playlists',
		'profiles',
	])
})

test('table exposure rejects ambiguous or misspelled configuration', () => {
	assert.throws(
		() => selectTableNames(tables, { include: ['playlists'], exclude: ['profiles'] }),
		/either tables\.include or tables\.exclude/,
	)
	assert.throws(
		() => selectTableNames(tables, { include: ['playlist'] }),
		/Unknown table.*playlist/,
	)
	assert.throws(
		() => selectTableNames(tables, { include: 'playlists' }),
		/must be an array/,
	)
})

test('column policies preserve simple defaults and reject contradictory server-only exposure', () => {
	const policies = getColumnPolicies({
		columns: {
			profiles: {
				display_name: { hidden: true },
				internal_note: { serverOnly: true },
			},
		},
	}, 'profiles', ['id', 'display_name', 'internal_note'])

	assert.deepEqual(policies.id, { selectable: true, editable: undefined, hidden: false, serverOnly: false })
	assert.equal(policies.display_name.hidden, true)
	assert.deepEqual(policies.internal_note, { selectable: false, editable: false, hidden: true, serverOnly: true })
	assert.throws(
		() => getColumnPolicies({ columns: { profiles: { secret: { serverOnly: true, selectable: true } } } }, 'profiles', ['secret']),
		/cannot be serverOnly and selectable\/editable/,
	)
})
