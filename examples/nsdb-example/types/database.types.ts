export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      gears: {
        Row: {
          color: string | null
          created_at: string
          device_id: string | null
          id: string
          image: string | null
          manufacturer: string
          name: string
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          image?: string | null
          manufacturer: string
          name: string
          profile_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          image?: string | null
          manufacturer?: string
          name?: string
          profile_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gears_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          id: string
          item_count: number | null
          profile_id: string
          provider: Database["public"]["Enums"]["PROVIDERS"] | null
          provider_id: string | null
          thumbnail: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_count?: number | null
          profile_id?: string
          provider?: Database["public"]["Enums"]["PROVIDERS"] | null
          provider_id?: string | null
          thumbnail?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_count?: number | null
          profile_id?: string
          provider?: Database["public"]["Enums"]["PROVIDERS"] | null
          provider_id?: string | null
          thumbnail?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playlists_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar: string | null
          bio: string | null
          created_at: string
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          onboard: boolean
          public: boolean | null
          soundcloud: string | null
          spotify: string | null
          username: string | null
          youtube: string
        }
        Insert: {
          avatar?: string | null
          bio?: string | null
          created_at?: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          onboard?: boolean
          public?: boolean | null
          soundcloud?: string | null
          spotify?: string | null
          username?: string | null
          youtube?: string
        }
        Update: {
          avatar?: string | null
          bio?: string | null
          created_at?: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          onboard?: boolean
          public?: boolean | null
          soundcloud?: string | null
          spotify?: string | null
          username?: string | null
          youtube?: string
        }
        Relationships: []
      }
      samples: {
        Row: {
          bpm: number | null
          created_at: string
          id: string
          key: string | null
          name: string | null
          profile_id: string | null
          storage_path: string | null
          type: string | null
        }
        Insert: {
          bpm?: number | null
          created_at?: string
          id?: string
          key?: string | null
          name?: string | null
          profile_id?: string | null
          storage_path?: string | null
          type?: string | null
        }
        Update: {
          bpm?: number | null
          created_at?: string
          id?: string
          key?: string | null
          name?: string | null
          profile_id?: string | null
          storage_path?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "samples_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          bucket_path: string | null
          created_at: string
          id: string
          owner: string
          playlist_id: string
          profile_id: string
          provider: Database["public"]["Enums"]["PROVIDERS"]
          provider_id: string | null
          resource_id: string
          thumbnail: string
          title: string
        }
        Insert: {
          bucket_path?: string | null
          created_at?: string
          id?: string
          owner: string
          playlist_id: string
          profile_id?: string
          provider: Database["public"]["Enums"]["PROVIDERS"]
          provider_id?: string | null
          resource_id: string
          thumbnail: string
          title: string
        }
        Update: {
          bucket_path?: string | null
          created_at?: string
          id?: string
          owner?: string
          playlist_id?: string
          profile_id?: string
          provider?: Database["public"]["Enums"]["PROVIDERS"]
          provider_id?: string | null
          resource_id?: string
          thumbnail?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlistItems_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      PROVIDERS: "mysic" | "youtube" | "soundcloud" | "spotify"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      PROVIDERS: ["mysic", "youtube", "soundcloud", "spotify"],
    },
  },
} as const
