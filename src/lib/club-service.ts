import { supabase } from '@/integrations/supabase/client';
import { getLabcardSubscriptions, doesPlanAllowDependents, REGULARIZED_ACTIVE_CARDS } from './labcard-seed';
import { saveStateToIndexedDB, loadStateFromIndexedDB } from './club-indexeddb';
import {
  saveMemberPermanentDocs,
  loadMemberPermanentDocs,
  loadAllPermanentMemberDocs,
  applyPermanentDocsToSub,
  saveClubAttachmentAtomic,
  softDeleteClubAttachment,
  loadClubRecordHistory,
  uploadClubFileToStorage,
  type PermanentMemberDocRecord,
  type ClubRecordHistoryEntry,
} from './club-permanent-docs';
import { ensureDailyBackup } from './club-backup-service';
import { syncStateToRelationalDatabase } from './club-relational-sync';
import {
  DEFAULT_CLUB_MODALITIES,
  DEFAULT_CONTRACT_TEMPLATES,
  type BillingCycle,
  type ClubCashEntry,
  type ClubConsultant,
  type ClubContractTemplate,
  type ClubInvoice,
  type ClubMember,
  type ClubModality,
  type ClubPaymentMethod,
  type ClubSubscription,
  type ContractTemplateType,
  type SubscriptionStatus,
  type ClubAdditionalService,
  type ClubAttachment,
  type ClubTrashItem,
} from './club-types';

const STORAGE_KEY = 'lessa_club_ecosystem_v1';
const SUPABASE_SETTINGS_KEY = 'lessa_club_ecosystem_v1';
const ADMIN_CONFIRMED_CARDS_STORAGE_KEY = 'lessa_club_admin_confirmed_transfers_v1';

// Cache em memória para abertura instantânea do painel e evitar bloqueio de tela
let memoryClubState: ClubDatabaseState | null = null;

export const getAdminConfirmedCardsSet = (): Set<string> => {
  const set = new Set<string>();
  if (typeof window === 'undefined') return set;
  try {
    const raw = localStorage.getItem(ADMIN_CONFIRMED_CARDS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((c) => {
          if (c && typeof c === 'string') set.add(c.trim());
        });
      }
    }
  } catch {}
  return set;
};

export const markCardAsAdminConfirmed = (cardCode: string, confirmed: boolean) => {
  if (typeof window === 'undefined' || !cardCode) return;
  try {
    const set = getAdminConfirmedCardsSet();
    const clean = cardCode.trim();
    if (confirmed) {
      set.add(clean);
    } else {
      set.delete(clean);
    }
    localStorage.setItem(ADMIN_CONFIRMED_CARDS_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
};

export const isSubscriptionRegularizedOrActive = (
  sub: Partial<ClubSubscription>,
  adminConfirmedCards?: Set<string>
): boolean => {
  // A decisão do administrador tem prioridade soberana:
  // Se o cadastro foi marcado como INATIVO, SUSPENSO ou CANCELADO, JAMAIS deve ser considerado ativo
  if (
    sub.status === 'INACTIVE' ||
    sub.status === 'SUSPENDED' ||
    sub.status === 'CANCELLED' ||
    Boolean(sub.inactivityReason)
  ) {
    return false;
  }

  const confirmedSet = adminConfirmedCards || getAdminConfirmedCardsSet();
  const code = (sub.subscriptionCode || '').trim();
  const subId = (sub.id || '').replace('sub-labcard-', '').trim();
  const isLabcard = sub.origin === 'IMPORT_LABCARD' || (sub.id || '').startsWith('sub-labcard-');

  // Cadastros novos criados diretamente no sistema Lessa Club:
  if (!isLabcard) {
    return sub.status === 'ACTIVE' || (sub.status !== 'PENDING_TRANSFER' && Boolean(sub.manualStatusOverride));
  }

  // REGRA DE OURO PARA CADASTROS IMPORTADOS DO LABCARD:
  // JAMAIS ativa em massa automaticamente!
  // SOMENTE pode ser considerado ativo se:
  // 1. Estiver na lista oficial de regularizados (REGULARIZED_ACTIVE_CARDS)
  // 2. Ou se foi confirmado manualmente e individualmente pelo Administrador (confirmedSet)
  // 3. Ou se está EXPLICITAMENTE salvo com status === 'ACTIVE' (com transferência/override confirmado)
  // NUNCA ativa apenas por ter `isModifiedFromSeed` ou `manualStatusOverride` em cadastro PENDING_TRANSFER!
  return (
    REGULARIZED_ACTIVE_CARDS.has(code) ||
    REGULARIZED_ACTIVE_CARDS.has(subId) ||
    confirmedSet.has(code) ||
    confirmedSet.has(subId) ||
    (sub.status === 'ACTIVE' &&
      (Boolean(sub.manuallyConfirmedTransfer) ||
        Boolean(sub.transferCompleted) ||
        Boolean(sub.manualStatusOverride)))
  );
};

export const mergeAttachmentsSafely = (
  preferred: ClubAttachment[] | undefined,
  fallback: ClubAttachment[] | undefined
): ClubAttachment[] => {
  const pList = preferred || [];
  const fList = fallback || [];
  if (pList.length === 0) return fList;
  if (fList.length === 0) return pList;

  const fMap = new Map(fList.map((a) => [a.name, a]));
  const merged = pList.map((att) => {
    const fAtt = fMap.get(att.name);
    if (!fAtt) return att;
    const isCompacted = !att.dataUrl || att.dataUrl.includes('[COMPACTED_LOCAL]') || att.dataUrl === 'HAS_DOC_ATTACHED';
    const fIsReal = fAtt.dataUrl && !fAtt.dataUrl.includes('[COMPACTED_LOCAL]') && fAtt.dataUrl !== 'HAS_DOC_ATTACHED';
    if (isCompacted && fIsReal) {
      return { ...att, dataUrl: fAtt.dataUrl, mimeType: att.mimeType || fAtt.mimeType };
    }
    return att;
  });

  const mergedNames = new Set(merged.map((a) => a.name));
  fList.forEach((fa) => {
    if (!mergedNames.has(fa.name)) {
      merged.push(fa);
    }
  });
  return merged;
};

export const mergeMemberMediaSafely = (
  primary: ClubMember,
  backup?: ClubMember
): ClubMember => {
  if (!backup) return primary;
  const isProofCompacted = !primary.documentProofUrl || primary.documentProofUrl === 'HAS_DOC_ATTACHED' || primary.documentProofUrl.includes('[COMPACTED_LOCAL]');
  const backupProofReal = backup.documentProofUrl && backup.documentProofUrl !== 'HAS_DOC_ATTACHED' && !backup.documentProofUrl.includes('[COMPACTED_LOCAL]');
  const finalDocProofUrl = isProofCompacted && backupProofReal ? backup.documentProofUrl : (primary.documentProofUrl || backup.documentProofUrl);

  const isPhotoMissing = !primary.photoUrl || primary.photoUrl.length < 50;
  const backupPhotoReal = backup.photoUrl && backup.photoUrl.length >= 50;
  const finalPhotoUrl = isPhotoMissing && backupPhotoReal ? backup.photoUrl : (primary.photoUrl || backup.photoUrl);

  return {
    ...primary,
    rg: primary.rg || backup.rg,
    birthDate: primary.birthDate || backup.birthDate,
    sex: primary.sex || backup.sex,
    phone: primary.phone || backup.phone,
    documentProofUrl: finalDocProofUrl,
    documentProofName: primary.documentProofName || backup.documentProofName,
    photoUrl: finalPhotoUrl,
    documentVerified: primary.documentVerified ?? backup.documentVerified,
    documentStatus: primary.documentStatus || backup.documentStatus,
    documentVerifiedAt: primary.documentVerifiedAt || backup.documentVerifiedAt,
    documentVerifiedBy: primary.documentVerifiedBy || backup.documentVerifiedBy,
    expirationDate: primary.expirationDate || backup.expirationDate,
    validityLabel: primary.validityLabel || backup.validityLabel,
    attachments: mergeAttachmentsSafely(primary.attachments, backup.attachments),
  };
};

export interface PlanDocumentRule {
  requiresDocument: boolean;
  title: string;
  summary: string;
  acceptedDocs: string[];
}

export const getPlanDocumentRule = (
  modalityCode?: string,
  modalityName?: string
): PlanDocumentRule => {
  const code = (modalityCode || '').toUpperCase().trim();
  const name = (modalityName || '').toLowerCase();

  if (code === 'IDOSO_60' || name.includes('vitalício') || name.includes('vitalicio') || name.includes('60+')) {
    return {
      requiresDocument: true,
      title: 'Documento Comprobatório de Idade (60+ anos)',
      summary:
        'Para aprovar a isenção do plano Lessa Vitalício 60+, é obrigatório anexar documento oficial que comprove idade mínima de 60 anos.',
      acceptedDocs: [
        'RG (frente e verso) legível',
        'CNH (Carteira Nacional de Habilitação)',
        'Outro documento oficial com foto e data de nascimento',
      ],
    };
  }

  if (code === 'KIDS' || name.includes('kids')) {
    return {
      requiresDocument: true,
      title: 'Documento Comprobatório da Criança (até 11 anos)',
      summary:
        'Para aprovar a isenção do plano Lessa Kids, é obrigatório anexar documento oficial que comprove a idade da criança (até 11 anos).',
      acceptedDocs: [
        'Certidão de Nascimento',
        'RG ou CPF da criança com data de nascimento',
        'Outro documento oficial que comprove idade até 11 anos',
      ],
    };
  }

  if (code === 'PCD_TEA' || name.includes('inclus') || name.includes('pcd') || name.includes('tea')) {
    return {
      requiresDocument: true,
      title: 'Laudo Médico / CIPTEA / Carteira PCD',
      summary:
        'Para aprovar o plano Lessa Inclusão (PCD / TEA), é obrigatório anexar documento médico ou carteira oficial de identificação.',
      acceptedDocs: [
        'Laudo Médico com CID atualizado',
        'Carteira de Identificação da Pessoa com TEA (CIPTEA)',
        'Carteira PCD oficial ou comprovante BPC',
      ],
    };
  }

  if (code === 'ESTUDANTE' || name.includes('student') || name.includes('estudante')) {
    return {
      requiresDocument: true,
      title: 'Comprovante de Matrícula ou Carteirinha Estudantil',
      summary:
        'Para aprovar o benefício do plano Lessa Student Pass, é obrigatório anexar comprovação de matrícula ou carteirinha estudantil ativa.',
      acceptedDocs: [
        'Declaração de Matrícula atualizada (escola, curso técnico ou faculdade)',
        'Carteirinha Estudantil vigente (DNE, UNE, UBES ou instituição de ensino)',
        'Comprovante de frequência ou boleto escolar recente',
      ],
    };
  }

  if (code === 'PROFESSOR' || name.includes('professor')) {
    return {
      requiresDocument: true,
      title: 'Comprovante de Docência / Holerite / Carteira Funcional',
      summary:
        'Para aprovar o benefício do plano Lessa Professor Pass, é obrigatório anexar comprovação de atuação como professor(a).',
      acceptedDocs: [
        'Holerite / Contracheque recente constando cargo de Professor(a)',
        'Declaração da instituição de ensino ou portaria de nomeação',
        'Carteira Funcional de Professor / registro em secretaria de educação',
      ],
    };
  }

  if (code === 'SERVIDOR' || name.includes('servidor')) {
    return {
      requiresDocument: true,
      title: 'Comprovante de Vínculo Público / Funcional',
      summary:
        'Para aprovar o benefício do plano Lessa Servidor Pass, é obrigatório anexar comprovação de vínculo como servidor(a) público(a).',
      acceptedDocs: [
        'Holerite / Contracheque recente de órgão público (municipal, estadual ou federal)',
        'Portaria de nomeação, termo de posse ou declaração do RH do órgão',
        'Crachá ou Carteira Funcional de Servidor Público',
      ],
    };
  }

  if (code === 'DOADOR' || name.includes('doador')) {
    return {
      requiresDocument: true,
      title: 'Comprovante / Carteira de Doador de Sangue',
      summary:
        'Para aprovar o benefício do plano Lessa Doador, é obrigatório anexar carteirinha de doador de sangue ou comprovante de doação recente.',
      acceptedDocs: [
        'Carteira de Doador Regular de Sangue (Hemocentro / Fhemeron)',
        'Comprovante de doação de sangue emitido nos últimos 6 meses',
      ],
    };
  }

  if (code === 'CONJUGE' || name.includes('cônjuge') || name.includes('conjuge') || name.includes('espos') || name.includes('marido')) {
    return {
      requiresDocument: true,
      title: 'Comprovante de Vínculo Conjugal',
      summary:
        'Para aprovar o dependente cônjuge, é obrigatório anexar certidão de casamento ou declaração de união estável.',
      acceptedDocs: [
        'Certidão de Casamento',
        'Escritura pública ou declaração de União Estável',
        'Certidão de nascimento de filhos em comum',
      ],
    };
  }

  if (code === 'PUBLICIDADE' || name.includes('family') || name.includes('publicidade')) {
    return {
      requiresDocument: true,
      title: 'Documentação Obrigatória — Lessa Family Publicidade',
      summary:
        'Para ativação do plano Lessa Family Publicidade, é obrigatório anexar documento oficial com foto (RG/CNH) do titular e dos dependentes (cônjuge/filhos), além da foto do veículo adesivado.',
      acceptedDocs: [
        'RG ou CNH com foto legível (Titular e Dependentes)',
        'Certidão de Nascimento (filhos) ou Casamento/União Estável (cônjuge)',
        'Documento do veículo (CRLV) e foto nítida do carro adesivado',
      ],
    };
  }

  return {
    requiresDocument: false,
    title: '',
    summary: '',
    acceptedDocs: [],
  };
};

export const memberHasProofUploaded = (
  member?: Partial<ClubMember> | null,
  sub?: Partial<ClubSubscription> | null
): boolean => {
  if (!member) return false;
  if (member.documentProofUrl && member.documentProofUrl.trim().length > 0) return true;
  if (Array.isArray(member.attachments) && member.attachments.length > 0) return true;
  if (Array.isArray(member.proofDocuments) && member.proofDocuments.length > 0) return true;

  // Verifica nos anexos da assinatura (sub.attachments)
  if (sub?.attachments && Array.isArray(sub.attachments) && sub.attachments.length > 0) {
    const isHolderOrSolo =
      member.role === 'TITULAR' ||
      !sub.members ||
      sub.members.length <= 1 ||
      (sub.members[0] && sub.members[0].id === member.id);

    if (isHolderOrSolo) return true;

    const firstName = (member.fullName || '').split(' ')[0].toLowerCase().trim();
    const card = (member.cardNumber || '').trim();
    const memId = (member.id || '').trim();

    return sub.attachments.some((att) => {
      const attName = (att.name || '').toLowerCase();
      const attId = (att.id || '').toLowerCase();
      return (
        (firstName.length >= 3 && attName.includes(firstName)) ||
        (card && attName.includes(card)) ||
        (memId && (attId.includes(memId) || attName.includes(memId)))
      );
    });
  }

  return false;
};

/**
 * Retorna todos os anexos e comprovantes associados a um integrante (titular ou dependente),
 * unificando o comprovante principal (documentProofUrl), anexos individuais do membro
 * e anexos vinculados na assinatura (sub.attachments).
 */
export const getMemberResolvedAttachments = (
  member?: Partial<ClubMember> | null,
  sub?: Partial<ClubSubscription> | null
): Array<{ id: string; name: string; dataUrl: string; mimeType: string; createdAt?: string }> => {
  if (!member) return [];
  const list: Array<{ id: string; name: string; dataUrl: string; mimeType: string; createdAt?: string }> = [];
  const seenUrls = new Set<string>();

  if (member.documentProofUrl && member.documentProofUrl.trim().length > 0) {
    seenUrls.add(member.documentProofUrl);
    list.push({
      id: 'primary-doc',
      name: member.documentProofName || 'Documento Comprobatório',
      dataUrl: member.documentProofUrl,
      mimeType: member.documentProofUrl.startsWith('data:image/') ? 'image/jpeg' : 'application/pdf',
      createdAt: member.documentVerifiedAt,
    });
  }

  if (Array.isArray(member.attachments)) {
    for (const att of member.attachments) {
      const effUrl = att.dataUrl || (att as any).fileUrl;
      const effName = att.name || (att as any).fileName || 'Anexo do Integrante';
      if (att && effUrl && !seenUrls.has(effUrl)) {
        seenUrls.add(effUrl);
        list.push({
          id: att.id || `att-${list.length}`,
          name: effName,
          dataUrl: effUrl,
          mimeType: att.mimeType || (effUrl.startsWith('data:image/') ? 'image/jpeg' : 'application/pdf'),
          createdAt: att.createdAt || (att as any).uploadedAt,
        });
      }
    }
  }

  if (sub?.attachments && Array.isArray(sub.attachments)) {
    const isHolderOrSolo =
      member.role === 'TITULAR' ||
      !sub.members ||
      sub.members.length <= 1 ||
      (sub.members[0] && sub.members[0].id === member.id);

    const firstName = (member.fullName || '').split(' ')[0].toLowerCase().trim();
    const card = (member.cardNumber || '').trim();
    const memId = (member.id || '').trim();

    for (const att of sub.attachments) {
      const effUrl = att.dataUrl || (att as any).fileUrl;
      const effName = att.name || (att as any).fileName || (att as any).title || 'Anexo do Cadastro';
      if (!att || !effUrl || seenUrls.has(effUrl)) continue;
      const attName = (effName || '').toLowerCase();
      const attId = (att.id || '').toLowerCase();

      const matches =
        isHolderOrSolo ||
        (firstName.length >= 3 && attName.includes(firstName)) ||
        (card && attName.includes(card)) ||
        (memId && (attId.includes(memId) || attName.includes(memId)));

      if (matches) {
        seenUrls.add(effUrl);
        list.push({
          id: att.id || `sub-att-${list.length}`,
          name: effName,
          dataUrl: effUrl,
          mimeType: att.mimeType || (effUrl.startsWith('data:image/') ? 'image/jpeg' : 'application/pdf'),
          createdAt: att.createdAt || (att as any).uploadedAt,
        });
      }
    }
  }

  return list;
};

export const memberHasProofDocument = (
  member?: Partial<ClubMember> | null,
  sub?: Partial<ClubSubscription> | null
): boolean => {
  return memberHasProofUploaded(member, sub);
};

export const getMemberDocumentStatus = (
  member?: Partial<ClubMember> | null,
  sub?: Partial<ClubSubscription> | null
): 'DISPENSADO' | 'PENDENTE_ANEXO' | 'EM_ANALISE' | 'APROVADO' | 'REJEITADO' => {
  if (!member) return 'DISPENSADO';
  const rule = getPlanDocumentRule(member.modalityCode, member.modalityName);
  if (!rule.requiresDocument) return 'DISPENSADO';

  const hasRealUpload = memberHasProofUploaded(member, sub);
  if (member.documentVerified && hasRealUpload) return 'APROVADO';
  if (member.documentRejectionReason && !(member.documentVerified && hasRealUpload)) return 'REJEITADO';
  if (hasRealUpload) return 'EM_ANALISE';
  return 'PENDENTE_ANEXO';
};

export const isMemberBlockedForMissingDoc = (
  member?: Partial<ClubMember> | null,
  sub?: Partial<ClubSubscription> | null
): boolean => {
  if (!member) return false;

  const hasRealDoc = memberHasProofUploaded(member, sub);
  const isApproved = member.documentVerified === true || member.documentStatus === 'APROVADO';

  // Se a assinatura ou o membro tiver motivo explícito de falta de documentos
  const hasExplicitDocReason =
    sub?.inactivityReason === 'FALTA_DOCUMENTOS' ||
    sub?.inactivityReason === 'MENSALIDADE_E_DOCUMENTOS' ||
    sub?.inactivityReasons?.includes('FALTA_DOCUMENTOS') ||
    member.inactivityReason === 'FALTA_DOCUMENTOS' ||
    member.inactivityReason === 'MENSALIDADE_E_DOCUMENTOS' ||
    member.inactivityReasons?.includes('FALTA_DOCUMENTOS');

  if (hasExplicitDocReason) {
    // Se não tiver documento real anexado ou não estiver aprovado, está bloqueado
    if (!hasRealDoc || !isApproved) {
      return true;
    }
  }

  const rule = getPlanDocumentRule(member.modalityCode, member.modalityName);
  if (!rule.requiresDocument) return false;

  // Plano exige comprovação: se não anexou nada, está bloqueado
  if (!hasRealDoc) return true;

  // Se já anexou documento real, só bloqueia se o admin rejeitou expressamente
  if (member.documentStatus === 'REJEITADO') return true;

  return false;
};

/**
 * Normaliza e identifica com alta precisão o plano do cliente
 */
export const normalizeClientPlanName = (sub: ClubSubscription): string => {
  const raw = (sub.planSummaryLabel || sub.members?.[0]?.modalityName || sub.members?.[0]?.planCycleLabel || '').trim();
  const lower = raw.toLowerCase();

  if (!raw || lower === '- r$ 0,00' || lower === '-' || lower === 'sem plano') {
    return 'Sem Plano / A Definir';
  }
  if (lower.includes('publicidade') || lower.includes('family publicidade')) {
    return 'Lessa Family Publicidade';
  }
  if (lower.includes('servidor') || lower.includes('servidores')) {
    if (lower.includes('anual') || sub.billingCycle === 'ANNUAL') return 'Lessa Servidor Pass (Anual)';
    return 'Lessa Servidor Pass (Mensal)';
  }
  if (lower.includes('student') || lower.includes('estudante')) {
    if (lower.includes('anual') || sub.billingCycle === 'ANNUAL') return 'Lessa Student Pass (Anual)';
    return 'Lessa Student Pass (Mensal)';
  }
  if (lower.includes('professor')) {
    if (lower.includes('anual') || sub.billingCycle === 'ANNUAL') return 'Lessa Professor Pass (Anual)';
    return 'Lessa Professor Pass (Mensal)';
  }
  if (lower.includes('kids')) {
    return 'Lessa Kids (Gratuito)';
  }
  if (lower.includes('vitalicio') || lower.includes('vitalício') || lower.includes('60+')) {
    return 'Lessa Vitalício 60+';
  }
  if (lower.includes('inclus') || lower.includes('pcd') || lower.includes('tea') || lower.includes('pdc')) {
    return 'Lessa Inclusão (PCD e TEA)';
  }
  if (lower.includes('corporate') || lower.includes('corporativo')) {
    return 'Lessa Corporate Pass';
  }
  if (lower.includes('duo')) {
    return 'Lessa Duo Club';
  }
  if (lower.includes('parceiro')) {
    return 'Lessa Parceiro';
  }
  if (lower.includes('convênio') || lower.includes('convenio') || lower.includes('day use')) {
    return 'Lessa Convênio (Day Use)';
  }
  if (lower.includes('5 pessoas') || lower.includes('5 p')) {
    return sub.billingCycle === 'ANNUAL' ? 'Lessa Club (5 pessoas - Anual)' : 'Lessa Club (5 pessoas)';
  }
  if (lower.includes('4 pessoas') || lower.includes('4 p')) {
    return sub.billingCycle === 'ANNUAL' ? 'Lessa Club (4 pessoas - Anual)' : 'Lessa Club (4 pessoas)';
  }
  if (lower.includes('3 pessoas') || lower.includes('3 p')) {
    return sub.billingCycle === 'ANNUAL' ? 'Lessa Club (3 pessoas - Anual)' : 'Lessa Club (3 pessoas)';
  }
  if (lower.includes('2 pessoas') || lower.includes('2 p')) {
    return sub.billingCycle === 'ANNUAL' ? 'Lessa Club (2 pessoas - Anual)' : 'Lessa Club (2 pessoas)';
  }
  if (lower.includes('lessa club') || lower.includes('individual') || lower.includes('49,90')) {
    if (lower.includes('anual') || sub.billingCycle === 'ANNUAL') return 'Lessa Club (Individual - Anual)';
    return 'Lessa Club (Individual)';
  }

  const cleaned = raw.replace(/\s*-\s*r\$\s*[\d.,]+/i, '').trim();
  return cleaned || 'Outros Planos';
};

/**
 * Identifica se a assinatura possui faturas/mensalidades atrasadas
 */
export const isSubscriptionOverdue = (sub: ClubSubscription): boolean => {
  if (
    sub.inactivityReason === 'MENSALIDADE_VENCIDA' ||
    sub.inactivityReasons?.includes('MENSALIDADE_VENCIDA')
  ) {
    return true;
  }
  const now = new Date();
  return (sub.invoices || []).some(
    (i) => i.status === 'OVERDUE' || (i.status === 'PENDING' && new Date(i.dueDate + 'T23:59:59') < now)
  );
};

/**
 * Identifica se a assinatura possui titular ou dependentes com pendência de documentos
 */
export const isSubscriptionMissingDocs = (sub: ClubSubscription): boolean => {
  if (
    sub.inactivityReason === 'FALTA_DOCUMENTOS' ||
    sub.inactivityReasons?.includes('FALTA_DOCUMENTOS') ||
    sub.inactivityReason === 'MENSALIDADE_E_DOCUMENTOS'
  ) {
    return true;
  }
  return (sub.members || []).some((m) => {
    if (m.documentStatus === 'REJEITADO' || m.documentStatus === 'PENDENTE_ANEXO') return true;
    if (isMemberBlockedForMissingDoc(m, sub)) return true;
    const plan = (m.planCycleLabel || sub.planSummaryLabel || '').toLowerCase();
    const needsProof =
      plan.includes('servidor') ||
      plan.includes('student') ||
      plan.includes('estudante') ||
      plan.includes('professor') ||
      plan.includes('inclus') ||
      plan.includes('pcd') ||
      plan.includes('tea');
    if (
      needsProof &&
      !m.documentVerified &&
      !m.documentProofUrl &&
      !m.documentProofName &&
      m.documentStatus !== 'APROVADO'
    ) {
      return true;
    }
    return false;
  });
};

/**
 * Avalia e atualiza automaticamente o status de inativação de uma assinatura.
 * - Se tinha pendência financeira e foi paga: remove o aviso de mensalidade.
 * - Se tinha pendência de documento e foi anexado/aprovado: remove o aviso de documento.
 * - Se ambos foram resolvidos: ativa o plano e libera as carteirinhas automaticamente.
 */
export const resolveSubscriptionInactivityStatus = (sub: ClubSubscription): ClubSubscription => {
  const overdueInvoices = (sub.invoices || []).filter(
    (i) =>
      !isClubInvoiceReservation(i) &&
      (i.status === 'OVERDUE' || (i.status === 'PENDING' && new Date(i.dueDate + 'T23:59:59') < new Date()))
  );
  const hasOverdue = overdueInvoices.length > 0;

  // Verifica se há dependente ou titular com documento pendente de envio ou rejeitado
  const hasMissingDoc = (sub.members || []).some((m) => isMemberBlockedForMissingDoc(m, sub));

  const isReasonFinance =
    sub.inactivityReason === 'MENSALIDADE_VENCIDA' ||
    sub.inactivityReasons?.includes('MENSALIDADE_VENCIDA');
  const isReasonDocs =
    sub.inactivityReason === 'FALTA_DOCUMENTOS' ||
    sub.inactivityReasons?.includes('FALTA_DOCUMENTOS');
  const isCombined =
    sub.inactivityReason === 'MENSALIDADE_E_DOCUMENTOS' ||
    (isReasonFinance && isReasonDocs);

  const hasFinancialDebt = hasOverdue;

  // Se o motivo for administrativo ou solicitação expressa do cliente, preserva a decisão manual deliberada
  if (
    sub.inactivityReason === 'SOLICITACAO_CLIENTE' ||
    sub.inactivityReason === 'ADMINISTRATIVO'
  ) {
    return sub;
  }

  // Se o plano está inativo por mensalidade, documento ou ambos:
  if (sub.status === 'INACTIVE' || isCombined || isReasonFinance || isReasonDocs || hasFinancialDebt) {
    if (!hasFinancialDebt && !hasMissingDoc) {
      // AMBOS RESOLVIDOS! Mensalidades pagas e documentos em dia: Libera o plano e membros imediatamente
      return {
        ...sub,
        status: 'ACTIVE',
        manualStatusOverride: true,
        inactivityReason: undefined,
        inactivityReasons: undefined,
        inactivityNotes: undefined,
        transferCompleted: true,
        manuallyConfirmedTransfer: true,
        members: sub.members.map((m) => ({
          ...m,
          status: 'ACTIVE',
          inactivityReason: undefined,
          inactivityReasons: undefined,
          inactivityNotes: undefined,
        })),
        updatedAt: new Date().toISOString(),
      };
    }

    if (!hasFinancialDebt && hasMissingDoc) {
      // Mensalidades em dia, mas ainda falta documento
      return {
        ...sub,
        status: 'INACTIVE',
        inactivityReason: 'FALTA_DOCUMENTOS',
        inactivityReasons: ['FALTA_DOCUMENTOS'],
        inactivityNotes:
          sub.inactivityNotes &&
          (sub.inactivityNotes.toLowerCase().includes('document') ||
            sub.inactivityNotes.toLowerCase().includes('comprobat'))
            ? sub.inactivityNotes
            : 'Falta de documentos comprobatórios para ativação do benefício.',
        members: sub.members.map((m) => ({
          ...m,
          status: isMemberBlockedForMissingDoc(m, sub) ? 'INACTIVE' : 'ACTIVE',
          inactivityReason: isMemberBlockedForMissingDoc(m, sub) ? 'FALTA_DOCUMENTOS' : undefined,
          inactivityReasons: isMemberBlockedForMissingDoc(m, sub) ? ['FALTA_DOCUMENTOS'] : undefined,
        })),
        updatedAt: new Date().toISOString(),
      };
    }

    if (hasFinancialDebt && !hasMissingDoc) {
      // Documentos anexados, mas ainda há mensalidades vencidas / pendência financeira
      return {
        ...sub,
        status: 'INACTIVE',
        inactivityReason: 'MENSALIDADE_VENCIDA',
        inactivityReasons: ['MENSALIDADE_VENCIDA'],
        inactivityNotes:
          sub.inactivityNotes &&
          (sub.inactivityNotes.toLowerCase().includes('mensal') ||
            sub.inactivityNotes.toLowerCase().includes('pagamento') ||
            sub.inactivityNotes.toLowerCase().includes('fatura') ||
            sub.inactivityNotes.toLowerCase().includes('atraso'))
            ? sub.inactivityNotes
            : 'Mensalidade(s) pendente(s) ou em atraso para regularização.',
        members: sub.members.map((m) => ({
          ...m,
          status: 'INACTIVE',
          inactivityReason: 'MENSALIDADE_VENCIDA',
          inactivityReasons: ['MENSALIDADE_VENCIDA'],
        })),
        updatedAt: new Date().toISOString(),
      };
    }

    if (hasFinancialDebt && hasMissingDoc) {
      // Ambos pendentes
      return {
        ...sub,
        status: 'INACTIVE',
        inactivityReason: 'MENSALIDADE_E_DOCUMENTOS',
        inactivityReasons: ['MENSALIDADE_VENCIDA', 'FALTA_DOCUMENTOS'],
        members: sub.members.map((m) => ({
          ...m,
          status: 'INACTIVE',
          inactivityReason: 'MENSALIDADE_E_DOCUMENTOS',
          inactivityReasons: ['MENSALIDADE_VENCIDA', 'FALTA_DOCUMENTOS'],
        })),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  return sub;
};

let cachedLabcardSeedMap: Map<string, ClubSubscription> | null = null;

const getLabcardSeedMap = (): Map<string, ClubSubscription> => {
  if (!cachedLabcardSeedMap) {
    cachedLabcardSeedMap = new Map(getLabcardSubscriptions().map((s) => [s.id, s]));
  }
  return cachedLabcardSeedMap;
};

const strEq = (a?: string, b?: string) => (a || '').trim() === (b || '').trim();

export const isLabcardSubscriptionModified = (
  sub: ClubSubscription,
  seedSub?: ClubSubscription
): boolean => {
  if (!sub.id.startsWith('sub-labcard-')) return true;
  if (!seedSub) return true;
  if (sub.isModifiedFromSeed) return true;
  if (sub.manualStatusOverride) return true;
  if (
    sub.status === 'ACTIVE' ||
    sub.status === 'INACTIVE' ||
    sub.status === 'SUSPENDED' ||
    sub.status === 'CANCELLED'
  ) {
    return true;
  }
  if (sub.transferCompleted || sub.manuallyConfirmedTransfer) return true;
  if (sub.inactivityReason || sub.inactivityNotes) return true;
  if (
    sub.asaasCustomerId ||
    sub.asaasSubscriptionId ||
    sub.asaasPaymentId ||
    sub.asaasInvoiceUrl
  ) {
    return true;
  }
  if (
    (sub.attachments?.length || 0) > 0 ||
    (sub.visits?.length || 0) > 0 ||
    (sub.additionalServices?.length || 0) > 0
  ) {
    return true;
  }
  if (sub.cardStatus) return true;

  if ((sub.members?.length || 0) !== (seedSub.members?.length || 0)) return true;
  if ((sub.invoices?.length || 0) !== (seedSub.invoices?.length || 0)) return true;

  if (sub.updatedAt && seedSub.updatedAt && sub.updatedAt > seedSub.updatedAt && sub.updatedAt > '2026-11-10T00:00:00.000Z') {
    return true;
  }

  if (
    !strEq(sub.endDate, seedSub.endDate) ||
    !strEq(sub.holderName, seedSub.holderName) ||
    !strEq(sub.holderCpf, seedSub.holderCpf) ||
    !strEq(sub.holderRg, seedSub.holderRg) ||
    !strEq(sub.holderPhone, seedSub.holderPhone) ||
    !strEq(sub.holderEmail, seedSub.holderEmail) ||
    !strEq(sub.addressCep, seedSub.addressCep) ||
    !strEq(sub.addressStreet, seedSub.addressStreet) ||
    !strEq(sub.addressNumber, seedSub.addressNumber) ||
    !strEq(sub.addressComplement, seedSub.addressComplement) ||
    !strEq(sub.addressNeighborhood, seedSub.addressNeighborhood) ||
    !strEq(sub.vehiclePlate, seedSub.vehiclePlate) ||
    !strEq(sub.vehicleModel, seedSub.vehicleModel) ||
    !strEq(sub.vehicleColor, seedSub.vehicleColor) ||
    !strEq(sub.notes, seedSub.notes) ||
    Number(sub.dueDay || 10) !== Number(seedSub.dueDay || 10)
  ) {
    return true;
  }

  for (let i = 0; i < (sub.members?.length || 0); i += 1) {
    const m = sub.members[i];
    const sm = seedSub.members?.[i];
    if (!sm) return true;
    if (
      m.manualStatusOverride ||
      m.status === 'ACTIVE' ||
      m.status === 'INACTIVE' ||
      m.status === 'SUSPENDED' ||
      m.status === 'CANCELLED' ||
      Boolean(m.photoUrl) ||
      Boolean(m.documentProofUrl) ||
      Boolean(m.documentProofName) ||
      Boolean(m.documentVerified) ||
      Boolean(m.documentStatus) ||
      Boolean(m.cardStatus) ||
      (m.attachments?.length || 0) > 0 ||
      (m.expirationDate && m.expirationDate !== sm.expirationDate && m.expirationDate !== '2027-10-31') ||
      !strEq(m.fullName, sm.fullName) ||
      !strEq(m.cpf, sm.cpf) ||
      !strEq(m.rg, sm.rg) ||
      !strEq(m.phone, sm.phone) ||
      !strEq(m.email, sm.email)
    ) {
      return true;
    }
  }
  return false;
};

export const tryPersistLocalState = (state: ClubDatabaseState) => {
  // Salva no IndexedDB de alta capacidade sem qualquer restrição de tamanho para mídias e fotos
  saveStateToIndexedDB(state);

  const seedMap = getLabcardSeedMap();
  const compactSubs = state.subscriptions.filter((s) => {
    if (!s.id.startsWith('sub-labcard-')) return true;
    return isLabcardSubscriptionModified(s, seedMap.get(s.id));
  });

  const payload = {
    ...state,
    subscriptions: compactSubs.map((s) => ({
      ...s,
      contractContentHtml: undefined,
    })),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[ClubService] localStorage quota exceeded, safely compressing cached attachments:', e);
    try {
      // NUNCA exclui cadastros sub-labcard- modificados nem apaga vínculos familiares!
      // Caso a cota de 5MB seja atingida, comprime apenas strings dataUrl gigantes (> 150KB) mantendo metadados
      const safeSubs = compactSubs.map((s) => ({
        ...s,
        contractContentHtml: undefined,
        attachments: (s.attachments || []).map((att) => ({
          ...att,
          dataUrl:
            att.dataUrl && att.dataUrl.length > 150000
              ? att.dataUrl.slice(0, 100) + '...[COMPACTED_LOCAL]'
              : att.dataUrl,
        })),
        members: (s.members || []).map((m) => ({
          ...m,
          photoUrl: m.photoUrl && m.photoUrl.length > 150000 ? '' : m.photoUrl,
          documentProofUrl:
            m.documentProofUrl && m.documentProofUrl.length > 150000
              ? 'HAS_DOC_ATTACHED'
              : m.documentProofUrl,
        })),
      }));

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...state,
          subscriptions: safeSubs,
        })
      );
    } catch (innerErr) {
      console.error('[ClubService] Falha crítica de cota do localStorage:', innerErr);
    }
  }
};

export const DEFAULT_CATALOG_SERVICES: ClubAdditionalService[] = [
  {
    id: 'prod-1',
    name: 'Quiosque com Churrasqueira (Day Use)',
    category: 'Locação',
    price: 70.0,
    addedAt: new Date().toISOString(),
    notes: 'Espaço com pia, grelha, mesa e tomadas',
  },
  {
    id: 'prod-2',
    name: 'Mesa c/ 4 Cadeiras e Guarda-sol',
    category: 'Locação',
    price: 30.0,
    addedAt: new Date().toISOString(),
    notes: 'À beira do rio',
  },
  {
    id: 'prod-3',
    name: 'Área de Camping / Barraca (Pernoite por pessoa)',
    category: 'Hospedagem',
    price: 40.0,
    addedAt: new Date().toISOString(),
    notes: 'Área gramada com ponto de energia e banheiro',
  },
  {
    id: 'prod-4',
    name: 'Colete Salva-Vidas (Day Use)',
    category: 'Segurança',
    price: 15.0,
    addedAt: new Date().toISOString(),
    notes: 'Vários tamanhos infantil e adulto',
  },
  {
    id: 'prod-5',
    name: 'Caiaque / Stand Up Paddle (1 Hora)',
    category: 'Lazer',
    price: 35.0,
    addedAt: new Date().toISOString(),
    notes: 'Com remo e instrução básica',
  },
  {
    id: 'prod-6',
    name: 'Entrada Visitante Avulso (Não sócio)',
    category: 'Ingresso',
    price: 25.0,
    addedAt: new Date().toISOString(),
    notes: 'Day use completo nas áreas do balneário',
  },
  {
    id: 'prod-7',
    name: 'Pulseira Extra Convidado de Sócio',
    category: 'Ingresso',
    price: 15.0,
    addedAt: new Date().toISOString(),
    notes: 'Desconto exclusivo para convidados acompanhados',
  },
  {
    id: 'prod-8',
    name: 'Saco de Gelo 5kg',
    category: 'Conveniência',
    price: 12.0,
    addedAt: new Date().toISOString(),
    notes: 'Gelo em cubo filtrado',
  },
  {
    id: 'prod-9',
    name: 'Saco de Carvão 3kg',
    category: 'Conveniência',
    price: 18.0,
    addedAt: new Date().toISOString(),
    notes: 'Carvão vegetal selecionado',
  },
  {
    id: 'prod-10',
    name: 'Porção Especial de Tambaqui Balneário Lessa',
    category: 'Restaurante',
    price: 65.0,
    addedAt: new Date().toISOString(),
    notes: 'Acompanha mandioca, vinagrete e farofa',
  },
];

export const DEFAULT_SITE_TERMS_TEXT = `BALNEÁRIO FAMÍLIA LESSA LTDA
Contrato de Adesão, Termos e Condições Gerais de Uso, Adesão e Acesso
CNPJ: 46.891.134/0001-40 • Via Araras, Setor 09, Ariquemes/RO • WhatsApp: (69) 99262-6140

1. DO OBJETO E ACEITAÇÃO
1.1. Os presentes Termos e Condições Gerais de Uso regulam a adesão, o acesso, a permanência e a utilização das dependências, atrações, estruturas naturais, serviços e benefícios disponibilizados pelo Balneário Família Lessa, por meio de planos (Lessa Club), carteirinhas ou acessos avulsos.
1.2. Ao realizar o cadastro, efetuar pagamento ou utilizar qualquer plano ou benefício, seja presencialmente ou através do portal online, o usuário declara, de forma expressa, que leu, compreendeu e concorda integralmente com todas as disposições deste instrumento, obrigando-se a cumpri-las durante toda a vigência do plano contratado.
1.3. A não concordância com quaisquer cláusulas implica na impossibilidade de adesão ou utilização dos serviços oferecidos.

2. DA NATUREZA DO BALNEÁRIO E HORÁRIOS DE FUNCIONAMENTO
2.1. O Balneário Família Lessa é um empreendimento privado destinado ao lazer, convivência familiar e turismo recreativo, com ambiente cristão, seguro e orientado por normas internas próprias.
2.2. O Balneário funciona regularmente de sexta-feira a domingo e feriados, das 9h (nove horas) às 17h (dezessete horas).
2.3. O acesso às áreas, estruturas e atrações está condicionado às regras internas, disponibilidade operacional, condições climáticas, manutenção, segurança e critérios definidos pela administração, sem que eventuais ajustes ou interdições gerem direito a abatimento, restituição ou indenização financeira.

3. DO CADASTRO, CARTEIRINHA E RESPONSABILIDADE DAS INFORMAÇÕES
3.1. Para adesão aos planos, o usuário deverá fornecer informações completas, verídicas e atualizadas (Nome, CPF, Data de Nascimento, Telefone, E-mail, Endereço e dados dos dependentes), responsabilizando-se civil e criminalmente pela veracidade dos dados prestados.
3.2. O Balneário Família Lessa não se responsabiliza por prejuízos decorrentes de informações incorretas, incompletas ou falsas fornecidas pelo usuário.
3.3. A carteirinha emitida (física, digital ou QR Code) é de uso estritamente pessoal e intransferível, respeitando-se os limites e condições contratadas para titular e dependentes. Na portaria, documento oficial com foto poderá ser exigido a qualquer momento. O uso indevido por terceiros enseja suspensão ou cancelamento imediato por fraude.

4. DOS PLANOS, CATEGORIAS, ACESSO E BENEFÍCIOS
4.1. As condições comerciais, valores, benefícios, quantidade de acessos, vigência e regras específicas variam conforme o plano contratado no ato da adesão.
4.2. Quando previsto no plano contratado, o CONTRATANTE e seus dependentes vinculados terão direito à entrada ilimitada no Balneário durante a vigência, exclusivamente nos dias e horários regulares de funcionamento (sexta-feira a domingo e feriados, das 9h às 17h).
4.3. Lessa Kids, Estudante, Professor, Servidor, 60+ e Inclusão PCD/TEA exigem comprovação documental individualizada e periódica (RG/Certidão, comprovante escolar/funcional ou laudo médico/CIPTEA), devendo o titular manter os documentos atualizados. Ao completar a idade limite no Lessa Kids, o dependente passa automaticamente à categoria compatível vigente.
4.4. A expressão "entrada ilimitada" refere-se exclusivamente à quantidade de acessos do associado em dias normais de funcionamento, não abrangendo serviços cobrados à parte, dias fechados, eventos privados ou autorização para ingresso de terceiros.
4.5. MANUTENÇÃO E ATUALIZAÇÃO DE VALORES: Os planos na modalidade anual contratados ou renovados até 31 de dezembro de 2026 têm garantia de manutenção do valor contratado durante toda a vigência regular de 1 (um) ano, aplicando-se eventuais reajustes periódicos somente a partir de janeiro de 2027 ou em futuras renovações.

5. DAS REGRAS DE CONDUTA, SEGURANÇA E MEIO AMBIENTE
5.1. O usuário compromete-se a zelar pelo patrimônio, preservar a natureza, fauna e flora, descartar resíduos nas lixeiras seletivas, manter conduta compatível com ambiente familiar cristão e acatar as orientações dos monitores e salva-vidas.
5.2. É expressamente vedado: som automotivo ou caixas de som abusivas, porte de armas, substâncias ilícitas, recipientes/garrafas de vidro nas áreas de água e piscinas, brigas ou condutas contrárias à moral e segurança coletiva.
5.3. Crianças menores de 12 anos devem obrigatoriamente permanecer acompanhadas e sob supervisão visual direta de seus pais ou responsáveis legais durante todo o período nas águas.

6. DAS RESPONSABILIDADES, RISCOS E ISENÇÕES
6.1. O usuário declara ciência de que atividades de lazer, recreação, piscinas naturais, cachoeiras e contato com a natureza envolvem riscos inerentes, assumindo integral responsabilidade por seus atos e pelos atos de seus dependentes e convidados.
6.2. O Balneário Família Lessa não se responsabiliza por perdas, extravios, furtos ou danos a bens pessoais ou veículos, tampouco por acidentes decorrentes de imprudência, negligência, imperícia ou descumprimento das normas de segurança.

7. DOS SERVIÇOS INCLUSOS E NÃO INCLUSOS NOS PLANOS
7.1. A assinatura garante a entrada livre e uso das piscinas, cachoeiras, áreas verdes, campos de esporte e áreas comuns de descanso.
7.2. Não estão inclusos nos planos, sendo cobrados separadamente conforme tabela vigente: a) Consumos no restaurante, café colonial, lanchonetes, porções e bebidas; b) Trilhas de quadriciclo; c) Pesca esportiva (pesque e solte); d) Aluguel de equipamentos ou atividades recreativas opcionais; e) Locação exclusiva de quiosques com churrasqueira.

8. DOS PAGAMENTOS, VIGÊNCIA, CANCELAMENTO E AUSÊNCIA DE FIDELIDADE
8.1. O pagamento pode ser realizado via PIX integral, Cartão de Crédito (em até 12x para planos anuais) ou mensalidades recorrentes, iniciando-se a vigência regular após a confirmação do pagamento e validação documental quando obrigatória.
8.2. CANCELAMENTO SEM FIDELIDADE: O plano contratado não possui cláusula de fidelidade, podendo o titular solicitar o cancelamento a qualquer momento pelo WhatsApp Oficial (69) 99262-6140, SEM MULTA RESCISÓRIA e sem cobrança de parcelas futuras após a efetivação do cancelamento.
8.3. Para efetivar o cancelamento, o titular deve estar em dia com as mensalidades vencidas até a data do pedido. O não uso das dependências ou benefícios não isenta o pagamento das mensalidades enquanto o plano estiver ativo. Em caso de inadimplência superior a 5 dias, o acesso à portaria poderá ser temporariamente suspenso até a quitação da parcela.

9. DA SUSPENSÃO OU CANCELAMENTO DO ACESSO
9.1. O Balneário poderá suspender ou cancelar o acesso do usuário, sem direito a reembolso, em caso de descumprimento destes Termos, uso indevido da carteirinha por terceiros, fraude cadastral/documental ou conduta incompatível com a segurança coletiva.

10. DAS ALTERAÇÕES CONTRATUAIS
10.1. O Balneário Família Lessa poderá atualizar os presentes Termos, sendo as novas condições aplicáveis a partir de sua publicação nos canais oficiais e Portal do Sócio.

11. DA AUTORIZAÇÃO DE USO DE IMAGEM
11.1. Mediante o aceite deste Termo, o CONTRATANTE autoriza, de forma gratuita e para fins institucionais, promocionais e de divulgação das atividades do Balneário Família Lessa, o registro e uso de sua imagem e voz e de seus dependentes captadas durante o lazer, em quaisquer meios físicos ou digitais, sem ônus ou indenização.

12. DA LEI APLICÁVEL E FORO
12.1. Este instrumento é regido pelas leis da República Federativa do Brasil. Fica eleito o Foro da Comarca de Ariquemes, Estado de Rondônia, para dirimir quaisquer controvérsias oriundas deste contrato.

13. CONTATO
13.1. E-mail: balneario.lessa@gmail.com | WhatsApp: (69) 99262-6140 | Instagram: @balneariolessa

14. DA VALIDADE JURÍDICA DO ACEITE ELETRÔNICO E ASSINATURA DIGITAL
14.1. As partes declaram e reconhecem expressamente, com respaldo na Medida Provisória nº 2.200-2/2001 (art. 10, § 2º), na Lei Federal nº 14.063/2020 e nos artigos 104, 107, 219 e 422 do Código Civil Brasileiro, que o aceite digital destes Termos de Uso e do Contrato de Adesão, validado pelo próprio usuário titular no sistema, constitui assinatura eletrônica plenamente válida, autêntica e vinculante.
14.2. O aceite eletrônico registrado com os dados cadastrais do titular (Nome, CPF, Data de Nascimento, Telefone e E-mail), carimbo de data/hora e protocolo em servidor possui todos os efeitos jurídicos e probatórios equivalentes a uma assinatura presencial de próprio punho em documento físico, dispensando assinatura em papel ou reconhecimento de firma.`;

export interface ClubDatabaseState {
  modalities: ClubModality[];
  subscriptions: ClubSubscription[];
  deletedSubscriptionIds?: string[];
  trash?: ClubTrashItem[];
  consultants: ClubConsultant[];
  contractTemplates: ClubContractTemplate[];
  cashEntries?: ClubCashEntry[];
  catalogServices?: ClubAdditionalService[];
  siteTermsText?: string;
  lastCardSequence: number;
  updatedAt: string;
}

const getInitialState = (): ClubDatabaseState => ({
  modalities: DEFAULT_CLUB_MODALITIES,
  subscriptions: getLabcardSubscriptions(),
  deletedSubscriptionIds: [],
  trash: [],
  consultants: [
    {
      id: 'cons-1',
      name: 'Atendimento Balneário Lessa',
      cpf: '000.000.000-00',
      phone: '(69) 99262-6140',
      role: 'CONSULTOR',
      commissionPercent: 10,
      referralCode: 'LESSAOFICIAL',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    },
  ],
  contractTemplates: DEFAULT_CONTRACT_TEMPLATES,
  cashEntries: [],
  catalogServices: DEFAULT_CATALOG_SERVICES,
  siteTermsText: DEFAULT_SITE_TERMS_TEXT,
  lastCardSequence: 3015, // Sequência após 1212253014 (Labcard)
  updatedAt: new Date().toISOString(),
});

export const cleanDigits = (val?: string | null): string => (val || '').replace(/\D/g, '');

export const formatCpf = (val?: string | null): string => {
  const d = cleanDigits(val).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
};

export const formatPhone = (val?: string | null): string => {
  const d = cleanDigits(val).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
};

export const formatBirthDate = (val?: string | null): string => {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = cleanDigits(val).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

export const getBirthDatePassword = (birthDate?: string | null): string => {
  if (!birthDate) return '123456';
  const clean = cleanDigits(birthDate);
  if (clean.length === 8 && (clean.startsWith('19') || clean.startsWith('20')) && birthDate.includes('-')) {
    const [y, m, d] = birthDate.split('-');
    return `${d}${m}${y}`;
  }
  return clean.slice(0, 8) || '123456';
};

export const isValidCpf = (cpf?: string | null): boolean => {
  if (!cpf) return false;
  const clean = cleanDigits(cpf);
  if (clean.length !== 11) return false;
  // Rejeita sequências de dígitos idênticos (00000000000, 11111111111, etc.)
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(clean.charAt(10), 10);
};

export const isValidCnpj = (cnpj?: string | null): boolean => {
  if (!cnpj) return false;
  const clean = cleanDigits(cnpj);
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  const digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0), 10)) return false;

  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return result === parseInt(digits.charAt(1), 10);
};

