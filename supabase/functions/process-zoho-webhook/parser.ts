
import { ParsedProjectData } from './types.ts';
import { validate } from "https://deno.land/std@0.204.0/uuid/mod.ts";
import { v5 } from "https://deno.land/std@0.204.0/uuid/mod.ts";

// Using a namespace UUID for consistent company ID generation
const NAMESPACE_UUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

export function parseZohoData(rawData: any): ParsedProjectData {
  console.log('Parsing data:', rawData);

  if (!rawData || typeof rawData !== 'object') {
    throw new Error('Invalid data received from Zoho');
  }

  // Handle both direct ID field and nested ID field cases
  const idValue = rawData.ID || (rawData.rawData && rawData.rawData.ID);
  const companyIdValue = rawData.Company_ID || (rawData.rawData && rawData.rawData.Company_ID);

  if (!idValue) {
    throw new Error('Project ID is missing in the Zoho data');
  }

  if (!companyIdValue) {
    throw new Error('Company ID is missing in the Zoho data');
  }

  // Validate the namespace UUID
  if (!validate(NAMESPACE_UUID)) {
    throw new Error('Invalid namespace UUID');
  }

  const crmId = String(idValue);
  
  // Convert the company ID to bytes
  const nameBytes = new TextEncoder().encode(`zoho-company-${companyIdValue}`);
  // Generate the UUID using the namespace and name
  const companyId = v5.generate(NAMESPACE_UUID, nameBytes);

  // Handle both direct fields and nested rawData fields
  const data = rawData.rawData || rawData;

  return {
    crmId,
    companyId,
    lastMilestone: data.Last_Milestone || '',
    nextStep: data.Next_Step || '',
    propertyAddress: data.Property_Address || '',
    timeline: {
      contractSigned: String(data.Contract_Signed || ''),
      siteVisitScheduled: String(data.Site_Visit_Scheduled || ''),
      workOrderConfirmed: String(data.Work_Order_Confirmed || ''),
      roofInstallApproved: String(data.Roof_Install_Approved || ''),
      roofInstallScheduled: String(data.Install_Scheduled || ''),
      installDateConfirmedByRoofer: String(data.Install_Date_Confirmed_by_Roofer || ''),
      roofInstallComplete: String(data.Roof_Install_Complete || ''),
      roofInstallFinalized: String(data.Roof_Install_Finalized || '')
    }
  };
}
