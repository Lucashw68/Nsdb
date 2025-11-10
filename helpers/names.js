// helpers/names.js
export const toPascal = (s) => (
	String(s)
		.replace(/[_\-./\s]+/g, ' ')
		.trim()
		.replace(/(^|\s)([a-zA-Z])/g, (_, __, c) => c.toUpperCase())
		.replace(/\s+/g, '')
)

export const singular = (s) => (
	String(s).endsWith('s') ? s.slice(0, -1) : s
)

export const modelHookName = (table) => `use${toPascal(table)}`
export const storeName = (table) => `use${toPascal(singular(table))}Store`
