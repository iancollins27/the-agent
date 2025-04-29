
import { supabase } from "@/integrations/supabase/client";

export async function fetchUserProfile(userId: string) {
  if (!userId) {
    return { data: null, error: new Error('User ID is required') };
  }
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) {
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

// Helper function to fetch user profile through API - client side implementation
export async function fetchUserProfileApi(userId: string) {
  try {
    const response = await fetch(`/api/user-profile?userId=${userId}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch user profile');
    }
    
    const result = await response.json();
    return { data: result.data, error: null };
  } catch (error: any) {
    console.error('Error fetching user profile via API:', error);
    return { data: null, error };
  }
}
