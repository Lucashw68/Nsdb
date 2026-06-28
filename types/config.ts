export interface NsdbConfig {
	supabase?: {
		schema?: string
		projectId?: string
		dbUrl?: string
		linked?: boolean
		remoteTypes?: {
			sshHost?: string
			projectPath?: string
			dbUrl?: string
			remoteOutput?: string
			beforeCommand?: string
			supabaseCommand?: string
		}
	}
	paths?: {
		types?: string
		enums?: string
		schemas?: string
		models?: string
		composables?: string
		stores?: string
	}
	imports?: {
		databaseTypes?: string
	}
	templates?: {
		model?: string
		schema?: string
		useNsdbModel?: string
		store?: string
	}
	generators?: {
		force?: boolean
	}
}
