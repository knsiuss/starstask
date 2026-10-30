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

export type LeaveRequestStatusRow =
  "draft" | "submitted" | "forwarded" | "cancelled";

export type LeaveReasonCategoryRow = "illness" | "family_matter" | "other";

export type LeaveOcrStatusRow =
  "not_run" | "pending" | "succeeded" | "failed" | "unsupported";

export type LeaveReportFormatRow = "summary" | "complete";

export type ClassStatusRow = "active" | "archived";

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
  | "leave_request_cancelled"
  | "verification_submitted"
  | "verification_approved"
  | "verification_rejected"
  | "verification_revision_requested"
  | "class_admin_revoked"
  | "class_assignment_published";

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

export type SessionCheckInStatusRow = "present" | "late" | "excused" | "absent";

export type SessionCheckInMethodRow = "geo" | "manual";

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
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code?: string | null;
          department?: string | null;
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
          created_at: string;
          updated_at: string;
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
          original_filename: string;
          mime_type: string;
          file_size: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          storage_path: string;
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
      classes: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string;
          course_id: string;
          course_name: string;
          institution: string | null;
          lecturer_name: string | null;
          semester: string;
          academic_year: string;
          status: ClassStatusRow;
          join_policy: "invitation" | "open";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description: string;
          course_id: string;
          course_name: string;
          institution?: string | null;
          lecturer_name?: string | null;
          semester: string;
          academic_year: string;
          status?: ClassStatusRow;
          join_policy?: "invitation" | "open";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string;
          course_id?: string;
          course_name?: string;
          institution?: string | null;
          lecturer_name?: string | null;
          semester?: string;
          academic_year?: string;
          status?: ClassStatusRow;
          join_policy?: "invitation" | "open";
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
      notification_events: {
        Row: {
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
        };
        Update: {
          status?: DeliveryStatusRow;
          attempt_count?: number;
          next_attempt_at?: string;
          last_error_category?: string | null;
          sent_at?: string | null;
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
          accuracy_m: number | null;
          distance_m: number | null;
          note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
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
          accuracy_m?: number | null;
          distance_m?: number | null;
          note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: SessionCheckInStatusRow;
          note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
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
      leave_requests: {
        Row: {
          id: string;
          reference: string;
          student_id: string;
          class_id: string;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          actor_id?: string | null;
          action: string;
          note?: string | null;
          metadata?: Json;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          invitation_id: string;
          user_id: string;
          created_at?: string;
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
    };
    Views: { [_ in never]: never };
    Functions: {
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
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          slug: string;
          name: string;
          description: string;
          course_name: string;
          institution: string | null;
          lecturer_name: string | null;
          semester: string;
          academic_year: string;
          status: ClassStatusRow;
          created_at: string;
          member_count: number;
          admin_count: number;
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
      developer_applied_migrations: {
        Args: Record<string, never>;
        Returns: Json;
      };
      is_platform_admin: {
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
        };
        Returns: string | null;
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
      set_class_status: {
        Args: { p_class_id: string; p_status: string };
        Returns: boolean;
      };
      delete_class: {
        Args: { p_class_id: string };
        Returns: boolean;
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
      publish_class_assignment: {
        Args: { p_assignment_id: string };
        Returns: boolean;
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
      session_attendance: {
        Args: { p_session_id: string };
        Returns: SessionAttendanceRow[];
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
          p_nim: string;
          p_university: string;
          p_declared_class?: string | null;
        };
        Returns: Json;
      };
      set_my_avatar_url: {
        Args: { p_avatar_url: string };
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
