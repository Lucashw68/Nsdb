import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { markGenerated } from '../helpers/generated.js'
import { main as generateEnums } from '../scripts/generate-enums.js'
import { main as generateSchemas } from '../scripts/generate-schemas.js'
import { main as generateModels } from '../scripts/generate-models.js'
import { main as generateStores } from '../scripts/generate-stores.js'
import { main as generateComposables } from '../scripts/generate-composables.js'

const packageRoot = path.resolve(import.meta.dirname, '..')

const databaseFixture = `export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null }
        Insert: { id?: string; display_name?: string | null }
        Update: { id?: string; display_name?: string | null }
        Relationships: []
      }
      playlists: {
        Row: {
          id: string
          title: string
          description: string | null
          status: Database["public"]["Enums"]["playlist_status"]
          owner_id: string
          score: number | null
          active: boolean
          metadata: Json | null
          tags: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: Database["public"]["Enums"]["playlist_status"]
          owner_id: string
          score?: number | null
          active?: boolean
          metadata?: Json | null
          tags?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: Database["public"]["Enums"]["playlist_status"]
          owner_id?: string
          score?: number | null
          active?: boolean
          metadata?: Json | null
          tags?: string[] | null
          created_at?: string
        }
        Relationships: [{
          foreignKeyName: "playlists_owner_id_fkey"
          columns: ["owner_id"]
          isOneToOne: false
          referencedRelation: "profiles"
          referencedColumns: ["id"]
        }]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: { playlist_status: "draft" | "published" }
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"]
`

function createFixtureProject() {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nsdb-generators-'))
	fs.mkdirSync(path.join(root, 'types'), { recursive: true })
	fs.writeFileSync(path.join(root, 'types', 'database.types.ts'), databaseFixture)
	return root
}

async function runScript(root, generator, args) {
	const previousDirectory = process.cwd()
	const previousArguments = process.argv
	process.chdir(root)
	process.argv = [process.execPath, 'nsdb-generator', ...args]
	try {
		await generator()
	} finally {
		process.argv = previousArguments
		process.chdir(previousDirectory)
	}
}

async function generateAllFromFixture(root) {
	const types = 'types/database.types.ts'
	await runScript(root, generateEnums, ['--types', types, '--out', 'nsdb/enums.ts'])
	await runScript(root, generateSchemas, [
		'--types', types,
		'--outDir', 'nsdb/schemas',
		'--template', path.join(packageRoot, 'templates/schema.template.ts'),
	])
	await runScript(root, generateModels, [
		'--types', types,
		'--outDir', 'nsdb/models',
		'--template', path.join(packageRoot, 'templates/model.template.ts'),
	])
	await runScript(root, generateStores, [
		'--models-dir', 'nsdb/models',
		'--stores-dir', 'stores',
		'--types-import-path', '~~/types/database.types',
	])
	// Models are intentionally regenerated after stores so their optional adapter is bound.
	await runScript(root, generateModels, [
		'--types', types,
		'--outDir', 'nsdb/models',
		'--template', path.join(packageRoot, 'templates/model.template.ts'),
	])
	await runScript(root, generateComposables, [
		'--types', types,
		'--outDir', 'nsdb/composables',
		'--template', path.join(packageRoot, 'templates/useNsdbModel.template.ts'),
	])
}

function snapshotGenerated(root) {
	const roots = ['nsdb', 'stores']
	const snapshot = new Map()

	function visit(directory) {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			const entryPath = path.join(directory, entry.name)
			if (entry.isDirectory()) visit(entryPath)
			else snapshot.set(path.relative(root, entryPath), fs.readFileSync(entryPath, 'utf8'))
		}
	}

	for (const relativeRoot of roots) visit(path.join(root, relativeRoot))
	return [...snapshot.entries()].sort(([left], [right]) => left.localeCompare(right))
}

