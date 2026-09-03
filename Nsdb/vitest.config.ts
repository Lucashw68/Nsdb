import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
	plugins: [vue()],
	resolve: {
		alias: [
			{ find: '#imports', replacement: `${root}tests/runtime/fixtures/nuxt-imports.ts` },
			{ find: '#build/nsdb/registry', replacement: `${root}tests/runtime/fixtures/registry.ts` },
			{ find: '#build/nsdb/schemas', replacement: `${root}tests/runtime/fixtures/schemas.ts` },
			{ find: /^@lucashw68\/nsdb\/(.+)$/, replacement: `${root}$1` },
		],
	},
	test: {
		include: ['tests/runtime/**/*.test.ts'],
		environment: 'happy-dom',
		setupFiles: ['tests/runtime/setup.ts'],
		clearMocks: true,
	},
})
