const fs = require('fs');

// Configurações Supabase e Asaas Edge Function
const SUPABASE_URL = 'https://lcymbetnnuokrijynmjm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794';
const EDGE_URL = `${SUPABASE_URL}/functions/v1/create-payment`;

async function queryAsaasByCpf(cpf) {
  const clean = String(cpf || '').replace(/\D/g, '');
  if (!clean || clean.length < 11) return { payments: [] };
  try {
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify({ action: 'list-customer-charges', cpf: clean })
    });
    if (!res.ok) return { payments: [] };
    return await res.json();
  } catch (err) {
    return { payments: [] };
  }
}

module.exports = { SUPABASE_URL, ANON_KEY, queryAsaasByCpf };
