
/**
 * Schema definition for knowledge-base-lookup tool
 */

export const knowledgeBaseLookupSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "The search query to find relevant information"
    },
    company_id: {
      type: "string",
      description: "Optional company ID to limit the search scope"
    },
    limit: {
      type: "integer",
      description: "Maximum number of results to return (default: 5)"
    }
  },
  required: ["query"]
};