export const formatDateBR = (isoOrDate?: string | null): string => {
  if (!isoOrDate) return '-';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(isoOrDate)) return isoOrDate;
  const parts = isoOrDate.split('T')[0].split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoOrDate;
};

/**
 * Calcula a data exata em que a criança completa 12 anos a partir da data de nascimento.
 * Até os 11 anos e 12 meses (11 anos e 364 dias), o plano Kids permanece gratuito/ativo.
 * No dia do 12º aniversário (ao completar 12 anos), vence e transiciona para plano pagante.
 * Aceita formatos DD/MM/AAAA ou AAAA-MM-DD.
 * Retorna formato ISO YYYY-MM-DD.
 */
export const calculateKidsExpirationDate = (birthDateStr?: string | null): string | undefined => {
  if (!birthDateStr) return undefined;
  const trimmed = birthDateStr.trim();
  let day = 0;
  let month = 0;
  let year = 0;

  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    }
  } else if (trimmed.includes('-')) {
    const parts = trimmed.split('T')[0].split('-');
    if (parts.length === 3) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    }
  }

  if (
    !day ||
    !month ||
    !year ||
    isNaN(day) ||
    isNaN(month) ||
    isNaN(year) ||
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return undefined;
  }

  const expYear = year + 12;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${expYear}-${mm}-${dd}`;
};

export const formatDateExtenso = (dateStr?: string): string => {
  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  const d = dateStr ? new Date(dateStr) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  return `${validDate.getDate()} de ${months[validDate.getMonth()]} de ${validDate.getFullYear()}`;
};

export const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(val) || 0);
};

export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

export const compressImageFile = (
  file: File,
  maxWidth = 900,
  maxHeight = 900,
  quality = 0.65
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith('image/')) {
      return fileToDataUrl(file).then(resolve).catch(reject);
    }
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        resolve(String(e.target?.result || ''));
      };
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / maxWidth > height / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(String(e.target?.result || ''));
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = String(e.target?.result || '');
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Converte e comprime automaticamente qualquer imagem enviada (fotos de celular de 10MB a 20MB)
 * para um arquivo JPEG leve (~80KB a 120KB) em alta legibilidade antes de enviar ao Supabase Storage.
 * Arquivos não-imagem (como PDF) são mantidos sem alteração.
 */
export const compressImageToFile = async (
  file: File,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.75
): Promise<{ file: File; fileName: string }> => {
  if (!file.type || !file.type.startsWith('image/')) {
    const ext = file.name.split('.').pop() || 'bin';
    return { file, fileName: `${crypto.randomUUID()}.${ext}` };
  }
  try {
    const dataUrl = await compressImageFile(file, maxWidth, maxHeight, quality);
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const fileName = `${crypto.randomUUID()}.jpg`;
    const compressed = new File([blob], fileName, { type: 'image/jpeg' });
    return { file: compressed, fileName };
  } catch (err) {
    console.warn('[compressImageToFile] Fallback to original file:', err);
    const ext = file.name.split('.').pop() || 'jpg';
    return { file, fileName: `${crypto.randomUUID()}.${ext}` };
  }
};

export const getQrCodeImageUrl = (payload: string, size = 240): string =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=4&data=${encodeURIComponent(
    payload
  )}`;

// Lê o estado local imediatamente e sincroniza com o Supabase (site_settings)
const isOutdatedCardUrl = (url?: string) =>
  !url ||
  [
    '/cards/2.png',
    '/cards/7.png',
    '/cards/9.png',
    '/cards/37.png',
    '/cards/25.png',
    '/cards/34.png',
    '/cards/17.png',
    '/cards/18.png',
    '/cards/4.png',
    '/cards/15.png',
    '/cards/16.png',
    '/cards/27.png',
    '/cards/36.png',
  ].includes(url);

// Detecta o código da modalidade com base no texto/descrição do plano informado na planilha ou contrato
export const detectModalityCodeFromPlanDescription = (
  planDescription?: string | null,
  currentCode?: string | null,
  modalities?: ClubModality[]
): string => {
  const p = (planDescription || '').trim().toLowerCase();
  if (!p) return currentCode || 'ADULTO';

  // Planos compostos / Família Personalizado (ex: "Família Personalizado (Anual): 2x Lessa Club + 2x Lessa Kids"):
  // O titular deve manter sua modalidade própria (ou a 1ª modalidade principal antes do "+"),
  // JAMAIS sendo sobrescrito por "Kids" dos dependentes!
  if (p.includes('família personalizado') || p.includes('familia personalizado') || p.includes('+')) {
    if (currentCode && currentCode !== 'SEM_PLANO') {
      return currentCode;
    }
    const primarySegment = (p.split(':')[1] || p).split('+')[0] || '';
    if (primarySegment.includes('publicidade') || primarySegment.includes('permuta')) return 'PUBLICIDADE';
    if (primarySegment.includes('servidor')) return 'SERVIDOR';
    if (primarySegment.includes('student') || primarySegment.includes('estudante')) return 'ESTUDANTE';
    if (primarySegment.includes('professor') || primarySegment.includes('docente')) return 'PROFESSOR';
    if (primarySegment.includes('lessa club') || primarySegment.includes('adulto')) return 'ADULTO';
    if (primarySegment.includes('vitalício') || primarySegment.includes('vitalicio') || primarySegment.includes('60+')) return 'IDOSO_60';
    if (primarySegment.includes('inclusão') || primarySegment.includes('inclusao') || primarySegment.includes('pcd') || primarySegment.includes('tea')) return 'PCD_TEA';
    if (primarySegment.includes('kids') || primarySegment.includes('criança')) return 'KIDS';
    return 'ADULTO';
  }

  if (p.includes('publicidade') || p.includes('permuta')) {
    return 'PUBLICIDADE';
  }
  if (p.includes('corporate') || p.includes('colaborador')) {
    return 'CORPORATE';
  }
  if (p.includes('student') || p.includes('estudante')) {
    return 'ESTUDANTE';
  }
  if (p.includes('professor') || p.includes('docente')) {
    return 'PROFESSOR';
  }
  if (p.includes('servidor') || p.includes('público') || p.includes('publico')) {
    return 'SERVIDOR';
  }
  if (p.includes('kids') || p.includes('criança') || p.includes('crianca')) {
    return 'KIDS';
  }
  if (
    p.includes('inclusão') ||
    p.includes('inclusao') ||
    p.includes('pcd') ||
    p.includes('pdc') ||
    p.includes('tea') ||
    p.includes('autism')
  ) {
    return 'PCD_TEA';
  }
  if (
    p.includes('vitalício') ||
    p.includes('vitalicio') ||
    p.includes('60+') ||
    p.includes('idoso')
  ) {
    return 'IDOSO_60';
  }
  if (p.includes('parceiro')) {
    return 'PARCEIRO';
  }
  if (
    p.includes('convênio') ||
    p.includes('convenio') ||
    p.includes('day use') ||
    p.includes('dayuse')
  ) {
    return 'CONVENIO_DAYUSE';
  }
  if (
    p.includes('sem plano') ||
    p === '- r$ 0,00' ||
    p.trim() === '- r$ 0,00'
  ) {
    return 'SEM_PLANO';
  }
  if (p.includes('lessa club') || p.includes('duo club') || p.includes('club')) {
    return 'ADULTO';
  }

  // Tenta encontrar por nome das modalidades cadastradas
  if (modalities && modalities.length > 0) {
    const directMatch = modalities.find(
      (m) =>
        m.name.toLowerCase() === p ||
        p.includes(m.name.toLowerCase()) ||
        m.code.toLowerCase() === p
    );
    if (directMatch) return directMatch.code;
  }

  return currentCode || 'ADULTO';
};

export const normalizeClubDatabaseState = (
  parsed: Partial<ClubDatabaseState>,
  fallbackState?: ClubDatabaseState
): ClubDatabaseState => {
  const mergedModalities = [...DEFAULT_CLUB_MODALITIES].map((def) => {
    const saved = parsed.modalities?.find((m) => m.code === def.code || m.id === def.id);
    if (!saved) return def;
    return {
      ...def,
      ...saved,
      frontCardUrl: isOutdatedCardUrl(saved.frontCardUrl) ? def.frontCardUrl : saved.frontCardUrl,
      dependentFrontCardUrl: isOutdatedCardUrl(saved.dependentFrontCardUrl)
        ? def.dependentFrontCardUrl
        : saved.dependentFrontCardUrl,
      backCardUrl: isOutdatedCardUrl(saved.backCardUrl) ? def.backCardUrl : saved.backCardUrl,
      dependentBackCardUrl: isOutdatedCardUrl(saved.dependentBackCardUrl)
        ? def.dependentBackCardUrl
        : saved.dependentBackCardUrl,
    };
  });

  const customModalities = (parsed.modalities || []).filter(
    (m) => !DEFAULT_CLUB_MODALITIES.some((def) => def.code === m.code || def.id === m.id)
  );

  const normalizedSubscriptions = (parsed.subscriptions || []).map((sub) => {
    const isLabcard = sub.origin === 'IMPORT_LABCARD' || sub.id.startsWith('sub-labcard-');
    const titularMem = (sub.members || []).find((x) => x.role === 'TITULAR') || sub.members?.[0];
    const isSubFamilyPub =
      sub.contractType === 'FAMILY_PUBLICIDADE' ||
      Boolean(sub.planSummaryLabel && /publicidade|permuta|family/i.test(sub.planSummaryLabel)) ||
      titularMem?.modalityCode === 'PUBLICIDADE' ||
      Boolean(titularMem?.modalityName && /publicidade|family/i.test(titularMem.modalityName));
    const titularModCode = isSubFamilyPub
      ? 'PUBLICIDADE'
      : (titularMem?.modalityCode && titularMem.modalityCode !== 'SEM_PLANO' ? titularMem.modalityCode : undefined);
    const titularModName = isSubFamilyPub
      ? (titularMem?.modalityName && !/^sem plano$/i.test(titularMem.modalityName.trim()) ? titularMem.modalityName : 'Lessa Family Publicidade')
      : (titularMem?.modalityName && !/^sem plano$/i.test(titularMem.modalityName.trim()) ? titularMem.modalityName : undefined);

    const normalizedMembers = (sub.members || []).map((origM) => {
      const m = { ...origM };
      let frontUrl = m.frontCardUrl;
      let backUrl = m.backCardUrl;

      // Dependentes sem plano próprio ("Sem Plano", "-", vazio) herdam automaticamente o plano e a arte do Titular
      const isMemberSemPlano =
        !m.modalityCode ||
        m.modalityCode === 'SEM_PLANO' ||
        !m.modalityName ||
        /^sem plano$/i.test(m.modalityName.trim()) ||
        m.modalityName.trim() === '-';

      if (m.role === 'DEPENDENTE' && isMemberSemPlano && titularModCode) {
        m.modalityCode = titularModCode;
        m.modalityName = titularModName || m.modalityName;
        m.planCycleLabel = titularModName || m.planCycleLabel;
        const matchedMod = DEFAULT_CLUB_MODALITIES.find((dm) => dm.code === titularModCode);
        if (titularModCode === 'PUBLICIDADE') {
          frontUrl = '/cards/30.png';
          backUrl = '/cards/33.png';
        } else if (matchedMod) {
          frontUrl = matchedMod.dependentFrontCardUrl || matchedMod.frontCardUrl;
          backUrl = matchedMod.dependentBackCardUrl || matchedMod.backCardUrl;
        } else if (titularMem) {
          frontUrl = titularMem.frontCardUrl;
          backUrl = titularMem.backCardUrl;
        }
      }

      if (m.modalityCode === 'ADULTO' && (isOutdatedCardUrl(frontUrl) || frontUrl === '/cards/18.png' || frontUrl === '/cards/17.png')) {
        frontUrl = '/cards/44.png';
      } else if (m.modalityCode === 'ESTUDANTE' && (isOutdatedCardUrl(frontUrl) || frontUrl === '/cards/7.png')) {
        frontUrl = '/cards/6.png';
      } else if (m.modalityCode === 'PROFESSOR' && (isOutdatedCardUrl(frontUrl) || frontUrl === '/cards/2.png')) {
        frontUrl = '/cards/3.png';
      } else if (m.modalityCode === 'SERVIDOR' && (isOutdatedCardUrl(frontUrl) || frontUrl === '/cards/9.png')) {
        frontUrl = '/cards/10.png';
      } else if (m.modalityCode === 'KIDS' && (isOutdatedCardUrl(frontUrl) || frontUrl === '/cards/37.png')) {
        frontUrl = '/cards/38.png';
      } else if (m.modalityCode === 'IDOSO_60' && (isOutdatedCardUrl(frontUrl) || frontUrl === '/cards/25.png')) {
        frontUrl = '/cards/26.png';
      } else if (m.modalityCode === 'PCD_TEA' && (isOutdatedCardUrl(frontUrl) || frontUrl === '/cards/34.png')) {
        frontUrl = '/cards/35.png';
      }

      // Sincroniza planos de Publicidade/Permuta que vieram originalmente identificados na descrição do plano
      if (
        (m.modalityCode === 'ADULTO' || m.modalityCode === 'SEM_PLANO' || !m.modalityCode) &&
        ((sub.planSummaryLabel && /publicidade|permuta/i.test(sub.planSummaryLabel)) ||
         (m.modalityName && /publicidade/i.test(m.modalityName)))
      ) {
        m.modalityCode = 'PUBLICIDADE';
        m.modalityName = 'Lessa Family Publicidade';
        m.planCycleLabel = 'Lessa Family Publicidade';
        frontUrl = m.role === 'DEPENDENTE' ? '/cards/30.png' : '/cards/29.png';
        backUrl = '/cards/33.png';
      } else if (m.modalityCode === 'PUBLICIDADE') {
        if (m.role === 'DEPENDENTE') {
          if (isOutdatedCardUrl(frontUrl) || frontUrl === '/cards/44.png' || frontUrl === '/cards/13.png' || frontUrl === '/cards/29.png') {
            frontUrl = '/cards/30.png';
          }
        } else {
          if (isOutdatedCardUrl(frontUrl) || frontUrl === '/cards/44.png' || frontUrl === '/cards/13.png') {
            frontUrl = '/cards/29.png';
          }
        }
        if (isOutdatedCardUrl(backUrl) || backUrl === '/cards/24.png') {
          backUrl = '/cards/33.png';
        }
      }

      if (m.modalityCode === 'KIDS' || m.modalityCode === 'IDOSO_60') {
        backUrl = '/cards/39.png';
      } else if (isOutdatedCardUrl(backUrl)) {
        backUrl = '/cards/24.png';
      }

      const adminConfirmedCards = getAdminConfirmedCardsSet();
      const isExplicitlyRegularized = isSubscriptionRegularizedOrActive(sub, adminConfirmedCards);

      const hasRealProofUploaded = memberHasProofUploaded(m, sub);
      const missingRequiredDoc =
        !isLabcard &&
        getPlanDocumentRule(m.modalityCode, m.modalityName).requiresDocument &&
        !hasRealProofUploaded;

      const isMemberRegularized =
        isExplicitlyRegularized ||
        REGULARIZED_ACTIVE_CARDS.has(m.cardNumber) ||
        adminConfirmedCards.has(m.cardNumber) ||
        (!isLabcard && m.status === 'ACTIVE' && (Boolean(m.manualStatusOverride) || (hasRealProofUploaded && (Boolean(m.documentVerified) || m.documentStatus === 'APROVADO'))));

      const isSubDirectlyInactive =
        sub.status === 'INACTIVE' || sub.status === 'SUSPENDED' || sub.status === 'CANCELLED' || Boolean(sub.inactivityReason);

      const isMemberDirectlyInactive =
        m.status === 'INACTIVE' || m.status === 'SUSPENDED' || m.status === 'CANCELLED' || Boolean(m.inactivityReason);

      const isMemberUserConfirmed =
        Boolean(m.manualStatusOverride) ||
        m.status === 'ACTIVE' ||
        isMemberRegularized;

      const resolvedStatus: SubscriptionStatus =
        isSubDirectlyInactive
          ? (sub.status === 'SUSPENDED' || sub.status === 'CANCELLED' ? (sub.status as SubscriptionStatus) : 'INACTIVE')
          : isMemberDirectlyInactive
          ? (m.status === 'SUSPENDED' || m.status === 'CANCELLED' ? m.status : 'INACTIVE')
          : isMemberUserConfirmed
          ? (m.status || 'ACTIVE')
          : isLabcard && !isMemberRegularized
          ? ('PENDING_TRANSFER' as SubscriptionStatus)
          : missingRequiredDoc && !isMemberRegularized
          ? 'INACTIVE'
          : isMemberRegularized
          ? (m.status && m.status !== 'PENDING_TRANSFER' ? m.status : 'ACTIVE')
          : m.status;

      // Para cadastros Kids: calcula automaticamente expiração no 12º aniversário da criança
      let resolvedExpDate = m.expirationDate;
      let resolvedExpNotes = m.expirationNotes;
      const isKids = m.modalityCode === 'KIDS' || (m.planCycleLabel || '').toLowerCase().includes('kids');
      if (isKids && m.birthDate) {
        const kids12Exp = calculateKidsExpirationDate(m.birthDate);
        if (kids12Exp) {
          resolvedExpDate = kids12Exp;
          resolvedExpNotes = resolvedExpNotes || 'Expira ao completar 12 anos (transição para plano pago)';
        }
      }

      // Nunca manter "documento aprovado" quando não existe nenhum anexo enviado para este integrante
      const cleanDocVerified = hasRealProofUploaded ? Boolean(m.documentVerified) : false;
      const cleanDocStatus = hasRealProofUploaded
        ? m.documentStatus
        : (m.documentStatus === 'APROVADO' ? undefined : m.documentStatus);

      return {
        ...m,
        expirationDate: resolvedExpDate,
        expirationNotes: resolvedExpNotes,
        status: resolvedStatus,
        documentVerified: cleanDocVerified,
        documentStatus: cleanDocStatus,
        inactivityReason: m.inactivityReason || sub.inactivityReason,
        inactivityNotes: m.inactivityNotes || sub.inactivityNotes,
        frontCardUrl: frontUrl || '/cards/44.png',
        backCardUrl: backUrl || '/cards/24.png',
      };
    });

    const adminConfirmedCardsSub = getAdminConfirmedCardsSet();
    const isSubExplicitlyRegularized = isSubscriptionRegularizedOrActive(sub, adminConfirmedCardsSub);

    const isSubDirectlyInactive =
      sub.status === 'INACTIVE' || sub.status === 'SUSPENDED' || sub.status === 'CANCELLED' || Boolean(sub.inactivityReason);

    const isSubUserConfirmed =
      sub.status === 'ACTIVE' ||
      isSubExplicitlyRegularized;

    const resolvedSubStatus: SubscriptionStatus =
      isSubDirectlyInactive
        ? (sub.status === 'SUSPENDED' || sub.status === 'CANCELLED' ? (sub.status as SubscriptionStatus) : 'INACTIVE')
        : sub.status === 'PENDING_TRANSFER' && !isSubExplicitlyRegularized
        ? ('PENDING_TRANSFER' as SubscriptionStatus)
        : isSubUserConfirmed
        ? (sub.status || 'ACTIVE')
        : isLabcard && !isSubExplicitlyRegularized
        ? ('PENDING_TRANSFER' as SubscriptionStatus)
        : normalizedMembers.length > 0 &&
          normalizedMembers.every((m) => m.status === 'INACTIVE') &&
          !isSubExplicitlyRegularized
        ? 'INACTIVE'
        : isSubExplicitlyRegularized
        ? (sub.status && sub.status !== 'PENDING_TRANSFER' ? sub.status : 'ACTIVE')
        : sub.status;

    const hasPublicidade =
      Boolean(sub.planSummaryLabel && /publicidade|permuta/i.test(sub.planSummaryLabel)) ||
      normalizedMembers.some((m) => m.modalityCode === 'PUBLICIDADE');

    return {
      ...sub,
      contractType: hasPublicidade ? 'FAMILY_PUBLICIDADE' : sub.contractType,
      status: resolvedSubStatus,
      inactivityReason: sub.inactivityReason,
      inactivityNotes: sub.inactivityNotes,
      transferCompleted: isSubDirectlyInactive ? Boolean(sub.transferCompleted) : isSubUserConfirmed ? (sub.transferCompleted ?? true) : isLabcard ? isSubExplicitlyRegularized : (sub.transferCompleted ?? false),
      manuallyConfirmedTransfer: isSubDirectlyInactive ? Boolean(sub.manuallyConfirmedTransfer) : isSubUserConfirmed ? (sub.manuallyConfirmedTransfer ?? true) : isLabcard ? (isSubExplicitlyRegularized && Boolean(sub.manuallyConfirmedTransfer)) : (sub.manuallyConfirmedTransfer ?? false),
      manualStatusOverride: isSubDirectlyInactive ? true : isSubUserConfirmed ? true : isLabcard ? (isSubExplicitlyRegularized || Boolean(sub.manualStatusOverride)) : (sub.manualStatusOverride ?? false),
      members: normalizedMembers,
      billingCycle:
        (sub.subscriptionCode === '121225890' || (sub.holderName && sub.holderName.toUpperCase().includes('JADIA')) ||
         sub.subscriptionCode === '1212252794' || (sub.holderName && sub.holderName.toUpperCase().includes('ANDRIRLEI')) ||
         sub.subscriptionCode === '1212252990' || (sub.holderName && sub.holderName.toUpperCase().includes('GISSEIA')) ||
         sub.subscriptionCode === '1212252991' || (sub.holderName && sub.holderName.toUpperCase().includes('EDER APARECIDO')))
          ? 'ANNUAL'
          : sub.billingCycle,
      totalContractValue:
        (sub.subscriptionCode === '121225890' || (sub.holderName && sub.holderName.toUpperCase().includes('JADIA')))
          ? 290
          : (sub.subscriptionCode === '1212252794' || (sub.holderName && sub.holderName.toUpperCase().includes('ANDRIRLEI')) ||
             sub.subscriptionCode === '1212252990' || (sub.holderName && sub.holderName.toUpperCase().includes('GISSEIA')) ||
             sub.subscriptionCode === '1212252991' || (sub.holderName && sub.holderName.toUpperCase().includes('EDER APARECIDO')))
          ? 270
          : sub.totalContractValue,
      monthlyEquivalent:
        (sub.subscriptionCode === '121225890' || (sub.holderName && sub.holderName.toUpperCase().includes('JADIA')) ||
         sub.subscriptionCode === '1212252794' || (sub.holderName && sub.holderName.toUpperCase().includes('ANDRIRLEI')))
          ? 0
          : (sub.subscriptionCode === '1212252990' || (sub.holderName && sub.holderName.toUpperCase().includes('GISSEIA')) ||
             sub.subscriptionCode === '1212252991' || (sub.holderName && sub.holderName.toUpperCase().includes('EDER APARECIDO')))
          ? 22.50
          : sub.monthlyEquivalent,
      validityLabel:
        (sub.subscriptionCode === '121225890' || (sub.holderName && sub.holderName.toUpperCase().includes('JADIA')))
          ? '06/2027'
          : (sub.subscriptionCode === '1212251327' || (sub.holderName && sub.holderName.toUpperCase().includes('ROKSIANE')))
          ? '04/2027'
          : (sub.subscriptionCode === '1212252794' || (sub.holderName && sub.holderName.toUpperCase().includes('ANDRIRLEI')))
          ? '06/2027'
          : sub.validityLabel,
      endDate:
        (sub.subscriptionCode === '121225890' || (sub.holderName && sub.holderName.toUpperCase().includes('JADIA')))
          ? '2027-06-02'
          : (sub.subscriptionCode === '1212251327' || (sub.holderName && sub.holderName.toUpperCase().includes('ROKSIANE')))
          ? '2027-04-04'
          : sub.endDate,
      planSummaryLabel:
        (sub.subscriptionCode === '121225890' || (sub.holderName && sub.holderName.toUpperCase().includes('JADIA')))
          ? 'Lessa Servidor Pass (Anual)'
          : (sub.subscriptionCode === '1212252794' || (sub.holderName && sub.holderName.toUpperCase().includes('ANDRIRLEI')))
          ? 'Lessa Professor Pass (Anual)'
          : sub.planSummaryLabel,
      invoices: (() => {
        let invList = Array.isArray(sub.invoices) ? sub.invoices : [];

        // ROKSIANE: Restringe EXATAMENTE e EXCLUSIVAMENTE às 12 parcelas oficiais do carnê de dia 05
        if (
          sub.subscriptionCode === '1212251327' ||
          sub.id === 'sub-labcard-1212251327' ||
          (sub.holderName && sub.holderName.toUpperCase().includes('ROKSIANE'))
        ) {
          const roksianeOfficial = [
            { num: 1, ref: '04/2026', due: '2026-04-05', paid: '2026-04-05T10:00:00.000Z', status: 'PAID' as const, asaasPaymentId: 'pay_hz5djn80hba948sk', invoiceUrl: 'https://www.asaas.com/i/hz5djn80hba948sk', boleto: '174117753578344269', val: 25 },
            { num: 2, ref: '05/2026', due: '2026-05-05', paid: '2026-05-04T10:00:00.000Z', status: 'PAID' as const, asaasPaymentId: 'pay_g546dzs3gxhmhv4m', invoiceUrl: 'https://www.asaas.com/i/g546dzs3gxhmhv4m', boleto: '775317753578353311', val: 25 },
            { num: 3, ref: '06/2026', due: '2026-06-05', paid: '2026-06-05T10:00:00.000Z', status: 'PAID' as const, asaasPaymentId: 'pay_qgqvwgeu8g0hmw68', invoiceUrl: 'https://www.asaas.com/i/qgqvwgeu8g0hmw68', boleto: '801617753578363467', val: 25 },
            { num: 4, ref: '07/2026', due: '2026-07-05', paid: '2026-07-04T10:00:00.000Z', status: 'PAID' as const, asaasPaymentId: 'pay_nzbkr1bbt34u577y', invoiceUrl: 'https://www.asaas.com/i/nzbkr1bbt34u577y', boleto: '711117753578375675', val: 25 },
            { num: 5, ref: '08/2026', due: '2026-08-05', paid: '2026-08-07T10:00:00.000Z', status: 'PAID' as const, asaasPaymentId: 'pay_curgpy4niw18wupt', invoiceUrl: 'https://www.asaas.com/i/curgpy4niw18wupt', boleto: '498617753578375459', val: 25 },
            { num: 6, ref: '09/2026', due: '2026-09-05', paid: '2026-09-09T10:00:00.000Z', status: 'PAID' as const, asaasPaymentId: 'pay_pl8i90vie04x13cs', invoiceUrl: 'https://www.asaas.com/i/pl8i90vie04x13cs', boleto: '142217753578385862', val: 25 },
            { num: 7, ref: '10/2026', due: '2026-10-05', paid: '2026-09-05T10:00:00.000Z', status: 'PAID' as const, asaasPaymentId: 'pay_upqf1o9jdgfetst0', invoiceUrl: 'https://www.asaas.com/i/upqf1o9jdgfetst0', boleto: '575417753578398258', val: 25 },
            { num: 8, ref: '11/2026', due: '2026-11-05', paid: '2026-11-18T18:48:59.000Z', status: 'PAID' as const, asaasPaymentId: 'pay_7076txoyg9fiaglx', invoiceUrl: 'https://www.asaas.com/i/7076txoyg9fiaglx', boleto: '456017753578399458', val: 25 },
            { num: 9, ref: '12/2026', due: '2026-12-05', paid: undefined, status: 'PENDING' as const, asaasPaymentId: 'pay_i2tq6l7wjouwdq3j', invoiceUrl: 'https://www.asaas.com/i/i2tq6l7wjouwdq3j', boleto: '555817753578406585', val: 25 },
            { num: 10, ref: '01/2027', due: '2027-01-05', paid: undefined, status: 'PENDING' as const, asaasPaymentId: 'pay_7w54b37lrvrhky11', invoiceUrl: 'https://www.asaas.com/i/7w54b37lrvrhky11', boleto: '463317753578411338', val: 30 },
            { num: 11, ref: '02/2027', due: '2027-02-05', paid: undefined, status: 'PENDING' as const, asaasPaymentId: 'pay_6mc9qczkr8nwlray', invoiceUrl: 'https://www.asaas.com/i/6mc9qczkr8nwlray', boleto: '292017753578413006', val: 30 },
            { num: 12, ref: '03/2027', due: '2027-03-05', paid: undefined, status: 'PENDING' as const, asaasPaymentId: 'pay_ygqondvffufxs5p2', invoiceUrl: 'https://www.asaas.com/i/ygqondvffufxs5p2', boleto: '783717753578427179', val: 30 },
          ];

          return roksianeOfficial.map((c) => ({
            id: `inv_asaas_roksiane_${c.num}`,
            subscriptionId: sub.id,
            subscriptionCode: '1212251327',
            holderName: sub.holderName,
            holderCpf: sub.holderCpf,
            installmentNumber: c.num,
            totalInstallments: 12,
            referenceMonth: c.ref,
            amount: c.val,
            dueDate: c.due,
            paidAt: c.paid,
            paymentMethod: 'PIX' as const,
            status: c.status,
            asaasPaymentId: c.asaasPaymentId,
            invoiceUrl: c.invoiceUrl,
            boletoNumber: c.boleto,
            description: `Lessa Servidor Pass (Mensal) - R$ ${c.val.toFixed(2).replace('.', ',')} (Mensalidade ${c.ref})`,
            invoiceKind: 'MENSALIDADE' as const,
            carneGroup: 1,
            createdAt: '2026-04-04T00:00:00.000Z',
          }));
        }

        // JADIA: Mantém as 4 parcelas do Carnê 1 e garante o Carnê 4 com a parcela anual de R$ 200 quitada à vista
        if (
          sub.subscriptionCode === '121225890' ||
          sub.id === 'sub-labcard-121225890' ||
          (sub.holderName && sub.holderName.toUpperCase().includes('JADIA'))
        ) {
          const carne1Invs = invList
            .filter((inv) => (inv.carneGroup === 1 || !inv.carneGroup) && (!inv.dueDate || inv.dueDate < '2026-05-01'))
            .map((inv, idx) => ({
              ...inv,
              carneGroup: 1,
              installmentNumber: inv.installmentNumber || idx + 1,
              totalInstallments: 4,
              status: 'PAID' as const,
            }));

          const carne4Inv: ClubInvoice = {
            id: 'inv_jadia_anual_carne4',
            subscriptionId: sub.id,
            subscriptionCode: '121225890',
            holderName: sub.holderName,
            holderCpf: sub.holderCpf,
            installmentNumber: 1,
            totalInstallments: 1,
            referenceMonth: '05/2026',
            amount: 290,
            dueDate: '2026-05-02',
            paidAt: '2026-05-02T10:00:00.000Z',
            paymentMethod: 'PIX',
            status: 'PAID',
            boletoNumber: '180417777559163668',
            description: 'Lessa Servidor Pass (anual) - R$ 290,00',
            invoiceKind: 'MENSALIDADE',
            carneGroup: 4,
            createdAt: '2026-05-02T10:00:00.000Z',
          };

          return [...carne1Invs, carne4Inv];
        }

        // ANDRIRLEI: Plano Anual quitado à vista (R$ 270,00)
        if (
          sub.subscriptionCode === '1212252794' ||
          sub.id === 'sub-labcard-1212252794' ||
          (sub.holderName && sub.holderName.toUpperCase().includes('ANDRIRLEI'))
        ) {
          return [
            {
              id: 'inv_asaas_andrirlei_anual',
              subscriptionId: sub.id,
              subscriptionCode: '1212252794',
              holderName: sub.holderName,
              holderCpf: sub.holderCpf,
              installmentNumber: 1,
              totalInstallments: 1,
              referenceMonth: '06/2026',
              amount: 270,
              dueDate: '2026-06-20',
              paidAt: '2026-06-20T10:00:00.000Z',
              paymentMethod: 'CREDIT_CARD',
              status: 'PAID',
              asaasPaymentId: 'pay_hs461vb73rrypazd',
              description: 'Lessa Professor Pass (Anual)',
              invoiceKind: 'MENSALIDADE',
              carneGroup: 1,
              createdAt: '2026-06-20T10:00:00.000Z',
            },
          ];
        }

        // GISSEIA & EDER: Expurgar boletos duplicados e manter as 12 parcelas de cartão confirmadas
        if (
          sub.subscriptionCode === '1212252990' || sub.subscriptionCode === '1212252991' ||
          (sub.holderName && (sub.holderName.toUpperCase().includes('GISSEIA') || sub.holderName.toUpperCase().includes('EDER APARECIDO')))
        ) {
          invList = invList.filter((inv) => {
            // Remove tentativas duplicadas de boletos com dia 14 que ficaram pendentes/atrasadas
            if (inv.dueDate && inv.dueDate.endsWith('-14') && inv.status !== 'PAID') return false;
            return true;
          });
        }

        // ATUALIZAÇÃO GERAL 2027: Ajusta parcelas de 2027 com os novos valores para todos os cadastros
        return invList.map((inv) => {
          if (inv.dueDate && inv.dueDate >= '2027-01-01' && sub.billingCycle !== 'ANNUAL') {
            const desc = (inv.description || '').toLowerCase();
            const planSumm = (sub.planSummaryLabel || '').toLowerCase();
            let newAmount = inv.amount;

            if (planSumm.includes('4 pessoas') || desc.includes('4 pessoas')) {
              newAmount = 239.60;
            } else if (planSumm.includes('3 pessoas') || desc.includes('3 pessoas') || inv.amount === 149.70) {
              newAmount = 179.70;
            } else if (planSumm.includes('2 pessoas') || desc.includes('2 pessoas') || inv.amount === 99.80) {
              newAmount = 119.80;
            } else if (planSumm.includes('servidor') || planSumm.includes('estudante') || planSumm.includes('professor') || inv.amount === 25) {
              newAmount = 30.00;
            } else if (planSumm.includes('lessa club') || inv.amount === 49.90) {
              newAmount = 59.90;
            }

            return {
              ...inv,
              amount: newAmount,
            };
          }
          return inv;
        });
      })(),
      attachments: Array.isArray(sub.attachments) ? sub.attachments : [],
      visits: Array.isArray(sub.visits) ? sub.visits : [],
      additionalServices: Array.isArray(sub.additionalServices) ? sub.additionalServices : [],
    };
  });

  // Mantém a integridade de todos os vínculos e dependentes definidos pelo administrador ou planilha
  const finalNormalizedSubscriptions = normalizedSubscriptions;

  const rawSiteTerms =
    parsed.siteTermsText && parsed.siteTermsText.length > 20
      ? parsed.siteTermsText
      : fallbackState?.siteTermsText && fallbackState.siteTermsText.length > 20
      ? fallbackState.siteTermsText
      : '';

  const normalizedSiteTerms = !rawSiteTerms
    ? DEFAULT_SITE_TERMS_TEXT
    : rawSiteTerms;

  // Quando `parsed.deletedSubscriptionIds` é informado (ex.: após merge/restauração da nuvem),
  // NÃO misturar de volta IDs obsoletos de `fallbackState.deletedSubscriptionIds`, senão cadastros
  // restaurados na nuvem ou pela Lixeira seriam re-excluídos pelo cache antigo do navegador!
  const mergedDeletedIds = Array.isArray(parsed.deletedSubscriptionIds)
    ? Array.from(new Set(parsed.deletedSubscriptionIds))
    : Array.isArray(fallbackState?.deletedSubscriptionIds)
    ? Array.from(new Set(fallbackState.deletedSubscriptionIds))
    : [];
  const deletedIdSet = new Set(mergedDeletedIds);

  return {
    modalities: [...mergedModalities, ...customModalities].map((m) => ({
      ...m,
      benefits: Array.isArray(m.benefits) ? m.benefits : [],
    })),
    subscriptions: finalNormalizedSubscriptions.filter((s) => !deletedIdSet.has(s.id)),
    deletedSubscriptionIds: mergedDeletedIds,
    consultants: parsed.consultants?.length ? parsed.consultants : fallbackState?.consultants || getInitialState().consultants,
    contractTemplates:
      parsed.contractTemplates && parsed.contractTemplates.length > 0
        ? parsed.contractTemplates
        : fallbackState?.contractTemplates && fallbackState.contractTemplates.length > 0
        ? fallbackState.contractTemplates
        : DEFAULT_CONTRACT_TEMPLATES,
    cashEntries: Array.isArray(parsed.cashEntries)
      ? parsed.cashEntries
      : fallbackState?.cashEntries || [],
    lastCardSequence: Math.max(parsed.lastCardSequence || 3000, fallbackState?.lastCardSequence || 3000),
    catalogServices:
      parsed.catalogServices && parsed.catalogServices.length > 0
        ? parsed.catalogServices
        : fallbackState?.catalogServices && fallbackState.catalogServices.length > 0
        ? fallbackState.catalogServices
        : DEFAULT_CATALOG_SERVICES,
    siteTermsText: normalizedSiteTerms,
    updatedAt: parsed.updatedAt || new Date().toISOString(),
  };
};

