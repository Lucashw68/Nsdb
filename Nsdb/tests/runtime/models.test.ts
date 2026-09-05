import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { setTestSupabaseClient, setTestSupabaseUser } from './fixtures/nuxt-imports'
import { createSupabaseClientMock } from './fixtures/supabase'
import { useSupabaseModel } from '../../runtime/composables/useSupabaseModels'

type Playlist = { id: string; title: string }
type PlaylistInsert = { title: string }
type PlaylistUpdate = { title?: string }

function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>(resolvePromise => { resolve = resolvePromise })
	return { promise, resolve }
}

describe('useSupabaseModel', () => {
	beforeEach(() => setTestSupabaseUser({ id: 'user-a' }))
	it('maintains items/count and normalizes CRUD in direct mode', async () => {
		const mock = createSupabaseClientMock([
			{ data: [{ id: '1', title: 'One' }], count: 1, error: null },
			{ data: { id: '1', title: 'One' }, error: null },
			{ data: { id: '2', title: 'Two' }, error: null },
			{ data: [{ id: '2', title: 'Renamed' }], error: null },
			{ data: null, error: null },
		])
		setTestSupabaseClient(mock.client)
		const model = useSupabaseModel<Playlist, PlaylistInsert, PlaylistUpdate>('playlists')

		expect(await model.fetch({ limit: 5 })).toEqual([{ id: '1', title: 'One' }])
		expect(model.items.value).toEqual([{ id: '1', title: 'One' }])
		expect(model.totalCount.value).toBe(1)
		expect(await model.getById('1')).toEqual({ id: '1', title: 'One' })
		expect(await model.create({ title: 'Two' })).toEqual({ id: '2', title: 'Two' })
		expect(await model.update('2', { title: 'Renamed' })).toEqual({ id: '2', title: 'Renamed' })
		await expect(model.remove('2')).resolves.toBeUndefined()
	})

	it('rejects Supabase failures instead of returning empty/null values', async () => {
		const failure = { message: 'network failure' }
		const mock = createSupabaseClientMock([
			{ data: null, count: null, error: failure },
			{ data: null, error: failure },
			{ data: null, error: failure },
			{ data: null, error: failure },
			{ data: null, error: failure },
		])
		setTestSupabaseClient(mock.client)
		vi.spyOn(console, 'error').mockImplementation(() => {})
		const model = useSupabaseModel<Playlist, PlaylistInsert, PlaylistUpdate>('playlists')

		await expect(model.fetch()).rejects.toBe(failure)
		await expect(model.getById('1')).rejects.toBe(failure)
		await expect(model.create({ title: 'New' })).rejects.toBe(failure)
		await expect(model.update('1', { title: 'Updated' })).rejects.toBe(failure)
		await expect(model.remove('1')).rejects.toBe(failure)
	})

	it('rejects creation when Supabase does not return the persisted row', async () => {
		const mock = createSupabaseClientMock([{ data: null, error: null }])
		setTestSupabaseClient(mock.client)
		const model = useSupabaseModel<Playlist, PlaylistInsert, PlaylistUpdate>('playlists')

		await expect(model.create({ title: 'Missing response' }))
			.rejects.toThrow('Cannot create "playlists": Supabase returned no row.')
	})

	it('delegates the same canonical API to an optional store', async () => {
		const items = ref<Playlist[]>([{ id: '1', title: 'Cached' }])
		const totalCount = ref<number | null>(1)
		const store = {
			items,
			totalCount,
			getById: vi.fn((id: string | number) => items.value.find(item => item.id === id) ?? null),
			create: vi.fn(async (payload: PlaylistInsert) => ({ id: '2', ...payload })),
			update: vi.fn(async (id: string | number, payload: PlaylistUpdate) => ({ id: String(id), title: payload.title ?? '' })),
			remove: vi.fn(async () => {}),
			fetchFromSupabase: vi.fn(async () => items.value),
			subscribe: vi.fn(),
		}
		const model = useSupabaseModel<Playlist, PlaylistInsert, PlaylistUpdate>('playlists', {
			store: true,
			storeCreator: () => store,
		})

		expect(await model.fetch()).toEqual(items.value)
		expect(await model.getById('1')).toEqual({ id: '1', title: 'Cached' })
		const created = await model.create({ title: 'New' })
		expect(created).toEqual({ id: '2', title: 'New' })
		await model.update(created, { title: 'Updated' })
		await model.remove(created)
		expect(store.update).toHaveBeenCalledWith('2', { title: 'Updated' })
		expect(store.remove).toHaveBeenCalledWith('2')
		model.subscribe()
		expect(store.subscribe).toHaveBeenCalledOnce()
	})

	it('extracts a custom primary key from fetched, created and related rows without sending the row as payload', async () => {
		type Article = { slug: string; title: string; author?: { id: string; name: string } }
		type ArticleInsert = { slug: string; title: string }
		type ArticleUpdate = { title?: string }
		const mock = createSupabaseClientMock([
			{ data: [{ slug: 'fetched', title: 'Fetched', author: { id: 'a', name: 'Author' } }], count: 1, error: null },
			{ data: { slug: 'found', title: 'Found' }, error: null },
			{ data: { slug: 'created', title: 'Created' }, error: null },
			{ data: [{ slug: 'created', title: 'Created updated' }], error: null },
			{ data: [{ slug: 'fetched', title: 'Fetched updated' }], error: null },
			{ data: [{ slug: 'found', title: 'Found updated' }], error: null },
			{ data: null, error: null },
		])
		setTestSupabaseClient(mock.client)
		const model = useSupabaseModel<Article, ArticleInsert, ArticleUpdate, 'slug'>('articles', {
			primaryKey: 'slug',
		})

		const fetched = (await model.fetch({ select: '*, author(*)' }))[0]!
		const found = await model.getById('found')
		const created = await model.create({ slug: 'created', title: 'Created' })
		await model.update(created, { title: 'Created updated' })
		await model.update(fetched, { title: 'Fetched updated' })
		await model.update(found!, { title: 'Found updated' })
		await model.remove(fetched)

		expect(mock.queries[3].calls).toContainEqual(['update', { title: 'Created updated' }])
		expect(mock.queries[3].calls).toContainEqual(['eq', 'slug', 'created'])
		expect(mock.queries[4].calls).toContainEqual(['update', { title: 'Fetched updated' }])
		expect(mock.queries[4].calls).toContainEqual(['eq', 'slug', 'fetched'])
		expect(mock.queries[5].calls).toContainEqual(['eq', 'slug', 'found'])
		expect(mock.queries[6].calls).toContainEqual(['eq', 'slug', 'fetched'])
	})

	it('accepts falsy string and numeric primary keys from row targets', async () => {
		const stringMock = createSupabaseClientMock([{ data: [{ slug: '', title: 'Empty slug updated' }], error: null }])
		setTestSupabaseClient(stringMock.client)
		const stringModel = useSupabaseModel<{ slug: string; title: string }, never, { title?: string }, 'slug'>('articles', {
			primaryKey: 'slug',
		})
		await stringModel.update({ slug: '' }, { title: 'Empty slug updated' })
		expect(stringMock.queries[0].calls).toContainEqual(['eq', 'slug', ''])

		const numericMock = createSupabaseClientMock([
			{ data: [{ sequence_id: 0, title: 'Zero updated' }], error: null },
			{ data: null, error: null },
		])
		setTestSupabaseClient(numericMock.client)
		const numericModel = useSupabaseModel<{ sequence_id: number; title: string }, never, { title?: string }, 'sequence_id'>('events', {
			primaryKey: 'sequence_id',
		})
		const zero = { sequence_id: 0 }
		await numericModel.update(zero, { title: 'Zero updated' })
		await numericModel.remove(zero)
		expect(numericMock.queries[0].calls).toContainEqual(['eq', 'sequence_id', 0])
		expect(numericMock.queries[1].calls).toContainEqual(['eq', 'sequence_id', 0])
	})

	it('rejects row targets missing the generated primary key before contacting Supabase', async () => {
		const mock = createSupabaseClientMock([])
		setTestSupabaseClient(mock.client)
		const model = useSupabaseModel<{ slug: string; title: string }, never, { title?: string }, 'slug'>('articles', {
			primaryKey: 'slug',
		})

		await expect(model.update({ title: 'Draft' } as any, { title: 'Changed' }))
			.rejects.toThrow('Cannot update "articles": target is missing primary key "slug".')
		await expect(model.remove({ title: 'Draft' } as any))
			.rejects.toThrow('Cannot remove "articles": target is missing primary key "slug".')
		expect(mock.queries).toHaveLength(0)
	})

	it('requires a store creator when store mode is requested', () => {
		expect(() => useSupabaseModel<Playlist>('playlists', true)).toThrow(/requires a storeCreator/)
	})

	it('keeps the latest fetch result when responses finish out of order', async () => {
		const older = deferred<{ data: Playlist[]; count: number; error: null }>()
		const newer = deferred<{ data: Playlist[]; count: number; error: null }>()
		const mock = createSupabaseClientMock([older.promise, newer.promise])
		setTestSupabaseClient(mock.client)
		const model = useSupabaseModel<Playlist>('playlists')

		const firstRequest = model.fetch({ search: 'r', searchColumns: ['title'] })
		const secondRequest = model.fetch({ search: 'rock', searchColumns: ['title'] })
		newer.resolve({ data: [{ id: '2', title: 'Rock' }], count: 1, error: null })
		await secondRequest
		older.resolve({ data: [{ id: '1', title: 'Old result' }], count: 1, error: null })
		await firstRequest

		expect(model.items.value).toEqual([{ id: '2', title: 'Rock' }])
	})

	it.each([
		{ operation: 'create', response: { data: { id: '2', title: 'Created by server' }, error: null }, expected: [{ id: '2', title: 'Created by server' }] },
		{ operation: 'update', response: { data: [{ id: '1', title: 'Updated by server' }], error: null }, expected: [{ id: '1', title: 'Updated by server' }] },
		{ operation: 'remove', response: { data: null, error: null }, expected: [] },
	] as const)('keeps direct state coherent when $operation succeeds during an older fetch', async ({ operation, response, expected }) => {
		const oldFetch = deferred<{ data: Playlist[]; count: number; error: null }>()
		const mock = createSupabaseClientMock([oldFetch.promise, response])
		setTestSupabaseClient(mock.client)
		const model = useSupabaseModel<Playlist, PlaylistInsert, PlaylistUpdate>('playlists')
		if (operation !== 'create') model.items.value = [{ id: '1', title: 'Before' }]
		const fetching = model.fetch()
		if (operation === 'create') await model.create({ title: 'Created' })
		else if (operation === 'update') await model.update('1', { title: 'Updated' })
		else await model.remove('1')
		oldFetch.resolve({ data: [{ id: '1', title: 'Stale' }], count: 1, error: null })
		await fetching
		expect(model.items.value).toEqual(expected)
		expect(model.stale.value).toBe(true)
	})

	it('keeps direct instances independent and exposes clear freshness primitives', async () => {
		const mock = createSupabaseClientMock([
			{ data: [{ id: '1', title: 'One' }], count: 1, error: null },
			{ data: [{ id: '2', title: 'Refreshed' }], count: 1, error: null },
		])
		setTestSupabaseClient(mock.client)
		const first = useSupabaseModel<Playlist>('playlists')
		const second = useSupabaseModel<Playlist>('playlists')
		await first.fetch()
		expect(second.items.value).toEqual([])
		first.invalidate()
		expect(first.items.value[0]?.title).toBe('One')
		expect(first.stale.value).toBe(true)
		await first.refresh()
		expect(first.items.value[0]?.title).toBe('Refreshed')
		expect(first.stale.value).toBe(false)
	})

	it('preserves simple ordering and known counts after direct mutations', async () => {
		const mock = createSupabaseClientMock([
			{ data: [{ id: '1', title: 'Zulu' }], count: 1, error: null },
			{ data: { id: '2', title: 'Alpha' }, error: null },
			{ data: [{ id: '1', title: 'Beta' }], error: null },
			{ data: null, error: null },
		])
		setTestSupabaseClient(mock.client)
		const model = useSupabaseModel<Playlist, PlaylistInsert, PlaylistUpdate>('playlists')
		await model.fetch({ orderBy: 'title', orderDirection: 'asc' })
		await model.create({ title: 'Alpha' })
		expect(model.items.value.map(row => row.title)).toEqual(['Alpha', 'Zulu'])
		expect(model.totalCount.value).toBe(2)
		await model.update('1', { title: 'Beta' })
		expect(model.items.value.map(row => row.title)).toEqual(['Alpha', 'Beta'])
		await model.remove('2')
		expect(model.totalCount.value).toBe(1)
	})

	it('supports an idempotent identity-bound realtime lifecycle in direct mode', async () => {
		const mock = createSupabaseClientMock([])
		setTestSupabaseClient(mock.client)
		const model = useSupabaseModel<Playlist>('playlists')
		model.subscribe()
		model.subscribe()
		expect(mock.channels).toHaveLength(1)
		mock.channels[0].emit({ eventType: 'INSERT', new: { id: '1', title: 'Realtime' }, old: {} })
		mock.channels[0].emit({ eventType: 'INSERT', new: { id: '1', title: 'Realtime' }, old: {} })
		expect(model.items.value).toEqual([{ id: '1', title: 'Realtime' }])
		setTestSupabaseUser({ id: 'user-b' })
		await nextTick()
		expect(model.items.value).toEqual([])
		expect(mock.channels[0].unsubscribed).toBe(true)
		await model.unsubscribe()
	})
})
