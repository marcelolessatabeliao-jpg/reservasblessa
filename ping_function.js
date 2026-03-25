
const SUPABASE_URL = 'https://lcymbetnnuokrijynmjm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794';

async function checkFunction() {
  console.log('Verificando se a Edge Function responde (OPTIONS)...');
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-payment`, {
      method: 'OPTIONS',
      headers: { 'apikey': ANON_KEY }
    });
    console.log('Status da função:', res.status, res.statusText);
    if (res.ok) {
       console.log('SUCESSO: A função create-payment está online e respondendo.');
    } else {
       console.log('FALHA: A função respondeu com erro ou não existe.');
    }
  } catch (e) {
    console.log('ERRO de Conexão:', e.message);
  }
}
checkFunction();