test('generators map observable Supabase types, enums and relationships', async () => {
	const root = createFixtureProject()
	await generateAllFromFixture(root)

	const enums = fs.readFileSync(path.join(root, 'nsdb/enums.ts'), 'utf8')
	const schema = fs.readFileSync(path.join(root, 'nsdb/schemas/playlists.ts'), 'utf8')
	const model = fs.readFileSync(path.join(root, 'nsdb/models/playlists.ts'), 'utf8')
	const registry = fs.readFileSync(path.join(root, 'nsdb/composables/useNsdbModels.ts'), 'utf8')

	assert.match(enums, /PlaylistStatusValues = \["draft","published"\] as const/)
	assert.match(schema, /title: \{ label: 'Title', type: 'text', required: true/)
	assert.match(schema, /description: \{ label: 'Description', type: 'text', required: false/)
	assert.match(schema, /status: \{ label: 'Status', type: 'select'/)
	assert.match(schema, /active: \{ label: 'Active', type: 'checkbox'/)
	assert.match(schema, /score: \{ label: 'Score', type: 'number'/)
	assert.match(schema, /description: .*nullable: true, hasDefault: false/)
	assert.match(schema, /status: .*nullable: false, hasDefault: true/)
	assert.match(schema, /referencedTable: 'profiles'/)
	assert.match(schema, /foreignKeyName: 'playlists_owner_id_fkey'/)
	assert.match(model, /import \{ usePlaylistStore \}/)
	assert.match(model, /TablesInsert/)
	assert.match(model, /PlaylistsInsert/)
	assert.match(model, /TablesUpdate/)
	assert.match(model, /PlaylistsUpdate/)
	assert.match(model, /useSupabaseModel<PlaylistsRow, PlaylistsInsert, PlaylistsUpdate, 'id'>/)
	assert.match(model, /storeCreator: \(\(\) => usePlaylistStore\(\) as any\)/)
	assert.match(registry, /case 'playlists'/)
	const store = fs.readFileSync(path.join(root, 'stores/usePlaylistStore.ts'), 'utf8')
	assert.doesNotMatch(store, /export type PlaylistsRow/)
})

test('schema generation exposes database field capabilities and safe UI controls', async () => {
	const root = createFixtureProject()
	fs.mkdirSync(path.join(root, 'nsdb'), { recursive: true })
	fs.writeFileSync(path.join(root, 'nsdb.config.mjs'), `export default { paths: { metadata: 'nsdb/database.metadata.json' } }\n`)
	fs.writeFileSync(path.join(root, 'nsdb/database.metadata.json'), JSON.stringify({
		version: 1,
		schema: 'public',
		tables: {
			playlists: {
				primaryKey: ['id'],
				uniqueConstraints: [],
				relationships: [],
				columns: {
					id: { dataType: 'uuid', nullable: false, hasDefault: true, defaultExpression: 'gen_random_uuid()', primaryKey: true, insertable: true, updatable: false },
					title: { dataType: 'text', nullable: false, hasDefault: false, defaultExpression: null, primaryKey: false, insertable: true, updatable: true },
					description: { dataType: 'text', nullable: true, hasDefault: false, defaultExpression: null, primaryKey: false, insertable: true, updatable: true },
					status: { dataType: 'playlist_status', nullable: false, hasDefault: true, defaultExpression: "'draft'::playlist_status", primaryKey: false, insertable: true, updatable: true },
					owner_id: { dataType: 'uuid', nullable: false, hasDefault: false, defaultExpression: null, primaryKey: false, insertable: true, updatable: true },
					score: { dataType: 'numeric', nullable: true, hasDefault: false, defaultExpression: null, primaryKey: false, insertable: true, updatable: true },
					active: { dataType: 'boolean', nullable: false, hasDefault: true, defaultExpression: 'false', primaryKey: false, insertable: true, updatable: true },
					metadata: { dataType: 'jsonb', nullable: true, hasDefault: false, defaultExpression: null, primaryKey: false, insertable: true, updatable: true },
					tags: { dataType: 'text[]', nullable: true, hasDefault: false, defaultExpression: null, primaryKey: false, insertable: true, updatable: true },
					created_at: { dataType: 'timestamp with time zone', nullable: false, hasDefault: true, defaultExpression: 'now()', primaryKey: false, insertable: true, updatable: true },
				},
			},
		},
	}))

	await runScript(root, generateSchemas, [
		'--types', 'types/database.types.ts',
		'--outDir', 'nsdb/schemas',
		'--template', path.join(packageRoot, 'templates/schema.template.ts'),
	])
	const schema = fs.readFileSync(path.join(root, 'nsdb/schemas/playlists.ts'), 'utf8')

	assert.match(schema, /id: \{[^\n]*insertable: true, updatable: false[^\n]*primaryKey: true[^\n]*hasDefault: true/)
	assert.match(schema, /title: \{[^\n]*required: true[^\n]*insertable: true, updatable: true/)
	assert.match(schema, /metadata: \{[^\n]*type: 'json'/)
	assert.match(schema, /tags: \{[^\n]*type: 'array'/)
	assert.match(schema, /created_at: \{[^\n]*type: 'datetime'[^\n]*hasDefault: true[^\n]*defaultExpression: "now\(\)"/)
})

test('complete generation is byte-deterministic and prunes only marked stale outputs', async () => {
	const root = createFixtureProject()
	await generateAllFromFixture(root)
	const firstSnapshot = snapshotGenerated(root)

	const staleGenerated = path.join(root, 'nsdb/models/removed_table.ts')
	const userFile = path.join(root, 'nsdb/models/custom.ts')
	fs.writeFileSync(staleGenerated, markGenerated('export {}\n'))
	fs.writeFileSync(userFile, 'export const custom = true\n')

	await generateAllFromFixture(root)
	const secondSnapshot = snapshotGenerated(root).filter(([name]) => name !== 'nsdb/models/custom.ts')

	assert.deepEqual(secondSnapshot, firstSnapshot)
	assert.equal(fs.existsSync(staleGenerated), false)
	assert.equal(fs.existsSync(userFile), true)
})

test('package and CLI generate:all both regenerate models after stores', () => {
	const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'))
	const packageCommand = packageJson.scripts['generate:all']
	const cliSource = fs.readFileSync(path.join(packageRoot, 'cli/index.js'), 'utf8')

	assert.equal((packageCommand.match(/generate:models/g) ?? []).length, 2)
	assert.match(cliSource, /generate-models\.js'[\s\S]*generate-stores\.js'[\s\S]*generate-models\.js'/)
})

test('table allowlist limits every generated client artifact', async () => {
	const root = createFixtureProject()
	fs.writeFileSync(
		path.join(root, 'nsdb.config.mjs'),
		`export default {
			tables: {
				include: ['playlists'],
				columns: {
					playlists: {
						metadata: { serverOnly: true },
						description: { hidden: true },
						title: { editable: false },
						active: { selectable: false },
					},
				},
			},
		}\n`,
	)

	await generateAllFromFixture(root)

	assert.equal(fs.existsSync(path.join(root, 'nsdb/models/profiles.ts')), false)
	assert.equal(fs.existsSync(path.join(root, 'nsdb/schemas/profiles.ts')), false)
	assert.equal(fs.existsSync(path.join(root, 'stores/useProfileStore.ts')), false)
	const registry = fs.readFileSync(path.join(root, 'nsdb/composables/useNsdbModels.ts'), 'utf8')
	const playlistSchema = fs.readFileSync(path.join(root, 'nsdb/schemas/playlists.ts'), 'utf8')
	assert.doesNotMatch(registry, /profiles/)
	assert.doesNotMatch(playlistSchema, /referencedTable: 'profiles'/)
	assert.doesNotMatch(playlistSchema, /metadata:/)
	assert.match(playlistSchema, /description: \{[^\n]*hidden: true/)
	assert.match(playlistSchema, /title: \{[^\n]*editable: false[^\n]*readonly: true/)
	const playlistModel = fs.readFileSync(path.join(root, 'nsdb/models/playlists.ts'), 'utf8')
	assert.match(playlistModel, /PlaylistsRow = Omit<Tables<'playlists'>, 'active' \| 'metadata'>/)
	assert.match(playlistModel, /PlaylistsInsert = Omit<TablesInsert<'playlists'>, [^\n]*'title'/)
})
