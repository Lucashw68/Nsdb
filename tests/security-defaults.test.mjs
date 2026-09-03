import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

test('database stores do not persist Supabase rows by default', () => {
	const source = fs.readFileSync(new URL('../runtime/stores/createDbStore.ts', import.meta.url), 'utf8')
	assert.match(source, /options\.persist \?\? false/)
	assert.doesNotMatch(source, /options\.persist \?\? true/)
})

test('database stores validate persisted ownership after hydration', () => {
	const source = fs.readFileSync(new URL('../runtime/stores/createDbStore.ts', import.meta.url), 'utf8')
	assert.match(source, /scopeOwnerId/)
	assert.match(source, /afterHydrate/)
	assert.match(source, /reconcileUserScope/)
})
