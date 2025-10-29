import { defineNuxtModule, addImportsDir, createResolver } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'nsdb', configKey: 'nsdb' },
  defaults: { withStores: true },
  setup(options, nuxt) {
    const rModule = createResolver(import.meta.url)
    const rApp = createResolver(nuxt.options.srcDir)

    const runtimeDir = rModule.resolve('./runtime')
    const typesDir   = rModule.resolve('./types')

    nuxt.options.alias['#nsdb'] = runtimeDir

    // 👇 point runtime to the app’s generated types/models.ts
    nuxt.options.alias['#nsdb/models'] = rApp.resolve('types/models.ts')

    // (if you use the tables barrel alias)
    nuxt.options.alias['#nsdb/tables'] = rApp.resolve('nsdb/tables.ts')

    addImportsDir(rModule.resolve(runtimeDir, 'composables'))
    if (options.withStores) addImportsDir(rModule.resolve(runtimeDir, 'stores'))
    addImportsDir(typesDir)
  }
})
