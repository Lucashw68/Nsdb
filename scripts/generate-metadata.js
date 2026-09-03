#!/usr/bin/env node
import path from 'node:path'
import postgres from 'postgres'
import { parseArgs } from '../helpers/args.js'
import { getOption, loadNsdbConfig } from '../helpers/config.js'
import { writeText } from '../helpers/io.js'

function sameColumns(left, right) {
	return left.length === right.length && left.every((column, index) => column === right[index])
}

export async function introspectDatabase({ dbUrl, schemaName = 'public' }) {
	const sql = postgres(dbUrl, { max: 1, prepare: false })
	try {
		const columns = await sql`
			select
				cls.relname as table_name,
				att.attname as column_name,
				att.attnum as ordinal_position,
				pg_catalog.format_type(att.atttypid, att.atttypmod) as data_type,
				not att.attnotnull as nullable,
				pg_get_expr(def.adbin, def.adrelid) as default_expression,
				att.attidentity as identity_kind,
				att.attgenerated as generated_kind,
				typ.typtype = 'e' as is_enum,
				typ.typname as database_type
			from pg_catalog.pg_attribute att
			join pg_catalog.pg_class cls on cls.oid = att.attrelid
			join pg_catalog.pg_namespace ns on ns.oid = cls.relnamespace
			join pg_catalog.pg_type typ on typ.oid = att.atttypid
			left join pg_catalog.pg_attrdef def
				on def.adrelid = att.attrelid and def.adnum = att.attnum
			where ns.nspname = ${schemaName}
				and cls.relkind in ('r', 'p')
				and att.attnum > 0
				and not att.attisdropped
			order by cls.relname, att.attnum
		`

		const constraints = await sql`
			select
				con.conname as constraint_name,
				con.contype as constraint_type,
				local_table.relname as table_name,
				foreign_table.relname as referenced_table,
				array(
					select local_att.attname
					from unnest(con.conkey) with ordinality as key(attnum, position)
					join pg_catalog.pg_attribute local_att
						on local_att.attrelid = con.conrelid and local_att.attnum = key.attnum
					order by key.position
				) as columns,
				case when con.confkey is null then array[]::text[] else array(
					select foreign_att.attname
					from unnest(con.confkey) with ordinality as key(attnum, position)
					join pg_catalog.pg_attribute foreign_att
						on foreign_att.attrelid = con.confrelid and foreign_att.attnum = key.attnum
					order by key.position
				) end as referenced_columns
			from pg_catalog.pg_constraint con
			join pg_catalog.pg_class local_table on local_table.oid = con.conrelid
			join pg_catalog.pg_namespace ns on ns.oid = local_table.relnamespace
			left join pg_catalog.pg_class foreign_table on foreign_table.oid = con.confrelid
			where ns.nspname = ${schemaName} and con.contype in ('p', 'u', 'f')
			order by local_table.relname, con.conname
		`

		const tables = {}
		for (const column of columns) {
			const table = tables[column.table_name] ??= {
				primaryKey: [],
				uniqueConstraints: [],
				columns: {},
				relationships: [],
			}
			const identity = column.identity_kind === 'a'
				? 'always'
				: column.identity_kind === 'd' ? 'byDefault' : false
			const generated = column.generated_kind === 's'
				? 'stored'
				: column.generated_kind === 'v' ? 'virtual' : false
			table.columns[column.column_name] = {
				position: Number(column.ordinal_position),
				dataType: column.data_type,
				databaseType: column.database_type,
				nullable: Boolean(column.nullable),
				hasDefault: column.default_expression != null || Boolean(identity),
				defaultExpression: column.default_expression,
				identity,
				generated,
				enum: Boolean(column.is_enum),
				primaryKey: false,
				unique: false,
				insertable: !generated && identity !== 'always',
				updatable: !generated && identity !== 'always',
			}
		}

		for (const constraint of constraints) {
			const table = tables[constraint.table_name]
			if (!table) continue
			const constraintColumns = [...constraint.columns]
			if (constraint.constraint_type === 'p') {
				table.primaryKey = constraintColumns
				for (const column of constraintColumns) {
					table.columns[column].primaryKey = true
					table.columns[column].updatable = false
				}
			}
			if (constraint.constraint_type === 'p' || constraint.constraint_type === 'u') {
				table.uniqueConstraints.push({ name: constraint.constraint_name, columns: constraintColumns })
				if (constraintColumns.length === 1) table.columns[constraintColumns[0]].unique = true
			}
		}

		for (const constraint of constraints.filter(item => item.constraint_type === 'f')) {
			const table = tables[constraint.table_name]
			if (!table) continue
			const relationColumns = [...constraint.columns]
			table.relationships.push({
				foreignKeyName: constraint.constraint_name,
				columns: relationColumns,
				referencedRelation: constraint.referenced_table,
				referencedColumns: [...constraint.referenced_columns],
				isOneToOne: table.uniqueConstraints.some(unique => sameColumns(unique.columns, relationColumns)),
			})
		}

		return { version: 1, schema: schemaName, tables }
	} finally {
		await sql.end()
	}
}

export async function main() {
	const parsedArguments = parseArgs()
	const currentWorkingDirectory = process.cwd()
	const { config } = await loadNsdbConfig(currentWorkingDirectory, parsedArguments.get('config', ''))
	const dbUrl = getOption(parsedArguments, config, 'db-url', 'supabase.dbUrl', process.env.SUPABASE_DB_URL || '')
	const schemaName = getOption(parsedArguments, config, 'schema', 'supabase.schema', 'public')
	const outputPath = path.resolve(
		currentWorkingDirectory,
		getOption(parsedArguments, config, 'out', 'paths.metadata', 'nsdb/database.metadata.json'),
	)

	if (!dbUrl) {
		console.warn(
			'⚠️  Metadata introspection skipped: configure supabase.dbUrl or SUPABASE_DB_URL. ' +
			'Generation will fall back to Supabase TypeScript types and cannot reliably infer SQL defaults, identity/generated columns, composite constraints, or inverse relations.'
		)
		return
	}

	const metadata = await introspectDatabase({ dbUrl, schemaName })
	writeText(outputPath, `${JSON.stringify(metadata, null, 2)}\n`)
	console.log(`✅ metadata: ${path.relative(currentWorkingDirectory, outputPath)}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error('❌ Failed to introspect PostgreSQL metadata.')
		console.error(error)
		process.exit(1)
	})
}
