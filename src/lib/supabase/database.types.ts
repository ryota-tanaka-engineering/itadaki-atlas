export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      dish_details: {
        Row: {
          created_at: string
          food_item_id: string
          noodle_curl: string | null
          noodle_thickness: string | null
          originator_shop: string | null
          primary_style: string | null
          richness: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          food_item_id: string
          noodle_curl?: string | null
          noodle_thickness?: string | null
          originator_shop?: string | null
          primary_style?: string | null
          richness?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          food_item_id?: string
          noodle_curl?: string | null
          noodle_thickness?: string | null
          originator_shop?: string | null
          primary_style?: string | null
          richness?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_details_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: true
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
        ]
      }
      food_item_regions: {
        Row: {
          city: string | null
          created_at: string
          food_item_id: string
          id: string
          is_representative: boolean
          lat: number | null
          lng: number | null
          pref: string
          relation_type: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          food_item_id: string
          id?: string
          is_representative?: boolean
          lat?: number | null
          lng?: number | null
          pref: string
          relation_type: string
        }
        Update: {
          city?: string | null
          created_at?: string
          food_item_id?: string
          id?: string
          is_representative?: boolean
          lat?: number | null
          lng?: number | null
          pref?: string
          relation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_item_regions_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
        ]
      }
      food_item_relations: {
        Row: {
          created_at: string
          from_id: string
          id: string
          relation_type: string
          to_id: string
        }
        Insert: {
          created_at?: string
          from_id: string
          id?: string
          relation_type: string
          to_id: string
        }
        Update: {
          created_at?: string
          from_id?: string
          id?: string
          relation_type?: string
          to_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_item_relations_from_id_fkey"
            columns: ["from_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_item_relations_to_id_fkey"
            columns: ["to_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
        ]
      }
      food_item_sources: {
        Row: {
          accessed_at: string | null
          created_at: string
          food_item_id: string
          id: string
          publisher: string | null
          title: string
          url: string | null
        }
        Insert: {
          accessed_at?: string | null
          created_at?: string
          food_item_id: string
          id?: string
          publisher?: string | null
          title: string
          url?: string | null
        }
        Update: {
          accessed_at?: string | null
          created_at?: string
          food_item_id?: string
          id?: string
          publisher?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_item_sources_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
        ]
      }
      food_item_translations: {
        Row: {
          created_at: string
          food_item_id: string
          history: string | null
          id: string
          locale: string
          name: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          food_item_id: string
          history?: string | null
          id?: string
          locale: string
          name: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          food_item_id?: string
          history?: string | null
          id?: string
          locale?: string
          name?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_item_translations_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
        ]
      }
      food_items: {
        Row: {
          created_at: string
          genre_id: string
          id: string
          lat: number | null
          lng: number | null
          name_romaji: string
          origin_city: string | null
          origin_pref: string | null
          slug: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          genre_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          name_romaji: string
          origin_city?: string | null
          origin_pref?: string | null
          slug: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          genre_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name_romaji?: string
          origin_city?: string | null
          origin_pref?: string | null
          slug?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_items_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          created_at: string
          default_source: string | null
          id: string
          name_en: string
          name_ja: string
          slug: string
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_source?: string | null
          id?: string
          name_en: string
          name_ja: string
          slug: string
          sort_order?: number
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_source?: string | null
          id?: string
          name_en?: string
          name_ja?: string
          slug?: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          category: string
          created_at: string
          email: string
          id: string
          locale: string
          message: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          email: string
          id?: string
          locale: string
          message: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          email?: string
          id?: string
          locale?: string
          message?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