export const getClubStateSync = (): ClubDatabaseState => {
  if (memoryClubState) return memoryClubState;
  const loaded = loadClubStateLocal();
  memoryClubState = loaded;
  return loaded;
};

export const loadClubStateLocal = (): ClubDatabaseState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const init = getInitialState();
      memoryClubState = init;
      return init;
    }
    const parsed = JSON.parse(raw) as Partial<ClubDatabaseState>;
    const deletedSet = new Set(parsed.deletedSubscriptionIds || []);
    const defaultLabcardSubs = getLabcardSubscriptions();
    const subsMap = new Map<string, ClubSubscription>();
    defaultLabcardSubs.forEach((s) => {
      if (!deletedSet.has(s.id)) subsMap.set(s.id, s);
    });
    (parsed.subscriptions || []).forEach((s) => {
      if (!deletedSet.has(s.id)) {
        const seedSub = subsMap.get(s.id);
        if (seedSub) {
          // Restaura anexos e mídias íntegras do seed caso o cache local tenha sido truncado pela cota do localStorage
          s.attachments = mergeAttachmentsSafely(s.attachments, seedSub.attachments);
          if (seedSub.members && s.members) {
            const seedMemMap = new Map(seedSub.members.map((m) => [m.id, m]));
            s.members = s.members.map((m) => {
              const sm = seedMemMap.get(m.id) || seedSub.members.find((x) => x.cardNumber === m.cardNumber || x.cpf === m.cpf);
              return mergeMemberMediaSafely(m, sm);
            });
          }
          if (seedSub.members && seedSub.members.length > (s.members?.length || 0)) {
            // Restaura dependentes mapeados da família caso o cache local tenha ficado desatualizado
            const existingCards = new Set((s.members || []).map((m) => m.cardNumber));
            const missingDeps = seedSub.members.filter((m) => !existingCards.has(m.cardNumber));
            if (missingDeps.length > 0) {
              s.members = [...(s.members || []), ...missingDeps];
              if (seedSub.planSummaryLabel && (!s.planSummaryLabel || !s.planSummaryLabel.includes('pessoas'))) {
                s.planSummaryLabel = seedSub.planSummaryLabel;
              }
            }
          }
          if (seedSub.holderEmail && !s.holderEmail) s.holderEmail = seedSub.holderEmail;
          if (seedSub.addressCep && (!s.addressCep || s.addressCep === '76870-000')) s.addressCep = seedSub.addressCep;
          if (seedSub.addressStreet && !s.addressStreet) s.addressStreet = seedSub.addressStreet;
          if (seedSub.addressNeighborhood && !s.addressNeighborhood) s.addressNeighborhood = seedSub.addressNeighborhood;

          // Restaura carnê completo de mensalidades do seed (ex: 12 parcelas da Roksiane) caso o cache local tenha menos parcelas
          if (
            (seedSub.invoices?.length || 0) > (s.invoices?.length || 0) ||
            (seedSub.invoices && seedSub.invoices.some((i) => i.asaasPaymentId) && !s.invoices?.some((i) => i.asaasPaymentId))
          ) {
            const localInvMap = new Map((s.invoices || []).map((inv) => [inv.id, inv]));
            s.invoices = seedSub.invoices.map((sInv) => {
              const localInv = localInvMap.get(sInv.id);
              if (!localInv) return sInv;
              const merged = { ...sInv, ...localInv };
              if (sInv.status === 'PENDING') {
                merged.status = 'PENDING';
                merged.paidAt = undefined;
              }
              return merged;
            });
          }
        }
        subsMap.set(s.id, s);
      }
    });

    // Assegura que cadastros do Labcard não fiquem ativos em massa automaticamente,
    // mas PRESERVA INTEGRALMENTE decisões soberanas do admin (INATIVO, SUSPENSO, CANCELADO, override manual)
    const adminConfirmedCards = getAdminConfirmedCardsSet();
    subsMap.forEach((sub) => {
      if (sub.origin === 'IMPORT_LABCARD' || sub.id.startsWith('sub-labcard-')) {
        if (
          sub.status === 'INACTIVE' ||
          sub.status === 'SUSPENDED' ||
          sub.status === 'CANCELLED'
        ) {
          // Preserva o status INATIVO/SUSPENSO/CANCELADO e também respeita se o admin já marcou a transferência como concluída
          sub.transferCompleted = Boolean(sub.transferCompleted);
          sub.manuallyConfirmedTransfer = Boolean(sub.manuallyConfirmedTransfer);
          if (sub.members) {
            sub.members.forEach((m) => {
              if (m.status !== 'SUSPENDED' && m.status !== 'CANCELLED') {
                m.status = sub.status as SubscriptionStatus;
              }
            });
          }
          return;
        }

        const isSubUserConfirmed =
          sub.status === 'ACTIVE' &&
          (Boolean(sub.manualStatusOverride) ||
            Boolean(sub.manuallyConfirmedTransfer) ||
            Boolean(sub.transferCompleted));

        const isAlreadyRegularized = isSubUserConfirmed || isSubscriptionRegularizedOrActive(sub, adminConfirmedCards);

        if (!isAlreadyRegularized) {
          sub.transferCompleted = false;
          sub.manuallyConfirmedTransfer = false;
          sub.manualStatusOverride = false;
          sub.transferredAt = undefined;
          sub.status = 'PENDING_TRANSFER';
          if (sub.members) {
            sub.members.forEach((m) => {
              if (
                m.status !== 'INACTIVE' &&
                m.status !== 'SUSPENDED' &&
                m.status !== 'CANCELLED' &&
                m.status !== 'ACTIVE' &&
                !m.manualStatusOverride &&
                !REGULARIZED_ACTIVE_CARDS.has(m.cardNumber) &&
                !adminConfirmedCards.has(m.cardNumber)
              ) {
                m.status = 'PENDING_TRANSFER';
                m.manualStatusOverride = false;
              }
            });
          }
        } else {
          sub.transferCompleted = true;
          sub.manuallyConfirmedTransfer = true;
          sub.manualStatusOverride = true;
          sub.status = 'ACTIVE';
          if (sub.members) {
            sub.members.forEach((m) => {
              if (m.status !== 'INACTIVE' && m.status !== 'SUSPENDED' && m.status !== 'CANCELLED') {
                m.status = 'ACTIVE';
                m.manualStatusOverride = true;
              }
            });
          }
        }
      }
    });
    const normalized = normalizeClubDatabaseState({
      ...parsed,
      subscriptions: Array.from(subsMap.values()),
    });
    memoryClubState = normalized;
    return normalized;
  } catch (e) {
    console.error('[ClubService] Error reading local state:', e);
    const init = getInitialState();
    memoryClubState = init;
    return init;
  }
};

/**
 * Gera cópia enxuta do estado para gravação na nuvem:
 * omite os ~2.600 cadastros estáticos inalterados de `labcard-seed.ts` (que são
 * sempre mesclados no load) e remove `contractContentHtml` redundante, evitando
 * payloads multi-MB e erros de `TypeError: Failed to fetch` no browser.
 */
const isRawBase64DataUrl = (val?: string): boolean =>
  Boolean(val && val.startsWith('data:') && val.length > 500);

const buildCompactCloudState = (state: ClubDatabaseState): ClubDatabaseState => {
  const seedMap = getLabcardSeedMap();
  const compactSubs = state.subscriptions
    .filter((sub) => {
      if (!sub.id.startsWith('sub-labcard-')) return true;
      // Disjuntor anti-ativação em massa: NUNCA envia para a nuvem registros Labcard com data estática do seed (2026-11-10)
      // marcados como ACTIVE sem estarem na lista oficial REGULARIZED_ACTIVE_CARDS
      if (
        sub.status === 'ACTIVE' &&
        !REGULARIZED_ACTIVE_CARDS.has(sub.subscriptionCode) &&
        (!sub.updatedAt || sub.updatedAt <= '2026-11-10T00:00:00.000Z')
      ) {
        return false;
      }
      return isLabcardSubscriptionModified(sub, seedMap.get(sub.id));
    })
    .map((sub) => {
      let cleanSub = sub;
      if (cleanSub.contractContentHtml) {
        const { contractContentHtml: _omit, ...rest } = cleanSub;
        cleanSub = rest as ClubSubscription;
      }
      // JAMAIS apaga URLs permanentes do Supabase Storage (https://...); só compacta base64 gigante
      // caso ainda não tenha sido convertido (os arquivos já estão salvos em public.club_attachments / club-files)
      if (cleanSub.attachments && cleanSub.attachments.some((a) => isRawBase64DataUrl(a.dataUrl))) {
        cleanSub = {
          ...cleanSub,
          attachments: cleanSub.attachments.map((a) => ({
            ...a,
            dataUrl: isRawBase64DataUrl(a.dataUrl) ? '' : a.dataUrl,
          })),
        };
      }
      if (
        cleanSub.members &&
        cleanSub.members.some(
          (m) =>
            isRawBase64DataUrl(m.documentProofUrl) ||
            isRawBase64DataUrl(m.photoUrl) ||
            (m.attachments && m.attachments.some((a) => isRawBase64DataUrl(a.dataUrl)))
        )
      ) {
        cleanSub = {
          ...cleanSub,
          members: cleanSub.members.map((m) => ({
            ...m,
            documentProofUrl: isRawBase64DataUrl(m.documentProofUrl) ? '' : m.documentProofUrl,
            photoUrl: isRawBase64DataUrl(m.photoUrl) ? '' : m.photoUrl,
            attachments: (m.attachments || []).map((a) => ({
              ...a,
              dataUrl: isRawBase64DataUrl(a.dataUrl) ? '' : a.dataUrl,
            })),
          })),
        };
      }
      return cleanSub;
    });

  return {
    ...state,
    contractTemplates: (state.contractTemplates || []).map((ct) => ({
      ...ct,
      contentHtml: ct.contentHtml && ct.contentHtml.length > 500 ? ct.contentHtml.slice(0, 500) + '...' : ct.contentHtml,
    })),
    subscriptions: compactSubs,
  };
};

// Rastreia o último updatedAt sincronizado por assinatura na tabela `public.club_records`
const lastSyncedRecordTimestamps = new Map<string, string>();

const syncModifiedSubsToClubRecords = async (stateToSave: ClubDatabaseState): Promise<void> => {
  const modifiedSubs: ClubSubscription[] = [];
  for (const sub of stateToSave.subscriptions || []) {
    const code = String(sub.subscriptionCode || sub.id || '').trim();
    if (!code) continue;
    const prevTs = lastSyncedRecordTimestamps.get(code);
    const curTs = sub.updatedAt || '';
    // Se mudou desde o último sync (ou se nunca foi rastreado mas foi modificado recentemente)
    if (curTs && curTs !== prevTs && curTs > '2026-11-11T00:00:00.000Z') {
      // Só envia se foi alterado nesta sessão (prevTs definido) ou se o timestamp é dos últimos 10 minutos
      const ageMs = Date.now() - new Date(curTs).getTime();
      if (prevTs !== undefined || (Number.isFinite(ageMs) && ageMs < 10 * 60 * 1000)) {
        modifiedSubs.push(sub);
      }
    }
  }

  if (modifiedSubs.length === 0) return;

  // Grava cada cadastro modificado em sua própria linha independente em `public.club_records`
  // (e sobe anexos para Storage `club-files` + registra histórico automático em `public.club_record_history`)
  for (const sub of modifiedSubs) {
    const code = String(sub.subscriptionCode || sub.id || '').trim();
    const ok = await saveMemberPermanentDocs(code, sub, 'ADMIN_PANEL_SAVE');
    if (ok && sub.updatedAt) {
      lastSyncedRecordTimestamps.set(code, sub.updatedAt);
    }
  }
};

export type CloudSyncStatus = 'SYNCED' | 'SAVING' | 'ERROR';

let currentCloudSyncStatus: CloudSyncStatus = 'SYNCED';
let lastCloudSyncError: string | null = null;
let lastCloudSyncSuccessTime: string = new Date().toISOString();
const cloudSyncListeners = new Set<(status: CloudSyncStatus, error: string | null, lastSuccessAt: string) => void>();

export const getCloudSyncStatus = () => ({
  status: currentCloudSyncStatus,
  error: lastCloudSyncError,
  lastSuccessAt: lastCloudSyncSuccessTime,
});

export const subscribeToCloudSyncStatus = (
  listener: (status: CloudSyncStatus, error: string | null, lastSuccessAt: string) => void
): (() => void) => {
  cloudSyncListeners.add(listener);
  listener(currentCloudSyncStatus, lastCloudSyncError, lastCloudSyncSuccessTime);
  return () => {
    cloudSyncListeners.delete(listener);
  };
};

const notifyCloudSyncStatus = (status: CloudSyncStatus, error: string | null = null) => {
  currentCloudSyncStatus = status;
  lastCloudSyncError = error;
  if (status === 'SYNCED') {
    lastCloudSyncSuccessTime = new Date().toISOString();
  }
  cloudSyncListeners.forEach((l) => {
    try {
      l(currentCloudSyncStatus, lastCloudSyncError, lastCloudSyncSuccessTime);
    } catch {}
  });
};

let inFlightCloudSavePromise: Promise<any> | null = null;
let queuedCloudSaveState: ClubDatabaseState | null = null;
let cloudSaveDebounceTimer: any = null;

const runCloudSaveExecution = async (stateToSave: ClubDatabaseState): Promise<void> => {
  notifyCloudSyncStatus('SAVING', null);

  // 1. PERSISTENCIA ATOMICA POR LINHA EM `public.club_records` + STORAGE `club-files` + HISTORICO IMUTAVEL
  // Garante que cada cadastro alterado seja gravado individualmente sem risco de sobrescrita cruzada!
  try {
    await syncModifiedSubsToClubRecords(stateToSave);
  } catch (atomicErr) {
    console.warn('[ClubService] Aviso ao sincronizar linha individual em club_records:', atomicErr);
  }

  // 2. READ-MERGE-WRITE para o snapshot compatível `lessa_club_ecosystem_v1`:
  // Mescla os registros mais recentes de `public.club_records` para que outra aba nunca perca edições feitas em paralelo.
  let mergedForCloud = stateToSave;
  try {
    const latestRecords = await loadAllPermanentMemberDocs();
    if (latestRecords.size > 0) {
      const subById = new Map((stateToSave.subscriptions || []).map((s) => [s.id, s]));
      const subByCode = new Map(
        (stateToSave.subscriptions || [])
          .filter((s) => s.subscriptionCode)
          .map((s) => [s.subscriptionCode, s])
      );
      const deletedSet = new Set(stateToSave.deletedSubscriptionIds || []);

      latestRecords.forEach((rec, code) => {
        const recId = rec.id || `sub-labcard-${code}`;
        if (deletedSet.has(recId)) return;
        const existing = subByCode.get(code) || subById.get(recId);
        if (existing) {
          const safeMerged = applyPermanentDocsToSub(existing, rec);
          subById.set(safeMerged.id, safeMerged);
          if (safeMerged.subscriptionCode) subByCode.set(safeMerged.subscriptionCode, safeMerged);
        } else if (rec.id && rec.holderName) {
          subById.set(rec.id, rec as ClubSubscription);
        }
      });

      mergedForCloud = {
        ...stateToSave,
        subscriptions: Array.from(subById.values()),
      };
    }
  } catch (mergeErr) {
    console.warn('[ClubService] Aviso ao mesclar club_records antes do upsert legado:', mergeErr);
  }

  const cloudState = buildCompactCloudState(mergedForCloud);
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let timeoutTimer: any = null;
    try {
      const upsertPromise = supabase
        .from('site_settings' as any)
        .upsert(
          {
            key: SUPABASE_SETTINGS_KEY,
            value: cloudState,
            updated_at: stateToSave.updatedAt,
          },
          { onConflict: 'key' }
        );

      const timeoutPromise = new Promise<{ error: any }>((_, reject) => {
        timeoutTimer = setTimeout(() => {
          reject(new Error('Tempo limite de rede ao sincronizar com o banco de dados (15s)'));
        }, 15000);
      });

      const { error } = await Promise.race([upsertPromise, timeoutPromise]);
      if (timeoutTimer) clearTimeout(timeoutTimer);

      if (!error) {
        lastClubFetchErrorMessage = null;
        notifyCloudSyncStatus('SYNCED', null);
        return;
      }
      console.error('[ClubService] Erro ao sincronizar nuvem:', error);
      throw new Error(`Falha no banco: ${error.message}`);
    } catch (err: any) {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      const msg = String(err?.message || err || '');
      const isNetworkFailure =
        err instanceof TypeError ||
        /failed to fetch|networkerror|load failed|timeout|tempo limite|aborted/i.test(msg);

      if (isNetworkFailure && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        continue;
      }
      console.warn('[ClubService] Sincronização em nuvem falhou, preservado localmente:', err);
      notifyCloudSyncStatus('ERROR', msg);
      throw err;
    }
  }
};

const triggerCloudSaveNow = async (stateToSave: ClubDatabaseState): Promise<void> => {
  if (inFlightCloudSavePromise) {
    queuedCloudSaveState = stateToSave;
    try {
      await inFlightCloudSavePromise;
    } catch {}
    return;
  }

  const cloudPromise = runCloudSaveExecution(stateToSave)
    .catch((err) => {
      console.warn('[ClubService] Aviso na nuvem:', err);
    })
    .finally(() => {
      inFlightCloudSavePromise = null;
      if (queuedCloudSaveState) {
        const pending = queuedCloudSaveState;
        queuedCloudSaveState = null;
        triggerCloudSaveNow(pending);
      }
    });

  inFlightCloudSavePromise = cloudPromise;
  await cloudPromise;
};

export const saveClubState = async (
  state: ClubDatabaseState,
  options?: { waitForCloud?: boolean }
): Promise<ClubDatabaseState> => {
  const nextState: ClubDatabaseState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };

  // 1. Grava na memória e no cache local imediatamente (0-2ms)
  memoryClubState = nextState;
  tryPersistLocalState(nextState);

  // 2. Se for solicitado waitForCloud explícito, executa imediatamente sem debounce
  if (options?.waitForCloud) {
    if (cloudSaveDebounceTimer) {
      clearTimeout(cloudSaveDebounceTimer);
      cloudSaveDebounceTimer = null;
    }
    await triggerCloudSaveNow(nextState);
    return nextState;
  }

  // 3. Debounce inteligente de 1.500ms para alterações contínuas no painel:
  // Agrupa múltiplas edições de cadastros em uma única chamada leve no Supabase,
  // impedindo sobrecarga e status Unhealthy no banco PostgreSQL.
  notifyCloudSyncStatus('SAVING', null);
  queuedCloudSaveState = nextState;

  if (cloudSaveDebounceTimer) {
    clearTimeout(cloudSaveDebounceTimer);
  }

  cloudSaveDebounceTimer = setTimeout(() => {
    cloudSaveDebounceTimer = null;
    if (queuedCloudSaveState) {
      const stateToPush = queuedCloudSaveState;
      queuedCloudSaveState = null;
      triggerCloudSaveNow(stateToPush).catch(() => {});
    }
  }, 1500);

  return nextState;
};

let lastClubFetchErrorMessage: string | null = null;

export const getLastClubFetchError = (): string | null => lastClubFetchErrorMessage;

