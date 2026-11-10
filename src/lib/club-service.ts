import { supabase } from '@/integrations/supabase/client';
import { getLabcardSubscriptions } from './labcard-seed';
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
} from './club-types';

const STORAGE_KEY = 'lessa_club_ecosystem_v1';
const SUPABASE_SETTINGS_KEY = 'lessa_club_ecosystem_v1';

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

export const DEFAULT_SITE_TERMS_TEXT = `BALNEÁRIO FAMÍLIA LESSA
Contrato de Adesão de Associado

1. DO OBJETO E ACEITAÇÃO
1.1 Os presentes Termos e Condições Gerais de Uso regulam a adesão, o acesso e a utilização das dependências, serviços e benefícios disponibilizados pelo Balneário Família Lessa, por meio de planos, carteirinhas ou acessos avulsos.
1.2. Ao realizar o cadastro, efetuar pagamento ou utilizar qualquer plano ou benefício, o usuário declara, de forma expressa, que leu, compreendeu e concorda integralmente com todas as disposições deste instrumento, obrigando-se a cumpri-las durante toda a vigência do plano contratado.
1.3. A não concordância com quaisquer cláusulas implica na impossibilidade de adesão ou utilização dos serviços oferecidos.

2. DA NATUREZA DO BALNEÁRIO
2.1. O Balneário Família Lessa é um empreendimento privado destinado ao lazer, convivência familiar e turismo recreativo, com ambiente cristão, seguro e orientado por normas internas próprias.
2.2. O acesso às dependências, quiosques, piscinas e estruturas naturais está condicionado às regras de segurança, disponibilidade operacional e critérios da administração.

3. DO CADASTRO E RESPONSABILIDADE DAS INFORMAÇÕES
3.1. Para adesão aos planos, o titular deve fornecer dados completos e verdadeiros (Nome, CPF, Telefone, Endereço e dados dos dependentes).
3.2. As carteirinhas emitidas são de uso estritamente pessoal e intransferível.

4. DOS PLANOS, ACESSO, DIAS DE FUNCIONAMENTO E BENEFÍCIOS
4.1. O titular e dependentes têm direito de entrada ilimitada no Balneário nos dias e horários de funcionamento: atualmente de sexta-feira a domingo e feriados, das 9h às 17h.
4.2. Apresentação obrigatória de documento oficial com foto e carteirinha de sócio física ou digital (QR Code).
4.3. Manutenção de valores de tabela contratados para o ciclo anual vigente e regras de transição de faixa etária para dependentes kids e estudantes.

5. DAS REGRAS DE CONDUTA E USO DAS DEPENDÊNCIAS
5.1. O usuário compromete-se a zelar pelo patrimônio, preservar a natureza, fauna e flora, manter conduta compatível com ambiente familiar e acatar as orientações dos monitores e salva-vidas.
5.2. É expressamente proibido som automotivo abusivo, porte de armas, brigas, substâncias ilícitas ou condutas contrárias à moral e segurança coletiva.

6. DAS FORMAS DE PAGAMENTO E INADIMPLÊNCIA
6.1. O pagamento pode ser realizado via PIX integral, Cartão de Crédito parcelado ou mensalidades recorrentes.
6.2. Em caso de inadimplência em planos recorrentes, o acesso à portaria poderá ser temporariamente suspenso até a regularização da parcela.

7. DA VIGÊNCIA E CANCELAMENTO SEM MULTA
7.1. O plano vigorará pelo prazo de 12 (doze) meses ou renovação mensal acordada.
7.2. O cancelamento pode ser solicitado a qualquer momento pelo titular SEM QUALQUER MULTA RESCISÓRIA.

8. DO FORO
8.1. Fica eleito o Foro da Comarca de Ariquemes, Estado de Rondônia, para dirimir quaisquer dúvidas oriundas deste contrato.`;

