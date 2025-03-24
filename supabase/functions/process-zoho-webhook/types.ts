
export interface ParsedProjectData {
  crmId: string;
  zohoCompanyId: string;
  lastMilestone: string;
  nextStep: string;
  propertyAddress: string;
  notes: string;
  projectManagerId?: string; // Add the project manager ID field
  timeline: {
    contractSigned: string;
    siteVisitScheduled: string;
    workOrderConfirmed: string;
    roofInstallApproved: string;
    roofInstallScheduled: string;
    installDateConfirmedByRoofer: string;
    roofInstallComplete: string;
    roofInstallFinalized: string;
  };
}

export interface TimelineData {
  contractSigned: string;
  siteVisitScheduled: string;
  workOrderConfirmed: string;
  roofInstallApproved: string;
  roofInstallScheduled: string;
  installDateConfirmedByRoofer: string;
  roofInstallComplete: string;
  roofInstallFinalized: string;
}
