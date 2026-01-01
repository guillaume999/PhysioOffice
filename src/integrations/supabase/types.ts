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
      annonce_settings: {
        Row: {
          created_at: string
          extension_duration_days: number
          extension_price_cents: number
          featured_price_cents: number
          free_duration_days: number
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          extension_duration_days?: number
          extension_price_cents?: number
          featured_price_cents?: number
          free_duration_days?: number
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          extension_duration_days?: number
          extension_price_cents?: number
          featured_price_cents?: number
          free_duration_days?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      annonces: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          departement: string | null
          description: string
          expires_at: string
          id: string
          is_active: boolean
          is_featured: boolean
          region: string
          title: string
          type: Database["public"]["Enums"]["annonce_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          departement?: string | null
          description: string
          expires_at: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          region: string
          title: string
          type: Database["public"]["Enums"]["annonce_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          departement?: string | null
          description?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          region?: string
          title?: string
          type?: Database["public"]["Enums"]["annonce_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          end_time: string
          id: string
          notes: string | null
          patient_id: string
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          patient_id: string
          start_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          patient_id?: string
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      certificat_models: {
        Row: {
          content: string
          created_at: string
          id: string
          is_platform: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_platform?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_platform?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      exercice_consultations: {
        Row: {
          consulted_at: string
          created_at: string
          exercice_id: string
          id: string
          is_consulted: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          consulted_at?: string
          created_at?: string
          exercice_id: string
          id?: string
          is_consulted?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          consulted_at?: string
          created_at?: string
          exercice_id?: string
          id?: string
          is_consulted?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercice_consultations_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
        ]
      }
      exercices: {
        Row: {
          author_name: string | null
          created_at: string
          deleted_by_author: boolean | null
          description: string | null
          id: string
          is_copy: boolean | null
          is_platform: boolean | null
          original_id: string | null
          pathologie_tags: string[] | null
          rejection_reason: string | null
          status: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          video_id: string | null
          video_url: string | null
        }
        Insert: {
          author_name?: string | null
          created_at?: string
          deleted_by_author?: boolean | null
          description?: string | null
          id?: string
          is_copy?: boolean | null
          is_platform?: boolean | null
          original_id?: string | null
          pathologie_tags?: string[] | null
          rejection_reason?: string | null
          status?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
          video_id?: string | null
          video_url?: string | null
        }
        Update: {
          author_name?: string | null
          created_at?: string
          deleted_by_author?: boolean | null
          description?: string | null
          id?: string
          is_copy?: boolean | null
          is_platform?: boolean | null
          original_id?: string | null
          pathologie_tags?: string[] | null
          rejection_reason?: string | null
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_id?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercices_original_id_fkey"
            columns: ["original_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_exercices: {
        Row: {
          added_by: string
          created_at: string
          exercice_id: string
          id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          exercice_id: string
          id?: string
        }
        Update: {
          added_by?: string
          created_at?: string
          exercice_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_exercices_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: true
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
        ]
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
      featured_traitements: {
        Row: {
          added_by: string
          created_at: string
          id: string
          traitement_type_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          id?: string
          traitement_type_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          id?: string
          traitement_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_traitements_traitement_type_id_fkey"
            columns: ["traitement_type_id"]
            isOneToOne: true
            referencedRelation: "traitement_types"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string
          id: string
          is_new: boolean
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          is_new?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          is_new?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      patient_bilans: {
        Row: {
          bilan_date: string | null
          content: string | null
          created_at: string
          id: string
          patient_id: string
          position_after_seance: number
          traitement_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bilan_date?: string | null
          content?: string | null
          created_at?: string
          id?: string
          patient_id: string
          position_after_seance?: number
          traitement_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bilan_date?: string | null
          content?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          position_after_seance?: number
          traitement_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_bilans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_bilans_traitement_id_fkey"
            columns: ["traitement_id"]
            isOneToOne: false
            referencedRelation: "traitement_types"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_care_plans: {
        Row: {
          active_traitement_id: string | null
          bilan_initial_data: string | null
          bilan_initial_date: string | null
          bilan_kine: string | null
          comments: string | null
          created_at: string
          id: string
          motif_consultation: string | null
          objectifs_prise_en_charge: string | null
          patient_id: string
          traitement_start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_traitement_id?: string | null
          bilan_initial_data?: string | null
          bilan_initial_date?: string | null
          bilan_kine?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          motif_consultation?: string | null
          objectifs_prise_en_charge?: string | null
          patient_id: string
          traitement_start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_traitement_id?: string | null
          bilan_initial_data?: string | null
          bilan_initial_date?: string | null
          bilan_kine?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          motif_consultation?: string | null
          objectifs_prise_en_charge?: string | null
          patient_id?: string
          traitement_start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_care_plans_active_traitement_id_fkey"
            columns: ["active_traitement_id"]
            isOneToOne: false
            referencedRelation: "traitement_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_care_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_numero_sequences: {
        Row: {
          created_at: string
          id: string
          last_numero: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_numero?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_numero?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_seances: {
        Row: {
          created_at: string
          id: string
          ordre: number
          patient_id: string
          seance_type_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ordre?: number
          patient_id: string
          seance_type_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ordre?: number
          patient_id?: string
          seance_type_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_seances_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_seances_seance_type_id_fkey"
            columns: ["seance_type_id"]
            isOneToOne: false
            referencedRelation: "seance_types"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_session_access: {
        Row: {
          access_code: string
          created_at: string
          expires_at: string
          id: string
          patient_id: string
          seance_type_id: string
          user_id: string
        }
        Insert: {
          access_code: string
          created_at?: string
          expires_at: string
          id?: string
          patient_id: string
          seance_type_id: string
          user_id: string
        }
        Update: {
          access_code?: string
          created_at?: string
          expires_at?: string
          id?: string
          patient_id?: string
          seance_type_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_session_access_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_session_access_seance_type_id_fkey"
            columns: ["seance_type_id"]
            isOneToOne: false
            referencedRelation: "seance_types"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_traitement_seance_dates: {
        Row: {
          created_at: string
          id: string
          patient_id: string
          seance_date: string | null
          seance_ordre: number
          traitement_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          patient_id: string
          seance_date?: string | null
          seance_ordre: number
          traitement_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          patient_id?: string
          seance_date?: string | null
          seance_ordre?: number
          traitement_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_traitement_seance_dates_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_traitement_seance_dates_traitement_id_fkey"
            columns: ["traitement_id"]
            isOneToOne: false
            referencedRelation: "traitement_types"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          allergies: string | null
          antecedents: string | null
          blood_type: string | null
          created_at: string
          has_mutual: boolean
          id: string
          medical_notes: string | null
          name: string
          numero: string | null
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
          antecedents?: string | null
          blood_type?: string | null
          created_at?: string
          has_mutual?: boolean
          id?: string
          medical_notes?: string | null
          name: string
          numero?: string | null
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
          antecedents?: string | null
          blood_type?: string | null
          created_at?: string
          has_mutual?: boolean
          id?: string
          medical_notes?: string | null
          name?: string
          numero?: string | null
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
          can_share: boolean | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_banned: boolean | null
          is_premium: boolean | null
          last_name: string | null
          pseudo: string | null
          specialty: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_end_date: string | null
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          trial_end_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          can_share?: boolean | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_banned?: boolean | null
          is_premium?: boolean | null
          last_name?: string | null
          pseudo?: string | null
          specialty?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          trial_end_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          can_share?: boolean | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_banned?: boolean | null
          is_premium?: boolean | null
          last_name?: string | null
          pseudo?: string | null
          specialty?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          trial_end_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resource_shares: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          owner_user_id: string
          permission: string
          resource_id: string | null
          resource_type: string
          shared_with_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          owner_user_id: string
          permission?: string
          resource_id?: string | null
          resource_type: string
          shared_with_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          owner_user_id?: string
          permission?: string
          resource_id?: string | null
          resource_type?: string
          shared_with_user_id?: string
          updated_at?: string
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
          duration_seconds: number | null
          exercice_id: string | null
          id: string
          name: string | null
          ordre: number
          repetitions: number | null
          seance_type_id: string
          series: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          exercice_id?: string | null
          id?: string
          name?: string | null
          ordre?: number
          repetitions?: number | null
          seance_type_id: string
          series?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          exercice_id?: string | null
          id?: string
          name?: string | null
          ordre?: number
          repetitions?: number | null
          seance_type_id?: string
          series?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seance_exercices_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seance_exercices_seance_type_id_fkey"
            columns: ["seance_type_id"]
            isOneToOne: false
            referencedRelation: "seance_types"
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
          is_hidden_from_list: boolean | null
          is_shared: boolean
          is_validated: boolean | null
          objectif_principal: string
          objectif_secondaire: string | null
          objectifs_principaux: string[] | null
          objectifs_secondaires: string[] | null
          original_id: string | null
          pathologie: string
          pathologies: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          created_at?: string
          id?: string
          is_copy?: boolean | null
          is_hidden_from_list?: boolean | null
          is_shared?: boolean
          is_validated?: boolean | null
          objectif_principal: string
          objectif_secondaire?: string | null
          objectifs_principaux?: string[] | null
          objectifs_secondaires?: string[] | null
          original_id?: string | null
          pathologie: string
          pathologies?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          created_at?: string
          id?: string
          is_copy?: boolean | null
          is_hidden_from_list?: boolean | null
          is_shared?: boolean
          is_validated?: boolean | null
          objectif_principal?: string
          objectif_secondaire?: string | null
          objectifs_principaux?: string[] | null
          objectifs_secondaires?: string[] | null
          original_id?: string | null
          pathologie?: string
          pathologies?: string[] | null
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
      subscription_limits: {
        Row: {
          can_share_exercices: boolean
          can_use_ai: boolean
          created_at: string
          id: string
          max_exercices: number
          max_patients: number
          max_seances: number
          max_traitements: number
          tier: Database["public"]["Enums"]["subscription_tier"]
        }
        Insert: {
          can_share_exercices?: boolean
          can_use_ai?: boolean
          created_at?: string
          id?: string
          max_exercices: number
          max_patients: number
          max_seances: number
          max_traitements: number
          tier: Database["public"]["Enums"]["subscription_tier"]
        }
        Update: {
          can_share_exercices?: boolean
          can_use_ai?: boolean
          created_at?: string
          id?: string
          max_exercices?: number
          max_patients?: number
          max_seances?: number
          max_traitements?: number
          tier?: Database["public"]["Enums"]["subscription_tier"]
        }
        Relationships: []
      }
      subscription_prices: {
        Row: {
          billing_period: string
          created_at: string
          id: string
          price_cents: number
          stripe_price_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
        }
        Insert: {
          billing_period: string
          created_at?: string
          id?: string
          price_cents: number
          stripe_price_id?: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
        }
        Update: {
          billing_period?: string
          created_at?: string
          id?: string
          price_cents?: number
          stripe_price_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
        }
        Relationships: []
      }
      traitement_seances: {
        Row: {
          created_at: string
          id: string
          ordre: number
          seance_type_id: string
          traitement_type_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ordre?: number
          seance_type_id: string
          traitement_type_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ordre?: number
          seance_type_id?: string
          traitement_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "traitement_seances_seance_type_id_fkey"
            columns: ["seance_type_id"]
            isOneToOne: false
            referencedRelation: "seance_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traitement_seances_traitement_type_id_fkey"
            columns: ["traitement_type_id"]
            isOneToOne: false
            referencedRelation: "traitement_types"
            referencedColumns: ["id"]
          },
        ]
      }
      traitement_tests: {
        Row: {
          created_at: string
          description: string | null
          exercice_id: string | null
          id: string
          ordre: number
          traitement_type_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          exercice_id?: string | null
          id?: string
          ordre?: number
          traitement_type_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          exercice_id?: string | null
          id?: string
          ordre?: number
          traitement_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "traitement_tests_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traitement_tests_traitement_type_id_fkey"
            columns: ["traitement_type_id"]
            isOneToOne: false
            referencedRelation: "traitement_types"
            referencedColumns: ["id"]
          },
        ]
      }
      traitement_types: {
        Row: {
          author_name: string | null
          created_at: string
          description: string | null
          id: string
          is_copy: boolean | null
          is_hidden_from_list: boolean | null
          is_shared: boolean
          is_validated: boolean | null
          original_id: string | null
          pathologie: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_copy?: boolean | null
          is_hidden_from_list?: boolean | null
          is_shared?: boolean
          is_validated?: boolean | null
          original_id?: string | null
          pathologie: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_copy?: boolean | null
          is_hidden_from_list?: boolean | null
          is_shared?: boolean
          is_validated?: boolean | null
          original_id?: string | null
          pathologie?: string
          updated_at?: string
          user_id?: string
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
      videos: {
        Row: {
          created_at: string
          id: string
          name: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          video_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
          video_url: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_create_item: {
        Args: { _item_type: string; _user_id: string }
        Returns: boolean
      }
      get_user_subscription_tier: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["subscription_tier"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_shared_access: {
        Args: {
          _owner_id: string
          _required_permission?: string
          _resource_id?: string
          _resource_type: string
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      annonce_type:
        | "remplacement_recherche"
        | "remplacement_offre"
        | "emploi_offre"
        | "emploi_recherche"
        | "association"
        | "vente_cabinet"
        | "autre"
      app_role: "admin" | "user"
      subscription_tier: "free" | "basic" | "premium"
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
      annonce_type: [
        "remplacement_recherche",
        "remplacement_offre",
        "emploi_offre",
        "emploi_recherche",
        "association",
        "vente_cabinet",
        "autre",
      ],
      app_role: ["admin", "user"],
      subscription_tier: ["free", "basic", "premium"],
    },
  },
} as const
