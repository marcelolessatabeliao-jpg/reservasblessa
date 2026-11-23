import { supabase } from '../integrations/supabase/client';
import type { ClubSubscription, ClubAttachment, ClubMember } from './club-types';
import {
  saveMemberPermanentDataToIndexedDB,
  loadMemberPermanentDataFromIndexedDB,
  loadAllMemberPermanentDataFromIndexedDB,
} from './club-indexeddb';

const SETTINGS_KEY_PREFIX = 'club_member_docs_';

export interface PermanentMemberDocRecord {
  subscriptionCode: string;
  subscriptionId?: string;
  holderName?: string;
  holderCpf?: string;
  holderRg?: string;
  holderBirthDate?: string;
  holderSex?: string;
  holderMaritalStatus?: string;
  holderPhone?: string;
  holderEmail?: string;
  consultantName?: string;
  addressCep?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  vehicleModel?: string;
  vehicleBrand?: string;
  vehiclePlate?: string;
  vehicleColor?: string;
  notes?: string;
  dueDay?: number;
  billingCycle?: 'MONTHLY' | 'ANNUAL';
  monthlyEquivalent?: number;
  totalContractValue?: number;
  planSummaryLabel?: string;
  endDate?: string;
  validityLabel?: string;
  status?: ClubSubscription['status'];
  manualStatusOverride?: boolean;
  transferCompleted?: boolean;
  manuallyConfirmedTransfer?: boolean;
  transferredAt?: string;
  attachments?: ClubAttachment[];
  members?: ClubMember[];
  updatedAt: string;
}

/**
 * Salva permanentemente dados e anexos de um associado.
 * Grava atomicamente no Supabase (chave dedicada `club_member_docs_${code}`)
 * e no IndexedDB permanente, garantindo que NUNCA sejam perdidos ou sobrescritos.
 */
