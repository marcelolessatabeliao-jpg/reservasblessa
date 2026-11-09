import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Users,
  UserPlus,
  CreditCard,
  Receipt,
  FileText,
  Search,
  Printer,
  CheckCircle2,
  Upload,
  Plus,
  Trash2,
  QrCode,
  CheckSquare,
  UserCheck,
  Home,
  Store,
  Briefcase,
  Sparkles,
  DollarSign,
  BarChart3,
  Settings,
  User,
  ChevronDown,
  ChevronRight,
  Download,
  Calendar,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Wallet,
  Paperclip,
  PenTool,
  Link2,
  Lock,
  ClipboardList,
  Copy,
  ExternalLink,
  Wrench,
  X,
  Check,
  Edit3,
  Eye,
  EyeOff,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import logo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  BillingCycle,
  ClubAdditionalService,
  ClubAttachment,
  ClubCashEntry,
  ClubConsultant,
  ClubContractTemplate,
  ClubInvoice,
  ClubMember,
  ClubModality,
  ClubPaymentMethod,
  ClubSubscription,
  ClubVisitRecord,
  ContractTemplateType,
} from '@/lib/club-types';
import {
  ClubDatabaseState,
  fetchClubState,
  saveClubState,
  createClubSubscription,
  markClubInvoicePaid,
  generateAsaasChargeForClubInvoice,
  generateUnifiedPaymentLink,
  getQrCodeImageUrl,
  renderSubscriptionContractHtml,
  findMemberOrSubscriptionByQuery,
  formatCurrency,
  formatDateBR,
  fileToDataUrl,
  isValidCpf,
  isValidCnpj,
  cleanDigits,
  formatCpf,
  formatBirthDate,
  getMemberAccessMessage,
  updateAsaasPaymentDueDate,
  fetchAddressByCep,
} from '@/lib/club-service';
import {
  ClubMemberCardView,
  MultiCardPrintSheet,
} from '@/components/club/ClubMemberCardView';

interface AdminClubEcosystemProps {
  standalone?: boolean;
}

export const AdminClubEcosystem: React.FC<AdminClubEcosystemProps> = ({
  standalone = false,
}) => {
  const { toast } = useToast();
  const [state, setState] = useState<ClubDatabaseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Quick search (Lupa Labcard)
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');

  // Clientes & Empresas filters
  const [subSearch, setSubSearch] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState<string>('ALL');
  const [personFilter, setPersonFilter] = useState<'ALL' | 'PF' | 'PJ'>('ALL');
  const [originFilter, setOriginFilter] = useState<'ALL' | 'SITE' | 'ADMIN'>('ALL');
  const [empresaStatusFilter, setEmpresaStatusFilter] = useState<string>('ALL');
  const [selectedSubForDetail, setSelectedSubForDetail] =
    useState<ClubSubscription | null>(null);

  // Active tool inside existing client record (selectedSubForDetail)
  const [clientDetailTool, setClientDetailTool] = useState<
    | 'DADOS_CADASTRAIS'
    | 'CARTOES'
    | 'CADASTRAR_CARTAO_PAGTO'
    | 'FINANCEIRO_CLIENTE'
    | 'GERAR_CONTRATO'
    | 'ANEXOS'
    | 'ADICIONAR_DEPENDENTES'
    | 'AGENDA_VISITAS'
    | 'SERVICOS_ADICIONAIS'
    | 'LINK_ASSINATURA'
    | 'TERMOS_USO'
    | 'SMS_CLIENTE'
  >('DADOS_CADASTRAIS');

  // Editable form state for existing client registration (DADOS_CADASTRAIS)
  const [editClientData, setEditClientData] = useState({
    holderName: '',
    holderCpf: '',
    holderRg: '',
    holderBirthDate: '',
    holderSex: '',
    holderMaritalStatus: '',
    holderPhone: '',
    holderEmail: '',
    consultantName: '',
    influencerName: '',
    addressCep: '',
    addressStreet: '',
    addressNumber: '',
    addressComplement: '',
    addressNeighborhood: '',
    addressCity: 'Ariquemes',
    addressState: 'RO',
    vehicleModel: '',
    vehiclePlate: '',
    vehicleColor: '',
    notes: '',
    dueDay: 10,
    billingCycle: 'ANNUAL' as BillingCycle,
    monthlyEquivalent: 0,
    planSummaryLabel: '',
  });

  // Perfil Financeiro do Cliente states (matching Labcard Perfil financeiro screenshot)
  const [selectedCarneNumber, setSelectedCarneNumber] = useState('1');
  const [selectedClientInvoiceIdsForDelete, setSelectedClientInvoiceIdsForDelete] =
    useState<string[]>([]);
  const [editingClientInvoiceId, setEditingClientInvoiceId] = useState<
    string | null
  >(null);
  const [editInvDueDate, setEditInvDueDate] = useState('');
  const [editInvAmount, setEditInvAmount] = useState('');
  const [editInvDesc, setEditInvDesc] = useState('');
  const [showFaturaAvulsaForm, setShowFaturaAvulsaForm] = useState(false);
  const [avulsaDesc, setAvulsaDesc] = useState('Mensalidade / Taxa Avulsa');
  const [avulsaAmount, setAvulsaAmount] = useState('49.90');
  const [avulsaDueDate, setAvulsaDueDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );

  // Modal para Visualizar / Gerar Cobrança PIX da Parcela (Botão Azul QR Code da Tabela)
  const [selectedInvoiceForPixModal, setSelectedInvoiceForPixModal] =
    useState<ClubInvoice | null>(null);
  const [loadingRowPix, setLoadingRowPix] = useState(false);

  // Modal para TODOS EM CARTÃO (Link Único de Quitação)
  const [unifiedCardModalOpen, setUnifiedCardModalOpen] = useState(false);
  const [unifiedCardLoading, setUnifiedCardLoading] = useState(false);
  const [unifiedCardUrl, setUnifiedCardUrl] = useState('');

  // Modal para GERAR CARNÊ / + ADD CARNÊ
  const [carneModalOpen, setCarneModalOpen] = useState(false);
  const [carneInstallmentCount, setCarneInstallmentCount] = useState<number>(12);
  const [carneInstallmentValue, setCarneInstallmentValue] = useState<string>('49.90');
  const [carneFirstDueDate, setCarneFirstDueDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [carneDescription, setCarneDescription] = useState('Mensalidade');

  // Estado para exclusão segura de clientes (com confirmação)
  const [clientToDelete, setClientToDelete] = useState<ClubSubscription | null>(null);

  // Dados reais da Empresa Balneário Lessa (Matching Imagem DADOS PESSOAIS)
  const [companyProfile, setCompanyProfile] = useState({
    empresa: 'Balneário Lessa',
    cnpj: '46.891.134/0001-40',
    nomeResponsavel: 'Rosimeire da Silva Lessa',
    cpfResponsavel: '926.810.182-34',
    telefone: '(69) 9 9262-6140',
    celular: '(69) 9 9220-2196',
    email: 'balneario.lessa@gmail.com',
    site: 'balneariolessa.com.br',
    usuario: 'admbalneario',
    senha: '••••••••',
    showSenha: false,
  });

  // States for inside existing client record tools
  const [adminCardType, setAdminCardType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adminCardInstallments, setAdminCardInstallments] = useState<number>(12);
  const [adminCardHolder, setAdminCardHolder] = useState('');
  const [adminCardNumber, setAdminCardNumber] = useState('');
  const [adminCardExpiry, setAdminCardExpiry] = useState('');
  const [adminCardCvv, setAdminCardCvv] = useState('');

  const [newDepName, setNewDepName] = useState('');
  const [newDepCpf, setNewDepCpf] = useState('');
  const [newDepBirth, setNewDepBirth] = useState('');
  const [newDepModality, setNewDepModality] = useState('ADULTO');
  const [newDepPhoto, setNewDepPhoto] = useState('');
  const [newDepExpirationDate, setNewDepExpirationDate] = useState('');
  const [newDepExpirationNotes, setNewDepExpirationNotes] = useState('');
  const [editingDepModalityMemberId, setEditingDepModalityMemberId] = useState<string | null>(null);
  const [targetNewModalityCode, setTargetNewModalityCode] = useState('');

  // Modal de Validação de Carteirinha (QR Code / Portaria) via menu Clientes
  const [isQrValidatorModalOpen, setIsQrValidatorModalOpen] = useState(false);
  const [qrValidatorQuery, setQrValidatorQuery] = useState('');
  const [qrValidatorResult, setQrValidatorResult] = useState<{
    subscription: ClubSubscription;
    member: ClubMember;
  } | null>(null);
  const [qrValidatorSearched, setQrValidatorSearched] = useState(false);

  const [visitDateInput, setVisitDateInput] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [visitMemberCard, setVisitMemberCard] = useState('');
  const [visitNotesInput, setVisitNotesInput] = useState('');
  const [agendaMonth, setAgendaMonth] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );

  const [serviceNameInput, setServiceNameInput] = useState('');
  const [servicePriceInput, setServicePriceInput] = useState('');
  const [serviceNotesInput, setServiceNotesInput] = useState('');
  const [editingExpirationDate, setEditingExpirationDate] = useState(false);

  // Consultores & Influencers state (Screenshot 2 e 4)
  const [consultantRoleFilter, setConsultantRoleFilter] = useState<
    'CONSULTOR' | 'INFLUENCER' | 'TODOS'
  >('TODOS');
  const [consultantStatusFilter, setConsultantStatusFilter] = useState<
    'TODOS' | 'ACTIVE' | 'INACTIVE'
  >('TODOS');
  const [showNewConsultantForm, setShowNewConsultantForm] = useState(false);
  const [newConsName, setNewConsName] = useState('');
  const [newConsCpf, setNewConsCpf] = useState('');
  const [newConsPhone, setNewConsPhone] = useState('');
  const [newConsEmail, setNewConsEmail] = useState('');
  const [newConsCommissionType, setNewConsCommissionType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [newConsCommission, setNewConsCommission] = useState<number>(10);
  const [newConsCommissionRecurring, setNewConsCommissionRecurring] = useState(false);
  const [newConsCommissionFirstOnly, setNewConsCommissionFirstOnly] = useState(true);
  const [newConsMethods, setNewConsMethods] = useState({
    boleto: true,
    pix: true,
    creditCard: true,
    recurrence: true,
  });
  const [newConsCode, setNewConsCode] = useState('');

  // Modal Gerar Link de Indicação (Screenshot 4)
  const [selectedConsultantForLink, setSelectedConsultantForLink] = useState<ClubConsultant | null>(null);
  const [linkPlanSelection, setLinkPlanSelection] = useState<string>('TODOS');
  const [linkAllowedMethods, setLinkAllowedMethods] = useState({
    boleto: true,
    pix: true,
    creditCard: true,
    recurrence: true,
  });

  // Filtros Avançados de Relatórios (Datas, Idades, Planos, Categoria, Status)
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportAgeGroup, setReportAgeGroup] = useState<'TODOS' | 'KIDS' | 'TEENS' | 'ADULTS' | 'SENIORS'>('TODOS');
  const [reportPlanCode, setReportPlanCode] = useState<string>('TODOS');
  const [reportCategory, setReportCategory] = useState<'TODOS' | 'TITULARES' | 'DEPENDENTES'>('TODOS');
  const [reportStatus, setReportStatus] = useState<'TODOS' | 'ACTIVE' | 'INACTIVE' | 'OVERDUE'>('TODOS');

  // Adicionais e Serviços do Balneário
  const [editingCatalogService, setEditingCatalogService] = useState<{
    id: string;
    name: string;
    category: string;
    price: number;
    description: string;
    active: boolean;
  } | null>(null);

  // Finanças sub-views (matching Labcard Finanças dropdown)
  const [financeSubView, setFinanceSubView] = useState<
    | 'FLUXO_CAIXA'
    | 'ENTRADA_CAIXA'
    | 'SAIDA_CAIXA'
    | 'FATURAMENTO_PREVISTO'
    | 'MENSALIDADES'
    | 'VENCIDAS_POR_MES'
    | 'ASSINATURAS_ATIVAS'
    | 'ASSINATURAS_VENCIDAS'
    | 'BAIXAS_EM_LOTE'
  >('MENSALIDADES');
  const [overdueMonthFilter, setOverdueMonthFilter] = useState<string>('ALL');

  // New Cash Entry (Entrada / Saída de Caixa)
  const [cashCategory, setCashCategory] = useState('Recepção / Mensalidade');
  const [cashDescription, setCashDescription] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [cashMethod, setCashMethod] = useState('PIX');
  const [cashDate, setCashDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );

  // Relatórios sub-views (matching Labcard Relatórios dropdown & cascading submenus)
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);
  const [reportSubView, setReportSubView] = useState<
    | 'CLIENTES'
    | 'CONSULTORES'
    | 'INFLUENCER'
    | 'EMPRESAS'
    | 'AGENDA'
    | 'SMS'
    | 'OUTROS'
  >('CLIENTES');
  const [consultantReportSubFilter, setConsultantReportSubFilter] = useState<
    'COMISSAO' | 'LISTA_CADASTRO'
  >('COMISSAO');
  const [influencerReportSubFilter, setInfluencerReportSubFilter] = useState<
    'LISTA_CADASTRO' | 'COMISSAO'
  >('LISTA_CADASTRO');
  const [planosReportFilter, setPlanosReportFilter] = useState<
    'TODOS' | 'CORTESIA'
  >('TODOS');
  const [clientReportSubFilter, setClientReportSubFilter] = useState<
    | 'LISTAGEM'
    | 'PERIODO_ATIVOS'
    | 'POR_CIDADES'
    | 'CONTRATO_RECEBIDO'
    | 'CONTRATOS_GERADOS'
    | 'FAIXA_ETARIA'
    | 'ADICIONAIS'
    | 'ADIMPLENTES'
    | 'INADIMPLENTES'
    | 'A_RENOVAR'
  >('LISTAGEM');
  const [otherReportSubFilter, setOtherReportSubFilter] = useState<
    | 'PLANOS'
    | 'CARNES_ACABANDO'
    | 'SEM_FINANCEIRO'
    | 'CARTAO_EMISSAO'
    | 'CARTAO_VENCIMENTO'
    | 'LOGS'
  >('PLANOS');
  const [configSection, setConfigSection] = useState<
    | 'CONFIG_CARTAO'
    | 'PLANOS'
    | 'ADICIONAIS'
    | 'TERMO_USO_SITE'
    | 'CONTRATOS'
    | 'FORMAS_PG'
    | 'CATEGORIAS'
    | 'ESPECIALIDADES'
    | 'SERVICOS'
    | 'PROFISSIONAIS'
    | 'EXCLUIR_CLIENTES'
  >('PLANOS');
  const [perfilSection, setPerfilSection] = useState<
    | 'MEUS_DADOS'
    | 'ACESSOS'
    | 'MEU_PLANO'
    | 'MINHAS_FATURAS'
    | 'ALTERAR_COR'
  >('MEUS_DADOS');
  const [navThemeColor, setNavThemeColor] = useState<string>('#004d00');
  const [siteTermsText, setSiteTermsText] = useState<string>(
    'TERMO DE USO E ADESÃO ONLINE — BALNEÁRIO E RESERVA LESSA CLUB\n1. Ao aderir aos planos pelo portal oficial, o titular declara estar ciente das regras de uso do Balneário Lessa.\n2. O cartão de sócio ficará ativo imediatamente após a confirmação do pagamento (PIX ou Cartão).'
  );
  const [smsTemplate, setSmsTemplate] = useState(
    'Olá {NOME}, sua carteirinha Lessa Club (#{CARTAO}) está com mensalidade em aberto. Regularize pelo Portal do Sócio!'
  );

  // Multi-card print selection
  const [selectedMemberIdsForPrint, setSelectedMemberIdsForPrint] = useState<
    string[]
  >([]);

  // Financial filters & batch selection
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('ALL');
  const [selectedInvoiceKeys, setSelectedInvoiceKeys] = useState<string[]>([]);

  // Manual Registration Modal & Tab (PF / PJ + Custom Family - Replicating Labcard Layout)
  const [newSubModalOpen, setNewSubModalOpen] = useState(false);
  const [personType, setPersonType] = useState<'PF' | 'PJ'>('PF');
  const [cycle, setCycle] = useState<BillingCycle>('ANNUAL');
  const [paymentMethod, setPaymentMethod] =
    useState<ClubPaymentMethod>('LOCAL');
  const [activateImmediately, setActivateImmediately] = useState(false);
  const [holderName, setHolderName] = useState('');
  const [holderCpfCnpj, setHolderCpfCnpj] = useState('');
  const [holderRg, setHolderRg] = useState('');
  const [holderBirthDate, setHolderBirthDate] = useState('');
  const [holderSex, setHolderSex] = useState('');
  const [holderMaritalStatus, setHolderMaritalStatus] = useState('');
  const [holderDdd, setHolderDdd] = useState('69');
  const [holderPhone, setHolderPhone] = useState('');
  const [holderEmail, setHolderEmail] = useState('');
  const [consultantName, setConsultantName] = useState('');
  const [holderCardCustom, setHolderCardCustom] = useState('CARTÃO PADRÃO DESSE CLIENTE');
  const [holderPhotoUrl, setHolderPhotoUrl] = useState('');
  const [holderModalityCode, setHolderModalityCode] = useState('ADULTO');
  const [notes, setNotes] = useState('');
  const [showNotesAccordion, setShowNotesAccordion] = useState(false);
  const [zipCode, setZipCode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('Ariquemes');
  const [uf, setUf] = useState('RO');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [manualDependents, setManualDependents] = useState<
    Array<{
      fullName: string;
      cpf: string;
      birthDate: string;
      modalityCode: string;
      photoUrl?: string;
    }>
  >([]);

  // Funcionários da Empresa para Convênio Corporativo (PJ) - Lessa Parceiro R$ 25,00/cada
  const [companyEmployees, setCompanyEmployees] = useState<
    Array<{
      id: string;
      fullName: string;
      cpf: string;
      phone: string;
    }>
  >([]);

  // Situação (Liberar / Inativar / Status) para cadastro já existente
  const [situacaoLiberar, setSituacaoLiberar] = useState<'SIM' | 'NAO'>('SIM');
  const [situacaoInativar, setSituacaoInativar] = useState<'NAO' | 'SIM'>('NAO');

  // Editing Modality or Contract
  const [editingModality, setEditingModality] =
    useState<ClubModality | null>(null);
  const [editingContract, setEditingContract] =
    useState<ClubContractTemplate | null>(null);

  useEffect(() => {
    fetchClubState().then((loaded) => {
      setState(loaded);
      setLoading(false);
    });
  }, []);

  const persist = async (next: ClubDatabaseState) => {
    const saved = await saveClubState(next);
    setState(saved);
  };

  const handleExecuteQrSearch = (customQuery?: string) => {
    const q = (customQuery !== undefined ? customQuery : qrValidatorQuery).trim();
    if (!state || !q) return;
    const matches = findMemberOrSubscriptionByQuery(state, q);
    if (matches.length > 0) {
      setQrValidatorResult(matches[0]);
    } else {
      setQrValidatorResult(null);
    }
    setQrValidatorSearched(true);
  };

  const handleRegisterQrCheckin = async (sub: ClubSubscription, member: ClubMember) => {
    if (!state) return;
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toTimeString().slice(0, 5);
    const existingVisits = sub.visits || [];

    const newVisit: ClubVisitRecord = {
      id: `vis_${Date.now()}`,
      date: today,
      time: nowTime,
      memberName: member.fullName,
      cardNumber: member.cardNumber,
      source: 'QR_SCAN',
      notes: 'Entrada autorizada na Portaria / Recepção Balneário Lessa',
    };
    const updatedSub: ClubSubscription = {
      ...sub,
      visits: [newVisit, ...existingVisits],
    };
    const nextState: ClubDatabaseState = {
      ...state,
      subscriptions: state.subscriptions.map((s) =>
        s.id === updatedSub.id ? updatedSub : s
      ),
    };
    await persist(nextState);
    setQrValidatorResult({ subscription: updatedSub, member });
    toast({
      title: 'Entrada Confirmada com Sucesso!',
      description: `${member.fullName} — Check-in registrado em ${formatDateBR(today)} às ${nowTime}.`,
    });
  };

  // Computed metrics (matching Labcard Dashboard)
  const metrics = useMemo(() => {
    if (!state) {
      return {
        holdersActive: 0,
        holdersInactive: 0,
        dependentsActive: 0,
        dependentsInactive: 0,
        invoicesPaid: 0,
        invoicesPending: 0,
        invoicesOverdue: 0,
        totalPaidAmount: 0,
        totalPendingAmount: 0,
      };
    }

    let holdersActive = 0;
    let holdersInactive = 0;
    let dependentsActive = 0;
    let dependentsInactive = 0;
    let invoicesPaid = 0;
    let invoicesPending = 0;
    let invoicesOverdue = 0;
    let totalPaidAmount = 0;
    let totalPendingAmount = 0;

    for (const sub of (state?.subscriptions || [])) {
      const isSubActive = sub.status === 'ACTIVE';
      if (isSubActive) holdersActive++;
      else holdersInactive++;

      for (const m of (sub.members || [])) {
        if (m.role === 'DEPENDENTE') {
          if (m.status === 'ACTIVE' && isSubActive) dependentsActive++;
          else dependentsInactive++;
        }
      }

      for (const inv of (sub.invoices || [])) {
        if (inv.status === 'PAID') {
          invoicesPaid++;
          totalPaidAmount += inv.amount;
        } else if (inv.status === 'OVERDUE') {
          invoicesOverdue++;
          totalPendingAmount += inv.amount;
        } else if (inv.status === 'PENDING') {
          invoicesPending++;
          totalPendingAmount += inv.amount;
        }
      }
    }

    return {
      holdersActive,
      holdersInactive,
      dependentsActive,
      dependentsInactive,
      invoicesPaid,
      invoicesPending,
      invoicesOverdue,
      totalPaidAmount,
      totalPendingAmount,
    };
  }, [state]);

  // All members flattened for Multi-Card Print Sheet
  const allMembers = useMemo(() => {
    if (!state) return [];
    const list: ClubMember[] = [];
    for (const sub of (state.subscriptions || [])) {
      for (const member of (sub.members || [])) {
        list.push(member);
      }
    }
    return list;
  }, [state]);

  // All invoices flattened for Financial tab
  const allInvoicesWithSub = useMemo(() => {
    if (!state) return [];
    const list: Array<{
      invoice: ClubInvoice;
      subscription: ClubSubscription;
    }> = [];
    for (const sub of (state.subscriptions || [])) {
      for (const invoice of (sub.invoices || [])) {
        list.push({ invoice, subscription: sub });
      }
    }
    return list;
  }, [state]);

  // Filtered subscriptions (supports Clientes PF, Empresas PJ, Status, Via Site)
  const filteredSubscriptions = useMemo(() => {
    if (!state) return [];
    return (state.subscriptions || []).filter((sub) => {
      if (personFilter !== 'ALL' && sub.personType !== personFilter) {
        return false;
      }
      if (originFilter !== 'ALL' && sub.origin !== originFilter) {
        return false;
      }
      if (subStatusFilter !== 'ALL' && sub.status !== subStatusFilter) {
        return false;
      }
      if (!subSearch.trim()) return true;
      const q = subSearch.toLowerCase();
      const digits = q.replace(/\D/g, '');
      return (
        (sub.holderName || '').toLowerCase().includes(q) ||
        (digits && (sub.holderCpf || '').replace(/\D/g, '').includes(digits)) ||
        (sub.members || []).some(
          (m) =>
            (m.fullName || '').toLowerCase().includes(q) ||
            (m.cardNumber || '').includes(q) ||
            (digits && (m.cpf || '').replace(/\D/g, '').includes(digits))
        )
      );
    });
  }, [state, subSearch, subStatusFilter, personFilter, originFilter]);

  // Fluxo de Caixa consolidado (Faturas Pagas + Lançamentos Manuais Entrada/Saída)
  const cashFlowSummary = useMemo(() => {
    const entries: ClubCashEntry[] = [...(state?.cashEntries || [])];
    if (state) {
      for (const sub of (state.subscriptions || [])) {
        for (const inv of (sub.invoices || [])) {
          if (inv.status === 'PAID' && inv.amount > 0) {
            entries.push({
              id: `inv_${inv.id}`,
              type: 'IN',
              category: 'Mensalidade / Assinatura',
              description: `${sub.holderName} - ${inv.description || inv.referenceMonth}`,
              amount: inv.amount,
              paymentMethod: inv.paymentMethod,
              date: (inv.paidAt || inv.dueDate || new Date().toISOString()).split('T')[0],
              createdAt: inv.paidAt || inv.createdAt || new Date().toISOString(),
            });
          }
        }
      }
    }
    entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const totalIn = entries
      .filter((e) => e.type === 'IN')
      .reduce((acc, e) => acc + e.amount, 0);
    const totalOut = entries
      .filter((e) => e.type === 'OUT')
      .reduce((acc, e) => acc + e.amount, 0);

    return {
      entries,
      totalIn: Number(totalIn.toFixed(2)),
      totalOut: Number(totalOut.toFixed(2)),
      balance: Number((totalIn - totalOut).toFixed(2)),
    };
  }, [state]);

  const handleAddCashEntry = async (type: 'IN' | 'OUT') => {
    if (!state) return;
    const val = Number(cashAmount.replace(',', '.'));
    if (!cashDescription.trim() || !val || val <= 0) {
      toast({
        title: 'Preencha a descrição e o valor',
        description: 'Informe uma descrição e um valor maior que zero.',
        variant: 'destructive',
      });
      return;
    }
    const newEntry: ClubCashEntry = {
      id: `cash_${Date.now()}`,
      type,
      category:
        cashCategory ||
        (type === 'IN' ? 'Entrada Recepção' : 'Despesa Operacional'),
      description: cashDescription.trim(),
      amount: val,
      paymentMethod: cashMethod,
      date: cashDate || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };
    const nextState: ClubDatabaseState = {
      ...state,
      cashEntries: [newEntry, ...(state.cashEntries || [])],
    };
    await persist(nextState);
    setCashDescription('');
    setCashAmount('');
    toast({
      title:
        type === 'IN'
          ? 'Entrada de Caixa registrada!'
          : 'Saída de Caixa registrada!',
      description: `${newEntry.description} — ${formatCurrency(newEntry.amount)}`,
    });
  };

  const handleCreateConsultant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state || !newConsName.trim()) return;
    const assignedRole = consultantRoleFilter === 'INFLUENCER' ? 'INFLUENCER' : 'CONSULTOR';
    const newCons: ClubConsultant = {
      id: `cons_${Date.now()}`,
      name: newConsName.trim(),
      cpf: newConsCpf.trim() || '000.000.000-00',
      phone: newConsPhone.trim(),
      email: newConsEmail.trim(),
      role: assignedRole,
      commissionType: newConsCommissionType,
      commissionValue: Number(newConsCommission) || 10,
      commissionPercent: newConsCommissionType === 'PERCENT' ? (Number(newConsCommission) || 10) : 10,
      commissionRecurring: newConsCommissionRecurring,
      commissionFirstOnly: newConsCommissionFirstOnly,
      paymentMethodsAllowed: { ...newConsMethods },
      referralCode:
        newConsCode.trim().toUpperCase() ||
        newConsName
          .trim()
          .split(' ')[0]
          .toUpperCase() + Math.floor(10 + Math.random() * 89),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    await persist({
      ...state,
      consultants: [newCons, ...state.consultants],
    });
    setNewConsName('');
    setNewConsCpf('');
    setNewConsPhone('');
    setNewConsEmail('');
    setNewConsCode('');
    setShowNewConsultantForm(false);
    toast({
      title: `${assignedRole === 'INFLUENCER' ? 'Influencer' : 'Consultor'} cadastrado com sucesso!`,
      description: `Código de Indicação: ${newCons.referralCode} (${newConsCommissionType === 'FIXED' ? `R$ ${newConsCommission},00 fixo` : `${newConsCommission}%`})`,
    });
  };

  const handleToggleConsultantStatus = async (consultantId: string) => {
    if (!state) return;
    const updated = (state.consultants || []).map((c) =>
      c.id === consultantId
        ? { ...c, status: (c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE' }
        : c
    );
    await persist({ ...state, consultants: updated });
    toast({
      title: 'Status atualizado',
      description: 'O status do consultor/influencer foi alterado.',
    });
  };

  const handleDeleteConsultant = async (consultantId: string, consultantName: string) => {
    if (!state) return;
    if (!confirm(`Deseja realmente excluir o consultor/influencer "${consultantName}"?`)) return;
    const updated = (state.consultants || []).filter((c) => c.id !== consultantId);
    await persist({ ...state, consultants: updated });
    toast({
      title: 'Consultor removido',
      description: `O consultor "${consultantName}" foi excluído.`,
    });
  };

  const getAgeFromBirthDate = (birthDateStr?: string): number => {
    if (!birthDateStr) return -1;
    const parts = birthDateStr.split('-');
    if (parts.length < 3) return -1;
    const birth = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getFilteredReportSubscriptions = () => {
    if (!state) return [];
    return (state.subscriptions || []).filter((sub) => {
      // 1. Período
      if (reportStartDate && sub.startDate < reportStartDate) return false;
      if (reportEndDate && sub.startDate > reportEndDate) return false;

      // 2. Status
      if (reportStatus === 'ACTIVE' && sub.status !== 'ACTIVE') return false;
      if (reportStatus === 'INACTIVE' && sub.status === 'ACTIVE') return false;
      if (reportStatus === 'OVERDUE' && sub.status !== 'OVERDUE') return false;

      // 3. Plano
      if (reportPlanCode !== 'TODOS') {
        const hasPlan = sub.members.some((m) => m.modalityCode === reportPlanCode);
        if (!hasPlan) return false;
      }

      // 4. Faixa Etária
      if (reportAgeGroup !== 'TODOS') {
        const matchesAge = sub.members.some((m) => {
          const age = getAgeFromBirthDate(m.birthDate);
          if (age < 0) return false;
          if (reportAgeGroup === 'KIDS') return age <= 12;
          if (reportAgeGroup === 'TEENS') return age >= 13 && age <= 17;
          if (reportAgeGroup === 'ADULTS') return age >= 18 && age <= 59;
          if (reportAgeGroup === 'SENIORS') return age >= 60;
          return true;
        });
        if (!matchesAge) return false;
      }

      return true;
    });
  };

  const handleExportReportXlsx = (reportType: string) => {
    if (!state) return;
    let rows: Record<string, any>[] = [];
    if (reportType === 'CLIENTES' || reportType === 'EMPRESAS') {
      const baseFiltered = getFilteredReportSubscriptions();
      const targetSubs = baseFiltered.filter((s) =>
        reportType === 'EMPRESAS' ? s.personType === 'PJ' : s.personType === 'PF'
      );
      rows = targetSubs.map((s) => ({
        Cartao: s.subscriptionCode,
        Titular: s.holderName,
        CPF_CNPJ: s.holderCpf,
        Telefone: s.holderPhone,
        Email: s.holderEmail || '',
        Plano: s.planSummaryLabel,
        Ciclo: s.billingCycle === 'ANNUAL' ? 'Anual' : 'Mensal',
        Mensalidade: s.monthlyEquivalent,
        Status: s.status,
        Origem: s.origin,
        Consultor: s.consultantName || '',
        Integrantes: s.members.length,
        Cidade: s.addressCity,
        DataAdesao: formatDateBR(s.startDate),
      }));
    } else if (reportType === 'CONSULTORES' || reportType === 'INFLUENCER') {
      const role = reportType === 'INFLUENCER' ? 'INFLUENCER' : 'CONSULTOR';
      rows = state.consultants
        .filter((c) => c.role === role)
        .map((c) => ({
          Nome: c.name,
          Funcao: c.role,
          CPF: c.cpf,
          Telefone: c.phone,
          Codigo: c.referralCode,
          Comissao_Pct: c.commissionPercent,
          Status: c.status,
        }));
    } else {
      rows = cashFlowSummary.entries.map((e) => ({
        Data: formatDateBR(e.date),
        Tipo: e.type === 'IN' ? 'ENTRADA' : 'SAIDA',
        Categoria: e.category,
        Descricao: e.description,
        Valor: e.amount,
        Forma_Pagto: e.paymentMethod,
      }));
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Relatorio_${reportType}`);
    XLSX.writeFile(wb, `Relatorio_Lessa_Club_${reportType}.xlsx`);
  };

  // Quick search results
  const quickSearchResults = useMemo(() => {
    if (!state || !quickQuery.trim()) return [];
    return findMemberOrSubscriptionByQuery(state, quickQuery);
  }, [state, quickQuery]);

  // Calculate preview monthly total in Manual Registration Modal
  const calculatedManualMonthly = useMemo(() => {
    if (!state) return 0;
    const holderMod = (state.modalities || []).find((m) => m.code === holderModalityCode);
    let sum = holderMod
      ? cycle === 'ANNUAL'
        ? holderMod.annualInstallment
        : holderMod.monthlyPrice
      : 0;
    for (const dep of manualDependents) {
      const m = (state.modalities || []).find((mod) => mod.code === dep.modalityCode);
      if (m) {
        sum += cycle === 'ANNUAL' ? m.annualInstallment : m.monthlyPrice;
      }
    }
    return Number(sum.toFixed(2));
  }, [state, holderModalityCode, manualDependents, cycle]);

  useEffect(() => {
    if (selectedSubForDetail) {
      if (selectedSubForDetail.status === 'ACTIVE') {
        setSituacaoLiberar('SIM');
        setSituacaoInativar('NAO');
      } else {
        setSituacaoLiberar('NAO');
        setSituacaoInativar('SIM');
      }
      setEditClientData({
        holderName: selectedSubForDetail.holderName || '',
        holderCpf: selectedSubForDetail.holderCpf || '',
        holderRg: selectedSubForDetail.holderRg || '',
        holderBirthDate: selectedSubForDetail.holderBirthDate || '',
        holderSex: selectedSubForDetail.holderSex || '',
        holderMaritalStatus: selectedSubForDetail.holderMaritalStatus || '',
        holderPhone: selectedSubForDetail.holderPhone || '',
        holderEmail: selectedSubForDetail.holderEmail || '',
        consultantName: selectedSubForDetail.consultantName || '',
        influencerName: selectedSubForDetail.influencerName || '',
        addressCep: selectedSubForDetail.addressCep || '',
        addressStreet: selectedSubForDetail.addressStreet || '',
        addressNumber: selectedSubForDetail.addressNumber || '',
        addressComplement: selectedSubForDetail.addressComplement || '',
        addressNeighborhood: selectedSubForDetail.addressNeighborhood || '',
        addressCity: selectedSubForDetail.addressCity || 'Ariquemes',
        addressState: selectedSubForDetail.addressState || 'RO',
        vehicleModel: selectedSubForDetail.vehicleModel || '',
        vehiclePlate: selectedSubForDetail.vehiclePlate || '',
        vehicleColor: selectedSubForDetail.vehicleColor || '',
        notes: selectedSubForDetail.notes || '',
        dueDay: selectedSubForDetail.dueDay || 10,
        billingCycle: selectedSubForDetail.billingCycle || 'ANNUAL',
        monthlyEquivalent: selectedSubForDetail.monthlyEquivalent || 0,
        planSummaryLabel: selectedSubForDetail.planSummaryLabel || '',
      });
      setSelectedClientInvoiceIdsForDelete([]);
      setEditingClientInvoiceId(null);
      setShowFaturaAvulsaForm(false);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [selectedSubForDetail?.id]);

  useEffect(() => {
    setSelectedSubForDetail(null);
  }, [
    activeTab,
    subStatusFilter,
    personFilter,
    originFilter,
    financeSubView,
    reportSubView,
    configSection,
    perfilSection,
  ]);

  const handleSaveClientRegistrationEdits = async () => {
    if (!state || !selectedSubForDetail) return;

    const rawCpf = editClientData.holderCpf.trim();
    if (rawCpf && selectedSubForDetail.personType === 'PF' && !isValidCpf(rawCpf)) {
      toast({
        title: 'CPF do Titular Inválido',
        description: 'Por favor, informe um CPF válido com 11 dígitos para o titular.',
        variant: 'destructive',
      });
      return;
    }
    if (rawCpf && selectedSubForDetail.personType === 'PJ' && !isValidCnpj(rawCpf)) {
      toast({
        title: 'CNPJ da Empresa Inválido',
        description: 'Por favor, informe um CNPJ válido com 14 dígitos para a empresa.',
        variant: 'destructive',
      });
      return;
    }

    const targetStatus: ClubSubscription['status'] =
      situacaoLiberar === 'SIM' && situacaoInativar === 'NAO'
        ? 'ACTIVE'
        : 'INACTIVE';
    const monthlyVal =
      Number(editClientData.monthlyEquivalent) ||
      selectedSubForDetail.monthlyEquivalent;
    const updatedSub: ClubSubscription = {
      ...selectedSubForDetail,
      status: targetStatus,
      holderName: editClientData.holderName.trim() || selectedSubForDetail.holderName,
      holderCpf: editClientData.holderCpf.trim() || selectedSubForDetail.holderCpf,
      holderRg: editClientData.holderRg.trim(),
      holderBirthDate: editClientData.holderBirthDate,
      holderSex: editClientData.holderSex,
      holderMaritalStatus: editClientData.holderMaritalStatus,
      holderPhone: editClientData.holderPhone.trim(),
      holderEmail: editClientData.holderEmail.trim(),
      consultantName: editClientData.consultantName.trim(),
      influencerName: editClientData.influencerName.trim(),
      addressCep: editClientData.addressCep.trim(),
      addressStreet: editClientData.addressStreet.trim(),
      addressNumber: editClientData.addressNumber.trim(),
      addressComplement: editClientData.addressComplement.trim(),
      addressNeighborhood: editClientData.addressNeighborhood.trim(),
      addressCity: editClientData.addressCity.trim() || 'Ariquemes',
      addressState: editClientData.addressState.trim() || 'RO',
      vehicleModel: editClientData.vehicleModel.trim(),
      vehiclePlate: editClientData.vehiclePlate.trim().toUpperCase(),
      vehicleColor: editClientData.vehicleColor.trim(),
      notes: editClientData.notes.trim(),
      dueDay: Number(editClientData.dueDay) || 10,
      billingCycle: editClientData.billingCycle,
      monthlyEquivalent: monthlyVal,
      totalContractValue:
        editClientData.billingCycle === 'ANNUAL'
          ? Number((monthlyVal * 12).toFixed(2))
          : monthlyVal,
      planSummaryLabel:
        editClientData.planSummaryLabel.trim() ||
        selectedSubForDetail.planSummaryLabel,
      members: selectedSubForDetail.members.map((m) =>
        m.role === 'TITULAR'
          ? {
              ...m,
              fullName:
                editClientData.holderName.trim() || m.fullName,
              cpf: editClientData.holderCpf.trim() || m.cpf,
              rg: editClientData.holderRg.trim() || m.rg,
              birthDate: editClientData.holderBirthDate || m.birthDate,
              sex: editClientData.holderSex || m.sex,
              phone: editClientData.holderPhone.trim() || m.phone,
              status: targetStatus,
            }
          : {
              ...m,
              status: targetStatus,
            }
      ),
      updatedAt: new Date().toISOString(),
    };
    const nextState: ClubDatabaseState = {
      ...state,
      subscriptions: (state.subscriptions || []).map((s) =>
        s.id === updatedSub.id ? updatedSub : s
      ),
    };
    setSelectedSubForDetail(updatedSub);
    await persist(nextState);
    toast({
      title: 'Cadastro do cliente atualizado com sucesso!',
      description: `${updatedSub.holderName} (#${updatedSub.subscriptionCode}) — Status: ${
        targetStatus === 'ACTIVE' ? 'ATIVO (LIBERADO)' : 'INATIVO'
      }`,
    });
  };

  const handleGenerateNewCarneForClient = async (
    sub: ClubSubscription,
    count = 12,
    customValue?: number,
    firstDueDateStr?: string,
    desc = 'Mensalidade',
    mode: 'append' | 'replace' = 'append'
  ) => {
    if (!state) return;
    const baseDate = firstDueDateStr
      ? new Date(`${firstDueDateStr}T12:00:00`)
      : new Date();
    const monthlyVal =
      customValue !== undefined ? customValue : sub.monthlyEquivalent || 49.9;
    const startIndex = mode === 'append' ? sub.invoices.length : 0;
    const totalInst = mode === 'append' ? startIndex + count : count;

    const newInvoices: ClubInvoice[] = Array.from({ length: count }, (_, idx) => {
      const due = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth() + idx,
        sub.dueDay || baseDate.getDate()
      );
      const yyyy = due.getFullYear();
      const mm = String(due.getMonth() + 1).padStart(2, '0');
      const dd = String(due.getDate()).padStart(2, '0');
      const installmentNum = startIndex + idx + 1;
      return {
        id: `inv_${Date.now()}_${installmentNum}`,
        subscriptionId: sub.id,
        subscriptionCode: sub.subscriptionCode,
        holderName: sub.holderName,
        holderCpf: sub.holderCpf,
        holderPhone: sub.holderPhone,
        installmentNumber: installmentNum,
        totalInstallments: totalInst,
        referenceMonth: `${mm}/${yyyy}`,
        amount: monthlyVal,
        dueDate: `${yyyy}-${mm}-${dd}`,
        paymentMethod: sub.paymentMethod,
        status: 'PENDING',
        description: desc,
        createdAt: new Date().toISOString(),
      };
    });

    const finalInvoices =
      mode === 'append' ? [...sub.invoices, ...newInvoices] : newInvoices;
    const updatedSub: ClubSubscription = {
      ...sub,
      invoices: finalInvoices,
    };
    const nextState: ClubDatabaseState = {
      ...state,
      subscriptions: (state.subscriptions || []).map((s) =>
        s.id === updatedSub.id ? updatedSub : s
      ),
    };
    setSelectedSubForDetail(updatedSub);
    await persist(nextState);
    toast({
      title: 'Carnê gerado com sucesso!',
      description: `${count} parcelas de ${formatCurrency(monthlyVal)} para ${sub.holderName}.`,
    });
    return updatedSub;
  };

  const handlePrintInstallmentReceipt = (
    sub: ClubSubscription,
    inv: ClubInvoice
  ) => {
    const win = window.open('', '_blank', 'width=850,height=700');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Recibo Parcela ${inv.installmentNumber}/${inv.totalInstallments} - ${sub.holderName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #1e293b; }
            .box { border: 2px solid #004d00; border-radius: 12px; padding: 24px; max-width: 700px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #004d00; padding-bottom: 12px; margin-bottom: 16px; }
            .title { font-size: 18px; font-weight: 900; color: #004d00; }
            .row { margin: 8px 0; font-size: 14px; }
            .sig { margin-top: 48px; border-top: 1px solid #334155; width: 280px; text-align: center; padding-top: 6px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="header">
              <div>
                <div class="title">BALNEÁRIO LESSA</div>
                <div style="font-size:12px;color:#475569;">CNPJ: 46.891.134/0001-40 • Linha C-65, KM 07, Zona Rural, Ariquemes/RO</div>
                <div style="font-size:12px;font-weight:bold;margin-top:2px;">Recibo Oficial de Mensalidade / Parcela</div>
              </div>
              <div style="text-align:right;font-weight:bold;">
                Parcela ${inv.installmentNumber} / ${inv.totalInstallments}<br/>
                Valor: ${formatCurrency(inv.amount)}
              </div>
            </div>
            <div class="row"><strong>Associado Titular:</strong> ${sub.holderName} (Cartão Nº ${sub.subscriptionCode})</div>
            <div class="row"><strong>CPF/CNPJ:</strong> ${sub.holderCpf} • <strong>Telefone:</strong> ${sub.holderPhone || '—'}</div>
            <div class="row"><strong>Descrição:</strong> ${inv.description || 'Mensalidade'} (${sub.planSummaryLabel})</div>
            <div class="row"><strong>Vencimento:</strong> ${formatDateBR(inv.dueDate)} • <strong>Recebimento:</strong> ${inv.paidAt ? formatDateBR(inv.paidAt) : '__/__/____'}</div>
            <div class="row"><strong>Status:</strong> ${inv.status === 'PAID' ? 'PAGO (QUITADO)' : 'EM ABERTO'}</div>
            <div class="row"><strong>Chave PIX Oficial:</strong> 46.891.134/0001-40 (Balneário Lessa)</div>
            <div class="sig">Assinatura / Carimbo Balneário Lessa</div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handlePrintCarneSimples = (sub: ClubSubscription) => {
    const win = window.open('', '_blank', 'width=960,height=850');
    if (!win) return;
    const slipsHtml = sub.invoices
      .map(
        (inv) => `
        <div class="slip">
          <div class="left">
            <div class="brand">BALNEÁRIO LESSA — VIA DO CLIENTE</div>
            <div><strong>Titular:</strong> ${sub.holderName}</div>
            <div><strong>Nº Cartão:</strong> ${sub.subscriptionCode}</div>
            <div><strong>Parcela:</strong> ${inv.installmentNumber} / ${inv.totalInstallments}</div>
            <div><strong>Vencimento:</strong> ${formatDateBR(inv.dueDate)}</div>
            <div><strong>Valor:</strong> ${formatCurrency(inv.amount)}</div>
            <div><strong>Chave PIX:</strong> 46.891.134/0001-40</div>
            <div><strong>Status:</strong> ${inv.status === 'PAID' ? 'PAGO em ' + formatDateBR(inv.paidAt || inv.dueDate) : 'EM ABERTO'}</div>
          </div>
          <div class="right">
            <div class="brand">BALNEÁRIO LESSA — CARNÊ DE MENSALIDADES (VIA DO CAIXA)</div>
            <div style="font-size:10px;color:#475569;margin-bottom:3px;">CNPJ: 46.891.134/0001-40 • Linha C-65, KM 07, Zona Rural, Ariquemes/RO</div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;">
              <span><strong>Associado:</strong> ${sub.holderName} (CPF: ${sub.holderCpf})</span>
              <span><strong>Cartão Nº:</strong> ${sub.subscriptionCode}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;">
              <span><strong>Plano/Desc:</strong> ${inv.description || 'Mensalidade'} (${sub.planSummaryLabel})</span>
              <span><strong>Parcela:</strong> ${inv.installmentNumber} / ${inv.totalInstallments}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:6px;padding-top:4px;border-top:1px dashed #94a3b8;">
              <span><strong>Vencimento:</strong> ${formatDateBR(inv.dueDate)}</span>
              <span><strong>Recebimento:</strong> ${inv.paidAt ? formatDateBR(inv.paidAt) : '____/____/________'}</span>
              <span><strong>Valor:</strong> ${formatCurrency(inv.amount)}</span>
            </div>
            <div style="font-size:9px;color:#64748b;margin-top:4px;display:flex;justify-content:space-between;">
              <span>Pague via PIX: Chave CNPJ 46.891.134/0001-40</span>
              <span>Autenticação Mecânica / Assinatura Caixa</span>
            </div>
          </div>
        </div>
      `
      )
      .join('');
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Carnê Simples - ${sub.holderName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; color: #0f172a; }
            .slip { display: grid; grid-template-columns: 32% 68%; border: 1.5px solid #004d00; margin-bottom: 10px; font-size: 11px; page-break-inside: avoid; }
            .left { border-right: 2px dashed #004d00; padding: 8px; background: #f8fafc; }
            .right { padding: 8px 12px; }
            .brand { font-weight: 900; color: #004d00; font-size: 11px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 4px; }
          </style>
        </head>
        <body>
          <h3 style="margin:0 0 12px 0;color:#004d00;">BALNEÁRIO LESSA — CARNÊ SIMPLES DE MENSALIDADES (${sub.holderName} - Cartão Nº ${sub.subscriptionCode})</h3>
          ${slipsHtml}
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const lookupCepAndFill = async (rawCep: string) => {
    const digits = rawCep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    try {
      const data = await fetchAddressByCep(digits);
      if (data) {
        setStreet(data.logradouro || '');
        setNeighborhood(data.bairro || '');
        setCity(data.localidade || 'Ariquemes');
        setUf(data.uf || 'RO');
        toast({
          title: 'Endereço localizado via CEP!',
          description: `${data.logradouro || 'Rua'}, ${data.bairro || 'Bairro'} — ${data.localidade || 'Ariquemes'}/${data.uf || 'RO'}`,
        });
      }
    } catch {}
  };

  const handleAdminCepBlur = async () => {
    await lookupCepAndFill(zipCode);
  };

  // Handle Manual Creation (PF / PJ + Custom Family)
  const handleCreateManualSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state) return;
    if (!holderName.trim() || !holderCpfCnpj.trim()) {
      toast({
        title: 'Dados obrigatórios',
        description: 'Informe o Nome e CPF/CNPJ do titular.',
        variant: 'destructive',
      });
      return;
    }

    if (personType === 'PF') {
      if (!isValidCpf(holderCpfCnpj)) {
        toast({
          title: 'CPF do Titular Inválido',
          description: 'Por favor, informe um CPF válido com 11 dígitos para o titular.',
          variant: 'destructive',
        });
        return;
      }
    } else {
      if (!isValidCnpj(holderCpfCnpj)) {
        toast({
          title: 'CNPJ da Empresa Inválido',
          description: 'Por favor, informe um CNPJ válido com 14 dígitos para a empresa.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (personType === 'PF') {
      const invalidManualDep = manualDependents.find(
        (d) => d.fullName.trim() && d.cpf.trim() && !isValidCpf(d.cpf)
      );
      if (invalidManualDep) {
        toast({
          title: 'CPF do Dependente Inválido',
          description: `O CPF do dependente ${invalidManualDep.fullName} não é válido. Verifique os números digitados.`,
          variant: 'destructive',
        });
        return;
      }
    }

    const isPublicidade =
      holderModalityCode === 'PUBLICIDADE' ||
      manualDependents.some((d) => d.modalityCode === 'PUBLICIDADE');

    const contractType: ContractTemplateType = isPublicidade
      ? 'FAMILY_PUBLICIDADE'
      : 'ADESAO_PF';

    const fullPhone = holderPhone.trim().startsWith('(')
      ? holderPhone.trim()
      : holderDdd.trim()
      ? `(${holderDdd.trim()}) ${holderPhone.trim()}`
      : holderPhone.trim();

    // Quando for PJ, membros são construídos a partir da lista de funcionários (Lessa Parceiro R$ 25/mês cada)
    const members =
      personType === 'PJ'
        ? [
            {
              role: 'TITULAR' as const,
              modalityCode: 'PARCEIRO',
              fullName: holderName.trim(),
              cpf: holderCpfCnpj.trim(),
              rg: holderRg.trim(),
              birthDate: holderBirthDate || '1990-01-01',
              sex: holderSex || 'Outro',
              phone: fullPhone,
              photoUrl: holderPhotoUrl,
            },
            ...companyEmployees
              .filter((emp) => emp.fullName.trim() !== '')
              .map((emp) => ({
                role: 'DEPENDENTE' as const,
                modalityCode: 'PARCEIRO',
                fullName: emp.fullName.trim(),
                cpf: emp.cpf.trim(),
                phone: emp.phone.trim(),
                birthDate: '1995-01-01',
              })),
          ]
        : [
            {
              role: 'TITULAR' as const,
              modalityCode: holderModalityCode,
              fullName: holderName.trim(),
              cpf: holderCpfCnpj.trim(),
              rg: holderRg.trim(),
              birthDate: holderBirthDate,
              sex: holderSex,
              phone: fullPhone,
              photoUrl: holderPhotoUrl,
            },
            ...manualDependents
              .filter((d) => d.fullName.trim() !== '')
              .map((d) => ({
                role: 'DEPENDENTE' as const,
                modalityCode: d.modalityCode,
                fullName: d.fullName.trim(),
                cpf: d.cpf.trim(),
                birthDate: d.birthDate,
                photoUrl: d.photoUrl,
              })),
          ];

    const created = await createClubSubscription({
      personType,
      holderName: holderName.trim(),
      holderCpf: holderCpfCnpj.trim(),
      holderRg: holderRg.trim(),
      holderBirthDate,
      holderSex,
      holderMaritalStatus,
      holderPhone: fullPhone,
      holderEmail: holderEmail.trim(),
      addressCep: zipCode,
      addressStreet: street,
      addressNumber: number,
      addressComplement: complement,
      addressNeighborhood: neighborhood,
      addressCity: city,
      addressState: uf,
      billingCycle: cycle,
      paymentMethod,
      status: activateImmediately ? 'ACTIVE' : 'INACTIVE',
      origin: 'ADMIN',
      consultantName,
      notes,
      contractType,
      vehicleModel,
      vehiclePlate,
      vehicleColor,
      members,
    });

    const refreshed = await fetchClubState();
    setState(refreshed);
    setNewSubModalOpen(false);
    setSelectedSubForDetail(created.subscription);

    // Reset form
    setHolderName('');
    setHolderCpfCnpj('');
    setHolderRg('');
    setHolderBirthDate('');
    setHolderSex('');
    setHolderMaritalStatus('');
    setHolderPhone('');
    setHolderEmail('');
    setHolderPhotoUrl('');
    setNotes('');
    setComplement('');
    setManualDependents([]);

    toast({
      title: 'Associado e Família cadastrados com sucesso!',
      description: `${created.subscription.members.length} carteirinha(s) gerada(s) imediatamente.`,
    });
  };

  // Toggle Subscription Active/Inactive Status
  const handleToggleSubStatus = async (
    sub: ClubSubscription,
    newStatus: ClubSubscription['status']
  ) => {
    if (!state) return;
    const updatedSub: ClubSubscription = {
      ...sub,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      members: sub.members.map((m) => ({
        ...m,
        status: newStatus === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      })),
    };
    const nextState: ClubDatabaseState = {
      ...state,
      subscriptions: (state.subscriptions || []).map((s) =>
        s.id === updatedSub.id ? updatedSub : s
      ),
    };
    await persist(nextState);
    if (selectedSubForDetail?.id === updatedSub.id) {
      setSelectedSubForDetail(updatedSub);
    }
    toast({
      title:
        newStatus === 'ACTIVE'
          ? 'Cadastro LIBERADO • Status: ATIVO!'
          : 'Cadastro INATIVADO • Status: INATIVO!',
      description: `Titular: ${sub.holderName} (Carteirinhas atualizadas)`,
    });
  };

  // Batch settle invoices
  const handleBatchSettleInvoices = async () => {
    if (!state || selectedInvoiceKeys.length === 0) return;
    let latestState = state;
    for (const key of selectedInvoiceKeys) {
      const [subId, invId] = key.split('::');
      if (subId && invId) {
        latestState = await markClubInvoicePaid(subId, invId, 'LOCAL');
      }
    }
    setState(latestState);
    setSelectedInvoiceKeys([]);
    toast({
      title: 'Baixa em lote concluída!',
      description: `${selectedInvoiceKeys.length} fatura(s) marcada(s) como PAGA(S) e carteirinhas liberadas.`,
    });
  };

  // Print Contract
  const handlePrintContract = (sub: ClubSubscription) => {
    if (!state) return;
    const html = renderSubscriptionContractHtml(sub, state.contractTemplates);
    const win = window.open('', '_blank', 'width=900,height=800');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Contrato Lessa Club - ${sub.holderName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
            @media print { .no-print { display: none !important; } }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom:16px; text-align:right;">
            <button onclick="window.print()" style="padding:10px 18px; background:#059669; color:#fff; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">
              Imprimir Contrato Assinado / Salvar PDF
            </button>
          </div>
          ${html}
        </body>
      </html>
    `);
    win.document.close();
  };

  // Import CSV/Excel from Labcard
  const handleImportLabcardSpreadsheet = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !state) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(
        workbook.Sheets[sheetName]
      );

      if (rows.length === 0) {
        toast({
          title: 'Planilha vazia',
          description: 'Nenhuma linha encontrada no arquivo enviado.',
          variant: 'destructive',
        });
        return;
      }

      let importedCount = 0;

      for (const row of rows) {
        const nome =
          row['Nome'] ||
          row['NOME'] ||
          row['Titular'] ||
          row['Cliente'] ||
          row['fullName'] ||
          '';
        if (!nome) continue;

        const cpf = String(
          row['CPF'] || row['cpf'] || row['Documento'] || '000.000.000-00'
        );
        const telefone = String(
          row['Telefone'] || row['Celular'] || row['WhatsApp'] || ''
        );
        const email = String(row['Email'] || row['E-mail'] || '');
        const planoNome = String(
          row['Plano'] || row['Modalidade'] || 'Lessa Club'
        );

        await createClubSubscription({
          personType: 'PF',
          holderName: String(nome).trim(),
          holderCpf: cpf.trim(),
          holderPhone: telefone.trim(),
          holderEmail: email.trim(),
          addressCity: String(row['Cidade'] || 'Ariquemes'),
          addressState: String(row['UF'] || 'RO'),
          billingCycle: planoNome.toLowerCase().includes('anual')
            ? 'ANNUAL'
            : 'MONTHLY',
          paymentMethod: 'LOCAL',
          status: 'ACTIVE',
          origin: 'IMPORT_LABCARD',
          members: [
            {
              role: 'TITULAR',
              modalityCode: 'CLUB_INTEGRAL',
              fullName: String(nome).trim(),
              cpf: cpf.trim(),
              phone: telefone.trim(),
            },
          ],
        });
        importedCount++;
      }

      const refreshed = await fetchClubState();
      setState(refreshed);
      toast({
        title: 'Importação concluída!',
        description: `${importedCount} associado(s) importado(s) do sistema antigo com carteirinhas geradas.`,
      });
    } catch (err) {
      console.error('Erro ao importar planilha:', err);
      toast({
        title: 'Erro ao ler planilha',
        description: 'Certifique-se de enviar um arquivo .xlsx ou .csv válido.',
        variant: 'destructive',
      });
    }
  };

  if (loading || !state) {
    return (
      <div className="p-12 text-center text-slate-500">
        Carregando Ecossistema Lessa Club...
      </div>
    );
  }

  return (
    <div className={standalone ? 'min-h-screen bg-slate-100 p-6' : 'space-y-6'}>
      {/* =====================================================================
          BARRA DE NAVEGAÇÃO SUPERIOR VERDE ESCURA (IDÊNTICA ÀS IMAGENS ENVIADAS)
          Dashboard | Clientes ⌄ | Empresas ⌄ | Consultores ⌄ | Influencer ⌄ |
          Finanças ⌄ | Relatórios ⌄ | Config. ⌄ | Perfil ⌄
      ===================================================================== */}
      <div
        className="text-white rounded-2xl shadow-xl border border-emerald-900 relative z-30 transition-colors"
        style={{ backgroundColor: navThemeColor }}
        onMouseLeave={() => {
          setOpenMenu(null);
          setOpenSubMenu(null);
        }}
      >
        <div className="px-3 sm:px-4 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          {/* Logo Balneário Lessa + Título Mobile */}
          <div className="flex items-center justify-between w-full md:w-auto">
            <div
              onClick={() => {
                setActiveTab('dashboard');
                setOpenMenu(null);
                setOpenSubMenu(null);
              }}
              className="flex items-center gap-2 cursor-pointer py-1"
            >
              <img src={logo} alt="Balneário Lessa" className="h-8 sm:h-11 w-auto" />
              <div className="md:hidden">
                <span className="font-black text-xs block leading-tight text-white tracking-wide">
                  Lessa Club
                </span>
                <span className="text-[9px] text-emerald-200 uppercase font-bold tracking-wider">
                  Painel de Gestão
                </span>
              </div>
            </div>

            {/* Ações Rápidas no Topo Mobile */}
            <div className="md:hidden flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setQuickSearchOpen(true)}
                className="flex items-center gap-1 bg-black/30 hover:bg-black/50 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-xl border border-white/20 transition-all"
                title="Busca Rápida"
              >
                <Search className="w-3.5 h-3.5 text-amber-300" />
                <span>Buscar</span>
              </button>
            </div>
          </div>

          {/* 9 Ícones e Menus: Grid 3x3 no Mobile / Flex no Desktop */}
          <div className="grid grid-cols-3 sm:grid-cols-5 md:flex md:flex-wrap items-center gap-1 sm:gap-2 flex-1 justify-around w-full md:w-auto pt-1 md:pt-0 border-t border-white/10 md:border-none">
            {/* 1. DASHBOARD */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('dashboard');
                  setOpenMenu(null);
                }}
                onMouseEnter={() => {
                  setOpenMenu(null);
                  setOpenSubMenu(null);
                }}
                className={`w-full flex flex-col items-center justify-center px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-colors ${
                  activeTab === 'dashboard'
                    ? 'bg-black/25 text-white'
                    : 'hover:bg-white/10 text-white'
                }`}
              >
                <Home className="w-5 h-5 sm:w-7 sm:h-7 mb-0.5 sm:mb-1 stroke-[2.2]" />
                <span className="text-[10px] sm:text-xs font-bold tracking-tight">Dashboard</span>
              </button>
            </div>

            {/* 2. CLIENTES ⌄ */}
            <div
              className="relative"
              onMouseEnter={() => {
                setOpenMenu('clientes');
                setOpenSubMenu(null);
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'clientes' ? null : 'clientes')
                }
                className={`w-full flex flex-col items-center justify-center px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-colors ${
                  openMenu === 'clientes' ||
                  (activeTab === 'associados' && personFilter !== 'PJ')
                    ? 'bg-black/25 text-white'
                    : 'hover:bg-white/10 text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Users className="w-5 h-5 sm:w-7 sm:h-7 mb-0.5 sm:mb-1 stroke-[2.2]" />
                  <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
                </div>
                <span className="text-[10px] sm:text-xs font-bold tracking-tight">Clientes</span>
              </button>

              {openMenu === 'clientes' && (
                <div
                  className="absolute left-0 top-full mt-0.5 w-52 max-w-[calc(100vw-2rem)] text-white rounded-xl shadow-2xl border border-emerald-800 py-2 z-50 text-xs font-semibold"
                  style={{ backgroundColor: navThemeColor }}
                >
                  {/* ▶ Cadastrar (Submenu cascata: . PF / . PJ) */}
                  <div
                    className="relative"
                    onMouseEnter={() => setOpenSubMenu('CLI_CADASTRAR')}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenSubMenu(
                          openSubMenu === 'CLI_CADASTRAR' ? null : 'CLI_CADASTRAR'
                        )
                      }
                      className={`w-full px-4 py-2.5 text-left flex items-center justify-between transition-colors ${
                        openSubMenu === 'CLI_CADASTRAR'
                          ? 'bg-black/35 text-white'
                          : 'hover:bg-white/15'
                      }`}
                    >
                      <span>▶ Cadastrar</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {openSubMenu === 'CLI_CADASTRAR' && (
                      <div
                        className="sm:absolute sm:left-full sm:top-0 relative left-0 top-0 w-full sm:w-44 text-white shadow-2xl border sm:border-emerald-800 border-white/20 z-50 text-xs font-semibold divide-y divide-white/20 bg-black/25 sm:bg-transparent rounded-lg sm:rounded-none mt-1 sm:mt-0"
                        style={{ backgroundColor: navThemeColor }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setPersonType('PF');
                            setHolderModalityCode('ADULTO');
                            setNewSubModalOpen(true);
                            setOpenMenu(null);
                            setOpenSubMenu(null);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-white/20 flex items-center gap-2"
                        >
                          <span className="text-emerald-300 font-bold">•</span>
                          <span>PF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPersonType('PJ');
                            setHolderModalityCode(
                              state?.modalities.find((m) => m.planType === 'EMPRESARIAL' || m.isCorporate)?.code || 'ADULTO'
                            );
                            setNewSubModalOpen(true);
                            setOpenMenu(null);
                            setOpenSubMenu(null);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-white/20 flex items-center gap-2"
                        >
                          <span className="text-emerald-300 font-bold">•</span>
                          <span>PJ</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ▶ Cadastrados (Submenu cascata: . PF / . PJ) */}
                  <div
                    className="relative"
                    onMouseEnter={() => setOpenSubMenu('CLI_CADASTRADOS')}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenSubMenu(
                          openSubMenu === 'CLI_CADASTRADOS' ? null : 'CLI_CADASTRADOS'
                        )
                      }
                      className={`w-full px-4 py-2.5 text-left flex items-center justify-between transition-colors ${
                        openSubMenu === 'CLI_CADASTRADOS'
                          ? 'bg-black/35 text-white'
                          : 'hover:bg-white/15'
                      }`}
                    >
                      <span>▶ Cadastrados</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {openSubMenu === 'CLI_CADASTRADOS' && (
                      <div
                        className="sm:absolute sm:left-full sm:top-0 relative left-0 top-0 w-full sm:w-44 text-white shadow-2xl border sm:border-emerald-800 border-white/20 z-50 text-xs font-semibold divide-y divide-white/20 bg-black/25 sm:bg-transparent rounded-lg sm:rounded-none mt-1 sm:mt-0"
                        style={{ backgroundColor: navThemeColor }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setPersonFilter('PF');
                            setOriginFilter('ALL');
                            setSubStatusFilter('ALL');
                            setActiveTab('associados');
                            setOpenMenu(null);
                            setOpenSubMenu(null);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-white/20 flex items-center gap-2"
                        >
                          <span className="text-emerald-300 font-bold">•</span>
                          <span>PF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPersonFilter('PJ');
                            setOriginFilter('ALL');
                            setSubStatusFilter('ALL');
                            setActiveTab('associados');
                            setOpenMenu(null);
                            setOpenSubMenu(null);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-white/20 flex items-center gap-2"
                        >
                          <span className="text-emerald-300 font-bold">•</span>
                          <span>PJ</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Submenus: Inativos, Pendentes, Prospect, Prospect Arquivados, Cancelados, Via site */}
                  {[
                    { label: 'Inativos', status: 'INACTIVE', origin: 'ALL' as const },
                    { label: 'Pendentes', status: 'PENDING', origin: 'ALL' as const },
                    { label: 'Prospect', status: 'PROSPECT', origin: 'ALL' as const },
                    {
                      label: 'Prospect Arquivados',
                      status: 'ARCHIVED_PROSPECT',
                      origin: 'ALL' as const,
                    },
                    { label: 'Cancelados', status: 'CANCELLED', origin: 'ALL' as const },
                    { label: 'Via site', status: 'ALL', origin: 'SITE' as const },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onMouseEnter={() => setOpenSubMenu(null)}
                      onClick={() => {
                        setPersonFilter('ALL');
                        setSubStatusFilter(item.status);
                        setOriginFilter(item.origin);
                        setActiveTab('associados');
                        setOpenMenu(null);
                        setOpenSubMenu(null);
                      }}
                      className="w-full px-5 py-2 text-left hover:bg-white/15 flex items-center gap-2"
                    >
                      <span className="text-white/70">•</span>
                      <span>{item.label}</span>
                    </button>
                  ))}

                  <div className="border-t border-white/20 my-1 pt-1">
                    <button
                      type="button"
                      onMouseEnter={() => setOpenSubMenu(null)}
                      onClick={() => {
                        setIsQrValidatorModalOpen(true);
                        setQrValidatorQuery('');
                        setQrValidatorResult(null);
                        setQrValidatorSearched(false);
                        setOpenMenu(null);
                        setOpenSubMenu(null);
                      }}
                      className="w-full px-4 py-2 text-left bg-emerald-800/80 hover:bg-emerald-700 flex items-center gap-2 text-white font-bold"
                    >
                      <QrCode className="w-4 h-4 text-amber-300" />
                      <span>Validar Carteirinha (QR Code)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. EMPRESAS ⌄ */}
            <div
              className="relative"
              onMouseEnter={() => {
                setOpenMenu('empresas');
                setOpenSubMenu(null);
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'empresas' ? null : 'empresas')
                }
                className={`w-full flex flex-col items-center justify-center px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-colors ${
                  openMenu === 'empresas' ||
                  (activeTab === 'associados' && personFilter === 'PJ')
                    ? 'bg-black/25 text-white'
                    : 'hover:bg-white/10 text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Store className="w-5 h-5 sm:w-7 sm:h-7 mb-0.5 sm:mb-1 stroke-[2.2]" />
                  <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
                </div>
                <span className="text-[10px] sm:text-xs font-bold tracking-tight">Empresas</span>
              </button>

              {openMenu === 'empresas' && (
                <div
                  className="absolute right-0 sm:right-auto sm:left-0 top-full mt-0.5 w-48 max-w-[calc(100vw-2rem)] text-white rounded-xl shadow-2xl border border-emerald-800 py-2 z-50 text-xs font-semibold"
                  style={{ backgroundColor: navThemeColor }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPersonType('PJ');
                      setHolderModalityCode('CORPORATE');
                      setNewSubModalOpen(true);
                      setOpenMenu(null);
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                  >
                    <span>•</span>
                    <span>Cadastrar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPersonFilter('PJ');
                      setOriginFilter('ALL');
                      setSubStatusFilter('ALL');
                      setActiveTab('associados');
                      setOpenMenu(null);
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                  >
                    <span>•</span>
                    <span>Cadastradas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPersonFilter('PJ');
                      setOriginFilter('ALL');
                      setSubStatusFilter('INACTIVE');
                      setActiveTab('associados');
                      setOpenMenu(null);
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                  >
                    <span>•</span>
                    <span>Inativas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPersonFilter('PJ');
                      setOriginFilter('ALL');
                      setSubStatusFilter('PENDING');
                      setActiveTab('associados');
                      setOpenMenu(null);
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                  >
                    <span>•</span>
                    <span>Pendentes</span>
                  </button>
                </div>
              )}
            </div>

            {/* 4. CONSULTORES ⌄ */}
            <div
              className="relative"
              onMouseEnter={() => {
                setOpenMenu('consultores');
                setOpenSubMenu(null);
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'consultores' ? null : 'consultores')
                }
                className={`w-full flex flex-col items-center justify-center px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-colors ${
                  openMenu === 'consultores' ||
                  (activeTab === 'consultores' &&
                    consultantRoleFilter === 'CONSULTOR')
                    ? 'bg-black/25 text-white'
                    : 'hover:bg-white/10 text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Briefcase className="w-5 h-5 sm:w-7 sm:h-7 mb-0.5 sm:mb-1 stroke-[2.2]" />
                  <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
                </div>
                <span className="text-[10px] sm:text-xs font-bold tracking-tight">
                  Consultores
                </span>
              </button>

              {openMenu === 'consultores' && (
                <div
                  className="absolute left-0 top-full mt-0.5 w-48 max-w-[calc(100vw-2rem)] text-white rounded-xl shadow-2xl border border-emerald-800 py-2 z-50 text-xs font-semibold"
                  style={{ backgroundColor: navThemeColor }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setConsultantRoleFilter('CONSULTOR');
                      setShowNewConsultantForm(true);
                      setActiveTab('consultores');
                      setOpenMenu(null);
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                  >
                    <span>•</span>
                    <span>Cadastrar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConsultantRoleFilter('CONSULTOR');
                      setShowNewConsultantForm(false);
                      setActiveTab('consultores');
                      setOpenMenu(null);
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                  >
                    <span>•</span>
                    <span>Cadastrados</span>
                  </button>
                </div>
              )}
            </div>

            {/* 5. INFLUENCER ⌄ */}
            <div
              className="relative"
              onMouseEnter={() => {
                setOpenMenu('influencer');
                setOpenSubMenu(null);
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'influencer' ? null : 'influencer')
                }
                className={`w-full flex flex-col items-center justify-center px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-colors ${
                  openMenu === 'influencer' ||
                  (activeTab === 'consultores' &&
                    consultantRoleFilter === 'INFLUENCER')
                    ? 'bg-black/25 text-white'
                    : 'hover:bg-white/10 text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Sparkles className="w-5 h-5 sm:w-7 sm:h-7 mb-0.5 sm:mb-1 stroke-[2.2]" />
                  <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
                </div>
                <span className="text-[10px] sm:text-xs font-bold tracking-tight">
                  Influencer
                </span>
              </button>

              {openMenu === 'influencer' && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-0 top-full mt-0.5 w-48 max-w-[calc(100vw-2rem)] text-white rounded-xl shadow-2xl border border-emerald-800 py-2 z-50 text-xs font-semibold"
                  style={{ backgroundColor: navThemeColor }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setConsultantRoleFilter('INFLUENCER');
                      setShowNewConsultantForm(true);
                      setActiveTab('consultores');
                      setOpenMenu(null);
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                  >
                    <span>•</span>
                    <span>Cadastrar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConsultantRoleFilter('INFLUENCER');
                      setShowNewConsultantForm(false);
                      setActiveTab('consultores');
                      setOpenMenu(null);
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                  >
                    <span>•</span>
                    <span>Cadastrados</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPersonType('PF');
                      setHolderModalityCode('PUBLICIDADE');
                      setNewSubModalOpen(true);
                      setOpenMenu(null);
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                  >
                    <span>•</span>
                    <span>Family Publicidade</span>
                  </button>
                </div>
              )}
            </div>

            {/* 6. FINANÇAS ⌄ */}
            <div
              className="relative"
              onMouseEnter={() => {
                setOpenMenu('financas');
                setOpenSubMenu(null);
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'financas' ? null : 'financas')
                }
                className={`w-full flex flex-col items-center justify-center px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-colors ${
                  openMenu === 'financas' || activeTab === 'financeiro'
                    ? 'bg-black/25 text-white'
                    : 'hover:bg-white/10 text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <DollarSign className="w-5 h-5 sm:w-7 sm:h-7 mb-0.5 sm:mb-1 stroke-[2.5]" />
                  <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
                </div>
                <span className="text-[10px] sm:text-xs font-bold tracking-tight">Finanças</span>
              </button>

              {openMenu === 'financas' && (
                <div
                  className="absolute right-0 sm:right-auto sm:left-0 top-full mt-0.5 w-60 max-w-[calc(100vw-2rem)] text-white rounded-xl shadow-2xl border border-emerald-800 py-2 z-50 text-xs font-semibold"
                  style={{ backgroundColor: navThemeColor }}
                >
                  {(
                    [
                      { label: 'Fluxo Caixa', view: 'FLUXO_CAIXA' },
                      { label: 'Entrada de Caixa', view: 'ENTRADA_CAIXA' },
                      { label: 'Saída Caixa', view: 'SAIDA_CAIXA' },
                      {
                        label: 'Faturamento Mensal Previsto',
                        view: 'FATURAMENTO_PREVISTO',
                      },
                      { label: 'Mensalidades', view: 'MENSALIDADES' },
                      {
                        label: 'Cobranças Vencidas Por Mês',
                        view: 'VENCIDAS_POR_MES',
                      },
                      { label: 'Assinaturas Ativas', view: 'ASSINATURAS_ATIVAS' },
                      {
                        label: 'Assinaturas Vencidas',
                        view: 'ASSINATURAS_VENCIDAS',
                      },
                      { label: 'Baixas em Lote', view: 'BAIXAS_EM_LOTE' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.view}
                      type="button"
                      onClick={() => {
                        setFinanceSubView(item.view);
                        setActiveTab('financeiro');
                        setOpenMenu(null);
                      }}
                      className="w-full px-5 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                    >
                      <span>•</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 7. RELATÓRIOS ⌄ (Com Submenus Cascata para ▶ Clientes e ▶ Outros) */}
            <div
              className="relative"
              onMouseEnter={() => setOpenMenu('relatorios')}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'relatorios' ? null : 'relatorios')
                }
                className={`w-full flex flex-col items-center justify-center px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-colors ${
                  openMenu === 'relatorios' || activeTab === 'relatorios'
                    ? 'bg-black/25 text-white'
                    : 'hover:bg-white/10 text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <BarChart3 className="w-5 h-5 sm:w-7 sm:h-7 mb-0.5 sm:mb-1 stroke-[2.2]" />
                  <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
                </div>
                <span className="text-[10px] sm:text-xs font-bold tracking-tight">
                  Relatórios
                </span>
              </button>

              {openMenu === 'relatorios' && (
                <div
                  className="absolute left-0 top-full mt-0.5 w-52 max-w-[calc(100vw-2rem)] text-white rounded-xl shadow-2xl border border-emerald-800 py-2 z-50 text-xs font-semibold"
                  style={{ backgroundColor: navThemeColor }}
                >
                  {(
                    [
                      { label: 'Clientes', view: 'CLIENTES', hasSub: 'REL_CLIENTES' },
                      { label: 'Consultores', view: 'CONSULTORES', hasSub: 'REL_CONSULTORES' },
                      { label: 'Influencer', view: 'INFLUENCER', hasSub: 'REL_INFLUENCER' },
                      { label: 'Empresas', view: 'EMPRESAS', hasSub: null },
                      { label: 'Agenda', view: 'AGENDA', hasSub: null },
                      { label: "SMS's", view: 'SMS', hasSub: null },
                      { label: 'Outros', view: 'OUTROS', hasSub: 'REL_OUTROS' },
                    ] as const
                  ).map((item) => (
                    <div
                      key={item.view}
                      className="relative"
                      onMouseEnter={() => setOpenSubMenu(item.hasSub)}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setReportSubView(item.view);
                          setActiveTab('relatorios');
                          if (!item.hasSub) {
                            setOpenMenu(null);
                            setOpenSubMenu(null);
                          }
                        }}
                        className={`w-full px-4 py-2.5 text-left flex items-center justify-between ${
                          openSubMenu === item.hasSub && item.hasSub
                            ? 'bg-black/35'
                            : 'hover:bg-white/15'
                        }`}
                      >
                        <span>▶ {item.label}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      {/* SUBMENU CASCATA: RELATÓRIOS -> ▶ CLIENTES */}
                      {item.hasSub === 'REL_CLIENTES' &&
                        openSubMenu === 'REL_CLIENTES' && (
                          <div
                            className="sm:absolute sm:left-full sm:top-0 relative left-0 top-0 w-full sm:w-72 text-white shadow-2xl border sm:border-emerald-800 border-white/20 z-50 text-xs font-semibold divide-y divide-white/25 bg-black/25 sm:bg-transparent rounded-lg sm:rounded-none mt-1 sm:mt-0"
                            style={{ backgroundColor: navThemeColor }}
                          >
                            {(
                              [
                                { id: 'LISTAGEM', label: 'Listagem' },
                                {
                                  id: 'PERIODO_ATIVOS',
                                  label:
                                    'Relatório de Clientes por Período Ativos',
                                },
                                {
                                  id: 'POR_CIDADES',
                                  label: 'Relatório de Clientes por Cidades',
                                },
                                {
                                  id: 'CONTRATO_RECEBIDO',
                                  label: 'Contrato Recebido',
                                },
                                {
                                  id: 'CONTRATOS_GERADOS',
                                  label: 'Contratos Gerados',
                                },
                                { id: 'FAIXA_ETARIA', label: 'Por Faixa Etária' },
                                { id: 'ADICIONAIS', label: 'Adicionais' },
                                { id: 'ADIMPLENTES', label: 'Adimplentes' },
                                { id: 'INADIMPLENTES', label: 'Inadimplentes' },
                                { id: 'A_RENOVAR', label: 'A Renovar' },
                              ] as const
                            ).map((subItem) => (
                              <button
                                key={subItem.id}
                                type="button"
                                onClick={() => {
                                  setReportSubView('CLIENTES');
                                  setClientReportSubFilter(subItem.id);
                                  setActiveTab('relatorios');
                                  setOpenMenu(null);
                                  setOpenSubMenu(null);
                                }}
                                className="w-full px-4 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                              >
                                <span>•</span>
                                <span>{subItem.label}</span>
                              </button>
                            ))}
                          </div>
                        )}

                      {/* SUBMENU CASCATA: RELATÓRIOS -> ▶ CONSULTORES (Comissão e Lista de Cadastro) */}
                      {item.hasSub === 'REL_CONSULTORES' &&
                        openSubMenu === 'REL_CONSULTORES' && (
                          <div
                            className="absolute left-full top-0 w-56 text-white shadow-2xl border border-emerald-800 z-50 text-xs font-semibold divide-y divide-white/25"
                            style={{ backgroundColor: navThemeColor }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setReportSubView('CONSULTORES');
                                setConsultantReportSubFilter('COMISSAO');
                                setActiveTab('relatorios');
                                setOpenMenu(null);
                                setOpenSubMenu(null);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                            >
                              <span>•</span>
                              <span>Comissão</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReportSubView('CONSULTORES');
                                setConsultantReportSubFilter('LISTA_CADASTRO');
                                setActiveTab('relatorios');
                                setOpenMenu(null);
                                setOpenSubMenu(null);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                            >
                              <span>•</span>
                              <span>Lista de Cadastro</span>
                            </button>
                          </div>
                        )}

                      {/* SUBMENU CASCATA: RELATÓRIOS -> ▶ INFLUENCER (Lista de Cadastro) */}
                      {item.hasSub === 'REL_INFLUENCER' &&
                        openSubMenu === 'REL_INFLUENCER' && (
                          <div
                            className="absolute left-full top-0 w-56 text-white shadow-2xl border border-emerald-800 z-50 text-xs font-semibold divide-y divide-white/25"
                            style={{ backgroundColor: navThemeColor }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setReportSubView('INFLUENCER');
                                setInfluencerReportSubFilter('LISTA_CADASTRO');
                                setActiveTab('relatorios');
                                setOpenMenu(null);
                                setOpenSubMenu(null);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                            >
                              <span>•</span>
                              <span>Lista de Cadastro</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReportSubView('INFLUENCER');
                                setInfluencerReportSubFilter('COMISSAO');
                                setActiveTab('relatorios');
                                setOpenMenu(null);
                                setOpenSubMenu(null);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                            >
                              <span>•</span>
                              <span>Comissão</span>
                            </button>
                          </div>
                        )}

                      {/* SUBMENU CASCATA: RELATÓRIOS -> ▶ OUTROS (Planos -> Todos / Cortesia) */}
                      {item.hasSub === 'REL_OUTROS' &&
                        openSubMenu === 'REL_OUTROS' && (
                          <div
                            className="absolute left-full bottom-0 w-64 text-white shadow-2xl border border-emerald-800 z-50 text-xs font-semibold divide-y divide-white/25"
                            style={{ backgroundColor: navThemeColor }}
                          >
                            <div className="divide-y divide-white/15">
                              <button
                                type="button"
                                onClick={() => {
                                  setReportSubView('OUTROS');
                                  setOtherReportSubFilter('PLANOS');
                                  setPlanosReportFilter('TODOS');
                                  setActiveTab('relatorios');
                                  setOpenMenu(null);
                                  setOpenSubMenu(null);
                                }}
                                className="w-full px-4 py-2.5 text-left hover:bg-white/15 flex items-center justify-between"
                              >
                                <span>▶ Planos (Todos)</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReportSubView('OUTROS');
                                  setOtherReportSubFilter('PLANOS');
                                  setPlanosReportFilter('CORTESIA');
                                  setActiveTab('relatorios');
                                  setOpenMenu(null);
                                  setOpenSubMenu(null);
                                }}
                                className="w-full px-6 py-2 text-left hover:bg-white/15 flex items-center gap-2 bg-black/20"
                              >
                                <span>• Planos — Cortesia / Gratuidade</span>
                              </button>
                            </div>
                            {(
                              [
                                {
                                  id: 'CARNES_ACABANDO',
                                  label: 'Carnês Acabando',
                                  arrow: false,
                                },
                                {
                                  id: 'SEM_FINANCEIRO',
                                  label: 'Clientes Sem Financeiro',
                                  arrow: false,
                                },
                                {
                                  id: 'CARTAO_EMISSAO',
                                  label: 'Cartão - (emissão)',
                                  arrow: false,
                                },
                                {
                                  id: 'CARTAO_VENCIMENTO',
                                  label: 'Cartão - (vencimento)',
                                  arrow: false,
                                },
                                { id: 'LOGS', label: "Log's", arrow: false },
                              ] as const
                            ).map((subItem) => (
                              <button
                                key={subItem.id}
                                type="button"
                                onClick={() => {
                                  setReportSubView('OUTROS');
                                  setOtherReportSubFilter(subItem.id);
                                  setActiveTab('relatorios');
                                  setOpenMenu(null);
                                  setOpenSubMenu(null);
                                }}
                                className="w-full px-4 py-2.5 text-left hover:bg-white/15 flex items-center justify-between"
                              >
                                <span>• {subItem.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 8. CONFIG. ⌄ (Idêntico às imagens: Config. Cartão, Impressões - Multi-Cartão, Planos, Adicionais, ▶ Contratos, ▶ OUTROS...) */}
            <div
              className="relative"
              onMouseEnter={() => {
                setOpenMenu('config');
                setOpenSubMenu(null);
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'config' ? null : 'config')
                }
                className={`w-full flex flex-col items-center justify-center px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-colors ${
                  openMenu === 'config' ||
                  activeTab === 'planos_contratos' ||
                  activeTab === 'impressao' ||
                  activeTab === 'importar'
                    ? 'bg-black/25 text-white'
                    : 'hover:bg-white/10 text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Settings className="w-5 h-5 sm:w-7 sm:h-7 mb-0.5 sm:mb-1 stroke-[2.2]" />
                  <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
                </div>
                <span className="text-[10px] sm:text-xs font-bold tracking-tight">Config.</span>
              </button>

              {openMenu === 'config' && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 sm:translate-x-0 sm:right-0 sm:left-auto top-full mt-0.5 w-60 max-w-[calc(100vw-2rem)] text-white rounded-xl shadow-2xl border border-emerald-800 py-2 z-50 text-xs font-semibold"
                  style={{ backgroundColor: navThemeColor }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setConfigSection('CONFIG_CARTAO');
                      setActiveTab('planos_contratos');
                      setOpenMenu(null);
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                    onMouseEnter={() => setOpenSubMenu(null)}
                  >
                    <span>•</span>
                    <span>Config. Cartão</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('impressao');
                      setOpenMenu(null);
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                    onMouseEnter={() => setOpenSubMenu(null)}
                  >
                    <span>•</span>
                    <span>Impressões - Multi-Cartão</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setConfigSection('PLANOS');
                      setActiveTab('planos_contratos');
                      setOpenMenu(null);
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                    onMouseEnter={() => setOpenSubMenu(null)}
                  >
                    <span>•</span>
                    <span>Planos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setConfigSection('ADICIONAIS');
                      setActiveTab('planos_contratos');
                      setOpenMenu(null);
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                    onMouseEnter={() => setOpenSubMenu(null)}
                  >
                    <span>•</span>
                    <span>Adicionais</span>
                  </button>

                  {/* ▶ Contratos > (Com Submenu Cascata: Termo de Uso - Site | Contratos) */}
                  <div
                    className="relative"
                    onMouseEnter={() => setOpenSubMenu('CFG_CONTRATOS')}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setConfigSection('CONTRATOS');
                        setActiveTab('planos_contratos');
                        setOpenMenu(null);
                        setOpenSubMenu(null);
                      }}
                      className={`w-full px-4 py-2.5 text-left flex items-center justify-between ${
                        openSubMenu === 'CFG_CONTRATOS'
                          ? 'bg-black/35'
                          : 'hover:bg-white/15'
                      }`}
                    >
                      <span>▶ Contratos</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {openSubMenu === 'CFG_CONTRATOS' && (
                      <div
                        className="absolute right-full top-0 w-56 text-white shadow-2xl border border-emerald-800 z-50 text-xs font-semibold divide-y divide-white/25"
                        style={{ backgroundColor: navThemeColor }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setConfigSection('TERMO_USO_SITE');
                            setActiveTab('planos_contratos');
                            setOpenMenu(null);
                            setOpenSubMenu(null);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                        >
                          <span>•</span>
                          <span>Termo de Uso - Site</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfigSection('CONTRATOS');
                            setActiveTab('planos_contratos');
                            setOpenMenu(null);
                            setOpenSubMenu(null);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                        >
                          <span>•</span>
                          <span>Contratos</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ▶ OUTROS... > (Idêntico à Imagem 2: Formas PG, Categorias, Especialidades, Serviços, Profissionais, ▶ SMS's, Excluir Clientes + Importar) */}
                  <div
                    className="relative"
                    onMouseEnter={() => setOpenSubMenu('CFG_OUTROS')}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setConfigSection('FORMAS_PG');
                        setActiveTab('planos_contratos');
                        setOpenMenu(null);
                        setOpenSubMenu(null);
                      }}
                      className={`w-full px-4 py-2.5 text-left flex items-center justify-between ${
                        openSubMenu === 'CFG_OUTROS'
                          ? 'bg-black/35'
                          : 'hover:bg-white/15'
                      }`}
                    >
                      <span>▶ OUTROS...</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {openSubMenu === 'CFG_OUTROS' && (
                      <div
                        className="absolute right-full bottom-0 w-60 text-white shadow-2xl border border-emerald-800 z-50 text-xs font-semibold divide-y divide-white/25"
                        style={{ backgroundColor: navThemeColor }}
                      >
                        {(
                          [
                            { id: 'FORMAS_PG', label: 'Formas PG' },
                            { id: 'CATEGORIAS', label: 'Categorias' },
                            { id: 'ESPECIALIDADES', label: 'Especialidades' },
                            { id: 'SERVICOS', label: 'Serviços' },
                            { id: 'PROFISSIONAIS', label: 'Profissionais' },
                          ] as const
                        ).map((cfgOut) => (
                          <button
                            key={cfgOut.id}
                            type="button"
                            onClick={() => {
                              setConfigSection(cfgOut.id);
                              setActiveTab('planos_contratos');
                              setOpenMenu(null);
                              setOpenSubMenu(null);
                            }}
                            className="w-full px-4 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                          >
                            <span>•</span>
                            <span>{cfgOut.label}</span>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setReportSubView('SMS');
                            setActiveTab('relatorios');
                            setOpenMenu(null);
                            setOpenSubMenu(null);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-white/15 flex items-center justify-between"
                        >
                          <span>▶ SMS's</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfigSection('EXCLUIR_CLIENTES');
                            setActiveTab('planos_contratos');
                            setOpenMenu(null);
                            setOpenSubMenu(null);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                        >
                          <span>•</span>
                          <span>Excluir Clientes</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('importar');
                            setOpenMenu(null);
                            setOpenSubMenu(null);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                        >
                          <span>•</span>
                          <span>Importar Planilha Labcard</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 9. PERFIL ⌄ (Idêntico à imagem: Meus Dados, Acessos, Meu Plano, Minhas Faturas, Alterar Cor, Sair) */}
            <div
              className="relative"
              onMouseEnter={() => {
                setOpenMenu('perfil');
                setOpenSubMenu(null);
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'perfil' ? null : 'perfil')
                }
                className={`w-full flex flex-col items-center justify-center px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-colors ${
                  openMenu === 'perfil' || activeTab === 'perfil'
                    ? 'bg-black/25 text-white'
                    : 'hover:bg-white/10 text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <User className="w-5 h-5 sm:w-7 sm:h-7 mb-0.5 sm:mb-1 stroke-[2.2]" />
                  <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
                </div>
                <span className="text-[10px] sm:text-xs font-bold tracking-tight">Perfil</span>
              </button>

              {openMenu === 'perfil' && (
                <div
                  className="absolute right-0 top-full mt-0.5 w-48 max-w-[calc(100vw-2rem)] text-white rounded-xl shadow-2xl border border-emerald-800 py-2 z-50 text-xs font-semibold"
                  style={{ backgroundColor: navThemeColor }}
                >
                  {(
                    [
                      { id: 'MEUS_DADOS', label: 'Meus Dados' },
                      { id: 'ACESSOS', label: 'Acessos' },
                      { id: 'MEU_PLANO', label: 'Meu Plano' },
                      { id: 'MINHAS_FATURAS', label: 'Minhas Faturas' },
                      { id: 'ALTERAR_COR', label: 'Alterar Cor' },
                    ] as const
                  ).map((pItem) => (
                    <button
                      key={pItem.id}
                      type="button"
                      onClick={() => {
                        setPerfilSection(pItem.id);
                        setActiveTab('perfil');
                        setOpenMenu(null);
                      }}
                      className="w-full px-5 py-2.5 text-left hover:bg-white/15 flex items-center gap-2"
                    >
                      <span>•</span>
                      <span>{pItem.label}</span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      window.location.href = '/admin';
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-rose-700/60 flex items-center gap-2 border-t border-white/15 mt-1 pt-2.5"
                  >
                    <span>•</span>
                    <span>Sair</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BARRA DE BUSCA RÁPIDA DIRETA NO TOPO + BOTÃO FLUTUANTE DE LUPA */}
      <div className="bg-white rounded-2xl border-2 border-emerald-600/30 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <Label className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-700" />
            Busca rápida — Digite o nome, Nº. do CPF ou Nº. do Cartão do cliente:
          </Label>
          {quickQuery.trim() !== '' && (
            <button
              type="button"
              onClick={() => setQuickQuery('')}
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Limpar busca
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="w-5 h-5 text-emerald-700 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            placeholder="Digite o nome, Nº. do CPF ou Nº. do Cartão do cliente (ex: 1212253001)..."
            className="pl-11 h-12 text-sm sm:text-base font-medium border-slate-300 focus:border-emerald-600"
          />
        </div>

        {quickQuery.trim() !== '' && (
          <div className="pt-1">
            {quickSearchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto">
                {quickSearchResults.map(({ member, subscription }) => (
                  <div
                    key={member.id}
                    className={`rounded-xl border-2 p-3.5 flex items-center justify-between gap-3 ${
                      subscription.status === 'ACTIVE'
                        ? 'border-emerald-500 bg-emerald-50/60'
                        : 'border-rose-400 bg-rose-50/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge
                          className={
                            subscription.status === 'ACTIVE'
                              ? 'bg-emerald-600 text-white text-[10px]'
                              : 'bg-rose-600 text-white text-[10px]'
                          }
                        >
                          {subscription.status === 'ACTIVE'
                            ? 'ATIVO • LIBERADO'
                            : 'INATIVO / AGUARDANDO'}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-bold">
                          {member.role === 'TITULAR' ? '👑 TITULAR' : '👥 DEPENDENTE'}
                        </Badge>
                      </div>
                      <h4 className="text-sm font-black text-slate-900">
                        {member.fullName}
                      </h4>
                      <p className="text-xs text-slate-600">
                        Cartão: <strong>#{member.cardNumber}</strong> • CPF:{' '}
                        <strong>{member.cpf || subscription.holderCpf}</strong> •{' '}
                        {member.planCycleLabel}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setSelectedSubForDetail(subscription)}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shrink-0"
                    >
                      Abrir Cadastro / Situação
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-rose-600 font-bold py-2">
                Nenhum cliente encontrado para "{quickQuery}".
              </p>
            )}
          </div>
        )}
      </div>

      {/* Botão Flutuante de Lupa (Idêntico ao Labcard na lateral direita) */}
      <button
        type="button"
        onClick={() => setQuickSearchOpen(true)}
        title="Busca rápida: Digite o nome, Nº. do CPF ou Nº. do Cartão do cliente"
        className="fixed bottom-6 right-4 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:right-5 z-40 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#004d00] hover:bg-emerald-800 text-white shadow-2xl border-2 border-white flex items-center justify-center transition-transform hover:scale-105"
      >
        <Search className="w-5 h-5" />
      </button>

      {/* CONTEÚDO DAS ABAS E FERRAMENTAS */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className={selectedSubForDetail ? 'hidden' : 'space-y-6'}
      >
        {/* TAB 1: DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Titulares */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Titulares Cadastrados
                </span>
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div
                  onClick={() => {
                    setPersonFilter('ALL');
                    setSubStatusFilter('ACTIVE');
                    setActiveTab('associados');
                  }}
                  className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 cursor-pointer hover:bg-emerald-100/70 transition-colors"
                >
                  <span className="text-xs font-bold text-emerald-700 block">
                    Ativos
                  </span>
                  <span className="text-3xl font-black text-emerald-900">
                    {metrics.holdersActive}
                  </span>
                </div>
                <div
                  onClick={() => {
                    setPersonFilter('ALL');
                    setSubStatusFilter('INACTIVE');
                    setActiveTab('associados');
                  }}
                  className="bg-rose-50 border border-rose-200 rounded-2xl p-4 cursor-pointer hover:bg-rose-100/70 transition-colors"
                >
                  <span className="text-xs font-bold text-rose-700 block">
                    Pendentes / Inativos
                  </span>
                  <span className="text-3xl font-black text-rose-900">
                    {metrics.holdersInactive}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Dependentes */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Dependentes Vinculados
                </span>
                <UserCheck className="w-5 h-5 text-blue-600" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <span className="text-xs font-bold text-blue-700 block">
                    Ativos
                  </span>
                  <span className="text-3xl font-black text-blue-900">
                    {metrics.dependentsActive}
                  </span>
                </div>
                <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4">
                  <span className="text-xs font-bold text-slate-600 block">
                    Inativos
                  </span>
                  <span className="text-3xl font-black text-slate-800">
                    {metrics.dependentsInactive}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Financeiro de Faturas */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Faturas & Mensalidades
                </span>
                <Receipt className="w-5 h-5 text-amber-600" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div
                  onClick={() => {
                    setFinanceSubView('FLUXO_CAIXA');
                    setActiveTab('financeiro');
                  }}
                  className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 cursor-pointer hover:bg-emerald-100"
                >
                  <span className="text-[11px] font-bold text-emerald-700 block">
                    Pagas ({metrics.invoicesPaid})
                  </span>
                  <span className="text-sm font-black text-emerald-950">
                    {formatCurrency(metrics.totalPaidAmount)}
                  </span>
                </div>
                <div
                  onClick={() => {
                    setFinanceSubView('MENSALIDADES');
                    setInvoiceStatusFilter('PENDING');
                    setActiveTab('financeiro');
                  }}
                  className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 cursor-pointer hover:bg-amber-100"
                >
                  <span className="text-[11px] font-bold text-amber-700 block">
                    Abertas ({metrics.invoicesPending})
                  </span>
                  <span className="text-sm font-black text-amber-950">
                    {formatCurrency(metrics.totalPendingAmount)}
                  </span>
                </div>
                <div
                  onClick={() => {
                    setFinanceSubView('VENCIDAS_POR_MES');
                    setActiveTab('financeiro');
                  }}
                  className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 cursor-pointer hover:bg-rose-100"
                >
                  <span className="text-[11px] font-bold text-rose-700 block">
                    Vencidas
                  </span>
                  <span className="text-lg font-black text-rose-900">
                    {metrics.invoicesOverdue}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-black text-slate-900 mb-4">
              Ações Rápidas do Balneário
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Button
                onClick={() => {
                  setPersonType('PF');
                  setNewSubModalOpen(true);
                }}
                className="h-14 justify-start bg-[#004d00] hover:bg-emerald-900 text-white font-bold rounded-2xl px-4"
              >
                <UserPlus className="w-5 h-5 mr-3 shrink-0" />
                <div className="text-left">
                  <div className="text-sm">Cadastrar Cliente PF</div>
                  <div className="text-[10px] opacity-80 font-normal">
                    Integral + Estudante + Kids + 60+
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                onClick={() => setActiveTab('impressao')}
                className="h-14 justify-start border-slate-200 hover:bg-slate-50 font-bold rounded-2xl px-4"
              >
                <Printer className="w-5 h-5 mr-3 text-emerald-600 shrink-0" />
                <div className="text-left">
                  <div className="text-sm text-slate-900">
                    Folha c/ 4 Carteirinhas
                  </div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Frente e Verso pronto p/ impressão
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setFinanceSubView('FLUXO_CAIXA');
                  setActiveTab('financeiro');
                }}
                className="h-14 justify-start border-slate-200 hover:bg-slate-50 font-bold rounded-2xl px-4"
              >
                <DollarSign className="w-5 h-5 mr-3 text-emerald-700 shrink-0" />
                <div className="text-left">
                  <div className="text-sm text-slate-900">
                    Fluxo de Caixa & Baixas
                  </div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Entradas, Saídas e Baixa em Lote
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                onClick={() => setActiveTab('relatorios')}
                className="h-14 justify-start border-slate-200 hover:bg-slate-50 font-bold rounded-2xl px-4"
              >
                <BarChart3 className="w-5 h-5 mr-3 text-purple-600 shrink-0" />
                <div className="text-left">
                  <div className="text-sm text-slate-900">
                    Relatórios & Agenda
                  </div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Clientes, Consultores, Empresas, SMS
                  </div>
                </div>
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* =====================================================================
            TAB 2: CLIENTES (PF) & EMPRESAS (PJ)
            Suporta todos os filtros do menu Clientes e Empresas:
            Cadastrados | Inativos | Pendentes | Prospect | Prospect Arquivados |
            Cancelados | Via site
        ===================================================================== */}
        <TabsContent value="associados" className="space-y-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {personFilter === 'PJ'
                    ? `Empresas Conveniadas / Corporativas PJ (${filteredSubscriptions.length})`
                    : `Clientes - Cadastrados PF (${filteredSubscriptions.length})`}
                  {originFilter === 'SITE' && ' — Via Site'}
                </h3>
                <p className="text-xs text-slate-500">
                  Listagem exclusiva de Titulares. Os dependentes ficam dentro do cadastro de cada titular ou podem ser localizados pesquisando por Nome, CPF ou Nº da Carteirinha.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setPersonType(personFilter === 'PJ' ? 'PJ' : 'PF');
                    setNewSubModalOpen(true);
                  }}
                  className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold w-full sm:w-auto"
                >
                  <UserPlus className="w-4 h-4 mr-1.5" /> + Cadastrar{' '}
                  {personFilter === 'PJ' ? 'Empresa PJ' : 'Cliente PF'}
                </Button>
              </div>
            </div>

            {/* SELETOR DE PESSOA FÍSICA (PF) vs EMPRESA (PJ) */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-fit">
              <span className="text-xs font-bold text-slate-500 px-2">Tipo de Cliente:</span>
              <Button
                type="button"
                size="sm"
                variant={personFilter === 'ALL' ? 'default' : 'ghost'}
                onClick={() => setPersonFilter('ALL')}
                className={`h-7 text-xs font-bold ${
                  personFilter === 'ALL' ? 'bg-[#004d00] text-white shadow-sm' : 'text-slate-700 hover:bg-white'
                }`}
              >
                Todos
              </Button>
              <Button
                type="button"
                size="sm"
                variant={personFilter === 'PF' ? 'default' : 'ghost'}
                onClick={() => setPersonFilter('PF')}
                className={`h-7 text-xs font-bold ${
                  personFilter === 'PF' ? 'bg-[#004d00] text-white shadow-sm' : 'text-slate-700 hover:bg-white'
                }`}
              >
                PF (Pessoa Física)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={personFilter === 'PJ' ? 'default' : 'ghost'}
                onClick={() => setPersonFilter('PJ')}
                className={`h-7 text-xs font-bold ${
                  personFilter === 'PJ' ? 'bg-[#004d00] text-white shadow-sm' : 'text-slate-700 hover:bg-white'
                }`}
              >
                PJ (Empresas)
              </Button>
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={subSearch}
                  onChange={(e) => setSubSearch(e.target.value)}
                  placeholder="Pesquisar Titular ou Dependente por Nome, CPF/CNPJ ou Nº da Carteirinha (121225xxxx)..."
                  className="pl-10 h-11"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap -mx-1 px-1">
                {(
                  [
                    { id: 'ALL', label: 'Cadastrados (Todos)' },
                    { id: 'ACTIVE', label: 'Ativos' },
                    { id: 'INACTIVE', label: 'Inativos' },
                    { id: 'PENDING', label: 'Pendentes' },
                    { id: 'PROSPECT', label: 'Prospect' },
                    { id: 'ARCHIVED_PROSPECT', label: 'Prospect Arquivados' },
                    { id: 'CANCELLED', label: 'Cancelados' },
                  ] as const
                ).map((st) => (
                  <Button
                    key={st.id}
                    size="sm"
                    variant={
                      subStatusFilter === st.id && originFilter === 'ALL'
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() => {
                      setOriginFilter('ALL');
                      setSubStatusFilter(st.id);
                    }}
                    className={`shrink-0 whitespace-nowrap text-xs ${
                      subStatusFilter === st.id && originFilter === 'ALL'
                        ? 'bg-[#004d00] text-white font-bold'
                        : ''
                    }`}
                  >
                    {st.label}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={originFilter === 'SITE' ? 'default' : 'outline'}
                  onClick={() => {
                    setOriginFilter(originFilter === 'SITE' ? 'ALL' : 'SITE');
                    setSubStatusFilter('ALL');
                  }}
                  className={`shrink-0 whitespace-nowrap text-xs ${
                    originFilter === 'SITE'
                      ? 'bg-blue-700 text-white font-bold'
                      : ''
                  }`}
                >
                  Via site
                </Button>
              </div>
            </div>

            {filteredSubscriptions.length === 0 ? (
              <div className="text-center py-12 text-slate-500 space-y-3">
                <p>Nenhum registro encontrado para o filtro selecionado.</p>
                <Button
                  onClick={() => setNewSubModalOpen(true)}
                  className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold"
                >
                  <UserPlus className="w-4 h-4 mr-2" /> Cadastrar Novo Registro
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#004d00] text-white text-xs uppercase tracking-wider font-black">
                      <th className="py-3 px-4 border-r border-emerald-800">
                        Nº Cartão
                      </th>
                      <th className="py-3 px-4 border-r border-emerald-800">
                        Nome (Titular)
                      </th>
                      <th className="py-3 px-4 border-r border-emerald-800">
                        CPF / CNPJ
                      </th>
                      <th className="py-3 px-4 border-r border-emerald-800">
                        Telefone
                      </th>
                      <th className="py-3 px-4 border-r border-emerald-800 text-center">
                        Status
                      </th>
                      <th className="py-3 px-4 text-right">
                        Opções do Cadastro & Financeiro
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {filteredSubscriptions.map((sub, idx) => {
                      const q = subSearch.trim().toLowerCase();
                      const qDigits = q.replace(/\D/g, '');
                      const matchedDependents = q
                        ? sub.members.filter(
                            (m) =>
                              m.role === 'DEPENDENTE' &&
                              (m.fullName.toLowerCase().includes(q) ||
                                m.cardNumber.includes(q) ||
                                (qDigits &&
                                  m.cpf.replace(/\D/g, '').includes(qDigits)))
                          )
                        : [];

                      return (
                        <tr
                          key={sub.id}
                          className={`${
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'
                          } hover:bg-emerald-50/60 transition-colors`}
                        >
                          <td
                            onClick={() => {
                              setClientDetailTool('DADOS_CADASTRAIS');
                              setSelectedSubForDetail(sub);
                            }}
                            className="py-3 px-4 font-mono font-bold text-slate-800 border-r border-slate-200 cursor-pointer hover:text-emerald-700"
                          >
                            {sub.subscriptionCode}
                          </td>
                          <td
                            onClick={() => {
                              setClientDetailTool('DADOS_CADASTRAIS');
                              setSelectedSubForDetail(sub);
                            }}
                            className="py-3 px-4 border-r border-slate-200 cursor-pointer"
                          >
                            <div className="font-black text-slate-900 hover:text-emerald-800 uppercase">
                              {sub.holderName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {sub.planSummaryLabel} •{' '}
                              {sub.billingCycle === 'ANNUAL' ? 'Anual' : 'Mensal'} (
                              {formatCurrency(sub.monthlyEquivalent)}/mês)
                            </div>
                            {matchedDependents.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {matchedDependents.map((dep) => (
                                  <span
                                    key={dep.id}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md"
                                  >
                                    🔍 Dependente localizado: {dep.fullName} (Cartão #{dep.cardNumber} • CPF: {dep.cpf || '—'})
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-700 border-r border-slate-200">
                            {sub.holderCpf}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-700 border-r border-slate-200">
                            {sub.holderPhone || '—'}
                          </td>
                          <td className="py-3 px-4 border-r border-slate-200 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded font-black text-[11px] lowercase ${
                                sub.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}
                            >
                              {sub.status === 'ACTIVE' ? 'ativo' : 'inativo'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setClientDetailTool('DADOS_CADASTRAIS');
                                  setSelectedSubForDetail(sub);
                                }}
                                className="h-8 bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs px-3"
                              >
                                <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Entrar no Cadastro
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setClientDetailTool('FINANCEIRO_CLIENTE');
                                  setSelectedSubForDetail(sub);
                                }}
                                className="h-8 border-emerald-700 text-emerald-900 hover:bg-emerald-50 font-bold text-xs px-2.5"
                                title="Abrir Perfil Financeiro do Cliente"
                              >
                                <DollarSign className="w-3.5 h-3.5 mr-1 text-emerald-700" />{' '}
                                Financeiro
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setClientDetailTool('CARTOES');
                                  setSelectedSubForDetail(sub);
                                }}
                                className="h-8 text-xs px-2.5 font-semibold"
                                title="Ver Carteirinhas do Titular e Dependentes"
                              >
                                <CreditCard className="w-3.5 h-3.5 mr-1 text-emerald-700" />{' '}
                                Cartões
                              </Button>
                              {sub.status !== 'ACTIVE' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleToggleSubStatus(sub, 'ACTIVE')}
                                  className="h-8 border-emerald-500 text-emerald-800 hover:bg-emerald-50 font-bold text-xs px-2.5"
                                >
                                  Liberar
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleToggleSubStatus(sub, 'INACTIVE')}
                                  className="h-8 border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs px-2.5"
                                >
                                  Inativar
                                </Button>
                              )}
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
        </TabsContent>

        {/* =====================================================================
            TAB CONSULTORES & INFLUENCER
        ===================================================================== */}
        <TabsContent value="consultores" className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Gestão Unificada de Consultores & Influencers de Vendas
                </h3>
                <p className="text-xs text-slate-500">
                  Cadastre consultores e influencers, defina comissão em % ou R$ fixo, gere links exclusivos e QR Codes rastreáveis.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  <Button
                    size="sm"
                    variant={consultantRoleFilter === 'TODOS' ? 'default' : 'ghost'}
                    onClick={() => setConsultantRoleFilter('TODOS')}
                    className={`h-7 px-2.5 text-xs font-bold ${
                      consultantRoleFilter === 'TODOS' ? 'bg-slate-900 text-white' : 'text-slate-700'
                    }`}
                  >
                    Todos
                  </Button>
                  <Button
                    size="sm"
                    variant={consultantRoleFilter === 'CONSULTOR' ? 'default' : 'ghost'}
                    onClick={() => setConsultantRoleFilter('CONSULTOR')}
                    className={`h-7 px-2.5 text-xs font-bold ${
                      consultantRoleFilter === 'CONSULTOR' ? 'bg-[#004d00] text-white' : 'text-slate-700'
                    }`}
                  >
                    Consultores
                  </Button>
                  <Button
                    size="sm"
                    variant={consultantRoleFilter === 'INFLUENCER' ? 'default' : 'ghost'}
                    onClick={() => setConsultantRoleFilter('INFLUENCER')}
                    className={`h-7 px-2.5 text-xs font-bold ${
                      consultantRoleFilter === 'INFLUENCER' ? 'bg-purple-800 text-white' : 'text-slate-700'
                    }`}
                  >
                    Influencers
                  </Button>
                </div>

                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  <Button
                    size="sm"
                    variant={consultantStatusFilter === 'TODOS' ? 'default' : 'ghost'}
                    onClick={() => setConsultantStatusFilter('TODOS')}
                    className={`h-7 px-2.5 text-xs font-bold ${
                      consultantStatusFilter === 'TODOS' ? 'bg-slate-800 text-white' : 'text-slate-600'
                    }`}
                  >
                    Status: Todos
                  </Button>
                  <Button
                    size="sm"
                    variant={consultantStatusFilter === 'ACTIVE' ? 'default' : 'ghost'}
                    onClick={() => setConsultantStatusFilter('ACTIVE')}
                    className={`h-7 px-2.5 text-xs font-bold ${
                      consultantStatusFilter === 'ACTIVE' ? 'bg-emerald-700 text-white' : 'text-slate-600'
                    }`}
                  >
                    Ativos
                  </Button>
                  <Button
                    size="sm"
                    variant={consultantStatusFilter === 'INACTIVE' ? 'default' : 'ghost'}
                    onClick={() => setConsultantStatusFilter('INACTIVE')}
                    className={`h-7 px-2.5 text-xs font-bold ${
                      consultantStatusFilter === 'INACTIVE' ? 'bg-rose-700 text-white' : 'text-slate-600'
                    }`}
                  >
                    Inativos
                  </Button>
                </div>

                <Button
                  size="sm"
                  onClick={() => setShowNewConsultantForm((p) => !p)}
                  className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs h-9"
                >
                  <Plus className="w-4 h-4 mr-1" /> Novo Consultor / Influencer
                </Button>
              </div>
            </div>

            {/* FORMULÁRIO DE CADASTRO COM TODOS OS DADOS DA SCREENSHOT 2 */}
            {showNewConsultantForm && (
              <form
                onSubmit={handleCreateConsultant}
                className="bg-emerald-50/80 border border-emerald-300 rounded-2xl p-5 space-y-4 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                  <h4 className="font-black text-sm text-emerald-950 uppercase tracking-wide">
                    Cadastrar Novo Consultor de Vendas / Influencer
                  </h4>
                  <Badge className="bg-emerald-800 text-white text-xs">
                    Comissão Flexível (% ou R$) + Link Rastreado
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs font-bold text-slate-700">
                  <div className="sm:col-span-4">
                    <Label className="text-xs font-bold">Nome Completo *</Label>
                    <Input
                      value={newConsName}
                      onChange={(e) => setNewConsName(e.target.value)}
                      placeholder="Nome do vendedor ou influencer"
                      className="bg-white mt-1 h-9"
                      required
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="text-xs font-bold">CPF *</Label>
                    <Input
                      value={newConsCpf}
                      onChange={(e) => setNewConsCpf(e.target.value)}
                      placeholder="000.000.000-00"
                      className="bg-white mt-1 h-9"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="text-xs font-bold">Telefone / WhatsApp *</Label>
                    <Input
                      value={newConsPhone}
                      onChange={(e) => setNewConsPhone(e.target.value)}
                      placeholder="(69) 99999-9999"
                      className="bg-white mt-1 h-9"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-bold">Papel</Label>
                    <select
                      value={consultantRoleFilter === 'INFLUENCER' ? 'INFLUENCER' : 'CONSULTOR'}
                      onChange={(e) => setConsultantRoleFilter(e.target.value as any)}
                      className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs font-bold bg-white mt-1"
                    >
                      <option value="CONSULTOR">Consultor</option>
                      <option value="INFLUENCER">Influencer</option>
                    </select>
                  </div>

                  {/* CONFIGURAÇÃO DA COMISSÃO (PERCENTUAL OU EM R$ FIXO) */}
                  <div className="sm:col-span-3">
                    <Label className="text-xs font-bold">Tipo de Comissão</Label>
                    <select
                      value={newConsCommissionType}
                      onChange={(e) => setNewConsCommissionType(e.target.value as 'PERCENT' | 'FIXED')}
                      className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs font-bold bg-white mt-1"
                    >
                      <option value="PERCENT">Percentual (%) sobre o valor</option>
                      <option value="FIXED">Valor Fixo em Reais (R$)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <Label className="text-xs font-bold">
                      {newConsCommissionType === 'PERCENT' ? 'Porcentagem (%)' : 'Valor Fixo (R$)'}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newConsCommission}
                      onChange={(e) => setNewConsCommission(Number(e.target.value))}
                      placeholder={newConsCommissionType === 'PERCENT' ? '10' : '20.00'}
                      className="bg-white mt-1 h-9 font-bold text-emerald-900"
                      required
                    />
                  </div>

                  <div className="sm:col-span-6 flex flex-col justify-end space-y-2 pb-1">
                    <div className="flex items-center gap-4 text-xs font-semibold text-slate-800">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newConsCommissionFirstOnly}
                          onChange={(e) => setNewConsCommissionFirstOnly(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-700"
                        />
                        <span>Apenas na 1ª adesão</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newConsCommissionRecurring}
                          onChange={(e) => setNewConsCommissionRecurring(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-700"
                        />
                        <span>Comissão recorrente em todas mensalidades</span>
                      </label>
                    </div>
                  </div>

                  {/* FORMAS DE VENDAS AUTORIZADAS (SCREENSHOT 2) */}
                  <div className="sm:col-span-12 pt-2 border-t border-emerald-200">
                    <Label className="text-xs font-bold text-slate-700 mb-1.5 block">
                      Formas de Vendas Liberadas para este Consultor:
                    </Label>
                    <div className="flex flex-wrap items-center gap-5 text-xs font-semibold text-slate-800">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newConsMethods.boleto}
                          onChange={(e) =>
                            setNewConsMethods((prev) => ({ ...prev, boleto: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-emerald-700"
                        />
                        <span>Boleto Bancário</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newConsMethods.pix}
                          onChange={(e) =>
                            setNewConsMethods((prev) => ({ ...prev, pix: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-emerald-700"
                        />
                        <span>PIX Online</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newConsMethods.creditCard}
                          onChange={(e) =>
                            setNewConsMethods((prev) => ({ ...prev, creditCard: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-emerald-700"
                        />
                        <span>Cartão de Crédito</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newConsMethods.recurrence}
                          onChange={(e) =>
                            setNewConsMethods((prev) => ({ ...prev, recurrence: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-emerald-700"
                        />
                        <span>Recorrência Automática</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-emerald-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewConsultantForm(false)}
                    className="h-9 text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-[#004d00] hover:bg-emerald-900 text-white font-black text-xs h-9 px-5"
                  >
                    Salvar e Ativar Vendedor
                  </Button>
                </div>
              </form>
            )}

            {/* LISTAGEM DE CONSULTORES E INFLUENCERS COM FILTROS E AÇÕES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {state.consultants
                .filter((c) => {
                  if (consultantRoleFilter !== 'TODOS' && c.role !== consultantRoleFilter) {
                    return false;
                  }
                  if (consultantStatusFilter !== 'TODOS' && c.status !== consultantStatusFilter) {
                    return false;
                  }
                  return true;
                })
                .map((cons) => {
                  const linkedSubs = (state.subscriptions || []).filter(
                    (s) =>
                      s.consultantName?.toLowerCase() === cons.name.toLowerCase() ||
                      s.influencerName?.toLowerCase() === cons.name.toLowerCase() ||
                      s.consultantCode?.toLowerCase() === cons.referralCode.toLowerCase()
                  );
                  const salesCount = linkedSubs.length;
                  const totalVolume = linkedSubs.reduce((acc, s) => acc + (s.totalContractValue || 0), 0);
                  const commissionText =
                    cons.commissionType === 'FIXED'
                      ? `R$ ${(cons.commissionValue || 0).toFixed(2)} por venda`
                      : `${cons.commissionPercent || cons.commissionValue || 10}% sobre contratos`;

                  return (
                    <div
                      key={cons.id}
                      className="rounded-2xl border border-slate-200 p-4 bg-slate-50 flex flex-col justify-between gap-3 shadow-sm hover:border-emerald-300 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 text-sm">
                              {cons.name}
                            </span>
                            <Badge
                              className={
                                cons.role === 'INFLUENCER'
                                  ? 'bg-purple-800 text-white text-[10px]'
                                  : 'bg-emerald-800 text-white text-[10px]'
                              }
                            >
                              {cons.role === 'INFLUENCER' ? 'INFLUENCER' : 'CONSULTOR'}
                            </Badge>
                          </div>
                          <Badge
                            className={
                              cons.status === 'ACTIVE'
                                ? 'bg-emerald-600 text-white text-[10px]'
                                : 'bg-slate-500 text-white text-[10px]'
                            }
                          >
                            {cons.status === 'ACTIVE' ? 'ATIVO' : 'INATIVO'}
                          </Badge>
                        </div>

                        <div className="text-xs text-slate-600 mt-2 space-y-1">
                          <p>
                            Código de Indicação: <strong className="font-mono text-emerald-800">{cons.referralCode}</strong>
                          </p>
                          <p>
                            Tel: <strong>{cons.phone || '—'}</strong> • CPF: {cons.cpf}
                          </p>
                          <p>
                            Comissão: <strong className="text-emerald-900">{commissionText}</strong>
                            {cons.commissionRecurring && ' (Recorrente)'}
                          </p>
                          <p className="text-slate-500 text-[11px] pt-1">
                            Vendas Rastreadas: <strong>{salesCount} contratos</strong> • Volume: <strong>{formatCurrency(totalVolume)}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                        <Button
                          size="sm"
                          onClick={() => setSelectedConsultantForLink(cons)}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-8"
                        >
                          <QrCode className="w-3.5 h-3.5 mr-1" /> Gerar Link & QR Code
                        </Button>

                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleConsultantStatus(cons.id)}
                            className="text-xs h-8"
                          >
                            {cons.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteConsultant(cons.id, cons.name)}
                            className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 text-xs h-8 px-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {(state.consultants || []).length === 0 && (
              <div className="text-center py-10 text-slate-500 text-sm">
                Nenhum consultor ou influencer cadastrado ainda. Clique em <strong>"Novo Consultor / Influencer"</strong> acima.
              </div>
            )}
          </div>

          {/* =====================================================================
              MODAL GERAR LINK DE INDICAÇÃO PERSONALIZADO + QR CODE (SCREENSHOT 4)
          ===================================================================== */}
          <Dialog
            open={!!selectedConsultantForLink}
            onOpenChange={(open) => !open && setSelectedConsultantForLink(null)}
          >
            <DialogContent className="max-w-xl p-6 space-y-4">
              {selectedConsultantForLink && (() => {
                const baseUrl = window.location.origin;
                const planParam =
                  linkPlanSelection !== 'TODOS' ? `&plano=${linkPlanSelection}` : '';
                const fullReferralLink = `${baseUrl}/planos?ref=${selectedConsultantForLink.referralCode}${planParam}`;
                const qrUrl = getQrCodeImageUrl(fullReferralLink, 280);

                return (
                  <div className="space-y-4">
                    <DialogHeader>
                      <DialogTitle className="text-base font-black text-slate-900 uppercase">
                        GERAR LINK DE INDICAÇÃO PF PERSONALIZADO
                      </DialogTitle>
                      <p className="text-xs text-slate-500">
                        Consultor / Influencer: <strong>{selectedConsultantForLink.name}</strong> (Código: {selectedConsultantForLink.referralCode})
                      </p>
                    </DialogHeader>

                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <Label className="text-xs font-bold text-slate-700">Selecione o plano:</Label>
                        <select
                          value={linkPlanSelection}
                          onChange={(e) => setLinkPlanSelection(e.target.value)}
                          className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs font-bold bg-white mt-1"
                        >
                          <option value="TODOS">Todos os Planos (Página Geral de Adesão)</option>
                          {(state.modalities || []).map((m) => (
                            <option key={m.code} value={m.code}>
                              {m.name} — Mensal: {formatCurrency(m.monthlyPrice)} / Anual: {formatCurrency(m.annualPrice)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label className="text-xs font-bold text-slate-700 mb-1 block">
                          Formas de Vendas Permitidas:
                        </Label>
                        <div className="flex flex-wrap gap-4 text-xs font-semibold">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={linkAllowedMethods.boleto}
                              onChange={(e) =>
                                setLinkAllowedMethods((p) => ({ ...p, boleto: e.target.checked }))
                              }
                              className="w-4 h-4 rounded text-emerald-700"
                            />
                            <span>Boleto Bancário</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={linkAllowedMethods.pix}
                              onChange={(e) =>
                                setLinkAllowedMethods((p) => ({ ...p, pix: e.target.checked }))
                              }
                              className="w-4 h-4 rounded text-emerald-700"
                            />
                            <span>PIX Online</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={linkAllowedMethods.creditCard}
                              onChange={(e) =>
                                setLinkAllowedMethods((p) => ({ ...p, creditCard: e.target.checked }))
                              }
                              className="w-4 h-4 rounded text-emerald-700"
                            />
                            <span>Cartão de Crédito</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={linkAllowedMethods.recurrence}
                              onChange={(e) =>
                                setLinkAllowedMethods((p) => ({ ...p, recurrence: e.target.checked }))
                              }
                              className="w-4 h-4 rounded text-emerald-700"
                            />
                            <span>Recorrência</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* LINK E QR CODE GERADOS */}
                    <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-3">
                      <div>
                        <Label className="text-xs font-bold text-emerald-950">Link Rastreado do Vendedor:</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            readOnly
                            value={fullReferralLink}
                            className="bg-white text-xs font-mono select-all h-9"
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(fullReferralLink);
                              toast({
                                title: 'Link copiado!',
                                description: 'O link de indicação foi copiado para a área de transferência.',
                              });
                            }}
                            className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs h-9 px-3 shrink-0"
                          >
                            <Copy className="w-3.5 h-3.5 mr-1" /> Copiar Link
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-4 pt-2 border-t border-emerald-200">
                        <img
                          src={qrUrl}
                          alt="QR Code do Consultor"
                          className="w-28 h-28 p-1 bg-white border border-emerald-300 rounded-xl shadow-sm"
                        />
                        <div className="space-y-1.5 text-xs text-emerald-950">
                          <strong className="block text-sm">QR Code Exclusivo de Indicação</strong>
                          <p className="text-[11px] text-emerald-800">
                            Aponte a câmera do celular para este QR Code para abrir direto a contratação com a comissão vinculada a <strong>{selectedConsultantForLink.name}</strong>.
                          </p>
                          <a
                            href={qrUrl}
                            download={`qrcode_${selectedConsultantForLink.referralCode}.png`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-xs font-bold border-emerald-600 text-emerald-900 h-8 mt-1"
                            >
                              Baixar Imagem QR Code
                            </Button>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* =====================================================================
            TAB 3: IMPRESSÃO MULTI-CARTÃO (4 CARTEIRINHAS FRENTE E VERSO)
        ===================================================================== */}
        <TabsContent value="impressao" className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Folha de Impressão de Carteirinhas (Frente + Verso Lado a Lado)
                </h3>
                <p className="text-xs text-slate-500">
                  Selecione os associados abaixo para montar a folha de impressão idêntica ao gabarito gráfico (4 por página ou quantos desejar).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSelectedMemberIdsForPrint(
                      allMembers.slice(0, 4).map((m) => m.id)
                    )
                  }
                >
                  Selecionar Primeiros 4
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedMemberIdsForPrint([])}
                >
                  Limpar Seleção ({selectedMemberIdsForPrint.length})
                </Button>
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-2xl p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 bg-slate-50">
              {allMembers.map((member) => {
                const checked = selectedMemberIdsForPrint.includes(member.id);
                return (
                  <div
                    key={member.id}
                    onClick={() => {
                      setSelectedMemberIdsForPrint((prev) =>
                        prev.includes(member.id)
                          ? prev.filter((id) => id !== member.id)
                          : [...prev, member.id]
                      );
                    }}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                      checked
                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div>{member.fullName}</div>
                      <div
                        className={`text-[10px] ${
                          checked ? 'text-emerald-100' : 'text-slate-400'
                        }`}
                      >
                        #{member.cardNumber} • {member.planCycleLabel}
                      </div>
                    </div>
                    <CheckSquare className="w-4 h-4 shrink-0" />
                  </div>
                );
              })}
            </div>

            {selectedMemberIdsForPrint.length > 0 && (
              <MultiCardPrintSheet
                members={allMembers.filter((m) =>
                  selectedMemberIdsForPrint.includes(m.id)
                )}
              />
            )}
          </div>
        </TabsContent>

        {/* =====================================================================
            TAB 4: FINANÇAS COMPLETO (IDÊNTICO AO MENU FINANÇAS DO LABCARD)
            • Fluxo Caixa | • Entrada de Caixa | • Saída Caixa |
            • Faturamento Mensal Previsto | • Mensalidades |
            • Cobranças Vencidas Por Mês | • Assinaturas Ativas |
            • Assinaturas Vencidas | • Baixas em Lote
        ===================================================================== */}
        <TabsContent value="financeiro" className="space-y-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-6 shadow-sm space-y-4 sm:space-y-6">
            {/* Sub-barra de ferramentas de Finanças */}
            <div className="flex items-center gap-1.5 border-b border-slate-200 pb-3 overflow-x-auto no-scrollbar sm:flex-wrap -mx-1 px-1">
              {(
                [
                  { id: 'FLUXO_CAIXA', label: 'Fluxo Caixa' },
                  { id: 'ENTRADA_CAIXA', label: 'Entrada de Caixa' },
                  { id: 'SAIDA_CAIXA', label: 'Saída Caixa' },
                  {
                    id: 'FATURAMENTO_PREVISTO',
                    label: 'Faturamento Mensal Previsto',
                  },
                  { id: 'MENSALIDADES', label: 'Mensalidades' },
                  {
                    id: 'VENCIDAS_POR_MES',
                    label: 'Cobranças Vencidas Por Mês',
                  },
                  { id: 'ASSINATURAS_ATIVAS', label: 'Assinaturas Ativas' },
                  { id: 'ASSINATURAS_VENCIDAS', label: 'Assinaturas Vencidas' },
                  { id: 'BAIXAS_EM_LOTE', label: 'Baixas em Lote' },
                ] as const
              ).map((tab) => (
                <Button
                  key={tab.id}
                  size="sm"
                  variant={financeSubView === tab.id ? 'default' : 'outline'}
                  onClick={() => setFinanceSubView(tab.id)}
                  className={`shrink-0 whitespace-nowrap text-xs ${
                    financeSubView === tab.id
                      ? 'bg-[#004d00] text-white font-bold'
                      : ''
                  }`}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {/* 1. FLUXO DE CAIXA / ENTRADA DE CAIXA / SAÍDA DE CAIXA */}
            {(financeSubView === 'FLUXO_CAIXA' ||
              financeSubView === 'ENTRADA_CAIXA' ||
              financeSubView === 'SAIDA_CAIXA') && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-emerald-700 block">
                        Total de Entradas
                      </span>
                      <span className="text-2xl font-black text-emerald-950">
                        {formatCurrency(cashFlowSummary.totalIn)}
                      </span>
                    </div>
                    <TrendingUp className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-rose-700 block">
                        Total de Saídas
                      </span>
                      <span className="text-2xl font-black text-rose-950">
                        {formatCurrency(cashFlowSummary.totalOut)}
                      </span>
                    </div>
                    <TrendingDown className="w-8 h-8 text-rose-600" />
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-emerald-300 block">
                        Saldo Líquido em Caixa
                      </span>
                      <span className="text-2xl font-black">
                        {formatCurrency(cashFlowSummary.balance)}
                      </span>
                    </div>
                    <Wallet className="w-8 h-8 text-emerald-400" />
                  </div>
                </div>

                {/* Formulário de Lançamento de Entrada ou Saída */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <h4 className="text-sm font-black uppercase text-slate-800">
                    {financeSubView === 'SAIDA_CAIXA'
                      ? 'Registrar Nova Saída de Caixa (Despesa / Pagamento)'
                      : 'Registrar Nova Entrada / Movimentação de Caixa'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-4">
                      <Label className="text-xs font-bold">Descrição *</Label>
                      <Input
                        value={cashDescription}
                        onChange={(e) => setCashDescription(e.target.value)}
                        placeholder="Ex: Recebimento avulso / Impressão de cartões..."
                        className="bg-white mt-1"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs font-bold">Valor (R$) *</Label>
                      <Input
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        placeholder="0,00"
                        className="bg-white mt-1"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs font-bold">Meio</Label>
                      <select
                        value={cashMethod}
                        onChange={(e) => setCashMethod(e.target.value)}
                        className="w-full h-10 rounded-md border border-slate-300 px-2 text-xs font-bold bg-white mt-1"
                      >
                        <option value="PIX">PIX</option>
                        <option value="DINHEIRO">Dinheiro</option>
                        <option value="CARTAO">Cartão</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs font-bold">Data</Label>
                      <Input
                        type="date"
                        value={cashDate}
                        onChange={(e) => setCashDate(e.target.value)}
                        className="bg-white mt-1"
                      />
                    </div>
                    <div className="sm:col-span-2 flex gap-1.5">
                      {financeSubView !== 'SAIDA_CAIXA' && (
                        <Button
                          type="button"
                          onClick={() => handleAddCashEntry('IN')}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                        >
                          + Entrada
                        </Button>
                      )}
                      {financeSubView !== 'ENTRADA_CAIXA' && (
                        <Button
                          type="button"
                          onClick={() => handleAddCashEntry('OUT')}
                          className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                        >
                          - Saída
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {cashFlowSummary.entries
                    .filter((e) =>
                      financeSubView === 'ENTRADA_CAIXA'
                        ? e.type === 'IN'
                        : financeSubView === 'SAIDA_CAIXA'
                        ? e.type === 'OUT'
                        : true
                    )
                    .map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between bg-white text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            className={
                              entry.type === 'IN'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-600 text-white'
                            }
                          >
                            {entry.type === 'IN' ? 'ENTRADA' : 'SAÍDA'}
                          </Badge>
                          <div>
                            <div className="font-bold text-slate-900">
                              {entry.description}
                            </div>
                            <div className="text-slate-500">
                              {formatDateBR(entry.date)} • {entry.category} •{' '}
                              {entry.paymentMethod}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`font-black text-sm ${
                            entry.type === 'IN'
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {entry.type === 'IN' ? '+' : '-'}{' '}
                          {formatCurrency(entry.amount)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 2. FATURAMENTO MENSAL PREVISTO */}
            {financeSubView === 'FATURAMENTO_PREVISTO' && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-emerald-950 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase text-emerald-300 block">
                      Receita Mensal Recorrente Prevista (Assinaturas Ativas)
                    </span>
                    <span className="text-3xl font-black">
                      {formatCurrency(
                        state.subscriptions
                          .filter((s) => s.status === 'ACTIVE')
                          .reduce((acc, s) => acc + s.monthlyEquivalent, 0)
                      )}
                      /mês
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-emerald-300 block">
                      Projeção Anualizada (12 meses)
                    </span>
                    <span className="text-xl font-black text-amber-300">
                      {formatCurrency(
                        state.subscriptions
                          .filter((s) => s.status === 'ACTIVE')
                          .reduce((acc, s) => acc + s.monthlyEquivalent * 12, 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. ASSINATURAS ATIVAS vs ASSINATURAS VENCIDAS */}
            {(financeSubView === 'ASSINATURAS_ATIVAS' ||
              financeSubView === 'ASSINATURAS_VENCIDAS') && (
              <div className="space-y-3">
                <h4 className="font-black text-sm text-slate-900 uppercase">
                  {financeSubView === 'ASSINATURAS_ATIVAS'
                    ? 'Relação Financeira de Assinaturas Ativas'
                    : 'Relação de Assinaturas Vencidas / Inativas'}
                </h4>
                {state.subscriptions
                  .filter((s) =>
                    financeSubView === 'ASSINATURAS_ATIVAS'
                      ? s.status === 'ACTIVE'
                      : s.status !== 'ACTIVE'
                  )
                  .map((sub) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50"
                    >
                      <div>
                        <div className="font-black text-sm text-slate-900">
                          {sub.holderName} (#{sub.subscriptionCode})
                        </div>
                        <div className="text-xs text-slate-600">
                          {sub.planSummaryLabel} • CPF: {sub.holderCpf}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-emerald-800">
                          {formatCurrency(sub.monthlyEquivalent)}/mês
                        </span>
                        <Button
                          size="sm"
                          onClick={() => {
                            setClientDetailTool('FINANCEIRO_CLIENTE');
                            setSelectedSubForDetail(sub);
                          }}
                          className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs"
                        >
                          <DollarSign className="w-3.5 h-3.5 mr-1" /> Perfil Financeiro
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setClientDetailTool('DADOS_CADASTRAIS');
                            setSelectedSubForDetail(sub);
                          }}
                          className="text-xs font-bold"
                        >
                          Cadastro
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* 4. MENSALIDADES / COBRANÇAS VENCIDAS POR MÊS / BAIXAS EM LOTE */}
            {(financeSubView === 'MENSALIDADES' ||
              financeSubView === 'VENCIDAS_POR_MES' ||
              financeSubView === 'BAIXAS_EM_LOTE') && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      {financeSubView === 'VENCIDAS_POR_MES'
                        ? 'Cobranças Vencidas / Pendentes Por Mês'
                        : financeSubView === 'BAIXAS_EM_LOTE'
                        ? 'Baixas em Lote de Mensalidades'
                        : 'Controle Geral de Mensalidades e PIX Asaas'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Selecione faturas para dar baixa em lote, clique em "Perfil Financeiro" para abrir o carnê completo do cliente, ou clique em "Dar Baixa Manual".
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedInvoiceKeys.length > 0 && (
                      <Button
                        size="sm"
                        onClick={handleBatchSettleInvoices}
                        className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirmar Baixa em Lote (
                        {selectedInvoiceKeys.length})
                      </Button>
                    )}
                    {(['ALL', 'PENDING', 'PAID', 'OVERDUE'] as const).map(
                      (st) => (
                        <Button
                          key={st}
                          size="sm"
                          variant={
                            invoiceStatusFilter === st ? 'default' : 'outline'
                          }
                          onClick={() => setInvoiceStatusFilter(st)}
                        >
                          {st === 'ALL'
                            ? 'Todas'
                            : st === 'PENDING'
                            ? 'Pendentes'
                            : st === 'PAID'
                            ? 'Pagas'
                            : 'Vencidas'}
                        </Button>
                      )
                    )}
                  </div>
                </div>

                <div className="space-y-2.5">
                  {allInvoicesWithSub
                    .filter(({ invoice }) => {
                      if (
                        financeSubView === 'VENCIDAS_POR_MES' &&
                        invoice.status === 'PAID'
                      ) {
                        return false;
                      }
                      if (
                        financeSubView === 'BAIXAS_EM_LOTE' &&
                        invoice.status === 'PAID'
                      ) {
                        return false;
                      }
                      return (
                        invoiceStatusFilter === 'ALL' ||
                        invoice.status === invoiceStatusFilter
                      );
                    })
                    .map(({ invoice, subscription }) => {
                      const key = `${subscription.id}::${invoice.id}`;
                      const isSelected = selectedInvoiceKeys.includes(key);
                      const isPaid = invoice.status === 'PAID';
                      return (
                        <div
                          key={key}
                          className="rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-50/60"
                        >
                          <div className="flex items-center gap-3">
                            {!isPaid && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedInvoiceKeys((prev) => [
                                      ...prev,
                                      key,
                                    ]);
                                  } else {
                                    setSelectedInvoiceKeys((prev) =>
                                      prev.filter((k) => k !== key)
                                    );
                                  }
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                              />
                            )}
                            <div>
                              <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setClientDetailTool('FINANCEIRO_CLIENTE');
                                    setSelectedSubForDetail(subscription);
                                  }}
                                  className="hover:underline hover:text-emerald-800 text-left font-black"
                                >
                                  {subscription.holderName}
                                </button>
                                <Badge
                                  className={
                                    isPaid
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-amber-500 text-white'
                                  }
                                >
                                  {isPaid ? 'PAGA' : 'PENDENTE'}
                                </Badge>
                              </div>
                              <div className="text-xs text-slate-500">
                                {invoice.description} • Ref:{' '}
                                <strong>{invoice.referenceMonth}</strong> • Vencimento:{' '}
                                <strong>{formatDateBR(invoice.dueDate)}</strong> • CPF:{' '}
                                {subscription.holderCpf}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-slate-900 mr-2">
                              {formatCurrency(invoice.amount)}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setClientDetailTool('FINANCEIRO_CLIENTE');
                                setSelectedSubForDetail(subscription);
                              }}
                              className="border-emerald-600 text-emerald-900 font-bold text-xs"
                            >
                              <DollarSign className="w-3.5 h-3.5 mr-1 text-emerald-700" />{' '}
                              Perfil Financeiro
                            </Button>
                            {!isPaid && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    const next = await markClubInvoicePaid(
                                      subscription.id,
                                      invoice.id,
                                      'LOCAL'
                                    );
                                    setState(next);
                                    toast({
                                      title: 'Fatura baixada com sucesso!',
                                      description: `Assinatura de ${subscription.holderName} ativada.`,
                                    });
                                  }}
                                  className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs"
                                >
                                  Dar Baixa Manual
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      const charge =
                                        await generateAsaasChargeForClubInvoice(
                                          subscription,
                                          invoice,
                                          'PIX'
                                        );
                                      if (charge.invoiceUrl) {
                                        window.open(charge.invoiceUrl, '_blank');
                                      }
                                    } catch (err: any) {
                                      toast({
                                        title: 'Erro ao gerar link Asaas',
                                        description: err?.message,
                                        variant: 'destructive',
                                      });
                                    }
                                  }}
                                  className="text-xs"
                                >
                                  Gerar PIX Asaas
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* =====================================================================
            TAB RELATÓRIOS COMPLETO (IDÊNTICO AO MENU RELATÓRIOS DO LABCARD)
            ▶ Clientes (10 sub-relatórios) | ▶ Consultores | ▶ Influencer | ▶ Empresas |
            ▶ Agenda | ▶ SMS's | ▶ Outros (6 sub-relatórios)
        ===================================================================== */}
        <TabsContent value="relatorios" className="space-y-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap -mx-1 px-1">
                {(
                  [
                    { id: 'CLIENTES', label: '▶ Clientes' },
                    { id: 'CONSULTORES', label: '▶ Consultores' },
                    { id: 'INFLUENCER', label: '▶ Influencer' },
                    { id: 'EMPRESAS', label: '▶ Empresas' },
                    { id: 'AGENDA', label: '▶ Agenda' },
                    { id: 'SMS', label: "▶ SMS's / WhatsApp" },
                    { id: 'OUTROS', label: '▶ Outros' },
                  ] as const
                ).map((r) => (
                  <Button
                    key={r.id}
                    size="sm"
                    variant={reportSubView === r.id ? 'default' : 'outline'}
                    onClick={() => setReportSubView(r.id)}
                    className={`shrink-0 whitespace-nowrap text-xs ${
                      reportSubView === r.id
                        ? 'bg-[#004d00] text-white font-bold'
                        : ''
                    }`}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>

              <Button
                size="sm"
                onClick={() => handleExportReportXlsx(reportSubView)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs w-full sm:w-auto shrink-0 justify-center"
              >
                <Download className="w-4 h-4 mr-1.5" /> Exportar Relatório Excel (.xlsx)
              </Button>
            </div>

            {/* BARRA DE FILTROS AVANÇADOS GLOBAIS DE RELATÓRIO */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-emerald-800" />
                  <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
                    Filtros Avançados de Relatórios
                  </span>
                </div>
                {(reportStartDate ||
                  reportEndDate ||
                  reportAgeGroup !== 'TODOS' ||
                  reportPlanCode !== 'TODOS' ||
                  reportCategory !== 'TODOS' ||
                  reportStatus !== 'TODOS') && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setReportStartDate('');
                      setReportEndDate('');
                      setReportAgeGroup('TODOS');
                      setReportPlanCode('TODOS');
                      setReportCategory('TODOS');
                      setReportStatus('TODOS');
                    }}
                    className="text-xs font-bold text-rose-700 hover:bg-rose-50 h-7 px-2"
                  >
                    ✕ Limpar Todos os Filtros
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 text-xs">
                {/* Data Início */}
                <div>
                  <Label className="text-[11px] font-bold text-slate-600">Período De:</Label>
                  <Input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="h-8 bg-white text-xs mt-1"
                  />
                </div>

                {/* Data Fim */}
                <div>
                  <Label className="text-[11px] font-bold text-slate-600">Período Até:</Label>
                  <Input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="h-8 bg-white text-xs mt-1"
                  />
                </div>

                {/* Idades / Faixa Etária */}
                <div>
                  <Label className="text-[11px] font-bold text-slate-600">Faixa Etária / Idade:</Label>
                  <select
                    value={reportAgeGroup}
                    onChange={(e) => setReportAgeGroup(e.target.value as any)}
                    className="w-full h-8 rounded-md border border-slate-300 px-2 text-xs font-bold bg-white mt-1"
                  >
                    <option value="TODOS">Todas as Idades</option>
                    <option value="KIDS">Crianças (0 a 12 anos)</option>
                    <option value="TEENS">Adolescentes (13 a 17 anos)</option>
                    <option value="ADULTS">Adultos (18 a 59 anos)</option>
                    <option value="SENIORS">Idosos (60+ anos)</option>
                  </select>
                </div>

                {/* Planos */}
                <div>
                  <Label className="text-[11px] font-bold text-slate-600">Plano:</Label>
                  <select
                    value={reportPlanCode}
                    onChange={(e) => setReportPlanCode(e.target.value)}
                    className="w-full h-8 rounded-md border border-slate-300 px-2 text-xs font-bold bg-white mt-1"
                  >
                    <option value="TODOS">Todos os Planos</option>
                    {(state.modalities || []).map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Categoria */}
                <div>
                  <Label className="text-[11px] font-bold text-slate-600">Categoria:</Label>
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value as any)}
                    className="w-full h-8 rounded-md border border-slate-300 px-2 text-xs font-bold bg-white mt-1"
                  >
                    <option value="TODOS">Titulares + Dependentes</option>
                    <option value="TITULARES">Apenas Titulares</option>
                    <option value="DEPENDENTES">Apenas Dependentes</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <Label className="text-[11px] font-bold text-slate-600">Status:</Label>
                  <select
                    value={reportStatus}
                    onChange={(e) => setReportStatus(e.target.value as any)}
                    className="w-full h-8 rounded-md border border-slate-300 px-2 text-xs font-bold bg-white mt-1"
                  >
                    <option value="TODOS">Todos os Status</option>
                    <option value="ACTIVE">Ativos / Adimplentes</option>
                    <option value="INACTIVE">Inativos</option>
                    <option value="OVERDUE">Inadimplentes / Vencidos</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SUB-FILTROS DE ▶ CLIENTES (10 OPÇÕES DA IMAGEM) */}
            {reportSubView === 'CLIENTES' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  {(
                    [
                      { id: 'LISTAGEM', label: '• Listagem' },
                      {
                        id: 'PERIODO_ATIVOS',
                        label: '• Clientes por Período Ativos',
                      },
                      { id: 'POR_CIDADES', label: '• Clientes por Cidades' },
                      { id: 'CONTRATO_RECEBIDO', label: '• Contrato Recebido' },
                      { id: 'CONTRATOS_GERADOS', label: '• Contratos Gerados' },
                      { id: 'FAIXA_ETARIA', label: '• Por Faixa Etária' },
                      { id: 'ADICIONAIS', label: '• Adicionais (Dependentes)' },
                      { id: 'ADIMPLENTES', label: '• Adimplentes' },
                      { id: 'INADIMPLENTES', label: '• Inadimplentes' },
                      { id: 'A_RENOVAR', label: '• A Renovar' },
                    ] as const
                  ).map((cf) => (
                    <Button
                      key={cf.id}
                      size="sm"
                      variant={
                        clientReportSubFilter === cf.id ? 'default' : 'outline'
                      }
                      onClick={() => setClientReportSubFilter(cf.id)}
                      className={
                        clientReportSubFilter === cf.id
                          ? 'bg-emerald-800 text-white font-bold text-xs h-8'
                          : 'text-xs h-8'
                      }
                    >
                      {cf.label}
                    </Button>
                  ))}
                </div>

                {clientReportSubFilter === 'POR_CIDADES' ? (
                  <div className="space-y-2">
                    <h4 className="font-black text-sm text-slate-900">
                      Relatório de Clientes por Cidades
                    </h4>
                    {Array.from(
                      new Set(
                        (state.subscriptions || []).map(
                          (s) => `${s.addressCity || 'Ariquemes'} - ${s.addressState || 'RO'}`
                        )
                      )
                    ).map((cidadeUf) => {
                      const count = (state.subscriptions || []).filter(
                        (s) =>
                          `${s.addressCity || 'Ariquemes'} - ${s.addressState || 'RO'}` ===
                          cidadeUf
                      ).length;
                      return (
                        <div
                          key={cidadeUf}
                          className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50 text-xs"
                        >
                          <span className="font-bold text-slate-900">
                            📍 {cidadeUf}
                          </span>
                          <Badge className="bg-emerald-700 text-white">
                            {count} Titular(es)
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : clientReportSubFilter === 'ADICIONAIS' ? (
                  <div className="space-y-2">
                    <h4 className="font-black text-sm text-slate-900">
                      Relatório de Adicionais / Dependentes Cadastrados
                    </h4>
                    {state.subscriptions
                      .flatMap((s) =>
                        s.members
                          .filter((m) => m.role === 'DEPENDENTE')
                          .map((m) => ({ member: m, sub: s }))
                      )
                      .map(({ member, sub }) => (
                        <div
                          key={member.id}
                          className="p-3 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50 text-xs"
                        >
                          <div>
                            <strong>{member.fullName}</strong> (Cartão #
                            {member.cardNumber}) • Modalidade:{' '}
                            <strong>{member.modalityName}</strong>
                            <span className="text-slate-500 ml-2">
                              (Titular: {sub.holderName})
                            </span>
                          </div>
                          <Badge variant="outline">
                            {formatCurrency(member.monthlyPrice)}/mês
                          </Badge>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h4 className="font-black text-sm text-slate-900">
                      Relatório de Clientes — Filtro: {clientReportSubFilter}
                    </h4>
                    {getFilteredReportSubscriptions()
                      .filter((s) => {
                        if (clientReportSubFilter === 'PERIODO_ATIVOS')
                          return s.status === 'ACTIVE';
                        if (clientReportSubFilter === 'ADIMPLENTES')
                          return s.status === 'ACTIVE';
                        if (clientReportSubFilter === 'INADIMPLENTES')
                          return (
                            s.status === 'INACTIVE' ||
                            s.status === 'OVERDUE' ||
                            s.status === 'PENDING'
                          );
                        if (clientReportSubFilter === 'CONTRATO_RECEBIDO')
                          return s.status === 'ACTIVE';
                        return true;
                      })
                      .map((sub) => (
                        <div
                          key={sub.id}
                          className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50 text-xs"
                        >
                          <div>
                            <strong className="text-slate-900">
                              {sub.holderName}
                            </strong>{' '}
                            (#{sub.subscriptionCode}) • CPF: {sub.holderCpf} •{' '}
                            {sub.planSummaryLabel} • Cidade: {sub.addressCity}/
                            {sub.addressState}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              className={
                                sub.status === 'ACTIVE'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-rose-600 text-white'
                              }
                            >
                              {sub.status === 'ACTIVE' ? 'ATIVO' : 'INATIVO'}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedSubForDetail(sub)}
                              className="h-7 text-xs"
                            >
                              Abrir
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* SUB-FILTROS DE ▶ OUTROS (6 OPÇÕES DA IMAGEM) */}
            {reportSubView === 'OUTROS' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  {(
                    [
                      { id: 'PLANOS', label: '▶ Planos' },
                      { id: 'CARNES_ACABANDO', label: '• Carnês Acabando' },
                      {
                        id: 'SEM_FINANCEIRO',
                        label: '• Clientes Sem Financeiro',
                      },
                      { id: 'CARTAO_EMISSAO', label: '• Cartão - (emissão)' },
                      {
                        id: 'CARTAO_VENCIMENTO',
                        label: '• Cartão - (vencimento)',
                      },
                      { id: 'LOGS', label: "• Log's" },
                    ] as const
                  ).map((of) => (
                    <Button
                      key={of.id}
                      size="sm"
                      variant={
                        otherReportSubFilter === of.id ? 'default' : 'outline'
                      }
                      onClick={() => setOtherReportSubFilter(of.id)}
                      className={
                        otherReportSubFilter === of.id
                          ? 'bg-emerald-800 text-white font-bold text-xs h-8'
                          : 'text-xs h-8'
                      }
                    >
                      {of.label}
                    </Button>
                  ))}
                </div>

                {otherReportSubFilter === 'PLANOS' ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={
                            planosReportFilter === 'TODOS' ? 'default' : 'outline'
                          }
                          onClick={() => setPlanosReportFilter('TODOS')}
                          className={
                            planosReportFilter === 'TODOS'
                              ? 'bg-[#004d00] text-white font-bold text-xs h-8 shadow-sm'
                              : 'text-xs h-8'
                          }
                        >
                          • Todos os Planos
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            planosReportFilter === 'CORTESIA'
                              ? 'default'
                              : 'outline'
                          }
                          onClick={() => setPlanosReportFilter('CORTESIA')}
                          className={
                            planosReportFilter === 'CORTESIA'
                              ? 'bg-[#004d00] text-white font-bold text-xs h-8 shadow-sm'
                              : 'text-xs h-8'
                          }
                        >
                          • Cortesia / Gratuidades (PCD/TEA, Idoso, Kids)
                        </Button>
                      </div>

                      <Button
                        size="sm"
                        onClick={() =>
                          setEditingModality({
                            id: `mod_${Date.now()}`,
                            code: `PLANO_${Date.now()}`,
                            name: '',
                            subtitle: 'Acesso e lazer familiar',
                            verse: '',
                            monthlyPrice: 49.9,
                            annualPrice: 538.92,
                            annualInstallment: 44.91,
                            adhesionFee: 0,
                            maxDependents: 99,
                            gracePeriodDays: 0,
                            frontCardUrl: '/cards/44.png',
                            dependentFrontCardUrl: '/cards/44.png',
                            backCardUrl: '/cards/24.png',
                            dependentBackCardUrl: '/cards/24.png',
                            requiresDocument: false,
                            isFreeTier: false,
                            visibleOnSite: true,
                            visibleInSimulator: true,
                            visibleOnTotem: true,
                            visibleToConsultants: true,
                            visibleToInfluencers: true,
                            addExistingConsultants: true,
                            addExistingInfluencers: true,
                            telemedicina: false,
                            planType: 'NORMAL',
                            recurrenceType: 'MENSAL',
                            benefits: [
                              'Acesso ilimitado às áreas do Balneário nos dias e horários de funcionamento',
                              'Sem taxa de adesão',
                              'Carteirinha digital e física personalizada com QR Code',
                              'Desconto especial para familiares e convidados',
                            ],
                            contractType: 'ADESAO_PF',
                            active: true,
                          })
                        }
                        className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs h-8 shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> + Cadastrar Novo Plano
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {state.modalities
                        .filter((m) =>
                          planosReportFilter === 'CORTESIA'
                            ? m.isFreeTier || m.monthlyPrice === 0
                            : true
                        )
                        .map((m) => {
                          const subCount = (state.subscriptions || []).filter((s) =>
                            s.members.some(
                              (mem) => mem.modalityCode === m.code
                            )
                          ).length;

                          return (
                            <div
                              key={m.id}
                              onClick={() => setEditingModality(m)}
                              className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-600 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-3">
                                {m.frontCardUrl && (
                                  <img
                                    src={m.frontCardUrl}
                                    alt={m.name}
                                    className="w-14 h-9 rounded object-cover border border-slate-200 shadow-sm shrink-0"
                                  />
                                )}
                                <div>
                                  <strong className="text-slate-900 flex items-center gap-1.5 text-sm group-hover:text-emerald-800 transition-colors">
                                    {m.name || 'Plano Sem Nome'}
                                    {(m.isFreeTier || m.monthlyPrice === 0) && (
                                      <Badge className="bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                        CORTESIA / GRÁTIS
                                      </Badge>
                                    )}
                                    {m.planType && (
                                      <Badge variant="outline" className="text-[9px] font-mono">
                                        {m.planType}
                                      </Badge>
                                    )}
                                  </strong>
                                  <div className="text-slate-500 text-xs mt-0.5">
                                    Valor: <strong>{formatCurrency(m.monthlyPrice)}/mês</strong> • Anual:{' '}
                                    {formatCurrency(m.annualPrice)}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Badge className="bg-emerald-800 text-white font-bold text-xs px-2.5 py-1">
                                  {subCount} adesões
                                </Badge>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs font-bold text-emerald-800 hover:bg-emerald-50 h-8"
                                >
                                  <Edit3 className="w-3.5 h-3.5 mr-1" /> Alterar
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : otherReportSubFilter === 'LOGS' ? (
                  <div className="space-y-2">
                    <h4 className="font-black text-sm text-slate-900">
                      Log's de Auditoria e Emissões do Sistema
                    </h4>
                    {(state.subscriptions || []).map((sub) => (
                      <div
                        key={sub.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs flex items-center justify-between"
                      >
                        <span>
                          <strong>[{formatDateBR(sub.createdAt)}]</strong>{' '}
                          Assinatura #{sub.subscriptionCode} ({sub.holderName}) —
                          Origem: <strong>{sub.origin}</strong>
                        </span>
                        <Badge variant="outline">{sub.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h4 className="font-black text-sm text-slate-900">
                      Relatório: {otherReportSubFilter}
                    </h4>
                    {(state.subscriptions || []).map((sub) => (
                      <div
                        key={sub.id}
                        className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50 text-xs"
                      >
                        <div>
                          <strong>{sub.holderName}</strong> • Cartão #
                          {sub.subscriptionCode} • Emissão:{' '}
                          {formatDateBR(sub.startDate)} • Vencimento:{' '}
                          <strong>{formatDateBR(sub.endDate)}</strong>
                        </div>
                        <Badge variant="outline">
                          {sub.members.length} cartão(ões)
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {reportSubView === 'SMS' && (
              <div className="space-y-4">
                <h4 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-700" /> Central de Avisos SMS / WhatsApp para Associados
                </h4>
                <Textarea
                  rows={3}
                  value={smsTemplate}
                  onChange={(e) => setSmsTemplate(e.target.value)}
                  className="text-xs"
                />
                <div className="space-y-2">
                  {(state.subscriptions || []).map((sub) => {
                    const msg = smsTemplate
                      .replace('{NOME}', sub.holderName)
                      .replace('{CARTAO}', sub.subscriptionCode);
                    const phoneDigits = sub.holderPhone.replace(/\D/g, '');
                    return (
                      <div
                        key={sub.id}
                        className="p-3 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50 text-xs"
                      >
                        <div>
                          <strong>{sub.holderName}</strong> • {sub.holderPhone} •
                          Cartão #{sub.subscriptionCode}
                        </div>
                        <a
                          href={`https://wa.me/55${phoneDigits}?text=${encodeURIComponent(
                            msg
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                          >
                            Enviar Aviso
                          </Button>
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {reportSubView === 'AGENDA' && (
              <div className="space-y-3">
                <h4 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-700" /> Agenda de Renovações de Contratos e Vencimentos
                </h4>
                {(state.subscriptions || []).map((sub) => (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50 text-xs"
                  >
                    <div>
                      <strong>{sub.holderName}</strong> — {sub.planSummaryLabel}
                    </div>
                    <div className="text-slate-600">
                      Início: <strong>{formatDateBR(sub.startDate)}</strong> •
                      Vencimento do Contrato:{' '}
                      <strong className="text-emerald-800">
                        {formatDateBR(sub.endDate)}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {reportSubView === 'CONSULTORES' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <Button
                    size="sm"
                    variant={
                      consultantReportSubFilter === 'COMISSAO'
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() => setConsultantReportSubFilter('COMISSAO')}
                    className={
                      consultantReportSubFilter === 'COMISSAO'
                        ? 'bg-[#004d00] text-white font-bold text-xs h-8'
                        : 'text-xs h-8'
                    }
                  >
                    • Comissão de Consultores
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      consultantReportSubFilter === 'LISTA_CADASTRO'
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() =>
                      setConsultantReportSubFilter('LISTA_CADASTRO')
                    }
                    className={
                      consultantReportSubFilter === 'LISTA_CADASTRO'
                        ? 'bg-[#004d00] text-white font-bold text-xs h-8'
                        : 'text-xs h-8'
                    }
                  >
                    • Lista de Cadastro de Consultores
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {state.consultants
                    .filter((c) => c.role === 'CONSULTOR')
                    .map((cons) => {
                      const linkedSubs = (state.subscriptions || []).filter(
                        (s) =>
                          (s.consultantName || '')
                            .toLowerCase()
                            .includes(cons.name.toLowerCase()) ||
                          (s.consultantName || '')
                            .toLowerCase()
                            .includes(cons.referralCode.toLowerCase())
                      );
                      const totalSales = linkedSubs.reduce(
                        (acc, s) => acc + s.totalContractValue,
                        0
                      );
                      const totalCommission =
                        (totalSales * (cons.commissionPercent || 10)) / 100;
                      return (
                        <div
                          key={cons.id}
                          className="p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 text-xs"
                        >
                          <div>
                            <div className="font-black text-sm text-slate-900 flex items-center gap-2">
                              {cons.name}
                              <Badge variant="outline">
                                Código: {cons.referralCode}
                              </Badge>
                            </div>
                            <div className="text-slate-600 mt-0.5">
                              CPF: {cons.cpf} • Tel: {cons.phone || '—'} •
                              Comissão: <strong>{cons.commissionPercent}%</strong>
                            </div>
                          </div>
                          {consultantReportSubFilter === 'COMISSAO' ? (
                            <div className="text-right">
                              <div className="text-[11px] text-slate-500">
                                {linkedSubs.length} venda(s) • Total Contratos:{' '}
                                {formatCurrency(totalSales)}
                              </div>
                              <div className="text-sm font-black text-emerald-700">
                                Comissão a Pagar:{' '}
                                {formatCurrency(totalCommission)}
                              </div>
                            </div>
                          ) : (
                            <Badge className="bg-emerald-700 text-white">
                              {cons.status === 'ACTIVE' ? 'ATIVO' : 'INATIVO'} •{' '}
                              {linkedSubs.length} cliente(s)
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {reportSubView === 'INFLUENCER' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <Button
                    size="sm"
                    variant={
                      influencerReportSubFilter === 'LISTA_CADASTRO'
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() =>
                      setInfluencerReportSubFilter('LISTA_CADASTRO')
                    }
                    className={
                      influencerReportSubFilter === 'LISTA_CADASTRO'
                        ? 'bg-[#004d00] text-white font-bold text-xs h-8'
                        : 'text-xs h-8'
                    }
                  >
                    • Lista de Cadastro de Influencers
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      influencerReportSubFilter === 'COMISSAO'
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() => setInfluencerReportSubFilter('COMISSAO')}
                    className={
                      influencerReportSubFilter === 'COMISSAO'
                        ? 'bg-[#004d00] text-white font-bold text-xs h-8'
                        : 'text-xs h-8'
                    }
                  >
                    • Comissão / Indicações Influencer
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {state.consultants
                    .filter((c) => c.role === 'INFLUENCER')
                    .map((inf) => {
                      const linkedSubs = (state.subscriptions || []).filter(
                        (s) =>
                          (s.influencerName || s.consultantName || '')
                            .toLowerCase()
                            .includes(inf.name.toLowerCase()) ||
                          (s.influencerName || s.consultantName || '')
                            .toLowerCase()
                            .includes(inf.referralCode.toLowerCase())
                      );
                      return (
                        <div
                          key={inf.id}
                          className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between bg-slate-50 text-xs"
                        >
                          <div>
                            <div className="font-black text-sm text-slate-900 flex items-center gap-2">
                              {inf.name}
                              <Badge className="bg-amber-600 text-white">
                                INFLUENCER • {inf.referralCode}
                              </Badge>
                            </div>
                            <div className="text-slate-600 mt-0.5">
                              CPF: {inf.cpf} • Tel: {inf.phone || '—'} •
                              Comissão: <strong>{inf.commissionPercent}%</strong>
                            </div>
                          </div>
                          <Badge className="bg-emerald-700 text-white">
                            {linkedSubs.length} indicação(ões)
                          </Badge>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {reportSubView === 'EMPRESAS' && (
              <div className="space-y-3">
                <h4 className="font-black text-base text-slate-900">
                  Relatório Detalhado: Empresas Conveniadas (PJ)
                </h4>
                {state.subscriptions
                  .filter((s) => s.personType === 'PJ')
                  .map((sub) => (
                    <div
                      key={sub.id}
                      className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50 text-xs"
                    >
                      <div>
                        <strong>{sub.holderName}</strong> • CNPJ:{' '}
                        {sub.holderCpf} • {sub.members.length} colaborador(es)
                      </div>
                      <Badge className="bg-emerald-700 text-white">
                        {formatCurrency(sub.monthlyEquivalent)}/mês
                      </Badge>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 5: CONFIG. (Config. Cartão | Planos | Adicionais | Contratos | Termo de Uso - Site | OUTROS...) */}
        <TabsContent value="planos_contratos" className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-2.5 sm:p-4 shadow-sm flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap -mx-1 px-1">
            {(
              [
                { id: 'CONFIG_CARTAO', label: '• Config. Cartão' },
                { id: 'PLANOS', label: '• Planos' },
                { id: 'ADICIONAIS', label: '• Adicionais' },
                { id: 'TERMO_USO_SITE', label: '• Termo de Uso - Site' },
                { id: 'CONTRATOS', label: '• Contratos Oficiais' },
                { id: 'FORMAS_PG', label: '• Formas PG' },
                { id: 'CATEGORIAS', label: '• Categorias' },
                { id: 'ESPECIALIDADES', label: '• Especialidades' },
                { id: 'SERVICOS', label: '• Serviços' },
                { id: 'PROFISSIONAIS', label: '• Profissionais' },
                { id: 'EXCLUIR_CLIENTES', label: '• Excluir Clientes' },
              ] as const
            ).map((cfg) => (
              <Button
                key={cfg.id}
                size="sm"
                variant={configSection === cfg.id ? 'default' : 'outline'}
                onClick={() => setConfigSection(cfg.id)}
                className={`shrink-0 whitespace-nowrap text-xs ${
                  configSection === cfg.id
                    ? 'bg-[#004d00] text-white font-bold'
                    : ''
                }`}
              >
                {cfg.label}
              </Button>
            ))}
          </div>

          {configSection === 'EXCLUIR_CLIENTES' && (
            <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-black text-rose-900">
                Excluir Clientes / Cadastros de Teste
              </h3>
              <p className="text-xs text-slate-600">
                Selecione um cadastro abaixo caso deseje removê-lo permanentemente da base:
              </p>
              <div className="space-y-2">
                {(state.subscriptions || []).map((sub) => (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50 text-xs"
                  >
                    <div>
                      <strong>{sub.holderName}</strong> (#{sub.subscriptionCode}) • CPF:{' '}
                      {sub.holderCpf} • Status: <strong>{sub.status}</strong>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setClientToDelete(sub)}
                      className="h-8 text-xs font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE CLIENTE */}
          <Dialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base font-black text-rose-700 flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-rose-600" /> Confirmar Exclusão de Cliente
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2 text-xs text-slate-700">
                <p>
                  Tem certeza que deseja excluir permanentemente o cadastro de:
                </p>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <div className="font-bold text-sm text-rose-950">
                    {clientToDelete?.holderName}
                  </div>
                  <div className="text-[11px] text-rose-800">
                    Cartão: <strong>#{clientToDelete?.subscriptionCode}</strong> • CPF: <strong>{clientToDelete?.holderCpf}</strong>
                  </div>
                  <div className="text-[11px] text-rose-700">
                    Plano: {clientToDelete?.planSummaryLabel} ({clientToDelete?.invoices.length || 0} faturas vinculadas)
                  </div>
                </div>
                <p className="text-slate-500 font-medium">
                  ⚠️ Esta ação é irreversível e removerá todas as carteirinhas, dependentes, histórico financeiro e parcelas deste cliente.
                </p>
              </div>
              <DialogFooter className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setClientToDelete(null)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    if (!clientToDelete || !state) return;
                    const nextState: ClubDatabaseState = {
                      ...state,
                      subscriptions: (state.subscriptions || []).filter(
                        (s) => s.id !== clientToDelete.id
                      ),
                    };
                    await persist(nextState);
                    toast({
                      title: 'Cliente excluído com sucesso!',
                      description: clientToDelete.holderName,
                    });
                    if (selectedSubForDetail?.id === clientToDelete.id) {
                      setSelectedSubForDetail(null);
                    }
                    setClientToDelete(null);
                  }}
                  className="text-xs font-bold bg-rose-600 hover:bg-rose-700"
                >
                  Sim, Excluir Cadastro
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {(configSection === 'FORMAS_PG' ||
            configSection === 'CATEGORIAS' ||
            configSection === 'ESPECIALIDADES' ||
            configSection === 'SERVICOS' ||
            configSection === 'PROFISSIONAIS') && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-black text-slate-900">
                Configuração Auxiliar — {configSection}
              </h3>
              {configSection === 'FORMAS_PG' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
                    <strong className="block text-emerald-950 text-sm mb-1">
                      1. PIX Integral / Recorrente
                    </strong>
                    Habilitado para Planos Anuais (Valor Integral) e Planos Mensais (12 cobranças recorrentes).
                  </div>
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
                    <strong className="block text-emerald-950 text-sm mb-1">
                      2. Cartão de Crédito (1x até 12x)
                    </strong>
                    Habilitado para Planos Anuais (parcelado em até 12x) e Planos Mensais (cobrança recorrente).
                  </div>
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
                    <strong className="block text-emerald-950 text-sm mb-1">
                      3. Cartão de Débito (Somente Mensal)
                    </strong>
                    Habilitado exclusivamente para Planos Mensais (12 cobranças mensais). Bloqueado no Anual.
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  Módulo <strong>{configSection}</strong> ativo e integrado aos cadastros de planos, serviços adicionais e parceiros do Balneário Lessa.
                </p>
              )}
            </div>
          )}

          {configSection === 'TERMO_USO_SITE' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Termo de Uso - Site (/planos)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Texto apresentado no momento do aceite digital no portal público de planos.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    toast({
                      title: 'Termo de Uso do Site salvo!',
                      description: 'Atualizado com sucesso.',
                    })
                  }
                  className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold"
                >
                  Salvar Termo de Uso
                </Button>
              </div>
              <Textarea
                rows={7}
                value={siteTermsText}
                onChange={(e) => setSiteTermsText(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          )}

          {/* SEÇÃO ADICIONAIS: PRODUTOS E SERVIÇOS DO BALNEÁRIO LESSA */}
          {configSection === 'ADICIONAIS' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Catálogo de Adicionais — Produtos & Serviços do Balneário Lessa
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gerencie quiosques, churrasqueiras, passeios de caiaque, coletes, camping, porções e serviços extras.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    setEditingCatalogService({
                      id: `srv_${Date.now()}`,
                      name: '',
                      category: 'ESTRUTURA',
                      price: 30,
                      description: '',
                      active: true,
                    })
                  }
                  className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> + Novo Produto / Serviço
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(state.catalogServices || []).map((srv) => (
                  <div
                    key={srv.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-3 shadow-sm hover:border-emerald-300 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-[10px] font-bold text-slate-600">
                          {srv.category}
                        </Badge>
                        <span className="text-sm font-black text-emerald-800">
                          {formatCurrency(srv.price)}
                        </span>
                      </div>
                      <h4 className="font-black text-slate-900 text-sm mt-1.5">
                        {srv.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {srv.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingCatalogService(srv)}
                        className="h-7 text-xs font-bold"
                      >
                        <Edit3 className="w-3 h-3 mr-1" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm(`Deseja excluir "${srv.name}"?`)) return;
                          const updated = (state.catalogServices || []).filter((s) => s.id !== srv.id);
                          await persist({ ...state, catalogServices: updated });
                          toast({ title: 'Item removido do catálogo' });
                        }}
                        className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 h-7 text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Modal de Cadastro / Edição de Serviço do Balneário */}
              <Dialog
                open={!!editingCatalogService}
                onOpenChange={(o) => !o && setEditingCatalogService(null)}
              >
                <DialogContent className="max-w-md p-6 space-y-4">
                  {editingCatalogService && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const current = state.catalogServices || [];
                        const exists = current.some((s) => s.id === editingCatalogService.id);
                        const next = exists
                          ? current.map((s) =>
                              s.id === editingCatalogService.id ? editingCatalogService : s
                            )
                          : [editingCatalogService, ...current];
                        await persist({ ...state, catalogServices: next });
                        setEditingCatalogService(null);
                        toast({ title: 'Catálogo de Serviços Atualizado com Sucesso!' });
                      }}
                      className="space-y-4"
                    >
                      <DialogHeader>
                        <DialogTitle className="text-base font-black text-slate-900 uppercase">
                          {state.catalogServices?.some((s) => s.id === editingCatalogService.id)
                            ? 'Editar Produto / Serviço'
                            : 'Cadastrar Produto / Serviço'}
                        </DialogTitle>
                      </DialogHeader>

                      <div className="space-y-3 text-xs font-bold text-slate-700">
                        <div>
                          <Label className="text-xs font-bold">Nome do Serviço / Produto *</Label>
                          <Input
                            value={editingCatalogService.name}
                            onChange={(e) =>
                              setEditingCatalogService({
                                ...editingCatalogService,
                                name: e.target.value,
                              })
                            }
                            placeholder="Ex: Quiosque com Churrasqueira"
                            className="bg-white mt-1"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs font-bold">Categoria</Label>
                            <select
                              value={editingCatalogService.category}
                              onChange={(e) =>
                                setEditingCatalogService({
                                  ...editingCatalogService,
                                  category: e.target.value,
                                })
                              }
                              className="w-full h-10 rounded-md border border-slate-300 px-2 text-xs font-bold bg-white mt-1"
                            >
                              <option value="ESTRUTURA">Estrutura</option>
                              <option value="ALUGUEL">Aluguel / Esporte</option>
                              <option value="ENTRADA">Entrada / Pulseira</option>
                              <option value="CONSUMO">Consumo / Bebidas</option>
                              <option value="OUTROS">Outros Serviços</option>
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs font-bold">Valor (R$) *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editingCatalogService.price}
                              onChange={(e) =>
                                setEditingCatalogService({
                                  ...editingCatalogService,
                                  price: Number(e.target.value),
                                })
                              }
                              className="bg-white mt-1"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs font-bold">Descrição / Regras de Uso</Label>
                          <Textarea
                            rows={3}
                            value={editingCatalogService.description}
                            onChange={(e) =>
                              setEditingCatalogService({
                                ...editingCatalogService,
                                description: e.target.value,
                              })
                            }
                            placeholder="Ex: Uso por ordem de chegada ou agendamento prévio..."
                            className="bg-white text-xs mt-1"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setEditingCatalogService(null)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          className="bg-[#004d00] hover:bg-emerald-900 text-white font-black"
                        >
                          Salvar Serviço
                        </Button>
                      </div>
                    </form>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* SEÇÃO CONFIGURAÇÃO MESTRE DE PLANOS & CARTÕES (SCREENSHOT 3) */}
          {(configSection === 'CONFIG_CARTAO' || configSection === 'PLANOS') && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Configuração Mestre de Planos & Carteirinhas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ao alterar o valor, nome ou regras nesta tela, a mudança é propagada automaticamente por todo o sistema.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    setEditingModality({
                      id: `mod_${Date.now()}`,
                      code: `CUSTOM_${Date.now()}`,
                      name: 'Novo Plano Lessa',
                      subtitle: 'Descrição detalhada do plano',
                      verse: '',
                      monthlyPrice: 49.9,
                      annualPrice: 538.92,
                      annualInstallment: 44.91,
                      adhesionFee: 0,
                      maxDependents: 99,
                      gracePeriodDays: 0,
                      frontCardUrl: '/cards/44.png',
                      backCardUrl: '/cards/24.png',
                      requiresDocument: false,
                      isFreeTier: false,
                      visibleOnSite: true,
                      visibleInSimulator: true,
                      visibleToConsultants: true,
                      visibleToInfluencers: true,
                      contractType: 'ADESAO_PF',
                      active: true,
                      sortOrder: (state.modalities.length || 0) + 1,
                    })
                  }
                  className="bg-[#004d00] hover:bg-emerald-900 text-white font-black text-xs"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> + CADASTRAR NOVO PLANO
                </Button>
              </div>

              {/* BANNER AMARELO DE INSTRUÇÃO (IDÊNTICO À SCREENSHOT 3) */}
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-950 font-bold leading-relaxed">
                  Para alterar a ordem de exibição dos planos, digite a numeração de acordo com a ordem que deseja que os planos sejam exibidos e depois clique no botão ao lado para salvar a alteração.
                </p>
              </div>

              {/* TABELA DE PLANOS ATIVOS (SCREENSHOT 3) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    PLANOS ATIVOS ({(state.modalities || []).filter((m) => !m.deleted).length})
                  </h4>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-black uppercase text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Nome</th>
                        <th className="py-3 px-4">Valor</th>
                        <th className="py-3 px-4 text-center">Qtd Dependentes</th>
                        <th className="py-3 px-4 text-center">Ordem de Exibição</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {state.modalities
                        .filter((m) => !m.deleted)
                        .sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99))
                        .map((mod) => {
                          const directPlanLink = `${window.location.origin}/planos?plano=${mod.code}`;
                          return (
                            <tr key={mod.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={mod.frontCardUrl}
                                    alt={mod.name}
                                    className="w-12 h-8 object-cover rounded border border-slate-300 shrink-0"
                                  />
                                  <div>
                                    <strong className="text-slate-900 block font-black">
                                      {mod.name}
                                    </strong>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {mod.code}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                {mod.isFreeTier || mod.monthlyPrice === 0 ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                                    Grátis / Cortesia
                                  </Badge>
                                ) : (
                                  <div>
                                    <strong className="text-emerald-900 block">
                                      {formatCurrency(mod.monthlyPrice)}/mês
                                    </strong>
                                    <span className="text-[10px] text-slate-500">
                                      Anual: {formatCurrency(mod.annualPrice)}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-slate-700">
                                {mod.maxDependents === 99 || !mod.maxDependents
                                  ? 'Ilimitados'
                                  : mod.maxDependents}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="inline-flex items-center gap-1.5">
                                  <Input
                                    type="number"
                                    defaultValue={mod.sortOrder ?? 1}
                                    id={`order_input_${mod.id}`}
                                    className="w-14 h-8 text-center text-xs font-black bg-white"
                                  />
                                  <Button
                                    type="button"
                                    size="icon"
                                    onClick={async () => {
                                      const inputEl = document.getElementById(
                                        `order_input_${mod.id}`
                                      ) as HTMLInputElement | null;
                                      const newOrder = inputEl ? Number(inputEl.value) : 1;
                                      const updated = (state.modalities || []).map((m) =>
                                        m.id === mod.id ? { ...m, sortOrder: newOrder } : m
                                      );
                                      await persist({ ...state, modalities: updated });
                                      toast({
                                        title: 'Ordem de exibição salva!',
                                        description: `O plano "${mod.name}" agora é a posição #${newOrder} no site.`,
                                      });
                                    }}
                                    className="h-8 w-8 bg-emerald-700 hover:bg-emerald-800 text-white shrink-0"
                                    title="Salvar ordem"
                                  >
                                    💾
                                  </Button>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      navigator.clipboard.writeText(directPlanLink);
                                      toast({
                                        title: 'Link copiado!',
                                        description: `Link direto do plano ${mod.name}: ${directPlanLink}`,
                                      });
                                    }}
                                    className="h-7 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100"
                                  >
                                    <Copy className="w-3 h-3 mr-1" /> Copiar Link
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => setEditingModality(mod)}
                                    className="h-7 text-xs font-bold bg-[#004d00] hover:bg-emerald-900 text-white"
                                  >
                                    <Edit3 className="w-3 h-3 mr-1" /> Alterar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={async () => {
                                      if (!confirm(`Deseja realmente desativar/excluir o plano "${mod.name}"?`)) return;
                                      const updated = (state.modalities || []).map((m) =>
                                        m.id === mod.id ? { ...m, deleted: true, active: false } : m
                                      );
                                      await persist({ ...state, modalities: updated });
                                      toast({
                                        title: 'Plano movido para excluídos',
                                        description: `Você pode reativar o plano "${mod.name}" a qualquer momento.`,
                                      });
                                    }}
                                    className="h-7 text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SEÇÃO DE PLANOS EXCLUÍDOS (SCREENSHOT 3) */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-800">
                  PLANOS EXCLUIDOS ({(state.modalities || []).filter((m) => m.deleted).length})
                </h4>

                {(state.modalities || []).filter((m) => m.deleted).length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl">
                    Nenhum plano excluído no momento.
                  </p>
                ) : (
                  <div className="border border-rose-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-rose-50/80 border-b border-rose-200 text-rose-950 font-black uppercase text-[11px]">
                        <tr>
                          <th className="py-2.5 px-4">Nome do Plano</th>
                          <th className="py-2.5 px-4">Valor Mensal</th>
                          <th className="py-2.5 px-4 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100">
                        {state.modalities
                          .filter((m) => m.deleted)
                          .map((mod) => (
                            <tr key={mod.id} className="hover:bg-rose-50/30">
                              <td className="py-2.5 px-4 font-bold text-slate-800">
                                {mod.name}
                              </td>
                              <td className="py-2.5 px-4 text-slate-600">
                                {formatCurrency(mod.monthlyPrice)}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    const updated = (state.modalities || []).map((m) =>
                                      m.id === mod.id ? { ...m, deleted: false, active: true } : m
                                    );
                                    await persist({ ...state, modalities: updated });
                                    toast({
                                      title: 'Plano Reativado com Sucesso!',
                                      description: `O plano "${mod.name}" está ativo novamente.`,
                                    });
                                  }}
                                  className="h-7 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white"
                                >
                                  Reativar
                                </Button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">
                Modelos Oficiais de Contratos (Preenchimento Dinâmico)
              </h3>
              <p className="text-xs text-slate-500">
                Estes 3 contratos ficam disponíveis automaticamente no perfil do associado com os dados do titular, tabela de dependentes e veículo.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {state.contractTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="rounded-2xl border border-slate-200 p-5 bg-slate-50 flex flex-col justify-between gap-4"
                >
                  <div>
                    <Badge variant="outline" className="mb-2">
                      {tpl.id}
                    </Badge>
                    <h4 className="font-black text-slate-900 text-sm">
                      {tpl.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {tpl.description}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingContract(tpl)}
                    className="w-full font-bold"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5" /> Editar Cláusulas
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* TAB 6: IMPORTAR DA LABCARD */}
        <TabsContent value="importar">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm max-w-2xl mx-auto text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900">
              Importar Associados do Sistema Antigo (Labcard / Excel / CSV)
            </h3>
            <p className="text-sm text-slate-600">
              Envie a planilha exportada do sistema antigo (<code>.xlsx</code> ou{' '}
              <code>.csv</code>) contendo colunas como <strong>Nome</strong>,{' '}
              <strong>CPF</strong>, <strong>Telefone</strong>,{' '}
              <strong>Plano</strong> e <strong>Valor</strong>. O sistema criará as assinaturas e gerará os números de carteirinha automaticamente.
            </p>
            <div className="pt-2">
              <Label
                htmlFor="labcard-upload"
                className="inline-flex items-center px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow"
              >
                <Upload className="w-4 h-4 mr-2" /> Selecionar Planilha (.xlsx / .csv)
              </Label>
              <input
                id="labcard-upload"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportLabcardSpreadsheet}
              />
            </div>
          </div>
        </TabsContent>

        {/* TAB 7: PERFIL (Meus Dados | Acessos | Meu Plano | Minhas Faturas | Alterar Cor) */}
        <TabsContent value="perfil" className="space-y-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
            <div className="flex items-center gap-1.5 border-b border-slate-200 pb-3 overflow-x-auto no-scrollbar sm:flex-wrap -mx-1 px-1">
              {(
                [
                  { id: 'MEUS_DADOS', label: '• Meus Dados' },
                  { id: 'ACESSOS', label: '• Acessos' },
                  { id: 'MEU_PLANO', label: '• Meu Plano' },
                  { id: 'MINHAS_FATURAS', label: '• Minhas Faturas' },
                  { id: 'ALTERAR_COR', label: '• Alterar Cor' },
                ] as const
              ).map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant={perfilSection === p.id ? 'default' : 'outline'}
                  onClick={() => setPerfilSection(p.id)}
                  className={`shrink-0 whitespace-nowrap text-xs ${
                    perfilSection === p.id
                      ? 'bg-[#004d00] text-white font-bold'
                      : ''
                  }`}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {perfilSection === 'ALTERAR_COR' ? (
              <div className="space-y-4">
                <h3 className="text-lg font-black text-slate-900">
                  Alterar Cor da Barra de Ferramentas do Painel
                </h3>
                <p className="text-xs text-slate-500">
                  Escolha a cor principal do menu superior (Padrão Balneário Lessa: Verde Escuro #004d00):
                </p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { name: 'Verde Lessa Oficial (#004d00)', color: '#004d00' },
                    { name: 'Verde Esmeralda (#065f46)', color: '#065f46' },
                    { name: 'Azul Marinho (#0f172a)', color: '#0f172a' },
                    { name: 'Verde Floresta (#14532d)', color: '#14532d' },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => {
                        setNavThemeColor(c.color);
                        toast({
                          title: 'Cor atualizada!',
                          description: c.name,
                        });
                      }}
                      className="px-4 py-3 rounded-xl text-white font-bold text-xs shadow border-2 border-white flex items-center gap-2"
                      style={{ backgroundColor: c.color }}
                    >
                      {navThemeColor === c.color && (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : perfilSection === 'MEUS_DADOS' ? (
              /* TELA EXATA DE DADOS PESSOAIS — SCREENSHOT 2 (media_1793384635438_92e14046.png) */
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                      DADOS PESSOAIS
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Informações cadastrais e credenciais oficiais da administração do Balneário Lessa.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-sm">
                      <Store className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-slate-700">
                  {/* Linha 1 */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Empresa</Label>
                    <Input
                      value={companyProfile.empresa}
                      onChange={(e) =>
                        setCompanyProfile({ ...companyProfile, empresa: e.target.value })
                      }
                      className="h-10 text-xs bg-white border-slate-300 font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">CNPJ</Label>
                    <Input
                      value={companyProfile.cnpj}
                      onChange={(e) =>
                        setCompanyProfile({ ...companyProfile, cnpj: e.target.value })
                      }
                      className="h-10 text-xs bg-white border-slate-300 font-semibold"
                    />
                  </div>

                  {/* Linha 2 */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Nome</Label>
                    <Input
                      value={companyProfile.nomeResponsavel}
                      onChange={(e) =>
                        setCompanyProfile({
                          ...companyProfile,
                          nomeResponsavel: e.target.value,
                        })
                      }
                      className="h-10 text-xs bg-white border-slate-300 font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">
                      CPF <em>(Responsável)</em>
                    </Label>
                    <Input
                      value={companyProfile.cpfResponsavel}
                      onChange={(e) =>
                        setCompanyProfile({
                          ...companyProfile,
                          cpfResponsavel: e.target.value,
                        })
                      }
                      className="h-10 text-xs bg-white border-slate-300 font-semibold"
                    />
                  </div>

                  {/* Linha 3 */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Telefone</Label>
                    <Input
                      value={companyProfile.telefone}
                      onChange={(e) =>
                        setCompanyProfile({ ...companyProfile, telefone: e.target.value })
                      }
                      className="h-10 text-xs bg-white border-slate-300 font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Celular</Label>
                    <Input
                      value={companyProfile.celular}
                      onChange={(e) =>
                        setCompanyProfile({ ...companyProfile, celular: e.target.value })
                      }
                      className="h-10 text-xs bg-white border-slate-300 font-semibold"
                    />
                  </div>

                  {/* Linha 4 */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">E-mail</Label>
                    <Input
                      value={companyProfile.email}
                      onChange={(e) =>
                        setCompanyProfile({ ...companyProfile, email: e.target.value })
                      }
                      className="h-10 text-xs bg-white border-slate-300 font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Site</Label>
                    <Input
                      value={companyProfile.site}
                      onChange={(e) =>
                        setCompanyProfile({ ...companyProfile, site: e.target.value })
                      }
                      className="h-10 text-xs bg-white border-slate-300 font-semibold"
                    />
                  </div>

                  {/* Linha 5 */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Usuário</Label>
                    <Input
                      value={companyProfile.usuario}
                      onChange={(e) =>
                        setCompanyProfile({ ...companyProfile, usuario: e.target.value })
                      }
                      className="h-10 text-xs bg-white border-slate-300 font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Senha</Label>
                    <div className="relative">
                      <Input
                        type={companyProfile.showSenha ? 'text' : 'password'}
                        value={companyProfile.senha}
                        onChange={(e) =>
                          setCompanyProfile({ ...companyProfile, senha: e.target.value })
                        }
                        className="h-10 text-xs bg-white border-slate-300 font-semibold pr-10"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCompanyProfile({
                            ...companyProfile,
                            showSenha: !companyProfile.showSenha,
                          })
                        }
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
                      >
                        {companyProfile.showSenha ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">
                    📍 Balneário Família Lessa • Ariquemes - RO • CNPJ: <strong>{companyProfile.cnpj}</strong>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      toast({
                        title: 'Dados da Empresa Salvos com Sucesso!',
                        description: `${companyProfile.empresa} — CNPJ: ${companyProfile.cnpj}`,
                      });
                    }}
                    className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs px-6 h-9"
                  >
                    Salvar Dados da Empresa
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <Badge className="bg-[#004d00] text-white">
                    {perfilSection}
                  </Badge>
                  <h4 className="text-base font-black text-slate-900">
                    BALNEÁRIO LESSA
                  </h4>
                  <p className="text-xs text-slate-600">
                    CNPJ: 46.891.134/0001-40 • Ariquemes - RO
                  </p>
                  <p className="text-xs text-slate-500">
                    Sistema Lessa Club • Licenciado e Ativo (100% Ilimitado)
                  </p>
                </div>
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                  <h4 className="text-sm font-black text-slate-900">
                    Atalhos Rápidos dos Portais Públicos
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <a href="/planos" target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" className="text-xs font-bold">
                        Portal de Planos (/planos)
                      </Button>
                    </a>
                    <a href="/socio" target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" className="text-xs font-bold">
                        Área do Sócio (/socio)
                      </Button>
                    </a>
                    <a href="/verificar" target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" className="text-xs font-bold">
                        Validador QR (/verificar)
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* FLOATING QUICK SEARCH MODAL (Lupa Labcard) */}
      <Dialog open={quickSearchOpen} onOpenChange={setQuickSearchOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-emerald-950">
              <Search className="w-5 h-5 text-emerald-700" /> Busca Rápida de Cliente / Associado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Digite o nome, Nº. do CPF ou Nº. do Cartão do cliente
              </Label>
              <Input
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                placeholder="Digite o nome, Nº. do CPF ou Nº. do Cartão do cliente..."
                className="h-12 text-base"
                autoFocus
              />
            </div>
            {quickSearchResults.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {quickSearchResults.map(({ member, subscription }) => (
                  <div
                    key={member.id}
                    className={`rounded-2xl border-2 p-4 flex items-center justify-between gap-3 ${
                      subscription.status === 'ACTIVE'
                        ? 'border-emerald-500 bg-emerald-50/50'
                        : 'border-rose-400 bg-rose-50/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          className={
                            subscription.status === 'ACTIVE'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-rose-600 text-white'
                          }
                        >
                          {subscription.status === 'ACTIVE'
                            ? 'STATUS: ATIVO (LIBERADO)'
                            : 'STATUS: INATIVO'}
                        </Badge>
                        <Badge variant="outline" className="text-xs font-bold">
                          {member.role === 'TITULAR' ? '👑 TITULAR' : '👥 DEPENDENTE'}
                        </Badge>
                      </div>
                      <h4 className="text-base font-black text-slate-900">
                        {member.fullName}
                      </h4>
                      <p className="text-xs text-slate-600">
                        Cartão #{member.cardNumber} • CPF: {member.cpf || subscription.holderCpf} •{' '}
                        {member.planCycleLabel}
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => {
                          setClientDetailTool('DADOS_CADASTRAIS');
                          setSelectedSubForDetail(subscription);
                          setQuickSearchOpen(false);
                        }}
                        className="bg-[#004d00] hover:bg-emerald-800 text-white font-bold text-xs"
                      >
                        Entrar no Cadastro
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setClientDetailTool('FINANCEIRO_CLIENTE');
                          setSelectedSubForDetail(subscription);
                          setQuickSearchOpen(false);
                        }}
                        className="border-emerald-700 text-emerald-900 font-bold text-xs"
                      >
                        Perfil Financeiro ($)
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              quickQuery.trim() !== '' && (
                <p className="text-sm text-center text-rose-600 py-4 font-semibold">
                  Nenhum associado localizado para "{quickQuery}".
                </p>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* =====================================================================
          MODAL DE CADASTRO EXISTENTE: DADOS PESSOAIS + BARRA DE 9+ FERRAMENTAS
          (IDÊNTICO À IMAGEM ENVIADA: DADOS PESSOAIS - Nº Cartão + Ícones Verdes)
          • Dados Pessoais & Alterações Cadastrais completas
          • Perfil Financeiro do Cliente (Carnê 12 parcelas, Baixa, Recibo, etc.)
          1. Gerar cartão de associados
          2. Cadastrar cartão de crédito/débito para ativar assinatura no cartão
          3. Gerar contrato (+ aba lateral CONTRATO DO CLIENTE)
          4. Adicionar anexos (imagens, arquivos, pdf, etc)
          5. Adicionar dependentes
          6. Agenda do cliente (mapa dos dias de visita do cliente ao marcar ou ler qr code)
          7. Adicionar serviços adicionais
          8. Gerar link para assinatura digital do contrato
          9. Visualizar termos de uso e condições
      ===================================================================== */}
      {selectedSubForDetail && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3 sm:p-6 sm:pr-10 shadow-sm relative space-y-4 sm:space-y-5 overflow-hidden">
              {/* Aba Vertical Lateral Direita: CONTRATO DO CLIENTE (Apenas em telas médias/grandes) */}
              <button
                type="button"
                onClick={() => setClientDetailTool('GERAR_CONTRATO')}
                title="Abrir ou Imprimir Contrato do Cliente"
                className="hidden md:block fixed right-0 top-1/3 z-50 bg-[#004d00] hover:bg-emerald-800 text-white font-black text-[11px] tracking-widest uppercase py-5 px-2 rounded-l-lg shadow-xl border-l border-y border-white/30"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
              >
                CONTRATO DO CLIENTE
              </button>

              {/* CABEÇALHO DADOS PESSOAIS - Nº Cartão */}
              <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                  <h2 className="text-xl sm:text-2xl font-normal text-slate-800 tracking-tight uppercase">
                    {clientDetailTool === 'FINANCEIRO_CLIENTE'
                      ? 'PERFIL FINANCEIRO'
                      : 'DADOS PESSOAIS'}
                  </h2>
                  <span className="text-xs sm:text-sm font-medium text-slate-600 break-words">
                    - Nº Cartão: <strong>{selectedSubForDetail.subscriptionCode}</strong> (
                    <span className="underline font-bold text-slate-800">
                      {selectedSubForDetail.holderName}
                    </span>
                    )
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={`text-[11px] sm:text-xs py-1 ${
                      selectedSubForDetail.status === 'ACTIVE'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    STATUS ATUAL:{' '}
                    {selectedSubForDetail.status === 'ACTIVE'
                      ? 'ATIVO (LIBERADO)'
                      : 'INATIVO (AGUARDANDO PAGTO)'}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedSubForDetail(null)}
                    className="h-8 border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs w-full sm:w-auto"
                  >
                    ← Voltar para Lista de Clientes
                  </Button>
                </div>
              </div>

              {/* BARRA DE BOTÕES DE ÍCONES VERDES ESCUROS (COM SUPORTE MOBILE E DESKTOP) */}
              <div className="space-y-2">
                {/* Seletor Rápido Mobile (Aparece apenas em celulares) */}
                <div className="block sm:hidden">
                  <label className="text-[11px] font-bold text-slate-600 uppercase mb-1 block">
                    Navegar pelas Ferramentas do Cliente:
                  </label>
                  <select
                    value={clientDetailTool}
                    onChange={(e) => setClientDetailTool(e.target.value as any)}
                    className="w-full h-10 rounded-lg border-2 border-emerald-800 bg-emerald-950 text-white font-bold text-xs px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="DADOS_CADASTRAIS">📝 Dados Pessoais e Cadastrais</option>
                    <option value="CARTOES">💳 1. Gerar Cartões (Titular / Dependentes)</option>
                    <option value="CADASTRAR_CARTAO_PAGTO">💼 2. Ativar no Cartão de Crédito</option>
                    <option value="FINANCEIRO_CLIENTE">💲 Perfil Financeiro ($)</option>
                    <option value="GERAR_CONTRATO">📄 3. Gerar Contrato / Imprimir</option>
                    <option value="ANEXOS">📎 4. Anexos e Comprovantes</option>
                    <option value="ADICIONAR_DEPENDENTES">👥 5. Adicionar Dependentes</option>
                    <option value="AGENDA_VISITAS">📅 6. Agenda de Visitas</option>
                    <option value="SERVICOS_ADICIONAIS">📋 7. Serviços Adicionais</option>
                    <option value="LINK_ASSINATURA">✒️ 8. Link Assinatura Digital</option>
                    <option value="TERMOS_USO">🔒 9. Termos de Uso</option>
                    <option value="SMS_CLIENTE">💬 SMS / WhatsApp</option>
                  </select>
                </div>

                {/* Carrossel de Botões / Grid de Botões */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar max-w-full sm:flex-wrap -mx-1 px-1">
                  {(
                    [
                      {
                        id: 'DADOS_CADASTRAIS',
                        title: 'Ver e Alterar Todos os Dados Pessoais, Endereço, Veículo e Situação do Cliente',
                        label: 'Dados Pessoais',
                        icon: Edit3,
                      },
                      {
                        id: 'CARTOES',
                        title: '1. Gerar Cartão de Associados (Titular e Dependentes)',
                        label: '1. Cartões',
                        icon: CreditCard,
                      },
                      {
                        id: 'CADASTRAR_CARTAO_PAGTO',
                        title: '2. Cadastrar Cartão de Crédito/Débito para Ativar Assinatura',
                        label: '2. Ativar no Cartão',
                        icon: Wallet,
                      },
                      {
                        id: 'FINANCEIRO_CLIENTE',
                        title: 'Perfil Financeiro do Cliente (Carnês, Parcelas, Baixas e Recibos)',
                        label: 'Financeiro ($)',
                        icon: DollarSign,
                      },
                      {
                        id: 'GERAR_CONTRATO',
                        title: '3. Gerar Contrato Oficial Preenchido / Imprimir',
                        label: '3. Gerar Contrato',
                        icon: FileText,
                      },
                      {
                        id: 'ANEXOS',
                        title: '4. Adicionar Anexos (Imagens, Arquivos, PDF, Comprovantes)',
                        label: `4. Anexos (${(selectedSubForDetail.attachments || []).length})`,
                        icon: Paperclip,
                      },
                      {
                        id: 'ADICIONAR_DEPENDENTES',
                        title: '5. Adicionar Dependentes ao Cadastro',
                        label: `5. Dependentes (${selectedSubForDetail.members.filter((m) => m.role === 'DEPENDENTE').length})`,
                        icon: UserPlus,
                      },
                      {
                        id: 'AGENDA_VISITAS',
                        title: '6. Agenda do Cliente (Mapa dos Dias de Visita / Leitura QR Code)',
                        label: `6. Agenda Visitas (${(selectedSubForDetail.visits || []).length})`,
                        icon: Calendar,
                      },
                      {
                        id: 'SERVICOS_ADICIONAIS',
                        title: '7. Adicionar Serviços Adicionais',
                        label: `7. Serviços Adicionais (${(selectedSubForDetail.additionalServices || []).length})`,
                        icon: ClipboardList,
                      },
                      {
                        id: 'LINK_ASSINATURA',
                        title: '8. Gerar Link para Assinatura Digital do Contrato',
                        label: '8. Link Assinatura Digital',
                        icon: PenTool,
                      },
                      {
                        id: 'TERMOS_USO',
                        title: '9. Visualizar Termos de Uso e Condições',
                        label: '9. Termos de Uso',
                        icon: Lock,
                      },
                      {
                        id: 'SMS_CLIENTE',
                        title: 'Enviar SMS / WhatsApp Direto para o Cliente',
                        label: 'SMS / WhatsApp',
                        icon: MessageSquare,
                      },
                    ] as const
                  ).map((btn) => {
                    const IconComp = btn.icon;
                    const isActive = clientDetailTool === btn.id;
                    return (
                      <button
                        key={btn.id}
                        type="button"
                        title={btn.title}
                        onClick={() => setClientDetailTool(btn.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all shadow-sm border shrink-0 whitespace-nowrap ${
                          isActive
                            ? 'bg-emerald-950 text-white border-emerald-400 ring-2 ring-emerald-500/40 scale-[1.02]'
                            : 'bg-[#004d00] hover:bg-[#1a5c1a] text-white border-emerald-900'
                        }`}
                      >
                        <IconComp className="w-4 h-4 shrink-0" />
                        <span>{btn.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* FAIXA VENCIMENTO DO CARTÃO + CALENDÁRIO E CARTÃO PADRÃO (IDÊNTICO À IMAGEM) */}
                <div className="bg-slate-100 border border-slate-200 rounded-lg p-2.5 sm:p-3 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-700 flex-wrap">
                      <strong className="shrink-0">Vencimento do cartão:</strong>
                      {editingExpirationDate ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Input
                            type="date"
                            value={selectedSubForDetail.endDate}
                            onChange={async (e) => {
                              const newEnd = e.target.value;
                              if (!newEnd) return;
                              const [yyyy, mm] = newEnd.split('-');
                              const newValidity = `${mm}/${yyyy}`;
                              const updatedSub: ClubSubscription = {
                                ...selectedSubForDetail,
                                endDate: newEnd,
                                members: selectedSubForDetail.members.map((m) => ({
                                  ...m,
                                  validityLabel: newValidity,
                                })),
                              };
                              const nextState: ClubDatabaseState = {
                                ...state,
                                subscriptions: (state.subscriptions || []).map((s) =>
                                  s.id === updatedSub.id ? updatedSub : s
                                ),
                              };
                              setSelectedSubForDetail(updatedSub);
                              await persist(nextState);
                              setEditingExpirationDate(false);
                              toast({
                                title: 'Vencimento do cartão atualizado!',
                                description: `Nova validade: ${formatDateBR(newEnd)}`,
                              });
                            }}
                            className="h-8 text-xs w-36 bg-white"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingExpirationDate(false)}
                            className="h-7 text-xs px-2"
                          >
                            Fechar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span>{formatDateBR(selectedSubForDetail.endDate)}</span>
                          <button
                            type="button"
                            onClick={() => setEditingExpirationDate(true)}
                            title="Alterar data de vencimento do cartão"
                            className="bg-[#004d00] hover:bg-emerald-800 text-white p-1.5 rounded shadow-sm"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-500 break-words">
                      Plano: <strong>{selectedSubForDetail.planSummaryLabel}</strong> • Valor:{' '}
                      <strong>{formatCurrency(selectedSubForDetail.monthlyEquivalent)}/mês</strong>
                    </span>
                  </div>

                  <div
                    onClick={() => setClientDetailTool('CARTOES')}
                    className="w-full bg-white border border-slate-300 rounded px-3 sm:px-4 py-2 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:bg-slate-50"
                  >
                    <span className="w-4 hidden sm:inline" />
                    <span>CARTÃO PADRÃO DESSE CLIENTE</span>
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  </div>
                </div>
              </div>



              {/* =====================================================================
                  DADOS CADASTRAIS DO CLIENTE (VER E ALTERAR TODAS AS INFORMAÇÕES)
                  Idêntico ao formulário DADOS PESSOAIS / ENDEREÇO / VEÍCULO do Labcard
              ===================================================================== */}
              {clientDetailTool === 'DADOS_CADASTRAIS' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-5 space-y-4 sm:space-y-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase">
                        Ficha Completa do Cliente Titular — Alteração de Dados
                      </h3>
                      <p className="text-xs text-slate-500">
                        Altere qualquer informação pessoal, endereço, veículo, consultor ou plano do cliente e clique em Salvar Alterações.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setClientDetailTool('FINANCEIRO_CLIENTE')}
                        className="border-emerald-700 text-emerald-900 font-bold text-xs w-full sm:w-auto justify-center"
                      >
                        <DollarSign className="w-3.5 h-3.5 mr-1 text-emerald-700" /> Abrir Perfil Financeiro
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveClientRegistrationEdits}
                        className="bg-[#004d00] hover:bg-emerald-900 text-white font-black text-xs px-4 sm:px-5 w-full sm:w-auto justify-center"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> SALVAR ALTERAÇÕES
                      </Button>
                    </div>
                  </div>

                  {/* DADOS PESSOAIS */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-6">
                      <Label className="text-xs font-bold text-slate-700">
                        Nome Completo do Titular *
                      </Label>
                      <Input
                        value={editClientData.holderName}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            holderName: e.target.value,
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs font-bold text-slate-700">
                        Data de Nascimento
                      </Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="DD/MM/AAAA"
                        maxLength={10}
                        value={formatBirthDate(editClientData.holderBirthDate)}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            holderBirthDate: formatBirthDate(e.target.value),
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs font-bold text-slate-700">
                        RG
                      </Label>
                      <Input
                        value={editClientData.holderRg}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            holderRg: e.target.value,
                          })
                        }
                        placeholder="Nº do RG"
                        className="mt-1"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <Label className="text-xs font-bold text-slate-700">
                        CPF / CNPJ *
                      </Label>
                      <Input
                        value={editClientData.holderCpf}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            holderCpf: e.target.value,
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs font-bold text-slate-700">
                        Sexo
                      </Label>
                      <select
                        value={editClientData.holderSex}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            holderSex: e.target.value,
                          })
                        }
                        className="w-full h-10 mt-1 rounded-md border border-slate-300 px-3 text-xs font-semibold bg-white"
                      >
                        <option value="">Selecione</option>
                        <option value="MASCULINO">Masculino</option>
                        <option value="FEMININO">Feminino</option>
                        <option value="OUTRO">Outro</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs font-bold text-slate-700">
                        Estado Civil
                      </Label>
                      <select
                        value={editClientData.holderMaritalStatus}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            holderMaritalStatus: e.target.value,
                          })
                        }
                        className="w-full h-10 mt-1 rounded-md border border-slate-300 px-3 text-xs font-semibold bg-white"
                      >
                        <option value="">Selecione</option>
                        <option value="SOLTEIRO(A)">Solteiro(a)</option>
                        <option value="CASADO(A)">Casado(a)</option>
                        <option value="DIVORCIADO(A)">Divorciado(a)</option>
                        <option value="VIUVO(A)">Viúvo(a)</option>
                        <option value="UNIAO ESTAVEL">União Estável</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs font-bold text-slate-700">
                        Telefone / WhatsApp *
                      </Label>
                      <Input
                        value={editClientData.holderPhone}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            holderPhone: e.target.value,
                          })
                        }
                        className="mt-1"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <Label className="text-xs font-bold text-slate-700">
                        E-mail
                      </Label>
                      <Input
                        value={editClientData.holderEmail}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            holderEmail: e.target.value,
                          })
                        }
                        placeholder="cliente@email.com"
                        className="mt-1"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Label className="text-xs font-bold text-slate-700">
                        Consultor / Vendedor
                      </Label>
                      <select
                        value={editClientData.consultantName}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            consultantName: e.target.value,
                          })
                        }
                        className="w-full h-10 mt-1 rounded-md border border-slate-300 px-3 text-xs font-semibold bg-white"
                      >
                        <option value="">Sem Consultor / Direto</option>
                        {(state.consultants || []).map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name} ({c.role})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <Label className="text-xs font-bold text-slate-700">
                        Plano / Descrição do Contrato
                      </Label>
                      <Input
                        value={editClientData.planSummaryLabel}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            planSummaryLabel: e.target.value,
                          })
                        }
                        className="mt-1"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <Label className="text-xs font-bold text-slate-700">
                        Modalidade de Cobrança
                      </Label>
                      <select
                        value={editClientData.billingCycle}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            billingCycle: e.target.value as BillingCycle,
                          })
                        }
                        className="w-full h-10 mt-1 rounded-md border border-slate-300 px-3 text-xs font-semibold bg-white"
                      >
                        <option value="ANNUAL">Plano Anual (Fidelidade 12 meses)</option>
                        <option value="MONTHLY">Plano Mensal Recorrente</option>
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <Label className="text-xs font-bold text-slate-700">
                        Valor Mensal (R$)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editClientData.monthlyEquivalent}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            monthlyEquivalent: Number(e.target.value),
                          })
                        }
                        className="mt-1 font-bold text-emerald-900"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Label className="text-xs font-bold text-slate-700">
                        Dia de Vencimento
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        max={28}
                        value={editClientData.dueDay}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            dueDay: Number(e.target.value),
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* ENDEREÇO COMPLETO */}
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                      ENDEREÇO DO CLIENTE
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-3">
                        <Label className="text-xs font-bold text-slate-700">
                          CEP
                        </Label>
                        <Input
                          value={editClientData.addressCep}
                          onChange={async (e) => {
                            const val = e.target.value;
                            setEditClientData((prev) => ({
                              ...prev,
                              addressCep: val,
                            }));
                            const digits = val.replace(/\D/g, '');
                            if (digits.length === 8) {
                              const d = await fetchAddressByCep(digits);
                              if (d) {
                                setEditClientData((prev) => ({
                                  ...prev,
                                  addressStreet: d.logradouro || prev.addressStreet,
                                  addressNeighborhood: d.bairro || prev.addressNeighborhood,
                                  addressCity: d.localidade || prev.addressCity,
                                  addressState: d.uf || prev.addressState,
                                }));
                              }
                            }
                          }}
                          onBlur={async () => {
                            const digits = editClientData.addressCep.replace(
                              /\D/g,
                              ''
                            );
                            if (digits.length !== 8) return;
                            const d = await fetchAddressByCep(digits);
                            if (d) {
                              setEditClientData((prev) => ({
                                ...prev,
                                addressStreet: d.logradouro || prev.addressStreet,
                                addressNeighborhood: d.bairro || prev.addressNeighborhood,
                                addressCity: d.localidade || prev.addressCity,
                                addressState: d.uf || prev.addressState,
                              }));
                            }
                          }}
                          placeholder="00000-000"
                          className="mt-1"
                        />
                      </div>
                      <div className="sm:col-span-6">
                        <Label className="text-xs font-bold text-slate-700">
                          Rua / Logradouro
                        </Label>
                        <Input
                          value={editClientData.addressStreet}
                          onChange={(e) =>
                            setEditClientData({
                              ...editClientData,
                              addressStreet: e.target.value,
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Label className="text-xs font-bold text-slate-700">
                          Número
                        </Label>
                        <Input
                          value={editClientData.addressNumber}
                          onChange={(e) =>
                            setEditClientData({
                              ...editClientData,
                              addressNumber: e.target.value,
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Label className="text-xs font-bold text-slate-700">
                          Complemento
                        </Label>
                        <Input
                          value={editClientData.addressComplement}
                          onChange={(e) =>
                            setEditClientData({
                              ...editClientData,
                              addressComplement: e.target.value,
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <Label className="text-xs font-bold text-slate-700">
                          Bairro
                        </Label>
                        <Input
                          value={editClientData.addressNeighborhood}
                          onChange={(e) =>
                            setEditClientData({
                              ...editClientData,
                              addressNeighborhood: e.target.value,
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Label className="text-xs font-bold text-slate-700">
                          Cidade
                        </Label>
                        <Input
                          value={editClientData.addressCity}
                          onChange={(e) =>
                            setEditClientData({
                              ...editClientData,
                              addressCity: e.target.value,
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs font-bold text-slate-700">
                          UF
                        </Label>
                        <Input
                          value={editClientData.addressState}
                          onChange={(e) =>
                            setEditClientData({
                              ...editClientData,
                              addressState: e.target.value.toUpperCase(),
                            })
                          }
                          maxLength={2}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* VEÍCULO E OBSERVAÇÕES */}
                  <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-4">
                      <Label className="text-xs font-bold text-slate-700">
                        Modelo do Veículo
                      </Label>
                      <Input
                        value={editClientData.vehicleModel}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            vehicleModel: e.target.value,
                          })
                        }
                        placeholder="Ex: Hilux / Corolla / Gol"
                        className="mt-1"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Label className="text-xs font-bold text-slate-700">
                        Placa do Veículo
                      </Label>
                      <Input
                        value={editClientData.vehiclePlate}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            vehiclePlate: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="ABC-1D23"
                        className="mt-1"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Label className="text-xs font-bold text-slate-700">
                        Cor do Veículo
                      </Label>
                      <Input
                        value={editClientData.vehicleColor}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            vehicleColor: e.target.value,
                          })
                        }
                        placeholder="Branco / Prata / Preto"
                        className="mt-1"
                      />
                    </div>
                    <div className="sm:col-span-12">
                      <Label className="text-xs font-bold text-slate-700">
                        Observações Internas do Cadastro
                      </Label>
                      <Textarea
                        value={editClientData.notes}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            notes: e.target.value,
                          })
                        }
                        rows={2}
                        placeholder="Anotações sobre o cliente, dependentes ou condições especiais..."
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>

                  {/* RESUMO RÁPIDO DOS DEPENDENTES VINCULADOS A ESTE TITULAR */}
                  <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-xl">
                    <div className="text-xs text-slate-700">
                      <strong>Dependentes vinculados a este titular:</strong>{' '}
                      {selectedSubForDetail.members.filter(
                        (m) => m.role === 'DEPENDENTE'
                      ).length === 0
                        ? 'Nenhum dependente cadastrado.'
                        : selectedSubForDetail.members
                            .filter((m) => m.role === 'DEPENDENTE')
                            .map((d) => `${d.fullName} (#${d.cardNumber})`)
                            .join(', ')}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setClientDetailTool('ADICIONAR_DEPENDENTES')}
                      className="text-xs font-bold h-8 border-emerald-700 text-emerald-900"
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-1" /> Gerenciar / Adicionar Dependentes (
                      {
                        selectedSubForDetail.members.filter(
                          (m) => m.role === 'DEPENDENTE'
                        ).length
                      }
                      )
                    </Button>
                  </div>

                  {/* SITUAÇÃO DO CADASTRO (LIBERAR / INATIVAR) — APENAS ABAIXO NA ABA DADOS PESSOAIS */}
                  <div className="bg-slate-50 rounded-2xl border-2 border-slate-200 p-3 sm:p-4 space-y-3 mt-2">
                    <div className="border-b border-slate-200 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                        SITUAÇÃO DO CADASTRO (LIBERAR / INATIVAR)
                      </h3>
                      <span className="text-[11px] sm:text-xs text-slate-500">
                        CPF/CNPJ: <strong>{selectedSubForDetail.holderCpf}</strong> • Tel:{' '}
                        <strong>{selectedSubForDetail.holderPhone}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <div className="sm:col-span-4 flex items-center gap-2">
                        <Label className="text-xs font-bold text-slate-600 w-16 text-left sm:text-right shrink-0">
                          Liberar
                        </Label>
                        <select
                          value={situacaoLiberar}
                          onChange={(e) => {
                            const val = e.target.value as 'SIM' | 'NAO';
                            setSituacaoLiberar(val);
                            setSituacaoInativar(val === 'SIM' ? 'NAO' : 'SIM');
                          }}
                          className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs font-bold bg-white"
                        >
                          <option value="SIM">SIM</option>
                          <option value="NAO">NÃO</option>
                        </select>
                      </div>

                      <div className="sm:col-span-4 flex items-center gap-2">
                        <Label className="text-xs font-bold text-slate-600 w-16 text-left sm:text-right shrink-0">
                          Inativar
                        </Label>
                        <select
                          value={situacaoInativar}
                          onChange={(e) => {
                            const val = e.target.value as 'NAO' | 'SIM';
                            setSituacaoInativar(val);
                            setSituacaoLiberar(val === 'SIM' ? 'NAO' : 'SIM');
                          }}
                          className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs font-bold bg-white"
                        >
                          <option value="NAO">NÃO</option>
                          <option value="SIM">SIM</option>
                        </select>
                      </div>

                      <div className="sm:col-span-4 flex items-center justify-between gap-2 pt-1 sm:pt-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-600">
                            Status <span className="text-blue-600">?</span>
                          </span>
                          <span
                            className={`text-xs font-black uppercase px-2.5 py-1 rounded ${
                              situacaoLiberar === 'SIM' && situacaoInativar === 'NAO'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}
                          >
                            {situacaoLiberar === 'SIM' && situacaoInativar === 'NAO'
                              ? 'ATIVO'
                              : 'INATIVO'}
                          </span>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const targetStatus =
                              situacaoLiberar === 'SIM' && situacaoInativar === 'NAO'
                                ? 'ACTIVE'
                                : 'INACTIVE';
                            handleToggleSubStatus(selectedSubForDetail, targetStatus);
                          }}
                          className="bg-[#004d00] hover:bg-emerald-900 text-white font-black uppercase tracking-wider px-4 sm:px-5 h-9 rounded-md shadow shrink-0 text-xs"
                        >
                          SALVAR
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      onClick={handleSaveClientRegistrationEdits}
                      className="w-full sm:w-auto bg-[#004d00] hover:bg-emerald-900 text-white font-black uppercase tracking-wider px-4 sm:px-8 h-12 sm:h-11 shadow-md text-xs sm:text-sm whitespace-normal text-center flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2 shrink-0" /> SALVAR TODAS AS ALTERAÇÕES DO CADASTRO
                    </Button>
                  </div>
                </div>
              )}

              {/* =====================================================================
                  OPÇÃO 1: GERAR CARTÃO DE ASSOCIADOS (TITULAR vs DEPENDENTES)
              ===================================================================== */}
              {clientDetailTool === 'CARTOES' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <div className="text-xs font-bold text-emerald-950">
                      1. Gerar Cartão de Associados — Clique em "Enviar Foto 3x4" para trocar ou reposicionar a foto de perfil, ou imprima frente e verso.
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        const memberIds = selectedSubForDetail.members.map(
                          (m) => m.id
                        );
                        setSelectedMemberIdsForPrint(memberIds.slice(0, 4));
                        setSelectedSubForDetail(null);
                        setActiveTab('impressao');
                      }}
                      className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs h-8"
                    >
                      <Printer className="w-3.5 h-3.5 mr-1.5" /> Enviar Família para Folha Multi-Cartão (4 por folha)
                    </Button>
                  </div>

                  {selectedSubForDetail.members
                    .filter((m) => m.role === 'TITULAR')
                    .map((holderMember) => (
                      <div key={holderMember.id} className="space-y-2">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                          <Badge className="bg-emerald-800 text-white font-black">
                            TITULAR
                          </Badge>
                          <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">
                            1. Carteirinha do Titular ({holderMember.fullName})
                          </h4>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                          <ClubMemberCardView
                            member={holderMember}
                            showBackSide={true}
                            onUpdatePhoto={async (memberId, dataUrl) => {
                              const updatedSub: ClubSubscription = {
                                ...selectedSubForDetail,
                                members: selectedSubForDetail.members.map((m) =>
                                  m.id === memberId ? { ...m, photoUrl: dataUrl } : m
                                ),
                              };
                              const nextState: ClubDatabaseState = {
                                ...state,
                                subscriptions: (state.subscriptions || []).map((s) =>
                                  s.id === updatedSub.id ? updatedSub : s
                                ),
                              };
                              setSelectedSubForDetail(updatedSub);
                              await persist(nextState);
                              toast({ title: 'Foto 3x4 atualizada!' });
                            }}
                          />
                        </div>
                      </div>
                    ))}

                  {selectedSubForDetail.members.some((m) => m.role === 'DEPENDENTE') && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-700 text-white font-black">
                            DEPENDENTES (
                            {
                              selectedSubForDetail.members.filter(
                                (m) => m.role === 'DEPENDENTE'
                              ).length
                            }
                            )
                          </Badge>
                          <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">
                            2. Carteirinhas dos Dependentes Vinculados
                          </h4>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setClientDetailTool('ADICIONAR_DEPENDENTES')}
                          className="text-xs font-bold h-8"
                        >
                          <UserPlus className="w-3.5 h-3.5 mr-1" /> + Adicionar Dependente
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {selectedSubForDetail.members
                          .filter((m) => m.role === 'DEPENDENTE')
                          .map((depMember, depIdx) => (
                            <div
                              key={depMember.id}
                              className="bg-slate-50 rounded-2xl p-4 border border-slate-200"
                            >
                              <ClubMemberCardView
                                member={depMember}
                                dependentIndex={depIdx + 1}
                                showBackSide={true}
                                onUpdatePhoto={async (memberId, dataUrl) => {
                                  const updatedSub: ClubSubscription = {
                                    ...selectedSubForDetail,
                                    members: selectedSubForDetail.members.map((m) =>
                                      m.id === memberId
                                        ? { ...m, photoUrl: dataUrl }
                                        : m
                                    ),
                                  };
                                  const nextState: ClubDatabaseState = {
                                    ...state,
                                    subscriptions: (state.subscriptions || []).map((s) =>
                                      s.id === updatedSub.id ? updatedSub : s
                                    ),
                                  };
                                  setSelectedSubForDetail(updatedSub);
                                  await persist(nextState);
                                  toast({ title: 'Foto 3x4 atualizada!' });
                                }}
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* =====================================================================
                  OPÇÃO 2: CADASTRAR CARTÃO DE CRÉDITO / DÉBITO PARA ATIVAR ASSINATURA
              ===================================================================== */}
              {clientDetailTool === 'CADASTRAR_CARTAO_PAGTO' && (
                <div className="bg-white rounded-2xl border-2 border-emerald-600/40 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-emerald-700" />
                        2. Cadastrar Cartão de Crédito / Débito para Ativar Assinatura
                      </h3>
                      <p className="text-xs text-slate-500">
                        Escolha em quantas vezes deseja parcelar, confira o valor das parcelas e cadastre o cartão para ativar a assinatura imediatamente.
                      </p>
                    </div>
                    {selectedSubForDetail.registeredCard && (
                      <Badge className="bg-emerald-700 text-white">
                        Cartão Final •••• {selectedSubForDetail.registeredCard.last4Digits} Ativo
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-bold text-slate-700">
                        Modalidade do Cartão
                      </Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <Button
                          type="button"
                          variant={adminCardType === 'CREDIT' ? 'default' : 'outline'}
                          onClick={() => setAdminCardType('CREDIT')}
                          className={
                            adminCardType === 'CREDIT'
                              ? 'bg-[#004d00] text-white font-bold text-xs'
                              : 'text-xs'
                          }
                        >
                          Cartão de Crédito (1x a 12x)
                        </Button>
                        <Button
                          type="button"
                          disabled={selectedSubForDetail.billingCycle === 'ANNUAL'}
                          variant={adminCardType === 'DEBIT' ? 'default' : 'outline'}
                          onClick={() => {
                            setAdminCardType('DEBIT');
                            setAdminCardInstallments(1);
                          }}
                          className={
                            adminCardType === 'DEBIT'
                              ? 'bg-[#004d00] text-white font-bold text-xs'
                              : 'text-xs'
                          }
                        >
                          Cartão de Débito (Recorrente Mensal)
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-bold text-slate-700">
                        Em quantas vezes deseja parcelar?
                      </Label>
                      <select
                        value={adminCardInstallments}
                        onChange={(e) =>
                          setAdminCardInstallments(Number(e.target.value))
                        }
                        className="w-full h-10 mt-1 rounded-lg border border-slate-300 px-3 text-xs font-bold bg-white"
                      >
                        {Array.from({ length: 12 }, (_, idx) => idx + 1).map(
                          (n) => {
                            const totalBase =
                              selectedSubForDetail.totalContractValue ||
                              selectedSubForDetail.monthlyEquivalent * 12;
                            const valParcela = Number(
                              (totalBase / n).toFixed(2)
                            );
                            return (
                              <option key={n} value={n}>
                                {n}x de {formatCurrency(valParcela)} sem juros (Total:{' '}
                                {formatCurrency(totalBase)})
                              </option>
                            );
                          }
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-5">
                      <Label className="text-xs font-bold">
                        Nome Impresso no Cartão *
                      </Label>
                      <Input
                        value={adminCardHolder}
                        onChange={(e) =>
                          setAdminCardHolder(e.target.value.toUpperCase())
                        }
                        placeholder={selectedSubForDetail.holderName.toUpperCase()}
                      />
                    </div>
                    <div className="md:col-span-4">
                      <Label className="text-xs font-bold">
                        Número do Cartão *
                      </Label>
                      <Input
                        value={adminCardNumber}
                        onChange={(e) => setAdminCardNumber(e.target.value)}
                        placeholder="0000 0000 0000 0000"
                        maxLength={19}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs font-bold">Validade *</Label>
                      <Input
                        value={adminCardExpiry}
                        onChange={(e) => setAdminCardExpiry(e.target.value)}
                        placeholder="MM/AA"
                        maxLength={5}
                      />
                    </div>
                    <div className="md:col-span-1">
                      <Label className="text-xs font-bold">CVV *</Label>
                      <Input
                        value={adminCardCvv}
                        onChange={(e) => setAdminCardCvv(e.target.value)}
                        placeholder="123"
                        maxLength={4}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-slate-600">
                      Valor da Parcela Selecionada:{' '}
                      <strong className="text-emerald-800 text-sm">
                        {adminCardInstallments}x de{' '}
                        {formatCurrency(
                          (selectedSubForDetail.totalContractValue ||
                            selectedSubForDetail.monthlyEquivalent * 12) /
                            adminCardInstallments
                        )}
                      </strong>
                    </div>
                    <Button
                      type="button"
                      onClick={async () => {
                        const digits = adminCardNumber.replace(/\D/g, '');
                        if (digits.length < 12) {
                          toast({
                            title: 'Número do cartão inválido',
                            description: 'Digite os dígitos do cartão para ativar.',
                            variant: 'destructive',
                          });
                          return;
                        }
                        const totalBase =
                          selectedSubForDetail.totalContractValue ||
                          selectedSubForDetail.monthlyEquivalent * 12;
                        const instValue = Number(
                          (totalBase / adminCardInstallments).toFixed(2)
                        );
                        const updatedSub: ClubSubscription = {
                          ...selectedSubForDetail,
                          status: 'ACTIVE',
                          paymentMethod:
                            adminCardType === 'DEBIT'
                              ? 'DEBIT_CARD'
                              : 'CREDIT_CARD',
                          installments: adminCardInstallments,
                          registeredCard: {
                            holderName:
                              adminCardHolder.trim() ||
                              selectedSubForDetail.holderName.toUpperCase(),
                            last4Digits: digits.slice(-4),
                            expiry: adminCardExpiry || '12/29',
                            cardType: adminCardType,
                            installments: adminCardInstallments,
                            installmentValue: instValue,
                            registeredAt: new Date().toISOString(),
                          },
                          members: selectedSubForDetail.members.map((m) => ({
                            ...m,
                            status: 'ACTIVE',
                          })),
                          invoices: selectedSubForDetail.invoices.map((inv, idx) =>
                            idx === 0
                              ? {
                                  ...inv,
                                  status: 'PAID',
                                  paidAt: new Date().toISOString(),
                                }
                              : inv
                          ),
                        };
                        const nextState: ClubDatabaseState = {
                          ...state,
                          subscriptions: (state.subscriptions || []).map((s) =>
                            s.id === updatedSub.id ? updatedSub : s
                          ),
                        };
                        setSelectedSubForDetail(updatedSub);
                        setSituacaoLiberar('SIM');
                        setSituacaoInativar('NAO');
                        await persist(nextState);
                        toast({
                          title: 'Cartão cadastrado e Assinatura ATIVADA!',
                          description: `Cartão final ${digits.slice(-4)} (${adminCardInstallments}x de ${formatCurrency(instValue)}). Carteirinhas liberadas!`,
                        });
                      }}
                      className="bg-[#004d00] hover:bg-emerald-900 text-white font-black text-xs px-6 h-10"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Cadastrar Cartão e Ativar Assinatura
                    </Button>
                  </div>
                </div>
              )}

              {/* =====================================================================
                  PERFIL FINANCEIRO DO CLIENTE ($) — IDÊNTICO À IMAGEM ENVIADA
                  • Cabeçalho: Perfil financeiro - {NOME DO CLIENTE}
                  • Barra verde-clara: [ADD CARNÊ] [VOLTAR]
                  • Seletor: ESCOLHA UM CARNÊ: [Carnê 1 v] [VER PARCELAS]
                  • Tabela verde-escura (#004d00):
                    # | REGISTRO | PLANO/DESC | Nº PARC. | VENCIMENTO | RECEBIMENTO | VALOR | STATUS | AÇÃO (5 botões) | EXCLUIR
                  • Barra inferior azul-clara:
                    [FATURA AVULSA] [GERAR CARNÊ] [TODOS EM CARTÃO (Link único)] [CARNÊ SIMPLES]
              ===================================================================== */}
              {clientDetailTool === 'FINANCEIRO_CLIENTE' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
                  {/* Título Perfil financeiro - NOME DO CLIENTE */}
                  <div className="border-b border-slate-200 pb-2">
                    <h3 className="text-xl font-normal text-slate-700">
                      Perfil financeiro -{' '}
                      <span className="underline font-semibold text-slate-900 uppercase">
                        {selectedSubForDetail.holderName}
                      </span>
                    </h3>
                  </div>

                  {/* Faixa verde-clara superior com botões ADD CARNÊ e VOLTAR */}
                  <div className="bg-[#dff0d8] border border-[#d6e9c6] rounded-md py-3 px-4 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleGenerateNewCarneForClient(selectedSubForDetail)
                      }
                      className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs uppercase px-4 py-2 rounded shadow-sm flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> ADD CARNÊ
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientDetailTool('DADOS_CADASTRAIS')}
                      className="bg-[#2b6cb0] hover:bg-blue-800 text-white font-bold text-xs uppercase px-4 py-2 rounded shadow-sm"
                    >
                      VOLTAR
                    </button>
                  </div>

                  {/* ESCOLHA UM CARNÊ + VER PARCELAS */}
                  <div className="flex flex-wrap items-end justify-center gap-3 py-1">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        ESCOLHA UM CARNÊ:
                      </label>
                      <select
                        value={selectedCarneNumber}
                        onChange={(e) => setSelectedCarneNumber(e.target.value)}
                        className="h-9 w-56 rounded border border-slate-300 px-3 text-xs font-semibold bg-white text-slate-800"
                      >
                        <option value="1">Carnê 1</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        toast({
                          title: 'Carnê 1 carregado',
                          description: `Exibindo ${selectedSubForDetail.invoices.length} parcelas do cliente.`,
                        })
                      }
                      className="h-9 bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs uppercase px-4 rounded shadow-sm"
                    >
                      VER PARCELAS
                    </button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const dateSigned = selectedSubForDetail.createdAt
                          ? formatDateBR(selectedSubForDetail.createdAt.split('T')[0])
                          : 'recente';
                        const legalMsg = `Olá, ${selectedSubForDetail.holderName}. Entendemos sua dúvida, mas esclarecemos que a sua associação ao Lessa Club foi realizada em ${dateSigned} via formulário digital oficial. No momento do cadastro, houve o preenchimento dos seus dados pessoais e o aceite eletrônico do Contrato de Adesão de Associado do Balneário Família Lessa, seguido pelo pagamento da primeira mensalidade.\n\nA legislação brasileira (pelo Código Civil e pela Medida Provisória nº 2.200-2/2001) reconhece o contrato eletrônico e o 'clique de aceite' como manifestações de vontade plenamente válidas e com força jurídica de assinatura física. Como o plano escolhido prevê renovação automática e a ausência de frequência ao balneário não suspende a cobrança, o plano continuou ativo e os valores em aberto são devidos.\n\nEstamos à disposição para facilitar o parcelamento desse saldo. Como podemos te ajudar a regularizar?`;
                        navigator.clipboard.writeText(legalMsg);
                        toast({
                          title: '⚖️ Resposta Jurídica Copiada!',
                          description: 'Texto formal com respaldo do Código Civil e MP 2.200-2/2001 pronto para colar no WhatsApp.',
                        });
                      }}
                      className="h-9 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/40 font-bold text-xs shadow-sm"
                    >
                      ⚖️ Copiar Resposta Jurídica Cobrança ("Não assinei nada")
                    </Button>
                  </div>

                  {/* Modal/Form inline para Editar Parcela (quando clica no ícone Chave Inglesa) */}
                  {editingClientInvoiceId && (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[160px]">
                        <Label className="text-xs font-bold text-amber-950">
                          Plano / Descrição da Parcela
                        </Label>
                        <Input
                          value={editInvDesc}
                          onChange={(e) => setEditInvDesc(e.target.value)}
                          className="h-8 text-xs bg-white mt-1"
                        />
                      </div>
                      <div className="w-40">
                        <Label className="text-xs font-bold text-amber-950">
                          Vencimento
                        </Label>
                        <Input
                          type="date"
                          value={editInvDueDate}
                          onChange={(e) => setEditInvDueDate(e.target.value)}
                          className="h-8 text-xs bg-white mt-1"
                        />
                      </div>
                      <div className="w-32">
                        <Label className="text-xs font-bold text-amber-950">
                          Valor (R$)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editInvAmount}
                          onChange={(e) => setEditInvAmount(e.target.value)}
                          className="h-8 text-xs bg-white mt-1"
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={async () => {
                          const targetInv = selectedSubForDetail.invoices.find(
                            (inv) => inv.id === editingClientInvoiceId
                          );
                          const newDueDate = editInvDueDate || targetInv?.dueDate || '';
                          const newAmount = Number(editInvAmount) || targetInv?.amount || 0;

                          let asaasSyncSuccess = false;
                          let asaasErrorMsg = '';

                          if (
                            targetInv?.asaasPaymentId &&
                            (newDueDate !== targetInv.dueDate || newAmount !== targetInv.amount)
                          ) {
                            try {
                              await updateAsaasPaymentDueDate(
                                targetInv.asaasPaymentId,
                                newDueDate,
                                newAmount
                              );
                              asaasSyncSuccess = true;
                            } catch (err: any) {
                              console.error('Erro ao atualizar no Asaas:', err);
                              asaasErrorMsg = err?.message || 'Falha ao sincronizar com Asaas';
                            }
                          }

                          const updatedInvoices =
                            selectedSubForDetail.invoices.map((inv) =>
                              inv.id === editingClientInvoiceId
                                ? {
                                    ...inv,
                                    description:
                                      editInvDesc.trim() || inv.description,
                                    dueDate: newDueDate,
                                    amount: newAmount,
                                  }
                                : inv
                            );
                          const updatedSub: ClubSubscription = {
                            ...selectedSubForDetail,
                            invoices: updatedInvoices,
                          };
                          const nextState: ClubDatabaseState = {
                            ...state,
                            subscriptions: (state.subscriptions || []).map((s) =>
                              s.id === updatedSub.id ? updatedSub : s
                            ),
                          };
                          setSelectedSubForDetail(updatedSub);
                          await persist(nextState);
                          setEditingClientInvoiceId(null);

                          if (asaasSyncSuccess) {
                            toast({
                              title: 'Parcela atualizada com sucesso!',
                              description: 'Data de vencimento e valor sincronizados diretamente no Asaas.',
                            });
                          } else if (asaasErrorMsg) {
                            toast({
                              title: 'Parcela atualizada localmente',
                              description: `Aviso Asaas: ${asaasErrorMsg}`,
                              variant: 'destructive',
                            });
                          } else {
                            toast({ title: 'Parcela atualizada com sucesso!' });
                          }
                        }}
                        className="h-8 bg-[#004d00] text-white text-xs font-bold"
                      >
                        Salvar Parcela
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingClientInvoiceId(null)}
                        className="h-8 text-xs"
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}

                  {/* Formulário inline para FATURA AVULSA */}
                  {showFaturaAvulsaForm && (
                    <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[180px]">
                        <Label className="text-xs font-bold text-sky-950">
                          Descrição da Fatura Avulsa
                        </Label>
                        <Input
                          value={avulsaDesc}
                          onChange={(e) => setAvulsaDesc(e.target.value)}
                          className="h-8 text-xs bg-white mt-1"
                        />
                      </div>
                      <div className="w-36">
                        <Label className="text-xs font-bold text-sky-950">
                          Vencimento
                        </Label>
                        <Input
                          type="date"
                          value={avulsaDueDate}
                          onChange={(e) => setAvulsaDueDate(e.target.value)}
                          className="h-8 text-xs bg-white mt-1"
                        />
                      </div>
                      <div className="w-32">
                        <Label className="text-xs font-bold text-sky-950">
                          Valor (R$)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={avulsaAmount}
                          onChange={(e) => setAvulsaAmount(e.target.value)}
                          className="h-8 text-xs bg-white mt-1"
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={async () => {
                          const nextNum =
                            selectedSubForDetail.invoices.length + 1;
                          const newInv: ClubInvoice = {
                            id: `inv_avulsa_${Date.now()}`,
                            subscriptionId: selectedSubForDetail.id,
                            subscriptionCode:
                              selectedSubForDetail.subscriptionCode,
                            holderName: selectedSubForDetail.holderName,
                            holderCpf: selectedSubForDetail.holderCpf,
                            holderPhone: selectedSubForDetail.holderPhone,
                            installmentNumber: nextNum,
                            totalInstallments: nextNum,
                            referenceMonth: avulsaDueDate
                              .slice(0, 7)
                              .split('-')
                              .reverse()
                              .join('/'),
                            amount: Number(avulsaAmount) || 49.9,
                            dueDate: avulsaDueDate,
                            paymentMethod: 'PIX',
                            status: 'PENDING',
                            description: avulsaDesc.trim() || 'Fatura Avulsa',
                            createdAt: new Date().toISOString(),
                          };
                          const updatedSub: ClubSubscription = {
                            ...selectedSubForDetail,
                            invoices: [
                              ...selectedSubForDetail.invoices,
                              newInv,
                            ],
                          };
                          const nextState: ClubDatabaseState = {
                            ...state,
                            subscriptions: (state.subscriptions || []).map((s) =>
                              s.id === updatedSub.id ? updatedSub : s
                            ),
                          };
                          setSelectedSubForDetail(updatedSub);
                          await persist(nextState);
                          setShowFaturaAvulsaForm(false);
                          toast({
                            title: 'Fatura Avulsa adicionada!',
                            description: `${newInv.description} — ${formatCurrency(newInv.amount)}`,
                          });
                        }}
                        className="h-8 bg-[#004d00] text-white text-xs font-bold"
                      >
                        + Lançar Fatura Avulsa
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowFaturaAvulsaForm(false)}
                        className="h-8 text-xs"
                      >
                        Fechar
                      </Button>
                    </div>
                  )}

                  {/* TABELA VERDE-ESCURA IDÊNTICA AO PERFIL FINANCEIRO DA IMAGEM */}
                  <div className="overflow-x-auto rounded-md border border-emerald-950 shadow">
                    <table className="w-full text-left border-collapse bg-[#004d00] text-white text-xs">
                      <thead>
                        <tr className="border-b border-emerald-800 bg-[#003d00] text-[11px] font-black uppercase tracking-wider">
                          <th className="py-2.5 px-3 border-r border-emerald-800/80">
                            #
                          </th>
                          <th className="py-2.5 px-3 border-r border-emerald-800/80">
                            REGISTRO
                          </th>
                          <th className="py-2.5 px-3 border-r border-emerald-800/80">
                            PLANO/DESC
                          </th>
                          <th className="py-2.5 px-3 border-r border-emerald-800/80">
                            Nº PARC.
                          </th>
                          <th className="py-2.5 px-3 border-r border-emerald-800/80">
                            VENCIMENTO | RECEBIMENTO
                          </th>
                          <th className="py-2.5 px-3 border-r border-emerald-800/80">
                            VALOR
                          </th>
                          <th className="py-2.5 px-3 border-r border-emerald-800/80 text-center">
                            STATUS
                          </th>
                          <th className="py-2.5 px-3 border-r border-emerald-800/80 text-center">
                            AÇÃO
                          </th>
                          <th className="py-2.5 px-3 text-center">EXCLUIR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-800/80">
                        {selectedSubForDetail.invoices.map((inv, idx) => {
                          const isPaid = inv.status === 'PAID';
                          const todayIso = new Date()
                            .toISOString()
                            .split('T')[0];
                          const isOverdue =
                            !isPaid &&
                            (inv.status === 'OVERDUE' ||
                              inv.dueDate < todayIso);
                          const checkedForDel =
                            selectedClientInvoiceIdsForDelete.includes(inv.id);

                          return (
                            <tr
                              key={inv.id}
                              className="hover:bg-emerald-900/70 transition-colors"
                            >
                              <td className="py-2 px-3 border-r border-emerald-800/60 font-bold">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3 border-r border-emerald-800/60">
                                {formatDateBR(
                                  inv.createdAt || selectedSubForDetail.createdAt
                                )}
                              </td>
                              <td className="py-2 px-3 border-r border-emerald-800/60">
                                {inv.description || 'Mensalidade'}
                              </td>
                              <td className="py-2 px-3 border-r border-emerald-800/60 font-semibold">
                                {inv.installmentNumber} /{' '}
                                {inv.totalInstallments ||
                                  selectedSubForDetail.invoices.length}
                              </td>
                              <td className="py-2 px-3 border-r border-emerald-800/60 font-mono">
                                <span>{formatDateBR(inv.dueDate)}</span>
                                <span className="mx-1.5 text-emerald-300">|</span>
                                {isPaid ? (
                                  <span className="bg-[#90ee90] text-[#003d00] font-black px-1.5 py-0.5 rounded text-[11px]">
                                    {formatDateBR(inv.paidAt || inv.dueDate)}
                                  </span>
                                ) : (
                                  <span className="text-emerald-200/80">
                                    __/__/____
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 border-r border-emerald-800/60 font-bold">
                                {formatCurrency(inv.amount)}
                              </td>
                              <td className="py-2 px-3 border-r border-emerald-800/60 text-center">
                                {isPaid ? (
                                  <span className="inline-block bg-[#90ee90] text-[#003d00] font-black text-[10px] uppercase px-2.5 py-0.5 rounded">
                                    PAGO
                                  </span>
                                ) : isOverdue ? (
                                  <span className="inline-block bg-[#f4a460] text-slate-900 font-black text-[10px] uppercase px-2.5 py-0.5 rounded">
                                    VENCIDA
                                  </span>
                                ) : (
                                  <span className="inline-block bg-[#a4c2f4] text-slate-900 font-black text-[10px] uppercase px-2.5 py-0.5 rounded">
                                    NÃO PAGA
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 border-r border-emerald-800/60">
                                <div className="flex items-center justify-center gap-1">
                                  {/* 1. Chave Inglesa (Editar parcela) */}
                                  <button
                                    type="button"
                                    title="Editar vencimento / valor da parcela"
                                    onClick={() => {
                                      setEditingClientInvoiceId(inv.id);
                                      setEditInvDesc(
                                        inv.description || 'Mensalidade'
                                      );
                                      setEditInvDueDate(inv.dueDate);
                                      setEditInvAmount(String(inv.amount));
                                    }}
                                    className="w-7 h-7 rounded bg-[#2e8b57] hover:bg-emerald-600 text-white flex items-center justify-center shadow-sm border border-white/20"
                                  >
                                    <Wrench className="w-3.5 h-3.5" />
                                  </button>

                                  {/* 2. Impressora (Imprimir Recibo da Parcela) */}
                                  <button
                                    type="button"
                                    title="Imprimir Recibo desta Parcela"
                                    onClick={() =>
                                      handlePrintInstallmentReceipt(
                                        selectedSubForDetail,
                                        inv
                                      )
                                    }
                                    className="w-7 h-7 rounded bg-[#2e8b57] hover:bg-emerald-600 text-white flex items-center justify-center shadow-sm border border-white/20"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>

                                  {/* 3. Botão Vermelho X (Estornar / Marcar Não Paga) */}
                                  <button
                                    type="button"
                                    title="Estornar / Marcar parcela como NÃO PAGA"
                                    onClick={async () => {
                                      const updatedInvoices =
                                        selectedSubForDetail.invoices.map((i) =>
                                          i.id === inv.id
                                            ? {
                                                ...i,
                                                status: 'PENDING' as const,
                                                paidAt: undefined,
                                              }
                                            : i
                                        );
                                      const updatedSub: ClubSubscription = {
                                        ...selectedSubForDetail,
                                        invoices: updatedInvoices,
                                      };
                                      const nextState: ClubDatabaseState = {
                                        ...state,
                                        subscriptions: (state.subscriptions || []).map(
                                          (s) =>
                                            s.id === updatedSub.id
                                              ? updatedSub
                                              : s
                                        ),
                                      };
                                      setSelectedSubForDetail(updatedSub);
                                      await persist(nextState);
                                      toast({
                                        title: `Parcela ${inv.installmentNumber} marcada como NÃO PAGA.`,
                                      });
                                    }}
                                    className="w-7 h-7 rounded bg-[#d9534f] hover:bg-rose-700 text-white flex items-center justify-center shadow-sm border border-white/20"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>

                                  {/* 4. Botão Verde Check (Dar Baixa / PAGO) */}
                                  <button
                                    type="button"
                                    title="Dar Baixa (Marcar como PAGO e liberar cliente)"
                                    onClick={async () => {
                                      const next = await markClubInvoicePaid(
                                        selectedSubForDetail.id,
                                        inv.id,
                                        'LOCAL'
                                      );
                                      setState(next);
                                      const updated = next.subscriptions.find(
                                        (s) => s.id === selectedSubForDetail.id
                                      );
                                      if (updated) {
                                        setSelectedSubForDetail(updated);
                                        setSituacaoLiberar('SIM');
                                        setSituacaoInativar('NAO');
                                      }
                                      toast({
                                        title: `Parcela ${inv.installmentNumber} baixada como PAGO!`,
                                        description:
                                          'Recebimento registrado e cliente liberado.',
                                      });
                                    }}
                                    className="w-7 h-7 rounded bg-[#5cb85c] hover:bg-emerald-500 text-white flex items-center justify-center shadow-sm border border-white/20"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>

                                  {/* 5. Botão Azul (PIX / Boleto Asaas da Parcela) */}
                                  <button
                                    type="button"
                                    title="Visualizar / Gerar Cobrança PIX ou Boleto desta parcela"
                                    onClick={() => setSelectedInvoiceForPixModal(inv)}
                                    className="w-7 h-7 rounded bg-[#5bc0de] hover:bg-sky-500 text-white flex items-center justify-center shadow-sm border border-white/20"
                                  >
                                    <QrCode className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={checkedForDel}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedClientInvoiceIdsForDelete(
                                        (prev) => [...prev, inv.id]
                                      );
                                    } else {
                                      setSelectedClientInvoiceIdsForDelete(
                                        (prev) =>
                                          prev.filter((id) => id !== inv.id)
                                      );
                                    }
                                  }}
                                  className="w-4 h-4 rounded cursor-pointer"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Rodapé da tabela com botão Excluir Selecionados */}
                    <div className="bg-[#004d00] border-t border-emerald-800 px-3 py-2.5 flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          if (selectedClientInvoiceIdsForDelete.length === 0) {
                            toast({
                              title: 'Selecione ao menos uma parcela na coluna EXCLUIR',
                              variant: 'destructive',
                            });
                            return;
                          }
                          const remaining =
                            selectedSubForDetail.invoices.filter(
                              (i) =>
                                !selectedClientInvoiceIdsForDelete.includes(
                                  i.id
                                )
                            );
                          const updatedSub: ClubSubscription = {
                            ...selectedSubForDetail,
                            invoices: remaining,
                          };
                          const nextState: ClubDatabaseState = {
                            ...state,
                            subscriptions: (state.subscriptions || []).map((s) =>
                              s.id === updatedSub.id ? updatedSub : s
                            ),
                          };
                          setSelectedSubForDetail(updatedSub);
                          setSelectedClientInvoiceIdsForDelete([]);
                          await persist(nextState);
                          toast({
                            title: 'Parcelas selecionadas excluídas!',
                          });
                        }}
                        className="bg-slate-100 hover:bg-white text-slate-800 font-semibold text-xs px-3 py-1.5 rounded shadow-sm"
                      >
                        Excluir Selecionados
                      </button>
                    </div>
                  </div>

                  {/* BARRA INFERIOR COM OS 4 BOTÕES AZUIS (IDÊNTICA À IMAGEM ENVIADA) */}
                  <div className="bg-[#e8f4f8] border border-[#bce8f1] rounded-md p-3 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setShowFaturaAvulsaForm(!showFaturaAvulsaForm)
                      }
                      className="bg-[#5bc0de] hover:bg-[#31b0d5] text-white font-bold text-xs uppercase px-4 py-2 rounded shadow-sm flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" /> FATURA AVULSA
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCarneInstallmentValue(
                          String(selectedSubForDetail.monthlyEquivalent || 49.9)
                        );
                        setCarneInstallmentCount(12);
                        setCarneModalOpen(true);
                      }}
                      className="bg-[#5bc0de] hover:bg-[#31b0d5] text-white font-bold text-xs uppercase px-4 py-2 rounded shadow-sm flex items-center gap-1.5"
                    >
                      <Receipt className="w-3.5 h-3.5" /> GERAR CARNÊ
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setUnifiedCardUrl('');
                        setUnifiedCardModalOpen(true);
                      }}
                      className="bg-[#5bc0de] hover:bg-[#31b0d5] text-white font-bold text-xs uppercase px-4 py-2 rounded shadow-sm flex items-center gap-1.5"
                    >
                      <CreditCard className="w-3.5 h-3.5" /> TODOS EM CARTÃO (Link único)
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handlePrintCarneSimples(selectedSubForDetail)
                      }
                      className="bg-[#5bc0de] hover:bg-[#31b0d5] text-white font-bold text-xs uppercase px-4 py-2 rounded shadow-sm flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" /> CARNÊ SIMPLES
                    </button>
                  </div>
                </div>
              )}

              {/* MODAL COBRANÇA PIX DA PARCELA INDIVIDUAL (BOTÃO AZUL QR CODE) */}
              <Dialog
                open={!!selectedInvoiceForPixModal}
                onOpenChange={(o) => !o && setSelectedInvoiceForPixModal(null)}
              >
                <DialogContent className="max-w-md">
                  {selectedInvoiceForPixModal && (
                    <div className="space-y-4">
                      <DialogHeader>
                        <DialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                          <QrCode className="w-5 h-5 text-emerald-700" />
                          Cobrança PIX — Parcela {selectedInvoiceForPixModal.installmentNumber} / {selectedInvoiceForPixModal.totalInstallments}
                        </DialogTitle>
                      </DialogHeader>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Associado:</span>
                          <strong className="text-slate-900">{selectedSubForDetail.holderName}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Valor da Parcela:</span>
                          <strong className="text-emerald-700 text-sm font-black">
                            {formatCurrency(selectedInvoiceForPixModal.amount)}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Vencimento:</span>
                          <strong className="text-slate-900">{formatDateBR(selectedInvoiceForPixModal.dueDate)}</strong>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Situação:</span>
                          <Badge className={selectedInvoiceForPixModal.status === 'PAID' ? 'bg-emerald-600 text-white font-bold' : 'bg-amber-600 text-white font-bold'}>
                            {selectedInvoiceForPixModal.status === 'PAID' ? 'PAGO' : 'NÃO PAGA'}
                          </Badge>
                        </div>
                      </div>

                      {/* Imagem QR Code */}
                      <div className="text-center p-4 bg-white border border-slate-200 rounded-2xl shadow-inner">
                        <img
                          src={
                            selectedInvoiceForPixModal.pixQrCode
                              ? selectedInvoiceForPixModal.pixQrCode.startsWith('data:')
                                ? selectedInvoiceForPixModal.pixQrCode
                                : `data:image/png;base64,${selectedInvoiceForPixModal.pixQrCode}`
                              : getQrCodeImageUrl(
                                  selectedInvoiceForPixModal.pixPayload ||
                                    '00020101021226800014br.gov.bcb.pix2558pix.asaas.com/qr/lessa/46891134000140'
                                )
                          }
                          alt="PIX QR Code"
                          className="w-44 h-44 mx-auto rounded-lg object-contain shadow-sm border border-slate-100"
                        />
                        <span className="text-[11px] text-slate-400 block mt-2">
                          Escaneie com o app do banco ou copie o código abaixo
                        </span>
                      </div>

                      {/* Código Copia e Cola */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">Chave PIX / Código Copia e Cola</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            value={
                              selectedInvoiceForPixModal.pixPayload ||
                              '46.891.134/0001-40'
                            }
                            className="text-xs font-mono bg-slate-50 truncate"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                selectedInvoiceForPixModal.pixPayload || '46.891.134/0001-40'
                              );
                              toast({ title: 'Código PIX copiado com sucesso!' });
                            }}
                            className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs shrink-0"
                          >
                            <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                          </Button>
                        </div>
                      </div>

                      {/* Ações: Asaas e WhatsApp */}
                      <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
                        <div className="flex flex-wrap items-center gap-2">
                          {selectedInvoiceForPixModal.invoiceUrl ? (
                            <a
                              href={selectedInvoiceForPixModal.invoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1"
                            >
                              <Button
                                type="button"
                                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-9"
                              >
                                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir Fatura no Asaas
                              </Button>
                            </a>
                          ) : (
                            <Button
                              type="button"
                              disabled={loadingRowPix}
                              onClick={async () => {
                                setLoadingRowPix(true);
                                try {
                                  const charge = await generateAsaasChargeForClubInvoice(
                                    selectedSubForDetail,
                                    selectedInvoiceForPixModal,
                                    'PIX'
                                  );
                                  setSelectedInvoiceForPixModal({
                                    ...selectedInvoiceForPixModal,
                                    asaasPaymentId: charge.paymentId,
                                    invoiceUrl: charge.invoiceUrl,
                                    pixPayload: charge.pixPayload,
                                    pixQrCode: charge.pixQrCode,
                                  });
                                  toast({
                                    title: 'Cobrança sincronizada com Asaas!',
                                    description: `Fatura online gerada com sucesso.`,
                                  });
                                } catch (err: any) {
                                  toast({
                                    title: 'Aviso ao gerar no Asaas',
                                    description: err.message || 'Utilize a chave oficial CNPJ 46.891.134/0001-40.',
                                    variant: 'destructive',
                                  });
                                } finally {
                                  setLoadingRowPix(false);
                                }
                              }}
                              className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-9"
                            >
                              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                              {loadingRowPix ? 'Gerando no Asaas...' : 'Sincronizar no Asaas'}
                            </Button>
                          )}

                          <a
                            href={`https://wa.me/55${selectedSubForDetail.holderPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                              `Olá ${selectedSubForDetail.holderName}! Segue o link/PIX da sua parcela ${selectedInvoiceForPixModal.installmentNumber}/${selectedInvoiceForPixModal.totalInstallments} (Vencimento: ${formatDateBR(selectedInvoiceForPixModal.dueDate)}) no valor de ${formatCurrency(selectedInvoiceForPixModal.amount)} do Balneário Lessa: ${selectedInvoiceForPixModal.invoiceUrl || selectedInvoiceForPixModal.pixPayload || 'Chave PIX CNPJ: 46.891.134/0001-40'}`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1"
                          >
                            <Button
                              type="button"
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9"
                            >
                              <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Enviar no WhatsApp
                            </Button>
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {/* MODAL TODOS EM CARTÃO (LINK ÚNICO DE QUITAÇÃO) */}
              <Dialog
                open={unifiedCardModalOpen}
                onOpenChange={(o) => !o && setUnifiedCardModalOpen(false)}
              >
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-emerald-700" />
                      TODOS EM CARTÃO — Link Único de Quitação
                    </DialogTitle>
                  </DialogHeader>

                  {(() => {
                    const pending = selectedSubForDetail.invoices.filter((i) => i.status !== 'PAID');
                    const totalPendingVal = Number(
                      pending.reduce((acc, i) => acc + i.amount, 0).toFixed(2)
                    );

                    return (
                      <div className="space-y-4 py-1 text-xs">
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                          <div className="flex justify-between font-bold text-slate-700">
                            <span>Associado:</span>
                            <span>{selectedSubForDetail.holderName} (#{selectedSubForDetail.subscriptionCode})</span>
                          </div>
                          <div className="flex justify-between font-bold text-slate-700">
                            <span>Parcelas Pendentes:</span>
                            <span>{pending.length} parcelas</span>
                          </div>
                          <div className="flex justify-between font-black text-sm text-emerald-900 border-t border-emerald-200 pt-1.5">
                            <span>Valor Total a Quitar:</span>
                            <span>{formatCurrency(totalPendingVal)}</span>
                          </div>
                        </div>

                        {/* Simulação de Parcelamento em até 12x */}
                        <div>
                          <Label className="text-xs font-bold text-slate-700 mb-1.5 block">
                            Simulação de Parcelamento no Cartão (Cliente paga tudo em 1 cobrança):
                          </Label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                            {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((x) => (
                              <div key={x} className="bg-white p-1.5 rounded border border-slate-200 text-center">
                                <span className="font-bold text-slate-800">{x}x</span> de{' '}
                                <span className="text-emerald-700 font-bold">
                                  {formatCurrency(totalPendingVal / x)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Botão de Gerar Link */}
                        {!unifiedCardUrl ? (
                          <Button
                            type="button"
                            disabled={unifiedCardLoading || pending.length === 0}
                            onClick={async () => {
                              setUnifiedCardLoading(true);
                              try {
                                const res = await generateUnifiedPaymentLink(
                                  selectedSubForDetail,
                                  pending,
                                  'CREDIT_CARD'
                                );
                                setUnifiedCardUrl(res.invoiceUrl);
                                toast({
                                  title: 'Link de Quitação Unificado gerado!',
                                  description: `Total: ${formatCurrency(totalPendingVal)} em até 12x.`,
                                });
                              } catch (err: any) {
                                const fallbackOrigin =
                                  typeof window !== 'undefined'
                                    ? window.location.origin
                                    : 'https://assinatura.balneariolessa.com.br';
                                const fallbackUrl = `${fallbackOrigin}/socio?cpf=${encodeURIComponent(
                                  selectedSubForDetail.holderCpf
                                )}&cartao=${encodeURIComponent(
                                  selectedSubForDetail.subscriptionCode
                                )}`;
                                setUnifiedCardUrl(fallbackUrl);
                                toast({
                                  title: 'Link Oficial Gerado!',
                                  description: 'Link oficial do portal para quitação no cartão.',
                                });
                              } finally {
                                setUnifiedCardLoading(false);
                              }
                            }}
                            className="w-full bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs h-10"
                          >
                            <Sparkles className="w-4 h-4 mr-1.5" />
                            {unifiedCardLoading
                              ? 'Gerando Link no Asaas...'
                              : `Gerar Link Único (${formatCurrency(totalPendingVal)})`}
                          </Button>
                        ) : (
                          <div className="space-y-3 p-3 bg-emerald-50 border border-emerald-300 rounded-xl">
                            <Label className="text-xs font-bold text-emerald-950">
                              Link Único de Pagamento no Cartão:
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input readOnly value={unifiedCardUrl} className="font-mono text-xs bg-white" />
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(unifiedCardUrl);
                                  toast({ title: 'Link copiado com sucesso!' });
                                }}
                                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shrink-0"
                              >
                                <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                              </Button>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <a
                                href={unifiedCardUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1"
                              >
                                <Button type="button" variant="outline" className="w-full text-xs font-bold bg-white h-9">
                                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir Pagamento
                                </Button>
                              </a>
                              <a
                                href={`https://wa.me/55${selectedSubForDetail.holderPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                  `Olá ${selectedSubForDetail.holderName}! Segue o link exclusivo para quitar todas as suas ${pending.length} mensalidades do Balneário Lessa Club no cartão de crédito em até 12x: ${unifiedCardUrl}`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1"
                              >
                                <Button type="button" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-9">
                                  <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Enviar WhatsApp
                                </Button>
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Baixar todas de uma vez */}
                        <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                          <span className="text-[11px] text-slate-500">
                            Cliente já pagou na recepção / maquininha?
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            onClick={async () => {
                              const nowIso = new Date().toISOString();
                              const updatedInvoices = selectedSubForDetail.invoices.map((inv) => ({
                                ...inv,
                                status: 'PAID' as const,
                                paidAt: inv.paidAt || nowIso,
                              }));
                              const updatedSub: ClubSubscription = {
                                ...selectedSubForDetail,
                                status: 'ACTIVE',
                                invoices: updatedInvoices,
                              };
                              const nextState: ClubDatabaseState = {
                                ...state!,
                                subscriptions: state!.subscriptions.map((s) =>
                                  s.id === updatedSub.id ? updatedSub : s
                                ),
                              };
                              setSelectedSubForDetail(updatedSub);
                              await persist(nextState);
                              setUnifiedCardModalOpen(false);
                              toast({
                                title: 'Todas as parcelas baixadas como PAGO!',
                                description: `${pending.length} parcelas quitadas e cliente ATIVO.`,
                              });
                            }}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Dar Baixa em Todas
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </DialogContent>
              </Dialog>

              {/* MODAL GERAR CARNÊ / + ADD CARNÊ */}
              <Dialog
                open={carneModalOpen}
                onOpenChange={(o) => !o && setCarneModalOpen(false)}
              >
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-emerald-700" />
                      Gerar Carnê de Parcelas — {selectedSubForDetail.holderName}
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4 py-1 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-700">Qtd. de Parcelas</Label>
                        <Input
                          type="number"
                          min="1"
                          max="24"
                          value={carneInstallmentCount}
                          onChange={(e) =>
                            setCarneInstallmentCount(
                              Math.max(1, Math.min(24, Number(e.target.value) || 12))
                            )
                          }
                          className="h-9 text-xs bg-white font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-700">Valor da Parcela (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={carneInstallmentValue}
                          onChange={(e) => setCarneInstallmentValue(e.target.value)}
                          className="h-9 text-xs bg-white font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-700">Primeiro Vencimento</Label>
                        <Input
                          type="date"
                          value={carneFirstDueDate}
                          onChange={(e) => setCarneFirstDueDate(e.target.value)}
                          className="h-9 text-xs bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-700">Descrição</Label>
                        <Input
                          value={carneDescription}
                          onChange={(e) => setCarneDescription(e.target.value)}
                          placeholder="Mensalidade"
                          className="h-9 text-xs bg-white"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-[11px] text-slate-600">
                      <div>
                        Total do Carnê: <strong>{carneInstallmentCount}x de {formatCurrency(Number(carneInstallmentValue) || 49.9)}</strong> = <strong>{formatCurrency(carneInstallmentCount * (Number(carneInstallmentValue) || 49.9))}</strong>
                      </div>
                      <div>
                        As parcelas terão vencimento mensal consecutivo iniciando em <strong>{formatDateBR(carneFirstDueDate)}</strong>.
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
                      <Button
                        type="button"
                        onClick={async () => {
                          const updated = await handleGenerateNewCarneForClient(
                            selectedSubForDetail,
                            carneInstallmentCount,
                            Number(carneInstallmentValue) || 49.9,
                            carneFirstDueDate,
                            carneDescription.trim() || 'Mensalidade',
                            'append'
                          );
                          setCarneModalOpen(false);
                        }}
                        className="w-full bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs h-10"
                      >
                        <Plus className="w-4 h-4 mr-1.5" /> Adicionar {carneInstallmentCount} Parcelas ao Cadastro
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          const updated = await handleGenerateNewCarneForClient(
                            selectedSubForDetail,
                            carneInstallmentCount,
                            Number(carneInstallmentValue) || 49.9,
                            carneFirstDueDate,
                            carneDescription.trim() || 'Mensalidade',
                            'append'
                          );
                          setCarneModalOpen(false);
                          if (updated) {
                            handlePrintCarneSimples(updated);
                          }
                        }}
                        className="w-full text-xs font-bold h-10 border-slate-300"
                      >
                        <Printer className="w-4 h-4 mr-1.5" /> Gerar e Imprimir Carnê Simples Agora
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* =====================================================================
                  OPÇÃO 3: GERAR CONTRATO
              ===================================================================== */}
              {clientDetailTool === 'GERAR_CONTRATO' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        3. Contrato Oficial Preenchido — {selectedSubForDetail.holderName}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Inclui cláusulas espaçadas, tabela de dependentes e campos de assinatura para impressão.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handlePrintContract(selectedSubForDetail)}
                      className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs"
                    >
                      <Printer className="w-4 h-4 mr-1.5" /> Imprimir Contrato Assinado
                    </Button>
                  </div>
                  <div
                    className="p-6 rounded-xl border border-slate-200 bg-slate-50 max-h-96 overflow-y-auto text-xs prose max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: renderSubscriptionContractHtml(
                        selectedSubForDetail,
                        state.contractTemplates
                      ),
                    }}
                  />
                </div>
              )}

              {/* =====================================================================
                  OPÇÃO 4: ADICIONAR ANEXOS (IMAGENS, ARQUIVOS, PDF, ETC.)
              ===================================================================== */}
              {clientDetailTool === 'ANEXOS' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <Paperclip className="w-5 h-5 text-emerald-700" />
                        4. Anexos do Cliente (Imagens, Documentos, PDF, Comprovantes)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Anexe comprovante de estudante, laudo PCD/TEA, RG/CNH, contrato digitalizado ou recibos.
                      </p>
                    </div>
                    <Label
                      htmlFor="client-attachment-upload"
                      className="inline-flex items-center px-4 py-2 rounded-lg bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs cursor-pointer shadow"
                    >
                      <Upload className="w-4 h-4 mr-1.5" /> + Adicionar Anexo (Imagem / PDF / Arquivo)
                    </Label>
                    <input
                      id="client-attachment-upload"
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const dataUrl = await fileToDataUrl(file);
                        const newAtt: ClubAttachment = {
                          id: `att_${Date.now()}`,
                          name: file.name,
                          mimeType: file.type || 'application/octet-stream',
                          dataUrl,
                          createdAt: new Date().toISOString(),
                        };
                        const updatedSub: ClubSubscription = {
                          ...selectedSubForDetail,
                          attachments: [
                            newAtt,
                            ...(selectedSubForDetail.attachments || []),
                          ],
                        };
                        const nextState: ClubDatabaseState = {
                          ...state,
                          subscriptions: (state.subscriptions || []).map((s) =>
                            s.id === updatedSub.id ? updatedSub : s
                          ),
                        };
                        setSelectedSubForDetail(updatedSub);
                        await persist(nextState);
                        toast({
                          title: 'Anexo adicionado com sucesso!',
                          description: file.name,
                        });
                      }}
                    />
                  </div>

                  {(selectedSubForDetail.attachments || []).length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      Nenhum anexo cadastrado para este cliente ainda. Clique em "+ Adicionar Anexo" acima.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(selectedSubForDetail.attachments || []).map((att) => (
                        <div
                          key={att.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            {att.mimeType.startsWith('image/') ? (
                              <img
                                src={att.dataUrl}
                                alt={att.name}
                                className="w-12 h-12 rounded-lg object-cover border border-slate-300 shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs shrink-0">
                                PDF/DOC
                              </div>
                            )}
                            <div className="truncate">
                              <div className="font-bold text-xs text-slate-900 truncate">
                                {att.name}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Adicionado em {formatDateBR(att.createdAt)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={att.dataUrl}
                              download={att.name}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Button size="sm" variant="outline" className="h-8 text-xs">
                                <Download className="w-3.5 h-3.5 mr-1" /> Baixar
                              </Button>
                            </a>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const updatedSub: ClubSubscription = {
                                  ...selectedSubForDetail,
                                  attachments: (
                                    selectedSubForDetail.attachments || []
                                  ).filter((a) => a.id !== att.id),
                                };
                                const nextState: ClubDatabaseState = {
                                  ...state,
                                  subscriptions: (state.subscriptions || []).map((s) =>
                                    s.id === updatedSub.id ? updatedSub : s
                                  ),
                                };
                                setSelectedSubForDetail(updatedSub);
                                await persist(nextState);
                                toast({ title: 'Anexo removido.' });
                              }}
                              className="h-8 text-rose-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SEÇÃO EXTRA: DOCUMENTOS DOS DEPENDENTES (CERTIDÕES, LAUDOS, RG) */}
                  <div className="pt-4 border-t border-slate-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-black text-slate-800 flex items-center gap-1.5 uppercase">
                          <Paperclip className="w-4 h-4 text-emerald-700" />
                          Documentos dos Dependentes ({selectedSubForDetail.members.filter((m) => m.role === 'DEPENDENTE').reduce((acc, m) => acc + (m.attachments || []).length, 0)})
                        </h4>
                        <p className="text-xs text-slate-500">
                          Documentação comprobatória individual (RG, Certidão de Nascimento, Laudo PCD/TEA, Matrícula Estudantil).
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setClientDetailTool('ADICIONAR_DEPENDENTES')}
                        className="text-xs font-bold border-emerald-700 text-emerald-900"
                      >
                        <UserPlus className="w-3.5 h-3.5 mr-1" /> Ir para Gestão de Dependentes
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {selectedSubForDetail.members.filter((m) => m.role === 'DEPENDENTE').length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          Nenhum dependente cadastrado neste plano.
                        </p>
                      ) : (
                        selectedSubForDetail.members
                          .filter((m) => m.role === 'DEPENDENTE')
                          .map((dep) => (
                            <div
                              key={dep.id}
                              className="p-3 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div>
                                  <strong>{dep.fullName}</strong> ({dep.modalityName}) • Cartão #{dep.cardNumber}
                                  {dep.expirationDate && (
                                    <span className="ml-2 font-semibold text-amber-800">
                                      • Vencimento: {formatDateBR(dep.expirationDate)}
                                    </span>
                                  )}
                                </div>
                                <Label
                                  htmlFor={`anexos-tab-upload-${dep.id}`}
                                  className="inline-flex items-center px-2 py-1 rounded bg-[#004d00] hover:bg-emerald-800 text-white font-bold text-[11px] cursor-pointer"
                                >
                                  <Upload className="w-3 h-3 mr-1" /> + Anexar para {dep.fullName.split(' ')[0]}
                                </Label>
                                <input
                                  id={`anexos-tab-upload-${dep.id}`}
                                  type="file"
                                  accept="image/*,.pdf,.doc,.docx"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const dataUrl = await fileToDataUrl(file);
                                    const newAtt: ClubAttachment = {
                                      id: `att_dep_${Date.now()}`,
                                      name: `${dep.fullName.split(' ')[0]} - ${file.name}`,
                                      mimeType: file.type || 'application/octet-stream',
                                      dataUrl,
                                      createdAt: new Date().toISOString(),
                                    };
                                    const updatedMembers = selectedSubForDetail.members.map((m) =>
                                      m.id === dep.id
                                        ? { ...m, attachments: [newAtt, ...(m.attachments || [])] }
                                        : m
                                    );
                                    const updatedSub: ClubSubscription = {
                                      ...selectedSubForDetail,
                                      members: updatedMembers,
                                    };
                                    const nextState: ClubDatabaseState = {
                                      ...state,
                                      subscriptions: (state.subscriptions || []).map((s) =>
                                        s.id === updatedSub.id ? updatedSub : s
                                      ),
                                    };
                                    setSelectedSubForDetail(updatedSub);
                                    await persist(nextState);
                                    toast({
                                      title: 'Documento anexado ao dependente!',
                                      description: file.name,
                                    });
                                  }}
                                />
                              </div>

                              {(dep.attachments || []).length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic">
                                  Nenhum anexo para este dependente.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {(dep.attachments || []).map((att) => (
                                    <div
                                      key={att.id}
                                      className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs"
                                    >
                                      <div className="truncate">
                                        <div className="font-bold text-slate-800 truncate">
                                          {att.name}
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                          {formatDateBR(att.createdAt)}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <a href={att.dataUrl} download={att.name} target="_blank" rel="noreferrer">
                                          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]">
                                            <Download className="w-3 h-3 mr-1" /> Baixar
                                          </Button>
                                        </a>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={async () => {
                                            const updatedMembers = selectedSubForDetail.members.map((m) =>
                                              m.id === dep.id
                                                ? {
                                                    ...m,
                                                    attachments: (m.attachments || []).filter((a) => a.id !== att.id),
                                                  }
                                                : m
                                            );
                                            const updatedSub: ClubSubscription = {
                                              ...selectedSubForDetail,
                                              members: updatedMembers,
                                            };
                                            const nextState: ClubDatabaseState = {
                                              ...state,
                                              subscriptions: (state.subscriptions || []).map((s) =>
                                                s.id === updatedSub.id ? updatedSub : s
                                              ),
                                            };
                                            setSelectedSubForDetail(updatedSub);
                                            await persist(nextState);
                                            toast({ title: 'Documento removido.' });
                                          }}
                                          className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* =====================================================================
                  OPÇÃO 5: ADICIONAR DEPENDENTES DENTRO DO CADASTRO EXISTENTE
                  Inclui vencimento de cadastro, anexos individuais e transição para pagante
              ===================================================================== */}
              {clientDetailTool === 'ADICIONAR_DEPENDENTES' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-emerald-700" />
                        5. Gestão de Dependentes — {selectedSubForDetail.holderName}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Adicione dependentes, vincule anexos individuais (RG, Certidão, Laudo PCD/TEA), configure datas de expiração (ex: criança que completará idade pagante) e altere modalidades.
                      </p>
                    </div>
                  </div>

                  {/* FORMULÁRIO DE CADASTRO DE NOVO DEPENDENTE */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                      + Incluir Novo Dependente
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-4">
                        <Label className="text-xs font-bold text-slate-700">
                          Nome Completo do Dependente *
                        </Label>
                        <Input
                          value={newDepName}
                          onChange={(e) => setNewDepName(e.target.value)}
                          placeholder="Nome do dependente"
                          className="h-9 text-xs bg-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs font-bold text-slate-700">CPF</Label>
                        <Input
                          value={newDepCpf}
                          onChange={(e) => setNewDepCpf(e.target.value)}
                          placeholder="000.000.000-00"
                          className="h-9 text-xs bg-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs font-bold text-slate-700">Nascimento</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="DD/MM/AAAA"
                          maxLength={10}
                          value={newDepBirth}
                          onChange={(e) => setNewDepBirth(formatBirthDate(e.target.value))}
                          className="h-9 text-xs bg-white"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <Label className="text-xs font-bold text-slate-700">
                          Modalidade (Gratuidades / Pagantes)
                        </Label>
                        <select
                          value={newDepModality}
                          onChange={(e) => setNewDepModality(e.target.value)}
                          className="w-full h-9 rounded-lg border border-slate-300 px-2 text-xs font-bold bg-white"
                        >
                          {(state.modalities || []).map((m) => (
                            <option key={m.code} value={m.code}>
                              {m.name} —{' '}
                              {m.isFreeTier
                                ? 'GRATUITO (R$ 0,00)'
                                : formatCurrency(
                                    selectedSubForDetail.billingCycle === 'ANNUAL'
                                      ? m.annualInstallment
                                      : m.monthlyPrice
                                  )}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* CONTROLE DE VENCIMENTO DO DEPENDENTE (EX: CRIANÇA QUE FARÁ ANIVERSÁRIO EM 2 MESES) */}
                      <div className="sm:col-span-3">
                        <Label className="text-xs font-bold text-slate-700">
                          Vencimento de Cadastro / Documento
                        </Label>
                        <Input
                          type="date"
                          value={newDepExpirationDate}
                          onChange={(e) => setNewDepExpirationDate(e.target.value)}
                          className="h-9 text-xs bg-white"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <Label className="text-xs font-bold text-slate-700">
                          Observações de Vencimento / Transição
                        </Label>
                        <Input
                          value={newDepExpirationNotes}
                          onChange={(e) => setNewDepExpirationNotes(e.target.value)}
                          placeholder="Ex: Faz 6 anos em 2 meses, tornar pagante / Laudo PCD vence 2027"
                          className="h-9 text-xs bg-white"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <Label className="text-xs font-bold text-slate-700">
                          Foto 3x4 do Dependente
                        </Label>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              const url = await fileToDataUrl(f);
                              setNewDepPhoto(url);
                            }
                          }}
                          className="h-9 text-xs bg-white"
                        />
                      </div>

                      <div className="sm:col-span-12 flex justify-end pt-1">
                        <Button
                          type="button"
                          onClick={async () => {
                            if (!newDepName.trim()) {
                              toast({
                                title: 'Informe o nome do dependente',
                                variant: 'destructive',
                              });
                              return;
                            }
                            if (newDepCpf.trim() && !isValidCpf(newDepCpf)) {
                              toast({
                                title: 'CPF do Dependente Inválido',
                                description: 'Por favor, informe um CPF válido com 11 dígitos para o dependente.',
                                variant: 'destructive',
                              });
                              return;
                            }
                            const mod =
                              (state.modalities || []).find(
                                (m) => m.code === newDepModality
                              ) || state.modalities[0];
                            const newCardNum = String(
                              Number(selectedSubForDetail.subscriptionCode) +
                                selectedSubForDetail.members.length
                            );
                            const addMonthly =
                              selectedSubForDetail.billingCycle === 'ANNUAL'
                                ? mod.annualInstallment
                                : mod.monthlyPrice;
                            const newMember: ClubMember = {
                              id: `mem_${Date.now()}`,
                              subscriptionId: selectedSubForDetail.id,
                              role: 'DEPENDENTE',
                              modalityCode: mod.code,
                              modalityName: mod.name,
                              planCycleLabel: `${mod.name} (${
                                selectedSubForDetail.billingCycle === 'ANNUAL'
                                  ? 'Anual'
                                  : 'Mensal'
                              })`,
                              fullName: newDepName.trim(),
                              cpf: newDepCpf.trim(),
                              birthDate: newDepBirth,
                              photoUrl: newDepPhoto || undefined,
                              cardNumber: newCardNum,
                              holderCardNumber:
                                selectedSubForDetail.subscriptionCode,
                              qrToken: newCardNum,
                              frontCardUrl:
                                mod.dependentFrontCardUrl || mod.frontCardUrl,
                              backCardUrl:
                                mod.dependentBackCardUrl || mod.backCardUrl,
                              validityLabel:
                                selectedSubForDetail.members[0]?.validityLabel ||
                                '10/2027',
                              monthlyValue: addMonthly,
                              status: selectedSubForDetail.status,
                              expirationDate: newDepExpirationDate || undefined,
                              expirationNotes:
                                newDepExpirationNotes.trim() || undefined,
                              attachments: [],
                              createdAt: new Date().toISOString(),
                            };
                            const updatedMembers = [
                              ...selectedSubForDetail.members,
                              newMember,
                            ];
                            const newMonthlyTotal = Number(
                              (
                                selectedSubForDetail.monthlyEquivalent + addMonthly
                              ).toFixed(2)
                            );
                            const updatedSub: ClubSubscription = {
                              ...selectedSubForDetail,
                              members: updatedMembers,
                              monthlyEquivalent: newMonthlyTotal,
                              totalContractValue:
                                selectedSubForDetail.billingCycle === 'ANNUAL'
                                  ? Number((newMonthlyTotal * 12).toFixed(2))
                                  : newMonthlyTotal,
                            };
                            const nextState: ClubDatabaseState = {
                              ...state,
                              subscriptions: (state.subscriptions || []).map((s) =>
                                s.id === updatedSub.id ? updatedSub : s
                              ),
                            };
                            setSelectedSubForDetail(updatedSub);
                            await persist(nextState);
                            setNewDepName('');
                            setNewDepCpf('');
                            setNewDepBirth('');
                            setNewDepPhoto('');
                            setNewDepExpirationDate('');
                            setNewDepExpirationNotes('');
                            toast({
                              title: 'Dependente adicionado com sucesso!',
                              description: `${newMember.fullName} — Cartão #${newMember.cardNumber}`,
                            });
                          }}
                          className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs h-9 px-6"
                        >
                          <Plus className="w-4 h-4 mr-1" /> Incluir Dependente e Gerar Cartão
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* LISTAGEM DOS DEPENDENTES COM ANEXOS INDIVIDUAIS E VENCIMENTOS */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                      Dependentes Cadastrados ({selectedSubForDetail.members.filter((m) => m.role === 'DEPENDENTE').length})
                    </h4>

                    {selectedSubForDetail.members.filter((m) => m.role === 'DEPENDENTE').length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        Nenhum dependente vinculado a este titular ainda.
                      </div>
                    ) : (
                      selectedSubForDetail.members
                        .filter((m) => m.role === 'DEPENDENTE')
                        .map((dep) => {
                          const expDateObj = dep.expirationDate
                            ? new Date(dep.expirationDate)
                            : null;
                          const daysLeft = expDateObj
                            ? Math.ceil(
                                (expDateObj.getTime() - Date.now()) /
                                  (1000 * 60 * 60 * 24)
                              )
                            : null;
                          const isExpired = daysLeft !== null && daysLeft <= 0;
                          const isWarning =
                            daysLeft !== null && !isExpired && daysLeft <= 60;
                          const isEditingModality =
                            editingDepModalityMemberId === dep.id;

                          return (
                            <div
                              key={dep.id}
                              className={`p-4 rounded-xl border transition-all space-y-3 ${
                                isExpired
                                  ? 'bg-rose-50/60 border-rose-300'
                                  : isWarning
                                  ? 'bg-amber-50/60 border-amber-300'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              {/* CABEÇALHO DO DEPENDENTE */}
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                  {dep.photoUrl ? (
                                    <img
                                      src={dep.photoUrl}
                                      alt={dep.fullName}
                                      className="w-10 h-10 rounded-full object-cover border border-slate-300 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                                      {dep.fullName.slice(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                      <span>{dep.fullName}</span>
                                      <Badge
                                        variant="outline"
                                        className="text-[11px] font-semibold border-slate-300"
                                      >
                                        Cartão #{dep.cardNumber}
                                      </Badge>
                                      <Badge className="bg-emerald-800 text-white text-[11px]">
                                        {dep.modalityName || 'Dependente'}
                                      </Badge>
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      CPF: <strong>{dep.cpf || 'Não informado'}</strong> • Nascimento:{' '}
                                      <strong>
                                        {dep.birthDate ? formatDateBR(dep.birthDate) : 'Não informado'}
                                      </strong> • Mensalidade:{' '}
                                      <strong>{formatCurrency(dep.monthlyValue || 0)}</strong>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      if (isEditingModality) {
                                        setEditingDepModalityMemberId(null);
                                      } else {
                                        setEditingDepModalityMemberId(dep.id);
                                        setTargetNewModalityCode(
                                          dep.modalityCode || 'ESTUDANTE'
                                        );
                                      }
                                    }}
                                    className="text-xs font-bold border-amber-600 text-amber-900 hover:bg-amber-100 h-8"
                                  >
                                    ⚡ {isEditingModality ? 'Fechar Edição' : 'Tornar Pagante / Alterar Modalidade'}
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={async () => {
                                      const updatedMembers =
                                        selectedSubForDetail.members.filter(
                                          (m) => m.id !== dep.id
                                        );
                                      const removedMonthly = dep.monthlyValue || 0;
                                      const newMonthlyTotal = Math.max(
                                        0,
                                        Number(
                                          (
                                            selectedSubForDetail.monthlyEquivalent -
                                            removedMonthly
                                          ).toFixed(2)
                                        )
                                      );
                                      const updatedSub: ClubSubscription = {
                                        ...selectedSubForDetail,
                                        members: updatedMembers,
                                        monthlyEquivalent: newMonthlyTotal,
                                        totalContractValue:
                                          selectedSubForDetail.billingCycle ===
                                          'ANNUAL'
                                            ? Number((newMonthlyTotal * 12).toFixed(2))
                                            : newMonthlyTotal,
                                      };
                                      const nextState: ClubDatabaseState = {
                                        ...state,
                                        subscriptions: (state.subscriptions || []).map((s) =>
                                          s.id === updatedSub.id ? updatedSub : s
                                        ),
                                      };
                                      setSelectedSubForDetail(updatedSub);
                                      await persist(nextState);
                                      toast({ title: 'Dependente removido.' });
                                    }}
                                    className="text-rose-600 hover:bg-rose-50 h-8 text-xs"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
                                  </Button>
                                </div>
                              </div>

                              {/* ALERTA DE VENCIMENTO / EXPIRAÇÃO */}
                              {dep.expirationDate && (
                                <div
                                  className={`p-2.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
                                    isExpired
                                      ? 'bg-rose-100/80 border-rose-300 text-rose-900 font-bold'
                                      : isWarning
                                      ? 'bg-amber-100/80 border-amber-300 text-amber-950 font-semibold'
                                      : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    {isExpired ? (
                                      <span className="text-base">🔴</span>
                                    ) : isWarning ? (
                                      <span className="text-base">⚠️</span>
                                    ) : (
                                      <span className="text-base">📅</span>
                                    )}
                                    <span>
                                      <strong>
                                        {isExpired
                                          ? 'CADASTRO / GRATUIDADE EXPIRADA:'
                                          : isWarning
                                          ? `ATENÇÃO: VENCE EM ${daysLeft} DIAS:`
                                          : 'Vencimento de Cadastro:'}
                                      </strong>{' '}
                                      {formatDateBR(dep.expirationDate)}
                                      {dep.expirationNotes && (
                                        <span className="ml-2 font-normal italic">
                                          ({dep.expirationNotes})
                                        </span>
                                      )}
                                    </span>
                                  </div>

                                  {!isEditingModality && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => {
                                        setEditingDepModalityMemberId(dep.id);
                                        setTargetNewModalityCode(
                                          dep.modalityCode === 'KIDS'
                                            ? 'ESTUDANTE'
                                            : 'ADULTO'
                                        );
                                      }}
                                      className="h-7 text-xs font-bold bg-[#004d00] hover:bg-emerald-900 text-white"
                                    >
                                      Transicionar para Pagante
                                    </Button>
                                  )}
                                </div>
                              )}

                              {/* PAINEL INLINE: TORNAR PAGANTE / ALTERAR MODALIDADE */}
                              {isEditingModality && (
                                <div className="bg-white p-3.5 rounded-lg border border-amber-300 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h5 className="text-xs font-black text-amber-950 uppercase">
                                      ⚡ Transição de Categoria / Tornar Pagante ({dep.fullName})
                                    </h5>
                                    <span className="text-[11px] text-slate-500">
                                      Ex: Criança completou idade limite e se tornará pagante (Estudante ou Adulto)
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                                    <div className="sm:col-span-5">
                                      <Label className="text-xs font-bold text-slate-700">
                                        Nova Modalidade
                                      </Label>
                                      <select
                                        value={targetNewModalityCode}
                                        onChange={(e) =>
                                          setTargetNewModalityCode(e.target.value)
                                        }
                                        className="w-full h-8 rounded border border-slate-300 px-2 text-xs font-bold bg-white"
                                      >
                                        {(state.modalities || []).map((m) => (
                                          <option key={m.code} value={m.code}>
                                            {m.name} —{' '}
                                            {m.isFreeTier
                                              ? 'GRATUITO'
                                              : `${formatCurrency(
                                                  selectedSubForDetail.billingCycle ===
                                                    'ANNUAL'
                                                    ? m.annualInstallment
                                                    : m.monthlyPrice
                                                )}/mês`}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="sm:col-span-3">
                                      <Label className="text-xs font-bold text-slate-700">
                                        Nova Data de Expiração (opcional)
                                      </Label>
                                      <Input
                                        type="date"
                                        defaultValue={dep.expirationDate || ''}
                                        id={`exp-date-edit-${dep.id}`}
                                        className="h-8 text-xs bg-white"
                                      />
                                    </div>

                                    <div className="sm:col-span-4 flex items-center gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={async () => {
                                          const newMod =
                                            (state.modalities || []).find(
                                              (m) =>
                                                m.code === targetNewModalityCode
                                            ) || state.modalities[0];
                                          const newAddMonthly =
                                            selectedSubForDetail.billingCycle ===
                                            'ANNUAL'
                                              ? newMod.annualInstallment
                                              : newMod.monthlyPrice;
                                          const oldMonthly =
                                            dep.monthlyValue || 0;
                                          const inputDateEl =
                                            document.getElementById(
                                              `exp-date-edit-${dep.id}`
                                            ) as HTMLInputElement | null;
                                          const updatedExpDate =
                                            inputDateEl?.value ||
                                            dep.expirationDate;

                                          const updatedMembers =
                                            selectedSubForDetail.members.map((m) =>
                                              m.id === dep.id
                                                ? {
                                                    ...m,
                                                    modalityCode: newMod.code,
                                                    modalityName: newMod.name,
                                                    planCycleLabel: `${newMod.name} (${
                                                      selectedSubForDetail.billingCycle ===
                                                      'ANNUAL'
                                                        ? 'Anual'
                                                        : 'Mensal'
                                                    })`,
                                                    monthlyValue: newAddMonthly,
                                                    expirationDate: updatedExpDate,
                                                    expirationNotes:
                                                      newMod.isFreeTier
                                                        ? dep.expirationNotes
                                                        : `Transicionado para ${newMod.name} (Pagante)`,
                                                  }
                                                : m
                                            );

                                          const newMonthlyTotal = Number(
                                            (
                                              selectedSubForDetail.monthlyEquivalent -
                                              oldMonthly +
                                              newAddMonthly
                                            ).toFixed(2)
                                          );

                                          const updatedSub: ClubSubscription = {
                                            ...selectedSubForDetail,
                                            members: updatedMembers,
                                            monthlyEquivalent: newMonthlyTotal,
                                            totalContractValue:
                                              selectedSubForDetail.billingCycle ===
                                              'ANNUAL'
                                                ? Number(
                                                    (newMonthlyTotal * 12).toFixed(2)
                                                  )
                                                : newMonthlyTotal,
                                          };

                                          const nextState: ClubDatabaseState = {
                                            ...state,
                                            subscriptions:
                                              (state.subscriptions || []).map((s) =>
                                                s.id === updatedSub.id
                                                  ? updatedSub
                                                  : s
                                              ),
                                          };
                                          setSelectedSubForDetail(updatedSub);
                                          setEditingDepModalityMemberId(null);
                                          await persist(nextState);
                                          toast({
                                            title: 'Modalidade atualizada!',
                                            description: `${dep.fullName} agora é ${newMod.name} (${formatCurrency(newAddMonthly)}/mês). Total do contrato recalculado.`,
                                          });
                                        }}
                                        className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs h-8 px-4"
                                      >
                                        Salvar Mudança
                                      </Button>

                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          setEditingDepModalityMemberId(null)
                                        }
                                        className="h-8 text-xs"
                                      >
                                        Cancelar
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* SEÇÃO DE ANEXOS INDIVIDUAIS DO DEPENDENTE */}
                              <div className="pt-2 border-t border-slate-200">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <Paperclip className="w-3.5 h-3.5 text-emerald-700" />
                                    Anexos e Documentos deste Dependente (
                                    {(dep.attachments || []).length}):
                                  </span>

                                  <Label
                                    htmlFor={`dep-upload-${dep.id}`}
                                    className="inline-flex items-center px-2.5 py-1 rounded bg-[#004d00] hover:bg-emerald-800 text-white font-bold text-[11px] cursor-pointer shadow-sm"
                                  >
                                    <Upload className="w-3 h-3 mr-1" /> + Anexar (RG / Certidão / Laudo / Comprovante)
                                  </Label>
                                  <input
                                    id={`dep-upload-${dep.id}`}
                                    type="file"
                                    accept="image/*,.pdf,.doc,.docx"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const dataUrl = await fileToDataUrl(file);
                                      const newAtt: ClubAttachment = {
                                        id: `att_dep_${Date.now()}`,
                                        name: `${dep.fullName.split(' ')[0]} - ${file.name}`,
                                        mimeType:
                                          file.type || 'application/octet-stream',
                                        dataUrl,
                                        createdAt: new Date().toISOString(),
                                      };
                                      const updatedMembers =
                                        selectedSubForDetail.members.map((m) =>
                                          m.id === dep.id
                                            ? {
                                                ...m,
                                                attachments: [
                                                  newAtt,
                                                  ...(m.attachments || []),
                                                ],
                                              }
                                            : m
                                        );
                                      const updatedSub: ClubSubscription = {
                                        ...selectedSubForDetail,
                                        members: updatedMembers,
                                      };
                                      const nextState: ClubDatabaseState = {
                                        ...state,
                                        subscriptions: (state.subscriptions || []).map((s) =>
                                          s.id === updatedSub.id ? updatedSub : s
                                        ),
                                      };
                                      setSelectedSubForDetail(updatedSub);
                                      await persist(nextState);
                                      toast({
                                        title: 'Documento anexado ao dependente!',
                                        description: file.name,
                                      });
                                    }}
                                  />
                                </div>

                                {(dep.attachments || []).length === 0 ? (
                                  <div className="text-[11px] text-slate-400 italic bg-white p-2 rounded border border-dashed border-slate-200 text-center">
                                    Nenhum documento anexado para {dep.fullName} ainda (ex: Certidão de Nascimento, Laudo PCD ou Comprovante de Matrícula).
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {(dep.attachments || []).map((att) => (
                                      <div
                                        key={att.id}
                                        className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs"
                                      >
                                        <div className="flex items-center gap-2 truncate">
                                          {att.mimeType.startsWith('image/') ? (
                                            <img
                                              src={att.dataUrl}
                                              alt={att.name}
                                              className="w-8 h-8 rounded object-cover border border-slate-200 shrink-0"
                                            />
                                          ) : (
                                            <div className="w-8 h-8 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                              DOC
                                            </div>
                                          )}
                                          <div className="truncate">
                                            <div className="font-bold text-slate-800 truncate">
                                              {att.name}
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                              {formatDateBR(att.createdAt)}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <a
                                            href={att.dataUrl}
                                            download={att.name}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 px-2 text-[11px]"
                                            >
                                              <Download className="w-3 h-3 mr-1" /> Baixar
                                            </Button>
                                          </a>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={async () => {
                                              const updatedMembers =
                                                selectedSubForDetail.members.map(
                                                  (m) =>
                                                    m.id === dep.id
                                                      ? {
                                                          ...m,
                                                          attachments: (
                                                            m.attachments || []
                                                          ).filter(
                                                            (a) =>
                                                              a.id !== att.id
                                                          ),
                                                        }
                                                      : m
                                                );
                                              const updatedSub: ClubSubscription = {
                                                ...selectedSubForDetail,
                                                members: updatedMembers,
                                              };
                                              const nextState: ClubDatabaseState = {
                                                ...state,
                                                subscriptions:
                                                  (state.subscriptions || []).map((s) =>
                                                    s.id === updatedSub.id
                                                      ? updatedSub
                                                      : s
                                                  ),
                                              };
                                              setSelectedSubForDetail(updatedSub);
                                              await persist(nextState);
                                              toast({
                                                title: 'Documento removido.',
                                              });
                                            }}
                                            className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              )}

              {/* =====================================================================
                  OPÇÃO 6: AGENDA DO CLIENTE (MAPA DOS DIAS DE VISITA / QR CODE)
              ===================================================================== */}
              {clientDetailTool === 'AGENDA_VISITAS' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-emerald-700" />
                        6. Agenda do Cliente — Mapa dos Dias de Visita (Leitura QR Code ou Marcação)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Os dias marcados em verde indicam visitas registradas na portaria (via QR Code) ou agendadas manualmente. Clique em qualquer dia do mapa para marcar/desmarcar!
                      </p>
                    </div>
                    <Input
                      type="month"
                      value={agendaMonth}
                      onChange={(e) => setAgendaMonth(e.target.value)}
                      className="w-44 h-9 text-xs font-bold"
                    />
                  </div>

                  {/* MAPA CALENDÁRIO DE DIAS DO MÊS */}
                  <div className="grid grid-cols-7 gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(
                      (d) => (
                        <div
                          key={d}
                          className="text-center text-[10px] font-black uppercase text-slate-400 py-1"
                        >
                          {d}
                        </div>
                      )
                    )}
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                      const dayStr = `${agendaMonth}-${String(day).padStart(
                        2,
                        '0'
                      )}`;
                      const visitsOnDay = (
                        selectedSubForDetail.visits || []
                      ).filter((v) => v.date === dayStr);
                      const hasVisit = visitsOnDay.length > 0;
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={async () => {
                            const existing = selectedSubForDetail.visits || [];
                            let nextVisits: ClubVisitRecord[];
                            if (hasVisit) {
                              nextVisits = existing.filter(
                                (v) => v.date !== dayStr
                              );
                            } else {
                              nextVisits = [
                                {
                                  id: `vis_${Date.now()}`,
                                  date: dayStr,
                                  time: new Date().toTimeString().slice(0, 5),
                                  memberName: selectedSubForDetail.holderName,
                                  cardNumber:
                                    selectedSubForDetail.subscriptionCode,
                                  source: 'ADMIN_AGENDA',
                                  notes: 'Visita marcada no Mapa da Agenda',
                                },
                                ...existing,
                              ];
                            }
                            const updatedSub: ClubSubscription = {
                              ...selectedSubForDetail,
                              visits: nextVisits,
                            };
                            const nextState: ClubDatabaseState = {
                              ...state,
                              subscriptions: (state.subscriptions || []).map((s) =>
                                s.id === updatedSub.id ? updatedSub : s
                              ),
                            };
                            setSelectedSubForDetail(updatedSub);
                            await persist(nextState);
                          }}
                          className={`h-12 rounded-lg border text-xs font-bold flex flex-col items-center justify-center transition-all ${
                            hasVisit
                              ? 'bg-[#004d00] text-white border-emerald-900 shadow-sm'
                              : 'bg-white hover:bg-emerald-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span>Dia {day}</span>
                          {hasVisit && (
                            <span className="text-[9px] text-emerald-200 font-black">
                              ✓ VISITA ({visitsOnDay.length})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* FORMULÁRIO PARA REGISTRAR VISITA ESPECÍFICA */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="sm:col-span-3">
                      <Label className="text-xs font-bold">Data da Visita</Label>
                      <Input
                        type="date"
                        value={visitDateInput}
                        onChange={(e) => setVisitDateInput(e.target.value)}
                        className="h-9 text-xs bg-white"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Label className="text-xs font-bold">Integrante</Label>
                      <select
                        value={visitMemberCard}
                        onChange={(e) => setVisitMemberCard(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-300 px-2 text-xs font-bold bg-white"
                      >
                        {selectedSubForDetail.members.map((m) => (
                          <option key={m.id} value={m.cardNumber}>
                            {m.fullName} (#{m.cardNumber})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs font-bold">Observação</Label>
                      <Input
                        value={visitNotesInput}
                        onChange={(e) => setVisitNotesInput(e.target.value)}
                        placeholder="Ex: Leitura QR Portaria"
                        className="h-9 text-xs bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Button
                        type="button"
                        onClick={async () => {
                          const targetMember =
                            selectedSubForDetail.members.find(
                              (m) => m.cardNumber === visitMemberCard
                            ) || selectedSubForDetail.members[0];
                          const newVisit: ClubVisitRecord = {
                            id: `vis_${Date.now()}`,
                            date: visitDateInput,
                            time: new Date().toTimeString().slice(0, 5),
                            memberName: targetMember.fullName,
                            cardNumber: targetMember.cardNumber,
                            source: 'ADMIN_AGENDA',
                            notes:
                              visitNotesInput.trim() ||
                              'Presença confirmada na Agenda',
                          };
                          const updatedSub: ClubSubscription = {
                            ...selectedSubForDetail,
                            visits: [
                              newVisit,
                              ...(selectedSubForDetail.visits || []),
                            ],
                          };
                          const nextState: ClubDatabaseState = {
                            ...state,
                            subscriptions: (state.subscriptions || []).map((s) =>
                              s.id === updatedSub.id ? updatedSub : s
                            ),
                          };
                          setSelectedSubForDetail(updatedSub);
                          await persist(nextState);
                          setVisitNotesInput('');
                          toast({
                            title: 'Visita registrada no mapa do cliente!',
                            description: `${targetMember.fullName} em ${formatDateBR(visitDateInput)}`,
                          });
                        }}
                        className="w-full bg-[#004d00] text-white font-bold text-xs h-9"
                      >
                        + Marcar Visita
                      </Button>
                    </div>
                  </div>

                  {/* HISTÓRICO DE VISITAS */}
                  <div className="space-y-1.5">
                    {(selectedSubForDetail.visits || []).map((v) => (
                      <div
                        key={v.id}
                        className="p-2.5 rounded-lg border border-slate-200 flex items-center justify-between bg-slate-50 text-xs"
                      >
                        <div>
                          <strong>{formatDateBR(v.date)}</strong>{' '}
                          {v.time && `às ${v.time}`} —{' '}
                          <strong>{v.memberName}</strong> (Cartão #{v.cardNumber}) •{' '}
                          <span className="text-slate-500">{v.notes}</span>
                        </div>
                        <Badge
                          className={
                            v.source === 'QR_SCAN'
                              ? 'bg-emerald-700 text-white text-[10px]'
                              : 'bg-blue-700 text-white text-[10px]'
                          }
                        >
                          {v.source === 'QR_SCAN'
                            ? '📱 Leitura QR Code'
                            : '📅 Agenda Admin'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* =====================================================================
                  OPÇÃO 7: ADICIONAR SERVIÇOS ADICIONAIS
              ===================================================================== */}
              {clientDetailTool === 'SERVICOS_ADICIONAIS' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-emerald-700" />
                    7. Adicionar Serviços Adicionais ao Cliente
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="sm:col-span-5">
                      <Label className="text-xs font-bold">
                        Serviço Adicional *
                      </Label>
                      <Input
                        value={serviceNameInput}
                        onChange={(e) => setServiceNameInput(e.target.value)}
                        placeholder="Ex: Reserva Quiosque, 2ª Via Cartão PVC, Convidado Day Use..."
                        className="bg-white"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs font-bold">Valor (R$)</Label>
                      <Input
                        value={servicePriceInput}
                        onChange={(e) => setServicePriceInput(e.target.value)}
                        placeholder="Ex: 50,00"
                        className="bg-white"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Button
                        type="button"
                        onClick={async () => {
                          if (!serviceNameInput.trim()) return;
                          const price =
                            Number(servicePriceInput.replace(',', '.')) || 0;
                          const newSvc: ClubAdditionalService = {
                            id: `svc_${Date.now()}`,
                            name: serviceNameInput.trim(),
                            price,
                            addedAt: new Date().toISOString(),
                            notes: serviceNotesInput.trim(),
                          };
                          const updatedSub: ClubSubscription = {
                            ...selectedSubForDetail,
                            additionalServices: [
                              newSvc,
                              ...(selectedSubForDetail.additionalServices || []),
                            ],
                          };
                          const nextState: ClubDatabaseState = {
                            ...state,
                            subscriptions: (state.subscriptions || []).map((s) =>
                              s.id === updatedSub.id ? updatedSub : s
                            ),
                          };
                          setSelectedSubForDetail(updatedSub);
                          await persist(nextState);
                          setServiceNameInput('');
                          setServicePriceInput('');
                          toast({
                            title: 'Serviço adicional incluído!',
                            description: `${newSvc.name} (${formatCurrency(newSvc.price)})`,
                          });
                        }}
                        className="w-full bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs h-10"
                      >
                        <Plus className="w-4 h-4 mr-1" /> Adicionar Serviço
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(selectedSubForDetail.additionalServices || []).length ===
                    0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">
                        Nenhum serviço adicional lançado para este cliente.
                      </p>
                    ) : (
                      (selectedSubForDetail.additionalServices || []).map(
                        (svc) => (
                          <div
                            key={svc.id}
                            className="p-3 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50 text-xs"
                          >
                            <div>
                              <strong>{svc.name}</strong> • Lançado em{' '}
                              {formatDateBR(svc.addedAt)}
                            </div>
                            <Badge className="bg-emerald-700 text-white">
                              {formatCurrency(svc.price)}
                            </Badge>
                          </div>
                        )
                      )
                    )}
                  </div>
                </div>
              )}

              {/* =====================================================================
                  OPÇÃO 8: GERAR LINK PARA ASSINATURA DIGITAL DO CONTRATO
              ===================================================================== */}
              {clientDetailTool === 'LINK_ASSINATURA' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <PenTool className="w-5 h-5 text-emerald-700" />
                    8. Gerar Link para Assinatura Digital do Contrato
                  </h3>
                  <p className="text-xs text-slate-600">
                    Envie o link exclusivo abaixo para o titular (<strong>{selectedSubForDetail.holderName}</strong>) visualizar, assinar digitalmente o contrato e acessar sua Área do Sócio:
                  </p>

                  {(() => {
                    const originUrl =
                      typeof window !== 'undefined'
                        ? window.location.origin
                        : 'https://assinatura.balneariolessa.com.br';
                    const digitalSignLink = `${originUrl}/socio?cpf=${encodeURIComponent(
                      selectedSubForDetail.holderCpf
                    )}&cartao=${encodeURIComponent(
                      selectedSubForDetail.subscriptionCode
                    )}&assinar=1`;
                    const phoneDigits =
                      selectedSubForDetail.holderPhone.replace(/\D/g, '');
                    const waText = `Olá ${selectedSubForDetail.holderName}! Segue o link oficial do Balneário Lessa Club para conferir e assinar digitalmente o seu Contrato (#${selectedSubForDetail.subscriptionCode}): ${digitalSignLink}`;

                    return (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            value={digitalSignLink}
                            className="font-mono text-xs bg-slate-50"
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(digitalSignLink);
                              toast({
                                title: 'Link de Assinatura Digital copiado!',
                                description: digitalSignLink,
                              });
                            }}
                            className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs shrink-0"
                          >
                            <Copy className="w-4 h-4 mr-1.5" /> Copiar Link
                          </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`https://wa.me/55${phoneDigits}?text=${encodeURIComponent(
                              waText
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button
                              type="button"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                            >
                              <MessageSquare className="w-4 h-4 mr-1.5" /> Enviar Link de Assinatura por WhatsApp
                            </Button>
                          </a>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={async () => {
                              const updatedSub: ClubSubscription = {
                                ...selectedSubForDetail,
                                contractAccepted: true,
                                contractSignedAt: new Date().toISOString(),
                              };
                              const nextState: ClubDatabaseState = {
                                ...state,
                                subscriptions: (state.subscriptions || []).map((s) =>
                                  s.id === updatedSub.id ? updatedSub : s
                                ),
                              };
                              setSelectedSubForDetail(updatedSub);
                              await persist(nextState);
                              toast({
                                title: 'Assinatura digital confirmada!',
                                description: `Contrato assinado em ${formatDateBR(updatedSub.contractSignedAt)}.`,
                              });
                            }}
                            className="text-xs font-bold"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-700" /> Confirmar Assinatura Digital Agora
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* =====================================================================
                  OPÇÃO 9: VISUALIZAR TERMOS DE USO E CONDIÇÕES
              ===================================================================== */}
              {clientDetailTool === 'TERMOS_USO' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-emerald-700" />
                        9. Termos de Uso e Regulamento Interno Aceitos pelo Cliente
                      </h3>
                      <p className="text-xs text-slate-500">
                        Status do Aceite:{' '}
                        <strong>
                          {selectedSubForDetail.contractAccepted
                            ? `ACEITO E ASSINADO DIGITALMENTE EM ${formatDateBR(
                                selectedSubForDetail.contractSignedAt
                              )}`
                            : 'PENDENTE DE ASSINATURA DIGITAL'}
                        </strong> • Titular: <strong>{selectedSubForDetail.holderName}</strong> (Cartão #{selectedSubForDetail.subscriptionCode})
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          const printWin = window.open('', '_blank');
                          if (printWin) {
                            printWin.document.write(`
                              <!DOCTYPE html>
                              <html>
                                <head>
                                  <meta charset="utf-8" />
                                  <title>Termos de Uso e Regulamento - Balneário Família Lessa</title>
                                  <style>
                                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; font-size: 13px; line-height: 1.6; }
                                    h2 { color: #005200; border-bottom: 2px solid #005200; padding-bottom: 8px; font-size: 18px; margin-top: 0; }
                                    h3 { color: #005200; margin-top: 24px; font-size: 14px; text-transform: uppercase; }
                                    .header-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 14px; border-radius: 8px; margin-bottom: 24px; font-size: 12px; }
                                    .clause-title { font-weight: bold; color: #0f172a; margin-top: 16px; margin-bottom: 6px; font-size: 13px; }
                                    p { margin: 6px 0; }
                                    strong { color: #0f172a; }
                                  </style>
                                </head>
                                <body>
                                  <h2>BALNEÁRIO FAMÍLIA LESSA LTDA — TERMOS E REGULAMENTO OFICIAL</h2>
                                  <div class="header-box">
                                    <strong>CNPJ:</strong> 46.891.134/0001-40 • <strong>Local:</strong> Linha C-65, KM 07, Zona Rural, Ariquemes/RO<br />
                                    <strong>Associado Titular:</strong> ${selectedSubForDetail.holderName} • <strong>CPF:</strong> ${selectedSubForDetail.holderCpf} • <strong>Cartão:</strong> #${selectedSubForDetail.subscriptionCode}<br />
                                    <strong>Plano:</strong> ${selectedSubForDetail.planSummaryLabel} • <strong>Adesão:</strong> ${formatDateBR(selectedSubForDetail.startDate)}
                                  </div>
                                  <div>
                                    ${(
                                      state.contractTemplates.find(
                                        (t) => t.id === 'TERMOS_SITE'
                                      )?.contentHtml || ''
                                    )
                                      .replace(/\[\/nome-pf\]/g, selectedSubForDetail.holderName.toUpperCase())
                                      .replace(/\[\/cpf-pf\]/g, selectedSubForDetail.holderCpf)
                                      .replace(/\[\/rg-pf\]/g, selectedSubForDetail.holderRg || '—')
                                      .replace(/\[\/plano-pf\]/g, selectedSubForDetail.planSummaryLabel)
                                      .replace(/\[\/data-cadastro-extenso\]/g, formatDateExtensoBR(selectedSubForDetail.startDate))
                                      || siteTermsText}
                                  </div>
                                </body>
                              </html>
                            `);
                            printWin.document.close();
                            printWin.focus();
                            printWin.print();
                          }
                        }}
                        className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs"
                      >
                        <Printer className="w-3.5 h-3.5 mr-1.5" /> Imprimir Termos Completos
                      </Button>
                    </div>
                  </div>

                  {/* DOCUMENTO COMPLETO E ESTRUTURADO PARA LEITURA INTEGRAL DO CLIENTE */}
                  <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed max-h-[550px] overflow-y-auto space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-emerald-950 font-medium">
                      ℹ️ O cliente pode tirar todas as dúvidas consultando as cláusulas abaixo sobre admissão, horários (sexta a domingo e feriados das 9h às 17h), gratuidade kids (idade limite), entrada ilimitada, conduta e cancelamento sem multa.
                    </div>

                    <div className="space-y-4 font-normal">
                      <div>
                        <h4 className="font-bold text-sm text-[#005200] border-b border-slate-200 pb-1 mb-2">
                          1. DO OBJETO E ACEITAÇÃO
                        </h4>
                        <p>1.1. Os presentes Termos e Condições Gerais de Uso regulam a adesão, o acesso e a utilização das dependências, serviços e benefícios disponibilizados pelo Balneário Família Lessa, por meio de planos, carteirinhas ou acessos avulsos.</p>
                        <p>1.2. Ao realizar o cadastro, efetuar pagamento ou utilizar qualquer plano ou benefício, o titular declara ter lido, compreendido e aceito integralmente todas as disposições deste regulamento.</p>
                        <p>1.3. A não concordância com quaisquer cláusulas implica na impossibilidade de adesão ou utilização dos serviços oferecidos.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-[#005200] border-b border-slate-200 pb-1 mb-2">
                          2. DA NATUREZA DO BALNEÁRIO
                        </h4>
                        <p>2.1. O Balneário Família Lessa é um empreendimento privado destinado ao lazer, convivência familiar e turismo recreativo, com ambiente cristão, seguro e orientado por normas internas próprias.</p>
                        <p>2.2. O acesso às áreas, estruturas e atrações está condicionado às regras internas, disponibilidade operacional, condições climáticas, manutenção e critérios de segurança definidos pela administração.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-[#005200] border-b border-slate-200 pb-1 mb-2">
                          3. DO CADASTRO E RESPONSABILIDADE DAS INFORMAÇÕES
                        </h4>
                        <p>3.1. Para adesão aos planos, o usuário deverá fornecer informações completas, verídicas e atualizadas, responsabilizando-se civil e criminalmente pela veracidade dos dados prestados.</p>
                        <p>3.2. O plano e as carteirinhas emitidas são de uso pessoal e intransferível, respeitando-se os limites e condições contratadas para titular e dependentes.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-[#005200] border-b border-slate-200 pb-1 mb-2">
                          4. DOS PLANOS, ACESSO, DIAS DE FUNCIONAMENTO E BENEFÍCIOS
                        </h4>
                        <p>4.1. O CONTRATANTE e seus dependentes vinculados terão direito à entrada no Balneário durante o período de vigência, exclusivamente nos dias e horários regulares de funcionamento: <strong>atualmente de sexta-feira a domingo e feriados, das 9h (nove horas) às 17h (dezessete horas)</strong>.</p>
                        <p>4.2. O acesso ao Balneário é condicionado à apresentação de documento oficial com foto e carteirinha de sócio (física ou digital com QR Code).</p>
                        <p>4.3. <strong>TRANSIÇÃO DE DEPENDENTES E GRATUIDADE KIDS:</strong> Crianças cadastradas em modalidades gratuitas (0 a 5 anos) ou convênios especiais mantêm o benefício até atingirem a idade limite estipulada. Ao completar a idade limite, o titular deverá atualizar o cadastro, passando o dependente para a categoria correspondente (Estudante ou Adulto pagante).</p>
                        <p>4.4. <strong>MANUTENÇÃO DE VALORES:</strong> Os planos contratados na modalidade anual até 31 de dezembro de 2026 têm garantia de manutenção do valor durante toda a vigência regular de 1 (um) ano, aplicando-se reajustes periódicos somente em 2027 ou futuras renovações.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-[#005200] border-b border-slate-200 pb-1 mb-2">
                          5. DAS REGRAS DE CONDUTA E USO DAS DEPENDÊNCIAS
                        </h4>
                        <p>5.1. O usuário compromete-se a zelar pelo patrimônio, preservar a natureza, manter conduta compatível com ambiente familiar e acatar as orientações dos monitores e salva-vidas.</p>
                        <p>5.2. É expressamente vedado: o uso inadequado das instalações, brigas, som excessivo, armas, substâncias ilícitas ou condutas contrárias aos bons costumes e segurança coletiva.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-[#005200] border-b border-slate-200 pb-1 mb-2">
                          6. DAS FORMAS DE PAGAMENTO E INADIMPLÊNCIA
                        </h4>
                        <p>6.1. O pagamento pode ser realizado via PIX integral, Cartão de Crédito (em até 12x para planos anuais) ou parcelas recorrentes mensais.</p>
                        <p>6.2. Em caso de inadimplência em planos recorrentes, o acesso à portaria poderá ser temporariamente suspenso até a regularização da parcela em atraso.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-[#005200] border-b border-slate-200 pb-1 mb-2">
                          7. DA VIGÊNCIA E CANCELAMENTO SEM MULTA
                        </h4>
                        <p>7.1. O plano vigorará pelo prazo contratado de 1 (um) ano para planos anuais ou renovações mensais para planos recorrentes.</p>
                        <p>7.2. <strong>O cancelamento pode ser solicitado a qualquer momento pelo titular SEM MULTA RESCISÓRIA</strong>, não havendo restituição retroativa de períodos já usufruídos.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-[#005200] border-b border-slate-200 pb-1 mb-2">
                          8. DO FORO
                        </h4>
                        <p>8.1. Fica eleito o Foro da Comarca de Ariquemes, Estado de Rondônia, para dirimir eventuais controvérsias decorrentes destes Termos de Uso.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* =====================================================================
                  OPÇÃO EXTRA: SMS / WHATSAPP DIRETO PARA O CLIENTE
              ===================================================================== */}
              {clientDetailTool === 'SMS_CLIENTE' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Enviar Mensagem Direta (SMS / WhatsApp) para {selectedSubForDetail.holderName}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Envie comunicados gerais ou os dados oficiais de acesso ao Portal do Associado.
                    </p>
                  </div>

                  {/* BOX CREDENCIAIS DE ACESSO AO PORTAL */}
                  {(() => {
                    const access = getMemberAccessMessage(selectedSubForDetail);
                    return (
                      <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-700" />
                          <h4 className="text-xs font-black uppercase text-emerald-900 tracking-wider">
                            Dados de Acesso ao Portal do Associado
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">Usuário de Login</span>
                            <span className="font-black text-slate-800 break-all">{access.login}</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">Senha Padrão (Nascimento)</span>
                            <span className="font-mono font-black text-emerald-700">{access.password}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <a href={access.whatsappUrl} target="_blank" rel="noreferrer">
                            <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-9">
                              <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Enviar Login e Senha via WhatsApp
                            </Button>
                          </a>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(access.text);
                              toast({
                                title: 'Dados de acesso copiados!',
                                description: `Login: ${access.login} | Senha: ${access.password}`,
                              });
                            }}
                            className="bg-white hover:bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-xs h-9"
                          >
                            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar Mensagem de Acesso
                          </Button>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <Label className="text-xs font-bold text-slate-700">Mensagem Personalizada</Label>
                    <Textarea
                      rows={3}
                      value={smsTemplate
                        .replace('{NOME}', selectedSubForDetail.holderName)
                        .replace('{CARTAO}', selectedSubForDetail.subscriptionCode)}
                      onChange={(e) => setSmsTemplate(e.target.value)}
                      className="text-xs"
                    />
                    <a
                      href={`https://wa.me/55${selectedSubForDetail.holderPhone.replace(
                        /\D/g,
                        ''
                      )}?text=${encodeURIComponent(
                        smsTemplate
                          .replace('{NOME}', selectedSubForDetail.holderName)
                          .replace('{CARTAO}', selectedSubForDetail.subscriptionCode)
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs mt-2">
                        <MessageSquare className="w-4 h-4 mr-1.5" /> Enviar via WhatsApp Agora
                      </Button>
                    </a>
                  </div>
                </div>
              )}
        </div>
      )}

      {/* =====================================================================
          MANUAL CLIENT REGISTRATION MODAL (IDÊNTICO AO LABCARD:
          DADOS PESSOAIS | PLANOS + OBSERVAÇÕES | ENDEREÇO + CADASTRAR)
      ===================================================================== */}
      <Dialog open={newSubModalOpen} onOpenChange={setNewSubModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <DialogTitle className="text-lg font-black uppercase tracking-wider text-slate-800">
                  {personType === 'PJ'
                    ? 'CADASTRAR EMPRESA PJ / PLANO EMPRESARIAL'
                    : 'CADASTRAR CLIENTE PF / FAMÍLIA'}
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  {personType === 'PJ'
                    ? 'Cadastro corporativo para planos empresariais e convênios com CNPJ.'
                    : 'Cadastro de pessoa física com titular e dependentes vinculados.'}
                </p>
              </div>

              {/* SELETOR RÁPIDO PF vs PJ */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant={personType === 'PF' ? 'default' : 'ghost'}
                  onClick={() => {
                    setPersonType('PF');
                    setHolderModalityCode('ADULTO');
                  }}
                  className={`h-7 px-3 text-xs font-bold ${
                    personType === 'PF'
                      ? 'bg-[#004d00] text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  Pessoa Física (PF)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={personType === 'PJ' ? 'default' : 'ghost'}
                  onClick={() => {
                    setPersonType('PJ');
                    setHolderModalityCode(
                      state?.modalities.find((m) => m.planType === 'EMPRESARIAL' || m.isCorporate)?.code || 'ADULTO'
                    );
                  }}
                  className={`h-7 px-3 text-xs font-bold ${
                    personType === 'PJ'
                      ? 'bg-[#004d00] text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  Pessoa Jurídica (PJ)
                </Button>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreateManualSubscription} className="space-y-6 pt-2">
            {/* SEÇÃO 1: DADOS CADASTRAIS (DINÂMICO PF vs PJ) */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1.5 flex items-center justify-between">
                <span>{personType === 'PJ' ? 'DADOS DA EMPRESA (PJ)' : 'DADOS PESSOAIS (PF)'}</span>
                <Badge variant="outline" className="text-[10px] font-bold">
                  {personType === 'PJ' ? 'PESSOA JURÍDICA' : 'PESSOA FÍSICA'}
                </Badge>
              </h4>

              {personType === 'PJ' ? (
                /* CAMPOS ESPECÍFICOS DE EMPRESA PJ */
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                    Razão Social *
                  </Label>
                  <div className="sm:col-span-9">
                    <Input
                      value={holderName}
                      onChange={(e) => setHolderName(e.target.value)}
                      placeholder="Ex: Empresa Comercial e Serviços Ltda"
                      required
                    />
                  </div>

                  <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                    CNPJ da Empresa *
                  </Label>
                  <div className="sm:col-span-5">
                    <Input
                      value={holderCpfCnpj}
                      onChange={(e) => setHolderCpfCnpj(e.target.value)}
                      placeholder="00.000.000/0000-00"
                      className={`${
                        holderCpfCnpj &&
                        cleanDigits(holderCpfCnpj).length === 14 &&
                        !isValidCnpj(holderCpfCnpj)
                          ? 'border-rose-500 focus-visible:ring-rose-500 bg-rose-50/20'
                          : ''
                      }`}
                      required
                    />
                    {holderCpfCnpj &&
                      cleanDigits(holderCpfCnpj).length === 14 &&
                      !isValidCnpj(holderCpfCnpj) && (
                        <p className="text-[11px] text-rose-600 font-bold mt-1">
                          ⚠️ CNPJ inválido. Verifique os números digitados.
                        </p>
                      )}
                  </div>
                  <div className="sm:col-span-4 text-xs text-slate-400">
                    Apenas números ou formato padrão
                  </div>

                  <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                    Responsável Legal
                  </Label>
                  <div className="sm:col-span-9">
                    <Input
                      value={holderRg}
                      onChange={(e) => setHolderRg(e.target.value)}
                      placeholder="Nome do diretor, sócio ou gestor responsável"
                    />
                  </div>
                </div>
              ) : (
                /* CAMPOS DE PESSOA FÍSICA PF */
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                    Nome *
                  </Label>
                  <div className="sm:col-span-9">
                    <Input
                      value={holderName}
                      onChange={(e) => setHolderName(e.target.value)}
                      placeholder="Nome completo do titular"
                      required
                    />
                  </div>

                  <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                    Data de Nascimento
                  </Label>
                  <div className="sm:col-span-4">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      value={holderBirthDate}
                      onChange={(e) => setHolderBirthDate(formatBirthDate(e.target.value))}
                    />
                  </div>
                  <div className="sm:col-span-5" />

                  <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                    RG
                  </Label>
                  <div className="sm:col-span-4">
                    <Input
                      value={holderRg}
                      onChange={(e) => setHolderRg(e.target.value)}
                      placeholder="Nº do RG"
                    />
                  </div>
                  <div className="sm:col-span-5" />

                  <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                    CPF *
                  </Label>
                  <div className="sm:col-span-4">
                    <Input
                      value={holderCpfCnpj}
                      onChange={(e) => setHolderCpfCnpj(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      className={`${
                        holderCpfCnpj &&
                        cleanDigits(holderCpfCnpj).length === 11 &&
                        !isValidCpf(holderCpfCnpj)
                          ? 'border-rose-500 focus-visible:ring-rose-500 bg-rose-50/20'
                          : ''
                      }`}
                      required
                    />
                    {holderCpfCnpj &&
                      cleanDigits(holderCpfCnpj).length === 11 &&
                      !isValidCpf(holderCpfCnpj) && (
                        <p className="text-[11px] text-rose-600 font-bold mt-1">
                          ⚠️ CPF inválido. Verifique os dígitos digitados.
                        </p>
                      )}
                  </div>
                  <div className="sm:col-span-5" />

                  <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                    Sexo
                  </Label>
                  <div className="sm:col-span-4">
                    <select
                      value={holderSex}
                      onChange={(e) => setHolderSex(e.target.value)}
                      className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                    >
                      <option value="">Selecione</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div className="sm:col-span-5" />

                  <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                    Estado Civil
                  </Label>
                  <div className="sm:col-span-4">
                    <select
                      value={holderMaritalStatus}
                      onChange={(e) => setHolderMaritalStatus(e.target.value)}
                      className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                    >
                      <option value="">Selecione</option>
                      <option value="Solteiro(a)">Solteiro(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="União Estável">União Estável</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viúvo(a)">Viúvo(a)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-5" />
                </div>
              )}

              {/* CAMPOS DE CONTATO E ATRIBUIÇÃO (COMUNS PARA PF E PJ) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1 border-t border-slate-100">
                <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                  DDD
                </Label>
                <div className="sm:col-span-2">
                  <Input
                    value={holderDdd}
                    onChange={(e) =>
                      setHolderDdd(e.target.value.replace(/\D/g, '').slice(0, 2))
                    }
                    placeholder="69"
                    maxLength={2}
                  />
                </div>
                <Label className="sm:col-span-2 text-xs font-bold text-slate-600 sm:text-right">
                  Telefone *
                </Label>
                <div className="sm:col-span-5">
                  <Input
                    value={holderPhone}
                    onChange={(e) => setHolderPhone(e.target.value)}
                    placeholder="99999-9999"
                    required
                  />
                </div>

                <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                  E-mail
                </Label>
                <div className="sm:col-span-9">
                  <Input
                    type="email"
                    value={holderEmail}
                    onChange={(e) => setHolderEmail(e.target.value)}
                    placeholder="contato@email.com"
                  />
                </div>

                <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                  Atribuir cadastro a um vendedor:
                </Label>
                <div className="sm:col-span-6">
                  <select
                    value={consultantName}
                    onChange={(e) => setConsultantName(e.target.value)}
                    className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                  >
                    <option value="">SELECIONE</option>
                    <option value="Recepção Balneário Lessa">
                      Recepção Balneário Lessa
                    </option>
                    <option value="Consultor Comercial 01">
                      Consultor Comercial 01
                    </option>
                    <option value="Consultor Comercial 02">
                      Consultor Comercial 02
                    </option>
                    <option value="Atendimento WhatsApp">
                      Atendimento WhatsApp
                    </option>
                  </select>
                </div>
                <div className="sm:col-span-3" />

                <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                  Foto 3x4 do Titular:
                </Label>
                <div className="sm:col-span-6">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) setHolderPhotoUrl(await fileToDataUrl(f));
                    }}
                  />
                </div>
                <div className="sm:col-span-3" />
              </div>
            </div>

            {/* SEÇÃO 2: PLANOS + DEPENDENTES + BARRA VERDE OBSERVAÇÕES */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1.5 flex items-center justify-between">
                <span>
                  {personType === 'PJ'
                    ? 'FUNCIONÁRIOS DA EMPRESA (CONVÊNIO / PARCERIA)'
                    : 'PLANOS'}
                </span>
                {personType === 'PJ' && (
                  <Badge className="bg-emerald-800 text-white text-[10px]">
                    PLANO LESSA PARCEIRO • R$ 25,00/mês por Funcionário
                  </Badge>
                )}
              </h4>

              {personType === 'PJ' ? (
                /* SEÇÃO DE FUNCIONÁRIOS DA EMPRESA (PJ) */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                      Ciclo e Cobrança:
                    </Label>
                    <div className="sm:col-span-4">
                      <select
                        value={cycle}
                        onChange={(e) => setCycle(e.target.value as BillingCycle)}
                        className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                      >
                        <option value="MONTHLY">Faturamento Mensal Recorrente</option>
                        <option value="ANNUAL">Faturamento Anual (12 Meses)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-5">
                      <select
                        value={paymentMethod}
                        onChange={(e) =>
                          setPaymentMethod(e.target.value as ClubPaymentMethod)
                        }
                        className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                      >
                        <option value="PIX">PIX Online (Boleto / Pix Asaas)</option>
                        <option value="LOCAL">Faturado Recepção / Boleto</option>
                        <option value="CREDIT_CARD">Cartão Corporativo</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-emerald-950">
                          Colaboradores da Empresa Conveniada
                        </span>
                        <p className="text-[11px] text-emerald-800">
                          Cada colaborador cadastrado terá carteirinha oficial "Lessa Parceiro" no valor de R$ 25,00/mês.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          setCompanyEmployees((prev) => [
                            ...prev,
                            {
                              id: `emp_${Date.now()}_${Math.random()}`,
                              fullName: '',
                              cpf: '',
                              phone: '',
                            },
                          ])
                        }
                        className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs h-8"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> + Adicionar Funcionário
                      </Button>
                    </div>

                    {companyEmployees.length === 0 ? (
                      <div className="text-center py-6 border-2 border-dashed border-emerald-200 rounded-lg text-xs text-slate-500 bg-white/60">
                        Nenhum funcionário adicionado ainda. Clique no botão acima para adicionar colaboradores da empresa.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {companyEmployees.map((emp, idx) => (
                          <div
                            key={emp.id}
                            className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-white p-3 rounded-xl border border-emerald-200 shadow-sm"
                          >
                            <div className="sm:col-span-5">
                              <Label className="text-[11px] font-bold text-slate-700">
                                Nome do Funcionário #{idx + 1} *
                              </Label>
                              <Input
                                value={emp.fullName}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCompanyEmployees((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, fullName: val } : item
                                    )
                                  );
                                }}
                                placeholder="Nome completo"
                                className="h-9 text-xs font-semibold"
                                required
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <Label className="text-[11px] font-bold text-slate-700">
                                CPF do Funcionário *
                              </Label>
                              <Input
                                value={emp.cpf}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCompanyEmployees((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, cpf: val } : item
                                    )
                                  );
                                }}
                                placeholder="000.000.000-00"
                                className="h-9 text-xs"
                                required
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <Label className="text-[11px] font-bold text-slate-700">
                                Telefone / WhatsApp *
                              </Label>
                              <Input
                                value={emp.phone}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCompanyEmployees((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, phone: val } : item
                                    )
                                  );
                                }}
                                placeholder="(69) 99999-9999"
                                className="h-9 text-xs"
                                required
                              />
                            </div>
                            <div className="sm:col-span-1 flex justify-end">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  setCompanyEmployees((prev) =>
                                    prev.filter((_, i) => i !== idx)
                                  )
                                }
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-9 w-9"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}

                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 p-3 bg-emerald-100/60 rounded-xl border border-emerald-300 text-xs font-bold text-emerald-950">
                          <span>
                            Total: <strong>{companyEmployees.length} colaboradores</strong> vinculados à empresa
                          </span>
                          <span className="text-sm font-black text-emerald-900">
                            Valor Mensal: {formatCurrency(companyEmployees.length * 25)} / mês
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                  Ciclo e Pagamento:
                </Label>
                <div className="sm:col-span-4">
                  <select
                    value={cycle}
                    onChange={(e) => setCycle(e.target.value as BillingCycle)}
                    className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                  >
                    <option value="ANNUAL">Plano Anual (12x / À Vista)</option>
                    <option value="MONTHLY">Plano Mensal Recorrente</option>
                  </select>
                </div>
                <div className="sm:col-span-5">
                  <select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as ClubPaymentMethod)
                    }
                    className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                  >
                    <option value="LOCAL">Recepção (PIX / Cartão Local)</option>
                    <option value="PIX">PIX Online (Asaas)</option>
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                    <option value="DEBIT_CARD">Cartão de Débito (Mensal)</option>
                    <option value="COURTESY">Cortesia / Gratuito (R$ 0)</option>
                  </select>
                </div>

                <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                  Planos:
                </Label>
                <div className="sm:col-span-6">
                  <select
                    value={holderModalityCode}
                    onChange={(e) => setHolderModalityCode(e.target.value)}
                    className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                  >
                    {(state.modalities || []).map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.name} (
                        {m.isFreeTier
                          ? 'R$ 0,00 - Grátis'
                          : cycle === 'ANNUAL'
                          ? `Anual: ${formatCurrency(m.annualPrice)} ou 12x ${formatCurrency(
                              m.annualInstallment
                            )}`
                          : `Mensal: ${formatCurrency(m.monthlyPrice)}/mês`}
                        )
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setManualDependents((prev) => [
                        ...prev,
                        {
                          fullName: '',
                          cpf: '',
                          birthDate: '',
                          modalityCode: 'KIDS',
                        },
                      ])
                    }
                    className="w-full text-xs font-bold border-emerald-600 text-emerald-800"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> + Dependente
                  </Button>
                </div>
              </div>

              {/* Dependentes adicionados no cadastro manual */}
              {manualDependents.length > 0 && (
                <div className="space-y-2 pt-2">
                  {manualDependents.map((dep, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-slate-50 p-3 rounded-xl border border-slate-200"
                    >
                      <div className="sm:col-span-4">
                        <Label className="text-[11px] font-bold">
                          Nome do Dependente #{idx + 1}
                        </Label>
                        <Input
                          value={dep.fullName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setManualDependents((prev) =>
                              prev.map((d, i) =>
                                i === idx ? { ...d, fullName: val } : d
                              )
                            );
                          }}
                          placeholder="Nome completo"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-[11px] font-bold">Nascimento</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="DD/MM/AAAA"
                          maxLength={10}
                          value={dep.birthDate}
                          onChange={(e) => {
                            const val = formatBirthDate(e.target.value);
                            setManualDependents((prev) =>
                              prev.map((d, i) =>
                                i === idx ? { ...d, birthDate: val } : d
                              )
                            );
                          }}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-[11px] font-bold">CPF</Label>
                        <Input
                          value={dep.cpf}
                          onChange={(e) => {
                            const val = formatCpf(e.target.value);
                            setManualDependents((prev) =>
                              prev.map((d, i) =>
                                i === idx ? { ...d, cpf: val } : d
                              )
                            );
                          }}
                          placeholder="000.000.000-00"
                          className={`${
                            dep.cpf &&
                            cleanDigits(dep.cpf).length === 11 &&
                            !isValidCpf(dep.cpf)
                              ? 'border-rose-500 focus-visible:ring-rose-500 bg-rose-50/20'
                              : ''
                          }`}
                        />
                        {dep.cpf &&
                          cleanDigits(dep.cpf).length === 11 &&
                          !isValidCpf(dep.cpf) && (
                            <p className="text-[10px] text-rose-600 font-bold mt-0.5">
                              ⚠️ CPF inválido
                            </p>
                          )}
                      </div>
                      <div className="sm:col-span-3">
                        <Label className="text-[11px] font-bold">
                          Plano / Categoria do Dependente
                        </Label>
                        <select
                          value={dep.modalityCode}
                          onChange={(e) => {
                            const val = e.target.value;
                            setManualDependents((prev) =>
                              prev.map((d, i) =>
                                i === idx ? { ...d, modalityCode: val } : d
                              )
                            );
                          }}
                          className="w-full h-10 rounded-lg border border-slate-300 px-2 text-xs bg-white font-bold"
                        >
                          {(state.modalities || []).map((m) => (
                            <option key={m.code} value={m.code}>
                              {m.name} (
                              {formatCurrency(
                                cycle === 'ANNUAL'
                                  ? m.annualInstallment
                                  : m.monthlyPrice
                              )}
                              /mês)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setManualDependents((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
                </>
              )}

              {/* BARRA VERDE ESCURA EXPANSÍVEL: OBSERVAÇÕES ⌄ (IDÊNTICA À IMAGEM) */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowNotesAccordion((prev) => !prev)}
                  className="w-full bg-[#004d00] hover:bg-emerald-900 text-white font-black text-xs uppercase tracking-wider py-2.5 px-4 rounded-sm flex items-center justify-center gap-2 shadow-sm"
                >
                  <span>OBSERVAÇÕES</span>
                  <span>{showNotesAccordion ? '⌃' : '⌄'}</span>
                </button>
                {showNotesAccordion && (
                  <div className="p-3 bg-slate-50 border border-t-0 border-slate-200 rounded-b-md">
                    <Textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Digite observações internas sobre este associado ou contrato..."
                      className="bg-white text-xs"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* SEÇÃO 3: ENDEREÇO */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1.5">
                ENDEREÇO
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                  CEP
                </Label>
                <div className="sm:col-span-4">
                  <Input
                    value={zipCode}
                    onChange={(e) => {
                      const val = e.target.value;
                      setZipCode(val);
                      if (val.replace(/\D/g, '').length === 8) {
                        lookupCepAndFill(val);
                      }
                    }}
                    onBlur={handleAdminCepBlur}
                    placeholder="Apenas Números (busca automática)"
                  />
                </div>
                <div className="sm:col-span-5" />

                <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                  Endereço
                </Label>
                <div className="sm:col-span-9">
                  <Input
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Rua / Avenida"
                  />
                </div>

                <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                  Nº
                </Label>
                <div className="sm:col-span-3">
                  <Input
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="Nº"
                  />
                </div>
                <div className="sm:col-span-6" />

                <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                  Complemento
                </Label>
                <div className="sm:col-span-9">
                  <Input
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    placeholder="Casa, Apto, Bloco..."
                  />
                </div>

                <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                  Bairro
                </Label>
                <div className="sm:col-span-4">
                  <Input
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Bairro"
                  />
                </div>
                <div className="sm:col-span-5" />

                <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                  Cidade
                </Label>
                <div className="sm:col-span-4">
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Cidade"
                  />
                </div>
                <div className="sm:col-span-5" />

                <Label className="sm:col-span-3 text-xs font-bold text-slate-600 sm:text-right">
                  Estado
                </Label>
                <div className="sm:col-span-4">
                  <select
                    value={uf}
                    onChange={(e) => setUf(e.target.value)}
                    className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                  >
                    <option value="">Selecione</option>
                    {[
                      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
                      'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
                      'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
                    ].map((sigla) => (
                      <option key={sigla} value={sigla}>
                        {sigla}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-5" />
              </div>
            </div>

            {/* RODAPÉ COM STATUS INICIAL + BOTÃO VERDE ESCURO "CADASTRAR" */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activateImmediately}
                    onChange={(e) => setActivateImmediately(e.target.checked)}
                    className="rounded w-4 h-4 accent-emerald-700"
                  />
                  Já liberar cadastro como ATIVO imediatamente
                </label>
                <span className="text-xs font-black text-emerald-800">
                  Total: {formatCurrency(calculatedManualMonthly)}/mês
                </span>
              </div>

              <Button
                type="submit"
                className="bg-[#004d00] hover:bg-emerald-900 text-white font-black uppercase tracking-wider px-10 h-11 rounded-md shadow-md"
              >
                CADASTRAR
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* =====================================================================
          GESTÃO COMPLETA DE PLANOS (CRIAR, ALTERAR E EXCLUIR + LINHAS DE BENEFÍCIOS)
          Fiel aos prints: media_1793302125292_ea915717.png e media_1793302173466_3acdf265.png
      ===================================================================== */}
      <Dialog
        open={!!editingModality}
        onOpenChange={(o) => !o && setEditingModality(null)}
      >
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6 space-y-6">
          {editingModality && (
            <div className="space-y-6">
              {/* CABEÇALHO DO MODAL */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <DialogTitle className="text-xl font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <span>
                      {state?.modalities.some((m) => m.id === editingModality.id)
                        ? 'ALTERAR PLANO'
                        : 'CADASTRAR PLANOS'}
                    </span>
                    {editingModality.code && (
                      <Badge variant="outline" className="text-xs font-mono font-bold">
                        {editingModality.code}
                      </Badge>
                    )}
                  </DialogTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure os valores, regras de visibilidade, cartões e benefícios exclusivos deste plano.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      editingModality.isFreeTier || editingModality.monthlyPrice === 0
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-slate-900 text-white font-bold'
                    }
                  >
                    {editingModality.isFreeTier || editingModality.monthlyPrice === 0
                      ? 'CORTESIA / GRÁTIS'
                      : formatCurrency(editingModality.monthlyPrice) + '/mês'}
                  </Badge>
                </div>
              </div>

              {/* FORMULÁRIO PRINCIPAL DE CONFIGURAÇÃO (Screenshot 3) */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1.5">
                  DADOS GERAIS DO PLANO
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-slate-700">
                  {/* 1. Nome */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Nome do Plano *</Label>
                    <Input
                      value={editingModality.name}
                      onChange={(e) =>
                        setEditingModality({
                          ...editingModality,
                          name: e.target.value,
                        })
                      }
                      placeholder="Ex: PLANO INDIVIDUAL MENSAL / Lessa Club"
                      className="bg-white"
                      required
                    />
                  </div>

                  {/* 2. Configurações de Preços (Mensal, Anual e Parcelamento) */}
                  <div className="md:col-span-2 bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                        Valores, Anual com 10% OFF e Parcelamento no Cartão
                      </Label>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const monthly = editingModality.monthlyPrice || 0;
                          const totalSemDesc = Number((monthly * 12).toFixed(2));
                          const totalComDesc = Number((totalSemDesc * 0.9).toFixed(2));
                          const parcela = Number((totalComDesc / 12).toFixed(2));
                          setEditingModality({
                            ...editingModality,
                            annualPrice: totalComDesc,
                            annualInstallment: parcela,
                            maxInstallments: 12,
                          });
                          toast({
                            title: '10% OFF calculado com sucesso!',
                            description: `Anual à Vista: ${formatCurrency(totalComDesc)} | 12x de ${formatCurrency(parcela)}/mês`,
                          });
                        }}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-7 px-2.5"
                      >
                        ⚡ Calcular 10% OFF Anual Automático
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700">
                          Mensal Recorrente (R$) *
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editingModality.monthlyPrice}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setEditingModality({
                              ...editingModality,
                              monthlyPrice: val,
                            });
                          }}
                          placeholder="49.90"
                          className="bg-white text-xs font-bold"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700">
                          Anual à Vista / Pix (R$)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editingModality.annualPrice ?? 0}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setEditingModality({
                              ...editingModality,
                              annualPrice: val,
                            });
                          }}
                          placeholder="538.91"
                          className="bg-white text-xs font-bold"
                        />
                        <span className="text-[10px] text-slate-500 block">
                          Sem desconto: {formatCurrency((editingModality.monthlyPrice || 0) * 12)}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700">
                          Parcela Anual Cartão (R$/mês)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editingModality.annualInstallment ?? 0}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setEditingModality({
                              ...editingModality,
                              annualInstallment: val,
                            });
                          }}
                          placeholder="44.91"
                          className="bg-white text-xs font-bold"
                        />
                        <span className="text-[10px] text-slate-500 block">
                          Ex: 44,91/mês
                        </span>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700">
                          Max Parcelas no Cartão
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          max="24"
                          value={editingModality.maxInstallments ?? 12}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(24, Number(e.target.value) || 12));
                            setEditingModality({
                              ...editingModality,
                              maxInstallments: val,
                            });
                          }}
                          placeholder="12"
                          className="bg-white text-xs font-bold"
                        />
                        <span className="text-[10px] text-slate-500 block">
                          Até {editingModality.maxInstallments ?? 12}x sem juros
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. R$ Adesão */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">R$ Adesão (Taxa Inicial)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editingModality.adhesionFee ?? 0}
                      onChange={(e) =>
                        setEditingModality({
                          ...editingModality,
                          adhesionFee: Number(e.target.value) || 0,
                        })
                      }
                      placeholder="0.00"
                      className="bg-white"
                    />
                  </div>

                  {/* 4. Limite de dependentes */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold">Limite de Dependentes</Label>
                      <span className="text-[10px] text-slate-400 font-normal">Max: 99</span>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max="99"
                      value={editingModality.maxDependents ?? 99}
                      onChange={(e) =>
                        setEditingModality({
                          ...editingModality,
                          maxDependents: Math.min(99, Math.max(0, Number(e.target.value) || 0)),
                        })
                      }
                      className="bg-white"
                    />
                  </div>

                  {/* 5. Tipo de Recorrência */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Tipo de Recorrência</Label>
                    <select
                      value={editingModality.recurrenceType || 'MENSAL'}
                      onChange={(e) =>
                        setEditingModality({
                          ...editingModality,
                          recurrenceType: e.target.value as any,
                        })
                      }
                      className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                    >
                      <option value="MENSAL">Mensal</option>
                      <option value="TRIMESTRAL">Trimestral</option>
                      <option value="SEMESTRAL">Semestral</option>
                      <option value="ANUAL">Anual</option>
                      <option value="VITALICIO">Vitalício</option>
                    </select>
                  </div>

                  {/* 6. Carência de Uso */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold">Carência de Uso</Label>
                      <span className="text-[10px] text-slate-400 font-normal">Max: 99 dias</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="99"
                        value={editingModality.gracePeriodDays ?? 0}
                        onChange={(e) =>
                          setEditingModality({
                            ...editingModality,
                            gracePeriodDays: Math.min(99, Math.max(0, Number(e.target.value) || 0)),
                          })
                        }
                        className="bg-white"
                      />
                      <span className="text-xs text-slate-500 font-bold shrink-0">dias</span>
                    </div>
                  </div>

                  {/* 7. Selecione a imagem do cartão/plano */}
                  <div className="md:col-span-2 space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <Label className="text-xs font-bold block">
                      Selecione a imagem do cartão / plano (Frente e Verso)
                    </Label>
                    <div className="flex flex-wrap items-center gap-4">
                      {editingModality.frontCardUrl && (
                        <div className="text-center">
                          <img
                            src={editingModality.frontCardUrl}
                            alt="Frente"
                            className="w-28 h-16 rounded object-cover border-2 border-emerald-600 shadow-sm"
                          />
                          <span className="text-[10px] text-slate-500 font-bold block mt-1">Frente</span>
                        </div>
                      )}
                      {editingModality.backCardUrl && (
                        <div className="text-center">
                          <img
                            src={editingModality.backCardUrl}
                            alt="Verso"
                            className="w-28 h-16 rounded object-cover border border-slate-300 shadow-sm"
                          />
                          <span className="text-[10px] text-slate-500 font-bold block mt-1">Verso</span>
                        </div>
                      )}

                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Caminho Frente (/cards/X.png)</span>
                            <Input
                              value={editingModality.frontCardUrl}
                              onChange={(e) =>
                                setEditingModality({
                                  ...editingModality,
                                  frontCardUrl: e.target.value,
                                })
                              }
                              className="h-8 text-xs bg-white"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Caminho Verso (/cards/X.png)</span>
                            <Input
                              value={editingModality.backCardUrl}
                              onChange={(e) =>
                                setEditingModality({
                                  ...editingModality,
                                  backCardUrl: e.target.value,
                                })
                              }
                              className="h-8 text-xs bg-white"
                            />
                          </div>
                        </div>

                        {/* Seletor rápido de cartões do Balneário */}
                        <div>
                          <span className="text-[10px] text-slate-500 block mb-1">
                            Ou escolha rápido uma das artes oficiais:
                          </span>
                          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1 bg-white rounded border border-slate-200">
                            {[1, 2, 4, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 34, 37, 39, 44].map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() =>
                                  setEditingModality({
                                    ...editingModality,
                                    frontCardUrl: `/cards/${num}.png`,
                                  })
                                }
                                className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                                  editingModality.frontCardUrl === `/cards/${num}.png`
                                    ? 'bg-emerald-700 text-white font-bold border-emerald-800'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                #{num}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 8. Exibir no Site (SIM / NÃO) */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Exibir no Site (/planos)</Label>
                    <select
                      value={editingModality.visibleOnSite ? 'SIM' : 'NAO'}
                      onChange={(e) =>
                        setEditingModality({
                          ...editingModality,
                          visibleOnSite: e.target.value === 'SIM',
                          visibleInSimulator: e.target.value === 'SIM',
                        })
                      }
                      className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                    >
                      <option value="SIM">SIM</option>
                      <option value="NAO">NÃO</option>
                    </select>
                  </div>

                  {/* 9. Exibir no Totem (SIM / NÃO) */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Exibir no Totem / Portaria</Label>
                    <select
                      value={editingModality.visibleOnTotem !== false ? 'SIM' : 'NAO'}
                      onChange={(e) =>
                        setEditingModality({
                          ...editingModality,
                          visibleOnTotem: e.target.value === 'SIM',
                        })
                      }
                      className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                    >
                      <option value="SIM">SIM</option>
                      <option value="NAO">NÃO</option>
                    </select>
                  </div>

                  {/* 10. Exibir para Consultores */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Exibir para Consultores</Label>
                    <select
                      value={editingModality.visibleToConsultants ? 'SIM' : 'NAO'}
                      onChange={(e) =>
                        setEditingModality({
                          ...editingModality,
                          visibleToConsultants: e.target.value === 'SIM',
                        })
                      }
                      className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                    >
                      <option value="SIM">SIM</option>
                      <option value="NAO">NÃO</option>
                    </select>
                  </div>

                  {/* 11. Add a todos os consultores existentes */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Add a todos os consultores existentes</Label>
                    <select
                      value={editingModality.addExistingConsultants !== false ? 'SIM' : 'NAO'}
                      onChange={(e) =>
                        setEditingModality({
                          ...editingModality,
                          addExistingConsultants: e.target.value === 'SIM',
                        })
                      }
                      className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                    >
                      <option value="SIM">SIM</option>
                      <option value="NAO">NÃO</option>
                    </select>
                  </div>

                  {/* 12. Exibir para Influencer */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Exibir para Influencer</Label>
                    <select
                      value={editingModality.visibleToInfluencers ? 'SIM' : 'NAO'}
                      onChange={(e) =>
                        setEditingModality({
                          ...editingModality,
                          visibleToInfluencers: e.target.value === 'SIM',
                        })
                      }
                      className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                    >
                      <option value="SIM">SIM</option>
                      <option value="NAO">NÃO</option>
                    </select>
                  </div>

                  {/* 13. Add a todos os Influencer existentes */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Add a todos os Influencer existentes</Label>
                    <select
                      value={editingModality.addExistingInfluencers !== false ? 'SIM' : 'NAO'}
                      onChange={(e) =>
                        setEditingModality({
                          ...editingModality,
                          addExistingInfluencers: e.target.value === 'SIM',
                        })
                      }
                      className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                    >
                      <option value="SIM">SIM</option>
                      <option value="NAO">NÃO</option>
                    </select>
                  </div>

                  {/* 14. Telemedicina */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Telemedicina</Label>
                    <select
                      value={editingModality.telemedicina ? 'SIM' : 'NAO'}
                      onChange={(e) =>
                        setEditingModality({
                          ...editingModality,
                          telemedicina: e.target.value === 'SIM',
                        })
                      }
                      className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                    >
                      <option value="SIM">SIM</option>
                      <option value="NAO">NÃO</option>
                    </select>
                  </div>

                  {/* 15. Cortesia */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Cortesia / Isento</Label>
                    <select
                      value={editingModality.isFreeTier ? 'SIM' : 'NAO'}
                      onChange={(e) => {
                        const isFree = e.target.value === 'SIM';
                        setEditingModality({
                          ...editingModality,
                          isFreeTier: isFree,
                          monthlyPrice: isFree ? 0 : editingModality.monthlyPrice || 49.9,
                          annualPrice: isFree ? 0 : editingModality.annualPrice || 538.92,
                          annualInstallment: isFree ? 0 : editingModality.annualInstallment || 44.91,
                        });
                      }}
                      className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                    >
                      <option value="SIM">SIM</option>
                      <option value="NAO">NÃO</option>
                    </select>
                  </div>

                  {/* 16. Tipo de Plano */}
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs font-bold">Tipo de Plano</Label>
                    <select
                      value={editingModality.planType || 'NORMAL'}
                      onChange={(e) =>
                        setEditingModality({
                          ...editingModality,
                          planType: e.target.value as any,
                          isCorporate: e.target.value === 'EMPRESARIAL',
                        })
                      }
                      className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                    >
                      <option value="NORMAL">NORMAL (Pessoa Física / Lazer Regular)</option>
                      <option value="EMPRESARIAL">EMPRESARIAL (Pessoa Jurídica / Corporativo)</option>
                      <option value="CONVENIO">CONVÊNIO (Associações / Servidores)</option>
                      <option value="PUBLICIDADE">PUBLICIDADE (Permutas e Parcerias)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: LINHAS DE BENEFÍCIOS (Screenshot 4: media_1793302173466_3acdf265.png) */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      LINHAS DE BENEFÍCIOS DO PLANO
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Itens descritivos exibidos nos cards, proposta de adesão e contrato.
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const current = editingModality.benefits || [];
                      setEditingModality({
                        ...editingModality,
                        benefits: [...current, 'Novo benefício do plano'],
                      });
                    }}
                    className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs h-8"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> + Adicionar Linha de Benefício
                  </Button>
                </div>

                <div className="space-y-2 pt-1">
                  {(editingModality.benefits && editingModality.benefits.length > 0
                    ? editingModality.benefits
                    : [
                        'Acesso ilimitado às áreas do Balneário nos dias e horários de funcionamento',
                        'Sem taxa de adesão',
                        'Carteirinha digital e física personalizada',
                        'Desconto exclusivo no restaurante e quiosques',
                      ]
                  ).map((benefit, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={benefit}
                        onChange={(e) => {
                          const val = e.target.value;
                          const list = [
                            ...(editingModality.benefits && editingModality.benefits.length > 0
                              ? editingModality.benefits
                              : [
                                  'Acesso ilimitado às áreas do Balneário nos dias e horários de funcionamento',
                                  'Sem taxa de adesão',
                                  'Carteirinha digital e física personalizada',
                                  'Desconto exclusivo no restaurante e quiosques',
                                ]),
                          ];
                          list[idx] = val;
                          setEditingModality({
                            ...editingModality,
                            benefits: list,
                          });
                        }}
                        placeholder={`Benefício #${idx + 1}`}
                        className="bg-white h-9 text-xs font-medium"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          const list = [
                            ...(editingModality.benefits && editingModality.benefits.length > 0
                              ? editingModality.benefits
                              : [
                                  'Acesso ilimitado às áreas do Balneário nos dias e horários de funcionamento',
                                  'Sem taxa de adesão',
                                  'Carteirinha digital e física personalizada',
                                  'Desconto exclusivo no restaurante e quiosques',
                                ]),
                          ];
                          setEditingModality({
                            ...editingModality,
                            benefits: list.filter((_, i) => i !== idx),
                          });
                        }}
                        className="h-9 w-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* RODAPÉ DO MODAL COM BOTÕES DE AÇÃO */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                {state?.modalities.some((m) => m.id === editingModality.id) ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={async () => {
                      if (!confirm(`Tem certeza que deseja excluir permanentemente o plano "${editingModality.name}"?`)) {
                        return;
                      }
                      const filtered = (state.modalities || []).filter((m) => m.id !== editingModality.id);
                      await persist({ ...state, modalities: filtered });
                      setEditingModality(null);
                      toast({
                        title: 'Plano excluído com sucesso!',
                        description: `O plano "${editingModality.name}" foi removido do catálogo.`,
                      });
                    }}
                    className="font-bold text-xs h-10 w-full sm:w-auto"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" /> Excluir Plano
                  </Button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingModality(null)}
                    className="h-10 text-xs font-bold"
                  >
                    Cancelar
                  </Button>

                  <Button
                    type="button"
                    onClick={async () => {
                      if (!editingModality.name.trim()) {
                        toast({
                          title: 'Informe o nome do plano',
                          variant: 'destructive',
                        });
                        return;
                      }
                      const exists = (state.modalities || []).some(
                        (m) => m.id === editingModality.id
                      );
                      const nextModalities = exists
                        ? (state.modalities || []).map((m) =>
                            m.id === editingModality.id ? editingModality : m
                          )
                        : [...state.modalities, editingModality];
                      await persist({ ...state, modalities: nextModalities });
                      setEditingModality(null);
                      toast({
                        title: exists ? 'Plano alterado com sucesso!' : 'Novo plano cadastrado com sucesso!',
                        description: `${editingModality.name} — ${formatCurrency(editingModality.monthlyPrice)}/mês`,
                      });
                    }}
                    className="bg-[#004d00] hover:bg-emerald-900 text-white font-black uppercase tracking-wider px-8 h-10 text-xs shadow-md"
                  >
                    {state?.modalities.some((m) => m.id === editingModality.id)
                      ? 'Salvar Alterações'
                      : 'Cadastrar Plano'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* EDIT CONTRACT MODAL */}
      <Dialog
        open={!!editingContract}
        onOpenChange={(o) => !o && setEditingContract(null)}
      >
        <DialogContent className="max-w-3xl">
          {editingContract && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="font-black">
                  Editar Contrato • {editingContract.title}
                </DialogTitle>
              </DialogHeader>
              <Input
                value={editingContract.title}
                onChange={(e) =>
                  setEditingContract({
                    ...editingContract,
                    title: e.target.value,
                  })
                }
              />
              <Textarea
                rows={14}
                value={editingContract.contentHtml}
                onChange={(e) =>
                  setEditingContract({
                    ...editingContract,
                    contentHtml: e.target.value,
                  })
                }
                className="font-mono text-xs"
              />
              <Button
                onClick={async () => {
                  const nextTemplates = state.contractTemplates.map((t) =>
                    t.id === editingContract.id
                      ? { ...editingContract, updatedAt: new Date().toISOString() }
                      : t
                  );
                  await persist({
                    ...state,
                    contractTemplates: nextTemplates,
                  });
                  setEditingContract(null);
                  toast({ title: 'Contrato atualizado com sucesso!' });
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Salvar Modelo de Contrato
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: VALIDAR CARTEIRINHA (PORTARIA / QR CODE) */}
      <Dialog
        open={isQrValidatorModalOpen}
        onOpenChange={(open) => {
          setIsQrValidatorModalOpen(open);
          if (!open) {
            setQrValidatorQuery('');
            setQrValidatorResult(null);
            setQrValidatorSearched(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-700" />
              <span>Validador de Carteirinha Oficial (Portaria / QR Code)</span>
            </DialogTitle>
          </DialogHeader>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-xs text-slate-600 font-medium">
              Aponte o leitor de QR Code ou digite o <strong>Número da Carteirinha</strong>, <strong>Código de Verificação</strong> ou <strong>CPF</strong> do associado para autenticar o acesso e registrar a entrada.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleExecuteQrSearch();
              }}
              className="flex gap-2"
            >
              <Input
                placeholder="Ex: LESSA-CLUB-ADULTO-1234, CPF ou Código do QR..."
                value={qrValidatorQuery}
                onChange={(e) => setQrValidatorQuery(e.target.value)}
                className="bg-white border-slate-300 font-semibold text-sm"
                autoFocus
              />
              <Button
                type="submit"
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 shrink-0"
              >
                <Search className="w-4 h-4 mr-1.5" />
                Buscar
              </Button>
            </form>
          </div>

          {qrValidatorSearched && !qrValidatorResult && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 text-center space-y-1">
              <div className="flex items-center justify-center gap-2 font-bold text-sm">
                <XCircle className="w-5 h-5 text-rose-600" />
                <span>Carteirinha não encontrada</span>
              </div>
              <p className="text-xs text-rose-600">
                Nenhum titular ou dependente foi localizado com o termo digitado. Verifique os dígitos e tente novamente.
              </p>
            </div>
          )}

          {qrValidatorResult && (
            <div className="space-y-4 pt-1">
              {/* Status do Plano */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                  qrValidatorResult.subscription.status === 'ACTIVE'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <div className="flex items-center gap-3">
                  {qrValidatorResult.subscription.status === 'ACTIVE' ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Situação Cadastral
                    </div>
                    <div className="text-base font-black">
                      {qrValidatorResult.subscription.status === 'ACTIVE'
                        ? '✅ PLANO ATIVO — ACESSO LIBERADO'
                        : `⚠️ PLANO ${qrValidatorResult.subscription.status} — VERIFICAR FINANCEIRO`}
                    </div>
                  </div>
                </div>

                <Badge
                  className={`font-black text-xs px-3 py-1 ${
                    qrValidatorResult.subscription.status === 'ACTIVE'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  {qrValidatorResult.subscription.status === 'ACTIVE' ? 'LIBERADO' : 'PENDENTE'}
                </Badge>
              </div>

              {/* Informações do Membro e Titular */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-white border border-slate-200 rounded-xl p-4">
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">
                    Nome Completo
                  </span>
                  <span className="font-black text-sm text-slate-900">
                    {qrValidatorResult.member.fullName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">
                    Categoria / Modalidade
                  </span>
                  <span className="font-bold text-slate-800">
                    {qrValidatorResult.member.role === 'HOLDER'
                      ? 'Titular do Plano'
                      : 'Dependente Familiar'}{' '}
                    • {qrValidatorResult.member.modalityCode}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">
                    Número da Carteirinha
                  </span>
                  <span className="font-mono font-bold text-slate-800">
                    {qrValidatorResult.member.cardNumber || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">
                    CPF
                  </span>
                  <span className="font-mono font-semibold text-slate-700">
                    {qrValidatorResult.member.cpf || 'Não informado'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">
                    Validade do Acesso
                  </span>
                  <span className="font-bold text-slate-800">
                    {qrValidatorResult.subscription.expiresAt
                      ? formatDateBR(qrValidatorResult.subscription.expiresAt)
                      : '31/12/2026'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px]">
                    Titular do Contrato
                  </span>
                  <span className="font-semibold text-slate-700">
                    {qrValidatorResult.subscription.holder.fullName} ({qrValidatorResult.subscription.holder.phone || 'Sem fone'})
                  </span>
                </div>
              </div>

              {/* Preview Visual da Carteirinha Oficial */}
              <div className="bg-slate-900 rounded-xl p-3 flex justify-center">
                <ClubMemberCardView
                  member={qrValidatorResult.member}
                  subscription={qrValidatorResult.subscription}
                  modalities={state?.modalities}
                  scale={0.85}
                />
              </div>

              {/* Botão de Registro de Entrada / Check-in */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  Total de acessos registrados:{' '}
                  <strong>{qrValidatorResult.subscription.visits?.length || 0}</strong>
                </span>
                <Button
                  type="button"
                  onClick={() =>
                    handleRegisterQrCheckin(
                      qrValidatorResult.subscription,
                      qrValidatorResult.member
                    )
                  }
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-black"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Registrar Entrada na Portaria (Check-in)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
