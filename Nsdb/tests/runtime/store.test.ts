import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, nextTick } from 'vue'
import { setTestSupabaseClient, setTestSupabaseUser } from './fixtures/nuxt-imports'
import { createSupabaseClientMock } from './fixtures/supabase'
import { createDbStore } from '../../runtime/stores/createDbStore'

type Row = { id: string; title: string }

function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>(resolvePromise => { resolve = resolvePromise })
	return { promise, resolve }
}

describe('createDbStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		setTestSupabaseUser({ id: 'user-a' })
	})
	afterEach(() => vi.useRealTimers())

	it('caches by query/TTL while refresh bypasses the cache', async () => {
		const mock = createSupabaseClientMock([
			{ data: [{ id: '1', title: 'One' }], count: 1, error: null },
			{ data: [{ id: '2', title: 'Two' }], count: 1, error: null },
		])
		setTestSupabaseClient(mock.client)
		const useStore = createDbStore<Row>('playlists', { persist: false, staleTimeMs: 60_000 })
		const store = useStore()

		expect(await store.fetchFromSupabase({ limit: 10 })).toEqual([{ id: '1', title: 'One' }])
		expect(await store.fetchFromSupabase({ limit: 10 })).toEqual([{ id: '1', title: 'One' }])
		expect(mock.queries).toHaveLength(1)
		await store.refresh({ limit: 10, merge: false })
		expect(store.items).toEqual([{ id: '2', title: 'Two' }])
		expect(store.totalCount).toBe(1)
	})

	it('synchronizes create, update and remove mutations locally', async () => {
		const mock = createSupabaseClientMock([
			{ data: { id: '1', title: 'One' }, error: null },
			{ data: [{ id: '1', title: 'Updated' }], error: null },
			{ data: null, error: null },
		])
		setTestSupabaseClient(mock.client)
		const store = createDbStore<Row>('playlists', { persist: false })()

		await store.create({ title: 'One' })
		expect(store.getById('1')).toEqual({ id: '1', title: 'One' })
		const renderedTitle = computed(() => store.items[0]?.title)
		expect(renderedTitle.value).toBe('One')
		await store.update('1', { title: 'Updated' })
		expect(store.getById('1')?.title).toBe('Updated')
		expect(renderedTitle.value).toBe('Updated')
		await store.remove('1')
		expect(store.getById('1')).toBeNull()
	})

	it('clears rows immediately when the authenticated identity changes', async () => {
		const mock = createSupabaseClientMock([{ data: [{ id: 'a', title: 'Private A' }], count: 1, error: null }])
		setTestSupabaseClient(mock.client)
		const store = createDbStore<Row>('playlists', { persist: false, scopeToUser: true })()
		await store.fetchFromSupabase()
		expect(store.items).toHaveLength(1)
		expect(store.scopeOwnerId).toBe('user-a')

		setTestSupabaseUser(null)
		await nextTick()
		expect(store.items).toEqual([])
		setTestSupabaseUser({ id: 'user-b' })
		await nextTick()
		expect(store.items).toEqual([])
		expect(store.scopeOwnerId).toBe('user-b')
	})

	it.each([
		{ label: 'anonymous', restoredUserId: null, shouldRestore: false },
		{ label: 'the same user', restoredUserId: 'user-a', shouldRestore: true },
		{ label: 'another user', restoredUserId: 'user-b', shouldRestore: false },
	])('quarantines persisted user A rows until session validation: $label', async ({ restoredUserId, shouldRestore }) => {
		let resolveUser!: (value: any) => void
		const validatedUser = new Promise(resolve => { resolveUser = resolve })
		const mock = createSupabaseClientMock([])
		const getSession = vi.fn()
		mock.client.auth = { getUser: () => validatedUser, getSession }
		setTestSupabaseClient(mock.client)
		setTestSupabaseUser(null)
		const store = createDbStore<Row>('persisted_playlists', { persist: true, scopeToUser: true })()

		store.$patch({
			items: [{ id: 'private-a', title: 'Private A' }],
			totalCount: 1,
			lastFetchedAt: 123,
			scopeOwnerId: 'user-a',
		})
		const validation = store.quarantineHydratedState()

		expect(store.hydrationReady).toBe(false)
		expect(store.items).toEqual([])
		resolveUser({
			data: { user: restoredUserId ? { id: restoredUserId } : null },
			error: null,
		})
		await validation

		expect(store.hydrationReady).toBe(true)
		expect(store.items).toEqual(shouldRestore ? [{ id: 'private-a', title: 'Private A' }] : [])
		expect(store.scopeOwnerId).toBe(restoredUserId)
		expect(getSession).not.toHaveBeenCalled()
	})

	it('rejects fetch errors and keeps reactive error state', async () => {
		const failure = { message: 'RLS denied' }
		const mock = createSupabaseClientMock([{ data: null, count: null, error: failure }])
		setTestSupabaseClient(mock.client)
		vi.spyOn(console, 'error').mockImplementation(() => {})
		const store = createDbStore<Row>('playlists', { persist: false })()

		await expect(store.fetchFromSupabase()).rejects.toBe(failure)
		expect(store.error).toEqual(failure)
		expect(store.loading).toBe(false)
	})

	it('uses a controlled TTL, stable query keys and restores cached views', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-09-02T10:00:00Z'))
		const mock = createSupabaseClientMock([
			{ data: [{ id: 'r', title: 'Rock' }], count: 1, error: null },
			{ data: [{ id: 'j', title: 'Jazz' }], count: 1, error: null },
			{ data: [{ id: 'r2', title: 'Rock refreshed' }], count: 1, error: null },
		])
		setTestSupabaseClient(mock.client)
		const store = createDbStore<Row>('playlists', { persist: false, staleTimeMs: 1_000 })()

		await store.fetchFromSupabase({ where: { title: 'rock', id: 'r' }, merge: false })
		await store.fetchFromSupabase({ where: { id: 'r', title: 'rock' }, merge: false })
		expect(mock.queries).toHaveLength(1)
		await store.fetchFromSupabase({ search: 'jazz', searchColumns: ['title'], merge: false })
		expect(store.items).toEqual([{ id: 'j', title: 'Jazz' }])
		await store.fetchFromSupabase({ where: { id: 'r', title: 'rock' }, merge: false })
		expect(store.items).toEqual([{ id: 'r', title: 'Rock' }])
		expect(mock.queries).toHaveLength(2)

		vi.advanceTimersByTime(1_001)
		await store.fetchFromSupabase({ where: { title: 'rock', id: 'r' }, merge: false })
		expect(mock.queries).toHaveLength(3)
		expect(store.items[0]?.title).toBe('Rock refreshed')
	})

	it('refresh bypasses TTL, invalidate keeps rows visible, and refresh failure preserves them', async () => {
		const failure = { message: 'offline' }
		const mock = createSupabaseClientMock([
			{ data: [{ id: '1', title: 'Known' }], count: 1, error: null },
			{ data: null, count: null, error: failure },
		])
		setTestSupabaseClient(mock.client)
		vi.spyOn(console, 'error').mockImplementation(() => {})
		const store = createDbStore<Row>('playlists', { persist: false, staleTimeMs: 60_000 })()
		await store.fetchFromSupabase()
		expect(store.stale).toBe(false)
		store.invalidate()
		expect(store.items[0]?.title).toBe('Known')
		expect(store.stale).toBe(true)
		await expect(store.refresh()).rejects.toBe(failure)
		expect(store.items[0]?.title).toBe('Known')
		expect(store.error).toEqual(failure)
	})

	it('deduplicates identical in-flight store fetches', async () => {
		const pending = deferred<{ data: Row[]; count: number; error: null }>()
		const mock = createSupabaseClientMock([pending.promise])
		setTestSupabaseClient(mock.client)
		const store = createDbStore<Row>('playlists', { persist: false })()
		const first = store.fetchFromSupabase({ search: 'rock', searchColumns: ['title'] })
		const second = store.fetchFromSupabase({ searchColumns: ['title'], search: 'rock' })
		await Promise.resolve()
		await Promise.resolve()
		expect(mock.queries).toHaveLength(1)
		pending.resolve({ data: [{ id: '1', title: 'Rock' }], count: 1, error: null })
		expect(await first).toEqual(await second)
	})

	it.each([
		{ operation: 'create', mutationResponse: { data: { id: '2', title: 'Created' }, error: null }, expected: [{ id: '2', title: 'Created' }] },
		{ operation: 'update', mutationResponse: { data: [{ id: '1', title: 'Updated' }], error: null }, expected: [{ id: '1', title: 'Updated' }] },
		{ operation: 'remove', mutationResponse: { data: null, error: null }, expected: [] },
	] as const)('does not let an old fetch undo $operation', async ({ operation, mutationResponse, expected }) => {
		const oldFetch = deferred<{ data: Row[]; count: number; error: null }>()
		const mock = createSupabaseClientMock([oldFetch.promise, mutationResponse])
		setTestSupabaseClient(mock.client)
		const store = createDbStore<Row>('playlists', { persist: false })()
		if (operation !== 'create') store.addOrUpdate({ id: '1', title: 'Before' })
		const pendingFetch = store.fetchFromSupabase({ merge: false })
		if (operation === 'create') await store.create({ title: 'Created' })
		else if (operation === 'update') await store.update('1', { title: 'Updated' })
		else await store.remove('1')
		oldFetch.resolve({ data: [{ id: '1', title: 'Stale server row' }], count: 1, error: null })
		await pendingFetch
		expect(store.items).toEqual(expected)
		expect(store.stale).toBe(true)
	})

	it('invalidates cached snapshots after a successful mutation', async () => {
		const mock = createSupabaseClientMock([
			{ data: [{ id: '1', title: 'Old' }], count: 1, error: null },
			{ data: [{ id: '1', title: 'Updated' }], error: null },
			{ data: [{ id: '1', title: 'Updated' }], count: 1, error: null },
		])
		setTestSupabaseClient(mock.client)
		const store = createDbStore<Row>('playlists', { persist: false, staleTimeMs: 60_000 })()
		await store.fetchFromSupabase()
		await store.update('1', { title: 'Updated' })
		expect(store.items[0]?.title).toBe('Updated')
		await store.fetchFromSupabase()
		expect(mock.queries).toHaveLength(3)
	})

	it('shares mutation state across consumers of the same Pinia store', async () => {
		const mock = createSupabaseClientMock([
			{ data: { id: '1', title: 'One' }, error: null },
			{ data: [{ id: '1', title: 'Updated' }], error: null },
			{ data: null, error: null },
		])
		setTestSupabaseClient(mock.client)
		const useStore = createDbStore<Row>('shared_playlists', { persist: false })
		const consumerA = useStore()
		const consumerB = useStore()
		expect(consumerA).toBe(consumerB)
		await consumerA.create({ title: 'One' })
		expect(consumerB.items[0]?.title).toBe('One')
		await consumerA.update('1', { title: 'Updated' })
		expect(consumerB.items[0]?.title).toBe('Updated')
		await consumerA.remove('1')
		expect(consumerB.items).toEqual([])
	})

	it('manages realtime INSERT/UPDATE/DELETE idempotently and protects events from stale fetches', async () => {
		const oldFetch = deferred<{ data: Row[]; count: number; error: null }>()
		const mock = createSupabaseClientMock([oldFetch.promise])
		setTestSupabaseClient(mock.client)
		const store = createDbStore<Row>('playlists', { persist: false })()
		const pendingFetch = store.fetchFromSupabase({ merge: false })
		await Promise.resolve()
		await Promise.resolve()
		store.subscribe()
		store.subscribe()
		expect(mock.channels).toHaveLength(1)
		mock.channels[0].emit({ eventType: 'INSERT', new: { id: '2', title: 'Realtime' }, old: {} })
		mock.channels[0].emit({ eventType: 'INSERT', new: { id: '2', title: 'Realtime' }, old: {} })
		expect(store.items).toEqual([{ id: '2', title: 'Realtime' }])
		mock.channels[0].emit({ eventType: 'UPDATE', new: { id: '2', title: 'Changed' }, old: {} })
		expect(store.items[0]?.title).toBe('Changed')
		oldFetch.resolve({ data: [{ id: '1', title: 'Stale' }], count: 1, error: null })
		await pendingFetch
		expect(store.items[0]?.title).toBe('Changed')
		mock.channels[0].emit({ eventType: 'DELETE', new: {}, old: { id: '2' } })
		expect(store.items).toEqual([])
		await store.unsubscribe()
		await store.unsubscribe()
		expect(mock.channels[0].unsubscribed).toBe(true)
	})

	it('invalidates filtered realtime views and closes identity-bound subscriptions on logout', async () => {
		const mock = createSupabaseClientMock([{ data: [{ id: '1', title: 'Rock' }], count: 1, error: null }])
		setTestSupabaseClient(mock.client)
		const store = createDbStore<Row>('playlists', { persist: false })()
		await store.fetchFromSupabase({ where: { title: 'Rock' }, merge: false })
		store.subscribe()
		mock.channels[0].emit({ eventType: 'UPDATE', new: { id: '1', title: 'Jazz' }, old: { id: '1' } })
		expect(store.items[0]?.title).toBe('Rock')
		expect(store.stale).toBe(true)
		setTestSupabaseUser(null)
		await nextTick()
		expect(store.items).toEqual([])
		expect(mock.channels[0].unsubscribed).toBe(true)
	})

	it('does not guess filtered membership after create/update and safely removes deleted rows', async () => {
		const mock = createSupabaseClientMock([
			{ data: [{ id: '1', title: 'Visible' }], count: 1, error: null },
			{ data: { id: '2', title: 'Outside filter' }, error: null },
			{ data: [{ id: '1', title: 'May no longer match' }], error: null },
			{ data: null, error: null },
		])
		setTestSupabaseClient(mock.client)
		const store = createDbStore<Row>('playlists', { persist: false })()
		await store.fetchFromSupabase({ where: { title: 'Visible' } })
		await store.create({ title: 'Outside filter' })
		expect(store.items).toEqual([{ id: '1', title: 'Visible' }])
		await store.update('1', { title: 'May no longer match' })
		expect(store.items).toEqual([{ id: '1', title: 'Visible' }])
		await store.remove('1')
		expect(store.items).toEqual([])
		expect(store.totalCount).toBeNull()
		expect(store.stale).toBe(true)
	})

	it('keeps a bounded number of query snapshots', async () => {
		const responses = Array.from({ length: 22 }, (_, index) => ({
			data: [{ id: String(index), title: `Row ${index}` }], count: 1, error: null,
		}))
		const mock = createSupabaseClientMock(responses)
		setTestSupabaseClient(mock.client)
		const store = createDbStore<Row>('playlists', { persist: false, staleTimeMs: 60_000 })()
		for (let index = 0; index < 21; index++) await store.fetchFromSupabase({ search: String(index) })
		await store.fetchFromSupabase({ search: '0' })
		expect(mock.queries).toHaveLength(22)
	})

	it('invalidates and refreshes after a realtime reconnection', async () => {
		const mock = createSupabaseClientMock([
			{ data: [{ id: '1', title: 'Before disconnect' }], count: 1, error: null },
			{ data: [{ id: '1', title: 'After reconnect' }], count: 1, error: null },
		])
		setTestSupabaseClient(mock.client)
		const store = createDbStore<Row>('playlists', { persist: false })()
		await store.fetchFromSupabase()
		store.subscribe()
		mock.channels[0].emitStatus('CHANNEL_ERROR', new Error('offline'))
		expect(store.stale).toBe(true)
		mock.channels[0].emitStatus('SUBSCRIBED')
		await vi.waitFor(() => expect(store.items[0]?.title).toBe('After reconnect'))
		expect(store.stale).toBe(false)
	})

	it('does not open realtime channels during SSR', () => {
		const mock = createSupabaseClientMock([])
		setTestSupabaseClient(mock.client)
		const store = createDbStore<Row>('playlists', { persist: false })()
		const browserWindow = globalThis.window
		vi.stubGlobal('window', undefined)
		store.subscribe()
		expect(mock.channels).toHaveLength(0)
		vi.stubGlobal('window', browserWindow)
	})

	it('preserves a simple requested order after mutations', async () => {
		const mock = createSupabaseClientMock([
			{ data: [{ id: '1', title: 'Zulu' }], count: 1, error: null },
			{ data: { id: '2', title: 'Alpha' }, error: null },
			{ data: [{ id: '1', title: 'Beta' }], error: null },
		])
		setTestSupabaseClient(mock.client)
		const store = createDbStore<Row>('playlists', { persist: false })()
		await store.fetchFromSupabase({ orderBy: 'title', orderDirection: 'asc' })
		await store.create({ title: 'Alpha' })
		expect(store.items.map(row => row.title)).toEqual(['Alpha', 'Zulu'])
		await store.update('1', { title: 'Beta' })
		expect(store.items.map(row => row.title)).toEqual(['Alpha', 'Beta'])
	})

	it('reuses an identity-validated transferred snapshot without a duplicate hydration fetch', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-09-02T12:00:00Z'))
		const serverMock = createSupabaseClientMock([{ data: [{ id: '1', title: 'SSR' }], count: 1, error: null }])
		setTestSupabaseClient(serverMock.client)
		const useServerStore = createDbStore<Row>('ssr_playlists', { persist: true, scopeToUser: true, staleTimeMs: 60_000 })
		const serverStore = useServerStore()
		serverStore.hydrationReady = true
		await serverStore.fetchFromSupabase()

		setActivePinia(createPinia())
		const clientMock = createSupabaseClientMock([])
		clientMock.client.auth = { getUser: async () => ({ data: { user: { id: 'user-a' } }, error: null }) }
		setTestSupabaseClient(clientMock.client)
		const clientStore = createDbStore<Row>('ssr_playlists', { persist: true, scopeToUser: true, staleTimeMs: 60_000 })()
		clientStore.$patch({
			items: [...serverStore.items],
			totalCount: serverStore.totalCount,
			lastFetchedAt: serverStore.lastFetchedAt,
			lastQueryKey: serverStore.lastQueryKey,
			scopeOwnerId: 'user-a',
		})
		await clientStore.quarantineHydratedState()
		expect(await clientStore.fetchFromSupabase()).toEqual([{ id: '1', title: 'SSR' }])
		expect(clientMock.queries).toHaveLength(0)
	})
})
