
import { createActionRecord } from './create-action-record/index.ts';
import { dataFetch } from './data-fetch/index.ts';
import { knowledgeBaseLookup } from './knowledge-base-lookup/index.ts';
import { crmDataWrite } from './crm-data-write/index.ts';
import { readCrmData } from './read-crm-data/index.ts';
import { Tool } from './types.ts';

export const tools: Tool[] = [
  createActionRecord,
  dataFetch,
  knowledgeBaseLookup,
  crmDataWrite,
  readCrmData
];

export * from './types.ts';
