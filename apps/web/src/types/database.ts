/**
 * Hand-maintained database types that mirror `supabase/migrations`.
 * Regenerate with `pnpm db:types` once a local Supabase instance is running.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AssignmentStatusRow =
  | "draft"
  | "pending_review"
  | "pending"
  | "published"
  | "rejected"
  | "unpublished"
  | "archived";

export type AssignmentReportReasonRow =
  | "wrong_deadline"
  | "wrong_details"
  | "duplicate"
  | "broken_attachment"
  | "other";

export type AssignmentReportStatusRow = "open" | "resolved" | "dismissed";

export type AssignmentRevisionChangeKindRow =
  "created" | "updated" | "moderated";

export type FeedbackCategoryRow = "bug" | "confusing" | "idea" | "other";

export type FeedbackStatusRow = "open" | "reviewing" | "resolved" | "dismissed";

export type LeaveRequestStatusRow =
  "draft" | "submitted" | "approved" | "rejected" | "forwarded" | "cancelled";

export type LeaveReasonCategoryRow = "illness" | "family_matter" | "other";

export type LeaveOcrStatusRow =
  "not_run" | "pending" | "succeeded" | "failed" | "unsupported";

export type LeaveReportFormatRow = "summary" | "complete";

export type ClassStatusRow = "draft" | "active" | "archived";

export type ClassApplicationStatusRow =
  "pending" | "approved" | "rejected" | "withdrawn";

export type AssignmentReviewDecisionRow =
  | "submitted"
  | "approved"
  | "rejected"
  | "unpublished"
  | "restored"
  | "archived";

export type NotificationEventKindRow =
  | "class_application_approved"
  | "class_application_rejected"
  | "class_admin_assigned"
  | "class_invitation"
  | "assignment_approved"
  | "assignment_rejected"
  | "submission_received"
  | "moderation_required"
  | "session_updated"
  | "session_cancelled"
  | "session_rsvp"
  | "leave_request_submitted"
  | "leave_request_revision_requested"
  | "leave_request_forwarded"
  | "leave_request_approved"
  | "leave_request_rejected"
  | "leave_request_cancelled"
  | "verification_submitted"
  | "verification_approved"
  | "verification_rejected"
  | "verification_revision_requested"
  | "class_admin_revoked"
  | "class_assignment_published"
  | "assignment_report_reviewed"
  | "assignment_created"
  | "dm_message";

export type VerificationStatusRow =
  "pending" | "needs_revision" | "verified" | "rejected";

export type VerificationReviewActionRow =
  | "created"
  | "updated"
  | "submitted"
  | "resubmitted"
  | "evidence_added"
  | "evidence_removed"
  | "revision_requested"
  | "approved"
  | "rejected"
  | "access_revoked";

export type PushReminderTypeRow = "24h" | "3h";

export type DeliveryStatusRow =
  "pending" | "processing" | "sent" | "failed" | "skipped";

export type SessionStatusRow = "scheduled" | "cancelled" | "completed";

export type SessionTypeRow = "online" | "in_person";

export type SessionVisibilityRow = "class_members" | "public";

export type RsvpStatusRow = "going" | "maybe" | "not_going";

export type SessionCheckInStatusRow =
  "present" | "late" | "excused" | "sick" | "absent";

export type SessionCheckInMethodRow = "geo" | "manual" | "system";

/** Row returned when selecting a check-in; coordinates are never granted. */
export interface SessionCheckInRow {
  id: string;
  session_id: string;
  user_id: string;
  status: SessionCheckInStatusRow;
  method: SessionCheckInMethodRow;
  checked_in_at: string;
  /** Null for a manual row, which was recorded without a location reading. */
  accuracy_m: number | null;
  distance_m: number | null;
  note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CalendarMappingStatusRow =
  "pending" | "synced" | "out_of_sync" | "failed" | "deleted";

export type CalendarConnectionStatusRow = "connected" | "revoked" | "error";

/** Row returned by `claim_session_reminders`, joined with its session. */
export interface SessionReminderClaim {
  id: string;
  user_id: string;
  session_id: string;
  reminder_type: PushReminderTypeRow;
  starts_at: string;
  attempt_count: number;
  session_title: string;
  session_status: SessionStatusRow;
  session_time_zone: string;
  session_ends_at: string;
  current_starts_at: string;
  class_name: string;
  push_enabled: boolean | null;
  reminder_24h: boolean | null;
  reminder_3h: boolean | null;
  pref_timezone: string | null;
}

/** Row returned by `session_attendance`. */
export interface SessionAttendanceRow {
  going_count: number;
  maybe_count: number;
  not_going_count: number;
  capacity: number | null;
  viewer_status: RsvpStatusRow | null;
}

/** Row returned by `list_discussion_sessions`. */
export interface SessionListRow {
  id: string;
  class_id: string;
  class_slug: string;
  class_name: string;
  assignment_id: string | null;
  organizer_id: string;
  organizer_display_name: string;
  organizer_avatar_url: string | null;
  title: string;
  description: string;
  agenda: string | null;
  session_type: SessionTypeRow;
  meeting_url: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  capacity: number | null;
  registration_deadline: string | null;
  visibility: SessionVisibilityRow;
  status: SessionStatusRow;
  cancelled_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  going_count: number;
  maybe_count: number;
  viewer_status: RsvpStatusRow | null;
  total_count: number;
}

/** Row returned by `claim_notification_deliveries`, joined with its assignment. */
export interface PushDeliveryClaim {
  id: string;
  user_id: string;
  assignment_id: string;
  reminder_type: PushReminderTypeRow;
  deadline_at: string;
  attempt_count: number;
  assignment_title: string;
  course_name: string;
  current_deadline: string | null;
  assignment_status: string;
  push_enabled: boolean;
  reminder_24h: boolean;
  reminder_3h: boolean;
  pref_timezone: string;
}

/** Row returned by `claim_notification_events`. */
export interface NotificationEventClaim {
  id: string;
  user_id: string;
  kind: NotificationEventKindRow;
  payload: Json;
  attempt_count: number;
}

export interface AssignmentListItem {
  id: string;
  title: string;
  description: string;
  course_id: string;
  class_id: string | null;
  course_name: string;
  course_code: string | null;
  lecturer_name: string | null;
  semester: string | null;
  academic_year: string | null;
  assignment_type: string | null;
  /** `lecturer_assignment` or `class_announcement`. */
  content_type?: string;
  /** Names the lecturer behind recorded instructions; null for announcements. */
  source_label?: string | null;
  drive_url?: string | null;
  /** The caller's own personal completion mark; never an official submission. */
  completed?: boolean;
  deadline: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  author_display_name: string;
  author_avatar_url: string | null;
  attachment_count: number;
  total_count: number;
}

export interface Database {
  public: {
    Tables: {
      personal_calendar_events: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          starts_at: string;
          ends_at: string;
          time_zone: string;
          location: string | null;
          status: "published" | "cancelled" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          starts_at: string;
          ends_at: string;
          time_zone?: string;
          location?: string | null;
          status?: "published" | "cancelled" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          starts_at?: string;
          ends_at?: string;
          time_zone?: string;
          location?: string | null;
          status?: "published" | "cancelled" | "archived";
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          declared_position: "student" | "class_representative";
          full_name: string | null;
          nim: string | null;
          university: string | null;
          declared_class_name: string | null;
          bio: string | null;
          onboarded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          avatar_url?: string | null;
          full_name?: string | null;
          nim?: string | null;
          university?: string | null;
          declared_class_name?: string | null;
          bio?: string | null;
          onboarded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          avatar_url?: string | null;
          full_name?: string | null;
          nim?: string | null;
          university?: string | null;
          declared_class_name?: string | null;
          bio?: string | null;
          onboarded_at?: string | null;
        };
        Relationships: [];
      };
      courses: {
        Row: {
          id: string;
          name: string;
          code: string | null;
          department: string | null;
          normalized_name: string;
          normalized_code: string | null;
          university_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code?: string | null;
          department?: string | null;
          university_id?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          code?: string | null;
          department?: string | null;
        };
        Relationships: [];
      };
      assignments: {
        Row: {
          offering_id: string | null;
          university_id: string | null;
          id: string;
          title: string;
          description: string;
          course_id: string;
          user_id: string;
          lecturer_name: string | null;
          semester: string | null;
          academic_year: string | null;
          assignment_type: string | null;
          deadline: string | null;
          tags: string[];
          reference_urls: Json;
          status: AssignmentStatusRow;
          class_id: string | null;
          subject_id: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          rejection_reason: string | null;
          published_at: string | null;
          revision: number;
          content_type: string;
          source_label: string | null;
          drive_url: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
          /** Generated full-text column; never written by application code. */
          search_vector: unknown;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          course_id: string;
          user_id: string;
          lecturer_name?: string | null;
          semester?: string | null;
          academic_year?: string | null;
          assignment_type?: string | null;
          deadline?: string | null;
          tags?: string[];
          reference_urls?: Json;
          status?: AssignmentStatusRow;
          class_id?: string | null;
          subject_id?: string | null;
          revision?: number;
          content_type?: string;
          source_label?: string | null;
          drive_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string;
          course_id?: string;
          lecturer_name?: string | null;
          semester?: string | null;
          academic_year?: string | null;
          assignment_type?: string | null;
          deadline?: string | null;
          tags?: string[];
          reference_urls?: Json;
          status?: AssignmentStatusRow;
          class_id?: string | null;
          subject_id?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
          published_at?: string | null;
          revision?: number;
          content_type?: string;
          source_label?: string | null;
          drive_url?: string | null;
          archived_at?: string | null;
        };
        // Only outgoing foreign keys belong here. Reverse (one-to-many) embeds
        // such as `assignment_attachments(...)` are resolved from the child
        // table's own Relationships, which is how Supabase generates types.
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      assignment_completions: {
        Row: {
          assignment_id: string;
          user_id: string;
          completed_at: string;
        };
        Insert: {
          assignment_id: string;
          user_id: string;
          completed_at?: string;
        };
        Update: Record<string, never>;
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
          id: string;
          assignment_id: string;
          reporter_id: string;
          class_id: string;
          reason: AssignmentReportReasonRow;
          note: string | null;
          status: AssignmentReportStatusRow;
          resolved_by: string | null;
          resolved_at: string | null;
          resolution_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          reporter_id: string;
          class_id: string;
          reason: AssignmentReportReasonRow;
          note?: string | null;
          status?: AssignmentReportStatusRow;
          resolved_by?: string | null;
          resolved_at?: string | null;
          resolution_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          reason?: AssignmentReportReasonRow;
          note?: string | null;
          status?: AssignmentReportStatusRow;
          resolved_by?: string | null;
          resolved_at?: string | null;
          resolution_note?: string | null;
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
      assignment_revisions: {
        Row: {
          id: string;
          assignment_id: string;
          class_id: string | null;
          editor_id: string | null;
          revision: number;
          change_kind: AssignmentRevisionChangeKindRow;
          snapshot: Json;
          changed_fields: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          class_id?: string | null;
          editor_id?: string | null;
          revision: number;
          change_kind?: AssignmentRevisionChangeKindRow;
          snapshot?: Json;
          changed_fields?: string[];
          created_at?: string;
        };
        Update: {
          snapshot?: Json;
          changed_fields?: string[];
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
      assignment_attachments: {
        Row: {
          id: string;
          assignment_id: string;
          storage_path: string;
          storage_provider: string;
          original_filename: string;
          mime_type: string;
          file_size: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          storage_path: string;
          storage_provider?: string;
          original_filename: string;
          mime_type: string;
          file_size: number;
          created_at?: string;
        };
        Update: {
          original_filename?: string;
          mime_type?: string;
          file_size?: number;
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
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          device_label: string | null;
          created_at: string;
          updated_at: string;
          last_success_at: string | null;
          disabled_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          device_label?: string | null;
          created_at?: string;
          updated_at?: string;
          last_success_at?: string | null;
          disabled_at?: string | null;
        };
        Update: {
          device_label?: string | null;
          disabled_at?: string | null;
          last_success_at?: string | null;
        };
        Relationships: [];
      };
      native_push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: "android" | "ios";
          device_label: string | null;
          created_at: string;
          updated_at: string;
          last_success_at: string | null;
          disabled_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform: "android" | "ios";
          device_label?: string | null;
          created_at?: string;
          updated_at?: string;
          last_success_at?: string | null;
          disabled_at?: string | null;
        };
        Update: {
          device_label?: string | null;
          disabled_at?: string | null;
          last_success_at?: string | null;
          platform?: "android" | "ios";
          token?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          push_enabled: boolean;
          reminder_24h: boolean;
          reminder_3h: boolean;
          session_reminder_24h: boolean;
          session_reminder_3h: boolean;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          push_enabled?: boolean;
          reminder_24h?: boolean;
          reminder_3h?: boolean;
          session_reminder_24h?: boolean;
          session_reminder_3h?: boolean;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          push_enabled?: boolean;
          reminder_24h?: boolean;
          reminder_3h?: boolean;
          session_reminder_24h?: boolean;
          session_reminder_3h?: boolean;
          timezone?: string;
        };
        Relationships: [];
      };
      saved_assignments: {
        Row: {
          id: string;
          user_id: string;
          assignment_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          assignment_id: string;
          created_at?: string;
        };
        Update: {
          assignment_id?: string;
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
      notification_deliveries: {
        Row: {
          university_id: string | null;
          id: string;
          user_id: string;
          assignment_id: string;
          reminder_type: PushReminderTypeRow;
          deadline_at: string;
          scheduled_for: string;
          status: DeliveryStatusRow;
          attempt_count: number;
          next_attempt_at: string;
          last_error_category: string | null;
          created_at: string;
          updated_at: string;
          delivered_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          assignment_id: string;
          reminder_type: PushReminderTypeRow;
          deadline_at: string;
          scheduled_for: string;
          status?: DeliveryStatusRow;
          attempt_count?: number;
          next_attempt_at?: string;
          last_error_category?: string | null;
          created_at?: string;
          updated_at?: string;
          delivered_at?: string | null;
        };
        Update: {
          status?: DeliveryStatusRow;
          attempt_count?: number;
          next_attempt_at?: string;
          last_error_category?: string | null;
          delivered_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_admins: {
        Row: {
          user_id: string;
          granted_at: string;
          granted_by: string | null;
        };
        Insert: {
          user_id: string;
          granted_at?: string;
          granted_by?: string | null;
        };
        Update: {
          granted_by?: string | null;
        };
        Relationships: [];
      };
      class_export_branding: {
        Row: {
          class_id: string;
          university_name: string;
          university_short_name: string | null;
          university_tagline: string | null;
          faculty: string | null;
          department: string | null;
          study_program: string | null;
          address: string | null;
          city: string | null;
          official_website: string | null;
          official_email: string | null;
          contact_number: string | null;
          document_title: string;
          footer_text: string | null;
          product_name: string;
          product_tagline: string;
          product_logo_url: string;
          product_footer: string | null;
          branding_enabled: boolean;
          passing_threshold: number;
          university_logo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          class_id: string;
          university_name?: string;
          university_short_name?: string | null;
          university_tagline?: string | null;
          faculty?: string | null;
          department?: string | null;
          study_program?: string | null;
          address?: string | null;
          city?: string | null;
          official_website?: string | null;
          official_email?: string | null;
          contact_number?: string | null;
          document_title?: string;
          footer_text?: string | null;
          product_name?: string;
          product_tagline?: string;
          product_logo_url?: string;
          product_footer?: string | null;
          branding_enabled?: boolean;
          passing_threshold?: number;
          university_logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          university_name?: string;
          university_short_name?: string | null;
          university_tagline?: string | null;
          faculty?: string | null;
          department?: string | null;
          study_program?: string | null;
          address?: string | null;
          city?: string | null;
          official_website?: string | null;
          official_email?: string | null;
          contact_number?: string | null;
          document_title?: string;
          footer_text?: string | null;
          product_name?: string;
          product_tagline?: string;
          product_logo_url?: string;
          product_footer?: string | null;
          branding_enabled?: boolean;
          passing_threshold?: number;
          university_logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      classes: {
        Row: {
          entry_year: number | null;
          code: string | null;
          semester_id: string | null;
          academic_year_id: string | null;
          academic_unit_id: string | null;
          university_id: string | null;
          id: string;
          slug: string;
          name: string;
          class_code: string | null;
          class_code_normalized: string | null;
          avatar_url: string | null;
          cover_url: string | null;
          description: string;
          course_id: string;
          course_name: string;
          institution: string | null;
          institution_normalized: string | null;
          lecturer_name: string | null;
          semester: string;
          academic_year: string;
          status: ClassStatusRow;
          join_policy: "invitation" | "open";
          archived_at: string | null;
          archived_by: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          class_code?: string | null;
          avatar_url?: string | null;
          cover_url?: string | null;
          description: string;
          course_id: string;
          course_name: string;
          institution?: string | null;
          lecturer_name?: string | null;
          semester: string;
          academic_year: string;
          status?: ClassStatusRow;
          join_policy?: "invitation" | "open";
          archived_at?: string | null;
          archived_by?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          class_code?: string | null;
          avatar_url?: string | null;
          cover_url?: string | null;
          description?: string;
          course_id?: string;
          course_name?: string;
          institution?: string | null;
          lecturer_name?: string | null;
          semester?: string;
          academic_year?: string;
          status?: ClassStatusRow;
          join_policy?: "invitation" | "open";
          archived_at?: string | null;
          archived_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "classes_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      class_applications: {
        Row: {
          id: string;
          applicant_id: string;
          proposed_slug: string;
          proposed_name: string;
          proposed_class_code: string | null;
          course_name: string;
          institution: string | null;
          lecturer_name: string | null;
          semester: string;
          academic_year: string;
          description: string;
          reason: string;
          supporting_info: string | null;
          status: ClassApplicationStatusRow;
          reviewed_by: string | null;
          reviewed_at: string | null;
          decision_note: string | null;
          created_class_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          applicant_id: string;
          proposed_slug: string;
          proposed_name: string;
          proposed_class_code?: string | null;
          course_name: string;
          institution?: string | null;
          lecturer_name?: string | null;
          semester: string;
          academic_year: string;
          description: string;
          reason: string;
          supporting_info?: string | null;
          status?: ClassApplicationStatusRow;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          proposed_slug?: string;
          proposed_name?: string;
          proposed_class_code?: string | null;
          course_name?: string;
          institution?: string | null;
          lecturer_name?: string | null;
          semester?: string;
          academic_year?: string;
          description?: string;
          reason?: string;
          supporting_info?: string | null;
          status?: ClassApplicationStatusRow;
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
      class_application_reviews: {
        Row: {
          id: string;
          application_id: string;
          reviewer_id: string;
          decision: "approved" | "rejected";
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          application_id: string;
          reviewer_id: string;
          decision: "approved" | "rejected";
          note?: string | null;
          created_at?: string;
        };
        Update: {
          note?: string | null;
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
      class_members: {
        Row: {
          class_id: string;
          user_id: string;
          joined_via:
            | "invitation"
            | "admin_assignment"
            | "platform_assignment"
            | "name_match";
          joined_at: string;
        };
        Insert: {
          class_id: string;
          user_id: string;
          joined_via?:
            | "invitation"
            | "admin_assignment"
            | "platform_assignment"
            | "name_match";
          joined_at?: string;
        };
        Update: {
          joined_via?:
            | "invitation"
            | "admin_assignment"
            | "platform_assignment"
            | "name_match";
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
      class_admins: {
        Row: {
          class_id: string;
          user_id: string;
          assigned_by: string | null;
          assigned_at: string;
        };
        Insert: {
          class_id: string;
          user_id: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
        Update: {
          assigned_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "class_admins_class_id_user_id_fkey";
            columns: ["class_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "class_members";
            referencedColumns: ["class_id", "user_id"];
          },
        ];
      };
      class_invitations: {
        Row: {
          id: string;
          class_id: string;
          created_by: string;
          token_hash: string;
          email_restriction: string | null;
          expires_at: string;
          max_uses: number;
          used_count: number;
          revoked_at: string | null;
          revoked_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          created_by: string;
          token_hash: string;
          email_restriction?: string | null;
          expires_at: string;
          max_uses?: number;
          used_count?: number;
          revoked_at?: string | null;
          revoked_by?: string | null;
          created_at?: string;
        };
        Update: {
          revoked_at?: string | null;
          revoked_by?: string | null;
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
      class_invitation_acceptances: {
        Row: {
          id: string;
          invitation_id: string;
          user_id: string;
          accepted_at: string;
        };
        Insert: {
          id?: string;
          invitation_id: string;
          user_id: string;
          accepted_at?: string;
        };
        Update: Record<string, never>;
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
      assignment_reviews: {
        Row: {
          id: string;
          assignment_id: string;
          reviewer_id: string | null;
          decision: AssignmentReviewDecisionRow;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          reviewer_id?: string | null;
          decision: AssignmentReviewDecisionRow;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          reason?: string | null;
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
      audit_logs: {
        Row: {
          before_state: string | null;
          after_state: string | null;
          university_id: string | null;
          id: number;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          class_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          class_id?: string | null;
          university_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "audit_logs_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      auth_activity_events: {
        Row: {
          id: number;
          user_id: string | null;
          event_type: "sign_in_succeeded" | "sign_in_failed";
          provider: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          user_id?: string | null;
          event_type: "sign_in_succeeded" | "sign_in_failed";
          provider?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      app_activity_events: {
        Row: {
          id: number;
          actor_id: string | null;
          event_type:
            "assignment_created" | "assignment_updated" | "assignment_deleted";
          resource_type: string;
          resource_id: string | null;
          class_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          actor_id?: string | null;
          event_type:
            "assignment_created" | "assignment_updated" | "assignment_deleted";
          resource_type: string;
          resource_id?: string | null;
          class_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Record<string, never>;
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
          id: number;
          route_path: string | null;
          method: string | null;
          error_name: string | null;
          error_digest: string | null;
          created_at: string;
        };
        Insert: {
          route_path?: string | null;
          method?: string | null;
          error_name?: string | null;
          error_digest?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      developer_incidents: {
        Row: {
          id: string;
          title: string;
          status: "open" | "monitoring" | "resolved";
          severity: "low" | "medium" | "high";
          created_by: string | null;
          created_at: string;
          updated_by: string | null;
          updated_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          status?: "open" | "monitoring" | "resolved";
          severity?: "low" | "medium" | "high";
          created_by?: string | null;
          created_at?: string;
          updated_by?: string | null;
          updated_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          title?: string;
          status?: "open" | "monitoring" | "resolved";
          severity?: "low" | "medium" | "high";
          updated_by?: string | null;
          updated_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      developer_incident_notes: {
        Row: {
          id: number;
          incident_id: string;
          body: string;
          author_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          incident_id: string;
          body: string;
          author_id?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
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
      export_jobs: {
        Row: {
          created_at: string;
          error_category: string | null;
          id: string;
          kind: string;
          params: Json;
          result_path: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          error_category?: string | null;
          id?: string;
          kind: string;
          params?: Json;
          result_path?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          error_category?: string | null;
          id?: string;
          kind?: string;
          params?: Json;
          result_path?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "export_jobs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      feedback_entries: {
        Row: {
          id: string;
          user_id: string;
          category: FeedbackCategoryRow;
          message: string;
          page_path: string | null;
          status: FeedbackStatusRow;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category: FeedbackCategoryRow;
          message: string;
          page_path?: string | null;
          status?: FeedbackStatusRow;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: FeedbackStatusRow;
        };
        Relationships: [];
      };
      notification_events: {
        Row: {
          university_id: string | null;
          id: string;
          user_id: string;
          kind: NotificationEventKindRow;
          dedupe_key: string;
          payload: Json;
          status: DeliveryStatusRow;
          attempt_count: number;
          next_attempt_at: string;
          last_error_category: string | null;
          created_at: string;
          updated_at: string;
          sent_at: string | null;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: NotificationEventKindRow;
          dedupe_key: string;
          payload?: Json;
          status?: DeliveryStatusRow;
          attempt_count?: number;
          next_attempt_at?: string;
          last_error_category?: string | null;
          created_at?: string;
          updated_at?: string;
          sent_at?: string | null;
          read_at?: string | null;
        };
        Update: {
          status?: DeliveryStatusRow;
          attempt_count?: number;
          next_attempt_at?: string;
          last_error_category?: string | null;
          sent_at?: string | null;
          read_at?: string | null;
        };
        Relationships: [];
      };
      discussion_sessions: {
        Row: {
          id: string;
          class_id: string;
          assignment_id: string | null;
          organizer_id: string;
          title: string;
          description: string;
          agenda: string | null;
          session_type: SessionTypeRow;
          meeting_url: string | null;
          location: string | null;
          starts_at: string;
          ends_at: string;
          time_zone: string;
          capacity: number | null;
          registration_deadline: string | null;
          visibility: SessionVisibilityRow;
          status: SessionStatusRow;
          cancelled_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
          checkin_latitude: number | null;
          checkin_longitude: number | null;
          checkin_radius_m: number;
          subject_id: string | null;
          meeting_number: number | null;
          meeting_date: string | null;
          attendance_opens_at: string | null;
          attendance_closes_at: string | null;
          attendance_opened_at: string | null;
          attendance_closed_at: string | null;
          attendance_finalized_at: string | null;
          late_after_minutes: number;
        };
        Insert: {
          id?: string;
          class_id: string;
          assignment_id?: string | null;
          organizer_id: string;
          title: string;
          description: string;
          agenda?: string | null;
          session_type?: SessionTypeRow;
          meeting_url?: string | null;
          location?: string | null;
          starts_at: string;
          ends_at: string;
          time_zone?: string;
          capacity?: number | null;
          registration_deadline?: string | null;
          visibility?: SessionVisibilityRow;
          status?: SessionStatusRow;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          checkin_latitude?: number | null;
          checkin_longitude?: number | null;
          checkin_radius_m?: number;
          subject_id?: string | null;
          meeting_number?: number | null;
          meeting_date?: string | null;
          attendance_opens_at?: string | null;
          attendance_closes_at?: string | null;
          attendance_opened_at?: string | null;
          attendance_closed_at?: string | null;
          attendance_finalized_at?: string | null;
          late_after_minutes?: number;
        };
        Update: {
          title?: string;
          description?: string;
          agenda?: string | null;
          session_type?: SessionTypeRow;
          meeting_url?: string | null;
          location?: string | null;
          starts_at?: string;
          ends_at?: string;
          time_zone?: string;
          capacity?: number | null;
          registration_deadline?: string | null;
          visibility?: SessionVisibilityRow;
          status?: SessionStatusRow;
          cancelled_at?: string | null;
          completed_at?: string | null;
          checkin_latitude?: number | null;
          checkin_longitude?: number | null;
          checkin_radius_m?: number;
          subject_id?: string | null;
          meeting_number?: number | null;
          meeting_date?: string | null;
          attendance_opens_at?: string | null;
          attendance_closes_at?: string | null;
          attendance_opened_at?: string | null;
          attendance_closed_at?: string | null;
          attendance_finalized_at?: string | null;
          late_after_minutes?: number;
        };
        Relationships: [
          {
            foreignKeyName: "discussion_sessions_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discussion_sessions_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      discussion_session_rsvps: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          status: RsvpStatusRow;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          status: RsvpStatusRow;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: RsvpStatusRow;
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
      discussion_session_checkins: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          status: SessionCheckInStatusRow;
          method: SessionCheckInMethodRow;
          checked_in_at: string;
          latitude: number | null;
          longitude: number | null;
          coordinates_purged_at: string | null;
          accuracy_m: number | null;
          distance_m: number | null;
          note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          identity_verified: boolean;
          identity_verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          status?: SessionCheckInStatusRow;
          method?: SessionCheckInMethodRow;
          checked_in_at?: string;
          latitude?: number | null;
          longitude?: number | null;
          coordinates_purged_at?: string | null;
          accuracy_m?: number | null;
          distance_m?: number | null;
          note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          identity_verified?: boolean;
          identity_verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: SessionCheckInStatusRow;
          note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          identity_verified?: boolean;
          identity_verified_at?: string | null;
          updated_at?: string;
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
      attendance_verification_attempts: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          outcome: string;
          distance_m: number | null;
          accuracy_m: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          outcome: string;
          distance_m?: number | null;
          accuracy_m?: number | null;
          created_at?: string;
        };
        Update: {
          outcome?: string;
          distance_m?: number | null;
          accuracy_m?: number | null;
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
      attendance_correction_audits: {
        Row: {
          id: string;
          session_id: string;
          class_id: string;
          subject_id: string | null;
          student_id: string;
          admin_id: string | null;
          previous_status: string;
          new_status: string;
          reason: string;
          physically_verified: boolean;
          verification_method: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          class_id: string;
          subject_id?: string | null;
          student_id: string;
          admin_id?: string | null;
          previous_status: string;
          new_status: string;
          reason: string;
          physically_verified?: boolean;
          verification_method?: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          previous_status?: string;
          new_status?: string;
          reason?: string;
          physically_verified?: boolean;
          verification_method?: string;
          metadata?: Json;
          subject_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_correction_audits_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "discussion_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_correction_audits_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
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
      discussion_session_reminders: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          reminder_type: PushReminderTypeRow;
          starts_at: string;
          scheduled_for: string;
          status: DeliveryStatusRow;
          attempt_count: number;
          next_attempt_at: string;
          last_error_category: string | null;
          created_at: string;
          updated_at: string;
          delivered_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          reminder_type: PushReminderTypeRow;
          starts_at: string;
          scheduled_for: string;
          status?: DeliveryStatusRow;
          attempt_count?: number;
          next_attempt_at?: string;
          last_error_category?: string | null;
          created_at?: string;
          updated_at?: string;
          delivered_at?: string | null;
        };
        Update: {
          status?: DeliveryStatusRow;
          attempt_count?: number;
          next_attempt_at?: string;
          last_error_category?: string | null;
          delivered_at?: string | null;
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
      google_calendar_connections: {
        Row: {
          user_id: string;
          calendar_id: string;
          scope: string;
          access_token_ciphertext: string;
          refresh_token_ciphertext: string | null;
          token_expires_at: string;
          status: CalendarConnectionStatusRow;
          last_error_category: string | null;
          connected_at: string;
          last_refreshed_at: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          calendar_id?: string;
          scope: string;
          access_token_ciphertext: string;
          refresh_token_ciphertext?: string | null;
          token_expires_at: string;
          status?: CalendarConnectionStatusRow;
          last_error_category?: string | null;
          connected_at?: string;
          last_refreshed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          calendar_id?: string;
          scope?: string;
          access_token_ciphertext?: string;
          refresh_token_ciphertext?: string | null;
          token_expires_at?: string;
          status?: CalendarConnectionStatusRow;
          last_error_category?: string | null;
          last_refreshed_at?: string | null;
        };
        Relationships: [];
      };
      google_calendar_event_mappings: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          calendar_id: string;
          google_event_id: string | null;
          status: CalendarMappingStatusRow;
          attempt_count: number;
          next_attempt_at: string;
          last_synced_at: string | null;
          last_error_category: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          calendar_id?: string;
          google_event_id?: string | null;
          status?: CalendarMappingStatusRow;
          attempt_count?: number;
          next_attempt_at?: string;
          last_synced_at?: string | null;
          last_error_category?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          calendar_id?: string;
          google_event_id?: string | null;
          status?: CalendarMappingStatusRow;
          attempt_count?: number;
          next_attempt_at?: string;
          last_synced_at?: string | null;
          last_error_category?: string | null;
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
      rate_limits: {
        Row: {
          key: string;
          window_started_at: string;
          hits: number;
        };
        Insert: {
          key: string;
          window_started_at?: string;
          hits?: number;
        };
        Update: {
          window_started_at?: string;
          hits?: number;
        };
        Relationships: [];
      };
      leave_lecturer_outcomes: {
        Row: {
          id: string;
          request_id: string;
          outcome: string;
          recorded_by: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          outcome: string;
          recorded_by: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          note?: string | null;
        };
        Relationships: [];
      };
      leave_requests: {
        Row: {
          id: string;
          reference: string;
          student_id: string;
          class_id: string;
          subject_ids: string[];
          leave_start_date: string | null;
          leave_end_date: string | null;
          reason_category: LeaveReasonCategoryRow | null;
          explanation: string | null;
          document_issue_date: string | null;
          status: LeaveRequestStatusRow;
          submitted_at: string | null;
          forwarded_at: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          cancellation_note: string | null;
          ocr_status: LeaveOcrStatusRow;
          ocr_provider: string | null;
          ocr_result: Json | null;
          ocr_extracted_at: string | null;
          ocr_confirmed_at: string | null;
          field_sources: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference?: string;
          student_id: string;
          class_id: string;
          subject_ids?: string[];
          leave_start_date?: string | null;
          leave_end_date?: string | null;
          reason_category?: LeaveReasonCategoryRow | null;
          explanation?: string | null;
          document_issue_date?: string | null;
          status?: LeaveRequestStatusRow;
          submitted_at?: string | null;
          forwarded_at?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancellation_note?: string | null;
          ocr_status?: LeaveOcrStatusRow;
          ocr_provider?: string | null;
          ocr_result?: Json | null;
          ocr_extracted_at?: string | null;
          ocr_confirmed_at?: string | null;
          field_sources?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          subject_ids?: string[];
          leave_start_date?: string | null;
          leave_end_date?: string | null;
          reason_category?: LeaveReasonCategoryRow | null;
          explanation?: string | null;
          document_issue_date?: string | null;
          status?: LeaveRequestStatusRow;
          submitted_at?: string | null;
          forwarded_at?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancellation_note?: string | null;
          ocr_status?: LeaveOcrStatusRow;
          ocr_provider?: string | null;
          ocr_result?: Json | null;
          ocr_extracted_at?: string | null;
          ocr_confirmed_at?: string | null;
          field_sources?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      leave_request_evidence: {
        Row: {
          id: string;
          request_id: string;
          storage_path: string;
          original_filename: string;
          mime_type: string;
          file_size: number;
          sort_order: number;
          uploaded_by: string | null;
          created_at: string;
          removed_at: string | null;
          removed_by: string | null;
        };
        Insert: {
          id?: string;
          request_id: string;
          storage_path: string;
          original_filename: string;
          mime_type: string;
          file_size: number;
          sort_order?: number;
          uploaded_by?: string | null;
          created_at?: string;
          removed_at?: string | null;
          removed_by?: string | null;
        };
        Update: {
          sort_order?: number;
          removed_at?: string | null;
          removed_by?: string | null;
        };
        Relationships: [];
      };
      leave_request_history: {
        Row: {
          id: string;
          request_id: string;
          actor_id: string | null;
          action: string;
          note: string | null;
          metadata: Json;
          previous_status: string | null;
          next_status: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          actor_id?: string | null;
          action: string;
          note?: string | null;
          metadata?: Json;
          previous_status?: string | null;
          next_status?: string | null;
          created_at?: string;
        };
        Update: {
          note?: string | null;
          metadata?: Json;
        };
        Relationships: [];
      };
      leave_request_forwardings: {
        Row: {
          id: string;
          reference: string;
          class_id: string;
          forwarded_by: string | null;
          recipient_name: string;
          recipient_email: string | null;
          report_reference: string;
          report_format: LeaveReportFormatRow;
          request_count: number;
          idempotency_key: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          reference?: string;
          class_id: string;
          forwarded_by?: string | null;
          recipient_name: string;
          recipient_email?: string | null;
          report_reference: string;
          report_format: LeaveReportFormatRow;
          request_count: number;
          idempotency_key: string;
          created_at?: string;
        };
        Update: {
          recipient_name?: string;
          recipient_email?: string | null;
          report_reference?: string;
        };
        Relationships: [];
      };
      leave_request_forwarding_items: {
        Row: {
          forwarding_id: string;
          request_id: string;
          student_display_name: string;
          leave_start_date: string;
          leave_end_date: string;
        };
        Insert: {
          forwarding_id: string;
          request_id: string;
          student_display_name: string;
          leave_start_date: string;
          leave_end_date: string;
        };
        Update: {
          student_display_name?: string;
        };
        Relationships: [];
      };
      class_verification_requests: {
        Row: {
          id: string;
          student_id: string;
          class_id: string;
          declared_position: "class_representative";
          statement: string | null;
          status: VerificationStatusRow;
          submitted_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_note: string | null;
          revision_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          class_id: string;
          declared_position?: "class_representative";
          statement?: string | null;
          status?: VerificationStatusRow;
          submitted_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_note?: string | null;
          revision_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          statement?: string | null;
          status?: VerificationStatusRow;
          submitted_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_note?: string | null;
          revision_count?: number;
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
      class_verification_evidence: {
        Row: {
          id: string;
          request_id: string;
          storage_path: string;
          original_filename: string;
          mime_type: string;
          file_size: number;
          uploaded_by: string | null;
          created_at: string;
          removed_at: string | null;
          removed_by: string | null;
        };
        Insert: {
          id?: string;
          request_id: string;
          storage_path: string;
          original_filename: string;
          mime_type: string;
          file_size: number;
          uploaded_by?: string | null;
          created_at?: string;
          removed_at?: string | null;
          removed_by?: string | null;
        };
        Update: {
          removed_at?: string | null;
          removed_by?: string | null;
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
      class_verification_reviews: {
        Row: {
          id: string;
          request_id: string;
          actor_id: string | null;
          action: VerificationReviewActionRow;
          previous_status: VerificationStatusRow | null;
          new_status: VerificationStatusRow | null;
          note: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          actor_id?: string | null;
          action: VerificationReviewActionRow;
          previous_status?: VerificationStatusRow | null;
          new_status?: VerificationStatusRow | null;
          note?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Record<string, never>;
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
      class_subjects: {
        Row: {
          id: string;
          class_id: string;
          course_id: string | null;
          name: string;
          code: string | null;
          description: string | null;
          lecturer_name: string | null;
          status: "active" | "archived";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          course_id?: string | null;
          name: string;
          code?: string | null;
          description?: string | null;
          lecturer_name?: string | null;
          status?: "active" | "archived";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          code?: string | null;
          description?: string | null;
          lecturer_name?: string | null;
          status?: "active" | "archived";
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
      course_materials: {
        Row: {
          offering_id: string | null;
          university_id: string | null;
          id: string;
          class_id: string;
          subject_id: string;
          kind: "document" | "video" | "link" | "other";
          title: string;
          description: string | null;
          resource_url: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          subject_id: string;
          kind?: "document" | "video" | "link" | "other";
          title: string;
          description?: string | null;
          resource_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          subject_id?: string;
          kind?: "document" | "video" | "link" | "other";
          title?: string;
          description?: string | null;
          resource_url?: string | null;
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
            foreignKeyName: "course_materials_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "class_subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      class_calendar_events: {
        Row: {
          id: string;
          class_id: string;
          subject_id: string | null;
          title: string;
          description: string | null;
          event_type: "class_schedule" | "exam" | "academic_event";
          starts_at: string;
          ends_at: string;
          time_zone: string;
          location: string | null;
          visibility: "group";
          status: "published" | "cancelled" | "archived";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          subject_id?: string | null;
          title: string;
          description?: string | null;
          event_type: "class_schedule" | "exam" | "academic_event";
          starts_at: string;
          ends_at: string;
          time_zone?: string;
          location?: string | null;
          visibility?: "group";
          status?: "published" | "cancelled" | "archived";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          subject_id?: string | null;
          title?: string;
          description?: string | null;
          event_type?: "class_schedule" | "exam" | "academic_event";
          starts_at?: string;
          ends_at?: string;
          time_zone?: string;
          location?: string | null;
          status?: "published" | "cancelled" | "archived";
          updated_at?: string;
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
          id: string;
          class_id: string;
          subject_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          room: string | null;
          lecturer_name: string | null;
          period: string | null;
          start_date: string | null;
          end_date: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          subject_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          room?: string | null;
          lecturer_name?: string | null;
          period?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          subject_id?: string;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          room?: string | null;
          lecturer_name?: string | null;
          period?: string | null;
          start_date?: string | null;
          end_date?: string | null;
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
      class_invitation_declines: {
        Row: {
          id: string;
          invitation_id: string;
          user_id: string;
          declined_at: string;
        };
        Insert: {
          id?: string;
          invitation_id: string;
          user_id: string;
          declined_at?: string;
        };
        Update: Record<string, never>;
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
      class_ketua_assignments: {
        Row: {
          assigned_at: string;
          class_id: string;
          id: string;
          removed_reason: string | null;
          revoked_at: string | null;
          source: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          assigned_at?: string;
          class_id: string;
          id?: string;
          removed_reason?: string | null;
          revoked_at?: string | null;
          source: string;
          user_id: string;
        };
        Update: {
          assigned_at?: string;
          class_id?: string;
          id?: string;
          removed_reason?: string | null;
          revoked_at?: string | null;
          source?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_ketua_assignments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      class_ketua_recall_votes: {
        Row: {
          created_at: string;
          recall_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          recall_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          recall_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_ketua_recall_votes_recall_id_fkey";
            columns: ["recall_id"];
            isOneToOne: false;
            referencedRelation: "class_ketua_recalls";
            referencedColumns: ["id"];
          },
        ];
      };
      class_ketua_recalls: {
        Row: {
          class_id: string;
          created_at: string;
          decided_at: string | null;
          id: string;
          opened_by: string;
          reason: string | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          decided_at?: string | null;
          id?: string;
          opened_by: string;
          reason?: string | null;
          status?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          decided_at?: string | null;
          id?: string;
          opened_by?: string;
          reason?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_ketua_recalls_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
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
      beta_testers: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          note: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          note?: string | null;
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          note?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      class_subject_members: {
        Row: {
          class_id: string;
          enrolled_at: string;
          enrolled_via: string;
          subject_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          enrolled_at?: string;
          enrolled_via?: string;
          subject_id: string;
          user_id: string;
        };
        Update: {
          class_id?: string;
          enrolled_at?: string;
          enrolled_via?: string;
          subject_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_subject_members_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_subject_members_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes_legacy_vs_fk_gap";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_subject_members_class_id_user_id_fkey";
            columns: ["class_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "class_members";
            referencedColumns: ["class_id", "user_id"];
          },
          {
            foreignKeyName: "class_subject_members_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "class_subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      course_component_grades: {
        Row: {
          class_id: string;
          component: string;
          created_at: string;
          id: string;
          score: number;
          student_id: string;
          subject_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          component: string;
          created_at?: string;
          id?: string;
          score: number;
          student_id: string;
          subject_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          class_id?: string;
          component?: string;
          created_at?: string;
          id?: string;
          score?: number;
          student_id?: string;
          subject_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "course_component_grades_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_component_grades_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes_legacy_vs_fk_gap";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_component_grades_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "class_subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      course_retake_enrollments: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string | null;
          enrolled_via: string;
          subject_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          enrolled_via?: string;
          subject_id: string;
          user_id: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          enrolled_via?: string;
          subject_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "course_retake_enrollments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_retake_enrollments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes_legacy_vs_fk_gap";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_retake_enrollments_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "class_subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      dm_calls: {
        Row: {
          caller_id: string;
          conversation_id: string;
          created_at: string;
          ended_at: string | null;
          id: string;
          kind: string;
          signal: string | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          caller_id: string;
          conversation_id: string;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          kind?: string;
          signal?: string | null;
          status?: string;
        };
        Update: {
          caller_id?: string;
          conversation_id?: string;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          kind?: string;
          signal?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dm_calls_caller_id_fkey";
            columns: ["caller_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dm_calls_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "dm_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      dm_group_keys: {
        Row: {
          conversation_id: string;
          user_id: string;
          wrapped_key: string;
        };
        ComputedFields: never;
        Insert: {
          conversation_id: string;
          user_id: string;
          wrapped_key: string;
        };
        Update: {
          conversation_id?: string;
          user_id?: string;
          wrapped_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dm_group_keys_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "dm_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dm_group_keys_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dm_key_backup: {
        Row: {
          updated_at: string;
          user_id: string;
          wrapped_private_key: string;
        };
        ComputedFields: never;
        Insert: {
          updated_at?: string;
          user_id: string;
          wrapped_private_key: string;
        };
        Update: {
          updated_at?: string;
          user_id?: string;
          wrapped_private_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dm_key_backup_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dm_key_history: {
        Row: {
          created_at: string;
          id: string;
          public_key: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          public_key: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          public_key?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dm_key_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dm_stories: {
        Row: {
          caption: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          mime: string;
          path: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          caption?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          mime: string;
          path: string;
          user_id: string;
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          mime?: string;
          path?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dm_stories_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dm_typing: {
        Row: {
          conversation_id: string;
          is_typing: boolean;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          conversation_id: string;
          is_typing?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          is_typing?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dm_typing_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "dm_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dm_typing_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      google_drive_connections: {
        Row: {
          access_token_ciphertext: string;
          connected_at: string;
          drive_email: string | null;
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
          connected_at?: string;
          drive_email?: string | null;
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
          connected_at?: string;
          drive_email?: string | null;
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
      offline_checkin_queue: {
        Row: {
          captured_at: string;
          created_at: string;
          id: string;
          payload: NonNullable<Json>;
          session_id: string;
          synced_at: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          captured_at?: string;
          created_at?: string;
          id?: string;
          payload: NonNullable<Json>;
          session_id: string;
          synced_at?: string | null;
          user_id: string;
        };
        Update: {
          captured_at?: string;
          created_at?: string;
          id?: string;
          payload?: NonNullable<Json>;
          session_id?: string;
          synced_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "offline_checkin_queue_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      plugin_events: {
        Row: {
          content_hash: string;
          description: string | null;
          ends_at: string | null;
          first_seen_at: string;
          id: string;
          kind: string;
          last_seen_at: string;
          location: string | null;
          plugin_id: string;
          program_id: string;
          source_url: string | null;
          starts_at: string;
          title: string;
          university_id: string;
        };
        ComputedFields: never;
        Insert: {
          content_hash: string;
          description?: string | null;
          ends_at?: string | null;
          first_seen_at?: string;
          id?: string;
          kind: string;
          last_seen_at?: string;
          location?: string | null;
          plugin_id: string;
          program_id?: string;
          source_url?: string | null;
          starts_at: string;
          title: string;
          university_id: string;
        };
        Update: {
          content_hash?: string;
          description?: string | null;
          ends_at?: string | null;
          first_seen_at?: string;
          id?: string;
          kind?: string;
          last_seen_at?: string;
          location?: string | null;
          plugin_id?: string;
          program_id?: string;
          source_url?: string | null;
          starts_at?: string;
          title?: string;
          university_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plugin_events_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      plugin_sync_status: {
        Row: {
          event_count: number;
          last_attempt_at: string | null;
          last_error: string | null;
          last_success_at: string | null;
          plugin_id: string;
          university_id: string;
        };
        ComputedFields: never;
        Insert: {
          event_count?: number;
          last_attempt_at?: string | null;
          last_error?: string | null;
          last_success_at?: string | null;
          plugin_id: string;
          university_id: string;
        };
        Update: {
          event_count?: number;
          last_attempt_at?: string | null;
          last_error?: string | null;
          last_success_at?: string | null;
          plugin_id?: string;
          university_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plugin_sync_status_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
        ];
      };
      university_plugins: {
        Row: {
          enabled: boolean;
          plugin_id: string;
          university_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          enabled?: boolean;
          plugin_id: string;
          university_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          enabled?: boolean;
          plugin_id?: string;
          university_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "university_plugins_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "university_plugins_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
      drive_submissions: {
        Row: {
          assignment_id: string;
          created_at: string;
          drive_file_id: string | null;
          drive_file_name: string;
          file_size: number;
          id: string;
          mime_type: string;
          share_expires_at: string | null;
          share_revoked_at: string | null;
          share_token: string;
          share_token_hash: string | null;
          source: string;
          storage_path: string;
          storage_provider: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          created_at?: string;
          drive_file_id?: string | null;
          drive_file_name: string;
          file_size: number;
          id?: string;
          mime_type: string;
          share_expires_at?: string | null;
          share_revoked_at?: string | null;
          share_token?: string;
          share_token_hash?: string | null;
          source?: string;
          storage_path: string;
          storage_provider: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          assignment_id?: string;
          created_at?: string;
          drive_file_id?: string | null;
          drive_file_name?: string;
          file_size?: number;
          id?: string;
          mime_type?: string;
          share_expires_at?: string | null;
          share_revoked_at?: string | null;
          share_token?: string;
          share_token_hash?: string | null;
          source?: string;
          storage_path?: string;
          storage_provider?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
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
          institutional_domains: string[];
          locale: string | null;
          logo_url: string | null;
          name: string;
          nim_prefix: string | null;
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
          institutional_domains?: string[];
          locale?: string | null;
          logo_url?: string | null;
          name: string;
          nim_prefix?: string | null;
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
          institutional_domains?: string[];
          locale?: string | null;
          logo_url?: string | null;
          name?: string;
          nim_prefix?: string | null;
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
      dm_conversations: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          is_group: boolean;
          group_key: string | null;
          group_name: string | null;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          is_group?: boolean;
          group_key?: string | null;
          group_name?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          is_group?: boolean;
          group_key?: string | null;
          group_name?: string | null;
        };
        Relationships: [];
      };
      dm_participants: {
        Row: {
          conversation_id: string;
          user_id: string;
          last_read_at: string | null;
          left_at: string | null;
          archived_at: string | null;
          is_archived: boolean;
          is_muted: boolean;
          is_pinned: boolean;
          last_seen_at: string | null;
          pinned_at: string | null;
          theme: string | null;
        };
        ComputedFields: never;
        Insert: {
          conversation_id: string;
          user_id: string;
          last_read_at?: string | null;
          left_at?: string | null;
          archived_at?: string | null;
          is_archived?: boolean;
          is_muted?: boolean;
          is_pinned?: boolean;
          last_seen_at?: string | null;
          pinned_at?: string | null;
          theme?: string | null;
        };
        Update: {
          conversation_id?: string;
          user_id?: string;
          last_read_at?: string | null;
          left_at?: string | null;
          archived_at?: string | null;
          is_archived?: boolean;
          is_muted?: boolean;
          is_pinned?: boolean;
          last_seen_at?: string | null;
          pinned_at?: string | null;
          theme?: string | null;
        };
        Relationships: [];
      };
      dm_messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          created_at: string;
          edited_at: string | null;
          deleted_at: string | null;
          attachment_mime: string | null;
          attachment_name: string | null;
          attachment_path: string | null;
          attachment_size: number | null;
          group_wraps: Json | null;
          is_pinned: boolean;
          key_epoch: number;
          reactions: Json;
          reply_to_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          created_at?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
          attachment_mime?: string | null;
          attachment_name?: string | null;
          attachment_path?: string | null;
          attachment_size?: number | null;
          group_wraps?: Json | null;
          is_pinned?: boolean;
          key_epoch?: number;
          reactions?: Json;
          reply_to_id?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          body?: string;
          created_at?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
          attachment_mime?: string | null;
          attachment_name?: string | null;
          attachment_path?: string | null;
          attachment_size?: number | null;
          group_wraps?: Json | null;
          is_pinned?: boolean;
          key_epoch?: number;
          reactions?: Json;
          reply_to_id?: string | null;
        };
        Relationships: [];
      };
      dm_blocks: {
        Row: {
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: {
          blocker_id?: string;
          blocked_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      dm_keys: {
        Row: {
          user_id: string;
          public_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          public_key: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          public_key?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      assignments_owner_reporting: {
        Row: {
          class_id: string | null;
          content_type: string;
          course_id: string;
          effective_owner_grain: string | null;
          id: string;
          offering_id: string | null;
          status: string;
          subject_id: string | null;
          university_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          class_id?: string | null;
          content_type?: string | null;
          course_id?: string | null;
          effective_owner_grain?: never;
          id?: string | null;
          offering_id?: string | null;
          status?: string | null;
          subject_id?: string | null;
          university_id?: string | null;
        };
        Update: {
          class_id?: string | null;
          content_type?: string | null;
          course_id?: string | null;
          effective_owner_grain?: never;
          id?: string | null;
          offering_id?: string | null;
          status?: string | null;
          subject_id?: string | null;
          university_id?: string | null;
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
            foreignKeyName: "assignments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes_legacy_vs_fk_gap";
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
      audit_logs_university_gap: {
        Row: {
          day: string | null;
          null_university_rows: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      classes_legacy_vs_fk_gap: {
        Row: {
          academic_year: string;
          id: string;
          missing_class_code: boolean | null;
          missing_semester_fk: boolean | null;
          missing_university_fk: boolean | null;
          missing_year_fk: boolean | null;
          semester: string;
        };
        ComputedFields: never;
        Insert: {
          academic_year?: string | null;
          id?: string | null;
          missing_class_code?: never;
          missing_semester_fk?: never;
          missing_university_fk?: never;
          missing_year_fk?: never;
          semester?: string | null;
        };
        Update: {
          academic_year?: string | null;
          id?: string | null;
          missing_class_code?: never;
          missing_semester_fk?: never;
          missing_university_fk?: never;
          missing_year_fk?: never;
          semester?: string | null;
        };
        Relationships: [];
      };
      discussion_sessions_domain_view: {
        Row: {
          assignment_id: string | null;
          cancelled_at: string | null;
          class_id: string;
          completed_at: string | null;
          ends_at: string;
          id: string;
          is_cancelled: boolean | null;
          is_completed: boolean | null;
          is_upcoming: boolean | null;
          meeting_type: string;
          organizer_id: string;
          starts_at: string;
          status: string;
          window_length: string | null;
        };
        ComputedFields: never;
        Insert: {
          assignment_id?: string | null;
          cancelled_at?: string | null;
          class_id?: string | null;
          completed_at?: string | null;
          ends_at?: string | null;
          id?: string | null;
          is_cancelled?: never;
          is_completed?: never;
          is_upcoming?: never;
          meeting_type?: string | null;
          organizer_id?: string | null;
          starts_at?: string | null;
          status?: string | null;
          window_length?: never;
        };
        Update: {
          assignment_id?: string | null;
          cancelled_at?: string | null;
          class_id?: string | null;
          completed_at?: string | null;
          ends_at?: string | null;
          id?: string | null;
          is_cancelled?: never;
          is_completed?: never;
          is_upcoming?: never;
          meeting_type?: string | null;
          organizer_id?: string | null;
          starts_at?: string | null;
          status?: string | null;
          window_length?: never;
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
            foreignKeyName: "discussion_sessions_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments_owner_reporting";
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
            foreignKeyName: "discussion_sessions_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes_legacy_vs_fk_gap";
            referencedColumns: ["id"];
          },
        ];
      };
      dual_write_drift: {
        Row: {
          legacy_members: number | null;
          legacy_without_new: number | null;
          new_memberships: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      nim_drift: {
        Row: {
          identities_total: number | null;
          prefixed: number | null;
          unprefixed: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      notification_daily_digest: {
        Row: {
          day: string | null;
          items: Json | null;
          total: number | null;
          user_id: string;
        };
        ComputedFields: never;
        Relationships: [];
      };
      observability_tenant_gap: {
        Row: {
          null_university_rows: number | null;
          source: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      semester_rollover_candidates: {
        Row: {
          old_code: string;
          old_status: string;
          old_year_id: string;
        };
        ComputedFields: never;
        Insert: {
          old_code?: string | null;
          old_status?: string | null;
          old_year_id?: string | null;
        };
        Update: {
          old_code?: string | null;
          old_status?: string | null;
          old_year_id?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      dm_get_or_create_conversation: {
        Args: { p_other: string };
        Returns: string;
      };
      create_or_get_course: {
        Args: {
          p_name: string;
          p_code?: string | null;
          p_department?: string | null;
        };
        Returns: Database["public"]["Tables"]["courses"]["Row"];
      };
      list_assignments: {
        Args: {
          p_search?: string | null;
          p_course_id?: string | null;
          p_semester?: string | null;
          p_type?: string | null;
          p_tag?: string | null;
          p_sort?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
          p_class_id?: string | null;
        };
        Returns: AssignmentListItem[];
      };
      list_platform_users: {
        Args: {
          p_search?: string | null;
          p_role?: string;
          p_onboarding?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
          onboarded_at: string | null;
          is_platform_admin: boolean;
          class_count: number;
          admin_class_count: number;
          total_count: number;
        }[];
      };
      list_platform_classes: {
        Args: {
          p_search?: string | null;
          p_status?: string;
          p_academic_year?: string | null;
          p_semester?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          slug: string;
          name: string;
          class_code: string | null;
          description: string;
          course_name: string;
          institution: string | null;
          lecturer_name: string | null;
          semester: string;
          academic_year: string;
          status: ClassStatusRow;
          archived_at: string | null;
          created_at: string;
          member_count: number;
          admin_count: number;
          subject_count: number;
          admin_names: string[];
          total_count: number;
        }[];
      };
      get_platform_admin_overview: {
        Args: Record<string, never>;
        Returns: {
          total_users: number;
          onboarded_users: number;
          platform_admins: number;
          pending_applications: number;
          approved_applications: number;
          rejected_applications: number;
          active_classes: number;
          archived_classes: number;
          published_assignments: number;
          unpublished_assignments: number;
          pending_reviews: number;
          pending_verifications: number;
        }[];
      };
      list_classes: {
        Args: {
          p_search?: string | null;
          p_semester?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: {
          id: string;
          slug: string;
          name: string;
          class_code: string | null;
          description: string;
          course_name: string;
          institution: string | null;
          lecturer_name: string | null;
          semester: string;
          academic_year: string;
          created_at: string;
          member_count: number;
          total_count: number;
        }[];
      };
      consume_rate_limit: {
        Args: {
          p_key: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      register_push_subscription: {
        Args: {
          p_endpoint: string;
          p_p256dh: string;
          p_auth: string;
          p_device_label?: string | null;
        };
        Returns: string | null;
      };
      delete_push_subscription: {
        Args: {
          p_endpoint: string;
        };
        Returns: boolean;
      };
      register_native_push_token: {
        Args: {
          p_token: string;
          p_platform: "android" | "ios";
          p_device_label?: string | null;
        };
        Returns: string | null;
      };
      delete_native_push_token: {
        Args: {
          p_token: string;
        };
        Returns: boolean;
      };
      claim_notification_deliveries: {
        Args: {
          p_now: string;
          p_limit?: number;
        };
        Returns: PushDeliveryClaim[];
      };
      list_reminder_audience: {
        Args: {
          p_assignment_ids: string[];
        };
        Returns: {
          assignment_id: string;
          user_id: string;
          pref_timezone: string;
          reminder_24h: boolean;
          reminder_3h: boolean;
        }[];
      };
      complete_notification_delivery: {
        Args: {
          p_id: string;
          p_status: string;
          p_error_category?: string | null;
          p_next_attempt_at?: string | null;
        };
        Returns: boolean;
      };
      developer_class_metrics: {
        Args: { p_limit?: number };
        Returns: {
          class_id: string;
          name: string;
          class_code: string | null;
          status: ClassStatusRow;
          academic_year: string;
          semester: string;
          member_count: number;
          admin_count: number;
          published_count: number;
          pending_review_count: number;
          session_count: number;
          attendance_count: number;
          leave_request_count: number;
          invitation_count: number;
          last_activity_at: string;
        }[];
      };
      developer_dashboard_metrics: {
        Args: {
          p_since_7: string;
          p_since_30: string;
        };
        Returns: {
          total_users: number;
          registrations_7: number;
          registrations_30: number;
          sign_ins_7: number;
          sign_ins_30: number;
          active_users_7: number;
          active_users_30: number;
          total_assignments: number;
        }[];
      };
      developer_database_health: {
        Args: Record<string, never>;
        Returns: Json;
      };
      developer_list_users: {
        Args: {
          p_search?: string | null;
          p_sort?: string;
          p_direction?: string;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          id: string;
          display_name: string | null;
          created_at: string;
          last_sign_in_at: string | null;
          total_count: number;
        }[];
      };
      developer_applied_migrations: {
        Args: Record<string, never>;
        Returns: Json;
      };
      can_publish_public_assignment: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_platform_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_beta_tester: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_class_member: {
        Args: { p_class_id: string };
        Returns: boolean;
      };
      is_class_admin: {
        Args: { p_class_id: string };
        Returns: boolean;
      };
      has_class_permission: {
        Args: { p_class_id: string; p_permission: string };
        Returns: boolean;
      };
      is_university_member: {
        Args: { p_university_id: string };
        Returns: boolean;
      };
      can_manage_class: {
        Args: { p_class_id: string };
        Returns: boolean;
      };
      apply_for_class: {
        Args: {
          p_proposed_slug: string;
          p_proposed_name: string;
          p_course_name: string;
          p_semester: string;
          p_academic_year: string;
          p_description: string;
          p_reason: string;
          p_institution?: string | null;
          p_lecturer_name?: string | null;
          p_supporting_info?: string | null;
          p_proposed_class_code?: string | null;
        };
        Returns: string;
      };
      revise_class_application: {
        Args: {
          p_application_id: string;
          p_proposed_slug: string;
          p_proposed_name: string;
          p_course_name: string;
          p_semester: string;
          p_academic_year: string;
          p_description: string;
          p_reason: string;
          p_institution?: string | null;
          p_lecturer_name?: string | null;
          p_supporting_info?: string | null;
          p_proposed_class_code?: string | null;
        };
        Returns: boolean;
      };
      withdraw_class_application: {
        Args: { p_application_id: string };
        Returns: boolean;
      };
      decide_class_application: {
        Args: {
          p_application_id: string;
          p_decision: string;
          p_note?: string | null;
          p_grant_class_admin?: boolean;
          p_initial_status?: string;
        };
        Returns: string | null;
      };
      create_class_as_student: {
        Args: {
          p_academic_year: string;
          p_course_name: string;
          p_description: string;
          p_join_policy?: string;
          p_proposed_name: string;
          p_proposed_slug: string;
          p_semester: string;
          p_university_id?: string;
        };
        Returns: string;
      };
      create_class_invitation: {
        Args: {
          p_class_id: string;
          p_token_hash: string;
          p_expires_at: string;
          p_max_uses?: number;
          p_email_restriction?: string | null;
        };
        Returns: string;
      };
      revoke_class_invitation: {
        Args: { p_invitation_id: string };
        Returns: boolean;
      };
      accept_class_invitation: {
        Args: { p_token: string };
        Returns: string;
      };
      assign_class_admin: {
        Args: { p_class_id: string; p_user_id: string };
        Returns: boolean;
      };
      revoke_class_admin: {
        Args: { p_class_id: string; p_user_id: string };
        Returns: boolean;
      };
      remove_class_member: {
        Args: { p_class_id: string; p_user_id: string };
        Returns: boolean;
      };
      set_class_join_policy: {
        Args: { p_class_id: string; p_policy: string };
        Returns: boolean;
      };
      set_class_status: {
        Args: { p_class_id: string; p_status: string };
        Returns: boolean;
      };
      delete_class: {
        Args: { p_class_id: string };
        Returns: boolean;
      };
      get_class_dependencies: {
        Args: { p_class_id: string };
        Returns: {
          class_status: ClassStatusRow;
          member_count: number;
          assignment_count: number;
          submission_count: number;
          session_count: number;
          attendance_count: number;
          schedule_count: number;
          calendar_event_count: number;
          leave_request_count: number;
          subject_count: number;
          invitation_count: number;
          has_history: boolean;
          can_delete: boolean;
        }[];
      };
      find_class_duplicates: {
        Args: {
          p_name: string;
          p_class_code: string | null;
          p_academic_year: string;
          p_semester: string;
          p_institution?: string | null;
          p_exclude_class_id?: string | null;
        };
        Returns: {
          class_id: string;
          slug: string;
          name: string;
          class_code: string | null;
          academic_year: string;
          semester: string;
          institution: string | null;
          status: ClassStatusRow;
          code_match: boolean;
          name_match: boolean;
        }[];
      };
      update_class_metadata: {
        Args: {
          p_class_id: string;
          p_name: string;
          p_description: string;
          p_course_name: string;
          p_semester: string;
          p_academic_year: string;
          p_institution?: string | null;
          p_lecturer_name?: string | null;
          p_class_code?: string | null;
        };
        Returns: boolean;
      };
      submit_class_assignment: {
        Args: {
          p_class_id: string;
          p_title: string;
          p_description: string;
          p_deadline?: string | null;
          p_assignment_type?: string | null;
          p_tags?: string[];
          p_reference_urls?: Json;
          p_content_type?: string;
          p_source_label?: string | null;
          p_drive_url?: string | null;
          p_subject_id?: string | null;
        };
        Returns: string;
      };
      revise_class_assignment: {
        Args: {
          p_assignment_id: string;
          p_title: string;
          p_description: string;
          p_deadline?: string | null;
          p_assignment_type?: string | null;
          p_tags?: string[];
          p_reference_urls?: Json;
        };
        Returns: boolean;
      };
      review_class_assignment: {
        Args: {
          p_assignment_id: string;
          p_decision: string;
          p_reason?: string | null;
        };
        Returns: string;
      };
      review_public_assignment: {
        Args: {
          p_assignment_id: string;
          p_decision: string;
          p_reason?: string | null;
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
      moderate_assignment: {
        Args: {
          p_assignment_id: string;
          p_action: string;
          p_reason?: string | null;
        };
        Returns: string;
      };
      remove_assignment_attachment: {
        Args: { p_attachment_id: string; p_reason?: string | null };
        Returns: string;
      };
      claim_notification_events: {
        Args: { p_now: string; p_limit?: number };
        Returns: NotificationEventClaim[];
      };
      mark_notification_events_read: {
        Args: { p_ids?: string[] | null };
        Returns: number;
      };
      complete_notification_event: {
        Args: {
          p_id: string;
          p_status: string;
          p_error_category?: string | null;
          p_next_attempt_at?: string | null;
        };
        Returns: boolean;
      };
      can_view_session: {
        Args: { p_session_id: string };
        Returns: boolean;
      };
      can_organize_class_sessions: {
        Args: { p_class_id: string };
        Returns: boolean;
      };
      create_discussion_session: {
        Args: {
          p_class_id: string;
          p_title: string;
          p_description: string;
          p_starts_at: string;
          p_ends_at: string;
          p_time_zone: string;
          p_session_type?: string;
          p_meeting_url?: string | null;
          p_location?: string | null;
          p_agenda?: string | null;
          p_capacity?: number | null;
          p_registration_deadline?: string | null;
          p_visibility?: string;
          p_assignment_id?: string | null;
        };
        Returns: string;
      };
      update_discussion_session: {
        Args: {
          p_session_id: string;
          p_title: string;
          p_description: string;
          p_starts_at: string;
          p_ends_at: string;
          p_time_zone: string;
          p_session_type?: string;
          p_meeting_url?: string | null;
          p_location?: string | null;
          p_agenda?: string | null;
          p_capacity?: number | null;
          p_registration_deadline?: string | null;
          p_visibility?: string;
          p_assignment_id?: string | null;
        };
        Returns: boolean;
      };
      set_discussion_session_status: {
        Args: { p_session_id: string; p_status: string };
        Returns: boolean;
      };
      rsvp_discussion_session: {
        Args: { p_session_id: string; p_status: string };
        Returns: Json;
      };
      cancel_session_rsvp: {
        Args: { p_session_id: string };
        Returns: boolean;
      };
      check_in_discussion_session: {
        Args: {
          p_session_id: string;
          p_latitude: number;
          p_longitude: number;
          p_accuracy_m: number;
        };
        Returns: Json;
      };
      create_attendance_meeting: {
        Args: {
          p_class_id: string;
          p_subject_id: string;
          p_meeting_number: number;
          p_meeting_date: string;
          p_starts_at: string;
          p_ends_at: string;
          p_opens_at: string | null;
          p_closes_at: string | null;
          p_location: string;
          p_late_after_minutes?: number;
          p_latitude?: number | null;
          p_longitude?: number | null;
          p_radius_m?: number;
          p_title?: string | null;
        };
        Returns: string;
      };
      open_attendance_meeting: {
        Args: { p_session_id: string };
        Returns: boolean;
      };
      close_attendance_meeting: {
        Args: { p_session_id: string; p_finalize?: boolean };
        Returns: number;
      };
      reopen_attendance_meeting: {
        Args: { p_session_id: string };
        Returns: number;
      };
      update_attendance_meeting_location: {
        Args: {
          p_session_id: string;
          p_latitude: number;
          p_longitude: number;
          p_radius_m: number;
          p_reason: string;
        };
        Returns: boolean;
      };
      check_in_attendance_meeting: {
        Args: {
          p_session_id: string;
          p_full_name: string;
          p_nim: string;
          p_latitude: number;
          p_longitude: number;
          p_accuracy_m: number;
        };
        Returns: Json;
      };
      attendance_meeting_roster: {
        Args: { p_session_id: string };
        Returns: {
          user_id: string;
          full_name: string;
          nim: string | null;
          display_name: string | null;
          joined_at: string;
          eligible: boolean;
          status: string;
          method: SessionCheckInMethodRow | null;
          checked_in_at: string | null;
          distance_m: number | null;
          accuracy_m: number | null;
          note: string | null;
          reviewed_at: string | null;
          identity_verified: boolean;
        }[];
      };
      attendance_meeting_failures: {
        Args: { p_session_id: string };
        Returns: {
          user_id: string;
          display_name: string | null;
          outcome: string;
          distance_m: number | null;
          accuracy_m: number | null;
          created_at: string;
        }[];
      };
      attendance_correction_audit_list: {
        Args: { p_class_id: string; p_subject_id?: string | null };
        Returns: {
          id: string;
          session_id: string;
          meeting_number: number | null;
          meeting_date: string | null;
          student_id: string;
          student_nim: string | null;
          student_name: string;
          subject_id: string | null;
          subject_name: string | null;
          previous_status: string;
          new_status: string;
          reason: string;
          physically_verified: boolean;
          verification_method: string;
          admin_name: string;
          created_at: string;
        }[];
      };
      record_attendance_correction: {
        Args: {
          p_session_id: string;
          p_user_id: string;
          p_status: string;
          p_reason: string;
          p_physically_verified?: boolean;
        };
        Returns: string;
      };
      class_attendance_roster: {
        Args: { p_class_id: string };
        Returns: {
          user_id: string;
          full_name: string;
          nim: string | null;
          display_name: string | null;
          joined_at: string;
        }[];
      };
      class_attendance_recap: {
        Args: { p_class_id: string; p_subject_id: string };
        Returns: {
          session_id: string;
          meeting_number: number;
          meeting_date: string | null;
          starts_at: string;
          ends_at: string;
          title: string;
          location: string | null;
          attendance_opens_at: string | null;
          attendance_closes_at: string | null;
          attendance_opened_at: string | null;
          attendance_closed_at: string | null;
          attendance_finalized_at: string | null;
          user_id: string;
          full_name: string;
          nim: string | null;
          joined_at: string;
          eligible: boolean;
          status: string;
        }[];
      };
      class_attendance_meeting_list: {
        Args: { p_class_id: string };
        Returns: {
          session_id: string;
          subject_id: string;
          subject_name: string;
          subject_code: string | null;
          meeting_number: number;
          meeting_date: string | null;
          title: string;
          location: string | null;
          starts_at: string;
          ends_at: string;
          attendance_opens_at: string | null;
          attendance_closes_at: string | null;
          attendance_opened_at: string | null;
          attendance_closed_at: string | null;
          attendance_finalized_at: string | null;
          radius_m: number;
          late_after_minutes: number;
          expected_count: number;
          present_count: number;
          late_count: number;
          excused_count: number;
          sick_count: number;
          absent_count: number;
          not_recorded_count: number;
          failed_count: number;
        }[];
      };
      log_attendance_export: {
        Args: {
          p_class_id: string;
          p_subject_id: string | null;
          p_session_id: string | null;
          p_kind: string;
        };
        Returns: undefined;
      };
      set_discussion_session_checkin_location: {
        Args: {
          p_session_id: string;
          p_latitude: number;
          p_longitude: number;
          p_radius_m?: number;
        };
        Returns: boolean;
      };
      clear_discussion_session_checkin_location: {
        Args: { p_session_id: string };
        Returns: boolean;
      };
      review_discussion_session_checkin: {
        Args: {
          p_session_id: string;
          p_checkin_id: string;
          p_status: string;
          p_note?: string | null;
        };
        Returns: boolean;
      };
      record_discussion_session_checkin: {
        Args: {
          p_session_id: string;
          p_user_id: string;
          p_status: string;
          p_note?: string | null;
        };
        Returns: string;
      };
      class_attendance_member_summary: {
        Args: { p_class_id: string };
        Returns: {
          user_id: string;
          joined_at: string;
          present_count: number;
          late_count: number;
          excused_count: number;
          absent_count: number;
          unrecorded_count: number;
          pending_count: number;
        }[];
      };
      class_attendance_session_summary: {
        Args: { p_class_id: string };
        Returns: {
          session_id: string;
          expected_count: number;
          present_count: number;
          late_count: number;
          excused_count: number;
          absent_count: number;
          unrecorded_count: number;
          pending_count: number;
        }[];
      };
      session_attendance: {
        Args: { p_session_id: string };
        Returns: SessionAttendanceRow[];
      };
      session_checkin_summary: {
        Args: { p_session_id: string };
        Returns: { has_location: boolean; radius_m: number }[];
      };
      session_checkin_summary_many: {
        Args: { p_session_ids: string[] };
        Returns: {
          session_id: string;
          has_location: boolean;
          radius_m: number;
        }[];
      };
      list_discussion_sessions: {
        Args: {
          p_class_id?: string | null;
          p_status?: string | null;
          p_type?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: SessionListRow[];
      };
      list_session_reminder_audience: {
        Args: { p_session_ids: string[] };
        Returns: {
          session_id: string;
          user_id: string;
          pref_timezone: string;
          reminder_24h: boolean;
          reminder_3h: boolean;
        }[];
      };
      list_course_component_grades: {
        Args: { p_class_id: string; p_subject_id: string };
        Returns: Json;
      };
      set_course_component_grade: {
        Args: {
          p_class_id: string;
          p_subject_id: string;
          p_student_id: string;
          p_component: string;
          p_score: number;
        };
        Returns: number;
      };
      claim_session_reminders: {
        Args: { p_now: string; p_limit?: number };
        Returns: SessionReminderClaim[];
      };
      complete_session_reminder: {
        Args: {
          p_id: string;
          p_status: string;
          p_error_category?: string | null;
          p_next_attempt_at?: string | null;
        };
        Returns: boolean;
      };
      create_leave_request: {
        Args: {
          p_class_id: string;
          p_leave_start_date?: string | null;
          p_leave_end_date?: string | null;
          p_reason_category?: string | null;
          p_explanation?: string | null;
          p_document_issue_date?: string | null;
        };
        Returns: { id: string; reference: string }[];
      };
      update_leave_request: {
        Args: {
          p_request_id: string;
          p_leave_start_date: string | null;
          p_leave_end_date: string | null;
          p_reason_category: string | null;
          p_explanation: string | null;
          p_document_issue_date: string | null;
        };
        Returns: undefined;
      };
      record_leave_request_ocr: {
        Args: {
          p_request_id: string;
          p_provider: string;
          p_status: string;
          p_result: Json;
        };
        Returns: undefined;
      };
      confirm_leave_request_ocr: {
        Args: { p_request_id: string; p_field_sources: Json };
        Returns: undefined;
      };
      add_leave_request_evidence: {
        Args: {
          p_request_id: string;
          p_storage_path: string;
          p_original_filename: string;
          p_mime_type: string;
          p_file_size: number;
        };
        Returns: string;
      };
      remove_leave_request_evidence: {
        Args: { p_evidence_id: string };
        Returns: string;
      };
      submit_leave_request: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
      cancel_leave_request: {
        Args: { p_request_id: string; p_note?: string | null };
        Returns: undefined;
      };
      review_leave_request: {
        Args: {
          p_request_id: string;
          p_decision: string;
          p_note?: string | null;
        };
        Returns: string;
      };
      complete_leave_forwarding: {
        Args: {
          p_class_id: string;
          p_request_ids: string[];
          p_recipient_name: string;
          p_recipient_email: string | null;
          p_report_reference: string;
          p_report_format: string;
          p_idempotency_key: string;
        };
        Returns: { id: string; reference: string; request_count: number }[];
      };
      can_view_leave_request: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      can_review_leave_request: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      is_leave_request_owner: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      leave_request_id_from_object_path: {
        Args: { p_name: string };
        Returns: string | null;
      };
      get_my_declared_position: {
        Args: Record<string, never>;
        Returns: string;
      };
      become_class_representative: {
        Args: { p_class_id: string };
        Returns: string;
      };
      set_my_declared_position: {
        Args: { p_position: string };
        Returns: string;
      };
      begin_class_verification: {
        Args: { p_class_id: string; p_statement?: string | null };
        Returns: string;
      };
      revise_class_verification: {
        Args: { p_request_id: string; p_statement?: string | null };
        Returns: boolean;
      };
      add_class_verification_evidence: {
        Args: {
          p_request_id: string;
          p_storage_path: string;
          p_original_filename: string;
          p_mime_type: string;
          p_file_size: number;
        };
        Returns: string;
      };
      remove_class_verification_evidence: {
        Args: { p_evidence_id: string };
        Returns: string;
      };
      submit_class_verification: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
      discard_class_verification: {
        Args: { p_request_id: string };
        Returns: string[];
      };
      decide_class_verification: {
        Args: {
          p_request_id: string;
          p_decision: string;
          p_note?: string | null;
        };
        Returns: string;
      };
      revoke_verified_class_admin: {
        Args: { p_request_id: string; p_note: string };
        Returns: boolean;
      };
      can_view_class_verification: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      can_edit_class_verification: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      is_class_verification_owner: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      verification_request_id_from_object_path: {
        Args: { p_name: string };
        Returns: string | null;
      };
      get_my_profile: {
        Args: Record<string, never>;
        Returns: Json;
      };
      update_my_bio: {
        Args: { p_bio: string };
        Returns: string | null;
      };
      list_class_member_bios: {
        Args: { p_class_id: string };
        Returns: { user_id: string; bio: string | null }[];
      };
      update_my_profile: {
        Args: {
          p_full_name: string;
          p_nickname: string;
          p_nim: string | null;
          p_university: string;
          p_declared_class?: string | null;
        };
        Returns: Json;
      };
      set_my_avatar_url: {
        Args: { p_avatar_url: string };
        Returns: undefined;
      };
      set_leave_request_subjects: {
        Args: { p_request_id: string; p_subject_ids: string[] };
        Returns: undefined;
      };
      set_class_media: {
        Args: {
          p_class_id: string;
          p_avatar_url?: string | null;
          p_cover_url?: string | null;
        };
        Returns: undefined;
      };
      join_class_by_name: {
        Args: { p_class_name: string };
        Returns: Json;
      };
      get_invitation_preview: {
        Args: { p_token: string };
        Returns: Json;
      };
      accept_pending_invitation: {
        Args: { p_invitation_id: string };
        Returns: string;
      };
      decline_class_invitation: {
        Args: { p_invitation_id: string };
        Returns: boolean;
      };
      create_class_subject: {
        Args: {
          p_class_id: string;
          p_name: string;
          p_code?: string | null;
          p_description?: string | null;
          p_lecturer_name?: string | null;
        };
        Returns: string;
      };
      update_class_subject: {
        Args: {
          p_subject_id: string;
          p_name?: string | null;
          p_code?: string | null;
          p_description?: string | null;
          p_lecturer_name?: string | null;
          p_status?: string;
        };
        Returns: boolean;
      };
      delete_class_subject: {
        Args: { p_subject_id: string };
        Returns: boolean;
      };
      normalize_class_key: {
        Args: { p_value: string };
        Returns: string | null;
      };
      report_assignment: {
        Args: {
          p_assignment_id: string;
          p_reason: string;
          p_note?: string | null;
        };
        Returns: string;
      };
      review_assignment_report: {
        Args: { p_report_id: string; p_status: string; p_note?: string | null };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
