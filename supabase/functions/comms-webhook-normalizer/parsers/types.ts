
export type CommunicationType = 'CALL' | 'SMS' | 'EMAIL';
export type CommunicationDirection = 'inbound' | 'outbound';

export interface NormalizedCommunication {
  type: CommunicationType;
  subtype: string;
  participants: Array<{
    type: 'phone' | 'email';
    value: string;
    role?: 'caller' | 'recipient' | 'sender' | 'receiver';
  }>;
  timestamp: string;
  direction: CommunicationDirection;
  duration?: number; // in seconds
  content?: string; // message body or transcript
  recording_url?: string;
  project_id?: string;
}
