import {
	defineNuxtModule,
	addImportsDir,
	addPlugin,
	createResolver,
} from '@nuxt/kit'

export default defineNuxtModule({
	meta: {
		name: 'nsdb',
		configKey: 'nsdb',
	},

	defaults: {
		withStores: true,
	},

	setup(options, nuxt) {
		const { resolve } = createResolver(import.meta.url)
		const runtimeDir = resolve('./runtime')

		// Alias interne (#nsdb → module)
		nuxt.options.alias['#nsdb'] = runtimeDir

		// Auto-import des composables
		addImportsDir(resolve(runtimeDir, 'composables'))

		if (options.withStores) {
			addImportsDir(resolve(runtimeDir, 'stores'))
		}

		// Injection du plugin (Supabase, etc.)
		addPlugin(resolve(runtimeDir, 'plugins/nsdb'))
	}
})
