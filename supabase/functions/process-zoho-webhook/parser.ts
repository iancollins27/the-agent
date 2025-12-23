
import { ParsedProjectData } from './types.ts';

export async function parseZohoData(rawData: any): Promise<ParsedProjectData> {
  console.log('Parsing data:', rawData);
  
  if (!rawData || typeof rawData !== 'object') {
    throw new Error('Invalid data received from Zoho');
  }
  
  // Handle both direct ID field and nested ID field cases
  // Ensure IDs are always treated as strings to preserve precision
  const idValue = rawData.ID || (rawData.rawData && rawData.rawData.ID);
  const idValueString = String(idValue); // Explicitly convert to string
  const companyIdFromZoho = String(rawData.Company_ID || (rawData.rawData && rawData.rawData.Company_ID));
  
  // Log the raw ID value for debugging
  console.log('Raw ID from Zoho:', idValue);
  console.log('Converted ID (string):', idValueString);
  
  if (!idValue) {
    throw new Error('Project ID is missing in the Zoho data');
  }
  
  if (!companyIdFromZoho) {
    throw new Error('Company ID is missing in the Zoho data');
  }
  
  // Handle both direct fields and nested rawData fields
  const data = rawData.rawData || rawData;
  
  // Log the data to help with debugging
  console.log('Processing data object:', data);
  console.log('Notes from Zoho:', data.Notes || 'No notes provided');
  console.log('Property Address from Zoho:', data.Property_Address || 'No address provided');
  
  // Added logging for Project Manager ID from Zoho (checking both formats)
  console.log('Project Manager ID from Zoho (with underscore):', data.Project_Manager_ID || 'Not found');
  console.log('Project Manager ID from Zoho (with spaces):', data['Project Manager ID'] || 'Not found');
  
  // Check for Address field in various formats and log it
  if (data.Address) {
    console.log('Found Address field:', data.Address);
  }
  if (data.Property_Address) {
    console.log('Found Property_Address field:', data.Property_Address);
  }
  if (data.property_address) {
    console.log('Found property_address field:', data.property_address);
  }
  
  // Enhanced address extraction
  const propertyAddress = data.Property_Address || data.Address || data.property_address || '';
  console.log('Final extracted property address:', propertyAddress);
  
  // Fix: Extract project manager ID checking both naming conventions (with spaces and with underscores)
  const projectManagerId = String(
    data.Project_Manager_ID || 
    data['Project Manager ID'] || 
    ''
  );
  console.log('Extracted project manager ID:', projectManagerId);
  
  // Parse Test_Record - handle various formats (boolean, string "true"/"false", etc.)
  const testRecordValue = data.Test_Record ?? data.test_record ?? false;
  const testRecord = testRecordValue === true || testRecordValue === 'true' || testRecordValue === 1;
  
  // Parse Status field
  const status = data.Status || data.status || '';
  
  console.log('Parsed Test_Record:', testRecord, 'from value:', testRecordValue);
  console.log('Parsed Status:', status);
  
  const result = {
    crmId: idValueString,
    zohoCompanyId: companyIdFromZoho,
    lastMilestone: data.Last_Milestone || '',
    nextStep: data.Next_Step || '',
    propertyAddress: propertyAddress,
    notes: data.Notes || '',
    projectManagerId: projectManagerId,
    testRecord: testRecord,
    status: status,
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
