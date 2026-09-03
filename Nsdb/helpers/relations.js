function singular(value) {
	return value.endsWith('ies') ? `${value.slice(0, -3)}y` : value.replace(/s$/, '')
}

function forwardAlias(relation) {
	const raw = relation.columns.join('_').replace(/_id(?:_|$)/g, '_').replace(/_+$/, '')
	return raw || singular(relation.referencedRelation)
}

function addUnique(catalog, tableName, relation) {
	const entries = catalog[tableName] ??= []
	let alias = relation.alias
	if (entries.some(entry => entry.alias === alias)) {
		alias = `${alias}_${relation.foreignKeyName}`.replace(/[^a-zA-Z0-9_]/g, '_')
	}
	entries.push({ ...relation, alias })
}

function isJoinTable(table) {
	if (table.relationships.length !== 2) return false
	const relationColumns = table.relationships.flatMap(relation => relation.columns)
	const uniqueRelationColumns = [...new Set(relationColumns)].sort()
	const constrained = [table.primaryKey, ...table.uniqueConstraints.map(item => item.columns)]
		.some(columns => [...columns].sort().join('\0') === uniqueRelationColumns.join('\0'))
	if (!constrained) return false

	return Object.entries(table.columns).every(([column, metadata]) =>
		uniqueRelationColumns.includes(column) || metadata.nullable || metadata.hasDefault || metadata.generated,
	)
}

export function buildRelationCatalog(databaseMetadata, exposedTableNames) {
	const catalog = Object.fromEntries([...exposedTableNames].map(tableName => [tableName, []]))
	if (!databaseMetadata) return catalog

	for (const [sourceTable, table] of Object.entries(databaseMetadata.tables)) {
		if (!exposedTableNames.has(sourceTable)) continue
		for (const relation of table.relationships) {
			if (!exposedTableNames.has(relation.referencedRelation)) continue
			const alias = forwardAlias(relation)
			const nullable = relation.columns.some(column => table.columns[column]?.nullable)
			addUnique(catalog, sourceTable, {
				alias,
				kind: relation.isOneToOne ? 'hasOne' : 'belongsTo',
				direction: 'forward',
				nullable,
				referencedTable: relation.referencedRelation,
				embedResource: sourceTable === relation.referencedRelation && relation.columns.length === 1
					? relation.columns[0]
					: relation.referencedRelation,
				localColumns: relation.columns,
				referencedColumns: relation.referencedColumns,
				foreignKeyName: relation.foreignKeyName,
				composite: relation.columns.length > 1,
			})

			const duplicates = table.relationships.filter(item => item.referencedRelation === relation.referencedRelation).length
			const inverseAlias = sourceTable === relation.referencedRelation && alias === 'parent'
				? 'children'
				: duplicates > 1 ? `${alias}_${sourceTable}` : sourceTable
			addUnique(catalog, relation.referencedRelation, {
				alias: inverseAlias,
				kind: relation.isOneToOne ? 'hasOne' : 'hasMany',
				direction: 'inverse',
				nullable: false,
				referencedTable: sourceTable,
				embedResource: sourceTable,
				localColumns: relation.referencedColumns,
				referencedColumns: relation.columns,
				foreignKeyName: relation.foreignKeyName,
				composite: relation.columns.length > 1,
			})
		}
	}

	for (const [joinTableName, table] of Object.entries(databaseMetadata.tables)) {
		if (!exposedTableNames.has(joinTableName) || !isJoinTable(table)) continue
		const [left, right] = table.relationships
		if (!exposedTableNames.has(left.referencedRelation) || !exposedTableNames.has(right.referencedRelation)) continue
		addUnique(catalog, left.referencedRelation, {
			alias: right.referencedRelation,
			kind: 'manyToMany', direction: 'through', nullable: false,
			referencedTable: right.referencedRelation,
			embedResource: right.referencedRelation,
			localColumns: left.referencedColumns,
			referencedColumns: right.referencedColumns,
			throughTable: joinTableName,
		})
		addUnique(catalog, right.referencedRelation, {
			alias: left.referencedRelation,
			kind: 'manyToMany', direction: 'through', nullable: false,
			referencedTable: left.referencedRelation,
			embedResource: left.referencedRelation,
			localColumns: right.referencedColumns,
			referencedColumns: left.referencedColumns,
			throughTable: joinTableName,
		})
	}

	return catalog
}
