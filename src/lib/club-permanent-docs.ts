import { supabase } from '../integrations/supabase/client';
import type { ClubSubscription, ClubAttachment, ClubMember } from './club-types';
import {
  saveMemberPermanentDataToIndexedDB,
  loadMemberPermanentDataFromIndexedDB,
  loadAllMemberPermanentDataFromIndexedDB,
} from './club-indexeddb';

const STORAGE_BUCKET = 'club-files';

export interface PermanentMemberDocRecord extends Partial<ClubSubscription> {
  subscriptionCode: string;
  updatedAt: string;
}

export interface ClubRecordHistoryEntry {
  id: number;
  subscriptionCode: string;
  subscriptionId: string;
  holderName: string;
  action: string;
  version: number;
  snapshot: ClubSubscription;
  createdAt: string;
}

const isHttpUrl = (val?: string | null): boolean =>
  Boolean(val && (val.startsWith('http://') || val.startsWith('https://')));

const isDataUrl = (val?: string | null): boolean =>
  Boolean(val && val.startsWith('data:') && val.length > 50);

const sanitizeFileName = (name: string): string => {
  const cleaned = (name || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
  return cleaned || 'arquivo';
};

const dataUrlToBlob = (dataUrl: string, fallbackMime = 'application/octet-stream'): { blob: Blob; mimeType: string } => {
  const parts = dataUrl.split(',');
  const header = parts[0] || '';
  const base64 = parts[1] || '';
  const mimeMatch = header.match(/data:([^;]+);/i);
  const mimeType = mimeMatch?.[1] || fallbackMime;
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i += 1) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return { blob: new Blob([byteArray], { type: mimeType }), mimeType };
};

/**
 * Faz upload real do arquivo binário (imagem, PDF, DOC) para o Supabase Storage (bucket `club-files`),
 * retornando uma URL HTTP pública permanente. Nunca estoura limite de JSON nem de localStorage.
 */
