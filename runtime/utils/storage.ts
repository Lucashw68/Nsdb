export function normalizePath(path = '') {
	const segments = path
		.split('/')
		.map(part => part.trim())
		.filter(Boolean)

	if (segments.some(part => part === '.' || part === '..')) {
		throw new Error('[nsdb:storage] Relative path segments are not allowed.')
	}

	return segments.join('/')
}

export function normalizeDirectoryPath(path = '') {
	return normalizePath(path)
}

export function normalizeFilePath(path: string) {
	const normalizedPath = normalizePath(path)
	if (!normalizedPath) throw new Error('[nsdb:storage] A file path is required.')
	return normalizedPath
}

export function joinPath(...parts: Array<string | number | null | undefined>) {
	return parts
		.map(part => normalizePath(String(part ?? '')))
		.filter(Boolean)
		.join('/')
}

export function applySearchFilter<T extends { name?: string }>(items: T[], search?: string) {
	const normalizedSearch = search?.trim().toLowerCase()
	if (!normalizedSearch) return items
	return items.filter(item => item.name?.toLowerCase().includes(normalizedSearch))
}

export function normalizeBucketName(bucketName: string) {
	const normalizedName = bucketName.trim()
	if (!normalizedName) throw new Error('[nsdb:storage] A bucket name is required.')
	return normalizedName
}
