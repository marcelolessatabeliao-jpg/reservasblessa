export type BillingCycle = 'MONTHLY' | 'ANNUAL';
export type SubscriptionStatus = 'ACTIVE' | 'PENDING' | 'OVERDUE' | 'INACTIVE' | 'CANCELLED' | 'PROSPECT' | 'ARCHIVED_PROSPECT';
export type ClubPaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO' | 'COURTESY' | 'LOCAL';
export type ContractTemplateType = 'ADESAO_PF' | 'TERMOS_SITE' | 'FAMILY_PUBLICIDADE';

export interface ClubModality {
  id: string;
  code: string;
  name: string;
  subtitle: string;
  verse: string;
  monthlyPrice: number;
  annualPrice: number; // valor anual integral (12x annualInstallment)
  annualInstallment: number; // parcela mensal no plano anual
  maxInstallments?: number; // parcelamento máximo no cartão (padrão 12x)
  adhesionFee: number;
  maxDependents: number;
  gracePeriodDays: number;
  frontCardUrl: string;
  dependentFrontCardUrl?: string;
  backCardUrl: string;
  dependentBackCardUrl?: string;
  requiresDocument: boolean;
  documentLabel?: string;
  isFreeTier: boolean;
  isCorporate?: boolean;
  requiresVehicle?: boolean;
  visibleOnSite: boolean;
  visibleInSimulator: boolean;
  visibleToConsultants: boolean;
  visibleToInfluencers: boolean;
  contractType: ContractTemplateType;
  active: boolean;
  emoji?: string;
  badgeText?: string;
  benefits?: string[];
  visibleOnTotem?: boolean;
  addExistingConsultants?: boolean;
  addExistingInfluencers?: boolean;
  telemedicina?: boolean;
  planType?: 'NORMAL' | 'EMPRESARIAL' | 'CONVENIO' | 'PUBLICIDADE';
  recurrenceType?: 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'VITALICIO';
  sortOrder?: number;
  deleted?: boolean;
}

export interface ClubMember {
  id: string;
  subscriptionId: string;
  role: 'TITULAR' | 'DEPENDENTE';
  modalityCode: string;
  modalityName: string;
  planCycleLabel: string; // Ex: "Lessa Student Pass (Mensal)" ou "Lessa Servidor Pass (Anual)"
  fullName: string;
  cpf: string;
  rg?: string;
  birthDate?: string;
  sex?: string;
  phone?: string;
  photoUrl?: string;
  documentProofUrl?: string;
  documentProofName?: string;
  cardNumber: string; // Ex: 1212252975
  holderCardNumber: string;
  qrToken: string;
  frontCardUrl: string;
  backCardUrl: string;
  validityLabel: string; // Ex: 10/2027
  monthlyValue: number;
  status: SubscriptionStatus;
  expirationDate?: string; // YYYY-MM-DD - Vencimento individual do cadastro/benefício do dependente (ex: quando a criança completa idade pagante ou expira comprovação)
  expirationNotes?: string; // Motivo do vencimento (ex: "Completa idade em 2 meses - passa a ser pagante")
  attachments?: ClubAttachment[]; // Anexos e documentos individuais do dependente
  createdAt: string;
}

export interface ClubInvoice {
  id: string;
  subscriptionId: string;
  subscriptionCode: string;
  holderName: string;
  holderCpf: string;
  holderPhone: string;
  installmentNumber: number;
  totalInstallments: number;
  referenceMonth: string; // Ex: "10/2026"
  amount: number;
  dueDate: string; // YYYY-MM-DD
  paidAt?: string;
  paymentMethod: ClubPaymentMethod;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'CANCELLED';
  asaasPaymentId?: string;
  invoiceUrl?: string;
  pixPayload?: string;
  pixQrCode?: string;
  description?: string;
  createdAt: string;
}

export interface ClubAttachment {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  createdAt: string;
}

export interface ClubVisitRecord {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  memberName: string;
  cardNumber: string;
  source: 'QR_SCAN' | 'ADMIN_AGENDA';
  notes?: string;
}

export interface ClubAdditionalService {
  id: string;
  name: string;
  category?: string;
  price: number;
  addedAt: string;
  notes?: string;
}

export interface ClubRegisteredCard {
  brand?: string;
  holderName: string;
  last4Digits: string;
  expiry: string;
  cardType: 'CREDIT' | 'DEBIT';
  installments: number;
  installmentValue: number;
  registeredAt: string;
}

export interface ClubSubscription {
  id: string;
  subscriptionCode: string;
  personType: 'PF' | 'PJ';
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
  addressCity: string;
  addressState: string;
  billingCycle: BillingCycle;
  paymentMethod: ClubPaymentMethod;
  installments: number;
  monthlyEquivalent: number;
  totalContractValue: number;
  dueDay: number;
  status: SubscriptionStatus;
  origin: 'SITE' | 'ADMIN' | 'IMPORT_LABCARD';
  consultantName?: string;
  influencerName?: string;
  consultantCode?: string;
  consultantId?: string;
  planSummaryLabel: string; // Ex: "Família Personalizado (1 Integral + 1 Estudante + 1 Kids)"
  vehicleModel?: string;
  vehiclePlate?: string;
  vehicleColor?: string;
  notes?: string;
  asaasCustomerId?: string;
  asaasSubscriptionId?: string;
  asaasPaymentId?: string;
  asaasInvoiceUrl?: string;
  contractType: ContractTemplateType;
  contractAccepted: boolean;
  contractSignedAt: string;
  contractSignatureIp?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  members: ClubMember[];
  invoices: ClubInvoice[];
  attachments?: ClubAttachment[];
  visits?: ClubVisitRecord[];
  additionalServices?: ClubAdditionalService[];
  registeredCard?: ClubRegisteredCard;
  createdAt: string;
  updatedAt: string;
}

export interface ClubConsultant {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email?: string;
  role: 'CONSULTOR' | 'INFLUENCER';
  commissionPercent: number;
  commissionType?: 'PERCENT' | 'FIXED';
  commissionValue?: number;
  commissionRecurring?: boolean;
  commissionFirstOnly?: boolean;
  paymentMethodsAllowed?: {
    boleto: boolean;
    pix: boolean;
    creditCard: boolean;
    recurrence: boolean;
  };
  referralCode: string;
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE';
  createdAt: string;
}

export interface ClubContractTemplate {
  id: ContractTemplateType;
  title: string;
  description: string;
  contentHtml: string;
  updatedAt: string;
}

