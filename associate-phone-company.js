// Associate phone number with BidList company
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const userProfile = process.env.USERPROFILE || process.env.HOME;
const mcpConfigPath = path.join(userProfile, '.cursor', 'mcp.json');
const config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));

const supabase = createClient(
  config.mcpServers.supabase.env.SUPABASE_URL,
  config.mcpServers.supabase.env.SUPABASE_SERVICE_ROLE_KEY
);

const phoneNumber = '+15103875771'; // 510-387-5771

async function associatePhoneWithBidList() {
  console.log('🔗 Associating phone number with BidList company...\n');
  console.log(`Phone: ${phoneNumber}`);

  // 1. Find BidList company
  console.log('\n1️⃣ Finding BidList company...');
  const { data: companies, error: companyError } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', '%BidList%');

  if (companyError) {
    console.error('Error finding company:', companyError.message);
    process.exit(1);
  }

  if (!companies || companies.length === 0) {
    console.error('❌ BidList company not found!');
    process.exit(1);
  }

  const bidList = companies[0];
  console.log(`✅ Found: ${bidList.name} (ID: ${bidList.id})`);

  // 2. Check if contact exists
  console.log('\n2️⃣ Checking for existing contact...');
  const { data: existingContacts, error: contactError } = await supabase
    .from('contacts')
    .select('*')
    .eq('phone_number', phoneNumber);

  if (contactError) {
    console.error('Error checking contacts:', contactError.message);
    process.exit(1);
  }

  if (existingContacts && existingContacts.length > 0) {
    const contact = existingContacts[0];
    console.log(`✅ Found existing contact: ${contact.full_name || 'Unnamed'}`);
    console.log(`   Current company: ${contact.company_id || 'None'}`);
    console.log(`   Contact ID: ${contact.id}`);

    // Update the contact
    console.log('\n3️⃣ Updating contact to associate with BidList...');
    const { data: updatedContact, error: updateError } = await supabase
      .from('contacts')
      .update({
        company_id: bidList.id
      })
      .eq('id', contact.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating contact:', updateError.message);
      process.exit(1);
    }

    console.log(`✅ Successfully updated contact!`);
    console.log(`   Company ID: ${updatedContact.company_id}`);
    console.log(`   Company Name: ${bidList.name}`);
  } else {
    // Create new contact
    console.log('❌ Contact not found, creating new contact...');
    const { data: newContact, error: createError } = await supabase
      .from('contacts')
      .insert({
        phone_number: phoneNumber,
        full_name: 'User',
        company_id: bidList.id,
        role: 'homeowner'
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating contact:', createError.message);
      console.error('Full error:', JSON.stringify(createError, null, 2));
      process.exit(1);
    }

    console.log(`✅ Successfully created contact!`);
    console.log(`   Contact ID: ${newContact.id}`);
    console.log(`   Company ID: ${newContact.company_id}`);
    console.log(`   Company Name: ${bidList.name}`);
  }

  // 4. Verify the association
  console.log('\n4️⃣ Verifying association...');
  const { data: verifyContact, error: verifyError } = await supabase
    .from('contacts')
    .select('*, companies:company_id(name)')
    .eq('phone_number', phoneNumber)
    .single();

  if (verifyError) {
    console.error('Error verifying:', verifyError.message);
  } else {
    console.log('✅ Verification successful!');
    console.log(`   Phone: ${verifyContact.phone_number}`);
    console.log(`   Name: ${verifyContact.full_name || 'Unnamed'}`);
    console.log(`   Company: ${verifyContact.companies?.name || 'None'}`);
    console.log(`   Company ID: ${verifyContact.company_id || 'None'}`);
  }

  console.log('\n✅ Done! Your phone number is now associated with BidList.');
}

associatePhoneWithBidList().catch(console.error);

