
/**
 * Knowledge base lookup tool implementation
 */
import { Tool } from '../types.ts';
import { knowledgeBaseLookupSchema } from './schema.ts';
import { handleKnowledgeBaseLookup } from './handler.ts';

export const knowledgeBaseLookup: Tool = {
  name: "knowledge_base_lookup",
  description: "Searches the knowledge base for relevant information",
  schema: knowledgeBaseLookupSchema,
  execute: handleKnowledgeBaseLookup
};
