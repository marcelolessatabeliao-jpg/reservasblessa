import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Download,
  Upload,
  ShieldCheck,
  Clock,
  Camera,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  ClubSubscription,
  ClubMember,
  ClubAttachment,
} from '@/lib/club-types';
import {
  getPlanDocumentRule,
  memberHasProofUploaded,
  getMemberDocumentStatus,
  verifyMemberProofDocument,
  compressImageFile,
  fileToDataUrl,
  formatDateBR,
} from '@/lib/club-service';

interface ClubDocumentVerificationPanelProps {
  subscription: ClubSubscription;
  onUpdateSub: (updatedSub: ClubSubscription) => void;
  onPreviewAttachment?: (att: {
    name: string;
    dataUrl: string;
    mimeType: string;
    createdAt?: string;
  }) => void;
  compact?: boolean;
}

const isRealMediaUrl = (url?: string | null): boolean => {
  if (!url) return false;
  if (
    url === 'HAS_DOC_ATTACHED' ||
    url === 'HAS_DOC_REMOTE' ||
    url.startsWith('HAS_DOC_') ||
    url.includes('[COMPACTED_LOCAL]')
  ) {
    return false;
  }
  return (
    url.startsWith('data:') ||
    url.startsWith('http:') ||
    url.startsWith('https:') ||
    url.startsWith('/') ||
    url.startsWith('blob:')
  );
};

