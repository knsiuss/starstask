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
  | "moderation_required";

export type PushReminderTypeRow = "24h" | "3h";

export type DeliveryStatusRow =
  "pending" | "processing" | "sent" | "failed" | "skipped";

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
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          avatar_url?: string | null;
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
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          push_enabled?: boolean;
          reminder_24h?: boolean;
          reminder_3h?: boolean;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          push_enabled?: boolean;
          reminder_24h?: boolean;
          reminder_3h?: boolean;
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
          joined_via: "invitation" | "admin_assignment" | "platform_assignment";
          joined_at: string;
        };
        Insert: {
          class_id: string;
          user_id: string;
          joined_via?:
            "invitation" | "admin_assignment" | "platform_assignment";
          joined_at?: string;
        };
        Update: {
          joined_via?:
            "invitation" | "admin_assignment" | "platform_assignment";
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
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