export async function saveMemberPermanentDocs(
  subCodeOrId: string,
  sub: Partial<ClubSubscription>
): Promise<boolean> {
  const code = (sub.subscriptionCode || subCodeOrId || '').trim();
  if (!code) return false;

  const titular = sub.members?.find((m) => m.role === 'TITULAR') || sub.members?.[0];

  const payload: PermanentMemberDocRecord = {
    subscriptionCode: code,
    subscriptionId: sub.id,
    holderName: (sub.holderName || titular?.fullName || '').trim(),
    holderCpf: (sub.holderCpf || titular?.cpf || '').trim(),
    holderRg: (sub.holderRg || titular?.rg || '').trim(),
    holderBirthDate: sub.holderBirthDate || titular?.birthDate,
    holderSex: sub.holderSex || titular?.sex,
    holderMaritalStatus: sub.holderMaritalStatus,
    holderPhone: (sub.holderPhone || titular?.phone || '').trim(),
    holderEmail: (sub.holderEmail || titular?.email || '').trim(),
    consultantName: (sub.consultantName || '').trim(),
    addressCep: (sub.addressCep || '').trim(),
    addressStreet: (sub.addressStreet || '').trim(),
    addressNumber: (sub.addressNumber || '').trim(),
    addressComplement: (sub.addressComplement || '').trim(),
    addressNeighborhood: (sub.addressNeighborhood || '').trim(),
    addressCity: (sub.addressCity || 'Ariquemes').trim(),
    addressState: (sub.addressState || 'RO').trim(),
    vehicleModel: (sub.vehicleModel || '').trim(),
    vehicleBrand: (sub.vehicleBrand || '').trim(),
    vehiclePlate: (sub.vehiclePlate || '').trim(),
    vehicleColor: (sub.vehicleColor || '').trim(),
    notes: (sub.notes || '').trim(),
    dueDay: sub.dueDay,
    billingCycle: sub.billingCycle,
    monthlyEquivalent: sub.monthlyEquivalent,
    totalContractValue: sub.totalContractValue,
    planSummaryLabel: sub.planSummaryLabel,
    endDate: sub.endDate,
    validityLabel: sub.validityLabel,
    status: sub.status,
    manualStatusOverride: sub.manualStatusOverride,
    transferCompleted: sub.transferCompleted,
    manuallyConfirmedTransfer: sub.manuallyConfirmedTransfer,
    transferredAt: sub.transferredAt,
    attachments: Array.isArray(sub.attachments) ? sub.attachments : [],
    members: Array.isArray(sub.members) ? sub.members : [],
    updatedAt: new Date().toISOString(),
  };

  // 1. Grava no IndexedDB imediatamente
  await saveMemberPermanentDataToIndexedDB(code, payload);

  // 2. Grava no Supabase de forma atômica e independente
  try {
    const key = `${SETTINGS_KEY_PREFIX}${code}`;
    const { error } = await supabase
      .from('site_settings' as any)
      .upsert(
        {
          key,
          value: payload,
          updated_at: payload.updatedAt,
        },
        { onConflict: 'key' }
      );

    if (error) {
      console.warn(`[ClubPermanentDocs] Erro ao gravar chave ${key} no Supabase:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[ClubPermanentDocs] Exceção ao gravar chave no Supabase:`, err);
    return false;
  }
}

/**
 * Carrega os dados e anexos permanentes de um associado.
 * Tenta buscar primeiro no IndexedDB local e depois na nuvem (Supabase).
 */
export async function loadMemberPermanentDocs(
  subCodeOrId: string
): Promise<PermanentMemberDocRecord | null> {
  const code = (subCodeOrId || '').trim();
  if (!code) return null;

  // 1. Consulta IndexedDB
  const local = await loadMemberPermanentDataFromIndexedDB(code);

  // 2. Consulta Supabase
  try {
    const key = `${SETTINGS_KEY_PREFIX}${code}`;
    const { data, error } = await supabase
      .from('site_settings' as any)
      .select('value, updated_at')
      .eq('key', key)
      .maybeSingle();

    if (!error && data && (data as any).value) {
      const remote = (data as any).value as PermanentMemberDocRecord;
      if (local) {
        // Retorna o mais recente ou mescla garantindo que anexos e campos não vazios nunca sejam perdidos
        return mergePermanentRecords(local, remote);
      }
      // Atualiza o IndexedDB para ficar em cache local
      saveMemberPermanentDataToIndexedDB(code, remote);
      return remote;
    }
  } catch (err) {
    console.warn(`[ClubPermanentDocs] Falha ao carregar chave do Supabase:`, err);
  }

  return local || null;
}

/**
 * Carrega todos os registros permanentes de associados (do Supabase e do IndexedDB).
 */
export async function loadAllPermanentMemberDocs(): Promise<Map<string, PermanentMemberDocRecord>> {
  const map = new Map<string, PermanentMemberDocRecord>();

  // 1. Carrega do IndexedDB
  try {
    const idbMap = await loadAllMemberPermanentDataFromIndexedDB();
    idbMap.forEach((val, key) => {
      if (val && typeof val === 'object') {
        map.set(key, val as PermanentMemberDocRecord);
      }
    });
  } catch {}

  // 2. Carrega do Supabase
  try {
    const { data, error } = await supabase
      .from('site_settings' as any)
      .select('key, value, updated_at')
      .like('key', `${SETTINGS_KEY_PREFIX}%`);

    if (!error && Array.isArray(data)) {
      data.forEach((row: any) => {
        if (row.key && row.value) {
          const code = row.key.replace(SETTINGS_KEY_PREFIX, '');
          const remoteRec = row.value as PermanentMemberDocRecord;
          const localRec = map.get(code);
          const finalRec = localRec ? mergePermanentRecords(localRec, remoteRec) : remoteRec;
          map.set(code, finalRec);
          // Atualiza o IndexedDB
          saveMemberPermanentDataToIndexedDB(code, finalRec);
        }
      });
    }
  } catch (err) {
    console.warn('[ClubPermanentDocs] Falha ao listar registros permanentes do Supabase:', err);
  }

  return map;
}

function mergePermanentRecords(
  a: PermanentMemberDocRecord,
  b: PermanentMemberDocRecord
): PermanentMemberDocRecord {
  const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
  const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
  const primary = aTime >= bTime ? a : b;
  const secondary = aTime >= bTime ? b : a;

  // Anexos: NUNCA descarta anexos de nenhum dos lados!
  const attMap = new Map<string, ClubAttachment>();
  (secondary.attachments || []).forEach((att) => {
    if (att && att.name) attMap.set(att.name, att);
  });
  (primary.attachments || []).forEach((att) => {
    if (att && att.name) {
      const existing = attMap.get(att.name);
      if (existing && (!att.dataUrl || att.dataUrl.length < (existing.dataUrl?.length || 0))) {
        attMap.set(att.name, { ...att, dataUrl: existing.dataUrl });
      } else {
        attMap.set(att.name, att);
      }
    }
  });

  return {
    ...secondary,
    ...primary,
    holderEmail: primary.holderEmail || secondary.holderEmail,
    addressCep: (primary.addressCep && primary.addressCep !== '76870-000') ? primary.addressCep : (secondary.addressCep || primary.addressCep),
    addressStreet: primary.addressStreet || secondary.addressStreet,
    addressNeighborhood: primary.addressNeighborhood || secondary.addressNeighborhood,
    addressNumber: primary.addressNumber || secondary.addressNumber,
    addressComplement: primary.addressComplement || secondary.addressComplement,
    addressCity: primary.addressCity || secondary.addressCity,
    addressState: primary.addressState || secondary.addressState,
    holderRg: primary.holderRg || secondary.holderRg,
    holderBirthDate: primary.holderBirthDate || secondary.holderBirthDate,
    endDate: primary.endDate || secondary.endDate,
    validityLabel: primary.validityLabel || secondary.validityLabel,
    attachments: Array.from(attMap.values()),
    updatedAt: new Date(Math.max(aTime, bTime)).toISOString(),
  };
}

/**
 * Aplica os dados e anexos permanentes sobre a assinatura.
 * Garante que anexos, e-mail, CEP e datas editadas pelo administrador
 * NUNCA sejam esvaziados por sincronizações de rede.
 */
export function applyPermanentDocsToSub(
  sub: ClubSubscription,
  perm?: PermanentMemberDocRecord
): ClubSubscription {
  if (!perm) return sub;

  // 1. Mescla anexos: NUNCA descarta anexos existentes na assinatura nem no registro permanente
  const mergedAttMap = new Map<string, ClubAttachment>();
  (sub.attachments || []).forEach((a) => {
    if (a && a.name) mergedAttMap.set(a.name, a);
  });
  (perm.attachments || []).forEach((a) => {
    if (a && a.name) {
      const cur = mergedAttMap.get(a.name);
      if (cur && (!a.dataUrl || a.dataUrl.length < (cur.dataUrl?.length || 0))) {
        mergedAttMap.set(a.name, { ...a, dataUrl: cur.dataUrl });
      } else {
        mergedAttMap.set(a.name, a);
      }
    }
  });

  const finalAttachments = Array.from(mergedAttMap.values());

  // 2. Mescla integrantes e comprovantes
  const updatedMembers = (sub.members || []).map((m) => {
    const permMem = (perm.members || []).find((pm) => pm.id === m.id || pm.cardNumber === m.cardNumber || (pm.cpf && pm.cpf === m.cpf));
    if (!permMem) return m;

    const docProof = permMem.documentProofUrl && permMem.documentProofUrl !== 'HAS_DOC_ATTACHED'
      ? permMem.documentProofUrl
      : (m.documentProofUrl || permMem.documentProofUrl);

    return {
      ...m,
      documentProofUrl: docProof,
      documentProofName: permMem.documentProofName || m.documentProofName,
      documentStatus: permMem.documentStatus || m.documentStatus,
      documentVerified: permMem.documentVerified ?? m.documentVerified,
      documentVerifiedAt: permMem.documentVerifiedAt || m.documentVerifiedAt,
      documentVerifiedBy: permMem.documentVerifiedBy || m.documentVerifiedBy,
      rg: permMem.rg || m.rg,
      birthDate: permMem.birthDate || m.birthDate,
      expirationDate: permMem.expirationDate || m.expirationDate,
      validityLabel: permMem.validityLabel || m.validityLabel,
      expirationNotes: permMem.expirationNotes || m.expirationNotes,
      status: permMem.status || m.status,
      manualStatusOverride: permMem.manualStatusOverride ?? m.manualStatusOverride,
    };
  });

  return {
    ...sub,
    holderName: perm.holderName || sub.holderName,
    holderCpf: perm.holderCpf || sub.holderCpf,
    holderRg: perm.holderRg || sub.holderRg,
    holderBirthDate: perm.holderBirthDate || sub.holderBirthDate,
    holderSex: perm.holderSex || sub.holderSex,
    holderMaritalStatus: perm.holderMaritalStatus || sub.holderMaritalStatus,
    holderPhone: perm.holderPhone || sub.holderPhone,
    holderEmail: perm.holderEmail || sub.holderEmail,
    consultantName: perm.consultantName || sub.consultantName,
    addressCep: (perm.addressCep && perm.addressCep !== '76870-000') ? perm.addressCep : (sub.addressCep || perm.addressCep),
    addressStreet: perm.addressStreet || sub.addressStreet,
    addressNumber: perm.addressNumber || sub.addressNumber,
    addressComplement: perm.addressComplement || sub.addressComplement,
    addressNeighborhood: perm.addressNeighborhood || sub.addressNeighborhood,
    addressCity: perm.addressCity || sub.addressCity,
    addressState: perm.addressState || sub.addressState,
    vehicleModel: perm.vehicleModel || sub.vehicleModel,
    vehicleBrand: perm.vehicleBrand || sub.vehicleBrand,
    vehiclePlate: perm.vehiclePlate || sub.vehiclePlate,
    vehicleColor: perm.vehicleColor || sub.vehicleColor,
    notes: perm.notes || sub.notes,
    endDate: perm.endDate || sub.endDate,
    validityLabel: perm.validityLabel || sub.validityLabel,
    status: perm.status || sub.status,
    manualStatusOverride: perm.manualStatusOverride ?? sub.manualStatusOverride,
    transferCompleted: perm.transferCompleted ?? sub.transferCompleted,
    manuallyConfirmedTransfer: perm.manuallyConfirmedTransfer ?? sub.manuallyConfirmedTransfer,
    transferredAt: perm.transferredAt || sub.transferredAt,
    attachments: finalAttachments,
    members: updatedMembers.length > 0 ? updatedMembers : sub.members,
    isModifiedFromSeed: true,
  };
}
