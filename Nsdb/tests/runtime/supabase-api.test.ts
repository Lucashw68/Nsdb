import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setTestSupabaseClient } from './fixtures/nuxt-imports'
import { createSupabaseClientMock } from './fixtures/supabase'
import { useSupabaseApi } from '../../runtime/composables/useSupabaseApi'

describe('useSupabaseApi', () => {
	beforeEach(() => setTestSupabaseClient(null))

	it('builds observable list queries and preserves count', async () => {
		const mock = createSupabaseClientMock([{ data: [{ id: '1' }], count: 1, error: null }])
		setTestSupabaseClient(mock.client)
		const api = useSupabaseApi()

		const response = await api.all<{ id: string }>('playlists', {
			select: 'id,title',
			where: { status: ['draft', 'published'], active: true },
			search: 'rock',
			searchColumns: ['title'],
			orderBy: 'created_at',
			orderDirection: 'desc',
			limit: 10,
			offset: 20,
		})

		expect(response).toEqual({ success: true, error: undefined, data: [{ id: '1' }], count: 1 })
		expect(mock.resources).toEqual(['playlists'])
		expect(mock.queries[0].calls).toEqual([
			['select', 'id,title', { count: 'exact' }],
			['in', 'status', ['draft', 'published']],
			['eq', 'active', true],
			['or', 'title.ilike.%rock%'],
			['order', 'created_at', { ascending: false }],
			['range', 20, 29],
		])
	})

	it('does not assume an id column in a canonical low-level list query', async () => {
		const mock = createSupabaseClientMock([{ data: [], count: 0, error: null }])
		setTestSupabaseClient(mock.client)

		await useSupabaseApi().all('schema_features', {})

		expect(mock.queries[0]?.calls.some(call => call[0] === 'order')).toBe(false)
	})

	it('covers getById, create, update, remove and upsert query contracts', async () => {
		const mock = createSupabaseClientMock([
			{ data: { id: '1' }, error: null },
			{ data: { id: '2' }, error: null },
			{ data: [{ id: '2' }], error: null },
			{ data: null, error: null },
			{ data: [{ id: '2' }], error: null },
		])
		setTestSupabaseClient(mock.client)
		const api = useSupabaseApi()

		await api.getById('playlists', '1', { select: 'id' })
		await api.create('playlists', { title: 'New' })
		await api.update('playlists', '2', { title: 'Updated' })
		await api.remove('playlists', '2')
		await api.upsert('playlists', { id: '2', title: 'Upserted' }, { onConflict: 'id' })

		expect(mock.queries.map(query => query.calls)).toEqual([
			[['select', 'id'], ['eq', 'id', '1'], ['limit', 1], ['single']],
			[['insert', { title: 'New' }], ['select'], ['single']],
			[['update', { title: 'Updated' }], ['eq', 'id', '2'], ['select']],
			[['delete'], ['eq', 'id', '2']],
			[['upsert', { id: '2', title: 'Upserted' }, { onConflict: 'id' }], ['select']],
		])
	})

	it('supports explicit custom keys for getById/update/remove', async () => {
		const mock = createSupabaseClientMock([
			{ data: { slug: 'slug-a' }, error: null },
			{ data: [{ slug: 'slug-a', title: 'Updated' }], error: null },
			{ data: null, error: null },
		])
		setTestSupabaseClient(mock.client)
		const api = useSupabaseApi()
		await api.getById('playlists', 'slug-a', { key: 'slug', select: 'slug,title' })
		await api.update('playlists', 'slug-a', { title: 'Updated' }, { key: 'slug' })
		await api.remove('playlists', 'slug-a', { key: 'slug' })

		expect(mock.queries[0]?.calls).toEqual(expect.arrayContaining([
			['select', 'slug,title'],
			['eq', 'slug', 'slug-a'],
		]))
		expect(mock.queries[1]?.calls).toContainEqual(['eq', 'slug', 'slug-a'])
		expect(mock.queries[2]?.calls).toContainEqual(['eq', 'slug', 'slug-a'])
	})

	it('covers canonical filtered lists, count and findOne', async () => {
		const mock = createSupabaseClientMock([
			{ data: [{ id: '1' }], count: 1, error: null },
			{ data: null, count: 4, error: null },
			{ data: { id: '1' }, error: null },
		])
		setTestSupabaseClient(mock.client)
		const api = useSupabaseApi()

		expect((await api.all('playlists', { where: { owner_id: 'user-a' } })).count).toBe(1)
		expect((await api.count('playlists', { property: 'owner_id', value: 'user-a' })).data).toBe(4)
		expect((await api.findOne('playlists', { where: { slug: 'rock' } })).data).toEqual({ id: '1' })
	})

	it('returns a discriminated failure without confusing it with empty success', async () => {
		const databaseError = { message: 'RLS denied' }
		const mock = createSupabaseClientMock([{ data: null, count: null, error: databaseError }])
		setTestSupabaseClient(mock.client)
		vi.spyOn(console, 'error').mockImplementation(() => {})

		const response = await useSupabaseApi().all('playlists')

		expect(response).toEqual({ success: false, error: databaseError, data: [], count: null })
	})

	it('fails clearly when the Nuxt Supabase client is unavailable', () => {
		expect(() => useSupabaseApi()).toThrow(/Supabase client not found/)
	})
})
