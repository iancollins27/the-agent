
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProjectManagerNav from "../components/ProjectManagerNav";
import KnowledgeBaseSettings from "../components/Settings/KnowledgeBaseSettings";
import { supabase } from "@/integrations/supabase/client";

const CompanySettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState("knowledge-base");
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        // Get the first company as default
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .limit(1)
          .single();
          
        if (error) {
          console.error('Error fetching company:', error);
        } else {
          setCompany(data);
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
          <TabsList className="grid grid-cols-1 w-full sm:w-[200px]">
            <TabsTrigger value="knowledge-base">Knowledge Base</TabsTrigger>
          </TabsList>
          
          <TabsContent value="knowledge-base">
            {company && (
              <KnowledgeBaseSettings 
                company={company} 
                onUpdate={(updates) => handleCompanyUpdate(updates)} 
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CompanySettings;
