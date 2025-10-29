import {
	defineNuxtModule,
	addImportsDir,
	createResolver
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
		const typesDir = resolve('./types')

		// Alias interne (#nsdb → module)
		nuxt.options.alias['#nsdb'] = runtimeDir

		// Alias pour les tables générées (#nsdb/tables → app)
		const projectRoot = nuxt.options.srcDir || nuxt.options.rootDir
   		nuxt.options.alias['#nsdb/tables'] = resolve(projectRoot, 'nsdb/tables')

		// Auto-import des composables
		addImportsDir(resolve(runtimeDir, 'composables'))

		if (options.withStores) {
			addImportsDir(resolve(runtimeDir, 'stores'))
		}

		addImportsDir(resolve(typesDir))
	}
})
