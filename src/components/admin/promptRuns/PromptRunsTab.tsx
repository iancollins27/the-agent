
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Component imports
import PromptRunsTable from './PromptRunsTable';
import PromptRunFilters from '../PromptRunFilters';
import EmptyPromptRunsState from './EmptyPromptRunsState';
import TimeFilterSelect from '../TimeFilterSelect';
import PromptRunHeader from './PromptRunHeader';

// Hooks and utils
import { useTimeFilter } from '@/hooks/useTimeFilter';
import { usePromptRunData } from './usePromptRunData';
import { useFilterPersistence } from '@/hooks/useFilterPersistence';

const PromptRunsTab = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [activeTab, setActiveTab] = useState('all');
  
  // Get time filter state
  const { timeFilter, setTimeFilter } = useTimeFilter();
  
  // Set up persisted filter state
  const { filters, setFilter } = useFilterPersistence('promptRunsFilters', {
    reviewed: false,
    rating: null,
    hasError: false,
    search: '',
  });
  
  // Fetch prompt runs data with filters
  const { 
    data, 
    isLoading, 
    error, 
    refresh
  } = usePromptRunData({ 
    projectId, 
    timeFilter, 
    filters,
    activeTab
  });
  
  // Fetch project data if projectId is available
  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, Address')
        .eq('id', projectId)
        .single();
        
      if (error) throw error;
      return data;
    },
    enabled: !!projectId
  });
  
  useEffect(() => {
    if (error) {
      toast({
        title: "Error Loading Data",
        description: error.message || "Failed to load prompt runs. Please try again.",
        variant: "destructive",
      });
    }
  }, [error]);
  
  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };
  
  return (
    <div className="w-full">
      {/* Header with project info if viewing a single project */}
      {projectId && projectData && (
        <PromptRunHeader 
          projectName={projectData.project_name || projectData.Address || 'Unnamed Project'}
          onBackClick={() => navigate('/admin/prompt-runs')}
        />
      )}
      
      {/* Filters row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
          <TimeFilterSelect 
            value={timeFilter}
            onChange={setTimeFilter}
          />
          <PromptRunFilters 
            filters={filters}
            setFilter={setFilter}
          />
        </div>
        
        {/* Tabs for execution status */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full md:w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="success">Successful</TabsTrigger>
            <TabsTrigger value="error">Errors</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Content */}
      <TabsContent value={activeTab} className="mt-0">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, index) => (
              <Skeleton key={index} className="w-full h-16 rounded-md" />
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <PromptRunsTable data={data} refresh={refresh} />
        ) : (
          <EmptyPromptRunsState 
            filters={filters}
            timeFilter={timeFilter}
            onResetFilters={() => {
              setFilter('rating', null);
              setFilter('reviewed', false);
              setFilter('hasError', false);
              setFilter('search', '');
              setTimeFilter('24h');
            }}
          />
        )}
      </TabsContent>
    </div>
  );
};

export default PromptRunsTab;
