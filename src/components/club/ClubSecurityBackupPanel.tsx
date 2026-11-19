import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Database,
  Download,
  UploadCloud,
  RefreshCw,
  Trash2,
  Undo2,
  HardDrive,
  FileCheck2,
  Calendar,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { ClubDatabaseState } from '@/lib/club-service';
import type { ClubTrashItem, ClubSubscription } from '@/lib/club-types';
import {
  getBackupsManifest,
  createClubBackup,
  restoreClubBackup,
  deleteClubBackup,
  downloadBackupAsJson,
  fetchBackupData,
  type ClubBackupMeta,
} from '@/lib/club-backup-service';
import { syncStateToRelationalDatabase } from '@/lib/club-relational-sync';

interface ClubSecurityBackupPanelProps {
  state: ClubDatabaseState;
  onUpdateState: (nextState: ClubDatabaseState) => Promise<any>;
}

export const ClubSecurityBackupPanel: React.FC<ClubSecurityBackupPanelProps> = ({
  state,
  onUpdateState,
}) => {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<'backups' | 'trash'>('backups');
  const [manifest, setManifest] = useState<ClubBackupMeta[]>([]);
  const [isLoadingManifest, setIsLoadingManifest] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isSyncingRelational, setIsSyncingRelational] = useState(false);
  const [backupToRestore, setBackupToRestore] = useState<ClubBackupMeta | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [trashToDelete, setTrashToDelete] = useState<ClubTrashItem | null>(null);

  // Carrega lista de backups ao abrir
  const loadManifest = async () => {
    setIsLoadingManifest(true);
    try {
      const list = await getBackupsManifest();
      setManifest(list);
    } catch {
      toast({ title: 'Aviso', description: 'Não foi possível carregar a lista de snapshots.' });
    } finally {
      setIsLoadingManifest(false);
    }
  };

  useEffect(() => {
    loadManifest();
  }, []);

  // Criar backup manual sob demanda
  const handleCreateManualBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const result = await createClubBackup(state, 'MANUAL');
      if (result) {
        toast({
          title: 'Snapshot de Segurança Criado!',
          description: `Backup "${result.label}" salvo com sucesso na nuvem (${result.sizeKb} KB).`,
        });
        await loadManifest();
      } else {
        toast({
          title: 'Erro ao criar backup',
          description: 'Verifique a conexão com a nuvem.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // Forçar Sincronização Relacional SQL
  const handleForceRelationalSync = async () => {
    setIsSyncingRelational(true);
    try {
      const res = await syncStateToRelationalDatabase(state);
      if (res.success) {
        toast({
          title: 'Banco Relacional Atualizado!',
          description: `${res.syncedSubscriptions} assinaturas, ${res.syncedMembers} membros e ${res.syncedInvoices} faturas sincronizadas nas tabelas SQL do Supabase.`,
        });
      } else {
        toast({
          title: 'Sincronização com avisos',
          description: res.errors.slice(0, 2).join(' | '),
          variant: 'destructive',
        });
      }
    } finally {
      setIsSyncingRelational(false);
    }
  };

  // Restaurar Backup
  const handleConfirmRestore = async () => {
    if (!backupToRestore) return;
    setIsRestoring(true);
    try {
      const restored = await restoreClubBackup(backupToRestore.key, state);
      await onUpdateState(restored);
      toast({
        title: 'Sistema Restaurado com Sucesso!',
        description: `Estado restabelecido a partir de "${backupToRestore.label}". Um ponto de restauração prévio foi criado automaticamente.`,
      });
      setBackupToRestore(null);
      await loadManifest();
    } catch (err: any) {
      toast({
        title: 'Falha ao restaurar',
        description: err.message || 'Erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // Excluir snapshot
  const handleDeleteBackup = async (key: string) => {
    const ok = window.confirm('Tem certeza que deseja excluir este snapshot da nuvem?');
    if (!ok) return;
    const success = await deleteClubBackup(key);
    if (success) {
      toast({ title: 'Snapshot removido da nuvem.' });
      setManifest((prev) => prev.filter((m) => m.key !== key));
    }
  };

  // Download de snapshot específico do histórico
  const handleDownloadSnapshot = async (meta: ClubBackupMeta) => {
    try {
      const data = await fetchBackupData(meta.key);
      if (data) {
        downloadBackupAsJson(data, `${meta.key}.json`);
      } else {
        toast({ title: 'Erro ao baixar snapshot', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro ao baixar snapshot', variant: 'destructive' });
    }
  };

  // Restaurar item da Lixeira (Soft Delete)
  const handleRestoreFromTrash = async (trashId: string) => {
    const item = (state.trash || []).find((t) => t.id === trashId);
    if (!item) return;

    if (item.itemType === 'SUBSCRIPTION' && item.originalData) {
      const restoredSub = item.originalData as ClubSubscription;
      const nextDeletedIds = (state.deletedSubscriptionIds || []).filter((id) => id !== restoredSub.id);
      const nextTrash = (state.trash || []).filter((t) => t.id !== trashId);
      const nextSubs = [restoredSub, ...(state.subscriptions || []).filter((s) => s.id !== restoredSub.id)];

      const nextState: ClubDatabaseState = {
        ...state,
        subscriptions: nextSubs,
        deletedSubscriptionIds: nextDeletedIds,
        trash: nextTrash,
      };

      await onUpdateState(nextState);
      toast({
        title: 'Cadastro Restaurado!',
        description: `O associado "${item.name}" foi recuperado com sucesso e voltou à lista de clientes ativos.`,
      });
    }
  };

  // Excluir permanentemente da Lixeira
  const handlePermanentDelete = async () => {
    if (!trashToDelete) return;
    const nextTrash = (state.trash || []).filter((t) => t.id !== trashToDelete.id);
    const nextState: ClubDatabaseState = {
      ...state,
      trash: nextTrash,
    };
    await onUpdateState(nextState);
    toast({
      title: 'Excluído Definitivamente',
      description: `O registro de "${trashToDelete.name}" foi eliminado permanentemente da lixeira.`,
    });
    setTrashToDelete(null);
  };

  const trashList = state.trash || [];
  const totalSubs = (state.subscriptions || []).length;
  let totalInvoices = 0;
  (state.subscriptions || []).forEach((s) => {
    totalInvoices += (s.invoices || []).length;
  });

  return (
    <div className="space-y-6">
      {/* CABEÇALHO COM STATUS DE BLINDAGEM */}
      <div className="bg-gradient-to-r from-emerald-900/90 via-teal-900/90 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 border border-emerald-400/30 rounded-xl">
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  Central de Segurança & Blindagem de Dados
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/40 text-xs font-bold">
                    PROTEÇÃO ATIVA
                  </Badge>
                </h1>
                <p className="text-emerald-100/70 text-sm">
                  Snapshots diários em nuvem, persistência relacional paralela (PostgreSQL) e lixeira protegida contra exclusões acidentais.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleCreateManualBackup}
              disabled={isCreatingBackup}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-lg shadow-emerald-900/40 text-sm gap-2"
            >
              <UploadCloud className={`w-4 h-4 ${isCreatingBackup ? 'animate-bounce' : ''}`} />
              {isCreatingBackup ? 'Gravando Snapshot...' : 'Gerar Snapshot Agora'}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => downloadBackupAsJson(state)}
              className="border-emerald-400/40 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-200 font-semibold text-sm gap-2"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Baixar JSON
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleForceRelationalSync}
              disabled={isSyncingRelational}
              className="border-teal-400/40 bg-teal-950/40 hover:bg-teal-900/60 text-teal-200 font-semibold text-sm gap-2"
            >
              <RefreshCw className={`w-4 h-4 text-teal-400 ${isSyncingRelational ? 'animate-spin' : ''}`} />
              {isSyncingRelational ? 'Sincronizando SQL...' : 'Sincronizar SQL'}
            </Button>
          </div>
        </div>

        {/* CARDS DE STATUS RÁPIDO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-emerald-500/20">
          <div className="bg-slate-900/60 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
            <Database className="w-6 h-6 text-emerald-400" />
            <div>
              <p className="text-xs text-emerald-200/60 font-medium">Cadastros Protegidos</p>
              <p className="text-lg font-bold text-white">{totalSubs} Titulares</p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
            <FileCheck2 className="w-6 h-6 text-teal-400" />
            <div>
              <p className="text-xs text-teal-200/60 font-medium">Faturas em Carteira</p>
              <p className="text-lg font-bold text-white">{totalInvoices} Faturas</p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
            <HardDrive className="w-6 h-6 text-cyan-400" />
            <div>
              <p className="text-xs text-cyan-200/60 font-medium">Snapshots Gravados</p>
              <p className="text-lg font-bold text-white">{manifest.length} Pontos de Restauração</p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
            <Trash2 className="w-6 h-6 text-amber-400" />
            <div>
              <p className="text-xs text-amber-200/60 font-medium">Lixeira Protegida</p>
              <p className="text-lg font-bold text-white">{trashList.length} Itens Recuperáveis</p>
            </div>
          </div>
        </div>
      </div>

      {/* SELETOR DE SEÇÃO (BACKUPS / LIXEIRA) */}
      <div className="flex items-center gap-3 border-b border-slate-700/60 pb-3">
        <button
          type="button"
          onClick={() => setActiveSection('backups')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeSection === 'backups'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          Histórico de Snapshots na Nuvem ({manifest.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('trash')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeSection === 'trash'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          Lixeira Protegida / Cadastros Excluídos ({trashList.length})
        </button>
      </div>

      {/* SEÇÃO 1: SNAPSHOTS EM NUVEM */}
      {activeSection === 'backups' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                Pontos de Restauração e Snapshots Diários
              </h2>
              <p className="text-xs text-slate-400">
                O sistema gera snapshots automáticos a cada dia e mantém pontos de segurança antes de qualquer restauração.
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadManifest}
              disabled={isLoadingManifest}
              className="text-slate-400 hover:text-white text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingManifest ? 'animate-spin' : ''}`} />
              Atualizar Lista
            </Button>
          </div>

          {manifest.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <ShieldCheck className="w-12 h-12 mx-auto text-emerald-500/40 mb-3" />
              <p className="font-semibold text-white">Nenhum snapshot registrado ainda.</p>
              <p className="text-xs text-slate-500 mt-1">
                Clique no botão "Gerar Snapshot Agora" no cabeçalho para criar o primeiro backup seguro na nuvem.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Tipo</th>
                    <th className="px-5 py-3.5">Identificação</th>
                    <th className="px-5 py-3.5">Data e Hora</th>
                    <th className="px-5 py-3.5 text-center">Tamanho</th>
                    <th className="px-5 py-3.5 text-center">Clientes</th>
                    <th className="px-5 py-3.5 text-center">Faturas</th>
                    <th className="px-5 py-3.5 text-right">Ações de Segurança</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {manifest.map((item) => {
                    const isDaily = item.type === 'DAILY_AUTO';
                    const isPreRestore = item.type === 'PRE_RESTORE';

                    return (
                      <tr key={item.key} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4">
                          {isDaily ? (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                              Diário Automático
                            </Badge>
                          ) : isPreRestore ? (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
                              Pré-Restauração
                            </Badge>
                          ) : (
                            <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-xs">
                              Manual
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-4 font-semibold text-white">
                          {item.label}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400">
                          {new Date(item.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-5 py-4 text-center font-mono text-xs text-emerald-400">
                          {item.sizeKb} KB
                        </td>
                        <td className="px-5 py-4 text-center font-medium text-white">
                          {item.totalSubscriptions}
                        </td>
                        <td className="px-5 py-4 text-center font-medium text-slate-300">
                          {item.totalInvoices}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadSnapshot(item)}
                              title="Baixar cópia JSON deste snapshot"
                              className="h-8 px-2.5 text-xs border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setBackupToRestore(item)}
                              className="h-8 px-3 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              Restaurar
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteBackup(item.key)}
                              className="h-8 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SEÇÃO 2: LIXEIRA PROTEGIDA (SOFT DELETE) */}
      {activeSection === 'trash' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-amber-400" />
              Lixeira Protegida (Soft Delete)
            </h2>
            <p className="text-xs text-slate-400">
              Cadastros excluídos no sistema não são destruídos imediatamente. Eles ficam armazenados nesta lixeira e podem ser restaurados a qualquer momento com todos os dados e carnês intactos.
            </p>
          </div>

          {trashList.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <ShieldCheck className="w-12 h-12 mx-auto text-emerald-500/40 mb-3" />
              <p className="font-semibold text-white">A lixeira está vazia.</p>
              <p className="text-xs text-slate-500 mt-1">
                Nenhum cadastro de sócio ou carnê foi excluído recentemente.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Tipo</th>
                    <th className="px-5 py-3.5">Nome / Identificação</th>
                    <th className="px-5 py-3.5">Cartão / Código</th>
                    <th className="px-5 py-3.5">Excluído Em</th>
                    <th className="px-5 py-3.5">Responsável</th>
                    <th className="px-5 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {trashList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4">
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
                          {item.itemType === 'SUBSCRIPTION' ? 'Associado Titular' : item.itemType}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 font-semibold text-white">{item.name}</td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-400">{item.code}</td>
                      <td className="px-5 py-4 text-xs text-slate-400">
                        {new Date(item.deletedAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-300">{item.deletedBy || 'Administrador'}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleRestoreFromTrash(item.id)}
                            className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            Restaurar Cadastro
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => setTrashToDelete(item)}
                            className="h-8 px-2.5 text-xs bg-rose-700/80 hover:bg-rose-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DIÁLOGO DE CONFIRMAÇÃO DE RESTAURAÇÃO DE BACKUP */}
      <Dialog open={Boolean(backupToRestore)} onOpenChange={(open) => !open && setBackupToRestore(null)}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Restaurar Ponto de Segurança?
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-sm mt-2 space-y-2">
              <p>
                Você está prestes a restaurar a base de dados do Lessa Club para o snapshot:
              </p>
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs space-y-1 font-mono">
                <p className="text-white font-bold">{backupToRestore?.label}</p>
                <p className="text-slate-400">Data: {backupToRestore && new Date(backupToRestore.createdAt).toLocaleString('pt-BR')}</p>
                <p className="text-slate-400">Contagem: {backupToRestore?.totalSubscriptions} associados | {backupToRestore?.totalInvoices} faturas</p>
              </div>
              <p className="text-xs text-emerald-400 font-medium">
                ✓ Por segurança absoluta, o sistema irá gerar automaticamente um novo snapshot prévio antes de aplicar esta restauração.
              </p>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBackupToRestore(null)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmRestore}
              disabled={isRestoring}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              {isRestoring ? 'Restaurando...' : 'Sim, Restaurar Snapshot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE CONFIRMAÇÃO DE EXCLUSÃO DEFINITIVA DA LIXEIRA */}
      <Dialog open={Boolean(trashToDelete)} onOpenChange={(open) => !open && setTrashToDelete(null)}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-rose-500">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Exclusão Permanente
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-sm mt-2">
              Tem certeza que deseja apagar definitivamente o registro de{' '}
              <strong className="text-white">{trashToDelete?.name}</strong>?
              Esta ação removerá este item da lixeira e ele não poderá mais ser recuperado.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTrashToDelete(null)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handlePermanentDelete}
              className="bg-rose-600 hover:bg-rose-700 font-bold"
            >
              Sim, Excluir Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
