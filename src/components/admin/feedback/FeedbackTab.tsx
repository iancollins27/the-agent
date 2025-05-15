
import React from 'react';
import FeedbackTable from './FeedbackTable';
import FeedbackDetailsDialog from './FeedbackDetailsDialog';
import { useFeedbackTab } from '@/hooks/useFeedbackTab';

const FeedbackTab = () => {
  const {
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
  } = useFeedbackTab();

  if (isLoading) {
    return <div>Loading feedback...</div>;
  }

  return (
    <>
      <FeedbackTable 
        feedbackRuns={feedbackRuns}
        onRowClick={handleRowClick}
        onOpenCRM={handleOpenCRM}
      />

      <FeedbackDetailsDialog
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        selectedRun={selectedRun}
        feedbackReview={feedbackReview}
        setFeedbackReview={setFeedbackReview}
        isSaving={isSaving}
        handleSaveFeedbackReview={handleSaveFeedbackReview}
        isReviewed={isReviewed}
      />
    </>
  );
};

export default FeedbackTab;
