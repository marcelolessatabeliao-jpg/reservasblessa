const fs=require('fs');
const env=fs.readFileSync('.env', 'utf8');
const url=env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/"/g, '');
const key=env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim().replace(/"/g, '');
fetch(url+'/rest/v1/order_items?select=id,is_redeemed,redeemed_at&limit=1', {headers:{apikey:key, Authorization:'Bearer '+key}})
  .then(r=>r.json())
  .then(console.log)
  .catch(console.error);
