import {
    defineNuxtModule,
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
    defaults: { withStores: true },

    setup(options, nuxt) {
      const rMod = createResolver(import.meta.url)
      const rApp = createResolver(nuxt.options.srcDir)

      const runtimeDir = rMod.resolve('./runtime')
      const typesDir   = rMod.resolve('./types')

      // 1) Alias interne vers le runtime du module
      nuxt.options.alias['#nsdb'] = runtimeDir

      // 2) Proxy de build pour le barrel d'app ~/nsdb/models.ts
      //    -> importable partout via:  import { useX } from '#build/nsdb/models'
      const appModelsAbs = rApp.resolve('nsdb/models.ts')
      const appModelsExists = existsSync(appModelsAbs)

      addTemplate({
        filename: 'nsdb/models.ts',
        write: true,
        getContents: () =>
          appModelsExists
            ? `export * from '~/nsdb/models'`
            : `// Fallback neutre: générez vos modules avec nsdb:models
  export {}`
      })

      // Regénère le proxy si ~/nsdb/models.ts apparaît en dev
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
      })

      // 3) Auto-imports du runtime du module
      addImportsDir(rMod.resolve(runtimeDir, 'composables'))
      if (options.withStores) addImportsDir(rMod.resolve(runtimeDir, 'stores'))
      addImportsDir(typesDir)
    }
})
