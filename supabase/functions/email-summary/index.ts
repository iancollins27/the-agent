
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { ImapFlow } from "https://esm.sh/imapflow@1.0.157";
import { simpleParser } from "https://esm.sh/mailparser@3.6.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailSummaryRequest {
  project_id: string;
  company_id: string; // Required for security
  days_lookback?: number; // Optional: how many days back to look for emails
  append_mode?: boolean; // Whether to append to existing summary or replace
}

async function getEmailCredentials(supabase: any, company_id: string) {
  try {
    const { data, error } = await supabase
      .from('company_integrations')
      .select('*')
      .eq('company_id', company_id)
      .eq('provider_type', 'email')
      .eq('is_active', true)
      .single();
      
    if (error || !data) {
      console.error("Error fetching email credentials:", error);
      throw new Error("No email integration found for this company");
    }
    
    return {
      user: data.account_id,
      password: data.api_secret,
      host: data.api_key.includes('@gmail') ? 'imap.gmail.com' : 
            data.api_key.includes('@outlook') || data.api_key.includes('@hotmail') ? 'outlook.office365.com' : 
            'imap.mail.yahoo.com', // Default to yahoo if domain is unknown
      port: 993,
      secure: true
    };
  } catch (error) {
    console.error("Failed to get email credentials:", error);
    throw new Error("Could not retrieve email credentials");
  }
}

async function fetchProjectEmails(credentials: any, projectId: string, lastProcessedDate: Date | null, daysLookback: number = 7) {
  console.log(`Connecting to email server at ${credentials.host} for user ${credentials.user}`);
  
  const client = new ImapFlow({
    host: credentials.host,
    port: credentials.port,
    secure: credentials.secure,
    auth: {
      user: credentials.user,
      pass: credentials.password,
    },
    logger: false
  });

  const emails = [];
  
  try {
    // Connect to the server
    await client.connect();
    
    // Select and lock the mailbox
    const lock = await client.getMailboxLock('INBOX');
    
    try {
      // Calculate search date
      let searchDate;
      if (lastProcessedDate) {
        searchDate = lastProcessedDate;
        console.log(`Searching for emails since last processed date: ${searchDate.toISOString()}`);
      } else {
        searchDate = new Date();
        searchDate.setDate(searchDate.getDate() - daysLookback);
        console.log(`No last processed date found. Searching for emails from the last ${daysLookback} days`);
      }
      
      // Format date for IMAP search
      const formattedDate = searchDate.toISOString().split('T')[0];
      
      // Search for messages related to the project
      const searchCriteria = {
        since: formattedDate,
        subject: `Project-${projectId}`
      };
      
      console.log(`Searching with criteria: ${JSON.stringify(searchCriteria)}`);
      
      // Fetch matching messages
      for await (const message of client.fetch({ since: formattedDate }, { source: true })) {
        const parsedEmail = await simpleParser(message.source);
        
        // Check if email is related to project
        // Either by:
        // 1. Subject contains project ID
        // 2. Body contains project ID
        const isProjectRelated = 
          (parsedEmail.subject && parsedEmail.subject.includes(projectId)) || 
          (parsedEmail.text && parsedEmail.text.includes(projectId));
          
        if (isProjectRelated) {
          emails.push({
            id: message.uid,
            date: parsedEmail.date,
            subject: parsedEmail.subject,
            from: parsedEmail.from?.text,
            to: parsedEmail.to?.text,
            text: parsedEmail.text,
            html: parsedEmail.html
          });
        }
      }
    } finally {
      // Release the mailbox lock
      lock.release();
    }
    
    // Logout
    await client.logout();
    
  } catch (error) {
    console.error("Error fetching emails:", error);
    throw new Error(`Failed to fetch emails: ${error.message}`);
  }
  
  return emails;
}

