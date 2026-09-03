import { useSupabaseClient } from '#imports'
import type { OrderDirection } from '@lucashw68/nsdb/types/list'
import {
	applySearchFilter,
	joinPath,
	normalizeBucketName,
	normalizeDirectoryPath,
	normalizeFilePath,
	normalizePath,
} from '../utils/storage'

export {
	applySearchFilter,
	joinPath,
	normalizeBucketName,
	normalizeDirectoryPath,
	normalizeFilePath,
	normalizePath,
} from '../utils/storage'

export type StorageFileBody = File | Blob | ArrayBuffer | ArrayBufferView | FormData | string

export type StorageOrderBy =
	| 'name'
	| 'created_at'
	| 'updated_at'
	| 'last_accessed_at'

export type StorageImageResizeMode = 'cover' | 'contain' | 'fill'
export type StorageImageFormat = 'origin' | 'webp' | 'png' | 'jpeg'

export interface StorageImageTransformOptions {
	width?: number
	height?: number
	resize?: StorageImageResizeMode
	quality?: number
	format?: StorageImageFormat
}

export interface StorageListOptions {
	path?: string
	limit?: number
	offset?: number
	orderBy?: StorageOrderBy
	orderDirection?: OrderDirection
	search?: string
}

export interface StorageWriteOptions {
	cacheControl?: string
	contentType?: string
	metadata?: Record<string, unknown>
	upsert?: boolean
}

export interface StorageDownloadOptions {
	transform?: StorageImageTransformOptions
}

export interface StoragePublicUrlOptions {
	download?: boolean | string
	transform?: StorageImageTransformOptions
}

export interface StorageSignedUrlOptions {
	download?: boolean | string
	transform?: StorageImageTransformOptions
}

export interface StorageCreateBucketOptions {
	public?: boolean
	allowedMimeTypes?: string[]
	fileSizeLimit?: number | string
}

export interface StorageApiSuccess<T> {
	success: true
	data: T
	error: undefined
}

export interface StorageApiFailure<T> {
	success: false
	data: T
	error: unknown
}

export type StorageApiResponse<T> = StorageApiSuccess<T> | StorageApiFailure<T>

const DEFAULT_LIST_OPTIONS: Required<Pick<StorageListOptions, 'path' | 'limit' | 'offset' | 'orderBy' | 'orderDirection'>> = {
	path: '',
	limit: 100,
	offset: 0,
	orderBy: 'name',
	orderDirection: 'asc',
}

function handleStorageResponse<T>(
	payload: { data: T | null; error: unknown },
	context: string,
	fallbackData: T
): StorageApiResponse<T> {
	const { data, error } = payload

	if (error) {
		console.error(`❌ [storage:${context}]`, error)
		return {
			success: false,
			error,
			data: fallbackData,
		}
	}

	return {
		success: true,
		error: undefined,
		data: (data ?? fallbackData) as T,
	}
}

function normalizeBucketOptions(options: StorageCreateBucketOptions = {}) {
	return {
		public: options.public ?? false,
		allowedMimeTypes: options.allowedMimeTypes,
		fileSizeLimit: options.fileSizeLimit,
	}
}

