import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ygpfklhjwwqwrfpsfhue.supabase.co';
const SUPABASE_KEY = 'REDACTED_SERVICE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTables() {
  const tables = ['conversations', 'messages', 'push_notification_settings', 'business_notification_settings', 'message_analytics'];

  console.log('Checking which tables exist...\n');

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error && error.code === 'PGRST205') {
      console.log(`❌ ${table} - NEEDS TO BE CREATED`);
    } else if (error) {
      console.log(`⚠️  ${table} - ${error.message}`);
    } else {
      console.log(`✅ ${table} - EXISTS`);
    }
  }
}

checkTables();
