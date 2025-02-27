
import { ParsedProjectData } from './types.ts';

export async function parseZohoData(rawData: any): Promise<ParsedProjectData> {
  console.log('Parsing data:', rawData);
  
  if (!rawData || typeof rawData !== 'object') {
    throw new Error('Invalid data received from Zoho');
  }
  
  // Handle both direct ID field and nested ID field cases
  // Convert to string immediately to preserve precision
  const idValue = String(rawData.ID || (rawData.rawData && rawData.rawData.ID));
  const companyIdFromZoho = String(rawData.Company_ID || (rawData.rawData && rawData.rawData.Company_ID));
  
  // Log the raw ID value for debugging
  console.log('Raw ID from Zoho:', rawData.ID || (rawData.rawData && rawData.rawData.ID));
  console.log('Converted ID:', idValue);
  
  if (!idValue) {
    throw new Error('Project ID is missing in the Zoho data');
  }
  
  if (!companyIdFromZoho) {
    throw new Error('Company ID is missing in the Zoho data');
  }
  
  // Handle both direct fields and nested rawData fields
  const data = rawData.rawData || rawData;
  
  const result = {
    crmId: idValue, // Using the string version of the ID
    zohoCompanyId: companyIdFromZoho,
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
}
