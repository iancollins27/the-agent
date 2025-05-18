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
      action_metrics: {
        Row: {
          action_record_id: string
          approved: boolean | null
          created_at: string | null
          decision: string | null
          executed: boolean | null
        }
        Insert: {
          action_record_id: string
          approved?: boolean | null
          created_at?: string | null
          decision?: string | null
          executed?: boolean | null
        }
        Update: {
          action_record_id?: string
          approved?: boolean | null
          created_at?: string | null
          decision?: string | null
          executed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "action_metrics_action_record_id_fkey"
            columns: ["action_record_id"]
            isOneToOne: true
            referencedRelation: "action_records"
            referencedColumns: ["id"]
          },
        ]
      }
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
          sender_phone: string | null
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
          sender_phone?: string | null
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
          sender_phone?: string | null
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
          available_tools: string[] | null
          created_at: string
          id: string
          mcp_tool_definitions: string | null
          model: string
          search_project_data: boolean
          system_prompt: string
          temperature: number
        }
        Insert: {
          available_tools?: string[] | null
          created_at?: string
          id?: string
          mcp_tool_definitions?: string | null
          model?: string
          search_project_data?: boolean
          system_prompt: string
          temperature?: number
        }
        Update: {
          available_tools?: string[] | null
          created_at?: string
          id?: string
          mcp_tool_definitions?: string | null
          model?: string
          search_project_data?: boolean
          system_prompt?: string
          temperature?: number
        }
        Relationships: []
      }
      comms_batch_status: {
        Row: {
          batch_status: string
          created_at: string
          id: string
          processed_at: string | null
          project_id: string
          scheduled_processing_time: string | null
        }
        Insert: {
          batch_status: string
          created_at?: string
          id?: string
          processed_at?: string | null
          project_id: string
          scheduled_processing_time?: string | null
        }
        Update: {
          batch_status?: string
          created_at?: string
          id?: string
          processed_at?: string | null
          project_id?: string
          scheduled_processing_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comms_batch_status_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          batch_id: string | null
          content: string | null
          created_at: string
          direction: string
          duration: number | null
          error_details: string | null
          id: string
          participants: Json
          processed_for_summary: boolean | null
          project_id: string | null
          provider: string | null
          provider_response: Json | null
          raw_webhook_id: string | null
          recording_url: string | null
          sent_at: string | null
          status: string | null
          subtype: string
          timestamp: string
          type: string
        }
        Insert: {
          batch_id?: string | null
          content?: string | null
          created_at?: string
          direction: string
          duration?: number | null
          error_details?: string | null
          id?: string
          participants: Json
          processed_for_summary?: boolean | null
          project_id?: string | null
          provider?: string | null
          provider_response?: Json | null
          raw_webhook_id?: string | null
          recording_url?: string | null
          sent_at?: string | null
          status?: string | null
          subtype: string
          timestamp: string
          type: string
        }
        Update: {
          batch_id?: string | null
          content?: string | null
          created_at?: string
          direction?: string
          duration?: number | null
          error_details?: string | null
          id?: string
          participants?: Json
          processed_for_summary?: boolean | null
          project_id?: string | null
          provider?: string | null
          provider_response?: Json | null
          raw_webhook_id?: string | null
          recording_url?: string | null
          sent_at?: string | null
          status?: string | null
          subtype?: string
          timestamp?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "comms_batch_status"
            referencedColumns: ["id"]
          },
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
          company_project_base_URL: string | null
          default_email_provider: string | null
          default_phone_provider: string | null
          default_project_track: string | null
          id: string
          knowledge_base_settings: Json | null
          name: string
          zoho_id: string | null
        }
        Insert: {
          action_approval_settings?: Json | null
          company_project_base_URL?: string | null
          default_email_provider?: string | null
          default_phone_provider?: string | null
          default_project_track?: string | null
          id?: string
          knowledge_base_settings?: Json | null
          name: string
          zoho_id?: string | null
        }
        Update: {
          action_approval_settings?: Json | null
          company_project_base_URL?: string | null
          default_email_provider?: string | null
          default_phone_provider?: string | null
          default_project_track?: string | null
          id?: string
          knowledge_base_settings?: Json | null
          name?: string
          zoho_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_default_email_provider_fkey"
            columns: ["default_email_provider"]
            isOneToOne: false
            referencedRelation: "company_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_default_email_provider_fkey"
            columns: ["default_email_provider"]
            isOneToOne: false
            referencedRelation: "company_integrations_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_default_phone_provider_fkey"
            columns: ["default_phone_provider"]
            isOneToOne: false
            referencedRelation: "company_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_default_phone_provider_fkey"
            columns: ["default_phone_provider"]
            isOneToOne: false
            referencedRelation: "company_integrations_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_default_project_track_fkey"
            columns: ["default_project_track"]
            isOneToOne: false
            referencedRelation: "project_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      company_integrations: {
        Row: {
          account_id: string | null
          api_call_json: Json | null
          api_key: string
          api_secret: string | null
          company_id: string
          created_at: string
          id: string
          integration_mode: string
          is_active: boolean | null
          provider_name: string
          provider_type: Database["public"]["Enums"]["provider_type_enum"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          api_call_json?: Json | null
          api_key: string
          api_secret?: string | null
          company_id: string
          created_at?: string
          id?: string
          integration_mode?: string
          is_active?: boolean | null
          provider_name: string
          provider_type: Database["public"]["Enums"]["provider_type_enum"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          api_call_json?: Json | null
          api_key?: string
          api_secret?: string | null
          company_id?: string
          created_at?: string
          id?: string
          integration_mode?: string
          is_active?: boolean | null
          provider_name?: string
          provider_type?: Database["public"]["Enums"]["provider_type_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          associated_profile: string | null
          comms_preferences: string | null
          email: string | null
          full_name: string
          id: string
          phone_number: string | null
          role: Database["public"]["Enums"]["contact_role"]
        }
        Insert: {
          associated_profile?: string | null
          comms_preferences?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone_number?: string | null
          role: Database["public"]["Enums"]["contact_role"]
        }
        Update: {
          associated_profile?: string | null
          comms_preferences?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone_number?: string | null
          role?: Database["public"]["Enums"]["contact_role"]
        }
        Relationships: [
          {
            foreignKeyName: "contacts_associated_profile_fkey"
            columns: ["associated_profile"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_job_queue: {
        Row: {
          action_record_id: string | null
          company_id: string
          created_at: string | null
          error_message: string | null
          id: string
          next_retry_at: string | null
          operation_type: string
          payload: Json
          processed_at: string | null
          project_id: string | null
          resource_type: string
          result: Json | null
          retry_count: number | null
          status: string
        }
        Insert: {
          action_record_id?: string | null
          company_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          next_retry_at?: string | null
          operation_type: string
          payload: Json
          processed_at?: string | null
          project_id?: string | null
          resource_type: string
          result?: Json | null
          retry_count?: number | null
          status?: string
        }
        Update: {
          action_record_id?: string | null
          company_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          next_retry_at?: string | null
          operation_type?: string
          payload?: Json
          processed_at?: string | null
          project_id?: string | null
          resource_type?: string
          result?: Json | null
          retry_count?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_job_queue_action_record_id_fkey"
            columns: ["action_record_id"]
            isOneToOne: false
            referencedRelation: "action_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_job_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_job_queue_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_key_access_logs: {
        Row: {
          access_reason: string | null
          accessed_at: string
          accessed_by: string | null
          id: string
          integration_id: string
          source_ip: string | null
        }
        Insert: {
          access_reason?: string | null
          accessed_at?: string
          accessed_by?: string | null
          id?: string
          integration_id: string
          source_ip?: string | null
        }
        Update: {
          access_reason?: string | null
          accessed_at?: string
          accessed_by?: string | null
          id?: string
          integration_id?: string
          source_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_key_access_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "company_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_key_access_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "company_integrations_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_embeddings: {
        Row: {
          company_id: string
          content: string
          embedding: string | null
          file_name: string | null
          file_type: string | null
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
          file_name?: string | null
          file_type?: string | null
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
          file_name?: string | null
          file_type?: string | null
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
          company_id: string | null
          created_at: string | null
          id: string
          permission: Database["public"]["Enums"]["user_permission"]
          profile_crm_id: string | null
          profile_fname: string | null
          profile_lname: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id: string
          permission?: Database["public"]["Enums"]["user_permission"]
          profile_crm_id?: string | null
          profile_fname?: string | null
          profile_lname?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["user_permission"]
          profile_crm_id?: string | null
          profile_fname?: string | null
          profile_lname?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_profile_associated_company_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          track_id_name: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          prompt_instructions?: string | null
          step_order?: number | null
          step_title?: string | null
          track_id?: string | null
          track_id_name?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          prompt_instructions?: string | null
          step_order?: number | null
          step_title?: string | null
          track_id?: string | null
          track_id_name?: string | null
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
          created_at: string
          crm_id: string | null
          email_summary: string | null
          id: string
          last_action_check: string | null
          last_email_processed_at: string | null
          latest_prompt_run_ID: string | null
          next_check_date: string | null
          next_step: string | null
          project_manager: string | null
          project_name: string | null
          Project_status: Database["public"]["Enums"]["project_status"] | null
          project_track: string | null
          search_vector: string | null
          summary: string | null
        }
        Insert: {
          Address?: string | null
          company_id?: string | null
          created_at?: string
          crm_id?: string | null
          email_summary?: string | null
          id?: string
          last_action_check?: string | null
          last_email_processed_at?: string | null
          latest_prompt_run_ID?: string | null
          next_check_date?: string | null
          next_step?: string | null
          project_manager?: string | null
          project_name?: string | null
          Project_status?: Database["public"]["Enums"]["project_status"] | null
          project_track?: string | null
          search_vector?: string | null
          summary?: string | null
        }
        Update: {
          Address?: string | null
          company_id?: string | null
          created_at?: string
          crm_id?: string | null
          email_summary?: string | null
          id?: string
          last_action_check?: string | null
          last_email_processed_at?: string | null
          latest_prompt_run_ID?: string | null
          next_check_date?: string | null
          next_step?: string | null
          project_manager?: string | null
          project_name?: string | null
          Project_status?: Database["public"]["Enums"]["project_status"] | null
          project_track?: string | null
          search_vector?: string | null
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
            foreignKeyName: "projects_latest_prompt_run_ID_fkey"
            columns: ["latest_prompt_run_ID"]
            isOneToOne: false
            referencedRelation: "prompt_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_manager_fkey"
            columns: ["project_manager"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          completion_tokens: number | null
          created_at: string
          error_message: string | null
          feedback_description: string | null
          feedback_rating: number | null
          feedback_review: string | null
          feedback_tags: string[] | null
          id: string
          project_id: string | null
          prompt_input: string
          prompt_output: string | null
          prompt_tokens: number | null
          reviewed: boolean | null
          status: string
          usd_cost: number | null
          workflow_prompt_id: string | null
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string | null
          completed_at?: string | null
          completion_tokens?: number | null
          created_at?: string
          error_message?: string | null
          feedback_description?: string | null
          feedback_rating?: number | null
          feedback_review?: string | null
          feedback_tags?: string[] | null
          id?: string
          project_id?: string | null
          prompt_input: string
          prompt_output?: string | null
          prompt_tokens?: number | null
          reviewed?: boolean | null
          status?: string
          usd_cost?: number | null
          workflow_prompt_id?: string | null
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string | null
          completed_at?: string | null
          completion_tokens?: number | null
          created_at?: string
          error_message?: string | null
          feedback_description?: string | null
          feedback_rating?: number | null
          feedback_review?: string | null
          feedback_tags?: string[] | null
          id?: string
          project_id?: string | null
          prompt_input?: string
          prompt_output?: string | null
          prompt_tokens?: number | null
          reviewed?: boolean | null
          status?: string
          usd_cost?: number | null
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
      tool_logs: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          id: string
          input_hash: string | null
          output_trim: string | null
          prompt_run_id: string | null
          status_code: number | null
          tool_name: string
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          input_hash?: string | null
          output_trim?: string | null
          prompt_run_id?: string | null
          status_code?: number | null
          tool_name: string
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          input_hash?: string | null
          output_trim?: string | null
          prompt_run_id?: string | null
          status_code?: number | null
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_logs_prompt_run_id_fkey"
            columns: ["prompt_run_id"]
            isOneToOne: false
            referencedRelation: "prompt_runs"
            referencedColumns: ["id"]
          },
        ]
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
      company_integrations_secure: {
        Row: {
          account_id: string | null
          api_key: string | null
          api_secret: string | null
          company_id: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          provider_name: string | null
          provider_type:
            | Database["public"]["Enums"]["provider_type_enum"]
            | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          api_key?: string | null
          api_secret?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          provider_name?: string | null
          provider_type?:
            | Database["public"]["Enums"]["provider_type_enum"]
            | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          api_key?: string | null
          api_secret?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          provider_name?: string | null
          provider_type?:
            | Database["public"]["Enums"]["provider_type_enum"]
            | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      v_daily_llm_costs: {
        Row: {
          company_id: string | null
          day: string | null
          total_tokens: number | null
          total_usd: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      get_column_info: {
        Args: { table_name: string; column_name: string }
        Returns: {
          data_type: string
          is_nullable: boolean
          column_default: string
        }[]
      }
      get_company_integration_keys: {
        Args: { integration_id: string }
        Returns: {
          api_key: string
          api_secret: string
          account_id: string
        }[]
      }
      get_project_search_text: {
        Args: { project_id: string }
        Returns: string
      }
      get_projects_due_for_check: {
        Args: Record<PropertyKey, never>
        Returns: {
          Address: string | null
          company_id: string | null
          created_at: string
          crm_id: string | null
          email_summary: string | null
          id: string
          last_action_check: string | null
          last_email_processed_at: string | null
          latest_prompt_run_ID: string | null
          next_check_date: string | null
          next_step: string | null
          project_manager: string | null
          project_name: string | null
          Project_status: Database["public"]["Enums"]["project_status"] | null
          project_track: string | null
          search_vector: string | null
          summary: string | null
        }[]
      }
      get_table_info: {
        Args: { table_name: string }
        Returns: {
          constraint_name: string
          constraint_type: string
          definition: string
        }[]
      }
      get_user_company_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      log_integration_key_access: {
        Args: {
          p_integration_id: string
          p_accessed_by: string
          p_access_reason: string
          p_source_ip: string
        }
        Returns: undefined
      }
      match_documents: {
        Args: { embedding: string; k: number; _company_id: string }
        Returns: {
          id: string
          title: string
          content: string
          url: string
          similarity: number
        }[]
      }
      search_projects_by_vector: {
        Args: {
          search_embedding: string
          match_threshold?: number
          match_count?: number
          p_company_id?: string
        }
        Returns: {
          id: string
          crm_id: string
          summary: string
          next_step: string
          project_track: string
          company_id: string
          company_name: string
          address: string
          status: string
          similarity: number
          project_name: string
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      user_belongs_to_company: {
        Args: { company_id: string }
        Returns: boolean
      }
      user_can_access_project: {
        Args: { project_id: string }
        Returns: boolean
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      contact_role:
        | "Roofer"
        | "HO"
        | "BidList Project Manager"
        | "Solar"
        | "Solar Ops"
        | "Solar Sales Rep"
      project_status: "Archived"
      provider_type_enum: "email" | "phone" | "crm"
      user_permission: "read" | "update_settings"
      user_role: "owner" | "admin" | "manager" | "user" | "guest"
      workflow_type:
        | "summary_generation"
        | "summary_update"
        | "action_detection"
        | "action_execution"
        | "action_detection_execution"
        | "multi_project_analysis"
        | "multi_project_message_generation"
        | "mcp_orchestrator"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      contact_role: [
        "Roofer",
        "HO",
        "BidList Project Manager",
        "Solar",
        "Solar Ops",
        "Solar Sales Rep",
      ],
      project_status: ["Archived"],
      provider_type_enum: ["email", "phone", "crm"],
      user_permission: ["read", "update_settings"],
      user_role: ["owner", "admin", "manager", "user", "guest"],
      workflow_type: [
        "summary_generation",
        "summary_update",
        "action_detection",
        "action_execution",
        "action_detection_execution",
        "multi_project_analysis",
        "multi_project_message_generation",
        "mcp_orchestrator",
      ],
    },
  },
} as const
