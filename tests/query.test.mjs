import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { tsImport } from 'tsx/esm/api'

const {
	applyListOptions,
	applySearch,
	applyWhereFilters,
	escapePostgrestSearchTerm,
	normalizePagination,
} = await tsImport(new URL('../runtime/query.ts', import.meta.url).href, import.meta.url)

function queryRecorder() {
	const calls = []
	const query = new Proxy({}, {
		get(_target, property) {
			return (...args) => {
				calls.push([property, ...args])
				return query
			}
		},
	})
	return { calls, query }
}

test('primitive filter arrays compile to one IN operation', () => {
	const { calls, query } = queryRecorder()
	applyWhereFilters(query, { status: ['draft', 'published'] })
	assert.deepEqual(calls, [['in', 'status', ['draft', 'published']]])
})

test('operator arrays apply every explicit operation and reject mixed arrays', () => {
	const { calls, query } = queryRecorder()
	applyWhereFilters(query, {
		score: [
			{ op: 'gte', value: 10 },
			{ op: 'lt', value: 20 },
		],
	})
	assert.deepEqual(calls, [
		['gte', 'score', 10],
		['lt', 'score', 20],
	])
	assert.throws(
		() => applyWhereFilters(query, { score: [{ op: 'gte', value: 10 }, 20] }),
		/cannot mix values and operators/,
	)
})

test('all supported scalar operators map to the matching query method', () => {
	const { calls, query } = queryRecorder()
	applyWhereFilters(query, {
		a: { op: 'eq', value: 1 },
		b: { op: 'neq', value: 2 },
		c: { op: 'gt', value: 3 },
		d: { op: 'gte', value: 4 },
		e: { op: 'lt', value: 5 },
		f: { op: 'lte', value: 6 },
		g: { op: 'ilike', value: '%rock%' },
		h: { op: 'in', value: ['x', 'y'] },
	})
	assert.deepEqual(calls.map(call => call[0]), ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'ilike', 'in'])
})

test('search deduplicates columns and escapes structural/wildcard characters', () => {
	const { calls, query } = queryRecorder()
	assert.equal(escapePostgrestSearchTerm(' 100%_(rock,test) '), '100\\%\\_ rock test')
	applySearch(query, {
		search: ' 100%_(rock,test) ',
		searchColumns: ['title', 'title', ' description '],
	})
	assert.deepEqual(calls, [[
		'or',
		'title.ilike.%100\\%\\_ rock test%,description.ilike.%100\\%\\_ rock test%',
	]])
})

test('ordering and pagination produce an inclusive Supabase range', () => {
	const { calls, query } = queryRecorder()
	applyListOptions(query, {
		orderBy: 'title',
		orderDirection: 'desc',
		orderForeignTable: 'playlists',
		limit: 20,
		offset: 40,
	})
	assert.deepEqual(calls, [
		['order', 'title', { ascending: false, referencedTable: 'playlists' }],
		['range', 40, 59],
	])
})

test('pagination without explicit ordering does not assume an id column', () => {
	const { calls, query } = queryRecorder()
	applyListOptions(query, { limit: 10, offset: 0 })
	assert.deepEqual(calls, [['range', 0, 9]])
})

test('pagination rejects invalid ranges instead of emitting malformed queries', () => {
	assert.deepEqual(normalizePagination({}), { limit: 100, offset: 0 })
	for (const input of [
		{ limit: 0 },
		{ limit: -1 },
		{ limit: 1.5 },
		{ offset: -1 },
		{ offset: Number.POSITIVE_INFINITY },
	]) {
		assert.throws(() => normalizePagination(input), /safe integer/)
	}
})

test('upsert passes onConflict to Supabase upsert options', () => {
	const source = fs.readFileSync(
		new URL('../runtime/composables/useSupabaseApi.ts', import.meta.url),
		'utf8',
	)
	assert.match(source, /\.upsert\(payload, upsertOptions\)/)
	assert.doesNotMatch(source, /q\.onConflict/)
})
