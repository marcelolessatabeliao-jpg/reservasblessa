
const SUPABASE_URL = 'https://lcymbetnnuokrijynmjm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794';

async function listTables() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/?select=*`, {
    headers: { 'apikey': ANON_KEY }
  });
  if (res.ok) {
     const data = await res.json();
     console.log('Tables in OpenAPI:', Object.keys(data.definitions || {}));
  } else {
     console.log('OpenAPI failed:', await res.status, await res.text());
  }
}
listTables();
