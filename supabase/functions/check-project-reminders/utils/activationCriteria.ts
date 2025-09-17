/**
 * Checks if a project meets the activation criteria for reminder actions
 * @param projectData The project data from CRM
 * @returns Object with result and reason
 */
export function meetsActivationCriteria(projectData: any): { 
  meetsActivationCriteria: boolean; 
  reason?: string 
} {
  if (!projectData) {
    return { 
      meetsActivationCriteria: false, 
      reason: "No project data provided" 
    };
  }

  // Extract the record from project data
  let recordRec = projectData.project?.fields || projectData;
  
  // If the required fields are in zoho_fields, merge them into recordRec
  if (recordRec.zoho_fields && (
    !recordRec.Contract_Signed || 
    recordRec.Roof_Install_Finalized === undefined || 
    recordRec.Test_Record === undefined || 
    !recordRec.Status
  )) {
    recordRec = {
      ...recordRec,
      ...recordRec.zoho_fields
    };
  }
  
  // Make sure we use the status from the top level if it exists
  if (!recordRec.Status && projectData.status) {
    recordRec.Status = projectData.status;
  }
  
  // If Test_Record is undefined, default to false
  if (recordRec.Test_Record === undefined) {
    recordRec.Test_Record = false;
  }
  
  // If Roof_Install_Finalized is an empty string, treat it as null
  if (recordRec.Roof_Install_Finalized === '') {
    recordRec.Roof_Install_Finalized = null;
  }

  // Log the fields we're checking
  console.log('Checking activation criteria with fields:', {
    Contract_Signed: recordRec.Contract_Signed,
    Roof_Install_Finalized: recordRec.Roof_Install_Finalized,
    Test_Record: recordRec.Test_Record,
    Status: recordRec.Status
  });

  // Check entry criteria
  let entryCheck = false;
  if (
    recordRec.Contract_Signed != null && 
    recordRec.Roof_Install_Finalized == null && 
    recordRec.Test_Record === false
  ) {
    entryCheck = true;
  }

  // Check status criteria
  let statusCheck = false;
  if (
    recordRec.Status !== "Archived" && 
    recordRec.Status !== "VOID" && 
    recordRec.Status !== "Cancelled" && 
    recordRec.Status !== "Canceled"
  ) {
    statusCheck = true;
  }

  // Both criteria must be met
  const meetsActivationCriteria = entryCheck && statusCheck;

  // Return result with reason if criteria not met
  if (!meetsActivationCriteria) {
    let reason = "";
    if (!entryCheck) {
      reason = "Project does not meet entry criteria: Contract signed, roof install not finalized, and not a test record";
    } else if (!statusCheck) {
      reason = `Project status '${recordRec.Status}' is not eligible for reminders`;
    }
    
    return { meetsActivationCriteria, reason };
  }

  return { meetsActivationCriteria: true };
}
