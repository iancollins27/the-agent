
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
  
  // Check if payload is empty
  if (!rawPayload || (typeof rawPayload === 'object' && Object.keys(rawPayload).length === 0)) {
    console.warn('Empty webhook payload received. Using fallback data.');
    return createFallbackData(source);
  }
  
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
 * Create fallback data when payload is empty
 */
function createFallbackData(source: string): {
  projectData: ParsedProjectData;
  standardizedData: StandardizedWebhookData;
} {
  const fallbackId = `fallback-${Date.now()}`;
  
  const projectData: ParsedProjectData = {
    crmId: fallbackId,
    zohoCompanyId: '',
    lastMilestone: '',
    nextStep: 'Webhook payload was empty - manual verification needed',
    propertyAddress: 'Unknown Address',
    notes: 'This record was created from an empty webhook payload',
    timeline: {
      contractSigned: '',
      siteVisitScheduled: '',
      workOrderConfirmed: '',
      roofInstallApproved: '',
      roofInstallScheduled: '',
      installDateConfirmedByRoofer: '',
      roofInstallComplete: '',
      roofInstallFinalized: ''
    }
  };
  
  const standardizedData: StandardizedWebhookData = {
    crmId: fallbackId,
    companyId: '',
    eventType: 'project_updated',
    rawPayload: {}
  };
  
  console.log('Created fallback data due to empty payload');
  
  return { projectData, standardizedData };
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
