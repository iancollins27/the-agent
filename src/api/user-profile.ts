
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
