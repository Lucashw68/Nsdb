import { defineNuxtModule, addImportsDir, addTemplate, createResolver } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: '@lucashw68/nsdb', configKey: 'nsdb' },
  defaults: { withStores: true },
  setup(options, nuxt) {
    const rMod = createResolver(import.meta.url)
	
    const runtimeDir = rMod.resolve('./runtime')
    const typesDir   = rMod.resolve('./types')

    // alias interne (ok)
    nuxt.options.alias['#nsdb'] = runtimeDir

    // 🔧 proxy: #build/nsdb/models -> re-export de l'app
    addTemplate({
      filename: 'nsdb/models.ts',
      write: true,
      getContents: () => `export * from '~/nsdb/models'`
    })

    addImportsDir(rMod.resolve(runtimeDir, 'composables'))
    if (options.withStores) addImportsDir(rMod.resolve(runtimeDir, 'stores'))
    addImportsDir(typesDir)
  }
})
