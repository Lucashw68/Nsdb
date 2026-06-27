import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const packageRoot = path.resolve(import.meta.dirname, '..')

test('package exports include current public integration APIs', async () => {
	const packageJson = JSON.parse(
		await readFile(path.join(packageRoot, 'package.json'), 'utf8')
	)

	assert.equal(packageJson.exports['./useNsdbProfile'], './runtime/composables/useNsdbProfile.ts')
	assert.equal(packageJson.exports['./types/config'], './types/config.ts')
	assert.equal(packageJson.exports['./types/list'], './types/list.ts')
})

test('runtime Vue components do not rely on @ts-nocheck', async () => {
	const files = [
		'runtime/components/NsdbForm.vue',
		'runtime/components/Form/NsdbRelationSelect.vue',
	]

	for (const relativePath of files) {
		const content = await readFile(path.join(packageRoot, relativePath), 'utf8')
		assert.equal(content.includes('@ts-nocheck'), false, `${relativePath} should stay typechecked`)
	}
})
