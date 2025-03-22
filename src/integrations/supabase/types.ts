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
      action_records: {
        Row: {
          action_payload: Json
          action_type: string
          approver_id: string | null
          created_at: string
          executed_at: string | null
          execution_result: Json | null
          id: string
          message: string | null
          project_id: string | null
          prompt_run_id: string | null
          recipient_id: string | null
          requires_approval: boolean
          sender_ID: string | null
          status: string
        }
        Insert: {
          action_payload: Json
          action_type: string
          approver_id?: string | null
          created_at?: string
          executed_at?: string | null
          execution_result?: Json | null
          id?: string
          message?: string | null
          project_id?: string | null
          prompt_run_id?: string | null
          recipient_id?: string | null
          requires_approval?: boolean
          sender_ID?: string | null
          status?: string
        }
        Update: {
          action_payload?: Json
          action_type?: string
          approver_id?: string | null
          created_at?: string
          executed_at?: string | null
          execution_result?: Json | null
          id?: string
          message?: string | null
          project_id?: string | null
          prompt_run_id?: string | null
          recipient_id?: string | null
          requires_approval?: boolean
          sender_ID?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_records_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_records_prompt_run_id_fkey"
            columns: ["prompt_run_id"]
            isOneToOne: false
            referencedRelation: "prompt_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_records_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_records_sender_ID_fkey"
            columns: ["sender_ID"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_config: {
        Row: {
          created_at: string
          id: string
          model: string
          provider: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string
          provider?: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          provider?: string
        }
        Relationships: []
      }
      chatbot_config: {
        Row: {
          created_at: string
          id: string
          model: string
          search_project_data: boolean
          system_prompt: string
          temperature: number
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string
          search_project_data?: boolean
          system_prompt: string
          temperature?: number
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          search_project_data?: boolean
          system_prompt?: string
          temperature?: number
        }
        Relationships: []
      }
      communications: {
        Row: {
          content: string | null
          created_at: string
          direction: string
          duration: number | null
          id: string
          participants: Json
          processed_for_summary: boolean | null
          project_id: string | null
          raw_webhook_id: string | null
          recording_url: string | null
          subtype: string
          timestamp: string
          type: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          direction: string
          duration?: number | null
          id?: string
          participants: Json
          processed_for_summary?: boolean | null
          project_id?: string | null
          raw_webhook_id?: string | null
          recording_url?: string | null
          subtype: string
          timestamp: string
          type: string
        }
        Update: {
          content?: string | null
          created_at?: string
          direction?: string
          duration?: number | null
          id?: string
          participants?: Json
          processed_for_summary?: boolean | null
          project_id?: string | null
          raw_webhook_id?: string | null
          recording_url?: string | null
          subtype?: string
          timestamp?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_raw_webhook_id_fkey"
            columns: ["raw_webhook_id"]
            isOneToOne: false
            referencedRelation: "raw_comms_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          action_approval_settings: Json | null
          default_project_track: string | null
          id: string
          knowledge_base_settings: Json | null
          name: string
          zoho_id: string | null
        }
        Insert: {
          action_approval_settings?: Json | null
          default_project_track?: string | null
          id?: string
          knowledge_base_settings?: Json | null
          name: string
          zoho_id?: string | null
        }
        Update: {
          action_approval_settings?: Json | null
          default_project_track?: string | null
          id?: string
          knowledge_base_settings?: Json | null
          name?: string
          zoho_id?: string | null
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
          email: string | null
          full_name: string
          id: string
          phone_number: string | null
          role: Database["public"]["Enums"]["contact_role"]
        }
        Insert: {
          comms_preferences?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone_number?: string | null
          role: Database["public"]["Enums"]["contact_role"]
        }
        Update: {
          comms_preferences?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone_number?: string | null
          role?: Database["public"]["Enums"]["contact_role"]
        }
        Relationships: []
      }
      knowledge_base_embeddings: {
        Row: {
          company_id: string
          content: string
          embedding: string | null
          id: string
          last_updated: string | null
          metadata: Json | null
          source_id: string
          source_type: string
          title: string | null
          url: string | null
        }
        Insert: {
          company_id: string
          content: string
          embedding?: string | null
          id?: string
          last_updated?: string | null
          metadata?: Json | null
          source_id: string
          source_type: string
          title?: string | null
          url?: string | null
        }
        Update: {
          company_id?: string
          content?: string
          embedding?: string | null
          id?: string
          last_updated?: string | null
          metadata?: Json | null
          source_id?: string
          source_type?: string
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_embeddings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: []
      }
      project_contacts: {
        Row: {
          contact_id: string
          project_id: string
        }
        Insert: {
          contact_id: string
          project_id: string
        }
        Update: {
          contact_id?: string
          project_id?: string
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
      project_track_milestones: {
        Row: {
          created_at: string
          description: string | null
          id: string
          prompt_instructions: string | null
          step_order: number | null
          step_title: string | null
          track_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          prompt_instructions?: string | null
          step_order?: number | null
          step_title?: string | null
          track_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          prompt_instructions?: string | null
          step_order?: number | null
          step_title?: string | null
          track_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_track_milestones_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "project_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tracks: {
        Row: {
          company_id: string
          id: string
          name: string
          Roles: string | null
          "track base prompt": string | null
        }
        Insert: {
          company_id: string
          id?: string
          name?: string
          Roles?: string | null
          "track base prompt"?: string | null
        }
        Update: {
          company_id?: string
          id?: string
          name?: string
          Roles?: string | null
          "track base prompt"?: string | null
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
          Address: string | null
          company_id: string | null
          crm_id: string | null
          id: string
          last_action_check: string | null
          next_check_date: string | null
          next_step: string | null
          project_track: string | null
          summary: string | null
        }
        Insert: {
          Address?: string | null
          company_id?: string | null
          crm_id?: string | null
          id?: string
          last_action_check?: string | null
          next_check_date?: string | null
          next_step?: string | null
          project_track?: string | null
          summary?: string | null
        }
        Update: {
          Address?: string | null
          company_id?: string | null
          crm_id?: string | null
          id?: string
          last_action_check?: string | null
          next_check_date?: string | null
          next_step?: string | null
          project_track?: string | null
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
      prompt_runs: {
        Row: {
          ai_model: string | null
          ai_provider: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          feedback_description: string | null
          feedback_rating: number | null
          feedback_tags: string[] | null
          id: string
          project_id: string | null
          prompt_input: string
          prompt_output: string | null
          status: string
          workflow_prompt_id: string | null
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          feedback_description?: string | null
          feedback_rating?: number | null
          feedback_tags?: string[] | null
          id?: string
          project_id?: string | null
          prompt_input: string
          prompt_output?: string | null
          status?: string
          workflow_prompt_id?: string | null
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          feedback_description?: string | null
          feedback_rating?: number | null
          feedback_tags?: string[] | null
          id?: string
          project_id?: string | null
          prompt_input?: string
          prompt_output?: string | null
          status?: string
          workflow_prompt_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_runs_workflow_prompt_id_fkey"
            columns: ["workflow_prompt_id"]
            isOneToOne: false
            referencedRelation: "workflow_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_comms_webhooks: {
        Row: {
          created_at: string
          id: string
          processed: boolean | null
          processing_error: string | null
          raw_payload: Json
          service_name: string
          signature: string | null
          webhook_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          processed?: boolean | null
          processing_error?: string | null
          raw_payload: Json
          service_name: string
          signature?: string | null
          webhook_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          processed?: boolean | null
          processing_error?: string | null
          raw_payload?: Json
          service_name?: string
          signature?: string | null
          webhook_id?: string | null
        }
        Relationships: []
      }
      workflow_prompts: {
        Row: {
          created_at: string | null
          id: string
          prompt_text: string
          type: Database["public"]["Enums"]["workflow_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          prompt_text: string
          type: Database["public"]["Enums"]["workflow_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
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
      binary_quantize:
        | {
            Args: {
              "": string
            }
            Returns: unknown
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
      get_projects_due_for_check: {
        Args: Record<PropertyKey, never>
        Returns: {
          Address: string | null
          company_id: string | null
          crm_id: string | null
          id: string
          last_action_check: string | null
          next_check_date: string | null
          next_step: string | null
          project_track: string | null
          summary: string | null
        }[]
      }
      halfvec_avg: {
        Args: {
          "": number[]
        }
        Returns: unknown
      }
      halfvec_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      halfvec_send: {
        Args: {
          "": unknown
        }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
      hnsw_bit_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnswhandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflathandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      l2_norm:
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
      l2_normalize:
        | {
            Args: {
              "": string
            }
            Returns: string
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
      sparsevec_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      sparsevec_send: {
        Args: {
          "": unknown
        }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
      vector_avg: {
        Args: {
          "": number[]
        }
        Returns: string
      }
      vector_dims:
        | {
            Args: {
              "": string
            }
            Returns: number
          }
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
      vector_norm: {
        Args: {
          "": string
        }
        Returns: number
      }
      vector_out: {
        Args: {
          "": string
        }
        Returns: unknown
      }
      vector_send: {
        Args: {
          "": string
        }
        Returns: string
      }
      vector_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
    }
    Enums: {
      contact_role: "Roofer" | "HO" | "BidList Project Manager" | "Solar"
      user_permission: "read" | "update_settings"
      workflow_type:
        | "summary_generation"
        | "summary_update"
        | "action_detection"
        | "action_execution"
        | "action_detection_execution"
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
