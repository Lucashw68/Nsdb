import { useSupabaseClient } from '#imports'

// Tu peux réutiliser ton type global si tu veux
export type OrderDirection = 'asc' | 'desc'

export type StorageOrderBy =
    | 'name'
    | 'created_at'
    | 'updated_at'
    | 'last_accessed_at'
    | 'size'

export interface StorageListOptions {
    path?: string
    limit?: number
    offset?: number
    orderBy?: StorageOrderBy
    orderDirection?: OrderDirection
}

/**
 * Unifie la gestion des réponses de Supabase Storage.
 * Même shape que useSupabaseApi : { success, data, error }
 */
function handleStorageResponse<T>(
    data: T | null,
    error: any,
    context: string
) {
    if (error) {
        console.error(`❌ [storage:${context}]`, error)
        return {
            success: false as const,
            error,
            data: undefined as unknown as T,
        }
    }

    return {
        success: true as const,
        error: undefined,
        data: data as T,
    }
}

export const useSupabaseApiStorage = () => {
    const supabase = useSupabaseClient?.()

    if (!supabase) {
        throw new Error('[nsdb] Supabase client not found. Install @nuxtjs/supabase.')
    }

    // ############################################################
    // # LIST (all)
    // ############################################################

    /**
     * Liste le contenu d’un bucket (équivalent amélioré de ton "all").
     *
     * Exemple :
     *   list('songs', { path: 'covers', orderBy: 'name', orderDirection: 'asc' })
     */
    async function list(
        bucket: string,
        options: StorageListOptions = {}
    ) {
        const {
            path = '',
            limit = 100,
            offset = 0,
            orderBy = 'name',
            orderDirection = 'asc',
        } = options

        const { data, error } = await supabase
            .storage
            .from(bucket)
            .list(path, {
                limit,
                offset,
                sortBy: { column: orderBy, order: orderDirection },
            })

        return handleStorageResponse<any[]>(data, error, `LIST ${bucket}/${path}`)
    }

    /**
     * Alias pour compatibilité avec ton ancienne API.
     */
    async function all(
        bucket: string,
        path: string = '',
        limit: number = 100,
        orderBy: StorageOrderBy = 'name',
        orderDirection: OrderDirection = 'asc'
    ) {
        return list(bucket, { path, limit, orderBy, orderDirection })
    }

    // ############################################################
    // # UPLOAD
    // ############################################################

    /**
     * Upload d’un fichier dans un bucket.
     *
     * Exemple :
     *   upload('songs', `covers/${id}.png`, file, { upsert: true })
     */
    async function upload(
        bucket: string,
        path: string,
        file: File | Blob,
        options: { upsert?: boolean } = {}
    ) {
        const { upsert = false } = options

        const { data, error } = await supabase
            .storage
            .from(bucket)
            .upload(path, file, { upsert })

        return handleStorageResponse<any>(data, error, `UPLOAD ${bucket}/${path}`)
    }

    // ############################################################
    // # GET / DOWNLOAD
    // ############################################################

    /**
     * Récupère le fichier (Blob) depuis le storage.
     *
     * Exemple :
     *   const { success, data } = await get('songs', 'covers/123.png')
     *   if (success && data) { const url = URL.createObjectURL(data) }
     */
    async function download(
        bucket: string,
        path: string
    ) {
        const { data, error } = await supabase
            .storage
            .from(bucket)
            .download(path)

        // data est un Blob
        return handleStorageResponse<Blob | null>(data, error, `DOWNLOAD ${bucket}/${path}`)
    }

    /**
     * Alias plus court, style "GET".
     * get() == download()
     */
    async function get(
        bucket: string,
        path: string
    ) {
        return download(bucket, path)
    }

    // ############################################################
    // # DELETE
    // ############################################################

    /**
     * Supprime un ou plusieurs fichiers.
     *
     * Exemple :
     *   remove('songs', 'covers/123.png')
     *   remove('songs', ['covers/1.png', 'covers/2.png'])
     */
    async function remove(
        bucket: string,
        paths: string | string[]
    ) {
        const pathArray = Array.isArray(paths) ? paths : [paths]

        const { data, error } = await supabase
            .storage
            .from(bucket)
            .remove(pathArray)

        return handleStorageResponse<any>(data, error, `REMOVE ${bucket}`)
    }

    // ############################################################
    // # URLS (public / signées)
    // ############################################################

    /**
     * Retourne l’URL publique d’un fichier.
     * (Ne fait pas d’appel réseau, c’est calculé côté client)
     *
     * Exemple :
     *   const url = getPublicUrl('songs', 'covers/123.png')
     */
    function getPublicUrl(
        bucket: string,
        path: string,
        options?: {
            download?: boolean
            transform?: {
                width?: number
                height?: number
                resize?: 'cover' | 'contain' | 'fill'
                quality?: number
                format?: 'origin' | 'webp' | 'png' | 'jpeg'
            }
        }
    ) {
        const { data } = supabase
            .storage
            .from(bucket)
            .getPublicUrl(path, options as any)

        return data?.publicUrl ?? null
    }

    /**
     * Crée une URL signée (temporaire).
     *
     * Exemple :
     *   const { success, data } = await createSignedUrl('songs', 'covers/123.png', 60)
     *   // data?.signedUrl
     */
    async function createSignedUrl(
        bucket: string,
        path: string,
        expiresIn: number = 60 // secondes
    ) {
        const { data, error } = await supabase
            .storage
            .from(bucket)
            .createSignedUrl(path, expiresIn)

        return handleStorageResponse<{ signedUrl: string } | null>(
            data,
            error,
            `SIGNED_URL ${bucket}/${path}`,
        )
    }

    // ############################################################
    // # MOVE / COPY
    // ############################################################

    /**
     * Déplace un fichier dans le même bucket.
     *
     * Exemple :
     *   move('songs', 'tmp/123.png', 'covers/123.png')
     */
    async function move(
        bucket: string,
        fromPath: string,
        toPath: string
    ) {
        const { data, error } = await supabase
            .storage
            .from(bucket)
            .move(fromPath, toPath)

        return handleStorageResponse<any>(
            data,
            error,
            `MOVE ${bucket} ${fromPath} -> ${toPath}`,
        )
    }

    /**
     * Copie un fichier dans le même bucket.
     *
     * Exemple :
     *   copy('songs', 'covers/123.png', 'covers/backups/123.png')
     */
    async function copy(
        bucket: string,
        fromPath: string,
        toPath: string
    ) {
        const { data, error } = await supabase
            .storage
            .from(bucket)
            .copy(fromPath, toPath)

        return handleStorageResponse<any>(
            data,
            error,
            `COPY ${bucket} ${fromPath} -> ${toPath}`,
        )
    }

    // ############################################################
    // # API exposée
    // ############################################################

    return {
        // listing
        list,
        all, // alias

        // fichiers
        upload,
        download,
        get,      // alias de download
        remove,

        // urls
        getPublicUrl,
        createSignedUrl,

        // gestion chemin
        move,
        copy,
    }
}
