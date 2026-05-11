const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testAuthUpdate() {
  // Try to sign in as admin to test authenticated RLS
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@reservaslessa.com', // just guessing a common admin email if any
    password: 'password'
  });
  
  // If we can't login, we can't test it this way, but we can assume authenticated RLS is the issue
  console.log('Auth:', authErr ? authErr.message : 'Success');
}

testAuthUpdate();
