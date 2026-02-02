import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const password = 'Merakiue1!!';
const encodedPassword = encodeURIComponent(password);
const projectRef = 'ygpfklhjwwqwrfpsfhue';

async function findWorkingConnection() {
  // Try different connection formats with encoded password
  const regions = ['us-east-1', 'us-west-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1', 'ap-northeast-1', 'sa-east-1'];

  const connections = [];

  // Add pooler connections for all regions
  for (const region of regions) {
    connections.push({
      desc: `Pooler ${region} (transaction mode)`,
      conn: `postgresql://postgres.${projectRef}:${encodedPassword}@aws-0-${region}.pooler.supabase.com:6543/postgres`
    });
  }

  // Add direct connection attempts
  connections.push({
    desc: 'Direct connection',
    conn: `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`
  });

  for (const { desc, conn } of connections) {
    console.log(`Trying: ${desc}...`);

    const testClient = new pg.Client({
      connectionString: conn,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000
    });
    try {
      await testClient.connect();
      console.log(`✅ Connected!\n`);
      return testClient;
    } catch (e) {
      const msg = e.message.slice(0, 50);
      if (!msg.includes('ENOTFOUND')) {
        console.log(`  ❌ ${msg}`);
      }
    }
  }
  return null;
}

async function runMigration() {
  console.log('='.repeat(60));
  console.log('RUNNING DATABASE MIGRATION');
  console.log('='.repeat(60));
  console.log(`Project: ${projectRef}`);
  console.log(`Password: ${password.slice(0,3)}***${password.slice(-2)}`);
  console.log('\nFinding working database connection...\n');

  const client = await findWorkingConnection();

  if (!client) {
    console.log('\n❌ Could not connect to database.');
    console.log('\nThe connection string format might be different for your project.');
    console.log('Go to: https://supabase.com/dashboard/project/' + projectRef + '/settings/database');
    console.log('And copy the full "Connection string (URI)" - paste it here.');
    return;
  }

  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations/004_booking_messaging_system.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration...\n');
    await client.query(sql);
    console.log('✅ Migration completed successfully!\n');

    // Verify
    const tables = ['conversations', 'messages', 'push_notification_settings'];
    console.log('Verifying tables:');
    for (const table of tables) {
      const result = await client.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`, [table]);
      console.log(`  ${result.rows[0].exists ? '✅' : '❌'} ${table}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }

  console.log('\n' + '='.repeat(60));
}

runMigration();