export interface ClubCashEntry {
  id: string;
  type: 'IN' | 'OUT';
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

// ============================================================================
// CATÁLOGO OFICIAL DE MODALIDADES (UNIFICADO MENSAL + ANUAL + ARTES OFICIAIS)
// ============================================================================
export const DEFAULT_CLUB_MODALITIES: ClubModality[] = [
  {
    id: 'mod-lessa-club',
    code: 'ADULTO',
    name: 'Lessa Club',
    subtitle: 'ASSOCIADO',
    verse: '“O Senhor prosperará o trabalho das tuas mãos.” – Deuteronômio 28:12',
    monthlyPrice: 49.90,
    annualInstallment: 44.91,
    annualPrice: 538.91,
    maxInstallments: 12,
    adhesionFee: 0,
    maxDependents: 99,
    gracePeriodDays: 0,
    frontCardUrl: '/cards/44.png',
    dependentFrontCardUrl: '/cards/44.png',
    backCardUrl: '/cards/24.png',
    dependentBackCardUrl: '/cards/24.png',
    requiresDocument: false,
    documentLabel: 'Documento Oficial com Foto (RG ou CNH)',
    isFreeTier: false,
    visibleOnSite: true,
    visibleInSimulator: true,
    visibleToConsultants: true,
    visibleToInfluencers: true,
    contractType: 'ADESAO_PF',
    active: true,
    emoji: '🎟️',
    badgeText: 'ACESSO ILIMITADO'
  },
  {
    id: 'mod-student-pass',
    code: 'ESTUDANTE',
    name: 'Lessa Student Pass',
    subtitle: 'MEIA-ENTRADA',
    verse: '“Ensina-me o caminho que devo seguir.” – Salmos 32:8',
    monthlyPrice: 25.00,
    annualInstallment: 22.50,
    annualPrice: 270.00,
    maxInstallments: 12,
    adhesionFee: 0,
    maxDependents: 99,
    gracePeriodDays: 0,
    frontCardUrl: '/cards/6.png',
    dependentFrontCardUrl: '/cards/6.png',
    backCardUrl: '/cards/24.png',
    dependentBackCardUrl: '/cards/24.png',
    requiresDocument: true,
    documentLabel: 'Carteirinha de Estudante ou Declaração Escolar/Faculdade',
    isFreeTier: false,
    visibleOnSite: true,
    visibleInSimulator: true,
    visibleToConsultants: true,
    visibleToInfluencers: true,
    contractType: 'ADESAO_PF',
    active: true,
    emoji: '🎓',
    badgeText: '50% OFF'
  },
  {
    id: 'mod-professor-pass',
    code: 'PROFESSOR',
    name: 'Lessa Professor Pass',
    subtitle: 'MEIA-ENTRADA',
    verse: '“Os que ensinam a muitos brilharão como estrelas.” – Daniel 12:3',
    monthlyPrice: 25.00,
    annualInstallment: 22.50,
    annualPrice: 270.00,
    maxInstallments: 12,
    adhesionFee: 0,
    maxDependents: 99,
    gracePeriodDays: 0,
    frontCardUrl: '/cards/3.png',
    dependentFrontCardUrl: '/cards/3.png',
    backCardUrl: '/cards/24.png',
    dependentBackCardUrl: '/cards/24.png',
    requiresDocument: true,
    documentLabel: 'Holerite, Crachá ou Comprovante de Docência',
    isFreeTier: false,
    visibleOnSite: true,
    visibleInSimulator: true,
    visibleToConsultants: true,
    visibleToInfluencers: true,
    contractType: 'ADESAO_PF',
    active: true,
    emoji: '📚',
    badgeText: '50% OFF'
  },
  {
    id: 'mod-servidor-pass',
    code: 'SERVIDOR',
    name: 'Lessa Servidor Pass',
    subtitle: 'MEIA-ENTRADA',
    verse: '“Bem-aventurado o servo que se mantém fiel.” – Lucas 12:43',
    monthlyPrice: 25.00,
    annualInstallment: 22.50,
    annualPrice: 270.00,
    maxInstallments: 12,
    adhesionFee: 0,
    maxDependents: 99,
    gracePeriodDays: 0,
    frontCardUrl: '/cards/10.png',
    dependentFrontCardUrl: '/cards/10.png',
    backCardUrl: '/cards/24.png',
    dependentBackCardUrl: '/cards/24.png',
    requiresDocument: true,
    documentLabel: 'Holerite, Portaria ou Funcional de Servidor Público',
    isFreeTier: false,
    visibleOnSite: true,
    visibleInSimulator: true,
    visibleToConsultants: true,
    visibleToInfluencers: true,
    contractType: 'ADESAO_PF',
    active: true,
    emoji: '🏛️',
    badgeText: '50% OFF'
  },
  {
    id: 'mod-lessa-kids',
    code: 'KIDS',
    name: 'Lessa Kids',
    subtitle: 'ENTRADA GRATUITA',
    verse: '“Deixem vir a mim as crianças.” – Mateus 19:14',
    monthlyPrice: 0.00,
    annualInstallment: 0.00,
    annualPrice: 0.00,
    adhesionFee: 0,
    maxDependents: 99,
    gracePeriodDays: 0,
    frontCardUrl: '/cards/38.png',
    dependentFrontCardUrl: '/cards/38.png',
    backCardUrl: '/cards/39.png',
    dependentBackCardUrl: '/cards/39.png',
    requiresDocument: true,
    documentLabel: 'Certidão de Nascimento ou RG da Criança (até 11 anos)',
    isFreeTier: true,
    visibleOnSite: true,
    visibleInSimulator: true,
    visibleToConsultants: true,
    visibleToInfluencers: true,
    contractType: 'ADESAO_PF',
    active: true,
    emoji: '👶',
    badgeText: 'GRÁTIS (ATÉ 11 ANOS)'
  },
  {
    id: 'mod-vitalicio-60',
    code: 'IDOSO_60',
    name: 'Lessa Vitalício 60+',
    subtitle: 'SÓCIO VITALÍCIO (ISENTO)',
    verse: '“Honra os idosos.” – Levítico 19:32',
    monthlyPrice: 0.00,
    annualInstallment: 0.00,
    annualPrice: 0.00,
    adhesionFee: 0,
    maxDependents: 99,
    gracePeriodDays: 0,
    frontCardUrl: '/cards/26.png',
    dependentFrontCardUrl: '/cards/26.png',
    backCardUrl: '/cards/39.png',
    dependentBackCardUrl: '/cards/39.png',
    requiresDocument: true,
    documentLabel: 'RG ou CNH comprovando 60 anos ou mais',
    isFreeTier: true,
    visibleOnSite: true,
    visibleInSimulator: true,
    visibleToConsultants: true,
    visibleToInfluencers: true,
    contractType: 'ADESAO_PF',
    active: true,
    emoji: '🧓',
    badgeText: 'ISENTO 60+'
  },
  {
    id: 'mod-inclusao-pcd',
    code: 'PCD_TEA',
    name: 'Lessa Inclusão - PCD e TEA',
    subtitle: 'ENTRADA GRATUITA + 1 ACOMP.',
    verse: '“Defendei o direito do fraco e do necessitado.” – Provérbios 31:9',
    monthlyPrice: 0.00,
    annualInstallment: 0.00,
    annualPrice: 0.00,
    adhesionFee: 0,
    maxDependents: 99,
    gracePeriodDays: 0,
    frontCardUrl: '/cards/35.png',
    dependentFrontCardUrl: '/cards/35.png',
    backCardUrl: '/cards/24.png',
    dependentBackCardUrl: '/cards/24.png',
    requiresDocument: true,
    documentLabel: 'Laudo Médico ou Carteirinha CIPTEA / PCD',
    isFreeTier: true,
    visibleOnSite: true,
    visibleInSimulator: true,
    visibleToConsultants: true,
    visibleToInfluencers: true,
    contractType: 'ADESAO_PF',
    active: true,
    emoji: '♿',
    badgeText: 'GRÁTIS + 1 ACOMP.'
  },
  {
    id: 'mod-parceiro',
    code: 'PARCEIRO',
    name: 'Lessa Parceiro',
    subtitle: 'ASSOCIADO',
    verse: '“O Senhor prosperará o trabalho das tuas mãos.” – Deuteronômio 28:12',
    monthlyPrice: 25.00,
    annualInstallment: 25.00,
    annualPrice: 300.00,
    adhesionFee: 0,
    maxDependents: 99,
    gracePeriodDays: 0,
    frontCardUrl: '/cards/21.png',
    dependentFrontCardUrl: '/cards/21.png',
    backCardUrl: '/cards/24.png',
    dependentBackCardUrl: '/cards/24.png',
    requiresDocument: false,
    isFreeTier: false,
    visibleOnSite: false,
    visibleInSimulator: false,
    visibleToConsultants: true,
    visibleToInfluencers: true,
    contractType: 'ADESAO_PF',
    active: true,
    emoji: '🤝',
    badgeText: 'PARCEIRO'
  },
  {
    id: 'mod-corporate-pass',
    code: 'CORPORATE',
    name: 'Lessa Corporate Pass',
    subtitle: 'ASSOCIADO',
    verse: '“Digno é o trabalhador do seu salário.” – Lucas 10:7',
    monthlyPrice: 0.00,
    annualInstallment: 0.00,
    annualPrice: 0.00,
    adhesionFee: 0,
    maxDependents: 99,
    gracePeriodDays: 0,
    frontCardUrl: '/cards/14.png',
    dependentFrontCardUrl: '/cards/13.png',
    backCardUrl: '/cards/24.png',
    dependentBackCardUrl: '/cards/15.png',
    requiresDocument: false,
    isFreeTier: true,
    isCorporate: true,
    visibleOnSite: false,
    visibleInSimulator: false,
    visibleToConsultants: true,
    visibleToInfluencers: false,
    contractType: 'ADESAO_PF',
    active: true,
    emoji: '🏢',
    badgeText: 'CORPORATIVO'
  },
  {
    id: 'mod-family-publicidade',
    code: 'PUBLICIDADE',
    name: 'Lessa Family Publicidade',
    subtitle: 'ENTRADA GRATUITA + DEPENDENTES',
    verse: '“Anunciai entre as nações a sua glória.” – Salmos 96:3',
    monthlyPrice: 0.00,
    annualInstallment: 0.00,
    annualPrice: 0.00,
    adhesionFee: 0,
    maxDependents: 10,
    gracePeriodDays: 0,
    frontCardUrl: '/cards/29.png',
    dependentFrontCardUrl: '/cards/30.png',
    backCardUrl: '/cards/33.png',
    dependentBackCardUrl: '/cards/33.png',
    requiresDocument: true,
    documentLabel: 'Documento do Veículo (CRLV) e CNH',
    isFreeTier: true,
    requiresVehicle: true,
    visibleOnSite: false,
    visibleInSimulator: false,
    visibleToConsultants: true,
    visibleToInfluencers: true,
    contractType: 'FAMILY_PUBLICIDADE',
    active: true,
    emoji: '🚗',
    badgeText: 'PERMUTA VEÍCULO'
  },
  {
    id: 'mod-convenio-dayuse',
    code: 'CONVENIO_DAYUSE',
    name: 'Lessa Convênio (Day Use)',
    subtitle: 'MEIA-ENTRADA NO DAY USE',
    verse: '“O Senhor prosperará o trabalho das tuas mãos.” – Deuteronômio 28:12',
    monthlyPrice: 0.00,
    annualInstallment: 0.00,
    annualPrice: 0.00,
    adhesionFee: 0,
    maxDependents: 99,
    gracePeriodDays: 0,
    frontCardUrl: '/cards/21.png',
    dependentFrontCardUrl: '/cards/13.png',
    backCardUrl: '/cards/16.png',
    dependentBackCardUrl: '/cards/16.png',
    requiresDocument: false,
    isFreeTier: true,
    visibleOnSite: false,
    visibleInSimulator: false,
    visibleToConsultants: true,
    visibleToInfluencers: true,
    contractType: 'ADESAO_PF',
    active: true,
    emoji: '🎫',
    badgeText: 'CONVÊNIO'
  }
];

// ============================================================================
// OS 3 MODELOS OFICIAIS DE CONTRATO (EXTRAÍDOS DE referencia/contratos/*.pdf)
// ============================================================================
export const DEFAULT_CONTRACT_TEMPLATES: ClubContractTemplate[] = [
  {
    id: 'ADESAO_PF',
    title: 'Termo de Adesão e Condições Gerais de Uso (Planos Lessa Club)',
    description: 'Contrato oficial padrão para associados PF e planos familiares personalizados (contrato.pdf + cláusula 4.7 de garantia de preço 2026/2027).',
    updatedAt: new Date().toISOString(),
    contentHtml: `
<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.75; font-size: 13.5px;">
  <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 24px; background: #ffffff;">
    <tr>
      <td style="width: 22%; text-align: center; padding: 14px; border: 1px solid #cbd5e1;">
        <strong style="color: #005200; font-size: 15px;">BALNEÁRIO FAMÍLIA LESSA</strong><br/>
        <span style="font-size: 11px; color: #64748b;">O Jardim do Éden</span>
      </td>
      <td style="width: 53%; text-align: center; padding: 14px; border: 1px solid #cbd5e1;">
        <h2 style="margin: 0 0 4px 0; font-size: 18px; color: #005200;">BALNEÁRIO FAMÍLIA LESSA LTDA</h2>
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 6px;">TERMO DE ADESÃO E CONDIÇÕES DE USO</div>
        <div style="font-size: 11px; color: #475569;">
          https://balneariolessa.com.br<br/>
          BALNEÁRIO FAMÍLIA LESSA LTDA - CNPJ: 46.891.134/0001-40<br/>
          Via Araras, Setor 09 - Ariquemes/RO - CEP 76870-000
        </div>
      </td>
      <td style="width: 25%; text-align: right; padding: 14px; border: 1px solid #cbd5e1; font-size: 11px;">
        <strong>TERMO Nº [/card-pf]</strong><br/>
        PERÍODO DE VIGÊNCIA DOS SERVIÇOS CONTRATADOS<br/><br/>
        <strong>INÍCIO:</strong> [/emissao-cartao-pf]<br/>
        <strong>FIM:</strong> [/vencimento-cartao-pf]
      </td>
    </tr>
  </table>

  <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
    <h3 style="color: #005200; border-bottom: 2px solid #005200; padding-bottom: 6px; margin-top: 0; margin-bottom: 12px; font-size: 15px;">
      IDENTIFICAÇÃO DAS PARTES
    </h3>
    <div style="margin-bottom: 12px;">
      <strong>CONTRATADA:</strong><br/>
      <strong>BALNEÁRIO FAMÍLIA LESSA LTDA</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 46.891.134/0001-40, com sede à Via Araras, Setor 09, CEP 76870-000, na cidade de Ariquemes, estado de RO, telefone (69) 99262-6140.
    </div>
    <div>
      <strong>CONTRATANTE (TITULAR RESPONSÁVEL):</strong><br/>
      Nome completo: <strong>[/nome-pf]</strong><br/>
      CPF: <strong>[/cpf-pf]</strong> | Data de nascimento: <strong>[/data-nasc-pf]</strong><br/>
      Telefone / WhatsApp: <strong>[/fone-pf]</strong> | E-mail: <strong>[/email-pf]</strong><br/>
      Endereço: <strong>[/end-pf], Nº [/num-pf], [/bairro-pf] - [/cidade-pf]/[/estado-pf] - CEP: [/cep-pf]</strong>
    </div>
  </div>

  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
    <h4 style="color: #005200; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase;">
      DADOS DO PLANO, COBRANÇA E COMPOSIÇÃO FAMILIAR
    </h4>
    <div style="margin-bottom: 6px;">
      Plano contratado: <strong>[/plano-pf]</strong>
    </div>
    <div style="margin-bottom: 6px;">
      [/resumo-financeiro-contrato]
    </div>
    <div>
      Data de adesão (por extenso): <strong>[/data-cadastro-extenso]</strong>
    </div>
  </div>

  <div style="margin-bottom: 24px;">
    [/tabela-integrantes]
  </div>

  <h3 style="color: #005200; border-bottom: 2px solid #005200; padding-bottom: 6px; margin-top: 28px; margin-bottom: 18px; font-size: 16px;">
    BALNEÁRIO FAMÍLIA LESSA — Termos e Condições Gerais de Uso, Adesão e Acesso
  </h3>

  <div style="margin-bottom: 18px;">
    <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 6px;">1. DO OBJETO E ACEITAÇÃO</strong>
    <div style="margin-bottom: 6px;">1.1. Os presentes Termos e Condições Gerais de Uso regulam a adesão, o acesso e a utilização das dependências, serviços e benefícios disponibilizados pelo Balneário Família Lessa, por meio de planos, carteirinhas ou acessos avulsos.</div>
    <div style="margin-bottom: 6px;">1.2. Ao realizar o cadastro, efetuar pagamento ou utilizar qualquer plano ou benefício, o usuário declara, de forma expressa, que leu, compreendeu e concorda integralmente com todas as disposições deste instrumento, obrigando-se a cumpri-las durante toda a vigência do plano contratado.</div>
    <div>1.3. A não concordância com quaisquer cláusulas implica na impossibilidade de adesão ou utilização dos serviços oferecidos.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 6px;">2. DA NATUREZA DO BALNEÁRIO</strong>
    <div style="margin-bottom: 6px;">2.1. O Balneário Família Lessa é um empreendimento privado destinado ao lazer, convivência familiar e turismo recreativo, com ambiente cristão, seguro e orientado por normas internas próprias.</div>
    <div>2.2. O acesso às áreas, estruturas e atrações está condicionado às regras internas, disponibilidade operacional, condições climáticas, manutenção, segurança e critérios definidos pela administração.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 6px;">3. DO CADASTRO E RESPONSABILIDADE DAS INFORMAÇÕES</strong>
    <div style="margin-bottom: 6px;">3.1. Para adesão aos planos, o usuário deverá fornecer informações completas, verídicas e atualizadas, responsabilizando-se civil e criminalmente pela veracidade dos dados prestados.</div>
    <div style="margin-bottom: 6px;">3.2. O Balneário Família Lessa não se responsabiliza por prejuízos decorrentes de informações incorretas, incompletas ou falsas fornecidas pelo usuário.</div>
    <div>3.3. O plano é de uso pessoal e intransferível, salvo quando expressamente previsto em planos familiares ou coletivos, respeitando-se os limites e condições contratadas.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 6px;">4. DOS PLANOS, ACESSO E BENEFÍCIOS</strong>
    <div style="margin-bottom: 6px;">4.1. As condições comerciais, valores, benefícios, quantidade de acessos, vigência e regras específicas variam conforme o plano contratado, conforme descrito no ato da adesão.</div>
    <div style="margin-bottom: 6px;">4.2. Quando previsto no plano contratado, o CONTRATANTE e os dependentes vinculados terão direito à entrada ilimitada no Balneário durante o período de vigência, exclusivamente nos dias e horários regulares de funcionamento, atualmente de sexta-feira a domingo e feriados das 9h (nove horas) às 17h (dezessete horas).</div>
    <div style="margin-bottom: 6px;">4.3. O acesso ao Balneário poderá ser condicionado à apresentação de documento oficial de identificação, carteirinha física ou digital, QR Code e demais meios de validação adotados.</div>
    <div style="margin-bottom: 6px;">4.4. O Balneário reserva-se o direito de restringir, suspender ou reorganizar o acesso a áreas específicas, temporária ou definitivamente, por motivos de segurança, manutenção, força maior, eventos internos ou determinações administrativas, sem que isso gere direito a abatimento, indenização ou reembolso.</div>
    <div style="margin-bottom: 6px;">4.5. Nos planos que concedem benefícios de meia-entrada, gratuidade ou condições especiais, o direito limita-se exclusivamente às regras específicas da modalidade, não se aplicando a entrada ilimitada mensal quando se tratar de convênio day use.</div>
    <div style="margin-bottom: 6px;">4.6. A expressão ‘entrada ilimitada’ refere-se exclusivamente à quantidade de acessos do CONTRATANTE ao local e não sobre serviços à parte, dentro do período de vigência do plano, não se estendendo a dias fechados, horários extraordinários, eventos privados, datas especiais ou situações excepcionais, nem autorização para ingresso de terceiros.</div>
    <div style="margin-bottom: 6px;"><strong>4.7. DA ATUALIZAÇÃO E ALTERAÇÃO DE VALORES:</strong> Os valores dos planos e serviços estão sujeitos a reajustes periódicos, entrando em vigência novos valores a partir de janeiro de 2027.</div>
    <div><strong>4.7.1.</strong> Os CONTRATANTES que aderirem ou renovarem o plano na modalidade anual até 31 de dezembro de 2026 terão a garantia de manutenção do valor originalmente contratado até o término regular da vigência de 1 (um) ano ou até a solicitação de cancelamento, sendo os novos valores aplicáveis somente em futuras renovações.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 6px;">5. DAS REGRAS DE CONDUTA E USO DAS DEPENDÊNCIAS</strong>
    <div style="margin-bottom: 6px;">5.1. O usuário compromete-se a respeitar integralmente as normas internas, zelar pelo patrimônio, preservar o meio ambiente, manter conduta compatível com ambiente familiar e acatar as orientações da equipe.</div>
    <div>5.2. É expressamente vedado: a) O uso inadequado das instalações; b) A prática de atos ilícitos, ofensivos, agressivos ou contrários à moral e aos bons costumes; c) A entrada com itens proibidos pelas normas internas; d) Qualquer conduta que coloque em risco a integridade física, moral ou patrimonial de terceiros.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 6px;">6. DAS RESPONSABILIDADES, RISCOS E ISENÇÕES</strong>
    <div style="margin-bottom: 6px;">6.1. O usuário declara ciência de que atividades de lazer, recreação e contato com a natureza envolvem riscos inerentes, assumindo integral responsabilidade por seus atos, bem como pelos atos de seus dependentes e convidados.</div>
    <div>6.2. O Balneário Família Lessa não se responsabiliza por perdas, extravios, furtos ou danos a bens pessoais, tampouco por acidentes decorrentes de imprudência, negligência, imperícia ou descumprimento das normas.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 6px;">7. DOS SERVIÇOS NÃO INCLUSOS NOS PLANOS</strong>
    <div style="margin-bottom: 6px;">7.1. Os planos e carteirinhas concedem exclusivamente os direitos de acesso previstos em cada modalidade, não abrangendo serviços adicionais ou opcionais.</div>
    <div style="margin-bottom: 6px;">7.2. Não estão incluídos nos planos, sendo cobrados separadamente, entre outros: a) Consumos no restaurante, café colonial, lanchonetes e serviços de alimentação; b) Trilha de quadriciclo; c) Pesca esportiva (pesque e solte); d) Aluguel de equipamentos, utensílios ou itens recreativos; e) Locação específica ou uso exclusivo de quiosques, quando aplicável.</div>
    <div>7.3. Os valores desses serviços poderão ser alterados a qualquer tempo, conforme tabela vigente no momento da utilização.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 6px;">8. DOS PAGAMENTOS, VIGÊNCIA, CANCELAMENTO E AUSÊNCIA DE FIDELIDADE</strong>
    <div style="margin-bottom: 6px;">8.1. Os pagamentos serão processados pela plataforma contratada, conforme condições do plano escolhido.</div>
    <div style="margin-bottom: 6px;">8.2. A vigência do plano terá início após a confirmação do pagamento.</div>
    <div style="margin-bottom: 6px;"><strong>8.3. DO CANCELAMENTO E AUSÊNCIA DE FIDELIDADE:</strong> O plano contratado não possui cláusula de fidelidade, podendo o CONTRATANTE solicitar o cancelamento a qualquer momento, sem cobrança de multa rescisória e sem obrigação de pagamento das parcelas futuras após a efetivação do cancelamento. Para que o cancelamento seja realizado, o CONTRATANTE deverá estar em dia com todas as mensalidades vencidas até a data da solicitação, permanecendo responsável pelos valores já vencidos ou referentes ao mês vigente. O não uso das dependências, atrações, benefícios ou serviços disponibilizados pelo Balneário Família Lessa não isenta o CONTRATANTE da obrigação de pagamento das mensalidades enquanto o plano permanecer ativo. Após a confirmação do cancelamento, o acesso do CONTRATANTE e dos dependentes vinculados ao plano será encerrado.</div>
    <div>8.4. Eventuais reembolsos obedecerão à legislação vigente e às condições específicas do plano contratado, quando aplicáveis.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 6px;">9. DA SUSPENSÃO OU CANCELAMENTO DO ACESSO</strong>
    <div>9.1. O Balneário poderá suspender ou cancelar o acesso do usuário, sem direito a reembolso, nas hipóteses de: a) Descumprimento destes Termos; b) Uso indevido do plano ou tentativa de fraude; c) Conduta incompatível com as normas, valores e finalidade do Balneário.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 6px;">10. DAS ALTERAÇÕES CONTRATUAIS</strong>
    <div style="margin-bottom: 6px;">10.1. O Balneário Família Lessa poderá, a seu exclusivo critério, alterar os presentes Termos, sendo as novas condições aplicáveis a partir de sua publicação nos canais oficiais.</div>
    <div>10.2. Os dias e horários de funcionamento poderão ser alterados por motivo de força maior, clima, manutenção, eventos internos ou decisão administrativa, sem que isso gere direito a indenização, abatimento ou reembolso.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 6px;">11. DA AUTORIZAÇÃO DE USO DE IMAGEM</strong>
    <div style="margin-bottom: 6px;">11.1. O CONTRATANTE declara estar ciente e de acordo que, durante a utilização das dependências e participação em atividades do Balneário Família Lessa, poderão ser realizadas fotografias, filmagens e/ou captações de imagem e som, de forma individual ou coletiva, incluindo imagens do CONTRATANTE, de seus dependentes e demais integrantes vinculados ao plano ou assinatura.</div>
    <div style="margin-bottom: 6px;">11.2. Mediante o aceite do presente Termo, o CONTRATANTE autoriza, de forma gratuita, definitiva, irrevogável e irretratável, o uso de sua imagem e voz, bem como a imagem e voz dos integrantes vinculados à assinatura, para fins institucionais, promocionais, publicitários e de divulgação das atividades do Balneário Família Lessa, em quaisquer meios de comunicação, físicos ou digitais.</div>
    <div>11.3. A presente autorização é concedida sem qualquer ônus financeiro ao Balneário Família Lessa, não gerando direito a indenização, remuneração ou compensação de qualquer natureza.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 6px;">12. LEI APLICÁVEL E FORO</strong>
    <div>Este termo é regido pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de Ariquemes/RO, onde está localizado o Balneário Família Lessa, para dirimir quaisquer controvérsias.</div>
  </div>

  <div style="margin-bottom: 24px;">
    <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 6px;">13. CONTATO</strong>
    <div>Email: balneario.lessa@gmail.com | WhatsApp: (69) 99262-6140 | Instagram: @balneariolessa</div>
  </div>

  <hr style="margin: 24px 0; border-color: #cbd5e1;" />
  <!-- BLOCO-ASSINATURAS-IMPRESSAO -->
  <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 20px; page-break-inside: avoid;">
    <h4 style="margin: 0 0 8px 0; color: #005200; font-size: 14px; text-transform: uppercase;">
      DECLARAÇÃO DE CIÊNCIA, ACEITE E ASSINATURAS DO CONTRATO
    </h4>
    <div style="margin-bottom: 10px;">
      Declaro que li, compreendi e aceito integralmente os Termos e Condições Gerais de Uso do Balneário Família Lessa.
    </div>
    <div style="margin-bottom: 16px;">
      Local e data: <strong>Ariquemes/RO, [/data-cadastro-extenso]</strong> &nbsp;|&nbsp; Emissão: <strong>[/dataAtualExt-admin]</strong><br/>
      <span style="font-size: 11px; color: #059669; font-weight: bold;">
        ✔ Aceite e assinatura eletrônica registrados em [/data-assinatura-iso] (Termo Nº [/card-pf])
      </span>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-top: 28px; text-align: center;">
      <tr>
        <td style="width: 48%; padding: 10px 14px; vertical-align: bottom;">
          <div style="height: 52px;"></div>
          <div style="border-top: 1.5px solid #0f172a; padding-top: 6px; font-weight: bold; font-size: 12px; color: #0f172a;">
            [/nome-pf]
          </div>
          <div style="font-size: 11px; color: #475569;">
            CPF: [/cpf-pf]<br/>
            <strong>CONTRATANTE / ASSOCIADO TITULAR</strong>
          </div>
        </td>
        <td style="width: 4%;"></td>
        <td style="width: 48%; padding: 10px 14px; vertical-align: bottom;">
          <div style="height: 52px;"></div>
          <div style="border-top: 1.5px solid #0f172a; padding-top: 6px; font-weight: bold; font-size: 12px; color: #0f172a;">
            BALNEÁRIO FAMÍLIA LESSA LTDA
          </div>
          <div style="font-size: 11px; color: #475569;">
            CNPJ: 46.891.134/0001-40<br/>
            <strong>CONTRATADA / ADMINISTRAÇÃO</strong>
          </div>
        </td>
      </tr>
    </table>

    <table style="width: 100%; border-collapse: collapse; margin-top: 28px; text-align: center;">
      <tr>
        <td style="width: 48%; padding: 10px 14px; vertical-align: bottom;">
          <div style="border-top: 1px dashed #64748b; padding-top: 6px; font-weight: bold; font-size: 11px; color: #334155;">
            1ª TESTEMUNHA
          </div>
          <div style="font-size: 11px; color: #64748b;">
            Nome: ____________________________________<br/>
            CPF: ___________________________
          </div>
        </td>
        <td style="width: 4%;"></td>
        <td style="width: 48%; padding: 10px 14px; vertical-align: bottom;">
          <div style="border-top: 1px dashed #64748b; padding-top: 6px; font-weight: bold; font-size: 11px; color: #334155;">
            2ª TESTEMUNHA
          </div>
          <div style="font-size: 11px; color: #64748b;">
            Nome: ____________________________________<br/>
            CPF: ___________________________
          </div>
        </td>
      </tr>
    </table>
  </div>
</div>
`
  },
  {
    id: 'FAMILY_PUBLICIDADE',
    title: 'Contrato de Permuta para Veículos — Plano Lessa Family Publicidade',
    description: 'Contrato específico para permuta publicitária com aplicação de adesivo perfurado (perfurite) no veículo cadastrado (family.pdf).',
    updatedAt: new Date().toISOString(),
    contentHtml: `
<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.75; font-size: 13.5px;">
  <h2 style="color: #005200; border-bottom: 2px solid #005200; padding-bottom: 8px; margin-bottom: 18px;">CONTRATO DE PERMUTA PARA VEÍCULOS — PLANO LESSA FAMILY PUBLICIDADE</h2>

  <div style="margin-bottom: 18px;">
    <h3 style="margin-bottom: 8px; color: #0f172a;">IDENTIFICAÇÃO DAS PARTES</h3>
    <div style="margin-bottom: 10px;"><strong>CONTRATADA:</strong><br/>
    <strong>BALNEÁRIO LESSA</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob nº 46.891.134/0001-40, com sede em Ariquemes/RO, doravante denominado "CONTRATANTE".</div>
    <div><strong>PERMUTANTE:</strong><br/>
    <strong>[/nome-pf]</strong>, portador(a) do RG nº <strong>[/rg-pf]</strong> e CPF nº <strong>[/cpf-pf]</strong>, residente e domiciliado(a) à <strong>[/end-pf]</strong>, Nº <strong>[/num-pf]</strong>, Complemento <strong>[/complemento-pf]</strong>, Bairro <strong>[/bairro-pf]</strong>, Cidade <strong>[/cidade-pf]</strong>, Estado <strong>[/estado-pf]</strong>, CEP <strong>[/cep-pf]</strong>, doravante denominado(a) "PERMUTANTE".</div>
  </div>

  <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 14px; border-radius: 8px; margin: 18px 0;">
    <strong>DADOS DO VEÍCULO CADASTRADO:</strong><br/>
    Marca/Modelo: <strong>[/veiculo-modelo]</strong> | Placa: <strong>[/veiculo-placa]</strong> | Cor: <strong>[/veiculo-cor]</strong>
  </div>

  <div style="margin-bottom: 20px;">
    [/tabela-integrantes]
  </div>

  <div style="margin-bottom: 18px;">
    <strong>CLÁUSULA 1 — DO OBJETO</strong><br/>
    O presente contrato tem como objeto a parceria/permuta entre o Balneário Lessa e o Permutante vinculada ao <strong>Plano Lessa Family Publicidade</strong>, mediante a qual o Permutante autoriza a aplicação e o uso contínuo de adesivo perfurado (perfurite) de divulgação do Balneário Lessa no vidro traseiro de seu veículo cadastrado, em contrapartida ao benefício de acesso e day use gratuito às dependências do Balneário Lessa durante a vigência deste instrumento.
  </div>

  <div style="margin-bottom: 18px;">
    <strong>CLÁUSULA 2 — DAS CONDIÇÕES OBRIGATÓRIAS DE ACESSO E ENTRADA</strong><br/>
    <strong>2.1. Exigência do Veículo na Portaria:</strong> O acesso e a liberação da entrada do Permutante e de seus dependentes são <strong>estritamente vinculados e condicionados à chegada no Balneário com o veículo cadastrado</strong> neste contrato.<br/>
    <strong>2.2. Verificação Presencial e Ineficácia da Carteirinha Isolada:</strong> A apresentação isolada de carteirinha física ou digital <strong>NÃO autoriza o acesso</strong>. Na portaria/recepção, será realizada obrigatoriamente a inspeção visual pela equipe para constatar:<br/>
    a) Se o veículo que transporta os associados corresponde exatamente ao modelo e placa cadastrados;<br/>
    b) Se o adesivo perfurado está devidamente aplicado, íntegro e visível no vidro.<br/>
    2.3. Caso o Permutante e seus dependentes compareçam em outro veículo (de aplicativo, emprestado, carona, etc.) ou sem o veículo cadastrado, <strong>o benefício da gratuidade não será aplicado</strong>, ficando o acesso condicionado ao pagamento regular de entrada/day use.<br/>
    2.4. Em caso de manutenção mecânica, conserto, avaria ou substituição do veículo cadastrado, o Permutante deverá comunicar previamente à administração do Balneário para regularização e nova aplicação do adesivo, ficando o benefício suspenso até a nova vistoria.
  </div>

  <div style="margin-bottom: 18px;">
    <strong>CLÁUSULA 3 — DAS OBRIGAÇÕES DAS PARTES</strong><br/>
    <strong>3.1. Obrigações do Permutante:</strong><br/>
    1. Disponibilizar o veículo cadastrado para a aplicação do adesivo perfurado;<br/>
    2. Manter o adesivo colado, limpo e em perfeito estado de conservação durante toda a vigência da permuta;<br/>
    3. Não remover, recortar, cobrir, descaracterizar ou danificar o adesivo antes do término da vigência, salvo prévia autorização por escrito do Contratante;<br/>
    4. Manter o veículo em circulação regular, sem películas sobrepostas ou objetos que obstruam a visualização da arte publicitária.<br/>
    <strong>3.2. Obrigações do Contratante:</strong><br/>
    1. Conceder ao Permutante e aos seus dependentes diretos de primeiro grau (cônjuge/companheiro(a) e/ou filhos) entrada gratuita em regime de day use nos dias regulares de funcionamento (sextas-feiras, sábados, domingos e feriados), durante o horário regular das 9h às 17h;<br/>
    2. Disponibilizar acesso às estruturas comuns abertas do Balneário Lessa, incluindo cachoeiras com piscinas naturais, piscinas convencionais, campos de futebol/vôlei e áreas comuns de lazer;<br/>
    3. Não estão inclusos no benefício os consumos de restaurantes/bares, locações privativas de quiosques, trilhas de quadriciclo, pesque-solte ou outros serviços cobrados à parte.
  </div>

  <div style="margin-bottom: 18px;">
    <strong>CLÁUSULA 4 — DA VIGÊNCIA</strong><br/>
    A presente permuta terá vigência de 6 (seis) meses, contados a partir da data de assinatura deste contrato e da aplicação do adesivo, podendo ser renovada por igual período mediante comum acordo entre as partes e vistoria do estado do adesivo.
  </div>

  <div style="margin-bottom: 18px;">
    <strong>CLÁUSULA 5 — DA REVOGAÇÃO, RESCISÃO E PENALIDADES</strong><br/>
    5.1. O contrato poderá ser rescindido por qualquer das partes mediante comunicação prévia de 10 (dez) dias.<br/>
    5.2. Caso o Permutante remova, danifique intencionalmente ou oculte o adesivo antes do término do prazo, perderá imediatamente e de pleno direito o benefício do acesso gratuito.<br/>
    5.3. O descumprimento das normas internas do Balneário, condutas incompatíveis com o ambiente familiar ou tentativa de burlar a conferência veicular na portaria acarretará a rescisão imediata do contrato e o cancelamento do benefício.
  </div>

  <div style="margin-bottom: 18px;">
    <strong>CLÁUSULA 6 — DA RESPONSABILIDADE SOBRE O VEÍCULO</strong><br/>
    O Contratante não se responsabiliza por quaisquer danos mecânicos, elétricos, sinistros, desgaste natural decorrente do uso cotidiano, intempéries ou conservação do veículo do Permutante, limitando-se sua intervenção exclusivamente à colocação do material adesivo.
  </div>

  <div style="margin-bottom: 18px;">
    <strong>CLÁUSULA 7 — DO USO DE IMAGEM</strong><br/>
    O Permutante autoriza, a título gratuito e promocional, o registro fotográfico ou em vídeo do veículo com o adesivo aplicado, bem como sua veiculação nas redes sociais e canais oficiais do Balneário Lessa para divulgação institucional.
  </div>

  <div style="margin-bottom: 18px;">
    <strong>CLÁUSULA 8 — DISPOSIÇÕES GERAIS</strong><br/>
    8.1. O presente instrumento não gera vínculo societário, empregatício ou de representação comercial entre as partes.<br/>
    8.2. O benefício pactuado é intransferível, não cumulativo e não poderá ser convertido em dinheiro, créditos ou outras vantagens pecuniárias.<br/>
    8.3. Qualquer alteração ou tolerância referente às disposições deste contrato somente terá validade se celebrada por termo aditivo formal.
  </div>

  <div style="margin-bottom: 18px;">
    <strong>CLÁUSULA 9 — DO FORO</strong><br/>
    Fica eleito o Foro da Comarca de Ariquemes, Estado de Rondônia, com exclusão de qualquer outro, por mais privilegiado que seja, para dirimir eventuais dúvidas ou controvérsias decorrentes deste contrato.
  </div>

  <hr style="margin: 24px 0; border-color: #cbd5e1;" />
  <!-- BLOCO-ASSINATURAS-IMPRESSAO -->
  <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 20px; page-break-inside: avoid;">
    <div style="margin-bottom: 16px;">
      Local e data: <strong>Ariquemes/RO, [/data-cadastro-extenso]</strong>.<br/>
      <span style="font-size: 11px; color: #059669; font-weight: bold;">
        ✔ Contrato registrado e assinado em [/data-assinatura-iso] (Termo Nº [/card-pf])
      </span>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-top: 28px; text-align: center;">
      <tr>
        <td style="width: 48%; padding: 10px 14px; vertical-align: bottom;">
          <div style="height: 52px;"></div>
          <div style="border-top: 1.5px solid #0f172a; padding-top: 6px; font-weight: bold; font-size: 12px; color: #0f172a;">
            [/nome-pf]
          </div>
          <div style="font-size: 11px; color: #475569;">
            CPF: [/cpf-pf]<br/>
            <strong>PERMUTANTE / TITULAR</strong>
          </div>
        </td>
        <td style="width: 4%;"></td>
        <td style="width: 48%; padding: 10px 14px; vertical-align: bottom;">
          <div style="height: 52px;"></div>
          <div style="border-top: 1.5px solid #0f172a; padding-top: 6px; font-weight: bold; font-size: 12px; color: #0f172a;">
            BALNEÁRIO FAMÍLIA LESSA LTDA
          </div>
          <div style="font-size: 11px; color: #475569;">
            CNPJ: 46.891.134/0001-40<br/>
            <strong>CONTRATANTE / ADMINISTRAÇÃO</strong>
          </div>
        </td>
      </tr>
    </table>

    <table style="width: 100%; border-collapse: collapse; margin-top: 28px; text-align: center;">
      <tr>
        <td style="width: 48%; padding: 10px 14px; vertical-align: bottom;">
          <div style="border-top: 1px dashed #64748b; padding-top: 6px; font-weight: bold; font-size: 11px; color: #334155;">
            1ª TESTEMUNHA
          </div>
          <div style="font-size: 11px; color: #64748b;">
            Nome: ____________________________________<br/>
            CPF: ___________________________
          </div>
        </td>
        <td style="width: 4%;"></td>
        <td style="width: 48%; padding: 10px 14px; vertical-align: bottom;">
          <div style="border-top: 1px dashed #64748b; padding-top: 6px; font-weight: bold; font-size: 11px; color: #334155;">
            2ª TESTEMUNHA
          </div>
          <div style="font-size: 11px; color: #64748b;">
            Nome: ____________________________________<br/>
            CPF: ___________________________
          </div>
        </td>
      </tr>
    </table>
  </div>
</div>
`
  },
  {
    id: 'TERMOS_SITE',
    title: 'Termos e Condições Gerais de Uso, Adesão e Acesso (Site & Portal)',
    description: 'Regulamento interno oficial completo para leitura de associados e consulta presencial/online.',
    updatedAt: new Date().toISOString(),
    contentHtml: `
<div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.8; font-size: 13.5px;">
  <div style="border-bottom: 2px solid #005200; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="color: #005200; margin: 0 0 6px 0; font-size: 20px; font-weight: 900;">BALNEÁRIO FAMÍLIA LESSA LTDA</h2>
    <h3 style="color: #334155; margin: 0; font-size: 15px; font-weight: bold;">REGULAMENTO INTERNO, TERMOS E CONDIÇÕES GERAIS DE USO E ADESÃO</h3>
    <div style="font-size: 11px; color: #64748b; margin-top: 4px;">CNPJ: 46.891.134/0001-40 • Via Araras, Setor 09, Ariquemes/RO • WhatsApp: (69) 99262-6140</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #005200; font-size: 14px; display: block; margin-bottom: 4px;">1. DO OBJETO E ACEITAÇÃO INTEGRAL</strong>
    <div>1.1. Os presentes Termos e Condições Gerais de Uso regulam o acesso, a permanência e a utilização das dependências, atrações, estruturas naturais e serviços do Balneário Família Lessa, bem como a adesão aos planos de associados (Lessa Club), modalidades de meia-entrada e gratuidades.</div>
    <div>1.2. O ato de adesão, seja presencial ou através do portal online, bem como a simples entrada no parque, implica na aceitação irrestrita e automática de todas as normas deste regulamento.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #005200; font-size: 14px; display: block; margin-bottom: 4px;">2. HORÁRIOS, DIAS DE FUNCIONAMENTO E ACESSO</strong>
    <div>2.1. O Balneário Família Lessa funciona regularmente às <strong>sextas-feiras, sábados, domingos e feriados, das 9h às 17h</strong>.</div>
    <div>2.2. A administração reserva-se o direito de fechar ou alterar os horários por motivo de força maior, condições climáticas adversas, manutenções emergenciais ou eventos previamente agendados, sem que isso gere direito a restituição ou indenização financeira.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #005200; font-size: 14px; display: block; margin-bottom: 4px;">3. CARTEIRINHA, QR CODE E USO PESSOAL E INTRANSFERÍVEL</strong>
    <div>3.1. A carteirinha de associado (seja em cartão PVC, cartão digital no smartphone ou QR Code) é de uso <strong>estritamente pessoal e intransferível</strong>. É expressamente proibido emprestar, ceder ou repassar o cartão ou QR Code para terceiros.</div>
    <div>3.2. Na portaria de acesso, a apresentação de documento de identificação com foto poderá ser solicitada a qualquer momento para conferência facial e validação do titular ou dependente. O uso indevido por terceiros enseja o cancelamento imediato do plano por fraude.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #005200; font-size: 14px; display: block; margin-bottom: 4px;">4. CATEGORIAS DE BENEFÍCIOS, GRATUIDADES E TRANSIÇÃO DE IDADE</strong>
    <div>4.1. <strong>Lessa Kids (Gratuidade por Faixa Etária):</strong> Concedido a crianças conforme a faixa etária vigente do balneário. Fica estabelecido que, ao completar a idade limite (aniversário que encerra o período de isenção), o dependente perde automaticamente a condição de gratuidade, passando à condição de pagante na categoria compatível (Estudante ou Integral).</div>
    <div>4.2. <strong>Lessa Estudante e Lessa Professor:</strong> Destinados exclusivamente a estudantes e professores comprovadamente matriculados ou em exercício, mediante apresentação periódica de declaração/comprovante escolar ou carteira estudantil oficial.</div>
    <div>4.3. <strong>Lessa 60+ (Melhor Idade):</strong> Destinado a idosos com 60 anos completos ou mais, comprovados mediante documento de identidade oficial.</div>
    <div>4.4. <strong>Lessa Inclusão PCD e TEA:</strong> Concede gratuidade à pessoa com deficiência e/ou Transtorno do Espectro Autista com direito a 1 (um) acompanhante, mediante apresentação de laudo médico ou carteirinha CIPTEA/PCD.</div>
    <div>4.5. <strong>Controle e Renovação de Documentos:</strong> O Balneário mantém cadastro individualizado de cada dependente com controle de expiração de laudos, documentos e idades, devendo o titular manter as comprovações sempre atualizadas.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #005200; font-size: 14px; display: block; margin-bottom: 4px;">5. SERVIÇOS INCLUSOS E SERVIÇOS COBRADOS À PARTE</strong>
    <div>5.1. A assinatura do plano garante a entrada livre e o uso das piscinas naturais, cachoeiras, áreas verdes, campos de esporte e espaços comuns de descanso.</div>
    <div>5.2. <strong>NÃO estão inclusos no plano</strong> e serão cobrados à parte conforme tabela vigente: restaurante, lanchonetes, porções e bebidas, passeios e trilhas de quadriciclo, pesque-e-solte (pesca esportiva) e locações exclusivas de quiosques reservados com antecedência.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #005200; font-size: 14px; display: block; margin-bottom: 4px;">6. REGRAS DE SEGURANÇA, CONVIVÊNCIA E MEIO AMBIENTE</strong>
    <div>6.1. O Balneário Família Lessa preza por um ambiente familiar, tranquilo e respeitoso. Não é permitido som automotivo ou caixas de som em volume que perturbe os demais visitantes.</div>
    <div>6.2. É expressamente proibido o uso de recipientes, copos e garrafas de vidro nas bordas e interiores das águas e piscinas naturais para evitar acidentes.</div>
    <div>6.3. Crianças menores de 12 anos devem obrigatoriamente estar acompanhadas e sob a supervisão visual direta de seus pais ou responsáveis durante todo o período de permanência nas águas.</div>
    <div>6.4. Preservação da fauna e flora: recolha sempre o lixo produzido e descarte nas lixeiras seletivas distribuídas pelo parque.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #005200; font-size: 14px; display: block; margin-bottom: 4px;">7. MODALIDADES DE COBRANÇA, PAGAMENTO E AUSÊNCIA DE FIDELIDADE</strong>
    <div>7.1. <strong>Plano Anual:</strong> Pagamento integral à vista via PIX ou valor integral parcelado em até 12x no Cartão de Crédito. Garante a manutenção dos valores vigentes até o término do período de 12 meses.</div>
    <div>7.2. <strong>Plano Mensal Recorrente:</strong> 12 mensalidades sucessivas cobradas via cartão de crédito, débito ou PIX mensal.</div>
    <div>7.3. <strong>Cancelamento sem Fidelidade:</strong> O associado pode solicitar o cancelamento a qualquer momento, sem multa rescisória, desde que esteja em dia com as mensalidades vencidas até a data da solicitação.</div>
    <div>7.4. Em caso de atraso superior a 5 dias, o acesso na portaria ficará temporariamente bloqueado até a quitação da pendência.</div>
  </div>

  <div style="margin-bottom: 18px;">
    <strong style="color: #005200; font-size: 14px; display: block; margin-bottom: 4px;">8. USO DE IMAGEM E DISPOSIÇÕES FINAIS</strong>
    <div>8.1. Ao frequentar o balneário, o associado autoriza o uso institucional de eventuais fotos ou gravações coletivas de lazer nas redes sociais e materiais informativos do Balneário Lessa.</div>
    <div>8.2. Fica eleito o Foro da Comarca de Ariquemes/RO para dirimir quaisquer controvérsias oriundas do presente regulamento.</div>
  </div>
</div>
`
  }
];

