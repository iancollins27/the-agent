
/**
 * Normalizer Service
 * Converts different webhook payloads into a standardized format
 */
import { ParsedProjectData } from '../types.ts';

/**
 * Normalizes webhook data based on source
 * @param source Source of the webhook (e.g., 'zoho', 'monday', 'salesforce')
 * @param rawPayload The raw payload from the webhook
 * @returns Normalized project data
 */
export async function normalizeWebhookData(source: string, rawPayload: any): Promise<{
  projectData: ParsedProjectData;
  standardizedData: StandardizedWebhookData;
}> {
  console.log(`Normalizing ${source} webhook data`);
  
  switch (source.toLowerCase()) {
    case 'zoho':
      return normalizeZohoData(rawPayload);
    // Future implementations for other CRMs
    // case 'monday':
    //   return normalizeMondayData(rawPayload);
    // case 'salesforce':
    //   return normalizeSalesforceData(rawPayload);
    default:
      throw new Error(`Unsupported webhook source: ${source}`);
  }
}

/**
 * Normalized webhook data in a standardized format
 */
export interface StandardizedWebhookData {
  crmId: string;
  companyId: string;
  projectName?: string;
  projectAddress?: string;
  nextStep?: string;
  lastMilestone?: string;
  currentStatus?: string;
  notes?: string;
  projectManagerId?: string;
  eventType: 'project_created' | 'project_updated' | 'note_added' | 'status_changed';
  rawPayload: any;
}

/**
 * Normalizes Zoho CRM webhook data
 * @param rawPayload The raw payload from Zoho
 * @returns Normalized project data
 */
async function normalizeZohoData(rawPayload: any): Promise<{
  projectData: ParsedProjectData;
  standardizedData: StandardizedWebhookData;
}> {
  // Use the existing parseZohoData function from our codebase
  // This gives us backward compatibility
  const { parseZohoData } = await import('../parser.ts');
  const projectData = await parseZohoData(rawPayload);
  
  // Now convert it to our new standardized format
  const standardizedData: StandardizedWebhookData = {
    crmId: projectData.crmId,
    companyId: projectData.zohoCompanyId,
    projectAddress: projectData.propertyAddress,
    nextStep: projectData.nextStep,
    lastMilestone: projectData.lastMilestone,
    notes: projectData.notes,
    projectManagerId: projectData.projectManagerId,
    // Determine event type - in a real system this would be more sophisticated
    eventType: 'project_updated',
    rawPayload
  };
  
  console.log('Normalized data:', standardizedData);
  
  return { projectData, standardizedData };
}
