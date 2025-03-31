
export type CommProvider = 'justcall' | 'twilio' | 'sendgrid' | 'none';
export type CommDirection = 'INBOUND' | 'OUTBOUND';

export interface SendCommRequest {
  actionId?: string;
  messageContent: string;
  recipient: {
    id?: string;
    phone?: string;
    email?: string;
    name?: string;
    sender?: {
      id?: string;
      name?: string;
      phone?: string;
      email?: string;
    };
    sender_ID?: string; // Legacy field
    sender_phone?: string;
  };
  channel: 'sms' | 'email' | 'call';
  providerId?: string; // Provider ID from company_integrations table
  projectId?: string;
  companyId?: string;
  isTest?: boolean;
  senderId?: string; // New field for sender ID
}

export interface ProviderInfo {
  provider_name: string;
  api_key: string;
  api_secret?: string;
  account_id?: string;
  justcall_number?: string;
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
    sender?: any;
    sender_ID?: string;
    sender_phone?: string;
  };
  providerInfo: ProviderInfo;
}