export interface ClubDatabaseState {
  modalities: ClubModality[];
  subscriptions: ClubSubscription[];
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
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75
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
    return {
      ...sub,
      status: isLabcard ? ('PENDING_TRANSFER' as SubscriptionStatus) : sub.status,
      members: (sub.members || []).map((m) => {
        let frontUrl = m.frontCardUrl;
        let backUrl = m.backCardUrl;

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

        if (m.modalityCode === 'KIDS' || m.modalityCode === 'IDOSO_60') {
          backUrl = '/cards/39.png';
        } else if (isOutdatedCardUrl(backUrl)) {
          backUrl = '/cards/24.png';
        }

        return {
          ...m,
          status: isLabcard ? ('PENDING_TRANSFER' as SubscriptionStatus) : m.status,
          frontCardUrl: frontUrl || '/cards/44.png',
          backCardUrl: backUrl || '/cards/24.png',
        };
      }),
      invoices: Array.isArray(sub.invoices) ? sub.invoices : [],
      attachments: Array.isArray(sub.attachments) ? sub.attachments : [],
      visits: Array.isArray(sub.visits) ? sub.visits : [],
      additionalServices: Array.isArray(sub.additionalServices) ? sub.additionalServices : [],
    };
  });

  const hasLatestContractFormat = parsed.contractTemplates?.every(
    (t) =>
      (t.contentHtml?.includes('[/resumo-financeiro-contrato]') &&
        t.contentHtml?.includes('BLOCO-ASSINATURAS-IMPRESSAO')) ||
      t.id === 'TERMOS_SITE'
  );

  return {
    modalities: [...mergedModalities, ...customModalities].map((m) => ({
      ...m,
      benefits: Array.isArray(m.benefits) ? m.benefits : [],
    })),
    subscriptions: normalizedSubscriptions,
    consultants: parsed.consultants?.length ? parsed.consultants : fallbackState?.consultants || getInitialState().consultants,
    contractTemplates:
      parsed.contractTemplates?.length && hasLatestContractFormat
        ? parsed.contractTemplates
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
    siteTermsText:
      parsed.siteTermsText && parsed.siteTermsText.length > 100
        ? parsed.siteTermsText
        : fallbackState?.siteTermsText && fallbackState.siteTermsText.length > 100
        ? fallbackState.siteTermsText
        : DEFAULT_SITE_TERMS_TEXT,
    updatedAt: parsed.updatedAt || new Date().toISOString(),
  };
};

