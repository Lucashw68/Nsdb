import type { NsdbConfig } from '@lucashw68/nsdb/types/config'

export default {
	supabase: {
		schema: 'public',
		projectId: process.env.SUPABASE_PROJECT_ID,
		// For self-hosted Supabase, use dbUrl instead of projectId:
		// dbUrl: process.env.SUPABASE_DB_URL,
		linked: false,
	},
	paths: {
		types: 'types/database.types.ts',
		enums: 'nsdb/enums.ts',
		schemas: 'nsdb/schemas',
		models: 'nsdb/models',
		composables: 'nsdb/composables',
		stores: 'stores',
	},
	imports: {
		databaseTypes: '~~/types/database.types',
	},
} satisfies NsdbConfig
