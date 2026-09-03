export const PlaylistsSchema = {
	id: { label: 'ID', type: 'text', readonly: true },
	title: { label: 'Title', type: 'text', required: true },
	description: { label: 'Description', type: 'textarea' },
	published_at: { label: 'Published at', type: 'datetime' },
	attachment: { label: 'Attachment', type: 'file' },
	status: {
		label: 'Status',
		type: 'select',
		options: [
			{ label: 'Draft', value: 'draft' },
			{ label: 'Published', value: 'published' },
		],
	},
	active: { label: 'Active', type: 'checkbox' },
	internal_note: { label: 'Internal note', type: 'text', hidden: true },
	server_secret: { label: 'Server secret', type: 'text', serverOnly: true, editable: false, selectable: false },
}
