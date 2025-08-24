import { defineNuxtModule, addImportsDir, addComponent, createResolver } from '@nuxt/kit'

export default defineNuxtModule({
	meta: {
		name: 'nsdb',
		configKey: 'nsdb',
	},

	defaults: {
		withStores: true
	},

	setup(options, nuxt) {
		const { resolve } = createResolver(import.meta.url)

		// Auto-import all composables (from runtime/composables)
		addImportsDir(resolve('./runtime/composables'))

		if (options.withStores) {
			addImportsDir(resolve('./runtime/stores'))
		}

		// Ajout de types
		nuxt.options.alias['#nsdb'] = resolve('.')
	}
})