export async function uploadClubFileToStorage(
  subCode: string,
  fileOrDataUrl: File | string,
  fileName: string,
  mimeType = 'application/octet-stream'
): Promise<{ publicUrl: string; storagePath: string; fileSize: number } | null> {
  try {
    if (typeof fileOrDataUrl === 'string') {
      if (isHttpUrl(fileOrDataUrl)) {
        return { publicUrl: fileOrDataUrl, storagePath: '', fileSize: 0 };
      }
      if (!isDataUrl(fileOrDataUrl)) return null;
    }

    const safeCode = sanitizeFileName(subCode || 'geral');
    const safeName = sanitizeFileName(fileName || 'documento');
    const uniquePath = `${safeCode}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${safeName}`;

    let uploadBlob: Blob;
    let finalMime = mimeType;

    if (typeof fileOrDataUrl === 'string') {
      const converted = dataUrlToBlob(fileOrDataUrl, mimeType);
      uploadBlob = converted.blob;
      finalMime = converted.mimeType;
    } else {
      uploadBlob = fileOrDataUrl;
      finalMime = fileOrDataUrl.type || mimeType;
    }

    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(uniquePath, uploadBlob, {
        contentType: finalMime,
        upsert: true,
        cacheControl: '31536000',
      });

    if (upErr) {
      console.warn('[ClubRecordsDB] Aviso ao enviar arquivo para Storage club-files:', upErr);
      return null;
    }

    const { data: pubData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(uniquePath);
    if (!pubData?.publicUrl) return null;

    return {
      publicUrl: pubData.publicUrl,
      storagePath: uniquePath,
      fileSize: uploadBlob.size,
    };
  } catch (err) {
    console.warn('[ClubRecordsDB] Exceção no upload para Storage club-files:', err);
    return null;
  }
}

/**
 * Salva um anexo individual atomicamente no Supabase Storage (`club-files`) + tabela `public.club_attachments`.
 * Retorna o objeto ClubAttachment atualizado com a URL pública permanente do Storage.
 */
export async function saveClubAttachmentAtomic(
  subCode: string,
  subId: string,
  memberId: string,
  att: ClubAttachment
): Promise<ClubAttachment> {
  const code = (subCode || subId || '').trim();
  if (!code || !att) return att;

  let publicUrl = isHttpUrl(att.dataUrl) ? att.dataUrl : '';
  let storagePath = '';
  let fileSize = 0;
  let fallbackDataUrl = '';

  if (isDataUrl(att.dataUrl)) {
    const uploaded = await uploadClubFileToStorage(code, att.dataUrl, att.name, att.mimeType);
    if (uploaded?.publicUrl) {
      publicUrl = uploaded.publicUrl;
      storagePath = uploaded.storagePath;
      fileSize = uploaded.fileSize;
    } else {
      // Fallback de segurança absoluta: se Storage oscilar, guarda o dataUrl na tabela dedicada club_attachments
      fallbackDataUrl = att.dataUrl;
      fileSize = att.dataUrl.length;
    }
  } else if (att.dataUrl && !publicUrl && att.dataUrl.length > 0 && !att.dataUrl.includes('[COMPACTED_LOCAL]') && att.dataUrl !== 'HAS_DOC_ATTACHED') {
    fallbackDataUrl = att.dataUrl;
  }

  const finalUrl = publicUrl || fallbackDataUrl || att.dataUrl || '';

  // Só registra linha na tabela se tivermos mídia real (URL pública ou dataUrl real)
  if (publicUrl || fallbackDataUrl) {
    try {
      await supabase
        .from('club_attachments' as any)
        .upsert(
          {
            id: att.id || `att_${code}_${Date.now()}`,
            subscription_code: code,
            subscription_id: subId || '',
            member_id: memberId || '',
            file_name: att.name || 'documento',
            mime_type: att.mimeType || 'application/octet-stream',
            storage_path: storagePath,
            public_url: publicUrl,
            data_url: publicUrl ? '' : fallbackDataUrl,
            file_size: fileSize,
            is_deleted: false,
            created_at: att.createdAt || new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
    } catch (err) {
      console.warn('[ClubRecordsDB] Aviso ao gravar em club_attachments:', err);
    }
  }

  return {
    ...att,
    dataUrl: finalUrl,
  };
}

/**
 * Soft-delete de anexo em `public.club_attachments` (mantém registro recuperável no banco).
 */
export async function softDeleteClubAttachment(attId: string): Promise<void> {
  if (!attId) return;
  try {
    await supabase
      .from('club_attachments' as any)
      .update({ is_deleted: true })
      .eq('id', attId);
  } catch (err) {
    console.warn('[ClubRecordsDB] Aviso ao remover anexo em club_attachments:', err);
  }
}

/**
 * Garante que todas as mídias/anexos (fotos, documentos, PDFs) de um cadastro estejam
 * gravadas no Supabase Storage (`club-files`) e na tabela `public.club_attachments`,
 * substituindo base64 pesado por URLs públicas permanentes.
 */
async function persistSubMediaToStorage(sub: Partial<ClubSubscription>, code: string): Promise<Partial<ClubSubscription>> {
  const subId = sub.id || `sub-labcard-${code}`;
  let nextSub = { ...sub };

  // 1. Foto do veículo adesivado
  if (isDataUrl(nextSub.vehicleStickerPhotoUrl)) {
    const up = await uploadClubFileToStorage(
      code,
      nextSub.vehicleStickerPhotoUrl!,
      nextSub.vehicleStickerPhotoName || 'veiculo_adesivado.jpg',
      'image/jpeg'
    );
    if (up?.publicUrl) {
      nextSub.vehicleStickerPhotoUrl = up.publicUrl;
      await saveClubAttachmentAtomic(code, subId, 'vehicle', {
        id: `att_vehicle_${code}_${Date.now()}`,
        name: nextSub.vehicleStickerPhotoName || 'veiculo_adesivado.jpg',
        mimeType: 'image/jpeg',
        dataUrl: up.publicUrl,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 2. Anexos gerais da assinatura
  if (Array.isArray(nextSub.attachments) && nextSub.attachments.length > 0) {
    const updatedAtts: ClubAttachment[] = [];
    for (const att of nextSub.attachments) {
      if (isDataUrl(att.dataUrl) || isHttpUrl(att.dataUrl)) {
        const savedAtt = await saveClubAttachmentAtomic(code, subId, '', att);
        updatedAtts.push(savedAtt);
      } else {
        updatedAtts.push(att);
      }
    }
    nextSub.attachments = updatedAtts;
  }

  // 3. Fotos e comprovantes individuais dos membros
  if (Array.isArray(nextSub.members) && nextSub.members.length > 0) {
    const updatedMembers: ClubMember[] = [];
    for (const m of nextSub.members) {
      let nextM = { ...m };

      if (isDataUrl(nextM.photoUrl)) {
        const upPhoto = await uploadClubFileToStorage(code, nextM.photoUrl!, `foto_${m.cardNumber || m.id}.jpg`, 'image/jpeg');
        if (upPhoto?.publicUrl) {
          nextM.photoUrl = upPhoto.publicUrl;
        }
      }

      if (isDataUrl(nextM.documentProofUrl)) {
        const proofName = nextM.documentProofName || `comprovante_${m.cardNumber || m.id}.jpg`;
        const upProof = await uploadClubFileToStorage(code, nextM.documentProofUrl!, proofName);
        if (upProof?.publicUrl) {
          nextM.documentProofUrl = upProof.publicUrl;
          await saveClubAttachmentAtomic(code, subId, m.id, {
            id: `att_proof_${m.id}_${Date.now()}`,
            name: proofName,
            mimeType: proofName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
            dataUrl: upProof.publicUrl,
            createdAt: new Date().toISOString(),
          });
        }
      }

      if (Array.isArray(nextM.attachments) && nextM.attachments.length > 0) {
        const memAtts: ClubAttachment[] = [];
        for (const ma of nextM.attachments) {
          if (isDataUrl(ma.dataUrl) || isHttpUrl(ma.dataUrl)) {
            const savedMa = await saveClubAttachmentAtomic(code, subId, m.id, ma);
            memAtts.push(savedMa);
          } else {
            memAtts.push(ma);
          }
        }
        nextM.attachments = memAtts;
      }

      updatedMembers.push(nextM);
    }
    nextSub.members = updatedMembers;
  }

  return nextSub;
}

/**
 * Salva permanentemente 1 cadastro individual na tabela relacional `public.club_records`
 * (1 linha por associado = IMPOSSÍVEL sobrescrever ou apagar outros clientes!),
 * sobe todos os anexos no Storage `club-files` + `public.club_attachments`,
 * dispara o Trigger automático do PostgreSQL para `public.club_record_history`,
 * e grava backup no IndexedDB local.
 */
export async function saveMemberPermanentDocs(
  subCodeOrId: string,
  sub: Partial<ClubSubscription>,
  actionLabel = 'ADMIN_SAVE'
): Promise<boolean> {
  const code = String(sub.subscriptionCode || subCodeOrId || '').trim();
  if (!code) return false;

  const nowIso = new Date().toISOString();

  // 1. Sobe qualquer anexo/foto em base64 para o Supabase Storage (club-files) + tabela club_attachments
  const withCloudMedia = await persistSubMediaToStorage(sub, code);

  // Remove HTML gigante redundante do contrato antes de gravar no JSONB (reconstruído dinamicamente)
  const { contractContentHtml: _omitHtml, ...cleanPayload } = withCloudMedia as any;
  const finalPayload: PermanentMemberDocRecord = {
    ...cleanPayload,
    subscriptionCode: code,
    updatedAt: cleanPayload.updatedAt || nowIso,
    isModifiedFromSeed: true,
  };

  // 2. Grava no IndexedDB local imediatamente
  await saveMemberPermanentDataToIndexedDB(code, finalPayload);

  // 3. UPSERT atômico EXCLUSIVAMENTE na linha deste cliente em `public.club_records`
  // (O trigger do PostgreSQL grava automaticamente um snapshot versionado em `public.club_record_history`!)
  try {
    const { error } = await supabase
      .from('club_records' as any)
      .upsert(
        {
          subscription_code: code,
          subscription_id: String(finalPayload.id || `sub-labcard-${code}`),
          holder_name: String(finalPayload.holderName || ''),
          holder_cpf: String(finalPayload.holderCpf || ''),
          status: String(finalPayload.status || 'PENDING_TRANSFER'),
          payload: finalPayload,
          updated_at: finalPayload.updatedAt,
          updated_by: actionLabel,
        },
        { onConflict: 'subscription_code' }
      );

    if (error) {
      console.warn(`[ClubRecordsDB] Erro ao gravar club_records (${code}):`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[ClubRecordsDB] Exceção ao gravar club_records (${code}):`, err);
    return false;
  }
}

/**
 * Carrega a linha individual de um associado diretamente de `public.club_records`
 * + todos os seus anexos reais de `public.club_attachments`.
 */
export async function loadMemberPermanentDocs(
  subCodeOrId: string
): Promise<PermanentMemberDocRecord | null> {
  const code = String(subCodeOrId || '').trim();
  if (!code) return null;

  const local = await loadMemberPermanentDataFromIndexedDB(code);

  try {
    const [recRes, attRes] = await Promise.all([
      supabase
        .from('club_records' as any)
        .select('payload, updated_at')
        .eq('subscription_code', code)
        .maybeSingle(),
      supabase
        .from('club_attachments' as any)
        .select('id, member_id, file_name, mime_type, public_url, data_url, created_at')
        .eq('subscription_code', code)
        .eq('is_deleted', false),
    ]);

    const dbAttachments: ClubAttachment[] = Array.isArray(attRes.data)
      ? (attRes.data as any[])
          .map((row) => ({
            id: row.id,
            name: row.file_name,
            mimeType: row.mime_type || 'application/octet-stream',
            dataUrl: row.public_url || row.data_url || '',
            createdAt: row.created_at,
          }))
          .filter((a) => Boolean(a.dataUrl))
      : [];

    if (!recRes.error && recRes.data && (recRes.data as any).payload) {
      const remote = (recRes.data as any).payload as PermanentMemberDocRecord;
      const withAtts = attachCloudFilesToRecord(remote, dbAttachments);
      const merged = local ? mergePermanentRecords(local, withAtts) : withAtts;
      saveMemberPermanentDataToIndexedDB(code, merged);
      return merged;
    }

    if (local && dbAttachments.length > 0) {
      return attachCloudFilesToRecord(local, dbAttachments);
    }
  } catch (err) {
    console.warn(`[ClubRecordsDB] Falha ao carregar club_records (${code}):`, err);
  }

  return local || null;
}

/**
 * Carrega TODOS os cadastros individuais de `public.club_records` e TODOS os anexos ativos
 * de `public.club_attachments` em paralelo (fonte da verdade soberana do sistema!).
 */
export async function loadAllPermanentMemberDocs(): Promise<Map<string, PermanentMemberDocRecord>> {
  const map = new Map<string, PermanentMemberDocRecord>();

  // 1. Cache IndexedDB local
  try {
    const idbMap = await loadAllMemberPermanentDataFromIndexedDB();
    idbMap.forEach((val, key) => {
      if (val && typeof val === 'object') {
        map.set(key, val as PermanentMemberDocRecord);
      }
    });
  } catch {}

  // 2. Consulta paralela nas tabelas relacionais `club_records` e `club_attachments`
  try {
    const [recordsRes, attachmentsRes] = await Promise.all([
      supabase
        .from('club_records' as any)
        .select('subscription_code, payload, updated_at')
        .order('updated_at', { ascending: false })
        .limit(5000),
      supabase
        .from('club_attachments' as any)
        .select('id, subscription_code, member_id, file_name, mime_type, public_url, data_url, created_at')
        .eq('is_deleted', false)
        .limit(5000),
    ]);

    // Agrupa anexos por subscription_code
    const attByCode = new Map<string, Array<{ att: ClubAttachment; memberId: string }>>();
    if (!attachmentsRes.error && Array.isArray(attachmentsRes.data)) {
      (attachmentsRes.data as any[]).forEach((row) => {
        const code = String(row.subscription_code || '').trim();
        const url = row.public_url || row.data_url || '';
        if (!code || !url) return;
        const list = attByCode.get(code) || [];
        list.push({
          memberId: String(row.member_id || ''),
          att: {
            id: row.id,
            name: row.file_name,
            mimeType: row.mime_type || 'application/octet-stream',
            dataUrl: url,
            createdAt: row.created_at,
          },
        });
        attByCode.set(code, list);
      });
    }

    if (!recordsRes.error && Array.isArray(recordsRes.data)) {
      (recordsRes.data as any[]).forEach((row) => {
        if (!row.subscription_code || !row.payload) return;
        const code = String(row.subscription_code).trim();
        let remoteRec = row.payload as PermanentMemberDocRecord;
        if (!remoteRec.updatedAt && row.updated_at) {
          remoteRec = { ...remoteRec, updatedAt: row.updated_at };
        }

        const codeAtts = attByCode.get(code);
        if (codeAtts && codeAtts.length > 0) {
          remoteRec = attachCloudFilesToRecord(
            remoteRec,
            codeAtts.map((x) => x.att),
            codeAtts
          );
        }

        const localRec = map.get(code);
        const finalRec = localRec ? mergePermanentRecords(localRec, remoteRec) : remoteRec;
        map.set(code, finalRec);
        saveMemberPermanentDataToIndexedDB(code, finalRec);
      });
    }

    // Garante que anexos de códigos presentes apenas em `club_attachments` também sejam aplicados
    attByCode.forEach((items, code) => {
      if (!map.has(code) && items.length > 0) {
        map.set(code, {
          subscriptionCode: code,
          attachments: items.map((x) => x.att),
          updatedAt: items[0].att.createdAt || new Date().toISOString(),
        });
      }
    });
  } catch (err) {
    console.warn('[ClubRecordsDB] Falha ao listar club_records/club_attachments:', err);
  }

  return map;
}

/**
 * Carrega o histórico completo e imutável de alterações de um associado (`public.club_record_history`)
 * para que o administrador possa visualizar e restaurar qualquer versão anterior com 1 clique.
 */
export async function loadClubRecordHistory(subCode: string, limit = 30): Promise<ClubRecordHistoryEntry[]> {
  const code = String(subCode || '').trim();
  if (!code) return [];
  try {
    const { data, error } = await supabase
      .from('club_record_history' as any)
      .select('id, subscription_code, subscription_id, holder_name, action, version, snapshot, created_at')
      .eq('subscription_code', code)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !Array.isArray(data)) return [];
    return (data as any[]).map((row) => ({
      id: Number(row.id),
      subscriptionCode: String(row.subscription_code),
      subscriptionId: String(row.subscription_id || ''),
      holderName: String(row.holder_name || ''),
      action: String(row.action || 'SAVE'),
      version: Number(row.version || 1),
      snapshot: row.snapshot as ClubSubscription,
      createdAt: String(row.created_at),
    }));
  } catch (err) {
    console.warn('[ClubRecordsDB] Falha ao carregar histórico:', err);
    return [];
  }
}

function attachCloudFilesToRecord(
  rec: PermanentMemberDocRecord,
  atts: ClubAttachment[],
  detailed?: Array<{ att: ClubAttachment; memberId: string }>
): PermanentMemberDocRecord {
  if (!atts || atts.length === 0) return rec;

  const existing = Array.isArray(rec.attachments) ? rec.attachments : [];
  const mergedMap = new Map<string, ClubAttachment>();

  existing.forEach((a) => {
    if (a && a.name) mergedMap.set(a.name, a);
  });

  atts.forEach((a) => {
    if (!a || !a.name || !a.dataUrl) return;
    const cur = mergedMap.get(a.name);
    const curIsEmpty = !cur?.dataUrl || cur.dataUrl.length < 30 || cur.dataUrl.includes('[COMPACTED_LOCAL]') || cur.dataUrl === 'HAS_DOC_ATTACHED';
    if (!cur || curIsEmpty || isHttpUrl(a.dataUrl)) {
      mergedMap.set(a.name, a);
    }
  });

  let updatedMembers = rec.members;
  if (detailed && Array.isArray(rec.members)) {
    updatedMembers = rec.members.map((m) => {
      const memAtts = detailed.filter((d) => d.memberId === m.id).map((d) => d.att);
      if (memAtts.length === 0) return m;
      const mProofEmpty = !m.documentProofUrl || m.documentProofUrl.length < 30 || m.documentProofUrl === 'HAS_DOC_ATTACHED';
      return {
        ...m,
        documentProofUrl: mProofEmpty ? memAtts[0].dataUrl : m.documentProofUrl,
        documentProofName: m.documentProofName || memAtts[0].name,
      };
    });
  }

  return {
    ...rec,
    attachments: Array.from(mergedMap.values()),
    members: updatedMembers,
  };
}

function isRealAttachmentUrl(url?: string): boolean {
  return Boolean(
    url &&
    url.trim().length > 20 &&
    !url.includes('[COMPACTED_LOCAL]') &&
    url !== 'HAS_DOC_ATTACHED'
  );
}

function mergeAttachmentsLists(primaryList?: ClubAttachment[], secondaryList?: ClubAttachment[]): ClubAttachment[] {
  const map = new Map<string, ClubAttachment>();
  (secondaryList || []).forEach((att) => {
    if (att && att.name) map.set(att.name, att);
  });
  (primaryList || []).forEach((att) => {
    if (!att || !att.name) return;
    const prev = map.get(att.name);
    if (!prev) {
      map.set(att.name, att);
    } else if (isRealAttachmentUrl(att.dataUrl)) {
      map.set(att.name, att);
    } else if (isRealAttachmentUrl(prev.dataUrl)) {
      map.set(att.name, { ...att, dataUrl: prev.dataUrl });
    } else {
      map.set(att.name, att);
    }
  });
  return Array.from(map.values());
}

function mergePermanentRecords(
  a: PermanentMemberDocRecord,
  b: PermanentMemberDocRecord
): PermanentMemberDocRecord {
  const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
  const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
  const primary = aTime >= bTime ? a : b;
  const secondary = aTime >= bTime ? b : a;

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
    attachments: mergeAttachmentsLists(primary.attachments, secondary.attachments),
    updatedAt: new Date(Math.max(aTime, bTime)).toISOString(),
  };
}

/**
 * Aplica os dados e anexos permanentes da tabela `public.club_records` sobre uma assinatura.
 * Compara rigorosamente os timestamps (`updatedAt`) para que uma versão mais antiga
 * NUNCA sobrescreva uma edição mais nova, enquanto garante que nenhum anexo ou campo
 * preenchido jamais seja apagado!
 */
export function applyPermanentDocsToSub(
  sub: ClubSubscription,
  perm?: PermanentMemberDocRecord
): ClubSubscription {
  if (!perm) return sub;

  const subTime = sub.updatedAt ? new Date(sub.updatedAt).getTime() : 0;
  const permTime = perm.updatedAt ? new Date(perm.updatedAt).getTime() : 0;
  const permIsNewerOrEqual = permTime >= subTime;

  const primary = permIsNewerOrEqual ? perm : sub;
  const secondary = permIsNewerOrEqual ? sub : perm;

  const finalAttachments = mergeAttachmentsLists(primary.attachments, secondary.attachments);

  // Unifica membros (garantindo que dependentes adicionados em `perm` nunca sejam perdidos!)
  const baseMembers = (primary.members && primary.members.length > 0 ? primary.members : sub.members) || [];
  const otherMembers = (secondary.members && secondary.members.length > 0 ? secondary.members : []) || [];

  const updatedMembers: ClubMember[] = baseMembers.map((pm) => {
    const om = otherMembers.find(
      (x) => x.id === pm.id || (x.cardNumber && x.cardNumber === pm.cardNumber) || (x.cpf && x.cpf === pm.cpf)
    );
    if (!om) return pm;

    const docProof = isRealAttachmentUrl(pm.documentProofUrl)
      ? pm.documentProofUrl
      : isRealAttachmentUrl(om.documentProofUrl)
      ? om.documentProofUrl
      : (pm.documentProofUrl || om.documentProofUrl);

    const photoUrl = isRealAttachmentUrl(pm.photoUrl)
      ? pm.photoUrl
      : isRealAttachmentUrl(om.photoUrl)
      ? om.photoUrl
      : (pm.photoUrl || om.photoUrl);

    const memAtts = mergeAttachmentsLists(pm.attachments, om.attachments);
    const hasAnyMemDoc = Boolean(
      isRealAttachmentUrl(docProof) ||
      memAtts.length > 0 ||
      (pm.role === 'TITULAR' && finalAttachments.length > 0)
    );

    return {
      ...om,
      ...pm,
      modalityCode: (pm.modalityCode && pm.modalityCode !== 'SEM_PLANO') ? pm.modalityCode : om.modalityCode,
      modalityName: (pm.modalityName && !/^sem plano$/i.test(pm.modalityName)) ? pm.modalityName : om.modalityName,
      planCycleLabel: (pm.planCycleLabel && !/^sem plano$/i.test(pm.planCycleLabel)) ? pm.planCycleLabel : om.planCycleLabel,
      frontCardUrl: (pm.frontCardUrl && pm.frontCardUrl !== '/cards/13.png') ? pm.frontCardUrl : om.frontCardUrl,
      backCardUrl: pm.backCardUrl || om.backCardUrl,
      photoUrl,
      documentProofUrl: docProof,
      documentProofName: pm.documentProofName || om.documentProofName,
      attachments: memAtts,
      documentStatus: hasAnyMemDoc ? (pm.documentStatus || om.documentStatus) : undefined,
      documentVerified: hasAnyMemDoc ? Boolean(pm.documentVerified ?? om.documentVerified) : false,
      documentVerifiedAt: hasAnyMemDoc ? (pm.documentVerifiedAt || om.documentVerifiedAt) : undefined,
      documentVerifiedBy: hasAnyMemDoc ? (pm.documentVerifiedBy || om.documentVerifiedBy) : undefined,
      rg: pm.rg || om.rg,
      birthDate: pm.birthDate || om.birthDate,
      expirationDate: pm.expirationDate || om.expirationDate,
      validityLabel: pm.validityLabel || om.validityLabel,
    };
  });

  // Mescla faturas (preservando baixas de pagamento do Asaas de qualquer lado!)
  const mergedInvoices = (() => {
    const subInvs = sub.invoices || [];
    const permInvs = perm.invoices || [];
    if (permInvs.length === 0) return subInvs;
    if (subInvs.length === 0) return permInvs;
    const baseInvs = permInvs.length >= subInvs.length ? permInvs : subInvs;
    const otherInvs = permInvs.length >= subInvs.length ? subInvs : permInvs;
    const otherMap = new Map(otherInvs.map((i) => [i.id, i]));
    return baseInvs.map((inv) => {
      const o = otherMap.get(inv.id);
      if (!o) return inv;
      // Se qualquer um dos lados registrou PAID no Asaas, preserva o PAID
      if (o.status === 'PAID' && inv.status !== 'PAID') {
        return { ...inv, ...o };
      }
      return permIsNewerOrEqual ? { ...o, ...inv } : { ...inv, ...o };
    });
  })();

  const finalStatus = (primary.status || secondary.status || sub.status) as ClubSubscription['status'];

  return {
    ...sub,
    ...(permIsNewerOrEqual ? perm : {}),
    holderName: primary.holderName || secondary.holderName || sub.holderName,
    holderCpf: primary.holderCpf || secondary.holderCpf || sub.holderCpf,
    holderRg: primary.holderRg || secondary.holderRg || sub.holderRg,
    holderBirthDate: primary.holderBirthDate || secondary.holderBirthDate || sub.holderBirthDate,
    holderSex: primary.holderSex || secondary.holderSex || sub.holderSex,
    holderMaritalStatus: primary.holderMaritalStatus || secondary.holderMaritalStatus || sub.holderMaritalStatus,
    holderPhone: primary.holderPhone || secondary.holderPhone || sub.holderPhone,
    holderEmail: primary.holderEmail || secondary.holderEmail || sub.holderEmail,
    consultantName: primary.consultantName || secondary.consultantName || sub.consultantName,
    influencerName: primary.influencerName || secondary.influencerName || sub.influencerName,
    addressCep: (primary.addressCep && primary.addressCep !== '76870-000')
      ? primary.addressCep
      : (secondary.addressCep && secondary.addressCep !== '76870-000')
      ? secondary.addressCep
      : (primary.addressCep || secondary.addressCep || sub.addressCep),
    addressStreet: primary.addressStreet || secondary.addressStreet || sub.addressStreet,
    addressNumber: primary.addressNumber || secondary.addressNumber || sub.addressNumber,
    addressComplement: primary.addressComplement || secondary.addressComplement || sub.addressComplement,
    addressNeighborhood: primary.addressNeighborhood || secondary.addressNeighborhood || sub.addressNeighborhood,
    addressCity: primary.addressCity || secondary.addressCity || sub.addressCity,
    addressState: primary.addressState || secondary.addressState || sub.addressState,
    vehicleModel: primary.vehicleModel || secondary.vehicleModel || sub.vehicleModel,
    vehicleBrand: primary.vehicleBrand || secondary.vehicleBrand || sub.vehicleBrand,
    vehiclePlate: primary.vehiclePlate || secondary.vehiclePlate || sub.vehiclePlate,
    vehicleColor: primary.vehicleColor || secondary.vehicleColor || sub.vehicleColor,
    vehicleStickerPhotoUrl: isRealAttachmentUrl(primary.vehicleStickerPhotoUrl)
      ? primary.vehicleStickerPhotoUrl
      : isRealAttachmentUrl(secondary.vehicleStickerPhotoUrl)
      ? secondary.vehicleStickerPhotoUrl
      : sub.vehicleStickerPhotoUrl,
    vehicleStickerPhotoName: primary.vehicleStickerPhotoName || secondary.vehicleStickerPhotoName || sub.vehicleStickerPhotoName,
    notes: primary.notes || secondary.notes || sub.notes,
    endDate: primary.endDate || secondary.endDate || sub.endDate,
    validityLabel: primary.validityLabel || secondary.validityLabel || sub.validityLabel,
    status: finalStatus,
    inactivityReason: finalStatus === 'ACTIVE' ? undefined : (primary.inactivityReason ?? secondary.inactivityReason),
    inactivityReasons: finalStatus === 'ACTIVE' ? undefined : (primary.inactivityReasons ?? secondary.inactivityReasons),
    inactivityNotes: finalStatus === 'ACTIVE' ? undefined : (primary.inactivityNotes ?? secondary.inactivityNotes),
    manualStatusOverride: primary.manualStatusOverride ?? secondary.manualStatusOverride ?? sub.manualStatusOverride,
    transferCompleted: primary.transferCompleted ?? secondary.transferCompleted ?? sub.transferCompleted,
    manuallyConfirmedTransfer: primary.manuallyConfirmedTransfer ?? secondary.manuallyConfirmedTransfer ?? sub.manuallyConfirmedTransfer,
    transferredAt: primary.transferredAt || secondary.transferredAt || sub.transferredAt,
    attachments: finalAttachments,
    members: updatedMembers.length > 0 ? updatedMembers : sub.members,
    invoices: mergedInvoices,
    updatedAt: new Date(Math.max(subTime, permTime)).toISOString(),
    isModifiedFromSeed: true,
  };
}
