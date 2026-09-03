import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const packageRoot = path.resolve(import.meta.dirname, '..')
const fixturesRoot = path.join(packageRoot, 'tests/fixtures')
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nsdb-release-consumers-'))
const npmCache = process.env.NSDB_NPM_CACHE || path.join(temporaryRoot, 'npm-cache')
const packageVersion = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version
const suppliedTarball = process.env.NSDB_TARBALL
  ? path.resolve(process.env.NSDB_TARBALL)
  : undefined

const consumers = [
  { name: 'minimal', fixture: 'consumer-minimal' },
  { name: 'relational-store', fixture: 'consumer', moduleMatrix: true },
  { name: 'direct-storage', fixture: 'consumer-direct-storage' },
]

function commandEnvironment() {
  return {
    ...process.env,
    SUPABASE_URL: 'http://127.0.0.1:55321',
    SUPABASE_KEY: 'test-anon-key',
    NPM_CONFIG_CACHE: npmCache,
  }
}

function run(command, args, cwd) {
  const startedAt = performance.now()
  execFileSync(command, args, { cwd, stdio: 'inherit', env: commandEnvironment() })
  return Math.round(performance.now() - startedAt)
}

function captureFailure(command, args, cwd) {
  try {
    execFileSync(command, args, { cwd, encoding: 'utf8', env: commandEnvironment() })
  } catch (error) {
    return `${error.stdout ?? ''}\n${error.stderr ?? ''}`
  }
  assert.fail(`Expected ${command} ${args.join(' ')} to fail`)
}

function writeNuxtConfig(consumerRoot, options) {
  fs.writeFileSync(path.join(consumerRoot, 'nuxt.config.ts'), `export default defineNuxtConfig({
  modules: ['@lucashw68/nsdb', '@pinia/nuxt', '@nuxtjs/supabase'],
  nsdb: ${JSON.stringify(options)},
})\n`)
}

function prepareAndRead(consumerRoot, options) {
  fs.rmSync(path.join(consumerRoot, '.nuxt'), { recursive: true, force: true })
  writeNuxtConfig(consumerRoot, options)
  run(path.join(consumerRoot, 'node_modules/.bin/nuxt'), ['prepare'], consumerRoot)
  return {
    components: fs.readFileSync(path.join(consumerRoot, '.nuxt/components.d.ts'), 'utf8'),
    imports: fs.readFileSync(path.join(consumerRoot, '.nuxt/imports.d.ts'), 'utf8'),
  }
}

function assertPackageBoundaries(consumerRoot) {
  const installedRoot = fs.realpathSync(path.join(consumerRoot, 'node_modules/@lucashw68/nsdb'))
  assert.equal(installedRoot.startsWith(consumerRoot), true, 'NSDB must be unpacked in the isolated consumer')
  assert.equal(installedRoot.includes(path.join('Tools', 'NSDB', 'Nsdb')), false, 'consumer must not resolve repository sources')
  const installedPackage = JSON.parse(fs.readFileSync(path.join(installedRoot, 'package.json'), 'utf8'))
  assert.equal(installedPackage.version, packageVersion)

  const consumerRequire = createRequire(path.join(consumerRoot, 'package.json'))
  assert.match(consumerRequire.resolve('@lucashw68/nsdb/useSupabaseModel'), /useSupabaseModels\.ts$/)
  assert.match(consumerRequire.resolve('@lucashw68/nsdb/types'), /types\/index\.ts$/)
  for (const privatePath of [
    '@lucashw68/nsdb/runtime/query',
    '@lucashw68/nsdb/runtime/components/Form/NsdbRelationSelect',
    '@lucashw68/nsdb/helpers/config',
    '@lucashw68/nsdb/scripts/generate-models',
    '@lucashw68/nsdb/templates/model.template',
    '@lucashw68/nsdb/useSupabaseModels',
    '@lucashw68/nsdb/useNsdbSchemas',
    '@lucashw68/nsdb/createSingletonDbStore',
  ]) {
    assert.throws(
      () => consumerRequire.resolve(privatePath),
      error => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
      `${privatePath} must stay blocked by package exports`,
    )
  }
}

function generatePublicArtifacts(consumerRoot) {
  const nsdbBin = path.join(consumerRoot, 'node_modules/.bin/nsdb')
  const help = execFileSync(nsdbBin, ['--help'], { cwd: consumerRoot, encoding: 'utf8', env: commandEnvironment() })
  assert.match(help, /nsdb generate:all/)
  for (const command of [
    'generate:enums',
    'generate:schemas',
    'generate:models',
    'generate:stores',
    'generate:models',
    'generate:composables',
  ]) run(nsdbBin, [command], consumerRoot)
  run(nsdbBin, ['clear', '--dry-run'], consumerRoot)
}

