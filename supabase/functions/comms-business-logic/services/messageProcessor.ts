
/**
 * Re-export message processor functions from their respective modules
 */
import { 
  processCommunicationForProject, 
  processMessagesForProject 
} from "./processors/singleProjectProcessor.ts";

import { 
  processMultiProjectMessages 
} from "./processors/multiProjectBatchProcessor.ts";

// Export the functions so they're available to other modules
export {
  processCommunicationForProject,
  processMessagesForProject,
  processMultiProjectMessages
};
