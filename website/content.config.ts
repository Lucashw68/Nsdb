import { defineCollection, defineContentConfig, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    docs: defineCollection({
      type: 'page',
      source: { include: '**/*.md', prefix: '/docs' },
      schema: z.object({
        title: z.string(),
        description: z.string(),
        badge: z.string().optional(),
      }),
    }),
  },
})
