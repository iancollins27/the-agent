
export interface ProviderInfo {
  provider_name: string;
  api_key: string;
  api_secret?: string;
  account_id?: string;
  justcall_number?: string;
  default_phone?: string;
  action_sender_phone?: string;
}

export interface Recipient {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
}

export interface Sender {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
}

export interface SendCommRequest {
  actionId?: string;
  messageContent: string;
  recipient: Recipient;
  sender?: Sender;
  channel: string;
  providerId?: string;
  projectId?: string;
  companyId?: string;
  isTest?: boolean;
}

export interface CommunicationRecordParams {
  projectId?: string;
  channel: string;
  messageContent: string;
  recipient: Recipient;
  sender?: Sender;
  providerInfo: ProviderInfo;
}

export type CommDirection = 'inbound' | 'outbound';
