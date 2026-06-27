declare module '#imports' {
	export const defineStore: any
	export const useSupabaseClient: any
	export const useSupabaseUser: any
}

declare module '~~/nsdb/schemas' {
	const schemas: Record<string, any>
	export = schemas
}
