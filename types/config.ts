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
		metadata?: string
		enums?: string
		schemas?: string
		models?: string
		composables?: string
		stores?: string
	}
	imports?: {
		databaseTypes?: string
	}
	tables?: {
		/** Allowlist of tables exposed through generated NSDB artifacts. */
		include?: string[]
		/** Tables omitted from generated NSDB artifacts. Mutually exclusive with include. */
		exclude?: string[]
		/** Per-table client exposure rules. Unspecified columns keep inferred defaults. */
		columns?: Record<string, Record<string, {
			selectable?: boolean
			editable?: boolean
			hidden?: boolean
			serverOnly?: boolean
		}>>
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
