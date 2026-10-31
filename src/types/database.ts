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
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
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
      pin_space: {
        Args: { p_space: Database["public"]["Enums"]["space_key"] };
        Returns: undefined;
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
    };
    Enums: {
      event_change_scope: "this" | "following";
      event_recurrence: "none" | "weekly" | "monthly";
      event_visibility: "private" | "busy" | "household";
      household_type:
        "single" | "couple" | "family_with_children" | "roommates";
      invitation_preview_status: "valid" | "invalid";
      invitation_status: "pending" | "accepted" | "revoked";
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
    };
    CompositeTypes: {
      invitation_preview_member: {
        initial: string | null;
        color: Database["public"]["Enums"]["member_color"] | null;
        name: string | null;
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
    },
  },
} as const;
