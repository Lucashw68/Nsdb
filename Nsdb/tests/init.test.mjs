import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from '../helpers/args.js'
import {
	buildNsdbConfigTemplate,
	initNsdb,
	mergePackageScripts,
} from '../scripts/init.js'

test('buildNsdbConfigTemplate supports linked projects', () => {
	const template = buildNsdbConfigTemplate({
		schemaName: 'private',
		linked: true,
	})

	assert.match(template, /schema: 'private'/)
	assert.match(template, /linked: true/)
	assert.doesNotMatch(template, /projectId:/)
	assert.doesNotMatch(template, /paths:/)
})

test('buildNsdbConfigTemplate only emits non-default path configuration', () => {
	const template = buildNsdbConfigTemplate({
		linked: true,
		paths: {
			types: 'generated/database.ts',
			metadata: 'generated/metadata.json',
			enums: 'generated/enums.ts',
			schemas: 'generated/schemas',
			models: 'generated/models',
			composables: 'generated/composables',
			stores: 'generated/stores',
		},
	})

	assert.match(template, /paths:/)
	assert.match(template, /types: 'generated\/database\.ts'/)
})

test('buildNsdbConfigTemplate supports self-hosted db url projects', () => {
	const template = buildNsdbConfigTemplate({
		schemaName: 'public',
		dbUrlExpression: 'process.env.SUPABASE_DB_URL',
	})

	assert.match(template, /dbUrl: process.env.SUPABASE_DB_URL/)
	assert.doesNotMatch(template, /projectId:/)
	assert.match(template, /linked: false/)
})

test('buildNsdbConfigTemplate supports remote ssh type generation', () => {
	const template = buildNsdbConfigTemplate({
		schemaName: 'public',
		remoteTypes: {
			sshHost: "'vps'",
			projectPath: "'/opt/supabase-projects/mysic'",
			dbUrl: "'postgresql://postgres:$POSTGRES_PASSWORD@db:5432/postgres'",
			remoteOutput: "'/tmp/database.types.ts'",
			beforeCommand: "'source ~/.nvm/nvm.sh'",
			supabaseCommand: "'npx supabase'",
		},
	})

	assert.match(template, /remoteTypes:/)
	assert.match(template, /sshHost: 'vps'/)
	assert.match(template, /projectPath: '\/opt\/supabase-projects\/mysic'/)
	assert.match(template, /dbUrl: 'postgresql:\/\/postgres:\$POSTGRES_PASSWORD@db:5432\/postgres'/)
	assert.match(template, /beforeCommand: 'source ~\/.nvm\/nvm.sh'/)
	assert.match(template, /supabaseCommand: 'npx supabase'/)
	assert.doesNotMatch(template, /projectId:/)
})

test('mergePackageScripts preserves existing scripts', () => {
	const packageJson = mergePackageScripts({
		scripts: {
			'nsdb:all': 'custom command',
			dev: 'nuxt dev',
		},
	})

	assert.equal(packageJson.scripts['nsdb:all'], 'custom command')
	assert.equal(packageJson.scripts.dev, 'nuxt dev')
	assert.equal(packageJson.scripts['nsdb:init'], 'nsdb init')
	assert.equal(packageJson.scripts['nsdb:types'], 'nsdb generate:types')
	assert.equal(packageJson.scripts['nsdb:metadata'], 'nsdb generate:metadata')
})

test('initNsdb writes config, env example, directories and package scripts', async () => {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'nsdb-init-'))
	fs.writeFileSync(
		path.join(temporaryDirectory, 'package.json'),
		`${JSON.stringify({ scripts: { dev: 'nuxt dev' } }, null, 2)}\n`
	)

	await initNsdb({
		currentWorkingDirectory: temporaryDirectory,
		parsedArguments: parseArgs(['--linked', '--schema', 'private']),
	})

	const config = fs.readFileSync(path.join(temporaryDirectory, 'nsdb.config.ts'), 'utf8')
	const packageJson = JSON.parse(fs.readFileSync(path.join(temporaryDirectory, 'package.json'), 'utf8'))

	assert.match(config, /schema: 'private'/)
	assert.match(config, /linked: true/)
	assert.doesNotMatch(config, /paths:/)
	assert.equal(packageJson.scripts.dev, 'nuxt dev')
	assert.equal(packageJson.scripts['nsdb:all'], 'nsdb generate:all')
	assert.equal(fs.existsSync(path.join(temporaryDirectory, '.env.example')), true)
	assert.equal(fs.existsSync(path.join(temporaryDirectory, 'nsdb/models')), true)
	assert.equal(fs.existsSync(path.join(temporaryDirectory, 'stores')), true)
})
