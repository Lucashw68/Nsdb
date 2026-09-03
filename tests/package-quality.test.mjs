import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const packageRoot = path.resolve(import.meta.dirname, '..')

test('package exports expose canonical entry points and keep internals private', async () => {
	const packageJson = JSON.parse(
		await readFile(path.join(packageRoot, 'package.json'), 'utf8')
	)

	assert.equal(packageJson.exports['./useNsdbProfile'], './runtime/composables/useNsdbProfile.ts')
	assert.equal(packageJson.exports['./useSupabaseModel'], './runtime/composables/useSupabaseModels.ts')
	assert.equal(packageJson.exports['./useNsdbSchema'], './runtime/composables/useNsdbSchemas.ts')
	assert.equal(packageJson.exports['./types'], './types/index.ts')
	assert.equal(packageJson.exports['./types/config'], './types/config.ts')
	assert.equal(packageJson.exports['./types/list'], './types/list.ts')
	assert.equal(packageJson.exports['./createSingletonStore'], './runtime/stores/createSingletonDbStore.ts')
	assert.equal(packageJson.exports['./helpers/config'], undefined)
	assert.equal(packageJson.exports['./useSupabaseModels'], undefined)
	assert.equal(packageJson.exports['./useNsdbSchemas'], undefined)
	assert.equal(packageJson.exports['./createSingletonDbStore'], undefined)
	assert.equal(Object.keys(packageJson.exports).length, 13)
	assert.equal(packageJson.version, '1.0.0-rc.1')
	assert.equal(packageJson.peerDependencies.nuxt, '^4.2.1')
	assert.equal(packageJson.peerDependencies['@nuxtjs/supabase'], '^1.6.1 || ^2.0.0')
	assert.equal(packageJson.peerDependencies['@pinia/nuxt'], '^0.11.2')
	assert.equal(packageJson.peerDependencies.pinia, '^3.0.3')
	assert.equal(packageJson.peerDependencies.vue, '^3.5.24')
	assert.equal(packageJson.dependencies['@types/node'], '^22.0.0')
})

test('pre-1.0 legacy aliases are absent from the stable surface', async () => {
	const [modelTypes, modelTemplate, listComponent, lowLevelApi] = await Promise.all([
		readFile(path.join(packageRoot, 'types/model.ts'), 'utf8'),
		readFile(path.join(packageRoot, 'templates/model.template.ts'), 'utf8'),
		readFile(path.join(packageRoot, 'runtime/components/NsdbList.vue'), 'utf8'),
		readFile(path.join(packageRoot, 'runtime/composables/useSupabaseApi.ts'), 'utf8'),
	])

	assert.doesNotMatch(modelTypes, /\bsync\s*\(/)
	assert.doesNotMatch(modelTypes, /\bforce\??:/)
	assert.doesNotMatch(modelTemplate, /\bnew:/)
	assert.doesNotMatch(modelTemplate, /\bfind[,]/)
	assert.doesNotMatch(modelTemplate, /\bsync:/)
	assert.doesNotMatch(listComponent, /\breload\b/)
	assert.doesNotMatch(lowLevelApi, /\b(?:show|destroy|allByProperty|showByProperty|updateByProperty|deleteByProperty)\s*\(/)
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

test('generated model template exposes totalCount from the runtime model', async () => {
	const content = await readFile(path.join(packageRoot, 'templates/model.template.ts'), 'utf8')

	assert.match(content, /items:\s*model\.items/)
	assert.match(content, /totalCount:\s*model\.totalCount/)
	assert.match(content, /createDraft:\s*\(\) => createDraftFromSchema\(\)/)
})

test('CLI exposes a stable help inventory', async () => {
	const cli = await readFile(path.join(packageRoot, 'cli/index.js'), 'utf8')
	assert.match(cli, /nsdb generate:all/)
	assert.match(cli, /nsdb clear/)
	assert.match(cli, /\['help', '--help', '-h'\]/)
})
