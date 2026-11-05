export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      academic_units: {
        Row: {
          code: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          parent_id: string | null;
          status: string;
          unit_type: string;
          university_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          parent_id?: string | null;
          status?: string;
          unit_type: string;
          university_id: string;
          updated_at?: string;
        };
        Update: {
          code?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          parent_id?: string | null;
          status?: string;
          unit_type?: string;
          university_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academic_units_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "academic_units_parent_same_university";
            columns: ["parent_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "academic_units";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "academic_units_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      academic_years: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          end_date: string;
          id: string;
          is_current: boolean;
          name: string;
          start_date: string;
          status: string;
          university_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          end_date: string;
          id?: string;
          is_current?: boolean;
          name: string;
          start_date: string;
          status?: string;
          university_id: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          end_date?: string;
          id?: string;
          is_current?: boolean;
          name?: string;
          start_date?: string;
          status?: string;
          university_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academic_years_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "academic_years_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      announcement_reads: {
        Row: {
          announcement_id: string;
          id: string;
          read_at: string;
          university_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          announcement_id: string;
          id?: string;
          read_at?: string;
          university_id: string;
          user_id: string;
        };
        Update: {
          announcement_id?: string;
          id?: string;
          read_at?: string;
          university_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcement_reads_same_university";
            columns: ["announcement_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "announcements";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "announcement_reads_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      announcements: {
        Row: {
          archived_at: string | null;
          author: string;
          body: string;
          class_id: string;
          created_at: string;
          id: string;
          offering_id: string | null;
          pinned: boolean;
          published_at: string | null;
          title: string;
          university_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          author: string;
          body: string;
          class_id: string;
          created_at?: string;
          id?: string;
          offering_id?: string | null;
          pinned?: boolean;
          published_at?: string | null;
          title: string;
          university_id: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          author?: string;
          body?: string;
          class_id?: string;
          created_at?: string;
          id?: string;
          offering_id?: string | null;
          pinned?: boolean;
          published_at?: string | null;
          title?: string;
          university_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_author_fkey";
            columns: ["author"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcements_class_same_university";
            columns: ["class_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "announcements_offering_same_university";
            columns: ["offering_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "course_offerings";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "announcements_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      app_activity_events: {
        Row: {
          actor_id: string | null;
          class_id: string | null;
          created_at: string;
          event_type: string;
          id: number;
          metadata: NonNullable<Json>;
          resource_id: string | null;
          resource_type: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          class_id?: string | null;
          created_at?: string;
          event_type: string;
          id?: number;
          metadata?: NonNullable<Json>;
          resource_id?: string | null;
          resource_type: string;
        };
        Update: {
          actor_id?: string | null;
          class_id?: string | null;
          created_at?: string;
          event_type?: string;
          id?: number;
          metadata?: NonNullable<Json>;
          resource_id?: string | null;
          resource_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "app_activity_events_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      app_error_events: {
        Row: {
          created_at: string;
          error_digest: string | null;
          error_name: string | null;
          id: number;
          method: string | null;
          route_path: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          error_digest?: string | null;
          error_name?: string | null;
          id?: number;
          method?: string | null;
          route_path?: string | null;
        };
        Update: {
          created_at?: string;
          error_digest?: string | null;
          error_name?: string | null;
          id?: number;
          method?: string | null;
          route_path?: string | null;
        };
        Relationships: [];
      };
      assignment_attachments: {
        Row: {
          assignment_id: string;
          created_at: string;
          file_size: number;
          id: string;
          mime_type: string;
          original_filename: string;
          storage_path: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          created_at?: string;
          file_size: number;
          id?: string;
          mime_type: string;
          original_filename: string;
          storage_path: string;
        };
        Update: {
          assignment_id?: string;
          created_at?: string;
          file_size?: number;
          id?: string;
          mime_type?: string;
          original_filename?: string;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignment_attachments_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      assignment_completions: {
        Row: {
          assignment_id: string;
          completed_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          completed_at?: string;
          user_id: string;
        };
        Update: {
          assignment_id?: string;
          completed_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignment_completions_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      assignment_reports: {
        Row: {
          assignment_id: string;
          class_id: string;
          created_at: string;
          id: string;
          note: string | null;
          reason: string;
          reporter_id: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          class_id: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          reason: string;
          reporter_id: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          assignment_id?: string;
          class_id?: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          reason?: string;
          reporter_id?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignment_reports_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignment_reports_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      assignment_reviews: {
        Row: {
          assignment_id: string;
          created_at: string;
          decision: string;
          id: string;
          reason: string | null;
          reviewer_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          created_at?: string;
          decision: string;
          id?: string;
          reason?: string | null;
          reviewer_id?: string | null;
        };
        Update: {
          assignment_id?: string;
          created_at?: string;
          decision?: string;
          id?: string;
          reason?: string | null;
          reviewer_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assignment_reviews_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      assignment_revisions: {
        Row: {
          assignment_id: string;
          change_kind: string;
          changed_fields: string[];
          class_id: string | null;
          created_at: string;
          editor_id: string | null;
          id: string;
          revision: number;
          snapshot: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          change_kind?: string;
          changed_fields?: string[];
          class_id?: string | null;
          created_at?: string;
          editor_id?: string | null;
          id?: string;
          revision: number;
          snapshot?: NonNullable<Json>;
        };
        Update: {
          assignment_id?: string;
          change_kind?: string;
          changed_fields?: string[];
          class_id?: string | null;
          created_at?: string;
          editor_id?: string | null;
          id?: string;
          revision?: number;
          snapshot?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "assignment_revisions_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignment_revisions_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      assignments: {
        Row: {
          academic_year: string | null;
          archived_at: string | null;
          assignment_type: string | null;
          class_id: string | null;
          content_type: string;
          course_id: string;
          created_at: string;
          deadline: string | null;
          description: string;
          drive_url: string | null;
          id: string;
          lecturer_name: string | null;
          offering_id: string | null;
          published_at: string | null;
          reference_urls: NonNullable<Json>;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          revision: number;
          search_vector: unknown;
          semester: string | null;
          source_label: string | null;
          status: string;
          subject_id: string | null;
          tags: string[];
          title: string;
          university_id: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          academic_year?: string | null;
          archived_at?: string | null;
          assignment_type?: string | null;
          class_id?: string | null;
          content_type?: string;
          course_id: string;
          created_at?: string;
          deadline?: string | null;
          description: string;
          drive_url?: string | null;
          id?: string;
          lecturer_name?: string | null;
          offering_id?: string | null;
          published_at?: string | null;
          reference_urls?: NonNullable<Json>;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          revision?: number;
          search_vector?: never;
          semester?: string | null;
          source_label?: string | null;
          status?: string;
          subject_id?: string | null;
          tags?: string[];
          title: string;
          university_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          academic_year?: string | null;
          archived_at?: string | null;
          assignment_type?: string | null;
          class_id?: string | null;
          content_type?: string;
          course_id?: string;
          created_at?: string;
          deadline?: string | null;
          description?: string;
          drive_url?: string | null;
          id?: string;
          lecturer_name?: string | null;
          offering_id?: string | null;
          published_at?: string | null;
          reference_urls?: NonNullable<Json>;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          revision?: number;
          search_vector?: never;
          semester?: string | null;
          source_label?: string | null;
          status?: string;
          subject_id?: string | null;
          tags?: string[];
          title?: string;
          university_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_offering_same_university";
            columns: ["offering_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "course_offerings";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "assignments_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "class_subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_correction_audits: {
        Row: {
          admin_id: string | null;
          class_id: string;
          created_at: string;
          id: string;
          metadata: NonNullable<Json>;
          new_status: string;
          physically_verified: boolean;
          previous_status: string;
          reason: string;
          session_id: string;
          student_id: string;
          subject_id: string | null;
          verification_method: string;
        };
        ComputedFields: never;
        Insert: {
          admin_id?: string | null;
          class_id: string;
          created_at?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          new_status: string;
          physically_verified?: boolean;
          previous_status: string;
          reason: string;
          session_id: string;
          student_id: string;
          subject_id?: string | null;
          verification_method?: string;
        };
        Update: {
          admin_id?: string | null;
          class_id?: string;
          created_at?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          new_status?: string;
          physically_verified?: boolean;
          previous_status?: string;
          reason?: string;
          session_id?: string;
          student_id?: string;
          subject_id?: string | null;
          verification_method?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_correction_audits_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_correction_audits_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "discussion_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_correction_audits_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "class_subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_corrections: {
        Row: {
          corrected_at: string;
          corrected_by: string;
          id: string;
          new_status: string;
          previous_status: string;
          reason: string;
          record_id: string;
          university_id: string;
        };
        ComputedFields: never;
        Insert: {
          corrected_at?: string;
          corrected_by: string;
          id?: string;
          new_status: string;
          previous_status: string;
          reason: string;
          record_id: string;
          university_id: string;
        };
        Update: {
          corrected_at?: string;
          corrected_by?: string;
          id?: string;
          new_status?: string;
          previous_status?: string;
          reason?: string;
          record_id?: string;
          university_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_corrections_corrected_by_fkey";
            columns: ["corrected_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_corrections_record_same_university";
            columns: ["record_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "attendance_records";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "attendance_corrections_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_meetings: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          location: string | null;
          offering_id: string;
          scheduled_at: string;
          status: string;
          university_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          location?: string | null;
          offering_id: string;
          scheduled_at: string;
          status?: string;
          university_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          location?: string | null;
          offering_id?: string;
          scheduled_at?: string;
          status?: string;
          university_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_meetings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_meetings_offering_same_university";
            columns: ["offering_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "course_offerings";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "attendance_meetings_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_records: {
        Row: {
          id: string;
          meeting_id: string;
          note: string | null;
          recorded_at: string;
          recorded_by: string;
          status: string;
          student_identity_id: string;
          university_id: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          meeting_id: string;
          note?: string | null;
          recorded_at?: string;
          recorded_by: string;
          status: string;
          student_identity_id: string;
          university_id: string;
        };
        Update: {
          id?: string;
          meeting_id?: string;
          note?: string | null;
          recorded_at?: string;
          recorded_by?: string;
          status?: string;
          student_identity_id?: string;
          university_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_records_identity_same_university";
            columns: ["student_identity_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "student_identities";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "attendance_records_meeting_same_university";
            columns: ["meeting_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "attendance_meetings";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "attendance_records_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_verification_attempts: {
        Row: {
          accuracy_m: number | null;
          created_at: string;
          distance_m: number | null;
          id: string;
          outcome: string;
          session_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          accuracy_m?: number | null;
          created_at?: string;
          distance_m?: number | null;
          id?: string;
          outcome: string;
          session_id: string;
          user_id: string;
        };
        Update: {
          accuracy_m?: number | null;
          created_at?: string;
          distance_m?: number | null;
          id?: string;
          outcome?: string;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_verification_attempts_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "discussion_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          after_state: Json | null;
          before_state: Json | null;
          class_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: number;
          metadata: NonNullable<Json>;
          university_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          after_state?: Json | null;
          before_state?: Json | null;
          class_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: never;
          metadata?: NonNullable<Json>;
          university_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after_state?: Json | null;
          before_state?: Json | null;
          class_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: never;
          metadata?: NonNullable<Json>;
          university_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      auth_activity_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: number;
          provider: string | null;
          reason: string | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_type: string;
          id?: number;
          provider?: string | null;
          reason?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: number;
          provider?: string | null;
          reason?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      class_admin_assignments: {
        Row: {
          class_id: string;
          granted_at: string;
          granted_by: string;
          id: string;
          revoked_at: string | null;
          revoked_by: string | null;
          student_identity_id: string | null;
          university_id: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          granted_at?: string;
          granted_by: string;
          id?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          student_identity_id?: string | null;
          university_id: string;
          user_id?: string | null;
        };
        Update: {
          class_id?: string;
          granted_at?: string;
          granted_by?: string;
          id?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          student_identity_id?: string | null;
          university_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "class_admin_assignments_class_same_university";
            columns: ["class_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "class_admin_assignments_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_admin_assignments_identity_same_university";
            columns: ["student_identity_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "student_identities";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "class_admin_assignments_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_admin_assignments_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      class_admin_permissions: {
        Row: {
          assignment_id: string;
          granted_at: string;
          permission_code: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          granted_at?: string;
          permission_code: string;
        };
        Update: {
          assignment_id?: string;
          granted_at?: string;
          permission_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_admin_permissions_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "class_admin_assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      class_admins: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          class_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          class_id: string;
          user_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          class_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_admins_class_id_user_id_fkey";
            columns: ["class_id", "user_id"];
            isOneToOne: true;
            referencedRelation: "class_members";
            referencedColumns: ["class_id", "user_id"];
          },
        ];
      };
      class_application_reviews: {
        Row: {
          application_id: string;
          created_at: string;
          decision: string;
          id: string;
          note: string | null;
          reviewer_id: string;
        };
        ComputedFields: never;
        Insert: {
          application_id: string;
          created_at?: string;
          decision: string;
          id?: string;
          note?: string | null;
          reviewer_id: string;
        };
        Update: {
          application_id?: string;
          created_at?: string;
          decision?: string;
          id?: string;
          note?: string | null;
          reviewer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_application_reviews_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "class_applications";
            referencedColumns: ["id"];
          },
        ];
      };
      class_applications: {
        Row: {
          academic_year: string;
          applicant_id: string;
          course_name: string;
          created_at: string;
          created_class_id: string | null;
          decision_note: string | null;
          description: string;
          id: string;
          institution: string | null;
          lecturer_name: string | null;
          proposed_class_code: string | null;
          proposed_name: string;
          proposed_slug: string;
          reason: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          semester: string;
          status: string;
          supporting_info: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          academic_year: string;
          applicant_id: string;
          course_name: string;
          created_at?: string;
          created_class_id?: string | null;
          decision_note?: string | null;
          description: string;
          id?: string;
          institution?: string | null;
          lecturer_name?: string | null;
          proposed_class_code?: string | null;
          proposed_name: string;
          proposed_slug: string;
          reason: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          semester: string;
          status?: string;
          supporting_info?: string | null;
          updated_at?: string;
        };
        Update: {
          academic_year?: string;
          applicant_id?: string;
          course_name?: string;
          created_at?: string;
          created_class_id?: string | null;
          decision_note?: string | null;
          description?: string;
          id?: string;
          institution?: string | null;
          lecturer_name?: string | null;
          proposed_class_code?: string | null;
          proposed_name?: string;
          proposed_slug?: string;
          reason?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          semester?: string;
          status?: string;
          supporting_info?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_applications_created_class_id_fkey";
            columns: ["created_class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      class_calendar_events: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          ends_at: string;
          event_type: string;
          id: string;
          location: string | null;
          starts_at: string;
          status: string;
          subject_id: string | null;
          time_zone: string;
          title: string;
          updated_at: string;
          visibility: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at: string;
          event_type: string;
          id?: string;
          location?: string | null;
          starts_at: string;
          status?: string;
          subject_id?: string | null;
          time_zone?: string;
          title: string;
          updated_at?: string;
          visibility?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string;
          event_type?: string;
          id?: string;
          location?: string | null;
          starts_at?: string;
          status?: string;
          subject_id?: string | null;
          time_zone?: string;
          title?: string;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_calendar_events_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_calendar_events_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "class_subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      class_course_schedules: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string | null;
          day_of_week: number;
          end_date: string | null;
          end_time: string;
          id: string;
          lecturer_name: string | null;
          period: string | null;
          room: string | null;
          start_date: string | null;
          start_time: string;
          subject_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          day_of_week: number;
          end_date?: string | null;
          end_time: string;
          id?: string;
          lecturer_name?: string | null;
          period?: string | null;
          room?: string | null;
          start_date?: string | null;
          start_time: string;
          subject_id: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          day_of_week?: number;
          end_date?: string | null;
          end_time?: string;
          id?: string;
          lecturer_name?: string | null;
          period?: string | null;
          room?: string | null;
          start_date?: string | null;
          start_time?: string;
          subject_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_course_schedules_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_course_schedules_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "class_subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      class_invitation_acceptances: {
        Row: {
          accepted_at: string;
          id: string;
          invitation_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string;
          id?: string;
          invitation_id: string;
          user_id: string;
        };
        Update: {
          accepted_at?: string;
          id?: string;
          invitation_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_invitation_acceptances_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "class_invitations";
            referencedColumns: ["id"];
          },
        ];
      };
      class_invitation_declines: {
        Row: {
          declined_at: string;
          id: string;
          invitation_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          declined_at?: string;
          id?: string;
          invitation_id: string;
          user_id: string;
        };
        Update: {
          declined_at?: string;
          id?: string;
          invitation_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_invitation_declines_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "class_invitations";
            referencedColumns: ["id"];
          },
        ];
      };
      class_invitations: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string;
          email_restriction: string | null;
          expires_at: string;
          id: string;
          max_uses: number;
          revoked_at: string | null;
          revoked_by: string | null;
          token_hash: string;
          used_count: number;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          created_by: string;
          email_restriction?: string | null;
          expires_at: string;
          id?: string;
          max_uses?: number;
          revoked_at?: string | null;
          revoked_by?: string | null;
          token_hash: string;
          used_count?: number;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string;
          email_restriction?: string | null;
          expires_at?: string;
          id?: string;
          max_uses?: number;
          revoked_at?: string | null;
          revoked_by?: string | null;
          token_hash?: string;
          used_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "class_invitations_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      class_members: {
        Row: {
          class_id: string;
          joined_at: string;
          joined_via: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          joined_at?: string;
          joined_via?: string;
          user_id: string;
        };
        Update: {
          class_id?: string;
          joined_at?: string;
          joined_via?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      class_memberships: {
        Row: {
          class_id: string;
          created_at: string;
          id: string;
          is_home: boolean;
          joined_at: string;
          joined_via: string;
          left_at: string | null;
          student_identity_id: string;
          transferred_from_class_id: string | null;
          university_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          id?: string;
          is_home?: boolean;
          joined_at?: string;
          joined_via?: string;
          left_at?: string | null;
          student_identity_id: string;
          transferred_from_class_id?: string | null;
          university_id: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          id?: string;
          is_home?: boolean;
          joined_at?: string;
          joined_via?: string;
          left_at?: string | null;
          student_identity_id?: string;
          transferred_from_class_id?: string | null;
          university_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_memberships_class_same_university";
            columns: ["class_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "class_memberships_identity_same_university";
            columns: ["student_identity_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "student_identities";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "class_memberships_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      class_subjects: {
        Row: {
          class_id: string;
          code: string | null;
          course_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          lecturer_name: string | null;
          name: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          code?: string | null;
          course_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          lecturer_name?: string | null;
          name: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          code?: string | null;
          course_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          lecturer_name?: string | null;
          name?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_subjects_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      class_verification_evidence: {
        Row: {
          created_at: string;
          file_size: number;
          id: string;
          mime_type: string;
          original_filename: string;
          removed_at: string | null;
          removed_by: string | null;
          request_id: string;
          storage_path: string;
          uploaded_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          file_size: number;
          id?: string;
          mime_type: string;
          original_filename: string;
          removed_at?: string | null;
          removed_by?: string | null;
          request_id: string;
          storage_path: string;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          file_size?: number;
          id?: string;
          mime_type?: string;
          original_filename?: string;
          removed_at?: string | null;
          removed_by?: string | null;
          request_id?: string;
          storage_path?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "class_verification_evidence_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "class_verification_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      class_verification_requests: {
        Row: {
          class_id: string;
          created_at: string;
          declared_position: string;
          id: string;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          revision_count: number;
          statement: string | null;
          status: string;
          student_id: string;
          submitted_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          declared_position?: string;
          id?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          revision_count?: number;
          statement?: string | null;
          status?: string;
          student_id: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          declared_position?: string;
          id?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          revision_count?: number;
          statement?: string | null;
          status?: string;
          student_id?: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_verification_requests_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      class_verification_reviews: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          id: string;
          metadata: NonNullable<Json>;
          new_status: string | null;
          note: string | null;
          previous_status: string | null;
          request_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          new_status?: string | null;
          note?: string | null;
          previous_status?: string | null;
          request_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          new_status?: string | null;
          note?: string | null;
          previous_status?: string | null;
          request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_verification_reviews_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "class_verification_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: {
          academic_unit_id: string | null;
          academic_year: string;
          academic_year_id: string | null;
          archived_at: string | null;
          archived_by: string | null;
          avatar_url: string | null;
          class_code: string | null;
          class_code_normalized: string | null;
          code: string | null;
          course_id: string;
          course_name: string;
          cover_url: string | null;
          created_at: string;
          created_by: string | null;
          description: string;
          entry_year: number | null;
          id: string;
          institution: string | null;
          institution_normalized: string | null;
          join_policy: string;
          lecturer_name: string | null;
          name: string;
          semester: string;
          semester_id: string | null;
          slug: string;
          status: string;
          university_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          academic_unit_id?: string | null;
          academic_year: string;
          academic_year_id?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          avatar_url?: string | null;
          class_code?: string | null;
          class_code_normalized?: never;
          code?: string | null;
          course_id: string;
          course_name: string;
          cover_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          description: string;
          entry_year?: number | null;
          id?: string;
          institution?: string | null;
          institution_normalized?: never;
          join_policy?: string;
          lecturer_name?: string | null;
          name: string;
          semester: string;
          semester_id?: string | null;
          slug: string;
          status?: string;
          university_id?: string | null;
          updated_at?: string;
        };
        Update: {
          academic_unit_id?: string | null;
          academic_year?: string;
          academic_year_id?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          avatar_url?: string | null;
          class_code?: string | null;
          class_code_normalized?: never;
          code?: string | null;
          course_id?: string;
          course_name?: string;
          cover_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          entry_year?: number | null;
          id?: string;
          institution?: string | null;
          institution_normalized?: never;
          join_policy?: string;
          lecturer_name?: string | null;
          name?: string;
          semester?: string;
          semester_id?: string | null;
          slug?: string;
          status?: string;
          university_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classes_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_semester_same_university";
            columns: ["semester_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "semesters";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "classes_unit_same_university";
            columns: ["academic_unit_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "academic_units";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "classes_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_year_same_university";
            columns: ["academic_year_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id", "university_id"];
          },
        ];
      };
      course_invite_acceptances: {
        Row: {
          enrollment_id: string | null;
          id: string;
          redeemed_at: string;
          redeemed_by: string;
          token_id: string;
          university_id: string;
        };
        ComputedFields: never;
        Insert: {
          enrollment_id?: string | null;
          id?: string;
          redeemed_at?: string;
          redeemed_by: string;
          token_id: string;
          university_id: string;
        };
        Update: {
          enrollment_id?: string | null;
          id?: string;
          redeemed_at?: string;
          redeemed_by?: string;
          token_id?: string;
          university_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "course_invite_acceptances_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_invite_acceptances_redeemed_by_fkey";
            columns: ["redeemed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_invite_acceptances_token_id_fkey";
            columns: ["token_id"];
            isOneToOne: false;
            referencedRelation: "course_invite_tokens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_invite_acceptances_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      course_invite_tokens: {
        Row: {
          created_at: string;
          created_by: string;
          expires_at: string | null;
          id: string;
          max_uses: number | null;
          offering_id: string;
          revoked_at: string | null;
          revoked_by: string | null;
          status: string;
          token_hash: string;
          university_id: string;
          use_count: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          expires_at?: string | null;
          id?: string;
          max_uses?: number | null;
          offering_id: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          status?: string;
          token_hash: string;
          university_id: string;
          use_count?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          expires_at?: string | null;
          id?: string;
          max_uses?: number | null;
          offering_id?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          status?: string;
          token_hash?: string;
          university_id?: string;
          use_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "course_invite_tokens_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_invite_tokens_offering_same_university";
            columns: ["offering_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "course_offerings";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "course_invite_tokens_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_invite_tokens_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      course_materials: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          kind: string;
          offering_id: string | null;
          resource_url: string | null;
          subject_id: string;
          title: string;
          university_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          kind?: string;
          offering_id?: string | null;
          resource_url?: string | null;
          subject_id: string;
          title: string;
          university_id?: string | null;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          kind?: string;
          offering_id?: string | null;
          resource_url?: string | null;
          subject_id?: string;
          title?: string;
          university_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "course_materials_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_materials_offering_same_university";
            columns: ["offering_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "course_offerings";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "course_materials_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "class_subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_materials_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      course_offerings: {
        Row: {
          academic_year_id: string | null;
          class_id: string;
          course_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          lecturer_name: string | null;
          semester_id: string | null;
          status: string;
          university_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          academic_year_id?: string | null;
          class_id: string;
          course_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          lecturer_name?: string | null;
          semester_id?: string | null;
          status?: string;
          university_id: string;
          updated_at?: string;
        };
        Update: {
          academic_year_id?: string | null;
          class_id?: string;
          course_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          lecturer_name?: string | null;
          semester_id?: string | null;
          status?: string;
          university_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "course_offerings_class_same_university";
            columns: ["class_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "course_offerings_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_offerings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_offerings_semester_same_university";
            columns: ["semester_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "semesters";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "course_offerings_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_offerings_year_same_university";
            columns: ["academic_year_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id", "university_id"];
          },
        ];
      };
      courses: {
        Row: {
          code: string | null;
          created_at: string;
          department: string | null;
          id: string;
          name: string;
          normalized_code: string | null;
          normalized_name: string | null;
          university_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          code?: string | null;
          created_at?: string;
          department?: string | null;
          id?: string;
          name: string;
          normalized_code?: never;
          normalized_name?: never;
          university_id?: string | null;
        };
        Update: {
          code?: string | null;
          created_at?: string;
          department?: string | null;
          id?: string;
          name?: string;
          normalized_code?: never;
          normalized_name?: never;
          university_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "courses_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      developer_incident_notes: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          id: number;
          incident_id: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: number;
          incident_id: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: number;
          incident_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "developer_incident_notes_incident_id_fkey";
            columns: ["incident_id"];
            isOneToOne: false;
            referencedRelation: "developer_incidents";
            referencedColumns: ["id"];
          },
        ];
      };
      developer_incidents: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          resolved_at: string | null;
          severity: string;
          status: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          resolved_at?: string | null;
          severity?: string;
          status?: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          resolved_at?: string | null;
          severity?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      discussion_session_checkins: {
        Row: {
          accuracy_m: number | null;
          checked_in_at: string;
          coordinates_purged_at: string | null;
          created_at: string;
          distance_m: number | null;
          id: string;
          identity_verified: boolean;
          identity_verified_at: string | null;
          latitude: number | null;
          longitude: number | null;
          method: string;
          note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          session_id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          accuracy_m?: number | null;
          checked_in_at?: string;
          coordinates_purged_at?: string | null;
          created_at?: string;
          distance_m?: number | null;
          id?: string;
          identity_verified?: boolean;
          identity_verified_at?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          method?: string;
          note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          session_id: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          accuracy_m?: number | null;
          checked_in_at?: string;
          coordinates_purged_at?: string | null;
          created_at?: string;
          distance_m?: number | null;
          id?: string;
          identity_verified?: boolean;
          identity_verified_at?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          method?: string;
          note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          session_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discussion_session_checkins_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "discussion_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      discussion_session_reminders: {
        Row: {
          attempt_count: number;
          created_at: string;
          delivered_at: string | null;
          id: string;
          last_error_category: string | null;
          next_attempt_at: string;
          reminder_type: string;
          scheduled_for: string;
          session_id: string;
          starts_at: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          attempt_count?: number;
          created_at?: string;
          delivered_at?: string | null;
          id?: string;
          last_error_category?: string | null;
          next_attempt_at?: string;
          reminder_type: string;
          scheduled_for: string;
          session_id: string;
          starts_at: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          attempt_count?: number;
          created_at?: string;
          delivered_at?: string | null;
          id?: string;
          last_error_category?: string | null;
          next_attempt_at?: string;
          reminder_type?: string;
          scheduled_for?: string;
          session_id?: string;
          starts_at?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discussion_session_reminders_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "discussion_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      discussion_session_rsvps: {
        Row: {
          created_at: string;
          id: string;
          session_id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          session_id: string;
          status: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          session_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discussion_session_rsvps_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "discussion_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      discussion_sessions: {
        Row: {
          agenda: string | null;
          assignment_id: string | null;
          attendance_closed_at: string | null;
          attendance_closes_at: string | null;
          attendance_finalized_at: string | null;
          attendance_opened_at: string | null;
          attendance_opens_at: string | null;
          cancelled_at: string | null;
          capacity: number | null;
          checkin_latitude: number | null;
          checkin_longitude: number | null;
          checkin_radius_m: number;
          class_id: string;
          completed_at: string | null;
          created_at: string;
          description: string;
          ends_at: string;
          id: string;
          late_after_minutes: number;
          location: string | null;
          meeting_date: string | null;
          meeting_number: number | null;
          meeting_url: string | null;
          organizer_id: string;
          registration_deadline: string | null;
          session_type: string;
          starts_at: string;
          status: string;
          subject_id: string | null;
          time_zone: string;
          title: string;
          updated_at: string;
          visibility: string;
        };
        ComputedFields: never;
        Insert: {
          agenda?: string | null;
          assignment_id?: string | null;
          attendance_closed_at?: string | null;
          attendance_closes_at?: string | null;
          attendance_finalized_at?: string | null;
          attendance_opened_at?: string | null;
          attendance_opens_at?: string | null;
          cancelled_at?: string | null;
          capacity?: number | null;
          checkin_latitude?: number | null;
          checkin_longitude?: number | null;
          checkin_radius_m?: number;
          class_id: string;
          completed_at?: string | null;
          created_at?: string;
          description: string;
          ends_at: string;
          id?: string;
          late_after_minutes?: number;
          location?: string | null;
          meeting_date?: string | null;
          meeting_number?: number | null;
          meeting_url?: string | null;
          organizer_id: string;
          registration_deadline?: string | null;
          session_type?: string;
          starts_at: string;
          status?: string;
          subject_id?: string | null;
          time_zone?: string;
          title: string;
          updated_at?: string;
          visibility?: string;
        };
        Update: {
          agenda?: string | null;
          assignment_id?: string | null;
          attendance_closed_at?: string | null;
          attendance_closes_at?: string | null;
          attendance_finalized_at?: string | null;
          attendance_opened_at?: string | null;
          attendance_opens_at?: string | null;
          cancelled_at?: string | null;
          capacity?: number | null;
          checkin_latitude?: number | null;
          checkin_longitude?: number | null;
          checkin_radius_m?: number;
          class_id?: string;
          completed_at?: string | null;
          created_at?: string;
          description?: string;
          ends_at?: string;
          id?: string;
          late_after_minutes?: number;
          location?: string | null;
          meeting_date?: string | null;
          meeting_number?: number | null;
          meeting_url?: string | null;
          organizer_id?: string;
          registration_deadline?: string | null;
          session_type?: string;
          starts_at?: string;
          status?: string;
          subject_id?: string | null;
          time_zone?: string;
          title?: string;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discussion_sessions_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discussion_sessions_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discussion_sessions_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "class_subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      discussion_threads: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string;
          id: string;
          offering_id: string | null;
          scope: string;
          title: string;
          university_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          offering_id?: string | null;
          scope: string;
          title: string;
          university_id: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          offering_id?: string | null;
          scope?: string;
          title?: string;
          university_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discussion_threads_class_same_university";
            columns: ["class_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "discussion_threads_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discussion_threads_offering_same_university";
            columns: ["offering_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "course_offerings";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "discussion_threads_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      enrollments: {
        Row: {
          created_at: string;
          created_by: string | null;
          dropped_at: string | null;
          enrolled_at: string;
          id: string;
          offering_id: string;
          source: string;
          status: string;
          student_identity_id: string;
          university_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          dropped_at?: string | null;
          enrolled_at?: string;
          id?: string;
          offering_id: string;
          source?: string;
          status?: string;
          student_identity_id: string;
          university_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          dropped_at?: string | null;
          enrolled_at?: string;
          id?: string;
          offering_id?: string;
          source?: string;
          status?: string;
          student_identity_id?: string;
          university_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enrollments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_identity_same_university";
            columns: ["student_identity_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "student_identities";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "enrollments_offering_same_university";
            columns: ["offering_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "course_offerings";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "enrollments_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      feedback_entries: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          message: string;
          page_path: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          created_at?: string;
          id?: string;
          message: string;
          page_path?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          message?: string;
          page_path?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      google_calendar_connections: {
        Row: {
          access_token_ciphertext: string;
          calendar_id: string;
          connected_at: string;
          last_error_category: string | null;
          last_refreshed_at: string | null;
          refresh_token_ciphertext: string | null;
          scope: string;
          status: string;
          token_expires_at: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          access_token_ciphertext: string;
          calendar_id?: string;
          connected_at?: string;
          last_error_category?: string | null;
          last_refreshed_at?: string | null;
          refresh_token_ciphertext?: string | null;
          scope: string;
          status?: string;
          token_expires_at: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_token_ciphertext?: string;
          calendar_id?: string;
          connected_at?: string;
          last_error_category?: string | null;
          last_refreshed_at?: string | null;
          refresh_token_ciphertext?: string | null;
          scope?: string;
          status?: string;
          token_expires_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      google_calendar_event_mappings: {
        Row: {
          attempt_count: number;
          calendar_id: string;
          created_at: string;
          google_event_id: string | null;
          id: string;
          last_error_category: string | null;
          last_synced_at: string | null;
          next_attempt_at: string;
          session_id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          attempt_count?: number;
          calendar_id?: string;
          created_at?: string;
          google_event_id?: string | null;
          id?: string;
          last_error_category?: string | null;
          last_synced_at?: string | null;
          next_attempt_at?: string;
          session_id: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          attempt_count?: number;
          calendar_id?: string;
          created_at?: string;
          google_event_id?: string | null;
          id?: string;
          last_error_category?: string | null;
          last_synced_at?: string | null;
          next_attempt_at?: string;
          session_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "google_calendar_event_mappings_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "discussion_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      grade_batches: {
        Row: {
          created_at: string;
          id: string;
          offering_id: string;
          published_at: string | null;
          source_file_hash: string;
          status: string;
          university_id: string;
          uploaded_by: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          offering_id: string;
          published_at?: string | null;
          source_file_hash: string;
          status?: string;
          university_id: string;
          uploaded_by: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          offering_id?: string;
          published_at?: string | null;
          source_file_hash?: string;
          status?: string;
          university_id?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "grade_batches_offering_same_university";
            columns: ["offering_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "course_offerings";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "grade_batches_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grade_batches_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      grade_entries: {
        Row: {
          batch_id: string;
          component: string;
          id: string;
          max_score: number;
          published: boolean;
          published_at: string | null;
          score: number;
          student_identity_id: string;
          university_id: string;
        };
        ComputedFields: never;
        Insert: {
          batch_id: string;
          component: string;
          id?: string;
          max_score: number;
          published?: boolean;
          published_at?: string | null;
          score: number;
          student_identity_id: string;
          university_id: string;
        };
        Update: {
          batch_id?: string;
          component?: string;
          id?: string;
          max_score?: number;
          published?: boolean;
          published_at?: string | null;
          score?: number;
          student_identity_id?: string;
          university_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "grade_entries_batch_same_university";
            columns: ["batch_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "grade_batches";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "grade_entries_identity_same_university";
            columns: ["student_identity_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "student_identities";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "grade_entries_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      grade_history: {
        Row: {
          changed_at: string;
          changed_by: string;
          entry_id: string;
          id: string;
          new_score: number;
          old_score: number;
          reason: string | null;
          university_id: string;
        };
        ComputedFields: never;
        Insert: {
          changed_at?: string;
          changed_by: string;
          entry_id: string;
          id?: string;
          new_score: number;
          old_score: number;
          reason?: string | null;
          university_id: string;
        };
        Update: {
          changed_at?: string;
          changed_by?: string;
          entry_id?: string;
          id?: string;
          new_score?: number;
          old_score?: number;
          reason?: string | null;
          university_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "grade_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grade_history_entry_same_university";
            columns: ["entry_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "grade_entries";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "grade_history_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_lecturer_outcomes: {
        Row: {
          created_at: string;
          id: string;
          note: string | null;
          outcome: string;
          recorded_by: string;
          request_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          note?: string | null;
          outcome: string;
          recorded_by: string;
          request_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string | null;
          outcome?: string;
          recorded_by?: string;
          request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leave_lecturer_outcomes_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "leave_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_request_evidence: {
        Row: {
          created_at: string;
          file_size: number;
          id: string;
          mime_type: string;
          original_filename: string;
          removed_at: string | null;
          removed_by: string | null;
          request_id: string;
          sort_order: number;
          storage_path: string;
          uploaded_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          file_size: number;
          id?: string;
          mime_type: string;
          original_filename: string;
          removed_at?: string | null;
          removed_by?: string | null;
          request_id: string;
          sort_order?: number;
          storage_path: string;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          file_size?: number;
          id?: string;
          mime_type?: string;
          original_filename?: string;
          removed_at?: string | null;
          removed_by?: string | null;
          request_id?: string;
          sort_order?: number;
          storage_path?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leave_request_evidence_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "leave_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_request_forwarding_items: {
        Row: {
          forwarding_id: string;
          leave_end_date: string;
          leave_start_date: string;
          request_id: string;
          student_display_name: string;
        };
        ComputedFields: never;
        Insert: {
          forwarding_id: string;
          leave_end_date: string;
          leave_start_date: string;
          request_id: string;
          student_display_name: string;
        };
        Update: {
          forwarding_id?: string;
          leave_end_date?: string;
          leave_start_date?: string;
          request_id?: string;
          student_display_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leave_request_forwarding_items_forwarding_id_fkey";
            columns: ["forwarding_id"];
            isOneToOne: false;
            referencedRelation: "leave_request_forwardings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_request_forwarding_items_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: true;
            referencedRelation: "leave_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_request_forwardings: {
        Row: {
          class_id: string;
          created_at: string;
          forwarded_by: string | null;
          id: string;
          idempotency_key: string;
          recipient_email: string | null;
          recipient_name: string;
          reference: string;
          report_format: string;
          report_reference: string;
          request_count: number;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          forwarded_by?: string | null;
          id?: string;
          idempotency_key: string;
          recipient_email?: string | null;
          recipient_name: string;
          reference?: string;
          report_format: string;
          report_reference: string;
          request_count: number;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          forwarded_by?: string | null;
          id?: string;
          idempotency_key?: string;
          recipient_email?: string | null;
          recipient_name?: string;
          reference?: string;
          report_format?: string;
          report_reference?: string;
          request_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "leave_request_forwardings_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_request_history: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          id: string;
          metadata: NonNullable<Json>;
          next_status: string | null;
          note: string | null;
          previous_status: string | null;
          request_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          next_status?: string | null;
          note?: string | null;
          previous_status?: string | null;
          request_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          next_status?: string | null;
          note?: string | null;
          previous_status?: string | null;
          request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leave_request_history_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "leave_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_requests: {
        Row: {
          cancellation_note: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          class_id: string;
          created_at: string;
          document_issue_date: string | null;
          explanation: string | null;
          field_sources: NonNullable<Json>;
          forwarded_at: string | null;
          id: string;
          leave_end_date: string | null;
          leave_start_date: string | null;
          ocr_confirmed_at: string | null;
          ocr_extracted_at: string | null;
          ocr_provider: string | null;
          ocr_result: Json | null;
          ocr_status: string;
          reason_category: string | null;
          reference: string;
          status: string;
          student_id: string;
          subject_ids: string[];
          submitted_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cancellation_note?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          class_id: string;
          created_at?: string;
          document_issue_date?: string | null;
          explanation?: string | null;
          field_sources?: NonNullable<Json>;
          forwarded_at?: string | null;
          id?: string;
          leave_end_date?: string | null;
          leave_start_date?: string | null;
          ocr_confirmed_at?: string | null;
          ocr_extracted_at?: string | null;
          ocr_provider?: string | null;
          ocr_result?: Json | null;
          ocr_status?: string;
          reason_category?: string | null;
          reference?: string;
          status?: string;
          student_id: string;
          subject_ids?: string[];
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          cancellation_note?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          class_id?: string;
          created_at?: string;
          document_issue_date?: string | null;
          explanation?: string | null;
          field_sources?: NonNullable<Json>;
          forwarded_at?: string | null;
          id?: string;
          leave_end_date?: string | null;
          leave_start_date?: string | null;
          ocr_confirmed_at?: string | null;
          ocr_extracted_at?: string | null;
          ocr_provider?: string | null;
          ocr_result?: Json | null;
          ocr_status?: string;
          reason_category?: string | null;
          reference?: string;
          status?: string;
          student_id?: string;
          subject_ids?: string[];
          submitted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leave_requests_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_deliveries: {
        Row: {
          assignment_id: string;
          attempt_count: number;
          created_at: string;
          deadline_at: string;
          delivered_at: string | null;
          id: string;
          last_error_category: string | null;
          next_attempt_at: string;
          reminder_type: string;
          scheduled_for: string;
          status: string;
          university_id: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          attempt_count?: number;
          created_at?: string;
          deadline_at: string;
          delivered_at?: string | null;
          id?: string;
          last_error_category?: string | null;
          next_attempt_at?: string;
          reminder_type: string;
          scheduled_for: string;
          status?: string;
          university_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          assignment_id?: string;
          attempt_count?: number;
          created_at?: string;
          deadline_at?: string;
          delivered_at?: string | null;
          id?: string;
          last_error_category?: string | null;
          next_attempt_at?: string;
          reminder_type?: string;
          scheduled_for?: string;
          status?: string;
          university_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_deliveries_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_events: {
        Row: {
          attempt_count: number;
          created_at: string;
          dedupe_key: string;
          id: string;
          kind: string;
          last_error_category: string | null;
          next_attempt_at: string;
          payload: NonNullable<Json>;
          read_at: string | null;
          sent_at: string | null;
          status: string;
          university_id: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          attempt_count?: number;
          created_at?: string;
          dedupe_key: string;
          id?: string;
          kind: string;
          last_error_category?: string | null;
          next_attempt_at?: string;
          payload?: NonNullable<Json>;
          read_at?: string | null;
          sent_at?: string | null;
          status?: string;
          university_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          attempt_count?: number;
          created_at?: string;
          dedupe_key?: string;
          id?: string;
          kind?: string;
          last_error_category?: string | null;
          next_attempt_at?: string;
          payload?: NonNullable<Json>;
          read_at?: string | null;
          sent_at?: string | null;
          status?: string;
          university_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_events_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          created_at: string;
          push_enabled: boolean;
          reminder_24h: boolean;
          reminder_3h: boolean;
          session_reminder_24h: boolean;
          session_reminder_3h: boolean;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          push_enabled?: boolean;
          reminder_24h?: boolean;
          reminder_3h?: boolean;
          session_reminder_24h?: boolean;
          session_reminder_3h?: boolean;
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          push_enabled?: boolean;
          reminder_24h?: boolean;
          reminder_3h?: boolean;
          session_reminder_24h?: boolean;
          session_reminder_3h?: boolean;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      personal_calendar_events: {
        Row: {
          created_at: string;
          description: string | null;
          ends_at: string;
          id: string;
          location: string | null;
          starts_at: string;
          status: string;
          time_zone: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          ends_at: string;
          id?: string;
          location?: string | null;
          starts_at: string;
          status?: string;
          time_zone?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          ends_at?: string;
          id?: string;
          location?: string | null;
          starts_at?: string;
          status?: string;
          time_zone?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      platform_admins: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          declared_class_name: string | null;
          declared_position: string;
          display_name: string;
          full_name: string | null;
          id: string;
          nim: string | null;
          onboarded_at: string | null;
          university: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          declared_class_name?: string | null;
          declared_position?: string;
          display_name?: string;
          full_name?: string | null;
          id: string;
          nim?: string | null;
          onboarded_at?: string | null;
          university?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          declared_class_name?: string | null;
          declared_position?: string;
          display_name?: string;
          full_name?: string | null;
          id?: string;
          nim?: string | null;
          onboarded_at?: string | null;
          university?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          device_label: string | null;
          disabled_at: string | null;
          endpoint: string;
          id: string;
          last_success_at: string | null;
          p256dh: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth: string;
          created_at?: string;
          device_label?: string | null;
          disabled_at?: string | null;
          endpoint: string;
          id?: string;
          last_success_at?: string | null;
          p256dh: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          device_label?: string | null;
          disabled_at?: string | null;
          endpoint?: string;
          id?: string;
          last_success_at?: string | null;
          p256dh?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          hits: number;
          key: string;
          window_started_at: string;
        };
        ComputedFields: never;
        Insert: {
          hits?: number;
          key: string;
          window_started_at?: string;
        };
        Update: {
          hits?: number;
          key?: string;
          window_started_at?: string;
        };
        Relationships: [];
      };
      saved_assignments: {
        Row: {
          assignment_id: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          assignment_id?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_assignments_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      schedule_exceptions: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          instance_id: string;
          kind: string;
          note: string | null;
          university_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          instance_id: string;
          kind: string;
          note?: string | null;
          university_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          instance_id?: string;
          kind?: string;
          note?: string | null;
          university_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "schedule_exceptions_instance_same_university";
            columns: ["instance_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "schedule_instances";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "schedule_exceptions_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      schedule_instances: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          instance_date: string;
          rule_id: string;
          starts_at: string;
          status: string;
          university_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          instance_date: string;
          rule_id: string;
          starts_at: string;
          status?: string;
          university_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          instance_date?: string;
          rule_id?: string;
          starts_at?: string;
          status?: string;
          university_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "schedule_instances_rule_same_university";
            columns: ["rule_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "schedule_rules";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "schedule_instances_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      schedule_rules: {
        Row: {
          created_at: string;
          created_by: string | null;
          effective_from: string | null;
          effective_to: string | null;
          end_time: string;
          id: string;
          offering_id: string;
          room: string | null;
          start_time: string;
          timezone: string;
          university_id: string;
          updated_at: string;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          effective_from?: string | null;
          effective_to?: string | null;
          end_time: string;
          id?: string;
          offering_id: string;
          room?: string | null;
          start_time: string;
          timezone: string;
          university_id: string;
          updated_at?: string;
          weekday: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          effective_from?: string | null;
          effective_to?: string | null;
          end_time?: string;
          id?: string;
          offering_id?: string;
          room?: string | null;
          start_time?: string;
          timezone?: string;
          university_id?: string;
          updated_at?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "schedule_rules_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "schedule_rules_offering_same_university";
            columns: ["offering_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "course_offerings";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "schedule_rules_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      semesters: {
        Row: {
          academic_year_id: string;
          code: string;
          created_at: string;
          created_by: string | null;
          end_date: string | null;
          id: string;
          name: string;
          sequence_no: number;
          start_date: string | null;
          status: string;
          university_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          academic_year_id: string;
          code: string;
          created_at?: string;
          created_by?: string | null;
          end_date?: string | null;
          id?: string;
          name: string;
          sequence_no?: number;
          start_date?: string | null;
          status?: string;
          university_id: string;
          updated_at?: string;
        };
        Update: {
          academic_year_id?: string;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          end_date?: string | null;
          id?: string;
          name?: string;
          sequence_no?: number;
          start_date?: string | null;
          status?: string;
          university_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "semesters_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "semesters_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "semesters_year_same_university";
            columns: ["academic_year_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id", "university_id"];
          },
        ];
      };
      student_identities: {
        Row: {
          academic_unit_id: string | null;
          created_at: string;
          created_by: string | null;
          entry_year: number | null;
          graduated_at: string | null;
          id: string;
          started_at: string | null;
          status: string;
          student_id: string;
          university_id: string;
          university_membership_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          academic_unit_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          entry_year?: number | null;
          graduated_at?: string | null;
          id?: string;
          started_at?: string | null;
          status?: string;
          student_id: string;
          university_id: string;
          university_membership_id: string;
          updated_at?: string;
        };
        Update: {
          academic_unit_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          entry_year?: number | null;
          graduated_at?: string | null;
          id?: string;
          started_at?: string | null;
          status?: string;
          student_id?: string;
          university_id?: string;
          university_membership_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_identities_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_identities_membership_same_university";
            columns: ["university_membership_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "university_memberships";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "student_identities_unit_same_university";
            columns: ["academic_unit_id", "university_id"];
            isOneToOne: false;
            referencedRelation: "academic_units";
            referencedColumns: ["id", "university_id"];
          },
          {
            foreignKeyName: "student_identities_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_identities_university_membership_id_fkey";
            columns: ["university_membership_id"];
            isOneToOne: true;
            referencedRelation: "university_memberships";
            referencedColumns: ["id"];
          },
        ];
      };
      universities: {
        Row: {
          activated_at: string | null;
          city: string | null;
          code: string | null;
          country: string | null;
          created_at: string;
          created_by: string | null;
          deactivated_at: string | null;
          id: string;
          locale: string | null;
          logo_url: string | null;
          name: string;
          province: string | null;
          short_name: string | null;
          slug: string;
          status: string;
          timezone: string | null;
          type: string | null;
          updated_at: string;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          activated_at?: string | null;
          city?: string | null;
          code?: string | null;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          deactivated_at?: string | null;
          id?: string;
          locale?: string | null;
          logo_url?: string | null;
          name: string;
          province?: string | null;
          short_name?: string | null;
          slug: string;
          status?: string;
          timezone?: string | null;
          type?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          activated_at?: string | null;
          city?: string | null;
          code?: string | null;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          deactivated_at?: string | null;
          id?: string;
          locale?: string | null;
          logo_url?: string | null;
          name?: string;
          province?: string | null;
          short_name?: string | null;
          slug?: string;
          status?: string;
          timezone?: string | null;
          type?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "universities_created_by_fk";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      university_memberships: {
        Row: {
          created_at: string;
          entry_year: number | null;
          id: string;
          role: string;
          status: string;
          student_id: string | null;
          university_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          entry_year?: number | null;
          id?: string;
          role?: string;
          status?: string;
          student_id?: string | null;
          university_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          entry_year?: number | null;
          id?: string;
          role?: string;
          status?: string;
          student_id?: string | null;
          university_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "university_memberships_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_class_invitation: { Args: { p_token: string }; Returns: string };
      accept_pending_invitation: {
        Args: { p_invitation_id: string };
        Returns: string;
      };
      add_class_verification_evidence: {
        Args: {
          p_file_size: number;
          p_mime_type: string;
          p_original_filename: string;
          p_request_id: string;
          p_storage_path: string;
        };
        Returns: string;
      };
      add_leave_request_evidence: {
        Args: {
          p_file_size: number;
          p_mime_type: string;
          p_original_filename: string;
          p_request_id: string;
          p_storage_path: string;
        };
        Returns: string;
      };
      apply_for_class: {
        Args: {
          p_academic_year: string;
          p_course_name: string;
          p_description: string;
          p_institution?: string;
          p_lecturer_name?: string;
          p_proposed_class_code?: string;
          p_proposed_name: string;
          p_proposed_slug: string;
          p_reason: string;
          p_semester: string;
          p_supporting_info?: string;
        };
        Returns: string;
      };
      assign_class_admin: {
        Args: { p_class_id: string; p_user_id: string };
        Returns: boolean;
      };
      assignment_id_from_object_path: {
        Args: { object_name: string };
        Returns: string;
      };
      attendance_correction_audit_list: {
        Args: { p_class_id: string; p_subject_id?: string };
        Returns: {
          admin_name: string;
          created_at: string;
          id: string;
          meeting_date: string;
          meeting_number: number;
          new_status: string;
          physically_verified: boolean;
          previous_status: string;
          reason: string;
          session_id: string;
          student_id: string;
          student_name: string;
          student_nim: string;
          subject_id: string;
          subject_name: string;
          verification_method: string;
        }[];
      };
      attendance_meeting_failures: {
        Args: { p_session_id: string };
        Returns: {
          accuracy_m: number;
          created_at: string;
          display_name: string;
          distance_m: number;
          outcome: string;
          user_id: string;
        }[];
      };
      attendance_meeting_roster: {
        Args: { p_session_id: string };
        Returns: {
          accuracy_m: number;
          checked_in_at: string;
          display_name: string;
          distance_m: number;
          eligible: boolean;
          full_name: string;
          identity_verified: boolean;
          joined_at: string;
          method: string;
          nim: string;
          note: string;
          reviewed_at: string;
          status: string;
          user_id: string;
        }[];
      };
      attendance_normalize_identity: {
        Args: { p_value: string };
        Returns: string;
      };
      become_class_representative: {
        Args: { p_class_id: string };
        Returns: string;
      };
      begin_class_verification: {
        Args: { p_class_id: string; p_statement?: string };
        Returns: string;
      };
      can_edit_class_verification: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      can_manage_class: { Args: { p_class_id: string }; Returns: boolean };
      can_organize_class_sessions: {
        Args: { p_class_id: string };
        Returns: boolean;
      };
      can_publish_public_assignment: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      can_review_leave_request: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      can_view_class_verification: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      can_view_leave_request: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      can_view_session: { Args: { p_session_id: string }; Returns: boolean };
      cancel_leave_request: {
        Args: { p_note?: string; p_request_id: string };
        Returns: undefined;
      };
      cancel_session_rsvp: { Args: { p_session_id: string }; Returns: boolean };
      check_in_attendance_meeting:
        | {
            Args: {
              p_accuracy_m: number;
              p_full_name: string;
              p_latitude: number;
              p_longitude: number;
              p_nim: string;
              p_session_id: string;
            };
            Returns: Json;
          }
        | {
            Args: {
              p_accuracy_m: number;
              p_captured_at: string;
              p_full_name: string;
              p_latitude: number;
              p_longitude: number;
              p_nim: string;
              p_session_id: string;
            };
            Returns: Json;
          };
      check_in_discussion_session:
        | {
            Args: {
              p_accuracy_m: number;
              p_latitude: number;
              p_longitude: number;
              p_session_id: string;
            };
            Returns: Json;
          }
        | {
            Args: {
              p_accuracy_m: number;
              p_captured_at: string;
              p_latitude: number;
              p_longitude: number;
              p_session_id: string;
            };
            Returns: Json;
          };
      claim_notification_deliveries: {
        Args: { p_limit?: number; p_now: string };
        Returns: {
          assignment_id: string;
          assignment_status: string;
          assignment_title: string;
          attempt_count: number;
          course_name: string;
          current_deadline: string;
          deadline_at: string;
          id: string;
          pref_timezone: string;
          push_enabled: boolean;
          reminder_24h: boolean;
          reminder_3h: boolean;
          reminder_type: string;
          user_id: string;
        }[];
      };
      claim_notification_events: {
        Args: { p_limit?: number; p_now: string };
        Returns: {
          attempt_count: number;
          id: string;
          kind: string;
          payload: Json;
          user_id: string;
        }[];
      };
      claim_session_reminders: {
        Args: { p_limit?: number; p_now: string };
        Returns: {
          attempt_count: number;
          class_name: string;
          current_starts_at: string;
          id: string;
          pref_timezone: string;
          push_enabled: boolean;
          reminder_24h: boolean;
          reminder_3h: boolean;
          reminder_type: string;
          session_ends_at: string;
          session_id: string;
          session_status: string;
          session_time_zone: string;
          session_title: string;
          starts_at: string;
          user_id: string;
        }[];
      };
      class_attendance_meeting_list: {
        Args: { p_class_id: string };
        Returns: {
          absent_count: number;
          attendance_closed_at: string;
          attendance_closes_at: string;
          attendance_finalized_at: string;
          attendance_opened_at: string;
          attendance_opens_at: string;
          ends_at: string;
          excused_count: number;
          expected_count: number;
          failed_count: number;
          late_after_minutes: number;
          late_count: number;
          location: string;
          meeting_date: string;
          meeting_number: number;
          not_recorded_count: number;
          present_count: number;
          radius_m: number;
          session_id: string;
          sick_count: number;
          starts_at: string;
          subject_code: string;
          subject_id: string;
          subject_name: string;
          title: string;
        }[];
      };
      class_attendance_member_summary: {
        Args: { p_class_id: string };
        Returns: {
          absent_count: number;
          excused_count: number;
          joined_at: string;
          late_count: number;
          pending_count: number;
          present_count: number;
          unrecorded_count: number;
          user_id: string;
        }[];
      };
      class_attendance_recap: {
        Args: { p_class_id: string; p_subject_id: string };
        Returns: {
          attendance_closed_at: string;
          attendance_closes_at: string;
          attendance_finalized_at: string;
          attendance_opened_at: string;
          attendance_opens_at: string;
          eligible: boolean;
          ends_at: string;
          full_name: string;
          joined_at: string;
          location: string;
          meeting_date: string;
          meeting_number: number;
          nim: string;
          session_id: string;
          starts_at: string;
          status: string;
          title: string;
          user_id: string;
        }[];
      };
      class_attendance_roster: {
        Args: { p_class_id: string };
        Returns: {
          display_name: string;
          full_name: string;
          joined_at: string;
          nim: string;
          user_id: string;
        }[];
      };
      class_attendance_session_summary: {
        Args: { p_class_id: string };
        Returns: {
          absent_count: number;
          excused_count: number;
          expected_count: number;
          late_count: number;
          pending_count: number;
          present_count: number;
          session_id: string;
          unrecorded_count: number;
        }[];
      };
      clear_discussion_session_checkin_location: {
        Args: { p_session_id: string };
        Returns: boolean;
      };
      close_attendance_meeting: {
        Args: { p_finalize?: boolean; p_session_id: string };
        Returns: number;
      };
      complete_leave_forwarding: {
        Args: {
          p_class_id: string;
          p_idempotency_key: string;
          p_recipient_email: string;
          p_recipient_name: string;
          p_report_format: string;
          p_report_reference: string;
          p_request_ids: string[];
        };
        Returns: {
          id: string;
          reference: string;
          request_count: number;
        }[];
      };
      complete_notification_delivery: {
        Args: {
          p_error_category?: string;
          p_id: string;
          p_next_attempt_at?: string;
          p_status: string;
        };
        Returns: boolean;
      };
      complete_notification_event: {
        Args: {
          p_error_category?: string;
          p_id: string;
          p_next_attempt_at?: string;
          p_status: string;
        };
        Returns: boolean;
      };
      complete_session_reminder: {
        Args: {
          p_error_category?: string;
          p_id: string;
          p_next_attempt_at?: string;
          p_status: string;
        };
        Returns: boolean;
      };
      confirm_leave_request_ocr: {
        Args: { p_field_sources: Json; p_request_id: string };
        Returns: undefined;
      };
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      create_attendance_meeting: {
        Args: {
          p_class_id: string;
          p_closes_at: string;
          p_ends_at: string;
          p_late_after_minutes?: number;
          p_latitude?: number;
          p_location: string;
          p_longitude?: number;
          p_meeting_date: string;
          p_meeting_number: number;
          p_opens_at: string;
          p_radius_m?: number;
          p_starts_at: string;
          p_subject_id: string;
          p_title?: string;
        };
        Returns: string;
      };
      create_class_invitation: {
        Args: {
          p_class_id: string;
          p_email_restriction?: string;
          p_expires_at: string;
          p_max_uses?: number;
          p_token_hash: string;
        };
        Returns: string;
      };
      create_class_subject: {
        Args: {
          p_class_id: string;
          p_code?: string;
          p_description?: string;
          p_lecturer_name?: string;
          p_name: string;
        };
        Returns: string;
      };
      create_discussion_session: {
        Args: {
          p_agenda?: string;
          p_assignment_id?: string;
          p_capacity?: number;
          p_class_id: string;
          p_description: string;
          p_ends_at: string;
          p_location?: string;
          p_meeting_url?: string;
          p_registration_deadline?: string;
          p_session_type?: string;
          p_starts_at: string;
          p_time_zone: string;
          p_title: string;
          p_visibility?: string;
        };
        Returns: string;
      };
      create_leave_request: {
        Args: {
          p_class_id: string;
          p_document_issue_date?: string;
          p_explanation?: string;
          p_leave_end_date?: string;
          p_leave_start_date?: string;
          p_reason_category?: string;
        };
        Returns: {
          id: string;
          reference: string;
        }[];
      };
      create_or_get_course: {
        Args: { p_code?: string; p_department?: string; p_name: string };
        Returns: {
          code: string | null;
          created_at: string;
          department: string | null;
          id: string;
          name: string;
          normalized_code: string | null;
          normalized_name: string | null;
          university_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "courses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      decide_class_application: {
        Args: {
          p_application_id: string;
          p_decision: string;
          p_grant_class_admin?: boolean;
          p_initial_status?: string;
          p_note?: string;
        };
        Returns: string;
      };
      decide_class_verification: {
        Args: { p_decision: string; p_note?: string; p_request_id: string };
        Returns: string;
      };
      decline_class_invitation: {
        Args: { p_invitation_id: string };
        Returns: boolean;
      };
      delete_class: { Args: { p_class_id: string }; Returns: boolean };
      delete_class_subject: {
        Args: { p_subject_id: string };
        Returns: boolean;
      };
      delete_push_subscription: {
        Args: { p_endpoint: string };
        Returns: boolean;
      };
      developer_applied_migrations: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      developer_class_metrics: {
        Args: { p_limit?: number };
        Returns: {
          academic_year: string;
          admin_count: number;
          attendance_count: number;
          class_code: string;
          class_id: string;
          invitation_count: number;
          last_activity_at: string;
          leave_request_count: number;
          member_count: number;
          name: string;
          pending_review_count: number;
          published_count: number;
          semester: string;
          session_count: number;
          status: string;
        }[];
      };
      developer_dashboard_metrics: {
        Args: { p_since_30: string; p_since_7: string };
        Returns: {
          active_users_30: number;
          active_users_7: number;
          registrations_30: number;
          registrations_7: number;
          sign_ins_30: number;
          sign_ins_7: number;
          total_assignments: number;
          total_users: number;
        }[];
      };
      developer_database_health: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      discard_class_verification: {
        Args: { p_request_id: string };
        Returns: string[];
      };
      distance_meters: {
        Args: {
          p_lat1: number;
          p_lat2: number;
          p_lon1: number;
          p_lon2: number;
        };
        Returns: number;
      };
      enqueue_notification_event: {
        Args: {
          p_dedupe_key: string;
          p_kind: string;
          p_payload: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      find_class_duplicates: {
        Args: {
          p_academic_year: string;
          p_class_code: string;
          p_exclude_class_id?: string;
          p_institution?: string;
          p_name: string;
          p_semester: string;
        };
        Returns: {
          academic_year: string;
          class_code: string;
          class_id: string;
          code_match: boolean;
          institution: string;
          name: string;
          name_match: boolean;
          semester: string;
          slug: string;
          status: string;
        }[];
      };
      get_class_dependencies: {
        Args: { p_class_id: string };
        Returns: {
          assignment_count: number;
          attendance_count: number;
          calendar_event_count: number;
          can_delete: boolean;
          class_status: string;
          has_history: boolean;
          invitation_count: number;
          leave_request_count: number;
          member_count: number;
          schedule_count: number;
          session_count: number;
          subject_count: number;
          submission_count: number;
        }[];
      };
      get_invitation_preview: { Args: { p_token: string }; Returns: Json };
      get_my_declared_position: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      get_my_profile: { Args: Record<PropertyKey, never>; Returns: Json };
      get_platform_admin_overview: {
        Args: Record<PropertyKey, never>;
        Returns: {
          active_classes: number;
          approved_applications: number;
          archived_classes: number;
          onboarded_users: number;
          pending_applications: number;
          pending_reviews: number;
          pending_verifications: number;
          platform_admins: number;
          published_assignments: number;
          rejected_applications: number;
          total_users: number;
          unpublished_assignments: number;
        }[];
      };
      has_class_permission: {
        Args: { p_class_id: string; p_permission: string };
        Returns: boolean;
      };
      is_class_admin: { Args: { p_class_id: string }; Returns: boolean };
      is_class_member: { Args: { p_class_id: string }; Returns: boolean };
      is_class_verification_owner: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      is_leave_request_owner: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      is_platform_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_university_member: {
        Args: { p_university_id: string };
        Returns: boolean;
      };
      join_class_by_name: { Args: { p_class_name: string }; Returns: Json };
      leave_request_class_id: {
        Args: { p_request_id: string };
        Returns: string;
      };
      leave_request_id_from_object_path: {
        Args: { p_name: string };
        Returns: string;
      };
      list_assignments: {
        Args: {
          p_class_id?: string;
          p_course_id?: string;
          p_limit?: number;
          p_offset?: number;
          p_search?: string;
          p_semester?: string;
          p_sort?: string;
          p_tag?: string;
          p_type?: string;
        };
        Returns: {
          academic_year: string;
          assignment_type: string;
          attachment_count: number;
          author_avatar_url: string;
          author_display_name: string;
          class_id: string;
          content_type: string;
          course_code: string;
          course_id: string;
          course_name: string;
          created_at: string;
          deadline: string;
          description: string;
          drive_url: string;
          id: string;
          lecturer_name: string;
          semester: string;
          source_label: string;
          tags: string[];
          title: string;
          total_count: number;
          updated_at: string;
        }[];
      };
      list_class_member_bios: {
        Args: { p_class_id: string };
        Returns: {
          bio: string;
          user_id: string;
        }[];
      };
      list_classes: {
        Args: {
          p_limit?: number;
          p_offset?: number;
          p_search?: string;
          p_semester?: string;
        };
        Returns: {
          academic_year: string;
          class_code: string;
          course_name: string;
          created_at: string;
          description: string;
          id: string;
          institution: string;
          lecturer_name: string;
          member_count: number;
          name: string;
          semester: string;
          slug: string;
          total_count: number;
        }[];
      };
      list_discussion_sessions: {
        Args: {
          p_class_id?: string;
          p_from?: string;
          p_limit?: number;
          p_offset?: number;
          p_status?: string;
          p_to?: string;
          p_type?: string;
        };
        Returns: {
          agenda: string;
          assignment_id: string;
          cancelled_at: string;
          capacity: number;
          class_id: string;
          class_name: string;
          class_slug: string;
          completed_at: string;
          created_at: string;
          description: string;
          ends_at: string;
          going_count: number;
          id: string;
          location: string;
          maybe_count: number;
          meeting_url: string;
          organizer_avatar_url: string;
          organizer_display_name: string;
          organizer_id: string;
          registration_deadline: string;
          session_type: string;
          starts_at: string;
          status: string;
          time_zone: string;
          title: string;
          total_count: number;
          updated_at: string;
          viewer_status: string;
          visibility: string;
        }[];
      };
      list_platform_classes: {
        Args: {
          p_academic_year?: string;
          p_limit?: number;
          p_offset?: number;
          p_search?: string;
          p_semester?: string;
          p_status?: string;
        };
        Returns: {
          academic_year: string;
          admin_count: number;
          admin_names: string[];
          archived_at: string;
          class_code: string;
          course_name: string;
          created_at: string;
          description: string;
          id: string;
          institution: string;
          lecturer_name: string;
          member_count: number;
          name: string;
          semester: string;
          slug: string;
          status: string;
          subject_count: number;
          total_count: number;
        }[];
      };
      list_platform_users: {
        Args: {
          p_limit?: number;
          p_offset?: number;
          p_onboarding?: string;
          p_role?: string;
          p_search?: string;
        };
        Returns: {
          admin_class_count: number;
          avatar_url: string;
          class_count: number;
          created_at: string;
          display_name: string;
          id: string;
          is_platform_admin: boolean;
          onboarded_at: string;
          total_count: number;
        }[];
      };
      list_reminder_audience: {
        Args: { p_assignment_ids: string[] };
        Returns: {
          assignment_id: string;
          pref_timezone: string;
          reminder_24h: boolean;
          reminder_3h: boolean;
          user_id: string;
        }[];
      };
      list_session_reminder_audience: {
        Args: { p_session_ids: string[] };
        Returns: {
          pref_timezone: string;
          reminder_24h: boolean;
          reminder_3h: boolean;
          session_id: string;
          user_id: string;
        }[];
      };
      log_attendance_export: {
        Args: {
          p_class_id: string;
          p_kind: string;
          p_session_id: string;
          p_subject_id: string;
        };
        Returns: undefined;
      };
      log_attendance_verification: {
        Args: {
          p_accuracy_m?: number;
          p_distance_m?: number;
          p_outcome: string;
          p_session_id: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      mark_notification_events_read: {
        Args: { p_ids?: string[] };
        Returns: number;
      };
      moderate_assignment: {
        Args: { p_action: string; p_assignment_id: string; p_reason?: string };
        Returns: string;
      };
      normalize_class_key: { Args: { p_value: string }; Returns: string };
      notify_class_leave_reviewers: {
        Args: {
          p_body: string;
          p_class_id: string;
          p_dedupe_suffix: string;
          p_kind: string;
          p_title: string;
          p_url: string;
        };
        Returns: undefined;
      };
      notify_session_participants: {
        Args: {
          p_body: string;
          p_dedupe_prefix: string;
          p_kind: string;
          p_session_id: string;
          p_title: string;
          p_url: string;
        };
        Returns: number;
      };
      open_attendance_meeting: {
        Args: { p_session_id: string };
        Returns: boolean;
      };
      platform_upsert_student_identity: {
        Args: {
          p_academic_unit_id: string;
          p_entry_year: number;
          p_membership_id: string;
          p_status: string;
          p_student_id: string;
        };
        Returns: string;
      };
      publish_class_assignment: {
        Args: { p_assignment_id: string };
        Returns: boolean;
      };
      purge_discussion_checkin_coordinates: {
        Args: { p_retention_days?: number };
        Returns: number;
      };
      purge_notification_deliveries: {
        Args: { p_retention_days?: number };
        Returns: number;
      };
      queue_session_notification: {
        Args: {
          p_body: string;
          p_dedupe_key: string;
          p_kind: string;
          p_title: string;
          p_url: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      record_attendance_correction: {
        Args: {
          p_physically_verified?: boolean;
          p_reason: string;
          p_session_id: string;
          p_status: string;
          p_user_id: string;
        };
        Returns: string;
      };
      record_audit: {
        Args: {
          p_action: string;
          p_class_id: string;
          p_entity_id: string;
          p_entity_type: string;
          p_metadata?: Json;
        };
        Returns: undefined;
      };
      record_discussion_session_checkin: {
        Args: {
          p_note?: string;
          p_session_id: string;
          p_status: string;
          p_user_id: string;
        };
        Returns: string;
      };
      record_leave_lecturer_outcome: {
        Args: { p_note?: string; p_outcome: string; p_request_id: string };
        Returns: string;
      };
      record_leave_request_ocr: {
        Args: {
          p_provider: string;
          p_request_id: string;
          p_result: Json;
          p_status: string;
        };
        Returns: undefined;
      };
      register_push_subscription: {
        Args: {
          p_auth: string;
          p_device_label?: string;
          p_endpoint: string;
          p_p256dh: string;
        };
        Returns: string;
      };
      remove_assignment_attachment: {
        Args: { p_attachment_id: string; p_reason?: string };
        Returns: string;
      };
      remove_class_member: {
        Args: { p_class_id: string; p_user_id: string };
        Returns: boolean;
      };
      remove_class_verification_evidence: {
        Args: { p_evidence_id: string };
        Returns: string;
      };
      remove_leave_request_evidence: {
        Args: { p_evidence_id: string };
        Returns: string;
      };
      reopen_attendance_meeting: {
        Args: { p_session_id: string };
        Returns: number;
      };
      report_assignment: {
        Args: { p_assignment_id: string; p_note?: string; p_reason: string };
        Returns: string;
      };
      review_assignment_report: {
        Args: { p_note?: string; p_report_id: string; p_status: string };
        Returns: undefined;
      };
      review_class_assignment: {
        Args: {
          p_assignment_id: string;
          p_decision: string;
          p_reason?: string;
        };
        Returns: string;
      };
      review_discussion_session_checkin: {
        Args: {
          p_checkin_id: string;
          p_note?: string;
          p_session_id: string;
          p_status: string;
        };
        Returns: boolean;
      };
      review_leave_request: {
        Args: { p_decision: string; p_note?: string; p_request_id: string };
        Returns: string;
      };
      review_public_assignment: {
        Args: {
          p_assignment_id: string;
          p_decision: string;
          p_reason?: string;
        };
        Returns: string;
      };
      revise_class_application: {
        Args: {
          p_academic_year: string;
          p_application_id: string;
          p_course_name: string;
          p_description: string;
          p_institution?: string;
          p_lecturer_name?: string;
          p_proposed_class_code?: string;
          p_proposed_name: string;
          p_proposed_slug: string;
          p_reason: string;
          p_semester: string;
          p_supporting_info?: string;
        };
        Returns: boolean;
      };
      revise_class_assignment: {
        Args: {
          p_assignment_id: string;
          p_assignment_type?: string;
          p_deadline?: string;
          p_description: string;
          p_reference_urls?: Json;
          p_tags?: string[];
          p_title: string;
        };
        Returns: boolean;
      };
      revise_class_verification: {
        Args: { p_request_id: string; p_statement?: string };
        Returns: boolean;
      };
      revoke_class_admin: {
        Args: { p_class_id: string; p_user_id: string };
        Returns: boolean;
      };
      revoke_class_invitation: {
        Args: { p_invitation_id: string };
        Returns: boolean;
      };
      revoke_verified_class_admin: {
        Args: { p_note: string; p_request_id: string };
        Returns: boolean;
      };
      rsvp_discussion_session: {
        Args: { p_session_id: string; p_status: string };
        Returns: Json;
      };
      session_attendance: {
        Args: { p_session_id: string };
        Returns: {
          capacity: number;
          going_count: number;
          maybe_count: number;
          not_going_count: number;
          viewer_status: string;
        }[];
      };
      session_checkin_summary: {
        Args: { p_session_id: string };
        Returns: {
          has_location: boolean;
          radius_m: number;
        }[];
      };
      session_checkin_summary_many: {
        Args: { p_session_ids: string[] };
        Returns: {
          session_id: string;
          has_location: boolean;
          radius_m: number;
        }[];
      };
      session_class_id: { Args: { p_session_id: string }; Returns: string };
      set_class_join_policy: {
        Args: { p_class_id: string; p_policy: string };
        Returns: boolean;
      };
      set_class_media: {
        Args: {
          p_avatar_url?: string;
          p_class_id: string;
          p_cover_url?: string;
        };
        Returns: undefined;
      };
      set_class_status: {
        Args: { p_class_id: string; p_status: string };
        Returns: boolean;
      };
      set_discussion_session_checkin_location: {
        Args: {
          p_latitude: number;
          p_longitude: number;
          p_radius_m?: number;
          p_session_id: string;
        };
        Returns: boolean;
      };
      set_discussion_session_status: {
        Args: { p_session_id: string; p_status: string };
        Returns: boolean;
      };
      set_leave_request_subjects: {
        Args: { p_request_id: string; p_subject_ids: string[] };
        Returns: undefined;
      };
      set_my_avatar_url: { Args: { p_avatar_url: string }; Returns: undefined };
      set_my_declared_position: {
        Args: { p_position: string };
        Returns: string;
      };
      settle_session_side_effects: {
        Args: { p_session_id: string; p_starts_at: string };
        Returns: undefined;
      };
      submit_class_assignment: {
        Args: {
          p_assignment_type?: string;
          p_class_id: string;
          p_content_type?: string;
          p_deadline?: string;
          p_description: string;
          p_drive_url?: string;
          p_reference_urls?: Json;
          p_source_label?: string;
          p_subject_id?: string;
          p_tags?: string[];
          p_title: string;
        };
        Returns: string;
      };
      submit_class_verification: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
      submit_leave_request: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
      update_attendance_meeting_location: {
        Args: {
          p_latitude: number;
          p_longitude: number;
          p_radius_m: number;
          p_reason: string;
          p_session_id: string;
        };
        Returns: boolean;
      };
      update_class_metadata: {
        Args: {
          p_academic_year: string;
          p_class_code?: string;
          p_class_id: string;
          p_course_name: string;
          p_description: string;
          p_institution?: string;
          p_lecturer_name?: string;
          p_name: string;
          p_semester: string;
        };
        Returns: boolean;
      };
      update_class_subject: {
        Args: {
          p_code?: string;
          p_description?: string;
          p_lecturer_name?: string;
          p_name: string;
          p_status?: string;
          p_subject_id: string;
        };
        Returns: boolean;
      };
      update_discussion_session: {
        Args: {
          p_agenda?: string;
          p_assignment_id?: string;
          p_capacity?: number;
          p_description: string;
          p_ends_at: string;
          p_location?: string;
          p_meeting_url?: string;
          p_registration_deadline?: string;
          p_session_id: string;
          p_session_type?: string;
          p_starts_at: string;
          p_time_zone: string;
          p_title: string;
          p_visibility?: string;
        };
        Returns: boolean;
      };
      update_leave_request: {
        Args: {
          p_document_issue_date: string;
          p_explanation: string;
          p_leave_end_date: string;
          p_leave_start_date: string;
          p_reason_category: string;
          p_request_id: string;
        };
        Returns: undefined;
      };
      update_my_bio: { Args: { p_bio: string }; Returns: string };
      update_my_profile: {
        Args: {
          p_declared_class?: string;
          p_full_name: string;
          p_nickname: string;
          p_nim: string;
          p_university: string;
        };
        Returns: Json;
      };
      validate_grade_entry: {
        Args: { p_max: number; p_score: number };
        Returns: boolean;
      };
      verification_request_id_from_object_path: {
        Args: { p_name: string };
        Returns: string;
      };
      withdraw_class_application: {
        Args: { p_application_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
