import { supabase } from '@/integrations/supabase/client';
import type { ClubDatabaseState } from './club-service';
import type { ClubSubscription, ClubMember, ClubInvoice } from './club-types';

/**
 * Converte qualquer ID alfanumérico para um UUID válido de 36 caracteres de forma determinística
 */
export const ensureUuid = (rawId: string): string => {
  if (!rawId) return '00000000-0000-0000-0000-000000000000';
  
  // Se já for um UUID v4/v5 válido
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(rawId)) {
    return rawId.toLowerCase();
  }

  // Gera hash simples determinístico de 32 chars hex
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < rawId.length; i++) {
    const char = rawId.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ char;
    hash2 = ((hash2 << 5) + hash2) ^ (char * (i + 1));
  }

  const hex1 = Math.abs(hash1).toString(16).padStart(8, '0');
  const hex2 = Math.abs(hash2).toString(16).padStart(8, '0');
  const hex3 = Math.abs(hash1 ^ hash2).toString(16).padStart(8, '0');
  const hex4 = Math.abs(hash1 + hash2).toString(16).padStart(8, '0');
  const fullHex = (hex1 + hex2 + hex3 + hex4).slice(0, 32);

  return [
    fullHex.substring(0, 8),
    fullHex.substring(8, 12),
    '4' + fullHex.substring(13, 16),
    'a' + fullHex.substring(17, 20),
    fullHex.substring(20, 32),
  ].join('-');
};

export interface RelationalSyncResult {
  syncedSubscriptions: number;
  syncedMembers: number;
  syncedInvoices: number;
  success: boolean;
  errors: string[];
}

/**
 * Sincroniza em lote todo o estado do Lessa Club para as tabelas relacionais do Supabase
 * (club_subscriptions, club_members, club_invoices)
 */