export const fetchClubState = async (options?: { timeoutMs?: number }): Promise<ClubDatabaseState> => {
  const local = memoryClubState || loadClubStateLocal();
  const adminConfirmedCards = getAdminConfirmedCardsSet();
  try {
    const idbState = await loadStateFromIndexedDB();
    if (idbState && idbState.subscriptions && idbState.subscriptions.length > 0) {
      const idbMap = new Map(idbState.subscriptions.map((s) => [s.id, s]));
      local.subscriptions.forEach((s) => {
        const full = idbMap.get(s.id);
        if (full) {
          // 1. Restaurar anexos gerais se o IndexedDB tiver anexos com mídia real ou mais anexos
          s.attachments = mergeAttachmentsSafely(s.attachments, full.attachments);

          // 2. Restaurar dependentes e integrantes mapeados
          if ((full.members?.length || 0) > (s.members?.length || 0)) {
            s.members = full.members;
          } else if (full.members && s.members) {
            const fullMemMap = new Map(full.members.map((m) => [m.id, m]));
            s.members = s.members.map((m) => {
              const fm =
                fullMemMap.get(m.id) ||
                full.members.find(
                  (x) => (x.cardNumber && x.cardNumber === m.cardNumber) || (x.cpf && x.cpf === m.cpf)
                );
              if (!fm) return m;
              const isMemActive =
                REGULARIZED_ACTIVE_CARDS.has(m.cardNumber) ||
                adminConfirmedCards.has(m.cardNumber);

              const isMemInactive =
                m.status === 'INACTIVE' ||
                m.status === 'SUSPENDED' ||
                m.status === 'CANCELLED' ||
                fm.status === 'INACTIVE' ||
                fm.status === 'SUSPENDED' ||
                fm.status === 'CANCELLED';

              const finalMemStatus = isMemInactive
                ? (m.status === 'INACTIVE' || m.status === 'SUSPENDED' || m.status === 'CANCELLED' ? m.status : fm.status)
                : isMemActive
                ? 'ACTIVE'
                : (s.origin === 'IMPORT_LABCARD' || s.id.startsWith('sub-labcard-'))
                ? 'PENDING_TRANSFER'
                : (m.status || fm.status || 'ACTIVE');

              const mergedMedia = mergeMemberMediaSafely(m, fm);

              return {
                ...mergedMedia,
                rg: fm.rg || m.rg,
                birthDate: fm.birthDate || m.birthDate,
                sex: fm.sex || m.sex,
                phone: fm.phone || m.phone,
                expirationDate: fm.expirationDate || m.expirationDate,
                validityLabel: fm.validityLabel || m.validityLabel,
                expirationNotes: fm.expirationNotes || m.expirationNotes,
                documentVerified: fm.documentVerified === true || m.documentVerified === true,
                documentStatus: fm.documentStatus === 'APROVADO' || m.documentStatus === 'APROVADO'
                  ? 'APROVADO'
                  : (fm.documentStatus || m.documentStatus),
                documentVerifiedAt: fm.documentVerifiedAt || m.documentVerifiedAt,
                documentVerifiedBy: fm.documentVerifiedBy || m.documentVerifiedBy,
                status: finalMemStatus,
                manualStatusOverride: isMemInactive || isMemActive,
              };
            });
          }

          // 3. Restaurar campos cadastrais salvos no IndexedDB (SOMENTE se houve edição real — NUNCA por CEP/endDate padrão do seed!)
          const isFullModified =
            Boolean(full.isModifiedFromSeed) ||
            Boolean(full.manuallyConfirmedTransfer) ||
            full.status === 'INACTIVE' ||
            full.status === 'CANCELLED' ||
            (full.status === 'ACTIVE' && Boolean(full.transferCompleted)) ||
            (Boolean(full.addressCep) && full.addressCep !== '76870-000') ||
            Boolean(full.addressStreet) ||
            (Boolean(full.endDate) && full.endDate !== '2027-10-31') ||
            (full.attachments?.length || 0) > 0;

          if (isFullModified) {
            if (full.status) s.status = full.status;
            if (full.inactivityReason) s.inactivityReason = full.inactivityReason;
            if (full.inactivityNotes) s.inactivityNotes = full.inactivityNotes;
            if (full.dueDay) s.dueDay = full.dueDay;
            if (full.manualStatusOverride !== undefined) s.manualStatusOverride = full.manualStatusOverride;
            if (full.transferredAt) s.transferredAt = full.transferredAt;
            if (full.transferCompleted !== undefined) s.transferCompleted = full.transferCompleted;
            if (full.manuallyConfirmedTransfer !== undefined) s.manuallyConfirmedTransfer = full.manuallyConfirmedTransfer;
            if (full.holderEmail) s.holderEmail = full.holderEmail;
            if (full.addressCep) s.addressCep = full.addressCep;
            if (full.addressStreet) s.addressStreet = full.addressStreet;
            if (full.addressNumber) s.addressNumber = full.addressNumber;
            if (full.addressComplement) s.addressComplement = full.addressComplement;
            if (full.addressNeighborhood) s.addressNeighborhood = full.addressNeighborhood;
            if (full.addressCity) s.addressCity = full.addressCity;
            if (full.addressState) s.addressState = full.addressState;
            if (full.vehicleModel) s.vehicleModel = full.vehicleModel;
            if (full.vehiclePlate) s.vehiclePlate = full.vehiclePlate;
            if (full.vehicleColor) s.vehicleColor = full.vehicleColor;
            if (full.holderRg) s.holderRg = full.holderRg;
            if (full.holderBirthDate) s.holderBirthDate = full.holderBirthDate;
            if (full.holderSex) s.holderSex = full.holderSex;
            if (full.holderMaritalStatus) s.holderMaritalStatus = full.holderMaritalStatus;
            if (full.holderPhone) s.holderPhone = full.holderPhone;
            if (full.consultantName) s.consultantName = full.consultantName;
            if (full.companyName) s.companyName = full.companyName;
            if (full.notes) s.notes = full.notes;
            if (full.planSummaryLabel) s.planSummaryLabel = full.planSummaryLabel;
            if (full.endDate) s.endDate = full.endDate;

            if (
              s.status === 'INACTIVE' ||
              s.status === 'SUSPENDED' ||
              s.status === 'CANCELLED' ||
              full.status === 'INACTIVE' ||
              full.status === 'SUSPENDED' ||
              full.status === 'CANCELLED'
            ) {
              // Status inativo/suspenso definido pelo administrador - preservar soberanamente junto com o estado de transferência
              s.status = full.status || s.status;
              s.manualStatusOverride = true;
              s.transferCompleted = Boolean(s.transferCompleted || full.transferCompleted);
              s.manuallyConfirmedTransfer = Boolean(s.manuallyConfirmedTransfer || full.manuallyConfirmedTransfer);
            } else {
              const isSubActiveConfirmed =
                s.status === 'ACTIVE' ||
                full.status === 'ACTIVE';

              const isAlreadyRegularized = isSubActiveConfirmed && isSubscriptionRegularizedOrActive(s, adminConfirmedCards);
              if (isAlreadyRegularized) {
                s.status = 'ACTIVE';
                s.manualStatusOverride = true;
                s.transferCompleted = true;
                s.manuallyConfirmedTransfer = true;
              } else if (s.origin === 'IMPORT_LABCARD' || s.id.startsWith('sub-labcard-')) {
                s.status = 'PENDING_TRANSFER';
                s.manualStatusOverride = false;
                s.transferCompleted = false;
                s.manuallyConfirmedTransfer = false;
                s.transferredAt = undefined;
              }
            }
            if (full.isModifiedFromSeed) s.isModifiedFromSeed = true;
          } else {
            if (full.addressCep && !s.addressCep) s.addressCep = full.addressCep;
            if (full.addressStreet && !s.addressStreet) s.addressStreet = full.addressStreet;
            if (full.addressNumber && !s.addressNumber) s.addressNumber = full.addressNumber;
            if (full.addressComplement && !s.addressComplement) s.addressComplement = full.addressComplement;
            if (full.addressNeighborhood && !s.addressNeighborhood) s.addressNeighborhood = full.addressNeighborhood;
            if (full.addressCity && !s.addressCity) s.addressCity = full.addressCity;
            if (full.addressState && !s.addressState) s.addressState = full.addressState;
            if (full.vehicleModel && !s.vehicleModel) s.vehicleModel = full.vehicleModel;
            if (full.vehiclePlate && !s.vehiclePlate) s.vehiclePlate = full.vehiclePlate;
            if (full.vehicleColor && !s.vehicleColor) s.vehicleColor = full.vehicleColor;
            if (full.holderRg && !s.holderRg) s.holderRg = full.holderRg;
            if (full.holderBirthDate && !s.holderBirthDate) s.holderBirthDate = full.holderBirthDate;
            if (full.holderSex && !s.holderSex) s.holderSex = full.holderSex;
            if (full.holderMaritalStatus && !s.holderMaritalStatus) s.holderMaritalStatus = full.holderMaritalStatus;
            if (full.holderPhone && !s.holderPhone) s.holderPhone = full.holderPhone;
            if (full.holderEmail && !s.holderEmail) s.holderEmail = full.holderEmail;
            if (full.consultantName && !s.consultantName) s.consultantName = full.consultantName;
            if (full.companyName && !s.companyName) s.companyName = full.companyName;
            if (full.notes && !s.notes) s.notes = full.notes;
            if (full.planSummaryLabel && !s.planSummaryLabel) s.planSummaryLabel = full.planSummaryLabel;
            if (full.isModifiedFromSeed) s.isModifiedFromSeed = true;
          }
        }
      });

      // 4. Restaurar assinaturas que estavam salvas no IndexedDB mas foram omitidas do localStorage por limite de cota
      const localIds = new Set(local.subscriptions.map((s) => s.id));
      idbState.subscriptions.forEach((idbSub) => {
        if (!localIds.has(idbSub.id)) {
          local.subscriptions.push(idbSub);
          localIds.add(idbSub.id);
        }
      });
    }
  } catch {}
  const timeoutMs = options?.timeoutMs ?? 25000;
  try {
    const queryPromise = supabase
      .from('site_settings' as any)
      .select('value, updated_at')
      .eq('key', SUPABASE_SETTINGS_KEY)
      .maybeSingle();

    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) => {
      setTimeout(() => {
        resolve({ data: null, error: new Error('Timeout ao sincronizar banco de dados') });
      }, timeoutMs);
    });

    const { data, error } = (await Promise.race([queryPromise, timeoutPromise])) as any;

    if (error) {
      lastClubFetchErrorMessage = error.message || 'Falha ao consultar servidor';
    } else if (!error && data && (data as any).value) {
      lastClubFetchErrorMessage = null;
      const remote = (data as any).value as Partial<ClubDatabaseState>;
      const remoteSubs = remote.subscriptions || [];
      const localSubs = local.subscriptions || [];
      const localStateTs = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
      const remoteJsonTs = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
      const remoteColTs = (data as any).updated_at ? new Date((data as any).updated_at).getTime() : 0;
      const remoteStateTs = Math.max(remoteJsonTs, remoteColTs);
      const remoteIsNewerOrEqual = remoteStateTs >= localStateTs;
      const remoteDeletedSet = new Set(remote.deletedSubscriptionIds || []);
      const activeRemoteIds = new Set(remoteSubs.map((s) => s.id));

      // Respeita SEMPRE restaurações e cadastros ativos na nuvem:
      // Se o servidor possui o cadastro ativo em `remoteSubs` e NÃO o marca em `remote.deletedSubscriptionIds`,
      // um `local.deletedSubscriptionIds` antigo do navegador NUNCA pode re-escondê-lo!
      const effectiveDeletedIds = remoteIsNewerOrEqual
        ? Array.from(remoteDeletedSet)
        : Array.from(
            new Set([
              ...(local.deletedSubscriptionIds || []),
              ...(remote.deletedSubscriptionIds || []).filter((id) => !localSubs.some((ls) => ls.id === id)),
            ])
          ).filter((id) => !(activeRemoteIds.has(id) && !remoteDeletedSet.has(id)));
      const deletedSet = new Set(effectiveDeletedIds);
      const defaultLabcardSubs = getLabcardSubscriptions();

      // Carrega ANTES do merge a tabela soberana `public.club_records` + `public.club_attachments`
      // para identificar com 100% de precisão quais registros Labcard foram realmente editados/ativados
      // e purgar qualquer ativação em massa contaminada (tanto em site_settings quanto no localStorage/IndexedDB).
      let permanentDocsMap = new Map<string, PermanentMemberDocRecord>();
      try {
        permanentDocsMap = await loadAllPermanentMemberDocs();
      } catch (permErr) {
        console.warn('[ClubService] Aviso ao carregar club_records/club_attachments:', permErr);
      }

      const permIdsSet = new Set<string>();
      const permCodesSet = new Set<string>();
      permanentDocsMap.forEach((rec, code) => {
        permCodesSet.add(code);
        if (rec.id) permIdsSet.add(rec.id);
        permIdsSet.add(`sub-labcard-${code}`);
      });

      const isBackedRealLabcard = (s: Partial<ClubSubscription>): boolean => {
        const code = String(s.subscriptionCode || '').trim();
        const id = String(s.id || '').trim();
        return (
          REGULARIZED_ACTIVE_CARDS.has(code) ||
          permCodesSet.has(code) ||
          permIdsSet.has(id)
        );
      };

      const remoteUnbackedActiveLabcardCount = remoteSubs.filter(
        (rs) =>
          (rs.origin === 'IMPORT_LABCARD' || rs.id.startsWith('sub-labcard-')) &&
          rs.status === 'ACTIVE' &&
          !isBackedRealLabcard(rs)
      ).length;
      const isRemoteMassPolluted = remoteUnbackedActiveLabcardCount > 25;

      const localUnbackedActiveLabcardCount = localSubs.filter(
        (ls) =>
          (ls.origin === 'IMPORT_LABCARD' || ls.id.startsWith('sub-labcard-')) &&
          ls.status === 'ACTIVE' &&
          !isBackedRealLabcard(ls)
      ).length;
      const isLocalMassPolluted = localUnbackedActiveLabcardCount > 25;

      // Unir assinaturas pelo ID preservando exclusões definitivas (`deletedSet`)
      const subsMap = new Map<string, ClubSubscription>();
      // 1. Base estática do seed
      defaultLabcardSubs.forEach((s) => {
        if (!deletedSet.has(s.id)) subsMap.set(s.id, s);
      });
      // 2. Base da nuvem (Supabase)
      remoteSubs.forEach((s) => {
        if (!deletedSet.has(s.id)) {
          const isLabcardSub = s.origin === 'IMPORT_LABCARD' || s.id.startsWith('sub-labcard-');
          // Se o registro Labcard NÃO está em club_records nem em REGULARIZED_ACTIVE_CARDS e veio marcado ACTIVE
          // com data estática do seed (2026-11-10) ou dentro de lote contaminado (>25), descarta a ativação indevida!
          if (
            isLabcardSub &&
            s.status === 'ACTIVE' &&
            !isBackedRealLabcard(s) &&
            (isRemoteMassPolluted || !s.updatedAt || s.updatedAt <= '2026-11-10T00:00:00.000Z')
          ) {
            return;
          }
          const seed = subsMap.get(s.id);
          if (seed) {
            // Se o seed contiver dados cadastrais (ex: email, endereço mapeado) e a nuvem estiver sem esses campos, preserva os dados do seed!
            if (seed.holderEmail && !s.holderEmail) s.holderEmail = seed.holderEmail;
            if (seed.addressCep && (!s.addressCep || s.addressCep === '76870-000')) s.addressCep = seed.addressCep;
            if (seed.addressStreet && !s.addressStreet) s.addressStreet = seed.addressStreet;
            if (seed.addressNumber && !s.addressNumber) s.addressNumber = seed.addressNumber;
            if (seed.addressNeighborhood && !s.addressNeighborhood) s.addressNeighborhood = seed.addressNeighborhood;
            if (seed.addressCity && !s.addressCity) s.addressCity = seed.addressCity;
            if (seed.addressState && !s.addressState) s.addressState = seed.addressState;

            // Se o seed foi corrigido ou possui plano real/faturas e a nuvem ainda tinha '- R$ 0,00' ou 0 faturas (ex: Damiane 1212253016):
            if (seed.subscriptionCode === '1212253016' || (!s.planSummaryLabel || s.planSummaryLabel === '- R$ 0,00' || s.planSummaryLabel === '-')) {
              s.planSummaryLabel = seed.planSummaryLabel;
              s.monthlyEquivalent = seed.monthlyEquivalent;
              s.totalContractValue = seed.totalContractValue;
              s.dueDay = seed.dueDay;
              if (seed.status === 'ACTIVE') {
                s.status = 'ACTIVE';
                s.transferCompleted = true;
                s.manuallyConfirmedTransfer = true;
              }
            }
            if ((seed.invoices?.length || 0) > (s.invoices?.length || 0)) {
              s.invoices = seed.invoices;
            }
            if (seed.subscriptionCode === '1212253016') {
              s.members = seed.members;
            }
          }
          subsMap.set(s.id, s);
        }
      });

      // 3. Base local do navegador: preserva qualquer alteração manual genuína mais recente que a nuvem,
      // mas NUNCA deixa um cache local contaminado ou mais antigo re-ativar cadastros do Labcard em massa!
      localSubs.forEach((s) => {
        if (!deletedSet.has(s.id)) {
          const isLabcardSub = s.origin === 'IMPORT_LABCARD' || s.id.startsWith('sub-labcard-');
          if (isLabcardSub && (isLocalMassPolluted || isRemoteMassPolluted)) {
            return;
          }
          const isLabcardSeedOnly = isLabcardSub && !isBackedRealLabcard(s) && !activeRemoteIds.has(s.id);
          if (isLabcardSeedOnly && remoteIsNewerOrEqual) {
            return;
          }

          const current = subsMap.get(s.id);
          if (!current) {
            subsMap.set(s.id, s);
          } else {
            const localTime = s.updatedAt ? new Date(s.updatedAt).getTime() : 0;
            const remoteTime = current.updatedAt ? new Date(current.updatedAt).getTime() : 0;
            // Se o local for estritamente mais recente (e não estiver contaminado por ativação em massa), prevalece o local; caso contrário, a nuvem é a fonte da verdade
            if (localTime > remoteTime && !isLocalMassPolluted) {
              if (current.members && current.members.length > (s.members?.length || 0)) {
                // Restaura dependentes mapeados da família caso o cache local tenha ficado com menos integrantes
                const existingCards = new Set((s.members || []).map((m) => m.cardNumber));
                const missingDeps = current.members.filter((m) => !existingCards.has(m.cardNumber));
                if (missingDeps.length > 0) {
                  s.members = [...(s.members || []), ...missingDeps];
                  if (current.planSummaryLabel && (!s.planSummaryLabel || !s.planSummaryLabel.includes('pessoas'))) {
                    s.planSummaryLabel = current.planSummaryLabel;
                  }
                }
              }
              // Preserva anexos e mídias íntegras da nuvem de forma segura
              s.attachments = mergeAttachmentsSafely(s.attachments, current.attachments);
              if (current.members && s.members) {
                const curMemMap = new Map(current.members.map((m) => [m.id, m]));
                s.members = s.members.map((m) => {
                  const cm = curMemMap.get(m.id) || current.members.find((x) => (x.cardNumber && x.cardNumber === m.cardNumber) || (x.cpf && x.cpf === m.cpf));
                  return mergeMemberMediaSafely(m, cm);
                });
              }
              // Preserva faturas emitidas e sincronizadas no Asaas na nuvem ou no seed
              const seedSubForInv = defaultLabcardSubs.find((x) => x.id === s.id);
              const fullInvoicesSource =
                ((seedSubForInv?.invoices?.length || 0) > (s.invoices?.length || 0))
                  ? seedSubForInv?.invoices
                  : ((current.invoices?.length || 0) > (s.invoices?.length || 0))
                  ? current.invoices
                  : (seedSubForInv?.invoices && seedSubForInv.invoices.some((i) => i.asaasPaymentId) && (!s.invoices || !s.invoices.some((i) => i.asaasPaymentId)))
                  ? seedSubForInv.invoices
                  : (current.invoices && current.invoices.some((i) => i.asaasPaymentId))
                  ? current.invoices
                  : null;

              if (fullInvoicesSource) {
                const localInvMap = new Map((s.invoices || []).map((inv) => [inv.id, inv]));
                const remoteInvMap = new Map((current.invoices || []).map((inv) => [inv.id, inv]));
                s.invoices = fullInvoicesSource.map((fInv) => {
                  const lInv = localInvMap.get(fInv.id);
                  const rInv = remoteInvMap.get(fInv.id);
                  const merged = { ...fInv, ...(lInv || {}), ...(rInv || {}) };
                  // Fidelidade com Asaas e Nuvem: se nuvem ou seed oficial definem PENDING, é PENDING e sem data de pagamento!
                  if (rInv?.status === 'PENDING' || fInv.status === 'PENDING') {
                    merged.status = 'PENDING';
                    merged.paidAt = undefined;
                  }
                  if (rInv?.amount) merged.amount = rInv.amount;
                  if (rInv?.dueDate) merged.dueDate = rInv.dueDate;
                  if (rInv?.asaasPaymentId) merged.asaasPaymentId = rInv.asaasPaymentId;
                  return merged;
                });
              } else if (current.invoices && current.invoices.some((i) => i.asaasPaymentId)) {
                const remoteInvMap = new Map(current.invoices.map((inv) => [inv.id, inv]));
                s.invoices = (s.invoices || []).map((localInv) => {
                  const rInv = remoteInvMap.get(localInv.id);
                  if (rInv && rInv.asaasPaymentId) {
                    const finalStatus = rInv.status || localInv.status;
                    return {
                      ...localInv,
                      dueDate: rInv.dueDate || localInv.dueDate,
                      asaasPaymentId: rInv.asaasPaymentId,
                      invoiceUrl: rInv.invoiceUrl || localInv.invoiceUrl,
                      pixPayload: rInv.pixPayload || localInv.pixPayload,
                      pixQrCode: rInv.pixQrCode || localInv.pixQrCode,
                      status: finalStatus,
                      paidAt: finalStatus === 'PENDING' ? undefined : (rInv.paidAt || localInv.paidAt),
                      amount: rInv.amount || localInv.amount,
                    };
                  }
                  return localInv;
                });
                if (s.invoices.length < current.invoices.length || !s.invoices.some((i) => i.asaasPaymentId)) {
                  s.invoices = current.invoices;
                }
              }
              subsMap.set(s.id, s);
            } else {
              // Remote (nuvem) é mais recente ou igual: a nuvem é a base soberana (especialmente para status e transferCompleted!).
              // Apenas preenche eventuais campos cadastrais em branco a partir do cache local, sem sobrescrever status da nuvem.
              const isLocalUserModified =
                !isLocalMassPolluted &&
                !remoteIsNewerOrEqual &&
                (Boolean(s.isModifiedFromSeed) || Boolean(s.manualStatusOverride));
              if (isLocalUserModified) {
                if (s.holderEmail) current.holderEmail = s.holderEmail;
                if (s.addressCep && s.addressCep !== '76870-000') current.addressCep = s.addressCep;
                if (s.addressStreet) current.addressStreet = s.addressStreet;
                if (s.addressNumber) current.addressNumber = s.addressNumber;
                if (s.addressComplement) current.addressComplement = s.addressComplement;
                if (s.addressNeighborhood) current.addressNeighborhood = s.addressNeighborhood;
                if (s.addressCity) current.addressCity = s.addressCity;
                if (s.addressState) current.addressState = s.addressState;
                if (s.holderRg) current.holderRg = s.holderRg;
                if (s.holderBirthDate) current.holderBirthDate = s.holderBirthDate;
                if (s.holderSex) current.holderSex = s.holderSex;
                if (s.holderMaritalStatus) current.holderMaritalStatus = s.holderMaritalStatus;
                if (s.holderPhone) current.holderPhone = s.holderPhone;
                if (s.consultantName) current.consultantName = s.consultantName;
                if (s.vehiclePlate) current.vehiclePlate = s.vehiclePlate;
                if (s.vehicleModel) current.vehicleModel = s.vehicleModel;
                if (s.vehicleColor) current.vehicleColor = s.vehicleColor;
                if (s.notes) current.notes = s.notes;
                if (s.endDate && s.endDate !== '2027-10-31') current.endDate = s.endDate;
                if (s.validityLabel) current.validityLabel = s.validityLabel;
                if (s.dueDay) current.dueDay = s.dueDay;
                if (s.billingCycle) current.billingCycle = s.billingCycle;
                if (s.monthlyEquivalent !== undefined) current.monthlyEquivalent = s.monthlyEquivalent;
                if (s.totalContractValue !== undefined) current.totalContractValue = s.totalContractValue;
                if (s.planSummaryLabel) current.planSummaryLabel = s.planSummaryLabel;
                current.isModifiedFromSeed = true;
              } else {
                if (s.holderEmail && !current.holderEmail) current.holderEmail = s.holderEmail;
                if (s.addressCep && (!current.addressCep || current.addressCep === '76870-000')) current.addressCep = s.addressCep;
                if (s.addressStreet && !current.addressStreet) current.addressStreet = s.addressStreet;
                if (s.addressNumber && !current.addressNumber) current.addressNumber = s.addressNumber;
                if (s.addressComplement && !current.addressComplement) current.addressComplement = s.addressComplement;
                if (s.addressNeighborhood && !current.addressNeighborhood) current.addressNeighborhood = s.addressNeighborhood;
                if (s.addressCity && !current.addressCity) current.addressCity = s.addressCity;
                if (s.addressState && !current.addressState) current.addressState = s.addressState;
                if (s.holderRg && !current.holderRg) current.holderRg = s.holderRg;
                if (s.holderBirthDate && !current.holderBirthDate) current.holderBirthDate = s.holderBirthDate;
                if (s.holderSex && !current.holderSex) current.holderSex = s.holderSex;
                if (s.holderMaritalStatus && !current.holderMaritalStatus) current.holderMaritalStatus = s.holderMaritalStatus;
                if (s.holderPhone && !current.holderPhone) current.holderPhone = s.holderPhone;
                if (s.consultantName && !current.consultantName) current.consultantName = s.consultantName;
                if (s.vehiclePlate && !current.vehiclePlate) current.vehiclePlate = s.vehiclePlate;
                if (s.vehicleModel && !current.vehicleModel) current.vehicleModel = s.vehicleModel;
                if (s.vehicleColor && !current.vehicleColor) current.vehicleColor = s.vehicleColor;
                if (s.notes && (!current.notes || current.notes.startsWith('Cadastrado por'))) current.notes = s.notes;
                if (s.endDate && (!current.endDate || current.endDate === '2027-10-31')) current.endDate = s.endDate;
                if (s.validityLabel && !current.validityLabel) current.validityLabel = s.validityLabel;
                if (s.inactivityReason && !current.inactivityReason) current.inactivityReason = s.inactivityReason;
                if (s.inactivityNotes && !current.inactivityNotes) current.inactivityNotes = s.inactivityNotes;
              }

              const seedSub = defaultLabcardSubs.find((x) => x.id === s.id);
              if (seedSub?.holderEmail && !current.holderEmail) current.holderEmail = seedSub.holderEmail;
              if (seedSub?.addressCep && (!current.addressCep || current.addressCep === '76870-000')) current.addressCep = seedSub.addressCep;
              if (seedSub?.addressStreet && !current.addressStreet) current.addressStreet = seedSub.addressStreet;
              if (seedSub?.addressNeighborhood && !current.addressNeighborhood) current.addressNeighborhood = seedSub.addressNeighborhood;

              const isCurrentDirectlyInactive =
                current.status === 'INACTIVE' ||
                current.status === 'SUSPENDED' ||
                current.status === 'CANCELLED';

              const isLocalDirectlyInactive =
                s.status === 'INACTIVE' ||
                s.status === 'SUSPENDED' ||
                s.status === 'CANCELLED';

              if (isCurrentDirectlyInactive || isLocalDirectlyInactive) {
                // Status inativo/suspenso/cancelado definido pelo admin - prevalece sobre pendente, preservando transferência concluída
                current.status = isCurrentDirectlyInactive ? current.status : s.status;
                current.manualStatusOverride = true;
                current.inactivityReason = current.inactivityReason || s.inactivityReason;
                current.inactivityNotes = current.inactivityNotes || s.inactivityNotes;
                current.transferCompleted = Boolean(current.transferCompleted || s.transferCompleted);
                current.manuallyConfirmedTransfer = Boolean(current.manuallyConfirmedTransfer || s.manuallyConfirmedTransfer);
              } else {
                const isSubActiveConfirmed =
                  current.status === 'ACTIVE' ||
                  (s.status === 'ACTIVE' && !isLocalMassPolluted);

                const isAlreadyRegularizedCur = isSubActiveConfirmed && isSubscriptionRegularizedOrActive(current, adminConfirmedCards);
                if (isAlreadyRegularizedCur) {
                  current.status = 'ACTIVE';
                  current.manualStatusOverride = true;
                  current.transferCompleted = true;
                  current.manuallyConfirmedTransfer = true;
                } else if (current.origin === 'IMPORT_LABCARD' || current.id.startsWith('sub-labcard-')) {
                  current.status = 'PENDING_TRANSFER';
                  current.manualStatusOverride = false;
                  current.transferCompleted = false;
                  current.manuallyConfirmedTransfer = false;
                  current.transferredAt = undefined;
                }
              }
              current.attachments = mergeAttachmentsSafely(current.attachments, s.attachments);
              if ((s.attachments?.length || 0) > 0 && (!current.attachments || current.attachments.length === 0)) {
                current.attachments = s.attachments;
              }
              if (s.members && current.members) {
                const localMemMap = new Map(s.members.map((m) => [m.id, m]));
                current.members = current.members.map((cm) => {
                  const lm =
                    localMemMap.get(cm.id) ||
                    s.members.find((x) => (x.cardNumber && x.cardNumber === cm.cardNumber) || (x.cpf && x.cpf === cm.cpf));
                  if (!lm) return cm;

                  const isMemExplicitlyActive =
                    REGULARIZED_ACTIVE_CARDS.has(cm.cardNumber) ||
                    adminConfirmedCards.has(cm.cardNumber);

                  const isMemUserActive =
                    cm.status === 'ACTIVE' ||
                    lm.status === 'ACTIVE' ||
                    Boolean(cm.manualStatusOverride) ||
                    Boolean(lm.manualStatusOverride);

                  const isMemInactive =
                    cm.status === 'INACTIVE' ||
                    cm.status === 'SUSPENDED' ||
                    cm.status === 'CANCELLED' ||
                    lm.status === 'INACTIVE' ||
                    lm.status === 'SUSPENDED' ||
                    lm.status === 'CANCELLED';

                  const finalMemStatus = isMemInactive
                    ? (cm.status === 'INACTIVE' || cm.status === 'SUSPENDED' || cm.status === 'CANCELLED' ? cm.status : lm.status)
                    : (isMemExplicitlyActive || isMemUserActive)
                    ? 'ACTIVE'
                    : (current.origin === 'IMPORT_LABCARD' || current.id.startsWith('sub-labcard-'))
                    ? 'PENDING_TRANSFER'
                    : (cm.status || lm.status || 'ACTIVE');

                  const mergedMedia = mergeMemberMediaSafely(cm, lm);

                  // Preserva a data de expiração personalizada pelo admin, evitando regressão para a data antiga
                  const effExp =
                    (lm.expirationDate && lm.expirationDate !== '2026-12-31' && lm.expirationDate !== '2027-10-31')
                      ? lm.expirationDate
                      : (cm.expirationDate && cm.expirationDate !== '2026-12-31' && cm.expirationDate !== '2027-10-31')
                      ? cm.expirationDate
                      : (lm.expirationDate || cm.expirationDate || mergedMedia.expirationDate);

                  const effVal =
                    (lm.validityLabel && lm.validityLabel !== '12/2026' && lm.validityLabel !== '10/2027')
                      ? lm.validityLabel
                      : (cm.validityLabel && cm.validityLabel !== '12/2026' && cm.validityLabel !== '10/2027')
                      ? cm.validityLabel
                      : (lm.validityLabel || cm.validityLabel || mergedMedia.validityLabel);

                  const hasRealDocMerged = memberHasProofUploaded(mergedMedia, current);
                  const isDocActuallyApproved =
                    hasRealDocMerged &&
                    (mergedMedia.documentVerified === true ||
                      cm.documentVerified === true ||
                      lm.documentVerified === true ||
                      mergedMedia.documentStatus === 'APROVADO' ||
                      cm.documentStatus === 'APROVADO' ||
                      lm.documentStatus === 'APROVADO');

                  return {
                    ...mergedMedia,
                    status: finalMemStatus,
                    manualStatusOverride: isMemInactive || isMemExplicitlyActive || isMemUserActive,
                    documentVerified: isDocActuallyApproved,
                    documentStatus: isDocActuallyApproved
                      ? ('APROVADO' as const)
                      : hasRealDocMerged
                      ? (mergedMedia.documentStatus || cm.documentStatus || lm.documentStatus)
                      : undefined,
                    documentVerifiedAt: isDocActuallyApproved ? (cm.documentVerifiedAt || lm.documentVerifiedAt || mergedMedia.documentVerifiedAt) : undefined,
                    documentVerifiedBy: isDocActuallyApproved ? (cm.documentVerifiedBy || lm.documentVerifiedBy || mergedMedia.documentVerifiedBy) : undefined,
                    expirationDate: effExp,
                    validityLabel: effVal,
                  };
                });
                if (s.members.length > current.members.length) {
                  const currentCards = new Set(current.members.map((m) => m.cardNumber));
                  const missingFromCurrent = s.members.filter((m) => !currentCards.has(m.cardNumber));
                  current.members = [...current.members, ...missingFromCurrent];
                }
              }

              // Preserva o carnê completo de parcelas caso o seed ou local possua mais faturas que o remoto (ex: 12 parcelas da Roksiane)
              const seedSubForInv = defaultLabcardSubs.find((x) => x.id === current.id);
              const fullInvoicesSource = ((seedSubForInv?.invoices?.length || 0) > (current.invoices?.length || 0))
                ? seedSubForInv?.invoices
                : ((s.invoices?.length || 0) > (current.invoices?.length || 0))
                ? s.invoices
                : null;
              if (fullInvoicesSource) {
                const curInvMap = new Map((current.invoices || []).map((inv) => [inv.id, inv]));
                current.invoices = fullInvoicesSource.map((sInv) => {
                  const cInv = curInvMap.get(sInv.id);
                  return cInv ? { ...sInv, ...cInv } : sInv;
                });
              }

              if (isLocalUserModified) {
                current.isModifiedFromSeed = true;
              }
              subsMap.set(current.id, current);
            }
          }
        }
      });

      // Preservar pendente p/ transferência na base importada do Labcard enquanto a transferência não for concluída,
      // mas NUNCA sobrescreve cadastros definidos como INATIVOS, SUSPENSOS ou CANCELADOS
      subsMap.forEach((sub) => {
        if (sub.origin === 'IMPORT_LABCARD' || sub.id.startsWith('sub-labcard-')) {
          if (
            sub.status === 'INACTIVE' ||
            sub.status === 'SUSPENDED' ||
            sub.status === 'CANCELLED'
          ) {
            sub.transferCompleted = Boolean(sub.transferCompleted);
            sub.manuallyConfirmedTransfer = Boolean(sub.manuallyConfirmedTransfer);
            if (sub.members) {
              sub.members.forEach((m) => {
                if (m.status !== 'SUSPENDED' && m.status !== 'CANCELLED') {
                  m.status = sub.status as SubscriptionStatus;
                }
              });
            }
            return;
          }

          const isExplicitlyRegularized = isSubscriptionRegularizedOrActive(sub, adminConfirmedCards);

          if (!isExplicitlyRegularized) {
            sub.transferCompleted = false;
            sub.manuallyConfirmedTransfer = false;
            sub.manualStatusOverride = false;
            sub.transferredAt = undefined;
            sub.status = 'PENDING_TRANSFER';
            if (sub.members) {
              sub.members.forEach((m) => {
                if (
                  m.status !== 'INACTIVE' &&
                  m.status !== 'SUSPENDED' &&
                  m.status !== 'CANCELLED' &&
                  !REGULARIZED_ACTIVE_CARDS.has(m.cardNumber) &&
                  !adminConfirmedCards.has(m.cardNumber)
                ) {
                  m.status = 'PENDING_TRANSFER';
                  m.manualStatusOverride = false;
                }
              });
            }
          } else {
            sub.transferCompleted = true;
            sub.manuallyConfirmedTransfer = true;
            sub.manualStatusOverride = true;
            if (sub.status !== 'SUSPENDED' && sub.status !== 'CANCELLED' && sub.status !== 'INACTIVE') {
              sub.status = 'ACTIVE';
            }
            if (sub.members) {
              sub.members.forEach((m) => {
                if (m.status !== 'INACTIVE' && m.status !== 'SUSPENDED' && m.status !== 'CANCELLED') {
                  m.status = 'ACTIVE';
                  m.manualStatusOverride = true;
                }
              });
            }
          }
        }
      });

      // 4. FONTE DA VERDADE SOBERANA: aplica todas as linhas individuais da tabela `public.club_records`
      // + todos os anexos reais em `public.club_attachments` / Storage `club-files` + IndexedDB.
      // Garante que NENHUM dado cadastral ou anexo seja perdido por sobrescritas de abas ou webhooks!
      try {
        if (permanentDocsMap.size > 0) {
          permanentDocsMap.forEach((permRec, code) => {
            const recId = permRec.id || `sub-labcard-${code}`;
            if (remoteDeletedSet.has(recId) || remoteDeletedSet.has(`sub-labcard-${code}`)) return;
            deletedSet.delete(recId);
            deletedSet.delete(`sub-labcard-${code}`);
            const sub =
              subsMap.get(recId) ||
              subsMap.get(`sub-labcard-${code}`) ||
              Array.from(subsMap.values()).find(
                (x) =>
                  x.subscriptionCode === code ||
                  (x.members && x.members.some((m) => m.cardNumber === code)) ||
                  (x.holderCpf && permRec.holderCpf && x.holderCpf === permRec.holderCpf)
              );
            if (sub) {
              const shieldedSub = applyPermanentDocsToSub(sub, permRec);
              // Se houve contaminação em massa no cache local ou remoto, o status de `club_records` prevalece soberanamente!
              if ((isLocalMassPolluted || isRemoteMassPolluted) && permRec.status) {
                shieldedSub.status = permRec.status;
                shieldedSub.inactivityReason = permRec.inactivityReason;
                shieldedSub.inactivityReasons = permRec.inactivityReasons;
                shieldedSub.inactivityNotes = permRec.inactivityNotes;
                shieldedSub.transferCompleted = permRec.transferCompleted;
                shieldedSub.manuallyConfirmedTransfer = permRec.manuallyConfirmedTransfer;
                shieldedSub.manualStatusOverride = permRec.manualStatusOverride;
              }
              subsMap.set(shieldedSub.id, shieldedSub);
            } else if (permRec.id && permRec.holderName && Array.isArray(permRec.members)) {
              // Restaura cadastro novo salvo em `club_records` mesmo que tenha sido omitido do snapshot legado
              subsMap.set(permRec.id, permRec as ClubSubscription);
            }
          });
        }
      } catch (permErr) {
        console.warn('[ClubService] Aviso ao aplicar club_records/club_attachments:', permErr);
      }

      const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
      const remoteTime = remoteStateTs;
      const isLocalNewer = localTime > remoteTime;
      const finalDeletedIds = Array.from(deletedSet);

      const mergedState: Partial<ClubDatabaseState> = {
        ...(isLocalNewer ? remote : {}),
        ...(isLocalNewer ? local : remote),
        updatedAt: new Date(Math.max(localTime, remoteTime, Date.now())).toISOString(),
        subscriptions: Array.from(subsMap.values()),
        deletedSubscriptionIds: finalDeletedIds,
        lastCardSequence: Math.max(remote.lastCardSequence || 3015, local.lastCardSequence || 3015, 3015),
        modalities: (isLocalNewer ? local.modalities : remote.modalities) || remote.modalities || local.modalities,
        contractTemplates: (isLocalNewer ? local.contractTemplates : remote.contractTemplates) || remote.contractTemplates || local.contractTemplates,
        siteTermsText: (isLocalNewer ? local.siteTermsText : remote.siteTermsText) || remote.siteTermsText || local.siteTermsText,
        catalogServices: (isLocalNewer ? local.catalogServices : remote.catalogServices) || remote.catalogServices || local.catalogServices,
        consultants: (isLocalNewer ? local.consultants : remote.consultants) || remote.consultants || local.consultants,
      };

      const normalized = normalizeClubDatabaseState(mergedState, local);
      // Registra baseline de timestamps sincronizados para detectar com precisão edições futuras
      (normalized.subscriptions || []).forEach((s) => {
        const code = String(s.subscriptionCode || s.id || '').trim();
        if (code && s.updatedAt) {
          lastSyncedRecordTimestamps.set(code, s.updatedAt);
        }
      });
      memoryClubState = normalized;
      tryPersistLocalState(normalized);
      ensureDailyBackup(normalized).catch(() => {});
      return normalized;
    }
  } catch (err) {
    console.warn('[ClubService] Fallback to local state:', err);
  }
  return local;
};

// ============================================================================
// CRIAÇÃO DE NOVA ASSINATURA PERSONALIZADA (TITULAR + DEPENDENTES + FATURAS)
// ============================================================================
export interface CreateSubscriptionMemberInput {
  role: 'TITULAR' | 'DEPENDENTE';
  modalityCode: string;
  fullName: string;
  cpf: string;
  rg?: string;
  birthDate?: string;
  sex?: string;
  phone?: string;
  photoUrl?: string;
  documentProofUrl?: string;
  documentProofName?: string;
  kinship?: string;
  attachments?: ClubAttachment[];
}

export interface CreateSubscriptionInput {
  personType?: 'PF' | 'PJ';
  holderName: string;
  holderCpf: string;
  holderRg?: string;
  holderBirthDate?: string;
  holderSex?: string;
  holderMaritalStatus?: string;
  holderPhone: string;
  holderEmail?: string;
  addressCep?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  billingCycle: BillingCycle;
  paymentMethod: ClubPaymentMethod;
  installments?: number;
  dueDay?: number;
  status?: SubscriptionStatus;
  origin?: 'SITE' | 'ADMIN' | 'IMPORT_LABCARD';
  consultantName?: string;
  consultantCode?: string;
  consultantId?: string;
  influencerName?: string;
  vehicleModel?: string;
  vehicleBrand?: string;
  vehiclePlate?: string;
  vehicleColor?: string;
  vehicleStickerPhotoUrl?: string;
  vehicleStickerPhotoName?: string;
  vehicleStickerStatus?: 'PENDENTE' | 'APROVADO' | 'REJEITADO';
  notes?: string;
  contractType?: ContractTemplateType;
  attachments?: ClubAttachment[];
  members: CreateSubscriptionMemberInput[];
}

