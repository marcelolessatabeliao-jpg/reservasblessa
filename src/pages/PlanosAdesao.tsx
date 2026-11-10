import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Check,
  CreditCard,
  QrCode,
  Plus,
  Trash2,
  ArrowLeft,
  Copy,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  Users,
  Lock,
  Sparkles,
  Crown,
  HeartHandshake,
  Camera,
  Upload,
  FileCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo.png';
import {
  BillingCycle,
  ClubInvoice,
  ClubModality,
  ClubPaymentMethod,
  ClubSubscription,
  ClubAttachment,
  DEFAULT_CLUB_MODALITIES,
} from '@/lib/club-types';
import {
  ClubDatabaseState,
  fetchClubState,
  saveClubState,
  createClubSubscription,
  generateAsaasChargeForClubInvoice,
  generateAllAsaasInvoicesForSubscription,
  processClubCreditCardPayment,
  checkClubInvoicePaymentStatus,
  markClubInvoicePaid,
  getQrCodeImageUrl,
  renderSubscriptionContractHtml,
  formatCurrency,
  formatCpf,
  formatPhone,
  formatBirthDate,
  getMemberAccessMessage,
  isValidCpf,
  cleanDigits,
  compressImageFile,
  fetchAddressByCep,
  trackConsultantClick,
} from '@/lib/club-service';
import { ClubMemberCardView } from '@/components/club/ClubMemberCardView';

const fileToDataUrl = compressImageFile;

interface CatalogPlanCard {
  id: string;
  title: string;
  subtitle: string;
  modalityCode: string; // 'ADULTO' | 'ESTUDANTE' | 'PROFESSOR' | 'SERVIDOR' | 'PCD_TEA' | 'IDOSO_60' | 'KIDS'
  cardImage: string;
  backCardUrl?: string;
  monthlyPrice: number;
  annualPrice: number;
  annualInstallment: number;
  badge?: string;
  hasPeopleCounter?: boolean;
  isCustomBuilder?: boolean;
  isFreePlan?: boolean;
  benefits: string[];
}

const CATALOG_PLANS: CatalogPlanCard[] = [
  {
    id: 'lessa-club',
    title: 'Lessa Club',
    subtitle: 'Plano Individual ou Familiar (Escolha a quantidade de pessoas)',
    modalityCode: 'ADULTO',
    cardImage: '/cards/17.png',
    backCardUrl: '/cards/24.png',
    monthlyPrice: 49.9,
    annualPrice: 538.92,
    annualInstallment: 44.91,
    badge: 'TRADICIONAL • 1 A 15 PESSOAS',
    hasPeopleCounter: true,
    benefits: [
      'Sem taxa de adesão',
      'Plano Anual - 10% OFF s/ juros em até 12x ou opção Mensal',
      'Acesso ilimitado às áreas do Balneário nos dias e horários de funcionamento',
      'Sextas, sábados, domingos e feriados, das 9h às 17h',
      'Carteirinha oficial digital + física com QR Code exclusivo de acesso',
      'Benefícios exclusivos para membros',
      'Crianças até 11 anos, PCD & TEA ou idosos 60+ já têm entrada grátis!',
      '*Novos valores a partir de 2027, assine agora e mantenha o valor de 2026*',
    ],
  },
  {
    id: 'lessa-student',
    title: 'Lessa Student Pass',
    subtitle: 'Meia-Assinatura para Estudantes (10% OFF)',
    modalityCode: 'ESTUDANTE',
    cardImage: '/cards/7.png',
    backCardUrl: '/cards/24.png',
    monthlyPrice: 25.0,
    annualPrice: 270.0,
    annualInstallment: 22.5,
    badge: '10% DE DESCONTO',
    benefits: [
      'Sem taxa de adesão • 10% de desconto para Estudantes',
      'Plano Anual (R$ 270,00 em até 12x de R$ 22,50) ou Mensal (R$ 25,00)',
      'Acesso ilimitado às áreas do Balneário nos dias e horários de funcionamento',
      'Sextas, sábados, domingos e feriados, das 9h às 17h',
      'Carteirinha oficial digital + física com QR Code exclusivo de acesso',
      'Mediante apresentação de comprovante escolar ou faculdade',
      'Permite adicionar familiares e dependentes no cadastro',
    ],
  },
  {
    id: 'lessa-professor',
    title: 'Lessa Professor Pass',
    subtitle: 'Meia-Assinatura para Professores (10% OFF)',
    modalityCode: 'PROFESSOR',
    cardImage: '/cards/2.png',
    backCardUrl: '/cards/24.png',
    monthlyPrice: 25.0,
    annualPrice: 270.0,
    annualInstallment: 22.5,
    badge: '10% DE DESCONTO',
    benefits: [
      'Sem taxa de adesão • 10% de desconto para Professores',
      'Plano Anual (R$ 270,00 em até 12x de R$ 22,50) ou Mensal (R$ 25,00)',
      'Acesso ilimitado às áreas do Balneário nos dias e horários de funcionamento',
      'Sextas, sábados, domingos e feriados, das 9h às 17h',
      'Carteirinha oficial digital + física com QR Code exclusivo de acesso',
      'Mediante comprovação de vínculo como professor(a)',
      'Permite adicionar familiares e dependentes no cadastro',
    ],
  },
  {
    id: 'lessa-servidor',
    title: 'Lessa Servidor Pass',
    subtitle: 'Meia-Assinatura para Servidores Públicos (10% OFF)',
    modalityCode: 'SERVIDOR',
    cardImage: '/cards/9.png',
    backCardUrl: '/cards/24.png',
    monthlyPrice: 25.0,
    annualPrice: 270.0,
    annualInstallment: 22.5,
    badge: '10% DE DESCONTO',
    benefits: [
      'Sem taxa de adesão • 10% de desconto para Servidores Públicos',
      'Plano Anual (R$ 270,00 em até 12x de R$ 22,50) ou Mensal (R$ 25,00)',
      'Acesso ilimitado às áreas do Balneário nos dias e horários de funcionamento',
      'Sextas, sábados, domingos e feriados, das 9h às 17h',
      'Carteirinha oficial digital + física com QR Code exclusivo de acesso',
      'Válido para servidores municipais, estaduais e federais',
      'Permite adicionar familiares e dependentes no cadastro',
    ],
  },
  {
    id: 'lessa-inclusao-pcd',
    title: 'Lessa Inclusão - PCD e TEA',
    subtitle: 'Gratuidade Oficial para Pessoas com Deficiência e Autismo (TEA)',
    modalityCode: 'PCD_TEA',
    cardImage: '/cards/34.png',
    backCardUrl: '/cards/24.png',
    monthlyPrice: 0.0,
    annualPrice: 0.0,
    annualInstallment: 0.0,
    badge: 'GRATUIDADE • 100% ISENTO',
    isFreePlan: true,
    benefits: [
      'Isenção total de mensalidade e adesão (R$ 0,00)',
      'Acesso gratuito ao Balneário nas sextas, sábados, domingos e feriados',
      'Carteirinha exclusiva Lessa Inclusão (PCD e TEA) com QR Code de acesso rápido',
      'Mediante apresentação de laudo médico ou carteira CIPTEA/PCD',
      'Permite vincular familiares/acompanhantes na mesma assinatura',
    ],
  },
  {
    id: 'lessa-vitalicio-60',
    title: 'Lessa Vitalício 60+',
    subtitle: 'Gratuidade Oficial para Idosos a partir de 60 anos',
    modalityCode: 'IDOSO_60',
    cardImage: '/cards/25.png',
    backCardUrl: '/cards/39.png',
    monthlyPrice: 0.0,
    annualPrice: 0.0,
    annualInstallment: 0.0,
    badge: 'GRATUIDADE • VITALÍCIO 60+',
    isFreePlan: true,
    benefits: [
      'Isenção total de mensalidade e adesão (R$ 0,00) para maiores de 60 anos',
      'Acesso gratuito ao Balneário nas sextas, sábados, domingos e feriados',
      'Carteirinha oficial Lessa Vitalício 60+ com QR Code exclusivo de acesso',
      'Mediante apresentação de documento oficial com foto (RG ou CNH)',
      'Permite vincular familiares na mesma assinatura se desejar',
    ],
  },
  {
    id: 'lessa-kids',
    title: 'Lessa Kids',
    subtitle: 'Gratuidade Oficial para Crianças de 0 a 11 anos',
    modalityCode: 'KIDS',
    cardImage: '/cards/37.png',
    backCardUrl: '/cards/39.png',
    monthlyPrice: 0.0,
    annualPrice: 0.0,
    annualInstallment: 0.0,
    badge: 'GRATUIDADE • ATÉ 11 ANOS',
    isFreePlan: true,
    benefits: [
      'Isenção total de mensalidade (R$ 0,00) para crianças de até 11 anos',
      'Carteirinha infantil exclusiva Lessa Kids com foto e QR Code de identificação',
      'Acesso ilimitado acompanhado dos pais ou responsáveis associados',
      'Mediante documento ou certidão de nascimento da criança',
    ],
  },
];

const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

interface DependentDraft {
  id: string;
  modalityCode: string;
  fullName: string;
  cpf: string;
  birthDate: string;
  sex: string;
  kinship: string;
  docAttachment?: ClubAttachment | null;
}

