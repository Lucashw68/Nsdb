import { useGearStore } from './useGearStore'
import { usePlaylistStore } from './usePlaylistStore'
import { useProfileStore } from './useProfileStore'
import { useSampleStore } from './useSampleStore'
import { useSongStore } from './useSongStore'

import type { Tables } from '@/types/database.types'

export interface ModelTypes {
  gears: Tables<'gears'>
  playlists: Tables<'playlists'>
  profiles: Tables<'profiles'>
  samples: Tables<'samples'>
  songs: Tables<'songs'>
}

export const modelMap = {
  gears: useGearStore,
  playlists: usePlaylistStore,
  profiles: useProfileStore,
  samples: useSampleStore,
  songs: useSongStore
} as const
