import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { parseArgs } from '../helpers/args.js'
import {
	GENERATED_FILE_MARKER,
	isNsdbGeneratedFile,
	markGenerated,
	removeStaleGeneratedFiles,
} from '../helpers/generated.js'
import { clearGeneratedFiles } from '../scripts/clear.js'

function temporaryProject() {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nsdb-generated-'))
	for (const directory of ['models', 'schemas', 'composables', 'stores']) {
		fs.mkdirSync(path.join(root, 'custom', directory), { recursive: true })
	}
	fs.writeFileSync(path.join(root, 'nsdb.config.mjs'), `export default {
		paths: {
			enums: 'custom/enums.ts',
			schemas: 'custom/schemas',
			models: 'custom/models',
			composables: 'custom/composables',
			stores: 'custom/stores'
		}
	}`)
	return root
}

test('generated markers are stable and detectable', () => {
	const root = temporaryProject()
	const filePath = path.join(root, 'custom', 'models', 'playlists.ts')
	const content = markGenerated('export {}\n')
	fs.writeFileSync(filePath, content)

	assert.equal(content, `${GENERATED_FILE_MARKER}\nexport {}\n`)
	assert.equal(markGenerated(content), content)
	assert.equal(isNsdbGeneratedFile(filePath), true)
})

test('clear removes only marked files from configured paths', async () => {
	const root = temporaryProject()
	const generatedModel = path.join(root, 'custom', 'models', 'playlists.ts')
	const generatedStore = path.join(root, 'custom', 'stores', 'usePlaylistStore.ts')
	const userStore = path.join(root, 'custom', 'stores', 'useAuthStore.ts')
	const unrelatedDefaultStore = path.join(root, 'stores', 'useLegacyStore.ts')

	fs.writeFileSync(generatedModel, markGenerated('export {}\n'))
	fs.writeFileSync(generatedStore, markGenerated('export {}\n'))
	fs.writeFileSync(userStore, 'export const userOwned = true\n')
	fs.mkdirSync(path.dirname(unrelatedDefaultStore), { recursive: true })
	fs.writeFileSync(unrelatedDefaultStore, 'export const legacy = true\n')

	await clearGeneratedFiles({ currentWorkingDirectory: root, parsedArguments: parseArgs([]) })

	assert.equal(fs.existsSync(generatedModel), false)
	assert.equal(fs.existsSync(generatedStore), false)
	assert.equal(fs.existsSync(userStore), true)
	assert.equal(fs.existsSync(unrelatedDefaultStore), true)
})

test('clear dry-run does not remove generated files', async () => {
	const root = temporaryProject()
	const generatedModel = path.join(root, 'custom', 'models', 'playlists.ts')
	fs.writeFileSync(generatedModel, markGenerated('export {}\n'))

	const candidates = await clearGeneratedFiles({
		currentWorkingDirectory: root,
		parsedArguments: parseArgs(['--dry-run']),
	})

	assert.deepEqual(candidates, [generatedModel])
	assert.equal(fs.existsSync(generatedModel), true)
})

test('stale cleanup preserves unmarked user files', () => {
	const root = temporaryProject()
	const outputDirectory = path.join(root, 'custom', 'models')
	const current = path.join(outputDirectory, 'playlists.ts')
	const stale = path.join(outputDirectory, 'removed_table.ts')
	const userFile = path.join(outputDirectory, 'custom.ts')
	fs.writeFileSync(current, markGenerated('export {}\n'))
	fs.writeFileSync(stale, markGenerated('export {}\n'))
	fs.writeFileSync(userFile, 'export const custom = true\n')

	removeStaleGeneratedFiles(outputDirectory, ['playlists.ts'])

	assert.equal(fs.existsSync(current), true)
	assert.equal(fs.existsSync(stale), false)
	assert.equal(fs.existsSync(userFile), true)
})

test('enum generator source contains no volatile timestamp', () => {
	const source = fs.readFileSync(new URL('../scripts/generate-enums.js', import.meta.url), 'utf8')
	assert.equal(source.includes('new Date().toISOString()'), false)
})
