
export interface ChatMessage {
  role: string;
  content: string;
  tool_calls?: any[];
}

export interface ProjectData {
  id: string;
  crm_id?: string;
  summary?: string;
  next_step?: string;
  Project_status?: string;
  Address?: string;
  companies?: {
    name?: string;
  };
  [key: string]: any;
}

export interface ChatContext {
  projectData?: ProjectData;
  knowledge_results?: any[];
  current_date?: string;
  available_tools?: string[];
  company_name?: string;
  user_question?: string;
}