export const PlanosAdesaoSection: React.FC<{ embedded?: boolean }> = ({
  embedded = false,
}) => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const urlRef = searchParams.get('ref');
  const urlPlan = searchParams.get('plano');

  const [state, setState] = useState<ClubDatabaseState | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Consultor identificado pela URL de indicação (Screenshot 4)
  const matchedConsultant = useMemo(() => {
    if (!urlRef || !state?.consultants) return null;
    return (
      state.consultants.find(
        (c) => c.referralCode.toLowerCase() === urlRef.trim().toLowerCase()
      ) || null
    );
  }, [urlRef, state]);

  // Rastreamento de acessos ao link ou QR Code do consultor/influencer
  useEffect(() => {
    if (matchedConsultant && urlRef) {
      const sessionKey = `tracked_ref_view_${matchedConsultant.id}`;
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, '1');
        trackConsultantClick(matchedConsultant.id);
      }
    }
  }, [matchedConsultant, urlRef]);

  // Ciclo geral e por card
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('ANNUAL');
  const [cardCycleMap, setCardCycleMap] = useState<Record<string, BillingCycle>>({});

  // Controle de abas de benefícios e documentação (fechadas por padrão para melhor visualização dos planos)
  const [expandedBenefitsMap, setExpandedBenefitsMap] = useState<Record<string, boolean>>({});

  // Contador de pessoas no card único "Lessa Club" (1 a 15 pessoas)
  const [lessaClubPeopleCount, setLessaClubPeopleCount] = useState<number>(1);

  // Contadores do Card "Plano Família Personalizado"
  const [customCounts, setCustomCounts] = useState<Record<string, number>>({
    ADULTO: 0,
    ESTUDANTE: 0,
    PROFESSOR: 0,
    SERVIDOR: 0,
    KIDS: 0,
    IDOSO_60: 0,
    PCD_TEA: 0,
  });

  // =========================================================================
  // PASSO 2: DADOS DO TITULAR (IDÊNTICO À TELA "CADASTRE-SE" ENVIADA)
  // =========================================================================
  const [selectedPlanTitle, setSelectedPlanTitle] = useState('Lessa Club');
  // Categoria Principal FIXA do Titular escolhida no Passo 1
  const [holderModalityCode, setHolderModalityCode] = useState<string>('ADULTO');

  const [holderName, setHolderName] = useState('');
  const [holderEmail, setHolderEmail] = useState('');
  const [holderCpf, setHolderCpf] = useState('');
  const [holderBirthDate, setHolderBirthDate] = useState('');
  const [holderSex, setHolderSex] = useState('');
  const [holderMaritalStatus, setHolderMaritalStatus] = useState('');
  const [holderPhone, setHolderPhone] = useState('');
  const [addressCep, setAddressCep] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [addressCity, setAddressCity] = useState('Ariquemes');
  const [addressState, setAddressState] = useState('RO');

  // Documento Comprobatório do Titular (Obrigatório para Kids, Vitalício 60+ e PCD/TEA)
  const [holderDocAttachment, setHolderDocAttachment] = useState<ClubAttachment | null>(null);

  // Lista de Dependentes adicionados à assinatura
  const [dependentsDraft, setDependentsDraft] = useState<DependentDraft[]>([]);

  // Passo 3: Termos
  const [contractAccepted, setContractAccepted] = useState(false);

  // Passo 4: Pagamento e Carteirinhas no Final
  const [paymentMethod, setPaymentMethod] = useState<ClubPaymentMethod>('CREDIT_CARD');
  const [installments, setInstallments] = useState<number>(12);
  const [cardHolderName, setCardHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolderCpf, setCardHolderCpf] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSub, setCreatedSub] = useState<ClubSubscription | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<ClubInvoice | null>(null);
  const [pixCharge, setPixCharge] = useState<{
    paymentId: string;
    invoiceUrl: string;
    pixPayload?: string;
    pixQrCode?: string;
  } | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);

  useEffect(() => {
    fetchClubState().then((loaded) => {
      setState(loaded);
      if (urlPlan && loaded?.modalities) {
        const mod = loaded.modalities.find(
          (m) =>
            m.code.toLowerCase() === urlPlan.trim().toLowerCase() ||
            m.id.toLowerCase() === urlPlan.trim().toLowerCase()
        );
        if (mod) {
          setHolderModalityCode(mod.code);
          setSelectedPlanTitle(mod.name);
        }
      }
    });
  }, [urlPlan]);

  // Sempre garante lista de modalidades (mesmo antes do fetch terminar)
  // Se o consultor/influencer possuir permissão específica de planos configurada, exibe apenas os liberados para ele
  const activeModalities: ClubModality[] = useMemo(() => {
    const list =
      state?.modalities && state.modalities.length > 0
        ? state.modalities
        : DEFAULT_CLUB_MODALITIES;

    if (matchedConsultant?.allowedPlanCodes && matchedConsultant.allowedPlanCodes.length > 0) {
      const allowed = matchedConsultant.allowedPlanCodes.map((c) => c.toUpperCase());
      const filtered = list.filter((m) => {
        return allowed.some(
          (code) =>
            m.code.toUpperCase() === code ||
            m.id.toUpperCase() === code ||
            m.name.toUpperCase().includes(code) ||
            code.includes(m.name.toUpperCase())
        );
      });
      return filtered.length > 0 ? filtered : list;
    }

    return list;
  }, [state, matchedConsultant]);

  const findModality = (code: string): ClubModality => {
    return (
      activeModalities.find((m) => m.code === code) ||
      DEFAULT_CLUB_MODALITIES.find((m) => m.code === code) ||
      DEFAULT_CLUB_MODALITIES[0]
    );
  };

  const getCardCycle = (cardId: string): BillingCycle => {
    return cardCycleMap[cardId] || billingCycle;
  };

  // Cálculo em tempo real do Card em Destaque "Plano Família Personalizado"
  const customBuilderTotals = useMemo(() => {
    let monthlySum = 0;
    let annualSum = 0;
    let annualInstallmentSum = 0;
    let totalPeople = 0;

    Object.entries(customCounts).forEach(([code, qty]) => {
      if (qty <= 0) return;
      totalPeople += qty;
      const mod = findModality(code);
      monthlySum += mod.monthlyPrice * qty;
      annualSum += mod.annualPrice * qty;
      annualInstallmentSum += mod.annualInstallment * qty;
    });

    return {
      monthlySum: Number(monthlySum.toFixed(2)),
      annualSum: Number(annualSum.toFixed(2)),
      annualInstallmentSum: Number(annualInstallmentSum.toFixed(2)),
      totalPeople,
    };
  }, [customCounts, activeModalities]);

  // =========================================================================
  // CÁLCULO EXATO DOS VALORES NO PASSO 2 (TITULAR FIXO + DEPENDENTES)
  // =========================================================================
  const holderModality = useMemo(
    () => findModality(holderModalityCode),
    [holderModalityCode, activeModalities]
  );


  const pricingSummary = useMemo(() => {
    const holderMonthly =
      billingCycle === 'ANNUAL'
        ? holderModality.annualInstallment
        : holderModality.monthlyPrice;
    const holderContractTotal =
      billingCycle === 'ANNUAL'
        ? holderModality.annualPrice
        : holderModality.monthlyPrice * 12;

    let dependentsMonthly = 0;
    let dependentsContractTotal = 0;

    dependentsDraft.forEach((dep) => {
      const depMod = findModality(dep.modalityCode);
      dependentsMonthly +=
        billingCycle === 'ANNUAL' ? depMod.annualInstallment : depMod.monthlyPrice;
      dependentsContractTotal +=
        billingCycle === 'ANNUAL' ? depMod.annualPrice : depMod.monthlyPrice * 12;
    });

    const totalMonthlyEquivalent = Number(
      (holderMonthly + dependentsMonthly).toFixed(2)
    );
    const totalContractValue = Number(
      (holderContractTotal + dependentsContractTotal).toFixed(2)
    );

    return {
      holderMonthly: Number(holderMonthly.toFixed(2)),
      holderContractTotal: Number(holderContractTotal.toFixed(2)),
      dependentsMonthly: Number(dependentsMonthly.toFixed(2)),
      totalMonthlyEquivalent,
      totalContractValue,
      totalPeople: 1 + dependentsDraft.length,
    };
  }, [holderModality, dependentsDraft, billingCycle, activeModalities]);

  // Ao clicar em "Aderir" no Card em Destaque "Plano Família Personalizado"
  const handleSelectCustomFamilyBuilder = () => {
    const activeCycle = getCardCycle('custom-family');
    setBillingCycle(activeCycle);

    const allCodes: string[] = [];
    Object.entries(customCounts).forEach(([code, qty]) => {
      for (let i = 0; i < qty; i++) {
        allCodes.push(code);
      }
    });

    if (allCodes.length === 0) {
      toast({
        title: 'Selecione pelo menos 1 pessoa',
        description: 'Adicione ao menos 1 integrante no montador familiar para continuar.',
        variant: 'destructive',
      });
      return;
    }

    const mainCode = allCodes[0];
    const depCodes = allCodes.slice(1);

    setHolderModalityCode(mainCode);
    setSelectedPlanTitle('Plano Família Personalizado');
    setDependentsDraft(
      depCodes.map((code, idx) => ({
        id: `dep-${Date.now()}-${idx}`,
        modalityCode: code,
        fullName: '',
        cpf: '',
        birthDate: '',
        sex: '',
        kinship: 'Dependente',
      }))
    );

    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Ao clicar em "Aderir" em qualquer Card da grade no Passo 1
  const handleSelectPlanCard = (card: CatalogPlanCard) => {
    const chosenCycle = getCardCycle(card.id);
    setBillingCycle(chosenCycle);

    if (card.hasPeopleCounter) {
      setHolderModalityCode('ADULTO');
      setSelectedPlanTitle(
        lessaClubPeopleCount === 1
          ? 'Lessa Club'
          : `Lessa Club (${lessaClubPeopleCount} pessoas)`
      );
      const extraPeople = Math.max(0, lessaClubPeopleCount - 1);
      setDependentsDraft(
        Array.from({ length: extraPeople }).map((_, idx) => ({
          id: `dep-${Date.now()}-${idx}`,
          modalityCode: 'ADULTO',
          fullName: '',
          cpf: '',
          birthDate: '',
          sex: '',
          kinship: 'Familiar / Dependente',
        }))
      );
    } else {
      setHolderModalityCode(card.modalityCode);
      setSelectedPlanTitle(card.title);
      setDependentsDraft([]);
    }

    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Busca automática de CEP
  const handleCepLookup = async (inputCep?: string) => {
    const raw = typeof inputCep === 'string' ? inputCep : addressCep;
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 8) return;
    try {
      const result = await fetchAddressByCep(digits);
      if (result) {
        if (result.logradouro) setAddressStreet(result.logradouro);
        if (result.bairro) setAddressNeighborhood(result.bairro);
        if (result.localidade) setAddressCity(result.localidade);
        if (result.uf) setAddressState(result.uf);
        toast({
          title: 'Endereço localizado!',
          description: `${result.logradouro || 'Rua'}, ${result.bairro || 'Bairro'} — ${result.localidade}/${result.uf}`,
        });
      }
    } catch {}
  };

  // Avançar do Passo 2 (Cadastro) para Passo 3 (Termos)
  const handleProceedToTerms = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holderName.trim() || !holderCpf.trim() || !holderPhone.trim()) {
      toast({
        title: 'Campos obrigatórios do Titular',
        description: 'Preencha Nome completo, CPF e Telefone com DDD.',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidCpf(holderCpf)) {
      toast({
        title: 'CPF do Titular Inválido',
        description: 'Por favor, informe um CPF válido com 11 dígitos para o titular.',
        variant: 'destructive',
      });
      return;
    }

    const invalidDepCpf = dependentsDraft.find((d) => d.cpf && !isValidCpf(d.cpf));
    if (invalidDepCpf) {
      toast({
        title: 'CPF do Dependente Inválido',
        description: `O CPF informado para o dependente ${invalidDepCpf.fullName || ''} não é válido. Verifique os números digitados.`,
        variant: 'destructive',
      });
      return;
    }

    const missingDep = dependentsDraft.some((d) => !d.fullName.trim());
    if (missingDep) {
      toast({
        title: 'Nome dos dependentes',
        description: 'Preencha o nome completo de todos os dependentes adicionados.',
        variant: 'destructive',
      });
      return;
    }

    // Validação de Documento Obrigatório para o Titular (PCD/TEA, Kids ou Vitalício 60+)
    const isHolderFreeOrDoc =
      holderModality.isFreeTier ||
      ['PCD_TEA', 'KIDS', 'IDOSO_60'].includes(holderModality.code);
    if (isHolderFreeOrDoc && !holderDocAttachment) {
      toast({
        title: 'Comprovante obrigatório pendente',
        description: `Por favor, tire uma foto ou anexe o documento comprobatório para o plano ${holderModality.name} antes de prosseguir e ativar o plano.`,
        variant: 'destructive',
      });
      return;
    }

    // Validação de Documento Obrigatório para Dependentes (PCD/TEA, Kids ou Vitalício 60+)
    const depMissingDoc = dependentsDraft.find(
      (d) =>
        ['PCD_TEA', 'KIDS', 'IDOSO_60'].includes(d.modalityCode) &&
        !d.docAttachment
    );
    if (depMissingDoc) {
      const depMod = findModality(depMissingDoc.modalityCode);
      toast({
        title: `Comprovante obrigatório pendente (${
          depMissingDoc.fullName || 'Dependente'
        })`,
        description: `Por favor, tire uma foto ou anexe o documento comprobatório de ${
          depMissingDoc.fullName || 'dependente'
        } (${depMod.name}) para ativar a gratuidade.`,
        variant: 'destructive',
      });
      return;
    }

    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Pré-visualização do contrato no Passo 3
  const previewContractHtml = useMemo(() => {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setFullYear(endDate.getFullYear() + 1);
    const validityLabel = `${String(endDate.getMonth() + 1).padStart(
      2,
      '0'
    )}/${endDate.getFullYear()}`;
    const cycleSuffix = billingCycle === 'ANNUAL' ? '(Anual)' : '(Mensal)';

    const mockSub: ClubSubscription = {
      id: 'preview',
      subscriptionCode: '1212253001',
      personType: 'PF',
      holderName: holderName || 'NOME DO TITULAR',
      holderCpf: holderCpf || '000.000.000-00',
      holderBirthDate,
      holderSex,
      holderMaritalStatus,
      holderPhone: holderPhone || '',
      holderEmail: holderEmail || '',
      addressCep,
      addressStreet,
      addressNumber,
      addressComplement,
      addressNeighborhood,
      addressCity,
      addressState,
      billingCycle,
      paymentMethod:
        pricingSummary.totalMonthlyEquivalent === 0 ? 'COURTESY' : paymentMethod,
      installments: billingCycle === 'ANNUAL' ? installments : 12,
      monthlyEquivalent: pricingSummary.totalMonthlyEquivalent,
      totalContractValue: pricingSummary.totalContractValue,
      dueDay: now.getDate(),
      status: 'PENDING',
      origin: 'SITE',
      planSummaryLabel: `${selectedPlanTitle} ${cycleSuffix}`,
      contractType: 'ADESAO_PF',
      contractAccepted: true,
      contractSignedAt: now.toISOString(),
      startDate: now.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      members: [
        {
          id: 'holder-preview',
          subscriptionId: 'preview',
          role: 'TITULAR',
          modalityCode: holderModality.code,
          modalityName: holderModality.name,
          planCycleLabel: holderModality.name,
          fullName: holderName || 'TITULAR',
          cpf: holderCpf,
          cardNumber: '1212253001',
          holderCardNumber: '1212253001',
          qrToken: '1212253001',
          frontCardUrl: holderModality.frontCardUrl,
          backCardUrl: holderModality.backCardUrl,
          validityLabel,
          monthlyValue: pricingSummary.holderMonthly,
          status: 'PENDING',
          createdAt: now.toISOString(),
        },
        ...dependentsDraft.map((d, idx) => {
          const mod = findModality(d.modalityCode);
          const monthlyVal =
            billingCycle === 'ANNUAL' ? mod.annualInstallment : mod.monthlyPrice;
          return {
            id: d.id,
            subscriptionId: 'preview',
            role: 'DEPENDENTE' as const,
            modalityCode: mod.code,
            modalityName: mod.name,
            planCycleLabel: mod.name,
            fullName: d.fullName || `Dependente ${idx + 1}`,
            cpf: d.cpf || holderCpf,
            cardNumber: `121225300${idx + 2}`,
            holderCardNumber: '1212253001',
            qrToken: `121225300${idx + 2}`,
            frontCardUrl: mod.dependentFrontCardUrl || mod.frontCardUrl,
            backCardUrl: mod.dependentBackCardUrl || mod.backCardUrl,
            validityLabel,
            monthlyValue: monthlyVal,
            status: 'PENDING' as const,
            createdAt: now.toISOString(),
          };
        }),
      ],
      invoices: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    return renderSubscriptionContractHtml(
      mockSub,
      state?.contractTemplates
    );
  }, [
    state,
    holderName,
    holderCpf,
    holderBirthDate,
    holderSex,
    holderMaritalStatus,
    holderPhone,
    holderEmail,
    addressCep,
    addressStreet,
    addressNumber,
    addressComplement,
    addressNeighborhood,
    addressCity,
    addressState,
    billingCycle,
    paymentMethod,
    installments,
    pricingSummary,
    selectedPlanTitle,
    holderModality,
    dependentsDraft,
  ]);

  // Finalizar Adesão (Passo 3 -> Passo 4: Pagamento e Carteirinhas no final)
  const handleFinalizeAndPay = async () => {
    if (!contractAccepted) {
      toast({
        title: 'Aceite os termos e condições',
        description: 'Confirme a leitura dos termos para prosseguir.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const isFree = pricingSummary.totalMonthlyEquivalent === 0;
      const chosenInstallments =
        billingCycle === 'ANNUAL'
          ? paymentMethod === 'PIX' || paymentMethod === 'DEBIT_CARD'
            ? 1
            : installments
          : 12;

      const res = await createClubSubscription({
        personType: 'PF',
        holderName,
        holderCpf,
        holderBirthDate,
        holderSex,
        holderMaritalStatus,
        holderPhone,
        holderEmail,
        addressCep,
        addressStreet,
        addressNumber,
        addressComplement,
        addressNeighborhood,
        addressCity,
        addressState,
        billingCycle,
        paymentMethod: isFree ? 'COURTESY' : paymentMethod,
        installments: chosenInstallments,
        status: isFree ? 'ACTIVE' : 'INACTIVE',
        origin: 'SITE',
        consultantName: matchedConsultant?.name || '',
        consultantCode: matchedConsultant?.referralCode || urlRef || '',
        consultantId: matchedConsultant?.id || '',
        attachments: holderDocAttachment ? [holderDocAttachment] : [],
        members: [
          {
            role: 'TITULAR',
            modalityCode: holderModalityCode,
            fullName: holderName,
            cpf: holderCpf,
            birthDate: holderBirthDate,
            sex: holderSex,
            phone: holderPhone,
            documentProofUrl: holderDocAttachment?.dataUrl,
            documentProofName: holderDocAttachment?.name,
            attachments: holderDocAttachment ? [holderDocAttachment] : [],
          },
          ...dependentsDraft.map((d) => ({
            role: 'DEPENDENTE' as const,
            modalityCode: d.modalityCode,
            fullName: d.fullName,
            cpf: d.cpf || holderCpf,
            birthDate: d.birthDate,
            sex: d.sex,
            phone: holderPhone,
            documentProofUrl: d.docAttachment?.dataUrl,
            documentProofName: d.docAttachment?.name,
            attachments: d.docAttachment ? [d.docAttachment] : [],
          })),
        ],
      });

      setCreatedSub(res.subscription);
      setCreatedInvoice(res.firstInvoice || null);

      if (!cardHolderName.trim()) {
        setCardHolderName(holderName.toUpperCase());
      }
      if (!cardHolderCpf.trim()) {
        setCardHolderCpf(holderCpf);
      }

      if (!isFree && res.firstInvoice && res.firstInvoice.amount > 0) {
        try {
          const charge = await generateAsaasChargeForClubInvoice(
            res.subscription,
            res.firstInvoice,
            paymentMethod === 'CREDIT_CARD'
              ? 'CREDIT_CARD'
              : paymentMethod === 'DEBIT_CARD'
              ? 'DEBIT_CARD'
              : 'PIX'
          );
          setPixCharge(charge);

          if (billingCycle === 'MONTHLY' && res.subscription.invoices.length > 1) {
            generateAllAsaasInvoicesForSubscription(
              res.subscription,
              paymentMethod === 'CREDIT_CARD'
                ? 'CREDIT_CARD'
                : paymentMethod === 'DEBIT_CARD'
                ? 'DEBIT_CARD'
                : 'PIX'
            ).catch((e) => console.warn('[PlanosAdesao] Background all invoices sync warning:', e));
          }
        } catch (chargeErr) {
          console.warn('Asaas charge warning:', chargeErr);
        }
      }

      setStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast({
        title: isFree
          ? 'Carteirinha Gratuita Ativada!'
          : 'Cadastro registrado (Status: Plano Inativo - Aguardando Pagamento)',
        description: isFree
          ? 'Sua carteirinha gratuita já está ATIVA! Insira sua foto 3x4 abaixo.'
          : 'Conclua o pagamento via Cartão ou PIX abaixo para ATIVAR sua assinatura e liberar a edição das carteirinhas.',
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao finalizar cadastro',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Atualizar foto 3x4 da carteirinha na Etapa Final (Passo 4) - apenas se ATIVO
  const handleUpdateCardPhotoInStep4 = async (
    memberId: string,
    photoDataUrl: string
  ) => {
    if (!createdSub) return;
    if (createdSub.status !== 'ACTIVE') {
      toast({
        title: 'Plano Inativo (Aguardando Pagamento)',
        description: 'Ative sua assinatura realizando o pagamento acima para liberar a edição da carteirinha.',
        variant: 'destructive',
      });
      return;
    }
    const current = await fetchClubState();
    const updatedSub: ClubSubscription = {
      ...createdSub,
      members: createdSub.members.map((m) =>
        m.id === memberId ? { ...m, photoUrl: photoDataUrl } : m
      ),
    };
    const nextState: ClubDatabaseState = {
      ...current,
      subscriptions: current.subscriptions.map((s) =>
        s.id === updatedSub.id ? updatedSub : s
      ),
    };
    await saveClubState(nextState);
    setState(nextState);
    setCreatedSub(updatedSub);
    toast({
      title: 'Foto adicionada à carteirinha!',
      description: 'Você já pode baixar sua carteirinha pronta em PNG.',
    });
  };

  // Processar pagamento com Cartão (Crédito/Débito) e Ativar Assinatura
  const handleConfirmCardPaymentAndActivate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!createdSub || !createdInvoice) return;

    const cleanCardNum = cardNumber.replace(/\D/g, '');
    if (
      !cardHolderName.trim() ||
      cleanCardNum.length < 13 ||
      cardExpiry.trim().length < 4 ||
      cardCvv.trim().length < 3
    ) {
      toast({
        title: 'Preencha os dados do cartão',
        description:
          'Informe o Nome no cartão, Número do cartão (16 dígitos), Validade (MM/AA) e CVV para ativar a assinatura.',
        variant: 'destructive',
      });
      return;
    }

    setCheckingPayment(true);
    try {
      const result = await processClubCreditCardPayment(
        createdSub,
        createdInvoice,
        {
          holderName: cardHolderName,
          cardNumber: cleanCardNum,
          cardExpiry,
          cardCvv,
          cardHolderCpf,
          installments,
        }
      );

      if (result.success && result.isPaid) {
        const nextState = await fetchClubState();
        setState(nextState);
        const updatedSub = nextState.subscriptions.find(
          (s) => s.id === createdSub.id
        );
        if (updatedSub) {
          setCreatedSub(updatedSub);
          setCreatedInvoice(updatedSub.invoices[0] || createdInvoice);
        }
        toast({
          title: 'Pagamento Aprovado • PLANO ATIVO!',
          description:
            'Sua assinatura e carteirinhas foram ativadas com sucesso! A edição das fotos e download já estão liberados abaixo.',
        });
      } else {
        toast({
          title: 'Pagamento não autorizado',
          description:
            result.error ||
            'Não foi possível debitar o valor no cartão informado. Verifique os dados, validade, CVV ou limite disponível e tente novamente.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao processar cartão',
        description:
          err?.message ||
          'Falha na comunicação com a operadora de cartão. Tente novamente ou utilize o PIX.',
        variant: 'destructive',
      });
    } finally {
      setCheckingPayment(false);
    }
  };

  // Verificar pagamento PIX no sistema bancário
  const handleVerifyPaymentNow = async () => {
    if (!createdSub || !createdInvoice) return;
    setCheckingPayment(true);
    try {
      const paid = await checkClubInvoicePaymentStatus(
        createdSub.id,
        createdInvoice.id
      );
      if (paid) {
        const updated = await fetchClubState();
        const sub = updated.subscriptions.find((s) => s.id === createdSub.id);
        if (sub) {
          setCreatedSub(sub);
          setCreatedInvoice(sub.invoices[0] || createdInvoice);
        }
        toast({
          title: 'Pagamento Confirmado • PLANO ATIVO!',
          description: 'Todas as carteirinhas da sua família estão ATIVAS e liberadas para edição!',
        });
      } else {
        toast({
          title: 'Pagamento ainda não identificado',
          description:
            'Ainda não identificamos a compensação do seu PIX no sistema bancário. Se já realizou a transferência, aguarde cerca de 30 a 60 segundos e tente novamente.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Falha ao consultar pagamento',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setCheckingPayment(false);
    }
  };

  // Polling automático para detecção de pagamento no Passo 4
  useEffect(() => {
    if (step !== 4 || !createdSub || createdSub.status === 'ACTIVE' || !createdInvoice) return;
    const interval = setInterval(async () => {
      try {
        const paid = await checkClubInvoicePaymentStatus(createdSub.id, createdInvoice.id);
        if (paid) {
          const nextState = await fetchClubState();
          setState(nextState);
          const updatedSub = nextState.subscriptions.find((s) => s.id === createdSub.id);
          if (updatedSub) {
            setCreatedSub(updatedSub);
            setCreatedInvoice(updatedSub.invoices[0] || createdInvoice);
          }
          toast({
            title: 'Pagamento Confirmado • PLANO ATIVO!',
            description: 'Todas as carteirinhas da sua família estão ATIVAS e liberadas para edição!',
          });
        }
      } catch (e) {
        console.warn('[PlanosAdesao] Polling check-payment warning:', e);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [step, createdSub, createdInvoice, toast]);

  // Preço do Banner Destaque "Plano Família Personalizado"
  const customActiveCycle = getCardCycle('custom-family');
  const customMainPrice =
    customActiveCycle === 'ANNUAL'
      ? customBuilderTotals.annualSum
      : customBuilderTotals.monthlySum;
  const [customIntPart, customDecPart] = customMainPrice
    .toFixed(2)
    .replace('.', ',')
    .split(',');

  return (
    <div className={embedded ? 'py-8' : 'min-h-screen bg-[#f4f7fa] pb-20'}>
      {!embedded && (
        <header className="bg-emerald-950 text-white border-b border-emerald-900 sticky top-0 z-40 shadow-md">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link to="/assinatura" className="flex items-center gap-3">
              <img src={logo} alt="Balneário Lessa" className="h-10 w-auto" />
              <div>
                <span className="font-display font-black text-lg text-white block leading-none">
                  Lessa Club
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300 block">
                  Portal de Adesão Online
                </span>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <Link to="/socio">
                <Button
                  size="sm"
                  className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black text-xs"
                >
                  <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Já sou Sócio
                </Button>
              </Link>
            </div>
          </div>
        </header>
      )}

      <div className="w-full max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {/* BARRA SUPERIOR DE 4 ETAPAS (Exibida no topo quando step > 1: Cadastro, Termos, Pagamento) */}
        {step > 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-2 max-w-4xl mx-auto mb-8">
            <div className="grid grid-cols-4 gap-2">
              {[
                { num: 1, label: 'Plano' },
                { num: 2, label: 'Cadastro' },
                { num: 3, label: 'Termos' },
                { num: 4, label: 'Pagamento' },
              ].map((item) => {
                const active = step === item.num;
                const completed = step > item.num;
                return (
                  <button
                    key={item.num}
                    type="button"
                    onClick={() => {
                      if (item.num < step) setStep(item.num as 1 | 2 | 3 | 4);
                    }}
                    disabled={item.num > step}
                    className={`h-11 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
                      active
                        ? 'bg-[#0b5ed7] text-white shadow-md'
                        : completed
                        ? 'bg-[#e6f4ea] text-[#137333] hover:bg-emerald-100 cursor-pointer'
                        : 'text-slate-600 cursor-default'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* =====================================================================
            PASSO 1: PLANOS (SUPER DESTAQUE NO PLANO PERSONALIZADO + DEMAIS PLANOS + GRATUIDADES)
        ===================================================================== */}
        {step === 1 && (
          <div className="space-y-8 sm:space-y-10">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Escolha ou Personalize seu Plano Lessa Club
              </h2>
              <p className="text-sm text-slate-600">
                Selecione entre <strong>Plano Anual (10% OFF em até 12x)</strong> ou{' '}
                <strong>Plano Mensal</strong> diretamente no plano escolhido.
              </p>

              {/* Chave de Ciclo (Anual com 10% OFF vs Mensal Recorrente) - Modo anterior solicitado */}
              <div className="pt-2 flex justify-center">
                <div className="inline-flex bg-white p-1 rounded-2xl border-2 border-emerald-950/20 shadow-md">
                  <button
                    type="button"
                    onClick={() => {
                      setBillingCycle('ANNUAL');
                      setCardCycleMap({});
                    }}
                    className={`px-5 sm:px-7 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center gap-2 ${
                      billingCycle === 'ANNUAL'
                        ? 'bg-[#005200] text-white shadow'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Plano Anual (Até 12x)</span>
                    <span className="bg-amber-400 text-emerald-950 text-[10px] px-2 py-0.5 rounded-full font-black">
                      10% OFF
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBillingCycle('MONTHLY');
                      setCardCycleMap({});
                    }}
                    className={`px-4 sm:px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all ${
                      billingCycle === 'MONTHLY'
                        ? 'bg-[#005200] text-white shadow'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Plano Mensal Recorrente
                  </button>
                </div>
              </div>
            </div>

            {/* ===============================================================
                SUPER DESTAQUE: PLANO FAMÍLIA PERSONALIZADO (FULL-WIDTH PREMIUM)
            =============================================================== */}
            <div id="simulador" className="relative rounded-3xl bg-gradient-to-br from-emerald-950 via-[#072e1d] to-slate-950 text-white p-6 sm:p-8 lg:p-10 shadow-2xl border-2 border-amber-400/80 ring-8 ring-amber-400/10 overflow-hidden scroll-mt-24">
              {/* Brilho decorativo */}
              <div className="absolute -top-24 -right-24 w-72 h-72 bg-amber-400/15 blur-3xl rounded-full pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-500/15 blur-3xl rounded-full pointer-events-none" />

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Coluna Esquerda: Apresentação + Cartão + Vantagens */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="inline-flex items-center gap-2 bg-amber-400 text-emerald-950 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-lg">
                    <Crown className="w-4 h-4 fill-emerald-950" />
                    EXCLUSIVO • MONTE DO SEU JEITO
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight text-white">
                    Plano Família Personalizado{' '}
                    <span className="text-amber-300 block sm:inline text-lg sm:text-2xl">
                      ({customActiveCycle === 'ANNUAL' ? 'Anual 10% OFF' : 'Mensal'})
                    </span>
                  </h3>

                  <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
                    Sua família tem perfis diferentes? Aqui você <strong>não precisa fazer assinaturas separadas</strong>! Combine <strong>Adulto Integral + Estudante + Professor + Servidor + Crianças Kids + Idosos 60+ + PCD/TEA</strong> em um único contrato e pagamento.
                  </p>

                  {/* Preview das artes das carteirinhas empilhadas com fotos de exemplo */}
                  <div className="flex items-center gap-3 pt-1">
                    <img
                      src="/cards/17.png"
                      alt="Lessa Club"
                      className="w-28 sm:w-32 rounded-xl border-2 border-amber-400/60 shadow-lg"
                    />
                    <img
                      src="/cards/7.png"
                      alt="Student Pass"
                      className="w-24 sm:w-28 rounded-xl border border-white/20 shadow-md -ml-6 mt-3"
                    />
                    <img
                      src="/cards/37.png"
                      alt="Lessa Kids"
                      className="w-24 sm:w-28 rounded-xl border border-white/20 shadow-md -ml-6 -mt-2"
                    />
                  </div>

                  <ul className="space-y-1.5 text-xs text-emerald-100/90 pt-2">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>1 Carteirinha Oficial individual (Frente e Verso) para cada membro</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Sem taxa de adesão • Acesso livre Sex, Sáb, Dom e Feriados</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Contrato único consolidado disponível no Portal do Sócio</span>
                    </li>
                  </ul>
                </div>

                {/* Coluna Direita: Montador Interativo da Família + Preço e Botão Aderir */}
                <div className="lg:col-span-7 bg-white text-slate-900 rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-100 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-emerald-700" />
                        <span className="font-black text-sm uppercase tracking-wide text-slate-900">
                          Integrantes da Família:
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Escolha o ciclo de cobrança do grupo:
                      </span>
                    </div>

                    {/* Chave Mensal / Anual do Personalizado com mais destaque */}
                    <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-2xl w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() =>
                          setCardCycleMap((prev) => ({
                            ...prev,
                            'custom-family': 'ANNUAL',
                          }))
                        }
                        className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                          customActiveCycle === 'ANNUAL'
                            ? 'bg-emerald-700 text-white shadow-md'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }`}
                      >
                        <span>⭐ Anual</span>
                        <span className="bg-amber-400 text-emerald-950 text-[9px] px-1.5 py-0.5 rounded font-black">
                          10% OFF
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCardCycleMap((prev) => ({
                            ...prev,
                            'custom-family': 'MONTHLY',
                          }))
                        }
                        className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                          customActiveCycle === 'MONTHLY'
                            ? 'bg-emerald-700 text-white shadow-md'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }`}
                      >
                        <span>📅 Mensal</span>
                      </button>
                    </div>
                  </div>

                  {/* Contadores por Modalidade */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      {
                        code: 'ADULTO',
                        label: 'Adulto Integral (Lessa Club)',
                        price:
                          customActiveCycle === 'ANNUAL'
                            ? 'R$ 44,91/mês'
                            : 'R$ 49,90/mês',
                      },
                      {
                        code: 'ESTUDANTE',
                        label: 'Estudante (10% OFF)',
                        price:
                          customActiveCycle === 'ANNUAL'
                            ? 'R$ 22,50/mês'
                            : 'R$ 25,00/mês',
                      },
                      {
                        code: 'PROFESSOR',
                        label: 'Professor (10% OFF)',
                        price:
                          customActiveCycle === 'ANNUAL'
                            ? 'R$ 22,50/mês'
                            : 'R$ 25,00/mês',
                      },
                      {
                        code: 'SERVIDOR',
                        label: 'Servidor Público (10% OFF)',
                        price:
                          customActiveCycle === 'ANNUAL'
                            ? 'R$ 22,50/mês'
                            : 'R$ 25,00/mês',
                      },
                      {
                        code: 'KIDS',
                        label: 'Lessa Kids (0 a 11 anos)',
                        price: 'GRÁTIS (R$ 0)',
                      },
                      {
                        code: 'IDOSO_60',
                        label: 'Lessa Vitalício 60+',
                        price: 'GRÁTIS (R$ 0)',
                      },
                      {
                        code: 'PCD_TEA',
                        label: 'Inclusão PCD e TEA',
                        price: 'GRÁTIS (R$ 0)',
                      },
                    ].map((item) => {
                      const qty = customCounts[item.code] || 0;
                      return (
                        <div
                          key={item.code}
                          className={`flex items-center justify-between py-2 px-3 rounded-xl border text-xs transition-all ${
                            qty > 0
                              ? 'bg-emerald-50/80 border-emerald-400 shadow-sm'
                              : 'bg-slate-50 border-slate-200/80'
                          }`}
                        >
                          <div className="pr-2">
                            <span className="font-bold text-slate-900 block leading-tight">
                              {item.label}
                            </span>
                            <span className="text-[10px] text-emerald-700 font-bold">
                              {item.price}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setCustomCounts((prev) => ({
                                  ...prev,
                                  [item.code]: Math.max(
                                    0,
                                    (prev[item.code] || 0) - 1
                                  ),
                                }))
                              }
                              className="w-7 h-7 rounded-lg bg-white border border-slate-300 font-black text-slate-700 hover:bg-slate-100"
                            >
                              -
                            </button>
                            <span className="w-5 text-center font-black text-sm text-slate-900">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setCustomCounts((prev) => ({
                                  ...prev,
                                  [item.code]: (prev[item.code] || 0) + 1,
                                }))
                              }
                              className="w-7 h-7 rounded-lg bg-emerald-700 text-white font-black hover:bg-emerald-800"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Rodapé do Card Personalizado: Resumo de Preço + Botão Aderir */}
                  <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-center sm:text-left">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Total para {customBuilderTotals.totalPeople}{' '}
                        {customBuilderTotals.totalPeople === 1 ? 'pessoa' : 'pessoas'}
                      </span>
                      <div className="text-slate-800 font-bold text-sm">
                        R${' '}
                        <span className="text-3xl font-black text-[#126b38]">
                          {customIntPart}
                        </span>
                        <span className="text-sm font-bold text-slate-500">
                          ,{customDecPart}
                        </span>
                        <span className="text-xs text-slate-500 font-normal ml-1">
                          {customActiveCycle === 'ANNUAL' ? '/ano' : '/mês'}
                        </span>
                      </div>
                      {customActiveCycle === 'ANNUAL' &&
                        customBuilderTotals.annualInstallmentSum > 0 && (
                          <div className="text-xs font-black text-emerald-700">
                            ou em até 12x de{' '}
                            {formatCurrency(customBuilderTotals.annualInstallmentSum)}
                            /mês
                          </div>
                        )}
                    </div>

                    <Button
                      type="button"
                      onClick={handleSelectCustomFamilyBuilder}
                      className="w-full sm:w-auto px-8 h-12 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black text-sm uppercase tracking-wide rounded-xl shadow-lg"
                    >
                      Aderir Plano Personalizado
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* BANNER DE VENDEDOR / CONSULTOR RASTREADO */}
            {matchedConsultant && (
              <div className="bg-gradient-to-r from-emerald-900 to-teal-950 text-white rounded-2xl p-3.5 max-w-3xl mx-auto my-3 shadow-md flex items-center justify-between gap-3 text-xs border border-emerald-500/30">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-300 uppercase text-[10px] tracking-wider block">
                      Indicação Oficial Balneário Lessa
                    </span>
                    <span className="font-black text-sm">
                      Você está contratando através de: {matchedConsultant.name}
                    </span>
                  </div>
                </div>
                <Badge className="bg-emerald-600 text-white font-mono font-bold text-xs shrink-0">
                  Ref: {matchedConsultant.referralCode}
                </Badge>
              </div>
            )}

            {/* BARRA DE 4 ETAPAS POSICIONADA ABAIXO DO CARD DE SELEÇÃO DE INTEGRANTES */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-2 max-w-3xl mx-auto my-3">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { num: 1, label: 'Plano' },
                  { num: 2, label: 'Cadastro' },
                  { num: 3, label: 'Termos' },
                  { num: 4, label: 'Pagamento' },
                ].map((item) => {
                  const active = step === item.num;
                  const completed = step > item.num;
                  return (
                    <button
                      key={item.num}
                      type="button"
                      onClick={() => {
                        if (item.num < step) setStep(item.num as 1 | 2 | 3 | 4);
                      }}
                      disabled={item.num > step}
                      className={`h-11 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
                        active
                          ? 'bg-[#0b5ed7] text-white shadow-md'
                          : completed
                          ? 'bg-[#e6f4ea] text-[#137333] hover:bg-emerald-100 cursor-pointer'
                          : 'text-slate-600 cursor-default'
                      }`}
                    >
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ===============================================================
                GRADE DE PLANOS INDIVIDUAIS, MEIA-ASSINATURA E GRATUIDADES
            =============================================================== */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg sm:text-xl font-black text-slate-900">
                  Planos por Categoria e Gratuidades Oficiais
                </h3>
                <span className="text-xs text-slate-500 hidden sm:inline">
                  Escolha sua categoria principal abaixo (você também poderá incluir dependentes no cadastro)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                {CATALOG_PLANS.map((card) => {
                  const activeCycle = getCardCycle(card.id);
                  const hasCounter = !!card.hasPeopleCounter;
                  const isFree = !!card.isFreePlan;
                  const peopleMultiplier = hasCounter ? lessaClubPeopleCount : 1;

                  const displayMonthly = Number(
                    (card.monthlyPrice * peopleMultiplier).toFixed(2)
                  );
                  const displayAnnual = Number(
                    (card.annualPrice * peopleMultiplier).toFixed(2)
                  );
                  const displayInstallment = Number(
                    (card.annualInstallment * peopleMultiplier).toFixed(2)
                  );

                  const mainPrice = isFree
                    ? 0
                    : activeCycle === 'ANNUAL'
                    ? displayAnnual
                    : displayMonthly;
                  const [intPart, decPart] = mainPrice
                    .toFixed(2)
                    .replace('.', ',')
                    .split(',');

                  return (
                    <div
                      key={card.id}
                      className={`bg-white rounded-2xl shadow-md border transition-all flex flex-col justify-between overflow-hidden ${
                        hasCounter
                          ? 'border-2 border-emerald-600 ring-4 ring-emerald-500/10'
                          : isFree
                          ? 'border-2 border-teal-500/50 hover:shadow-xl'
                          : 'border-slate-200/90 hover:shadow-xl'
                      }`}
                    >
                      <div>
                        {/* Imagem da Carteirinha com clique para ampliar e textos nítidos */}
                        <div className="p-4 pb-3 bg-white space-y-2">
                          {card.badge && (
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                {isFree ? 'Benefício Social' : 'Carteirinha Oficial'}
                              </span>
                              <div
                                className={`font-black text-[10px] uppercase tracking-wider px-3 py-1 rounded-full shadow-sm ${
                                  isFree
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-amber-400 text-emerald-950'
                                }`}
                              >
                                {card.badge}
                              </div>
                            </div>
                          )}
                          <div className="relative aspect-[1.586/1] w-full rounded-xl overflow-hidden shadow-sm bg-transparent flex items-center justify-center">
                            <img
                              src={card.cardImage}
                              alt={card.title}
                              className="w-full h-full object-cover rounded-xl select-none"
                            />
                          </div>
                        </div>

                        {/* Faixa Azul-Escura com o Nome do Plano */}
                        <div className="bg-[#111c2d] text-white py-3.5 px-4 text-center">
                          <h3 className="font-black text-base sm:text-lg tracking-tight">
                            {card.title}
                            {hasCounter && lessaClubPeopleCount > 1
                              ? ` (${lessaClubPeopleCount} pessoas)`
                              : ''}{' '}
                            {!isFree && (
                              <span className="text-amber-300 font-bold text-xs">
                                ({activeCycle === 'ANNUAL' ? 'Plano Anual' : 'Plano Mensal'})
                              </span>
                            )}
                          </h3>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            {card.subtitle}
                          </p>
                        </div>

                        {/* Chave Mensal / Anual dentro do Card (apenas para planos pagos) */}
                        {!isFree ? (
                          <div className="px-5 pt-3 space-y-2">
                            <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl text-xs font-bold gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setCardCycleMap((prev) => ({
                                    ...prev,
                                    [card.id]: 'MONTHLY',
                                  }))
                                }
                                className={`py-2 px-1 rounded-lg transition-all flex flex-col items-center justify-center ${
                                  activeCycle === 'MONTHLY'
                                    ? 'bg-white text-slate-900 shadow-sm font-black border border-slate-200'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                <span className="text-[11px] font-bold">Plano Mensal</span>
                                <span className="text-xs font-black text-slate-900">
                                  {formatCurrency(displayMonthly)}
                                  <span className="text-[10px] font-normal text-slate-500">/mês</span>
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setCardCycleMap((prev) => ({
                                    ...prev,
                                    [card.id]: 'ANNUAL',
                                  }))
                                }
                                className={`py-2 px-1 rounded-lg transition-all flex flex-col items-center justify-center ${
                                  activeCycle === 'ANNUAL'
                                    ? 'bg-emerald-700 text-white shadow-sm font-black'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                <span className="text-[11px] font-bold flex items-center gap-1">
                                  <span>Plano Anual</span>
                                  <span
                                    className={`text-[9px] px-1 rounded font-black ${
                                      activeCycle === 'ANNUAL'
                                        ? 'bg-amber-400 text-emerald-950'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    10% OFF
                                  </span>
                                </span>
                                <span className="text-xs font-black">
                                  12x {formatCurrency(displayInstallment)}
                                  <span
                                    className={`text-[10px] font-normal ${
                                      activeCycle === 'ANNUAL' ? 'text-emerald-100' : 'text-slate-500'
                                    }`}
                                  >
                                    /mês
                                  </span>
                                </span>
                              </button>
                            </div>

                          </div>
                        ) : (
                          <div className="px-5 pt-3">
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl py-2 px-3 text-center text-xs font-black flex items-center justify-center gap-1.5">
                              <HeartHandshake className="w-4 h-4 text-emerald-600" />
                              Benefício de Gratuidade • Sem Mensalidade
                            </div>
                          </div>
                        )}

                        {/* CONTADOR DE PESSOAS NO CARD ÚNICO "LESSA CLUB" */}
                        {hasCounter && (
                          <div className="mx-5 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-emerald-700" />
                              <div>
                                <span className="text-xs font-black text-emerald-950 block">
                                  Quantidade de Pessoas:
                                </span>
                                <span className="text-[10px] text-emerald-700 font-semibold">
                                  {lessaClubPeopleCount === 1
                                    ? '1 Titular Individual'
                                    : `1 Titular + ${lessaClubPeopleCount - 1} Dependente(s)`}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setLessaClubPeopleCount((c) => Math.max(1, c - 1))
                                }
                                className="w-8 h-8 rounded-lg bg-white border border-emerald-300 font-black text-emerald-900 hover:bg-emerald-100 text-base leading-none"
                              >
                                -
                              </button>
                              <span className="w-6 text-center font-black text-base text-emerald-950">
                                {lessaClubPeopleCount}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setLessaClubPeopleCount((c) => Math.min(15, c + 1))
                                }
                                className="w-8 h-8 rounded-lg bg-emerald-700 text-white font-black hover:bg-emerald-800 text-base leading-none"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ABA EXTENSÍVEL: VEJA OS BENEFÍCIOS E DOCUMENTAÇÃO (ESCONDIDA POR PADRÃO) */}
                        <div className="p-4 border-t border-slate-100 mt-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedBenefitsMap((prev) => ({
                                ...prev,
                                [card.id]: !prev[card.id],
                              }))
                            }
                            className={`w-full py-2.5 px-3.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between border shadow-sm ${
                              expandedBenefitsMap[card.id]
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Veja os benefícios e documentação</span>
                            </span>
                            <span className="flex items-center gap-1 text-[11px] font-black text-emerald-700">
                              <span>
                                {expandedBenefitsMap[card.id] ? 'Recolher' : 'Ver detalhes'}
                              </span>
                              <ChevronDown
                                className={`w-4 h-4 transition-transform duration-200 ${
                                  expandedBenefitsMap[card.id] ? 'rotate-180' : ''
                                }`}
                              />
                            </span>
                          </button>

                          {/* Conteúdo que se estende para baixo */}
                          {expandedBenefitsMap[card.id] && (
                            <div className="pt-3 space-y-3 animate-in fade-in duration-200">
                              <ul className="space-y-2 text-xs text-slate-600 divide-y divide-slate-100">
                                {card.benefits.map((b, i) => (
                                  <li
                                    key={i}
                                    className="pt-2 first:pt-0 flex items-start gap-2 leading-relaxed"
                                  >
                                    <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                                    <span>{b}</span>
                                  </li>
                                ))}
                              </ul>

                              {/* AVISO OBRIGATÓRIO DE COMPROVAÇÃO DE DOCUMENTO NA PARTE DE BAIXO */}
                              {(card.modalityCode === 'PCD_TEA' ||
                                card.modalityCode === 'KIDS' ||
                                card.modalityCode === 'IDOSO_60' ||
                                card.modalityCode === 'ESTUDANTE' ||
                                card.modalityCode === 'PROFESSOR' ||
                                card.modalityCode === 'SERVIDOR') && (
                                <div className="p-3 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-950 shadow-sm text-left">
                                  <div className="flex items-start gap-2 font-black text-xs leading-snug">
                                    <span className="text-base shrink-0">⚠️</span>
                                    <span>
                                      Atenção: É necessário comprovar com documento no ato da inscrição para ativar este cadastro. Tenha documentos em mãos!
                                    </span>
                                  </div>

                                  {card.modalityCode === 'PCD_TEA' && (
                                    <div className="mt-2 pt-2 border-t border-amber-200 text-[11px] leading-relaxed space-y-1">
                                      <div className="font-black text-amber-900">
                                        📄 Documentos aceitos para comprovação (basta 1):
                                      </div>
                                      <div className="font-semibold text-slate-800">✅ Laudo médico com CID</div>
                                      <div className="font-semibold text-slate-800">✅ Carteira de Identificação da Pessoa com Deficiência</div>
                                      <div className="font-semibold text-slate-800">✅ Carteira do Autista (municipal, estadual ou nacional)</div>
                                      <div className="font-semibold text-slate-800">✅ Documento oficial que comprove a condição</div>
                                      <div className="text-[10px] font-bold text-emerald-800 pt-1">
                                        📸 Permite tirar foto na hora com a câmera ou anexar arquivo.
                                      </div>
                                    </div>
                                  )}

                                  {card.modalityCode === 'KIDS' && (
                                    <div className="mt-2 pt-2 border-t border-amber-200 text-[11px] leading-relaxed space-y-1">
                                      <div className="font-black text-amber-900">
                                        📄 Documento obrigatório para comprovação de idade:
                                      </div>
                                      <div className="font-semibold text-slate-800">
                                        ✅ Foto que comprove a idade (ex: RG contendo foto, nome e nascimento ou Certidão de Nascimento).
                                      </div>
                                      <div className="text-[10px] font-bold text-emerald-800 pt-1">
                                        📸 Permite tirar foto na hora com a câmera ou anexar arquivo.
                                      </div>
                                    </div>
                                  )}

                                  {card.modalityCode === 'IDOSO_60' && (
                                    <div className="mt-2 pt-2 border-t border-amber-200 text-[11px] leading-relaxed space-y-1">
                                      <div className="font-black text-amber-900">
                                        📄 Documento obrigatório para comprovação de idade:
                                      </div>
                                      <div className="font-semibold text-slate-800">
                                        ✅ Foto que comprove a idade (ex: RG contendo foto, nome e nascimento ou CNH oficial).
                                      </div>
                                      <div className="text-[10px] font-bold text-emerald-800 pt-1">
                                        📸 Permite tirar foto na hora com a câmera ou anexar arquivo.
                                      </div>
                                    </div>
                                  )}

                                  {card.modalityCode === 'ESTUDANTE' && (
                                    <div className="mt-2 pt-2 border-t border-amber-200 text-[11px] leading-relaxed space-y-1">
                                      <div className="font-black text-amber-900">
                                        📄 Documento comprobatório:
                                      </div>
                                      <div className="font-semibold text-slate-800">
                                        ✅ Carteirinha de Estudante oficial ou Declaração de Matrícula.
                                      </div>
                                      <div className="text-[10px] font-bold text-emerald-800 pt-1">
                                        📸 Permite tirar foto na hora com a câmera ou anexar arquivo.
                                      </div>
                                    </div>
                                  )}

                                  {card.modalityCode === 'PROFESSOR' && (
                                    <div className="mt-2 pt-2 border-t border-amber-200 text-[11px] leading-relaxed space-y-1">
                                      <div className="font-black text-amber-900">
                                        📄 Documento comprobatório:
                                      </div>
                                      <div className="font-semibold text-slate-800">
                                        ✅ Holerite, crachá funcional ou comprovante de docência.
                                      </div>
                                      <div className="text-[10px] font-bold text-emerald-800 pt-1">
                                        📸 Permite tirar foto na hora com a câmera ou anexar arquivo.
                                      </div>
                                    </div>
                                  )}

                                  {card.modalityCode === 'SERVIDOR' && (
                                    <div className="mt-2 pt-2 border-t border-amber-200 text-[11px] leading-relaxed space-y-1">
                                      <div className="font-black text-amber-900">
                                        📄 Documento comprobatório:
                                      </div>
                                      <div className="font-semibold text-slate-800">
                                        ✅ Holerite, portaria ou identidade funcional de servidor público.
                                      </div>
                                      <div className="text-[10px] font-bold text-emerald-800 pt-1">
                                        📸 Permite tirar foto na hora com a câmera ou anexar arquivo.
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Rodapé com Preço + Botão Verde "Aderir" */}
                      <div className="p-5 pt-2 text-center space-y-3 border-t border-slate-100 bg-slate-50/40">
                        <div>
                          <div className="text-slate-700 font-bold text-sm">
                            R${' '}
                            <span className="text-3xl font-black text-[#126b38]">
                              {intPart}
                            </span>
                            <span className="text-sm font-bold text-slate-500">
                              ,{decPart}
                            </span>
                            {!isFree && (
                              <span className="text-xs text-slate-500 font-normal ml-1">
                                {activeCycle === 'ANNUAL' ? '/ano' : '/mês'}
                              </span>
                            )}
                          </div>
                          {!isFree && activeCycle === 'ANNUAL' && displayInstallment > 0 ? (
                            <div className="text-[11px] font-bold text-emerald-700">
                              ou em até 12x de {formatCurrency(displayInstallment)}/mês
                            </div>
                          ) : isFree ? (
                            <div className="text-[11px] font-bold text-emerald-700">
                              Gratuito mediante comprovação
                            </div>
                          ) : null}
                        </div>

                        <Button
                          type="button"
                          onClick={() => handleSelectPlanCard(card)}
                          className="w-full h-11 bg-[#146c38] hover:bg-[#0f532b] text-white font-bold text-sm rounded-lg shadow"
                        >
                          Aderir
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            PASSO 2: CADASTRE-SE (LAYOUT IDÊNTICO À IMAGEM ENVIADA + PLANO PRINCIPAL FIXO)
        ===================================================================== */}
        {step === 2 && (
          <form
            onSubmit={handleProceedToTerms}
            className="max-w-5xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-lg p-6 sm:p-8 space-y-6"
          >
            {/* Barra Azul Escura "Cadastre-se" idêntica à referência */}
            <div className="bg-[#111c2d] text-white rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-lg tracking-tight">Cadastre-se</h2>
                <p className="text-xs text-slate-300">
                  Preencha os dados cadastrais do titular e adicione os dependentes abaixo
                </p>
              </div>
              <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2 text-right">
                <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold block">
                  Total do Plano ({pricingSummary.totalPeople}{' '}
                  {pricingSummary.totalPeople === 1 ? 'pessoa' : 'pessoas'})
                </span>
                <span className="text-xl font-black text-white">
                  {formatCurrency(pricingSummary.totalMonthlyEquivalent)}/mês
                </span>
                {billingCycle === 'ANNUAL' && pricingSummary.totalContractValue > 0 && (
                  <span className="block text-[10px] text-emerald-300 font-semibold">
                    Total Anual: {formatCurrency(pricingSummary.totalContractValue)} (em até 12x)
                  </span>
                )}
              </div>
            </div>

            {/* CATEGORIA PRINCIPAL FIXA (TRAVADA CONFORME ESCOLHIDO NO PASSO 1) */}
            <div className="bg-emerald-50/70 border-2 border-emerald-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
                      Categoria Principal do Titular (Fixa)
                    </span>
                    <Badge className="bg-emerald-700 text-white text-[10px]">
                      {holderModality.isFreeTier
                        ? 'GRATUIDADE OFICIAL'
                        : billingCycle === 'ANNUAL'
                        ? 'PLANO ANUAL'
                        : 'PLANO MENSAL'}
                    </Badge>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    {holderModality.name} —{' '}
                    {holderModality.isFreeTier
                      ? 'R$ 0,00 (Gratuito / Isento)'
                      : billingCycle === 'ANNUAL'
                      ? `${formatCurrency(holderModality.annualInstallment)}/mês (${formatCurrency(
                          holderModality.annualPrice
                        )}/ano)`
                      : `${formatCurrency(holderModality.monthlyPrice)}/mês`}
                  </h3>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep(1)}
                className="text-xs font-bold border-emerald-600/40 text-emerald-900 hover:bg-emerald-100"
              >
                Trocar Plano Principal
              </Button>
            </div>

            {/* COMPROVAÇÃO DE DOCUMENTO OBRIGATÓRIA DO TITULAR (PCD/TEA, KIDS OU VITALÍCIO 60+) */}
            {(holderModality.isFreeTier ||
              ['PCD_TEA', 'KIDS', 'IDOSO_60'].includes(holderModality.code)) && (
              <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
                <div className="flex items-start gap-2.5">
                  <span className="text-2xl shrink-0">📄</span>
                  <div>
                    <h4 className="font-black text-sm text-amber-950 uppercase flex items-center gap-2">
                      <span>Comprovante Obrigatório para Ativar o Plano ({holderModality.name})</span>
                      <Badge className="bg-amber-400 text-amber-950 font-black text-[10px]">
                        OBRIGATÓRIO
                      </Badge>
                    </h4>
                    <p className="text-xs text-amber-900 mt-0.5 font-medium">
                      Para ativar seu cadastro de gratuidade, é necessário anexar ou tirar uma foto do documento comprobatório no ato da inscrição.
                    </p>
                  </div>
                </div>

                {holderModality.code === 'PCD_TEA' && (
                  <div className="bg-white/90 p-3.5 rounded-xl border border-amber-200 text-xs text-slate-800 space-y-1.5 shadow-sm">
                    <strong className="text-amber-950 block text-xs">
                      📄 Documentos aceitos para comprovação (basta 1):
                    </strong>
                    <div className="font-semibold text-slate-700">✅ Laudo médico com CID</div>
                    <div className="font-semibold text-slate-700">
                      ✅ Carteira de Identificação da Pessoa com Deficiência
                    </div>
                    <div className="font-semibold text-slate-700">
                      ✅ Carteira do Autista (municipal, estadual ou nacional)
                    </div>
                    <div className="font-semibold text-slate-700">
                      ✅ Documento oficial que comprove a condição
                    </div>
                  </div>
                )}

                {(holderModality.code === 'KIDS' || holderModality.code === 'IDOSO_60') && (
                  <div className="bg-white/90 p-3.5 rounded-xl border border-amber-200 text-xs text-slate-800 space-y-1.5 shadow-sm">
                    <strong className="text-amber-950 block text-xs">
                      📄 Documento obrigatório para comprovação de idade:
                    </strong>
                    <div className="font-semibold text-slate-700">
                      ✅ Foto que comprove a idade (ex: RG com foto, nome e nascimento ou{' '}
                      {holderModality.code === 'KIDS' ? 'Certidão de Nascimento' : 'CNH oficial'})
                      para que possa ativar o plano.
                    </div>
                  </div>
                )}

                {/* BOTÕES DE CAPTURA COM CÂMERA OU ANEXAR ARQUIVO */}
                <div className="pt-1">
                  {!holderDocAttachment ? (
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Botão Câmera */}
                      <Label
                        htmlFor="titular-cam-input"
                        className="flex-1 min-w-[210px] inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#004d00] hover:bg-emerald-900 text-white rounded-xl font-black text-xs cursor-pointer shadow transition-all hover:scale-[1.01]"
                      >
                        <Camera className="w-4 h-4 text-emerald-300" />
                        📸 Tirar Foto na Hora (Câmera)
                      </Label>
                      <input
                        id="titular-cam-input"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const dataUrl = await fileToDataUrl(f);
                          setHolderDocAttachment({
                            id: `att_holder_${Date.now()}`,
                            name: `Comprovante_${holderModality.name}_${f.name}`,
                            mimeType: f.type || 'image/jpeg',
                            dataUrl,
                            createdAt: new Date().toISOString(),
                          });
                          toast({
                            title: 'Foto capturada com sucesso!',
                            description: 'Documento pronto para ativação.',
                          });
                        }}
                      />

                      {/* Botão Anexar Arquivo */}
                      <Label
                        htmlFor="titular-file-input"
                        className="flex-1 min-w-[210px] inline-flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-300 rounded-xl font-black text-xs cursor-pointer shadow-sm transition-all"
                      >
                        <Upload className="w-4 h-4 text-slate-600" />
                        📁 Anexar Arquivo / Foto (Galeria ou PDF)
                      </Label>
                      <input
                        id="titular-file-input"
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const dataUrl = await fileToDataUrl(f);
                          setHolderDocAttachment({
                            id: `att_holder_${Date.now()}`,
                            name: `Comprovante_${holderModality.name}_${f.name}`,
                            mimeType: f.type || 'application/octet-stream',
                            dataUrl,
                            createdAt: new Date().toISOString(),
                          });
                          toast({
                            title: 'Arquivo anexado com sucesso!',
                            description: f.name,
                          });
                        }}
                      />
                    </div>
                  ) : (
                    /* PREVIEW DO DOCUMENTO CAPTURADO / ANEXADO */
                    <div className="bg-emerald-100/90 border-2 border-emerald-400 p-3.5 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {holderDocAttachment.mimeType.startsWith('image/') ? (
                          <img
                            src={holderDocAttachment.dataUrl}
                            alt="Comprovante"
                            className="w-12 h-12 object-cover rounded-lg border border-emerald-300 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-emerald-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            PDF
                          </div>
                        )}
                        <div className="truncate">
                          <div className="font-bold text-xs text-emerald-950 flex items-center gap-1.5 truncate">
                            <FileCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                            {holderDocAttachment.name}
                          </div>
                          <div className="text-[11px] text-emerald-800">
                            Comprovante anexado pronto para ativação do cadastro
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setHolderDocAttachment(null)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-bold shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Trocar / Remover
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* GRADE DE CAMPOS DO TITULAR (EXATAMENTE COMO NA IMAGEM "Cadastre-se") */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-black text-slate-900 mb-1.5 block">
                  Nome completo *
                </Label>
                <Input
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  placeholder="Digite seu nome completo"
                  className="h-11 bg-white border-slate-300"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-black text-slate-900 mb-1.5 block">
                  E-mail
                </Label>
                <Input
                  type="email"
                  value={holderEmail}
                  onChange={(e) => setHolderEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="h-11 bg-white border-slate-300"
                />
              </div>

              <div>
                <Label className="text-xs font-black text-slate-900 mb-1.5 block">
                  CPF *
                </Label>
                <Input
                  value={holderCpf}
                  onChange={(e) => setHolderCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  className={`h-11 bg-white ${
                    holderCpf && cleanDigits(holderCpf).length === 11 && !isValidCpf(holderCpf)
                      ? 'border-rose-500 focus-visible:ring-rose-500 bg-rose-50/20'
                      : 'border-slate-300'
                  }`}
                  required
                />
                {holderCpf && cleanDigits(holderCpf).length === 11 && !isValidCpf(holderCpf) && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1">
                    ⚠️ CPF inválido. Verifique os números digitados.
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs font-black text-slate-900 mb-1.5 block">
                  Data de nascimento *
                </Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={holderBirthDate}
                  onChange={(e) => setHolderBirthDate(formatBirthDate(e.target.value))}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className="h-11 bg-white border-slate-300"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-black text-slate-900 mb-1.5 block">
                  Sexo
                </Label>
                <select
                  value={holderSex}
                  onChange={(e) => setHolderSex(e.target.value)}
                  className="w-full h-11 rounded-md border border-slate-300 px-3 text-sm bg-white"
                >
                  <option value="">Selecione</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-black text-slate-900 mb-1.5 block">
                  Estado Civil
                </Label>
                <select
                  value={holderMaritalStatus}
                  onChange={(e) => setHolderMaritalStatus(e.target.value)}
                  className="w-full h-11 rounded-md border border-slate-300 px-3 text-sm bg-white"
                >
                  <option value="">Selecione</option>
                  <option value="Solteiro(a)">Solteiro(a)</option>
                  <option value="Casado(a)">Casado(a)</option>
                  <option value="União Estável">União Estável</option>
                  <option value="Divorciado(a)">Divorciado(a)</option>
                  <option value="Viúvo(a)">Viúvo(a)</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-black text-slate-900 mb-1.5 block">
                  Telefone / WhatsApp *
                </Label>
                <Input
                  value={holderPhone}
                  onChange={(e) => setHolderPhone(formatPhone(e.target.value))}
                  placeholder="Digite seu telefone com DDD"
                  className="h-11 bg-white border-slate-300"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-black text-slate-900 mb-1.5 block">
                  CEP
                </Label>
                <Input
                  value={addressCep}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAddressCep(val);
                    if (val.replace(/\D/g, '').length === 8) {
                      handleCepLookup(val);
                    }
                  }}
                  onBlur={() => handleCepLookup(addressCep)}
                  placeholder="76870-000"
                  className="h-11 bg-white border-slate-300"
                />
              </div>

              <div>
                <Label className="text-xs font-black text-slate-900 mb-1.5 block">
                  Rua/Av
                </Label>
                <Input
                  value={addressStreet}
                  onChange={(e) => setAddressStreet(e.target.value)}
                  className="h-11 bg-white border-slate-300"
                />
              </div>

              <div>
                <Label className="text-xs font-black text-slate-900 mb-1.5 block">
                  Número do endereço
                </Label>
                <Input
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value)}
                  className="h-11 bg-white border-slate-300"
                />
              </div>

              <div>
                <Label className="text-xs font-black text-slate-900 mb-1.5 block">
                  Complemento
                </Label>
                <Input
                  value={addressComplement}
                  onChange={(e) => setAddressComplement(e.target.value)}
                  className="h-11 bg-white border-slate-300"
                />
              </div>

              <div>
                <Label className="text-xs font-black text-slate-900 mb-1.5 block">
                  Bairro
                </Label>
                <Input
                  value={addressNeighborhood}
                  onChange={(e) => setAddressNeighborhood(e.target.value)}
                  className="h-11 bg-white border-slate-300"
                />
              </div>

              <div>
                <Label className="text-xs font-black text-slate-900 mb-1.5 block">
                  Cidade
                </Label>
                <Input
                  value={addressCity}
                  onChange={(e) => setAddressCity(e.target.value)}
                  className="h-11 bg-white border-slate-300"
                />
              </div>

              <div>
                <Label className="text-xs font-black text-slate-900 mb-1.5 block">
                  Estado
                </Label>
                <select
                  value={addressState}
                  onChange={(e) => setAddressState(e.target.value)}
                  className="w-full h-11 rounded-md border border-slate-300 px-3 text-sm bg-white"
                >
                  <option value="">Selecione</option>
                  {UF_LIST.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* =================================================================
                ADIÇÃO DE DEPENDENTES E AJUSTE DE VALORES EM TEMPO REAL
            ================================================================= */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    Dependentes / Familiares Vinculados ({dependentsDraft.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Adicione cônjuge, filhos estudantes, servidores, crianças até 11 anos (Grátis), idosos 60+ (Grátis) ou PCD/TEA (Grátis).
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={() =>
                    setDependentsDraft((prev) => [
                      ...prev,
                      {
                        id: `dep-${Date.now()}-${prev.length}`,
                        modalityCode: 'ADULTO',
                        fullName: '',
                        cpf: '',
                        birthDate: '',
                        sex: '',
                        kinship: 'Familiar / Dependente',
                      },
                    ])
                  }
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> + Adicionar Dependente
                </Button>
              </div>

              {dependentsDraft.length > 0 && (
                <div className="space-y-3">
                  {dependentsDraft.map((dep, idx) => {
                    const depMod = findModality(dep.modalityCode);
                    const depMonthly =
                      billingCycle === 'ANNUAL'
                        ? depMod.annualInstallment
                        : depMod.monthlyPrice;
                    return (
                      <div
                        key={dep.id}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase text-slate-700">
                            Dependente #{idx + 1} —{' '}
                            <span className="text-emerald-700">
                              {depMod.isFreeTier
                                ? 'ISENTO / GRÁTIS (R$ 0,00)'
                                : `+ ${formatCurrency(depMonthly)}/mês`}
                            </span>
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setDependentsDraft((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="text-rose-600 hover:text-rose-700 h-7 text-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                          <div className="sm:col-span-4">
                            <Label className="text-xs font-bold">
                              Modalidade do Dependente *
                            </Label>
                            <select
                              value={dep.modalityCode}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDependentsDraft((prev) =>
                                  prev.map((d, i) =>
                                    i === idx ? { ...d, modalityCode: val } : d
                                  )
                                );
                              }}
                              className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white mt-1"
                            >
                              {activeModalities
                                .filter((m) => m.visibleInSimulator)
                                .map((m) => (
                                  <option key={m.code} value={m.code}>
                                    {m.name} (
                                    {m.isFreeTier
                                      ? 'Grátis'
                                      : `${formatCurrency(
                                          billingCycle === 'ANNUAL'
                                            ? m.annualInstallment
                                            : m.monthlyPrice
                                        )}/mês`}
                                    )
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="sm:col-span-4">
                            <Label className="text-xs font-bold">
                              Nome completo *
                            </Label>
                            <Input
                              value={dep.fullName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDependentsDraft((prev) =>
                                  prev.map((d, i) =>
                                    i === idx ? { ...d, fullName: val } : d
                                  )
                                );
                              }}
                              placeholder="Nome completo do dependente"
                              className="h-10 bg-white mt-1"
                              required
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <Label className="text-xs font-bold">CPF</Label>
                            <Input
                              value={dep.cpf}
                              onChange={(e) => {
                                const val = formatCpf(e.target.value);
                                setDependentsDraft((prev) =>
                                  prev.map((d, i) =>
                                    i === idx ? { ...d, cpf: val } : d
                                  )
                                );
                              }}
                              placeholder="000.000.000-00"
                              className={`h-10 bg-white mt-1 ${
                                dep.cpf && cleanDigits(dep.cpf).length === 11 && !isValidCpf(dep.cpf)
                                  ? 'border-rose-500 focus-visible:ring-rose-500 bg-rose-50/20'
                                  : ''
                              }`}
                            />
                            {dep.cpf && cleanDigits(dep.cpf).length === 11 && !isValidCpf(dep.cpf) && (
                              <p className="text-[10px] text-rose-600 font-bold mt-0.5">
                                ⚠️ CPF inválido
                              </p>
                            )}
                          </div>

                          <div className="sm:col-span-2">
                            <Label className="text-xs font-bold">
                              Nascimento
                            </Label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={dep.birthDate}
                              onChange={(e) => {
                                const val = formatBirthDate(e.target.value);
                                setDependentsDraft((prev) =>
                                  prev.map((d, i) =>
                                    i === idx ? { ...d, birthDate: val } : d
                                  )
                                );
                              }}
                              placeholder="DD/MM/AAAA"
                              maxLength={10}
                              className="h-10 bg-white mt-1"
                            />
                          </div>
                        </div>

                        {/* COMPROVAÇÃO DE DOCUMENTO DO DEPENDENTE (PCD/TEA, KIDS OU IDOSO 60+) */}
                        {['PCD_TEA', 'KIDS', 'IDOSO_60'].includes(dep.modalityCode) && (
                          <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3.5 space-y-2.5 mt-2 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-black text-xs text-amber-950 uppercase flex items-center gap-1.5">
                                  📄 Comprovante Obrigatório ({depMod.name})
                                  <Badge className="bg-amber-400 text-amber-950 text-[9px] font-black">
                                    OBRIGATÓRIO
                                  </Badge>
                                </span>
                                <p className="text-[11px] text-amber-900 mt-0.5 font-medium">
                                  Para ativar a gratuidade deste dependente, é necessário anexar ou tirar uma foto do documento.
                                </p>
                              </div>
                            </div>

                            {dep.modalityCode === 'PCD_TEA' && (
                              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 text-[11px] text-slate-800 space-y-1">
                                <strong className="text-amber-950 block text-[11px]">
                                  Documentos aceitos para comprovação (basta 1):
                                </strong>
                                <div>✅ Laudo médico com CID</div>
                                <div>✅ Carteira de Identificação da Pessoa com Deficiência</div>
                                <div>✅ Carteira do Autista (municipal, estadual ou nacional)</div>
                                <div>✅ Documento oficial que comprove a condição</div>
                              </div>
                            )}

                            {(dep.modalityCode === 'KIDS' || dep.modalityCode === 'IDOSO_60') && (
                              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 text-[11px] text-slate-800 space-y-1">
                                <strong className="text-amber-950 block text-[11px]">
                                  Documento obrigatório para comprovação de idade:
                                </strong>
                                <div>
                                  ✅ Foto que comprove a idade (ex: RG com foto, nome e data de nascimento ou{' '}
                                  {dep.modalityCode === 'KIDS' ? 'Certidão de Nascimento' : 'CNH oficial'}).
                                </div>
                              </div>
                            )}

                            <div>
                              {!dep.docAttachment ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  {/* Botão Câmera Dependente */}
                                  <Label
                                    htmlFor={`dep-cam-input-${dep.id}`}
                                    className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#004d00] hover:bg-emerald-900 text-white rounded-lg font-bold text-xs cursor-pointer shadow-sm transition-all"
                                  >
                                    <Camera className="w-3.5 h-3.5 text-emerald-300" />
                                    📸 Tirar Foto na Hora (Câmera)
                                  </Label>
                                  <input
                                    id={`dep-cam-input-${dep.id}`}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const f = e.target.files?.[0];
                                      if (!f) return;
                                      const dataUrl = await fileToDataUrl(f);
                                      const newDoc: ClubAttachment = {
                                        id: `att_dep_${Date.now()}_${idx}`,
                                        name: `Comprovante_${depMod.name}_${f.name}`,
                                        mimeType: f.type || 'image/jpeg',
                                        dataUrl,
                                        createdAt: new Date().toISOString(),
                                      };
                                      setDependentsDraft((prev) =>
                                        prev.map((d, i) =>
                                          i === idx ? { ...d, docAttachment: newDoc } : d
                                        )
                                      );
                                      toast({
                                        title: 'Foto capturada com sucesso!',
                                        description: `Comprovante de ${dep.fullName || 'dependente'} anexado.`,
                                      });
                                    }}
                                  />

                                  {/* Botão Anexar Arquivo Dependente */}
                                  <Label
                                    htmlFor={`dep-file-input-${dep.id}`}
                                    className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg font-bold text-xs cursor-pointer shadow-sm transition-all"
                                  >
                                    <Upload className="w-3.5 h-3.5 text-slate-600" />
                                    📁 Anexar Arquivo / Foto (Galeria ou PDF)
                                  </Label>
                                  <input
                                    id={`dep-file-input-${dep.id}`}
                                    type="file"
                                    accept="image/*,.pdf"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const f = e.target.files?.[0];
                                      if (!f) return;
                                      const dataUrl = await fileToDataUrl(f);
                                      const newDoc: ClubAttachment = {
                                        id: `att_dep_${Date.now()}_${idx}`,
                                        name: `Comprovante_${depMod.name}_${f.name}`,
                                        mimeType: f.type || 'application/octet-stream',
                                        dataUrl,
                                        createdAt: new Date().toISOString(),
                                      };
                                      setDependentsDraft((prev) =>
                                        prev.map((d, i) =>
                                          i === idx ? { ...d, docAttachment: newDoc } : d
                                        )
                                      );
                                      toast({
                                        title: 'Arquivo anexado com sucesso!',
                                        description: f.name,
                                      });
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="bg-emerald-100/90 border border-emerald-400 p-2.5 rounded-lg flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 overflow-hidden text-xs">
                                    {dep.docAttachment.mimeType.startsWith('image/') ? (
                                      <img
                                        src={dep.docAttachment.dataUrl}
                                        alt="Comprovante"
                                        className="w-10 h-10 object-cover rounded border border-emerald-300 shrink-0"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded bg-emerald-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                                        PDF
                                      </div>
                                    )}
                                    <div className="truncate">
                                      <div className="font-bold text-emerald-950 truncate flex items-center gap-1">
                                        <FileCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                        {dep.docAttachment.name}
                                      </div>
                                      <div className="text-[10px] text-emerald-800">
                                        Comprovante anexado para ativação
                                      </div>
                                    </div>
                                  </div>

                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      setDependentsDraft((prev) =>
                                        prev.map((d, i) =>
                                          i === idx ? { ...d, docAttachment: null } : d
                                        )
                                      )
                                    }
                                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-[11px] font-bold h-7"
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" /> Trocar / Remover
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Resumo Financeiro Transparente (Titular + Dependentes) */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-0.5 text-xs">
                  <div className="text-slate-300">
                    Titular ({holderModality.name}):{' '}
                    <strong className="text-white">
                      {formatCurrency(pricingSummary.holderMonthly)}/mês
                    </strong>
                    {dependentsDraft.length > 0 && (
                      <>
                        {' '}
                        + {dependentsDraft.length} Dependente(s):{' '}
                        <strong className="text-white">
                          {formatCurrency(pricingSummary.dependentsMonthly)}/mês
                        </strong>
                      </>
                    )}
                  </div>
                  <div className="text-[11px] text-amber-300">
                    * As carteirinhas digitais serão geradas e personalizadas ao final da adesão.
                  </div>
                  <div className="text-[11px] text-slate-300/95 leading-relaxed pt-1.5 border-t border-slate-800">
                    <span className="text-emerald-400 font-bold">ℹ️ Modalidade de Assinatura:</span> Os planos do Lessa Club constituem uma assinatura contínua com mensalidades regulares para garantia de acesso ilimitado e manutenção dos benefícios de associado, devidas mensalmente independentemente da frequência de uso ou visitação ao balneário.
                  </div>
                </div>

                <div className="text-right sm:self-center shrink-0">
                  <span className="text-[10px] uppercase text-slate-400 block font-bold">
                    Valor Final da Assinatura
                  </span>
                  <span className="text-2xl font-black text-emerald-400">
                    {formatCurrency(pricingSummary.totalMonthlyEquivalent)}/mês
                  </span>
                  {billingCycle === 'ANNUAL' && pricingSummary.totalContractValue > 0 && (
                    <span className="block text-[11px] text-slate-300">
                      Total do Contrato Anual:{' '}
                      <strong>{formatCurrency(pricingSummary.totalContractValue)}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Bloco inferior igual à imagem enviada ("PROSSEGUIR") */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-4">
              <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
                Para continuar, na próxima etapa você visualizará os termos e o contrato preenchido com os dados da sua assinatura.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="h-11 px-6 font-bold"
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
                </Button>
                <Button
                  type="submit"
                  className="h-11 px-10 bg-[#0b5ed7] hover:bg-blue-700 text-white font-black uppercase tracking-wide rounded-lg shadow"
                >
                  PROSSEGUIR
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* =====================================================================
            PASSO 3: TERMOS E CONDIÇÕES / CONTRATO AUTOMÁTICO
        ===================================================================== */}
        {step === 3 && (
          <div className="max-w-5xl mx-auto bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-lg space-y-6">
            <div className="bg-[#111c2d] text-white rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-lg">Termos e Contrato de Adesão</h2>
                <p className="text-xs text-slate-300">
                  Escolha a forma de pagamento, o número de parcelas e confira seu contrato abaixo
                </p>
              </div>
              <div className="text-right">
                {pricingSummary.totalMonthlyEquivalent === 0 ? (
                  <span className="text-lg font-black text-emerald-400">
                    PLANO GRATUITO (R$ 0,00)
                  </span>
                ) : billingCycle === 'ANNUAL' ? (
                  <>
                    <span className="text-[11px] uppercase tracking-wider text-emerald-300 font-bold block">
                      Plano Anual • Total de 1 Ano: {formatCurrency(pricingSummary.totalContractValue)}
                    </span>
                    <span className="text-lg font-black text-amber-300">
                      {paymentMethod === 'PIX'
                        ? `${formatCurrency(pricingSummary.totalContractValue)} à vista no PIX`
                        : `${installments}x de ${formatCurrency(
                            Number((pricingSummary.totalContractValue / installments).toFixed(2))
                          )} no Cartão de Crédito`}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] uppercase tracking-wider text-sky-300 font-bold block">
                      Plano Mensal Recorrente (12 cobranças mensais)
                    </span>
                    <span className="text-lg font-black text-amber-300">
                      Mensalidade: {formatCurrency(pricingSummary.totalMonthlyEquivalent)}/mês
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* SELETOR DE MEIO DE PAGAMENTO + PARCELAMENTO + DADOS DO CARTÃO */}
            {pricingSummary.totalMonthlyEquivalent > 0 && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <Label className="text-xs font-black uppercase text-emerald-950 block">
                    {billingCycle === 'ANNUAL'
                      ? '1. Escolha o Meio de Pagamento do Plano Anual:'
                      : '1. Escolha o Meio de Pagamento do Plano Mensal (12 Cobranças Mensais Recorrentes):'}
                  </Label>
                  <span className="text-[11px] font-semibold text-emerald-800">
                    {billingCycle === 'ANNUAL'
                      ? `Valor Integral de 1 Ano: ${formatCurrency(pricingSummary.totalContractValue)}`
                      : `12 mensalidades recorrentes de ${formatCurrency(pricingSummary.totalMonthlyEquivalent)}/mês`}
                  </span>
                </div>

                {billingCycle === 'ANNUAL' ? (
                  /* PLANO ANUAL: PIX INTEGRAL, CRÉDITO 1X A 12X OU DÉBITO INTEGRAL */
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('PIX')}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                        paymentMethod === 'PIX'
                          ? 'bg-emerald-700 text-white border-emerald-700 font-bold shadow-md'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-black">
                          PIX (Integral)
                        </div>
                        <div
                          className={`text-[11px] mt-0.5 ${
                            paymentMethod === 'PIX' ? 'text-emerald-100' : 'text-slate-500'
                          }`}
                        >
                          Valor único de{' '}
                          <strong>{formatCurrency(pricingSummary.totalContractValue)}</strong> à vista
                        </div>
                      </div>
                      <QrCode className="w-5 h-5 shrink-0 ml-2" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CREDIT_CARD')}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                        paymentMethod === 'CREDIT_CARD'
                          ? 'bg-emerald-700 text-white border-emerald-700 font-bold shadow-md'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-black">
                          Cartão de Crédito (1x a 12x)
                        </div>
                        <div
                          className={`text-[11px] mt-0.5 ${
                            paymentMethod === 'CREDIT_CARD'
                              ? 'text-emerald-100'
                              : 'text-slate-500'
                          }`}
                        >
                          Valor integral em{' '}
                          <strong>
                            {installments}x de{' '}
                            {formatCurrency(
                              Number((pricingSummary.totalContractValue / installments).toFixed(2))
                            )}
                          </strong>
                        </div>
                      </div>
                      <CreditCard className="w-5 h-5 shrink-0 ml-2" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('DEBIT_CARD')}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                        paymentMethod === 'DEBIT_CARD'
                          ? 'bg-emerald-700 text-white border-emerald-700 font-bold shadow-md'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-black">
                          Cartão de Débito (Integral)
                        </div>
                        <div
                          className={`text-[11px] mt-0.5 ${
                            paymentMethod === 'DEBIT_CARD'
                              ? 'text-emerald-100'
                              : 'text-slate-500'
                          }`}
                        >
                          Valor único à vista:{' '}
                          <strong>{formatCurrency(pricingSummary.totalContractValue)}</strong>
                        </div>
                      </div>
                      <CreditCard className="w-5 h-5 shrink-0 ml-2" />
                    </button>
                  </div>
                ) : (
                  /* PLANO MENSAL: 12 COBRANÇAS RECORRENTES NO PIX, CRÉDITO OU DÉBITO */
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('PIX')}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                        paymentMethod === 'PIX'
                          ? 'bg-emerald-700 text-white border-emerald-700 font-bold shadow-md'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-black">PIX Recorrente</div>
                        <div
                          className={`text-[11px] mt-0.5 ${
                            paymentMethod === 'PIX' ? 'text-emerald-100' : 'text-slate-500'
                          }`}
                        >
                          12 cobranças mensais de{' '}
                          <strong>{formatCurrency(pricingSummary.totalMonthlyEquivalent)}/mês</strong>
                        </div>
                      </div>
                      <QrCode className="w-5 h-5 shrink-0 ml-2" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CREDIT_CARD')}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                        paymentMethod === 'CREDIT_CARD'
                          ? 'bg-emerald-700 text-white border-emerald-700 font-bold shadow-md'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-black">Cartão de Crédito</div>
                        <div
                          className={`text-[11px] mt-0.5 ${
                            paymentMethod === 'CREDIT_CARD'
                              ? 'text-emerald-100'
                              : 'text-slate-500'
                          }`}
                        >
                          12 cobranças recorrentes de{' '}
                          <strong>{formatCurrency(pricingSummary.totalMonthlyEquivalent)}/mês</strong>
                        </div>
                      </div>
                      <CreditCard className="w-5 h-5 shrink-0 ml-2" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('DEBIT_CARD')}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                        paymentMethod === 'DEBIT_CARD'
                          ? 'bg-emerald-700 text-white border-emerald-700 font-bold shadow-md'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-black">Cartão de Débito</div>
                        <div
                          className={`text-[11px] mt-0.5 ${
                            paymentMethod === 'DEBIT_CARD'
                              ? 'text-emerald-100'
                              : 'text-slate-500'
                          }`}
                        >
                          12 cobranças recorrentes de{' '}
                          <strong>{formatCurrency(pricingSummary.totalMonthlyEquivalent)}/mês</strong>
                        </div>
                      </div>
                      <CreditCard className="w-5 h-5 shrink-0 ml-2" />
                    </button>
                  </div>
                )}

                {/* PERGUNTA: EM QUANTAS VEZES DESEJA PARCELAR + VALOR DAS PARCELAS */}
                {billingCycle === 'ANNUAL' && paymentMethod === 'CREDIT_CARD' && (
                  <div className="bg-white rounded-xl border border-emerald-200 p-4 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <Label className="text-xs font-black uppercase text-emerald-950">
                        2. Em quantas vezes deseja parcelar no Cartão de Crédito?
                      </Label>
                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                        Selecionado: {installments}x de{' '}
                        {formatCurrency(
                          Number((pricingSummary.totalContractValue / installments).toFixed(2))
                        )}{' '}
                        sem juros (Total: {formatCurrency(pricingSummary.totalContractValue)})
                      </span>
                    </div>
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className="w-full h-11 rounded-xl border border-emerald-300 px-3 text-sm font-black text-slate-900 bg-white shadow-sm"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                        const instVal = Number(
                          (pricingSummary.totalContractValue / n).toFixed(2)
                        );
                        return (
                          <option key={n} value={n}>
                            {n}x de {formatCurrency(instVal)} sem juros — Total Anual:{' '}
                            {formatCurrency(pricingSummary.totalContractValue)}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {billingCycle === 'MONTHLY' &&
                  (paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT_CARD') && (
                    <div className="bg-white rounded-xl border border-emerald-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-black uppercase text-emerald-950 block">
                          2. Modalidade de Parcelamento / Recorrência Mensal:
                        </span>
                        <span className="text-xs text-slate-600">
                          Cobrança mensal automática sem comprometer o limite anual do cartão
                        </span>
                      </div>
                      <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                        12 cobranças mensais de{' '}
                        {formatCurrency(pricingSummary.totalMonthlyEquivalent)}/mês
                      </span>
                    </div>
                  )}

                {/* 3. DADOS DO CARTÃO (QUANDO ESCOLHIDO CARTÃO DE CRÉDITO OU DÉBITO) */}
                {(paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT_CARD') && (
                  <div className="bg-white rounded-xl border border-emerald-300 p-4 space-y-3 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                      <span className="text-xs font-black uppercase text-emerald-950">
                        3. Cadastre os Dados do{' '}
                        {paymentMethod === 'DEBIT_CARD'
                          ? 'Cartão de Débito'
                          : 'Cartão de Crédito'}{' '}
                        (ou preencha na próxima tela de Pagamento):
                      </span>
                      <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                        Status Atual: PLANO INATIVO (Ativa após o pagamento)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-5">
                        <Label className="text-[11px] font-bold text-slate-700">
                          Nome impresso no cartão
                        </Label>
                        <Input
                          value={cardHolderName}
                          onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
                          placeholder={holderName ? holderName.toUpperCase() : 'NOME NO CARTÃO'}
                          className="h-10 font-bold uppercase text-xs mt-1"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <Label className="text-[11px] font-bold text-slate-700">
                          Número do Cartão
                        </Label>
                        <Input
                          value={cardNumber}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
                            const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
                            setCardNumber(formatted);
                          }}
                          placeholder="0000 0000 0000 0000"
                          className="h-10 font-mono font-bold text-xs mt-1"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-[11px] font-bold text-slate-700">
                          Validade
                        </Label>
                        <Input
                          value={cardExpiry}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                            const formatted =
                              digits.length > 2
                                ? `${digits.slice(0, 2)}/${digits.slice(2)}`
                                : digits;
                            setCardExpiry(formatted);
                          }}
                          placeholder="MM/AA"
                          className="h-10 font-mono font-bold text-center text-xs mt-1"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <Label className="text-[11px] font-bold text-slate-700">
                          CVV
                        </Label>
                        <Input
                          value={cardCvv}
                          onChange={(e) =>
                            setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                          placeholder="123"
                          className="h-10 font-mono font-bold text-center text-xs mt-1"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AVISO PROFISSIONAL SOBRE A ASSINATURA */}
            <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 text-xs text-amber-950 space-y-1">
              <strong className="text-amber-900 flex items-center gap-1.5 font-black uppercase tracking-wide">
                <span>ℹ️</span> Informação Importante sobre a Assinatura:
              </strong>
              <p className="leading-relaxed text-slate-700">
                Os planos do Lessa Club constituem uma <strong>assinatura contínua com mensalidade regular</strong> para garantia do seu acesso ilimitado e manutenção ativa de todos os benefícios de associado. As mensalidades são devidas mensalmente durante a vigência do contrato, <strong>independentemente da frequência de comparecimento ou utilização do balneário</strong>.
              </p>
            </div>

            {/* VISUALIZAÇÃO DO CONTRATO ORGANIZADO COM ESPAÇAMENTO ENTRE CLÁUSULAS */}
            <div
              className="max-h-[460px] overflow-y-auto p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 shadow-inner"
              dangerouslySetInnerHTML={{ __html: previewContractHtml }}
            />

            <label className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={contractAccepted}
                onChange={(e) => setContractAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-slate-300 text-emerald-600"
              />
              <span className="text-xs sm:text-sm text-slate-700 font-medium">
                Li e aceito os <strong>Termos e Condições e o Contrato de Adesão Lessa Club</strong> acima.
              </span>
            </label>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(2)}
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar ao Cadastro
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalizeAndPay}
                className="bg-[#0b5ed7] hover:bg-blue-700 text-white font-black px-8 h-12 text-sm uppercase tracking-wide"
              >
                {isSubmitting
                  ? 'Processando Adesão...'
                  : pricingSummary.totalMonthlyEquivalent === 0
                  ? 'Concluir e Gerar Carteirinha Gratuita'
                  : 'Aceitar e Prosseguir para Pagamento'}
              </Button>
            </div>
          </div>
        )}

        {/* =====================================================================
            PASSO 4: PAGAMENTO (CARTÃO OU PIX) + STATUS INATIVO/ATIVO + CARTEIRINHAS
        ===================================================================== */}
        {step === 4 && createdSub && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-md space-y-6">
              {/* CABEÇALHO COM STATUS ATUAL: PLANO INATIVO vs PLANO ATIVO */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="space-y-1.5">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-sm text-center whitespace-normal leading-tight ${
                      createdSub.status === 'ACTIVE'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white animate-pulse'
                    }`}
                  >
                    {createdSub.status === 'ACTIVE'
                      ? '● STATUS ATUAL: PLANO ATIVO (PAGAMENTO IDENTIFICADO • ACESSO E EDIÇÃO LIBERADOS)'
                      : '● STATUS ATUAL: PLANO INATIVO (AGUARDANDO PAGAMENTO PARA ATIVAR)'}
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">
                    {createdSub.status === 'ACTIVE'
                      ? `Assinatura Ativa, ${createdSub.holderName}!`
                      : `Falta apenas o pagamento para ativar seu plano, ${createdSub.holderName}!`}
                  </h2>
                  <p className="text-sm text-slate-600">
                    Código da Assinatura: <strong>#{createdSub.subscriptionCode}</strong> •{' '}
                    {createdSub.billingCycle === 'ANNUAL' ? (
                      <>
                        Plano Anual: <strong>{formatCurrency(createdSub.totalContractValue)}</strong>{' '}
                        ({createdSub.paymentMethod === 'PIX'
                          ? 'Valor Integral no PIX'
                          : `${createdSub.installments || installments}x de ${formatCurrency(
                              Number(
                                (
                                  createdSub.totalContractValue /
                                  (createdSub.installments || installments)
                                ).toFixed(2)
                              )
                            )} no Cartão de Crédito`})
                      </>
                    ) : (
                      <>
                        Plano Mensal Recorrente (12 cobranças):{' '}
                        <strong>{formatCurrency(createdSub.monthlyEquivalent)}/mês</strong>
                      </>
                    )}
                  </p>
                </div>

                <Link to={`/socio?cpf=${encodeURIComponent(createdSub.holderCpf)}`}>
                  <Button className="bg-slate-900 hover:bg-slate-800 text-white font-bold">
                    Acessar Área do Sócio (/socio) <ExternalLink className="w-4 h-4 ml-1.5" />
                  </Button>
                </Link>
              </div>

              {/* CARD DE DADOS DE ACESSO AO PORTAL DO SÓCIO (LOGIN = EMAIL, SENHA = DATA DE NASCIMENTO) */}
              {(() => {
                const access = getMemberAccessMessage(createdSub);
                return (
                  <div className="bg-slate-900 text-white p-5 rounded-3xl border-2 border-amber-400 shadow-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                          🔑 Credenciais de Acesso ao Portal do Associado
                        </span>
                        <h4 className="text-base font-black text-white mt-0.5">
                          Seu Login e Senha para acessar o Portal
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(access.message);
                            toast({
                              title: 'Copiado!',
                              description: 'Dados de acesso copiados para a área de transferência.',
                            });
                          }}
                          variant="outline"
                          className="bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold text-xs h-9"
                        >
                          <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar Acesso
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          asChild
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs h-9"
                        >
                          <a href={access.whatsappUrl} target="_blank" rel="noopener noreferrer">
                            Enviar via WhatsApp
                            <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                          </a>
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Usuário / Login</span>
                        <span className="font-mono font-bold text-amber-300 text-sm block truncate" title={access.loginUser}>
                          {access.loginUser}
                        </span>
                      </div>
                      <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Senha Padrão</span>
                        <span className="font-mono font-bold text-emerald-400 text-sm block">
                          {access.password}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">Data de nascimento (números)</span>
                      </div>
                      <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Link de Acesso</span>
                        <span className="font-mono font-bold text-white text-xs block truncate">
                          balneariolessa.com.br/socio
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ===============================================================
                  BLOCO DE PAGAMENTO (EXIBIDO ENQUANTO O PLANO ESTÁ INATIVO)
              =============================================================== */}
              {createdSub.status !== 'ACTIVE' && createdInvoice && createdInvoice.amount > 0 && (
                <div className="bg-slate-50 border-2 border-emerald-500 rounded-2xl p-6 space-y-6 shadow-sm">
                  {/* Alternador rápido de forma de pagamento no Passo 4 */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-800 block">
                        Ativação da Assinatura Lessa Club
                      </span>
                      <h3 className="text-lg font-black text-slate-900">
                        Escolha como deseja pagar agora para ativar seu plano e liberar suas carteirinhas:
                      </h3>
                    </div>

                    <div className="inline-flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('CREDIT_CARD')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                          paymentMethod === 'CREDIT_CARD'
                            ? 'bg-emerald-700 text-white shadow'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Cartão de Crédito
                      </button>
                      <button
                          type="button"
                          onClick={() => setPaymentMethod('DEBIT_CARD')}
                          className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                            paymentMethod === 'DEBIT_CARD'
                              ? 'bg-emerald-700 text-white shadow'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Cartão de Débito
                        </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('PIX')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                          paymentMethod === 'PIX'
                            ? 'bg-emerald-700 text-white shadow'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <QrCode className="w-3.5 h-3.5" /> PIX
                      </button>
                    </div>
                  </div>

                  {/* OPÇÃO A: CADASTRO DE CARTÃO DE CRÉDITO / DÉBITO + ESCOLHA DE PARCELAS */}
                  {(paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT_CARD') && (
                    <form
                      onSubmit={handleConfirmCardPaymentAndActivate}
                      className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-5 h-5 text-emerald-700" />
                          <h4 className="font-black text-base text-slate-900">
                            Dados do{' '}
                            {paymentMethod === 'DEBIT_CARD'
                              ? createdSub.billingCycle === 'ANNUAL'
                                ? 'Cartão de Débito (Valor Integral Anual à Vista)'
                                : 'Cartão de Débito (Recorrência Mensal)'
                              : 'Cartão de Crédito'}{' '}
                            para Ativar a Assinatura
                          </h4>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-900 font-bold">
                          Ambiente Criptografado • Ativação Imediata
                        </Badge>
                      </div>

                      {/* Seletor de Parcelas (Em quantas vezes deseja parcelar + Valor das parcelas) */}
                      <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 space-y-2">
                        <Label className="text-xs font-black uppercase text-emerald-950 block">
                          Em quantas vezes deseja parcelar?
                        </Label>
                        {createdSub.billingCycle === 'ANNUAL' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                            <div className="sm:col-span-7">
                              <select
                                value={installments}
                                onChange={(e) => setInstallments(Number(e.target.value))}
                                className="w-full h-11 rounded-xl border border-emerald-400 px-3 text-sm font-black text-slate-900 bg-white"
                              >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                                  const val = Number(
                                    (createdSub.totalContractValue / n).toFixed(2)
                                  );
                                  return (
                                    <option key={n} value={n}>
                                      {n}x de {formatCurrency(val)} sem juros (Total Anual:{' '}
                                      {formatCurrency(createdSub.totalContractValue)})
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            <div className="sm:col-span-5 text-right">
                              <span className="text-[11px] uppercase font-bold text-emerald-800 block">
                                Valor de cada parcela:
                              </span>
                              <span className="text-xl font-black text-emerald-950">
                                {installments}x de{' '}
                                {formatCurrency(
                                  Number(
                                    (createdSub.totalContractValue / installments).toFixed(2)
                                  )
                                )}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-800">
                              12 cobranças mensais recorrentes no{' '}
                              {paymentMethod === 'DEBIT_CARD'
                                ? 'Cartão de Débito'
                                : 'Cartão de Crédito'}
                            </span>
                            <span className="text-lg font-black text-emerald-900">
                              {formatCurrency(createdSub.monthlyEquivalent)}/mês
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Campos do Cartão */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                        <div className="sm:col-span-6 space-y-1">
                          <Label className="text-xs font-bold text-slate-700">
                            Nome impresso no cartão *
                          </Label>
                          <Input
                            value={cardHolderName}
                            onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
                            placeholder="COMO ESTÁ NO CARTÃO"
                            className="h-11 font-bold uppercase"
                            required
                          />
                        </div>

                        <div className="sm:col-span-6 space-y-1">
                          <Label className="text-xs font-bold text-slate-700">
                            Número do Cartão *
                          </Label>
                          <Input
                            value={cardNumber}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
                              const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
                              setCardNumber(formatted);
                            }}
                            placeholder="0000 0000 0000 0000"
                            className="h-11 font-mono text-base font-bold tracking-wider"
                            required
                          />
                        </div>

                        <div className="sm:col-span-3 space-y-1">
                          <Label className="text-xs font-bold text-slate-700">
                            Validade (MM/AA) *
                          </Label>
                          <Input
                            value={cardExpiry}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                              const formatted =
                                digits.length > 2
                                  ? `${digits.slice(0, 2)}/${digits.slice(2)}`
                                  : digits;
                              setCardExpiry(formatted);
                            }}
                            placeholder="MM/AA"
                            className="h-11 font-mono font-bold text-center"
                            required
                          />
                        </div>

                        <div className="sm:col-span-3 space-y-1">
                          <Label className="text-xs font-bold text-slate-700">
                            Código CVV *
                          </Label>
                          <Input
                            value={cardCvv}
                            onChange={(e) =>
                              setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))
                            }
                            placeholder="123"
                            className="h-11 font-mono font-bold text-center"
                            required
                          />
                        </div>

                        <div className="sm:col-span-6 space-y-1">
                          <Label className="text-xs font-bold text-slate-700">
                            CPF do Titular do Cartão *
                          </Label>
                          <Input
                            value={cardHolderCpf}
                            onChange={(e) => setCardHolderCpf(formatCpf(e.target.value))}
                            placeholder="000.000.000-00"
                            className="h-11 font-mono"
                            required
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <span className="text-xs text-slate-500">
                          Ao confirmar, o pagamento será processado e suas carteirinhas serão{' '}
                          <strong className="text-emerald-700">ATIVADAS e LIBERADAS para edição</strong>{' '}
                          imediatamente.
                        </span>
                        <Button
                          type="submit"
                          disabled={checkingPayment}
                          className="w-full sm:w-auto min-h-[48px] h-auto py-3 px-4 sm:px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm uppercase tracking-wide shadow-lg whitespace-normal text-center leading-snug"
                        >
                          <CreditCard className="w-4 h-4 mr-2 shrink-0 inline" />
                          <span>
                            {checkingPayment
                              ? 'Processando Cartão...'
                              : paymentMethod === 'DEBIT_CARD'
                              ? createdSub.billingCycle === 'ANNUAL'
                                ? `Pagar Valor Integral no Débito (${formatCurrency(createdSub.totalContractValue)}) e Ativar`
                                : `Pagar 1ª Mensalidade no Débito (${formatCurrency(createdSub.monthlyEquivalent)}/mês) e Ativar`
                              : createdSub.billingCycle === 'ANNUAL'
                              ? `Pagar ${installments}x de ${formatCurrency(
                                  Number((createdSub.totalContractValue / installments).toFixed(2))
                                )} e Ativar`
                              : `Cadastrar Cartão (${formatCurrency(
                                  createdSub.monthlyEquivalent
                                )}/mês) e Ativar`}
                          </span>
                        </Button>
                      </div>
                        {createdInvoice?.invoiceUrl && (
                          <div className="text-center pt-1">
                            <a
                              href={createdInvoice.invoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline inline-flex items-center gap-1.5"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Ou pagar diretamente na fatura oficial Asaas (com Débito Bancário / 3DS)
                            </a>
                          </div>
                        )}
                    </form>
                  )}

                  {/* OPÇÃO B: PAGAMENTO VIA PIX QR CODE */}
                  {paymentMethod === 'PIX' && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-4">
                      <h4 className="text-base font-black text-emerald-950">
                        {createdSub.billingCycle === 'ANNUAL'
                          ? `Pagamento PIX Integral (1 Ano): ${formatCurrency(
                              createdSub.totalContractValue
                            )}`
                          : `1ª Mensalidade PIX Recorrente (1/12): ${formatCurrency(
                              createdSub.monthlyEquivalent
                            )}`}
                      </h4>

                      <img
                        src={
                          pixCharge?.pixQrCode
                            ? `data:image/png;base64,${pixCharge.pixQrCode}`
                            : getQrCodeImageUrl(
                                `00020126580014BR.GOV.BCB.PIX0136468911340001405204000053039865406${(createdSub.billingCycle === 'ANNUAL'
                                  ? createdSub.totalContractValue
                                  : createdSub.monthlyEquivalent
                                ).toFixed(2)}5802BR5923BALNEARIO FAMILIA LESSA6009ARIQUEMES62070503***6304`,
                                240
                              )
                        }
                        alt="QR Code PIX"
                        className="w-52 h-52 mx-auto bg-white p-3 rounded-2xl border shadow"
                      />

                      <div className="max-w-md mx-auto flex gap-2">
                        <Input
                          readOnly
                          value={
                            pixCharge?.pixPayload ||
                            `00020126580014BR.GOV.BCB.PIX0136468911340001405204000053039865406${(createdSub.billingCycle === 'ANNUAL'
                              ? createdSub.totalContractValue
                              : createdSub.monthlyEquivalent
                            ).toFixed(2)}5802BR5923BALNEARIO FAMILIA LESSA6009ARIQUEMES`
                          }
                          className="bg-slate-50 font-mono text-xs"
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              pixCharge?.pixPayload || '46.891.134/0001-40'
                            );
                            toast({ title: 'Código PIX Copia e Cola copiado!' });
                          }}
                        >
                          <Copy className="w-4 h-4 mr-1" /> Copiar PIX
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <Button
                          onClick={handleVerifyPaymentNow}
                          disabled={checkingPayment}
                          className="min-h-[48px] h-auto py-3 px-4 sm:px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wide shadow-md whitespace-normal text-center leading-snug text-xs sm:text-sm"
                        >
                          <RefreshCw
                            className={`w-4 h-4 mr-2 shrink-0 ${
                              checkingPayment ? 'animate-spin' : ''
                            }`}
                          />
                          Já realizei o pagamento PIX • Verificar e Ativar Assinatura
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===============================================================
                  ETAPA FINAL: CARTEIRINHAS SEPARADAS (TITULAR vs DEPENDENTES)
                  SÓ LIBERA EDIÇÃO DE FOTO E DOWNLOAD APÓS STATUS === 'ACTIVE'
              =============================================================== */}
              <div className="space-y-6 pt-2">
                <div
                  className={`rounded-2xl p-4 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    createdSub.status === 'ACTIVE'
                      ? 'bg-emerald-50 border-emerald-300'
                      : 'bg-amber-50 border-amber-300'
                  }`}
                >
                  <div>
                    <h3
                      className={`text-base font-black ${
                        createdSub.status === 'ACTIVE'
                          ? 'text-emerald-950'
                          : 'text-amber-950'
                      }`}
                    >
                      {createdSub.status === 'ACTIVE'
                        ? `✅ Plano Ativo! Edição e Download das Carteirinhas Liberados (${createdSub.members.length})`
                        : `🔒 Carteirinhas em Modo de Visualização — Plano Inativo (${createdSub.members.length})`}
                    </h3>
                    <p
                      className={`text-xs ${
                        createdSub.status === 'ACTIVE'
                          ? 'text-emerald-900'
                          : 'text-amber-900'
                      }`}
                    >
                      {createdSub.status === 'ACTIVE'
                        ? 'Agora você pode clicar em "Enviar Foto 3x4" e "Reposicionar Foto" em cada carteirinha abaixo e baixar o arquivo PNG oficial.'
                        : 'A adição/reposicionamento de foto 3x4 e o download das carteirinhas serão liberados automaticamente assim que o pagamento acima for confirmado.'}
                    </p>
                  </div>
                </div>

                {/* 1. CARTEIRINHA DO TITULAR PRINCIPAL */}
                {createdSub.members
                  .filter((m) => m.role === 'TITULAR')
                  .map((holderMember) => (
                    <div key={holderMember.id} className="space-y-3">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                        <Badge className="bg-emerald-800 text-white font-black">
                          TITULAR
                        </Badge>
                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">
                          1. Carteirinha do Titular Responsável ({holderMember.fullName})
                        </h4>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                        <ClubMemberCardView
                          member={holderMember}
                          showBackSide={true}
                          locked={createdSub.status !== 'ACTIVE'}
                          onUpdatePhoto={handleUpdateCardPhotoInStep4}
                        />
                      </div>
                    </div>
                  ))}

                {/* 2. CARTEIRINHAS DOS DEPENDENTES VINCULADOS */}
                {createdSub.members.some((m) => m.role === 'DEPENDENTE') && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                      <Badge className="bg-blue-700 text-white font-black">
                        DEPENDENTES (
                        {
                          createdSub.members.filter((m) => m.role === 'DEPENDENTE')
                            .length
                        }
                        )
                      </Badge>
                      <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">
                        2. Carteirinhas dos Dependentes Vinculados à Assinatura
                      </h4>
                    </div>

                    <div className="space-y-6">
                      {createdSub.members
                        .filter((m) => m.role === 'DEPENDENTE')
                        .map((depMember, depIdx) => (
                          <div
                            key={depMember.id}
                            className="p-4 rounded-2xl bg-slate-50 border border-slate-200"
                          >
                            <ClubMemberCardView
                              member={depMember}
                              dependentIndex={depIdx + 1}
                              showBackSide={true}
                              locked={createdSub.status !== 'ACTIVE'}
                              onUpdatePhoto={handleUpdateCardPhotoInStep4}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function PlanosAdesaoPage() {
  return <PlanosAdesaoSection embedded={false} />;
}
