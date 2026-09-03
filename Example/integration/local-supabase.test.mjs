import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { introspectDatabase } from '../../Nsdb/scripts/generate-metadata.js'
import { buildRelationCatalog } from '../../Nsdb/helpers/relations.js'

function localCredentials() {
	if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
		return {
			url: process.env.SUPABASE_URL,
			anonKey: process.env.SUPABASE_ANON_KEY,
			serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
			dbUrl: process.env.SUPABASE_DB_URL,
		}
	}

	const cli = path.resolve('node_modules/.bin/supabase')
	const status = JSON.parse(execFileSync(cli, ['status', '--workdir', '..', '-o', 'json'], { encoding: 'utf8' }))
	return {
		url: status.API_URL,
		anonKey: status.ANON_KEY,
		serviceRoleKey: status.SERVICE_ROLE_KEY,
		dbUrl: status.DB_URL,
	}
}

const credentials = localCredentials()
const admin = createClient(credentials.url, credentials.serviceRoleKey, {
	auth: { autoRefreshToken: false, persistSession: false },
})

test('pg_catalog introspection identifies keys, defaults, generated columns and relation topology', async () => {
	assert.ok(credentials.dbUrl, 'local Supabase status must expose DB_URL')
	const metadata = await introspectDatabase({ dbUrl: credentials.dbUrl, schemaName: 'public' })
	const features = metadata.tables.schema_features
	assert.deepEqual(features.primaryKey, ['slug'])
	assert.equal(features.columns.slug.primaryKey, true)
	assert.equal(features.columns.slug.insertable, true)
	assert.equal(features.columns.sequence_id.identity, 'always')
	assert.equal(features.columns.sequence_id.insertable, false)
	assert.equal(features.columns.sequence_by_default.identity, 'byDefault')
	assert.equal(features.columns.sequence_by_default.insertable, true)
	assert.equal(features.columns.computed_label.generated, 'stored')
	assert.equal(features.columns.computed_label.updatable, false)
	assert.equal(features.columns.custom_default.hasDefault, true)
	assert.equal(features.columns.nullable_field.nullable, true)
	assert.equal(features.columns.required_field.nullable, false)
	assert.equal(features.columns.state.enum, true)
	assert.equal(features.columns.uuid_default.dataType, 'uuid')
	assert.equal(features.columns.payload.dataType, 'jsonb')
	assert.match(features.columns.labels.dataType, /\[\]$/)

	const catalog = buildRelationCatalog(metadata, new Set(Object.keys(metadata.tables)))
	assert.ok(catalog.posts.some(relation => relation.alias === 'author' && relation.direction === 'forward'))
	assert.ok(catalog.authors.some(relation => relation.alias === 'sender_messages'))
	assert.ok(catalog.authors.some(relation => relation.alias === 'receiver_messages'))
	assert.ok(catalog.categories.some(relation => relation.alias === 'parent'))
	assert.ok(catalog.categories.some(relation => relation.alias === 'children'))
	assert.ok(catalog.posts.some(relation => relation.alias === 'tags' && relation.kind === 'manyToMany'))
	assert.ok(catalog.composite_children.some(relation => relation.composite === true))
})

test('PostgREST resolves simple, multiple, inverse, self, many-to-many and composite relations', async () => {
	const post = await admin.from('posts')
		.select('*, author:authors!posts_author_id_fkey(*), tags(*)')
		.single()
	assert.ifError(post.error)
	assert.equal(post.data.author.name, 'Ada')
	assert.deepEqual(post.data.tags.map(tag => tag.name).sort(), ['nuxt', 'supabase'])

	const author = await admin.from('authors')
		.select('*, posts!posts_author_id_fkey(*)')
		.eq('name', 'Ada')
		.single()
	assert.ifError(author.error)
	assert.equal(author.data.posts[0].title, 'Typed bridges')

	const message = await admin.from('messages')
		.select('*, sender:authors!messages_sender_id_fkey(*), receiver:authors!messages_receiver_id_fkey(*)')
		.single()
	assert.ifError(message.error)
	assert.equal(message.data.sender.name, 'Ada')
	assert.equal(message.data.receiver.name, 'Grace')

	const category = await admin.from('categories')
		.select('*, parent:parent_id(*)')
		.eq('name', 'Child')
		.single()
	assert.ifError(category.error)
	assert.equal(category.data.parent.name, 'Root')

	const composite = await admin.from('composite_children')
		.select('*, parent:composite_parents!composite_children_tenant_id_parent_code_fkey(*)')
		.single()
	assert.ifError(composite.error)
	assert.equal(composite.data.parent.label, 'Composite parent')
})

