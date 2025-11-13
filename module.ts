import {
	defineNuxtModule,
	addComponentsDir,
	addImportsDir,
	addTemplate,
	createResolver,
	logger
} from '@nuxt/kit'
import { existsSync } from 'node:fs'

export interface NsdbOptions {
	withStores?: boolean
}

export default defineNuxtModule<NsdbOptions>({
	meta: { name: '@lucashw68/nsdb', configKey: 'nsdb' },
	defaults: { withComponents: true, componentsPrefix: 'Nsdb', withStores: true },

	setup(options, nuxt) {
		const { resolve } = createResolver(import.meta.url)
		const rMod = createResolver(import.meta.url)
		const rApp = createResolver(nuxt.options.srcDir)

		const runtimeDir = rMod.resolve('./runtime')
		const typesDir = rMod.resolve('./types')

		// 1) Alias interne vers le runtime du module
		nuxt.options.alias['#nsdb'] = runtimeDir

		if (options.withComponents) {
			addComponentsDir({
				path: resolve(runtimeDir, 'components'),
				prefix: options.componentsPrefix ?? 'Nsdb',
				pathPrefix: false,
				transpile: true,
			})
		}

		// 2) Proxies de build pour les barrels d'app:
		//    -> import { ... } from '#build/nsdb/models'
		//    -> import { ... } from '#build/nsdb/schemas'
		const appModelsAbs = rApp.resolve('nsdb/models.ts')
		const appSchemasAbs = rApp.resolve('nsdb/schemas.ts')
		const appModelsExists = existsSync(appModelsAbs)
		const appSchemasExists = existsSync(appSchemasAbs)

		addTemplate({
			filename: 'nsdb/models.ts',
			write: true,
			getContents: () =>
				appModelsExists
					? `export * from '~/nsdb/models'`
					: `// Fallback neutre: générez vos modules avec nsdb:models
					export {}`
		})

		addTemplate({
			filename: 'nsdb/schemas.ts',
			write: true,
			getContents: () =>
				appSchemasExists
					? `export * from '~/nsdb/schemas'`
					: `// Fallback neutre: générez vos schémas avec nsdb:models (qui émet aussi nsdb/schemas)
					export {}`
		})

		// Regénère les proxies si ~/nsdb/models.ts ou ~/nsdb/schemas.ts apparaissent en dev
		nuxt.hook('builder:watch', (_event, relPath) => {
			if (!relPath) return
			const normalized = relPath.replace(/^[./]+/, '')
			if (normalized === 'nsdb/models.ts') {
				addTemplate({
					filename: 'nsdb/models.ts',
					write: true,
					getContents: () => `export * from '~/nsdb/models'`
				})
				logger.success('[nsdb] Proxy #build/nsdb/models mis à jour (~/nsdb/models.ts détecté).')
			}
			if (normalized === 'nsdb/schemas.ts') {
				addTemplate({
					filename: 'nsdb/schemas.ts',
					write: true,
					getContents: () => `export * from '~/nsdb/schemas'`
				})
				logger.success('[nsdb] Proxy #build/nsdb/schemas mis à jour (~/nsdb/schemas.ts détecté).')
			}
		})

		// 3) Auto-imports du runtime du module
		addImportsDir(rMod.resolve(runtimeDir, 'composables'))
		if (options.withStores) addImportsDir(rMod.resolve(runtimeDir, 'stores'))
		addImportsDir(typesDir)
	}
})
