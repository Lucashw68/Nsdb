export default {
	supabase: {
		schema: 'public',
		projectId: process.env.SUPABASE_PROJECT_ID,
		// For self-hosted Supabase, use dbUrl instead of projectId:
		// dbUrl: process.env.SUPABASE_DB_URL,
		// If Postgres is only reachable from a VPS, generate types remotely:
		// remoteTypes: {
		// 	sshHost: process.env.SUPABASE_REMOTE_SSH_HOST,
		// 	projectPath: process.env.SUPABASE_REMOTE_PROJECT_PATH,
		// 	dbUrl: process.env.SUPABASE_REMOTE_DB_URL,
		// 	remoteOutput: '/tmp/database.types.ts',
		// 	beforeCommand: process.env.SUPABASE_REMOTE_BEFORE_COMMAND,
		// 	supabaseCommand: process.env.SUPABASE_REMOTE_SUPABASE_COMMAND,
		// },
		linked: false,
	},
	paths: {
		types: 'types/database.types.ts',
		metadata: 'nsdb/database.metadata.json',
		enums: 'nsdb/enums.ts',
		schemas: 'nsdb/schemas',
		models: 'nsdb/models',
		composables: 'nsdb/composables',
		stores: 'stores',
	},
	imports: {
		databaseTypes: '~~/types/database.types',
	},
	tables: {
		include: ['playlists'],
		columns: {
			playlists: {
				internal_note: { serverOnly: true },
				created_at: { editable: false },
			},
		},
	},
}
