
# NsdbForm — Documentation

NsdbForm is a fully headless and schema‑driven form generator for the nsdb DX layer.
It supports:

- Creation and edition of any model
- Automatic initialization via DX handles (`usePlaylists`, `useSongs`, etc.)
- Automatic detection of required fields
- Automatic validation for required fields
- Validation for hidden required fields
- Automatic filtering of readOnly & primaryKey fields before submit
- Fully customizable UI via named slots
- Smooth integration with Supabase through your DX handles

---

# 1. Basic Usage

```vue
<NsdbForm
    model="playlists"
    :initial-values="{ title: '', profile_id: userId }"
    @saved="playlist => console.log('Saved!', playlist)"
/>
```

NsdbForm automatically:

- Loads the schema from `useNsdbModel(model)`
- Builds initial values (fallback from `handle.createDraft()`)
- Renders default fields if you do not use slots
- Filters forbidden fields (`id`, `created_at`, `updated_at`, etc.)
- Submits via `handle.add()` or `handle.patch()`

---

# 2. Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `model` | `string` | required | Name used by `useNsdbModel` to get the DX handle |
| `id` | `string \| number \| null` | `null` | If set → edit mode, otherwise creation |
| `initialValues` | `Record<string, any>` | `{}` | Pre-filled values for the form |
| `hideFields` | `string[]` | `[]` | Fields to hide from the UI |

---

# 3. Events

| Event | Payload | Description |
|-------|---------|-------------|
| `saved` | entity | Fired after successful creation or update |
| `created` | entity | Fired only on creation |
| `updated` | entity | Fired only on update |
| `error` | error | Fired if any submission error happens |

---

# 4. Required Field Validation

The component automatically checks:

1. **Hidden required fields**
   If a field is BOTH `required: true` in the schema AND listed in `hideFields`,
   it must be provided in `initialValues`.
   Otherwise the form will refuse to submit.

2. **Visible required fields**
   All visible required fields must have a non-empty value:
   - `null`, `undefined`, `""` → invalid
   - `false`, `0`, `"0"` → valid

Validation errors are emitted in:

```ts
fieldErrors.value = {
    fieldName: ["error message"]
}
```

---

# 5. Automatic Payload Filtering

Before submitting, NsdbForm removes all:

- Primary key fields (`primaryKey: true`)
- Readonly fields (`readOnly: true`)

This prevents errors like:

```
null value in column "id" violates not-null constraint
```

---

# 6. Slots

NsdbForm is headless and slot‑driven.

### `header`

```vue
<template #header="{ mode }">
	<h2>{{ mode === 'create' ? 'New Playlist' : 'Edit Playlist' }}</h2>
</template>
```

---

### `error`

```vue
<template #error="{ error }">
	<div class="text-red-500">{{ error }}</div>
</template>
```

---

### `fields`

Full control over the visible fields:

```vue
<template #fields="{ form, setField, schema, visibleFieldKeys }">
	<div v-for="key in visibleFieldKeys">
		<label>{{ key }}</label>
		<input
			:value="form[key]"
			@input="setField(key, $event.target.value)"
		/>
	</div>
</template>
```

Fallback fields are rendered if the slot is not defined.

---

### `actions`

```vue
<template #actions="{ saving, mode }">
	<button type="submit">
		{{ saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Update' }}
	</button>
</template>
```

---

# 7. Full Example

```vue
<NsdbForm
	model="playlists"
	:initial-values="{ title: '', profile_id: user.id }"
	:hide-fields="['id', 'created_at', 'updated_at']"
	@created="p => console.log('Created', p)"
>
	<template #fields="{ form, setField, schema, visibleFieldKeys }">
		<div class="grid gap-3">
			<div>
				<label>Title</label>
				<input
					type="text"
					v-model="form.title"
					class="border p-2"
				/>
			</div>

			<div>
				<label>Provider</label>
				<select
					:value="form.provider"
					@change="setField('provider', $event.target.value)"
				>
					<option
						v-for="p in schema.provider.enum"
						:key="p"
						:value="p"
					>{{ p }}</option>
				</select>
			</div>
		</div>
	</template>

	<template #actions="{ saving }">
		<button :disabled="saving">Save</button>
	</template>
</NsdbForm>
```

---

# 8. Summary

NsdbForm provides:

- Schema‑driven form generation
- Required field validation (visible + hidden)
- Automatic cleaning of payload (no readOnly/pk fields)
- DX‑handle powered data loading & saving
- Total UI flexibility through slots
- Robust error handling

This makes it suitable as the base form component for any nsdb model.
