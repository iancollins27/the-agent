
interface JobProgressWriter {
  execute(request: any): Promise<any>;
}

export class JobProgressWriter implements JobProgressWriter {
  private integration: any;
  private credentials: any;
  private baseUrl = "https://api.jobprogress.com/api/v3";

  constructor(integration: any, credentials: any) {
    this.integration = integration;
    this.credentials = credentials;
  }

  async execute(request: any): Promise<any> {
    const { resourceType, operationType, resourceId, data } = request;

    try {
      // Handle append_note as a special case
      if (operationType === 'append_note' && resourceType === 'project') {
        return await this.handleAppendNoteOperation(resourceId, data);
      }

      switch (resourceType) {
        case 'project':
          return await this.handleProjectOperation(operationType, resourceId, data);
        case 'task':
          return await this.handleTaskOperation(operationType, resourceId, data);
        case 'note':
          return await this.handleNoteOperation(operationType, resourceId, data);
        default:
          throw new Error(`Unsupported resource type: ${resourceType}`);
      }
    } catch (error) {
      console.error(`JobProgress write error for ${resourceType}:`, error);
      throw error;
    }
  }

  /**
   * Handles appending a note to a project's existing notes field
   * Reads current notes, appends new content, then updates
   */
  private async handleAppendNoteOperation(projectCrmId: string, data: any): Promise<any> {
    console.log(`Appending note to JobProgress project ${projectCrmId}`);
    
    try {
      // First, fetch the current project to get existing notes
      const currentProject = await this.makeRequest(`/jobs/${projectCrmId}`, 'GET');
      
      // Get existing notes (field name may vary - common ones are 'notes', 'description', 'job_notes')
      const existingNotes = currentProject?.notes || currentProject?.description || currentProject?.job_notes || '';
      
      // Append new note with separator
      const separator = existingNotes ? '\n\n---\n\n' : '';
      const updatedNotes = existingNotes + separator + data.note_content;
      
      // Update the project with appended notes
      const updateData = {
        notes: updatedNotes
      };
      
      console.log(`Updating JobProgress project ${projectCrmId} with appended note`);
      const result = await this.makeRequest(`/jobs/${projectCrmId}`, 'PUT', updateData);
      
      return {
        success: true,
        message: 'Note appended successfully',
        project_id: projectCrmId,
        result
      };
    } catch (error) {
      console.error(`Error appending note to JobProgress project ${projectCrmId}:`, error);
      throw error;
    }
  }

  private async makeRequest(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.credentials.api_key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`JobProgress API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  private async handleProjectOperation(operationType: string, resourceId: string, data: any): Promise<any> {
    switch (operationType) {
      case 'create':
        return await this.createJob(data);
      case 'update':
        return await this.updateJob(resourceId, data);
      case 'delete':
        return await this.deleteJob(resourceId);
      default:
        throw new Error(`Unsupported operation: ${operationType}`);
    }
  }

  private async handleTaskOperation(operationType: string, resourceId: string, data: any): Promise<any> {
    switch (operationType) {
      case 'create':
        return await this.createTask(data);
      case 'update':
        return await this.updateTask(resourceId, data);
      case 'delete':
        return await this.deleteTask(resourceId);
      default:
        throw new Error(`Unsupported operation: ${operationType}`);
    }
  }

  private async handleNoteOperation(operationType: string, resourceId: string, data: any): Promise<any> {
    switch (operationType) {
      case 'create':
        return await this.createNote(data);
      case 'update':
        return await this.updateNote(resourceId, data);
      case 'delete':
        return await this.deleteNote(resourceId);
      default:
        throw new Error(`Unsupported operation: ${operationType}`);
    }
  }

  private async createJob(data: any): Promise<any> {
    const jobData = {
      name: data.name || data.project_name,
      description: data.description,
      customer_id: data.customer_id,
      status: data.status,
      start_date: data.start_date,
      completion_date: data.completion_date
    };

    console.log('Creating JobProgress job:', jobData);
    return await this.makeRequest('/jobs', 'POST', jobData);
  }

  private async updateJob(jobId: string, data: any): Promise<any> {
    const updateData: any = {};
    
    if (data.name) updateData.name = data.name;
    if (data.description) updateData.description = data.description;
    if (data.status) updateData.status = data.status;
    if (data.start_date) updateData.start_date = data.start_date;
    if (data.completion_date) updateData.completion_date = data.completion_date;
    if (data.next_step) updateData.next_step = data.next_step;

    console.log(`Updating JobProgress job ${jobId}:`, updateData);
    return await this.makeRequest(`/jobs/${jobId}`, 'PUT', updateData);
  }

  private async deleteJob(jobId: string): Promise<any> {
    console.log(`Deleting JobProgress job ${jobId}`);
    return await this.makeRequest(`/jobs/${jobId}`, 'DELETE');
  }

  private async createTask(data: any): Promise<any> {
    const taskData = {
      title: data.title,
      description: data.description,
      job_id: data.project_id,
      status: data.status || 'pending',
      due_date: data.due_date,
      assigned_to: data.assignee
    };

    console.log('Creating JobProgress task:', taskData);
    return await this.makeRequest('/tasks', 'POST', taskData);
  }

  private async updateTask(taskId: string, data: any): Promise<any> {
    const updateData: any = {};
    
    if (data.title) updateData.title = data.title;
    if (data.description) updateData.description = data.description;
    if (data.status) updateData.status = data.status;
    if (data.due_date) updateData.due_date = data.due_date;
    if (data.assignee) updateData.assigned_to = data.assignee;

    console.log(`Updating JobProgress task ${taskId}:`, updateData);
    return await this.makeRequest(`/tasks/${taskId}`, 'PUT', updateData);
  }

  private async deleteTask(taskId: string): Promise<any> {
    console.log(`Deleting JobProgress task ${taskId}`);
    return await this.makeRequest(`/tasks/${taskId}`, 'DELETE');
  }

  private async createNote(data: any): Promise<any> {
    const noteData = {
      note: data.content,
      job_id: data.project_id,
      title: data.title,
      note_type: data.note_type || 'general'
    };

    console.log('Creating JobProgress note:', noteData);
    return await this.makeRequest('/job_notes', 'POST', noteData);
  }

  private async updateNote(noteId: string, data: any): Promise<any> {
    const updateData: any = {};
    
    if (data.content) updateData.note = data.content;
    if (data.title) updateData.title = data.title;

    console.log(`Updating JobProgress note ${noteId}:`, updateData);
    return await this.makeRequest(`/job_notes/${noteId}`, 'PUT', updateData);
  }

  private async deleteNote(noteId: string): Promise<any> {
    console.log(`Deleting JobProgress note ${noteId}`);
    return await this.makeRequest(`/job_notes/${noteId}`, 'DELETE');
  }
}
