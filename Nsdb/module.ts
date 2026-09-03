import {
	defineNuxtModule,
	addComponentsDir,
	addImports,
	addImportsDir,
	addTemplate,
	createResolver,
	logger
} from '@nuxt/kit'
import { existsSync } from 'node:fs'

export interface NsdbOptions {
	withComponents?: boolean
	componentsPrefix?: string
	withStores?: boolean
	autoImportModels?: boolean
}

export default defineNuxtModule<NsdbOptions>({
	meta: { name: '@lucashw68/nsdb', configKey: 'nsdb' },
	defaults: { withComponents: true, componentsPrefix: 'Nsdb', withStores: true, autoImportModels: true },

	setup(options: NsdbOptions, nuxt: any) {
		const { resolve } = createResolver(import.meta.url)
		const rMod = createResolver(import.meta.url)
		const rApp = createResolver(nuxt.options.rootDir)

		const runtimeDir = rMod.resolve('./runtime')
		// 1) Alias interne vers le runtime du module
		nuxt.options.alias['#nsdb'] = runtimeDir

		if (options.withComponents) {
			addComponentsDir({
				path: resolve(runtimeDir, 'components'),
				prefix: options.componentsPrefix ?? 'Nsdb',
				pathPrefix: false,
				ignore: ['Form/**'],
				transpile: true,
			})
		}

		// 2) Proxies de build pour les barrels d'app:
		//    -> import { ... } from '#build/nsdb/models'
		//    -> import { ... } from '#build/nsdb/schemas'
		const appModelsAbs = rApp.resolve('nsdb/models/index.ts')
		const appSchemasAbs = rApp.resolve('nsdb/schemas/index.ts')
		const appRegistryAbs = rApp.resolve('nsdb/composables/useNsdbModels.ts')
		const appModelsExists = existsSync(appModelsAbs)
		const appSchemasExists = existsSync(appSchemasAbs)
		const appRegistryExists = existsSync(appRegistryAbs)

		addTemplate({
			filename: 'nsdb/models.ts',
			write: true,
			getContents: () =>
				appModelsExists
					? `export * from '~~/nsdb/models'`
					: `// Fallback neutre: générez vos modules avec nsdb:models
					export {}`
		})

		addTemplate({
			filename: 'nsdb/schemas.ts',
			write: true,
			getContents: () =>
				appSchemasExists
					? `export * from '~~/nsdb/schemas'`
					: `// Fallback neutre: générez vos schémas avec nsdb:models (qui émet aussi nsdb/schemas)
					export {}`
		})

		addTemplate({
			filename: 'nsdb/registry.ts',
			write: true,
			getContents: () =>
				appRegistryExists
					? `export { useNsdbModel } from '~~/nsdb/composables/useNsdbModels'`
					: `export function useNsdbModel(model: string): never {
						throw new Error('[nsdb] No generated model registry found for "' + model + '". Run nsdb generate:all.')
					}`
		})

		// Regénère les proxies si ~/nsdb/models.ts ou ~/nsdb/schemas.ts apparaissent en dev
		nuxt.hook('builder:watch', (_event: string, relPath: string) => {
			if (!relPath) return
			const normalized = relPath.replace(/^[./]+/, '')
			if (normalized === 'nsdb/models/index.ts') {
				addTemplate({
					filename: 'nsdb/models.ts',
					write: true,
					getContents: () => `export * from '~~/nsdb/models'`
				})
				logger.success('[nsdb] Proxy #build/nsdb/models mis à jour (~/nsdb/models.ts détecté).')
			}
			if (normalized === 'nsdb/schemas/index.ts') {
				addTemplate({
					filename: 'nsdb/schemas.ts',
					write: true,
					getContents: () => `export * from '~~/nsdb/schemas'`
				})
				logger.success('[nsdb] Proxy #build/nsdb/schemas mis à jour (~/nsdb/schemas.ts détecté).')
			}
			if (normalized === 'nsdb/composables/useNsdbModels.ts') {
				addTemplate({
					filename: 'nsdb/registry.ts',
					write: true,
					getContents: () => `export { useNsdbModel } from '~~/nsdb/composables/useNsdbModels'`
				})
				logger.success('[nsdb] Proxy #build/nsdb/registry mis à jour.')
			}
		})

		// 3) Public runtime auto-imports. Keep this list explicit: exporting a
		// helper from a runtime file must not accidentally make it app-global.
		addImports([
			{ name: 'useSupabaseApi', from: rMod.resolve(runtimeDir, 'composables/useSupabaseApi') },
			{ name: 'useSupabaseApiStorage', from: rMod.resolve(runtimeDir, 'composables/useSupabaseApiStorage') },
			{ name: 'useSupabaseModel', from: rMod.resolve(runtimeDir, 'composables/useSupabaseModels') },
			{ name: 'useNsdbSchema', from: rMod.resolve(runtimeDir, 'composables/useNsdbSchemas') },
			{ name: 'useNsdbProfile', from: rMod.resolve(runtimeDir, 'composables/useNsdbProfile') },
		])
		if (options.withStores) {
			addImports([
				{ name: 'createDbStore', from: rMod.resolve(runtimeDir, 'stores/createDbStore') },
				{ name: 'createSingletonStore', from: rMod.resolve(runtimeDir, 'stores/createSingletonDbStore') },
			])
		}
		if (appModelsExists && options.autoImportModels) {
			const generatedModelsDir = rApp.resolve('nsdb/models')
			addImportsDir(generatedModelsDir)
			nuxt.hook('imports:extend', (imports: Array<{ name?: string; as?: string; from?: string }>) => {
				const generatedImports = imports.filter(entry => entry.from?.startsWith(generatedModelsDir))
				for (const generatedImport of generatedImports) {
					const publicName = generatedImport.as ?? generatedImport.name
					if (!publicName?.startsWith('use')) continue
					const collision = imports.find(entry =>
						entry !== generatedImport &&
						(entry.as ?? entry.name) === publicName &&
						!entry.from?.startsWith(generatedModelsDir),
					)
						if (collision) {
						throw new Error(
							`[nsdb] Auto-import collision for "${publicName}" between generated models and ${collision.from}. ` +
							'Set nsdb.autoImportModels=false and import the generated model explicitly.',
							)
						}
					}
				})
		}
	}
})
