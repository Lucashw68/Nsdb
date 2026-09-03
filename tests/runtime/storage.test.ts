import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setTestSupabaseClient } from './fixtures/nuxt-imports'
import { useSupabaseApiStorage } from '../../runtime/composables/useSupabaseApiStorage'
import {
	applySearchFilter,
	joinPath,
	normalizeBucketName,
	normalizeFilePath,
	normalizePath,
} from '../../runtime/utils/storage'

function successfulStorageClient() {
	const fileApi = {
		list: vi.fn(async () => ({ data: [{ name: 'Rock File.mp3' }, { name: 'jazz.mp3' }], error: null })),
		upload: vi.fn(async (path) => ({ data: { path }, error: null })),
		update: vi.fn(async (path) => ({ data: { path }, error: null })),
		download: vi.fn(async () => ({ data: new Blob(['audio']), error: null })),
		remove: vi.fn(async paths => ({ data: paths.map((name: string) => ({ name })), error: null })),
		getPublicUrl: vi.fn(path => ({ data: { publicUrl: `http://local/${path}` } })),
		createSignedUrl: vi.fn(async path => ({ data: { signedUrl: `signed:${path}` }, error: null })),
		createSignedUrls: vi.fn(async paths => ({ data: paths.map((path: string) => ({ path, signedUrl: `signed:${path}` })), error: null })),
		createSignedUploadUrl: vi.fn(async path => ({ data: { path, token: 'token', signedUrl: 'signed-upload' }, error: null })),
		uploadToSignedUrl: vi.fn(async path => ({ data: { path }, error: null })),
		move: vi.fn(async (from, to) => ({ data: { from, to }, error: null })),
		copy: vi.fn(async (from, to) => ({ data: { from, to }, error: null })),
	}
	const storage = {
		from: vi.fn(() => fileApi),
		listBuckets: vi.fn(async () => ({ data: [{ id: 'samples' }], error: null })),
		getBucket: vi.fn(async id => ({ data: { id }, error: null })),
		createBucket: vi.fn(async id => ({ data: { name: id }, error: null })),
		updateBucket: vi.fn(async id => ({ data: { name: id }, error: null })),
		deleteBucket: vi.fn(async id => ({ data: { name: id }, error: null })),
		emptyBucket: vi.fn(async id => ({ data: { name: id }, error: null })),
	}
	return { client: { storage }, storage, fileApi }
}

describe('Storage normalization', () => {
	it('normalizes nested paths while preserving valid spaces', () => {
		expect(normalizePath(' / users / Lucas / my file.png / ')).toBe('users/Lucas/my file.png')
		expect(joinPath('/users/', null, 'Lucas', 42, ' avatar.png ')).toBe('users/Lucas/42/avatar.png')
		expect(normalizeFilePath(' users/avatar.png ')).toBe('users/avatar.png')
	})

	it('rejects empty files/buckets and ambiguous relative segments', () => {
		expect(() => normalizeFilePath(' /// ')).toThrow(/file path is required/)
		expect(() => normalizePath('users/../secret')).toThrow(/Relative path segments/)
		expect(() => normalizeBucketName('   ')).toThrow(/bucket name is required/)
	})

	it('filters file names case-insensitively without mutating input', () => {
		const files = [{ name: 'Rock File.mp3' }, { name: 'jazz.mp3' }, {}]
		expect(applySearchFilter(files, 'ROCK')).toEqual([{ name: 'Rock File.mp3' }])
		expect(files).toHaveLength(3)
	})
})

describe('useSupabaseApiStorage', () => {
	beforeEach(() => setTestSupabaseClient(null))

	it('covers file operations, nested paths and URL helpers', async () => {
		const mock = successfulStorageClient()
		setTestSupabaseClient(mock.client)
		const api = useSupabaseApiStorage()
		const body = new Blob(['audio'])

		expect((await api.list(' samples ', { path: '/nested/', search: 'rock' })).data).toEqual([{ name: 'Rock File.mp3' }])
		await api.upload('samples', '/nested/new file.mp3', body, { upsert: true })
		await api.update('samples', 'nested/new file.mp3', body)
		expect((await api.download('samples', 'nested/new file.mp3')).data).toBeInstanceOf(Blob)
		await api.remove('samples', ['nested/new file.mp3', '/nested/other.mp3'])
		expect(api.getPublicUrl('samples', '/nested/new file.mp3')).toBe('http://local/nested/new file.mp3')
		expect((await api.createSignedUrl('samples', 'nested/new file.mp3')).success).toBe(true)
		expect((await api.createSignedUrls('samples', ['nested/a', 'nested/b'])).data).toHaveLength(2)
		expect((await api.createSignedUploadUrl('samples', 'nested/upload')).success).toBe(true)
		expect((await api.uploadToSignedUrl('samples', 'nested/upload', 'token', body)).success).toBe(true)
		expect((await api.move('samples', 'nested/a', 'archive/a')).success).toBe(true)
		expect((await api.copy('samples', 'archive/a', 'archive/b')).success).toBe(true)

		expect(mock.storage.from).toHaveBeenCalledWith('samples')
		expect(mock.fileApi.list).toHaveBeenCalledWith('nested', expect.objectContaining({ limit: 100, offset: 0 }))
		expect(mock.fileApi.upload).toHaveBeenCalledWith('nested/new file.mp3', body, { upsert: true })
	})

	it('covers bucket administration and normalizes every bucket name', async () => {
		const mock = successfulStorageClient()
		setTestSupabaseClient(mock.client)
		const api = useSupabaseApiStorage()

		expect((await api.listBuckets()).data).toEqual([{ id: 'samples' }])
		await api.getBucket(' samples ')
		await api.createBucket(' samples ', { public: true, allowedMimeTypes: ['audio/mpeg'] })
		await api.updateBucket(' samples ', { fileSizeLimit: '10MB' })
		await api.emptyBucket(' samples ')
		await api.deleteBucket(' samples ')

		expect(mock.storage.getBucket).toHaveBeenCalledWith('samples')
		expect(mock.storage.createBucket).toHaveBeenCalledWith('samples', {
			public: true,
			allowedMimeTypes: ['audio/mpeg'],
			fileSizeLimit: undefined,
		})
	})

	it('returns stable fallbacks on missing bucket/object or permission errors', async () => {
		const error = { message: 'Bucket not found' }
		const fileApi = { list: vi.fn(async () => ({ data: null, error })) }
		setTestSupabaseClient({ storage: { from: vi.fn(() => fileApi) } })
		vi.spyOn(console, 'error').mockImplementation(() => {})

		expect(await useSupabaseApiStorage().list('missing')).toEqual({
			success: false,
			error,
			data: [],
		})
	})

	it('fails clearly without a Supabase client', () => {
		expect(() => useSupabaseApiStorage()).toThrow(/Supabase client not found/)
	})
})
