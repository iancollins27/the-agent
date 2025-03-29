
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProjectManagerNav from "../components/ProjectManagerNav";
import KnowledgeBaseSettings from "../components/Settings/KnowledgeBaseSettings";
import CommunicationSettings from "../components/Settings/CommunicationSettings";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/components/admin/types";

interface Company {
  id: string;
  name: string;
  knowledge_base_settings?: {
    notion?: {
      token?: string;
      database_id?: string;
      page_id?: string;
      last_sync?: string;
    };
  } | Json;
  default_email_provider?: string;
  default_phone_provider?: string;
}

const CompanySettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState("knowledge-base");
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        // Get the first company as default
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .limit(1)
          .maybeSingle();
          
        if (error) {
          console.error('Error fetching company:', error);
        } else if (data) {
          // Ensure knowledge_base_settings is properly typed
          const formattedCompany: Company = {
            ...data,
            knowledge_base_settings: data.knowledge_base_settings || {}
          };
          setCompany(formattedCompany);
        }
      } catch (error) {
        console.error('Error fetching company data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCompany();
  }, []);

  const handleCompanyUpdate = async (updates: any) => {
    if (!company) return;
    
    try {
      const { error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', company.id);
        
      if (error) {
        console.error('Error updating company:', error);
      } else {
        // Update local state with the changes
        setCompany({
          ...company,
          ...updates
        });
      }
    } catch (error) {
      console.error('Error updating company data:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <ProjectManagerNav />
        <div className="container mx-auto py-6 flex justify-center items-center">
          <p>Loading company settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Company Settings</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full sm:w-[400px]">
            <TabsTrigger value="knowledge-base">Knowledge Base</TabsTrigger>
            <TabsTrigger value="communications">Communication</TabsTrigger>
          </TabsList>
          
          <TabsContent value="knowledge-base">
            {company && (
              <KnowledgeBaseSettings 
                company={company} 
                onUpdate={handleCompanyUpdate} 
              />
            )}
          </TabsContent>
          
          <TabsContent value="communications">
            <CommunicationSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CompanySettings;
