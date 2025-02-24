
export interface Timeline {
  contractSigned: string;
  siteVisitScheduled: string;
  workOrderConfirmed: string;
  roofInstallApproved: string;
  roofInstallScheduled: string;
  installDateConfirmedByRoofer: string;
  roofInstallComplete: string;
  roofInstallFinalized: string;
}

export interface ParsedProjectData {
  crmId: string;
  companyId: string;
  lastMilestone: string;
  nextStep: string;
  propertyAddress: string;
  timeline: Timeline;
}
