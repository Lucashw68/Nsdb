// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: '2025-07-15',
	devtools: { enabled: true },
	modules: [
		'@nuxt/fonts',
		'@nuxt/icon',
		'@nuxt/image',
		'@lucashw68/nsdb',
		'@pinia/nuxt',
		'@nuxtjs/supabase',
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
			],
		},
	},

	pinia: {
		storesDirs: ['./stores/**']
	},

	piniaPersistedstate: {
		storage: 'localStorage',
		debug: true
	},
})