// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: '2025-07-15',
	devtools: { enabled: true },
	debug: true,
	modules: [
		'@nuxt/fonts',
		'@nuxt/icon',
		'@nuxt/image',
		'@nuxt/content',
		'@lucashw68/nsdb',
		'@pinia/nuxt',
		'@nuxtjs/supabase',
		'pinia-plugin-persistedstate/nuxt',
		'@nuxtjs/tailwindcss'
	],

	runtimeConfig: {
		public: {
			supabaseUrl: process.env.SUPABASE_URL,
			supabaseKey: process.env.SUPABASE_KEY
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
				'/components',
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
		debug: true
	},

	build: {
		transpile: ['@lucashw68/nsdb']
	},
})