export const syncStateToRelationalDatabase = async (
  state: ClubDatabaseState
): Promise<RelationalSyncResult> => {
  const result: RelationalSyncResult = {
    syncedSubscriptions: 0,
    syncedMembers: 0,
    syncedInvoices: 0,
    success: true,
    errors: [],
  };

  if (!state || !Array.isArray(state.subscriptions)) {
    result.success = false;
    result.errors.push('Estado inválido');
    return result;
  }

  const subscriptions = state.subscriptions;
  const deletedSet = new Set(state.deletedSubscriptionIds || []);

  const activeSubs = subscriptions.filter((s) => !deletedSet.has(s.id));

  // 1. Mapear Assinaturas
  const subsPayload = activeSubs.map((s) => {
    const subUuid = ensureUuid(s.id);
    return {
      id: subUuid,
      subscription_code: s.subscriptionCode || s.id,
      person_type: s.personType || 'PF',
      holder_name: s.holderName || 'Associado',
      holder_cpf: s.holderCpf || '',
      holder_rg: s.holderRg || null,
      holder_birth_date: s.holderBirthDate || null,
      holder_sex: s.holderSex || null,
      holder_marital_status: s.holderMaritalStatus || null,
      holder_phone: s.holderPhone || '',
      holder_email: s.holderEmail || null,
      address_cep: s.addressCep || null,
      address_street: s.addressStreet || null,
      address_number: s.addressNumber || null,
      address_complement: s.addressComplement || null,
      address_neighborhood: s.addressNeighborhood || null,
      address_city: s.addressCity || 'Ariquemes',
      address_state: s.addressState || 'RO',
      billing_cycle: s.billingCycle || 'MONTHLY',
      payment_method: s.paymentMethod || 'PIX',
      installments: s.installments || 1,
      monthly_equivalent: Number(s.monthlyEquivalent || 0),
      total_contract_value: Number(s.totalContractValue || 0),
      due_day: Number(s.dueDay || 10),
      status: s.status || 'ACTIVE',
      origin: s.origin || 'SITE',
      consultant_id: s.consultantId || null,
      consultant_name: s.consultantName || null,
      influencer_name: s.influencerName || null,
      plan_summary_label: s.planSummaryLabel || 'Lessa Pass',
      vehicle_model: s.vehicleModel || null,
      vehicle_plate: s.vehiclePlate || null,
      vehicle_color: s.vehicleColor || null,
      notes: s.notes || null,
      asaas_customer_id: s.asaasCustomerId || null,
      asaas_subscription_id: s.asaasSubscriptionId || null,
      asaas_payment_id: s.asaasPaymentId || null,
      asaas_invoice_url: s.asaasInvoiceUrl || null,
      contract_type: s.contractType || 'ADESAO_PF',
      contract_accepted: s.contractAccepted ?? true,
      contract_signed_at: s.contractSignedAt || null,
      start_date: s.startDate || new Date().toISOString().slice(0, 10),
      end_date: s.endDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      created_at: s.createdAt || new Date().toISOString(),
      updated_at: s.updatedAt || new Date().toISOString(),
    };
  });

  // Grava assinaturas em lotes de 40
  const chunkSize = 40;
  for (let i = 0; i < subsPayload.length; i += chunkSize) {
    const chunk = subsPayload.slice(i, i + chunkSize);
    try {
      const { error } = await supabase
        .from('club_subscriptions' as any)
        .upsert(chunk, { onConflict: 'id' });

      if (error) {
        result.errors.push(`Erro ao gravar assinaturas (lote ${i}): ${error.message}`);
      } else {
        result.syncedSubscriptions += chunk.length;
      }
    } catch (err: any) {
      result.errors.push(`Exceção ao gravar assinaturas: ${err?.message || err}`);
    }
  }

  // 2. Mapear Membros (Titular + Dependentes)
  const membersPayload: any[] = [];
  activeSubs.forEach((s) => {
    const subUuid = ensureUuid(s.id);

    // Titular
    const holderId = ensureUuid(`${s.id}_holder`);
    const holderCardNumber = s.holderCardNumber || s.cardNumber || s.subscriptionCode;
    membersPayload.push({
      id: holderId,
      subscription_id: subUuid,
      role: 'TITULAR',
      modality_code: s.planSummaryLabel || 'TITULAR',
      modality_label: s.planSummaryLabel || 'Titular',
      full_name: s.holderName,
      cpf: s.holderCpf,
      rg: s.holderRg || null,
      birth_date: s.holderBirthDate || null,
      phone: s.holderPhone || null,
      photo_url: (s as any).photoUrl || null,
      document_proof_url: (s as any).documentProofUrl || null,
      card_number: holderCardNumber || `CARD-${subUuid.slice(0, 8)}`,
      holder_card_number: holderCardNumber,
      qr_token: `QR-TIT-${subUuid.slice(0, 12)}`,
      front_card_url: 'https://placehold.co/card',
      back_card_url: 'https://placehold.co/back',
      validity_label: s.endDate ? s.endDate.slice(0, 7) : '12/2027',
      status: s.status || 'ACTIVE',
      created_at: s.createdAt || new Date().toISOString(),
    });

    // Dependentes
    (s.dependents || []).forEach((dep, idx) => {
      const depUuid = ensureUuid(dep.id || `${s.id}_dep_${idx}`);
      membersPayload.push({
        id: depUuid,
        subscription_id: subUuid,
        role: 'DEPENDENTE',
        modality_code: dep.modalityCode || 'DEP',
        modality_label: dep.modalityName || dep.planCycleLabel || 'Dependente',
        full_name: dep.fullName || 'Dependente',
        cpf: dep.cpf || '',
        rg: dep.rg || null,
        birth_date: dep.birthDate || null,
        phone: dep.phone || null,
        photo_url: dep.photoUrl || null,
        document_proof_url: dep.documentProofUrl || null,
        card_number: dep.cardNumber || `CARD-DEP-${depUuid.slice(0, 8)}`,
        holder_card_number: holderCardNumber,
        qr_token: dep.qrToken || `QR-DEP-${depUuid.slice(0, 12)}`,
        front_card_url: dep.frontCardUrl || 'https://placehold.co/card',
        back_card_url: dep.backCardUrl || 'https://placehold.co/back',
        validity_label: dep.validityLabel || '12/2027',
        status: dep.status || 'ACTIVE',
        created_at: dep.createdAt || new Date().toISOString(),
      });
    });
  });

  // Grava membros em lotes de 40
  for (let i = 0; i < membersPayload.length; i += chunkSize) {
    const chunk = membersPayload.slice(i, i + chunkSize);
    try {
      const { error } = await supabase
        .from('club_members' as any)
        .upsert(chunk, { onConflict: 'id' });

      if (error) {
        result.errors.push(`Erro ao gravar membros (lote ${i}): ${error.message}`);
      } else {
        result.syncedMembers += chunk.length;
      }
    } catch (err: any) {
      result.errors.push(`Exceção ao gravar membros: ${err?.message || err}`);
    }
  }

  // 3. Mapear Faturas (Invoices)
  const invoicesPayload: any[] = [];
  activeSubs.forEach((s) => {
    const subUuid = ensureUuid(s.id);
    (s.invoices || []).forEach((inv, idx) => {
      const invUuid = ensureUuid(inv.id || `${s.id}_inv_${idx}`);
      invoicesPayload.push({
        id: invUuid,
        subscription_id: subUuid,
        holder_name: inv.holderName || s.holderName,
        holder_cpf: inv.holderCpf || s.holderCpf,
        installment_number: inv.installmentNumber || idx + 1,
        total_installments: inv.totalInstallments || (s.invoices || []).length || 1,
        reference_month: inv.referenceMonth || '01/2027',
        amount: Number(inv.amount || 0),
        due_date: inv.dueDate || new Date().toISOString().slice(0, 10),
        paid_at: inv.paidAt || null,
        payment_method: inv.paymentMethod || 'PIX',
        status: inv.status || 'PENDING',
        asaas_payment_id: inv.asaasPaymentId || null,
        invoice_url: inv.invoiceUrl || null,
        pix_payload: inv.pixPayload || null,
        pix_qr_code: inv.pixQrCode || null,
        created_at: inv.createdAt || new Date().toISOString(),
      });
    });
  });

  // Grava faturas em lotes de 50
  for (let i = 0; i < invoicesPayload.length; i += chunkSize) {
    const chunk = invoicesPayload.slice(i, i + chunkSize);
    try {
      const { error } = await supabase
        .from('club_invoices' as any)
        .upsert(chunk, { onConflict: 'id' });

      if (error) {
        result.errors.push(`Erro ao gravar faturas (lote ${i}): ${error.message}`);
      } else {
        result.syncedInvoices += chunk.length;
      }
    } catch (err: any) {
      result.errors.push(`Exceção ao gravar faturas: ${err?.message || err}`);
    }
  }

  result.success = result.errors.length === 0;
  return result;
};