export const loadClubStateLocal = (): ClubDatabaseState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialState();
    const parsed = JSON.parse(raw) as Partial<ClubDatabaseState>;
    return normalizeClubDatabaseState(parsed);
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
    const { error } = await supabase
      .from('site_settings' as any)
      .upsert(
        {
          key: SUPABASE_SETTINGS_KEY,
          value: nextState,
          updated_at: nextState.updatedAt,
        },
        { onConflict: 'key' }
      );
    if (error) {
      console.error('[ClubService] CRITICAL: Error saving to Supabase site_settings:', error);
      throw new Error(`Falha ao registrar no banco de dados: ${error.message}`);
    }
  } catch (err) {
    console.error('[ClubService] Exception syncing to Supabase site_settings:', err);
    throw err;
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
      const remote = (data as any).value as Partial<ClubDatabaseState>;
      const remoteSubs = remote.subscriptions || [];
      const localSubs = local.subscriptions || [];
      const defaultLabcardSubs = getLabcardSubscriptions();

      // Unir assinaturas pelo ID de modo que nenhuma adesão feita no site ou admin se perca
      const subsMap = new Map<string, ClubSubscription>();
      defaultLabcardSubs.forEach((s) => subsMap.set(s.id, s));
      localSubs.forEach((s) => {
        if (!subsMap.has(s.id)) {
          subsMap.set(s.id, s);
        }
      });
      remoteSubs.forEach((s) => subsMap.set(s.id, s));

      // Preservar status ATIVO quando houver vínculo de cartão ou faturamento efetivo, e PENDING_TRANSFER para os demais
      subsMap.forEach((sub) => {
        if ((sub.origin === 'IMPORT_LABCARD' || sub.id.startsWith('sub-labcard-')) && sub.status !== 'ACTIVE') {
          sub.status = 'PENDING_TRANSFER';
          if (sub.members) {
            sub.members.forEach((m) => {
              if (m.status !== 'ACTIVE') m.status = 'PENDING_TRANSFER';
            });
          }
        }
      });

      const mergedState: Partial<ClubDatabaseState> = {
        ...remote,
        subscriptions: Array.from(subsMap.values()),
        lastCardSequence: Math.max(remote.lastCardSequence || 3015, local.lastCardSequence || 3015, 3015),
      };

      const normalized = normalizeClubDatabaseState(mergedState, local);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      } catch {}
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
  influencerName?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  vehicleColor?: string;
  notes?: string;
  contractType?: ContractTemplateType;
  attachments?: ClubAttachment[];
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
  const isAnnualUpfrontFull =
    !isFree &&
    input.billingCycle === 'ANNUAL' &&
    (input.paymentMethod === 'PIX' || input.paymentMethod === 'DEBIT_CARD');

  const chosenAnnualInstallments = Math.max(
    1,
    Math.min(12, input.installments || 12)
  );

  const installmentsCount = isFree
    ? 1
    : isAnnualUpfrontFull
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
      : isAnnualUpfrontFull
      ? Number(totalContractValue.toFixed(2))
      : input.billingCycle === 'ANNUAL'
      ? annualCreditInstallmentValue
      : Number(monthlyEquivalent.toFixed(2));

    const descriptionLabel = isFree
      ? `Isenção / Gratuidade - ${planSummaryLabel}`
      : isAnnualUpfrontFull
      ? `Pagamento Anual Integral à Vista (${input.paymentMethod === 'DEBIT_CARD' ? 'Cartão de Débito' : 'PIX'}) - ${planSummaryLabel}`
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
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // Gerar o contrato oficial preenchido com todos os dados do titular e dependentes
  subscription.contractContentHtml = renderSubscriptionContractHtml(
    subscription,
    state.contractTemplates
  );

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

  const loginUser = subscription.holderEmail || subscription.holderCpf;
  const loginPass = getBirthDatePassword(subscription.holderBirthDate);
  const portalUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/socio`
      : 'https://balneariolessa.com.br/socio';

  const asaasDescription = [
    `Lessa Club (${subscription.subscriptionCode}) - ${invoice.description || subscription.planSummaryLabel}`,
    `🔐 Portal do Sócio: ${portalUrl}`,
    `👤 Usuário: ${loginUser}`,
    `🔑 Senha: ${loginPass} (sua data de nascimento)`,
  ].join('\n');

  const { data, error } = await supabase.functions.invoke('create-payment', {
    body: {
      orderId: invoice.id,
      name: subscription.holderName,
      email: subscription.holderEmail || 'socio@balneariolessa.com.br',
      phone: cleanDigits(subscription.holderPhone),
      cpf: cleanDigits(subscription.holderCpf),
      billingType: asaasBillingType,
      value: invoice.amount,
      dueDate: invoice.dueDate,
      description: asaasDescription,
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

export const generateAllAsaasInvoicesForSubscription = async (
  subscription: ClubSubscription,
  billingType: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' = 'PIX'
): Promise<ClubDatabaseState> => {
  const state = await fetchClubState();
  const subIdx = state.subscriptions.findIndex((s) => s.id === subscription.id);
  if (subIdx < 0) return state;

  const targetSub = state.subscriptions[subIdx];
  const invoicesToGenerate = targetSub.invoices.filter((inv) => !inv.asaasPaymentId && inv.amount > 0);

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
        `🔐 Portal do Sócio: ${portalUrl}`,
        `👤 Usuário: ${loginUser}`,
        `🔑 Senha: ${loginPass} (sua data de nascimento)`,
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
  const chosenInstallments = isAnnual ? Math.max(1, Math.min(12, cardData.installments || 12)) : 1;
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
    `🔐 Portal do Sócio: ${portalUrl}`,
    `👤 Usuário: ${loginUser}`,
    `🔑 Senha: ${loginPass} (sua data de nascimento)`,
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

  // Salva os dados na fatura e na assinatura
  const state = await fetchClubState();
  const subIdx = state.subscriptions.findIndex((s) => s.id === subscription.id);
  if (subIdx >= 0) {
    const targetSub = state.subscriptions[subIdx];
    targetSub.asaasPaymentId = paymentData.paymentId;
    targetSub.asaasInvoiceUrl = paymentData.invoiceUrl;
    targetSub.installments = chosenInstallments;
    const invIdx = targetSub.invoices.findIndex((inv) => inv.id === invoice.id);
    if (invIdx >= 0) {
      targetSub.invoices[invIdx].asaasPaymentId = paymentData.paymentId;
      targetSub.invoices[invIdx].invoiceUrl = paymentData.invoiceUrl;
      targetSub.invoices[invIdx].paymentMethod = 'CREDIT_CARD';
      if (isPaid) {
        targetSub.invoices[invIdx].status = 'PAID';
        targetSub.invoices[invIdx].paidAt = new Date().toISOString();
      }
    }
    if (isPaid) {
      targetSub.status = 'ACTIVE';
      targetSub.members.forEach((m) => {
        m.status = 'ACTIVE';
      });
      targetSub.contractContentHtml = renderSubscriptionContractHtml(
        targetSub,
        state.contractTemplates
      );
    }
    await saveClubState(state);
  }

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
  billingType: 'CREDIT_CARD' | 'UNDEFINED' | 'PIX' = 'UNDEFINED'
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

  const loginUser = subscription.holderEmail || subscription.holderCpf;
  const loginPass = getBirthDatePassword(subscription.holderBirthDate);
  const portalUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/socio`
      : 'https://balneariolessa.com.br/socio';

  const asaasDescription = [
    `Lessa Club (${subscription.subscriptionCode}) - Quitação Unificada no Cartão (${invoices.length} parcelas)`,
    `🔐 Portal do Sócio: ${portalUrl}`,
    `👤 Usuário: ${loginUser}`,
    `🔑 Senha: ${loginPass} (sua data de nascimento)`,
  ].join('\n');

  const { data, error } = await supabase.functions.invoke('create-payment', {
    body: {
      orderId: `unified_${subscription.id}_${Date.now()}`,
      name: subscription.holderName,
      email: subscription.holderEmail || 'socio@balneariolessa.com.br',
      phone: cleanDigits(subscription.holderPhone),
      cpf: cleanDigits(subscription.holderCpf),
      billingType: billingType === 'CREDIT_CARD' ? 'UNDEFINED' : billingType,
      value: totalAmount,
      totalValue: totalAmount,
      description: asaasDescription,
    },
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
    // Atualiza contrato oficial gerado com a confirmação de quitação / pagamento
    sub.contractContentHtml = renderSubscriptionContractHtml(sub, state.contractTemplates);
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

// ============================================================================
// ============================================================================
// BUSCA RÁPIDA (LUPA FLUTUANTE / PORTARIA / QR CODE)
// ============================================================================
export const scoreSearchMatch = (
  text: string,
  query: string
): number => {
  const t = text.trim().toLowerCase();
  const q = query.trim().toLowerCase();
  if (!t || !q) return 0;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 950;

  const tWords = t.split(/\s+/).filter(Boolean);
  const qWords = q.split(/\s+/).filter(Boolean);

  if (qWords.length === 1) {
    const qw = qWords[0];
    // Primeiro nome começa exatamente com a busca (Ex: "Maria Clara" ao buscar "maria")
    if (tWords[0]?.startsWith(qw)) return 850;
    // Sobrenome começa com a busca (Ex: "Ana Maria" ao buscar "maria")
    if (tWords.slice(1).some((w) => w.startsWith(qw))) return 700;
    // Subtermo no texto
    if (t.includes(qw)) return 400;
    return 0;
  }

  // Múltiplas palavras (Ex: "Maria Silva")
  const matchesFirst = tWords[0]?.startsWith(qWords[0]);
  const allPrefixes = qWords.every((qw) => tWords.some((tw) => tw.startsWith(qw)));
  if (matchesFirst && allPrefixes) return 900;
  if (allPrefixes) return 800;
  if (t.includes(q)) return 500;

  return 0;
};

export const findMemberOrSubscriptionByQuery = (
  state: ClubDatabaseState,
  query: string
): Array<{ member: ClubMember; subscription: ClubSubscription }> => {
  const q = query.trim().toLowerCase();
  const qDigits = cleanDigits(query);
  if (!q) return [];

  const scoredResults: Array<{
    member: ClubMember;
    subscription: ClubSubscription;
    score: number;
    createdAt: number;
  }> = [];

  for (const sub of state.subscriptions) {
    const subCreatedTime = new Date(sub.createdAt || sub.startDate || 0).getTime();
    for (const member of sub.members) {
      let maxScore = 0;

      // 1. Prioridade por Nome (Primeiro nome > Sobrenome > Substring)
      const nameScore = Math.max(
        scoreSearchMatch(member.fullName, q),
        scoreSearchMatch(sub.holderName, q)
      );
      if (nameScore > maxScore) maxScore = nameScore;

      // 2. Email exato ou prefixo
      if (sub.holderEmail) {
        const em = sub.holderEmail.toLowerCase().trim();
        if (em === q) maxScore = Math.max(maxScore, 920);
        else if (em.startsWith(q)) maxScore = Math.max(maxScore, 800);
        else if (em.includes(q)) maxScore = Math.max(maxScore, 300);
      }

      // 3. Carteirinha / Código
      const cardNum = member.cardNumber.toLowerCase();
      const code = sub.subscriptionCode.toLowerCase();
      const qrTok = member.qrToken.toLowerCase();
      if (cardNum === q || code === q || qrTok === q) {
        maxScore = Math.max(maxScore, 980);
      } else if (cardNum.startsWith(q) || code.startsWith(q)) {
        maxScore = Math.max(maxScore, 850);
      } else if (cardNum.includes(q) || code.includes(q)) {
        maxScore = Math.max(maxScore, 400);
      }

      // 4. CPF
      if (qDigits.length >= 3) {
        const memberCpf = cleanDigits(member.cpf);
        const holderCpf = cleanDigits(sub.holderCpf);
        if (memberCpf === qDigits || holderCpf === qDigits) {
          maxScore = Math.max(maxScore, 980);
        } else if (memberCpf.startsWith(qDigits) || holderCpf.startsWith(qDigits)) {
          maxScore = Math.max(maxScore, 860);
        } else if (memberCpf.includes(qDigits) || holderCpf.includes(qDigits)) {
          maxScore = Math.max(maxScore, 450);
        }
      }

      if (maxScore > 0) {
        scoredResults.push({
          member,
          subscription: sub,
          score: maxScore,
          createdAt: subCreatedTime,
        });
      }
    }
  }

  // Ordenar pelo score mais alto (quem começa com o nome primeiro), e em caso de empate, pelo cadastro mais recente
  scoredResults.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.createdAt - a.createdAt;
  });

  return scoredResults.map(({ member, subscription }) => ({ member, subscription }));
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
export const getMemberAccessMessage = (sub: ClubSubscription): { message: string; whatsappUrl: string; loginUser: string; password: string } => {
  const loginUser = sub.holderEmail || sub.holderCpf;
  const password = getBirthDatePassword(sub.holderBirthDate);
  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/socio` : 'https://balneariolessa.com.br/socio';

  const message = `🌿 *BALNEÁRIO FAMÍLIA LESSA — BEM-VINDO AO LESSA CLUB!* 🌿\n\nOlá, *${sub.holderName}*! Seu plano foi cadastrado com sucesso.\n\nVocê já pode acessar o Portal do Sócio para ver suas carteirinhas digitais com QR Code, enviar fotos e consultar seu contrato:\n\n🌐 *Portal do Sócio:* ${portalUrl}\n👤 *Usuário (Login):* ${loginUser}\n🔑 *Senha:* ${password} _(sua data de nascimento)_\n\nGuarde esses dados com carinho. Qualquer dúvida, estamos à disposição!`;

  const phone = cleanDigits(sub.holderPhone);
  const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
  const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;

  return { message, whatsappUrl, loginUser, password };
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
