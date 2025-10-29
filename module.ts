import {
  defineNuxtModule,
  addImportsDir,
  addTemplate,
  createResolver,
} from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'nsdb', configKey: 'nsdb' },
  defaults: { withStores: true },

  setup(options, nuxt) {
    const rMod = createResolver(import.meta.url)
    const runtimeDir = rMod.resolve('./runtime')
    const typesDir = rMod.resolve('./types')

    // Alias interne vers runtime du module
    nuxt.options.alias['#nsdb'] = runtimeDir

    // 🔧 Proxy pour les models de l’app (toujours existant dans buildDir)
    addTemplate({
      filename: 'nsdb/models.ts',
      write: true,
      getContents: () => `export * from '~/types/models'`,
    })

    // Tu peux aussi faire pareil pour tables/entities si besoin

    // Auto-imports
    addImportsDir(rMod.resolve(runtimeDir, 'composables'))
    if (options.withStores) addImportsDir(rMod.resolve(runtimeDir, 'stores'))
    addImportsDir(typesDir)
  },
})
