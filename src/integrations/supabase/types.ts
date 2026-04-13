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
