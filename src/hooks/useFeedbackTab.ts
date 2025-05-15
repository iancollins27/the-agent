
import { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { updateFeedbackReviewStatus } from '@/utils/api/prompt-runs';

interface FeedbackRun {
  id: string;
  created_at: string;
  status: string;
  ai_provider: string;
  ai_model: string;
  prompt_input: string;
  prompt_output: string | null;
  error_message: string | null;
  error: boolean;
  feedback_description: string;
  feedback_rating: number | null;
  feedback_review: string | null;
  feedback_tags: string[] | null;
  project_address: string | null;
  project_manager: string | null;
  project_crm_url: string | null;
  reviewed: boolean;
  project_id: string | null;
  relative_time: string;
  toolLogsCount: number;
}

export const useFeedbackTab = () => {
  const [feedbackRuns, setFeedbackRuns] = useState<FeedbackRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<FeedbackRun | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedbackReview, setFeedbackReview] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Use React Query to fetch prompt runs with feedback
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['feedbackRuns'],
    queryFn: async () => {
      // Use explicitly joined select to ensure proper relationship handling
      const { data, error } = await supabase
        .from('prompt_runs')
        .select(`
          *,
          project:project_id (
            id,
            Address,
            project_name
          )
        `)
        .not('feedback_description', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  // Process the data when it's available
  useEffect(() => {
    if (data) {
      const formattedRuns = data.map(run => {
        // Handle project object safely with optional chaining and nullish coalescing
        const project = run.project || {};
        
        return {
          id: run.id,
          created_at: run.created_at,
          status: run.status || '',
          ai_provider: run.ai_provider || '',
          ai_model: run.ai_model || '',
          prompt_input: run.prompt_input || '',
          prompt_output: run.prompt_output || '',
          error_message: run.error_message,
          error: !!run.error_message,
          feedback_description: run.feedback_description || '',
          feedback_rating: run.feedback_rating,
          feedback_review: run.feedback_review,
          feedback_tags: run.feedback_tags,
          project_address: project && 'Address' in project ? project.Address : 'No address',
          // Project manager is not reliably available in the current data structure
          project_manager: 'No manager assigned',
          project_crm_url: null, // crm_url doesn't exist, so set to null
          completed_at: run.completed_at,
          reviewed: run.reviewed || false,
          project_id: run.project_id,
          relative_time: formatRelativeTime(run.created_at),
          toolLogsCount: 0,
          workflow_prompt_id: run.workflow_prompt_id,
        } as FeedbackRun;
      });
      setFeedbackRuns(formattedRuns);
    }
  }, [data]);

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const now = new Date();
    const promptDate = new Date(dateString);
    const diffMs = now.getTime() - promptDate.getTime();
  
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  const handleRowClick = (run: FeedbackRun) => {
    setSelectedRun(run);
    setFeedbackReview(run.feedback_review || '');
    setIsModalOpen(true);
  };
  
  const handleOpenCRM = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    window.open(url, '_blank');
  };

  const handleSaveFeedbackReview = async (review: string) => {
    if (!selectedRun) return;
    
    setIsSaving(true);
    try {
      // Set reviewed status based on whether there's content in the feedback_review field
      const hasReviewContent = review.trim().length > 0;

      await updateFeedbackReviewStatus(selectedRun.id, {
        feedback_review: review,
        reviewed: hasReviewContent
      });

      // Update local state
      setFeedbackRuns(prev => 
        prev.map(run => 
          run.id === selectedRun.id 
            ? { ...run, feedback_review: review, reviewed: hasReviewContent } 
            : run
        )
      );
      
      // Update selected run
      setSelectedRun(prev => 
        prev ? { ...prev, feedback_review: review, reviewed: hasReviewContent } : null
      );

      toast({
        title: hasReviewContent ? "Feedback review saved" : "Feedback review cleared",
        description: hasReviewContent 
          ? "Your feedback review has been saved successfully." 
          : "The feedback review has been cleared."
      });
      
      // Refetch the data
      refetch();
    } catch (error) {
      console.error('Error saving feedback review:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save feedback review. Please try again."
      });
    } finally {
      setIsSaving(false);
      setIsModalOpen(false);
    }
  };

  // Function to check if a prompt run has been reviewed based on content
  const isReviewed = (run: FeedbackRun) => {
    return run.reviewed || (run.feedback_review && run.feedback_review.trim().length > 0);
  };

  return {
    feedbackRuns,
    selectedRun,
    isModalOpen,
    setIsModalOpen,
    feedbackReview,
    setFeedbackReview,
    isSaving,
    isLoading,
    handleRowClick,
    handleOpenCRM,
    handleSaveFeedbackReview,
    isReviewed
  };
};