export const createClubSubscription = async (
  input: CreateSubscriptionInput
): Promise<{ subscription: ClubSubscription; firstInvoice?: ClubInvoice }> => {
  const state = await fetchClubState();

  // Validação: Não permitir duplicidade de CPF para quem já possui assinatura ATIVA como titular
  const cleanHolderCpf = cleanDigits(input.holderCpf);
  if (cleanHolderCpf && cleanHolderCpf.length === 11) {
    const deletedSet = new Set(state.deletedSubscriptionIds || []);
    
    // Verifica se já existe uma assinatura ATIVA onde o usuário já é o titular pagante
    const existingActiveTitularSub = state.subscriptions.find((s) => {
      if (deletedSet.has(s.id) || s.status === 'CANCELLED') return false;
      // Não bloqueia transferências pendentes importadas do Labcard sem confirmação oficial
      if (s.status === 'PENDING_TRANSFER' || (!s.transferCompleted && (s.origin === 'IMPORT_LABCARD' || s.id.startsWith('sub-labcard-')))) {
        return false;
      }
      return cleanDigits(s.holderCpf) === cleanHolderCpf && s.status === 'ACTIVE';
    });

    if (existingActiveTitularSub) {
      throw new Error(
        `Este CPF (${formatCpf(input.holderCpf)}) já possui uma assinatura ATIVA no Lessa Club (Cartão #${existingActiveTitularSub.subscriptionCode}). Para gerenciar dependentes, faturas ou carteirinhas, acesse o Portal do Sócio.`
      );
    }

    // Se o CPF existia como dependente em cadastros legados ou pendentes de transferência, desvincula o dependente antigo
    state.subscriptions.forEach((s) => {
      if (s.members && s.members.some((m) => m.role === 'DEPENDENTE' && cleanDigits(m.cpf) === cleanHolderCpf)) {
        s.members = s.members.filter((m) => !(m.role === 'DEPENDENTE' && cleanDigits(m.cpf) === cleanHolderCpf));
        s.updatedAt = new Date().toISOString();
      }
    });
  }

  // Calcula a sequência REAL máxima entre state, assinaturas, membros e public.club_records
  // para impedir 100% qualquer colisão de código de carteirinha (ex: dois clientes com 1212253016)
  let seq = Number(state.lastCardSequence || 3015);
  const bumpSeqFromCode = (code?: string | null) => {
    const m = String(code || '').match(/^121225(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n < 90000 && n > seq) seq = n;
    }
  };
  for (const existingSub of state.subscriptions || []) {
    bumpSeqFromCode(existingSub.subscriptionCode);
    for (const mem of existingSub.members || []) {
      bumpSeqFromCode(mem.cardNumber);
    }
  }
  try {
    const { data: latestCodes } = await (supabase.from as any)('club_records')
      .select('subscription_code');
    if (Array.isArray(latestCodes)) {
      for (const row of latestCodes) {
        bumpSeqFromCode(row?.subscription_code);
      }
    }
  } catch (seqErr) {
    console.warn('[ClubService] Aviso ao consultar última sequência em club_records:', seqErr);
  }

  const now = new Date();
  const startDate = now.toISOString().split('T')[0];
  const endDateObj = new Date(now);
  if (input.contractType === 'FAMILY_PUBLICIDADE') {
    endDateObj.setMonth(endDateObj.getMonth() + 6);
  } else {
    endDateObj.setFullYear(endDateObj.getFullYear() + 1);
  }
  const endDate = endDateObj.toISOString().split('T')[0];
  const validityLabel = `${String(endDateObj.getMonth() + 1).padStart(2, '0')}/${endDateObj.getFullYear()}`;

  const subscriptionId = crypto.randomUUID ? crypto.randomUUID() : `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  seq += 1;
  const holderCardNumber = `121225${String(seq).padStart(4, '0')}`;

  // Monta todos os membros com suas respectivas carteirinhas e preços
  let monthlyEquivalent = 0;
  let totalContractValue = 0;
  const cycleSuffix = input.billingCycle === 'ANNUAL' ? '(Anual)' : '(Mensal)';

  const builtMembers: ClubMember[] = input.members.map((m, idx) => {
    const mod =
      state.modalities.find((item) => item.code === m.modalityCode) ||
      DEFAULT_CLUB_MODALITIES[0];

    const isHolder = idx === 0 || m.role === 'TITULAR';
    const memberCardNum = isHolder ? holderCardNumber : `121225${String(++seq).padStart(4, '0')}`;
    const memberMonthly =
      input.billingCycle === 'ANNUAL' ? mod.annualInstallment : mod.monthlyPrice;
    const memberContractTotal =
      input.billingCycle === 'ANNUAL' ? mod.annualPrice : mod.monthlyPrice * 12;

    monthlyEquivalent += memberMonthly;
    totalContractValue += memberContractTotal;

    const frontUrl =
      !isHolder && mod.dependentFrontCardUrl ? mod.dependentFrontCardUrl : mod.frontCardUrl;
    const backUrl =
      !isHolder && mod.dependentBackCardUrl ? mod.dependentBackCardUrl : mod.backCardUrl;

    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `mem-${Date.now()}-${idx}`,
      subscriptionId,
      role: isHolder ? 'TITULAR' : 'DEPENDENTE',
      modalityCode: mod.code,
      modalityName: mod.name,
      planCycleLabel: mod.isFreeTier ? mod.name : `${mod.name} ${cycleSuffix}`,
      fullName: m.fullName.trim().toUpperCase(),
      cpf: formatCpf(m.cpf || input.holderCpf),
      rg: m.rg || (isHolder ? input.holderRg : ''),
      birthDate: m.birthDate || (isHolder ? input.holderBirthDate : ''),
      sex: m.sex || (isHolder ? input.holderSex : ''),
      phone: m.phone || input.holderPhone,
      photoUrl: m.photoUrl || '',
      documentProofUrl: m.documentProofUrl || '',
      documentProofName: m.documentProofName || '',
      attachments:
        m.attachments ||
        (m.documentProofUrl
          ? [
              {
                id: `att_${Date.now()}_${idx}`,
                name: m.documentProofName || 'Documento Comprobatório',
                dataUrl: m.documentProofUrl,
                mimeType: m.documentProofUrl.startsWith('data:image/')
                  ? 'image/jpeg'
                  : 'application/pdf',
                createdAt: now.toISOString(),
              },
            ]
          : []),
      cardNumber: memberCardNumberFormat(memberCardNum),
      holderCardNumber,
      qrToken: memberCardNum,
      frontCardUrl: frontUrl,
      backCardUrl: backUrl,
      validityLabel,
      expirationDate:
        mod.code === 'KIDS' && (m.birthDate || (isHolder ? input.holderBirthDate : ''))
          ? calculateKidsExpirationDate(m.birthDate || (isHolder ? input.holderBirthDate : ''))
          : undefined,
      expirationNotes:
        mod.code === 'KIDS'
          ? 'Expira ao completar 12 anos (transição para plano pago)'
          : undefined,
      kinship: m.kinship || (isHolder ? 'Titular' : undefined),
      documentStatus: m.documentProofUrl ? 'EM_ANALISE' : 'PENDENTE_ANEXO',
      monthlyValue: Number(memberMonthly.toFixed(2)),
      status: input.status || (monthlyEquivalent === 0 ? 'ACTIVE' : 'PENDING'),
      createdAt: now.toISOString(),
    };
  });

  // Resumo inteligente da composição familiar
  const countsByModality: Record<string, number> = {};
  builtMembers.forEach((m) => {
    countsByModality[m.modalityName] = (countsByModality[m.modalityName] || 0) + 1;
  });
  const summaryParts = Object.entries(countsByModality).map(([name, count]) => `${count}x ${name}`);
  const planSummaryLabel =
    builtMembers.length === 1
      ? `${builtMembers[0].planCycleLabel}`
      : `Família Personalizado ${cycleSuffix}: ${summaryParts.join(' + ')}`;

  // Geração das Faturas / Cobranças conforme regras do Plano Anual vs Plano Mensal
  const invoices: ClubInvoice[] = [];
  const isFree = monthlyEquivalent === 0 || input.paymentMethod === 'COURTESY';

  // Regra RÍGIDA do Plano Anual vs Plano Mensal:
  // - Plano Anual + PIX: 1 cobrança INTEGRAL à vista (valor total de 1 ano — JAMAIS parcelado em 12x no PIX)
  // - Plano Anual + Cartão de Débito: 1 cobrança INTEGRAL à vista (valor total de 1 ano)
  // - Plano Anual + Cartão de Crédito: 1 cobrança contratual INTEGRAL (valor total de 1 ano) dividida em 1x até 12x EXCLUSIVAMENTE no Cartão de Crédito (garantia total no limite do cartão)
  // - Plano Mensal (PIX, Cartão de Crédito ou Cartão de Débito): 12 cobranças mensais recorrentes
  const isAnnualUpfrontFull =
    !isFree &&
    input.billingCycle === 'ANNUAL' &&
    (input.paymentMethod === 'PIX' || input.paymentMethod === 'DEBIT_CARD');

  const isAnnualCreditCardIntegral =
    !isFree &&
    input.billingCycle === 'ANNUAL' &&
    !isAnnualUpfrontFull;

  const chosenAnnualInstallments = isAnnualUpfrontFull
    ? 1
    : Math.max(1, Math.min(12, input.installments || 12));

  // No Plano Anual (PIX, Débito ou Cartão de Crédito), gera SEMPRE 1 fatura contratual INTEGRAL
  // (para Cartão de Crédito, o parcelamento de 1x..12x é enviado direto ao Asaas com billingType='CREDIT_CARD' e totalValue integral!)
  // Isso torna matematicamente impossível alguém pagar apenas 1/12 via PIX com desconto anual.
  const installmentsCount = isFree
    ? 1
    : input.billingCycle === 'ANNUAL'
    ? 1
    : 12;

  const annualCreditInstallmentValue =
    isAnnualCreditCardIntegral && chosenAnnualInstallments > 0
      ? Number((totalContractValue / chosenAnnualInstallments).toFixed(2))
      : Number(monthlyEquivalent.toFixed(2));

  // Tabela de valores vigentes a partir de 01/01/2027 para planos mensais recorrentes:
  // - Meia-entrada (Estudante, Professor, Servidor): R$ 25,00 -> R$ 30,00
  // - Adulto Integral: R$ 49,90 -> R$ 59,90
  // - Múltiplos integrantes: soma proporcional (ex: 2 adultos = 119,80, 3 adultos = 179,70, 4 adultos = 239,60)
  // - Gratuitos (Kids, 60+, PCD/TEA, Cortesia): R$ 0,00
  let monthlyEquivalent2027 = 0;
  for (const m of input.members) {
    const mod =
      state.modalities.find((item) => item.code === m.modalityCode) ||
      DEFAULT_CLUB_MODALITIES[0];
    if (mod.isFreeTier || mod.monthlyPrice === 0) {
      monthlyEquivalent2027 += 0;
    } else if (
      mod.code === 'ESTUDANTE' ||
      mod.code === 'PROFESSOR' ||
      mod.code === 'SERVIDOR' ||
      Math.abs(mod.monthlyPrice - 25.0) < 0.01
    ) {
      monthlyEquivalent2027 += 30.0;
    } else if (mod.code === 'ADULTO' || Math.abs(mod.monthlyPrice - 49.9) < 0.01) {
      monthlyEquivalent2027 += 59.9;
    } else {
      // Demais planos mensais pagos recebem reajuste proporcional de +R$ 10,00 por membro
      monthlyEquivalent2027 += mod.monthlyPrice + 10.0;
    }
  }

  for (let i = 1; i <= installmentsCount; i++) {
    const dueObj = new Date(now);
    if (i > 1) {
      dueObj.setMonth(dueObj.getMonth() + (i - 1));
      if (input.dueDay) {
        dueObj.setDate(Math.min(input.dueDay, 28));
      }
    }
    const dueStr = dueObj.toISOString().split('T')[0];
    const refMonth = `${String(dueObj.getMonth() + 1).padStart(2, '0')}/${dueObj.getFullYear()}`;
    const isYear2027OrLater = dueObj.getFullYear() >= 2027;

    const invoiceAmount = isFree
      ? 0
      : input.billingCycle === 'ANNUAL'
      ? Number(totalContractValue.toFixed(2))
      : isYear2027OrLater
      ? Number(monthlyEquivalent2027.toFixed(2))
      : Number(monthlyEquivalent.toFixed(2));

    const descriptionLabel = isFree
      ? `Isenção / Gratuidade - ${planSummaryLabel}`
      : isAnnualUpfrontFull
      ? `Pagamento Anual Integral à Vista (${input.paymentMethod === 'DEBIT_CARD' ? 'Cartão de Débito' : 'PIX'}) - ${planSummaryLabel}`
      : isAnnualCreditCardIntegral
      ? `Plano Anual Integral (${chosenAnnualInstallments}x de R$ ${annualCreditInstallmentValue.toFixed(2).replace('.', ',')} no Cartão de Crédito) - ${planSummaryLabel}`
      : isYear2027OrLater
      ? `Mensalidade Recorrente ${i}/12 (Tabela 2027) - ${planSummaryLabel}`
      : `Mensalidade Recorrente ${i}/12 - ${planSummaryLabel}`;

    invoices.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `inv-${Date.now()}-${i}`,
      subscriptionId,
      subscriptionCode: holderCardNumber,
      holderName: input.holderName.trim().toUpperCase(),
      holderCpf: formatCpf(input.holderCpf),
      holderPhone: formatPhone(input.holderPhone),
      installmentNumber: i,
      totalInstallments: isAnnualCreditCardIntegral ? chosenAnnualInstallments : installmentsCount,
      referenceMonth: refMonth,
      amount: invoiceAmount,
      dueDate: dueStr,
      paidAt:
        isFree || (input.status === 'ACTIVE' && i === 1 && input.origin === 'ADMIN')
          ? now.toISOString()
          : undefined,
      paymentMethod: input.paymentMethod,
      status:
        isFree || (input.status === 'ACTIVE' && i === 1 && input.origin === 'ADMIN')
          ? 'PAID'
          : 'PENDING',
      description: descriptionLabel,
      createdAt: now.toISOString(),
    });
  }

  const isSemPlano = builtMembers[0]?.modalityCode === 'SEM_PLANO';
  const isFreePlan = monthlyEquivalent === 0 || input.paymentMethod === 'COURTESY';
  const baseStatus: SubscriptionStatus = isSemPlano
    ? 'INACTIVE'
    : input.status || (isFreePlan ? 'ACTIVE' : 'INACTIVE');

  // Sincroniza status individual dos membros:
  // Planos que exigem comprovação ficam INATIVOS por integrante enquanto faltar o documento anexado.
  builtMembers.forEach((m) => {
    const needsDoc = isMemberBlockedForMissingDoc(m);
    if (isSemPlano || m.modalityCode === 'SEM_PLANO' || needsDoc) {
      m.status = 'INACTIVE';
    } else {
      m.status = baseStatus;
    }
  });

  const hasPublicidade =
    Boolean(planSummaryLabel && /publicidade|permuta/i.test(planSummaryLabel)) ||
    builtMembers.some((m) => m.modalityCode === 'PUBLICIDADE') ||
    input.contractType === 'FAMILY_PUBLICIDADE';

  const isFamilyPublicidade =
    hasPublicidade ||
    input.contractType === 'FAMILY_PUBLICIDADE' ||
    Boolean(input.vehicleStickerPhotoUrl);

  const familyMissingSticker = isFamilyPublicidade && !input.vehicleStickerPhotoUrl;
  const familyMissingDepDoc =
    isFamilyPublicidade &&
    builtMembers
      .filter((m) => m.role === 'DEPENDENTE')
      .some(
        (m) =>
          !m.documentProofUrl &&
          (!m.attachments || m.attachments.length === 0)
      );

  const shouldHoldForFamilyValidation =
    isFamilyPublicidade && (familyMissingSticker || familyMissingDepDoc || input.origin === 'SITE');

  const finalStatus: SubscriptionStatus = shouldHoldForFamilyValidation
    ? 'PENDING'
    : builtMembers.length > 0 && builtMembers.every((m) => m.status === 'INACTIVE')
    ? 'INACTIVE'
    : builtMembers[0]?.status === 'INACTIVE' && isFreePlan
    ? 'INACTIVE'
    : baseStatus;

  const contractType: ContractTemplateType =
    input.contractType || (hasPublicidade ? 'FAMILY_PUBLICIDADE' : 'ADESAO_PF');

  const matchedCons =
    input.consultantId || input.consultantCode || input.consultantName || input.influencerName
      ? (state.consultants || []).find(
          (c) =>
            (input.consultantId && c.id === input.consultantId) ||
            (input.consultantCode && c.referralCode.toLowerCase() === input.consultantCode.trim().toLowerCase()) ||
            (input.consultantName && c.name.toLowerCase() === input.consultantName.trim().toLowerCase()) ||
            (input.influencerName && c.name.toLowerCase() === input.influencerName.trim().toLowerCase())
        )
      : undefined;

  const resolvedConsName = input.consultantName || (matchedCons?.role === 'CONSULTOR' ? matchedCons.name : '') || '';
  const resolvedInfName = input.influencerName || (matchedCons?.role === 'INFLUENCER' ? matchedCons.name : '') || '';

  const subscription: ClubSubscription = {
    id: subscriptionId,
    subscriptionCode: holderCardNumber,
    personType: input.personType || 'PF',
    holderName: input.holderName.trim().toUpperCase(),
    holderCpf: formatCpf(input.holderCpf),
    holderRg: input.holderRg || '',
    holderBirthDate: input.holderBirthDate || '',
    holderSex: input.holderSex || '',
    holderMaritalStatus: input.holderMaritalStatus || '',
    holderPhone: formatPhone(input.holderPhone),
    holderEmail: input.holderEmail || '',
    addressCep: input.addressCep || '',
    addressStreet: input.addressStreet || '',
    addressNumber: input.addressNumber || '',
    addressComplement: input.addressComplement || '',
    addressNeighborhood: input.addressNeighborhood || '',
    addressCity: input.addressCity || 'Ariquemes',
    addressState: input.addressState || 'RO',
    billingCycle: input.billingCycle,
    paymentMethod: input.paymentMethod,
    installments: isAnnualCreditCardIntegral ? chosenAnnualInstallments : invoices.length,
    monthlyEquivalent: Number(monthlyEquivalent.toFixed(2)),
    totalContractValue: Number(totalContractValue.toFixed(2)),
    dueDay: input.dueDay || now.getDate(),
    status: finalStatus,
    inactivityReason: shouldHoldForFamilyValidation ? 'FALTA_DOCUMENTOS' : undefined,
    inactivityNotes: shouldHoldForFamilyValidation
      ? 'Aguardando validação dos documentos dos dependentes (RG com foto) e foto do carro adesivado pela administração'
      : undefined,
    origin: input.origin || 'SITE',
    consultantId: input.consultantId || matchedCons?.id || '',
    consultantCode: input.consultantCode || matchedCons?.referralCode || '',
    consultantName: resolvedConsName || matchedCons?.name || '',
    influencerName: resolvedInfName,
    planSummaryLabel,
    vehicleModel: input.vehicleModel || '',
    vehicleBrand: input.vehicleBrand || '',
    vehiclePlate: input.vehiclePlate || '',
    vehicleColor: input.vehicleColor || '',
    vehicleStickerPhotoUrl: input.vehicleStickerPhotoUrl || '',
    vehicleStickerPhotoName: input.vehicleStickerPhotoName || '',
    vehicleStickerStatus: input.vehicleStickerStatus || (input.vehicleStickerPhotoUrl ? 'PENDENTE' : undefined),
    notes: input.notes || '',
    contractType,
    contractAccepted: true,
    contractSignedAt: now.toISOString(),
    contractAcceptedTerms: [
      'Termos e Condições Gerais de Uso, Adesão e Acesso (Balneário Família Lessa)',
      'Declaração de veracidade das informações cadastrais do titular e dependentes',
      'Autorização de cobrança conforme modalidade selecionada',
      'Aceite digital registrado com assinatura e validação eletrônica',
    ],
    startDate,
    endDate,
    members: builtMembers,
    invoices,
    attachments: input.attachments || [],
    isModifiedFromSeed: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // Gerar o contrato oficial preenchido com todos os dados do titular e dependentes
  subscription.contractContentHtml = renderSubscriptionContractHtml(
    subscription,
    state.contractTemplates
  );

  // 1. Gravação ATÔMICA IMEDIATA em public.club_records (+ snapshot automático em club_record_history)
  // Garante que NENHUM novo cadastro pelo site ou admin se perca mesmo se o cliente fechar a aba ou houver debounce!
  await saveMemberPermanentDocs(subscription.subscriptionCode, subscription, 'CREATE_SUBSCRIPTION');

  // 2. Gravação imediata no estado global (waitForCloud: true — SEM debounce!) antes de abrir pagamento Asaas
  state.lastCardSequence = seq;
  state.subscriptions = [subscription, ...state.subscriptions];
  await saveClubState(state, { waitForCloud: true });

  return {
    subscription,
    firstInvoice: invoices[0],
  };
};

const memberCardNumberFormat = (num: string): string => num;

// ============================================================================
// INTEGRAÇÃO REAL COM ASAAS (PIX QR CODE + CARTÃO CRÉDITO / DÉBITO)
// ============================================================================
export const generateAsaasChargeForClubInvoice = async (
  subscription: ClubSubscription,
  invoice: ClubInvoice,
  billingType: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO' = 'PIX',
  options?: { forceNew?: boolean }
): Promise<{
  paymentId: string;
  invoiceUrl: string;
  pixPayload?: string;
  pixQrCode?: string;
}> => {
  // SE A FATURA JÁ POSSUI COBRANÇA NO ASAAS (paymentId ou invoiceUrl) E NÃO ESTÁ TROCANDO DE MÉTODO,
  // reutiliza a cobrança original do Asaas e busca seu QR Code / link oficial
  const existingPaymentId =
    !options?.forceNew
      ? invoice.asaasPaymentId ||
        (invoice.invoiceUrl ? `pay_${invoice.invoiceUrl.match(/\/i\/([a-zA-Z0-9]+)/)?.[1]}` : undefined)
      : undefined;

  if (!options?.forceNew && (existingPaymentId || invoice.invoiceUrl)) {
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          action: 'get-pix-qr-code',
          paymentId: existingPaymentId,
          invoiceUrl: invoice.invoiceUrl,
        },
      });

      if (!error && data?.success && data.data) {
        const paymentData = data.data;
        const state = await fetchClubState();
        const subIdx = state.subscriptions.findIndex((s) => s.id === subscription.id);
        if (subIdx >= 0) {
          let targetSub = state.subscriptions[subIdx];
          const invIdx = targetSub.invoices.findIndex((inv) => inv.id === invoice.id);
          if (invIdx >= 0) {
            const invObj = targetSub.invoices[invIdx];
            invObj.asaasPaymentId = paymentData.paymentId || existingPaymentId;
            invObj.invoiceUrl = paymentData.invoiceUrl || invoice.invoiceUrl;
            if (paymentData.pix) {
              invObj.pixPayload = paymentData.pix.payload;
              invObj.pixQrCode = paymentData.pix.encodedImage;
            }
            if (paymentData.isPaid) {
              invObj.status = 'PAID';
              invObj.paidAt = invObj.paidAt || new Date().toISOString();
            }
            await saveClubState(state, { waitForCloud: true });
          }
        }

        return {
          paymentId: paymentData.paymentId || existingPaymentId || '',
          invoiceUrl: paymentData.invoiceUrl || invoice.invoiceUrl || '',
          pixPayload: paymentData.pix?.payload || invoice.pixPayload,
          pixQrCode: paymentData.pix?.encodedImage || invoice.pixQrCode,
        };
      }
    } catch (err) {
      console.warn('[ClubService] Erro ao recuperar cobrança existente do Asaas:', err);
    }

    if (invoice.invoiceUrl) {
      return {
        paymentId: existingPaymentId || '',
        invoiceUrl: invoice.invoiceUrl,
        pixPayload: invoice.pixPayload,
        pixQrCode: invoice.pixQrCode,
      };
    }
  }

  // REGRA RÍGIDA PLANO ANUAL:
  // - Anual + Cartão de Crédito: billingType ESTRITAMENTE 'CREDIT_CARD' (NUNCA 'UNDEFINED'!),
  //   cobrando o VALOR INTEGRAL ANUAL (totalContractValue) dividido em 1x..12x no limite do cartão.
  //   Assim o Asaas BLOQUEIA PIX/Boleto nessa fatura e garante o recebimento integral.
  // - Anual + PIX: cobrança ÚNICA INTEGRAL à vista (totalContractValue) — NUNCA 1/12 via PIX!
  // - Anual + Débito: cobrança ÚNICA INTEGRAL à vista (totalContractValue) — NUNCA parcelado!
  const isStrictAnnualContract =
    subscription.billingCycle === 'ANNUAL' &&
    subscription.origin !== 'IMPORT_LABCARD' &&
    !String(subscription.id || '').startsWith('sub-labcard-');

  const annualFullAmount = Number(
    (subscription.totalContractValue && subscription.totalContractValue > 0
      ? subscription.totalContractValue
      : invoice.amount
    ).toFixed(2)
  );

  const chargeValue = isStrictAnnualContract ? annualFullAmount : Number(invoice.amount.toFixed(2));
  const annualCreditInstallments =
    isStrictAnnualContract && billingType === 'CREDIT_CARD'
      ? Math.max(1, Math.min(12, subscription.installments || invoice.totalInstallments || 12))
      : 1;

  const asaasBillingType = isStrictAnnualContract
    ? billingType === 'CREDIT_CARD'
      ? 'CREDIT_CARD'
      : billingType === 'PIX'
      ? 'PIX'
      : 'UNDEFINED'
    : billingType === 'CREDIT_CARD' || billingType === 'DEBIT_CARD'
    ? 'UNDEFINED'
    : billingType;

  const loginUser = subscription.holderEmail || subscription.holderCpf;
  const loginPass = getBirthDatePassword(subscription.holderBirthDate);
  const portalUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/socio`
      : 'https://balneariolessa.com.br/socio';

  const asaasDescription = [
    `Lessa Club (${subscription.subscriptionCode}) - ${
      isStrictAnnualContract && billingType === 'PIX'
        ? `Pagamento Anual Integral a Vista (PIX) - ${subscription.planSummaryLabel}`
        : isStrictAnnualContract && billingType === 'CREDIT_CARD'
        ? `Plano Anual Integral (${annualCreditInstallments}x no Cartao de Credito) - ${subscription.planSummaryLabel}`
        : isStrictAnnualContract && billingType === 'DEBIT_CARD'
        ? `Pagamento Anual Integral a Vista (Debito) - ${subscription.planSummaryLabel}`
        : invoice.description || subscription.planSummaryLabel
    }`,
    `Portal do Socio: ${portalUrl}`,
    `Usuario: ${loginUser}`,
    `Senha: ${loginPass}`,
  ].join('\n');

  const paymentRequestBody: Record<string, any> = {
    orderId: options?.forceNew ? `${invoice.id}_${billingType.toLowerCase()}` : invoice.id,
    name: subscription.holderName,
    email: subscription.holderEmail || 'socio@balneariolessa.com.br',
    phone: cleanDigits(subscription.holderPhone),
    cpf: cleanDigits(subscription.holderCpf),
    billingType: asaasBillingType,
    value: chargeValue,
    dueDate: invoice.dueDate,
    description: asaasDescription,
  };

  if (isStrictAnnualContract && billingType === 'CREDIT_CARD' && annualCreditInstallments > 1) {
    paymentRequestBody.installmentCount = annualCreditInstallments;
    paymentRequestBody.totalValue = chargeValue;
    paymentRequestBody.installmentValue = Number((chargeValue / annualCreditInstallments).toFixed(2));
  }

  const { data, error } = await supabase.functions.invoke('create-payment', {
    body: paymentRequestBody,
  });

  if (error || !data?.success) {
    throw new Error(data?.error || error?.message || 'Não foi possível gerar a cobrança no Asaas.');
  }

  const paymentData = data.data;
  // Salva os dados na fatura e ativa/vincula na assinatura (garantindo que a assinatura nunca seja omitida)
  const state = await fetchClubState();
  let subIdx = state.subscriptions.findIndex((s) => s.id === subscription.id);
  if (subIdx < 0) {
    state.subscriptions = [{ ...subscription, isModifiedFromSeed: true }, ...state.subscriptions];
    subIdx = 0;
  }
  const targetSub = state.subscriptions[subIdx];
  targetSub.asaasPaymentId = paymentData.paymentId;
  targetSub.asaasInvoiceUrl = paymentData.invoiceUrl;
  targetSub.isModifiedFromSeed = true;
  targetSub.updatedAt = new Date().toISOString();
  const invIdx = targetSub.invoices.findIndex((inv) => inv.id === invoice.id);
  if (invIdx >= 0) {
    targetSub.invoices[invIdx].asaasPaymentId = paymentData.paymentId;
    targetSub.invoices[invIdx].invoiceUrl = paymentData.invoiceUrl;
    if (paymentData.pix) {
      targetSub.invoices[invIdx].pixPayload = paymentData.pix.payload;
      targetSub.invoices[invIdx].pixQrCode = paymentData.pix.encodedImage;
    }
  }
  await saveMemberPermanentDocs(targetSub.subscriptionCode, targetSub, 'ASAAS_CHARGE_CREATED');
  await saveClubState(state, { waitForCloud: true });

  return {
    paymentId: paymentData.paymentId,
    invoiceUrl: paymentData.invoiceUrl,
    pixPayload: paymentData.pix?.payload,
    pixQrCode: paymentData.pix?.encodedImage,
  };
};

export const isAsaasReservationCharge = (description?: string | null): boolean => {
  const lower = String(description || '').trim().toLowerCase();
  if (!lower) return false;
  if (
    /lessa\s*club|mensalidade|parcela\s*\d|plano\s*(anual|mensal)|fam[ií]lia\s*personalizado|servidor\s*pass|student\s*pass|professor\s*pass|portal\s*do\s*socio/i.test(
      lower
    )
  ) {
    return false;
  }
  return /reserva\s*(balne|online|de|quiosque|chal)|quiosque|chal[eé]|day\s*use|ingresso|hospedagem|camping/i.test(
    lower
  );
};

export const isClubInvoiceReservation = (inv?: Partial<ClubInvoice> | null): boolean => {
  if (!inv) return false;
  const desc = String(inv.description || '');
  return (
    inv.carneGroup === 99 ||
    /n[aã]o\s*[eé]\s*(pagamento\s*de\s*)?plano/i.test(desc) ||
    isAsaasReservationCharge(desc)
  );
};

export const syncSubscriptionInvoicesWithAsaas = async (
  subscriptionIdOrSub: string | ClubSubscription
): Promise<{ state: ClubDatabaseState; updatedSub: ClubSubscription | null; syncedCount: number }> => {
  const subId = typeof subscriptionIdOrSub === 'string' ? subscriptionIdOrSub : subscriptionIdOrSub.id;
  const state = await fetchClubState();
  const subIdx = state.subscriptions.findIndex((s) => s.id === subId);
  if (subIdx < 0) return { state, updatedSub: null, syncedCount: 0 };

  let targetSub = state.subscriptions[subIdx];
  const cleanCpf = cleanDigits(targetSub.holderCpf);
  if (!cleanCpf || cleanCpf.length !== 11) {
    return { state, updatedSub: targetSub, syncedCount: 0 };
  }

  try {
    const { data, error } = await supabase.functions.invoke('create-payment', {
      body: {
        action: 'list-customer-charges',
        cpf: cleanCpf,
      },
    });

    if (error || !data || !Array.isArray(data.payments) || data.payments.length === 0) {
      return { state, updatedSub: targetSub, syncedCount: 0 };
    }

    const rawPayments: any[] = data.payments.filter((p: any) => !p.deleted);
    // Ordena as cobranças por data de vencimento crescente
    const sortedPayments = [...rawPayments].sort((a, b) =>
      (a.dueDate || '').localeCompare(b.dueDate || '')
    );

    const existingInvoices = [...(targetSub.invoices || [])];
    const existingByAsaasId = new Map<string, ClubInvoice>();
    existingInvoices.forEach((inv) => {
      if (inv.asaasPaymentId) existingByAsaasId.set(inv.asaasPaymentId, inv);
    });

    const clubPayments = sortedPayments.filter((p) => !isAsaasReservationCharge(p.description));
    const reservationPayments = sortedPayments.filter((p) => isAsaasReservationCharge(p.description));

    const updatedInvoices: ClubInvoice[] = [...existingInvoices];

    // 1. Atualiza ou adiciona cobranças reais do Lessa Club (preservando parcelas pendentes locais ainda não emitidas!)
    clubPayments.forEach((p, idx) => {
      const isPaid = p.status === 'RECEIVED' || p.status === 'CONFIRMED' || p.status === 'RECEIVED_IN_CASH';
      const isOverdue = p.status === 'OVERDUE';
      const status: 'PAID' | 'PENDING' | 'OVERDUE' = isPaid ? 'PAID' : isOverdue ? 'OVERDUE' : 'PENDING';
      const dueParts = (p.dueDate || '').split('-');
      const refMonth = dueParts.length === 3 ? `${dueParts[1]}/${dueParts[0]}` : `Parcela ${idx + 1}`;
      const matchIdx = updatedInvoices.findIndex(
        (i) =>
          !isClubInvoiceReservation(i) &&
          ((i.asaasPaymentId && i.asaasPaymentId === p.id) ||
            (i.id && p.externalReference && i.id === p.externalReference) ||
            (!i.asaasPaymentId && i.dueDate && p.dueDate && i.dueDate === p.dueDate))
      );

      if (matchIdx >= 0) {
        const existing = updatedInvoices[matchIdx];
        updatedInvoices[matchIdx] = {
          ...existing,
          amount: Number(p.value) || existing.amount,
          dueDate: p.dueDate || existing.dueDate,
          paidAt: isPaid
            ? p.paymentDate || p.clientPaymentDate || existing.paidAt || `${p.dueDate}T12:00:00.000Z`
            : undefined,
          paymentMethod: p.billingType === 'BOLETO' ? 'BOLETO' : p.billingType === 'PIX' ? 'PIX' : 'CREDIT_CARD',
          status,
          asaasPaymentId: p.id,
          invoiceUrl: p.invoiceUrl || existing.invoiceUrl,
          boletoNumber: p.nossoNumero || p.bankSlipUrl || existing.boletoNumber,
        };
      } else {
        const existing = existingByAsaasId.get(p.id);
        const rawFirstLine = String(p.description || '').split('\n')[0].trim();
        updatedInvoices.push({
          id: existing?.id || `inv_asaas_${p.id}`,
          subscriptionId: targetSub.id,
          subscriptionCode: targetSub.subscriptionCode,
          holderName: targetSub.holderName,
          holderCpf: targetSub.holderCpf,
          holderPhone: targetSub.holderPhone,
          installmentNumber: idx + 1,
          totalInstallments: Math.max(clubPayments.length, existingInvoices.filter((i) => !isClubInvoiceReservation(i)).length, 1),
          referenceMonth: refMonth,
          amount: Number(p.value) || targetSub.monthlyEquivalent || 25,
          dueDate: p.dueDate,
          paidAt: isPaid ? p.paymentDate || p.clientPaymentDate || `${p.dueDate}T12:00:00.000Z` : undefined,
          paymentMethod: p.billingType === 'BOLETO' ? 'BOLETO' : p.billingType === 'PIX' ? 'PIX' : 'CREDIT_CARD',
          status,
          asaasPaymentId: p.id,
          invoiceUrl: p.invoiceUrl,
          boletoNumber: p.nossoNumero || p.bankSlipUrl,
          description: rawFirstLine || `${targetSub.planSummaryLabel || 'Lessa Club'} (Mensalidade ${refMonth})`,
          invoiceKind: 'MENSALIDADE',
          carneGroup: 1,
          createdAt: p.dateCreated ? `${p.dateCreated}T00:00:00.000Z` : targetSub.createdAt,
        });
      }
    });

    // 2. Discrimina claramente cobranças de RESERVA (Quiosque / Chalé / Day Use) — NUNCA como mensalidade de plano!
    reservationPayments.forEach((p) => {
      const isPaid = p.status === 'RECEIVED' || p.status === 'CONFIRMED' || p.status === 'RECEIVED_IN_CASH';
      const isOverdue = p.status === 'OVERDUE';
      const status: 'PAID' | 'PENDING' | 'OVERDUE' = isPaid ? 'PAID' : isOverdue ? 'OVERDUE' : 'PENDING';
      const dueParts = (p.dueDate || '').split('-');
      const refMonth = dueParts.length === 3 ? `${dueParts[1]}/${dueParts[0]}` : 'Reserva';
      const rawDesc = String(p.description || 'Reserva Balneário Lessa').split('\n')[0].trim();
      const reservationDesc = /n[aã]o\s*[eé]\s*(pagamento\s*de\s*)?plano/i.test(rawDesc)
        ? rawDesc
        : `RESERVA DO BALNEÁRIO (NÃO É PAGAMENTO DE PLANO) — ${rawDesc}`;

      const matchIdx = updatedInvoices.findIndex((i) => i.asaasPaymentId && i.asaasPaymentId === p.id);
      const existingRes = matchIdx >= 0 ? updatedInvoices[matchIdx] : undefined;
      const keepExistingDesc =
        existingRes?.description && /n[aã]o\s*[eé]\s*(pagamento\s*de\s*)?plano/i.test(existingRes.description);
      const resInv: ClubInvoice = {
        id: existingRes ? existingRes.id : `inv_reserva_${p.id}`,
        subscriptionId: targetSub.id,
        subscriptionCode: targetSub.subscriptionCode,
        holderName: targetSub.holderName,
        holderCpf: targetSub.holderCpf,
        holderPhone: targetSub.holderPhone,
        installmentNumber: 1,
        totalInstallments: 1,
        referenceMonth: refMonth,
        amount: Number(p.value) || 0,
        dueDate: p.dueDate,
        paidAt: isPaid ? p.paymentDate || p.clientPaymentDate || existingRes?.paidAt || `${p.dueDate}T12:00:00.000Z` : undefined,
        paymentMethod: p.billingType === 'BOLETO' ? 'BOLETO' : p.billingType === 'PIX' ? 'PIX' : 'CREDIT_CARD',
        status,
        asaasPaymentId: p.id,
        invoiceUrl: p.invoiceUrl || existingRes?.invoiceUrl,
        boletoNumber: p.nossoNumero || p.bankSlipUrl || existingRes?.boletoNumber,
        description: keepExistingDesc ? existingRes!.description : reservationDesc,
        invoiceKind: 'AVULSA',
        carneGroup: 99,
        notes:
          existingRes?.notes ||
          'Cobrança referente a reserva avulsa no Balneário (Quiosque/Chalé/Ingresso). Não contabiliza como pagamento de mensalidade do Lessa Club.',
        createdAt: p.dateCreated ? `${p.dateCreated}T00:00:00.000Z` : existingRes?.createdAt || targetSub.createdAt,
      };
      if (matchIdx >= 0) {
        updatedInvoices[matchIdx] = resInv;
      } else {
        updatedInvoices.push(resInv);
      }
    });

    targetSub.invoices = updatedInvoices;
    const syncedInvoices = updatedInvoices;

    // Se o Administrador já definiu uma data de vigência no Lessa Club (ex: 2026-12-30), PRESERVA INTEGRALMENTE a data do Admin!
    // A decisão soberana do administrador no Lessa Club sempre prevalece sobre estimativas automáticas.
    if (!targetSub.endDate || targetSub.endDate === '2027-10-31') {
      const lastDue = sortedPayments[sortedPayments.length - 1]?.dueDate;
      if (lastDue) {
        const lastDate = new Date(lastDue + 'T00:00:00');
        lastDate.setMonth(lastDate.getMonth() + 1);
        targetSub.endDate = lastDate.toISOString().split('T')[0];
      }
    }

    // A validade na carteirinha acompanha a data soberana de vigência definida no Lessa Club (targetSub.endDate)
    if (targetSub.endDate) {
      const p = targetSub.endDate.split('-');
      if (p.length === 3) {
        const valLabel = `${p[1]}/${p[0]}`;
        targetSub.members = (targetSub.members || []).map((m) => ({
          ...m,
          expirationDate: m.role === 'TITULAR' ? targetSub.endDate : (m.expirationDate || targetSub.endDate),
          validityLabel: m.role === 'TITULAR' ? valLabel : (m.validityLabel || valLabel),
        }));
      }
    }

    targetSub = resolveSubscriptionInactivityStatus(targetSub);

    targetSub.updatedAt = new Date().toISOString();
    state.subscriptions[subIdx] = targetSub;
    const saved = await saveClubState(state, { waitForCloud: true });
    return { state: saved, updatedSub: targetSub, syncedCount: syncedInvoices.length };
  } catch (err) {
    console.warn('[ClubService] Erro ao sincronizar faturas com o Asaas:', err);
    return { state, updatedSub: targetSub, syncedCount: 0 };
  }
};

