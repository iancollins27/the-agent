
export const schema = {
  type: 'object',
  properties: {
    project_id: {
      type: 'string',
      description: 'UUID of the project to summarize emails for'
    },
    days_lookback: {
      type: 'number',
      description: 'Number of days to look back for emails if no last processed date exists (default: 7)'
    },
    append_mode: {
      type: 'boolean',
      description: 'Whether to append to existing summary (true) or replace it (false). Default: true'
    }
  },
  required: ['project_id']
};
