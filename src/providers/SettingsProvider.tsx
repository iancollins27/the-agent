
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";

// Types for our settings context
interface CompanySettings {
  id?: string;
  name?: string;
  knowledge_base_settings?: Json;
  notion_settings?: {
    token: string;
    database_id: string;
    page_id: string;
    last_sync?: string | null;
  };
  default_email_provider?: string;
  default_phone_provider?: string;
  communication_settings?: Json;
}

interface SettingsContextType {
  companySettings: CompanySettings | null;
  updateCompanySettings: (updates: Partial<CompanySettings>) => Promise<void>;
  isLoading: boolean;
}

// Create context with default values
const SettingsContext = createContext<SettingsContextType>({
  companySettings: null,
  updateCompanySettings: async () => {},
  isLoading: false,
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCompanySettings = async () => {
      try {
        setIsLoading(true);
        // Get the first company as default
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .limit(1)
          .maybeSingle();
          
        if (error) {
          console.error('Error fetching company settings:', error);
          toast({
            title: "Error",
            description: "Failed to load company settings",
            variant: "destructive",
          });
        } else if (data) {
          console.log('Fetched company settings:', data);
          setCompanySettings(data);
        }
      } catch (error) {
        console.error('Error fetching company data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCompanySettings();
  }, [toast]);

  const updateCompanySettings = async (updates: Partial<CompanySettings>) => {
    if (!companySettings?.id) {
      toast({
        title: "Error",
        description: "No company selected to update",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // For notion_settings, merge with existing settings
      if (updates.notion_settings && companySettings.notion_settings) {
        updates.notion_settings = {
          ...companySettings.notion_settings,
          ...updates.notion_settings
        };
      }
      
      console.log('Updating company settings:', updates);
      
      const { error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', companySettings.id);
        
      if (error) {
        console.error('Error updating company settings:', error);
        toast({
          title: "Error",
          description: "Failed to update company settings",
          variant: "destructive",
        });
      } else {
        // Update local state with the changes
        setCompanySettings({
          ...companySettings,
          ...updates
        });
        toast({
          title: "Success",
          description: "Company settings updated",
        });
      }
    } catch (error) {
      console.error('Error updating company data:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <SettingsContext.Provider value={{ companySettings, updateCompanySettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
