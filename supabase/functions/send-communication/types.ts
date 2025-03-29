
export type CommProvider = 'justcall' | 'twilio' | 'sendgrid' | 'none';

export interface SendCommRequest {
  actionId: string;
  messageContent: string;
  recipient: {
    id?: string;
    phone?: string;
    email?: string;
    name?: string;
  };
  channel: 'sms' | 'email' | 'call';
  provider?: string; // Provider ID from company_integrations table
  projectId?: string;
  companyId?: string;
}

export interface ProviderInfo {
  provider_name: string;
  api_key: string;
  api_secret?: string;
  account_id?: string;
}

export interface CommunicationRecordParams {
  projectId?: string;
  channel: 'sms' | 'email' | 'call';
  messageContent: string;
  recipient: {
    id?: string;
    phone?: string;
    email?: string;
    name?: string;
  };
  providerInfo: ProviderInfo;
}
