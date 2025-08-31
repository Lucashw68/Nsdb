import { usePlaylistsStore } from './usePlaylistsStore'

import type { Tables } from '@/types/database.types'

export interface ModelTypes {
  gears: Tables<'gears'>
  playlists: Tables<'playlists'>
  profiles: Tables<'profiles'>
  samples: Tables<'samples'>
  songs: Tables<'songs'>
}

export const modelMap = {
  playlists: usePlaylistsStore
} as const
