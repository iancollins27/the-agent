
export interface ContactPayload {
  name: string;
  number: string;
  email: string;
  role: string;
}

export interface WebhookPayload {
  contacts: ContactPayload[];
  Bid_ID: string;
}

export interface ContactProcessResult {
  status: 'success' | 'error';
  contactId?: string;
  message?: string;
  contact: ContactPayload;
}

export interface ProcessResult {
  success: boolean;
  message: string;
  projectId?: string;
  results?: ContactProcessResult[];
  error?: string;
}
