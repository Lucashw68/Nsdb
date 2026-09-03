import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NsdbList from '../../runtime/components/NsdbList.vue'
import NsdbForm from '../../runtime/components/NsdbForm.vue'
import { clearTestModels, setTestModel } from './fixtures/registry'
import { PlaylistsSchema } from './fixtures/schemas'
import { setTestSupabaseUser } from './fixtures/nuxt-imports'

function listModel(rows: Array<Record<string, unknown>> = []) {
	const items = ref(rows)
	const totalCount = ref<number | null>(rows.length)
	return {
		items,
		totalCount,
		fetch: vi.fn(async () => items.value),
		remove: vi.fn(async () => {}),
	}
}

function formModel(overrides: Record<string, unknown> = {}) {
	return {
		items: ref([]),
		schema: PlaylistsSchema,
		createDraft: () => ({
			id: null,
			title: null,
			description: null,
			published_at: null,
			attachment: null,
			status: null,
			active: false,
			internal_note: 'Hidden note',
			server_secret: 'Never expose',
		}),
		getById: vi.fn(async () => null),
		create: vi.fn(async (payload) => ({ id: 'created', ...payload })),
		update: vi.fn(async (id, payload) => ({ id, ...payload })),
		...overrides,
	}
}

function deferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (reason?: unknown) => void
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise
		reject = rejectPromise
	})
	return { promise, resolve, reject }
}

