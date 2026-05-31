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
          marked_via: string
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
          marked_via?: string
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
          marked_via?: string
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
      curriculum_designs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          grade: string
          id: string
          notes: string | null
          source: Database["public"]["Enums"]["curriculum_source"]
          status: Database["public"]["Enums"]["curriculum_status"]
          subject: string
          term: number
          title: string | null
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          grade: string
          id?: string
          notes?: string | null
          source?: Database["public"]["Enums"]["curriculum_source"]
          status?: Database["public"]["Enums"]["curriculum_status"]
          subject: string
          term: number
          title?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          grade?: string
          id?: string
          notes?: string | null
          source?: Database["public"]["Enums"]["curriculum_source"]
          status?: Database["public"]["Enums"]["curriculum_status"]
          subject?: string
          term?: number
          title?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      curriculum_strands: {
        Row: {
          created_at: string
          design_id: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          design_id: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          design_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_strands_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "curriculum_designs"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_sub_strands: {
        Row: {
          activities: string[]
          assessment_methods: string[]
          competencies: string[]
          created_at: string
          id: string
          inquiry_questions: string[]
          lesson_allocation: number
          name: string
          pcis: string[]
          resources: string[]
          slos: string[]
          sort_order: number
          strand_id: string
          values: string[]
        }
        Insert: {
          activities?: string[]
          assessment_methods?: string[]
          competencies?: string[]
          created_at?: string
          id?: string
          inquiry_questions?: string[]
          lesson_allocation?: number
          name: string
          pcis?: string[]
          resources?: string[]
          slos?: string[]
          sort_order?: number
          strand_id: string
          values?: string[]
        }
        Update: {
          activities?: string[]
          assessment_methods?: string[]
          competencies?: string[]
          created_at?: string
          id?: string
          inquiry_questions?: string[]
          lesson_allocation?: number
          name?: string
          pcis?: string[]
          resources?: string[]
          slos?: string[]
          sort_order?: number
          strand_id?: string
          values?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_sub_strands_strand_id_fkey"
            columns: ["strand_id"]
            isOneToOne: false
            referencedRelation: "curriculum_strands"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string
          id: string
          is_global: boolean
          school_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          created_by: string
          id?: string
          is_global?: boolean
          school_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_global?: boolean
          school_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          language: string
          prompt: string | null
          recipient_name: string | null
          recipient_type: string
          school_id: string
          title: string
          tone: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by: string
          id?: string
          language?: string
          prompt?: string | null
          recipient_name?: string | null
          recipient_type?: string
          school_id: string
          title: string
          tone?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          language?: string
          prompt?: string | null
          recipient_name?: string | null
          recipient_type?: string
          school_id?: string
          title?: string
          tone?: string
          updated_at?: string
        }
        Relationships: []
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
          receipt_number: string | null
          recorded_by: string
          school_id: string | null
          term: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
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
          receipt_number?: string | null
          recorded_by: string
          school_id?: string | null
          term: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          receipt_number?: string | null
          recorded_by?: string
          school_id?: string | null
          term?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
      fee_structures: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          description: string | null
          fee_type: string
          grade: string
          id: string
          is_active: boolean
          school_id: string
          term: number
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by: string
          description?: string | null
          fee_type?: string
          grade: string
          id?: string
          is_active?: boolean
          school_id: string
          term: number
          updated_at?: string
          year?: number
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          description?: string | null
          fee_type?: string
          grade?: string
          id?: string
          is_active?: boolean
          school_id?: string
          term?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      global_sms_config: {
        Row: {
          api_key: string
          body_template: Json
          created_at: string
          endpoint: string
          headers_json: Json
          id: string
          is_active: boolean
          partner_id: string | null
          provider: string
          sender_id: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          api_key?: string
          body_template?: Json
          created_at?: string
          endpoint?: string
          headers_json?: Json
          id?: string
          is_active?: boolean
          partner_id?: string | null
          provider?: string
          sender_id?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          api_key?: string
          body_template?: Json
          created_at?: string
          endpoint?: string
          headers_json?: Json
          id?: string
          is_active?: boolean
          partner_id?: string | null
          provider?: string
          sender_id?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      grade_subject_lessons: {
        Row: {
          created_at: string
          grade: string
          id: string
          learning_area_id: string
          lessons_per_week: number
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade: string
          id?: string
          learning_area_id: string
          lessons_per_week?: number
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade?: string
          id?: string
          learning_area_id?: string
          lessons_per_week?: number
          school_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      independent_learners: {
        Row: {
          county: string
          created_at: string
          full_name: string
          grade: string
          id: string
          is_active: boolean
          learner_code: string
          parent_name: string
          parent_phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          county: string
          created_at?: string
          full_name: string
          grade: string
          id?: string
          is_active?: boolean
          learner_code: string
          parent_name: string
          parent_phone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          county?: string
          created_at?: string
          full_name?: string
          grade?: string
          id?: string
          is_active?: boolean
          learner_code?: string
          parent_name?: string
          parent_phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      independent_subscriptions: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          amount: number
          created_at: string
          expires_at: string | null
          id: string
          learner_id: string
          mpesa_code: string | null
          mpesa_phone: string | null
          notes: string | null
          paid_to: string
          rejection_reason: string | null
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
          weeks: number
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          learner_id: string
          mpesa_code?: string | null
          mpesa_phone?: string | null
          notes?: string | null
          paid_to?: string
          rejection_reason?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
          weeks?: number
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          learner_id?: string
          mpesa_code?: string | null
          mpesa_phone?: string | null
          notes?: string | null
          paid_to?: string
          rejection_reason?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
          weeks?: number
        }
        Relationships: [
          {
            foreignKeyName: "independent_subscriptions_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "independent_learners"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "learning_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_face_descriptors: {
        Row: {
          descriptor: Json
          enrolled_at: string
          enrolled_by: string
          id: string
          learner_id: string
          school_id: string
          updated_at: string
        }
        Insert: {
          descriptor: Json
          enrolled_at?: string
          enrolled_by: string
          id?: string
          learner_id: string
          school_id: string
          updated_at?: string
        }
        Update: {
          descriptor?: Json
          enrolled_at?: string
          enrolled_by?: string
          id?: string
          learner_id?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      learner_lesson_progress: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          quiz_score: number | null
          quiz_total: number | null
          seconds_spent: number
          status: string
          subject_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          quiz_score?: number | null
          quiz_total?: number | null
          seconds_spent?: number
          status?: string
          subject_slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          quiz_score?: number | null
          quiz_total?: number | null
          seconds_spent?: number
          status?: string
          subject_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learner_streaks: {
        Row: {
          current_streak: number
          last_active_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_active_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_active_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learner_topic_mastery: {
        Row: {
          attempts_count: number
          competency_level: Database["public"]["Enums"]["cbc_competency_level"]
          grade: string
          id: string
          last_attempt_at: string | null
          mastery_percent: number
          subject_slug: string
          time_spent_seconds: number
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts_count?: number
          competency_level?: Database["public"]["Enums"]["cbc_competency_level"]
          grade: string
          id?: string
          last_attempt_at?: string | null
          mastery_percent?: number
          subject_slug: string
          time_spent_seconds?: number
          topic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts_count?: number
          competency_level?: Database["public"]["Enums"]["cbc_competency_level"]
          grade?: string
          id?: string
          last_attempt_at?: string | null
          mastery_percent?: number
          subject_slug?: string
          time_spent_seconds?: number
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_topic_mastery_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "learning_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      learners: {
        Row: {
          academic_year: number
          admission_number: string
          assessment_number: string | null
          created_at: string
          full_name: string
          gender: string
          grade: string
          id: string
          is_active: boolean
          parent_name: string | null
          parent_phone: string | null
          parent_phone_2: string | null
          school_id: string | null
          stream: string
          updated_at: string
        }
        Insert: {
          academic_year?: number
          admission_number: string
          assessment_number?: string | null
          created_at?: string
          full_name: string
          gender?: string
          grade: string
          id?: string
          is_active?: boolean
          parent_name?: string | null
          parent_phone?: string | null
          parent_phone_2?: string | null
          school_id?: string | null
          stream?: string
          updated_at?: string
        }
        Update: {
          academic_year?: number
          admission_number?: string
          assessment_number?: string | null
          created_at?: string
          full_name?: string
          gender?: string
          grade?: string
          id?: string
          is_active?: boolean
          parent_name?: string | null
          parent_phone?: string | null
          parent_phone_2?: string | null
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
      learning_assessments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          grade: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["learning_assessment_kind"]
          pass_percent: number
          question_ids: Json
          school_id: string | null
          subject_slug: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          grade: string
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["learning_assessment_kind"]
          pass_percent?: number
          question_ids?: Json
          school_id?: string | null
          subject_slug?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          grade?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["learning_assessment_kind"]
          pass_percent?: number
          question_ids?: Json
          school_id?: string | null
          subject_slug?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_assessments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_attempts: {
        Row: {
          answers: Json
          assessment_id: string | null
          competency_level:
            | Database["public"]["Enums"]["cbc_competency_level"]
            | null
          created_at: string
          duration_seconds: number | null
          earned_marks: number
          grade: string | null
          id: string
          passed: boolean
          score_percent: number
          started_at: string
          subject_slug: string | null
          submitted_at: string | null
          topic_id: string | null
          total_marks: number
          user_id: string
        }
        Insert: {
          answers?: Json
          assessment_id?: string | null
          competency_level?:
            | Database["public"]["Enums"]["cbc_competency_level"]
            | null
          created_at?: string
          duration_seconds?: number | null
          earned_marks?: number
          grade?: string | null
          id?: string
          passed?: boolean
          score_percent?: number
          started_at?: string
          subject_slug?: string | null
          submitted_at?: string | null
          topic_id?: string | null
          total_marks?: number
          user_id: string
        }
        Update: {
          answers?: Json
          assessment_id?: string | null
          competency_level?:
            | Database["public"]["Enums"]["cbc_competency_level"]
            | null
          created_at?: string
          duration_seconds?: number | null
          earned_marks?: number
          grade?: string | null
          id?: string
          passed?: boolean
          score_percent?: number
          started_at?: string
          subject_slug?: string | null
          submitted_at?: string | null
          topic_id?: string | null
          total_marks?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_attempts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "learning_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_attempts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "learning_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_badges: {
        Row: {
          code: string
          criteria: Json
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          title: string
        }
        Insert: {
          code: string
          criteria?: Json
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          title: string
        }
        Update: {
          code?: string
          criteria?: Json
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          title?: string
        }
        Relationships: []
      }
      learning_notes: {
        Row: {
          attachment_url: string | null
          content_md: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          school_id: string | null
          sort_order: number
          title: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          content_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          school_id?: string | null
          sort_order?: number
          title: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          content_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          school_id?: string | null
          sort_order?: number
          title?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_notes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "learning_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_path_entitlements: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          amount: number
          created_at: string
          expires_at: string | null
          id: string
          learner_id: string
          mpesa_code: string | null
          mpesa_phone: string | null
          notes: string | null
          paid_to: string
          parent_user_id: string
          rejection_reason: string | null
          school_id: string
          status: string
          submitted_at: string
          updated_at: string
          weeks: number
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          learner_id: string
          mpesa_code?: string | null
          mpesa_phone?: string | null
          notes?: string | null
          paid_to?: string
          parent_user_id: string
          rejection_reason?: string | null
          school_id: string
          status?: string
          submitted_at?: string
          updated_at?: string
          weeks?: number
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          learner_id?: string
          mpesa_code?: string | null
          mpesa_phone?: string | null
          notes?: string | null
          paid_to?: string
          parent_user_id?: string
          rejection_reason?: string | null
          school_id?: string
          status?: string
          submitted_at?: string
          updated_at?: string
          weeks?: number
        }
        Relationships: []
      }
      learning_progress: {
        Row: {
          badges: string[]
          id: string
          last_played: string | null
          learner_id: string
          lessons_completed: number
          level: number
          streak: number
          subject_id: string
          subject_name: string
          topics_covered: string[]
          updated_at: string
          xp: number
        }
        Insert: {
          badges?: string[]
          id?: string
          last_played?: string | null
          learner_id: string
          lessons_completed?: number
          level?: number
          streak?: number
          subject_id: string
          subject_name: string
          topics_covered?: string[]
          updated_at?: string
          xp?: number
        }
        Update: {
          badges?: string[]
          id?: string
          last_played?: string | null
          learner_id?: string
          lessons_completed?: number
          level?: number
          streak?: number
          subject_id?: string
          subject_name?: string
          topics_covered?: string[]
          updated_at?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_progress_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_questions: {
        Row: {
          correct_answers: Json
          created_at: string
          created_by: string | null
          difficulty: number
          explanation: string | null
          id: string
          is_active: boolean
          marks: number
          options: Json
          prompt: string
          question_type: Database["public"]["Enums"]["learning_question_type"]
          school_id: string | null
          topic_id: string
          updated_at: string
        }
        Insert: {
          correct_answers?: Json
          created_at?: string
          created_by?: string | null
          difficulty?: number
          explanation?: string | null
          id?: string
          is_active?: boolean
          marks?: number
          options?: Json
          prompt: string
          question_type?: Database["public"]["Enums"]["learning_question_type"]
          school_id?: string | null
          topic_id: string
          updated_at?: string
        }
        Update: {
          correct_answers?: Json
          created_at?: string
          created_by?: string | null
          difficulty?: number
          explanation?: string | null
          id?: string
          is_active?: boolean
          marks?: number
          options?: Json
          prompt?: string
          question_type?: Database["public"]["Enums"]["learning_question_type"]
          school_id?: string | null
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "learning_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_responses: {
        Row: {
          correct_answer: string | null
          created_at: string
          difficulty: number | null
          explanation: string | null
          id: string
          is_correct: boolean
          learner_id: string
          level_at_time: number | null
          question: string
          selected_answer: string | null
          source: string
          strand: string | null
          subject_id: string
          subject_name: string
        }
        Insert: {
          correct_answer?: string | null
          created_at?: string
          difficulty?: number | null
          explanation?: string | null
          id?: string
          is_correct: boolean
          learner_id: string
          level_at_time?: number | null
          question: string
          selected_answer?: string | null
          source: string
          strand?: string | null
          subject_id: string
          subject_name: string
        }
        Update: {
          correct_answer?: string | null
          created_at?: string
          difficulty?: number | null
          explanation?: string | null
          id?: string
          is_correct?: boolean
          learner_id?: string
          level_at_time?: number | null
          question?: string
          selected_answer?: string | null
          source?: string
          strand?: string | null
          subject_id?: string
          subject_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_responses_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_topics: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          grade: string
          id: string
          is_active: boolean
          school_id: string | null
          sort_order: number
          strand: string | null
          sub_strand: string | null
          subject_slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          grade: string
          id?: string
          is_active?: boolean
          school_id?: string | null
          sort_order?: number
          strand?: string | null
          sub_strand?: string | null
          subject_slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          grade?: string
          id?: string
          is_active?: boolean
          school_id?: string | null
          sort_order?: number
          strand?: string | null
          sub_strand?: string | null
          subject_slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_topics_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_videos: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          is_active: boolean
          school_id: string | null
          sort_order: number
          thumbnail_url: string | null
          title: string
          topic_id: string
          updated_at: string
          video_url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          school_id?: string | null
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          topic_id: string
          updated_at?: string
          video_url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          school_id?: string | null
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          topic_id?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_videos_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_videos_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "learning_topics"
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
      parent_portal_links: {
        Row: {
          assessment_type: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          is_active: boolean
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
          is_active?: boolean
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
          is_active?: boolean
          last_viewed_at?: string | null
          learner_id?: string
          school_id?: string
          term?: number
          token?: string
          view_count?: number
          year?: number
        }
        Relationships: []
      }
      pending_schools: {
        Row: {
          county: string
          created_at: string
          id: string
          linked_school_id: string | null
          normalized_name: string
          onboarding_status: string
          school_name: string
          updated_at: string
        }
        Insert: {
          county?: string
          created_at?: string
          id?: string
          linked_school_id?: string | null
          normalized_name: string
          onboarding_status?: string
          school_name: string
          updated_at?: string
        }
        Update: {
          county?: string
          created_at?: string
          id?: string
          linked_school_id?: string | null
          normalized_name?: string
          onboarding_status?: string
          school_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_schools_linked_school_id_fkey"
            columns: ["linked_school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      principal_comment_bands: {
        Row: {
          comment: string
          created_at: string
          id: string
          max_score: number
          min_score: number
          school_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          comment?: string
          created_at?: string
          id?: string
          max_score?: number
          min_score?: number
          school_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          max_score?: number
          min_score?: number
          school_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
          whatsapp_number: string | null
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
          whatsapp_number?: string | null
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
          whatsapp_number?: string | null
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
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          learner_id: string
          message_body: string | null
          provider_message_id: string | null
          recipient: string
          school_id: string
          sent_by: string
          share_link_id: string | null
          status: string
          template_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          learner_id: string
          message_body?: string | null
          provider_message_id?: string | null
          recipient: string
          school_id: string
          sent_by: string
          share_link_id?: string | null
          status?: string
          template_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          learner_id?: string
          message_body?: string | null
          provider_message_id?: string | null
          recipient?: string
          school_id?: string
          sent_by?: string
          share_link_id?: string | null
          status?: string
          template_id?: string | null
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
          {
            foreignKeyName: "report_delivery_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
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
      school_sms_config: {
        Row: {
          api_key: string
          body_template: Json
          created_at: string
          endpoint: string
          headers_json: Json
          id: string
          is_active: boolean
          notes: string | null
          partner_id: string | null
          provider: string
          school_id: string
          sender_id: string
          updated_at: string
        }
        Insert: {
          api_key?: string
          body_template?: Json
          created_at?: string
          endpoint?: string
          headers_json?: Json
          id?: string
          is_active?: boolean
          notes?: string | null
          partner_id?: string | null
          provider?: string
          school_id: string
          sender_id?: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          body_template?: Json
          created_at?: string
          endpoint?: string
          headers_json?: Json
          id?: string
          is_active?: boolean
          notes?: string | null
          partner_id?: string | null
          provider?: string
          school_id?: string
          sender_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_sms_credits: {
        Row: {
          balance: number
          enabled: boolean
          id: string
          low_threshold: number
          school_id: string
          updated_at: string
          used: number
        }
        Insert: {
          balance?: number
          enabled?: boolean
          id?: string
          low_threshold?: number
          school_id: string
          updated_at?: string
          used?: number
        }
        Update: {
          balance?: number
          enabled?: boolean
          id?: string
          low_threshold?: number
          school_id?: string
          updated_at?: string
          used?: number
        }
        Relationships: []
      }
      schools: {
        Row: {
          contact_email: string
          contact_phone: string
          county: string
          created_at: string
          id: string
          plan_expires_at: string | null
          plan_id: string | null
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
          plan_expires_at?: string | null
          plan_id?: string | null
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
          plan_expires_at?: string | null
          plan_id?: string | null
          school_code?: string
          school_name?: string
          subscription_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schools_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
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
      sms_logs: {
        Row: {
          error: string | null
          id: string
          message: string
          phone_source: string | null
          provider: string | null
          provider_message_id: string | null
          recipient: string
          school_id: string
          segments: number
          sender_id: string | null
          sent_at: string
          sent_by: string | null
          status: string
          used_global_fallback: boolean
        }
        Insert: {
          error?: string | null
          id?: string
          message: string
          phone_source?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient: string
          school_id: string
          segments?: number
          sender_id?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          used_global_fallback?: boolean
        }
        Update: {
          error?: string | null
          id?: string
          message?: string
          phone_source?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient?: string
          school_id?: string
          segments?: number
          sender_id?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          used_global_fallback?: boolean
        }
        Relationships: []
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
          level: string
          name: string
          school_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          name: string
          school_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
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
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          name: string
          price_monthly: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          price_monthly?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          price_monthly?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
      teacher_classes: {
        Row: {
          class_name: string
          created_at: string
          id: string
          linked_school_id: string | null
          pending_school_id: string | null
          stream: string
          teacher_user_id: string
          updated_at: string
        }
        Insert: {
          class_name: string
          created_at?: string
          id?: string
          linked_school_id?: string | null
          pending_school_id?: string | null
          stream?: string
          teacher_user_id: string
          updated_at?: string
        }
        Update: {
          class_name?: string
          created_at?: string
          id?: string
          linked_school_id?: string | null
          pending_school_id?: string | null
          stream?: string
          teacher_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_classes_linked_school_id_fkey"
            columns: ["linked_school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_classes_pending_school_id_fkey"
            columns: ["pending_school_id"]
            isOneToOne: false
            referencedRelation: "pending_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_learners: {
        Row: {
          admission_number: string
          class_id: string
          created_at: string
          full_name: string
          gender: string
          id: string
          is_active: boolean
          migrated_learner_id: string | null
          parent_name: string | null
          parent_phone: string | null
          teacher_user_id: string
          updated_at: string
        }
        Insert: {
          admission_number: string
          class_id: string
          created_at?: string
          full_name: string
          gender?: string
          id?: string
          is_active?: boolean
          migrated_learner_id?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          teacher_user_id: string
          updated_at?: string
        }
        Update: {
          admission_number?: string
          class_id?: string
          created_at?: string
          full_name?: string
          gender?: string
          id?: string
          is_active?: boolean
          migrated_learner_id?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          teacher_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_learners_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_learners_migrated_learner_id_fkey"
            columns: ["migrated_learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_registrations: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          class_name: string
          county: string
          created_at: string
          email: string
          full_name: string
          id: string
          linked_school_id: string | null
          pending_school_id: string | null
          phone: string
          rejection_reason: string | null
          school_name_raw: string
          stream: string
          tsc_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          class_name: string
          county?: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          linked_school_id?: string | null
          pending_school_id?: string | null
          phone: string
          rejection_reason?: string | null
          school_name_raw: string
          stream?: string
          tsc_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          class_name?: string
          county?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          linked_school_id?: string | null
          pending_school_id?: string | null
          phone?: string
          rejection_reason?: string | null
          school_name_raw?: string
          stream?: string
          tsc_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_registrations_linked_school_id_fkey"
            columns: ["linked_school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_registrations_pending_school_id_fkey"
            columns: ["pending_school_id"]
            isOneToOne: false
            referencedRelation: "pending_schools"
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
      timetable_class_lessons: {
        Row: {
          classroom: string | null
          count: number
          created_at: string
          grade: string
          id: string
          learning_area_id: string
          length: number
          school_id: string
          stream: string
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          classroom?: string | null
          count?: number
          created_at?: string
          grade: string
          id?: string
          learning_area_id: string
          length?: number
          school_id: string
          stream: string
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          classroom?: string | null
          count?: number
          created_at?: string
          grade?: string
          id?: string
          learning_area_id?: string
          length?: number
          school_id?: string
          stream?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      timetable_settings: {
        Row: {
          break_labels: Json
          break_periods: Json
          created_at: string
          day_labels: Json
          id: string
          num_days: number
          periods_per_day: number
          school_id: string
          updated_at: string
          weekend: Json
          zero_period: boolean
        }
        Insert: {
          break_labels?: Json
          break_periods?: Json
          created_at?: string
          day_labels?: Json
          id?: string
          num_days?: number
          periods_per_day?: number
          school_id: string
          updated_at?: string
          weekend?: Json
          zero_period?: boolean
        }
        Update: {
          break_labels?: Json
          break_periods?: Json
          created_at?: string
          day_labels?: Json
          id?: string
          num_days?: number
          periods_per_day?: number
          school_id?: string
          updated_at?: string
          weekend?: Json
          zero_period?: boolean
        }
        Relationships: []
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
      whatsapp_queue: {
        Row: {
          attempt_count: number
          channel_used: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          last_attempt_at: string | null
          learner_id: string | null
          max_attempts: number
          provider_message_id: string | null
          recipient: string
          rendered_message: string | null
          scheduled_for: string
          school_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["whatsapp_queue_status"]
          template_id: string | null
          updated_at: string
          variables: Json
        }
        Insert: {
          attempt_count?: number
          channel_used?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          learner_id?: string | null
          max_attempts?: number
          provider_message_id?: string | null
          recipient: string
          rendered_message?: string | null
          scheduled_for?: string
          school_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_queue_status"]
          template_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          attempt_count?: number
          channel_used?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          learner_id?: string | null
          max_attempts?: number
          provider_message_id?: string | null
          recipient?: string
          rendered_message?: string | null
          scheduled_for?: string
          school_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_queue_status"]
          template_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_queue_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_queue_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          recipient_ids: string[] | null
          run_at: string
          school_id: string
          target_grade: string | null
          target_scope: string
          target_stream: string | null
          template_id: string
          updated_at: string
          variables: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          recipient_ids?: string[] | null
          run_at: string
          school_id: string
          target_grade?: string | null
          target_scope?: string
          target_stream?: string | null
          template_id: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          recipient_ids?: string[] | null
          run_at?: string
          school_id?: string
          target_grade?: string | null
          target_scope?: string
          target_stream?: string | null
          template_id?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_schedules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_schedules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          auto_send_attendance: boolean
          auto_send_fee_reminders: boolean
          auto_send_report_cards: boolean
          created_at: string
          daily_send_limit: number
          enforce_school_branding: boolean
          id: string
          school_id: string
          sender_display_name: string | null
          updated_at: string
        }
        Insert: {
          auto_send_attendance?: boolean
          auto_send_fee_reminders?: boolean
          auto_send_report_cards?: boolean
          created_at?: string
          daily_send_limit?: number
          enforce_school_branding?: boolean
          id?: string
          school_id: string
          sender_display_name?: string | null
          updated_at?: string
        }
        Update: {
          auto_send_attendance?: boolean
          auto_send_fee_reminders?: boolean
          auto_send_report_cards?: boolean
          created_at?: string
          daily_send_limit?: number
          enforce_school_branding?: boolean
          id?: string
          school_id?: string
          sender_display_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body_text: string
          buttons: Json
          category: Database["public"]["Enums"]["whatsapp_template_category"]
          created_at: string
          created_by: string | null
          footer_text: string | null
          header_text: string | null
          id: string
          is_system: boolean
          language: string
          name: string
          provider_template_id: string | null
          required_vars: string[]
          school_id: string
          status: Database["public"]["Enums"]["whatsapp_template_status"]
          updated_at: string
        }
        Insert: {
          body_text: string
          buttons?: Json
          category?: Database["public"]["Enums"]["whatsapp_template_category"]
          created_at?: string
          created_by?: string | null
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_system?: boolean
          language?: string
          name: string
          provider_template_id?: string | null
          required_vars?: string[]
          school_id: string
          status?: Database["public"]["Enums"]["whatsapp_template_status"]
          updated_at?: string
        }
        Update: {
          body_text?: string
          buttons?: Json
          category?: Database["public"]["Enums"]["whatsapp_template_category"]
          created_at?: string
          created_by?: string | null
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_system?: boolean
          language?: string
          name?: string
          provider_template_id?: string | null
          required_vars?: string[]
          school_id?: string
          status?: Database["public"]["Enums"]["whatsapp_template_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
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
      deduct_sms_credits: {
        Args: { _amount: number; _school_id: string }
        Returns: boolean
      }
      expire_old_independent_subscriptions: { Args: never; Returns: number }
      find_system_wa_template: {
        Args: { _name: string; _school_id: string }
        Returns: string
      }
      generate_independent_learner_code: { Args: never; Returns: string }
      generate_receipt_number: { Args: { _school_id: string }; Returns: string }
      generate_school_code: { Args: never; Returns: string }
      get_school_plan_features: { Args: { _school_id: string }; Returns: Json }
      get_user_assigned_grades: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_school_id: { Args: { _user_id: string }; Returns: string }
      has_active_independent_subscription: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_active_learning_path: {
        Args: { _learner_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_pending_school_to_school: {
        Args: { _pending_school_id: string; _school_id: string }
        Returns: undefined
      }
      seed_whatsapp_defaults_for_school: {
        Args: { _school_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "teacher"
        | "headteacher"
        | "super_admin"
        | "parent"
        | "independent_learner"
        | "pending_teacher"
      cbc_competency_level: "emerging" | "approaching" | "meeting" | "exceeding"
      curriculum_source: "manual" | "ai_pdf"
      curriculum_status: "draft" | "review" | "approved" | "active" | "archived"
      learning_assessment_kind:
        | "topic_quiz"
        | "subject_assessment"
        | "kpsea_mock"
        | "kjsea_mock"
      learning_question_type:
        | "mcq"
        | "multi_select"
        | "true_false"
        | "short_answer"
      whatsapp_queue_status:
        | "queued"
        | "processing"
        | "sent"
        | "failed"
        | "cancelled"
      whatsapp_template_category: "utility" | "marketing" | "authentication"
      whatsapp_template_status: "draft" | "pending" | "approved" | "rejected"
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
      app_role: [
        "admin",
        "teacher",
        "headteacher",
        "super_admin",
        "parent",
        "independent_learner",
        "pending_teacher",
      ],
      cbc_competency_level: ["emerging", "approaching", "meeting", "exceeding"],
      curriculum_source: ["manual", "ai_pdf"],
      curriculum_status: ["draft", "review", "approved", "active", "archived"],
      learning_assessment_kind: [
        "topic_quiz",
        "subject_assessment",
        "kpsea_mock",
        "kjsea_mock",
      ],
      learning_question_type: [
        "mcq",
        "multi_select",
        "true_false",
        "short_answer",
      ],
      whatsapp_queue_status: [
        "queued",
        "processing",
        "sent",
        "failed",
        "cancelled",
      ],
      whatsapp_template_category: ["utility", "marketing", "authentication"],
      whatsapp_template_status: ["draft", "pending", "approved", "rejected"],
    },
  },
} as const