export const useSupabaseApiStorage = () => {
	const supabaseClient = useSupabaseClient?.()

	if (!supabaseClient) {
		throw new Error('[nsdb] Supabase client not found. Install @nuxtjs/supabase.')
	}

	function bucket(bucketName: string) {
		return supabaseClient.storage.from(normalizeBucketName(bucketName))
	}

	/**
	 * Liste les fichiers et dossiers d'un bucket.
	 * La recherche est locale car Supabase Storage ne fournit pas de recherche texte native.
	 */
	async function list<T extends { name?: string } = any>(bucketName: string, options: StorageListOptions = {}) {
		const listOptions = { ...DEFAULT_LIST_OPTIONS, ...options }
		const directoryPath = normalizeDirectoryPath(listOptions.path)

		const { data, error } = await bucket(bucketName).list(directoryPath, {
			limit: listOptions.limit,
			offset: listOptions.offset,
			sortBy: {
				column: listOptions.orderBy,
				order: listOptions.orderDirection,
			},
		})

		const filteredData = applySearchFilter((data ?? []) as unknown as T[], listOptions.search)
		return handleStorageResponse<T[]>({ data: filteredData, error }, `LIST ${bucketName}/${directoryPath}`, [])
	}

	/**
	 * Upload un nouveau fichier. Utiliser update() pour remplacer explicitement un fichier existant.
	 */
	async function upload<T = any>(
		bucketName: string,
		path: string,
		fileBody: StorageFileBody,
		options: StorageWriteOptions = {}
	) {
		const filePath = normalizeFilePath(path)
		const { data, error } = await bucket(bucketName).upload(filePath, fileBody, options as any)
		return handleStorageResponse<T>({ data: data as T | null, error }, `UPLOAD ${bucketName}/${filePath}`, null as T)
	}

	/**
	 * Remplace le contenu d'un fichier existant sans changer son chemin.
	 */
	async function update<T = any>(
		bucketName: string,
		path: string,
		fileBody: StorageFileBody,
		options: Omit<StorageWriteOptions, 'upsert'> = {}
	) {
		const filePath = normalizeFilePath(path)
		const { data, error } = await bucket(bucketName).update(filePath, fileBody, options as any)
		return handleStorageResponse<T>({ data: data as T | null, error }, `UPDATE ${bucketName}/${filePath}`, null as T)
	}

	async function download(bucketName: string, path: string, options: StorageDownloadOptions = {}) {
		const filePath = normalizeFilePath(path)
		const { data, error } = await bucket(bucketName).download(filePath, options as any)
		return handleStorageResponse<Blob>({ data, error }, `DOWNLOAD ${bucketName}/${filePath}`, null as unknown as Blob)
	}

	async function remove<T = any>(bucketName: string, paths: string | string[]) {
		const filePaths = (Array.isArray(paths) ? paths : [paths]).map(normalizeFilePath)
		const { data, error } = await bucket(bucketName).remove(filePaths)
		return handleStorageResponse<T[]>({ data: data as T[] | null, error }, `REMOVE ${bucketName}`, [])
	}

	function getPublicUrl(bucketName: string, path: string, options: StoragePublicUrlOptions = {}) {
		const filePath = normalizeFilePath(path)
		const { data } = bucket(bucketName).getPublicUrl(filePath, options as any)
		return data.publicUrl
	}

	async function createSignedUrl(
		bucketName: string,
		path: string,
		expiresIn = 60,
		options: StorageSignedUrlOptions = {}
	) {
		const filePath = normalizeFilePath(path)
		const { data, error } = await bucket(bucketName).createSignedUrl(filePath, expiresIn, options as any)
		return handleStorageResponse<{ signedUrl: string }>(
			{ data, error },
			`SIGNED_URL ${bucketName}/${filePath}`,
			null as unknown as { signedUrl: string },
		)
	}

	async function createSignedUrls(
		bucketName: string,
		paths: string[],
		expiresIn = 60,
		options: StorageSignedUrlOptions = {}
	) {
		const filePaths = paths.map(normalizeFilePath)
		const { data, error } = await bucket(bucketName).createSignedUrls(filePaths, expiresIn, options as any)
		return handleStorageResponse<Array<{ path: string; signedUrl: string }>>(
			{ data: data as Array<{ path: string; signedUrl: string }> | null, error },
			`SIGNED_URLS ${bucketName}`,
			[],
		)
	}

	async function createSignedUploadUrl(bucketName: string, path: string) {
		const filePath = normalizeFilePath(path)
		const { data, error } = await bucket(bucketName).createSignedUploadUrl(filePath)
		return handleStorageResponse<{ signedUrl: string; path: string; token: string }>(
			{ data, error },
			`SIGNED_UPLOAD_URL ${bucketName}/${filePath}`,
			null as unknown as { signedUrl: string; path: string; token: string },
		)
	}

	async function uploadToSignedUrl<T = any>(
		bucketName: string,
		path: string,
		token: string,
		fileBody: StorageFileBody
	) {
		const filePath = normalizeFilePath(path)
		const { data, error } = await bucket(bucketName).uploadToSignedUrl(filePath, token, fileBody as any)
		return handleStorageResponse<T>({ data: data as T | null, error }, `UPLOAD_SIGNED_URL ${bucketName}/${filePath}`, null as T)
	}

	async function move<T = any>(bucketName: string, fromPath: string, toPath: string) {
		const normalizedFromPath = normalizeFilePath(fromPath)
		const normalizedToPath = normalizeFilePath(toPath)
		const { data, error } = await bucket(bucketName).move(normalizedFromPath, normalizedToPath)
		return handleStorageResponse<T>(
			{ data: data as T | null, error },
			`MOVE ${bucketName} ${normalizedFromPath} -> ${normalizedToPath}`,
			null as T,
		)
	}

	async function copy<T = any>(bucketName: string, fromPath: string, toPath: string) {
		const normalizedFromPath = normalizeFilePath(fromPath)
		const normalizedToPath = normalizeFilePath(toPath)
		const { data, error } = await bucket(bucketName).copy(normalizedFromPath, normalizedToPath)
		return handleStorageResponse<T>(
			{ data: data as T | null, error },
			`COPY ${bucketName} ${normalizedFromPath} -> ${normalizedToPath}`,
			null as T,
		)
	}

	async function listBuckets<T = any>() {
		const { data, error } = await supabaseClient.storage.listBuckets()
		return handleStorageResponse<T[]>({ data: data as T[] | null, error }, 'LIST_BUCKETS', [])
	}

	async function getBucket<T = any>(bucketName: string) {
		const normalizedBucketName = normalizeBucketName(bucketName)
		const { data, error } = await supabaseClient.storage.getBucket(normalizedBucketName)
		return handleStorageResponse<T>({ data: data as T | null, error }, `GET_BUCKET ${normalizedBucketName}`, null as T)
	}

	async function createBucket<T = any>(bucketName: string, options: StorageCreateBucketOptions = {}) {
		const normalizedBucketName = normalizeBucketName(bucketName)
		const { data, error } = await supabaseClient.storage.createBucket(normalizedBucketName, normalizeBucketOptions(options))
		return handleStorageResponse<T>({ data: data as T | null, error }, `CREATE_BUCKET ${normalizedBucketName}`, null as T)
	}

	async function updateBucket<T = any>(bucketName: string, options: StorageCreateBucketOptions) {
		const normalizedBucketName = normalizeBucketName(bucketName)
		const { data, error } = await supabaseClient.storage.updateBucket(normalizedBucketName, normalizeBucketOptions(options))
		return handleStorageResponse<T>({ data: data as T | null, error }, `UPDATE_BUCKET ${normalizedBucketName}`, null as T)
	}

	async function deleteBucket<T = any>(bucketName: string) {
		const normalizedBucketName = normalizeBucketName(bucketName)
		const { data, error } = await supabaseClient.storage.deleteBucket(normalizedBucketName)
		return handleStorageResponse<T>({ data: data as T | null, error }, `DELETE_BUCKET ${normalizedBucketName}`, null as T)
	}

	async function emptyBucket<T = any>(bucketName: string) {
		const normalizedBucketName = normalizeBucketName(bucketName)
		const { data, error } = await supabaseClient.storage.emptyBucket(normalizedBucketName)
		return handleStorageResponse<T>({ data: data as T | null, error }, `EMPTY_BUCKET ${normalizedBucketName}`, null as T)
	}

	return {
		list,
		upload,
		update,
		download,
		remove,
		getPublicUrl,
		createSignedUrl,
		createSignedUrls,
		createSignedUploadUrl,
		uploadToSignedUrl,
		move,
		copy,
		listBuckets,
		getBucket,
		createBucket,
		updateBucket,
		deleteBucket,
		emptyBucket,
		joinPath,
		normalizePath,
	}
}