describe('NsdbList public behavior', () => {
	beforeEach(() => {
		clearTestModels()
		setTestSupabaseUser(null)
	})
	afterEach(() => vi.useRealTimers())

	it('renders successful rows, custom cells and pagination metadata', async () => {
		const model = listModel([{ id: '1', title: 'Rock' }])
		model.totalCount.value = 3
		setTestModel('playlists', () => model)
		const wrapper = mount(NsdbList, {
			props: {
				model: 'playlists',
				columns: [{ key: 'title', label: 'Title' }],
				pageSize: 1,
			},
			slots: {
				cell: ({ value }: { value: unknown }) => h('strong', { class: 'custom-cell' }, String(value)),
			},
		})
		await flushPromises()

		expect(model.fetch).toHaveBeenCalledWith(expect.objectContaining({ limit: 1, offset: 0 }))
		expect(wrapper.get('.custom-cell').text()).toBe('Rock')
		expect(wrapper.text()).toContain('page 1 / 3')
		expect(wrapper.text()).toContain('Suivant')
	})

	it('renders empty and error states distinctly', async () => {
		const warning = vi.spyOn(console, 'warn')
		const empty = listModel([])
		setTestModel('playlists', () => empty)
		const emptyWrapper = mount(NsdbList, { props: { model: 'playlists' } })
		await flushPromises()
		expect(emptyWrapper.text()).toContain('Aucune donnée')

		const failed = listModel([])
		failed.fetch.mockRejectedValueOnce(new Error('RLS denied'))
		setTestModel('failed', () => failed)
		const errorWrapper = mount(NsdbList, { props: { model: 'failed' } })
		await flushPromises()
		expect(errorWrapper.text()).toContain('RLS denied')
		expect(errorWrapper.text()).not.toContain('Aucun résultat')
		expect(warning).not.toHaveBeenCalled()
		warning.mockRestore()
	})

	it('debounces search and sends filters, sorting and pagination to the model', async () => {
		vi.useFakeTimers()
		const model = listModel([{ id: '1', title: 'Rock' }])
		setTestModel('playlists', () => model)
		const wrapper = mount(NsdbList, {
			props: {
				model: 'playlists',
				columns: [{ key: 'title', label: 'Title' }],
				filters: { active: true },
				searchable: true,
				searchColumns: ['title'],
				searchDebounceMs: 20,
				pageSize: 1,
			},
		})
		await flushPromises()
		await wrapper.get('input[placeholder="Rechercher..."]').setValue('rock')
		await vi.advanceTimersByTimeAsync(20)
		await flushPromises()

		expect(model.fetch).toHaveBeenLastCalledWith(expect.objectContaining({
			where: { active: true },
			search: 'rock',
			searchColumns: ['title'],
			limit: 1,
			offset: 0,
		}))
	})

	it('re-resolves the registry when the model prop changes', async () => {
		const playlists = listModel([{ id: '1', title: 'Playlist' }])
		const songs = listModel([{ id: '2', title: 'Song' }])
		setTestModel('playlists', () => playlists)
		setTestModel('songs', () => songs)
		const wrapper = mount(NsdbList, { props: { model: 'playlists' } })
		await flushPromises()
		await wrapper.setProps({ model: 'songs' })
		await flushPromises()

		expect(songs.fetch).toHaveBeenCalled()
		expect(wrapper.text()).toContain('Song')
	})

	it('omits hidden, non-selectable and server-only schema columns from inferred rendering', async () => {
		const model = listModel([{
			id: '1',
			title: 'Visible title',
			internal_note: 'Hidden note',
			server_secret: 'Never expose',
		}])
		setTestModel('playlists', () => model)
		const wrapper = mount(NsdbList, { props: { model: 'playlists' } })
		await flushPromises()

		expect(wrapper.text()).toContain('Visible title')
		expect(wrapper.text()).not.toContain('Hidden note')
		expect(wrapper.text()).not.toContain('Never expose')
	})

	it('uses accessible sorting controls and exposes delete failures', async () => {
		const model = listModel([{ id: '1', title: 'Rock' }])
		model.remove.mockRejectedValueOnce(new Error('RLS delete denied'))
		setTestModel('playlists', () => model)
		const wrapper = mount(NsdbList, {
			props: { model: 'playlists', columns: [{ key: 'title', label: 'Title' }] },
		})
		await flushPromises()

		const sort = wrapper.get('th button')
		expect(sort.attributes('aria-label')).toBe('Trier par Title')
		expect(wrapper.get('th').attributes('aria-sort')).toBe('none')
		await sort.trigger('click')
		await flushPromises()
		expect(wrapper.get('th').attributes('aria-sort')).toBe('ascending')
		const remove = wrapper.get('button[aria-label="Supprimer la ligne"]')
		await remove.trigger('click')
		await flushPromises()
		expect(wrapper.text()).toContain('RLS delete denied')
	})

	it('renders relation objects with a neutral fallback instead of object coercion', async () => {
		const model = listModel([{ id: '1', author: { id: 'a', name: 'Ada' }, tags: [{ id: 't' }] }])
		setTestModel('relations', () => model)
		const wrapper = mount(NsdbList, {
			props: {
				model: 'relations',
				columns: [{ key: 'author', label: 'Author' }, { key: 'tags', label: 'Tags' }],
			},
		})
		await flushPromises()
		expect(wrapper.text()).not.toContain('[object Object]')
		expect(wrapper.text()).toContain('1 élément')
	})

	it('quarantines rendered rows synchronously when the authenticated identity changes', async () => {
		const nextFetch = deferred<Array<Record<string, unknown>>>()
		const model = listModel([{ id: 'a', title: 'Private A' }])
		setTestModel('playlists', () => model)
		setTestSupabaseUser({ id: 'user-a' })
		const wrapper = mount(NsdbList, { props: { model: 'playlists', columns: [{ key: 'title', label: 'Title' }] } })
		await flushPromises()
		expect(wrapper.text()).toContain('Private A')
		model.fetch.mockImplementationOnce(() => nextFetch.promise as Promise<any[]>)

		setTestSupabaseUser({ id: 'user-b' })
		expect(model.items.value).toEqual([])
		await nextTick()
		expect(wrapper.text()).not.toContain('Private A')
		nextFetch.resolve([])
		await flushPromises()
	})

	it('uses the optional store-backed model without changing the component API', async () => {
		const model = listModel([{ id: '1', title: 'Stored' }])
		const factory = vi.fn(() => model)
		setTestModel('playlists', factory)
		const wrapper = mount(NsdbList, { props: { model: 'playlists', store: true, columns: [{ key: 'title', label: 'Title' }] } })
		await flushPromises()

		expect(factory).toHaveBeenCalledWith({ store: true })
		expect(wrapper.text()).toContain('Stored')
	})

	it('exposes only the canonical refresh controller', async () => {
		const model = listModel([{ id: '1', title: 'Stored' }])
		setTestModel('playlists', () => model)
		let controller: Record<string, unknown> = {}
		const wrapper = mount(NsdbList, {
			props: { model: 'playlists' },
			slots: { default: (slotProps: Record<string, unknown>) => { controller = slotProps; return h('div') } },
		})
		await flushPromises()

		expect(typeof (wrapper.vm as any).refresh).toBe('function')
		expect(typeof controller.refresh).toBe('function')
		expect('reload' in controller).toBe(false)
	})
})

