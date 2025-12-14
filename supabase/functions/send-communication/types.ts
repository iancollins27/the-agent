
export interface SendCommRequest {
  actionId?: string;
  messageContent: string;
  recipient: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
  };
  channel: string;
  providerId?: string;
  projectId?: string;
  companyId?: string;
  isTest?: boolean;
  sender?: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
  };
  providerInfo?: {
    provider_name: string;
  };
  isAgentMessage?: boolean;
  agentPhone?: string;
}

export interface ProviderInfo {
  provider_name: string;
  api_key: string;
  api_secret: string;
  justcall_number?: string;
  account_id?: string;
}