async function summarizeEmails(emails: any[]) {
  if (emails.length === 0) {
    return "No new emails found for this project.";
  }
  
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not found");
  }
  
  try {
    // Sort emails by date
    emails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const emailContent = emails.map(email => {
      return `
Date: ${email.date}
From: ${email.from}
To: ${email.to}
Subject: ${email.subject}
Content: ${email.text || email.html}
      `;
    }).join('\n\n---\n\n');
    
    console.log(`Summarizing ${emails.length} emails`);
    
    // Call OpenAI API for summarization
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-5-2025-08-07",
        messages: [
          {
            role: "system",
            content: "You are a professional assistant tasked with summarizing emails related to a project. Create a concise summary of the key points, action items, and important information from these emails. Organize the summary by topic and highlight any deadlines or important dates mentioned."
          },
          {
            role: "user",
            content: `Please summarize the following emails for a project:\n\n${emailContent}`
          }
        ],
        max_completion_tokens: 1000,
      }),
    });
    
    const data = await response.json();
    if (!data.choices || data.choices.length === 0) {
      console.error("Invalid response from OpenAI:", data);
      throw new Error("Failed to generate summary");
    }
    
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error summarizing emails:", error);
    throw new Error(`Failed to summarize emails: ${error.message}`);
  }
}

async function updateProjectWithSummary(supabase: any, projectId: string, summary: string, appendMode: boolean, currentTime: string) {
  try {
    // Get existing summary if in append mode
    let finalSummary = summary;
    
    if (appendMode) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('email_summary')
        .eq('id', projectId)
        .single();
      
      if (!projectError && project && project.email_summary) {
        finalSummary = `${project.email_summary}\n\n--- New Email Summary (${new Date().toISOString().split('T')[0]}) ---\n\n${summary}`;
      }
    }
    
    // Update project with new summary
    const { error } = await supabase
      .from('projects')
      .update({ 
        email_summary: finalSummary,
        last_email_processed_at: currentTime
      })
      .eq('id', projectId);
      
    if (error) {
      console.error("Error updating project with email summary:", error);
      throw new Error(`Failed to update project: ${error.message}`);
    }
    
    return finalSummary;
  } catch (error) {
    console.error("Error in updateProjectWithSummary:", error);
    throw new Error(`Failed to update project with summary: ${error.message}`);
  }
}

async function verifyProjectAccess(supabase: any, projectId: string, companyId: string) {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('company_id, last_email_processed_at')
      .eq('id', projectId)
      .single();
      
    if (error || !data) {
      console.error("Project not found:", error);
      throw new Error("Project not found");
    }
    
    if (data.company_id !== companyId) {
      console.error(`Security violation: Project ${projectId} belongs to company ${data.company_id}, not ${companyId}`);
      throw new Error("Unauthorized access to project");
    }
    
    return {
      authorized: true,
      lastProcessedDate: data.last_email_processed_at ? new Date(data.last_email_processed_at) : null
    };
  } catch (error) {
    console.error("Error verifying project access:", error);
    throw new Error(`Failed to verify project access: ${error.message}`);
  }
}

serve(async (req: Request) => {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const currentTime = new Date().toISOString();
    
    const { project_id, company_id, days_lookback = 7, append_mode = true }: EmailSummaryRequest = await req.json();
    
    if (!project_id || !company_id) {
      return new Response(
        JSON.stringify({ 
          status: 'error', 
          message: 'Missing required parameters: project_id and company_id are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log(`Processing email summary for project ${project_id} from company ${company_id}`);
    
    // Step 1: Verify project access
    const accessCheck = await verifyProjectAccess(supabase, project_id, company_id);
    const lastProcessedDate = accessCheck.lastProcessedDate;
    
    // Step 2: Get email credentials for the company
    const emailCredentials = await getEmailCredentials(supabase, company_id);
    
    // Step 3: Fetch project-related emails
    const emails = await fetchProjectEmails(emailCredentials, project_id, lastProcessedDate, days_lookback);
    
    console.log(`Found ${emails.length} emails related to project ${project_id}`);
    
    // Step 4: Summarize emails
    let summary = await summarizeEmails(emails);
    
    // Step 5: Update project with summary
    if (emails.length > 0) {
      await updateProjectWithSummary(supabase, project_id, summary, append_mode, currentTime);
      console.log(`Updated project ${project_id} with email summary`);
    } else {
      console.log(`No new emails to summarize for project ${project_id}`);
    }
    
    // Return success response
    return new Response(
      JSON.stringify({ 
        status: 'success', 
        summary: summary,
        emails_processed: emails.length,
        last_processed_at: currentTime
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error processing email summary:", error);
    return new Response(
      JSON.stringify({ status: 'error', message: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
