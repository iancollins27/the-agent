
import { ZohoConnector } from "../connectors/zoho.ts";
import { JobProgressConnector } from "../connectors/jobprogress.ts";
import { BaseConnector } from "../models/connector.ts";

export class DataFetchRouter {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async fetchProjectData(projectId: string, includeRaw: boolean): Promise<any> {
    try {
      if (!projectId) {
        throw new Error("Project ID is required");
      }

      console.log(`Fetching data for project: ${projectId}`);

      // First, get the project and its company_id
      const { data: project, error: projectError } = await this.supabase
        .from("projects")
        .select("*, companies(*)")
        .eq("id", projectId)
        .maybeSingle(); // Using maybeSingle instead of single to prevent the error

      if (projectError) {
        throw new Error(`Failed to fetch project details: ${projectError.message}`);
      }

      if (!project) {
        throw new Error(`No project found with ID: ${projectId}`);
      }

      const companyId = project.company_id;
      if (!companyId) {
        throw new Error(`Project does not have an associated company`);
      }

      // Get company integration info
      const { data: integration, error } = await this.supabase
        .from("company_integrations")
        .select("provider_name, provider_type, api_key, api_secret, account_id, integration_mode")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch company integration details: ${error.message}`);
      }

      // If no integration is found, return the project data without CRM data
      if (!integration) {
        console.log(`No active integration found for company_id: ${companyId}, returning basic project data only`);
        
        // Fetch contacts for this project
        const { data: contacts, error: contactsError } = await this.supabase
          .from("project_contacts")
          .select("contact_id, contacts(*)")
          .eq("project_id", projectId);
          
        if (contactsError) {
          throw new Error(`Failed to fetch project contacts: ${contactsError.message}`);
        }
        
        // Fetch communications for this project
        const { data: communications, error: commsError } = await this.supabase
          .from("communications")
          .select("*")
          .eq("project_id", projectId)
          .order("timestamp", { ascending: false })
          .limit(20);
          
        if (commsError) {
          throw new Error(`Failed to fetch communications: ${commsError.message}`);
        }
        
        // Return basic project data
        return {
          project: project,
          contacts: contacts?.map(c => c.contacts) || [],
          communications: communications || [],
          tasks: [],
          notes: [],
          provider: "database-only",
          fetched_at: new Date().toISOString()
        };
      }

      // Add company_id to the integration object for use in the connector
      const enhancedIntegration = {
        ...integration,
        company_id: companyId
      };

      // Initialize the appropriate connector based on provider_name
      const connector = this.getConnector(integration.provider_name, enhancedIntegration);
      
      console.log(`Using ${integration.provider_name} connector to fetch project data`);
      
      // Fetch project details from CRM
      const projectDetails = await connector.fetchResource('project', projectId);
      
      // Fetch contacts for this project
      const { data: contacts, error: contactsError } = await this.supabase
        .from("project_contacts")
        .select("contact_id, contacts(*)")
        .eq("project_id", projectId);
        
      if (contactsError) {
        throw new Error(`Failed to fetch project contacts: ${contactsError.message}`);
      }
      
      // Fetch communications for this project
      const { data: communications, error: commsError } = await this.supabase
        .from("communications")
        .select("*")
        .eq("project_id", projectId)
        .order("timestamp", { ascending: false })
        .limit(20);
        
      if (commsError) {
        throw new Error(`Failed to fetch communications: ${commsError.message}`);
      }
      
      // Fetch tasks (can be from CRM depending on integration)
      const tasks = await connector.fetchResource('task', null, projectId);
      
      // Fetch notes (can be from CRM depending on integration)  
      const notes = await connector.fetchResource('note', null, projectId);

      // Process result into a comprehensive response
      const response: any = {
        project: {
          ...project,
          ...projectDetails.data
        },
        contacts: contacts?.map(c => c.contacts) || [],
        communications: communications || [],
        tasks: tasks.data || [],
        notes: notes.data || [],
        provider: integration.provider_name,
        fetched_at: new Date().toISOString()
      };

      // Include raw data if requested
      if (includeRaw) {
        response.raw = {
          project: projectDetails.raw,
          tasks: tasks.raw,
          notes: notes.raw
        };
      }

      return response;
    } catch (error) {
      console.error("Router error:", error);
      throw error;
    }
  }
  
  // Original fetchData method remains for backward compatibility
  async fetchData(companyId: string, resourceType: string, resourceId: string | null, includeRaw: boolean): Promise<any> {
    try {
      // Get company integration info
      const { data: integration, error } = await this.supabase
        .from("company_integrations")
        .select("provider_name, provider_type, api_key, api_secret, account_id, integration_mode")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch company integration details: ${error.message}`);
      }

      if (!integration) {
        throw new Error(`No active integration found for company_id: ${companyId}`);
      }

      // Initialize the appropriate connector based on provider_name
      const connector = this.getConnector(integration.provider_name, integration);

      // Fetch data using the connector
      const result = await connector.fetchResource(resourceType, resourceId);
      
      // Process result
      const response: any = {
        provider: integration.provider_name,
        resource: resourceType,
        data: result.data,
        fetched_at: new Date().toISOString()
      };

      // Include raw data if requested
      if (includeRaw && result.raw) {
        response.raw = result.raw;
      }

      // If this is a project fetch, update milestone information
      if (resourceType === "project" && resourceId) {
        await this.updateMilestoneInfo(resourceId, result.data);
      }

      return response;
    } catch (error) {
      console.error("Router error:", error);
      throw error;
    }
  }

  private getConnector(providerName: string, integration: any): BaseConnector {
    switch (providerName.toLowerCase()) {
      case "zoho":
        return new ZohoConnector(this.supabase, integration);
      case "jobprogress":
        return new JobProgressConnector(this.supabase, integration);
      // Add more cases for other CRM providers as they're implemented
      default:
        throw new Error(`Unsupported provider: ${providerName}`);
    }
  }

  private async updateMilestoneInfo(projectId: string, projectData: any): Promise<void> {
    try {
      if (!projectData.next_step) {
        console.log("No next step found in project data, skipping milestone update");
        return;
      }

      // Get project information including track
      const { data: project, error: projectError } = await this.supabase
        .from("projects")
        .select("id, project_track")
        .eq("id", projectId)
        .maybeSingle();

      if (projectError || !project) {
        console.error("Error fetching project:", projectError);
        return;
      }

      // Get milestone information based on next_step
      if (project.project_track) {
        const { data: milestone, error: milestoneError } = await this.supabase
          .from("project_track_milestones")
          .select("id, prompt_instructions")
          .eq("track_id", project.project_track)
          .eq("step_title", projectData.next_step)
          .maybeSingle();

        if (milestoneError) {
          console.error("Error fetching milestone:", milestoneError);
          return;
        }

        if (milestone) {
          // Update project with milestone information
          const { error: updateError } = await this.supabase
            .from("projects")
            .update({
              next_milestone_id: milestone.id,
              milestone_instructions: milestone.prompt_instructions
            })
            .eq("id", projectId);

          if (updateError) {
            console.error("Error updating project milestone info:", updateError);
          } else {
            console.log(`Updated milestone info for project ${projectId}`);
          }
        } else {
          console.log(`No milestone found for step: ${projectData.next_step}`);
        }
      }
    } catch (error) {
      console.error("Error updating milestone information:", error);
    }
  }
}
