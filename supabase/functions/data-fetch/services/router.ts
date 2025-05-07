
import { ZohoConnector } from "../connectors/zoho.ts";
import { BaseConnector } from "../models/connector.ts";

export class DataFetchRouter {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

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
