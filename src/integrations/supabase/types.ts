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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      anamnesis_submissions: {
        Row: {
          form_data: Json
          id: string
          signature_data: string | null
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          form_data: Json
          id?: string
          signature_data?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          form_data?: Json
          id?: string
          signature_data?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer_de: string
          answer_en: string
          created_at: string
          id: string
          is_published: boolean
          question_de: string
          question_en: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer_de: string
          answer_en: string
          created_at?: string
          id?: string
          is_published?: boolean
          question_de: string
          question_en: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer_de?: string
          answer_en?: string
          created_at?: string
          id?: string
          is_published?: boolean
          question_de?: string
          question_en?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      iaa_submissions: {
        Row: {
          appointment_number: number
          form_data: Json
          id: string
          status: string
          submitted_at: string
          therapist_data: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_number?: number
          form_data?: Json
          id?: string
          status?: string
          submitted_at?: string
          therapist_data?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_number?: number
          form_data?: Json
          id?: string
          status?: string
          submitted_at?: string
          therapist_data?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_resources: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          is_published: boolean
          sort_order: number
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string
          id?: string
          is_published?: boolean
          sort_order?: number
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          is_published?: boolean
          sort_order?: number
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      practice_info: {
        Row: {
          content_de: string
          content_en: string
          created_at: string
          icon: string | null
          id: string
          is_published: boolean
          slug: string
          sort_order: number
          title_de: string
          title_en: string
          updated_at: string
        }
        Insert: {
          content_de: string
          content_en: string
          created_at?: string
          icon?: string | null
          id?: string
          is_published?: boolean
          slug: string
          sort_order?: number
          title_de: string
          title_en: string
          updated_at?: string
        }
        Update: {
          content_de?: string
          content_en?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_published?: boolean
          slug?: string
          sort_order?: number
          title_de?: string
          title_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      practice_pricing: {
        Row: {
          created_at: string
          id: string
          is_published: boolean
          label_de: string
          label_en: string
          note_de: string | null
          note_en: string | null
          price_text_de: string
          price_text_en: string
          service_key: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_published?: boolean
          label_de: string
          label_en: string
          note_de?: string | null
          note_en?: string | null
          price_text_de: string
          price_text_en: string
          service_key: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_published?: boolean
          label_de?: string
          label_en?: string
          note_de?: string | null
          note_en?: string | null
          price_text_de?: string
          price_text_en?: string
          service_key?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          city: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          first_name: string | null
          id: string
          is_verified_patient: boolean
          last_name: string | null
          phone: string | null
          postal_code: string | null
          street: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          first_name?: string | null
          id?: string
          is_verified_patient?: boolean
          last_name?: string | null
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_verified_patient?: boolean
          last_name?: string | null
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      therapy_sessions: {
        Row: {
          created_at: string
          created_by: string
          eingabe_daten: Json
          empfehlung: string
          id: string
          notiz: string | null
          pseudonym_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          eingabe_daten?: Json
          empfehlung?: string
          id?: string
          notiz?: string | null
          pseudonym_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          eingabe_daten?: Json
          empfehlung?: string
          id?: string
          notiz?: string | null
          pseudonym_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          type: string
          used: boolean
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          type?: string
          used?: boolean
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          type?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_audit_log: {
        Args: {
          _action: string
          _details?: Json
          _ip_address?: string
          _user_agent?: string
        }
        Returns: undefined
      }
      is_verified_patient: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "patient"
      language_code: "de" | "en"
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
      app_role: ["admin", "patient"],
      language_code: ["de", "en"],
    },
  },
} as const