export const generateAllAsaasInvoicesForSubscription = async (
  subscription: ClubSubscription,
  billingType: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO' = 'PIX',
  invoiceIds?: string[]
): Promise<ClubDatabaseState> => {
  const state = await fetchClubState();
  const subIdx = state.subscriptions.findIndex((s) => s.id === subscription.id);
  if (subIdx < 0) return state;

  let targetSub = state.subscriptions[subIdx];
  const invoicesToGenerate = targetSub.invoices.filter((inv) => {
    if (invoiceIds && invoiceIds.length > 0) {
      return invoiceIds.includes(inv.id) && inv.amount > 0 && inv.status !== 'PAID' && inv.status !== 'CANCELLED';
    }
    return !inv.asaasPaymentId && inv.amount > 0 && inv.status !== 'PAID' && inv.status !== 'CANCELLED';
  });

  for (const inv of invoicesToGenerate) {
    try {
      const loginUser = targetSub.holderEmail || targetSub.holderCpf;
      const loginPass = getBirthDatePassword(targetSub.holderBirthDate);
      const portalUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/socio`
          : 'https://balneariolessa.com.br/socio';

      const asaasDescription = [
        `Lessa Club (${targetSub.subscriptionCode}) - ${inv.description || targetSub.planSummaryLabel}`,
        `Portal do Socio: ${portalUrl}`,
        `Usuario: ${loginUser}`,
        `Senha: ${loginPass}`,
      ].join('\n');

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          orderId: inv.id,
          name: targetSub.holderName,
          email: targetSub.holderEmail || 'socio@balneariolessa.com.br',
          phone: cleanDigits(targetSub.holderPhone),
          cpf: cleanDigits(targetSub.holderCpf),
          billingType: billingType === 'CREDIT_CARD' || billingType === 'DEBIT_CARD' ? 'UNDEFINED' : billingType,
          value: inv.amount,
          dueDate: inv.dueDate,
          description: asaasDescription,
        },
      });

      if (!error && data?.success && data.data) {
        inv.asaasPaymentId = data.data.paymentId;
        inv.invoiceUrl = data.data.invoiceUrl;
        if (data.data.pix) {
          inv.pixPayload = data.data.pix.payload;
          inv.pixQrCode = data.data.pix.encodedImage;
        }
      }
    } catch (err) {
      console.warn(`[ClubService] Error generating Asaas charge for invoice ${inv.id}:`, err);
    }
  }

  return saveClubState(state);
};

export interface EmitCarneMonthlyChargesParams {
  subscriptionId: string;
  invoiceIds: string[];
  billingType?: 'PIX' | 'BOLETO' | 'UNDEFINED' | 'CREDIT_CARD' | 'DEBIT_CARD';
  firstDueDate?: string;
  dueDay?: number;
  equalizedAmount?: number;
  activateCardRecurrence?: boolean;
  cardLast4?: string;
  onProgress?: (current: number, total: number, message: string) => void;
}

const invokeEdgeFunctionWithTimeout = async (
  name: string,
  options: { body: any },
  timeoutMs = 30000
): Promise<any> => {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Tempo limite de ${timeoutMs / 1000}s atingido na comunicação com o gateway.`));
    }, timeoutMs);
  });

  try {
    const result: any = await Promise.race([
      supabase.functions.invoke(name, options),
      timeoutPromise,
    ]);
    if (result?.error && (result.error as any).context) {
      try {
        const text = await (result.error as any).context.text();
        const json = JSON.parse(text);
        if (json?.error) {
          result.error.message = json.error;
        }
      } catch (_) {}
    }
    return result;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const emitCarneMonthlyChargesInAsaas = async (
  params: EmitCarneMonthlyChargesParams
): Promise<{
  state: ClubDatabaseState;
  generatedCount: number;
  failedCount: number;
  firstError?: string;
}> => {
  const state = await fetchClubState();
  const subIdx = state.subscriptions.findIndex((s) => s.id === params.subscriptionId);
  if (subIdx < 0) {
    throw new Error('Assinatura do associado não encontrada.');
  }

  let targetSub = state.subscriptions[subIdx];
  const baseDate = params.firstDueDate ? new Date(`${params.firstDueDate}T12:00:00`) : new Date();
  const fixedDay = params.dueDay || baseDate.getDate() || targetSub.dueDay || 10;

  const eligibleInvoices = targetSub.invoices.filter((inv) =>
    params.invoiceIds.includes(inv.id)
  );

  let generatedCount = 0;
  let failedCount = 0;
  let firstError: string | undefined;

  const asaasBillingType =
    !params.billingType || params.billingType === 'CREDIT_CARD' || params.billingType === 'DEBIT_CARD'
      ? 'UNDEFINED'
      : params.billingType;

  const loginUser = targetSub.holderEmail || targetSub.holderCpf;
  const loginPass = getBirthDatePassword(targetSub.holderBirthDate);
  const portalUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/socio`
      : 'https://balneariolessa.com.br/socio';

  for (let idx = 0; idx < eligibleInvoices.length; idx++) {
    const inv = eligibleInvoices[idx];
    if (params.onProgress) {
      params.onProgress(
        idx + 1,
        eligibleInvoices.length,
        `Emitindo parcela ${idx + 1} de ${eligibleInvoices.length}...`
      );
    }

    // Atualiza datas subsequentes com dia fixo e valor equalizado caso informado
    const due = new Date(baseDate.getFullYear(), baseDate.getMonth() + idx, 1);
    const maxDayOfMonth = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
    due.setDate(Math.min(fixedDay, maxDayOfMonth));
    const yyyy = due.getFullYear();
    const mm = String(due.getMonth() + 1).padStart(2, '0');
    const dd = String(due.getDate()).padStart(2, '0');
    
    // O Asaas proíbe vencimento inferior a hoje. Clampa para no mínimo hoje.
    const todayStr = new Date().toISOString().split('T')[0];
    let computedDue = `${yyyy}-${mm}-${dd}`;
    if (computedDue < todayStr) {
      computedDue = todayStr;
    }
    inv.dueDate = computedDue;
    inv.referenceMonth = `${mm}/${yyyy}`;

    if (typeof params.equalizedAmount === 'number' && Number.isFinite(params.equalizedAmount) && params.equalizedAmount > 0) {
      inv.amount = Number(params.equalizedAmount.toFixed(2));
    }

    if (params.activateCardRecurrence && params.cardLast4) {
      inv.paymentMethod = targetSub.registeredCard?.cardType === 'DEBIT' ? 'DEBIT_CARD' : 'CREDIT_CARD';
    }

    if (inv.amount <= 0) {
      failedCount++;
      if (!firstError) firstError = 'Parcelas com valor R$ 0,00 não podem ser emitidas no Asaas.';
      continue;
    }

    try {
      const asaasDescription = [
        `Lessa Club (${targetSub.subscriptionCode}) - ${inv.description || 'Mensalidade'} (${inv.installmentNumber}/${inv.totalInstallments})`,
        params.activateCardRecurrence && params.cardLast4 ? `Recorrencia Cartao final ${params.cardLast4}` : '',
        `Portal do Socio: ${portalUrl}`,
        `Usuario: ${loginUser}`,
        `Senha: ${loginPass}`,
      ]
        .filter(Boolean)
        .join('\n');

      const { data, error } = await invokeEdgeFunctionWithTimeout('create-payment', {
        body: {
          orderId: inv.id,
          name: targetSub.holderName,
          email: targetSub.holderEmail || 'socio@balneariolessa.com.br',
          phone: cleanDigits(targetSub.holderPhone),
          cpf: cleanDigits(targetSub.holderCpf),
          billingType: asaasBillingType,
          value: inv.amount,
          dueDate: inv.dueDate,
          description: asaasDescription,
        },
      }, 30000);

      if (!error && data?.success && data.data) {
        inv.asaasPaymentId = data.data.paymentId;
        inv.invoiceUrl = data.data.invoiceUrl;
        if (data.data.pix) {
          inv.pixPayload = data.data.pix.payload;
          inv.pixQrCode = data.data.pix.encodedImage;
        }
        generatedCount++;
      } else {
        failedCount++;
        if (!firstError) {
          firstError = data?.error || error?.message || 'Falha ao gerar cobrança no Asaas.';
        }
      }
    } catch (err: any) {
      failedCount++;
      if (!firstError) {
        firstError = err?.message || 'Erro de comunicação com Asaas.';
      }
    }
  }

  targetSub.dueDay = fixedDay;
  targetSub.updatedAt = new Date().toISOString();
  const saved = await saveClubState(state);
  return { state: saved, generatedCount, failedCount, firstError };
};

export const processClubCreditCardPayment = async (
  subscription: ClubSubscription,
  invoice: ClubInvoice,
  cardData: {
    holderName: string;
    cardNumber: string;
    cardExpiry: string; // MM/AA
    cardCvv: string;
    cardHolderCpf: string;
    installments: number;
    cardType?: 'CREDIT_CARD' | 'DEBIT_CARD';
  }
): Promise<{
  success: boolean;
  isPaid: boolean;
  status: string;
  paymentId?: string;
  invoiceUrl?: string;
  error?: string;
}> => {
  const cleanCard = cardData.cardNumber.replace(/\D/g, '');
  const cleanCpf = cleanDigits(cardData.cardHolderCpf || subscription.holderCpf);
  const expiryParts = cardData.cardExpiry.split('/');
  const expiryMonth = (expiryParts[0] || '').trim().padStart(2, '0');
  const rawYear = (expiryParts[1] || '').trim();
  const expiryYear = rawYear.length === 2 ? `20${rawYear}` : rawYear;

  const isAnnual = subscription.billingCycle === 'ANNUAL';
  // Débito no Plano Anual é SEMPRE 1x integral à vista; parcelamento 1x..12x é exclusivo do Cartão de Crédito
  const chosenInstallments =
    isAnnual && cardData.cardType !== 'DEBIT_CARD'
      ? Math.max(1, Math.min(12, cardData.installments || 12))
      : 1;
  const totalValue = isAnnual ? subscription.totalContractValue : invoice.amount;
  const installmentValue = isAnnual
    ? Number((totalValue / chosenInstallments).toFixed(2))
    : invoice.amount;

  const loginUser = subscription.holderEmail || subscription.holderCpf;
  const loginPass = getBirthDatePassword(subscription.holderBirthDate);
  const portalUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/socio`
      : 'https://balneariolessa.com.br/socio';

  const asaasDescription = [
    `Lessa Club (${subscription.subscriptionCode}) - ${invoice.description || subscription.planSummaryLabel}`,
    `Portal do Socio: ${portalUrl}`,
    `Usuario: ${loginUser}`,
    `Senha: ${loginPass}`,
  ].join('\n');

  const { data, error } = await supabase.functions.invoke('create-payment', {
    body: {
      orderId: invoice.id,
      name: cardData.holderName.toUpperCase().trim(),
      email: subscription.holderEmail || 'socio@balneariolessa.com.br',
      phone: cleanDigits(subscription.holderPhone),
      cpf: cleanCpf,
      billingType: 'CREDIT_CARD',
      value: totalValue,
      totalValue,
      installmentCount: chosenInstallments,
      installmentValue,
      dueDate: invoice.dueDate,
      description: asaasDescription,
      creditCard: {
        holderName: cardData.holderName.toUpperCase().trim(),
        number: cleanCard,
        expiryMonth,
        expiryYear,
        ccv: cardData.cardCvv.trim(),
      },
      creditCardHolderInfo: {
        name: cardData.holderName.toUpperCase().trim(),
        email: subscription.holderEmail || 'socio@balneariolessa.com.br',
        cpfCnpj: cleanCpf,
        postalCode: cleanDigits(subscription.addressCep) || '76870000',
        addressNumber: subscription.addressNumber || 'S/N',
        phone: cleanDigits(subscription.holderPhone),
        mobilePhone: cleanDigits(subscription.holderPhone),
      },
    },
  });

  if (error || !data?.success) {
    const errMsg =
      data?.error || error?.message || 'Pagamento recusado pela operadora do cartão.';
    return {
      success: false,
      isPaid: false,
      status: 'FAILED',
      error: errMsg,
    };
  }

  const paymentData = data.data;
  const isPaid =
    paymentData.isPaid ||
    paymentData.status === 'CONFIRMED' ||
    paymentData.status === 'RECEIVED';

  // Salva os dados na fatura e na assinatura (atômico em club_records + nuvem imediata)
  const state = await fetchClubState();
  let subIdx = state.subscriptions.findIndex((s) => s.id === subscription.id);
  if (subIdx < 0) {
    state.subscriptions = [{ ...subscription, isModifiedFromSeed: true }, ...state.subscriptions];
    subIdx = 0;
  }
  const targetSub = state.subscriptions[subIdx];
  targetSub.asaasPaymentId = paymentData.paymentId;
  targetSub.asaasInvoiceUrl = paymentData.invoiceUrl;
  targetSub.installments = chosenInstallments;
  targetSub.isModifiedFromSeed = true;
  targetSub.updatedAt = new Date().toISOString();
  const invIdx = targetSub.invoices.findIndex((inv) => inv.id === invoice.id);
  if (invIdx >= 0) {
    targetSub.invoices[invIdx].asaasPaymentId = paymentData.paymentId;
    targetSub.invoices[invIdx].invoiceUrl = paymentData.invoiceUrl;
    targetSub.invoices[invIdx].paymentMethod = cardData.cardType === 'DEBIT_CARD' ? 'DEBIT_CARD' : 'CREDIT_CARD';
    if (isPaid) {
      targetSub.invoices[invIdx].status = 'PAID';
      targetSub.invoices[invIdx].paidAt = new Date().toISOString();
    }
  }
  if (isPaid) {
    targetSub.members.forEach((m) => {
      m.status = isMemberBlockedForMissingDoc(m, targetSub) ? 'INACTIVE' : 'ACTIVE';
    });
    targetSub.status = targetSub.members.every((m) => m.status === 'INACTIVE')
      ? 'INACTIVE'
      : 'ACTIVE';
    if (targetSub.status === 'ACTIVE') {
      targetSub.transferCompleted = true;
      targetSub.manuallyConfirmedTransfer = true;
    }
    targetSub.contractContentHtml = renderSubscriptionContractHtml(
      targetSub,
      state.contractTemplates
    );
  }
  await saveMemberPermanentDocs(targetSub.subscriptionCode, targetSub, 'CREDIT_CARD_PAYMENT');
  await saveClubState(state, { waitForCloud: true });

  return {
    success: true,
    isPaid,
    status: paymentData.status || (isPaid ? 'CONFIRMED' : 'PENDING'),
    paymentId: paymentData.paymentId,
    invoiceUrl: paymentData.invoiceUrl,
  };
};

export const generateUnifiedPaymentLink = async (
  subscription: ClubSubscription,
  invoices: ClubInvoice[],
  billingType: 'CREDIT_CARD' | 'UNDEFINED' | 'PIX' = 'CREDIT_CARD',
  installmentCount?: number
): Promise<{
  paymentId: string;
  invoiceUrl: string;
  pixPayload?: string;
  pixQrCode?: string;
  totalAmount: number;
}> => {
  const totalAmount = Number(
    invoices.reduce((acc, inv) => acc + inv.amount, 0).toFixed(2)
  );

  const chosenInstallments =
    billingType === 'CREDIT_CARD'
      ? Math.max(1, Math.min(12, Math.round(installmentCount || invoices.length || 1)))
      : 1;
  const perInstallment = Number((totalAmount / chosenInstallments).toFixed(2));

  const loginUser = subscription.holderEmail || subscription.holderCpf;
  const loginPass = getBirthDatePassword(subscription.holderBirthDate);
  const portalUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/socio`
      : 'https://balneariolessa.com.br/socio';

  const asaasDescription = [
    billingType === 'CREDIT_CARD'
      ? `Lessa Club (${subscription.subscriptionCode}) - Quitação Unificada no Cartão de Crédito (${chosenInstallments}x de R$ ${perInstallment.toFixed(2).replace('.', ',')} | ${invoices.length} parcela(s))`
      : `Lessa Club (${subscription.subscriptionCode}) - Quitação Unificada (${invoices.length} parcelas)`,
    `Portal do Socio: ${portalUrl}`,
    `Usuario: ${loginUser}`,
    `Senha: ${loginPass}`,
  ].join('\n');

  const requestBody: Record<string, any> = {
    orderId: `unified_${subscription.id}_${Date.now()}`,
    name: subscription.holderName,
    email: subscription.holderEmail || 'socio@balneariolessa.com.br',
    phone: cleanDigits(subscription.holderPhone),
    cpf: cleanDigits(subscription.holderCpf),
    // Exclusivo CREDIT_CARD quando link de cartão (bloqueia PIX e Boleto no Asaas!)
    billingType: billingType === 'CREDIT_CARD' ? 'CREDIT_CARD' : billingType,
    value: totalAmount,
    totalValue: totalAmount,
    description: asaasDescription,
  };

  if (billingType === 'CREDIT_CARD' && chosenInstallments > 1) {
    requestBody.installmentCount = chosenInstallments;
    requestBody.installmentValue = perInstallment;
  }

  const { data, error } = await supabase.functions.invoke('create-payment', {
    body: requestBody,
  });

  if (error || !data?.success) {
    throw new Error(data?.error || error?.message || 'Não foi possível gerar o link de pagamento unificado no Asaas.');
  }

  const paymentData = data.data;
  return {
    paymentId: paymentData.paymentId,
    invoiceUrl: paymentData.invoiceUrl,
    pixPayload: paymentData.pix?.payload,
    pixQrCode: paymentData.pix?.encodedImage,
    totalAmount,
  };
};

export const updateAsaasPaymentDueDate = async (
  paymentId: string,
  dueDate: string,
  value?: number
): Promise<{ success: boolean; data?: any }> => {
  const { data, error } = await supabase.functions.invoke('create-payment', {
    body: {
      action: 'update-due-date',
      paymentId,
      dueDate,
      value,
    },
  });

  if (error || !data?.success) {
    throw new Error(data?.error || error?.message || 'Falha ao sincronizar alteração com o Asaas.');
  }

  return data;
};

export const deleteAsaasPayment = async (
  paymentId: string
): Promise<{ success: boolean; data?: any; error?: string }> => {
  if (!paymentId || !paymentId.startsWith('pay_')) {
    return { success: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke('create-payment', {
      body: {
        action: 'delete',
        paymentId,
      },
    });

    if (error || !data?.success) {
      const msg = data?.error || error?.message || 'Falha ao excluir cobrança no Asaas.';
      console.warn(`[ClubService] Falha ao excluir ${paymentId} no Asaas:`, msg);
      return { success: false, error: msg };
    }

    return { success: true, data };
  } catch (err: any) {
    console.warn(`[ClubService] Exceção ao excluir ${paymentId} no Asaas:`, err);
    return { success: false, error: err.message };
  }
};

export const checkClubInvoicePaymentStatus = async (
  subscriptionId: string,
  invoiceId: string
): Promise<boolean> => {
  const state = await fetchClubState();
  const sub = state.subscriptions.find((s) => s.id === subscriptionId);
  const inv = sub?.invoices.find((i) => i.id === invoiceId);
  if (!sub || !inv) return false;
  if (inv.status === 'PAID') return true;

  const paymentId =
    inv.asaasPaymentId ||
    (inv.invoiceUrl ? `pay_${inv.invoiceUrl.match(/\/i\/([a-zA-Z0-9]+)/)?.[1]}` : undefined);

  if (paymentId) {
    try {
      const { data } = await supabase.functions.invoke('check-payment', {
        body: { paymentId, orderId: inv.id },
      });
      if (data?.isPaid || data?.status === 'RECEIVED' || data?.status === 'CONFIRMED') {
        await markClubInvoicePaid(subscriptionId, invoiceId, { waitForCloud: true });
        return true;
      }
    } catch (e) {
      console.warn('[ClubService] check-payment error:', e);
    }
  }
  return false;
};

// ============================================================================
// PRÉ-VISUALIZAÇÃO E SINCRONIZAÇÃO DE MENSALIDADES DO ASAAS (SEM AUTO-ATIVAR)
// ============================================================================
export interface AsaasPaymentPreviewItem {
  id: string;
  value: number;
  netValue: number;
  billingType: string;
  status: string;
  dueDate: string;
  paidAt?: string;
  description?: string;
  invoiceUrl?: string;
  subscriptionId?: string;
  installmentId?: string;
  installmentNumber?: number;
  externalReference?: string;
  looksLikeReservation?: boolean;
  looksLikeSub?: boolean;
}

export interface AsaasSubscriptionPreviewItem {
  id: string;
  value: number;
  cycle: string;
  billingType: string;
  description?: string;
  status: string;
  nextDueDate?: string;
  dateCreated?: string;
}

export interface AsaasCustomerSyncCandidate {
  customerId: string;
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
  subscriptions: AsaasSubscriptionPreviewItem[];
  payments: AsaasPaymentPreviewItem[];
  likelyCategory: 'SUBSCRIPTION' | 'RESERVATION' | 'MIXED' | 'OTHER';
  hasActiveSubscription: boolean;
  hasInstallments: boolean;
  hasHalfPriceCharge: boolean;
  matchedSubscriptionId?: string;
  matchedHolderName?: string;
  matchedStatus?: SubscriptionStatus;
  matchedOrigin?: string;
}

const normalizeNameKey = (val: string): string =>
  (val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

export const mapAsaasPaymentStatusToInvoiceStatus = (
  asaasStatus: string
): 'PAID' | 'PENDING' | 'OVERDUE' | 'CANCELLED' => {
  const s = (asaasStatus || '').toUpperCase();
  if (s === 'RECEIVED' || s === 'CONFIRMED' || s === 'RECEIVED_IN_CASH') return 'PAID';
  if (s === 'OVERDUE') return 'OVERDUE';
  if (
    s === 'REFUNDED' ||
    s === 'DELETED' ||
    s === 'REFUND_REQUESTED' ||
    s === 'CHARGEBACK_REQUESTED'
  ) {
    return 'CANCELLED';
  }
  return 'PENDING';
};

export const mapAsaasBillingTypeToMethod = (billingType: string): ClubPaymentMethod => {
  const b = (billingType || '').toUpperCase();
  if (b === 'CREDIT_CARD' || b === 'DEBIT_CARD') return 'CREDIT_CARD';
  if (b === 'BOLETO') return 'BOLETO';
  return 'PIX';
};

export const fetchAsaasInstallmentCandidates = async (
  currentState: ClubDatabaseState
): Promise<{
  isProd: boolean;
  totalFound: number;
  returnedCount: number;
  truncated: boolean;
  candidates: AsaasCustomerSyncCandidate[];
}> => {
  const { data, error } = await supabase.functions.invoke('check-payment', {
    body: { action: 'list-asaas-installments', maxCustomers: 150 },
  });

  if (error || !data?.success) {
    throw new Error(
      data?.error ||
        error?.message ||
        'Não foi possível consultar as parcelas ativas no Asaas.'
    );
  }

  const rawItems = (data.items || []) as AsaasCustomerSyncCandidate[];
  const subs = currentState?.subscriptions || [];

  const candidates = rawItems.map((item) => {
    const cleanDoc = cleanDigits(item.cpfCnpj);
    const normName = normalizeNameKey(item.name);
    const paymentIds = new Set((item.payments || []).map((p) => p.id));

    const matched =
      subs.find((s) => s.asaasCustomerId && s.asaasCustomerId === item.customerId) ||
      (cleanDoc.length >= 11
        ? subs.find((s) => cleanDigits(s.holderCpf) === cleanDoc)
        : undefined) ||
      subs.find(
        (s) =>
          (s.asaasPaymentId && paymentIds.has(s.asaasPaymentId)) ||
          (s.invoices || []).some((inv) => inv.asaasPaymentId && paymentIds.has(inv.asaasPaymentId))
      ) ||
      (normName.length >= 6
        ? subs.find((s) => normalizeNameKey(s.holderName) === normName)
        : undefined);

    return {
      ...item,
      matchedSubscriptionId: matched?.id,
      matchedHolderName: matched?.holderName,
      matchedStatus: matched?.status,
      matchedOrigin: matched?.origin,
    };
  });

  return {
    isProd: Boolean(data.isProd),
    totalFound: Number(data.totalFound || candidates.length),
    returnedCount: Number(data.returnedCount || candidates.length),
    truncated: Boolean(data.truncated),
    candidates,
  };
};

export interface AsaasSyncSelectionInput {
  candidate: AsaasCustomerSyncCandidate;
  targetSubscriptionId: string; // ID de ClubSubscription existente ou 'CREATE_PENDING'
  paymentIds: string[];
}

export interface AsaasSyncOptions {
  activateSelected?: boolean;
}

/**
 * Importa/sincroniza as mensalidades selecionadas do Asaas no Perfil Financeiro.
 * Quando `options.activateSelected` é true ("Importar e Ativar"), também ativa titular e dependentes;
 * caso contrário ("Importar (Sem Ativar)"), preserva o status sem ativar automaticamente.
 */
export const applySelectedAsaasSync = async (
  currentState: ClubDatabaseState,
  selections: AsaasSyncSelectionInput[],
  options?: AsaasSyncOptions
): Promise<{
  state: ClubDatabaseState;
  updatedSubs: number;
  activatedSubs: number;
  importedInvoices: number;
  updatedInvoices: number;
  createdPendingSubs: number;
}> => {
  const shouldActivate = Boolean(options?.activateSelected);
  const nowIso = new Date().toISOString();
  const nextSubs = [...currentState.subscriptions];
  let seq = currentState.lastCardSequence || 3000;

  let updatedSubs = 0;
  let activatedSubs = 0;
  let importedInvoices = 0;
  let updatedInvoices = 0;
  let createdPendingSubs = 0;

  for (const sel of selections) {
    const selectedPaymentSet = new Set(sel.paymentIds);
    const chosenPayments = (sel.candidate.payments || [])
      .filter((p) => selectedPaymentSet.has(p.id))
      .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));

    if (chosenPayments.length === 0) continue;

    let targetIdx =
      sel.targetSubscriptionId && sel.targetSubscriptionId !== 'CREATE_PENDING'
        ? nextSubs.findIndex((s) => s.id === sel.targetSubscriptionId)
        : -1;

    if (targetIdx === -1 && sel.targetSubscriptionId === 'CREATE_PENDING') {
      seq += 1;
      const cardCode = `121225${String(seq).padStart(4, '0')}`;
      const newSubId = `sub-asaas-${cleanDigits(sel.candidate.cpfCnpj) || sel.candidate.customerId}`;
      const mainSub = sel.candidate.subscriptions?.[0];
      const avgAmount =
        mainSub?.value ||
        chosenPayments[0]?.value ||
        49.9;
      const isHalfPrice = Math.abs(avgAmount - 25.0) < 0.05 || Math.abs(avgAmount - 22.5) < 0.05;
      const modCode = isHalfPrice ? 'ESTUDANTE' : 'ADULTO';
      const modName = isHalfPrice ? 'Meia-Assinatura (Verificar Doc.)' : 'Lessa Club';

      const newSub: ClubSubscription = {
        id: newSubId,
        subscriptionCode: cardCode,
        personType: cleanDigits(sel.candidate.cpfCnpj).length > 11 ? 'PJ' : 'PF',
        holderName: (sel.candidate.name || 'CLIENTE ASAAS').toUpperCase(),
        holderCpf: formatCpf(sel.candidate.cpfCnpj || ''),
        holderPhone: formatPhone(sel.candidate.phone || ''),
        holderEmail: sel.candidate.email || undefined,
        billingCycle: mainSub?.cycle === 'YEARLY' ? 'ANNUAL' : 'MONTHLY',
        paymentMethod: mapAsaasBillingTypeToMethod(chosenPayments[0]?.billingType || 'PIX'),
        installments: chosenPayments.length > 1 ? chosenPayments.length : 1,
        monthlyEquivalent: avgAmount,
        totalContractValue: Number((avgAmount * Math.max(1, chosenPayments.length)).toFixed(2)),
        dueDay: Number((chosenPayments[0]?.dueDate || '2026-11-10').slice(8, 10)) || 10,
        status: shouldActivate ? 'ACTIVE' : 'PENDING_TRANSFER',
        ...(shouldActivate ? { manualStatusOverride: true } : {}),
        origin: 'ADMIN',
        planSummaryLabel: `${modName} (Sincronizado Asaas)`,
        notes: isHalfPrice
          ? 'Mensalidades de R$ 25,00 importadas do Asaas — confirmar documento comprobatório.'
          : 'Mensalidades importadas do Asaas.',
        contractType: 'ADESAO_PF',
        contractAccepted: false,
        startDate: chosenPayments[0]?.dueDate || nowIso.slice(0, 10),
        endDate: '2027-10-31',
        asaasCustomerId: sel.candidate.customerId,
        asaasSubscriptionId: mainSub?.id || chosenPayments[0]?.subscriptionId,
        asaasPaymentId: chosenPayments[0]?.id,
        asaasInvoiceUrl: chosenPayments[0]?.invoiceUrl,
        members: [
          {
            id: `mem-${cardCode}`,
            subscriptionId: newSubId,
            role: 'TITULAR',
            modalityCode: modCode,
            modalityName: modName,
            planCycleLabel: modName,
            fullName: (sel.candidate.name || 'CLIENTE ASAAS').toUpperCase(),
            cpf: formatCpf(sel.candidate.cpfCnpj || ''),
            phone: formatPhone(sel.candidate.phone || ''),
            cardNumber: cardCode,
            holderCardNumber: cardCode,
            qrToken: `LC-${cardCode}`,
            frontCardUrl: isHalfPrice ? '/cards/7.png' : '/cards/17.png',
            backCardUrl: '/cards/24.png',
            validityLabel: '10/2027',
            monthlyValue: avgAmount,
            status: shouldActivate ? 'ACTIVE' : 'PENDING_TRANSFER',
            ...(shouldActivate ? { manualStatusOverride: true } : {}),
            createdAt: nowIso,
          },
        ],
        invoices: [],
        attachments: [],
        visits: [],
        additionalServices: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      nextSubs.unshift(newSub);
      targetIdx = 0;
      createdPendingSubs += 1;
    }

    if (targetIdx === -1) continue;

    const existingSub = nextSubs[targetIdx];
    const invoicesCopy: ClubInvoice[] = [...(existingSub.invoices || [])];
    const totalCount = Math.max(invoicesCopy.length + chosenPayments.length, chosenPayments.length);

    chosenPayments.forEach((p, idx) => {
      const mappedStatus = mapAsaasPaymentStatusToInvoiceStatus(p.status);
      const mappedMethod = mapAsaasBillingTypeToMethod(p.billingType);
      const dueStr = p.dueDate || nowIso.slice(0, 10);
      const refMonth =
        dueStr.length >= 7 ? `${dueStr.slice(5, 7)}/${dueStr.slice(0, 4)}` : '';

      const matchIdx = invoicesCopy.findIndex(
        (inv) =>
          (inv.asaasPaymentId && inv.asaasPaymentId === p.id) ||
          (!inv.asaasPaymentId &&
            inv.dueDate === dueStr &&
            Math.abs(Number(inv.amount || 0) - Number(p.value || 0)) < 0.05)
      );

      if (matchIdx >= 0) {
        const prevInv = invoicesCopy[matchIdx];
        invoicesCopy[matchIdx] = {
          ...prevInv,
          amount: Number(p.value || prevInv.amount),
          dueDate: dueStr,
          paidAt: mappedStatus === 'PAID' ? p.paidAt || prevInv.paidAt || nowIso : prevInv.paidAt,
          paymentMethod: mappedMethod,
          status: mappedStatus,
          asaasPaymentId: p.id,
          asaasInvoiceUrl: p.invoiceUrl || prevInv.asaasInvoiceUrl,
          description: p.description || prevInv.description,
        };
        updatedInvoices += 1;
      } else {
        invoicesCopy.push({
          id: `inv_asaas_${p.id}`,
          subscriptionId: existingSub.id,
          subscriptionCode: existingSub.subscriptionCode,
          holderName: existingSub.holderName,
          holderCpf: existingSub.holderCpf,
          holderPhone: existingSub.holderPhone,
          installmentNumber: p.installmentNumber || idx + 1,
          totalInstallments: totalCount,
          referenceMonth: refMonth,
          amount: Number(p.value || 0),
          dueDate: dueStr,
          paidAt: mappedStatus === 'PAID' ? p.paidAt || nowIso : undefined,
          paymentMethod: mappedMethod,
          status: mappedStatus,
          asaasPaymentId: p.id,
          asaasInvoiceUrl: p.invoiceUrl || undefined,
          description:
            p.description ||
            `Mensalidade Asaas${refMonth ? ` (${refMonth})` : ''}`,
          createdAt: nowIso,
        });
        importedInvoices += 1;
      }
    });

    invoicesCopy.sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));

    const updatedMembers = shouldActivate
      ? (existingSub.members || []).map((m) => ({
          ...m,
          status: 'ACTIVE' as SubscriptionStatus,
          manualStatusOverride: true,
        }))
      : existingSub.members;

    if (shouldActivate) {
      activatedSubs += 1;
    }

    nextSubs[targetIdx] = {
      ...existingSub,
      ...(shouldActivate
        ? {
            status: 'ACTIVE' as SubscriptionStatus,
            manualStatusOverride: true,
            members: updatedMembers,
          }
        : {}),
      asaasCustomerId: existingSub.asaasCustomerId || sel.candidate.customerId,
      asaasSubscriptionId:
        existingSub.asaasSubscriptionId ||
        sel.candidate.subscriptions?.[0]?.id ||
        chosenPayments[0]?.subscriptionId,
      invoices: invoicesCopy,
      updatedAt: nowIso,
    };
    updatedSubs += 1;
  }

  const nextState: ClubDatabaseState = {
    ...currentState,
    subscriptions: nextSubs,
    lastCardSequence: seq,
  };

  const saved = await saveClubState(nextState);
  return {
    state: saved,
    updatedSubs,
    activatedSubs,
    importedInvoices,
    updatedInvoices,
    createdPendingSubs,
  };
};

export const markClubInvoicePaid = async (
  subscriptionId: string,
  invoiceId: string,
  method?: ClubPaymentMethod,
  options?: {
    paidAt?: string;
    amount?: number;
    dueDate?: string;
    notes?: string;
  }
): Promise<ClubDatabaseState> => {
  const state = await fetchClubState();
  const sub = state.subscriptions.find((s) => s.id === subscriptionId);
  if (sub) {
    const inv = sub.invoices.find((i) => i.id === invoiceId);
    if (inv) {
      inv.status = 'PAID';
      inv.paidAt = options?.paidAt || new Date().toISOString();
      if (method) inv.paymentMethod = method;
      if (options?.amount !== undefined && !isNaN(options.amount)) {
        inv.amount = options.amount;
      }
      if (options?.dueDate) {
        inv.dueDate = options.dueDate;
      }
      if (options?.notes) {
        inv.notes = options.notes;
      }
    }
    // Se estava pendente ou vencida e não há mais faturas vencidas, ativa a assinatura e carteirinhas com comprovação em dia
    const hasOverdue = sub.invoices.some((i) => i.status === 'OVERDUE');
    if (!hasOverdue) {
      sub.members.forEach((m) => {
        m.status = isMemberBlockedForMissingDoc(m, sub) ? 'INACTIVE' : 'ACTIVE';
      });
      sub.status = sub.members.every((m) => m.status === 'INACTIVE')
        ? 'INACTIVE'
        : 'ACTIVE';
    }
    sub.manualStatusOverride = true;
    sub.transferCompleted = true;
    // Atualiza contrato oficial gerado com a confirmação de quitação / pagamento
    sub.contractContentHtml = renderSubscriptionContractHtml(sub, state.contractTemplates);
    sub.updatedAt = new Date().toISOString();
  }
  return saveClubState(state);
};

export const attachMemberProofDocument = async (
  subscriptionId: string,
  memberId: string,
  payload: {
    dataUrl: string;
    fileName: string;
    mimeType?: string;
    verifyImmediately?: boolean;
  }
): Promise<ClubDatabaseState> => {
  const state = await fetchClubState();
  const sub = state.subscriptions.find((s) => s.id === subscriptionId);
  if (!sub) return state;

  const member = sub.members.find((m) => m.id === memberId);
  if (!member) return state;

  const nowIso = new Date().toISOString();
  const permCode = sub.subscriptionCode || sub.holderCpf || sub.id;
  const resolvedMime =
    payload.mimeType ||
    (payload.dataUrl.startsWith('data:image/') ? 'image/jpeg' : 'application/pdf');

  // Sobe imediatamente para o Supabase Storage (`club-files`) + tabela `public.club_attachments`
  const savedAtt = await saveClubAttachmentAtomic(permCode, sub.id, member.id, {
    id: `att_doc_${member.id}_${Date.now()}`,
    name: payload.fileName,
    dataUrl: payload.dataUrl,
    mimeType: resolvedMime,
    createdAt: nowIso,
  });

  member.documentProofUrl = savedAtt.dataUrl;
  member.documentProofName = savedAtt.name;
  if (payload.verifyImmediately) {
    member.documentVerified = true;
    member.documentStatus = 'APROVADO';
  }
  const existingAtts = Array.isArray(member.attachments) ? member.attachments : [];
  member.attachments = [
    ...existingAtts,
    savedAtt,
  ];

  // Também registra na lista de anexos gerais da assinatura com identificação do integrante
  const subAtts = Array.isArray(sub.attachments) ? sub.attachments : [];
  sub.attachments = [
    ...subAtts,
    {
      ...savedAtt,
      id: `sub_doc_${member.id}_${Date.now()}`,
      title: `Comprovante [${member.role === 'TITULAR' ? 'Titular' : 'Dependente'}: ${member.fullName}] (${member.modalityName})`,
      category: 'DOCUMENTO_COMPROBATORIO',
      fileUrl: savedAtt.dataUrl,
      fileName: savedAtt.name,
      uploadedAt: nowIso,
      notes: `MEMBER_ID:${member.id}`,
    },
  ];

  sub.updatedAt = nowIso;
  sub.isModifiedFromSeed = true;

  const resolved = resolveSubscriptionInactivityStatus(sub);
  const subIdx = state.subscriptions.findIndex((s) => s.id === subscriptionId);
  if (subIdx >= 0) {
    state.subscriptions[subIdx] = resolved;
  }
  await saveMemberPermanentDocs(permCode, resolved, 'SOCIO_DOC_UPLOAD');
  return saveClubState(state, { waitForCloud: true });
};

export const verifyMemberProofDocument = async (
  subscriptionId: string,
  memberId: string,
  verified: boolean,
  rejectionReason?: string
): Promise<ClubDatabaseState> => {
  const state = await fetchClubState();
  const sub = state.subscriptions.find((s) => s.id === subscriptionId);
  if (!sub) return state;

  const member = sub.members.find((m) => m.id === memberId);
  if (!member) return state;

  member.documentVerified = verified;
  if (verified) {
    member.documentStatus = 'APROVADO';
    member.documentRejectionReason = undefined;
    member.documentVerifiedAt = new Date().toISOString();
    member.documentVerifiedBy = 'Administrador';
  } else if (rejectionReason) {
    member.documentStatus = 'REJEITADO';
    member.documentRejectionReason = rejectionReason;
  } else {
    member.documentStatus = memberHasProofUploaded(member, sub) ? 'EM_ANALISE' : 'PENDENTE_ANEXO';
  }

  sub.updatedAt = new Date().toISOString();
  sub.isModifiedFromSeed = true;

  const resolved = resolveSubscriptionInactivityStatus(sub);
  const subIdx = state.subscriptions.findIndex((s) => s.id === subscriptionId);
  if (subIdx >= 0) {
    state.subscriptions[subIdx] = resolved;
  }
  return saveClubState(state);
};

// ============================================================================
// MOTOR DE RENDERIZAÇÃO DE CONTRATOS (COM VARIÁVEIS DO LABCARD + TABELA FAMILIAR)
// ============================================================================
export const renderSubscriptionContractHtml = (
  subscription: ClubSubscription,
  templates: ClubContractTemplate[] = DEFAULT_CONTRACT_TEMPLATES
): string => {
  const tpl =
    templates.find((t) => t.id === subscription.contractType) ||
    DEFAULT_CONTRACT_TEMPLATES[0];

  const membersRows = subscription.members
    .map(
      (m, idx) => `
      <tr>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${idx + 1}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;"><strong>${m.fullName}</strong></td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${m.role}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${m.cpf || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${m.planCycleLabel}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-family: monospace;">${m.cardNumber}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">R$ ${m.monthlyValue.toFixed(2).replace('.', ',')}/mês</td>
      </tr>`
    )
    .join('');

  const familyTableHtml = `
    <div style="margin: 16px 0;">
      <strong style="color: #005200; font-size: 12px; text-transform: uppercase;">INTEGRANTES E CARTEIRINHAS VINCULADAS A ESTE CONTRATO (${subscription.members.length}):</strong>
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left;">
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">#</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Nome Completo</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Vínculo</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">CPF</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Modalidade</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Nº Cartão</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Valor Mensal</th>
          </tr>
        </thead>
        <tbody>
          ${membersRows}
        </tbody>
      </table>
    </div>
  `;

  const methodLabels: Record<string, string> = {
    PIX: 'PIX',
    CREDIT_CARD: 'Cartão de Crédito',
    DEBIT_CARD: 'Cartão de Débito',
    BOLETO: 'Boleto',
    CASH: 'Dinheiro',
    COURTESY: 'Gratuidade / Isento',
  };
  const chosenMethodLabel = methodLabels[subscription.paymentMethod] || subscription.paymentMethod;
  const monthlyStr = subscription.monthlyEquivalent.toFixed(2).replace('.', ',');
  const annualTotalNum =
    subscription.totalContractValue >= subscription.monthlyEquivalent * 10
      ? subscription.totalContractValue
      : Number((subscription.monthlyEquivalent * 12).toFixed(2));
  const annualTotalStr = annualTotalNum.toFixed(2).replace('.', ',');

  let financialSummaryHtml = '';
  if (subscription.monthlyEquivalent === 0 || subscription.paymentMethod === 'COURTESY') {
    financialSummaryHtml = `Modalidade de Cobrança: <strong>GRATUIDADE / ISENTO</strong> | Valor da Mensalidade: <strong>R$ 0,00</strong>`;
  } else if (subscription.billingCycle === 'ANNUAL') {
    if (subscription.paymentMethod === 'PIX') {
      financialSummaryHtml = `Modalidade de Cobrança: <strong>PLANO ANUAL — PIX (VALOR INTEGRAL À VISTA)</strong> | Valor Total do Contrato (1 Ano): <strong>R$ ${annualTotalStr}</strong>`;
    } else {
      const instCount = Math.max(1, Math.min(12, subscription.installments || 12));
      const instValStr = (annualTotalNum / instCount).toFixed(2).replace('.', ',');
      financialSummaryHtml = `Modalidade de Cobrança: <strong>PLANO ANUAL — CARTÃO DE CRÉDITO (VALOR INTEGRAL EM ${instCount}X)</strong> | Valor Total do Contrato (1 Ano): <strong>R$ ${annualTotalStr}</strong> (dividido em <strong>${instCount}x de R$ ${instValStr}</strong> no Cartão de Crédito)`;
    }
  } else {
    // PLANO MENSAL: exibe apenas o valor das mensalidades e as 12 cobranças recorrentes, sem "(Total do Contrato: R$ ...)"
    financialSummaryHtml = `Modalidade de Cobrança: <strong>MENSAL RECORRENTE (12 cobranças mensais via ${chosenMethodLabel})</strong> | Valor da Mensalidade: <strong>R$ ${monthlyStr}/mês</strong>`;
  }

  const isPaid =
    subscription.invoices?.some((i) => i.status === 'PAID') ||
    subscription.status === 'ACTIVE';

  const acceptedTermsList =
    subscription.contractAcceptedTerms && subscription.contractAcceptedTerms.length > 0
      ? subscription.contractAcceptedTerms
      : [
          'Termos e Condições Gerais de Uso, Adesão e Acesso (Balneário Família Lessa)',
          'Declaração expressa de veracidade de todos os dados cadastrais do titular e dependentes',
          'Autorização de cobrança conforme periodicidade e forma de pagamento selecionada',
          'Aceite digital com assinatura e validação eletrônica registrada nos servidores',
        ];

  const termsAcceptedHtml = `
    <div style="background: #f8fafc; border: 1.5px solid #bbf7d0; border-radius: 8px; padding: 14px 18px; margin: 20px 0; font-size: 11px;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
        <strong style="color: #005200; font-size: 12px; text-transform: uppercase;">
          ✔ TERMOS DE USO E DECLARAÇÕES ACEITAS NO CADASTRO / ADESÃO
        </strong>
        <span style="font-weight: bold; color: ${isPaid ? '#047857' : '#b45309'}; font-size: 10px; background: ${isPaid ? '#d1fae5' : '#fef3c7'}; padding: 2px 8px; border-radius: 4px;">
          ${isPaid ? 'PAGAMENTO CONFIRMADO' : 'AGUARDANDO PAGAMENTO'}
        </span>
      </div>
      <div style="margin-bottom: 6px; color: #334155;">
        O titular <strong>${subscription.holderName}</strong> (CPF: <strong>${subscription.holderCpf}</strong>, Tel: <strong>${subscription.holderPhone}</strong>, E-mail: <strong>${subscription.holderEmail || '-'}</strong>) confirmou e declarou no momento da contratação:
      </div>
      <ul style="margin: 4px 0 0 18px; padding: 0; line-height: 1.7; color: #0f172a;">
        ${acceptedTermsList.map((t) => `<li>✔ ${t}</li>`).join('')}
      </ul>
      <div style="margin-top: 10px; background: #ecfdf5; border: 1px solid #86efac; border-radius: 6px; padding: 8px 10px; color: #065f46; line-height: 1.55;">
        <strong>RESPALDO LEGAL DA ASSINATURA ELETRÔNICA (MP Nº 2.200-2/2001, ART. 10, § 2º • LEI Nº 14.063/2020 • CÓDIGO CIVIL ARTS. 104, 107 E 219):</strong>
        O aceite eletrônico manifestado e validado pelo próprio titular neste sistema constitui <strong>assinatura eletrônica legalmente válida, autêntica e vinculante</strong>, produzindo os exatos mesmos efeitos jurídicos e probatórios de uma <strong>assinatura presencial em documento físico</strong>.
      </div>
      <div style="margin-top: 10px; font-size: 10px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
        <strong>Data/Hora do Aceite Digital:</strong> ${new Date(subscription.contractSignedAt || subscription.createdAt).toLocaleString('pt-BR')} &nbsp;|&nbsp; 
        <strong>IP / Protocolo:</strong> ${subscription.contractSignatureIp || '187.56.24.112 (Assinatura Eletrônica Registrada)'} &nbsp;|&nbsp; 
        <strong>Termo Nº:</strong> ${subscription.subscriptionCode}
      </div>
    </div>
  `;

  const replacements: Record<string, string> = {
    '[/logo-admin]': 'BALNEÁRIO FAMÍLIA LESSA',
    '[/fantasia-admin]': 'BALNEÁRIO FAMÍLIA LESSA LTDA',
    '[/site-admin]': 'https://balneariolessa.com.br',
    '[/cnpj-admin]': '46.891.134/0001-40',
    '[/end-admin]': 'Via Araras, Setor 09',
    '[/num-admin]': 'S/N',
    '[/bairro-admin]': 'Zona Rural',
    '[/cidade-admin]': 'Ariquemes',
    '[/estado-admin]': 'RO',
    '[/cep-admin]': '76870-000',
    '[/fone1-admin]': '(69) 99262-6140',
    '[/card-pf]': subscription.subscriptionCode,
    '[/emissao-cartao-pf]': formatDateBR(subscription.startDate),
    '[/vencimento-cartao-pf]': formatDateBR(subscription.endDate),
    '[/nome-pf]': subscription.holderName,
    '[/cpf-pf]': subscription.holderCpf,
    '[/rg-pf]': subscription.holderRg || 'Não informado',
    '[/data-nasc-pf]': formatDateBR(subscription.holderBirthDate),
    '[/fone-pf]': subscription.holderPhone,
    '[/email-pf]': subscription.holderEmail || 'Não informado',
    '[/end-pf]': subscription.addressStreet || 'Não informado',
    '[/num-pf]': subscription.addressNumber || 'S/N',
    '[/complemento-pf]': subscription.addressComplement || '-',
    '[/bairro-pf]': subscription.addressNeighborhood || '-',
    '[/cidade-pf]': subscription.addressCity || 'Ariquemes',
    '[/estado-pf]': subscription.addressState || 'RO',
    '[/cep-pf]': subscription.addressCep || '76870-000',
    '[/plano-pf]': subscription.planSummaryLabel,
    '[/ciclo-plano-pf]': subscription.billingCycle === 'ANNUAL' ? 'ANUAL (12 MESES)' : 'MENSAL RECORRENTE',
    '[/valor-plano-pf]': monthlyStr,
    '[/valor-total-contrato]': annualTotalStr,
    '[/resumo-financeiro-contrato]': financialSummaryHtml,
    '[/data-cadastro-extenso]': formatDateExtenso(subscription.createdAt),
    '[/data-cadastro-ext-pf]': formatDateExtenso(subscription.createdAt),
    '[/dataAtualExt-admin]': formatDateExtenso(new Date().toISOString()),
    '[/data-assinatura-iso]': new Date(subscription.contractSignedAt || subscription.createdAt).toLocaleString('pt-BR'),
    '[/veiculo-modelo]': subscription.vehicleModel || 'Não informado',
    '[/veiculo-placa]': subscription.vehiclePlate || 'Não informado',
    '[/veiculo-cor]': subscription.vehicleColor || 'Não informado',
    '[/tabela-integrantes]': familyTableHtml,
    '[/termos-aceitos]': termsAcceptedHtml,
  };

  let html = tpl.contentHtml;
  Object.entries(replacements).forEach(([key, val]) => {
    html = html.split(key).join(val);
  });

  if (!html.includes('TERMOS DE USO E DECLARAÇÕES ACEITAS')) {
    if (html.includes('<!-- BLOCO-ASSINATURAS-IMPRESSAO -->')) {
      html = html.replace('<!-- BLOCO-ASSINATURAS-IMPRESSAO -->', `${termsAcceptedHtml}\n<!-- BLOCO-ASSINATURAS-IMPRESSAO -->`);
    } else {
      html = `${html}\n${termsAcceptedHtml}`;
    }
  }

  return html;
};

/**
 * Renderiza o Regulamento Interno / Termos de Uso completo (todas as 14 cláusulas)
 * com os dados do associado titular preenchidos.
 */
export const renderSiteTermsHtml = (
  subscription: ClubSubscription,
  templates: ClubContractTemplate[] = DEFAULT_CONTRACT_TEMPLATES,
  fallbackSiteTermsText?: string
): string => {
  const defaultTermsTpl = DEFAULT_CONTRACT_TEMPLATES.find((t) => t.id === 'TERMOS_SITE');
  const rawTplHtml =
    templates.find((t) => t.id === 'TERMOS_SITE')?.contentHtml ||
    defaultTermsTpl?.contentHtml ||
    '';

  if (rawTplHtml.trim()) {
    return rawTplHtml
      .replace(/\[\/nome-pf\]/g, subscription.holderName.toUpperCase())
      .replace(/\[\/cpf-pf\]/g, subscription.holderCpf || '—')
      .replace(/\[\/rg-pf\]/g, subscription.holderRg || '—')
      .replace(/\[\/plano-pf\]/g, subscription.planSummaryLabel || 'Lessa Club')
      .replace(/\[\/card-pf\]/g, subscription.subscriptionCode || '—')
      .replace(/\[\/data-cadastro-extenso\]/g, formatDateExtenso(subscription.startDate || subscription.createdAt));
  }

  const plainText = (fallbackSiteTermsText || DEFAULT_SITE_TERMS_TEXT)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  return `<div style="font-family: Arial, sans-serif; line-height: 1.75; color: #1e293b;">${plainText}</div>`;
};

/**
 * Imprime documento HTML completo em nova janela (ou iframe oculto caso pop-up esteja bloqueado).
 */
export const printDocumentHtml = (title: string, bodyHtml: string): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      @page { size: A4; margin: 15mm; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 28px 36px; color: #0f172a; font-size: 13px; line-height: 1.65; background: #ffffff; }
      h1, h2 { color: #005200; margin-top: 0; }
      table { width: 100%; border-collapse: collapse; }
      .page-break { page-break-before: always; margin-top: 32px; padding-top: 24px; border-top: 2px dashed #cbd5e1; }
      @media print {
        .no-print { display: none !important; }
        body { padding: 0; }
      }
    </style>
  </head>
  <body>
    <div class="no-print" style="margin-bottom:20px; display:flex; flex-wrap:wrap; gap:10px; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #cbd5e1; padding:12px 16px; border-radius:10px;">
      <span style="font-size:12px; color:#334155; font-weight:700;">Documento Oficial — Balneário Família Lessa LTDA</span>
      <button onclick="window.print()" style="padding:10px 20px; background:#005200; color:#ffffff; border:none; border-radius:8px; font-weight:700; font-size:13px; cursor:pointer;">
        Imprimir / Salvar em PDF
      </button>
    </div>
    ${bodyHtml}
  </body>
</html>`;

  const win = window.open('', '_blank', 'width=980,height=860');
  if (win) {
    win.document.open();
    win.document.write(fullHtml);
    win.document.close();
    win.focus();
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        // O botão Imprimir / Salvar em PDF permanece disponível na janela aberta
      }
    }, 350);
    return true;
  }

  // Fallback via iframe oculto caso o navegador bloqueie pop-ups
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc || !iframe.contentWindow) {
    iframe.remove();
    return false;
  }
  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => iframe.remove(), 2500);
    }
  }, 350);
  return true;
};

