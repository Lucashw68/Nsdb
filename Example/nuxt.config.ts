// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: '2025-07-15',
	devtools: { enabled: true },
	debug: false,
	modules: [
		'@lucashw68/nsdb',
		'@pinia/nuxt',
		'@nuxtjs/supabase',
		'pinia-plugin-persistedstate/nuxt',
		'@nuxtjs/tailwindcss'
	],

	runtimeConfig: {
		public: {
			supabaseUrl: process.env.SUPABASE_URL,
			supabaseKey: process.env.SUPABASE_KEY,
			playgroundEnvironment: process.env.NSDB_PLAYGROUND_ENV || (/^http:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(process.env.SUPABASE_URL ?? '') ? 'local' : 'custom'),
			docsUrl: process.env.NUXT_PUBLIC_NSDB_DOCS_URL || 'http://localhost:3001',
		}
	},

	nsdb: {
		withStores: true
	},

	supabase: {
		redirectOptions: {
			login: '/',
			callback: '/confirm',
				exclude: [
				'/',
				'/api',
				'/crud',
				'/store',
				'/realtime',
				'/components',
				'/relations',
				'/storage',
				'/ownership',
				'/e2e',
				'/persistence'
			],
		},
	},

	pinia: {
		storesDirs: ['./stores/**']
	},

	piniaPluginPersistedstate: {
		storage: 'localStorage',
		debug: false
	},

	build: {
		transpile: ['@lucashw68/nsdb']
	},

	vite: {
		resolve: {
			dedupe: ['vue', 'vue-router', 'pinia'],
		},
	},
})
