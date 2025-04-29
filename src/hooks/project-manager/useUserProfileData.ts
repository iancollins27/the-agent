
import { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { fetchUserProfile } from '@/api/user-profile';
import { useAuth } from "@/hooks/useAuth";

export const useUserProfileData = () => {
  const [userProfile, setUserProfile] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch user profile data on mount
  useEffect(() => {
    const getUserProfile = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await fetchUserProfile(user.id);
          
        if (error) {
          console.error('Error fetching user profile:', error);
          toast({
            variant: "destructive",
            title: "Error",
            description: `Failed to load user profile: ${error.message}`
          });
        } else {
          setUserProfile(data);
        }
      } catch (error: any) {
        console.error('Error fetching user profile:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: 'Failed to load user profile data'
        });
      }
    };
    
    getUserProfile();
  }, [user, toast]);

  return { user, userProfile };
};
