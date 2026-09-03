export default defineNuxtConfig({
  modules: [
    '@lucashw68/nsdb',
    '@pinia/nuxt',
    '@nuxtjs/supabase',
    'pinia-plugin-persistedstate/nuxt',
  ],
  nsdb: {
    withComponents: true,
    withStores: true,
  },
})
