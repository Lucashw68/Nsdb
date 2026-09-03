export type Database = {
  public: {
    Tables: {
      authors: {
        Row: { id: string; name: string }
        Insert: { id?: string; name: string }
        Update: { id?: string; name?: string }
        Relationships: []
      }
      playlists: {
        Row: { id: string; title: string; description: string | null }
        Insert: { id?: string; title: string; description?: string | null }
        Update: { id?: string; title?: string; description?: string | null }
        Relationships: []
      }
      schema_features: {
        Row: {
          slug: string
          sequence_id: number
          required_field: string
          custom_default: string
          nullable_field: string | null
          computed_label: string
        }
        Insert: {
          slug: string
          sequence_id?: number
          required_field: string
          custom_default?: string
          nullable_field?: string | null
          computed_label?: string
        }
        Update: {
          slug?: string
          sequence_id?: number
          required_field?: string
          custom_default?: string
          nullable_field?: string | null
          computed_label?: string
        }
        Relationships: []
      }
      posts: {
        Row: { id: string; author_id: string; title: string }
        Insert: { id?: string; author_id: string; title: string }
        Update: { id?: string; author_id?: string; title?: string }
        Relationships: [{
          foreignKeyName: "posts_author_id_fkey"
          columns: ["author_id"]
          isOneToOne: false
          referencedRelation: "authors"
          referencedColumns: ["id"]
        }]
      }
      messages: {
        Row: { id: string; sender_id: string; receiver_id: string; body: string }
        Insert: { id?: string; sender_id: string; receiver_id: string; body: string }
        Update: { id?: string; sender_id?: string; receiver_id?: string; body?: string }
        Relationships: [{
          foreignKeyName: "messages_sender_id_fkey"
          columns: ["sender_id"]
          isOneToOne: false
          referencedRelation: "authors"
          referencedColumns: ["id"]
        }, {
          foreignKeyName: "messages_receiver_id_fkey"
          columns: ["receiver_id"]
          isOneToOne: false
          referencedRelation: "authors"
          referencedColumns: ["id"]
        }]
      }
      categories: {
        Row: { id: string; parent_id: string | null; name: string }
        Insert: { id?: string; parent_id?: string | null; name: string }
        Update: { id?: string; parent_id?: string | null; name?: string }
        Relationships: [{
          foreignKeyName: "categories_parent_id_fkey"
          columns: ["parent_id"]
          isOneToOne: false
          referencedRelation: "categories"
          referencedColumns: ["id"]
        }]
      }
      tags: {
        Row: { id: string; name: string }
        Insert: { id?: string; name: string }
        Update: { id?: string; name?: string }
        Relationships: []
      }
      post_tags: {
        Row: { id: string; post_id: string; tag_id: string }
        Insert: { id?: string; post_id: string; tag_id: string }
        Update: { id?: string; post_id?: string; tag_id?: string }
        Relationships: [{
          foreignKeyName: "post_tags_post_id_fkey"
          columns: ["post_id"]
          isOneToOne: false
          referencedRelation: "posts"
          referencedColumns: ["id"]
        }, {
          foreignKeyName: "post_tags_tag_id_fkey"
          columns: ["tag_id"]
          isOneToOne: false
          referencedRelation: "tags"
          referencedColumns: ["id"]
        }]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
