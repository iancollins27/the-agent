
export interface Project {
  id: string;
  name: string;
  status: 'active' | 'pending' | 'completed';
  summary: string;
  lastUpdated: string;
  milestones: Milestone[];
  communications: Communication[];
  actions: Action[];
}

export interface Milestone {
  id: string;
  title: string;
  date: string;
  status: 'completed' | 'pending' | 'upcoming';
  description: string;
}

export interface Communication {
  id: string;
  type: 'inbound' | 'outbound';
  message: string;
  timestamp: string;
  sender: string;
  recipient: string;
}

export interface Action {
  id: string;
  type: 'task' | 'notification' | 'update';
  status: 'pending' | 'completed' | 'failed';
  title: string;
  description: string;
  createdAt: string;
  completedAt?: string;
}