try {
  let tarballPath = suppliedTarball
  if (!tarballPath) {
    const packResult = execFileSync('npm', ['pack', '--json', '--pack-destination', temporaryRoot], {
      cwd: packageRoot,
      encoding: 'utf8',
      env: { ...process.env, NPM_CONFIG_CACHE: npmCache },
    })
    const [{ filename: packedFilename }] = JSON.parse(packResult)
    tarballPath = path.join(temporaryRoot, packedFilename)
  }
  const filename = path.basename(tarballPath)
  assert.equal(fs.existsSync(tarballPath), true, 'npm pack must produce a tarball')

  for (const consumer of consumers) {
    const consumerRoot = path.join(temporaryRoot, consumer.name)
    fs.cpSync(path.join(fixturesRoot, consumer.fixture), consumerRoot, { recursive: true })
    const packageJsonPath = path.join(consumerRoot, 'package.json')
    fs.writeFileSync(packageJsonPath, fs.readFileSync(packageJsonPath, 'utf8').replace('__NSDB_TARBALL__', tarballPath))

    run('npm', ['install', '--legacy-peer-deps', '--no-audit', '--no-fund'], consumerRoot)
    run('npm', ['ls', 'vue', 'pinia', '@supabase/supabase-js', '--all'], consumerRoot)
    assertPackageBoundaries(consumerRoot)
    generatePublicArtifacts(consumerRoot)

    const generatedModels = path.join(consumerRoot, 'nsdb/models')
    const generatedSource = fs.readdirSync(generatedModels)
      .filter(name => name.endsWith('.ts'))
      .map(name => fs.readFileSync(path.join(generatedModels, name), 'utf8'))
      .join('\n')
    assert.doesNotMatch(generatedSource, /\.\.\/Nsdb|Nsdb\/src|useNsdbSchemas|\b(?:new|find|sync):/)

    const typecheckMs = run(path.join(consumerRoot, 'node_modules/.bin/nuxt'), ['typecheck'], consumerRoot)
    run(path.join(consumerRoot, 'node_modules/.bin/nuxt'), ['build'], consumerRoot)
    console.log(`[nsdb] ${consumer.name} typecheck: ${typecheckMs}ms`)

    if (consumer.moduleMatrix) {
      for (const withComponents of [true, false]) {
        for (const withStores of [true, false]) {
          const prepared = prepareAndRead(consumerRoot, { withComponents, withStores, componentsPrefix: 'Nsdb' })
          assert.equal(prepared.components.includes('export const NsdbList:'), withComponents)
          assert.equal(prepared.components.includes('NsdbRelationSelect'), false)
          assert.equal(prepared.imports.includes('createDbStore'), withStores)
          assert.equal(prepared.imports.includes('createSingletonStore'), withStores)
          assert.equal(prepared.imports.includes('normalizePath'), false)
        }
      }
      const customPrefix = prepareAndRead(consumerRoot, { withComponents: true, withStores: true, componentsPrefix: 'Bridge' })
      assert.match(customPrefix.components, /export const BridgeNsdbList:/)

      const appComposables = path.join(consumerRoot, 'app/composables')
      fs.mkdirSync(appComposables, { recursive: true })
      fs.writeFileSync(path.join(appComposables, 'usePlaylists.ts'), 'export const usePlaylists = () => ({ source: "application" })\n')
      fs.rmSync(path.join(consumerRoot, '.nuxt'), { recursive: true, force: true })
      writeNuxtConfig(consumerRoot, { withComponents: false, withStores: false })
      const collisionOutput = captureFailure(path.join(consumerRoot, 'node_modules/.bin/nuxt'), ['prepare'], consumerRoot)
      assert.match(collisionOutput, /Auto-import collision for "usePlaylists"/)
      const explicit = prepareAndRead(consumerRoot, { withComponents: false, withStores: false, autoImportModels: false })
      assert.doesNotMatch(explicit.imports, /nsdb\/models\/playlists/)
    }
  }

  const initRoot = path.join(temporaryRoot, 'readme-init')
  fs.mkdirSync(initRoot)
  const nsdbBin = path.join(temporaryRoot, 'minimal/node_modules/.bin/nsdb')
  const missingSource = captureFailure(nsdbBin, ['generate:types'], initRoot)
  assert.match(missingSource, /Missing Supabase source/)
  assert.match(missingSource, /--db-url|--project-id|--linked/)
  run(nsdbBin, ['init'], initRoot)
  assert.equal(fs.existsSync(path.join(initRoot, 'nsdb.config.ts')), true)

  console.log(`Release consumers passed with ${filename}`)
} finally {
  if (process.env.NSDB_KEEP_CONSUMER_FIXTURE !== '1') fs.rmSync(temporaryRoot, { recursive: true, force: true })
  else console.log(`Consumer fixtures kept at ${temporaryRoot}`)
}
