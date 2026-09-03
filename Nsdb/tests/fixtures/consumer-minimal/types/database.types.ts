export type Database = {
  public: {
    Tables: {
      todos: {
        Row: { id: string; title: string; completed: boolean; created_at: string }
        Insert: { id?: string; title: string; completed?: boolean; created_at?: string }
        Update: { id?: string; title?: string; completed?: boolean; created_at?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
