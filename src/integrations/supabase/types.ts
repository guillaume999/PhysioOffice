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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          subject?: string | null
        }
        Relationships: []
      }
      featured_seances: {
        Row: {
          added_by: string
          created_at: string
          id: string
          seance_type_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          id?: string
          seance_type_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          id?: string
          seance_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_seances_seance_type_id_fkey"
            columns: ["seance_type_id"]
            isOneToOne: true
            referencedRelation: "seance_types"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string | null
          created_at: string
          id: string
          patient_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          patient_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          patient_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      objectifs: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pathologies: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          address: string | null
          allergies: string | null
          blood_type: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          medical_notes: string | null
          mutual_number: string | null
          phone: string | null
          postal_code: string | null
          prescription: string | null
          remaining_sessions: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          allergies?: string | null
          blood_type?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          medical_notes?: string | null
          mutual_number?: string | null
          phone?: string | null
          postal_code?: string | null
          prescription?: string | null
          remaining_sessions?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          allergies?: string | null
          blood_type?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          medical_notes?: string | null
          mutual_number?: string | null
          phone?: string | null
          postal_code?: string | null
          prescription?: string | null
          remaining_sessions?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_premium: boolean | null
          last_name: string | null
          specialty: string | null
          trial_end_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_premium?: boolean | null
          last_name?: string | null
          specialty?: string | null
          trial_end_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_premium?: boolean | null
          last_name?: string | null
          specialty?: string | null
          trial_end_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      seance_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          seance_type_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          seance_type_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          seance_type_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seance_comments_seance_type_id_fkey"
            columns: ["seance_type_id"]
            isOneToOne: false
            referencedRelation: "seance_types"
            referencedColumns: ["id"]
          },
        ]
      }
      seance_exercices: {
        Row: {
          created_at: string
          description: string | null
          id: string
          ordre: number
          seance_type_id: string
          video_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          ordre?: number
          seance_type_id: string
          video_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          ordre?: number
          seance_type_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seance_exercices_seance_type_id_fkey"
            columns: ["seance_type_id"]
            isOneToOne: false
            referencedRelation: "seance_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seance_exercices_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      seance_likes: {
        Row: {
          created_at: string
          id: string
          seance_type_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          seance_type_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          seance_type_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seance_likes_seance_type_id_fkey"
            columns: ["seance_type_id"]
            isOneToOne: false
            referencedRelation: "seance_types"
            referencedColumns: ["id"]
          },
        ]
      }
      seance_types: {
        Row: {
          author_name: string | null
          created_at: string
          id: string
          is_copy: boolean | null
          is_shared: boolean
          objectif_principal: string
          objectif_secondaire: string | null
          original_id: string | null
          pathologie: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          created_at?: string
          id?: string
          is_copy?: boolean | null
          is_shared?: boolean
          objectif_principal: string
          objectif_secondaire?: string | null
          original_id?: string | null
          pathologie: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          created_at?: string
          id?: string
          is_copy?: boolean | null
          is_shared?: boolean
          objectif_principal?: string
          objectif_secondaire?: string | null
          original_id?: string | null
          pathologie?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seance_types_original_id_fkey"
            columns: ["original_id"]
            isOneToOne: false
            referencedRelation: "seance_types"
            referencedColumns: ["id"]
          },
        ]
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
      videos: {
        Row: {
          category: string | null
          category_pathology: string | null
          created_at: string
          description: string | null
          duration: number | null
          id: string
          is_copy: boolean | null
          is_shared: boolean | null
          most_used_patho: string | null
          original_id: string | null
          thumbnail_url: string | null
          title: string
          type_renfo: string | null
          user_id: string
          video_url: string
        }
        Insert: {
          category?: string | null
          category_pathology?: string | null
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          is_copy?: boolean | null
          is_shared?: boolean | null
          most_used_patho?: string | null
          original_id?: string | null
          thumbnail_url?: string | null
          title: string
          type_renfo?: string | null
          user_id: string
          video_url: string
        }
        Update: {
          category?: string | null
          category_pathology?: string | null
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          is_copy?: boolean | null
          is_shared?: boolean | null
          most_used_patho?: string | null
          original_id?: string | null
          thumbnail_url?: string | null
          title?: string
          type_renfo?: string | null
          user_id?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_original_id_fkey"
            columns: ["original_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