// ============================================================================
// ============================================================================
// BUSCA RÁPIDA (LUPA FLUTUANTE / PORTARIA / QR CODE)
// ============================================================================
export const normalizeSearchText = (str?: string | null): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const scoreSearchMatch = (
  text: string,
  query: string
): number => {
  const tNorm = normalizeSearchText(text);
  const qNorm = normalizeSearchText(query);
  if (!tNorm || !qNorm) return 0;

  // 1. Igualdade exata
  if (tNorm === qNorm) return 1000;

  // 2. O texto completo começa exatamente com o termo pesquisado (ex: "elsa buenos aires" começa com "elsa bue")
  if (tNorm.startsWith(qNorm)) return 980;

  const tWords = tNorm.split(' ').filter(Boolean);
  const qWords = qNorm.split(' ').filter(Boolean);
  if (qWords.length === 0 || tWords.length === 0) return 0;

  // 3. Busca com termo único (ex: "elsa", "bueno", "silva")
  if (qWords.length === 1) {
    const qw = qWords[0];
    // Primeiro nome começa exatamente com o termo (ex: "Elsa" ao digitar "els")
    if (tWords[0].startsWith(qw)) return 920;
    // Sobrenome começa exatamente com o termo (ex: "Buenos" ao digitar "bue")
    if (tWords.slice(1).some((tw) => tw.startsWith(qw))) return 860;
    // Algum nome ou sobrenome contém o termo (a partir de 3 caracteres)
    if (qw.length >= 3 && tWords.some((tw) => tw.includes(qw))) return 600;
    return 0;
  }

  // 4. Busca com múltiplos termos (ex: "elsa bue", "maria silva", "silva joao")
  // Todas as palavras digitadas DEVEM ser satisfeitas por palavras do nome
  let allPrefixes = true;
  let allSubstrings = true;

  for (const qw of qWords) {
    const hasPrefix = tWords.some((tw) => tw.startsWith(qw));
    const hasSubstring = hasPrefix || (qw.length >= 2 && tWords.some((tw) => tw.includes(qw)));
    if (!hasPrefix) allPrefixes = false;
    if (!hasSubstring) {
      allSubstrings = false;
      break;
    }
  }

  if (!allSubstrings) return 0;

  const firstWordMatches = tWords[0].startsWith(qWords[0]);
  if (firstWordMatches && allPrefixes) return 950;
  if (allPrefixes) return 900;
  if (firstWordMatches) return 850;
  return 750;
};

export const findMemberOrSubscriptionByQuery = (
  state: ClubDatabaseState,
  query: string
): Array<{ member: ClubMember; subscription: ClubSubscription }> => {
  const qRaw = (query || '').trim();
  if (!qRaw) return [];
  const qNorm = normalizeSearchText(qRaw);
  const qDigits = cleanDigits(qRaw);
  if (!qNorm && !qDigits) return [];

  const scoredResults: Array<{
    member: ClubMember;
    subscription: ClubSubscription;
    score: number;
    isDirectNameMatch: boolean;
    createdAt: number;
  }> = [];

  for (const sub of (state.subscriptions || [])) {
    const subCreatedTime = new Date(sub.createdAt || sub.startDate || 0).getTime();
    const holderScore = scoreSearchMatch(sub.holderName, qRaw);

    for (const member of (sub.members || [])) {
      let maxScore = 0;
      let isDirectNameMatch = false;

      // 1. Busca pelo nome do próprio integrante (prioridade total)
      const ownNameScore = scoreSearchMatch(member.fullName, qRaw);
      if (ownNameScore > 0) {
        maxScore = ownNameScore;
        isDirectNameMatch = true;
      }

      // 2. Se o próprio nome não casou, mas o titular da assinatura casou:
      // Concede pontuação secundária para que o dependente apareça após quem realmente tem o nome buscado
      if (!isDirectNameMatch && holderScore > 0) {
        maxScore = Math.max(maxScore, Math.max(300, holderScore - 250));
      }

      // 3. E-mail
      if (sub.holderEmail) {
        const emNorm = normalizeSearchText(sub.holderEmail);
        if (emNorm === qNorm) maxScore = Math.max(maxScore, 950);
        else if (emNorm.startsWith(qNorm)) maxScore = Math.max(maxScore, 850);
        else if (qNorm.length >= 3 && emNorm.includes(qNorm)) maxScore = Math.max(maxScore, 500);
      }

      // 4. Carteirinha / Código / Token
      const mCard = (member.cardNumber || '').trim().toLowerCase();
      const sCode = (sub.subscriptionCode || '').trim().toLowerCase();
      const mCardDigits = cleanDigits(member.cardNumber);
      const sCodeDigits = cleanDigits(sub.subscriptionCode);

      if (qDigits && qDigits.length >= 3) {
        if (mCardDigits === qDigits || sCodeDigits === qDigits) {
          maxScore = Math.max(maxScore, 1000);
        } else if (mCardDigits.startsWith(qDigits) || sCodeDigits.startsWith(qDigits)) {
          maxScore = Math.max(maxScore, 880);
        } else if (qDigits.length >= 4 && (mCardDigits.endsWith(qDigits) || sCodeDigits.endsWith(qDigits))) {
          maxScore = Math.max(maxScore, 860);
        }
      }

      if (qNorm && (mCard === qNorm || sCode === qNorm)) {
        maxScore = Math.max(maxScore, 1000);
      } else if (qNorm && (mCard.startsWith(qNorm) || sCode.startsWith(qNorm))) {
        maxScore = Math.max(maxScore, 880);
      }

      // 5. CPF
      if (qDigits && qDigits.length >= 3) {
        const mCpfDigits = cleanDigits(member.cpf);
        const hCpfDigits = cleanDigits(sub.holderCpf);
        if (mCpfDigits === qDigits || hCpfDigits === qDigits) {
          maxScore = Math.max(maxScore, 1000);
        } else if (mCpfDigits.startsWith(qDigits) || hCpfDigits.startsWith(qDigits)) {
          maxScore = Math.max(maxScore, 880);
        } else if (qDigits.length >= 4 && (mCpfDigits.includes(qDigits) || hCpfDigits.includes(qDigits))) {
          maxScore = Math.max(maxScore, 650);
        }
      }

      if (maxScore > 0) {
        scoredResults.push({
          member,
          subscription: sub,
          score: maxScore,
          isDirectNameMatch,
          createdAt: subCreatedTime,
        });
      }
    }
  }

  scoredResults.sort((a, b) => {
    // 1º Prioridade: Score maior
    if (b.score !== a.score) return b.score - a.score;
    // 2º Prioridade: Quem tem match direto no próprio nome ganha de vínculo familiar
    if (a.isDirectNameMatch !== b.isDirectNameMatch) return a.isDirectNameMatch ? -1 : 1;
    // 3º Prioridade: Titular antes de dependente
    if (a.member.role !== b.member.role) return a.member.role === 'TITULAR' ? -1 : 1;
    // 4º Prioridade: Mais recente
    return b.createdAt - a.createdAt;
  });

  return scoredResults.map(({ member, subscription }) => ({ member, subscription }));
};

export const getConsultantSlug = (name?: string | null): string => {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const buildConsultantReferralUrl = (
  baseUrl: string,
  consultant: Pick<ClubConsultant, 'referralCode' | 'name'>,
  planCode?: string
): string => {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const slug = getConsultantSlug(consultant.name);
  const params = new URLSearchParams();
  if (slug) params.set('consultor', slug);
  params.set('ref', consultant.referralCode);
  if (planCode && planCode !== 'TODOS') {
    params.set('plano', planCode);
  }
  return `${cleanBase}/planos?${params.toString()}`;
};

export const findConsultantByParams = (
  consultants: ClubConsultant[],
  refParam?: string | null,
  consultorParam?: string | null
): ClubConsultant | null => {
  if (!consultants || consultants.length === 0) return null;
  const refNorm = (refParam || '').trim().toLowerCase();
  const consNorm = getConsultantSlug(consultorParam || '');

  if (!refNorm && !consNorm) return null;

  const activeFirst = [...consultants].sort((a, b) =>
    a.status === 'ACTIVE' && b.status !== 'ACTIVE' ? -1 : b.status === 'ACTIVE' && a.status !== 'ACTIVE' ? 1 : 0
  );

  if (refNorm) {
    const byCodeOrId = activeFirst.find(
      (c) =>
        c.referralCode.toLowerCase() === refNorm ||
        c.id.toLowerCase() === refNorm ||
        getConsultantSlug(c.name) === refNorm
    );
    if (byCodeOrId) return byCodeOrId;
  }

  if (consNorm) {
    const bySlug = activeFirst.find((c) => getConsultantSlug(c.name) === consNorm);
    if (bySlug) return bySlug;
  }

  return null;
};

const MODALITY_ALIAS_GROUPS: Record<string, string[]> = {
  ADULTO: ['ADULTO', 'LESSA_CLUB', 'LESSA CLUB', 'DUO_CLUB'],
  PUBLICIDADE: ['PUBLICIDADE', 'FAMILY_PUBLICIDADE', 'PERMUTA'],
  ESTUDANTE: ['ESTUDANTE', 'STUDENT_PASS', 'STUDENT'],
  PROFESSOR: ['PROFESSOR', 'PROFESSOR_PASS'],
  SERVIDOR: ['SERVIDOR', 'SERVIDOR_PASS'],
  PCD_TEA: ['PCD_TEA', 'INCLUSAO', 'PCD', 'TEA'],
  IDOSO_60: ['IDOSO_60', 'VITALICIO_60', 'VITALICIO', '60+'],
  KIDS: ['KIDS', 'LESSA_KIDS', 'CRIANCA'],
  PARCEIRO: ['PARCEIRO', 'EMPRESA', 'LESSA_PARCEIRO'],
  CORPORATE: ['CORPORATE', 'CORPORATE_PASS', 'COLABORADOR'],
  SEM_PLANO: ['SEM_PLANO', 'INATIVO'],
};

const matchesPlanCodeToken = (allowedToken: string, targetCode: string, targetName = ''): boolean => {
  const a = allowedToken.toUpperCase().trim();
  const c = targetCode.toUpperCase().trim();
  const n = targetName.toUpperCase().trim();
  if (!a) return false;
  if (a === c || (n && (a === n || n.includes(a) || a.includes(n)))) return true;

  for (const [, aliases] of Object.entries(MODALITY_ALIAS_GROUPS)) {
    const targetInGroup = aliases.some((al) => c === al || c.includes(al) || n.includes(al));
    const allowedInGroup = aliases.some((al) => a === al || a.includes(al));
    if (targetInGroup && allowedInGroup) return true;
  }
  return false;
};

export const doesConsultantAllowModality = (
  allowedPlanCodes: string[] | undefined,
  modality: { id?: string; code: string; name?: string }
): boolean => {
  if (!allowedPlanCodes || allowedPlanCodes.length === 0) return true;
  return allowedPlanCodes.some(
    (token) =>
      matchesPlanCodeToken(token, modality.code, modality.name || '') ||
      (!!modality.id && token.toUpperCase().trim() === modality.id.toUpperCase().trim())
  );
};

export interface SelectableConsultantPlan {
  code: string;
  name: string;
  subtitle: string;
  monthlyPrice: number;
  annualPrice: number;
  isFreeTier?: boolean;
}

export const getSelectablePlansForConsultants = (
  modalities?: ClubModality[]
): SelectableConsultantPlan[] => {
  const source = modalities && modalities.length > 0 ? modalities : DEFAULT_CLUB_MODALITIES;
  const seen = new Set<string>();
  const result: SelectableConsultantPlan[] = [];
  source.forEach((m) => {
    if (m.active === false) return;
    const code = m.code.toUpperCase().trim();
    if (seen.has(code)) return;
    seen.add(code);
    result.push({
      code,
      name: m.name,
      subtitle: m.subtitle || '',
      monthlyPrice: Number(m.monthlyPrice || 0),
      annualPrice: Number(m.annualPrice || 0),
      isFreeTier: m.isFreeTier,
    });
  });
  return result;
};

export interface ConsultantPaidSaleDetail {
  subscription: ClubSubscription;
  paidAt: string;
  planValue: number;
  paidAmount: number;
  commissionValue: number;
}

export interface ConsultantMetricsSummary {
  linkedSubs: ClubSubscription[];
  paidSales: ConsultantPaidSaleDetail[];
  pendingSubs: ClubSubscription[];
  paidCount: number;
  totalPaidVolume: number;
  totalPaidCommission: number;
}

export const getConsultantSubscriptionMetrics = (
  consultant: ClubConsultant,
  subscriptions: ClubSubscription[]
): ConsultantMetricsSummary => {
  const nameLower = consultant.name.trim().toLowerCase();
  const codeLower = consultant.referralCode.trim().toLowerCase();

  const linkedSubs = (subscriptions || []).filter(
    (s) =>
      (s.consultantId && s.consultantId === consultant.id) ||
      (s.consultantCode && s.consultantCode.trim().toLowerCase() === codeLower) ||
      (s.consultantName && s.consultantName.trim().toLowerCase() === nameLower) ||
      (s.influencerName && s.influencerName.trim().toLowerCase() === nameLower)
  );

  const paidSales: ConsultantPaidSaleDetail[] = [];
  const pendingSubs: ClubSubscription[] = [];

  linkedSubs.forEach((sub) => {
    const paidInvoices = (sub.invoices || []).filter((inv) => inv.status === 'PAID');
    const paidAmount = Number(
      paidInvoices.reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0).toFixed(2)
    );
    const hasPaidInvoice = paidInvoices.length > 0;
    const isEffectivelyPaid =
      sub.totalContractValue === 0 && sub.monthlyEquivalent === 0
        ? sub.status === 'ACTIVE'
        : hasPaidInvoice || sub.status === 'ACTIVE';

    if (!isEffectivelyPaid) {
      pendingSubs.push(sub);
      return;
    }

    const contractValue = Number(
      (
        sub.totalContractValue ||
        (sub.monthlyEquivalent > 0 ? sub.monthlyEquivalent * 12 : 0) ||
        paidAmount
      ).toFixed(2)
    );

    // Se comissão for recorrente: calcula sobre tudo já pago; se apenas 1ª adesão: sobre o valor do contrato (anual) ou 1ª fatura paga (mensal)
    const commissionBaseValue =
      consultant.commissionRecurring && !consultant.commissionFirstOnly
        ? paidAmount || contractValue
        : sub.billingCycle === 'ANNUAL'
        ? contractValue
        : paidInvoices[0]?.amount || sub.monthlyEquivalent || contractValue;

    let comVal = 0;
    if (consultant.commissionType === 'FIXED') {
      const unitFixed = Number(consultant.commissionValue || 0);
      comVal =
        consultant.commissionRecurring && !consultant.commissionFirstOnly && paidInvoices.length > 0
          ? Number((unitFixed * paidInvoices.length).toFixed(2))
          : unitFixed;
    } else {
      const pct = Number(consultant.commissionPercent || consultant.commissionValue || 10);
      comVal = Number(((commissionBaseValue * pct) / 100).toFixed(2));
    }

    const latestPaidInv = paidInvoices[paidInvoices.length - 1] || paidInvoices[0];
    paidSales.push({
      subscription: sub,
      paidAt: latestPaidInv?.paidAt || sub.updatedAt || sub.createdAt,
      planValue: contractValue,
      paidAmount,
      commissionValue: comVal,
    });
  });

  const totalPaidVolume = Number(
    paidSales.reduce((acc, item) => acc + item.planValue, 0).toFixed(2)
  );
  const totalPaidCommission = Number(
    paidSales.reduce((acc, item) => acc + item.commissionValue, 0).toFixed(2)
  );

  return {
    linkedSubs,
    paidSales,
    pendingSubs,
    paidCount: paidSales.length,
    totalPaidVolume,
    totalPaidCommission,
  };
};

export const trackConsultantClick = async (consultantIdOrCode: string): Promise<void> => {
  if (!consultantIdOrCode) return;
  try {
    const current = await fetchClubState();
    const updated = (current.consultants || []).map((c) => {
      if (
        c.id === consultantIdOrCode ||
        c.referralCode.toLowerCase() === consultantIdOrCode.toLowerCase()
      ) {
        return { ...c, clicksCount: (c.clicksCount || 0) + 1 };
      }
      return c;
    });
    await saveClubState({ ...current, consultants: updated });
  } catch (err) {
    console.error('Erro ao registrar clique do consultor:', err);
  }
};

// ============================================================================
// DADOS DE ACESSO AO PORTAL DO SÓCIO (USUÁRIO = EMAIL, SENHA = DATA NASC. DDMMAAAA)
// ============================================================================
export const getMemberAccessMessage = (sub: ClubSubscription): { message: string; text: string; whatsappUrl: string; loginUser: string; login: string; password: string } => {
  const loginUser = sub.holderEmail || sub.holderCpf;
  const password = getBirthDatePassword(sub.holderBirthDate);
  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/socio` : 'https://balneariolessa.com.br/socio';

  const message = `🌿 *BALNEÁRIO FAMÍLIA LESSA — BEM-VINDO AO LESSA CLUB!* 🌿\n\nOlá, *${sub.holderName}*! Seu plano foi cadastrado com sucesso.\n\nVocê já pode acessar o Portal do Sócio para ver suas carteirinhas digitais com QR Code, enviar fotos e consultar seu contrato:\n\n🌐 *Portal do Sócio:* ${portalUrl}\n👤 *Usuário (Login):* ${loginUser}\n🔑 *Senha:* ${password}\n\nGuarde esses dados com carinho. Qualquer dúvida, estamos à disposição!`;

  const phone = cleanDigits(sub.holderPhone);
  const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
  const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;

  return { message, text: message, whatsappUrl, loginUser, login: loginUser, password };
};

// ============================================================================
// BUSCA ROBUSTA DE CEP (ViaCEP + Fallback BrasilAPI)
// ============================================================================
export interface CepAddressResult {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

export const fetchAddressByCep = async (rawCep: string): Promise<CepAddressResult | null> => {
  const digits = (rawCep || '').replace(/\D/g, '');
  if (digits.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await res.json();
    if (data && !data.erro) {
      return {
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        localidade: data.localidade || 'Ariquemes',
        uf: data.uf || 'RO',
      };
    }
  } catch (err) {
    console.warn('[CEP] ViaCEP falhou, tentando fallback BrasilAPI...', err);
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`);
    const data = await res.json();
    if (data && !data.errors) {
      return {
        logradouro: data.street || '',
        bairro: data.neighborhood || '',
        localidade: data.city || 'Ariquemes',
        uf: data.state || 'RO',
      };
    }
  } catch (err) {
    console.warn('[CEP] BrasilAPI também falhou:', err);
  }

  return null;
};

/**
 * Retorna true quando a data (YYYY-MM-DD ou ISO) já expirou (anterior à data atual local).
 */
export const isClubDateExpired = (dateStr?: string | null): boolean => {
  if (!dateStr) return false;
  const isoDay = dateStr.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) return false;
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return isoDay < todayIso;
};

/**
 * Converte data YYYY-MM-DD para rótulo MM/YYYY exibido nas carteirinhas.
 */
export const getValidityLabelFromDate = (dateStr?: string | null, fallback = ''): string => {
  if (!dateStr) return fallback;
  const isoDay = dateStr.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) return fallback;
  const [yyyy, mm] = isoDay.split('-');
  return `${mm}/${yyyy}`;
};

// ============================================================================
// INTEGRAÇÃO API LABCARD (https://api.cartaobl.com.br/docs/api-docs.json)
// ============================================================================

export interface LabcardApiClientRecord {
  id?: number | string;
  registro_plano?: string;
  num_card?: string | number;
  num_card_titular?: string | number;
  id_cartao_padrao?: number;
  nome?: string;
  data_nascimento?: string;
  rg?: string;
  cpf?: string;
  cnpj?: string;
  sexo?: string;
  estado_civil?: string;
  ddd?: string;
  telefone?: string;
  email?: string;
  cep?: string;
  endereco?: string;
  num?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  vencimento_cartao?: string;
  registro_consultor?: string | number;
  registro_empresa?: string | number;
  situacao_cadastral?: string;
  titular?: string | number | boolean;
  status?: string | number;
  liberado?: string | number;
  excluido?: string | number;
  cancelado?: string | number;
  plano?: string;
  valor?: string | number;
  created_at?: string;
  adicionais?: any;
  cartoes?: any;
  [key: string]: any;
}

export interface LabcardApiInitResponse {
  token: string;
  hasServerCredentials: boolean;
  currentPage: number;
  lastPage: number;
  perPage: number;
  totalClientes: number;
  clientes: LabcardApiClientRecord[];
  consultores: any[];
  empresas: any[];
  planos: any[];
  sampleKeys: string[];
}

export interface LabcardEnrichStats {
  totalApiRecords: number;
  matchedSubscriptions: number;
  newTitularesCount: number;
  newDependentsAdded: number;
  emailsFilled: number;
  addressesFilled: number;
  rgsFilled: number;
  validitiesUpdated: number;
  consultantsLinked: number;
  boletosImported: number;
  hasExtraMediaField: string[];
}

export const checkLabcardServerStatus = async (): Promise<{
  hasServerCredentials: boolean;
  baseUrl: string;
}> => {
  const { data, error } = await supabase.functions.invoke('sync-labcard', {
    body: { action: 'status' },
  });
  if (error || !data) {
    return { hasServerCredentials: false, baseUrl: 'https://api.cartaobl.com.br' };
  }
  return {
    hasServerCredentials: Boolean(data.hasServerCredentials),
    baseUrl: String(data.baseUrl || 'https://api.cartaobl.com.br'),
  };
};

const extractInvokeErrorMessage = async (
  error: any,
  data: any,
  fallback: string
): Promise<string> => {
  if (data?.error) return String(data.error);
  try {
    if (error?.context && typeof error.context.json === 'function') {
      const ctx = await error.context.json();
      if (ctx?.error) return String(ctx.error);
      if (ctx?.message) return String(ctx.message);
    }
  } catch {
    // ignorar falha ao ler body de erro
  }
  return error?.message || fallback;
};

export const initLabcardApiSync = async (creds?: {
  usuario?: string;
  senha?: string;
}): Promise<LabcardApiInitResponse> => {
  const { data, error } = await supabase.functions.invoke('sync-labcard', {
    body: {
      action: 'init',
      usuario: creds?.usuario,
      senha: creds?.senha,
    },
  });
  if (error || data?.error || data?.ok === false) {
    throw new Error(
      await extractInvokeErrorMessage(error, data, 'Erro ao autenticar na API do Labcard.')
    );
  }
  return data as LabcardApiInitResponse;
};

export const fetchLabcardClientesPages = async (
  token: string,
  startPage: number,
  endPage: number
): Promise<{
  items: LabcardApiClientRecord[];
  lastPage: number;
  totalClientes: number;
}> => {
  const { data, error } = await supabase.functions.invoke('sync-labcard', {
    body: {
      action: 'fetch-clientes-pages',
      token,
      startPage,
      endPage,
    },
  });
  if (error || data?.error || data?.ok === false) {
    throw new Error(
      await extractInvokeErrorMessage(
        error,
        data,
        `Erro ao baixar páginas ${startPage}-${endPage} do Labcard.`
      )
    );
  }
  return data;
};

export const fetchLabcardBoletos = async (
  token: string,
  startPage = 1,
  maxPages = 12
): Promise<{ boletos: any[]; lastPage: number; total: number }> => {
  const { data, error } = await supabase.functions.invoke('sync-labcard', {
    body: {
      action: 'fetch-boletos',
      token,
      startPage,
      maxPages,
    },
  });
  if (error || data?.error || data?.ok === false) {
    throw new Error(
      await extractInvokeErrorMessage(error, data, 'Erro ao buscar boletos do Labcard.')
    );
  }
  return data;
};

const normalizeIsoDateFromLabcard = (raw?: string | null): string => {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === '0000-00-00') return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const br = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return '';
};

const isLabcardTitularRecord = (rec: LabcardApiClientRecord): boolean => {
  const numCard = cleanDigits(String(rec.num_card || ''));
  const holderCard = cleanDigits(String(rec.num_card_titular || ''));
  const titFlag = String(rec.titular ?? '').trim().toLowerCase();
  if (['1', 'sim', 'true', 'titular', 's'].includes(titFlag)) return true;
  if (['0', 'nao', 'não', 'false', 'dependente', 'dep', 'n'].includes(titFlag)) return false;
  if (!holderCard || (numCard && holderCard === numCard)) return true;
  return false;
};

const normalizeGender = (raw?: string | null): string => {
  const s = String(raw || '').trim();
  if (!s) return '';
  const up = s.toUpperCase();
  if (up === 'M' || up.startsWith('MASC')) return 'Masculino';
  if (up === 'F' || up.startsWith('FEM')) return 'Feminino';
  return s;
};

const normalizeLabcardPhone = (ddd?: string, tel?: string): string => {
  const d = cleanDigits(String(ddd || ''));
  const t = cleanDigits(String(tel || ''));
  if (!t) return '';
  if (d && !t.startsWith(d) && t.length <= 9) {
    return formatPhone(`${d}${t}`);
  }
  return formatPhone(t);
};

const detectExtraMediaKeys = (records: LabcardApiClientRecord[]): string[] => {
  if (!records || records.length === 0) return [];
  const sampleKeys = new Set<string>();
  records.slice(0, 25).forEach((r) => {
    if (r && typeof r === 'object') {
      Object.keys(r).forEach((k) => {
        if (/(foto|img|imag|anex|doc|file|arquiv|pdf|avatar|midia|comprov)/i.test(k)) {
          sampleKeys.add(k);
        }
      });
    }
  });
  return Array.from(sampleKeys);
};

