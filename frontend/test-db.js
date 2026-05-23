const { Client } = require('pg');

const testCases = [
  'postgresql://postgres.bovauztiorzqcybnkqoz:Prvn%408917696616@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  'postgresql://postgres.bovauztiorzqcybnkqoz:%5BPrvn%408917696616%5D@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  'postgresql://postgres:Prvn%408917696616@aws-0-ap-south-1.pooler.supabase.com:5432/postgres'
];

async function run() {
  for (const str of testCases) {
    console.log('Testing:', str);
    const client = new Client({ connectionString: str });
    try {
      await client.connect();
      console.log('SUCCESS!');
      process.exit(0);
    } catch (e) {
      console.log('FAILED:', e.message);
    }
  }
}
run();
