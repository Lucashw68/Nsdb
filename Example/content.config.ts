import { defineContentConfig, defineCollection } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    components: defineCollection({
      type: 'page',
      source: 'components/*.md'
    }),
    module: defineCollection({
      type: 'page',
      source: 'module/*.md'
    })
  }
})
