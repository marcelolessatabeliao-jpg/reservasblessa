const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, ANON_KEY } = require('./asaas_helper.cjs');

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function run() {
  console.log('1. Lendo backup compilado...');
  const compiledData = JSON.parse(fs.readFileSync('scripts/lessa_club_ecosystem_backup_before_sync.json', 'utf8'));
  const allSubs = compiledData.value.subscriptions || [];

  console.log(`Total de assinaturas no arquivo compilado: ${allSubs.length}`);

  // Filtrar assinaturas relevantes para persistir no Supabase:
  // a) origin === 'SITE' (Cadastros feitos via site - obrigatório 100%)
  // b) Invoices > 0 (Cadastros que têm faturas/carnês Asaas vinculados)
  // c) status === 'INACTIVE' com débito
  // d) transferCompleted === true ou manuallyConfirmedTransfer === true
  // e) Possui anexos/documentos enviados
  // f) Thais Alessandra Sousa da Silva (garantir todos os cadastros dela)
  const cloudSubs = allSubs.filter(s => {
    if (s.origin === 'SITE') return true;
    if (s.invoices && s.invoices.length > 0) return true;
    if (s.status === 'INACTIVE' && s.invoices && s.invoices.length > 0) return true;
    if (s.transferCompleted || s.manuallyConfirmedTransfer) return true;
    if (s.attachments && s.attachments.length > 0) return true;
    if (s.holderName?.toUpperCase().includes('THAIS ALESSANDRA')) return true;
    if (s.members?.some(m => m.documentProofUrl || m.documentStatus)) return true;
    return false;
  });

  console.log(`Assinaturas selecionadas para persistência em nuvem (Supabase): ${cloudSubs.length}`);

  const counts = {
    site: cloudSubs.filter(s => s.origin === 'SITE').length,
    withInvoices: cloudSubs.filter(s => (s.invoices || []).length > 0).length,
    inactivesWithDebt: cloudSubs.filter(s => s.status === 'INACTIVE').length
  };
  console.log('Distribuição das assinaturas na nuvem:', counts);

  compiledData.value.subscriptions = cloudSubs;
  compiledData.value.updatedAt = new Date().toISOString();

  const jsonStr = JSON.stringify(compiledData.value);
  console.log(`Tamanho final do JSON para a nuvem: ${jsonStr.length} bytes (~${Math.round(jsonStr.length / 1024)} KB)`);

  console.log('Salvando no Supabase via upsert...');
  const t0 = Date.now();
  const { data, error } = await supabase
    .from('site_settings')
    .upsert({
      key: 'lessa_club_ecosystem_v1',
      value: compiledData.value,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

  if (error) {
    console.error('Falha ao salvar no Supabase:', error);
    throw error;
  }

  console.log(`SUCESSO! Salvo no Supabase em ${Date.now() - t0}ms!`);

  // Verificar leitura do banco
  console.log('\n2. Verificando leitura direta do Supabase...');
  const { data: readData, error: readError } = await supabase
    .from('site_settings')
    .select('updated_at, value')
    .eq('key', 'lessa_club_ecosystem_v1')
    .single();

  if (readError) {
    console.error('Erro ao ler do Supabase:', readError);
  } else {
    console.log('Supabase respondeu com sucesso!');
    console.log('Data da atualização:', readData.updated_at);
    console.log('Total de assinaturas na nuvem:', readData.value?.subscriptions?.length);
  }
}

run().catch(console.error);