export const ClubDocumentVerificationPanel: React.FC<ClubDocumentVerificationPanelProps> = ({
  subscription,
  onUpdateSub,
  onPreviewAttachment,
  compact = false,
}) => {
  const { toast } = useToast();
  const [rejectingMemberId, setRejectingMemberId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Integrantes que necessitam de comprovação
  const membersRequiringDocs = (subscription.members || []).map((m, idx) => ({
    member: m,
    index: idx,
    rule: getPlanDocumentRule(m.modalityCode, m.modalityName),
    status: getMemberDocumentStatus(m, subscription),
    hasProof: memberHasProofUploaded(m, subscription),
  })).filter((item) => item.rule.requiresDocument);

  if (membersRequiringDocs.length === 0) {
    if (compact) return null;
    return (
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
        <div>
          <strong className="font-black block uppercase text-[11px] text-emerald-950">
            Comprovação Documental Dispensada
          </strong>
          <span className="text-emerald-800">
            Todos os integrantes deste cadastro possuem modalidades padrão (não exigem envio de comprovante adicional).
          </span>
        </div>
      </div>
    );
  }

  const approvedCount = membersRequiringDocs.filter((m) => m.member.documentVerified).length;
  const pendingReviewCount = membersRequiringDocs.filter(
    (m) => m.hasProof && !m.member.documentVerified && !m.member.documentRejectionReason
  ).length;
  const missingUploadCount = membersRequiringDocs.filter((m) => !m.hasProof).length;
  const isFullyApproved = approvedCount === membersRequiringDocs.length;

  const handleApprove = async (member: ClubMember) => {
    try {
      setIsProcessing(true);
      const updatedState = await verifyMemberProofDocument(subscription.id, member.id, true);
      const updatedSub = (updatedState.subscriptions || []).find((s) => s.id === subscription.id);
      if (updatedSub) {
        onUpdateSub(updatedSub);
      }
      toast({
        title: 'Documento Validado e Aprovado!',
        description: `Comprovação de ${member.fullName} validada com sucesso. Carteirinha liberada.`,
      });
    } catch (e: any) {
      toast({
        title: 'Falha ao validar documento',
        description: e.message || 'Erro desconhecido.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (member: ClubMember) => {
    if (!rejectionReason.trim()) {
      toast({
        title: 'Informe o motivo da recusa',
        description: 'Ex: Foto cortada/ilegível, documento vencido ou sem comprovação válida.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsProcessing(true);
      const updatedState = await verifyMemberProofDocument(
        subscription.id,
        member.id,
        false,
        rejectionReason.trim()
      );
      const updatedSub = (updatedState.subscriptions || []).find((s) => s.id === subscription.id);
      if (updatedSub) {
        onUpdateSub(updatedSub);
      }
      setRejectingMemberId(null);
      setRejectionReason('');
      toast({
        title: 'Documento Rejeitado',
        description: `Notificação de recusa salva para ${member.fullName}. O titular poderá enviar novo arquivo.`,
        variant: 'destructive',
      });
    } catch (e: any) {
      toast({
        title: 'Falha ao recusar documento',
        description: e.message || 'Erro desconhecido.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRevoke = async (member: ClubMember) => {
    try {
      setIsProcessing(true);
      const updatedState = await verifyMemberProofDocument(subscription.id, member.id, false);
      const updatedSub = (updatedState.subscriptions || []).find((s) => s.id === subscription.id);
      if (updatedSub) {
        onUpdateSub(updatedSub);
      }
      toast({
        title: 'Validação Revogada',
        description: `O documento de ${member.fullName} voltou para o status de análise.`,
      });
    } catch (e: any) {
      toast({
        title: 'Erro ao revogar',
        description: e.message || 'Erro desconhecido.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadMemberDoc = async (member: ClubMember, file: File) => {
    try {
      setIsProcessing(true);
      const dataUrl = file.type.startsWith('image/')
        ? await compressImageFile(file, 1200, 1200, 0.72)
        : await fileToDataUrl(file);

      const newAtt: ClubAttachment = {
        id: `att_${member.id}_${Date.now()}`,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataUrl,
        createdAt: new Date().toISOString(),
      };

      const updatedMembers = subscription.members.map((m) => {
        if (m.id === member.id) {
          return {
            ...m,
            documentProofUrl: dataUrl,
            documentProofName: file.name,
            documentStatus: 'EM_ANALISE' as const,
            documentRejectionReason: undefined,
            documentVerified: false,
            attachments: [newAtt, ...(m.attachments || [])],
          };
        }
        return m;
      });

      const updatedSub: ClubSubscription = {
        ...subscription,
        attachments: [newAtt, ...(subscription.attachments || [])],
        members: updatedMembers,
      };

      onUpdateSub(updatedSub);
      toast({
        title: 'Comprovante Anexado com Sucesso!',
        description: `Arquivo ${file.name} vinculado a ${member.fullName}. Pronto para validação do Admin.`,
      });
    } catch (e: any) {
      toast({
        title: 'Erro ao anexar arquivo',
        description: e.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-amber-50/90 via-white to-emerald-50/40 rounded-2xl border-2 border-amber-300 p-4 sm:p-5 space-y-4 shadow-sm animate-in fade-in">
      {/* CABEÇALHO DO PAINEL DE VALIDAÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 pb-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-xl bg-amber-400 text-slate-950 font-black shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm sm:text-base font-black text-amber-950 uppercase tracking-wide">
                Comprovação Documental Obrigatória ({membersRequiringDocs.length} integrante{membersRequiringDocs.length > 1 ? 's' : ''})
              </h4>
              <Badge
                className={
                  isFullyApproved
                    ? 'bg-emerald-600 text-white font-black text-[10px]'
                    : missingUploadCount > 0
                    ? 'bg-rose-600 text-white font-black text-[10px]'
                    : 'bg-amber-500 text-slate-950 font-black text-[10px] animate-pulse'
                }
              >
                {isFullyApproved
                  ? 'TODOS APROVADOS PELO ADMIN ✓'
                  : missingUploadCount > 0
                  ? `${missingUploadCount} PENDENTE(S) DE ANEXO`
                  : `${pendingReviewCount} AGUARDANDO VALIDAÇÃO DO ADMIN`}
              </Badge>
            </div>
            <p className="text-xs text-amber-900 mt-1 font-medium leading-relaxed">
              Além do pagamento financeiro, modalidades com gratuidade, desconto estudantil, infantil, 60+, PCD ou funcional 
              <strong> exigem documento comprobatório aprovado pelo Administrador</strong> para que o cadastro e a carteirinha fiquem ativos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-xs font-bold bg-white/90 px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs">
          <span className="text-slate-600">Status Validação:</span>
          <span className="text-emerald-700 font-black">{approvedCount} de {membersRequiringDocs.length} Aprovado(s)</span>
        </div>
      </div>

      {/* LISTAGEM DE INTEGRANTES COM REGRAS EXPLÍCITAS E CONTROLES DE VALIDAÇÃO */}
      <div className="space-y-4">
        {membersRequiringDocs.map(({ member, index, rule, status, hasProof }) => {
          const isHolder = member.role === 'TITULAR' || index === 0;
          const isRejectingThis = rejectingMemberId === member.id;

          // Anexos vinculados a este integrante
          const rawMemberAttachments: ClubAttachment[] = member.attachments || [];
          const validProofFromAtt = rawMemberAttachments.find(
            (a) => a.dataUrl && a.dataUrl !== 'HAS_DOC_ATTACHED' && (a.dataUrl.startsWith('data:') || a.dataUrl.startsWith('http') || a.dataUrl.startsWith('/'))
          );

          const hasValidProofUrl =
            Boolean(member.documentProofUrl) &&
            member.documentProofUrl !== 'HAS_DOC_ATTACHED' &&
            !member.documentProofUrl.startsWith('HAS_DOC_ATTACHED') &&
            (member.documentProofUrl.startsWith('data:') ||
              member.documentProofUrl.startsWith('http') ||
              member.documentProofUrl.startsWith('/'));

          const effectiveProofUrl = hasValidProofUrl
            ? member.documentProofUrl
            : validProofFromAtt?.dataUrl || '';

          const memberDocs: ClubAttachment[] = [];

          // 1. Adiciona os anexos reais do integrante com URL válida
          for (const att of rawMemberAttachments) {
            const resolvedUrl = isRealMediaUrl(att.dataUrl) ? att.dataUrl : effectiveProofUrl;
            memberDocs.push({
              ...att,
              dataUrl: resolvedUrl,
            });
          }

          // 2. Se o integrante tiver documentProofName e não constar em memberDocs, adiciona para que o documento apareça na lista de conferência
          if (
            member.documentProofName &&
            !memberDocs.some((d) => d.name === member.documentProofName)
          ) {
            memberDocs.unshift({
              id: `primary_${member.id}`,
              name: member.documentProofName || 'Documento Comprobatório Principal',
              dataUrl: effectiveProofUrl,
              mimeType:
                effectiveProofUrl.startsWith('data:image/') ||
                /\.(jpe?g|png|webp|gif)/i.test(member.documentProofName || '')
                  ? 'image/jpeg'
                  : 'application/pdf',
              createdAt: member.createdAt,
            });
          }

          // 3. Fallback: se ainda estiver sem anexo com URL válida, busca em subscription.attachments
          if (memberDocs.length === 0 || memberDocs.every((d) => !isRealMediaUrl(d.dataUrl))) {
            const subMatch = (subscription.attachments || []).find((sa) => {
              if (member.documentProofName && sa.name === member.documentProofName) return true;
              const firstName = (member.fullName || '').split(' ')[0].toLowerCase().trim();
              const attName = (sa.name || '').toLowerCase();
              return firstName.length >= 3 && attName.includes(firstName);
            });
            if (subMatch && isRealMediaUrl(subMatch.dataUrl)) {
              memberDocs.push(subMatch);
            }
          }

          return (
            <div
              key={member.id}
              className={`rounded-2xl border-2 p-4 sm:p-5 space-y-3.5 transition-all shadow-xs ${
                member.documentVerified
                  ? 'bg-emerald-50/60 border-emerald-300'
                  : member.documentRejectionReason
                  ? 'bg-rose-50/70 border-rose-300'
                  : hasProof
                  ? 'bg-amber-50/80 border-amber-400'
                  : 'bg-white border-amber-300 ring-2 ring-amber-200/50'
              }`}
            >
              {/* TOPO DO INTEGRANTE */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {member.photoUrl ? (
                    <img
                      src={member.photoUrl}
                      alt={member.fullName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-emerald-700 shadow-xs shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-emerald-800 text-white font-black flex items-center justify-center text-sm shadow-xs shrink-0">
                      {member.fullName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={isHolder ? 'bg-emerald-800 text-white font-black text-[10px]' : 'bg-blue-700 text-white font-black text-[10px]'}>
                        {isHolder ? 'TITULAR' : `DEPENDENTE #${index}`}
                      </Badge>
                      <span className="font-black text-sm sm:text-base text-slate-900">
                        {member.fullName}
                      </span>
                      <Badge className="bg-amber-400 text-slate-950 font-black text-[11px]">
                        {member.modalityName || 'Plano com Benefício'}
                      </Badge>
                      <span className="text-xs font-mono font-bold text-slate-500">
                        Cartão #{member.cardNumber}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-slate-600 mt-0.5">
                      CPF: <strong>{member.cpf || 'Não informado'}</strong> • Nascimento: <strong>{member.birthDate ? formatDateBR(member.birthDate) : 'Não informado'}</strong>
                    </div>
                  </div>
                </div>

                {/* BADGE DE SITUAÇÃO DO DOCUMENTO */}
                <div className="flex items-center gap-2">
                  {member.documentVerified ? (
                    <Badge className="bg-emerald-700 text-white font-black text-xs px-3 py-1 shadow-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> DOCUMENTO VALIDADO PELO ADMIN ✓
                    </Badge>
                  ) : member.documentRejectionReason ? (
                    <Badge className="bg-rose-700 text-white font-black text-xs px-3 py-1 shadow-xs flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" /> DOCUMENTO RECUSADO
                    </Badge>
                  ) : hasProof ? (
                    <Badge className="bg-amber-500 text-slate-950 font-black text-xs px-3 py-1 shadow-xs flex items-center gap-1.5 animate-pulse">
                      <Clock className="w-3.5 h-3.5" /> EM ANÁLISE — AGUARDANDO ADMIN
                    </Badge>
                  ) : (
                    <Badge className="bg-rose-600 text-white font-black text-xs px-3 py-1 shadow-xs flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> FALTA ANEXAR COMPROVANTE
                    </Badge>
                  )}
                </div>
              </div>

              {/* QUADRO DO QUE É NECESSÁRIO E VÁLIDO PARA CADA CADASTRO */}
              <div className="bg-white rounded-xl border border-amber-300/80 p-3.5 sm:p-4 space-y-2 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-950 tracking-wider">
                  <FileText className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>O que é aceito e válido para comprovar este benefício ({member.modalityName}):</span>
                </div>
                <p className="text-xs text-slate-700 font-medium leading-relaxed">
                  {rule.summary}
                </p>
                <div className="bg-amber-50/80 rounded-lg p-2.5 border border-amber-200 space-y-1">
                  <span className="text-[11px] font-black text-amber-950 uppercase block">
                    Documentos aceitos (basta enviar 1 destes):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-800">
                    {rule.acceptedDocs.map((docDesc, dIdx) => (
                      <div key={dIdx} className="flex items-start gap-1.5 font-semibold">
                        <span className="text-emerald-700 font-bold shrink-0">✅</span>
                        <span>{docDesc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* SEÇÃO DE ARQUIVOS ANEXADOS E AÇÕES DO ADMINISTRADOR */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {hasProof ? (
                    <div className="space-y-1">
                      <span className="text-[11px] font-black uppercase text-slate-600 block">
                        Comprovante anexado para conferência:
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {memberDocs.map((doc) => (
                          <div
                            key={doc.id}
                            className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-2xs text-xs font-bold text-slate-800"
                          >
                            <div
                              onClick={() =>
                                onPreviewAttachment?.({
                                  name: doc.name,
                                  dataUrl: doc.dataUrl,
                                  mimeType: doc.mimeType,
                                  createdAt: doc.createdAt,
                                })
                              }
                              className="inline-flex items-center gap-2 cursor-pointer hover:text-emerald-800"
                              title="Clique para visualizar o documento em tela cheia"
                            >
                              {isRealMediaUrl(doc.dataUrl) && (doc.mimeType?.startsWith('image/') || doc.dataUrl?.startsWith('data:image/')) ? (
                                <img
                                  src={doc.dataUrl}
                                  alt={doc.name}
                                  className="w-6 h-6 rounded object-cover border border-slate-200"
                                />
                              ) : (
                                <FileText className="w-4 h-4 text-emerald-700" />
                              )}
                              <span className="max-w-[180px] sm:max-w-[240px] truncate" title={doc.name}>
                                {doc.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 ml-1 border-l pl-2 border-slate-200">
                              <button
                                type="button"
                                onClick={() =>
                                  onPreviewAttachment?.({
                                    name: doc.name,
                                    dataUrl: doc.dataUrl,
                                    mimeType: doc.mimeType,
                                    createdAt: doc.createdAt,
                                  })
                                }
                                className="p-1 rounded hover:bg-emerald-50 text-emerald-800 hover:text-emerald-950 font-bold"
                                title="Visualizar documento"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {isRealMediaUrl(doc.dataUrl) && (
                                <a
                                  href={doc.dataUrl}
                                  download={doc.name}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900"
                                  title="Baixar arquivo"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {member.documentRejectionReason && !member.documentVerified && (
                        <div className="bg-rose-100/80 border border-rose-300 text-rose-950 text-xs rounded-lg p-2 font-medium mt-1">
                          <strong>⚠️ Motivo da recusa anterior:</strong> {member.documentRejectionReason}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-rose-700 font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Nenhum documento anexado ainda. Anexe o arquivo abaixo para permitir a validação.</span>
                    </div>
                  )}
                </div>

                {/* BOTÕES DE CONTROLE DO ADMIN */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Botão de Upload / Tirar Foto */}
                  <Label
                    htmlFor={`upload-doc-member-${member.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl font-bold text-xs cursor-pointer shadow-xs transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-800" />
                    <span>{hasProof ? 'Substituir / Anexar Mais' : 'Anexar Documento'}</span>
                  </Label>
                  <input
                    id={`upload-doc-member-${member.id}`}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadMemberDoc(member, f);
                    }}
                  />

                  {/* Botões de Aprovação e Recusa pelo Administrador */}
                  {hasProof && (
                    <>
                      {member.documentVerified ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isProcessing}
                          onClick={() => handleRevoke(member)}
                          className="h-9 text-xs font-bold border-amber-400 text-amber-900 bg-amber-50 hover:bg-amber-100 gap-1.5"
                          title="Revogar validação para reanálise"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Desfazer Validação
                        </Button>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => handleApprove(member)}
                            className="h-9 px-4 text-xs font-black bg-emerald-700 hover:bg-emerald-800 text-white shadow-md gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Aprovar Documento e Liberar
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={isProcessing}
                            onClick={() => {
                              setRejectingMemberId(member.id);
                              setRejectionReason(member.documentRejectionReason || '');
                            }}
                            className="h-9 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs gap-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Rejeitar Documento
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* DIÁLOGO / CAMPO INLINE PARA RECUSA COM MOTIVO */}
              {isRejectingThis && (
                <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-3.5 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-black text-rose-950 uppercase">
                    <span>Informe o motivo da recusa do documento de {member.fullName}:</span>
                    <button
                      type="button"
                      onClick={() => setRejectingMemberId(null)}
                      className="text-rose-700 hover:text-rose-900 text-xs font-bold"
                    >
                      Cancelar ✕
                    </button>
                  </div>
                  <Input
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Ex: Foto cortada/ilegível, comprovante de matrícula desatualizado ou vencido."
                    className="h-9 text-xs bg-white border-rose-300 focus-visible:ring-rose-500"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setRejectingMemberId(null)}
                      className="h-8 text-xs font-bold text-slate-600"
                    >
                      Voltar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => handleReject(member)}
                      className="h-8 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      Confirmar Recusa do Documento
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