describe('NsdbForm public behavior', () => {
	beforeEach(() => {
		clearTestModels()
		setTestSupabaseUser(null)
	})

	it('validates required fields before creation', async () => {
		const model = formModel()
		setTestModel('playlists', () => model)
		const wrapper = mount(NsdbForm, { props: { model: 'playlists' } })
		await flushPromises()
		await wrapper.get('form').trigger('submit')

		expect(wrapper.text()).toContain('Ce champ est obligatoire')
		expect(model.create).not.toHaveBeenCalled()
	})

	it('creates from text, textarea, datetime, enum and checkbox controls and emits public events', async () => {
		const model = formModel()
		setTestModel('playlists', () => model)
		const wrapper = mount(NsdbForm, {
			props: { model: 'playlists', initialValues: { description: 'Initial' } },
		})
		await flushPromises()
		expect(wrapper.find('input[name="id"]').exists()).toBe(false)
		await wrapper.get('input[name="title"]').setValue('New playlist')
		await wrapper.get('textarea').setValue('Description')
		await wrapper.get('input[type="datetime-local"]').setValue('2026-09-01T12:00')
		await wrapper.get('select').setValue('published')
		await wrapper.get('input[type="checkbox"]').setValue(true)
		await wrapper.get('form').trigger('submit')
		await flushPromises()

		expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
			title: 'New playlist',
			description: 'Description',
			published_at: '2026-09-01T12:00',
			status: 'published',
			active: true,
		}))
		expect(model.create).toHaveBeenCalledWith(expect.not.objectContaining({ id: expect.anything() }))
		expect(wrapper.emitted('created')).toHaveLength(1)
		expect(wrapper.emitted('saved')).toHaveLength(1)
	})

	it('loads edit values, updates them, and emits updated/saved', async () => {
		const model = formModel({
			getById: vi.fn(async () => ({ id: '1', title: 'Old', status: 'draft', active: false })),
		})
		setTestModel('playlists', () => model)
		const wrapper = mount(NsdbForm, { props: { model: 'playlists', id: '1' } })
		await flushPromises()
		const title = wrapper.get('input[name="title"]')
		await title.setValue('Updated')
		await wrapper.get('form').trigger('submit')
		await flushPromises()

		expect(model.getById).toHaveBeenCalledWith('1')
		expect(model.update).toHaveBeenCalledWith('1', expect.objectContaining({ title: 'Updated' }))
		expect(wrapper.emitted('updated')).toHaveLength(1)
		expect(wrapper.emitted('saved')).toHaveLength(1)
	})

	it('emits model failures and does not emit saved', async () => {
		const failure = new Error('Supabase insert failed')
		const model = formModel({ create: vi.fn(async () => { throw failure }) })
		setTestModel('playlists', () => model)
		const wrapper = mount(NsdbForm, { props: { model: 'playlists', initialValues: { title: 'Ready' } } })
		await flushPromises()
		await wrapper.get('form').trigger('submit')
		await flushPromises()

		expect(wrapper.text()).toContain('Supabase insert failed')
		expect(wrapper.emitted('error')?.[0]).toEqual([failure])
		expect(wrapper.emitted('saved')).toBeUndefined()
	})

	it('does not render hidden/server-only metadata and never submits server-only fields', async () => {
		const model = formModel()
		setTestModel('playlists', () => model)
		const wrapper = mount(NsdbForm, {
			props: {
				model: 'playlists',
				initialValues: { title: 'Ready', internal_note: 'Allowed hidden value', server_secret: 'Forbidden' },
			},
		})
		await flushPromises()

		expect(wrapper.text()).not.toContain('Internal note')
		expect(wrapper.text()).not.toContain('Server secret')
		await wrapper.get('form').trigger('submit')
		await flushPromises()
		expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ internal_note: 'Allowed hidden value' }))
		expect(model.create).toHaveBeenCalledWith(expect.not.objectContaining({ server_secret: expect.anything() }))
	})

	it('re-resolves schema and values when model changes', async () => {
		const playlists = formModel()
		const profiles = formModel({
			schema: { display_name: { label: 'Display name', type: 'text', required: true } },
			createDraft: () => ({ display_name: null }),
		})
		setTestModel('playlists', () => playlists)
		setTestModel('profiles', () => profiles)
		const wrapper = mount(NsdbForm, { props: { model: 'playlists', initialValues: { title: 'Old' } } })
		await flushPromises()
		await wrapper.setProps({ model: 'profiles', initialValues: { display_name: 'Ada' } })
		await flushPromises()

		expect(wrapper.text()).toContain('Display name')
		expect(wrapper.text()).not.toContain('Title')
		expect(wrapper.get('input[type="text"]').element.value).toBe('Ada')
	})

	it('ignores an older item response after a rapid id change', async () => {
		const first = deferred<Record<string, any> | null>()
		const second = deferred<Record<string, any> | null>()
		const model = formModel({
			getById: vi.fn((id: string) => id === 'a' ? first.promise : second.promise),
		})
		setTestModel('playlists', () => model)
		const wrapper = mount(NsdbForm, { props: { model: 'playlists', id: 'a' } })
		await wrapper.setProps({ id: 'b' })
		second.resolve({ id: 'b', title: 'Second' })
		await flushPromises()
		first.resolve({ id: 'a', title: 'First' })
		await flushPromises()

		const title = wrapper.get('input[name="title"]')
		expect(title.element.value).toBe('Second')
	})

	it('omits untouched database defaults and normalizes empty nullable numbers to null', async () => {
		const schema = {
			title: { label: 'Title', type: 'text', required: true, nullable: false, insertable: true, updatable: true },
			custom_default: { label: 'Default', type: 'text', hasDefault: true, nullable: false, insertable: true, updatable: true },
			score: { label: 'Score', type: 'number', nullable: true, insertable: true, updatable: true },
		}
		const model = formModel({ schema, createDraft: () => ({ title: null, custom_default: undefined, score: 5 }) })
		setTestModel('features', () => model)
		const wrapper = mount(NsdbForm, { props: { model: 'features', initialValues: { title: 'Ready' } } })
		await flushPromises()
		await wrapper.get('input[type="number"]').setValue('')
		await wrapper.get('form').trigger('submit')
		await flushPromises()

		expect(model.create).toHaveBeenCalledWith({ title: 'Ready', score: null })
	})

	it('keeps Insert and Update field policies distinct', async () => {
		const schema = {
			insert_only: { label: 'Insert only', type: 'text', insertable: true, updatable: false },
			update_only: { label: 'Update only', type: 'text', insertable: false, updatable: true },
		}
		const createModel = formModel({ schema, createDraft: () => ({ insert_only: 'create', update_only: 'never' }) })
		setTestModel('policies', () => createModel)
		const createWrapper = mount(NsdbForm, { props: { model: 'policies' } })
		await flushPromises()
		expect(createWrapper.text()).toContain('Insert only')
		expect(createWrapper.text()).not.toContain('Update only')
		await createWrapper.get('form').trigger('submit')
		await flushPromises()
		expect(createModel.create).toHaveBeenCalledWith({ insert_only: 'create' })

		const updateModel = formModel({
			schema,
			getById: vi.fn(async () => ({ insert_only: 'fixed', update_only: 'change' })),
		})
		setTestModel('policies', () => updateModel)
		const updateWrapper = mount(NsdbForm, { props: { model: 'policies', id: '1' } })
		await flushPromises()
		await updateWrapper.get('form').trigger('submit')
		await flushPromises()
		expect(updateModel.update).toHaveBeenCalledWith('1', { update_only: 'change' })
	})

	it('rejects invalid JSON without losing form data and allows retry', async () => {
		const schema = {
			payload: { label: 'Payload', type: 'json', nullable: true, insertable: true, updatable: true },
		}
		const model = formModel({ schema, createDraft: () => ({ payload: null }) })
		setTestModel('documents', () => model)
		const wrapper = mount(NsdbForm, { props: { model: 'documents' } })
		await flushPromises()
		await wrapper.get('textarea').setValue('{bad')
		await wrapper.get('form').trigger('submit')
		await flushPromises()

		expect(model.create).not.toHaveBeenCalled()
		expect(wrapper.text()).toContain('JSON valide')
		expect(wrapper.get('textarea').element.value).toBe('{bad')
		await wrapper.get('textarea').setValue('{"ok":true}')
		await wrapper.get('form').trigger('submit')
		await flushPromises()
		expect(model.create).toHaveBeenCalledWith({ payload: { ok: true } })
	})

	it('prevents double submit and preserves created then saved event order', async () => {
		const pending = deferred<Record<string, any>>()
		const model = formModel({ create: vi.fn(() => pending.promise) })
		setTestModel('playlists', () => model)
		const wrapper = mount(NsdbForm, { props: { model: 'playlists', initialValues: { title: 'Ready' } } })
		await flushPromises()
		const form = wrapper.get('form')
		await form.trigger('submit')
		await form.trigger('submit')
		expect(model.create).toHaveBeenCalledTimes(1)
		expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
		pending.resolve({ id: '1', title: 'Ready' })
		await flushPromises()
		expect(Object.keys(wrapper.emitted()).filter(name => name === 'created' || name === 'saved')).toEqual(['created', 'saved'])
	})

	it('renders duplicate target relations independently and preserves numeric foreign keys', async () => {
		const schema = {
			sender_id: { label: 'Sender', type: 'relation', required: true, databaseType: 'bigint', insertable: true, updatable: true, relation: { kind: 'belongsTo', referencedTable: 'users', localColumns: ['sender_id'], referencedColumns: ['id'], foreignKeyName: 'messages_sender_id_fkey' } },
			receiver_id: { label: 'Receiver', type: 'relation', required: true, databaseType: 'bigint', insertable: true, updatable: true, relation: { kind: 'belongsTo', referencedTable: 'users', localColumns: ['receiver_id'], referencedColumns: ['id'], foreignKeyName: 'messages_receiver_id_fkey' } },
		}
		const users = listModel([{ id: 1 }, { id: 2 }])
		const messages = formModel({ schema, createDraft: () => ({ sender_id: null, receiver_id: null }) })
		setTestModel('users', () => users)
		setTestModel('messages', () => messages)
		const wrapper = mount(NsdbForm, { props: { model: 'messages' } })
		await flushPromises()

		expect(wrapper.findAll('select')).toHaveLength(2)
		await wrapper.get('select[name="sender_id"]').setValue('1')
		await wrapper.get('select[name="receiver_id"]').setValue('2')
		await wrapper.get('form').trigger('submit')
		await flushPromises()
		expect(messages.create).toHaveBeenCalledWith({ sender_id: 1, receiver_id: 2 })
	})

	it('creates an inline relation before the parent and selects its primary key', async () => {
		const schema = {
			author_id: { label: 'Author', type: 'relation', required: true, insertable: true, updatable: true, relation: { kind: 'belongsTo', referencedTable: 'authors', localColumns: ['author_id'], referencedColumns: ['slug'], displayField: 'name', allowInlineCreate: true } },
			title: { label: 'Title', type: 'text', required: true, insertable: true, updatable: true },
		}
		const authors = formModel({ schema: {}, create: vi.fn(async payload => ({ slug: 'ada', ...payload })), fetch: vi.fn(async () => []) })
		const posts = formModel({ schema, createDraft: () => ({ author_id: null, title: null }) })
		setTestModel('authors', () => authors)
		setTestModel('posts', () => posts)
		const wrapper = mount(NsdbForm, { props: { model: 'posts' } })
		await flushPromises()

		const inlineToggle = wrapper.findAll('button[type="button"]').find(button => button.text() === 'Créer')!
		await inlineToggle.trigger('click')
		await wrapper.get('input[name="author_id"]').setValue('Ada')
		await wrapper.get('input[name="title"]').setValue('Post')
		await wrapper.get('form').trigger('submit')
		await flushPromises()
		expect(authors.create).toHaveBeenCalledWith({ name: 'Ada' })
		expect(posts.create).toHaveBeenCalledWith({ author_id: 'ada', title: 'Post' })
	})

	it('accepts lightweight custom validation without changing the simple case', async () => {
		const model = formModel()
		setTestModel('playlists', () => model)
		const validate = vi.fn(() => ({ title: 'Ce titre est déjà utilisé.' }))
		const wrapper = mount(NsdbForm, { props: { model: 'playlists', initialValues: { title: 'Duplicate' }, validate } })
		await flushPromises()
		await wrapper.get('form').trigger('submit')
		await flushPromises()

		expect(validate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Duplicate' }), { mode: 'create', model: 'playlists' })
		expect(wrapper.text()).toContain('Ce titre est déjà utilisé.')
		expect(model.create).not.toHaveBeenCalled()
	})

	it('passes store mode through the same form surface', async () => {
		const model = formModel()
		const factory = vi.fn(() => model)
		setTestModel('playlists', factory)
		const wrapper = mount(NsdbForm, { props: { model: 'playlists', store: true, initialValues: { title: 'Stored create' } } })
		await flushPromises()
		await wrapper.get('form').trigger('submit')
		await flushPromises()

		expect(factory).toHaveBeenCalledWith({ store: true })
		expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Stored create' }))
	})

	it('associates labels and errors and supports a focused per-field slot', async () => {
		const model = formModel()
		setTestModel('playlists', () => model)
		const wrapper = mount(NsdbForm, {
			props: { model: 'playlists' },
			attachTo: document.body,
			slots: {
				'field-description': ({ value, update }: any) => h('input', {
					class: 'custom-description', value, onInput: (event: Event) => update((event.target as HTMLInputElement).value),
				}),
			},
		})
		await flushPromises()
		const titleLabel = wrapper.findAll('label').find(label => label.text() === 'Title')!
		const titleId = titleLabel.attributes('for')
		expect(titleId).toBeTruthy()
		expect(wrapper.get(`#${titleId}`).attributes('name')).toBe('title')
		await wrapper.get('form').trigger('submit')
		await flushPromises()
		const title = wrapper.get(`#${titleId}`)
		expect(title.attributes('aria-invalid')).toBe('true')
		expect(title.attributes('aria-describedby')).toBeTruthy()
		expect(document.activeElement).toBe(title.element)
		expect(wrapper.find('.custom-description').exists()).toBe(true)
		wrapper.unmount()
	})
})
