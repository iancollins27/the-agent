
import { ParsedProjectData } from './types.ts';
import { v5 } from "https://deno.land/std@0.204.0/uuid/v5.ts";
import { validate } from "https://deno.land/std@0.204.0/uuid/mod.ts";

// Using a namespace UUID for consistent company ID generation
const NAMESPACE_UUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

export async function parseZohoData(rawData: any): Promise<ParsedProjectData> {
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
  
  const crmId = String(idValue);
  
  // Convert the company ID to a string that will be used for UUID generation
  const nameString = `zoho-company-${companyIdValue}`;
  console.log(`Generating UUID for name: ${nameString}`);
  
  try {
    // Generate the v5 UUID using the namespace and name
    // Wait for the promise to resolve
    const companyId = await v5.generate(NAMESPACE_UUID, nameString);
    
    console.log(`Generated UUID: ${companyId}`);
    
    // Handle both direct fields and nested rawData fields
    const data = rawData.rawData || rawData;
    
    const result = {
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
    
    console.log('Parsed result:', result);
    return result;
  } catch (error) {
    console.error('Error generating UUID:', error);
    throw error;
  }
}
