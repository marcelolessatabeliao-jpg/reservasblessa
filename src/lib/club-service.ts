import { supabase } from '@/integrations/supabase/client';
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
} from './club-types';

const STORAGE_KEY = 'lessa_club_ecosystem_v1';
const SUPABASE_SETTINGS_KEY = 'lessa_club_ecosystem_v1';

export interface ClubDatabaseState {
  modalities: ClubModality[];
  subscriptions: ClubSubscription[];
  consultants: ClubConsultant[];
  contractTemplates: ClubContractTemplate[];
  cashEntries?: ClubCashEntry[];
  lastCardSequence: number;
  updatedAt: string;
}

const getInitialState = (): ClubDatabaseState => ({
  modalities: DEFAULT_CLUB_MODALITIES,
  subscriptions: [],
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
  lastCardSequence: 3000, // Sequência após 1212252999
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

export const formatDateBR = (isoOrDate?: string | null): string => {
  if (!isoOrDate) return '-';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(isoOrDate)) return isoOrDate;
  const parts = isoOrDate.split('T')[0].split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoOrDate;
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

export const getQrCodeImageUrl = (payload: string, size = 240): string =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=4&data=${encodeURIComponent(
    payload
  )}`;

// Lê o estado local imediatamente e sincroniza com o Supabase (site_settings)
export const loadClubStateLocal = (): ClubDatabaseState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialState();
    const parsed = JSON.parse(raw) as Partial<ClubDatabaseState>;
    // Garante que novas modalidades padrão estejam presentes
    const mergedModalities = [...DEFAULT_CLUB_MODALITIES].map((def) => {
      const saved = parsed.modalities?.find((m) => m.code === def.code || m.id === def.id);
      return saved ? { ...def, ...saved } : def;
    });
    const customModalities = (parsed.modalities || []).filter(
      (m) => !DEFAULT_CLUB_MODALITIES.some((def) => def.code === m.code || def.id === m.id)
    );
    const hasLatestContractFormat = parsed.contractTemplates?.every((t) =>
      (t.contentHtml?.includes('[/resumo-financeiro-contrato]') &&
        t.contentHtml?.includes('BLOCO-ASSINATURAS-IMPRESSAO')) ||
      t.id === 'TERMOS_SITE'
    );
    return {
      modalities: [...mergedModalities, ...customModalities],
      subscriptions: parsed.subscriptions || [],
      consultants: parsed.consultants?.length ? parsed.consultants : getInitialState().consultants,
      contractTemplates:
        parsed.contractTemplates?.length && hasLatestContractFormat
          ? parsed.contractTemplates
          : DEFAULT_CONTRACT_TEMPLATES,
      lastCardSequence: parsed.lastCardSequence || 3000,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch (e) {
    console.error('[ClubService] Error reading local state:', e);
    return getInitialState();
  }
};

export const saveClubState = async (state: ClubDatabaseState): Promise<ClubDatabaseState> => {
  const nextState: ClubDatabaseState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch (e) {
    console.warn('[ClubService] localStorage quota warning:', e);
  }

  try {
    await supabase
      .from('site_settings' as any)
      .upsert(
        {
          key: SUPABASE_SETTINGS_KEY,
          value: nextState,
          updated_at: nextState.updatedAt,
        },
        { onConflict: 'key' }
      );
  } catch (err) {
    console.warn('[ClubService] Error syncing to Supabase site_settings:', err);
  }

  return nextState;
};

export const fetchClubState = async (): Promise<ClubDatabaseState> => {
  const local = loadClubStateLocal();
  try {
    const { data, error } = await supabase
      .from('site_settings' as any)
      .select('value, updated_at')
      .eq('key', SUPABASE_SETTINGS_KEY)
      .maybeSingle();

    if (!error && data && (data as any).value) {
      const remote = (data as any).value as ClubDatabaseState;
      // Usa o estado que tiver mais assinaturas ou atualização mais recente
      const remoteSubsCount = remote.subscriptions?.length || 0;
      const localSubsCount = local.subscriptions?.length || 0;
      if (
        remoteSubsCount > localSubsCount ||
        (remote.updatedAt && (!local.updatedAt || remote.updatedAt >= local.updatedAt))
      ) {
        const mergedModalities = [...DEFAULT_CLUB_MODALITIES].map((def) => {
          const saved = remote.modalities?.find((m) => m.code === def.code || m.id === def.id);
          return saved ? { ...def, ...saved } : def;
        });
        const customModalities = (remote.modalities || []).filter(
          (m) => !DEFAULT_CLUB_MODALITIES.some((def) => def.code === m.code || def.id === m.id)
        );
        const remoteHasLatestContract = remote.contractTemplates?.every(
          (t) =>
            (t.contentHtml?.includes('[/resumo-financeiro-contrato]') &&
              t.contentHtml?.includes('BLOCO-ASSINATURAS-IMPRESSAO')) ||
            t.id === 'TERMOS_SITE'
        );
        const normalized: ClubDatabaseState = {
          modalities: [...mergedModalities, ...customModalities],
          subscriptions: remote.subscriptions || [],
          consultants: remote.consultants?.length ? remote.consultants : local.consultants,
          contractTemplates:
            remote.contractTemplates?.length && remoteHasLatestContract
              ? remote.contractTemplates
              : DEFAULT_CONTRACT_TEMPLATES,
          lastCardSequence: Math.max(remote.lastCardSequence || 3000, local.lastCardSequence || 3000),
          updatedAt: remote.updatedAt || new Date().toISOString(),
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } catch {}
        return normalized;
      }
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
  influencerName?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  vehicleColor?: string;
  notes?: string;
  contractType?: ContractTemplateType;
  members: CreateSubscriptionMemberInput[];
}

export const createClubSubscription = async (
  input: CreateSubscriptionInput
): Promise<{ subscription: ClubSubscription; firstInvoice?: ClubInvoice }> => {
  const state = await fetchClubState();
  let seq = state.lastCardSequence || 3000;

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
      cardNumber: memberCardNumberFormat(memberCardNum),
      holderCardNumber,
      qrToken: memberCardNum,
      frontCardUrl: frontUrl,
      backCardUrl: backUrl,
      validityLabel,
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

  // Regra:
  // - Plano Anual + PIX: 1 cobrança integral à vista (valor total de 1 ano)
  // - Plano Anual + Cartão de Crédito: valor integral dividido em 1x até 12x no cartão de crédito
  // - Plano Mensal (PIX, Cartão de Crédito ou Cartão de Débito): 12 cobranças mensais recorrentes
  const isAnnualPixFull =
    !isFree && input.billingCycle === 'ANNUAL' && input.paymentMethod === 'PIX';

  const chosenAnnualInstallments = Math.max(
    1,
    Math.min(12, input.installments || 12)
  );

  const installmentsCount = isFree
    ? 1
    : isAnnualPixFull
    ? 1
    : input.billingCycle === 'ANNUAL'
    ? chosenAnnualInstallments
    : 12;

  const annualCreditInstallmentValue =
    input.billingCycle === 'ANNUAL' && installmentsCount > 0
      ? Number((totalContractValue / installmentsCount).toFixed(2))
      : Number(monthlyEquivalent.toFixed(2));

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
    const invoiceAmount = isFree
      ? 0
      : isAnnualPixFull
      ? Number(totalContractValue.toFixed(2))
      : input.billingCycle === 'ANNUAL'
      ? annualCreditInstallmentValue
      : Number(monthlyEquivalent.toFixed(2));

    const descriptionLabel = isFree
      ? `Isenção / Gratuidade - ${planSummaryLabel}`
      : isAnnualPixFull
      ? `Pagamento Anual Integral à Vista (PIX) - ${planSummaryLabel}`
      : input.billingCycle === 'ANNUAL'
      ? `Parcela ${i}/${installmentsCount} (Plano Anual no Cartão de Crédito) - ${planSummaryLabel}`
      : `Mensalidade Recorrente ${i}/12 - ${planSummaryLabel}`;

    invoices.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `inv-${Date.now()}-${i}`,
      subscriptionId,
      subscriptionCode: holderCardNumber,
      holderName: input.holderName.trim().toUpperCase(),
      holderCpf: formatCpf(input.holderCpf),
      holderPhone: formatPhone(input.holderPhone),
      installmentNumber: i,
      totalInstallments: installmentsCount,
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

  const finalStatus: SubscriptionStatus =
    input.status || (isFree ? 'ACTIVE' : 'INACTIVE');

  // Sincroniza status dos membros
  builtMembers.forEach((m) => {
    m.status = finalStatus;
  });

  const hasPublicidade = builtMembers.some((m) => m.modalityCode === 'PUBLICIDADE');
  const contractType: ContractTemplateType =
    input.contractType || (hasPublicidade ? 'FAMILY_PUBLICIDADE' : 'ADESAO_PF');

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
    installments: invoices.length,
    monthlyEquivalent: Number(monthlyEquivalent.toFixed(2)),
    totalContractValue: Number(totalContractValue.toFixed(2)),
    dueDay: input.dueDay || now.getDate(),
    status: finalStatus,
    origin: input.origin || 'SITE',
    consultantName: input.consultantName || '',
    influencerName: input.influencerName || '',
    planSummaryLabel,
    vehicleModel: input.vehicleModel || '',
    vehiclePlate: input.vehiclePlate || '',
    vehicleColor: input.vehicleColor || '',
    notes: input.notes || '',
    contractType,
    contractAccepted: true,
    contractSignedAt: now.toISOString(),
    startDate,
    endDate,
    members: builtMembers,
    invoices,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  state.lastCardSequence = seq;
  state.subscriptions = [subscription, ...state.subscriptions];
  await saveClubState(state);

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
  billingType: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO' = 'PIX'
): Promise<{
  paymentId: string;
  invoiceUrl: string;
  pixPayload?: string;
  pixQrCode?: string;
}> => {
  const asaasBillingType =
    billingType === 'CREDIT_CARD' || billingType === 'DEBIT_CARD'
      ? 'UNDEFINED'
      : billingType;

  const { data, error } = await supabase.functions.invoke('create-payment', {
    body: {
      orderId: invoice.id,
      name: subscription.holderName,
      email: subscription.holderEmail || 'socio@balneariolessa.com.br',
      phone: cleanDigits(subscription.holderPhone),
      cpf: cleanDigits(subscription.holderCpf),
      billingType: asaasBillingType,
      value: invoice.amount,
      description: `Lessa Club (${subscription.subscriptionCode}) - ${invoice.description || `${subscription.planSummaryLabel}`}`,
    },
  });

  if (error || !data?.success) {
    throw new Error(data?.error || error?.message || 'Não foi possível gerar a cobrança no Asaas.');
  }

  const paymentData = data.data;
  // Salva os dados na fatura e ativa/vincula na assinatura
  const state = await fetchClubState();
  const subIdx = state.subscriptions.findIndex((s) => s.id === subscription.id);
  if (subIdx >= 0) {
    const targetSub = state.subscriptions[subIdx];
    targetSub.asaasPaymentId = paymentData.paymentId;
    targetSub.asaasInvoiceUrl = paymentData.invoiceUrl;
    const invIdx = targetSub.invoices.findIndex((inv) => inv.id === invoice.id);
    if (invIdx >= 0) {
      targetSub.invoices[invIdx].asaasPaymentId = paymentData.paymentId;
      targetSub.invoices[invIdx].invoiceUrl = paymentData.invoiceUrl;
      if (paymentData.pix) {
        targetSub.invoices[invIdx].pixPayload = paymentData.pix.payload;
        targetSub.invoices[invIdx].pixQrCode = paymentData.pix.encodedImage;
      }
    }
    await saveClubState(state);
  }

  return {
    paymentId: paymentData.paymentId,
    invoiceUrl: paymentData.invoiceUrl,
    pixPayload: paymentData.pix?.payload,
    pixQrCode: paymentData.pix?.encodedImage,
  };
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

  if (inv.asaasPaymentId) {
    try {
      const { data } = await supabase.functions.invoke('check-payment', {
        body: { paymentId: inv.asaasPaymentId, orderId: inv.id },
      });
      if (data?.isPaid || data?.status === 'RECEIVED' || data?.status === 'CONFIRMED') {
        await markClubInvoicePaid(subscriptionId, invoiceId);
        return true;
      }
    } catch (e) {
      console.warn('[ClubService] check-payment error:', e);
    }
  }
  return false;
};

export const markClubInvoicePaid = async (
  subscriptionId: string,
  invoiceId: string,
  method?: ClubPaymentMethod
): Promise<ClubDatabaseState> => {
  const state = await fetchClubState();
  const sub = state.subscriptions.find((s) => s.id === subscriptionId);
  if (sub) {
    const inv = sub.invoices.find((i) => i.id === invoiceId);
    if (inv) {
      inv.status = 'PAID';
      inv.paidAt = new Date().toISOString();
      if (method) inv.paymentMethod = method;
    }
    // Se estava pendente ou vencida e não há mais faturas vencidas, ativa a assinatura e todas as carteirinhas
    const hasOverdue = sub.invoices.some((i) => i.status === 'OVERDUE');
    if (!hasOverdue) {
      sub.status = 'ACTIVE';
      sub.members.forEach((m) => {
        m.status = 'ACTIVE';
      });
    }
    sub.updatedAt = new Date().toISOString();
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
  };

  let html = tpl.contentHtml;
  Object.entries(replacements).forEach(([key, val]) => {
    html = html.split(key).join(val);
  });
  return html;
};

// ============================================================================
// BUSCA RÁPIDA (LUPA FLUTUANTE / PORTARIA / QR CODE)
// ============================================================================
export const findMemberOrSubscriptionByQuery = (
  state: ClubDatabaseState,
  query: string
): Array<{ member: ClubMember; subscription: ClubSubscription }> => {
  const q = query.trim().toLowerCase();
  const qDigits = cleanDigits(query);
  if (!q) return [];

  const results: Array<{ member: ClubMember; subscription: ClubSubscription }> = [];
  for (const sub of state.subscriptions) {
    for (const member of sub.members) {
      const matchName = member.fullName.toLowerCase().includes(q) || sub.holderName.toLowerCase().includes(q);
      const matchCard =
        member.cardNumber.toLowerCase().includes(q) ||
        member.qrToken.toLowerCase() === q ||
        sub.subscriptionCode.toLowerCase().includes(q);
      const matchCpf =
        qDigits.length >= 3 &&
        (cleanDigits(member.cpf).includes(qDigits) || cleanDigits(sub.holderCpf).includes(qDigits));

      if (matchName || matchCard || matchCpf) {
        results.push({ member, subscription: sub });
      }
    }
  }
  return results;
};
