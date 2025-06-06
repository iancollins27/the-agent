
export const identifyProjectSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Search query to identify the project (address, project name, CRM ID, etc.)"
    },
    type: {
      type: "string",
      enum: ["any", "id", "crm_id", "name", "address"],
      description: "Type of search to perform. 'any' searches all fields, others are specific"
    }
  },
  required: ["query"]
};
