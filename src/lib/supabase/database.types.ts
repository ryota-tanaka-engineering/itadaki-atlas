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
      chain_recommendations: {
        Row: {
          chain_id: string
          created_at: string
          food_item_id: string
          id: string
          sort_order: number
        }
        Insert: {
          chain_id: string
          created_at?: string
          food_item_id: string
          id?: string
          sort_order?: number
        }
        Update: {
          chain_id?: string
          created_at?: string
          food_item_id?: string
          id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "chain_recommendations_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_recommendations_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
        ]
      }
      chains: {
        Row: {
          bridge_en: string
          bridge_ja: string
          created_at: string
          founded_note: string | null
          genre_slug: string
          id: string
          name_en: string
          name_ja: string
          pref_limited: string | null
          slug: string
          sort_order: number
          source_note: string | null
          source_url: string | null
          style_en: string | null
          style_ja: string | null
          updated_at: string
        }
        Insert: {
          bridge_en: string
          bridge_ja: string
          created_at?: string
          founded_note?: string | null
          genre_slug: string
          id?: string
          name_en: string
          name_ja: string
          pref_limited?: string | null
          slug: string
          sort_order?: number
          source_note?: string | null
          source_url?: string | null
          style_en?: string | null
          style_ja?: string | null
          updated_at?: string
        }
        Update: {
          bridge_en?: string
          bridge_ja?: string
          created_at?: string
          founded_note?: string | null
          genre_slug?: string
          id?: string
          name_en?: string
          name_ja?: string
          pref_limited?: string | null
          slug?: string
          sort_order?: number
          source_note?: string | null
          source_url?: string | null
          style_en?: string | null
          style_ja?: string | null
          updated_at?: string
        }
        Relationships: []
      }
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
          note_en: string | null
          note_ja: string | null
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
          note_en?: string | null
          note_ja?: string | null
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
          note_en?: string | null
          note_ja?: string | null
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
      food_item_tags: {
        Row: {
          food_item_id: string
          tag_slug: string
        }
        Insert: {
          food_item_id: string
          tag_slug: string
        }
        Update: {
          food_item_id?: string
          tag_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_item_tags_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_item_tags_tag_slug_fkey"
            columns: ["tag_slug"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["slug"]
          },
        ]
      }
      food_item_translations: {
        Row: {
          body_md: string | null
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
          body_md?: string | null
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
          body_md?: string | null
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
          genre_id: string | null
          id: string
          lat: number | null
          lng: number | null
          name_romaji: string
          origin_city: string | null
          origin_pref: string | null
          shelf_slug: string
          slug: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          genre_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name_romaji: string
          origin_city?: string | null
          origin_pref?: string | null
          shelf_slug: string
          slug: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          genre_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name_romaji?: string
          origin_city?: string | null
          origin_pref?: string | null
          shelf_slug?: string
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
          {
            foreignKeyName: "food_items_shelf_slug_fkey"
            columns: ["shelf_slug"]
            isOneToOne: false
            referencedRelation: "shelves"
            referencedColumns: ["slug"]
          },
        ]
      }
      genres: {
        Row: {
          created_at: string
          default_source: string | null
          id: string
          intro_en: string | null
          intro_ja: string | null
          name_en: string
          name_ja: string
          shelf_slug: string
          slug: string
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_source?: string | null
          id?: string
          intro_en?: string | null
          intro_ja?: string | null
          name_en: string
          name_ja: string
          shelf_slug: string
          slug: string
          sort_order?: number
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_source?: string | null
          id?: string
          intro_en?: string | null
          intro_ja?: string | null
          name_en?: string
          name_ja?: string
          shelf_slug?: string
          slug?: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "genres_shelf_slug_fkey"
            columns: ["shelf_slug"]
            isOneToOne: false
            referencedRelation: "shelves"
            referencedColumns: ["slug"]
          },
        ]
      }
      guide_links: {
        Row: {
          created_at: string
          guide_id: string
          target_kind: string
          target_slug: string
        }
        Insert: {
          created_at?: string
          guide_id: string
          target_kind: string
          target_slug: string
        }
        Update: {
          created_at?: string
          guide_id?: string
          target_kind?: string
          target_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_links_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_sources: {
        Row: {
          accessed_at: string | null
          created_at: string
          guide_id: string
          id: string
          publisher: string | null
          title: string
          url: string | null
        }
        Insert: {
          accessed_at?: string | null
          created_at?: string
          guide_id: string
          id?: string
          publisher?: string | null
          title: string
          url?: string | null
        }
        Update: {
          accessed_at?: string | null
          created_at?: string
          guide_id?: string
          id?: string
          publisher?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guide_sources_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_translations: {
        Row: {
          body_md: string | null
          created_at: string
          guide_id: string
          locale: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body_md?: string | null
          created_at?: string
          guide_id: string
          locale: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body_md?: string | null
          created_at?: string
          guide_id?: string
          locale?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_translations_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guides: {
        Row: {
          created_at: string
          id: string
          kind: string
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          slug?: string
          sort_order?: number
          status?: string
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
      place_names: {
        Row: {
          city: string
          created_at: string
          locale: string
          name: string
          pref: string
          updated_at: string
        }
        Insert: {
          city: string
          created_at?: string
          locale: string
          name: string
          pref: string
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          locale?: string
          name?: string
          pref?: string
          updated_at?: string
        }
        Relationships: []
      }
      shelves: {
        Row: {
          grp: string
          name_en: string
          name_ja: string
          slug: string
          sort_order: number
        }
        Insert: {
          grp: string
          name_en: string
          name_ja: string
          slug: string
          sort_order?: number
        }
        Update: {
          grp?: string
          name_en?: string
          name_ja?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      tags: {
        Row: {
          definition: string
          kind: string
          name_en: string
          name_ja: string
          slug: string
          synonyms: string[]
        }
        Insert: {
          definition: string
          kind: string
          name_en: string
          name_ja: string
          slug: string
          synonyms?: string[]
        }
        Update: {
          definition?: string
          kind?: string
          name_en?: string
          name_ja?: string
          slug?: string
          synonyms?: string[]
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

