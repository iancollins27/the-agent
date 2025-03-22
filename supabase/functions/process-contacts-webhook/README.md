
# Process Contacts Webhook

This edge function processes a webhook payload containing contacts for a new or existing project.

## Webhook URL

`https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/process-contacts-webhook`

## Payload Format

The webhook accepts both JSON and form-encoded data formats:

### JSON Format (Preferred)

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

### Form-encoded Format

The function can also accept form-encoded data with either:
- A JSON string in a field named `payload`
- Individual form fields for contacts (e.g., `contacts[0][name]`, `contacts[0][email]`, etc.)
- The Bid_ID as a separate field

## Process

1. Validates the incoming webhook payload
2. Looks up the project by `Bid_ID` (which is stored as `crm_id` in the projects table)
3. For each contact:
   - Checks if the contact already exists in the system by email or phone number
   - If it exists, uses the existing contact ID and updates any changed information
   - If not, creates a new contact record
   - Checks if the contact is already linked to the project
   - Links the contact to the project through the `project_contacts` junction table if not already linked

## Valid Roles

- "Roofer" - For roofing contractors
- "HO" - For homeowners
- "BidList Project Manager" - For BidList staff
- "Solar" - For solar sales representatives
- "Role Unknown" - Default for empty roles

## Notes for Zoho Integration

When calling from Zoho, make sure to:

1. Use the correct URL: `https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/process-contacts-webhook`
2. Set the Authorization header correctly: `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aWZzeHNyYmx1ZWhvcGFtcXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4MzA0NjIsImV4cCI6MjA1NTQwNjQ2Mn0.3MYZOhz5kH71qxniwzHDzVzF3PKCulkvACDc8R1pI6I`
3. If using JSON format, send with Content-Type: `application/json`
4. If using form data, make sure to properly structure the contacts data
5. **Important**: Remove any test URL overrides in your Zoho code
