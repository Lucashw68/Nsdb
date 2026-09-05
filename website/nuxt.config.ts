import nsdbPackage from '../Nsdb/package.json' with { type: 'json' }

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  modules: ['@nuxt/content', '@nuxt/ui', '@nuxt/icon'],
  ui: { fonts: false },
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'theme-color', content: '#081310' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'NSDB — Nuxt Supabase Data Bridge' },
        { property: 'og:description', content: 'The typed data layer between Nuxt and Supabase.' },
      ],
      link: [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    },
  },
  runtimeConfig: {
    public: {
      nsdbVersion: nsdbPackage.version,
      githubUrl: 'https://github.com/Lucashw68/nsdb',
    },
  },
  icon: {
    provider: 'none',
    clientBundle: {
      scan: true,
      icons: [
        'vscode-icons:file-type-nuxt',
        'vscode-icons:file-type-dotenv',
        'vscode-icons:file-type-typescript',
        'vscode-icons:file-type-vue',
        'vscode-icons:file-type-npm',
        'vscode-icons:file-type-pnpm',
        'vscode-icons:file-type-yarn',
      ],
      sizeLimitKb: 128,
    },
  },
  content: {
    build: {
      markdown: {
        toc: { depth: 3, searchDepth: 3 },
        highlight: {
          theme: { default: 'github-light', dark: 'github-dark' },
          langs: ['ts', 'vue', 'bash', 'sql', 'json'],
        },
      },
    },
  },
  typescript: { strict: true, typeCheck: false },
})
