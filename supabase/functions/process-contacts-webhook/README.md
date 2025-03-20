
# Process Contacts Webhook

This edge function processes a webhook payload containing contacts for a new or existing project.

## Webhook URL

`https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/process-contacts-webhook`

## Payload Format

```json
{
  "contacts": [
    {
      "name": "Jane Doe",
      "number": "+15551234567",
      "email": "jane.doe@solarcompany.com",
      "role": "BidList Project Manager"
    },
    {
      "name": "John Smith",
      "number": "+15559876543",
      "email": "john.smith@salesrep.com",
      "role": "Solar"
    }
  ],
  "Bid_ID": 12345
}
```

## Process

1. Validates the incoming webhook payload
2. Looks up the project by `Bid_ID` (which is stored as `crm_id` in the projects table)
3. For each contact:
   - Checks if the contact already exists in the system by email or phone number
   - If it exists, uses the existing contact ID
   - If not, creates a new contact record
   - Links the contact to the project through the `project_contacts` junction table

## Valid Roles

- "Roofer" - For roofing contractors
- "HO" - For homeowners
- "BidList Project Manager" - For BidList staff
- "Solar" - For solar sales representatives
