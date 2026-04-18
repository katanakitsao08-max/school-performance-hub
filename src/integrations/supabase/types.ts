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
      attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          learner_id: string
          marked_by: string
          remarks: string | null
          school_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          learner_id: string
          marked_by: string
          remarks?: string | null
          school_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          learner_id?: string
          marked_by?: string
          remarks?: string | null
          school_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      class_teachers: {
        Row: {
          created_at: string
          grade: string
          id: string
          school_id: string
          stream: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          grade: string
          id?: string
          school_id: string
          stream: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          grade?: string
          id?: string
          school_id?: string
          stream?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_records: {
        Row: {
          amount_charged: number
          amount_paid: number
          created_at: string
          description: string | null
          fee_type: string
          id: string
          learner_id: string
          mpesa_reference: string | null
          payment_date: string | null
          payment_method: string | null
          recorded_by: string
          school_id: string | null
          term: number
          updated_at: string
          year: number
        }
        Insert: {
          amount_charged?: number
          amount_paid?: number
          created_at?: string
          description?: string | null
          fee_type?: string
          id?: string
          learner_id: string
          mpesa_reference?: string | null
          payment_date?: string | null
          payment_method?: string | null
          recorded_by: string
          school_id?: string | null
          term: number
          updated_at?: string
          year?: number
        }
        Update: {
          amount_charged?: number
          amount_paid?: number
          created_at?: string
          description?: string | null
          fee_type?: string
          id?: string
          learner_id?: string
          mpesa_reference?: string | null
          payment_date?: string | null
          payment_method?: string | null
          recorded_by?: string
          school_id?: string | null
          term?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fee_records_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      learners: {
        Row: {
          academic_year: number
          admission_number: string
          created_at: string
          full_name: string
          gender: string
          grade: string
          id: string
          is_active: boolean
          parent_name: string | null
          parent_phone: string | null
          school_id: string | null
          stream: string
          updated_at: string
        }
        Insert: {
          academic_year?: number
          admission_number: string
          created_at?: string
          full_name: string
          gender?: string
          grade: string
          id?: string
          is_active?: boolean
          parent_name?: string | null
          parent_phone?: string | null
          school_id?: string | null
          stream?: string
          updated_at?: string
        }
        Update: {
          academic_year?: number
          admission_number?: string
          created_at?: string
          full_name?: string
          gender?: string
          grade?: string
          id?: string
          is_active?: boolean
          parent_name?: string | null
          parent_phone?: string | null
          school_id?: string | null
          stream?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learners_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_areas: {
        Row: {
          created_at: string
          grade: string
          id: string
          is_active: boolean
          max_score: number
          name: string
          school_id: string | null
        }
        Insert: {
          created_at?: string
          grade: string
          id?: string
          is_active?: boolean
          max_score?: number
          name: string
          school_id?: string | null
        }
        Update: {
          created_at?: string
          grade?: string
          id?: string
          is_active?: boolean
          max_score?: number
          name?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_areas_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          school_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          school_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          school_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_learners: {
        Row: {
          created_at: string
          id: string
          learner_id: string
          parent_user_id: string
          relationship: string
          school_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          learner_id: string
          parent_user_id: string
          relationship?: string
          school_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          learner_id?: string
          parent_user_id?: string
          relationship?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_learners_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_learners_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assigned_grades: string[] | null
          assigned_learning_areas: string[] | null
          assigned_streams: string[] | null
          created_at: string
          full_name: string
          id: string
          school_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_grades?: string[] | null
          assigned_learning_areas?: string[] | null
          assigned_streams?: string[] | null
          created_at?: string
          full_name: string
          id?: string
          school_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_grades?: string[] | null
          assigned_learning_areas?: string[] | null
          assigned_streams?: string[] | null
          created_at?: string
          full_name?: string
          id?: string
          school_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_log: {
        Row: {
          from_grade: string
          id: string
          learner_id: string
          promoted_at: string
          school_id: string | null
          to_grade: string
          year: number
        }
        Insert: {
          from_grade: string
          id?: string
          learner_id: string
          promoted_at?: string
          school_id?: string | null
          to_grade: string
          year: number
        }
        Update: {
          from_grade?: string
          id?: string
          learner_id?: string
          promoted_at?: string
          school_id?: string | null
          to_grade?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "promotion_log_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      report_delivery_log: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          learner_id: string
          provider_message_id: string | null
          recipient: string
          school_id: string
          sent_by: string
          share_link_id: string | null
          status: string
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          learner_id: string
          provider_message_id?: string | null
          recipient: string
          school_id: string
          sent_by: string
          share_link_id?: string | null
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          learner_id?: string
          provider_message_id?: string | null
          recipient?: string
          school_id?: string
          sent_by?: string
          share_link_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_delivery_log_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_delivery_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_delivery_log_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "report_share_links"
            referencedColumns: ["id"]
          },
        ]
      }
      report_share_links: {
        Row: {
          assessment_type: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          last_viewed_at: string | null
          learner_id: string
          school_id: string
          term: number
          token: string
          view_count: number
          year: number
        }
        Insert: {
          assessment_type?: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          last_viewed_at?: string | null
          learner_id: string
          school_id: string
          term: number
          token: string
          view_count?: number
          year: number
        }
        Update: {
          assessment_type?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          last_viewed_at?: string | null
          learner_id?: string
          school_id?: string
          term?: number
          token?: string
          view_count?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_share_links_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_share_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          school_id: string | null
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          school_id?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          school_id?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          contact_email: string
          contact_phone: string
          county: string
          created_at: string
          id: string
          school_code: string
          school_name: string
          subscription_status: string
          updated_at: string
        }
        Insert: {
          contact_email?: string
          contact_phone?: string
          county?: string
          created_at?: string
          id?: string
          school_code: string
          school_name: string
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string
          contact_phone?: string
          county?: string
          created_at?: string
          id?: string
          school_code?: string
          school_name?: string
          subscription_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      scores: {
        Row: {
          assessment_type: string
          created_at: string
          id: string
          learner_id: string
          learning_area_id: string
          school_id: string | null
          score: number
          teacher_comment: string | null
          term: number
          updated_at: string
          year: number
        }
        Insert: {
          assessment_type?: string
          created_at?: string
          id?: string
          learner_id: string
          learning_area_id: string
          school_id?: string | null
          score: number
          teacher_comment?: string | null
          term: number
          updated_at?: string
          year: number
        }
        Update: {
          assessment_type?: string
          created_at?: string
          id?: string
          learner_id?: string
          learning_area_id?: string
          school_id?: string | null
          score?: number
          teacher_comment?: string | null
          term?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "scores_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_learning_area_id_fkey"
            columns: ["learning_area_id"]
            isOneToOne: false
            referencedRelation: "learning_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      strand_scores: {
        Row: {
          assessment_type: string
          competency_level: string
          created_at: string
          id: string
          learner_id: string
          max_score: number
          school_id: string | null
          score: number
          strand_id: string
          teacher_comment: string | null
          term: number
          updated_at: string
          year: number
        }
        Insert: {
          assessment_type?: string
          competency_level?: string
          created_at?: string
          id?: string
          learner_id: string
          max_score?: number
          school_id?: string | null
          score?: number
          strand_id: string
          teacher_comment?: string | null
          term: number
          updated_at?: string
          year: number
        }
        Update: {
          assessment_type?: string
          competency_level?: string
          created_at?: string
          id?: string
          learner_id?: string
          max_score?: number
          school_id?: string | null
          score?: number
          strand_id?: string
          teacher_comment?: string | null
          term?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "strand_scores_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strand_scores_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strand_scores_strand_id_fkey"
            columns: ["strand_id"]
            isOneToOne: false
            referencedRelation: "strands"
            referencedColumns: ["id"]
          },
        ]
      }
      strands: {
        Row: {
          created_at: string
          id: string
          learning_area_id: string
          name: string
          school_id: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          learning_area_id: string
          name: string
          school_id?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          learning_area_id?: string
          name?: string
          school_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "strands_learning_area_id_fkey"
            columns: ["learning_area_id"]
            isOneToOne: false
            referencedRelation: "learning_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strands_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      streams: {
        Row: {
          created_at: string
          id: string
          name: string
          school_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          school_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "streams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_strands: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          strand_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          strand_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          strand_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_strands_strand_id_fkey"
            columns: ["strand_id"]
            isOneToOne: false
            referencedRelation: "strands"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_assignments: {
        Row: {
          created_at: string
          grade: string
          id: string
          learning_area_id: string
          school_id: string
          stream: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          grade: string
          id?: string
          learning_area_id: string
          school_id: string
          stream: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          grade?: string
          id?: string
          learning_area_id?: string
          school_id?: string
          stream?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_learning_area_id_fkey"
            columns: ["learning_area_id"]
            isOneToOne: false
            referencedRelation: "learning_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_activation_keys: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          activation_key: string
          created_at: string
          expires_at: string | null
          generated_by: string
          id: string
          is_revoked: boolean
          notes: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          activation_key: string
          created_at?: string
          expires_at?: string | null
          generated_by: string
          id?: string
          is_revoked?: boolean
          notes?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          activation_key?: string
          created_at?: string
          expires_at?: string | null
          generated_by?: string
          id?: string
          is_revoked?: boolean
          notes?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_activation_keys_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      timetables: {
        Row: {
          break_period: number | null
          created_at: string
          data: Json
          days: string[]
          generated_by: string
          grade: string | null
          id: string
          name: string
          periods_per_day: number
          school_id: string
          stream: string | null
          updated_at: string
        }
        Insert: {
          break_period?: number | null
          created_at?: string
          data?: Json
          days?: string[]
          generated_by: string
          grade?: string | null
          id?: string
          name: string
          periods_per_day?: number
          school_id: string
          stream?: string | null
          updated_at?: string
        }
        Update: {
          break_period?: number | null
          created_at?: string
          data?: Json
          days?: string[]
          generated_by?: string
          grade?: string | null
          id?: string
          name?: string
          periods_per_day?: number
          school_id?: string
          stream?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetables_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_attendance_alerts: { Args: never; Returns: undefined }
      check_performance_drops: { Args: never; Returns: undefined }
      create_notification: {
        Args: {
          _message: string
          _metadata?: Json
          _school_id: string
          _title: string
          _type?: string
          _user_id: string
        }
        Returns: string
      }
      generate_school_code: { Args: never; Returns: string }
      get_user_assigned_grades: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_school_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "headteacher" | "super_admin" | "parent"
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
      app_role: ["admin", "teacher", "headteacher", "super_admin", "parent"],
    },
  },
} as const
