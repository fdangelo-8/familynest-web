export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      calendar_accounts: {
        Row: {
          connected_at: string;
          created_at: string;
          credentials_ciphertext: string;
          email: string;
          failing_since: string | null;
          household_id: string;
          id: string;
          is_fake: boolean;
          last_synced_at: string | null;
          member_id: string;
          member_kind: Database["public"]["Enums"]["member_kind"];
          provider: Database["public"]["Enums"]["calendar_provider"];
          provider_account_id: string;
          status: Database["public"]["Enums"]["calendar_account_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          connected_at?: string;
          created_at?: string;
          credentials_ciphertext: string;
          email: string;
          failing_since?: string | null;
          household_id: string;
          id?: string;
          is_fake?: boolean;
          last_synced_at?: string | null;
          member_id: string;
          member_kind?: Database["public"]["Enums"]["member_kind"];
          provider: Database["public"]["Enums"]["calendar_provider"];
          provider_account_id: string;
          status?: Database["public"]["Enums"]["calendar_account_status"];
          updated_at?: string;
        };
        Update: {
          connected_at?: string;
          created_at?: string;
          credentials_ciphertext?: string;
          email?: string;
          failing_since?: string | null;
          household_id?: string;
          id?: string;
          is_fake?: boolean;
          last_synced_at?: string | null;
          member_id?: string;
          member_kind?: Database["public"]["Enums"]["member_kind"];
          provider?: Database["public"]["Enums"]["calendar_provider"];
          provider_account_id?: string;
          status?: Database["public"]["Enums"]["calendar_account_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_accounts_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_accounts_member_fkey";
            columns: ["member_id", "household_id", "member_kind"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id", "kind"];
          },
        ];
      };
      calendar_credential_revocations: {
        Row: {
          created_at: string;
          credentials_ciphertext: string;
          id: string;
          is_fake: boolean;
          provider: Database["public"]["Enums"]["calendar_provider"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          credentials_ciphertext: string;
          id?: string;
          is_fake: boolean;
          provider: Database["public"]["Enums"]["calendar_provider"];
        };
        Update: {
          created_at?: string;
          credentials_ciphertext?: string;
          id?: string;
          is_fake?: boolean;
          provider?: Database["public"]["Enums"]["calendar_provider"];
        };
        Relationships: [];
      };
      calendar_outbox: {
        Row: {
          action: Database["public"]["Enums"]["calendar_outbox_action"];
          attempts: number;
          calendar_id: string;
          changed_while_claimed: boolean;
          claim_token: string | null;
          claimed_until: string | null;
          created_at: string;
          event_id: string | null;
          household_id: string;
          id: string;
          next_attempt_at: string;
          provider_event_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: Database["public"]["Enums"]["calendar_outbox_action"];
          attempts?: number;
          calendar_id: string;
          changed_while_claimed?: boolean;
          claim_token?: string | null;
          claimed_until?: string | null;
          created_at?: string;
          event_id?: string | null;
          household_id: string;
          id?: string;
          next_attempt_at?: string;
          provider_event_id?: string | null;
        };
        Update: {
          action?: Database["public"]["Enums"]["calendar_outbox_action"];
          attempts?: number;
          calendar_id?: string;
          changed_while_claimed?: boolean;
          claim_token?: string | null;
          claimed_until?: string | null;
          created_at?: string;
          event_id?: string | null;
          household_id?: string;
          id?: string;
          next_attempt_at?: string;
          provider_event_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_outbox_calendar_fkey";
            columns: ["calendar_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "external_calendars";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "calendar_outbox_event_fkey";
            columns: ["event_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "calendar_outbox_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      child_profiles: {
        Row: {
          clothing_size: string | null;
          created_at: string;
          household_id: string;
          id: string;
          member_id: string;
          member_kind: Database["public"]["Enums"]["member_kind"];
          pajama_size: string | null;
          school_class: string | null;
          school_days: number[];
          school_ends_at: string | null;
          school_name: string | null;
          school_note: string | null;
          school_starts_at: string | null;
          shoe_size: string | null;
          sizes_updated_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          clothing_size?: string | null;
          created_at?: string;
          household_id?: string;
          id?: string;
          member_id: string;
          member_kind?: Database["public"]["Enums"]["member_kind"];
          pajama_size?: string | null;
          school_class?: string | null;
          school_days?: number[];
          school_ends_at?: string | null;
          school_name?: string | null;
          school_note?: string | null;
          school_starts_at?: string | null;
          shoe_size?: string | null;
          sizes_updated_at?: string | null;
          updated_at?: string;
        };
        Update: {
          clothing_size?: string | null;
          created_at?: string;
          household_id?: string;
          id?: string;
          member_id?: string;
          member_kind?: Database["public"]["Enums"]["member_kind"];
          pajama_size?: string | null;
          school_class?: string | null;
          school_days?: number[];
          school_ends_at?: string | null;
          school_name?: string | null;
          school_note?: string | null;
          school_starts_at?: string | null;
          shoe_size?: string | null;
          sizes_updated_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "child_profiles_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "child_profiles_member_fkey";
            columns: ["member_id", "household_id", "member_kind"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id", "kind"];
          },
        ];
      };
      child_teachers: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          member_id: string;
          member_kind: Database["public"]["Enums"]["member_kind"];
          name: string;
          phone: string | null;
          sort_order: number;
          subject: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          household_id?: string;
          id?: string;
          member_id: string;
          member_kind?: Database["public"]["Enums"]["member_kind"];
          name: string;
          phone?: string | null;
          sort_order: number;
          subject?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          id?: string;
          member_id?: string;
          member_kind?: Database["public"]["Enums"]["member_kind"];
          name?: string;
          phone?: string | null;
          sort_order?: number;
          subject?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "child_teachers_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "child_teachers_member_fkey";
            columns: ["member_id", "household_id", "member_kind"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id", "kind"];
          },
        ];
      };
      consent_records: {
        Row: {
          created_at: string;
          granted: boolean;
          id: string;
          kind: Database["public"]["Enums"]["consent_kind"];
          privacy_version_id: string | null;
          source: Database["public"]["Enums"]["consent_source"];
          terms_version_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          granted: boolean;
          id?: string;
          kind: Database["public"]["Enums"]["consent_kind"];
          privacy_version_id?: string | null;
          source: Database["public"]["Enums"]["consent_source"];
          terms_version_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          granted?: boolean;
          id?: string;
          kind?: Database["public"]["Enums"]["consent_kind"];
          privacy_version_id?: string | null;
          source?: Database["public"]["Enums"]["consent_source"];
          terms_version_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consent_records_privacy_version_id_fkey";
            columns: ["privacy_version_id"];
            isOneToOne: false;
            referencedRelation: "legal_document_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consent_records_terms_version_id_fkey";
            columns: ["terms_version_id"];
            isOneToOne: false;
            referencedRelation: "legal_document_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      data_exports: {
        Row: {
          created_at: string;
          expires_at: string | null;
          id: string;
          ready_at: string | null;
          requested_at: string;
          size_bytes: number | null;
          status: Database["public"]["Enums"]["data_export_status"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          ready_at?: string | null;
          requested_at?: string;
          size_bytes?: number | null;
          status?: Database["public"]["Enums"]["data_export_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          ready_at?: string | null;
          requested_at?: string;
          size_bytes?: number | null;
          status?: Database["public"]["Enums"]["data_export_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      deadline_assignees: {
        Row: {
          created_at: string;
          deadline_id: string;
          household_id: string;
          member_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deadline_id: string;
          household_id?: string;
          member_id: string;
        };
        Update: {
          created_at?: string;
          deadline_id?: string;
          household_id?: string;
          member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deadline_assignees_deadline_fkey";
            columns: ["deadline_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "deadlines";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "deadline_assignees_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deadline_assignees_member_fkey";
            columns: ["member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      deadlines: {
        Row: {
          assignee_member_id: string | null;
          created_at: string;
          created_by_member_id: string | null;
          due_date: string;
          for_member_id: string | null;
          household_id: string;
          id: string;
          is_private: boolean;
          note: string | null;
          recurrence: Database["public"]["Enums"]["deadline_recurrence"];
          recurrence_interval_days: number | null;
          reminder_days: number[];
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assignee_member_id?: string | null;
          created_at?: string;
          created_by_member_id?: string | null;
          due_date: string;
          for_member_id?: string | null;
          household_id?: string;
          id?: string;
          is_private?: boolean;
          note?: string | null;
          recurrence?: Database["public"]["Enums"]["deadline_recurrence"];
          recurrence_interval_days?: number | null;
          reminder_days?: number[];
          title: string;
          updated_at?: string;
        };
        Update: {
          assignee_member_id?: string | null;
          created_at?: string;
          created_by_member_id?: string | null;
          due_date?: string;
          for_member_id?: string | null;
          household_id?: string;
          id?: string;
          is_private?: boolean;
          note?: string | null;
          recurrence?: Database["public"]["Enums"]["deadline_recurrence"];
          recurrence_interval_days?: number | null;
          reminder_days?: number[];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deadlines_assignee_fkey";
            columns: ["assignee_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "deadlines_created_by_fkey";
            columns: ["created_by_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "deadlines_for_member_fkey";
            columns: ["for_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "deadlines_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      event_exceptions: {
        Row: {
          created_at: string;
          ends_at: string | null;
          escort_member_id: string | null;
          escort_undecided: boolean;
          event_id: string;
          household_id: string;
          is_cancelled: boolean;
          location: string | null;
          notes: string | null;
          occurrence_date: string;
          pickup_member_id: string | null;
          pickup_undecided: boolean;
          starts_at: string | null;
          title: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ends_at?: string | null;
          escort_member_id?: string | null;
          escort_undecided?: boolean;
          event_id: string;
          household_id?: string;
          is_cancelled?: boolean;
          location?: string | null;
          notes?: string | null;
          occurrence_date: string;
          pickup_member_id?: string | null;
          pickup_undecided?: boolean;
          starts_at?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string | null;
          escort_member_id?: string | null;
          escort_undecided?: boolean;
          event_id?: string;
          household_id?: string;
          is_cancelled?: boolean;
          location?: string | null;
          notes?: string | null;
          occurrence_date?: string;
          pickup_member_id?: string | null;
          pickup_undecided?: boolean;
          starts_at?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_exceptions_escort_fkey";
            columns: ["escort_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "event_exceptions_event_fkey";
            columns: ["event_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "event_exceptions_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_exceptions_pickup_fkey";
            columns: ["pickup_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      event_external_links: {
        Row: {
          calendar_id: string;
          created_at: string;
          event_id: string;
          household_id: string;
          id: string;
          is_busy_on_provider: boolean;
          is_private_on_provider: boolean;
          occurrence_key: string;
          origin: Database["public"]["Enums"]["external_event_origin"];
          provider_event_id: string;
          provider_version: string | null;
          updated_at: string;
          visibility_overridden: boolean;
        };
        ComputedFields: never;
        Insert: {
          calendar_id: string;
          created_at?: string;
          event_id: string;
          household_id: string;
          id?: string;
          is_busy_on_provider?: boolean;
          is_private_on_provider?: boolean;
          occurrence_key?: string;
          origin: Database["public"]["Enums"]["external_event_origin"];
          provider_event_id: string;
          provider_version?: string | null;
          updated_at?: string;
          visibility_overridden?: boolean;
        };
        Update: {
          calendar_id?: string;
          created_at?: string;
          event_id?: string;
          household_id?: string;
          id?: string;
          is_busy_on_provider?: boolean;
          is_private_on_provider?: boolean;
          occurrence_key?: string;
          origin?: Database["public"]["Enums"]["external_event_origin"];
          provider_event_id?: string;
          provider_version?: string | null;
          updated_at?: string;
          visibility_overridden?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "event_external_links_calendar_fkey";
            columns: ["calendar_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "external_calendars";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "event_external_links_event_fkey";
            columns: ["event_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "event_external_links_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      event_members: {
        Row: {
          created_at: string;
          event_id: string;
          household_id: string;
          member_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_id: string;
          household_id?: string;
          member_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          household_id?: string;
          member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_members_event_fkey";
            columns: ["event_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "event_members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_members_member_fkey";
            columns: ["member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      event_viewers: {
        Row: {
          created_at: string;
          event_id: string;
          household_id: string;
          member_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_id: string;
          household_id?: string;
          member_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          household_id?: string;
          member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_viewers_event_fkey";
            columns: ["event_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "event_viewers_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_viewers_member_fkey";
            columns: ["member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      events: {
        Row: {
          all_day: boolean;
          author_member_id: string | null;
          created_at: string;
          ends_at: string;
          escort_member_id: string | null;
          escort_undecided: boolean;
          household_id: string;
          id: string;
          location: string | null;
          notes: string | null;
          pickup_member_id: string | null;
          pickup_undecided: boolean;
          recurrence: Database["public"]["Enums"]["event_recurrence"];
          recurrence_until: string | null;
          recurrence_weekdays: number[] | null;
          remind_rides: boolean;
          reminder_minutes_before: number | null;
          starts_at: string;
          title: string;
          unverified_fields: Database["public"]["Enums"]["event_field"][];
          updated_at: string;
          visibility: Database["public"]["Enums"]["event_visibility"];
        };
        ComputedFields: never;
        Insert: {
          all_day?: boolean;
          author_member_id?: string | null;
          created_at?: string;
          ends_at: string;
          escort_member_id?: string | null;
          escort_undecided?: boolean;
          household_id?: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          pickup_member_id?: string | null;
          pickup_undecided?: boolean;
          recurrence?: Database["public"]["Enums"]["event_recurrence"];
          recurrence_until?: string | null;
          recurrence_weekdays?: number[] | null;
          remind_rides?: boolean;
          reminder_minutes_before?: number | null;
          starts_at: string;
          title: string;
          unverified_fields?: Database["public"]["Enums"]["event_field"][];
          updated_at?: string;
          visibility: Database["public"]["Enums"]["event_visibility"];
        };
        Update: {
          all_day?: boolean;
          author_member_id?: string | null;
          created_at?: string;
          ends_at?: string;
          escort_member_id?: string | null;
          escort_undecided?: boolean;
          household_id?: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          pickup_member_id?: string | null;
          pickup_undecided?: boolean;
          recurrence?: Database["public"]["Enums"]["event_recurrence"];
          recurrence_until?: string | null;
          recurrence_weekdays?: number[] | null;
          remind_rides?: boolean;
          reminder_minutes_before?: number | null;
          starts_at?: string;
          title?: string;
          unverified_fields?: Database["public"]["Enums"]["event_field"][];
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["event_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "events_author_fkey";
            columns: ["author_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "events_escort_fkey";
            columns: ["escort_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "events_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_pickup_fkey";
            columns: ["pickup_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      external_calendars: {
        Row: {
          account_id: string;
          counts_for_free_time: boolean;
          created_at: string;
          direction: Database["public"]["Enums"]["calendar_direction"];
          failing_since: string | null;
          household_id: string;
          id: string;
          is_enabled: boolean;
          is_new_events_target: boolean;
          is_primary: boolean;
          is_read_only: boolean;
          last_synced_at: string | null;
          member_id: string;
          name: string;
          provider_calendar_id: string;
          sync_cursor: string | null;
          updated_at: string;
          visibility: Database["public"]["Enums"]["event_visibility"];
          weekdays_only: boolean;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          counts_for_free_time?: boolean;
          created_at?: string;
          direction?: Database["public"]["Enums"]["calendar_direction"];
          failing_since?: string | null;
          household_id: string;
          id?: string;
          is_enabled?: boolean;
          is_new_events_target?: boolean;
          is_primary?: boolean;
          is_read_only?: boolean;
          last_synced_at?: string | null;
          member_id: string;
          name: string;
          provider_calendar_id: string;
          sync_cursor?: string | null;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["event_visibility"];
          weekdays_only?: boolean;
        };
        Update: {
          account_id?: string;
          counts_for_free_time?: boolean;
          created_at?: string;
          direction?: Database["public"]["Enums"]["calendar_direction"];
          failing_since?: string | null;
          household_id?: string;
          id?: string;
          is_enabled?: boolean;
          is_new_events_target?: boolean;
          is_primary?: boolean;
          is_read_only?: boolean;
          last_synced_at?: string | null;
          member_id?: string;
          name?: string;
          provider_calendar_id?: string;
          sync_cursor?: string | null;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["event_visibility"];
          weekdays_only?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "external_calendars_account_fkey";
            columns: ["account_id", "household_id", "member_id"];
            isOneToOne: false;
            referencedRelation: "calendar_accounts";
            referencedColumns: ["id", "household_id", "member_id"];
          },
          {
            foreignKeyName: "external_calendars_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      household_members: {
        Row: {
          birth_date: string | null;
          color: Database["public"]["Enums"]["member_color"];
          created_at: string;
          household_id: string;
          id: string;
          is_admin: boolean;
          joined_at: string | null;
          kind: Database["public"]["Enums"]["member_kind"];
          name: string;
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          birth_date?: string | null;
          color: Database["public"]["Enums"]["member_color"];
          created_at?: string;
          household_id: string;
          id?: string;
          is_admin?: boolean;
          joined_at?: string | null;
          kind: Database["public"]["Enums"]["member_kind"];
          name: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          birth_date?: string | null;
          color?: Database["public"]["Enums"]["member_color"];
          created_at?: string;
          household_id?: string;
          id?: string;
          is_admin?: boolean;
          joined_at?: string | null;
          kind?: Database["public"]["Enums"]["member_kind"];
          name?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      households: {
        Row: {
          created_at: string;
          first_shopping_item_at: string | null;
          household_type: Database["public"]["Enums"]["household_type"];
          id: string;
          name: string;
          starter_list_completed_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          first_shopping_item_at?: string | null;
          household_type: Database["public"]["Enums"]["household_type"];
          id?: string;
          name: string;
          starter_list_completed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          first_shopping_item_at?: string | null;
          household_type?: Database["public"]["Enums"]["household_type"];
          id?: string;
          name?: string;
          starter_list_completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          expires_at: string;
          household_id: string;
          id: string;
          invited_by_member_id: string | null;
          member_id: string;
          message: string | null;
          status: Database["public"]["Enums"]["invitation_status"];
          token: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          expires_at?: string;
          household_id: string;
          id?: string;
          invited_by_member_id?: string | null;
          member_id: string;
          message?: string | null;
          status?: Database["public"]["Enums"]["invitation_status"];
          token?: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          expires_at?: string;
          household_id?: string;
          id?: string;
          invited_by_member_id?: string | null;
          member_id?: string;
          message?: string | null;
          status?: Database["public"]["Enums"]["invitation_status"];
          token?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_invited_by_member_id_fkey";
            columns: ["invited_by_member_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id"];
          },
        ];
      };
      legal_document_versions: {
        Row: {
          created_at: string;
          document: Database["public"]["Enums"]["legal_document"];
          effective_from: string;
          id: string;
          notify_users: boolean;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          document: Database["public"]["Enums"]["legal_document"];
          effective_from: string;
          id?: string;
          notify_users?: boolean;
        };
        Update: {
          created_at?: string;
          document?: Database["public"]["Enums"]["legal_document"];
          effective_from?: string;
          id?: string;
          notify_users?: boolean;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          assigned_todos: boolean;
          created_at: string;
          deadlines: boolean;
          delivery_mode: Database["public"]["Enums"]["notification_delivery_mode"];
          digest_deadlines: boolean;
          digest_events: boolean;
          digest_rides: boolean;
          digest_shopping: boolean;
          digest_thanks: boolean;
          evening_digest_time: string;
          event_reminders: boolean;
          events: boolean;
          free_together: boolean;
          gifts: boolean;
          hide_content: boolean;
          household_id: string;
          id: string;
          member_id: string;
          morning_digest: boolean;
          quiet_hours: boolean;
          rides: boolean;
          shopping: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assigned_todos?: boolean;
          created_at?: string;
          deadlines?: boolean;
          delivery_mode?: Database["public"]["Enums"]["notification_delivery_mode"];
          digest_deadlines?: boolean;
          digest_events?: boolean;
          digest_rides?: boolean;
          digest_shopping?: boolean;
          digest_thanks?: boolean;
          evening_digest_time?: string;
          event_reminders?: boolean;
          events?: boolean;
          free_together?: boolean;
          gifts?: boolean;
          hide_content?: boolean;
          household_id?: string;
          id?: string;
          member_id: string;
          morning_digest?: boolean;
          quiet_hours?: boolean;
          rides?: boolean;
          shopping?: boolean;
          updated_at?: string;
        };
        Update: {
          assigned_todos?: boolean;
          created_at?: string;
          deadlines?: boolean;
          delivery_mode?: Database["public"]["Enums"]["notification_delivery_mode"];
          digest_deadlines?: boolean;
          digest_events?: boolean;
          digest_rides?: boolean;
          digest_shopping?: boolean;
          digest_thanks?: boolean;
          evening_digest_time?: string;
          event_reminders?: boolean;
          events?: boolean;
          free_together?: boolean;
          gifts?: boolean;
          hide_content?: boolean;
          household_id?: string;
          id?: string;
          member_id?: string;
          morning_digest?: boolean;
          quiet_hours?: boolean;
          rides?: boolean;
          shopping?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_preferences_member_fkey";
            columns: ["member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      notifications: {
        Row: {
          actor_member_id: string | null;
          created_at: string;
          created_on: string | null;
          days_before: number | null;
          deadline_id: string | null;
          evening_date: string | null;
          event_id: string | null;
          free_from: string | null;
          household_id: string;
          id: string;
          item_count: number | null;
          kind: Database["public"]["Enums"]["notification_kind"];
          occurrence_date: string | null;
          other_event_id: string | null;
          other_occurrence_date: string | null;
          read_at: string | null;
          recipient_member_id: string;
          ride_leg: Database["public"]["Enums"]["ride_leg"] | null;
          subject_member_id: string | null;
          todo_id: string | null;
          updated_at: string;
          wishlist_reservation_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          actor_member_id?: string | null;
          created_at?: string;
          created_on?: never;
          days_before?: number | null;
          deadline_id?: string | null;
          evening_date?: string | null;
          event_id?: string | null;
          free_from?: string | null;
          household_id: string;
          id?: string;
          item_count?: number | null;
          kind: Database["public"]["Enums"]["notification_kind"];
          occurrence_date?: string | null;
          other_event_id?: string | null;
          other_occurrence_date?: string | null;
          read_at?: string | null;
          recipient_member_id: string;
          ride_leg?: Database["public"]["Enums"]["ride_leg"] | null;
          subject_member_id?: string | null;
          todo_id?: string | null;
          updated_at?: string;
          wishlist_reservation_id?: string | null;
        };
        Update: {
          actor_member_id?: string | null;
          created_at?: string;
          created_on?: never;
          days_before?: number | null;
          deadline_id?: string | null;
          evening_date?: string | null;
          event_id?: string | null;
          free_from?: string | null;
          household_id?: string;
          id?: string;
          item_count?: number | null;
          kind?: Database["public"]["Enums"]["notification_kind"];
          occurrence_date?: string | null;
          other_event_id?: string | null;
          other_occurrence_date?: string | null;
          read_at?: string | null;
          recipient_member_id?: string;
          ride_leg?: Database["public"]["Enums"]["ride_leg"] | null;
          subject_member_id?: string | null;
          todo_id?: string | null;
          updated_at?: string;
          wishlist_reservation_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_actor_fkey";
            columns: ["actor_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "notifications_deadline_fkey";
            columns: ["deadline_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "deadlines";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "notifications_event_fkey";
            columns: ["event_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "notifications_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_other_event_fkey";
            columns: ["other_event_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "notifications_recipient_fkey";
            columns: ["recipient_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "notifications_subject_fkey";
            columns: ["subject_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "notifications_todo_fkey";
            columns: ["todo_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "todos";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "notifications_wishlist_reservation_fkey";
            columns: ["wishlist_reservation_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "wishlist_reservations";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      pet_photos: {
        Row: {
          content_type: string;
          created_at: string;
          data: string;
          household_id: string;
          member_id: string;
          member_kind: Database["public"]["Enums"]["member_kind"];
        };
        ComputedFields: never;
        Insert: {
          content_type: string;
          created_at?: string;
          data: string;
          household_id: string;
          member_id: string;
          member_kind?: Database["public"]["Enums"]["member_kind"];
        };
        Update: {
          content_type?: string;
          created_at?: string;
          data?: string;
          household_id?: string;
          member_id?: string;
          member_kind?: Database["public"]["Enums"]["member_kind"];
        };
        Relationships: [
          {
            foreignKeyName: "pet_photos_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pet_photos_member_fkey";
            columns: ["member_id", "household_id", "member_kind"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id", "kind"];
          },
        ];
      };
      pet_profiles: {
        Row: {
          adoption_date: string | null;
          created_at: string;
          date_kind: Database["public"]["Enums"]["pet_date_kind"] | null;
          date_precision:
            Database["public"]["Enums"]["pet_date_precision"] | null;
          date_year: number | null;
          food: string | null;
          household_id: string;
          id: string;
          member_id: string;
          member_kind: Database["public"]["Enums"]["member_kind"];
          note: string | null;
          species: Database["public"]["Enums"]["pet_species"] | null;
          updated_at: string;
          vet_clinic: string | null;
          vet_name: string | null;
          vet_phone: string | null;
        };
        ComputedFields: never;
        Insert: {
          adoption_date?: string | null;
          created_at?: string;
          date_kind?: Database["public"]["Enums"]["pet_date_kind"] | null;
          date_precision?:
            Database["public"]["Enums"]["pet_date_precision"] | null;
          date_year?: number | null;
          food?: string | null;
          household_id: string;
          id?: string;
          member_id: string;
          member_kind?: Database["public"]["Enums"]["member_kind"];
          note?: string | null;
          species?: Database["public"]["Enums"]["pet_species"] | null;
          updated_at?: string;
          vet_clinic?: string | null;
          vet_name?: string | null;
          vet_phone?: string | null;
        };
        Update: {
          adoption_date?: string | null;
          created_at?: string;
          date_kind?: Database["public"]["Enums"]["pet_date_kind"] | null;
          date_precision?:
            Database["public"]["Enums"]["pet_date_precision"] | null;
          date_year?: number | null;
          food?: string | null;
          household_id?: string;
          id?: string;
          member_id?: string;
          member_kind?: Database["public"]["Enums"]["member_kind"];
          note?: string | null;
          species?: Database["public"]["Enums"]["pet_species"] | null;
          updated_at?: string;
          vet_clinic?: string | null;
          vet_name?: string | null;
          vet_phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pet_profiles_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pet_profiles_member_fkey";
            columns: ["member_id", "household_id", "member_kind"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id", "kind"];
          },
        ];
      };
      pinned_spaces: {
        Row: {
          household_id: string;
          id: string;
          member_id: string;
          pinned_at: string;
          space: Database["public"]["Enums"]["space_key"];
        };
        ComputedFields: never;
        Insert: {
          household_id?: string;
          id?: string;
          member_id: string;
          pinned_at?: string;
          space: Database["public"]["Enums"]["space_key"];
        };
        Update: {
          household_id?: string;
          id?: string;
          member_id?: string;
          pinned_at?: string;
          space?: Database["public"]["Enums"]["space_key"];
        };
        Relationships: [
          {
            foreignKeyName: "pinned_spaces_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pinned_spaces_member_fkey";
            columns: ["member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      profiles: {
        Row: {
          appearance: Database["public"]["Enums"]["appearance_mode"];
          created_at: string;
          default_event_visibility: Database["public"]["Enums"]["event_visibility"];
          display_name: string | null;
          id: string;
          morning_digest_intro_seen_at: string | null;
          morning_digest_time: string;
          morning_digest_weekdays: number[];
          password_changed_at: string | null;
          start_lens: Database["public"]["Enums"]["lens"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          appearance?: Database["public"]["Enums"]["appearance_mode"];
          created_at?: string;
          default_event_visibility?: Database["public"]["Enums"]["event_visibility"];
          display_name?: string | null;
          id: string;
          morning_digest_intro_seen_at?: string | null;
          morning_digest_time?: string;
          morning_digest_weekdays?: number[];
          password_changed_at?: string | null;
          start_lens?: Database["public"]["Enums"]["lens"];
          updated_at?: string;
        };
        Update: {
          appearance?: Database["public"]["Enums"]["appearance_mode"];
          created_at?: string;
          default_event_visibility?: Database["public"]["Enums"]["event_visibility"];
          display_name?: string | null;
          id?: string;
          morning_digest_intro_seen_at?: string | null;
          morning_digest_time?: string;
          morning_digest_weekdays?: number[];
          password_changed_at?: string | null;
          start_lens?: Database["public"]["Enums"]["lens"];
          updated_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string | null;
          created_at: string;
          endpoint: string | null;
          household_id: string;
          id: string;
          last_seen_at: string;
          member_id: string;
          p256dh: string | null;
          platform: Database["public"]["Enums"]["push_platform"];
          session_id: string | null;
          token: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          auth?: string | null;
          created_at?: string;
          endpoint?: string | null;
          household_id: string;
          id?: string;
          last_seen_at?: string;
          member_id: string;
          p256dh?: string | null;
          platform: Database["public"]["Enums"]["push_platform"];
          session_id?: string | null;
          token?: string | null;
          updated_at?: string;
        };
        Update: {
          auth?: string | null;
          created_at?: string;
          endpoint?: string | null;
          household_id?: string;
          id?: string;
          last_seen_at?: string;
          member_id?: string;
          p256dh?: string | null;
          platform?: Database["public"]["Enums"]["push_platform"];
          session_id?: string | null;
          token?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "push_subscriptions_member_fkey";
            columns: ["member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      shopping_item_assignees: {
        Row: {
          created_at: string;
          household_id: string;
          member_id: string;
          shopping_item_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          household_id?: string;
          member_id: string;
          shopping_item_id: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          member_id?: string;
          shopping_item_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shopping_item_assignees_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shopping_item_assignees_item_fkey";
            columns: ["shopping_item_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "shopping_items";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "shopping_item_assignees_member_fkey";
            columns: ["member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      shopping_items: {
        Row: {
          added_by_member_id: string | null;
          checked_at: string | null;
          created_at: string;
          household_id: string;
          id: string;
          name: string;
          quantity: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          added_by_member_id?: string | null;
          checked_at?: string | null;
          created_at?: string;
          household_id?: string;
          id?: string;
          name: string;
          quantity?: string | null;
          updated_at?: string;
        };
        Update: {
          added_by_member_id?: string | null;
          checked_at?: string | null;
          created_at?: string;
          household_id?: string;
          id?: string;
          name?: string;
          quantity?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shopping_items_added_by_member_id_fkey";
            columns: ["added_by_member_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shopping_items_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      space_interests: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          member_id: string;
          space: Database["public"]["Enums"]["space_key"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          household_id?: string;
          id?: string;
          member_id: string;
          space: Database["public"]["Enums"]["space_key"];
        };
        Update: {
          created_at?: string;
          household_id?: string;
          id?: string;
          member_id?: string;
          space?: Database["public"]["Enums"]["space_key"];
        };
        Relationships: [
          {
            foreignKeyName: "space_interests_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "space_interests_member_fkey";
            columns: ["member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      todo_assignees: {
        Row: {
          created_at: string;
          household_id: string;
          member_id: string;
          todo_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          household_id?: string;
          member_id: string;
          todo_id: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          member_id?: string;
          todo_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "todo_assignees_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "todo_assignees_member_fkey";
            columns: ["member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "todo_assignees_todo_fkey";
            columns: ["todo_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "todos";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      todos: {
        Row: {
          assignee_member_id: string | null;
          created_at: string;
          created_by_member_id: string | null;
          done_at: string | null;
          done_by_member_id: string | null;
          due_date: string | null;
          for_member_id: string | null;
          household_id: string;
          id: string;
          is_private: boolean;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assignee_member_id?: string | null;
          created_at?: string;
          created_by_member_id?: string | null;
          done_at?: string | null;
          done_by_member_id?: string | null;
          due_date?: string | null;
          for_member_id?: string | null;
          household_id?: string;
          id?: string;
          is_private?: boolean;
          title: string;
          updated_at?: string;
        };
        Update: {
          assignee_member_id?: string | null;
          created_at?: string;
          created_by_member_id?: string | null;
          done_at?: string | null;
          done_by_member_id?: string | null;
          due_date?: string | null;
          for_member_id?: string | null;
          household_id?: string;
          id?: string;
          is_private?: boolean;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "todos_assignee_fkey";
            columns: ["assignee_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "todos_created_by_fkey";
            columns: ["created_by_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "todos_done_by_fkey";
            columns: ["done_by_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "todos_for_member_fkey";
            columns: ["for_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "todos_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      wishlist_item_photos: {
        Row: {
          content_type: string;
          created_at: string;
          data: string;
          household_id: string;
          item_id: string;
        };
        ComputedFields: never;
        Insert: {
          content_type: string;
          created_at?: string;
          data: string;
          household_id: string;
          item_id: string;
        };
        Update: {
          content_type?: string;
          created_at?: string;
          data?: string;
          household_id?: string;
          item_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wishlist_item_photos_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wishlist_item_photos_item_fkey";
            columns: ["item_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "wishlist_items";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      wishlist_items: {
        Row: {
          added_by_member_id: string | null;
          created_at: string;
          household_id: string;
          id: string;
          note: string | null;
          price_cents: number | null;
          shop_name: string | null;
          title: string;
          updated_at: string;
          url: string | null;
          wishlist_id: string;
        };
        ComputedFields: never;
        Insert: {
          added_by_member_id?: string | null;
          created_at?: string;
          household_id: string;
          id?: string;
          note?: string | null;
          price_cents?: number | null;
          shop_name?: string | null;
          title: string;
          updated_at?: string;
          url?: string | null;
          wishlist_id: string;
        };
        Update: {
          added_by_member_id?: string | null;
          created_at?: string;
          household_id?: string;
          id?: string;
          note?: string | null;
          price_cents?: number | null;
          shop_name?: string | null;
          title?: string;
          updated_at?: string;
          url?: string | null;
          wishlist_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wishlist_items_added_by_fkey";
            columns: ["added_by_member_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "wishlist_items_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wishlist_items_wishlist_fkey";
            columns: ["wishlist_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "wishlists";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      wishlist_reservations: {
        Row: {
          created_at: string;
          giver_key_hash: string | null;
          giver_name: string;
          household_id: string;
          id: string;
          item_id: string;
          share_link_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          giver_key_hash?: string | null;
          giver_name: string;
          household_id: string;
          id?: string;
          item_id: string;
          share_link_id: string;
        };
        Update: {
          created_at?: string;
          giver_key_hash?: string | null;
          giver_name?: string;
          household_id?: string;
          id?: string;
          item_id?: string;
          share_link_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wishlist_reservations_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wishlist_reservations_item_fkey";
            columns: ["item_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "wishlist_items";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "wishlist_reservations_share_link_fkey";
            columns: ["share_link_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "wishlist_share_links";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      wishlist_share_links: {
        Row: {
          code: string;
          created_at: string;
          disabled_at: string | null;
          expires_at: string;
          household_id: string;
          id: string;
          occasion_date: string;
          updated_at: string;
          wishlist_id: string;
        };
        ComputedFields: never;
        Insert: {
          code?: string;
          created_at?: string;
          disabled_at?: string | null;
          expires_at: string;
          household_id: string;
          id?: string;
          occasion_date: string;
          updated_at?: string;
          wishlist_id: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          disabled_at?: string | null;
          expires_at?: string;
          household_id?: string;
          id?: string;
          occasion_date?: string;
          updated_at?: string;
          wishlist_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wishlist_share_links_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wishlist_share_links_wishlist_fkey";
            columns: ["wishlist_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "wishlists";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      wishlists: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          member_id: string;
          member_kind: Database["public"]["Enums"]["member_kind"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          household_id?: string;
          id?: string;
          member_id: string;
          member_kind?: Database["public"]["Enums"]["member_kind"];
        };
        Update: {
          created_at?: string;
          household_id?: string;
          id?: string;
          member_id?: string;
          member_kind?: Database["public"]["Enums"]["member_kind"];
        };
        Relationships: [
          {
            foreignKeyName: "wishlists_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wishlists_member_fkey";
            columns: ["member_id", "household_id", "member_kind"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id", "household_id", "kind"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation_with_color: {
        Args: {
          p_color: Database["public"]["Enums"]["member_color"];
          p_token: string;
        };
        Returns: string;
      };
      accept_required_consents: {
        Args: {
          p_adult: boolean;
          p_privacy_version_id: string;
          p_terms_version_id: string;
        };
        Returns: undefined;
      };
      add_household_member: {
        Args: {
          p_birth_date?: string;
          p_color: Database["public"]["Enums"]["member_color"];
          p_kind: Database["public"]["Enums"]["member_kind"];
          p_name: string;
          p_species?: Database["public"]["Enums"]["pet_species"];
        };
        Returns: string;
      };
      add_shopping_items: {
        Args: { p_assignee_member_ids?: string[]; p_items: Json };
        Returns: string[];
      };
      add_space_interest: {
        Args: { p_space: Database["public"]["Enums"]["space_key"] };
        Returns: undefined;
      };
      add_wishlist_item: {
        Args: {
          p_member_id: string;
          p_note?: string;
          p_photo_base64?: string;
          p_photo_content_type?: string;
          p_price_cents?: number;
          p_shop_name?: string;
          p_title: string;
          p_url?: string;
        };
        Returns: string;
      };
      cancel_account_deletion: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      claim_calendar_outbox_items: {
        Args: {
          p_at?: string;
          p_is_fake: boolean;
          p_limit: number;
          p_user_id?: string;
        };
        Returns: {
          action: Database["public"]["Enums"]["calendar_outbox_action"];
          attempts: number;
          calendar_id: string;
          claim_token: string;
          event_id: string;
          id: string;
          provider_event_id: string;
        }[];
      };
      claim_push_deliveries: {
        Args: { p_at?: string; p_limit: number };
        Returns: {
          attempts: number;
          claim_token: string;
          id: string;
          kind: Database["public"]["Enums"]["push_delivery_kind"];
        }[];
      };
      claim_shop_link_read: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      clear_checked_shopping_items: {
        Args: { item_ids: string[] };
        Returns: {
          added_by_member_id: string | null;
          checked_at: string | null;
          created_at: string;
          household_id: string;
          id: string;
          name: string;
          quantity: string | null;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "shopping_items";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      clear_shopping_list: {
        Args: Record<PropertyKey, never>;
        Returns: {
          added_by_member_id: string | null;
          checked_at: string | null;
          created_at: string;
          household_id: string;
          id: string;
          name: string;
          quantity: string | null;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "shopping_items";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      complete_calendar_outbox_item: {
        Args: {
          p_claim_token?: string;
          p_id: string;
          p_provider_event_id?: string;
          p_provider_version?: string;
        };
        Returns: boolean;
      };
      complete_deadline: {
        Args: { p_deadline_id: string; p_due_date?: string };
        Returns: string;
      };
      complete_push_delivery: {
        Args: { p_claim_token: string; p_delivery_id: string };
        Returns: boolean;
      };
      complete_starter_list: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      confirm_event_fields: {
        Args: {
          p_event_id: string;
          p_fields?: Database["public"]["Enums"]["event_field"][];
        };
        Returns: undefined;
      };
      count_imported_events: {
        Args: { p_from: string };
        Returns: {
          event_count: number;
          provider: Database["public"]["Enums"]["calendar_provider"];
        }[];
      };
      count_unread_notifications: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      create_deadline: {
        Args: {
          p_assignee_member_ids?: string[];
          p_due_date: string;
          p_for_member_id?: string;
          p_is_private?: boolean;
          p_note?: string;
          p_recurrence?: Database["public"]["Enums"]["deadline_recurrence"];
          p_recurrence_interval_days?: number;
          p_reminder_days?: number[];
          p_title: string;
        };
        Returns: string;
      };
      create_event: {
        Args: {
          p_all_day?: boolean;
          p_ends_at: string;
          p_escort_member_id?: string;
          p_escort_undecided?: boolean;
          p_location?: string;
          p_member_ids: string[];
          p_notes?: string;
          p_pickup_member_id?: string;
          p_pickup_undecided?: boolean;
          p_recurrence?: Database["public"]["Enums"]["event_recurrence"];
          p_recurrence_until?: string;
          p_recurrence_weekdays?: number[];
          p_remind_rides?: boolean;
          p_reminder_minutes_before?: number;
          p_starts_at: string;
          p_title: string;
          p_unverified_fields?: Database["public"]["Enums"]["event_field"][];
          p_viewer_ids?: string[];
          p_visibility: Database["public"]["Enums"]["event_visibility"];
        };
        Returns: string;
      };
      create_household: {
        Args: {
          color: Database["public"]["Enums"]["member_color"];
          household_type: Database["public"]["Enums"]["household_type"];
          member_name: string;
          name: string;
        };
        Returns: string;
      };
      create_todo: {
        Args: {
          p_assignee_member_ids?: string[];
          p_due_date?: string;
          p_for_member_id?: string;
          p_is_private?: boolean;
          p_title: string;
        };
        Returns: string;
      };
      current_household_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      current_member_welcome: {
        Args: Record<PropertyKey, never>;
        Returns: {
          inviter_name: string;
        }[];
      };
      delete_event_occurrence: {
        Args: {
          p_day: string;
          p_event_id: string;
          p_scope: Database["public"]["Enums"]["event_change_scope"];
        };
        Returns: undefined;
      };
      delete_own_account: {
        Args: { p_expect_household_deletion: boolean };
        Returns: undefined;
      };
      delete_wishlist_item: { Args: { p_item_id: string }; Returns: undefined };
      disable_wishlist_share_link: {
        Args: { p_member_id: string };
        Returns: undefined;
      };
      end_my_other_sessions: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      end_my_session: { Args: { p_session_id: string }; Returns: undefined };
      fail_calendar_outbox_item: {
        Args: { p_claim_token?: string; p_id: string; p_retry_at: string };
        Returns: undefined;
      };
      fail_data_export: { Args: { p_id: string }; Returns: undefined };
      fail_push_delivery: {
        Args: {
          p_claim_token: string;
          p_delivery_id: string;
          p_retry_at: string;
        };
        Returns: boolean;
      };
      find_event_conflicts: {
        Args: {
          p_ends_at: string;
          p_escort_member_id?: string;
          p_exclude_event_id?: string;
          p_member_ids: string[];
          p_pickup_member_id?: string;
          p_starts_at: string;
        };
        Returns: {
          author_member_id: string;
          ends_at: string;
          escort_member_id: string;
          event_id: string;
          is_masked: boolean;
          member_id: string;
          member_ids: string[];
          occurrence_date: string;
          pickup_member_id: string;
          starts_at: string;
          title: string;
        }[];
      };
      finish_data_export: {
        Args: { p_id: string; p_size_bytes: number };
        Returns: undefined;
      };
      forget_data_export: { Args: { p_id: string }; Returns: undefined };
      get_account_deletion_outcome: {
        Args: Record<PropertyKey, never>;
        Returns: {
          deletes_household: boolean;
          next_admin_member_id: string;
        }[];
      };
      get_account_jobs_health: {
        Args: Record<PropertyKey, never>;
        Returns: {
          key_present: boolean;
          not_running: boolean;
          repeated_errors: boolean;
        }[];
      };
      get_event_calendar_link: {
        Args: { p_event_id: string };
        Returns: {
          calendar_id: string;
          calendar_name: string;
          is_imported: boolean;
          is_sent: boolean;
          provider: Database["public"]["Enums"]["calendar_provider"];
          visibility_overridden: boolean;
        }[];
      };
      get_event_occurrence: {
        Args: { p_day?: string; p_event_id: string };
        Returns: {
          all_day: boolean;
          author_member_id: string;
          ends_at: string;
          escort_member_id: string;
          escort_undecided: boolean;
          id: string;
          is_modified: boolean;
          location: string;
          member_ids: string[];
          notes: string;
          occurrence_date: string;
          pickup_member_id: string;
          pickup_undecided: boolean;
          recurrence: Database["public"]["Enums"]["event_recurrence"];
          recurrence_until: string;
          recurrence_weekdays: number[];
          remind_rides: boolean;
          reminder_minutes_before: number;
          series_ends_at: string;
          series_starts_at: string;
          starts_at: string;
          title: string;
          unverified_fields: Database["public"]["Enums"]["event_field"][];
          viewer_ids: string[];
          visibility: Database["public"]["Enums"]["event_visibility"];
        }[];
      };
      get_legal_versions: {
        Args: Record<PropertyKey, never>;
        Returns: {
          document: Database["public"]["Enums"]["legal_document"];
          effective_from: string;
          version_id: string;
        }[];
      };
      get_morning_digest: {
        Args: { p_day: string };
        Returns: {
          at: string;
          count: number;
          driver_member_id: string;
          event_id: string;
          leg: Database["public"]["Enums"]["ride_leg"];
          line: Database["public"]["Enums"]["morning_digest_line"];
          member_ids: string[];
          title: string;
        }[];
      };
      get_my_account_deletion: {
        Args: Record<PropertyKey, never>;
        Returns: {
          delete_on: string;
          deletes_household: boolean;
        }[];
      };
      get_my_consents: {
        Args: Record<PropertyKey, never>;
        Returns: {
          decided_at: string;
          granted: boolean;
          kind: Database["public"]["Enums"]["consent_kind"];
          privacy_effective_from: string;
          required_ok: boolean;
          terms_effective_from: string;
        }[];
      };
      get_my_data_export: {
        Args: Record<PropertyKey, never>;
        Returns: {
          expires_at: string;
          id: string;
          ready_at: string;
          requested_at: string;
          size_bytes: number;
          status: Database["public"]["Enums"]["data_export_status"];
        }[];
      };
      get_notification_preferences: {
        Args: Record<PropertyKey, never>;
        Returns: {
          assigned_todos: boolean;
          deadlines: boolean;
          delivery_mode: Database["public"]["Enums"]["notification_delivery_mode"];
          digest_deadlines: boolean;
          digest_events: boolean;
          digest_rides: boolean;
          digest_shopping: boolean;
          digest_thanks: boolean;
          evening_digest_time: string;
          event_reminders: boolean;
          events: boolean;
          free_together: boolean;
          gifts: boolean;
          hide_content: boolean;
          morning_digest: boolean;
          quiet_hours: boolean;
          rides: boolean;
          shopping: boolean;
        }[];
      };
      get_privacy_update: {
        Args: Record<PropertyKey, never>;
        Returns: {
          effective_from: string;
          privacy_version_id: string;
        }[];
      };
      get_public_wishlist: {
        Args: { p_code: string; p_giver_key?: string };
        Returns: {
          child_color: Database["public"]["Enums"]["member_color"];
          child_name: string;
          items: Database["public"]["CompositeTypes"]["public_wishlist_item"][];
          occasion_day: number;
          occasion_month: number;
          status: Database["public"]["Enums"]["wishlist_link_status"];
        }[];
      };
      get_public_wishlist_photo: {
        Args: { p_code: string; p_item_id: string };
        Returns: {
          content_type: string;
          data_base64: string;
        }[];
      };
      get_push_content: {
        Args: { p_claim_token: string; p_delivery_id: string };
        Returns: {
          at: string;
          is_hidden: boolean;
          item_count: number;
          kind: Database["public"]["Enums"]["notification_kind"];
          line: Database["public"]["Enums"]["morning_digest_line"];
          notification_id: string;
          person_name: string;
          place: string;
          title: string;
        }[];
      };
      has_consent_evidence_key: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      household_member_calendars: {
        Args: Record<PropertyKey, never>;
        Returns: {
          calendar_name: string;
          member_id: string;
          provider: Database["public"]["Enums"]["calendar_provider"];
          visibility: Database["public"]["Enums"]["event_visibility"];
        }[];
      };
      invitation_preview: {
        Args: { p_token: string };
        Returns: {
          caller_is_member: boolean;
          expires_at: string;
          household_name: string;
          invitee_color: Database["public"]["Enums"]["member_color"];
          invitee_name: string;
          inviter_name: string;
          members: Database["public"]["CompositeTypes"]["invitation_preview_member"][];
          message: string;
          status: Database["public"]["Enums"]["invitation_preview_status"];
        }[];
      };
      invite_adult: {
        Args: {
          p_color: Database["public"]["Enums"]["member_color"];
          p_name: string;
        };
        Returns: string;
      };
      list_calendar_events: {
        Args: { p_from: string; p_to: string };
        Returns: {
          all_day: boolean;
          author_member_id: string;
          counts_for_free_time: boolean;
          ends_at: string;
          escort_member_id: string;
          escort_undecided: boolean;
          id: string;
          is_imported: boolean;
          is_masked: boolean;
          location: string;
          member_ids: string[];
          pickup_member_id: string;
          pickup_undecided: boolean;
          remind_rides: boolean;
          reminder_minutes_before: number;
          source_provider: Database["public"]["Enums"]["calendar_provider"];
          starts_at: string;
          title: string;
          unverified_fields: Database["public"]["Enums"]["event_field"][];
          viewer_ids: string[];
          visibility: Database["public"]["Enums"]["event_visibility"];
        }[];
      };
      list_event_overlaps: {
        Args: { p_from: string; p_to: string };
        Returns: {
          day: string;
          ends_at: string;
          event_id: string;
          is_masked: boolean;
          member_id: string;
          starts_at: string;
        }[];
      };
      list_expired_data_exports: {
        Args: { p_limit: number };
        Returns: {
          export_id: string;
          object_path: string;
        }[];
      };
      list_household_events: {
        Args: { p_from: string; p_to: string };
        Returns: {
          author_member_id: string;
          ends_at: string;
          escort_member_id: string;
          id: string;
          is_masked: boolean;
          location: string;
          member_ids: string[];
          starts_at: string;
          title: string;
          visibility: Database["public"]["Enums"]["event_visibility"];
        }[];
      };
      list_household_events_with_source: {
        Args: { p_from: string; p_to: string };
        Returns: {
          author_member_id: string;
          counts_for_free_time: boolean;
          ends_at: string;
          escort_member_id: string;
          id: string;
          is_imported: boolean;
          is_masked: boolean;
          location: string;
          member_ids: string[];
          source_provider: Database["public"]["Enums"]["calendar_provider"];
          starts_at: string;
          title: string;
          visibility: Database["public"]["Enums"]["event_visibility"];
        }[];
      };
      list_my_sessions: {
        Args: Record<PropertyKey, never>;
        Returns: {
          device_kind: Database["public"]["Enums"]["session_device"];
          is_current: boolean;
          last_active_at: string;
          session_id: string;
        }[];
      };
      list_push_targets: {
        Args: { p_claim_token: string; p_delivery_id: string };
        Returns: {
          auth: string;
          endpoint: string;
          id: string;
          p256dh: string;
          platform: Database["public"]["Enums"]["push_platform"];
          token: string;
        }[];
      };
      mark_external_calendar_failing: {
        Args: { p_at?: string; p_calendar_id: string };
        Returns: undefined;
      };
      mark_morning_digest_intro_seen: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      mark_notifications_read: {
        Args: { p_ids: string[] };
        Returns: undefined;
      };
      mark_password_changed: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      mark_privacy_version_read: {
        Args: { p_privacy_version_id: string };
        Returns: undefined;
      };
      pin_space: {
        Args: { p_space: Database["public"]["Enums"]["space_key"] };
        Returns: undefined;
      };
      record_calendar_sync_result: {
        Args: {
          p_account_id: string;
          p_at?: string;
          p_outcome: Database["public"]["Enums"]["calendar_sync_outcome"];
        };
        Returns: undefined;
      };
      record_invitation_mail: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      register_push_subscription: {
        Args: {
          p_auth?: string;
          p_endpoint?: string;
          p_p256dh?: string;
          p_platform: Database["public"]["Enums"]["push_platform"];
          p_token?: string;
        };
        Returns: string;
      };
      remove_push_subscription: {
        Args: { p_subscription_id: string };
        Returns: boolean;
      };
      remove_space_interest: {
        Args: { p_space: Database["public"]["Enums"]["space_key"] };
        Returns: undefined;
      };
      renew_invitation: { Args: { p_member_id: string }; Returns: undefined };
      request_account_deletion: {
        Args: { p_expect_household_deletion: boolean };
        Returns: string;
      };
      request_ride: {
        Args: {
          p_event_id: string;
          p_leg: Database["public"]["Enums"]["ride_leg"];
          p_member_id: string;
          p_occurrence_date: string;
        };
        Returns: undefined;
      };
      reserve_public_wishlist_item: {
        Args: {
          p_code: string;
          p_giver_key: string;
          p_item_id: string;
          p_name: string;
        };
        Returns: Database["public"]["Enums"]["wishlist_reservation_outcome"];
      };
      restore_shopping_items: {
        Args: { item_ids: string[] };
        Returns: {
          added_by_member_id: string | null;
          checked_at: string | null;
          created_at: string;
          household_id: string;
          id: string;
          name: string;
          quantity: string | null;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "shopping_items";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      run_account_job: {
        Args: {
          p_at?: string;
          p_job: Database["public"]["Enums"]["account_job"];
        };
        Returns: number;
      };
      run_notification_job: {
        Args: {
          p_at?: string;
          p_household_id: string;
          p_job: Database["public"]["Enums"]["notification_job"];
        };
        Returns: number;
      };
      run_shopping_purge: {
        Args: { p_at?: string; p_household_id: string };
        Returns: number;
      };
      run_wishlist_cleanup: {
        Args: { p_household_id: string; p_today?: string };
        Returns: number;
      };
      save_calendar_account: {
        Args: {
          p_credentials_ciphertext: string;
          p_email: string;
          p_is_fake?: boolean;
          p_provider: Database["public"]["Enums"]["calendar_provider"];
          p_provider_account_id: string;
          p_user_id: string;
        };
        Returns: {
          account_id: string;
          is_new: boolean;
        }[];
      };
      save_child_profile: {
        Args: {
          p_birth_date?: string;
          p_clothing_size?: string;
          p_color: Database["public"]["Enums"]["member_color"];
          p_member_id: string;
          p_name: string;
          p_pajama_size?: string;
          p_school_class?: string;
          p_school_days?: number[];
          p_school_ends_at?: string;
          p_school_name?: string;
          p_school_note?: string;
          p_school_starts_at?: string;
          p_shoe_size?: string;
          p_teachers: Json;
        };
        Returns: undefined;
      };
      save_external_calendars: {
        Args: { p_account_id: string; p_calendars: Json };
        Returns: number;
      };
      save_pet_profile: {
        Args: {
          p_color: Database["public"]["Enums"]["member_color"];
          p_date?: string;
          p_date_kind?: Database["public"]["Enums"]["pet_date_kind"];
          p_date_precision?: Database["public"]["Enums"]["pet_date_precision"];
          p_date_year?: number;
          p_food?: string;
          p_member_id: string;
          p_name: string;
          p_note?: string;
          p_photo_base64?: string;
          p_photo_content_type?: string;
          p_remove_photo?: boolean;
          p_species?: Database["public"]["Enums"]["pet_species"];
          p_vet_clinic?: string;
          p_vet_name?: string;
          p_vet_phone?: string;
        };
        Returns: undefined;
      };
      search_household: {
        Args: {
          p_from?: string;
          p_kinds?: Database["public"]["Enums"]["search_result_kind"][];
          p_member_id?: string;
          p_text?: string;
          p_to?: string;
        };
        Returns: {
          assignee_member_id: string;
          assignee_member_ids: string[];
          author_member_id: string;
          due_date: string;
          ends_at: string;
          escort_member_id: string;
          for_member_id: string;
          id: string;
          is_masked: boolean;
          is_private: boolean;
          kind: Database["public"]["Enums"]["search_result_kind"];
          location: string;
          member_ids: string[];
          occurrence_day: string;
          quantity: string;
          recurrence: Database["public"]["Enums"]["event_recurrence"];
          recurrence_weekdays: number[];
          series_starts_on: string;
          sort_index: number;
          source_provider: Database["public"]["Enums"]["calendar_provider"];
          starts_at: string;
          title: string;
          visibility: Database["public"]["Enums"]["event_visibility"];
        }[];
      };
      set_consent: {
        Args: {
          p_granted: boolean;
          p_kind: Database["public"]["Enums"]["consent_kind"];
          p_source?: Database["public"]["Enums"]["consent_source"];
        };
        Returns: undefined;
      };
      set_event_also_on: {
        Args: { p_enabled: boolean; p_event_id: string };
        Returns: undefined;
      };
      set_new_events_calendar: {
        Args: { p_calendar_id: string };
        Returns: undefined;
      };
      set_notification_options: {
        Args: {
          p_delivery_mode?: Database["public"]["Enums"]["notification_delivery_mode"];
          p_evening_digest_time?: string;
          p_morning_digest_weekdays?: number[];
        };
        Returns: undefined;
      };
      set_notification_preference: {
        Args: {
          p_enabled: boolean;
          p_preference: Database["public"]["Enums"]["notification_preference"];
        };
        Returns: undefined;
      };
      share_wishlist: {
        Args: { p_member_id: string };
        Returns: {
          code: string;
          expires_at: string;
          occasion_date: string;
        }[];
      };
      space_interest_counts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          adults: number;
          households: number;
          space: Database["public"]["Enums"]["space_key"];
        }[];
      };
      start_data_export: { Args: Record<PropertyKey, never>; Returns: string };
      sync_external_calendar_events: {
        Args: {
          p_at?: string;
          p_calendar_id: string;
          p_cursor?: string;
          p_events: Json;
          p_full: boolean;
        };
        Returns: {
          deleted_count: number;
          imported_count: number;
        }[];
      };
      take_account_deletion_mails: {
        Args: { p_limit: number };
        Returns: {
          deleted_on: string;
          email: string;
        }[];
      };
      undo_added_shopping_items: {
        Args: { item_ids: string[] };
        Returns: string[];
      };
      undo_complete_deadline: {
        Args: { p_deadline_id: string; p_due_date: string };
        Returns: undefined;
      };
      unpin_space: {
        Args: { p_space: Database["public"]["Enums"]["space_key"] };
        Returns: undefined;
      };
      unregister_push_subscription: {
        Args: { p_endpoint?: string; p_token?: string };
        Returns: undefined;
      };
      update_calendar_account_credentials: {
        Args: {
          p_account_id: string;
          p_credentials_ciphertext: string;
          p_previous_ciphertext: string;
        };
        Returns: boolean;
      };
      update_deadline: {
        Args: {
          p_assignee_member_ids: string[];
          p_deadline_id: string;
          p_due_date: string;
          p_for_member_id: string;
          p_is_private: boolean;
          p_note: string;
          p_recurrence?: Database["public"]["Enums"]["deadline_recurrence"];
          p_recurrence_interval_days?: number;
          p_reminder_days: number[];
          p_title: string;
        };
        Returns: undefined;
      };
      update_event: {
        Args: {
          p_all_day?: boolean;
          p_day: string;
          p_ends_at: string;
          p_escort_member_id: string;
          p_escort_undecided?: boolean;
          p_event_id: string;
          p_location: string;
          p_member_ids: string[];
          p_notes: string;
          p_pickup_member_id?: string;
          p_pickup_undecided?: boolean;
          p_recurrence: Database["public"]["Enums"]["event_recurrence"];
          p_recurrence_until: string;
          p_recurrence_weekdays: number[];
          p_remind_rides?: boolean;
          p_reminder_minutes_before?: number;
          p_starts_at: string;
          p_title: string;
          p_viewer_ids?: string[];
          p_visibility: Database["public"]["Enums"]["event_visibility"];
        };
        Returns: {
          day: string;
          id: string;
        }[];
      };
      update_event_occurrence: {
        Args: {
          p_day: string;
          p_ends_at: string;
          p_escort_member_id: string;
          p_escort_undecided?: boolean;
          p_event_id: string;
          p_location: string;
          p_notes: string;
          p_pickup_member_id?: string;
          p_pickup_undecided?: boolean;
          p_starts_at: string;
          p_title: string;
        };
        Returns: undefined;
      };
      update_shopping_item: {
        Args: {
          p_assignee_member_ids: string[];
          p_item_id: string;
          p_name: string;
          p_quantity: string;
        };
        Returns: undefined;
      };
      update_todo: {
        Args: {
          p_assignee_member_ids: string[];
          p_due_date: string;
          p_for_member_id: string;
          p_is_private: boolean;
          p_title: string;
          p_todo_id: string;
        };
        Returns: undefined;
      };
      update_wishlist_item: {
        Args: { p_item_id: string; p_note?: string; p_title: string };
        Returns: undefined;
      };
    };
    Enums: {
      account_job: "deletions" | "exports" | "mail_purge" | "evidence_purge";
      appearance_mode: "light" | "dark" | "system";
      calendar_account_status: "active" | "reconnect" | "temporary_error";
      calendar_direction: "two_way" | "incoming";
      calendar_outbox_action: "create" | "update" | "delete";
      calendar_provider: "google" | "outlook";
      calendar_sync_outcome: "ok" | "auth_error" | "temporary_error";
      consent_kind:
        | "terms_and_privacy"
        | "adult"
        | "product_news_email"
        | "usage_analytics"
        | "assistant_questions";
      consent_source: "signup" | "settings" | "first_use" | "update";
      data_export_status: "preparing" | "ready" | "failed";
      deadline_recurrence:
        | "none"
        | "monthly"
        | "every_3_months"
        | "every_6_months"
        | "yearly"
        | "every_n_days";
      event_change_scope: "this" | "following";
      event_field: "title" | "day" | "time" | "members" | "location";
      event_recurrence:
        "none" | "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
      event_visibility: "private" | "busy" | "selected" | "household";
      external_event_origin: "imported" | "sent";
      household_type:
        "single" | "couple" | "family_with_children" | "roommates";
      invitation_preview_status: "valid" | "invalid";
      invitation_status: "pending" | "accepted" | "revoked";
      legal_document: "terms" | "privacy";
      lens: "io" | "nest";
      member_color:
        | "pomodoro"
        | "glicine"
        | "salvia"
        | "cobalto"
        | "zafferano"
        | "lampone"
        | "ceruleo"
        | "peonia"
        | "basilico"
        | "cannella";
      member_kind: "adult" | "child" | "pet";
      morning_digest_line:
        | "events"
        | "ride"
        | "todos"
        | "deadlines_today"
        | "deadlines_tomorrow"
        | "shopping"
        | "free_together";
      notification_delivery_mode: "each" | "mine_now" | "digest_only";
      notification_job:
        | "free_together"
        | "deadline_reminders"
        | "shopping_digest"
        | "purge"
        | "event_reminders"
        | "ride_reminders"
        | "overlaps"
        | "push_digests"
        | "push_purge";
      notification_kind:
        | "todo_assigned"
        | "deadline_reminder"
        | "free_together"
        | "event_time_changed"
        | "shopping_added"
        | "gift_taken"
        | "member_joined"
        | "event_reminder"
        | "ride_reminder"
        | "overlap_tomorrow"
        | "ride_request"
        | "household_handed_over"
        | "data_export_ready";
      notification_preference:
        | "events"
        | "assigned_todos"
        | "shopping"
        | "free_together"
        | "morning_digest"
        | "quiet_hours"
        | "hide_content"
        | "rides"
        | "event_reminders"
        | "deadlines"
        | "gifts"
        | "digest_events"
        | "digest_rides"
        | "digest_deadlines"
        | "digest_thanks"
        | "digest_shopping";
      pet_date_kind: "birth" | "adoption";
      pet_date_precision: "day" | "year";
      pet_species: "dog" | "cat" | "other";
      push_delivery_kind: "single" | "evening_digest" | "morning_digest";
      push_platform: "web" | "apns" | "fcm";
      ride_leg: "escort" | "pickup";
      search_result_kind: "event" | "deadline" | "todo" | "shopping_item";
      session_device: "phone" | "tablet" | "computer" | "unknown";
      space_key:
        | "meals"
        | "couple"
        | "wellbeing"
        | "together"
        | "hobbies"
        | "chores"
        | "projects"
        | "expenses"
        | "children"
        | "pets";
      wishlist_item_state: "free" | "mine" | "taken";
      wishlist_link_status: "active" | "inactive";
      wishlist_reservation_outcome:
        | "reserved"
        | "taken"
        | "not_found"
        | "inactive"
        | "rate_limited"
        | "invalid_name"
        | "invalid_key";
    };
    CompositeTypes: {
      invitation_preview_member: {
        initial: string | null;
        color: Database["public"]["Enums"]["member_color"] | null;
        name: string | null;
      };
      public_wishlist_item: {
        id: string | null;
        title: string | null;
        url: string | null;
        shop_name: string | null;
        note: string | null;
        price_cents: number | null;
        has_photo: boolean | null;
        state: Database["public"]["Enums"]["wishlist_item_state"] | null;
      };
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
  public: {
    Enums: {
      account_job: ["deletions", "exports", "mail_purge", "evidence_purge"],
      appearance_mode: ["light", "dark", "system"],
      calendar_account_status: ["active", "reconnect", "temporary_error"],
      calendar_direction: ["two_way", "incoming"],
      calendar_outbox_action: ["create", "update", "delete"],
      calendar_provider: ["google", "outlook"],
      calendar_sync_outcome: ["ok", "auth_error", "temporary_error"],
      consent_kind: [
        "terms_and_privacy",
        "adult",
        "product_news_email",
        "usage_analytics",
        "assistant_questions",
      ],
      consent_source: ["signup", "settings", "first_use", "update"],
      data_export_status: ["preparing", "ready", "failed"],
      deadline_recurrence: [
        "none",
        "monthly",
        "every_3_months",
        "every_6_months",
        "yearly",
        "every_n_days",
      ],
      event_change_scope: ["this", "following"],
      event_field: ["title", "day", "time", "members", "location"],
      event_recurrence: [
        "none",
        "daily",
        "weekly",
        "biweekly",
        "monthly",
        "yearly",
      ],
      event_visibility: ["private", "busy", "selected", "household"],
      external_event_origin: ["imported", "sent"],
      household_type: ["single", "couple", "family_with_children", "roommates"],
      invitation_preview_status: ["valid", "invalid"],
      invitation_status: ["pending", "accepted", "revoked"],
      legal_document: ["terms", "privacy"],
      lens: ["io", "nest"],
      member_color: [
        "pomodoro",
        "glicine",
        "salvia",
        "cobalto",
        "zafferano",
        "lampone",
        "ceruleo",
        "peonia",
        "basilico",
        "cannella",
      ],
      member_kind: ["adult", "child", "pet"],
      morning_digest_line: [
        "events",
        "ride",
        "todos",
        "deadlines_today",
        "deadlines_tomorrow",
        "shopping",
        "free_together",
      ],
      notification_delivery_mode: ["each", "mine_now", "digest_only"],
      notification_job: [
        "free_together",
        "deadline_reminders",
        "shopping_digest",
        "purge",
        "event_reminders",
        "ride_reminders",
        "overlaps",
        "push_digests",
        "push_purge",
      ],
      notification_kind: [
        "todo_assigned",
        "deadline_reminder",
        "free_together",
        "event_time_changed",
        "shopping_added",
        "gift_taken",
        "member_joined",
        "event_reminder",
        "ride_reminder",
        "overlap_tomorrow",
        "ride_request",
        "household_handed_over",
        "data_export_ready",
      ],
      notification_preference: [
        "events",
        "assigned_todos",
        "shopping",
        "free_together",
        "morning_digest",
        "quiet_hours",
        "hide_content",
        "rides",
        "event_reminders",
        "deadlines",
        "gifts",
        "digest_events",
        "digest_rides",
        "digest_deadlines",
        "digest_thanks",
        "digest_shopping",
      ],
      pet_date_kind: ["birth", "adoption"],
      pet_date_precision: ["day", "year"],
      pet_species: ["dog", "cat", "other"],
      push_delivery_kind: ["single", "evening_digest", "morning_digest"],
      push_platform: ["web", "apns", "fcm"],
      ride_leg: ["escort", "pickup"],
      search_result_kind: ["event", "deadline", "todo", "shopping_item"],
      session_device: ["phone", "tablet", "computer", "unknown"],
      space_key: [
        "meals",
        "couple",
        "wellbeing",
        "together",
        "hobbies",
        "chores",
        "projects",
        "expenses",
        "children",
        "pets",
      ],
      wishlist_item_state: ["free", "mine", "taken"],
      wishlist_link_status: ["active", "inactive"],
      wishlist_reservation_outcome: [
        "reserved",
        "taken",
        "not_found",
        "inactive",
        "rate_limited",
        "invalid_name",
        "invalid_key",
      ],
    },
  },
} as const;
