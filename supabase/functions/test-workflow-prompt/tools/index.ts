
import { createActionRecordTool } from '../../_shared/tools/create-action-record/index.ts';
import { knowledgeBaseLookup } from './knowledge-base-lookup/index.ts';
import { crmDataWrite } from './crm-data-write/index.ts';
import { readCrmDataTool } from '../../_shared/tools/read-crm-data/index.ts';
import { Tool } from './types.ts';

export const tools: Tool[] = [
  createActionRecordTool,
  knowledgeBaseLookup,
  crmDataWrite,
  readCrmDataTool
];

export * from './types.ts';