async function createTestUser(label) {
	const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`
	const email = `nsdb-${label}-${unique}@example.test`
	const password = `Nsdb-${unique}-password`
	const client = createClient(credentials.url, credentials.anonKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	})
	const { data, error } = await client.auth.signUp({ email, password })
	assert.ifError(error)
	assert.ok(data.user)
	assert.ok(data.session)
	return { client, user: data.user, password }
}

test('local PostgREST and RLS isolate anonymous, user A and user B', async (t) => {
	const userA = await createTestUser('a')
	const userB = await createTestUser('b')
	t.after(async () => {
		await admin.auth.admin.deleteUser(userA.user.id)
		await admin.auth.admin.deleteUser(userB.user.id)
	})

	const createdA = await userA.client
		.from('playlists')
		.insert({ title: 'A private playlist', status: 'published', tags: ['rock'] })
		.select('*, tracks(*)')
		.single()
	assert.ifError(createdA.error)
	assert.equal(createdA.data.user_id, userA.user.id)

	const trackA = await userA.client
		.from('tracks')
		.insert({ playlist_id: createdA.data.id, title: 'A track', position: 0 })
		.select()
		.single()
	assert.ifError(trackA.error)

	const createdB = await userB.client
		.from('playlists')
		.insert({ title: 'B private playlist' })
		.select()
		.single()
	assert.ifError(createdB.error)

	const visibleToA = await userA.client.from('playlists').select('*, tracks(*)').order('created_at')
	assert.ifError(visibleToA.error)
	assert.deepEqual(visibleToA.data.map(row => row.id), [createdA.data.id])
	assert.equal(visibleToA.data[0].tracks[0].title, 'A track')

	const forbiddenRead = await userA.client.from('playlists').select('*').eq('id', createdB.data.id)
	assert.ifError(forbiddenRead.error)
	assert.deepEqual(forbiddenRead.data, [])

	const forbiddenUpdate = await userA.client
		.from('playlists')
		.update({ title: 'Stolen' })
		.eq('id', createdB.data.id)
		.select()
	assert.ifError(forbiddenUpdate.error)
	assert.deepEqual(forbiddenUpdate.data, [])

	const anonymous = createClient(credentials.url, credentials.anonKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	})
	const anonymousRead = await anonymous.from('playlists').select('*')
	assert.ifError(anonymousRead.error)
	assert.deepEqual(anonymousRead.data, [])
	const anonymousInsert = await anonymous.from('playlists').insert({ title: 'Anonymous' })
	assert.ok(anonymousInsert.error)
})

test('two authenticated clients receive RLS-safe realtime INSERT, UPDATE and DELETE events', async (t) => {
	const listener = await createTestUser('realtime')
	const outsider = await createTestUser('realtime-outsider')
	const actor = createClient(credentials.url, credentials.anonKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	})
	const email = listener.user.email
	assert.ok(email)
	// The local fixture confirms emails automatically; create a second session
	// for the same identity so RLS admits the event to the listener.
	assert.ifError((await actor.auth.signInWithPassword({ email, password: listener.password })).error)

	const received = []
	const outsiderEvents = []
	let notify
	const waitForEvent = (eventType, predicate = () => true, timeoutMs = 5_000) => new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error(`Timed out waiting for realtime ${eventType}`)), timeoutMs)
		notify = payload => {
			if (payload.eventType !== eventType || !predicate(payload)) return
			clearTimeout(timeout)
			resolve(payload)
		}
	})
	const channel = listener.client
		.channel(`component-records-${Date.now()}`)
		.on('postgres_changes', { event: '*', schema: 'public', table: 'component_records' }, payload => {
			received.push(payload)
			notify?.(payload)
		})
	await new Promise((resolve, reject) => {
		channel.subscribe((status, error) => {
			if (status === 'SUBSCRIBED') resolve()
			else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(error ?? new Error(status))
		})
	})
	const outsiderChannel = outsider.client
		.channel(`component-records-outsider-${Date.now()}`)
		.on('postgres_changes', { event: '*', schema: 'public', table: 'component_records' }, payload => outsiderEvents.push(payload))
	await new Promise((resolve, reject) => {
		outsiderChannel.subscribe((status, error) => {
			if (status === 'SUBSCRIBED') resolve()
			else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(error ?? new Error(status))
		})
	})

	t.after(async () => {
		await listener.client.removeChannel(channel)
		await outsider.client.removeChannel(outsiderChannel)
		await admin.from('component_records').delete().eq('user_id', listener.user.id)
		await admin.auth.admin.deleteUser(listener.user.id)
		await admin.auth.admin.deleteUser(outsider.user.id)
	})

	let inserted
	let receivedInsert
	for (let attempt = 1; attempt <= 3; attempt++) {
		const title = `Realtime ${Date.now()}-${attempt}`
		const insertEvent = waitForEvent('INSERT', payload => payload.new?.title === title)
		inserted = await actor.from('component_records').insert({ title }).select().single()
		assert.ifError(inserted.error)
		try {
			receivedInsert = await insertEvent
			break
		} catch (error) {
			if (attempt === 3) throw error
		}
	}
	assert.ok(inserted?.data && receivedInsert)
	assert.equal(receivedInsert.new.id, inserted.data.id)

	const updateEvent = waitForEvent('UPDATE', payload => payload.new?.id === inserted.data.id)
	assert.ifError((await actor.from('component_records').update({ notes: 'updated remotely' }).eq('id', inserted.data.id)).error)
	assert.equal((await updateEvent).new.notes, 'updated remotely')

	const deleteEvent = waitForEvent('DELETE', payload => payload.old?.id === inserted.data.id)
	assert.ifError((await actor.from('component_records').delete().eq('id', inserted.data.id)).error)
	assert.equal((await deleteEvent).old.id, inserted.data.id)
	assert.deepEqual(
		received.filter(event => event.new?.id === inserted.data.id || event.old?.id === inserted.data.id).map(event => event.eventType),
		['INSERT', 'UPDATE', 'DELETE'],
	)
	await new Promise(resolve => setTimeout(resolve, 50))
	assert.deepEqual(
		outsiderEvents.filter(event => event.eventType !== 'DELETE'),
		[],
		'RLS must suppress another user\'s realtime row values',
	)
	assert.deepEqual(outsiderEvents.map(event => event.eventType), ['DELETE'])
	assert.deepEqual(Object.keys(outsiderEvents[0].old), ['id'], 'cross-user DELETE exposes no row values beyond the replica key')
})

test('local Storage enforces user prefixes and supports the complete file lifecycle', async (t) => {
	const userA = await createTestUser('storage-a')
	const userB = await createTestUser('storage-b')
	const bucket = 'nsdb-private'
	const originalPath = `${userA.user.id}/nested/file with spaces.txt`
	const copiedPath = `${userA.user.id}/nested/copied file.txt`
	const movedPath = `${userA.user.id}/archive/moved file.txt`
	t.after(async () => {
		await admin.storage.from(bucket).remove([originalPath, copiedPath, movedPath])
		await admin.auth.admin.deleteUser(userA.user.id)
		await admin.auth.admin.deleteUser(userB.user.id)
	})

	const uploaded = await userA.client.storage.from(bucket).upload(originalPath, new Blob(['hello']), {
		contentType: 'text/plain',
	})
	assert.ifError(uploaded.error)

	const listed = await userA.client.storage.from(bucket).list(`${userA.user.id}/nested`)
	assert.ifError(listed.error)
	assert.ok(listed.data.some(file => file.name === 'file with spaces.txt'))

	const downloaded = await userA.client.storage.from(bucket).download(originalPath)
	assert.ifError(downloaded.error)
	assert.equal(await downloaded.data.text(), 'hello')

	const updated = await userA.client.storage.from(bucket).update(originalPath, new Blob(['updated']))
	assert.ifError(updated.error)
	const signed = await userA.client.storage.from(bucket).createSignedUrl(originalPath, 60)
	assert.ifError(signed.error)
	assert.match(signed.data.signedUrl, /token=/)

	assert.ifError((await userA.client.storage.from(bucket).copy(originalPath, copiedPath)).error)
	assert.ifError((await userA.client.storage.from(bucket).move(copiedPath, movedPath)).error)

	const forbidden = await userB.client.storage.from(bucket).download(originalPath)
	assert.ok(forbidden.error)

	const removed = await userA.client.storage.from(bucket).remove([originalPath, movedPath])
	assert.ifError(removed.error)
})

test('local service client covers bucket create, list, update, empty and delete', async () => {
	const bucketName = `nsdb-admin-${Date.now()}`
	const created = await admin.storage.createBucket(bucketName, { public: false })
	assert.ifError(created.error)
	try {
		const listed = await admin.storage.listBuckets()
		assert.ifError(listed.error)
		assert.ok(listed.data.some(bucket => bucket.name === bucketName))
		assert.ifError((await admin.storage.updateBucket(bucketName, { public: true })).error)
		assert.ifError((await admin.storage.emptyBucket(bucketName)).error)
	} finally {
		assert.ifError((await admin.storage.deleteBucket(bucketName)).error)
	}
})
