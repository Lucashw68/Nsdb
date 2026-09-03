function normalizeTableList(value, optionName) {
	if (value == null) return []
	if (!Array.isArray(value) || value.some(table => typeof table !== 'string' || !table.trim())) {
		throw new TypeError(`[nsdb] tables.${optionName} must be an array of non-empty table names.`)
	}
	return [...new Set(value.map(table => table.trim()))]
}

export function selectTableNames(availableTableNames, tableSelection = {}) {
	const available = [...new Set(availableTableNames)].sort((left, right) => left.localeCompare(right))
	const include = normalizeTableList(tableSelection?.include, 'include')
	const exclude = normalizeTableList(tableSelection?.exclude, 'exclude')

	if (include.length > 0 && exclude.length > 0) {
		throw new Error('[nsdb] Configure either tables.include or tables.exclude, not both.')
	}

	const availableSet = new Set(available)
	const configuredNames = include.length > 0 ? include : exclude
	const unknownNames = configuredNames.filter(table => !availableSet.has(table))
	if (unknownNames.length > 0) {
		throw new Error(`[nsdb] Unknown table(s) in exposure config: ${unknownNames.join(', ')}`)
	}

	if (include.length > 0) {
		const included = new Set(include)
		return available.filter(table => included.has(table))
	}

	const excluded = new Set(exclude)
	return available.filter(table => !excluded.has(table))
}

export function selectTableProperties(tablesType, tableSelection = {}) {
	const properties = tablesType.getProperties()
	const byName = new Map(properties.map(property => [property.getName(), property]))
	return selectTableNames([...byName.keys()], tableSelection).map(tableName => byName.get(tableName))
}

export function getColumnPolicies(tableSelection = {}, tableName, availableColumnNames) {
	const configuredTables = tableSelection?.columns ?? {}
	if (configuredTables == null || typeof configuredTables !== 'object' || Array.isArray(configuredTables)) {
		throw new TypeError('[nsdb] tables.columns must be an object keyed by table name.')
	}

	const tableRules = configuredTables[tableName] ?? {}
	if (typeof tableRules !== 'object' || Array.isArray(tableRules)) {
		throw new TypeError(`[nsdb] tables.columns.${tableName} must be an object keyed by column name.`)
	}

	const available = new Set(availableColumnNames)
	const unknown = Object.keys(tableRules).filter(column => !available.has(column))
	if (unknown.length) {
		throw new Error(`[nsdb] Unknown column(s) for ${tableName}: ${unknown.join(', ')}`)
	}

	const result = {}
	for (const columnName of availableColumnNames) {
		const rule = tableRules[columnName] ?? {}
		if (typeof rule !== 'object' || Array.isArray(rule)) {
			throw new TypeError(`[nsdb] Column policy ${tableName}.${columnName} must be an object.`)
		}
		for (const key of ['selectable', 'editable', 'hidden', 'serverOnly']) {
			if (rule[key] != null && typeof rule[key] !== 'boolean') {
				throw new TypeError(`[nsdb] ${tableName}.${columnName}.${key} must be boolean.`)
			}
		}
		if (rule.serverOnly && (rule.selectable === true || rule.editable === true)) {
			throw new Error(`[nsdb] ${tableName}.${columnName} cannot be serverOnly and selectable/editable.`)
		}
		result[columnName] = {
			selectable: rule.serverOnly ? false : rule.selectable ?? true,
			editable: rule.serverOnly ? false : rule.editable,
			hidden: rule.serverOnly ? true : rule.hidden ?? false,
			serverOnly: rule.serverOnly ?? false,
		}
	}
	return result
}
