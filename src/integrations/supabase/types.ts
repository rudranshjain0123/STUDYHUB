export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      bookmarks: {
        Row: {
          created_at: string;
          user_id: string;
          work_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
          work_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
          work_id?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          work_id: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          work_id: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          work_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_work_id_fkey";
            columns: ["work_id"];
            isOneToOne: false;
            referencedRelation: "works";
            referencedColumns: ["id"];
          },
        ];
      };
      doubt_answers: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          question_id: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          question_id: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          question_id?: string;
        };
        Relationships: [];
      };
      doubt_questions: {
        Row: {
          attachment_name: string | null;
          attachment_path: string | null;
          author_id: string;
          best_answer_id: string | null;
          body: string;
          created_at: string;
          id: string;
          subject: string;
          title: string;
        };
        Insert: {
          attachment_name?: string | null;
          attachment_path?: string | null;
          author_id: string;
          best_answer_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          subject: string;
          title: string;
        };
        Update: {
          attachment_name?: string | null;
          attachment_path?: string | null;
          author_id?: string;
          best_answer_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          subject?: string;
          title?: string;
        };
        Relationships: [];
      };
      member_credentials: {
        Row: {
          created_at: string;
          email: string;
          passcode_hash: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          passcode_hash: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          passcode_hash?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_color: string;
          class_section: string | null;
          created_at: string;
          display_name: string;
          id: string;
          roll_number: string | null;
        };
        Insert: {
          avatar_color?: string;
          class_section?: string | null;
          created_at?: string;
          display_name: string;
          id: string;
          roll_number?: string | null;
        };
        Update: {
          avatar_color?: string;
          class_section?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          roll_number?: string | null;
        };
        Relationships: [];
      };
      note_requests: {
        Row: {
          created_at: string;
          details: string;
          fulfilled_at: string | null;
          fulfilled_by: string | null;
          fulfilled_work_id: string | null;
          id: string;
          requester_id: string;
          status: string;
          subject: string;
          subtype: string | null;
          title: string;
        };
        Insert: {
          created_at?: string;
          details: string;
          fulfilled_at?: string | null;
          fulfilled_by?: string | null;
          fulfilled_work_id?: string | null;
          id?: string;
          requester_id: string;
          status?: string;
          subject: string;
          subtype?: string | null;
          title: string;
        };
        Update: {
          created_at?: string;
          details?: string;
          fulfilled_at?: string | null;
          fulfilled_by?: string | null;
          fulfilled_work_id?: string | null;
          id?: string;
          requester_id?: string;
          status?: string;
          subject?: string;
          subtype?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      works: {
        Row: {
          created_at: string;
          file_name: string;
          id: string;
          storage_path: string;
          subject: string;
          subtype: string | null;
          title: string;
          uploader_id: string;
          work_type: Database["public"]["Enums"]["work_type"];
        };
        Insert: {
          created_at?: string;
          file_name: string;
          id?: string;
          storage_path: string;
          subject: string;
          subtype?: string | null;
          title: string;
          uploader_id: string;
          work_type: Database["public"]["Enums"]["work_type"];
        };
        Update: {
          created_at?: string;
          file_name?: string;
          id?: string;
          storage_path?: string;
          subject?: string;
          subtype?: string | null;
          title?: string;
          uploader_id?: string;
          work_type?: Database["public"]["Enums"]["work_type"];
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "member";
      work_type: "book" | "notebook";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
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
      app_role: ["admin", "member"],
      work_type: ["book", "notebook"],
    },
  },
} as const;
