
import { ParsedProjectData } from '../types.ts';

/**
 * Handles company creation or verification and returns the Supabase UUID and default track
 * @param supabase Supabase client
 * @param projectData Parsed project data from Zoho
 * @param rawData Raw data from the webhook
 * @returns Object containing company ID and default track ID
 */
export async function handleCompany(supabase: any, projectData: ParsedProjectData, rawData: any) {
  // Check if the company already exists
  let { data: existingCompany, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('zoho_id', projectData.zohoCompanyId)
    .single();

  if (companyError && companyError.status !== 404) {
    console.error('Error checking existing company:', companyError);
    throw new Error('Failed to check existing company');
  }

  if (!existingCompany) {
    // If the company doesn't exist, create it
    const companyName = rawData?.Company_Name || rawData?.rawData?.Company_Name || 'Unknown Company';
    let { data: newCompany, error: newCompanyError } = await supabase
      .from('companies')
      .insert({ zoho_id: projectData.zohoCompanyId, name: companyName })
      .select('*')
      .single();

    if (newCompanyError) {
      console.error('Error creating company:', newCompanyError);
      throw new Error('Failed to create company');
    }

    existingCompany = newCompany;
    console.log('New company created:', existingCompany);
  } else {
    console.log('Company already exists:', existingCompany);
  }

  // Fetch the default project track for the company using default_project_track field
  const { data: defaultTrack, error: trackError } = await supabase
    .from('companies')
    .select('default_project_track')
    .eq('id', existingCompany.id)
    .single();
    
  if (trackError) {
    console.error('Error fetching default track from companies table:', trackError);
  }

  // Use the default_project_track directly from the company record
  const defaultTrackId = defaultTrack?.default_project_track || null;
  console.log('Default track ID from company record:', defaultTrackId);

  return {
    id: existingCompany.id,
    defaultTrackId: defaultTrackId
  };
}