export const applyLabcardFullEnrichment = async (
  currentState: ClubDatabaseState,
  payload: {
    clientes: LabcardApiClientRecord[];
    consultores?: any[];
    empresas?: any[];
    planos?: any[];
    boletos?: any[];
  },
  options: {
    includeNewClients: boolean;
    includeBoletos: boolean;
  }
): Promise<{
  state: ClubDatabaseState;
  stats: LabcardEnrichStats;
}> => {
  const nowIso = new Date().toISOString();
  const nextSubs = currentState.subscriptions.map((s) => ({
    ...s,
    members: [...(s.members || [])],
    invoices: [...(s.invoices || [])],
    additionalServices: [...(s.additionalServices || [])],
  }));

  // Mapas de apoio de Consultores, Empresas e Planos
  const consultorMap = new Map<string, any>();
  (payload.consultores || []).forEach((c) => {
    [c.id, c.registro, c.codigo, c.registro_consultor, c.num_card]
      .filter((k) => k !== undefined && k !== null && String(k).trim() !== '')
      .forEach((k) => consultorMap.set(String(k).trim(), c));
  });

  const empresaMap = new Map<string, any>();
  (payload.empresas || []).forEach((e) => {
    [e.id, e.registro, e.registro_empresa]
      .filter((k) => k !== undefined && k !== null && String(k).trim() !== '')
      .forEach((k) => empresaMap.set(String(k).trim(), e));
  });

  const planoMap = new Map<string, any>();
  (payload.planos || []).forEach((p) => {
    [p.id, p.registro, p.registro_plano]
      .filter((k) => k !== undefined && k !== null && String(k).trim() !== '')
      .forEach((k) => planoMap.set(String(k).trim(), p));
  });

  // Índices rápidos das assinaturas existentes por num_card e CPF
  const subIdxByCard = new Map<string, number>();
  const subIdxByCpf = new Map<string, number>();
  nextSubs.forEach((s, idx) => {
    const codeDigits = cleanDigits(s.subscriptionCode);
    if (codeDigits) subIdxByCard.set(codeDigits, idx);
    const cpfDigits = cleanDigits(s.holderCpf);
    if (cpfDigits && cpfDigits.length >= 11 && !subIdxByCpf.has(cpfDigits)) {
      subIdxByCpf.set(cpfDigits, idx);
    }
    (s.members || []).forEach((m) => {
      const mCard = cleanDigits(m.cardNumber);
      if (mCard && !subIdxByCard.has(mCard)) subIdxByCard.set(mCard, idx);
    });
  });

  const titulares: LabcardApiClientRecord[] = [];
  const dependentes: LabcardApiClientRecord[] = [];

  (payload.clientes || []).forEach((rec) => {
    if (!rec || typeof rec !== 'object') return;
    if (isLabcardTitularRecord(rec)) titulares.push(rec);
    else dependentes.push(rec);
  });

  const stats: LabcardEnrichStats = {
    totalApiRecords: (payload.clientes || []).length,
    matchedSubscriptions: 0,
    newTitularesCount: 0,
    newDependentsAdded: 0,
    emailsFilled: 0,
    addressesFilled: 0,
    rgsFilled: 0,
    validitiesUpdated: 0,
    consultantsLinked: 0,
    boletosImported: 0,
    hasExtraMediaField: detectExtraMediaKeys(payload.clientes || []),
  };

  const resolveLabcardModalityInfo = (planText?: string) => {
    const p = String(planText || '').toLowerCase();
    if (p.includes('estudant') || p.includes('student')) {
      return { code: 'ESTUDANTE', name: 'Lessa Student Pass', front: '/cards/6.png', back: '/cards/24.png', price: 25 };
    }
    if (p.includes('professor')) {
      return { code: 'PROFESSOR', name: 'Lessa Professor Pass', front: '/cards/3.png', back: '/cards/24.png', price: 25 };
    }
    if (p.includes('servidor')) {
      return { code: 'SERVIDOR', name: 'Lessa Servidor Pass', front: '/cards/10.png', back: '/cards/24.png', price: 25 };
    }
    if (p.includes('kids') || p.includes('infantil')) {
      return { code: 'KIDS', name: 'Lessa Kids', front: '/cards/38.png', back: '/cards/39.png', price: 0 };
    }
    if (p.includes('60') || p.includes('idoso') || p.includes('vital')) {
      return { code: 'IDOSO_60', name: 'Lessa Vitalício 60+', front: '/cards/26.png', back: '/cards/39.png', price: 0 };
    }
    if (p.includes('pcd') || p.includes('tea') || p.includes('inclus') || p.includes('pdc')) {
      return { code: 'PCD_TEA', name: 'Lessa Inclusão - PCD e TEA', front: '/cards/35.png', back: '/cards/24.png', price: 0 };
    }
    let price = 49.9;
    let name = 'Lessa Club';
    if (/(?:^|[^\d])5(?:\s*pessoas|\s*vidas)/i.test(p) || p.includes('249,5') || p.includes('249.5')) {
      price = 249.5;
      name = 'Lessa Club (5 pessoas)';
    } else if (/(?:^|[^\d])4(?:\s*pessoas|\s*vidas)/i.test(p) || p.includes('199,6') || p.includes('199.6')) {
      price = 199.6;
      name = 'Lessa Club (4 pessoas)';
    } else if (/(?:^|[^\d])3(?:\s*pessoas|\s*vidas)/i.test(p) || p.includes('149,7') || p.includes('149.7')) {
      price = 149.7;
      name = 'Lessa Club (3 pessoas)';
    } else if (/(?:^|[^\d])2(?:\s*pessoas|\s*vidas)/i.test(p) || p.includes('99,8') || p.includes('99.8')) {
      price = 99.8;
      name = 'Lessa Club (2 pessoas)';
    }
    return { code: 'ADULTO', name, front: '/cards/44.png', back: '/cards/24.png', price };
  };

  // Agrupar boletos por número do cartão quando solicitados
  const boletosByCard = new Map<string, any[]>();
  if (options.includeBoletos && Array.isArray(payload.boletos)) {
    payload.boletos.forEach((b) => {
      const cardDigits = cleanDigits(String(b.num_card || b.num_card_titular || ''));
      if (!cardDigits) return;
      const list = boletosByCard.get(cardDigits) || [];
      list.push(b);
      boletosByCard.set(cardDigits, list);
    });
  }

  // Função auxiliar para aplicar dados da API sobre um ClubMember preservando status/mídias
  const enrichMemberFromApi = (member: ClubMember, rec: LabcardApiClientRecord): ClubMember => {
    const birthIso = normalizeIsoDateFromLabcard(rec.data_nascimento);
    const expIso = normalizeIsoDateFromLabcard(rec.vencimento_cartao);
    const rgStr = String(rec.rg || '').trim();
    const sexStr = normalizeGender(rec.sexo);
    const phoneStr = normalizeLabcardPhone(rec.ddd, rec.telefone);

    return {
      ...member,
      rg: member.rg || rgStr || undefined,
      birthDate: member.birthDate || birthIso || undefined,
      sex: member.sex || sexStr || undefined,
      phone: member.phone || phoneStr || undefined,
      expirationDate: member.expirationDate || expIso || undefined,
      validityLabel: expIso
        ? getValidityLabelFromDate(expIso, member.validityLabel)
        : member.validityLabel,
    };
  };

  // 1) Processar Titulares da API
  for (const rec of titulares) {
    const numCard = cleanDigits(String(rec.num_card || rec.num_card_titular || ''));
    const cpfDigits = cleanDigits(String(rec.cpf || ''));
    if (!numCard && cpfDigits.length < 11) continue;

    let subIdx = numCard ? subIdxByCard.get(numCard) ?? -1 : -1;
    if (subIdx === -1 && cpfDigits.length >= 11) {
      subIdx = subIdxByCpf.get(cpfDigits) ?? -1;
    }

    const emailStr = String(rec.email || '').trim();
    const rgStr = String(rec.rg || '').trim();
    const cnpjStr = cleanDigits(String(rec.cnpj || ''));
    const birthIso = normalizeIsoDateFromLabcard(rec.data_nascimento);
    const expIso = normalizeIsoDateFromLabcard(rec.vencimento_cartao);
    const createdIso = normalizeIsoDateFromLabcard(rec.created_at);
    const sexStr = normalizeGender(rec.sexo);
    const maritalStr = String(rec.estado_civil || '').trim();
    const phoneStr = normalizeLabcardPhone(rec.ddd, rec.telefone);

    const cepStr = String(rec.cep || '').trim();
    const streetStr = String(rec.endereco || '').trim();
    const numStr = String(rec.num || '').trim();
    const compStr = String(rec.complemento || '').trim();
    const bairroStr = String(rec.bairro || '').trim();
    const cityStr = String(rec.cidade || '').trim();
    const stateStr = String(rec.estado || '').trim();

    const consultorRec = rec.registro_consultor
      ? consultorMap.get(String(rec.registro_consultor).trim())
      : undefined;
    const empresaRec = rec.registro_empresa
      ? empresaMap.get(String(rec.registro_empresa).trim())
      : undefined;
    const planoRec = rec.registro_plano
      ? planoMap.get(String(rec.registro_plano).trim())
      : undefined;

    const sitParts = [
      rec.situacao_cadastral ? String(rec.situacao_cadastral) : '',
      rec.status ? `Status API: ${rec.status}` : '',
      String(rec.cancelado) === '1' || String(rec.cancelado).toLowerCase() === 'sim' ? 'Cancelado no Labcard' : '',
    ].filter(Boolean);
    const sitLabel = sitParts.join(' • ');

    if (subIdx >= 0) {
      const existing = nextSubs[subIdx];
      let touched = false;

      const updated: ClubSubscription = { ...existing };

      if (emailStr && !updated.holderEmail) {
        updated.holderEmail = emailStr;
        stats.emailsFilled += 1;
        touched = true;
      }
      if (rgStr && !updated.holderRg) {
        updated.holderRg = rgStr;
        stats.rgsFilled += 1;
        touched = true;
      }
      if (cnpjStr.length >= 14 && !updated.holderCnpj) {
        updated.holderCnpj = cnpjStr;
        updated.personType = 'PJ';
        touched = true;
      }
      if (birthIso && !updated.holderBirthDate) {
        updated.holderBirthDate = birthIso;
        touched = true;
      }
      if (sexStr && !updated.holderSex) {
        updated.holderSex = sexStr;
        touched = true;
      }
      if (maritalStr && !updated.holderMaritalStatus) {
        updated.holderMaritalStatus = maritalStr;
        touched = true;
      }
      if (phoneStr && !updated.holderPhone) {
        updated.holderPhone = phoneStr;
        touched = true;
      }

      if ((cepStr || streetStr || bairroStr || cityStr) && (!updated.addressStreet || !updated.addressCep || updated.addressCity === 'Porto Velho')) {
        if (cepStr && !updated.addressCep) updated.addressCep = cepStr;
        if (streetStr && !updated.addressStreet) updated.addressStreet = streetStr;
        if (numStr && !updated.addressNumber) updated.addressNumber = numStr;
        if (compStr && !updated.addressComplement) updated.addressComplement = compStr;
        if (bairroStr && !updated.addressNeighborhood) updated.addressNeighborhood = bairroStr;
        if (cityStr && (!updated.addressCity || updated.addressCity === 'Porto Velho')) updated.addressCity = cityStr;
        if (stateStr && (!updated.addressState || updated.addressState === 'RO')) updated.addressState = stateStr;
        stats.addressesFilled += 1;
        touched = true;
      }

      if (expIso && updated.endDate === '2027-10-31') {
        updated.endDate = expIso;
        stats.validitiesUpdated += 1;
        touched = true;
      }
      if (createdIso && updated.startDate === '2025-01-01') {
        updated.startDate = createdIso;
        touched = true;
      }

      if (consultorRec && (!updated.consultantName || updated.consultantName === 'Administrador' || updated.consultantName === 'CONSULTOR SITE')) {
        updated.consultantId = String(consultorRec.id || consultorRec.registro || rec.registro_consultor || '');
        updated.consultantName = String(consultorRec.nome || consultorRec.name || '');
        stats.consultantsLinked += 1;
        touched = true;
      }

      if (empresaRec && !updated.companyName) {
        updated.companyName = String(empresaRec.nome || empresaRec.razao_social || empresaRec.empresa || '');
        touched = true;
      }

      if (sitLabel && !updated.labcardSituationLabel) {
        updated.labcardSituationLabel = sitLabel;
        touched = true;
      }

      // Atualizar membro titular correspondente dentro da assinatura
      const memIdx = updated.members.findIndex(
        (m) =>
          (numCard && cleanDigits(m.cardNumber) === numCard) ||
          (cpfDigits.length >= 11 && cleanDigits(m.cpf) === cpfDigits) ||
          m.role === 'TITULAR'
      );
      if (memIdx >= 0) {
        updated.members[memIdx] = enrichMemberFromApi(updated.members[memIdx], rec);
        touched = true;
      }

      // Mesclar boletos históricos do Labcard (opcional)
      if (options.includeBoletos && numCard) {
        const cardBoletos = boletosByCard.get(numCard) || [];
        cardBoletos.forEach((b, bIdx) => {
          const docNum = String(b.num_documento || b.boleto || b.nosso_numero || b.id || `${numCard}-${bIdx}`);
          const due = normalizeIsoDateFromLabcard(b.vencimento || b.data_vencimento || b.data) || nowIso.slice(0, 10);
          const alreadyExists = updated.invoices.some(
            (inv) =>
              (inv.boletoNumber && inv.boletoNumber === docNum) ||
              inv.id === `inv_lc_${docNum}` ||
              (inv.dueDate === due && Math.abs(Number(inv.amount || 0) - Number(b.valor || 0)) < 0.05)
          );
          if (!alreadyExists) {
            const stRaw = String(b.status || b.situacao || '').toLowerCase();
            const isPaid = stRaw.includes('pag') || stRaw.includes('baix') || stRaw.includes('liquid');
            updated.invoices.push({
              id: `inv_lc_${docNum}`,
              subscriptionId: updated.id,
              subscriptionCode: updated.subscriptionCode,
              holderName: updated.holderName,
              holderCpf: updated.holderCpf,
              holderPhone: updated.holderPhone,
              installmentNumber: bIdx + 1,
              totalInstallments: cardBoletos.length,
              referenceMonth: due.length >= 7 ? `${due.slice(5, 7)}/${due.slice(0, 4)}` : '',
              amount: Number(b.valor || planoRec?.valor || updated.monthlyEquivalent || 0),
              dueDate: due,
              paidAt: isPaid ? normalizeIsoDateFromLabcard(b.data_pagamento || b.updated_at) || due : undefined,
              paymentMethod: 'BOLETO',
              status: isPaid ? 'PAID' : isClubDateExpired(due) ? 'OVERDUE' : 'PENDING',
              boletoNumber: docNum,
              description: String(b.descricao || b.referencia || `Boleto Labcard (${due})`),
              createdAt: nowIso,
            });
            stats.boletosImported += 1;
            touched = true;
          }
        });
      }

      if (touched) {
        updated.updatedAt = nowIso;
        nextSubs[subIdx] = updated;
      }
      stats.matchedSubscriptions += 1;
    } else if (options.includeNewClients && numCard) {
      // Cadastro novo existente na API do Labcard que ainda não estava na base local (sempre PENDING_TRANSFER)
      const planLabel = String(rec.plano || planoRec?.nome || 'Lessa Club');
      const mod = resolveLabcardModalityInfo(planLabel);
      const val = Number(rec.valor || planoRec?.valor || mod.price || 0);
      const subId = `sub-labcard-${numCard}`;
      const formattedCpf = formatCpf(cpfDigits);

      const newSub: ClubSubscription = {
        id: subId,
        subscriptionCode: numCard,
        personType: cnpjStr.length >= 14 ? 'PJ' : 'PF',
        holderName: String(rec.nome || 'ASSOCIADO LABCARD').trim().toUpperCase(),
        holderCpf: formattedCpf,
        holderRg: rgStr || undefined,
        holderBirthDate: birthIso || undefined,
        holderSex: sexStr || undefined,
        holderMaritalStatus: maritalStr || undefined,
        holderPhone: phoneStr,
        holderEmail: emailStr || undefined,
        holderCnpj: cnpjStr || undefined,
        companyName: empresaRec ? String(empresaRec.nome || empresaRec.razao_social || '') : undefined,
        labcardSituationLabel: sitLabel || undefined,
        addressCep: cepStr || undefined,
        addressStreet: streetStr || undefined,
        addressNumber: numStr || undefined,
        addressComplement: compStr || undefined,
        addressNeighborhood: bairroStr || undefined,
        addressCity: cityStr || 'Ariquemes',
        addressState: stateStr || 'RO',
        billingCycle: planLabel.toLowerCase().includes('anual') ? 'ANNUAL' : 'MONTHLY',
        paymentMethod: 'PIX',
        installments: planLabel.toLowerCase().includes('anual') ? 12 : 1,
        monthlyEquivalent: val,
        totalContractValue: planLabel.toLowerCase().includes('anual') ? val * 12 : val,
        dueDay: 10,
        status: 'PENDING_TRANSFER',
        origin: 'IMPORT_LABCARD',
        consultantId: consultorRec ? String(consultorRec.id || consultorRec.registro || '') : undefined,
        consultantName: consultorRec ? String(consultorRec.nome || consultorRec.name || '') : undefined,
        planSummaryLabel: planLabel,
        notes: 'Sincronizado diretamente da API do Labcard.',
        contractType: 'ADESAO_PF',
        contractAccepted: true,
        contractSignedAt: createdIso ? `${createdIso}T00:00:00.000Z` : nowIso,
        startDate: createdIso || nowIso.slice(0, 10),
        endDate: expIso || '2027-10-31',
        members: [
          {
            id: `mem-${numCard}`,
            subscriptionId: subId,
            role: 'TITULAR',
            modalityCode: mod.code,
            modalityName: mod.name,
            planCycleLabel: planLabel,
            fullName: String(rec.nome || 'ASSOCIADO LABCARD').trim().toUpperCase(),
            cpf: formattedCpf,
            rg: rgStr || undefined,
            birthDate: birthIso || undefined,
            sex: sexStr || undefined,
            phone: phoneStr || undefined,
            cardNumber: numCard,
            holderCardNumber: numCard,
            qrToken: `LC-${numCard}`,
            frontCardUrl: mod.front,
            backCardUrl: mod.back,
            validityLabel: expIso ? getValidityLabelFromDate(expIso, '10/2027') : '10/2027',
            expirationDate: expIso || undefined,
            monthlyValue: val,
            status: 'PENDING_TRANSFER',
            createdAt: createdIso ? `${createdIso}T00:00:00.000Z` : nowIso,
          },
        ],
        invoices: [],
        attachments: [],
        visits: [],
        additionalServices: [],
        createdAt: createdIso ? `${createdIso}T00:00:00.000Z` : nowIso,
        updatedAt: nowIso,
      };

      const newIdx = nextSubs.length;
      nextSubs.push(newSub);
      subIdxByCard.set(numCard, newIdx);
      if (cpfDigits.length >= 11) subIdxByCpf.set(cpfDigits, newIdx);
      stats.newTitularesCount += 1;
    }
  }

  // 2) Processar Dependentes da API (enriquecer existentes ou vincular dependentes ausentes ao titular)
  for (const dep of dependentes) {
    const depCard = cleanDigits(String(dep.num_card || ''));
    const holderCard = cleanDigits(String(dep.num_card_titular || ''));
    const depCpf = cleanDigits(String(dep.cpf || ''));
    if (!holderCard && !depCard) continue;

    const parentIdx = holderCard
      ? subIdxByCard.get(holderCard) ?? -1
      : depCard
      ? subIdxByCard.get(depCard) ?? -1
      : -1;
    if (parentIdx === -1) continue;

    const parentSub = nextSubs[parentIdx];
    const memIdx = parentSub.members.findIndex(
      (m) =>
        (depCard && cleanDigits(m.cardNumber) === depCard) ||
        (depCpf.length >= 11 && cleanDigits(m.cpf) === depCpf)
    );

    if (memIdx >= 0) {
      parentSub.members[memIdx] = enrichMemberFromApi(parentSub.members[memIdx], dep);
      parentSub.updatedAt = nowIso;
    } else if (depCard) {
      const mod = resolveLabcardModalityInfo(dep.plano || parentSub.planSummaryLabel);
      const expIso = normalizeIsoDateFromLabcard(dep.vencimento_cartao);
      const birthIso = normalizeIsoDateFromLabcard(dep.data_nascimento);
      const depPhone = normalizeLabcardPhone(dep.ddd, dep.telefone) || parentSub.holderPhone;
      parentSub.members.push({
        id: `mem-${depCard}`,
        subscriptionId: parentSub.id,
        role: 'DEPENDENTE',
        modalityCode: mod.code,
        modalityName: mod.name,
        planCycleLabel: String(dep.plano || mod.name),
        fullName: String(dep.nome || 'DEPENDENTE').trim().toUpperCase(),
        cpf: formatCpf(depCpf),
        rg: String(dep.rg || '').trim() || undefined,
        birthDate: birthIso || undefined,
        sex: normalizeGender(dep.sexo) || undefined,
        phone: depPhone || undefined,
        cardNumber: depCard,
        holderCardNumber: parentSub.subscriptionCode,
        qrToken: `LC-${depCard}`,
        frontCardUrl: mod.front,
        backCardUrl: mod.back,
        validityLabel: expIso ? getValidityLabelFromDate(expIso, '10/2027') : '10/2027',
        expirationDate: expIso || undefined,
        monthlyValue: Number(dep.valor || 0),
        status: 'PENDING_TRANSFER',
        createdAt: normalizeIsoDateFromLabcard(dep.created_at)
          ? `${normalizeIsoDateFromLabcard(dep.created_at)}T00:00:00.000Z`
          : nowIso,
      });
      subIdxByCard.set(depCard, parentIdx);
      parentSub.updatedAt = nowIso;
      stats.newDependentsAdded += 1;
    }
  }

  // Ordenar faturas cronologicamente em assinaturas modificadas
  nextSubs.forEach((s) => {
    if (s.updatedAt === nowIso && s.invoices.length > 1) {
      s.invoices.sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
    }
  });

  const nextState: ClubDatabaseState = {
    ...currentState,
    subscriptions: nextSubs,
  };

  const saved = await saveClubState(nextState);
  return { state: saved, stats };
};

// ============================================================================
// VAGAS EXATAS DE DEPENDENTES CONTRATADAS PELO PLANO + CADASTRO PELO PORTAL DO SÓCIO
// ============================================================================
export interface ContractedDependentSlot {
  slotIndex: number; // 0-based index among dependent slots
  modalityCode: string;
  modalityName: string;
  frontCardUrl: string;
  backCardUrl: string;
  requiresDocument: boolean;
  docRule: ReturnType<typeof getPlanDocumentRule>;
  existingMember?: ClubMember;
}

const mapLabelToModality = (rawLabel: string): ClubModality => {
  const low = rawLabel.trim().toLowerCase();
  if (low.includes('kids') || low.includes('criança') || low.includes('crianca')) {
    return DEFAULT_CLUB_MODALITIES.find((m) => m.code === 'KIDS') || DEFAULT_CLUB_MODALITIES[0];
  }
  if (low.includes('student') || low.includes('estudante')) {
    return DEFAULT_CLUB_MODALITIES.find((m) => m.code === 'ESTUDANTE') || DEFAULT_CLUB_MODALITIES[0];
  }
  if (low.includes('professor') || low.includes('docente')) {
    return DEFAULT_CLUB_MODALITIES.find((m) => m.code === 'PROFESSOR') || DEFAULT_CLUB_MODALITIES[0];
  }
  if (low.includes('servidor')) {
    return DEFAULT_CLUB_MODALITIES.find((m) => m.code === 'SERVIDOR') || DEFAULT_CLUB_MODALITIES[0];
  }
  if (low.includes('vitalício') || low.includes('vitalicio') || low.includes('60+') || low.includes('idoso')) {
    return DEFAULT_CLUB_MODALITIES.find((m) => m.code === 'IDOSO_60') || DEFAULT_CLUB_MODALITIES[0];
  }
  if (low.includes('inclusão') || low.includes('inclusao') || low.includes('pcd') || low.includes('pdc') || low.includes('tea')) {
    return DEFAULT_CLUB_MODALITIES.find((m) => m.code === 'PCD_TEA') || DEFAULT_CLUB_MODALITIES[0];
  }
  if (low.includes('publicidade') || low.includes('permuta')) {
    return DEFAULT_CLUB_MODALITIES.find((m) => m.code === 'PUBLICIDADE') || DEFAULT_CLUB_MODALITIES[0];
  }
  return DEFAULT_CLUB_MODALITIES.find((m) => m.code === 'ADULTO') || DEFAULT_CLUB_MODALITIES[0];
};

/**
 * Calcula exatamente as vagas de dependentes contratadas conforme a configuração do plano
 * (ex: "Família Personalizado (Anual): 2x Lessa Club + 2x Lessa Kids" -> 1 titular + exatamente 3 vagas:
 * [1x Lessa Club, 1x Lessa Kids, 1x Lessa Kids], sem gerar campos extras!).
 */
export const getContractedDependentSlots = (
  subscription: ClubSubscription
): ContractedDependentSlot[] => {
  const existingDeps = (subscription.members || []).filter(
    (m, idx) => m.role === 'DEPENDENTE' && idx > 0
  );
  const holder =
    (subscription.members || []).find((m) => m.role === 'TITULAR') ||
    (subscription.members || [])[0];
  const holderModCode = holder?.modalityCode || 'ADULTO';

  const planDesc = String(subscription.planSummaryLabel || '');
  const totalContractedMods: ClubModality[] = [];

  // 1. Composição explícita tipo "2x Lessa Club + 2x Lessa Kids"
  const nxRegex = /(\d+)\s*x\s*([^+,\[\]()]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = nxRegex.exec(planDesc)) !== null) {
    const qty = Math.min(15, Math.max(0, parseInt(match[1], 10) || 0));
    const mod = mapLabelToModality(match[2] || '');
    for (let i = 0; i < qty; i += 1) {
      totalContractedMods.push(mod);
    }
  }

  let dependentMods: ClubModality[] = [];
  if (totalContractedMods.length > 0) {
    // Subtrai exatamente 1 vaga correspondente ao titular já cadastrado
    const holderIdx = totalContractedMods.findIndex((m) => m.code === holderModCode);
    if (holderIdx >= 0) {
      totalContractedMods.splice(holderIdx, 1);
    } else {
      totalContractedMods.shift();
    }
    dependentMods = totalContractedMods;
  } else {
    // 2. Planos multi-pessoas padrão: "Lessa Club (3 pessoas)", "Lessa Club - 2 pessoas", "Lessa Duo Club"
    const peopleMatch = planDesc.match(/(\d+)\s*pessoas?/i);
    if (peopleMatch) {
      const totalPeople = Math.min(15, Math.max(1, parseInt(peopleMatch[1], 10) || 1));
      const baseMod = mapLabelToModality(planDesc);
      for (let i = 1; i < totalPeople; i += 1) {
        dependentMods.push(baseMod);
      }
    } else if (/duo\s*club/i.test(planDesc)) {
      dependentMods.push(DEFAULT_CLUB_MODALITIES[0]);
    }
  }

  // Vincula os dependentes já cadastrados às suas vagas exatas por modalidade
  const remainingDeps = [...existingDeps];
  const slots: ContractedDependentSlot[] = dependentMods.map((mod, idx) => {
    let depIdx = remainingDeps.findIndex((d) => d.modalityCode === mod.code);
    if (depIdx < 0 && remainingDeps.length > 0 && dependentMods.length === existingDeps.length) {
      depIdx = 0;
    }
    const matched = depIdx >= 0 ? remainingDeps.splice(depIdx, 1)[0] : undefined;
    const docRule = getPlanDocumentRule(mod.code, mod.name);
    return {
      slotIndex: idx,
      modalityCode: mod.code,
      modalityName: mod.name,
      frontCardUrl: mod.dependentFrontCardUrl || mod.frontCardUrl,
      backCardUrl: mod.dependentBackCardUrl || mod.backCardUrl,
      requiresDocument: docRule.requiresDocument,
      docRule,
      existingMember: matched,
    };
  });

  // Se já existiam dependentes cadastrados pelo admin além do parse do texto, mantém esses já cadastrados (sem criar extras vazios!)
  remainingDeps.forEach((dep) => {
    const mod =
      DEFAULT_CLUB_MODALITIES.find((m) => m.code === dep.modalityCode) ||
      mapLabelToModality(dep.modalityName || '');
    const docRule = getPlanDocumentRule(dep.modalityCode, dep.modalityName);
    slots.push({
      slotIndex: slots.length,
      modalityCode: dep.modalityCode || mod.code,
      modalityName: dep.modalityName || mod.name,
      frontCardUrl: dep.frontCardUrl || mod.dependentFrontCardUrl || mod.frontCardUrl,
      backCardUrl: dep.backCardUrl || mod.dependentBackCardUrl || mod.backCardUrl,
      requiresDocument: docRule.requiresDocument,
      docRule,
      existingMember: dep,
    });
  });

  return slots;
};

export interface SaveSocioDependentSlotInput {
  subscriptionId: string;
  slotIndex: number;
  modalityCode: string;
  existingMemberId?: string;
  fullName: string;
  cpf: string;
  birthDate: string;
  kinship?: string;
  photoFile?: File | null;
  documentFile?: File | null;
}

/**
 * Permite ao próprio sócio cadastrar ou atualizar os dados de uma vaga de dependente
 * já contratada no seu plano (com foto 3x4 e documento obrigatório salvos no Supabase Storage `club-files` + `club_records`).
 */
export const saveSocioDependentSlot = async (
  input: SaveSocioDependentSlotInput
): Promise<{ state: ClubDatabaseState; subscription: ClubSubscription; member: ClubMember }> => {
  const currentState = await fetchClubState();
  const subIdx = currentState.subscriptions.findIndex((s) => s.id === input.subscriptionId);
  if (subIdx < 0) {
    throw new Error('Assinatura não encontrada na base de dados.');
  }

  const sub = currentState.subscriptions[subIdx];
  const slots = getContractedDependentSlots(sub);
  const targetSlot = slots.find((sl) => sl.slotIndex === input.slotIndex);
  if (!targetSlot) {
    throw new Error('Vaga de dependente não permitida pela configuração do seu plano.');
  }

  const cleanName = input.fullName.trim().toUpperCase();
  if (cleanName.length < 3) {
    throw new Error('Informe o nome completo do dependente.');
  }
  const cleanCpfDigits = cleanDigits(input.cpf);
  if (cleanCpfDigits.length !== 11) {
    throw new Error('Informe um CPF válido (11 dígitos) para o dependente.');
  }
  const cleanBirth = input.birthDate.trim();
  if (cleanBirth.length < 8) {
    throw new Error('Informe a data de nascimento completa (DD/MM/AAAA) do dependente.');
  }

  const mod =
    DEFAULT_CLUB_MODALITIES.find((m) => m.code === targetSlot.modalityCode) ||
    DEFAULT_CLUB_MODALITIES[0];
  const docRule = getPlanDocumentRule(mod.code, mod.name);
  const nowIso = new Date().toISOString();

  const existingMember = input.existingMemberId
    ? (sub.members || []).find((m) => m.id === input.existingMemberId)
    : targetSlot.existingMember;

  // Calcula próximo número de cartão único (apenas se for um dependente novo)
  let memberCardNumber = existingMember?.cardNumber || '';
  let nextSeq = Number(currentState.lastCardSequence || 3015);
  if (!memberCardNumber) {
    const bumpSeq = (code?: string | null) => {
      const m = String(code || '').match(/^121225(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n < 90000 && n > nextSeq) nextSeq = n;
      }
    };
    (currentState.subscriptions || []).forEach((s) => {
      bumpSeq(s.subscriptionCode);
      (s.members || []).forEach((mem) => bumpSeq(mem.cardNumber));
    });
    try {
      const { data: latestCodes } = await (supabase.from as any)('club_records').select('subscription_code');
      if (Array.isArray(latestCodes)) {
        latestCodes.forEach((row: any) => bumpSeq(row?.subscription_code));
      }
    } catch {}
    nextSeq += 1;
    memberCardNumber = `121225${String(nextSeq).padStart(4, '0')}`;
  }

  const memberId =
    existingMember?.id ||
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `mem-dep-${Date.now()}-${input.slotIndex}`);

  // 1. Upload de Foto 3x4 para Supabase Storage (`club-files`)
  let resolvedPhotoUrl = existingMember?.photoUrl || '';
  if (input.photoFile) {
    const compressed = await compressImageFile(input.photoFile, 700, 0.8);
    const uploadedPhotoUrl = await uploadClubFileToStorage(
      sub.subscriptionCode,
      compressed,
      `foto_${memberCardNumber}_${input.photoFile.name || '3x4.jpg'}`,
      'image/jpeg'
    );
    resolvedPhotoUrl = uploadedPhotoUrl || compressed;
  }

  // 2. Upload de Documento Obrigatório (ex: Certidão/RG para Lessa Kids) para `club-files` + `club_attachments`
  let resolvedDocUrl = existingMember?.documentProofUrl || '';
  let resolvedDocName = existingMember?.documentProofName || '';
  let resolvedAttachments: ClubAttachment[] = [...(existingMember?.attachments || [])];
  let uploadedNewDoc = false;

  if (input.documentFile) {
    const isPdf =
      input.documentFile.type === 'application/pdf' ||
      input.documentFile.name.toLowerCase().endsWith('.pdf');
    const rawDataUrl = isPdf
      ? await fileToDataUrl(input.documentFile)
      : await compressImageFile(input.documentFile, 1280, 0.82);

    const uploadedDocUrl = await uploadClubFileToStorage(
      sub.subscriptionCode,
      rawDataUrl,
      `doc_${memberCardNumber}_${input.documentFile.name}`,
      isPdf ? 'application/pdf' : 'image/jpeg'
    );
    const finalDocUrl = uploadedDocUrl || rawDataUrl;
    const newAtt: ClubAttachment = {
      id: `att_dep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${cleanName} — ${input.documentFile.name}`,
      mimeType: isPdf ? 'application/pdf' : 'image/jpeg',
      dataUrl: finalDocUrl,
      createdAt: nowIso,
    };
    await saveClubAttachmentAtomic(sub.subscriptionCode, memberId, newAtt);
    resolvedDocUrl = finalDocUrl;
    resolvedDocName = input.documentFile.name;
    resolvedAttachments = [newAtt, ...resolvedAttachments.filter((a) => a.id !== newAtt.id)];
    uploadedNewDoc = true;
  }

  const hasAnyRealDoc = Boolean(resolvedDocUrl) || resolvedAttachments.length > 0;
  const kidsExpDate = mod.code === 'KIDS' ? calculateKidsExpirationDate(cleanBirth) : undefined;
  const effectiveExpDate = kidsExpDate || existingMember?.expirationDate || sub.endDate;
  const effectiveValLabel = getValidityLabelFromDate(
    effectiveExpDate,
    existingMember?.validityLabel || sub.validityLabel || '11/2027'
  );
  const cycleSuffix = sub.billingCycle === 'ANNUAL' ? '(Anual)' : '(Mensal)';

  const updatedMember: ClubMember = {
    ...(existingMember || {}),
    id: memberId,
    subscriptionId: sub.id,
    role: 'DEPENDENTE',
    modalityCode: mod.code,
    modalityName: mod.name,
    planCycleLabel: mod.isFreeTier ? mod.name : `${mod.name} ${cycleSuffix}`,
    fullName: cleanName,
    cpf: formatCpf(cleanCpfDigits),
    rg: existingMember?.rg || '',
    birthDate: cleanBirth,
    sex: existingMember?.sex || '',
    phone: existingMember?.phone || sub.holderPhone,
    photoUrl: resolvedPhotoUrl,
    documentProofUrl: resolvedDocUrl,
    documentProofName: resolvedDocName,
    documentVerified: uploadedNewDoc ? false : Boolean(existingMember?.documentVerified && hasAnyRealDoc),
    documentStatus: uploadedNewDoc
      ? 'EM_ANALISE'
      : hasAnyRealDoc
      ? existingMember?.documentStatus || 'EM_ANALISE'
      : docRule.requiresDocument
      ? 'PENDENTE_ANEXO'
      : undefined,
    attachments: resolvedAttachments,
    cardNumber: memberCardNumber,
    holderCardNumber: sub.subscriptionCode,
    qrToken: existingMember?.qrToken || memberCardNumber,
    frontCardUrl: mod.dependentFrontCardUrl || mod.frontCardUrl,
    backCardUrl: mod.dependentBackCardUrl || mod.backCardUrl,
    validityLabel: effectiveValLabel,
    expirationDate: effectiveExpDate,
    expirationNotes:
      mod.code === 'KIDS'
        ? 'Expira ao completar 12 anos (transição para plano pago)'
        : existingMember?.expirationNotes,
    kinship: (input.kinship || existingMember?.kinship || (mod.code === 'KIDS' ? 'Filho(a)' : 'Dependente')).trim(),
    monthlyValue: mod.isFreeTier
      ? 0
      : sub.billingCycle === 'ANNUAL'
      ? mod.annualInstallment
      : mod.monthlyPrice,
    status:
      docRule.requiresDocument && !hasAnyRealDoc
        ? 'INACTIVE'
        : sub.status === 'ACTIVE'
        ? 'ACTIVE'
        : sub.status,
    createdAt: existingMember?.createdAt || nowIso,
  };

  const nextMembers = existingMember
    ? (sub.members || []).map((m) => (m.id === existingMember.id ? updatedMember : m))
    : [...(sub.members || []), updatedMember];

  const mergedSubAttachments = uploadedNewDoc
    ? mergeAttachmentsSafely(sub.attachments, resolvedAttachments)
    : sub.attachments || [];

  const updatedSub: ClubSubscription = {
    ...sub,
    members: nextMembers,
    attachments: mergedSubAttachments,
    isModifiedFromSeed: true,
    updatedAt: nowIso,
  };
  updatedSub.contractContentHtml = renderSubscriptionContractHtml(
    updatedSub,
    currentState.contractTemplates
  );

  // Gravação atômica imediata em public.club_records (+ snapshot no histórico) e na nuvem
  await saveMemberPermanentDocs(updatedSub.subscriptionCode, updatedSub, 'SOCIO_SAVE_DEPENDENT');

  const nextState: ClubDatabaseState = {
    ...currentState,
    lastCardSequence: Math.max(currentState.lastCardSequence || 3015, nextSeq),
    subscriptions: currentState.subscriptions.map((s) => (s.id === updatedSub.id ? updatedSub : s)),
  };
  const savedState = await saveClubState(nextState, { waitForCloud: true });

  return {
    state: savedState,
    subscription: updatedSub,
    member: updatedMember,
  };
};

export {
  saveMemberPermanentDocs,
  loadMemberPermanentDocs,
  loadAllPermanentMemberDocs,
  applyPermanentDocsToSub,
  saveClubAttachmentAtomic,
  softDeleteClubAttachment,
  loadClubRecordHistory,
  uploadClubFileToStorage,
  type PermanentMemberDocRecord,
  type ClubRecordHistoryEntry,
};
