export type FieldType =
	| 'text'
	| 'textarea'
	| 'select'
	| 'checkbox'
	| 'number'
	| 'datetime'
	| 'file'
	| 'relation'

export type EntityField = {
	label: string
	type: FieldType
	required?: boolean
	readonly?: boolean
	default?: any
	options?: Array<{ label: string; value: any }>
	relation?: {
		table: string
		field: string
	}
}
