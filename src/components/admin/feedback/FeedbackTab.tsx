
import React from 'react';
import { useToast } from "@/components/ui/use-toast";
import { useFeedbackTab } from "@/hooks/useFeedbackTab";
import FeedbackTable from './FeedbackTable';
import FeedbackDetailsDialog from './FeedbackDetailsDialog';

const FeedbackTab: React.FC = () => {
  const { toast } = useToast();
  const {
    feedback,
    selectedFeedback,
    isDetailsOpen,
    isSavingReview,
    loading,
    setIsDetailsOpen,
    handleReviewSave,
    handleFeedbackSelect,
  } = useFeedbackTab();

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm">
        <FeedbackTable
          feedback={feedback}
          loading={loading}
          onFeedbackSelect={handleFeedbackSelect}
        />
      </div>

      {selectedFeedback && (
        <FeedbackDetailsDialog
          feedback={selectedFeedback}
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          onSaveReview={handleReviewSave}
          isSaving={isSavingReview}
        />
      )}
    </div>
  );
};

export default FeedbackTab;
