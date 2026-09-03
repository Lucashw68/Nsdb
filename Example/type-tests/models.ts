import { usePlaylists } from '~~/nsdb/models/playlists'

const playlists = usePlaylists()

void playlists.refresh()
playlists.invalidate()
playlists.subscribe()
void playlists.unsubscribe()
playlists.stale.value satisfies boolean

void playlists.create({ title: 'Typed playlist' })
void playlists.create({ title: 'Typed playlist', provider: 'spotify', thumbnail: null })
void playlists.update('playlist-id', { title: 'Renamed playlist', provider: null })

// @ts-expect-error title is required by the Supabase Insert type.
void playlists.create({ provider: 'spotify' })

// @ts-expect-error unknown columns must not compile.
void playlists.create({ title: 'Typed playlist', unknown_column: true })

// @ts-expect-error generated/readonly identity is not accepted by model create.
void playlists.create({ title: 'Typed playlist', id: 'client-controlled-id' })

// @ts-expect-error generated/readonly identity is not accepted by model update.
void playlists.update('playlist-id', { id: 'another-id' })

// @ts-expect-error enum values come from Supabase.
void playlists.update('playlist-id', { provider: 'invalid-provider' })
