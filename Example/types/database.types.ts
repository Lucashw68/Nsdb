export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      authors: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      component_records: {
        Row: {
          created_at: string
          event_date: string | null
          id: string
          metadata: Json
          notes: string | null
          priority: number | null
          published: boolean
          status: Database["public"]["Enums"]["playlist_status"]
          tags: string[]
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_date?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          priority?: number | null
          published?: boolean
          status?: Database["public"]["Enums"]["playlist_status"]
          tags?: string[]
          title: string
          user_id?: string
        }
        Update: {
          created_at?: string
          event_date?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          priority?: number | null
          published?: boolean
          status?: Database["public"]["Enums"]["playlist_status"]
          tags?: string[]
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      composite_children: {
        Row: {
          id: string
          parent_code: string
          tenant_id: string
        }
        Insert: {
          id?: string
          parent_code: string
          tenant_id: string
        }
        Update: {
          id?: string
          parent_code?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "composite_children_tenant_id_parent_code_fkey"
            columns: ["tenant_id", "parent_code"]
            isOneToOne: false
            referencedRelation: "composite_parents"
            referencedColumns: ["tenant_id", "code"]
          },
        ]
      }
      composite_parents: {
        Row: {
          code: string
          label: string
          tenant_id: string
        }
        Insert: {
          code: string
          label: string
          tenant_id: string
        }
        Update: {
          code?: string
          label?: string
          tenant_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          id: string
          receiver_id: string
          sender_id: string
        }
        Insert: {
          body: string
          id?: string
          receiver_id: string
          sender_id: string
        }
        Update: {
          body?: string
          id?: string
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_links: {
        Row: {
          child_id: string
          parent_id: string
        }
        Insert: {
          child_id: string
          parent_id: string
        }
        Update: {
          child_id?: string
          parent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_links_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          metadata: Json
          status: Database["public"]["Enums"]["playlist_status"]
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          status?: Database["public"]["Enums"]["playlist_status"]
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          status?: Database["public"]["Enums"]["playlist_status"]
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_tags: {
        Row: {
          post_id: string
          tag_id: string
        }
        Insert: {
          post_id: string
          tag_id: string
        }
        Update: {
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          id: string
          title: string
        }
        Insert: {
          author_id: string
          id?: string
          title: string
        }
        Update: {
          author_id?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      schema_features: {
        Row: {
          computed_label: string | null
          created_on: string
          custom_default: string
          labels: string[]
          nullable_field: string | null
          payload: Json
          required_field: string
          sequence_by_default: number
          sequence_id: number
          slug: string
          state: Database["public"]["Enums"]["playlist_status"]
          uuid_default: string
        }
        Insert: {
          computed_label?: string | null
          created_on?: string
          custom_default?: string
          labels?: string[]
          nullable_field?: string | null
          payload?: Json
          required_field: string
          sequence_by_default?: number
          sequence_id?: never
          slug: string
          state?: Database["public"]["Enums"]["playlist_status"]
          uuid_default?: string
        }
        Update: {
          computed_label?: string | null
          created_on?: string
          custom_default?: string
          labels?: string[]
          nullable_field?: string | null
          payload?: Json
          required_field?: string
          sequence_by_default?: number
          sequence_id?: never
          slug?: string
          state?: Database["public"]["Enums"]["playlist_status"]
          uuid_default?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      tracks: {
        Row: {
          created_at: string
          id: string
          playlist_id: string
          position: number
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          playlist_id: string
          position: number
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          playlist_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
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
      playlist_status: "draft" | "published"
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
      playlist_status: ["draft", "published"],
    },
  },
} as const
