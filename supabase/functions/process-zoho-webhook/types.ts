
export interface ParsedProjectData {
  crmId: string;
  zohoCompanyId: string; // Changed from companyId to zohoCompanyId to be more explicit
  lastMilestone: string;
  nextStep: string;
  propertyAddress: string;
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
