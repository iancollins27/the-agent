export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      action_logs: {
        Row: {
          action_description: string
          action_type: string
          created_at: string | null
          executed_at: string | null
          id: number
          project_id: number | null
          status: string | null
        }
        Insert: {
          action_description: string
          action_type: string
          created_at?: string | null
          executed_at?: string | null
          id?: number
          project_id?: number | null
          status?: string | null
        }
        Update: {
          action_description?: string
          action_type?: string
          created_at?: string | null
          executed_at?: string | null
          id?: number
          project_id?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          default_project_track: number | null
          id: number
          name: string
        }
        Insert: {
          default_project_track?: number | null
          id?: number
          name: string
        }
        Update: {
          default_project_track?: number | null
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_default_project_track_fkey"
            columns: ["default_project_track"]
            isOneToOne: false
            referencedRelation: "project_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          comms_preferences: string | null
          contact_info: string | null
          full_name: string
          id: number
          role: Database["public"]["Enums"]["contact_role"]
        }
        Insert: {
          comms_preferences?: string | null
          contact_info?: string | null
          full_name: string
          id?: number
          role: Database["public"]["Enums"]["contact_role"]
        }
        Update: {
          comms_preferences?: string | null
          contact_info?: string | null
          full_name?: string
          id?: number
          role?: Database["public"]["Enums"]["contact_role"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_id: number | null
          created_at: string | null
          id: string
          permission: Database["public"]["Enums"]["user_permission"]
          updated_at: string | null
        }
        Insert: {
          company_id?: number | null
          created_at?: string | null
          id: string
          permission?: Database["public"]["Enums"]["user_permission"]
          updated_at?: string | null
        }
        Update: {
          company_id?: number | null
          created_at?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["user_permission"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_contacts: {
        Row: {
          contact_id: number
          project_id: number
        }
        Insert: {
          contact_id: number
          project_id: number
        }
        Update: {
          contact_id?: number
          project_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tracks: {
        Row: {
          company_id: number
          description: string | null
          id: number
          name: string
        }
        Insert: {
          company_id: number
          description?: string | null
          id?: number
          name?: string
        }
        Update: {
          company_id?: number
          description?: string | null
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tracks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          company_id: number | null
          id: number
          last_action_check: string | null
          project_track: number | null
          summary: string | null
        }
        Insert: {
          company_id?: number | null
          id?: number
          last_action_check?: string | null
          project_track?: number | null
          summary?: string | null
        }
        Update: {
          company_id?: number | null
          id?: number
          last_action_check?: string | null
          project_track?: number | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_track_fkey"
            columns: ["project_track"]
            isOneToOne: false
            referencedRelation: "project_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_prompts: {
        Row: {
          created_at: string | null
          id: number
          prompt_text: string
          type: Database["public"]["Enums"]["workflow_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          prompt_text: string
          type: Database["public"]["Enums"]["workflow_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          prompt_text?: string
          type?: Database["public"]["Enums"]["workflow_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      contact_role: "Roofer" | "HO" | "BidList Project Manager" | "Solar"
      user_permission: "read" | "update_settings"
      workflow_type:
        | "summary_generation"
        | "summary_update"
        | "action_detection"
        | "action_execution"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
