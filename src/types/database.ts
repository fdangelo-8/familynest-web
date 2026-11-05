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
          event_id: string;
          household_id: string;
          is_cancelled: boolean;
          location: string | null;
          notes: string | null;
          occurrence_date: string;
          starts_at: string | null;
          title: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ends_at?: string | null;
          escort_member_id?: string | null;
          event_id: string;
          household_id?: string;
          is_cancelled?: boolean;
          location?: string | null;
          notes?: string | null;
          occurrence_date: string;
          starts_at?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string | null;
          escort_member_id?: string | null;
          event_id?: string;
          household_id?: string;
          is_cancelled?: boolean;
          location?: string | null;
          notes?: string | null;
          occurrence_date?: string;
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
      events: {
        Row: {
          author_member_id: string | null;
          created_at: string;
          ends_at: string;
          escort_member_id: string | null;
          household_id: string;
          id: string;
          location: string | null;
          notes: string | null;
          recurrence: Database["public"]["Enums"]["event_recurrence"];
          recurrence_until: string | null;
          recurrence_weekdays: number[] | null;
          starts_at: string;
          title: string;
          updated_at: string;
          visibility: Database["public"]["Enums"]["event_visibility"];
        };
        ComputedFields: never;
        Insert: {
          author_member_id?: string | null;
          created_at?: string;
          ends_at: string;
          escort_member_id?: string | null;
          household_id?: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          recurrence?: Database["public"]["Enums"]["event_recurrence"];
          recurrence_until?: string | null;
          recurrence_weekdays?: number[] | null;
          starts_at: string;
          title: string;
          updated_at?: string;
          visibility: Database["public"]["Enums"]["event_visibility"];
        };
        Update: {
          author_member_id?: string | null;
          created_at?: string;
          ends_at?: string;
          escort_member_id?: string | null;
          household_id?: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          recurrence?: Database["public"]["Enums"]["event_recurrence"];
          recurrence_until?: string | null;
          recurrence_weekdays?: number[] | null;
          starts_at?: string;
          title?: string;
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
          short_code: string;
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
          short_code?: string;
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
          short_code?: string;
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
      notification_preferences: {
        Row: {
          assigned_todos: boolean;
          created_at: string;
          events: boolean;
          free_together: boolean;
          household_id: string;
          id: string;
          member_id: string;
          morning_digest: boolean;
          shopping: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assigned_todos?: boolean;
          created_at?: string;
          events?: boolean;
          free_together?: boolean;
          household_id?: string;
          id?: string;
          member_id: string;
          morning_digest?: boolean;
          shopping?: boolean;
          updated_at?: string;
        };
        Update: {
          assigned_todos?: boolean;
          created_at?: string;
          events?: boolean;
          free_together?: boolean;
          household_id?: string;
          id?: string;
          member_id?: string;
          morning_digest?: boolean;
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
          read_at: string | null;
          recipient_member_id: string;
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
          read_at?: string | null;
          recipient_member_id: string;
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
          read_at?: string | null;
          recipient_member_id?: string;
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
            foreignKeyName: "notifications_recipient_fkey";
            columns: ["recipient_member_id", "household_id"];
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
          created_at: string;
          default_event_visibility: Database["public"]["Enums"]["event_visibility"];
          display_name: string | null;
          id: string;
          morning_digest_time: string;
          start_lens: Database["public"]["Enums"]["lens"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          default_event_visibility?: Database["public"]["Enums"]["event_visibility"];
          display_name?: string | null;
          id: string;
          morning_digest_time?: string;
          start_lens?: Database["public"]["Enums"]["lens"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          default_event_visibility?: Database["public"]["Enums"]["event_visibility"];
          display_name?: string | null;
          id?: string;
          morning_digest_time?: string;
          start_lens?: Database["public"]["Enums"]["lens"];
          updated_at?: string;
        };
        Relationships: [];
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
      accept_invitation: { Args: { token: string }; Returns: string };
      accept_invitation_with_color: {
        Args: {
          p_color: Database["public"]["Enums"]["member_color"];
          p_token: string;
        };
        Returns: string;
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
      complete_starter_list: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      count_unread_notifications: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      create_event: {
        Args: {
          p_ends_at: string;
          p_escort_member_id?: string;
          p_location?: string;
          p_member_ids: string[];
          p_notes?: string;
          p_recurrence?: Database["public"]["Enums"]["event_recurrence"];
          p_recurrence_until?: string;
          p_recurrence_weekdays?: number[];
          p_starts_at: string;
          p_title: string;
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
      get_account_deletion_outcome: {
        Args: Record<PropertyKey, never>;
        Returns: {
          deletes_household: boolean;
          next_admin_member_id: string;
        }[];
      };
      get_event_occurrence: {
        Args: { p_day?: string; p_event_id: string };
        Returns: {
          author_member_id: string;
          ends_at: string;
          escort_member_id: string;
          id: string;
          is_modified: boolean;
          location: string;
          member_ids: string[];
          notes: string;
          occurrence_date: string;
          recurrence: Database["public"]["Enums"]["event_recurrence"];
          recurrence_until: string;
          recurrence_weekdays: number[];
          series_ends_at: string;
          series_starts_at: string;
          starts_at: string;
          title: string;
          visibility: Database["public"]["Enums"]["event_visibility"];
        }[];
      };
      get_notification_preferences: {
        Args: Record<PropertyKey, never>;
        Returns: {
          assigned_todos: boolean;
          events: boolean;
          free_together: boolean;
          morning_digest: boolean;
          shopping: boolean;
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
      mark_notifications_read: {
        Args: { p_ids: string[] };
        Returns: undefined;
      };
      pin_space: {
        Args: { p_space: Database["public"]["Enums"]["space_key"] };
        Returns: undefined;
      };
      remove_space_interest: {
        Args: { p_space: Database["public"]["Enums"]["space_key"] };
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
      run_notification_job: {
        Args: {
          p_at?: string;
          p_household_id: string;
          p_job: Database["public"]["Enums"]["notification_job"];
        };
        Returns: number;
      };
      run_wishlist_cleanup: {
        Args: { p_household_id: string; p_today?: string };
        Returns: number;
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
          starts_at: string;
          title: string;
          visibility: Database["public"]["Enums"]["event_visibility"];
        }[];
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
      undo_added_shopping_items: {
        Args: { item_ids: string[] };
        Returns: string[];
      };
      unpin_space: {
        Args: { p_space: Database["public"]["Enums"]["space_key"] };
        Returns: undefined;
      };
      update_event: {
        Args: {
          p_day: string;
          p_ends_at: string;
          p_escort_member_id: string;
          p_event_id: string;
          p_location: string;
          p_member_ids: string[];
          p_notes: string;
          p_recurrence: Database["public"]["Enums"]["event_recurrence"];
          p_recurrence_until: string;
          p_recurrence_weekdays: number[];
          p_starts_at: string;
          p_title: string;
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
          p_event_id: string;
          p_location: string;
          p_notes: string;
          p_starts_at: string;
          p_title: string;
        };
        Returns: undefined;
      };
      update_wishlist_item: {
        Args: { p_item_id: string; p_note?: string; p_title: string };
        Returns: undefined;
      };
    };
    Enums: {
      event_change_scope: "this" | "following";
      event_recurrence: "none" | "weekly" | "monthly";
      event_visibility: "private" | "busy" | "household";
      household_type:
        "single" | "couple" | "family_with_children" | "roommates";
      invitation_preview_status: "valid" | "invalid";
      invitation_status: "pending" | "accepted" | "revoked";
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
      notification_job:
        "free_together" | "deadline_reminders" | "shopping_digest" | "purge";
      notification_kind:
        | "todo_assigned"
        | "deadline_reminder"
        | "free_together"
        | "event_time_changed"
        | "shopping_added"
        | "gift_taken";
      notification_preference:
        | "events"
        | "assigned_todos"
        | "shopping"
        | "free_together"
        | "morning_digest";
      search_result_kind: "event" | "deadline" | "todo" | "shopping_item";
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
      event_change_scope: ["this", "following"],
      event_recurrence: ["none", "weekly", "monthly"],
      event_visibility: ["private", "busy", "household"],
      household_type: ["single", "couple", "family_with_children", "roommates"],
      invitation_preview_status: ["valid", "invalid"],
      invitation_status: ["pending", "accepted", "revoked"],
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
      notification_job: [
        "free_together",
        "deadline_reminders",
        "shopping_digest",
        "purge",
      ],
      notification_kind: [
        "todo_assigned",
        "deadline_reminder",
        "free_together",
        "event_time_changed",
        "shopping_added",
        "gift_taken",
      ],
      notification_preference: [
        "events",
        "assigned_todos",
        "shopping",
        "free_together",
        "morning_digest",
      ],
      search_result_kind: ["event", "deadline", "todo", "shopping_item"],
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
