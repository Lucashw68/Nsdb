declare module '#imports' {
	export const defineStore: any
	export const useSupabaseClient: any
	export const useSupabaseUser: any
}

declare module '~~/nsdb/schemas' {
	const schemas: Record<string, any>
	export = schemas
}

declare module '#build/nsdb/registry' {
	export const useNsdbModel: (model: string, options?: { store?: boolean }) => any
}

declare module '#build/nsdb/schemas' {
	const schemas: Record<string, any>
	export = schemas
}
