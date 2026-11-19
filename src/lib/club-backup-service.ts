import { supabase } from '@/integrations/supabase/client';
import type { ClubDatabaseState } from './club-service';

export interface ClubBackupMeta {
  id: string;
  key: string;
  type: 'DAILY_AUTO' | 'MANUAL' | 'PRE_RESTORE' | 'RELATIONAL_SNAPSHOT';
  label: string;
  createdAt: string;
  dateKey: string; // YYYY-MM-DD
  totalSubscriptions: number;
  totalMembers: number;
  totalInvoices: number;
  activeSubscriptions: number;
  overdueSubscriptions: number;
  sizeKb: number;
  version: string;
}

const BACKUPS_MANIFEST_KEY = 'lessa_club_backups_manifest_v1';
const MAX_AUTO_BACKUPS_RETAINED = 30;

let lastDailyCheckDate: string | null = null;

/**
 * Obtém o manifesto com a lista de todos os backups registrados na nuvem
 */
export const getBackupsManifest = async (): Promise<ClubBackupMeta[]> => {
  try {
    const { data, error } = await supabase
      .from('site_settings' as any)
      .select('value')
      .eq('key', BACKUPS_MANIFEST_KEY)
      .maybeSingle();

    if (error || !data || !(data as any).value) {
      return [];
    }

    const list = (data as any).value;
    if (Array.isArray(list)) {
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return [];
  } catch (err) {
    console.error('[BackupService] Erro ao buscar lista de backups:', err);
    return [];
  }
};

/**
 * Salva o manifesto de backups atualizado
 */
export const saveBackupsManifest = async (manifest: ClubBackupMeta[]): Promise<void> => {
  try {
    await supabase.from('site_settings' as any).upsert(
      {
        key: BACKUPS_MANIFEST_KEY,
        value: manifest,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
  } catch (err) {
    console.error('[BackupService] Erro ao salvar manifesto de backups:', err);
  }
};

/**
 * Cria um snapshot de backup na nuvem (Supabase site_settings)
 */
export const createClubBackup = async (
  state: ClubDatabaseState,
  type: 'DAILY_AUTO' | 'MANUAL' | 'PRE_RESTORE' | 'RELATIONAL_SNAPSHOT' = 'MANUAL',
  customLabel?: string
): Promise<ClubBackupMeta | null> => {
  if (!state || !Array.isArray(state.subscriptions)) {
    console.warn('[BackupService] Estado inválido para backup');
    return null;
  }

  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const timeKey = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const id = `backup_${dateKey}_${timeKey}_${Math.random().toString(36).slice(2, 6)}`;
  const key = `lessa_club_backup_${type.toLowerCase()}_${dateKey}_${timeKey}`;

  // Resumo estatístico do snapshot
  const totalSubs = state.subscriptions.length;
  let totalMembers = 0;
  let totalInvoices = 0;
  let activeCount = 0;
  let overdueCount = 0;

  state.subscriptions.forEach((s) => {
    totalMembers += (s.dependents || []).length + 1;
    totalInvoices += (s.invoices || []).length;
    if (s.status === 'ACTIVE') activeCount += 1;
    if (s.status === 'OVERDUE') overdueCount += 1;
  });

  const defaultLabel =
    type === 'DAILY_AUTO'
      ? `Backup Diário Automático (${now.toLocaleDateString('pt-BR')})`
      : type === 'PRE_RESTORE'
      ? `Ponto de Restauração de Segurança (${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')})`
      : `Backup Manual (${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')})`;

  // Cria cópia limpa do estado para armazenamento
  const backupPayload: ClubDatabaseState = {
    ...state,
    updatedAt: now.toISOString(),
  };

  const payloadString = JSON.stringify(backupPayload);
  const sizeKb = Math.round(payloadString.length / 1024);

  const meta: ClubBackupMeta = {
    id,
    key,
    type,
    label: customLabel || defaultLabel,
    createdAt: now.toISOString(),
    dateKey,
    totalSubscriptions: totalSubs,
    totalMembers,
    totalInvoices,
    activeSubscriptions: activeCount,
    overdueSubscriptions: overdueCount,
    sizeKb,
    version: '2.0',
  };

  try {
    // 1. Salva o snapshot na nuvem
    const { error: saveError } = await supabase.from('site_settings' as any).upsert(
      {
        key,
        value: backupPayload,
        updated_at: now.toISOString(),
      },
      { onConflict: 'key' }
    );

    if (saveError) {
      console.error('[BackupService] Falha ao gravar snapshot:', saveError);
      return null;
    }

    // 2. Atualiza o manifesto de backups
    const currentManifest = await getBackupsManifest();
    let updatedManifest = [meta, ...currentManifest.filter((m) => m.key !== key)];

    // 3. Aplica política de retenção para backups automáticos diários (mantém até 30)
    const autoBackups = updatedManifest.filter((m) => m.type === 'DAILY_AUTO');
    if (autoBackups.length > MAX_AUTO_BACKUPS_RETAINED) {
      const toRemove = autoBackups.slice(MAX_AUTO_BACKUPS_RETAINED);
      for (const old of toRemove) {
        try {
          await supabase.from('site_settings' as any).delete().eq('key', old.key);
        } catch {}
      }
      const removeKeys = new Set(toRemove.map((r) => r.key));
      updatedManifest = updatedManifest.filter((m) => !removeKeys.has(m.key));
    }

    await saveBackupsManifest(updatedManifest);
    console.info(`[BackupService] Snapshot gravado com sucesso: ${key} (${sizeKb} KB)`);
    return meta;
  } catch (err) {
    console.error('[BackupService] Exceção ao gravar backup:', err);
    return null;
  }
};

/**
 * Garante que exista pelo menos um backup diário gerado na data atual.
 * Se já existir para hoje, não duplica.
 */
export const ensureDailyBackup = async (state: ClubDatabaseState): Promise<ClubBackupMeta | null> => {
  const todayKey = new Date().toISOString().slice(0, 10);
  if (lastDailyCheckDate === todayKey) {
    return null; // Já verificado nesta sessão
  }

  try {
    const manifest = await getBackupsManifest();
    const existingToday = manifest.find((m) => m.type === 'DAILY_AUTO' && m.dateKey === todayKey);

    if (existingToday) {
      lastDailyCheckDate = todayKey;
      return existingToday;
    }

    // Executa backup automático de hoje
    const result = await createClubBackup(state, 'DAILY_AUTO');
    if (result) {
      lastDailyCheckDate = todayKey;
    }
    return result;
  } catch (err) {
    console.warn('[BackupService] Falha ao verificar backup diário:', err);
    return null;
  }
};

/**
 * Busca o conteúdo completo de um backup a partir de sua chave
 */
export const fetchBackupData = async (backupKey: string): Promise<ClubDatabaseState | null> => {
  try {
    const { data, error } = await supabase
      .from('site_settings' as any)
      .select('value')
      .eq('key', backupKey)
      .maybeSingle();

    if (error || !data || !(data as any).value) {
      return null;
    }
    return (data as any).value as ClubDatabaseState;
  } catch (err) {
    console.error('[BackupService] Erro ao recuperar snapshot:', err);
    return null;
  }
};

/**
 * Restaura um backup existente para o estado principal.
 * Antes da restauração, gera automaticamente um snapshot PRE_RESTORE por segurança.
 */
export const restoreClubBackup = async (
  backupKey: string,
  currentState: ClubDatabaseState
): Promise<ClubDatabaseState> => {
  // 1. Cria ponto de restauração com o estado antes da substituição
  await createClubBackup(
    currentState,
    'PRE_RESTORE',
    `Ponto Seguro Antes de Restaurar (${new Date().toLocaleString('pt-BR')})`
  );

  // 2. Carrega os dados do snapshot escolhido
  const snapshotData = await fetchBackupData(backupKey);
  if (!snapshotData || !Array.isArray(snapshotData.subscriptions)) {
    throw new Error('O arquivo de backup selecionado está corrompido ou inacessível.');
  }

  return snapshotData;
};

/**
 * Remove um backup específico do sistema e atualiza o manifesto
 */
export const deleteClubBackup = async (backupKey: string): Promise<boolean> => {
  try {
    await supabase.from('site_settings' as any).delete().eq('key', backupKey);
    const manifest = await getBackupsManifest();
    const updated = manifest.filter((m) => m.key !== backupKey);
    await saveBackupsManifest(updated);
    return true;
  } catch (err) {
    console.error('[BackupService] Erro ao excluir backup:', err);
    return false;
  }
};

/**
 * Executa o download imediato de um arquivo JSON completo com o estado do banco
 * para a máquina local do administrador.
 */
export const downloadBackupAsJson = (
  state: ClubDatabaseState,
  customFileName?: string
): void => {
  try {
    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
    const fileName = customFileName || `backup_lessa_club_${dateStr}_${timeStr}.json`;

    const jsonString = JSON.stringify(state, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[BackupService] Falha ao exportar backup para download:', err);
    alert('Erro ao gerar arquivo de download do backup.');
  }
};
