
import React from 'react';
import { useToast } from "@/components/ui/use-toast";
import { useFeedbackTab } from "@/hooks/useFeedbackTab";
import FeedbackTable from './FeedbackTable';
import FeedbackDetailsDialog from './FeedbackDetailsDialog';

const FeedbackTab: React.FC = () => {
  const { toast } = useToast();
  const {
    feedbackRuns,
    selectedRun,
    isModalOpen,
    isSaving,
    isLoading,
    setIsModalOpen,
    handleSaveFeedbackReview,
    handleRowClick,
    handleOpenCRM
  } = useFeedbackTab();

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm">
        <FeedbackTable
          feedbackRuns={feedbackRuns}
          loading={isLoading}
          onRowClick={handleRowClick}
          onOpenCRM={handleOpenCRM}
        />
      </div>

      {selectedRun && (
        <FeedbackDetailsDialog
          run={selectedRun}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onSaveReview={handleSaveFeedbackReview}
          isSaving={isSaving}
        />
      )}
    </div>
  );
};

export default FeedbackTab;
