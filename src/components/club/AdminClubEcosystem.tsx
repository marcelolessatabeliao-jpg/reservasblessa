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
  Code,
  Save,
  Undo,
  Redo,
  ListOrdered,
  List,
  Outdent,
  Indent,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Maximize2,
  ShieldCheck,
  XCircle,
  RefreshCw,
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
  DialogDescription,
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
  ALL_CONSULTANT_PLANS,
  ConsultantPlanPermission,
} from '@/lib/club-types';
import {
  ClubDatabaseState,
  DEFAULT_SITE_TERMS_TEXT,
  getClubStateSync,
  fetchClubState,
  saveClubState,
  createClubSubscription,
  markClubInvoicePaid,
  generateAsaasChargeForClubInvoice,
  generateUnifiedPaymentLink,
  emitCarneMonthlyChargesInAsaas,
  getQrCodeImageUrl,
  renderSubscriptionContractHtml,
  renderSiteTermsHtml,
  printDocumentHtml,
  findMemberOrSubscriptionByQuery,
  scoreSearchMatch,
  formatCurrency,
  formatDateBR,
  fileToDataUrl,
  compressImageFile,
  isValidCpf,
  isValidCnpj,
  cleanDigits,
  formatCpf,
  formatPhone,
  formatBirthDate,
  getMemberAccessMessage,
  updateAsaasPaymentDueDate,
  fetchAddressByCep,
  getPlanDocumentRule,
  memberHasProofDocument,
  isMemberBlockedForMissingDoc,
  attachMemberProofDocument,
  verifyMemberProofDocument,
  getConsultantSlug,
  buildConsultantReferralUrl,
  doesConsultantAllowModality,
  getSelectablePlansForConsultants,
  getConsultantSubscriptionMetrics,
  isClubDateExpired,
  getValidityLabelFromDate,
  AsaasCustomerSyncCandidate,
  fetchAsaasInstallmentCandidates,
  applySelectedAsaasSync,
  mapAsaasPaymentStatusToInvoiceStatus,
} from '@/lib/club-service';
import {
  getSeenClubSubIds,
  markClubSubAsSeen,
  markAllClubSubsAsSeen,
} from '@/lib/admin-notifications';
import {
  ClubMemberCardView,
  MultiCardPrintSheet,
} from '@/components/club/ClubMemberCardView';

const MONTH_OPTIONS = [
  { value: '2026-01', label: 'Janeiro/2026' },
  { value: '2026-02', label: 'Fevereiro/2026' },
  { value: '2026-03', label: 'Março/2026' },
  { value: '2026-04', label: 'Abril/2026' },
  { value: '2026-05', label: 'Maio/2026' },
  { value: '2026-06', label: 'Junho/2026' },
  { value: '2026-07', label: 'Julho/2026' },
  { value: '2026-08', label: 'Agosto/2026' },
  { value: '2026-09', label: 'Setembro/2026' },
  { value: '2026-10', label: 'Outubro/2026' },
  { value: '2026-11', label: 'Novembro/2026' },
  { value: '2026-12', label: 'Dezembro/2026' },
  { value: '2027-01', label: 'Janeiro/2027' },
];

interface AdminClubEcosystemProps {
  standalone?: boolean;
}

export const AdminClubEcosystem: React.FC<AdminClubEcosystemProps> = ({
  standalone = false,
}) => {
  const { toast } = useToast();
  const [state, setState] = useState<ClubDatabaseState | null>(() => getClubStateSync());
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Quick search (Lupa Labcard)
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');

  // Clientes & Empresas filters
  const [subSearch, setSubSearch] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState<string>('ALL');
  const [personFilter, setPersonFilter] = useState<'ALL' | 'PF' | 'PJ'>('ALL');
  const [originFilter, setOriginFilter] = useState<'ALL' | 'SITE' | 'ADMIN' | 'IMPORT_LABCARD'>('ALL');
  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState<number | 'ALL'>(50);
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
    endDate: '',
  });

  // Perfil Financeiro do Cliente states
  const [selectedCarneNumber, setSelectedCarneNumber] = useState('ALL');
  const [selectedClientInvoiceIdsForDelete, setSelectedClientInvoiceIdsForDelete] =
    useState<string[]>([]);
  const [editingClientInvoiceId, setEditingClientInvoiceId] = useState<
    string | null
  >(null);
  const [editInvDueDate, setEditInvDueDate] = useState('');
  const [editInvAmount, setEditInvAmount] = useState('');
  const [editInvDesc, setEditInvDesc] = useState('');
  const [showFaturaAvulsaForm, setShowFaturaAvulsaForm] = useState(false);
  const [avulsaDesc, setAvulsaDesc] = useState('');
  const [avulsaAmount, setAvulsaAmount] = useState('');
  const [avulsaDueDate, setAvulsaDueDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [avulsaEmitAsaas, setAvulsaEmitAsaas] = useState(true);
  const [avulsaLoading, setAvulsaLoading] = useState(false);

  // Modal para Visualizar / Gerar Cobrança PIX da Parcela (Botão Azul QR Code da Tabela)
  const [selectedInvoiceForPixModal, setSelectedInvoiceForPixModal] =
    useState<ClubInvoice | null>(null);
  const [loadingRowPix, setLoadingRowPix] = useState(false);

  // Modal para TODOS EM CARTÃO (Link Único de Quitação)
  const [unifiedCardModalOpen, setUnifiedCardModalOpen] = useState(false);
  const [unifiedCardLoading, setUnifiedCardLoading] = useState(false);
  const [unifiedCardUrl, setUnifiedCardUrl] = useState('');

  // Modal para + ADD CARNÊ (Adicionar novo carnê baseado na soma dos planos)
  const [carneModalOpen, setCarneModalOpen] = useState(false);
  const [carneInstallmentCount, setCarneInstallmentCount] = useState<number>(12);
  const [carneInstallmentValue, setCarneInstallmentValue] = useState<string>('0.00');
  const [carneAdhesionDueDate, setCarneAdhesionDueDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [carneFirstDueDate, setCarneFirstDueDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });
  const [carneDescription, setCarneDescription] = useState('Mensalidade');
  const [carneRecurrenceMode, setCarneRecurrenceMode] = useState<'NONE' | 'REGISTERED_CARD'>('NONE');
  const [carneEmitAsaasOnCreate, setCarneEmitAsaasOnCreate] = useState(false);
  const [carneCreateLoading, setCarneCreateLoading] = useState(false);

  // Modal para GERAR CARNÊ (Botão inferior -> emitir cobranças mensais no Asaas)
  const [gerarCarneAsaasModalOpen, setGerarCarneAsaasModalOpen] = useState(false);
  const [gerarCarneAsaasCount, setGerarCarneAsaasCount] = useState<number>(12);
  const [gerarCarneAsaasFirstDue, setGerarCarneAsaasFirstDue] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [gerarCarneAsaasDueDay, setGerarCarneAsaasDueDay] = useState<number>(10);
  const [gerarCarneAsaasRecurrence, setGerarCarneAsaasRecurrence] = useState<'NONE' | 'REGISTERED_CARD'>('NONE');
  const [gerarCarneAsaasBillingType, setGerarCarneAsaasBillingType] = useState<'UNDEFINED' | 'BOLETO' | 'PIX'>('UNDEFINED');
  const [gerarCarneAsaasLoading, setGerarCarneAsaasLoading] = useState(false);

  // Modal de Confirmação Obrigatória para Exclusão / Estorno de Parcelas
  const [invoiceDeleteConfirm, setInvoiceDeleteConfirm] = useState<
    | null
    | { mode: 'BULK'; invoices: ClubInvoice[] }
    | { mode: 'SINGLE'; invoice: ClubInvoice }
  >(null);

  // Estado para exclusão segura de clientes (com confirmação)
  const [clientToDelete, setClientToDelete] = useState<ClubSubscription | null>(null);

  const [clubNotificationsTrigger, setClubNotificationsTrigger] = useState(0);
  useEffect(() => {
    const handler = () => setClubNotificationsTrigger((v) => v + 1);
    window.addEventListener('admin_notifications_updated', handler);
    return () => window.removeEventListener('admin_notifications_updated', handler);
  }, []);

  const seenClubSubIds = useMemo(() => {
    return getSeenClubSubIds();
  }, [clubNotificationsTrigger]);

  const unseenClubCount = useMemo(() => {
    if (!state?.subscriptions) return 0;
    return state.subscriptions.filter((s) => s && s.id && !seenClubSubIds.has(s.id)).length;
  }, [state?.subscriptions, seenClubSubIds]);

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
  const [newConsRole, setNewConsRole] = useState<'CONSULTOR' | 'INFLUENCER'>('CONSULTOR');
  const [newConsName, setNewConsName] = useState('');
  const [newConsCpf, setNewConsCpf] = useState('');
  const [newConsPhone, setNewConsPhone] = useState('');
  const [newConsEmail, setNewConsEmail] = useState('');
  const [newConsPassword, setNewConsPassword] = useState('');
  const [showNewConsPassword, setShowNewConsPassword] = useState(false);
  const [newConsAllowedPlans, setNewConsAllowedPlans] = useState<string[]>([]);
  const [isSavingConsultant, setIsSavingConsultant] = useState(false);
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

  // Modal Editar Consultor / Influencer
  const [editingConsultant, setEditingConsultant] = useState<ClubConsultant | null>(null);
  const [showEditConsPassword, setShowEditConsPassword] = useState(false);

  // Modal Gerar Link de Indicação (Screenshot 4)
  const [selectedConsultantForLink, setSelectedConsultantForLink] = useState<ClubConsultant | null>(null);
  const [linkPlanSelection, setLinkPlanSelection] = useState<string>('TODOS');
  const [linkAllowedMethods, setLinkAllowedMethods] = useState({
    boleto: true,
    pix: true,
    creditCard: true,
    recurrence: true,
  });

  // Modal Permissão de Planos (Screenshot 4 do usuário)
  const [selectedConsultantForPlans, setSelectedConsultantForPlans] = useState<ClubConsultant | null>(null);
  const [draftAllowedPlans, setDraftAllowedPlans] = useState<string[]>([]);

  // Modal Contabilidade & Vendas Pagas do Consultor
  const [selectedConsultantForAccounting, setSelectedConsultantForAccounting] = useState<ClubConsultant | null>(null);

  // Ferramentas Fluxo de Caixa (Screenshot 5 do usuário)
  const [cashFlowStartDate, setCashFlowStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [cashFlowEndDate, setCashFlowEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [cashFlowFilterMode, setCashFlowFilterMode] = useState<'ALL' | 'MANUAL' | 'AUTO'>('ALL');

  // Filtros Avançados de Relatórios (Datas, Idades, Planos, Categoria, Status)
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportAgeGroup, setReportAgeGroup] = useState<'TODOS' | 'KIDS' | 'TEENS' | 'ADULTS' | 'SENIORS'>('TODOS');
  const [reportPlanCode, setReportPlanCode] = useState<string>('TODOS');
  const [reportCategory, setReportCategory] = useState<'TODOS' | 'TITULARES' | 'DEPENDENTES'>('TODOS');
  const [reportStatus, setReportStatus] = useState<'TODOS' | 'ACTIVE' | 'INACTIVE' | 'OVERDUE'>('TODOS');
  const [reportCity, setReportCity] = useState<string>('TODAS');
  const [reportCourtesy, setReportCourtesy] = useState<'TODOS' | 'CORTESIA' | 'PAGO'>('TODOS');
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');

  const uniqueReportCities = useMemo(() => {
    if (!state?.subscriptions) return [];
    const set = new Set<string>();
    state.subscriptions.forEach((s) => {
      const city = (s.addressCity || '').trim();
      if (city) set.add(city);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [state?.subscriptions]);

  // Adicionais e Serviços do Balneário
  const [editingCatalogService, setEditingCatalogService] = useState<{
    id: string;
    name: string;
    category: string;
    price: number;
    description: string;
    active: boolean;
  } | null>(null);

  // Sincronização em lote com Asaas (Pré-visualização antes de importar mensalidades; sem ativar cadastros)
  const [isAsaasSyncModalOpen, setIsAsaasSyncModalOpen] = useState(false);
  const [isLoadingAsaasSync, setIsLoadingAsaasSync] = useState(false);
  const [isApplyingAsaasSync, setIsApplyingAsaasSync] = useState(false);
  const [asaasSyncError, setAsaasSyncError] = useState<string | null>(null);
  const [asaasSyncMeta, setAsaasSyncMeta] = useState<{
    isProd: boolean;
    totalFound: number;
    returnedCount: number;
    truncated: boolean;
  } | null>(null);
  const [asaasCandidates, setAsaasCandidates] = useState<AsaasCustomerSyncCandidate[]>([]);
  const [asaasSelectedCustomers, setAsaasSelectedCustomers] = useState<Record<string, boolean>>({});
  const [asaasTargetMap, setAsaasTargetMap] = useState<Record<string, string>>({});
  const [asaasPaymentSelectionMap, setAsaasPaymentSelectionMap] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [asaasFilterCategory, setAsaasFilterCategory] = useState<
    'ALL' | 'SUBSCRIPTION' | 'RESERVATION' | 'MATCHED' | 'HALF_PRICE'
  >('ALL');
  const [asaasSearchQuery, setAsaasSearchQuery] = useState('');
  const [expandedAsaasCustomerId, setExpandedAsaasCustomerId] = useState<string | null>(null);

  const handleLoadAsaasCandidates = async () => {
    if (!state) return;
    setIsLoadingAsaasSync(true);
    setAsaasSyncError(null);
    try {
      const res = await fetchAsaasInstallmentCandidates(state);
      setAsaasSyncMeta({
        isProd: res.isProd,
        totalFound: res.totalFound,
        returnedCount: res.returnedCount,
        truncated: res.truncated,
      });
      setAsaasCandidates(res.candidates);

      const nextSelected: Record<string, boolean> = {};
      const nextTargets: Record<string, string> = {};
      const nextPayMap: Record<string, Record<string, boolean>> = {};

      res.candidates.forEach((cand) => {
        nextSelected[cand.customerId] = false; // Usuário revisa e escolhe quem sincronizar
        nextTargets[cand.customerId] = cand.matchedSubscriptionId || 'CREATE_PENDING';
        const payFlags: Record<string, boolean> = {};
        (cand.payments || []).forEach((p) => {
          payFlags[p.id] = !p.looksLikeReservation;
        });
        nextPayMap[cand.customerId] = payFlags;
      });

      setAsaasSelectedCustomers(nextSelected);
      setAsaasTargetMap(nextTargets);
      setAsaasPaymentSelectionMap(nextPayMap);
    } catch (err: any) {
      setAsaasSyncError(err?.message || 'Erro ao consultar parcelas ativas no Asaas.');
    } finally {
      setIsLoadingAsaasSync(false);
    }
  };

  const handleOpenAsaasSyncModal = () => {
    setIsAsaasSyncModalOpen(true);
    handleLoadAsaasCandidates();
  };

  const handleApplyAsaasSync = async (activateSelected: boolean = false) => {
    if (!state) return;
    const chosenCandidates = asaasCandidates.filter(
      (c) => asaasSelectedCustomers[c.customerId]
    );
    if (chosenCandidates.length === 0) {
      toast({
        title: 'Nenhum cliente selecionado',
        description: 'Marque ao menos um cliente na pré-visualização para importar as mensalidades.',
        variant: 'destructive',
      });
      return;
    }

    const selections = chosenCandidates
      .map((cand) => {
        const payFlags = asaasPaymentSelectionMap[cand.customerId] || {};
        const paymentIds = (cand.payments || [])
          .filter((p) => payFlags[p.id] !== false)
          .map((p) => p.id);
        return {
          candidate: cand,
          targetSubscriptionId: asaasTargetMap[cand.customerId] || cand.matchedSubscriptionId || 'CREATE_PENDING',
          paymentIds,
        };
      })
      .filter((s) => s.paymentIds.length > 0);

    if (selections.length === 0) {
      toast({
        title: 'Nenhuma parcela marcada',
        description: 'Os clientes marcados não têm parcelas selecionadas para importar.',
        variant: 'destructive',
      });
      return;
    }

    setIsApplyingAsaasSync(true);
    try {
      const result = await applySelectedAsaasSync(state, selections, { activateSelected });
      setState(result.state);
      toast({
        title: activateSelected
          ? 'Mensalidades Importadas e Cadastros Ativados!'
          : 'Mensalidades do Asaas Sincronizadas!',
        description: activateSelected
          ? `${result.updatedSubs} cliente(s) atualizado(s) • ${result.activatedSubs} cadastro(s) ativado(s) • ${result.importedInvoices} nova(s) parcela(s) • ${result.updatedInvoices} atualizada(s).`
          : `${result.updatedSubs} cliente(s) atualizado(s) • ${result.importedInvoices} nova(s) parcela(s) • ${result.updatedInvoices} atualizada(s). Nenhum cadastro foi ativado automaticamente.`,
      });
      setIsAsaasSyncModalOpen(false);
    } catch (err: any) {
      toast({
        title: 'Erro na sincronização com o Asaas',
        description: err?.message || 'Não foi possível salvar as mensalidades importadas.',
        variant: 'destructive',
      });
    } finally {
      setIsApplyingAsaasSync(false);
    }
  };

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
  const [cashTitle, setCashTitle] = useState('');
  const [cashDescription, setCashDescription] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [cashMethod, setCashMethod] = useState('PIX');
  const [cashRegisteredBy, setCashRegisteredBy] = useState('Admin Lessa');
  const [cashDate, setCashDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [isCashEntryModalOpen, setIsCashEntryModalOpen] = useState(false);
  const [cashEntryModalType, setCashEntryModalType] = useState<'IN' | 'OUT'>('OUT');
  const [cashEntryStartDate, setCashEntryStartDate] = useState('2026-11-10');
  const [cashEntryEndDate, setCashEntryEndDate] = useState('2026-11-10');
  const [selectedCashEntryIds, setSelectedCashEntryIds] = useState<string[]>([]);

  // Filtros específicos de Finanças (Screenshots Labcard)
  const [faturamentoMonth, setFaturamentoMonth] = useState('2026-11');
  const [mensalidadesStartDate, setMensalidadesStartDate] = useState('2026-11-01');
  const [mensalidadesEndDate, setMensalidadesEndDate] = useState('2026-11-30');
  const [mensalidadesPaidFilter, setMensalidadesPaidFilter] = useState<'UNPAID' | 'PAID'>('UNPAID');
  const [vencidasMonth, setVencidasMonth] = useState('2026-06');

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
  const [siteTermsText, setSiteTermsText] = useState<string>(DEFAULT_SITE_TERMS_TEXT);
  const [isSiteTermsSourceMode, setIsSiteTermsSourceMode] = useState<boolean>(false);
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
  const [depExpDrafts, setDepExpDrafts] = useState<Record<string, string>>({});
  const [lastRegistrationChangeBox, setLastRegistrationChangeBox] = useState<{
    title: string;
    detail: string;
    isActive: boolean;
    changedAt: string;
  } | null>(null);
  const [statusChangeFeedbackModal, setStatusChangeFeedbackModal] = useState<{
    title: string;
    previousStatusLabel?: string;
    newStatusLabel: string;
    subjectName: string;
    expirationDate?: string;
    detail: string;
    isActive: boolean;
  } | null>(null);

  // Editing Modality or Contract
  const [editingModality, setEditingModality] =
    useState<ClubModality | null>(null);
  const [editingContract, setEditingContract] =
    useState<ClubContractTemplate | null>(null);

  // Modal de Visualização de Anexos
  const [previewAttachment, setPreviewAttachment] = useState<{
    name: string;
    dataUrl: string;
    mimeType?: string;
    createdAt?: string;
  } | null>(null);

  useEffect(() => {
    setIsSyncing(true);
    fetchClubState()
      .then((loaded) => {
        setState(loaded);
        if (loaded.siteTermsText && loaded.siteTermsText.length > 50) {
          setSiteTermsText(loaded.siteTermsText);
        } else {
          setSiteTermsText(DEFAULT_SITE_TERMS_TEXT);
        }
      })
      .finally(() => {
        setLoading(false);
        setIsSyncing(false);
      });
  }, []);

  useEffect(() => {
    if (state?.siteTermsText && state.siteTermsText.length > 50) {
      setSiteTermsText(state.siteTermsText);
    }
  }, [state?.siteTermsText]);

  const handleSaveSiteTerms = async () => {
    if (!state) return;
    try {
      const nextState: ClubDatabaseState = {
        ...state,
        siteTermsText: siteTermsText || DEFAULT_SITE_TERMS_TEXT,
        updatedAt: new Date().toISOString(),
      };
      await persist(nextState);
      toast({
        title: 'Termo de Uso salvo com sucesso!',
        description: 'O texto foi atualizado e está vigente para o site e contratos.',
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar Termo de Uso',
        description: 'Não foi possível salvar o texto.',
      });
    }
  };

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
  // Ordena do mais recente primeiro com data do cadastro e busca inteligente que prioriza quem começa pelo nome
  const filteredSubscriptions = useMemo(() => {
    if (!state) return [];
    const baseList = (state.subscriptions || []).filter((sub) => {
      if (personFilter !== 'ALL' && sub.personType !== personFilter) {
        return false;
      }
      if (originFilter !== 'ALL' && sub.origin !== originFilter) {
        return false;
      }
      if (subStatusFilter !== 'ALL') {
        if (subStatusFilter === 'PENDING') {
          if (sub.status !== 'PENDING' && sub.status !== 'PENDING_TRANSFER') return false;
        } else if (sub.status !== subStatusFilter) {
          return false;
        }
      }
      if (!subSearch.trim()) return true;
      const q = subSearch.toLowerCase().trim();
      const digits = q.replace(/\D/g, '');
      return (
        scoreSearchMatch(sub.holderName || '', q) > 0 ||
        (digits.length >= 3 && (sub.holderCpf || '').replace(/\D/g, '').includes(digits)) ||
        (sub.members || []).some(
          (m) =>
            scoreSearchMatch(m.fullName || '', q) > 0 ||
            (m.cardNumber || '').includes(q) ||
            (digits.length >= 3 && (m.cpf || '').replace(/\D/g, '').includes(digits))
        )
      );
    });

    if (subSearch.trim()) {
      const q = subSearch.toLowerCase().trim();
      return [...baseList].sort((a, b) => {
        const scoreA = Math.max(
          scoreSearchMatch(a.holderName || '', q),
          ...(a.members || []).map((m) => scoreSearchMatch(m.fullName || '', q))
        );
        const scoreB = Math.max(
          scoreSearchMatch(b.holderName || '', q),
          ...(b.members || []).map((m) => scoreSearchMatch(m.fullName || '', q))
        );
        if (scoreB !== scoreA) return scoreB - scoreA;
        const dateA = new Date(a.createdAt || a.startDate || 0).getTime();
        const dateB = new Date(b.createdAt || b.startDate || 0).getTime();
        return dateB - dateA;
      });
    }

    // Padrão: Mais recente primeiro com data do cadastro!
    return [...baseList].sort((a, b) => {
      const dateA = new Date(a.createdAt || a.startDate || 0).getTime();
      const dateB = new Date(b.createdAt || b.startDate || 0).getTime();
      return dateB - dateA;
    });
  }, [state, subSearch, subStatusFilter, personFilter, originFilter]);

  // Reset pagination when search or filters change
  useEffect(() => {
    setClientPage(1);
  }, [subSearch, subStatusFilter, personFilter, originFilter]);

  const totalClients = filteredSubscriptions.length;
  const totalPages =
    clientPageSize === 'ALL'
      ? 1
      : Math.max(1, Math.ceil(totalClients / clientPageSize));

  const paginatedSubscriptions = useMemo(() => {
    if (clientPageSize === 'ALL') return filteredSubscriptions;
    const start = (clientPage - 1) * clientPageSize;
    return filteredSubscriptions.slice(start, start + clientPageSize);
  }, [filteredSubscriptions, clientPage, clientPageSize]);

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

  // Ferramentas completas de Fluxo de Caixa (Idêntico ao painel Labcard - Screenshot 5)
  const cashFlowPanelData = useMemo(() => {
    if (!state) {
      return {
        rows: [] as Array<{
          id: string;
          cardCode: string;
          holderName: string;
          hasBoleto: boolean;
          boletoUrl?: string;
          boletoId?: string;
          planName: string;
          amount: number;
          paymentType: string;
          installment: string;
          dueDate: string;
          paidDate: string;
          obs: string;
          isAuto: boolean;
          isManual: boolean;
          isCashEntry: boolean;
          type: 'IN' | 'OUT';
        }>,
        manualBaixasTotal: 0,
        autoBaixasTotal: 0,
        mensalidadesTotal: 0,
        entradasCaixaTotal: 0,
        saidasCaixaTotal: 0,
        saldo: 0,
      };
    }

    interface CashFlowRow {
      id: string;
      cardCode: string;
      holderName: string;
      hasBoleto: boolean;
      boletoUrl?: string;
      boletoId?: string;
      planName: string;
      amount: number;
      paymentType: string;
      installment: string;
      dueDate: string;
      paidDate: string;
      obs: string;
      isAuto: boolean;
      isManual: boolean;
      isCashEntry: boolean;
      type: 'IN' | 'OUT';
    }

    const rows: CashFlowRow[] = [];

    // 1. Mensalidades / Faturas pagas dos associados
    for (const sub of state.subscriptions || []) {
      for (const inv of sub.invoices || []) {
        if (inv.status === 'PAID' && inv.amount > 0) {
          const paidDateStr = (inv.paidAt || inv.dueDate || inv.createdAt || '').split('T')[0];
          const isAuto = Boolean(inv.asaasPaymentId);
          const isManual = !isAuto;

          rows.push({
            id: inv.id,
            cardCode: sub.subscriptionCode || inv.subscriptionCode || '—',
            holderName: sub.holderName || inv.holderName || '—',
            hasBoleto: Boolean(inv.invoiceUrl || inv.asaasPaymentId),
            boletoUrl: inv.invoiceUrl,
            boletoId: inv.asaasPaymentId,
            planName: sub.planSummaryLabel || inv.description || 'Lessa Club',
            amount: inv.amount,
            paymentType: inv.paymentMethod || (isAuto ? 'Gateway Asaas' : 'Balcão / Manual'),
            installment: `${inv.installmentNumber || 1}/${inv.totalInstallments || 1}`,
            dueDate: inv.dueDate || '—',
            paidDate: paidDateStr,
            obs: inv.description || (isAuto ? 'Baixa Automática (Gateway)' : 'Baixa Manual no Balcão'),
            isAuto,
            isManual,
            isCashEntry: false,
            type: 'IN',
          });
        }
      }
    }

    // 2. Lançamentos avulsos de caixa (Entradas e Saídas)
    for (const entry of state.cashEntries || []) {
      rows.push({
        id: entry.id,
        cardCode: 'CAIXA',
        holderName: entry.category || 'Movimentação Avulsa',
        hasBoleto: false,
        planName: entry.description,
        amount: entry.amount,
        paymentType: entry.paymentMethod,
        installment: '1/1',
        dueDate: entry.date,
        paidDate: entry.date,
        obs: entry.type === 'IN' ? 'Entrada Avulsa de Caixa' : 'Saída Avulsa de Caixa (Despesa)',
        isAuto: false,
        isManual: true,
        isCashEntry: true,
        type: entry.type,
      });
    }

    // Filtro por data (cashFlowStartDate a cashFlowEndDate)
    const filteredByDate = rows.filter((r) => {
      if (!r.paidDate) return true;
      if (cashFlowStartDate && r.paidDate < cashFlowStartDate) return false;
      if (cashFlowEndDate && r.paidDate > cashFlowEndDate) return false;
      return true;
    });

    let manualBaixasTotal = 0;
    let autoBaixasTotal = 0;
    let mensalidadesTotal = 0;
    let entradasCaixaTotal = 0;
    let saidasCaixaTotal = 0;

    for (const r of filteredByDate) {
      if (r.type === 'IN') {
        if (!r.isCashEntry) {
          mensalidadesTotal += r.amount;
        } else {
          entradasCaixaTotal += r.amount;
        }

        if (r.isManual) {
          manualBaixasTotal += r.amount;
        }
        if (r.isAuto) {
          autoBaixasTotal += r.amount;
        }
      } else if (r.type === 'OUT') {
        saidasCaixaTotal += r.amount;
      }
    }

    const totalEntradas = mensalidadesTotal + entradasCaixaTotal;
    const saldo = totalEntradas - saidasCaixaTotal;

    const finalRows = filteredByDate.filter((r) => {
      if (cashFlowFilterMode === 'MANUAL') return r.isManual && r.type === 'IN';
      if (cashFlowFilterMode === 'AUTO') return r.isAuto && r.type === 'IN';
      return true;
    });

    finalRows.sort((a, b) => (b.paidDate || '').localeCompare(a.paidDate || ''));

    return {
      rows: finalRows,
      manualBaixasTotal,
      autoBaixasTotal,
      mensalidadesTotal,
      entradasCaixaTotal,
      saidasCaixaTotal,
      saldo,
    };
  }, [state, cashFlowStartDate, cashFlowEndDate, cashFlowFilterMode]);

  // 1. Faturamento Mensal Previsto (Screenshot 2)
  const faturamentoPrevistoComputed = useMemo(() => {
    if (!state) {
      return {
        totalBoletos: 0,
        totalRecebido: 0,
        totalPendente: 0,
        totalGeral: 0,
        rows: [] as Array<{
          name: string;
          cpf: string;
          plan: string;
          amount: number;
          installmentDate: string;
          status: 'PAID' | 'PENDING';
        }>,
      };
    }
    const rows: Array<{
      name: string;
      cpf: string;
      plan: string;
      amount: number;
      installmentDate: string;
      status: 'PAID' | 'PENDING';
    }> = [];

    const monthParts = faturamentoMonth.split('-');
    const refMonthShort = `${monthParts[1]}/${monthParts[0]}`;

    for (const sub of state.subscriptions || []) {
      for (const inv of sub.invoices || []) {
        const invDue = inv.dueDate || '';
        const matchDue = invDue.startsWith(faturamentoMonth);
        const matchRef = inv.referenceMonth && inv.referenceMonth.includes(refMonthShort);
        if (matchDue || matchRef) {
          rows.push({
            name: sub.holderName,
            cpf: sub.holderCpf,
            plan: sub.planSummaryLabel || inv.description || 'Lessa Club',
            amount: inv.amount,
            installmentDate: invDue,
            status: inv.status === 'PAID' ? 'PAID' : 'PENDING',
          });
        }
      }
    }

    const totalBoletos = rows.length;
    const totalRecebido = rows
      .filter((r) => r.status === 'PAID')
      .reduce((sum, r) => sum + r.amount, 0);
    const totalPendente = rows
      .filter((r) => r.status === 'PENDING')
      .reduce((sum, r) => sum + r.amount, 0);
    const totalGeral = totalRecebido + totalPendente;

    return {
      totalBoletos,
      totalRecebido,
      totalPendente,
      totalGeral,
      rows,
    };
  }, [state, faturamentoMonth]);

  // 2. Mensalidades com Filtro de Data e Rádios PAGOS / NÃO PAGOS (Screenshot 3)
  const mensalidadesComputed = useMemo(() => {
    if (!state) {
      return {
        total: 0,
        rows: [] as Array<{
          cardCode: string;
          name: string;
          boleto: string;
          plan: string;
          amount: number;
          installment: string;
          dueDate: string;
        }>,
      };
    }
    const rows: Array<{
      cardCode: string;
      name: string;
      boleto: string;
      plan: string;
      amount: number;
      installment: string;
      dueDate: string;
    }> = [];

    for (const sub of state.subscriptions || []) {
      for (const inv of sub.invoices || []) {
        if (!inv.dueDate) continue;
        if (mensalidadesStartDate && inv.dueDate < mensalidadesStartDate) continue;
        if (mensalidadesEndDate && inv.dueDate > mensalidadesEndDate) continue;

        const isPaid = inv.status === 'PAID';
        if (mensalidadesPaidFilter === 'PAID' && !isPaid) continue;
        if (mensalidadesPaidFilter === 'UNPAID' && isPaid) continue;

        rows.push({
          cardCode: sub.subscriptionCode || '—',
          name: sub.holderName,
          boleto: inv.boletoNumber || inv.asaasPaymentId || inv.id.replace(/\D/g, '') || '—',
          plan: sub.planSummaryLabel || inv.description || 'Lessa Club',
          amount: inv.amount,
          installment: `${inv.installmentNumber || 11} de ${inv.totalInstallments || 12}`,
          dueDate: inv.dueDate,
        });
      }
    }

    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    return {
      total,
      rows,
    };
  }, [state, mensalidadesStartDate, mensalidadesEndDate, mensalidadesPaidFilter]);

  // 3. Cobranças Vencidas Por Mês (Screenshot 4)
  const vencidasPorMesComputed = useMemo(() => {
    if (!state) return [];
    const rows: Array<{
      name: string;
      cardCode: string;
      dueDate: string;
      dueDay: number;
      amount: number;
      phone: string;
      email: string;
    }> = [];

    const monthParts = vencidasMonth.split('-');
    const refMonthShort = `${monthParts[1]}/${monthParts[0]}`;

    for (const sub of state.subscriptions || []) {
      for (const inv of sub.invoices || []) {
        const invDue = inv.dueDate || '';
        const matchMonth = invDue.startsWith(vencidasMonth) || (inv.referenceMonth && inv.referenceMonth.includes(refMonthShort));
        const isOverdue = inv.status === 'OVERDUE' || (inv.status === 'PENDING' && invDue < '2026-11-10');

        if (matchMonth && isOverdue) {
          const dueDayNum = parseInt(invDue.split('-')[2] || '1', 10);
          rows.push({
            name: sub.holderName,
            cardCode: sub.subscriptionCode || '—',
            dueDate: invDue,
            dueDay: dueDayNum || 1,
            amount: inv.amount,
            phone: sub.holderPhone || '—',
            email: sub.holderEmail || '—',
          });
        }
      }
    }

    return rows;
  }, [state, vencidasMonth]);

  // 4. Assinaturas Ativas e Vencidas com Vínculo a Cartões (Screenshot 5)
  const assinaturasAtivasVencidasComputed = useMemo(() => {
    if (!state) return [];
    const isActiveTab = financeSubView === 'ASSINATURAS_ATIVAS';

    return (state.subscriptions || []).filter((sub) => {
      if (isActiveTab) {
        return sub.status === 'ACTIVE' || sub.status === 'PENDING_TRANSFER';
      } else {
        return sub.status === 'EXPIRED' || sub.status === 'INACTIVE' || sub.status === 'OVERDUE';
      }
    }).map((sub) => {
      const cardStr = sub.registeredCard?.last4Digits
        ? `****${sub.registeredCard.last4Digits}`
        : '****';
      return {
        cardCode: sub.subscriptionCode || '—',
        name: sub.holderName,
        plan: sub.planSummaryLabel,
        amount: sub.monthlyEquivalent,
        card: cardStr,
        status: isActiveTab ? 'ACTIVE' : sub.status,
        createdAt: sub.createdAt ? sub.createdAt.split('T')[0] : '2026-04-30',
        dueDate: sub.endDate || '2026-12-30',
      };
    });
  }, [state, financeSubView]);

  // 5. Entradas e Saídas Avulsas de Caixa (Screenshot 1)
  const cashEntriesListComputed = useMemo(() => {
    if (!state) return [];
    const targetType = financeSubView === 'ENTRADA_CAIXA' ? 'IN' : 'OUT';
    return (state.cashEntries || []).filter((entry) => {
      if (entry.type !== targetType) return false;
      if (cashEntryStartDate && entry.date < cashEntryStartDate) return false;
      if (cashEntryEndDate && entry.date > cashEntryEndDate) return false;
      return true;
    });
  }, [state, financeSubView, cashEntryStartDate, cashEntryEndDate]);

  // Atualização instantânea em segundo plano ao clicar em Dashboard (sem bloquear tela)
  const handleRefreshDashboard = async () => {
    setActiveTab('dashboard');
    setOpenMenu(null);
    setOpenSubMenu(null);
    setIsSyncing(true);
    try {
      const reloaded = await fetchClubState();
      setState(reloaded);
      toast({
        title: 'Painel Atualizado',
        description: 'Dashboard e dados do Lessa Club sincronizados com sucesso.',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

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

  const handleSaveCashEntryModal = async () => {
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
      type: cashEntryModalType,
      title: cashTitle.trim() || (cashEntryModalType === 'IN' ? 'Entrada Avulsa' : 'Saída Operacional'),
      category: cashCategory || (cashEntryModalType === 'IN' ? 'Entrada Recepção' : 'Despesa Operacional'),
      description: cashDescription.trim(),
      amount: val,
      paymentMethod: cashMethod,
      date: cashDate || new Date().toISOString().split('T')[0],
      registeredBy: cashRegisteredBy.trim() || 'Admin Lessa',
      createdAt: new Date().toISOString(),
    };
    const nextState: ClubDatabaseState = {
      ...state,
      cashEntries: [newEntry, ...(state.cashEntries || [])],
    };
    await persist(nextState);
    setIsCashEntryModalOpen(false);
    setCashTitle('');
    setCashDescription('');
    setCashAmount('');
    toast({
      title: cashEntryModalType === 'IN' ? 'Entrada de Caixa registrada!' : 'Saída de Caixa registrada!',
      description: `${newEntry.title} — ${formatCurrency(newEntry.amount)}`,
    });
  };

  const handleDeleteSelectedCashEntries = async () => {
    if (!state || selectedCashEntryIds.length === 0) return;
    const remaining = (state.cashEntries || []).filter(
      (e) => !selectedCashEntryIds.includes(e.id)
    );
    const nextState = { ...state, cashEntries: remaining };
    await persist(nextState);
    setSelectedCashEntryIds([]);
    toast({
      title: 'Registros excluídos',
      description: 'As movimentações de caixa selecionadas foram excluídas com sucesso.',
    });
  };

  const generateUniqueReferralCode = (
    preferredCode: string,
    fullName: string,
    excludeId?: string
  ): string => {
    const existingCodes = new Set(
      (state?.consultants || [])
        .filter((c) => c.id !== excludeId)
        .map((c) => c.referralCode.trim().toUpperCase())
    );
    const cleanedPreferred = preferredCode
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');

    if (cleanedPreferred && !existingCodes.has(cleanedPreferred)) {
      return cleanedPreferred;
    }

    const baseName = fullName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .split(/\s+/)[0]
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '') || 'CONSULTOR';

    if (!existingCodes.has(baseName)) return baseName;
    let counter = 2;
    while (existingCodes.has(`${baseName}${counter}`)) {
      counter++;
    }
    return `${baseName}${counter}`;
  };

  const handleCreateConsultant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state) {
      toast({
        variant: 'destructive',
        title: 'Aguarde o carregamento',
        description: 'Os dados do sistema ainda estão carregando. Tente novamente em instantes.',
      });
      return;
    }
    if (!newConsName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Preencha o Nome Completo do consultor ou influencer.',
      });
      return;
    }

    const allPlanCodes = getSelectablePlansForConsultants(state.modalities).map((p) => p.code);
    const selectedPlans =
      newConsAllowedPlans.length > 0 ? newConsAllowedPlans : allPlanCodes;
    const assignedRole = newConsRole === 'INFLUENCER' ? 'INFLUENCER' : 'CONSULTOR';
    const referralCode = generateUniqueReferralCode(newConsCode, newConsName);
    const cpfFormatted = newConsCpf.trim() ? formatCpf(newConsCpf) || newConsCpf.trim() : '000.000.000-00';
    const passwordToSave =
      newConsPassword.trim() ||
      cleanDigits(newConsCpf) ||
      '123456';

    const newCons: ClubConsultant = {
      id: `cons_${Date.now()}`,
      name: newConsName.trim(),
      cpf: cpfFormatted,
      phone: newConsPhone.trim(),
      email: newConsEmail.trim().toLowerCase(),
      password: passwordToSave,
      role: assignedRole,
      commissionType: newConsCommissionType,
      commissionValue: Number(newConsCommission) || 0,
      commissionPercent: newConsCommissionType === 'PERCENT' ? (Number(newConsCommission) || 0) : 10,
      commissionRecurring: newConsCommissionRecurring,
      commissionFirstOnly: newConsCommissionFirstOnly,
      paymentMethodsAllowed: { ...newConsMethods },
      allowedPlanCodes: selectedPlans,
      referralCode,
      clicksCount: 0,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    setIsSavingConsultant(true);
    try {
      await persist({
        ...state,
        consultants: [newCons, ...(state.consultants || [])],
      });
      setNewConsName('');
      setNewConsCpf('');
      setNewConsPhone('');
      setNewConsEmail('');
      setNewConsPassword('');
      setNewConsCode('');
      setNewConsAllowedPlans(allPlanCodes);
      setConsultantRoleFilter('TODOS');
      setConsultantStatusFilter('TODOS');
      setShowNewConsultantForm(false);
      toast({
        title: `${assignedRole === 'INFLUENCER' ? 'Influencer' : 'Consultor'} cadastrado com sucesso!`,
        description: `Código: ${newCons.referralCode} • Login: ${newCons.email || newCons.cpf} • Senha: ${passwordToSave}`,
      });
    } catch (err: any) {
      console.error('[AdminClub] Erro ao salvar consultor:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar consultor/influencer',
        description: err?.message || 'Não foi possível salvar no banco de dados. Tente novamente.',
      });
    } finally {
      setIsSavingConsultant(false);
    }
  };

  const handleSaveEditedConsultant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state || !editingConsultant) return;
    if (!editingConsultant.name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Informe o nome do consultor/influencer.',
      });
      return;
    }

    const uniqueCode = generateUniqueReferralCode(
      editingConsultant.referralCode,
      editingConsultant.name,
      editingConsultant.id
    );

    const updatedCons: ClubConsultant = {
      ...editingConsultant,
      name: editingConsultant.name.trim(),
      cpf: editingConsultant.cpf.trim() ? formatCpf(editingConsultant.cpf) || editingConsultant.cpf.trim() : '000.000.000-00',
      phone: editingConsultant.phone.trim(),
      email: (editingConsultant.email || '').trim().toLowerCase(),
      password:
        (editingConsultant.password || '').trim() ||
        cleanDigits(editingConsultant.cpf) ||
        '123456',
      referralCode: uniqueCode,
      commissionPercent:
        editingConsultant.commissionType === 'FIXED'
          ? editingConsultant.commissionPercent || 10
          : Number(editingConsultant.commissionValue ?? editingConsultant.commissionPercent ?? 10),
    };

    setIsSavingConsultant(true);
    try {
      await persist({
        ...state,
        consultants: (state.consultants || []).map((c) =>
          c.id === updatedCons.id ? updatedCons : c
        ),
      });
      setEditingConsultant(null);
      toast({
        title: 'Cadastro atualizado!',
        description: `Dados e credenciais de ${updatedCons.name} salvos com sucesso.`,
      });
    } catch (err: any) {
      console.error('[AdminClub] Erro ao editar consultor:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar consultor',
        description: err?.message || 'Tente novamente.',
      });
    } finally {
      setIsSavingConsultant(false);
    }
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

      // 2. Cidade
      if (reportCity !== 'TODAS') {
        const subCity = (sub.addressCity || '').trim().toLowerCase();
        if (subCity !== reportCity.trim().toLowerCase()) return false;
      }

      // 3. Status
      if (reportStatus === 'ACTIVE' && sub.status !== 'ACTIVE') return false;
      if (reportStatus === 'INACTIVE' && sub.status === 'ACTIVE') return false;
      if (reportStatus === 'OVERDUE' && sub.status !== 'OVERDUE') return false;

      // 4. Plano
      if (reportPlanCode !== 'TODOS') {
        const hasPlan = sub.members.some((m) => m.modalityCode === reportPlanCode);
        if (!hasPlan) return false;
      }

      // 5. Cortesia
      const subIsCourtesy =
        sub.paymentMethod === 'COURTESY' ||
        sub.monthlyEquivalent === 0 ||
        sub.totalContractValue === 0;
      if (reportCourtesy === 'CORTESIA' && !subIsCourtesy) return false;
      if (reportCourtesy === 'PAGO' && subIsCourtesy) return false;

      // 6. Categoria (Titulares vs Dependentes)
      if (reportCategory === 'DEPENDENTES') {
        const hasDeps = sub.members.some((m) => m.role === 'DEPENDENTE');
        if (!hasDeps) return false;
      }

      // 7. Faixa Etária
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

  const getFilteredReportMembers = () => {
    if (!state?.subscriptions) return [];
    const results: { member: ClubMember; sub: ClubSubscription; isCourtesy: boolean }[] = [];
    const q = reportSearchQuery.trim().toLowerCase();

    state.subscriptions.forEach((sub) => {
      // 1. Período
      if (reportStartDate && sub.startDate < reportStartDate) return;
      if (reportEndDate && sub.startDate > reportEndDate) return;

      // 2. Cidade
      if (reportCity !== 'TODAS') {
        const subCity = (sub.addressCity || '').trim().toLowerCase();
        if (subCity !== reportCity.trim().toLowerCase()) return;
      }

      // 3. Status
      if (reportStatus === 'ACTIVE' && sub.status !== 'ACTIVE') return;
      if (reportStatus === 'INACTIVE' && sub.status === 'ACTIVE') return;
      if (reportStatus === 'OVERDUE' && sub.status !== 'OVERDUE') return;

      const subIsCourtesy =
        sub.paymentMethod === 'COURTESY' ||
        sub.monthlyEquivalent === 0 ||
        sub.totalContractValue === 0;

      (sub.members || []).forEach((m) => {
        // 4. Titulares vs Dependentes
        if (reportCategory === 'TITULARES' && m.role !== 'TITULAR') return;
        if (reportCategory === 'DEPENDENTES' && m.role !== 'DEPENDENTE') return;

        // 5. Plano
        if (reportPlanCode !== 'TODOS' && m.modalityCode !== reportPlanCode) return;

        // 6. Cortesia
        const memberIsCourtesy =
          subIsCourtesy ||
          m.monthlyValue === 0 ||
          m.modalityCode === 'KIDS' ||
          m.modalityCode === 'IDOSO_60' ||
          m.modalityCode === 'PCD_TEA';

        if (reportCourtesy === 'CORTESIA' && !memberIsCourtesy) return;
        if (reportCourtesy === 'PAGO' && memberIsCourtesy) return;

        // 7. Faixa Etária
        if (reportAgeGroup !== 'TODOS') {
          const age = getAgeFromBirthDate(m.birthDate);
          if (age >= 0) {
            if (reportAgeGroup === 'KIDS' && age > 12) return;
            if (reportAgeGroup === 'TEENS' && (age < 13 || age > 17)) return;
            if (reportAgeGroup === 'ADULTS' && (age < 18 || age > 59)) return;
            if (reportAgeGroup === 'SENIORS' && age < 60) return;
          }
        }

        // 8. Busca textual rápida no relatório
        if (q) {
          const matchName = (m.fullName || '').toLowerCase().includes(q);
          const matchCpf = cleanDigits(m.cpf || '').includes(cleanDigits(q));
          const matchCard = (m.cardNumber || '').toLowerCase().includes(q);
          const matchSub = (sub.holderName || '').toLowerCase().includes(q);
          if (!matchName && !matchCpf && !matchCard && !matchSub) return;
        }

        results.push({
          member: m,
          sub,
          isCourtesy: memberIsCourtesy,
        });
      });
    });

    return results;
  };

  const handleExportReportXlsx = (reportType: string) => {
    if (!state) return;
    let rows: Record<string, any>[] = [];
    if (reportType === 'CLIENTES') {
      const members = getFilteredReportMembers();
      rows = members.map(({ member, sub, isCourtesy }) => ({
        Cartao: member.cardNumber,
        Tipo: member.role === 'TITULAR' ? 'Titular' : 'Dependente',
        Nome: member.fullName,
        CPF: member.cpf || sub.holderCpf,
        Telefone: member.phone || sub.holderPhone,
        Email: sub.holderEmail || '',
        Plano: member.modalityName || sub.planSummaryLabel,
        Cidade: sub.addressCity || 'Ariquemes',
        UF: sub.addressState || 'RO',
        Cortesia: isCourtesy ? 'SIM (Gratuidade Oficial)' : 'NÃO (Plano Pago)',
        Valor: isCourtesy ? 0 : member.monthlyValue,
        Status: member.status || sub.status,
        Origem: sub.origin || 'SITE',
        TitularVinculado: member.role === 'DEPENDENTE' ? sub.holderName : '-',
        DataAdesao: formatDateBR(sub.startDate || sub.createdAt),
      }));
    } else if (reportType === 'EMPRESAS') {
      const baseFiltered = getFilteredReportSubscriptions();
      const targetSubs = baseFiltered.filter((s) => s.personType === 'PJ');
      rows = targetSubs.map((s) => ({
        Cartao: s.subscriptionCode,
        Empresa: s.holderName,
        CNPJ: s.holderCpf,
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
        endDate: selectedSubForDetail.endDate || '',
      });
      const draftMap: Record<string, string> = {};
      (selectedSubForDetail.members || []).forEach((m) => {
        draftMap[m.id] = m.expirationDate || '';
      });
      setDepExpDrafts(draftMap);
      setLastRegistrationChangeBox(null);
      setSelectedClientInvoiceIdsForDelete([]);
      setEditingClientInvoiceId(null);
      setShowFaturaAvulsaForm(false);
      markClubSubAsSeen(selectedSubForDetail.id);
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

    const prevStatus = selectedSubForDetail.status;
    const targetStatus: ClubSubscription['status'] =
      situacaoLiberar === 'SIM' && situacaoInativar === 'NAO'
        ? 'ACTIVE'
        : 'INACTIVE';
    const nextEndDate =
      editClientData.endDate.trim() || selectedSubForDetail.endDate;
    const nextValidityLabel = getValidityLabelFromDate(nextEndDate);
    const parsedEditMonthly = Number(String(editClientData.monthlyEquivalent).replace(',', '.'));
    const monthlyVal =
      Number.isFinite(parsedEditMonthly) && parsedEditMonthly >= 0
        ? parsedEditMonthly
        : selectedSubForDetail.monthlyEquivalent;
    const updatedSub: ClubSubscription = {
      ...selectedSubForDetail,
      status: targetStatus,
      endDate: nextEndDate,
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
              expirationDate: nextEndDate || m.expirationDate,
              validityLabel: nextValidityLabel || m.validityLabel,
            }
          : {
              ...m,
              // Preserva o status individual do dependente quando o titular já permanece ATIVO;
              // se o cadastro mudou entre ATIVO e INATIVO, sincroniza com a alteração solicitada.
              status:
                prevStatus !== targetStatus || targetStatus !== 'ACTIVE'
                  ? targetStatus
                  : m.status,
              validityLabel: m.expirationDate
                ? getValidityLabelFromDate(m.expirationDate, m.validityLabel)
                : nextValidityLabel || m.validityLabel,
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
    const prevLabel = prevStatus === 'ACTIVE' ? 'ATIVO' : 'INATIVO';
    const newLabel = targetStatus === 'ACTIVE' ? 'ATIVO' : 'INATIVO';
    const statusChanged = prevStatus !== targetStatus;
    const nowTime = new Date().toLocaleTimeString('pt-BR');
    const feedbackMsg = statusChanged
      ? `Alteração realizada no cadastro de ${updatedSub.holderName}: situação alterada de ${prevLabel} para ${newLabel}. Expiração: ${formatDateBR(nextEndDate)}.`
      : `Alterações do cadastro de ${updatedSub.holderName} salvas com sucesso (Situação: ${newLabel} • Expiração: ${formatDateBR(nextEndDate)}).`;
    setLastRegistrationChangeBox({
      title: statusChanged
        ? `Alteração no cadastro realizada (${prevLabel} → ${newLabel})`
        : 'Cadastro atualizado com sucesso!',
      detail: feedbackMsg,
      isActive: targetStatus === 'ACTIVE',
      changedAt: nowTime,
    });
    setStatusChangeFeedbackModal({
      title: 'Alteração realizada no cadastro!',
      previousStatusLabel: statusChanged ? prevLabel : undefined,
      newStatusLabel: newLabel,
      subjectName: `${updatedSub.holderName} (Cartão #${updatedSub.subscriptionCode})`,
      expirationDate: nextEndDate,
      detail: feedbackMsg,
      isActive: targetStatus === 'ACTIVE',
    });
    toast({
      title: 'Cadastro do cliente atualizado com sucesso!',
      description: `${updatedSub.holderName} (#${updatedSub.subscriptionCode}) — Status: ${
        targetStatus === 'ACTIVE' ? 'ATIVO (LIBERADO)' : 'INATIVO'
      }`,
    });
  };

  const getSubscriptionPlanBreakdown = (sub: ClubSubscription) => {
    const members = Array.isArray(sub.members) ? sub.members : [];
    const items = members.map((m) => {
      const mod = (state?.modalities || []).find(
        (md) => md.code === m.modalityCode || md.name === m.modalityName
      );
      let monthly = 0;
      if (typeof m.monthlyValue === 'number' && Number.isFinite(m.monthlyValue) && m.monthlyValue >= 0) {
        monthly = m.monthlyValue;
      } else if (mod && !mod.isFreeTier) {
        monthly =
          sub.billingCycle === 'ANNUAL'
            ? Number(mod.annualInstallment ?? mod.monthlyPrice) || 0
            : Number(mod.monthlyPrice) || 0;
      }
      return {
        memberId: m.id,
        role: m.role,
        fullName: m.fullName,
        modalityName: m.modalityName || m.planCycleLabel || 'Plano',
        monthlyValue: Number(monthly.toFixed(2)),
      };
    });
    const sumFromMembers = Number(
      items.reduce((acc, item) => acc + item.monthlyValue, 0).toFixed(2)
    );
    const fallbackTotal =
      typeof sub.monthlyEquivalent === 'number' && Number.isFinite(sub.monthlyEquivalent) && sub.monthlyEquivalent >= 0
        ? Number(sub.monthlyEquivalent.toFixed(2))
        : 0;
    return {
      items,
      total: items.length > 0 ? sumFromMembers : fallbackTotal,
    };
  };

  const getSubscriptionPlanMonthlyTotal = (sub: ClubSubscription): number => {
    return getSubscriptionPlanBreakdown(sub).total;
  };

  const buildSafeMonthlyDueDate = (baseDate: Date, monthOffset: number, preferredDay: number): Date => {
    const candidateMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset, 1, 12, 0, 0);
    const lastDay = new Date(candidateMonth.getFullYear(), candidateMonth.getMonth() + 1, 0).getDate();
    candidateMonth.setDate(Math.min(Math.max(1, preferredDay), lastDay));
    return candidateMonth;
  };

  const handleGenerateNewCarneForClient = async (
    sub: ClubSubscription,
    count = 12,
    customValue?: number,
    firstMonthlyDueDateStr?: string,
    desc = 'Mensalidade',
    mode: 'append' | 'replace' = 'append',
    options?: {
      adhesionDueDateStr?: string;
      recurrenceMode?: 'NONE' | 'REGISTERED_CARD';
      emitInAsaas?: boolean;
    }
  ) => {
    if (!state) return;
    const planCalculatedVal = getSubscriptionPlanMonthlyTotal(sub);
    const monthlyVal =
      typeof customValue === 'number' && Number.isFinite(customValue) && customValue >= 0
        ? Number(customValue.toFixed(2))
        : planCalculatedVal;

    const todayStr = new Date().toISOString().split('T')[0];
    const adhesionDate = new Date(`${options?.adhesionDueDateStr || firstMonthlyDueDateStr || todayStr}T12:00:00`);
    const firstMonthlyDate = new Date(`${firstMonthlyDueDateStr || todayStr}T12:00:00`);
    const existingGroups = (sub.invoices || []).map((i) => Number(i.carneGroup) || 1);
    const nextCarneGroup = existingGroups.length > 0 && mode === 'append' ? Math.max(...existingGroups) + 1 : 1;

    const startIndex = mode === 'append' ? sub.invoices.length : 0;
    const totalInst = count;
    const hasRegisteredCard = Boolean(sub.registeredCard?.last4Digits);
    const useCardRecurrence = options?.recurrenceMode === 'REGISTERED_CARD' && hasRegisteredCard;
    const invPaymentMethod: ClubPaymentMethod = useCardRecurrence
      ? sub.registeredCard?.cardType === 'DEBIT'
        ? 'DEBIT_CARD'
        : 'CREDIT_CARD'
      : sub.paymentMethod;

    const nowIso = new Date().toISOString();
    const newInvoices: ClubInvoice[] = Array.from({ length: count }, (_, idx) => {
      const due =
        idx === 0 && options?.adhesionDueDateStr
          ? adhesionDate
          : buildSafeMonthlyDueDate(
              firstMonthlyDate,
              options?.adhesionDueDateStr ? Math.max(0, idx - 1) : idx,
              firstMonthlyDate.getDate() || sub.dueDay || 10
            );
      const yyyy = due.getFullYear();
      const mm = String(due.getMonth() + 1).padStart(2, '0');
      const dd = String(due.getDate()).padStart(2, '0');
      const installmentNum = idx + 1;
      const isAdhesionFirst = idx === 0 && Boolean(options?.adhesionDueDateStr);
      return {
        id: `inv_${Date.now()}_${startIndex + installmentNum}`,
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
        paymentMethod: invPaymentMethod,
        status: 'PENDING',
        description: isAdhesionFirst ? `${desc} (Adesão / 1ª Parcela)` : desc,
        carneGroup: nextCarneGroup,
        invoiceKind: isAdhesionFirst ? 'ADESAO' : 'MENSALIDADE',
        createdAt: nowIso,
      };
    });

    const finalInvoices =
      mode === 'append' ? [...sub.invoices, ...newInvoices] : newInvoices;
    const updatedSub: ClubSubscription = {
      ...sub,
      monthlyEquivalent: monthlyVal,
      totalContractValue:
        sub.billingCycle === 'ANNUAL'
          ? Number((monthlyVal * 12).toFixed(2))
          : monthlyVal,
      paymentMethod: useCardRecurrence ? invPaymentMethod : sub.paymentMethod,
      invoices: finalInvoices,
      updatedAt: nowIso,
    };
    const nextState: ClubDatabaseState = {
      ...state,
      subscriptions: (state.subscriptions || []).map((s) =>
        s.id === updatedSub.id ? updatedSub : s
      ),
    };
    setSelectedSubForDetail(updatedSub);
    setSelectedCarneNumber(String(nextCarneGroup));
    await persist(nextState);

    if (options?.emitInAsaas && monthlyVal > 0) {
      try {
        const res = await emitCarneMonthlyChargesInAsaas({
          subscriptionId: updatedSub.id,
          invoiceIds: newInvoices.map((i) => i.id),
          billingType: useCardRecurrence ? 'UNDEFINED' : 'UNDEFINED',
          firstDueDate: newInvoices[0]?.dueDate,
          dueDay: firstMonthlyDate.getDate() || sub.dueDay || 10,
          activateCardRecurrence: useCardRecurrence,
          cardLast4: sub.registeredCard?.last4Digits,
        });
        setState(res.state);
        const syncedSub = res.state.subscriptions.find((s) => s.id === updatedSub.id);
        if (syncedSub) {
          setSelectedSubForDetail(syncedSub);
        }
        toast({
          title: `Carnê ${nextCarneGroup} criado e enviado ao Asaas!`,
          description: `${res.generatedCount} cobrança(s) emitida(s) de ${formatCurrency(monthlyVal)}${res.failedCount > 0 ? ` (${res.failedCount} não emitidas: ${res.firstError || 'verifique os dados'})` : ''}.`,
        });
        return syncedSub || updatedSub;
      } catch (err: any) {
        toast({
          title: `Carnê ${nextCarneGroup} salvo localmente`,
          description: `Não foi possível emitir no Asaas agora: ${err?.message || 'verifique o CPF/integração'}. Use "GERAR CARNÊ" depois para emitir no Asaas.`,
          variant: 'destructive',
        });
        return updatedSub;
      }
    }

    toast({
      title: `Carnê ${nextCarneGroup} gerado com sucesso!`,
      description: `${count} parcelas de ${formatCurrency(monthlyVal)} adicionadas para ${sub.holderName}.`,
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
    const prevLabel = sub.status === 'ACTIVE' ? 'ATIVO' : 'INATIVO';
    const newLabel = newStatus === 'ACTIVE' ? 'ATIVO' : 'INATIVO';
    const nextEndDate = editClientData.endDate.trim() || sub.endDate;
    const nextValidity = getValidityLabelFromDate(nextEndDate);

    const updatedSub: ClubSubscription = {
      ...sub,
      status: newStatus,
      endDate: nextEndDate,
      updatedAt: new Date().toISOString(),
      members: sub.members.map((m) => ({
        ...m,
        status: newStatus === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
        validityLabel: m.expirationDate
          ? getValidityLabelFromDate(m.expirationDate, m.validityLabel)
          : nextValidity || m.validityLabel,
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
    const feedbackMsg =
      prevLabel !== newLabel
        ? `Alteração realizada no cadastro de ${sub.holderName}: situação alterada de ${prevLabel} para ${newLabel}. Carteirinhas atualizadas.`
        : `Situação do cadastro confirmada como ${newLabel} para ${sub.holderName}.`;
    setLastRegistrationChangeBox({
      title:
        prevLabel !== newLabel
          ? `Alteração no cadastro realizada (${prevLabel} → ${newLabel})`
          : `Situação confirmada como ${newLabel}`,
      detail: feedbackMsg,
      isActive: newStatus === 'ACTIVE',
      changedAt: new Date().toLocaleTimeString('pt-BR'),
    });
    setStatusChangeFeedbackModal({
      title: 'Alteração realizada no cadastro!',
      previousStatusLabel: prevLabel !== newLabel ? prevLabel : undefined,
      newStatusLabel: newLabel,
      subjectName: `${sub.holderName} (Cartão #${sub.subscriptionCode})`,
      expirationDate: nextEndDate,
      detail: feedbackMsg,
      isActive: newStatus === 'ACTIVE',
    });
    toast({
      title:
        newStatus === 'ACTIVE'
          ? 'Cadastro LIBERADO • Status: ATIVO!'
          : 'Cadastro INATIVADO • Status: INATIVO!',
      description: `Titular: ${sub.holderName} (Carteirinhas atualizadas)`,
    });
  };

  // Ativar / Inativar dependente (ou integrante) individualmente
  const handleToggleMemberStatus = async (
    sub: ClubSubscription,
    memberId: string,
    nextMemberStatus: 'ACTIVE' | 'INACTIVE'
  ) => {
    if (!state) return;
    const targetMember = sub.members.find((m) => m.id === memberId);
    if (!targetMember) return;
    const prevLabel = targetMember.status === 'ACTIVE' ? 'ATIVO' : 'INATIVO';
    const newLabel = nextMemberStatus === 'ACTIVE' ? 'ATIVO' : 'INATIVO';

    const updatedSub: ClubSubscription = {
      ...sub,
      updatedAt: new Date().toISOString(),
      members: sub.members.map((m) =>
        m.id === memberId ? { ...m, status: nextMemberStatus } : m
      ),
    };
    const nextState: ClubDatabaseState = {
      ...state,
      subscriptions: (state.subscriptions || []).map((s) =>
        s.id === updatedSub.id ? updatedSub : s
      ),
    };
    if (selectedSubForDetail?.id === updatedSub.id) {
      setSelectedSubForDetail(updatedSub);
    }
    await persist(nextState);

    const feedbackMsg = `Alteração realizada no dependente ${targetMember.fullName}: situação alterada individualmente de ${prevLabel} para ${newLabel}.`;
    setStatusChangeFeedbackModal({
      title: 'Alteração individual de dependente realizada!',
      previousStatusLabel: prevLabel !== newLabel ? prevLabel : undefined,
      newStatusLabel: newLabel,
      subjectName: `${targetMember.fullName} (Cartão #${targetMember.cardNumber})`,
      expirationDate: targetMember.expirationDate || sub.endDate,
      detail: feedbackMsg,
      isActive: nextMemberStatus === 'ACTIVE',
    });
    toast({
      title: `${targetMember.fullName} marcado como ${newLabel}!`,
      description: `Status individual do dependente atualizado no cadastro de ${sub.holderName}.`,
    });
  };

  // Salvar data de expiração individual de qualquer cadastro / dependente
  const handleUpdateMemberExpirationDate = async (
    sub: ClubSubscription,
    memberId: string,
    newExpDate: string
  ) => {
    if (!state) return;
    const targetMember = sub.members.find((m) => m.id === memberId);
    if (!targetMember) return;
    const cleanedDate = newExpDate.trim() || undefined;
    const nextValidity = getValidityLabelFromDate(
      cleanedDate || sub.endDate,
      targetMember.validityLabel
    );

    const updatedSub: ClubSubscription = {
      ...sub,
      updatedAt: new Date().toISOString(),
      members: sub.members.map((m) =>
        m.id === memberId
          ? {
              ...m,
              expirationDate: cleanedDate,
              validityLabel: nextValidity,
            }
          : m
      ),
    };
    const nextState: ClubDatabaseState = {
      ...state,
      subscriptions: (state.subscriptions || []).map((s) =>
        s.id === updatedSub.id ? updatedSub : s
      ),
    };
    if (selectedSubForDetail?.id === updatedSub.id) {
      setSelectedSubForDetail(updatedSub);
      setDepExpDrafts((prev) => ({
        ...prev,
        [memberId]: cleanedDate || '',
      }));
    }
    await persist(nextState);

    toast({
      title: cleanedDate
        ? `Expiração atualizada para ${targetMember.fullName}!`
        : `Data de expiração individual removida para ${targetMember.fullName}.`,
      description: cleanedDate
        ? `Nova data de expiração: ${formatDateBR(cleanedDate)}`
        : `Passa a seguir o vencimento geral do titular (${formatDateBR(sub.endDate)}).`,
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
    const printed = printDocumentHtml(`Contrato Lessa Club - ${sub.holderName}`, html);
    if (!printed) {
      toast({
        title: 'Não foi possível abrir a impressão',
        description: 'Verifique se o navegador bloqueou a janela de impressão.',
        variant: 'destructive',
      });
    }
  };

  // Print Complete Terms of Use + Full Signed Contract + Legal Electronic Signature Declaration
  const handlePrintCompleteTermsAndContract = (sub: ClubSubscription) => {
    if (!state) return;
    const termsHtml = renderSiteTermsHtml(sub, state.contractTemplates, siteTermsText);
    const contractHtml = renderSubscriptionContractHtml(sub, state.contractTemplates);
    const signedAtStr = new Date(sub.contractSignedAt || sub.createdAt).toLocaleString('pt-BR');

    const fullBodyHtml = `
      <h2 style="color:#005200; border-bottom:2px solid #005200; padding-bottom:8px; font-size:18px; margin-top:0;">
        BALNEÁRIO FAMÍLIA LESSA LTDA — TERMOS DE USO COMPLETOS E CONTRATO DE ADESÃO
      </h2>
      <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:14px; border-radius:8px; margin-bottom:16px; font-size:12px;">
        <strong>CNPJ:</strong> 46.891.134/0001-40 • <strong>Endereço:</strong> Via Araras, Setor 09, Ariquemes/RO • <strong>WhatsApp:</strong> (69) 99262-6140<br />
        <strong>Associado Titular:</strong> ${sub.holderName} • <strong>CPF:</strong> ${sub.holderCpf} • <strong>Telefone:</strong> ${sub.holderPhone || '—'} • <strong>Cartão:</strong> #${sub.subscriptionCode}<br />
        <strong>Plano Contratado:</strong> ${sub.planSummaryLabel} • <strong>Data da Adesão:</strong> ${formatDateBR(sub.startDate)} • <strong>Status do Aceite:</strong> ${sub.contractAccepted ? `ACEITO E ASSINADO ELETRONICAMENTE EM ${signedAtStr}` : 'PENDENTE DE ASSINATURA DIGITAL'}
      </div>
      <div style="background:#ecfdf5; border:1.5px solid #86efac; padding:14px; border-radius:8px; margin-bottom:20px; font-size:12px; color:#065f46; line-height:1.6;">
        <strong>VALIDADE JURÍDICA DO ACEITE ELETRÔNICO E ASSINATURA DIGITAL (MP Nº 2.200-2/2001, ART. 10, § 2º • LEI Nº 14.063/2020 • CÓDIGO CIVIL ARTS. 104, 107, 219 E 422):</strong><br />
        O aceite digital destes Termos de Uso e do Contrato de Adesão, validado eletronicamente pelo próprio usuário titular com seus dados cadastrais e registro de data/hora e protocolo em servidor, constitui <strong>assinatura eletrônica legalmente válida, autêntica e vinculante, com a exata mesma validade jurídica e força probatória de uma assinatura presencial de próprio punho</strong>.
      </div>
      <h3 style="color:#005200; margin-top:8px; margin-bottom:12px; font-size:14px; text-transform:uppercase; border-bottom:1px solid #bbf7d0; padding-bottom:4px;">
        PARTE I — REGULAMENTO INTERNO E TERMOS DE USO COMPLETOS (TODAS AS CLÁUSULAS)
      </h3>
      <div>${termsHtml}</div>
      <div class="page-break">
        <h3 style="color:#005200; margin-top:0; margin-bottom:12px; font-size:14px; text-transform:uppercase; border-bottom:1px solid #bbf7d0; padding-bottom:4px;">
          PARTE II — CONTRATO OFICIAL DE ADESÃO COMPLETO DO ASSOCIADO
        </h3>
        ${contractHtml}
      </div>
    `;

    const printed = printDocumentHtml(
      `Termos Completos e Contrato Lessa Club - ${sub.holderName}`,
      fullBodyHtml
    );
    if (!printed) {
      toast({
        title: 'Não foi possível abrir a impressão',
        description: 'Verifique se o navegador bloqueou a janela de impressão.',
        variant: 'destructive',
      });
    }
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
      {isSyncing && (
        <div className="flex items-center justify-end text-[11px] font-bold text-emerald-800 px-1">
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Sincronizando dados em segundo plano...
          </span>
        </div>
      )}
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
              onClick={handleRefreshDashboard}
              className="flex items-center gap-2 cursor-pointer py-1"
              title="Ir para o Dashboard e Atualizar"
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
                onClick={handleRefreshDashboard}
                onMouseEnter={() => {
                  setOpenMenu(null);
                  setOpenSubMenu(null);
                }}
                className={`w-full flex flex-col items-center justify-center px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-colors ${
                  activeTab === 'dashboard'
                    ? 'bg-black/25 text-white'
                    : 'hover:bg-white/10 text-white'
                }`}
                title="Dashboard (Clique para Atualizar)"
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

                  {/* Submenus: Inativos, Pendentes p/ Transferência, Pendentes, Cancelados, Via site */}
                  {[
                    { label: 'Inativos', status: 'INACTIVE', origin: 'ALL' as const },
                    {
                      label: 'Pendentes p/ Transferência',
                      status: 'PENDING_TRANSFER',
                      origin: 'ALL' as const,
                    },
                    { label: 'Pendentes', status: 'PENDING', origin: 'ALL' as const },
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
                    <button
                      type="button"
                      onMouseEnter={() => setOpenSubMenu(null)}
                      onClick={() => {
                        setOpenMenu(null);
                        setOpenSubMenu(null);
                        handleOpenAsaasSyncModal();
                      }}
                      className="w-full px-4 py-2 mt-1 text-left bg-amber-400 hover:bg-amber-300 flex items-center gap-2 text-emerald-950 font-black"
                    >
                      <RefreshCw className="w-4 h-4 shrink-0" />
                      <span>Sincronizar Asaas</span>
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
                  <div className="border-t border-white/20 mt-1 pt-1 px-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenu(null);
                        handleOpenAsaasSyncModal();
                      }}
                      className="w-full px-3 py-2 rounded-lg text-left bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black flex items-center gap-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                      <span>Sincronizar Asaas (Mensalidades)</span>
                    </button>
                  </div>
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
                        : subscription.status === 'PENDING_TRANSFER'
                        ? 'border-amber-400 bg-amber-50/60'
                        : 'border-rose-400 bg-rose-50/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge
                          className={
                            subscription.status === 'ACTIVE'
                              ? 'bg-emerald-600 text-white text-[10px]'
                              : subscription.status === 'PENDING_TRANSFER'
                              ? 'bg-amber-600 text-white text-[10px]'
                              : 'bg-rose-600 text-white text-[10px]'
                          }
                        >
                          {subscription.status === 'ACTIVE'
                            ? 'ATIVO • LIBERADO'
                            : subscription.status === 'PENDING_TRANSFER'
                            ? 'PENDENTE P/ TRANSFERÊNCIA'
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Button
                type="button"
                onClick={handleOpenAsaasSyncModal}
                className="h-14 justify-start bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black rounded-2xl px-4 shadow-sm cursor-pointer"
              >
                <RefreshCw className="w-5 h-5 mr-3 shrink-0" />
                <div className="text-left">
                  <div className="text-sm">Sincronizar Asaas</div>
                  <div className="text-[10px] text-emerald-900 font-bold">
                    Pré-visualizar e importar parcelas
                  </div>
                </div>
              </Button>
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
            Cadastrados | Ativos | Inativos | Pendentes p/ Transferência | Pendentes |
            Cancelados | Via site
        ===================================================================== */}
        <TabsContent value="associados" className="space-y-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {personFilter === 'PJ'
                    ? `Empresas Conveniadas / Corporativas PJ (${filteredSubscriptions.length})`
                    : `Clientes - Cadastrados`}
                  {originFilter === 'SITE' && ' — Via Site'}
                  {originFilter === 'IMPORT_LABCARD' && ' — Base Labcard'}
                </h3>
                <p className="text-xs text-slate-500">
                  Listagem exclusiva de Titulares. Os dependentes ficam dentro do cadastro de cada titular ou podem ser localizados pesquisando por Nome, CPF ou Nº da Carteirinha.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={handleOpenAsaasSyncModal}
                  className="border-emerald-700 text-emerald-900 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-950 font-bold w-full sm:w-auto cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 mr-1.5" /> Sincronizar Asaas
                </Button>
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
              <button
                type="button"
                onClick={() => setPersonFilter('ALL')}
                className={`h-7 px-3 rounded-md text-xs font-bold transition-colors ${
                  personFilter === 'ALL'
                    ? 'bg-[#004d00] text-white hover:bg-[#003800] shadow-sm'
                    : 'text-slate-700 bg-transparent hover:bg-slate-200 hover:text-slate-900 border border-transparent'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setPersonFilter('PF')}
                className={`h-7 px-3 rounded-md text-xs font-bold transition-colors ${
                  personFilter === 'PF'
                    ? 'bg-[#004d00] text-white hover:bg-[#003800] shadow-sm'
                    : 'text-slate-700 bg-transparent hover:bg-slate-200 hover:text-slate-900 border border-transparent'
                }`}
              >
                PF (Pessoa Física)
              </button>
              <button
                type="button"
                onClick={() => setPersonFilter('PJ')}
                className={`h-7 px-3 rounded-md text-xs font-bold transition-colors ${
                  personFilter === 'PJ'
                    ? 'bg-[#004d00] text-white hover:bg-[#003800] shadow-sm'
                    : 'text-slate-700 bg-transparent hover:bg-slate-200 hover:text-slate-900 border border-transparent'
                }`}
              >
                PJ (Empresas)
              </button>
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
                    { id: 'PENDING_TRANSFER', label: 'Pendentes p/ Transferência' },
                    { id: 'PENDING', label: 'Pendentes' },
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
                <Button
                  size="sm"
                  variant={originFilter === 'IMPORT_LABCARD' ? 'default' : 'outline'}
                  onClick={() => {
                    setOriginFilter(
                      originFilter === 'IMPORT_LABCARD' ? 'ALL' : 'IMPORT_LABCARD'
                    );
                    setSubStatusFilter('ALL');
                  }}
                  className={`shrink-0 whitespace-nowrap text-xs ${
                    originFilter === 'IMPORT_LABCARD'
                      ? 'bg-amber-700 text-white font-bold'
                      : ''
                  }`}
                >
                  🏷️ Base Labcard (2.657 sócios)
                </Button>
              </div>
            </div>

            {unseenClubCount > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-rose-50 border border-rose-200/80 rounded-2xl px-4 py-2.5 shadow-sm mb-4">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                  </span>
                  <span className="text-xs font-bold text-rose-950">
                    {unseenClubCount} {unseenClubCount === 1 ? 'novo associado cadastrado não visualizado' : 'novos associados cadastrados não visualizados'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const allIds = (state?.subscriptions || []).map((s) => s.id);
                    markAllClubSubsAsSeen(allIds);
                    toast({ title: "Todos os associados foram marcados como vistos!" });
                  }}
                  className="text-xs font-black text-rose-700 hover:text-rose-900 underline self-end sm:self-auto transition-colors"
                >
                  Zerar notificações (Marcar todos como vistos)
                </button>
              </div>
            )}

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
                        Opções do Cadastro
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {paginatedSubscriptions.map((sub, idx) => {
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
                            <div className="font-black text-slate-900 hover:text-emerald-800 uppercase flex items-center gap-2">
                              <span>{sub.holderName}</span>
                              {!seenClubSubIds.has(sub.id) && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-600 text-white uppercase tracking-wider animate-pulse">
                                  Novo
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {sub.planSummaryLabel} •{' '}
                              {sub.billingCycle === 'ANNUAL' ? 'Anual' : 'Mensal'} (
                              {formatCurrency(sub.monthlyEquivalent)}/mês)
                            </div>
                            <div className="text-[10px] text-emerald-800 font-bold flex items-center gap-1 mt-0.5">
                              <span>Data do Cadastro:</span>
                              <span className="font-semibold text-slate-800">
                                {formatDateBR(sub.createdAt || sub.startDate)}
                              </span>
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
                              className={`inline-block px-2.5 py-0.5 rounded font-black text-[11px] whitespace-nowrap ${
                                sub.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 lowercase'
                                  : sub.status === 'PENDING_TRANSFER'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                  : sub.status === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300 lowercase'
                                  : 'bg-rose-100 text-rose-800 border border-rose-300 lowercase'
                              }`}
                            >
                              {sub.status === 'ACTIVE'
                                ? 'ativo'
                                : sub.status === 'PENDING_TRANSFER'
                                ? 'pendente para transferência'
                                : sub.status === 'PENDING'
                                ? 'pendente'
                                : 'inativo'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setClientDetailTool('DADOS_CADASTRAIS');
                                  setSelectedSubForDetail(sub);
                                }}
                                className="h-8 bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs px-3 shadow-sm"
                              >
                                <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Ver Cadastro
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Controles de Paginação */}
            {totalClients > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 px-2 text-xs text-slate-600 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span>Exibir por página:</span>
                  <select
                    value={clientPageSize}
                    onChange={(e) => {
                      const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                      setClientPageSize(val as any);
                      setClientPage(1);
                    }}
                    className="h-8 border border-slate-300 rounded-lg px-2 bg-white text-slate-800 font-bold focus:ring-2 focus:ring-emerald-500 text-xs"
                  >
                    <option value={25}>25 sócios</option>
                    <option value={50}>50 sócios</option>
                    <option value={100}>100 sócios</option>
                    <option value={200}>200 sócios</option>
                    <option value="ALL">Mostrar Todos ({totalClients})</option>
                  </select>
                  <span className="text-slate-500 ml-1">
                    Mostrando {clientPageSize === 'ALL' ? 1 : Math.min((clientPage - 1) * clientPageSize + 1, totalClients)} a{' '}
                    {clientPageSize === 'ALL' ? totalClients : Math.min(clientPage * clientPageSize, totalClients)} de{' '}
                    <strong className="text-slate-900 font-black">{totalClients}</strong> associados
                  </span>
                </div>

                {clientPageSize !== 'ALL' && totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={clientPage <= 1}
                      onClick={() => setClientPage(1)}
                      className="h-8 px-2 text-xs font-bold"
                      title="Primeira Página"
                    >
                      ««
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={clientPage <= 1}
                      onClick={() => setClientPage((p) => Math.max(1, p - 1))}
                      className="h-8 px-2.5 text-xs font-bold"
                    >
                      Anterior
                    </Button>
                    <span className="px-3 py-1 font-bold text-slate-700 bg-slate-100 rounded-lg">
                      Página {clientPage} de {totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={clientPage >= totalPages}
                      onClick={() => setClientPage((p) => Math.min(totalPages, p + 1))}
                      className="h-8 px-2.5 text-xs font-bold"
                    >
                      Próxima
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={clientPage >= totalPages}
                      onClick={() => setClientPage(totalPages)}
                      className="h-8 px-2 text-xs font-bold"
                      title="Última Página"
                    >
                      »»
                    </Button>
                  </div>
                )}
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

                <a
                  href="/consultor"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-emerald-700 text-emerald-900 hover:bg-emerald-50 hover:text-emerald-950 font-bold text-xs h-9"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> Portal do Consultor
                  </Button>
                </a>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const opening = !showNewConsultantForm;
                    if (opening && state) {
                      setNewConsRole(
                        consultantRoleFilter === 'INFLUENCER' ? 'INFLUENCER' : 'CONSULTOR'
                      );
                      setNewConsAllowedPlans(
                        getSelectablePlansForConsultants(state.modalities).map((p) => p.code)
                      );
                    }
                    setShowNewConsultantForm(opening);
                  }}
                  className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs h-9"
                >
                  <Plus className="w-4 h-4 mr-1" /> Novo Consultor / Influencer
                </Button>
              </div>
            </div>

            {/* FORMULÁRIO DE CADASTRO COMPLETO COM LOGIN, SENHA, LINK PERSONALIZADO E SELEÇÃO DE PLANOS */}
            {showNewConsultantForm && (
              <form
                onSubmit={handleCreateConsultant}
                className="bg-emerald-50/80 border border-emerald-300 rounded-2xl p-5 space-y-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-2">
                  <h4 className="font-black text-sm text-emerald-950 uppercase tracking-wide">
                    Cadastrar Novo Consultor de Vendas / Influencer
                  </h4>
                  <Badge className="bg-emerald-800 text-white text-xs">
                    Link Personalizado + Acesso ao Portal (E-mail e Senha)
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
                      onChange={(e) => setNewConsCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      className="bg-white mt-1 h-9"
                      required
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="text-xs font-bold">Telefone / WhatsApp *</Label>
                    <Input
                      value={newConsPhone}
                      onChange={(e) => setNewConsPhone(formatPhone(e.target.value))}
                      placeholder="(69) 99999-9999"
                      className="bg-white mt-1 h-9"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-bold">Papel</Label>
                    <select
                      value={newConsRole}
                      onChange={(e) => setNewConsRole(e.target.value as 'CONSULTOR' | 'INFLUENCER')}
                      className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs font-bold bg-white mt-1"
                    >
                      <option value="CONSULTOR">Consultor</option>
                      <option value="INFLUENCER">Influencer</option>
                    </select>
                  </div>

                  {/* CREDENCIAIS DE ACESSO AO PORTAL + CÓDIGO PERSONALIZADO */}
                  <div className="sm:col-span-4">
                    <Label className="text-xs font-bold">E-mail de Acesso (Portal) *</Label>
                    <Input
                      type="email"
                      value={newConsEmail}
                      onChange={(e) => setNewConsEmail(e.target.value)}
                      placeholder="vendedor@email.com"
                      className="bg-white mt-1 h-9"
                      required
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <Label className="text-xs font-bold">Senha de Acesso (Portal) *</Label>
                    <div className="relative mt-1">
                      <Input
                        type={showNewConsPassword ? 'text' : 'password'}
                        value={newConsPassword}
                        onChange={(e) => setNewConsPassword(e.target.value)}
                        placeholder="Crie a senha do consultor"
                        className="bg-white h-9 pr-9"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewConsPassword((p) => !p)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
                      >
                        {showNewConsPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-4">
                    <Label className="text-xs font-bold">Código Personalizado no Link</Label>
                    <Input
                      value={newConsCode}
                      onChange={(e) =>
                        setNewConsCode(
                          e.target.value
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .toUpperCase()
                            .replace(/[^A-Z0-9_-]/g, '')
                        )
                      }
                      placeholder={
                        newConsName.trim()
                          ? `Ex: ${getConsultantSlug(newConsName.split(' ')[0]).toUpperCase()}`
                          : 'Automático pelo nome'
                      }
                      className="bg-white mt-1 h-9 font-mono uppercase"
                    />
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
                    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-800">
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

                  {/* FORMAS DE VENDAS AUTORIZADAS */}
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

                  {/* PAINEL DE SELEÇÃO DE PLANOS EXISTENTES PARA O LINK DO CONSULTOR */}
                  {(() => {
                    const selectablePlans = getSelectablePlansForConsultants(state.modalities);
                    return (
                      <div className="sm:col-span-12 pt-3 border-t border-emerald-200 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <Label className="text-xs font-black text-emerald-950 uppercase block">
                              Planos Visíveis no Link Personalizado ({newConsAllowedPlans.length}/{selectablePlans.length})
                            </Label>
                            <span className="text-[11px] font-medium text-emerald-800">
                              Selecione quais planos existentes devem aparecer quando o cliente acessar o link deste consultor.
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setNewConsAllowedPlans(selectablePlans.map((p) => p.code))
                              }
                              className="h-7 text-[11px] font-bold bg-white border-emerald-600 text-emerald-900 hover:bg-emerald-100"
                            >
                              Selecionar Todos
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setNewConsAllowedPlans([])}
                              className="h-7 text-[11px] font-bold bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                            >
                              Limpar Seleção
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                          {selectablePlans.map((plan) => {
                            const checked = newConsAllowedPlans.includes(plan.code);
                            return (
                              <label
                                key={plan.code}
                                className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                  checked
                                    ? 'bg-white border-emerald-600 shadow-sm ring-1 ring-emerald-500/30'
                                    : 'bg-white/60 border-slate-200 opacity-75 hover:opacity-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setNewConsAllowedPlans((prev) =>
                                        prev.includes(plan.code) ? prev : [...prev, plan.code]
                                      );
                                    } else {
                                      setNewConsAllowedPlans((prev) =>
                                        prev.filter((c) => c !== plan.code)
                                      );
                                    }
                                  }}
                                  className="w-4 h-4 mt-0.5 rounded text-emerald-700 shrink-0"
                                />
                                <div className="min-w-0">
                                  <span className="font-black text-xs text-slate-900 block truncate">
                                    {plan.name}
                                  </span>
                                  <span className="text-[10px] font-semibold text-emerald-800 block">
                                    {plan.isFreeTier
                                      ? 'Gratuito (R$ 0,00)'
                                      : `Mensal ${formatCurrency(plan.monthlyPrice)} • Anual ${formatCurrency(plan.annualPrice)}`}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-emerald-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewConsultantForm(false)}
                    className="h-9 text-xs bg-white text-slate-800 hover:bg-slate-100"
                    disabled={isSavingConsultant}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSavingConsultant}
                    className="bg-[#004d00] hover:bg-emerald-900 text-white font-black text-xs h-9 px-5"
                  >
                    {isSavingConsultant ? 'Salvando...' : 'Salvar e Ativar Vendedor'}
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
                  const metrics = getConsultantSubscriptionMetrics(
                    cons,
                    state.subscriptions || []
                  );
                  const leadsCount = metrics.linkedSubs.length;
                  const paidCount = metrics.paidCount;
                  const totalPaidCommission = metrics.totalPaidCommission;
                  const selectablePlans = getSelectablePlansForConsultants(state.modalities);
                  const allowedList =
                    cons.allowedPlanCodes && cons.allowedPlanCodes.length > 0
                      ? selectablePlans.filter((p) =>
                          doesConsultantAllowModality(cons.allowedPlanCodes, p)
                        )
                      : selectablePlans;
                  const personalizedPreview = buildConsultantReferralUrl(
                    window.location.origin,
                    cons
                  );

                  const commissionText =
                    cons.commissionType === 'FIXED'
                      ? `R$ ${(cons.commissionValue || 0).toFixed(2)} por venda paga`
                      : `${cons.commissionPercent || cons.commissionValue || 10}% sobre vendas pagas`;

                  return (
                    <div
                      key={cons.id}
                      className="rounded-2xl border border-slate-200 p-4 bg-slate-50 flex flex-col justify-between gap-3 shadow-sm hover:border-emerald-300 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
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
                            Código de Indicação:{' '}
                            <strong className="font-mono text-emerald-800">
                              {cons.referralCode}
                            </strong>{' '}
                            • Planos no Link:{' '}
                            <strong className="text-slate-900">
                              {cons.allowedPlanCodes && cons.allowedPlanCodes.length > 0
                                ? `${allowedList.length}/${selectablePlans.length}`
                                : `Todos (${selectablePlans.length})`}
                            </strong>
                          </p>
                          <p>
                            Tel: <strong>{cons.phone || '—'}</strong> • CPF: {cons.cpf}
                          </p>
                          <p>
                            Login Portal:{' '}
                            <strong className="text-slate-900">
                              {cons.email || cons.cpf || '—'}
                            </strong>{' '}
                            • Senha:{' '}
                            <strong className="font-mono text-slate-800">
                              {cons.password || cleanDigits(cons.cpf) || '123456'}
                            </strong>
                          </p>
                          <p className="truncate text-[11px] text-emerald-900 bg-emerald-100/60 px-2 py-1 rounded border border-emerald-200 font-mono">
                            {personalizedPreview}
                          </p>
                          <p>
                            Comissão Configurada:{' '}
                            <strong className="text-emerald-900">{commissionText}</strong>
                            {cons.commissionRecurring && ' (Recorrente)'}
                          </p>
                          <div className="mt-2.5 pt-2 border-t border-slate-200 grid grid-cols-2 gap-1.5 text-[11px]">
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-slate-500 block">Acessos Link / QR:</span>
                              <strong className="text-slate-900 text-xs">
                                {cons.clicksCount || 0} acessos
                              </strong>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-slate-500 block">Pessoas Aderiram:</span>
                              <strong className="text-slate-900 text-xs">
                                {leadsCount} cadastros
                              </strong>
                            </div>
                            <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                              <span className="text-emerald-800 block">Vendas Pagas:</span>
                              <strong className="text-emerald-950 text-xs">
                                {paidCount} confirmadas
                              </strong>
                            </div>
                            <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                              <span className="text-emerald-800 block">Comissão Efetiva:</span>
                              <strong className="text-emerald-900 text-xs">
                                {formatCurrency(totalPaidCommission)}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setLinkPlanSelection('TODOS');
                              setLinkAllowedMethods(
                                cons.paymentMethodsAllowed || {
                                  boleto: true,
                                  pix: true,
                                  creditCard: true,
                                  recurrence: true,
                                }
                              );
                              setSelectedConsultantForLink(cons);
                            }}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-8"
                          >
                            <QrCode className="w-3.5 h-3.5 mr-1" /> Link & QR Code
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const currentAllowed = selectablePlans
                                .filter((p) => doesConsultantAllowModality(cons.allowedPlanCodes, p))
                                .map((p) => p.code);
                              setSelectedConsultantForPlans(cons);
                              setDraftAllowedPlans(
                                cons.allowedPlanCodes && cons.allowedPlanCodes.length > 0
                                  ? currentAllowed
                                  : selectablePlans.map((p) => p.code)
                              );
                            }}
                            className="bg-white border-slate-300 text-slate-800 hover:bg-slate-100 hover:text-slate-900 font-bold text-xs h-8"
                            title="Selecionar quais planos devem aparecer para este vendedor"
                          >
                            <Settings className="w-3.5 h-3.5 mr-1 text-slate-600" /> Planos
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedConsultantForAccounting(cons)}
                            className="bg-white border-emerald-600 text-emerald-900 hover:bg-emerald-50 hover:text-emerald-950 font-bold text-xs h-8"
                            title="Ver Vendas Pagas e Comissões"
                          >
                            <DollarSign className="w-3.5 h-3.5 mr-1 text-emerald-700" /> Contab. ({paidCount})
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingConsultant({ ...cons })}
                            className="bg-white border-slate-300 text-slate-800 hover:bg-slate-100 hover:text-slate-900 font-bold text-xs h-8"
                            title="Editar cadastro, e-mail e senha de acesso"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1 text-slate-600" /> Editar
                          </Button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleConsultantStatus(cons.id)}
                            className="bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-900 text-xs h-8"
                          >
                            {cons.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
                          </Button>
                          <Button
                            type="button"
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
              MODAL GERAR LINK PERSONALIZADO + QR CODE + ACESSO AO PORTAL
          ===================================================================== */}
          <Dialog
            open={!!selectedConsultantForLink}
            onOpenChange={(open) => !open && setSelectedConsultantForLink(null)}
          >
            <DialogContent className="max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              {selectedConsultantForLink && (() => {
                const baseUrl = window.location.origin;
                const fullReferralLink = buildConsultantReferralUrl(
                  baseUrl,
                  selectedConsultantForLink,
                  linkPlanSelection
                );
                const qrUrl = getQrCodeImageUrl(fullReferralLink, 280);
                const permittedModalities = (state.modalities || []).filter(
                  (m) =>
                    m.active !== false &&
                    doesConsultantAllowModality(selectedConsultantForLink.allowedPlanCodes, m)
                );
                const portalUrl = `${baseUrl}/consultor`;
                const consPass =
                  selectedConsultantForLink.password ||
                  cleanDigits(selectedConsultantForLink.cpf) ||
                  '123456';

                return (
                  <div className="space-y-4">
                    <DialogHeader>
                      <DialogTitle className="text-base font-black text-slate-900 uppercase">
                        LINK PERSONALIZADO & QR CODE DE VENDAS
                      </DialogTitle>
                      <p className="text-xs text-slate-600">
                        {selectedConsultantForLink.role === 'INFLUENCER' ? 'Influencer' : 'Consultor'}:{' '}
                        <strong className="text-emerald-900">{selectedConsultantForLink.name}</strong>{' '}
                        • Código: <strong className="font-mono">{selectedConsultantForLink.referralCode}</strong>
                      </p>
                    </DialogHeader>

                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <Label className="text-xs font-bold text-slate-700">
                          Direcionar para Plano Específico ({permittedModalities.length} liberado(s)):
                        </Label>
                        <select
                          value={linkPlanSelection}
                          onChange={(e) => setLinkPlanSelection(e.target.value)}
                          className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs font-bold bg-white mt-1"
                        >
                          <option value="TODOS">
                            Todos os Planos Liberados para este Vendedor ({permittedModalities.length})
                          </option>
                          {permittedModalities.map((m) => (
                            <option key={m.code} value={m.code}>
                              {m.name} — Mensal: {formatCurrency(m.monthlyPrice)} / Anual: {formatCurrency(m.annualPrice)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label className="text-xs font-bold text-slate-700 mb-1 block">
                          Formas de Vendas Configuradas:
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
                        <Label className="text-xs font-bold text-emerald-950">
                          Link Único Personalizado com Identificação do Consultor:
                        </Label>
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
                                description: 'O link personalizado do consultor foi copiado.',
                              });
                            }}
                            className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs h-9 px-3 shrink-0"
                          >
                            <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                          </Button>
                          <a
                            href={fullReferralLink}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button
                              type="button"
                              variant="outline"
                              className="bg-white border-emerald-600 text-emerald-900 hover:bg-emerald-100 font-bold text-xs h-9 px-3 shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir
                            </Button>
                          </a>
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
                            Ao abrir o link ou QR Code, o cliente verá o banner oficial confirmando o atendimento de{' '}
                            <strong>{selectedConsultantForLink.name}</strong> e apenas os planos liberados para ele.
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
                              className="bg-white text-xs font-bold border-emerald-600 text-emerald-900 hover:bg-emerald-100 h-8 mt-1"
                            >
                              Baixar Imagem QR Code
                            </Button>
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* CREDENCIAIS DO PORTAL DO CONSULTOR */}
                    <div className="p-3.5 bg-slate-900 text-white rounded-xl text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-amber-300 uppercase text-[11px]">
                          Acesso ao Portal do Consultor
                        </strong>
                        <a
                          href={portalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-300 hover:underline font-bold"
                        >
                          {portalUrl}
                        </a>
                      </div>
                      <p className="text-slate-300">
                        Usuário: <strong className="text-white">{selectedConsultantForLink.email || selectedConsultantForLink.cpf}</strong>{' '}
                        • Senha: <strong className="font-mono text-white">{consPass}</strong>
                      </p>
                    </div>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>

          {/* =====================================================================
              MODAL PERMISSÃO DE PLANOS (TODOS OS PLANOS EXISTENTES NO SISTEMA)
          ===================================================================== */}
          <Dialog
            open={!!selectedConsultantForPlans}
            onOpenChange={(open) => !open && setSelectedConsultantForPlans(null)}
          >
            <DialogContent className="max-w-4xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              {selectedConsultantForPlans && (() => {
                const selectablePlans = getSelectablePlansForConsultants(state?.modalities);
                const permittedPlans = selectablePlans.filter((p) =>
                  draftAllowedPlans.includes(p.code)
                );
                const unpermittedPlans = selectablePlans.filter(
                  (p) => !draftAllowedPlans.includes(p.code)
                );

                return (
                  <div className="space-y-4">
                    <DialogHeader className="border-b pb-2">
                      <DialogTitle className="text-lg font-black text-slate-900 uppercase flex items-center gap-2">
                        <span>PERMISSÃO DE PLANOS NO LINK DO CONSULTOR</span>
                        <ChevronDown className="w-5 h-5 text-slate-500" />
                      </DialogTitle>
                      <p className="text-xs text-slate-600">
                        Escolha exatamente quais planos cadastrados no sistema devem aparecer no link e QR Code de{' '}
                        <strong className="text-emerald-900">{selectedConsultantForPlans.name}</strong>{' '}
                        (Código: {selectedConsultantForPlans.referralCode})
                      </p>
                    </DialogHeader>

                    <div className="flex items-center justify-between py-1">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setDraftAllowedPlans([])}
                        className="bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase px-4 h-8 rounded"
                      >
                        REMOVER TODOS
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          setDraftAllowedPlans(selectablePlans.map((p) => p.code))
                        }
                        className="bg-[#008000] hover:bg-emerald-700 text-white font-black text-xs uppercase px-4 h-8 rounded"
                      >
                        ADD TODOS ({selectablePlans.length})
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Coluna 1: PLANOS PERMITIDOS */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
                          <span className="font-black text-xs uppercase tracking-wide text-slate-800">
                            PLANOS PERMITIDOS NO LINK ({permittedPlans.length})
                          </span>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                                <th className="py-2 px-3">Plano</th>
                                <th className="py-2 px-3 text-right">Ação</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {permittedPlans.map((p) => (
                                <tr key={p.code} className="hover:bg-slate-50">
                                  <td className="py-2 px-3 font-semibold text-slate-800">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] text-emerald-600">▶</span>
                                      <span>{p.name}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 block pl-4">
                                      {p.isFreeTier
                                        ? 'Gratuito'
                                        : `Mensal ${formatCurrency(p.monthlyPrice)} • Anual ${formatCurrency(p.annualPrice)}`}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDraftAllowedPlans((prev) =>
                                          prev.filter((c) => c !== p.code)
                                        )
                                      }
                                      className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-3 py-1 rounded"
                                    >
                                      Remover
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {permittedPlans.length === 0 && (
                                <tr>
                                  <td
                                    colSpan={2}
                                    className="py-8 text-center text-slate-400 text-xs italic"
                                  >
                                    Nenhum plano selecionado. Clique em "Add" ao lado ou "ADD TODOS".
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Coluna 2: TODOS OS PLANOS / DISPONÍVEIS */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
                          <span className="font-black text-xs uppercase tracking-wide text-slate-800">
                            TODOS OS PLANOS EXISTENTES ({unpermittedPlans.length} disponíveis)
                          </span>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                                <th className="py-2 px-3">Plano</th>
                                <th className="py-2 px-3 text-right">Ação</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {unpermittedPlans.map((p) => (
                                <tr key={p.code} className="hover:bg-slate-50">
                                  <td className="py-2 px-3 font-semibold text-slate-800">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] text-slate-400">▶</span>
                                      <span>{p.name}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 block pl-4">
                                      {p.isFreeTier
                                        ? 'Gratuito'
                                        : `Mensal ${formatCurrency(p.monthlyPrice)} • Anual ${formatCurrency(p.annualPrice)}`}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDraftAllowedPlans((prev) =>
                                          prev.includes(p.code) ? prev : [...prev, p.code]
                                        )
                                      }
                                      className="bg-[#008000] hover:bg-emerald-700 text-white text-[11px] font-bold px-3.5 py-1 rounded"
                                    >
                                      Add
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {unpermittedPlans.length === 0 && (
                                <tr>
                                  <td
                                    colSpan={2}
                                    className="py-8 text-center text-emerald-700 font-bold text-xs"
                                  >
                                    ✓ Todos os planos já estão liberados para este vendedor!
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <DialogFooter className="pt-2 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSelectedConsultantForPlans(null)}
                        className="bg-white text-slate-800 hover:bg-slate-100 text-xs"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        onClick={async () => {
                          if (!state || !selectedConsultantForPlans) return;
                          if (draftAllowedPlans.length === 0) {
                            toast({
                              variant: 'destructive',
                              title: 'Selecione ao menos 1 plano',
                              description: 'Escolha pelo menos um plano para aparecer no link deste consultor.',
                            });
                            return;
                          }
                          const updated = (state.consultants || []).map((c) =>
                            c.id === selectedConsultantForPlans.id
                              ? { ...c, allowedPlanCodes: draftAllowedPlans }
                              : c
                          );
                          await persist({ ...state, consultants: updated });
                          setSelectedConsultantForPlans(null);
                          toast({
                            title: 'Permissões de Planos Atualizadas!',
                            description: `${draftAllowedPlans.length} plano(s) configurados no link de ${selectedConsultantForPlans.name}.`,
                          });
                        }}
                        className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs"
                      >
                        Salvar Permissões de Planos
                      </Button>
                    </DialogFooter>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>

          {/* =====================================================================
              MODAL CONTABILIDADE & VENDAS PAGAS DO CONSULTOR / INFLUENCER
          ===================================================================== */}
          <Dialog
            open={!!selectedConsultantForAccounting}
            onOpenChange={(open) => !open && setSelectedConsultantForAccounting(null)}
          >
            <DialogContent className="max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              {selectedConsultantForAccounting && (() => {
                const metrics = getConsultantSubscriptionMetrics(
                  selectedConsultantForAccounting,
                  state?.subscriptions || []
                );

                return (
                  <div className="space-y-4">
                    <DialogHeader className="border-b pb-2">
                      <DialogTitle className="text-base font-black text-slate-900 uppercase">
                        Contabilidade de Vendas Pagas & Comissões
                      </DialogTitle>
                      <p className="text-xs text-slate-600">
                        {selectedConsultantForAccounting.role === 'INFLUENCER' ? 'Influencer' : 'Consultor'}:{' '}
                        <strong className="text-emerald-900">{selectedConsultantForAccounting.name}</strong>{' '}
                        (Código: {selectedConsultantForAccounting.referralCode})
                      </p>
                    </DialogHeader>

                    {/* Resumo Financeiro */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block">Acessos Link / QR</span>
                        <strong className="text-slate-900 text-lg block">
                          {selectedConsultantForAccounting.clicksCount || 0}
                        </strong>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block">Pessoas que Aderiram</span>
                        <strong className="text-slate-900 text-lg block">
                          {metrics.linkedSubs.length}
                        </strong>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="text-emerald-800 block">Vendas Pagas</span>
                        <strong className="text-emerald-950 text-lg block">
                          {metrics.paidCount}
                        </strong>
                        <span className="text-[10px] text-emerald-700 block">
                          Total: {formatCurrency(metrics.totalPaidVolume)}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#004d00] text-white">
                        <span className="text-emerald-300 block">Comissão a Pagar</span>
                        <strong className="text-white text-lg block">
                          {formatCurrency(metrics.totalPaidCommission)}
                        </strong>
                      </div>
                    </div>

                    {/* Tabela de Vendas Pagas */}
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase mb-2">
                        Vendas Confirmadas (Contabilidade Apenas Após Pagamento Efetivo)
                      </h4>
                      {metrics.paidSales.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-xs border border-dashed rounded-xl">
                          Nenhuma venda confirmada com pagamento efetivo até o momento.
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-[#004d00] text-white font-bold text-[11px]">
                                <th className="py-2 px-3">Cliente</th>
                                <th className="py-2 px-3">Data Pgto</th>
                                <th className="py-2 px-3">Plano Contratado</th>
                                <th className="py-2 px-3">Valor do Plano</th>
                                <th className="py-2 px-3">Comissão</th>
                                <th className="py-2 px-3 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {metrics.paidSales.map((sale) => (
                                <tr key={sale.subscription.id} className="hover:bg-slate-50">
                                  <td className="py-2 px-3 font-bold text-slate-900">
                                    {sale.subscription.holderName}
                                  </td>
                                  <td className="py-2 px-3 text-slate-600">
                                    {formatDateBR(sale.paidAt)}
                                  </td>
                                  <td className="py-2 px-3 text-slate-700">
                                    {sale.subscription.planSummaryLabel}
                                  </td>
                                  <td className="py-2 px-3 font-semibold text-slate-900">
                                    <div>{formatCurrency(sale.planValue)}</div>
                                    {sale.paidAmount > 0 && sale.paidAmount !== sale.planValue && (
                                      <span className="text-[10px] text-emerald-700 block">
                                        Pago: {formatCurrency(sale.paidAmount)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 font-black text-emerald-800">
                                    {formatCurrency(sale.commissionValue)}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span className="inline-block px-2 py-0.5 rounded font-black text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      PAGO
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {metrics.pendingSubs.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                        <span className="font-bold">⚠️ {metrics.pendingSubs.length} adesão(ões) aguardando pagamento:</span>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          A contabilidade e liberação da comissão ocorre somente após a compensação do pagamento pelo cliente.
                        </p>
                      </div>
                    )}

                    <DialogFooter className="pt-2 border-t">
                      <Button
                        type="button"
                        onClick={() => setSelectedConsultantForAccounting(null)}
                        className="bg-[#004d00] hover:bg-emerald-900 text-white text-xs font-bold"
                      >
                        Fechar Extrato
                      </Button>
                    </DialogFooter>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>

          {/* =====================================================================
              MODAL EDITAR DADOS, CÓDIGO E SENHA DE ACESSO DO CONSULTOR / INFLUENCER
          ===================================================================== */}
          <Dialog
            open={!!editingConsultant}
            onOpenChange={(open) => !open && setEditingConsultant(null)}
          >
            <DialogContent className="max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              {editingConsultant && (
                <form onSubmit={handleSaveEditedConsultant} className="space-y-4">
                  <DialogHeader className="border-b pb-2">
                    <DialogTitle className="text-base font-black text-slate-900 uppercase">
                      Editar Cadastro & Credenciais de Acesso
                    </DialogTitle>
                    <p className="text-xs text-slate-600">
                      Atualize dados cadastrais, e-mail e senha de acesso ao Portal do Consultor (<code>/consultor</code>).
                    </p>
                  </DialogHeader>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs font-bold text-slate-700">
                    <div className="sm:col-span-6">
                      <Label className="text-xs font-bold">Nome Completo *</Label>
                      <Input
                        value={editingConsultant.name}
                        onChange={(e) =>
                          setEditingConsultant({ ...editingConsultant, name: e.target.value })
                        }
                        className="bg-white mt-1 h-9"
                        required
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs font-bold">CPF</Label>
                      <Input
                        value={editingConsultant.cpf}
                        onChange={(e) =>
                          setEditingConsultant({
                            ...editingConsultant,
                            cpf: formatCpf(e.target.value),
                          })
                        }
                        className="bg-white mt-1 h-9"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs font-bold">Papel</Label>
                      <select
                        value={editingConsultant.role}
                        onChange={(e) =>
                          setEditingConsultant({
                            ...editingConsultant,
                            role: e.target.value as 'CONSULTOR' | 'INFLUENCER',
                          })
                        }
                        className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs font-bold bg-white mt-1"
                      >
                        <option value="CONSULTOR">Consultor</option>
                        <option value="INFLUENCER">Influencer</option>
                      </select>
                    </div>

                    <div className="sm:col-span-4">
                      <Label className="text-xs font-bold">Telefone / WhatsApp</Label>
                      <Input
                        value={editingConsultant.phone}
                        onChange={(e) =>
                          setEditingConsultant({
                            ...editingConsultant,
                            phone: formatPhone(e.target.value),
                          })
                        }
                        className="bg-white mt-1 h-9"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Label className="text-xs font-bold">E-mail de Login</Label>
                      <Input
                        type="email"
                        value={editingConsultant.email || ''}
                        onChange={(e) =>
                          setEditingConsultant({ ...editingConsultant, email: e.target.value })
                        }
                        placeholder="vendedor@email.com"
                        className="bg-white mt-1 h-9"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Label className="text-xs font-bold">Senha de Acesso (Portal)</Label>
                      <div className="relative mt-1">
                        <Input
                          type={showEditConsPassword ? 'text' : 'password'}
                          value={editingConsultant.password || ''}
                          onChange={(e) =>
                            setEditingConsultant({
                              ...editingConsultant,
                              password: e.target.value,
                            })
                          }
                          placeholder="Senha para entrar no portal"
                          className="bg-white h-9 pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEditConsPassword((p) => !p)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
                        >
                          {showEditConsPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="sm:col-span-4">
                      <Label className="text-xs font-bold">Código no Link</Label>
                      <Input
                        value={editingConsultant.referralCode}
                        onChange={(e) =>
                          setEditingConsultant({
                            ...editingConsultant,
                            referralCode: e.target.value
                              .normalize('NFD')
                              .replace(/[\u0300-\u036f]/g, '')
                              .toUpperCase()
                              .replace(/[^A-Z0-9_-]/g, ''),
                          })
                        }
                        className="bg-white mt-1 h-9 font-mono uppercase"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Label className="text-xs font-bold">Tipo de Comissão</Label>
                      <select
                        value={editingConsultant.commissionType || 'PERCENT'}
                        onChange={(e) =>
                          setEditingConsultant({
                            ...editingConsultant,
                            commissionType: e.target.value as 'PERCENT' | 'FIXED',
                          })
                        }
                        className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs font-bold bg-white mt-1"
                      >
                        <option value="PERCENT">Percentual (%)</option>
                        <option value="FIXED">Valor Fixo (R$)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <Label className="text-xs font-bold">
                        {editingConsultant.commissionType === 'FIXED' ? 'Valor Fixo (R$)' : 'Porcentagem (%)'}
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={
                          editingConsultant.commissionValue ??
                          editingConsultant.commissionPercent ??
                          10
                        }
                        onChange={(e) =>
                          setEditingConsultant({
                            ...editingConsultant,
                            commissionValue: Number(e.target.value),
                            commissionPercent:
                              editingConsultant.commissionType === 'FIXED'
                                ? editingConsultant.commissionPercent
                                : Number(e.target.value),
                          })
                        }
                        className="bg-white mt-1 h-9"
                      />
                    </div>
                  </div>

                  <DialogFooter className="pt-2 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingConsultant(null)}
                      className="bg-white text-slate-800 hover:bg-slate-100 text-xs"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSavingConsultant}
                      className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs"
                    >
                      {isSavingConsultant ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </DialogFooter>
                </form>
              )}
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
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={handleOpenAsaasSyncModal}
                className="shrink-0 whitespace-nowrap text-xs border-emerald-700 text-emerald-900 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-950 font-bold ml-auto cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Sincronizar Asaas (Mensalidades)
              </Button>
            </div>

            {/* 1. FLUXO DE CAIXA (IDÊNTICO À SCREENSHOT 5 DO USUÁRIO) */}
            {financeSubView === 'FLUXO_CAIXA' && (
              <div className="space-y-4">
                {/* Botões Superiores: BAIXAS MANUAIS e BAIXAS AUTOMÁTICAS (Screenshot 5) */}
                <div className="flex flex-wrap items-center justify-center gap-4 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCashFlowFilterMode(
                        cashFlowFilterMode === 'MANUAL' ? 'ALL' : 'MANUAL'
                      )
                    }
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm ${
                      cashFlowFilterMode === 'MANUAL'
                        ? 'bg-[#9ed2f6] text-[#002b4d] ring-2 ring-[#0066cc]'
                        : 'bg-[#c2e7ff] hover:bg-[#aedaff] text-[#003865]'
                    }`}
                  >
                    <Eye className="w-4 h-4 text-[#003865]" />
                    <span>
                      BAIXAS MANUAIS: {formatCurrency(cashFlowPanelData.manualBaixasTotal)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setCashFlowFilterMode(
                        cashFlowFilterMode === 'AUTO' ? 'ALL' : 'AUTO'
                      )
                    }
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm ${
                      cashFlowFilterMode === 'AUTO'
                        ? 'bg-[#b6f0bf] text-[#053b13] ring-2 ring-[#0f8b30]'
                        : 'bg-[#d3f9d8] hover:bg-[#c1f5c8] text-[#0a4d1a]'
                    }`}
                  >
                    <Eye className="w-4 h-4 text-[#0a4d1a]" />
                    <span>
                      BAIXAS AUTOMÁTICAS {formatCurrency(cashFlowPanelData.autoBaixasTotal)}
                    </span>
                  </button>
                </div>

                {/* 4 Totais Centrais (Screenshot 5) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center py-2 border-y border-slate-100">
                  <div>
                    <span className="text-xs text-slate-600 block">
                      Entrada de Mensalidades:
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {formatCurrency(cashFlowPanelData.mensalidadesTotal)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-600 block">
                      Entrada de Caixa:
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {formatCurrency(cashFlowPanelData.entradasCaixaTotal)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-600 block">
                      Saída de Caixa:
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {formatCurrency(cashFlowPanelData.saidasCaixaTotal)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-600 block">
                      Saldo:
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {formatCurrency(cashFlowPanelData.saldo)}
                    </span>
                  </div>
                </div>

                {/* Filtro de Datas com Buscar (Screenshot 5) */}
                <div className="flex flex-col items-center justify-center gap-2 py-2">
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-700">
                    <span>Entre:</span>
                    <input
                      type="date"
                      value={cashFlowStartDate}
                      onChange={(e) => setCashFlowStartDate(e.target.value)}
                      className="h-8 px-2 rounded border border-slate-300 text-xs bg-white font-mono"
                    />
                    <span>e:</span>
                    <input
                      type="date"
                      value={cashFlowEndDate}
                      onChange={(e) => setCashFlowEndDate(e.target.value)}
                      className="h-8 px-2 rounded border border-slate-300 text-xs bg-white font-mono"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-8 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100"
                  >
                    Buscar
                  </Button>
                </div>

                {/* Tabela Idêntica à Screenshot 5 com Cabeçalho Verde */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#004d00] text-white text-[11px] font-bold">
                        <th className="py-2.5 px-3">Nº Card</th>
                        <th className="py-2.5 px-3">Nome</th>
                        <th className="py-2.5 px-3 text-center">Boleto</th>
                        <th className="py-2.5 px-3">Plano</th>
                        <th className="py-2.5 px-3">Valor</th>
                        <th className="py-2.5 px-3">Tipo de PG</th>
                        <th className="py-2.5 px-3 text-center">Parcela</th>
                        <th className="py-2.5 px-3">Vencimento</th>
                        <th className="py-2.5 px-3">DT PG</th>
                        <th className="py-2.5 px-3">OBS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {cashFlowPanelData.rows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-slate-400">
                            Nenhuma baixa encontrada para o período selecionado.
                          </td>
                        </tr>
                      ) : (
                        cashFlowPanelData.rows.map((row, idx) => (
                          <tr
                            key={`${row.id}_${idx}`}
                            className={`${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                            } hover:bg-emerald-50/50 transition-colors`}
                          >
                            <td className="py-2 px-3 font-mono font-bold text-slate-800">
                              {row.cardCode}
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              {row.holderName}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {row.hasBoleto && row.boletoUrl ? (
                                <a
                                  href={row.boletoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-700 hover:underline font-bold inline-flex items-center gap-1"
                                >
                                  <FileText className="w-3.5 h-3.5" /> Ver
                                </a>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.planName}
                            </td>
                            <td className="py-2 px-3 font-black text-slate-900">
                              {formatCurrency(row.amount)}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-700">
                              {row.paymentType}
                            </td>
                            <td className="py-2 px-3 text-center font-mono">
                              {row.installment}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {formatDateBR(row.dueDate)}
                            </td>
                            <td className="py-2 px-3 font-semibold text-emerald-800">
                              {formatDateBR(row.paidDate)}
                            </td>
                            <td className="py-2 px-3 text-slate-600 text-[11px]">
                              {row.obs}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Botão Imprimir no Canto Inferior Esquerdo (Screenshot 5) */}
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.print()}
                    className="h-8 px-4 text-xs font-bold border-slate-300 text-slate-800 hover:bg-slate-100 uppercase"
                  >
                    IMPRIMIR
                  </Button>
                </div>
              </div>
            )}

            {/* 1.1 ENTRADA DE CAIXA / SAÍDA DE CAIXA (Screenshot 1 do usuário) */}
            {(financeSubView === 'ENTRADA_CAIXA' ||
              financeSubView === 'SAIDA_CAIXA') && (
              <div className="space-y-4">
                <h3 className="text-xl font-normal text-slate-800">
                  {financeSubView === 'ENTRADA_CAIXA'
                    ? 'Entrada de Caixa'
                    : 'Saída de Caixa'}
                </h3>

                {/* Resumo de Caixa (Entrada de Mensalidades, Entrada de Caixa, Saída de Caixa, Saldo) */}
                <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-xs py-1 border-b border-slate-100">
                  <div>
                    <span className="text-slate-600 block">
                      Entrada de Mensalidades:
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(cashFlowPanelData.mensalidadesTotal)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 block">
                      Entrada de Caixa:
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(cashFlowPanelData.entradasCaixaTotal)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 block">
                      Saída de Caixa:
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(cashFlowPanelData.saidasCaixaTotal)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 block">Saldo:</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(cashFlowPanelData.saldo)}
                    </span>
                  </div>
                </div>

                {/* Filtro de Datas com botão Buscar */}
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                    <span>Entre:</span>
                    <input
                      type="date"
                      value={cashEntryStartDate}
                      onChange={(e) => setCashEntryStartDate(e.target.value)}
                      className="h-8 px-2 rounded border border-slate-300 text-xs bg-white font-mono"
                    />
                    <span>e:</span>
                    <input
                      type="date"
                      value={cashEntryEndDate}
                      onChange={(e) => setCashEntryEndDate(e.target.value)}
                      className="h-8 px-2 rounded border border-slate-300 text-xs bg-white font-mono"
                    />
                  </div>
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-8 text-xs font-medium border-slate-300 text-slate-700 hover:bg-slate-100"
                    >
                      Buscar
                    </Button>
                  </div>
                </div>

                {/* Botões de Ação: ADICIONAR / EXCLUIR */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCashEntryModalType(
                        financeSubView === 'ENTRADA_CAIXA' ? 'IN' : 'OUT'
                      );
                      setIsCashEntryModalOpen(true);
                    }}
                    className="bg-[#1e70bf] hover:bg-[#185d9f] text-white text-xs font-bold px-4 py-2 rounded uppercase shadow-sm transition-colors"
                  >
                    {financeSubView === 'ENTRADA_CAIXA'
                      ? 'ADICIONAR ENTRADA'
                      : 'ADICIONAR SAÍDA'}
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteSelectedCashEntries}
                    disabled={selectedCashEntryIds.length === 0}
                    className="bg-[#d9534f] hover:bg-[#c9302c] text-white text-xs font-bold px-4 py-2 rounded uppercase shadow-sm transition-colors disabled:opacity-50"
                  >
                    {financeSubView === 'ENTRADA_CAIXA'
                      ? 'EXCLUIR ENTRADA'
                      : 'EXCLUIR SAÍDA'}
                  </button>
                </div>

                {/* Tabela de Lançamentos de Caixa com Cabeçalho Verde Escuro */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#004d00] text-white text-[11px] font-bold">
                        <th className="py-2.5 px-3 w-16">#ID</th>
                        <th className="py-2.5 px-3">Titulo</th>
                        <th className="py-2.5 px-3">Descrição</th>
                        <th className="py-2.5 px-3">Valor</th>
                        <th className="py-2.5 px-3">
                          {financeSubView === 'ENTRADA_CAIXA'
                            ? 'DT Entrada'
                            : 'DT Saida'}
                        </th>
                        <th className="py-2.5 px-3">Registrado dia</th>
                        <th className="py-2.5 px-3">Por</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {cashEntriesListComputed.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-8 text-center text-slate-400"
                          >
                            Nenhum registro encontrado para a data selecionada.
                          </td>
                        </tr>
                      ) : (
                        cashEntriesListComputed.map((entry, idx) => {
                          const isChecked = selectedCashEntryIds.includes(
                            entry.id
                          );
                          return (
                            <tr
                              key={entry.id}
                              className={`${
                                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                              } hover:bg-emerald-50/50 transition-colors`}
                            >
                              <td className="py-2 px-3 font-mono font-bold text-slate-800">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedCashEntryIds((prev) => [
                                          ...prev,
                                          entry.id,
                                        ]);
                                      } else {
                                        setSelectedCashEntryIds((prev) =>
                                          prev.filter((id) => id !== entry.id)
                                        );
                                      }
                                    }}
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-[#004d00] focus:ring-[#004d00]"
                                  />
                                  <span>#{idx + 101}</span>
                                </label>
                              </td>
                              <td className="py-2 px-3 font-bold text-slate-900">
                                {entry.title || entry.category || 'Movimentação'}
                              </td>
                              <td className="py-2 px-3 text-slate-700">
                                {entry.description}
                              </td>
                              <td className="py-2 px-3 font-black text-slate-900">
                                {formatCurrency(entry.amount)}
                              </td>
                              <td className="py-2 px-3 text-slate-700">
                                {formatDateBR(entry.date)}
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {formatDateBR(entry.createdAt || entry.date)}
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {entry.registeredBy || 'Admin Lessa'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Botão Imprimir */}
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.print()}
                    className="h-8 px-4 text-xs font-bold border-slate-300 text-slate-800 hover:bg-slate-100 uppercase"
                  >
                    IMPRIMIR
                  </Button>
                </div>
              </div>
            )}

            {/* Modal Dialog para ADICIONAR ENTRADA / SAÍDA DE CAIXA */}
            <Dialog
              open={isCashEntryModalOpen}
              onOpenChange={setIsCashEntryModalOpen}
            >
              <DialogContent className="max-w-md bg-white">
                <DialogHeader>
                  <DialogTitle className="text-base font-bold text-slate-900">
                    {cashEntryModalType === 'IN'
                      ? 'Adicionar Entrada de Caixa'
                      : 'Adicionar Saída de Caixa'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2 text-xs">
                  <div>
                    <Label className="text-xs font-bold text-slate-700">
                      Título *
                    </Label>
                    <Input
                      value={cashTitle}
                      onChange={(e) => setCashTitle(e.target.value)}
                      placeholder={
                        cashEntryModalType === 'IN'
                          ? 'Ex: Recebimento Avulso'
                          : 'Ex: Manutenção da Piscina'
                      }
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold text-slate-700">
                      Descrição Detalhada *
                    </Label>
                    <Input
                      value={cashDescription}
                      onChange={(e) => setCashDescription(e.target.value)}
                      placeholder="Ex: Compra de cloro / Pagamento de serviço..."
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-bold text-slate-700">
                        Valor (R$) *
                      </Label>
                      <Input
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        placeholder="0,00"
                        className="mt-1 h-9 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-slate-700">
                        Meio de Pagamento
                      </Label>
                      <select
                        value={cashMethod}
                        onChange={(e) => setCashMethod(e.target.value)}
                        className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs font-medium bg-white mt-1"
                      >
                        <option value="PIX">PIX</option>
                        <option value="DINHEIRO">Dinheiro</option>
                        <option value="CARTAO">Cartão</option>
                        <option value="BOLETO">Boleto</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-bold text-slate-700">
                        Data da Movimentação
                      </Label>
                      <Input
                        type="date"
                        value={cashDate}
                        onChange={(e) => setCashDate(e.target.value)}
                        className="mt-1 h-9 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-slate-700">
                        Registrado Por
                      </Label>
                      <Input
                        value={cashRegisteredBy}
                        onChange={(e) => setCashRegisteredBy(e.target.value)}
                        placeholder="Admin Lessa"
                        className="mt-1 h-9 text-xs"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex justify-end gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsCashEntryModalOpen(false)}
                    className="h-8 text-xs font-bold"
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveCashEntryModal}
                    className="h-8 bg-[#004d00] hover:bg-emerald-900 text-white text-xs font-bold"
                  >
                    Salvar Movimentação
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* 2. FATURAMENTO MENSAL PREVISTO (Screenshot 2 do usuário) */}
            {financeSubView === 'FATURAMENTO_PREVISTO' && (
              <div className="space-y-4">
                <h3 className="text-xl font-normal text-slate-800">
                  Relatório de Faturamentos Previstos
                </h3>

                {/* Filtro Mês/Ano com botão Filtrar */}
                <div className="flex flex-wrap items-center gap-3 py-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span>Mês/Ano</span>
                    <select
                      value={faturamentoMonth}
                      onChange={(e) => setFaturamentoMonth(e.target.value)}
                      className="h-8 px-3 rounded border border-slate-300 bg-white text-xs font-medium"
                    >
                      {MONTH_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    size="sm"
                    className="h-8 px-4 bg-[#1e70bf] hover:bg-[#185d9f] text-white text-xs font-medium"
                  >
                    Filtrar
                  </Button>
                </div>

                {/* 4 Cards de Totais (Idênticos à Screenshot 2) */}
                <div className="flex flex-wrap items-center gap-3 py-1">
                  <div className="px-3.5 py-1.5 rounded-lg bg-[#e8f4fc] border border-[#b9ddf8] text-[#0d6efd] text-xs font-semibold flex items-center gap-1.5">
                    <span>📄 Total de Boletos:</span>
                    <span className="font-bold">
                      {faturamentoPrevistoComputed.totalBoletos}
                    </span>
                  </div>
                  <div className="px-3.5 py-1.5 rounded-lg bg-[#eaf8ee] border border-[#bce6c6] text-[#198754] text-xs font-semibold flex items-center gap-1.5">
                    <span>💰 Total Recebido:</span>
                    <span className="font-bold">
                      {formatCurrency(
                        faturamentoPrevistoComputed.totalRecebido
                      )}
                    </span>
                  </div>
                  <div className="px-3.5 py-1.5 rounded-lg bg-[#fef8e7] border border-[#fde09e] text-[#d97706] text-xs font-semibold flex items-center gap-1.5">
                    <span>⏳ Total Pendente:</span>
                    <span className="font-bold">
                      {formatCurrency(
                        faturamentoPrevistoComputed.totalPendente
                      )}
                    </span>
                  </div>
                  <div className="px-3.5 py-1.5 rounded-lg bg-[#f1f3f5] border border-[#dee2e6] text-[#495057] text-xs font-semibold flex items-center gap-1.5">
                    <span>📊 Total Geral:</span>
                    <span className="font-bold">
                      {formatCurrency(faturamentoPrevistoComputed.totalGeral)}
                    </span>
                  </div>
                </div>

                {/* Tabela com Cabeçalho Verde Escuro */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#004d00] text-white text-[11px] font-bold">
                        <th className="py-2.5 px-3">Nome</th>
                        <th className="py-2.5 px-3">CPF</th>
                        <th className="py-2.5 px-3">Plano</th>
                        <th className="py-2.5 px-3">Valor</th>
                        <th className="py-2.5 px-3">Parcela</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {faturamentoPrevistoComputed.rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-8 text-center text-slate-400"
                          >
                            Nenhum faturamento previsto para o mês selecionado.
                          </td>
                        </tr>
                      ) : (
                        faturamentoPrevistoComputed.rows.map((row, idx) => (
                          <tr
                            key={`${row.cpf}_${idx}`}
                            className={`${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                            } hover:bg-emerald-50/50 transition-colors`}
                          >
                            <td className="py-2 px-3 font-bold text-slate-900">
                              {row.name}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-700">
                              {row.cpf}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.plan}
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              {formatCurrency(row.amount)}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-700">
                              {formatDateBR(row.installmentDate)}
                            </td>
                            <td className="py-2 px-3">
                              {row.status === 'PAID' ? (
                                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#d4edda] text-[#155724]">
                                  Paga
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#fff3cd] text-[#856404]">
                                  Pendente
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Botão Imprimir */}
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.print()}
                    className="h-8 px-4 text-xs font-bold border-slate-300 text-slate-800 hover:bg-slate-100 uppercase"
                  >
                    IMPRIMIR
                  </Button>
                </div>
              </div>
            )}

            {/* 3. MENSALIDADES (Screenshot 3 do usuário) */}
            {financeSubView === 'MENSALIDADES' && (
              <div className="space-y-4">
                <h3 className="text-xl font-normal text-slate-800">
                  Faturas &gt; Total {formatCurrency(mensalidadesComputed.total)}
                </h3>

                {/* Filtro Entre / e / Rádios PAGOS e NÃO PAGOS / Buscar */}
                <div className="space-y-2 py-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                    <span>Entre:</span>
                    <input
                      type="date"
                      value={mensalidadesStartDate}
                      onChange={(e) => setMensalidadesStartDate(e.target.value)}
                      className="h-8 px-2 rounded border border-slate-300 text-xs bg-white font-mono"
                    />
                    <span>e:</span>
                    <input
                      type="date"
                      value={mensalidadesEndDate}
                      onChange={(e) => setMensalidadesEndDate(e.target.value)}
                      className="h-8 px-2 rounded border border-slate-300 text-xs bg-white font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-6 text-xs font-bold text-slate-800">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <span>PAGOS:</span>
                      <input
                        type="radio"
                        name="mensalidadesPaidOption"
                        checked={mensalidadesPaidFilter === 'PAID'}
                        onChange={() => setMensalidadesPaidFilter('PAID')}
                        className="text-emerald-700 focus:ring-emerald-600"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <span>NÃO PAGOS:</span>
                      <input
                        type="radio"
                        name="mensalidadesPaidOption"
                        checked={mensalidadesPaidFilter === 'UNPAID'}
                        onChange={() => setMensalidadesPaidFilter('UNPAID')}
                        className="text-emerald-700 focus:ring-emerald-600"
                      />
                    </label>
                  </div>
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-8 text-xs font-medium border-slate-300 text-slate-700 hover:bg-slate-100"
                    >
                      Buscar
                    </Button>
                  </div>
                </div>

                {/* Tabela com Cabeçalho Verde Escuro */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#004d00] text-white text-[11px] font-bold">
                        <th className="py-2.5 px-3">Nº Card</th>
                        <th className="py-2.5 px-3">Nome</th>
                        <th className="py-2.5 px-3">Boleto</th>
                        <th className="py-2.5 px-3">Plano</th>
                        <th className="py-2.5 px-3">Valor</th>
                        <th className="py-2.5 px-3">Parcela</th>
                        <th className="py-2.5 px-3">Vencimento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {mensalidadesComputed.rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-8 text-center text-slate-400"
                          >
                            Nenhuma fatura encontrada para os filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        mensalidadesComputed.rows.map((row, idx) => (
                          <tr
                            key={`${row.cardCode}_${row.boleto}_${idx}`}
                            className={`${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                            } hover:bg-emerald-50/50 transition-colors`}
                          >
                            <td className="py-2 px-3 font-mono font-bold text-slate-800">
                              {row.cardCode}
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              {row.name}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-700">
                              {row.boleto}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.plan}
                            </td>
                            <td className="py-2 px-3 font-black text-slate-900">
                              {formatCurrency(row.amount)}
                            </td>
                            <td className="py-2 px-3 text-slate-700 font-mono">
                              {row.installment}
                            </td>
                            <td className="py-2 px-3 text-slate-700 font-mono">
                              {formatDateBR(row.dueDate)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Botão Imprimir */}
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.print()}
                    className="h-8 px-4 text-xs font-bold border-slate-300 text-slate-800 hover:bg-slate-100 uppercase"
                  >
                    IMPRIMIR
                  </Button>
                </div>
              </div>
            )}

            {/* 4. COBRANÇAS VENCIDAS POR MÊS (Screenshot 4 do usuário) */}
            {financeSubView === 'VENCIDAS_POR_MES' && (
              <div className="space-y-4">
                {/* Banner Azul Escuro de Relatório */}
                <div className="bg-[#1c5ba6] text-white p-4 rounded-xl flex items-center gap-3 shadow-sm">
                  <FileText className="w-6 h-6 text-white shrink-0" />
                  <div>
                    <h3 className="text-base font-bold text-white leading-tight">
                      Relatório de Cobranças em Atraso
                    </h3>
                    <p className="text-xs text-blue-100">
                      Visualização mensal de cobranças vencidas
                    </p>
                  </div>
                </div>

                {/* Filtro Mês / Ano */}
                <div className="flex flex-wrap items-center gap-3 py-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span>Mês / Ano</span>
                    <select
                      value={vencidasMonth}
                      onChange={(e) => setVencidasMonth(e.target.value)}
                      className="h-8 px-3 rounded border border-slate-300 bg-white text-xs font-medium"
                    >
                      {MONTH_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    size="sm"
                    className="h-8 px-4 bg-[#1e70bf] hover:bg-[#185d9f] text-white text-xs font-medium flex items-center gap-1.5"
                  >
                    <Filter className="w-3.5 h-3.5" /> Filtrar
                  </Button>
                </div>

                {/* Tabela com Cabeçalho Claro e Badge Vermelho na Parcela */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-800 text-[11px] font-bold">
                        <th className="py-2.5 px-3">Nome</th>
                        <th className="py-2.5 px-3">Cartão</th>
                        <th className="py-2.5 px-3">Parcela</th>
                        <th className="py-2.5 px-3">Dia do Vencimento</th>
                        <th className="py-2.5 px-3">Valor</th>
                        <th className="py-2.5 px-3">Contato</th>
                        <th className="py-2.5 px-3">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {vencidasPorMesComputed.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-8 text-center text-slate-400"
                          >
                            Nenhuma cobrança em atraso encontrada para o mês selecionado.
                          </td>
                        </tr>
                      ) : (
                        vencidasPorMesComputed.map((row, idx) => (
                          <tr
                            key={`${row.cardCode}_${row.dueDate}_${idx}`}
                            className={`${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                            } hover:bg-rose-50/40 transition-colors`}
                          >
                            <td className="py-2 px-3 font-bold text-slate-900">
                              {row.name}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-700">
                              {row.cardCode}
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#c92a2a] text-white">
                                {formatDateBR(row.dueDate)}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono text-center text-slate-700">
                              {row.dueDay}
                            </td>
                            <td className="py-2 px-3 font-black text-slate-900">
                              {formatCurrency(row.amount)}
                            </td>
                            <td className="py-2 px-3 text-slate-700 font-mono">
                              {row.phone}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {row.email}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Botão Imprimir */}
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.print()}
                    className="h-8 px-4 text-xs font-bold border-slate-300 text-slate-800 hover:bg-slate-100 uppercase"
                  >
                    IMPRIMIR
                  </Button>
                </div>
              </div>
            )}

            {/* 5. ASSINATURAS ATIVAS & ASSINATURAS VENCIDAS (Screenshot 5 do usuário) */}
            {(financeSubView === 'ASSINATURAS_ATIVAS' ||
              financeSubView === 'ASSINATURAS_VENCIDAS') && (
              <div className="space-y-4">
                <h3 className="text-xl font-normal text-slate-800">
                  {financeSubView === 'ASSINATURAS_ATIVAS'
                    ? 'Assinaturas Ativas'
                    : 'Assinaturas Vencidas'}
                </h3>

                {/* Tabela com Cabeçalho Verde Escuro e Coluna Cartão (ex: ****5439 ou ****) */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#004d00] text-white text-[11px] font-bold">
                        <th className="py-2.5 px-3">Nº Card</th>
                        <th className="py-2.5 px-3">Nome</th>
                        <th className="py-2.5 px-3">Plano</th>
                        <th className="py-2.5 px-3">Valor</th>
                        <th className="py-2.5 px-3">Cartão</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Data de Criação</th>
                        <th className="py-2.5 px-3">Vencimento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {assinaturasAtivasVencidasComputed.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="py-8 text-center text-slate-400"
                          >
                            Nenhuma assinatura encontrada nesta categoria.
                          </td>
                        </tr>
                      ) : (
                        assinaturasAtivasVencidasComputed.map((row, idx) => (
                          <tr
                            key={`${row.cardCode}_${idx}`}
                            className={`${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                            } hover:bg-emerald-50/50 transition-colors`}
                          >
                            <td className="py-2 px-3 font-mono font-bold text-slate-800">
                              {row.cardCode}
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              {row.name}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.plan}
                            </td>
                            <td className="py-2 px-3 font-black text-slate-900">
                              {formatCurrency(row.amount)}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-800">
                              {row.card}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] font-semibold text-slate-800">
                              {row.status}
                            </td>
                            <td className="py-2 px-3 text-slate-700 font-mono">
                              {formatDateBR(row.createdAt)}
                            </td>
                            <td className="py-2 px-3 text-slate-700 font-mono">
                              {formatDateBR(row.dueDate)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Botão Imprimir */}
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.print()}
                    className="h-8 px-4 text-xs font-bold border-slate-300 text-slate-800 hover:bg-slate-100 uppercase"
                  >
                    IMPRIMIR
                  </Button>
                </div>
              </div>
            )}

            {/* 6. BAIXAS EM LOTE (Ferramenta de Liquidação em Massa) */}
            {financeSubView === 'BAIXAS_EM_LOTE' && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Baixas em Lote de Mensalidades
                    </h3>
                    <p className="text-xs text-slate-500">
                      Selecione faturas pendentes para dar baixa manual de uma só vez.
                    </p>
                  </div>

                  {selectedInvoiceKeys.length > 0 && (
                    <Button
                      size="sm"
                      onClick={handleBatchSettleInvoices}
                      className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirmar Baixa em Lote ({selectedInvoiceKeys.length})
                    </Button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {allInvoicesWithSub
                    .filter(({ invoice }) => invoice.status !== 'PAID')
                    .map(({ invoice, subscription }) => {
                      const key = `${subscription.id}::${invoice.id}`;
                      const isSelected = selectedInvoiceKeys.includes(key);
                      return (
                        <div
                          key={key}
                          className="rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-50/60"
                        >
                          <div className="flex items-center gap-3">
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
                            <div>
                              <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                <span>{subscription.holderName}</span>
                                <Badge className="bg-amber-500 text-white">
                                  PENDENTE
                                </Badge>
                              </div>
                              <div className="text-xs text-slate-500">
                                {invoice.description} • Ref: {invoice.referenceMonth} • Vencimento: {formatDateBR(invoice.dueDate)} • CPF: {subscription.holderCpf}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 mr-2">
                              {formatCurrency(invoice.amount)}
                            </span>
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
                  reportCity !== 'TODAS' ||
                  reportCourtesy !== 'TODOS' ||
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
                      setReportCity('TODAS');
                      setReportCourtesy('TODOS');
                      setReportStatus('TODOS');
                      setReportSearchQuery('');
                    }}
                    className="text-xs font-bold text-rose-700 hover:bg-rose-50 h-7 px-2"
                  >
                    ✕ Limpar Todos os Filtros
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                {/* 1. Data Início */}
                <div>
                  <Label className="text-[11px] font-bold text-slate-600">Período De:</Label>
                  <Input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="h-8 bg-white text-xs mt-1"
                  />
                </div>

                {/* 2. Data Fim */}
                <div>
                  <Label className="text-[11px] font-bold text-slate-600">Período Até:</Label>
                  <Input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="h-8 bg-white text-xs mt-1"
                  />
                </div>

                {/* 3. Planos */}
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

                {/* 4. Cidades */}
                <div>
                  <Label className="text-[11px] font-bold text-slate-600">Cidade:</Label>
                  <select
                    value={reportCity}
                    onChange={(e) => setReportCity(e.target.value)}
                    className="w-full h-8 rounded-md border border-slate-300 px-2 text-xs font-bold bg-white mt-1"
                  >
                    <option value="TODAS">Todas as Cidades</option>
                    {uniqueReportCities.map((cidade) => (
                      <option key={cidade} value={cidade}>
                        📍 {cidade}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Cortesia */}
                <div>
                  <Label className="text-[11px] font-bold text-slate-600">Cortesia / Isento:</Label>
                  <select
                    value={reportCourtesy}
                    onChange={(e) => setReportCourtesy(e.target.value as any)}
                    className="w-full h-8 rounded-md border border-slate-300 px-2 text-xs font-bold bg-white mt-1"
                  >
                    <option value="TODOS">Todos (Pagos e Cortesias)</option>
                    <option value="CORTESIA">🎁 Apenas Cortesias / Gratuidades</option>
                    <option value="PAGO">💳 Apenas Planos Pagos</option>
                  </select>
                </div>

                {/* 6. Categoria (Titulares e Dependentes) */}
                <div>
                  <Label className="text-[11px] font-bold text-slate-600">Tipo de Membro:</Label>
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value as any)}
                    className="w-full h-8 rounded-md border border-slate-300 px-2 text-xs font-bold bg-white mt-1"
                  >
                    <option value="TODOS">Titulares + Dependentes</option>
                    <option value="TITULARES">👑 Apenas Titulares</option>
                    <option value="DEPENDENTES">👥 Apenas Dependentes</option>
                  </select>
                </div>

                {/* 7. Status */}
                <div>
                  <Label className="text-[11px] font-bold text-slate-600">Status:</Label>
                  <select
                    value={reportStatus}
                    onChange={(e) => setReportStatus(e.target.value as any)}
                    className="w-full h-8 rounded-md border border-slate-300 px-2 text-xs font-bold bg-white mt-1"
                  >
                    <option value="TODOS">Todos os Status</option>
                    <option value="ACTIVE">Ativos / Adimplentes</option>
                    <option value="PENDING_TRANSFER">Pendente Transferência</option>
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

                {clientReportSubFilter === 'LISTAGEM' ? (
                  <div className="space-y-4">
                    {/* Cabeçalho da Listagem com Estatísticas e Busca Rápida */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-emerald-800" />
                            <h4 className="font-black text-base text-slate-900">
                              Listagem Geral de Associados (Titulares & Dependentes)
                            </h4>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Filtros aplicados por planos, datas, cidades, cortesia e categoria (titulares/dependentes).
                          </p>
                        </div>

                        {/* Estatísticas resumidas em badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(() => {
                            const members = getFilteredReportMembers();
                            const titularCount = members.filter((m) => m.member.role === 'TITULAR').length;
                            const depCount = members.filter((m) => m.member.role === 'DEPENDENTE').length;
                            const courtesyCount = members.filter((m) => m.isCourtesy).length;
                            const paidCount = members.length - courtesyCount;
                            return (
                              <>
                                <Badge className="bg-emerald-800 text-white font-bold text-xs py-1 px-2.5">
                                  Total: {members.length} associados
                                </Badge>
                                <Badge variant="outline" className="text-xs font-bold border-emerald-300 text-emerald-900 bg-emerald-50">
                                  👑 {titularCount} Titulares
                                </Badge>
                                <Badge variant="outline" className="text-xs font-bold border-sky-300 text-sky-900 bg-sky-50">
                                  👥 {depCount} Dependentes
                                </Badge>
                                <Badge variant="outline" className="text-xs font-bold border-amber-300 text-amber-900 bg-amber-50">
                                  🎁 {courtesyCount} Cortesias
                                </Badge>
                                <Badge variant="outline" className="text-xs font-bold border-slate-300 text-slate-700 bg-slate-50">
                                  💳 {paidCount} Pagos
                                </Badge>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Busca Rápida na Listagem */}
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                          placeholder="Buscar nesta listagem por nome, CPF ou número da carteirinha..."
                          value={reportSearchQuery}
                          onChange={(e) => setReportSearchQuery(e.target.value)}
                          className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
                        />
                      </div>
                    </div>

                    {/* Tabela Completa de Associados */}
                    {(() => {
                      const filteredMembers = getFilteredReportMembers();

                      if (filteredMembers.length === 0) {
                        return (
                          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-3">
                            <Users className="w-10 h-10 text-slate-300 mx-auto" />
                            <div className="text-sm font-bold text-slate-700">
                              Nenhum associado encontrado para os filtros selecionados.
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReportStartDate('');
                                setReportEndDate('');
                                setReportAgeGroup('TODOS');
                                setReportPlanCode('TODOS');
                                setReportCategory('TODOS');
                                setReportCity('TODAS');
                                setReportCourtesy('TODOS');
                                setReportStatus('TODOS');
                                setReportSearchQuery('');
                              }}
                              className="text-xs font-bold text-emerald-800"
                            >
                              Limpar Filtros e Ver Todos
                            </Button>
                          </div>
                        );
                      }

                      return (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                                <tr>
                                  <th className="py-3 px-3">Nº Cartão</th>
                                  <th className="py-3 px-3">Associado</th>
                                  <th className="py-3 px-2">Tipo</th>
                                  <th className="py-3 px-3">Plano / Categoria</th>
                                  <th className="py-3 px-2">Cidade/UF</th>
                                  <th className="py-3 px-2">Valor / Tipo</th>
                                  <th className="py-3 px-2">Data Adesão</th>
                                  <th className="py-3 px-2 text-center">Status</th>
                                  <th className="py-3 px-3 text-right">Ações</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                {filteredMembers.map(({ member, sub, isCourtesy }) => {
                                  const isTitular = member.role === 'TITULAR';
                                  return (
                                    <tr
                                      key={`${sub.id}-${member.id}`}
                                      className="hover:bg-emerald-50/40 transition-colors"
                                    >
                                      {/* 1. Nº Cartão */}
                                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                        {member.cardNumber}
                                      </td>

                                      {/* 2. Associado (Nome + CPF + Telefone) */}
                                      <td className="py-2.5 px-3">
                                        <div className="flex items-center gap-2">
                                          {member.photoUrl ? (
                                            <img
                                              src={member.photoUrl}
                                              alt={member.fullName}
                                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                                            />
                                          ) : (
                                            <div
                                              className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                                                isTitular
                                                  ? 'bg-emerald-100 text-emerald-800'
                                                  : 'bg-sky-100 text-sky-800'
                                              }`}
                                            >
                                              {member.fullName.charAt(0)}
                                            </div>
                                          )}
                                          <div>
                                            <span className="font-bold text-slate-900 block leading-tight">
                                              {member.fullName}
                                            </span>
                                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                              {member.cpf && <span>CPF: {member.cpf}</span>}
                                              {member.phone && <span>Tel: {member.phone}</span>}
                                              {!isTitular && (
                                                <span className="text-emerald-700 font-semibold">
                                                  (Titular: {sub.holderName})
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </td>

                                      {/* 3. Tipo (Titular / Dependente) */}
                                      <td className="py-2.5 px-2">
                                        <Badge
                                          className={
                                            isTitular
                                              ? 'bg-emerald-800 text-white font-black text-[10px]'
                                              : 'bg-sky-700 text-white font-bold text-[10px]'
                                          }
                                        >
                                          {isTitular ? 'TITULAR' : 'DEPENDENTE'}
                                        </Badge>
                                      </td>

                                      {/* 4. Plano */}
                                      <td className="py-2.5 px-3">
                                        <span className="font-bold text-slate-800 block text-[11px]">
                                          {member.modalityName || sub.planSummaryLabel}
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                          {sub.billingCycle === 'ANNUAL' ? 'Plano Anual' : 'Plano Mensal'}
                                        </span>
                                      </td>

                                      {/* 5. Cidade/UF */}
                                      <td className="py-2.5 px-2 text-[11px] font-semibold text-slate-700">
                                        {sub.addressCity ? `${sub.addressCity}/${sub.addressState || 'RO'}` : 'Ariquemes/RO'}
                                      </td>

                                      {/* 6. Valor / Cortesia */}
                                      <td className="py-2.5 px-2">
                                        {isCourtesy ? (
                                          <Badge className="bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]">
                                            🎁 Cortesia / Isento
                                          </Badge>
                                        ) : (
                                          <span className="font-black text-slate-900 text-xs">
                                            {formatCurrency(member.monthlyValue || sub.monthlyEquivalent)}
                                            <span className="text-[10px] text-slate-500 font-normal">/mês</span>
                                          </span>
                                        )}
                                      </td>

                                      {/* 7. Data Cadastro */}
                                      <td className="py-2.5 px-2 text-[11px] text-slate-600 font-mono">
                                        {formatDateBR(sub.startDate || sub.createdAt)}
                                      </td>

                                      {/* 8. Status */}
                                      <td className="py-2.5 px-2 text-center">
                                        <Badge
                                          className={
                                            (member.status || sub.status) === 'ACTIVE'
                                              ? 'bg-emerald-600 text-white font-bold text-[10px]'
                                              : (member.status || sub.status) === 'PENDING_TRANSFER'
                                              ? 'bg-amber-600 text-white font-bold text-[10px]'
                                              : 'bg-rose-600 text-white font-bold text-[10px]'
                                          }
                                        >
                                          {(member.status || sub.status) === 'ACTIVE'
                                            ? 'ATIVO'
                                            : (member.status || sub.status) === 'PENDING_TRANSFER'
                                            ? 'PENDENTE TRANSF.'
                                            : 'INATIVO'}
                                        </Badge>
                                      </td>

                                      {/* 9. Ações */}
                                      <td className="py-2.5 px-3 text-right">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setSelectedSubForDetail(sub)}
                                          className="h-7 px-2.5 text-xs font-bold hover:bg-emerald-50 hover:text-emerald-800"
                                        >
                                          Abrir Ficha
                                        </Button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : clientReportSubFilter === 'POR_CIDADES' ? (
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
                      const metrics = getConsultantSubscriptionMetrics(
                        cons,
                        state.subscriptions || []
                      );
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
                              CPF: {cons.cpf} • Tel: {cons.phone || '—'} • E-mail: {cons.email || '—'} •
                              Comissão: <strong>{cons.commissionType === 'FIXED' ? `${formatCurrency(cons.commissionValue || 0)} fixo` : `${cons.commissionPercent || 10}%`}</strong>
                            </div>
                          </div>
                          {consultantReportSubFilter === 'COMISSAO' ? (
                            <div className="text-right">
                              <div className="text-[11px] text-slate-500">
                                {metrics.paidCount} venda(s) paga(s) ({metrics.linkedSubs.length} adesões) • Total Contratos:{' '}
                                {formatCurrency(metrics.totalPaidVolume)}
                              </div>
                              <div className="text-sm font-black text-emerald-700">
                                Comissão a Pagar:{' '}
                                {formatCurrency(metrics.totalPaidCommission)}
                              </div>
                            </div>
                          ) : (
                            <Badge className="bg-emerald-700 text-white">
                              {cons.status === 'ACTIVE' ? 'ATIVO' : 'INATIVO'} •{' '}
                              {metrics.paidCount} paga(s) / {metrics.linkedSubs.length} cliente(s)
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
                      const metrics = getConsultantSubscriptionMetrics(
                        inf,
                        state.subscriptions || []
                      );
                      return (
                        <div
                          key={inf.id}
                          className="p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 text-xs"
                        >
                          <div>
                            <div className="font-black text-sm text-slate-900 flex items-center gap-2">
                              {inf.name}
                              <Badge className="bg-amber-600 text-white">
                                INFLUENCER • {inf.referralCode}
                              </Badge>
                            </div>
                            <div className="text-slate-600 mt-0.5">
                              CPF: {inf.cpf} • Tel: {inf.phone || '—'} • E-mail: {inf.email || '—'} •
                              Comissão: <strong>{inf.commissionType === 'FIXED' ? `${formatCurrency(inf.commissionValue || 0)} fixo` : `${inf.commissionPercent || 10}%`}</strong>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] text-slate-500">
                              Total Pago: {formatCurrency(metrics.totalPaidVolume)} • Comissão: <strong className="text-emerald-700">{formatCurrency(metrics.totalPaidCommission)}</strong>
                            </div>
                            <Badge className="bg-emerald-700 text-white mt-1">
                              {metrics.paidCount} paga(s) / {metrics.linkedSubs.length} indicação(ões)
                            </Badge>
                          </div>
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

          {(configSection === 'TERMO_USO_SITE' || configSection === 'CONTRATOS') && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-2xl font-normal text-slate-800 tracking-tight">
                      Termo de Uso
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Edição e gestão do Termo de Uso e Adesão Oficial do Balneário Família Lessa.
                    </p>
                  </div>
                </div>

                {/* BARRA DE FERRAMENTAS ESTILO CKEDITOR / RICH TEXT (Idêntica à Imagem 1) */}
                <div className="border border-slate-300 rounded-lg bg-[#f8fafc] overflow-hidden shadow-sm">
                  {/* Linha 1: Código-Fonte, Ações e Formulários */}
                  <div className="flex flex-wrap items-center gap-1 p-1.5 border-b border-slate-200 bg-[#f1f5f9] text-slate-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setIsSiteTermsSourceMode(!isSiteTermsSourceMode)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${
                        isSiteTermsSourceMode
                          ? 'bg-emerald-700 text-white border-emerald-800'
                          : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                      }`}
                      title="Alternar Código-Fonte / Visualização"
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Código-Fonte</span>
                    </button>
                    <div className="h-4 w-px bg-slate-300 mx-1" />
                    <button
                      type="button"
                      onClick={handleSaveSiteTerms}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-700"
                      title="Salvar"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-700"
                      title="Imprimir"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <div className="h-4 w-px bg-slate-300 mx-1" />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(siteTermsText);
                        toast({ title: 'Texto copiado para a área de transferência!' });
                      }}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-700"
                      title="Copiar"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => document.execCommand('undo')}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-700"
                      title="Desfazer"
                    >
                      <Undo className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => document.execCommand('redo')}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-700"
                      title="Refazer"
                    >
                      <Redo className="w-3.5 h-3.5" />
                    </button>
                    <div className="h-4 w-px bg-slate-300 mx-1" />
                    <button
                      type="button"
                      onClick={() => {
                        const q = prompt('Buscar termo no texto:');
                        if (q) window.find && window.find(q);
                      }}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-700"
                      title="Localizar"
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => document.execCommand('selectAll')}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-700"
                      title="Selecionar Tudo"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Linha 2: B, I, U, S, Alinhamentos, Listas */}
                  <div className="flex flex-wrap items-center gap-1 p-1.5 border-b border-slate-200 bg-[#f8fafc] text-slate-700 text-xs">
                    <button
                      type="button"
                      onClick={() => document.execCommand('bold')}
                      className="px-2 py-0.5 hover:bg-white rounded font-bold border border-transparent hover:border-slate-300"
                      title="Negrito"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => document.execCommand('italic')}
                      className="px-2 py-0.5 hover:bg-white rounded italic font-serif border border-transparent hover:border-slate-300"
                      title="Itálico"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => document.execCommand('underline')}
                      className="px-2 py-0.5 hover:bg-white rounded underline border border-transparent hover:border-slate-300"
                      title="Sublinhado"
                    >
                      U
                    </button>
                    <button
                      type="button"
                      onClick={() => document.execCommand('strikeThrough')}
                      className="px-2 py-0.5 hover:bg-white rounded line-through border border-transparent hover:border-slate-300"
                      title="Tachado"
                    >
                      S
                    </button>
                    <span className="px-1 text-[11px] text-slate-400">|</span>
                    <button
                      type="button"
                      onClick={() => document.execCommand('insertOrderedList')}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300"
                      title="Lista Numerada"
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => document.execCommand('insertUnorderedList')}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300"
                      title="Lista com Marcadores"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => document.execCommand('outdent')}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300"
                      title="Diminuir Recuo"
                    >
                      <Outdent className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => document.execCommand('indent')}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300"
                      title="Aumentar Recuo"
                    >
                      <Indent className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-1 text-[11px] text-slate-400">|</span>
                    <button
                      type="button"
                      onClick={() => document.execCommand('justifyLeft')}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300"
                      title="Alinhar à Esquerda"
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => document.execCommand('justifyCenter')}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300"
                      title="Centralizar"
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => document.execCommand('justifyRight')}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300"
                      title="Alinhar à Direita"
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => document.execCommand('justifyFull')}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300"
                      title="Justificar"
                    >
                      <AlignJustify className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Linha 3: Selects Estilo, Formatação, Fonte, Tamanho */}
                  <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#f1f5f9] text-slate-700 text-xs">
                    <select
                      className="h-7 text-xs px-2 rounded border border-slate-300 bg-white"
                      defaultValue="Estilo"
                    >
                      <option value="Estilo">Estilo</option>
                      <option value="normal">Normal</option>
                      <option value="destaque">Destaque</option>
                    </select>
                    <select
                      className="h-7 text-xs px-2 rounded border border-slate-300 bg-white"
                      defaultValue="Formatação"
                    >
                      <option value="Formatação">Formatação</option>
                      <option value="p">Parágrafo</option>
                      <option value="h1">Título 1</option>
                      <option value="h2">Título 2</option>
                      <option value="h3">Título 3</option>
                    </select>
                    <select
                      className="h-7 text-xs px-2 rounded border border-slate-300 bg-white"
                      defaultValue="Fonte"
                    >
                      <option value="Fonte">Fonte</option>
                      <option value="Arial">Arial</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Verdana">Verdana</option>
                      <option value="Courier New">Courier New</option>
                    </select>
                    <select
                      className="h-7 text-xs px-2 rounded border border-slate-300 bg-white"
                      defaultValue="Tamanho"
                    >
                      <option value="Tamanho">Tamanho</option>
                      <option value="11px">11 px</option>
                      <option value="12px">12 px</option>
                      <option value="13px">13.5 px</option>
                      <option value="14px">14 px</option>
                      <option value="16px">16 px</option>
                      <option value="18px">18 px</option>
                    </select>
                    <div className="h-4 w-px bg-slate-300 mx-1" />
                    <button
                      type="button"
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-800 font-bold"
                      title="Cor do Texto"
                    >
                      <span className="border-b-2 border-red-500 px-0.5">A</span>
                    </button>
                    <button
                      type="button"
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-800 font-bold"
                      title="Cor de Fundo"
                    >
                      <span className="bg-amber-200 px-1 rounded">A</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSiteTermsSourceMode(!isSiteTermsSourceMode)}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-700 ml-auto"
                      title="Maximizar Editor"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Canvas do Documento (Visual ou Código-Fonte) */}
                  <div className="p-3 bg-white">
                    {isSiteTermsSourceMode ? (
                      <textarea
                        value={siteTermsText}
                        onChange={(e) => setSiteTermsText(e.target.value)}
                        className="w-full min-h-[480px] p-4 font-mono text-xs text-slate-800 border border-slate-300 rounded bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-700 leading-relaxed"
                        placeholder="Insira o texto ou HTML oficial dos termos de uso..."
                      />
                    ) : (
                      <textarea
                        value={siteTermsText}
                        onChange={(e) => setSiteTermsText(e.target.value)}
                        className="w-full min-h-[480px] p-6 font-sans text-[13.5px] leading-relaxed text-slate-900 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 resize-y whitespace-pre-wrap"
                        placeholder="Texto oficial dos Termos de Uso..."
                      />
                    )}
                  </div>
                </div>

                {/* Botão SALVAR idêntico à Imagem 1 (embaixo à esquerda) */}
                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleSaveSiteTerms}
                    className="px-6 py-2 border border-slate-400 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 text-xs font-semibold rounded shadow-sm tracking-wide transition-all"
                  >
                    SALVAR
                  </button>
                  <Button
                    size="sm"
                    onClick={handleSaveSiteTerms}
                    className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs"
                  >
                    <Save className="w-4 h-4 mr-1.5" /> Salvar e Aplicar em Todo o Sistema
                  </Button>
                </div>
              </div>

              {/* MODELOS OFICIAIS DE CONTRATOS (Preenchimento Dinâmico - Imagem 3) */}
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
                  {(state.contractTemplates || []).map((tpl) => (
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
                    <a href="/consultor" target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" className="text-xs font-bold">
                        Portal do Consultor (/consultor)
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
                        : subscription.status === 'PENDING_TRANSFER'
                        ? 'border-amber-400 bg-amber-50/50'
                        : 'border-rose-400 bg-rose-50/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          className={
                            subscription.status === 'ACTIVE'
                              ? 'bg-emerald-600 text-white'
                              : subscription.status === 'PENDING_TRANSFER'
                              ? 'bg-amber-600 text-white'
                              : 'bg-rose-600 text-white'
                          }
                        >
                          {subscription.status === 'ACTIVE'
                            ? 'STATUS: ATIVO (LIBERADO)'
                            : subscription.status === 'PENDING_TRANSFER'
                            ? 'STATUS: PENDENTE P/ TRANSFERÊNCIA'
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
                        : selectedSubForDetail.status === 'PENDING_TRANSFER'
                        ? 'bg-amber-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    STATUS ATUAL:{' '}
                    {selectedSubForDetail.status === 'ACTIVE'
                      ? 'ATIVO (LIBERADO)'
                      : selectedSubForDetail.status === 'PENDING_TRANSFER'
                      ? 'PENDENTE PARA TRANSFERÊNCIA'
                      : 'INATIVO (AGUARDANDO PAGTO)'}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedSubForDetail(null)}
                    className="h-8 border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-950 font-bold text-xs w-full sm:w-auto"
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
                        Plano Selecionado do Titular
                      </Label>
                      <div className="mt-1 h-10 px-3 rounded-md border border-emerald-300 bg-emerald-50 flex items-center justify-between text-xs font-black text-emerald-950">
                        <span className="truncate">
                          {selectedSubForDetail.members.find((m) => m.role === 'TITULAR')
                            ?.modalityName ||
                            selectedSubForDetail.members[0]?.modalityName ||
                            'Não identificado'}
                        </span>
                        <Badge className="bg-emerald-700 text-white text-[10px] shrink-0 ml-2">
                          TITULAR
                        </Badge>
                      </div>
                    </div>

                    <div className="sm:col-span-12">
                      <Label className="text-xs font-bold text-slate-700">
                        Plano / Descrição Completa do Contrato
                      </Label>
                      <Textarea
                        rows={2}
                        value={editClientData.planSummaryLabel}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            planSummaryLabel: e.target.value,
                          })
                        }
                        className="mt-1 font-semibold text-sm resize-y"
                      />
                    </div>

                    {/* COMPOSIÇÃO COMPLETA DA FICHA: NOME E PLANO DE CADA INTEGRANTE (TITULAR + DEPENDENTES) */}
                    <div className="sm:col-span-12 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-black uppercase text-emerald-950 flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-emerald-700" />
                          Integrantes da Assinatura ({selectedSubForDetail.members.length}): Nome e Plano de Cada Pessoa
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setClientDetailTool('ANEXOS')}
                          className="h-7 text-[11px] font-bold border-emerald-600 text-emerald-900 bg-white"
                        >
                          <Paperclip className="w-3 h-3 mr-1" /> Ver / Anexar Documentos
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {selectedSubForDetail.members.map((m, idx) => {
                          const docMissing = isMemberBlockedForMissingDoc(m, selectedSubForDetail);
                          const hasDoc = memberHasProofDocument(m, selectedSubForDetail);
                          const rule = getPlanDocumentRule(m.modalityCode, m.modalityName);
                          const effExp = m.expirationDate || selectedSubForDetail.endDate;
                          const isExpired = isClubDateExpired(effExp);
                          const isDep = m.role === 'DEPENDENTE';
                          const draftExp = depExpDrafts[m.id] ?? m.expirationDate ?? '';
                          return (
                            <div
                              key={m.id}
                              className={`bg-white rounded-xl border p-3 flex flex-col gap-2 text-xs shadow-sm ${
                                isExpired
                                  ? 'border-rose-300 bg-rose-50/40'
                                  : m.status !== 'ACTIVE'
                                  ? 'border-slate-300 bg-slate-50/70'
                                  : 'border-slate-200'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <span className="font-black text-slate-900">
                                  {idx === 0 || m.role === 'TITULAR' ? '👑 TITULAR' : `👤 DEPENDENTE #${idx}`}:{' '}
                                  {m.fullName}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <Badge
                                    className={
                                      isExpired || docMissing || m.status !== 'ACTIVE'
                                        ? 'bg-rose-600 text-white text-[10px]'
                                        : 'bg-emerald-600 text-white text-[10px]'
                                    }
                                  >
                                    {isExpired
                                      ? 'EXPIRADO'
                                      : docMissing
                                      ? 'INATIVO (FALTA DOC)'
                                      : m.status === 'ACTIVE'
                                      ? 'ATIVO'
                                      : m.status === 'PENDING_TRANSFER'
                                      ? 'PEND. TRANSF.'
                                      : 'INATIVO'}
                                  </Badge>
                                  {isDep && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleToggleMemberStatus(
                                          selectedSubForDetail,
                                          m.id,
                                          m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
                                        )
                                      }
                                      className={`h-6 px-2 text-[10px] font-bold cursor-pointer ${
                                        m.status === 'ACTIVE'
                                          ? 'border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100'
                                          : 'border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                                      }`}
                                    >
                                      {m.status === 'ACTIVE' ? 'Inativar' : 'Ativar'}
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div className="text-emerald-900 font-bold">
                                Plano: {m.planCycleLabel || m.modalityName}
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                                <span>
                                  Cartão: <strong className="font-mono text-slate-700">{m.cardNumber}</strong> • CPF: {m.cpf || '-'}
                                </span>
                                {rule.requiresDocument && (
                                  <span
                                    className={
                                      hasDoc
                                        ? 'text-emerald-700 font-bold'
                                        : 'text-rose-600 font-bold'
                                    }
                                  >
                                    {hasDoc ? '✔ Doc. anexado' : '⚠ Sem doc. anexado'}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                                <span className={`text-[11px] font-semibold ${isExpired ? 'text-rose-700' : 'text-slate-600'}`}>
                                  Expiração: <strong>{effExp ? formatDateBR(effExp) : 'Não definida'}</strong>
                                  {m.expirationDate ? '' : ' (geral)'}
                                </span>
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="date"
                                    value={draftExp}
                                    onChange={(e) =>
                                      setDepExpDrafts((prev) => ({
                                        ...prev,
                                        [m.id]: e.target.value,
                                      }))
                                    }
                                    className="h-7 text-[11px] w-32 bg-white px-2"
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleUpdateMemberExpirationDate(
                                        selectedSubForDetail,
                                        m.id,
                                        draftExp
                                      )
                                    }
                                    className="h-7 px-2 text-[10px] font-bold border-emerald-600 text-emerald-900 bg-white hover:bg-emerald-50 cursor-pointer"
                                  >
                                    Salvar Data
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="sm:col-span-3">
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
                    <div className="sm:col-span-3">
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
                    <div className="sm:col-span-3">
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
                    <div className="sm:col-span-3">
                      <Label className="text-xs font-bold text-slate-700">
                        Data de Expiração do Cadastro
                      </Label>
                      <Input
                        type="date"
                        value={editClientData.endDate}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            endDate: e.target.value,
                          })
                        }
                        className="mt-1 font-semibold bg-white"
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
                                : selectedSubForDetail?.status === 'PENDING_TRANSFER'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}
                          >
                            {situacaoLiberar === 'SIM' && situacaoInativar === 'NAO'
                              ? 'ATIVO'
                              : selectedSubForDetail?.status === 'PENDING_TRANSFER'
                              ? 'PENDENTE P/ TRANSFERÊNCIA'
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
                          className="bg-[#004d00] hover:bg-emerald-900 text-white font-black uppercase tracking-wider px-4 sm:px-5 h-9 rounded-md shadow shrink-0 text-xs cursor-pointer"
                        >
                          SALVAR
                        </Button>
                      </div>
                    </div>

                    {lastRegistrationChangeBox && (
                      <div
                        className={`rounded-xl border-2 p-3 flex flex-wrap items-center justify-between gap-2 text-xs ${
                          lastRegistrationChangeBox.isActive
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                            : 'bg-rose-50 border-rose-400 text-rose-950'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <CheckCircle2
                            className={`w-4 h-4 mt-0.5 shrink-0 ${
                              lastRegistrationChangeBox.isActive ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          />
                          <div>
                            <div className="font-black uppercase tracking-wide">
                              {lastRegistrationChangeBox.title} ({lastRegistrationChangeBox.changedAt})
                            </div>
                            <div className="font-medium mt-0.5">{lastRegistrationChangeBox.detail}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLastRegistrationChangeBox(null)}
                          className="text-[11px] font-bold px-2 py-1 rounded border border-current/25 hover:bg-white/60 cursor-pointer"
                        >
                          Fechar aviso
                        </button>
                      </div>
                    )}
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
                    .map((holderMember) => {
                      const holderMissingDoc = isMemberBlockedForMissingDoc(
                        holderMember,
                        selectedSubForDetail
                      );
                      const holderEffExp = holderMember.expirationDate || selectedSubForDetail.endDate;
                      const holderExpired = isClubDateExpired(holderEffExp);
                      const holderLocked =
                        holderMissingDoc || holderMember.status !== 'ACTIVE' || holderExpired;
                      return (
                        <div key={holderMember.id} className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="bg-emerald-800 text-white font-black">
                                TITULAR
                              </Badge>
                              <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">
                                1. Carteirinha do Titular ({holderMember.fullName})
                              </h4>
                              <Badge
                                className={
                                  holderExpired || holderMember.status !== 'ACTIVE'
                                    ? 'bg-rose-600 text-white text-[10px]'
                                    : 'bg-emerald-600 text-white text-[10px]'
                                }
                              >
                                {holderExpired
                                  ? `EXPIRADO (${formatDateBR(holderEffExp)})`
                                  : holderMember.status === 'ACTIVE'
                                  ? `ATIVO • Exp: ${formatDateBR(holderEffExp)}`
                                  : 'INATIVO'}
                              </Badge>
                            </div>
                            {holderMissingDoc && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setClientDetailTool('ANEXOS')}
                                className="h-7 text-[11px] font-bold border-rose-400 text-rose-700 bg-rose-50 hover:bg-rose-100"
                              >
                                ⚠ Comprovante Pendente — Anexar/Aprovar
                              </Button>
                            )}
                          </div>
                          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                            <ClubMemberCardView
                              member={holderMember}
                              showBackSide={true}
                              locked={holderLocked}
                              lockReason={
                                holderMissingDoc
                                  ? `Falta documento comprobatório (${holderMember.modalityName})`
                                  : holderExpired
                                  ? `Cadastro expirado em ${formatDateBR(holderEffExp)}`
                                  : holderMember.status !== 'ACTIVE'
                                  ? 'Cadastro INATIVO'
                                  : undefined
                              }
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
                      );
                    })}

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
                          .map((depMember, depIdx) => {
                            const depMissingDoc = isMemberBlockedForMissingDoc(
                              depMember,
                              selectedSubForDetail
                            );
                            const depEffExp = depMember.expirationDate || selectedSubForDetail.endDate;
                            const depExpired = isClubDateExpired(depEffExp);
                            const depLocked =
                              depMissingDoc || depMember.status !== 'ACTIVE' || depExpired;
                            return (
                              <div
                                key={depMember.id}
                                className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-200/80">
                                  <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <strong className="text-slate-900">{depMember.fullName}</strong>
                                    <Badge
                                      className={
                                        depExpired || depMember.status !== 'ACTIVE'
                                          ? 'bg-rose-600 text-white text-[10px]'
                                          : 'bg-emerald-600 text-white text-[10px]'
                                      }
                                    >
                                      {depExpired
                                        ? `EXPIRADO (${formatDateBR(depEffExp)})`
                                        : depMember.status === 'ACTIVE'
                                        ? 'ATIVO'
                                        : 'INATIVO'}
                                    </Badge>
                                    {depEffExp && (
                                      <span className="text-[11px] text-slate-600 font-medium">
                                        Expira em: <strong>{formatDateBR(depEffExp)}</strong>
                                      </span>
                                    )}
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleToggleMemberStatus(
                                        selectedSubForDetail,
                                        depMember.id,
                                        depMember.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
                                      )
                                    }
                                    className={`h-7 px-2.5 text-[11px] font-bold cursor-pointer ${
                                      depMember.status === 'ACTIVE'
                                        ? 'border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100'
                                        : 'border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                                    }`}
                                  >
                                    {depMember.status === 'ACTIVE'
                                      ? 'Inativar Dependente'
                                      : 'Ativar Dependente'}
                                  </Button>
                                </div>
                                {depMissingDoc && (
                                  <div className="flex flex-wrap items-center justify-between gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-xs text-rose-800">
                                    <span className="font-bold">
                                      ⚠ Carteirinha inativa/bloqueada: falta comprovação documental para {depMember.modalityName}.
                                    </span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setClientDetailTool('ANEXOS')}
                                      className="h-7 text-[11px] font-bold border-rose-400 text-rose-700 bg-white"
                                    >
                                      Anexar / Aprovar na aba Anexos
                                    </Button>
                                  </div>
                                )}
                                <ClubMemberCardView
                                  member={depMember}
                                  dependentIndex={depIdx + 1}
                                  showBackSide={true}
                                  locked={depLocked}
                                  lockReason={
                                    depMissingDoc
                                      ? `Falta documento comprobatório (${depMember.modalityName})`
                                      : depExpired
                                      ? `Cadastro expirado em ${formatDateBR(depEffExp)}`
                                      : depMember.status !== 'ACTIVE'
                                      ? 'Dependente INATIVO individualmente'
                                      : undefined
                                  }
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
                            );
                          })}
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
              {clientDetailTool === 'FINANCEIRO_CLIENTE' && (() => {
                const planBreakdown = getSubscriptionPlanBreakdown(selectedSubForDetail);
                const allInvoices = selectedSubForDetail.invoices || [];
                const availableCarneGroups = Array.from(
                  new Set(allInvoices.map((inv) => String(Number(inv.carneGroup) || 1)))
                ).sort((a, b) => Number(a) - Number(b));
                const filteredInvoices =
                  selectedCarneNumber === 'ALL'
                    ? allInvoices
                    : allInvoices.filter(
                        (inv) => String(Number(inv.carneGroup) || 1) === selectedCarneNumber
                      );

                return (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
                  {/* Título Perfil financeiro - NOME DO CLIENTE */}
                  <div className="border-b border-slate-200 pb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xl font-normal text-slate-700">
                      Perfil financeiro -{' '}
                      <span className="underline font-semibold text-slate-900 uppercase">
                        {selectedSubForDetail.holderName}
                      </span>
                    </h3>
                    <div className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5">
                      Soma dos planos selecionados:{' '}
                      <span className="text-[#004d00] font-black">
                        {formatCurrency(planBreakdown.total)}/mês
                      </span>
                    </div>
                  </div>

                  {/* Faixa verde-clara superior com botões ADD CARNÊ e VOLTAR */}
                  <div className="bg-[#dff0d8] border border-[#d6e9c6] rounded-md py-3 px-4 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const calcTotal = getSubscriptionPlanMonthlyTotal(selectedSubForDetail);
                        const todayIso = new Date().toISOString().split('T')[0];
                        const nextMonthDate = new Date();
                        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
                        const preferredDay = selectedSubForDetail.dueDay || nextMonthDate.getDate();
                        const maxD = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, 0).getDate();
                        nextMonthDate.setDate(Math.min(preferredDay, maxD));

                        setCarneInstallmentValue(calcTotal.toFixed(2));
                        setCarneAdhesionDueDate(todayIso);
                        setCarneFirstDueDate(nextMonthDate.toISOString().split('T')[0]);
                        setCarneInstallmentCount(selectedSubForDetail.installments || 12);
                        setCarneDescription(
                          selectedSubForDetail.planSummaryLabel
                            ? `Mensalidade - ${selectedSubForDetail.planSummaryLabel}`
                            : 'Mensalidade'
                        );
                        setCarneRecurrenceMode(
                          selectedSubForDetail.registeredCard?.last4Digits
                            ? 'REGISTERED_CARD'
                            : 'NONE'
                        );
                        setCarneEmitAsaasOnCreate(false);
                        setCarneModalOpen(true);
                      }}
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
                        <option value="ALL">Todos os Carnês ({allInvoices.length})</option>
                        {availableCarneGroups.map((grp) => {
                          const cnt = allInvoices.filter(
                            (inv) => String(Number(inv.carneGroup) || 1) === grp
                          ).length;
                          return (
                            <option key={grp} value={grp}>
                              Carnê {grp} ({cnt} parcelas)
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        toast({
                          title:
                            selectedCarneNumber === 'ALL'
                              ? 'Todos os carnês carregados'
                              : `Carnê ${selectedCarneNumber} carregado`,
                          description: `Exibindo ${filteredInvoices.length} parcela(s) do cliente.`,
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
                          min="0"
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
                          const parsedEditAmt = Number(String(editInvAmount).replace(',', '.'));
                          const newAmount =
                            Number.isFinite(parsedEditAmt) && parsedEditAmt >= 0
                              ? Number(parsedEditAmt.toFixed(2))
                              : targetInv?.amount ?? 0;

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
                                    referenceMonth: newDueDate
                                      ? `${newDueDate.slice(5, 7)}/${newDueDate.slice(0, 4)}`
                                      : inv.referenceMonth,
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
                        className="h-8 bg-[#004d00] hover:bg-emerald-900 text-white text-xs font-bold"
                      >
                        Salvar Parcela
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingClientInvoiceId(null)}
                        className="h-8 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        Cancelar
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
                          <th className="py-2.5 px-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span>EXCLUIR</span>
                              <input
                                type="checkbox"
                                title="Selecionar/Desmarcar todas"
                                checked={
                                  filteredInvoices.length > 0 &&
                                  filteredInvoices.every((inv) =>
                                    selectedClientInvoiceIdsForDelete.includes(inv.id)
                                  )
                                }
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedClientInvoiceIdsForDelete(
                                      filteredInvoices.map((inv) => inv.id)
                                    );
                                  } else {
                                    setSelectedClientInvoiceIdsForDelete([]);
                                  }
                                }}
                                className="w-3.5 h-3.5 rounded cursor-pointer"
                              />
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-800/80">
                        {filteredInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-6 text-center text-emerald-100/80 font-medium">
                              Nenhuma parcela encontrada para este filtro. Clique em + ADD CARNÊ ou FATURA AVULSA para lançar cobranças.
                            </td>
                          </tr>
                        ) : (
                        filteredInvoices.map((inv, idx) => {
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
                                <div className="flex flex-col gap-0.5">
                                  <span>{inv.description || 'Mensalidade'}</span>
                                  <div className="flex flex-wrap items-center gap-1 text-[10px]">
                                    <span className="bg-emerald-950/60 text-emerald-200 px-1.5 py-0.2 rounded">
                                      Carnê {Number(inv.carneGroup) || 1}
                                    </span>
                                    {inv.invoiceKind === 'AVULSA' && (
                                      <span className="bg-sky-500/30 text-sky-100 px-1.5 py-0.2 rounded font-semibold">
                                        AVULSA
                                      </span>
                                    )}
                                    {inv.asaasPaymentId && (
                                      <span className="bg-emerald-400/20 text-emerald-200 px-1.5 py-0.2 rounded font-semibold">
                                        Asaas ✓
                                      </span>
                                    )}
                                  </div>
                                </div>
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

                                  {/* 3. Botão Vermelho X (Estornar ou Excluir com confirmação obrigatória) */}
                                  <button
                                    type="button"
                                    title={
                                      isPaid
                                        ? 'Estornar pagamento ou excluir parcela (com confirmação)'
                                        : 'Excluir / cancelar parcela (com confirmação)'
                                    }
                                    onClick={() =>
                                      setInvoiceDeleteConfirm({
                                        mode: 'SINGLE',
                                        invoice: inv,
                                      })
                                    }
                                    className="w-7 h-7 rounded bg-[#d9534f] hover:bg-rose-700 text-white flex items-center justify-center shadow-sm border border-white/20"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>

                                  {/* 4. Botão Verde Check (Dar Baixa / PAGO) */}
                                  <button
                                    type="button"
                                    title={
                                      isPaid
                                        ? 'Parcela já quitada'
                                        : 'Dar Baixa (Marcar como PAGO e liberar cliente)'
                                    }
                                    onClick={async () => {
                                      if (isPaid) {
                                        toast({
                                          title: `Parcela ${inv.installmentNumber} já está PAGA`,
                                          description: inv.paidAt
                                            ? `Recebida em ${formatDateBR(inv.paidAt)}.`
                                            : undefined,
                                        });
                                        return;
                                      }
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
                                    className={`w-7 h-7 rounded ${
                                      isPaid
                                        ? 'bg-emerald-800/70 opacity-75'
                                        : 'bg-[#5cb85c] hover:bg-emerald-500'
                                    } text-white flex items-center justify-center shadow-sm border border-white/20`}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>

                                  {/* 5. Botão Azul (PIX / Boleto Asaas da Parcela) */}
                                  <button
                                    type="button"
                                    title="Visualizar / Gerar Cobrança PIX, Boleto ou Cartão no Asaas"
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
                        })
                        )}
                      </tbody>
                    </table>

                    {/* Rodapé da tabela com botão Excluir Selecionados (sempre exige confirmação) */}
                    <div className="bg-[#004d00] border-t border-emerald-800 px-3 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-emerald-100/80">
                        {selectedClientInvoiceIdsForDelete.length > 0
                          ? `${selectedClientInvoiceIdsForDelete.length} parcela(s) selecionada(s) para exclusão`
                          : 'Marque na coluna EXCLUIR para remover parcelas em lote'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedClientInvoiceIdsForDelete.length === 0) {
                            toast({
                              title: 'Selecione ao menos uma parcela na coluna EXCLUIR',
                              variant: 'destructive',
                            });
                            return;
                          }
                          const selectedInvs = selectedSubForDetail.invoices.filter((i) =>
                            selectedClientInvoiceIdsForDelete.includes(i.id)
                          );
                          setInvoiceDeleteConfirm({
                            mode: 'BULK',
                            invoices: selectedInvs,
                          });
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-1.5 rounded shadow-sm flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Excluir Selecionados
                      </button>
                    </div>
                  </div>

                  {/* BARRA INFERIOR COM OS 4 BOTÕES AZUIS (IDÊNTICA À IMAGEM ENVIADA) */}
                  <div className="bg-[#e8f4f8] border border-[#bce8f1] rounded-md p-3 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setAvulsaDueDate(new Date().toISOString().split('T')[0]);
                        setAvulsaAmount('');
                        setAvulsaDesc('');
                        setAvulsaEmitAsaas(true);
                        setShowFaturaAvulsaForm(true);
                      }}
                      className="bg-[#5bc0de] hover:bg-[#31b0d5] text-white font-bold text-xs uppercase px-4 py-2 rounded shadow-sm flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" /> FATURA AVULSA
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const eligible = filteredInvoices.filter(
                          (inv) =>
                            inv.status !== 'PAID' &&
                            inv.status !== 'CANCELLED' &&
                            !inv.asaasPaymentId &&
                            inv.invoiceKind !== 'AVULSA' &&
                            inv.invoiceKind !== 'ADESAO' &&
                            inv.amount > 0
                        );
                        const nextDue =
                          eligible[0]?.dueDate ||
                          filteredInvoices.find((i) => i.status !== 'PAID' && i.amount > 0)?.dueDate ||
                          new Date().toISOString().split('T')[0];
                        const parsedDue = new Date(`${nextDue}T12:00:00`);
                        setGerarCarneAsaasCount(eligible.length > 0 ? eligible.length : 12);
                        setGerarCarneAsaasFirstDue(nextDue);
                        setGerarCarneAsaasDueDay(
                          selectedSubForDetail.dueDay || parsedDue.getDate() || 10
                        );
                        setGerarCarneAsaasBillingType('UNDEFINED');
                        setGerarCarneAsaasRecurrence(
                          selectedSubForDetail.registeredCard?.last4Digits
                            ? 'REGISTERED_CARD'
                            : 'NONE'
                        );
                        setGerarCarneAsaasModalOpen(true);
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
                        handlePrintCarneSimples({
                          ...selectedSubForDetail,
                          invoices: filteredInvoices,
                        })
                      }
                      className="bg-[#5bc0de] hover:bg-[#31b0d5] text-white font-bold text-xs uppercase px-4 py-2 rounded shadow-sm flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" /> CARNÊ SIMPLES
                    </button>
                  </div>
                </div>
                );
              })()}

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
                                if (selectedInvoiceForPixModal.amount <= 0) {
                                  toast({
                                    title: 'Parcela gratuita / isenta (R$ 0,00)',
                                    description: 'Não é necessário emitir cobrança no Asaas para parcelas com valor R$ 0,00.',
                                  });
                                  return;
                                }
                                setLoadingRowPix(true);
                                try {
                                  const charge = await generateAsaasChargeForClubInvoice(
                                    selectedSubForDetail,
                                    selectedInvoiceForPixModal,
                                    'PIX'
                                  );
                                  const updatedInv: ClubInvoice = {
                                    ...selectedInvoiceForPixModal,
                                    asaasPaymentId: charge.paymentId,
                                    invoiceUrl: charge.invoiceUrl,
                                    pixPayload: charge.pixPayload,
                                    pixQrCode: charge.pixQrCode,
                                  };
                                  setSelectedInvoiceForPixModal(updatedInv);
                                  const refreshedSub: ClubSubscription = {
                                    ...selectedSubForDetail,
                                    asaasPaymentId: charge.paymentId,
                                    asaasInvoiceUrl: charge.invoiceUrl,
                                    invoices: selectedSubForDetail.invoices.map((i) =>
                                      i.id === updatedInv.id ? updatedInv : i
                                    ),
                                  };
                                  setSelectedSubForDetail(refreshedSub);
                                  if (state) {
                                    setState({
                                      ...state,
                                      subscriptions: state.subscriptions.map((s) =>
                                        s.id === refreshedSub.id ? refreshedSub : s
                                      ),
                                    });
                                  }
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

              {/* MODAL LINK DE CARTÃO / TODOS EM CARTÃO (LINK ÚNICO DE QUITAÇÃO) */}
              <Dialog
                open={unifiedCardModalOpen}
                onOpenChange={(o) => !o && setUnifiedCardModalOpen(false)}
              >
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-black text-slate-800 text-center flex items-center justify-center gap-2">
                      <CreditCard className="w-5 h-5 text-emerald-700" />
                      LINK DE CARTÃO
                    </DialogTitle>
                  </DialogHeader>

                  {(() => {
                    const pending = selectedSubForDetail.invoices.filter(
                      (i) => i.status !== 'PAID' && i.status !== 'CANCELLED' && i.amount > 0
                    );
                    const totalPendingVal = Number(
                      pending.reduce((acc, i) => acc + i.amount, 0).toFixed(2)
                    );

                    return (
                      <div className="space-y-4 py-1 text-xs">
                        <div className="text-center space-y-2 border-b border-slate-200 pb-3">
                          <p className="text-sm font-medium text-slate-800">
                            Deseja transformar esse grupo de cobranças em um <strong>LINK DE CARTÃO</strong>?
                          </p>
                          <p className="text-[11px] text-red-600 leading-relaxed">
                            Ps.: Obrigatoriamente, todas as parcelas incluídas no <strong>LINK DE CARTÃO</strong> deverão ter o mesmo valor, dias de vencimento iguais e meses subsequentes. Parcelas com diferentes valores serão somadas e unificadas em um link exclusivo para pagamento via cartão.
                          </p>
                        </div>

                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                          <div className="flex justify-between font-bold text-slate-700">
                            <span>Associado:</span>
                            <span>{selectedSubForDetail.holderName} (#{selectedSubForDetail.subscriptionCode})</span>
                          </div>
                          <div className="flex justify-between font-bold text-slate-700">
                            <span>Parcelas em aberto com valor:</span>
                            <span>{pending.length} parcela(s)</span>
                          </div>
                          <div className="flex justify-between font-black text-sm text-emerald-900 border-t border-emerald-200 pt-1.5">
                            <span>Valor Total no Cartão:</span>
                            <span>{formatCurrency(totalPendingVal)}</span>
                          </div>
                        </div>

                        {totalPendingVal > 0 && (
                          <div>
                            <Label className="text-xs font-bold text-slate-700 mb-1.5 block">
                              Simulação de Parcelamento no Cartão (Cliente paga em 1 cobrança única):
                            </Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium">
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
                        )}

                        {!unifiedCardUrl ? (
                          <div className="flex items-center justify-center gap-3 pt-2 border-t border-slate-200">
                            <Button
                              type="button"
                              onClick={() => setUnifiedCardModalOpen(false)}
                              className="bg-[#d9534f] hover:bg-rose-700 text-white font-bold text-xs uppercase px-5 h-10"
                            >
                              FECHAR JANELA
                            </Button>
                            <Button
                              type="button"
                              disabled={unifiedCardLoading || pending.length === 0 || totalPendingVal <= 0}
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
                                    title: 'Link de Cartão gerado no Asaas!',
                                    description: `Total: ${formatCurrency(totalPendingVal)} para pagamento via cartão.`,
                                  });
                                } catch (err: any) {
                                  toast({
                                    title: 'Não foi possível gerar o link no Asaas',
                                    description: err?.message || 'Verifique o CPF do cliente e a integração Asaas.',
                                    variant: 'destructive',
                                  });
                                } finally {
                                  setUnifiedCardLoading(false);
                                }
                              }}
                              className="bg-[#5cb85c] hover:bg-emerald-600 text-white font-bold text-xs uppercase px-5 h-10"
                            >
                              {unifiedCardLoading
                                ? 'GERANDO LINK...'
                                : 'GERAR LINK DE CARTÃO!'}
                            </Button>
                          </div>
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
                                <Button type="button" variant="outline" className="w-full text-xs font-bold bg-white text-slate-800 hover:bg-slate-100 h-9">
                                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir Pagamento
                                </Button>
                              </a>
                              <a
                                href={`https://wa.me/55${selectedSubForDetail.holderPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                  `Olá ${selectedSubForDetail.holderName}! Segue o link exclusivo para pagar seu plano do Balneário Lessa Club via cartão de crédito (${pending.length} parcela(s), Total: ${formatCurrency(totalPendingVal)}): ${unifiedCardUrl}`
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

                        {pending.length > 0 && (
                          <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                            <span className="text-[11px] text-slate-500">
                              Cliente já pagou na recepção / maquininha?
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              onClick={async () => {
                                const nowIso = new Date().toISOString();
                                const updatedInvoices = selectedSubForDetail.invoices.map((inv) =>
                                  inv.status !== 'CANCELLED'
                                    ? {
                                        ...inv,
                                        status: 'PAID' as const,
                                        paidAt: inv.paidAt || nowIso,
                                      }
                                    : inv
                                );
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
                        )}
                      </div>
                    );
                  })()}
                </DialogContent>
              </Dialog>

              {/* MODAL ADICIONAR NOVO CARNÊ (+ ADD CARNÊ — SOMA DOS PLANOS ESCOLHIDOS) */}
              <Dialog
                open={carneModalOpen}
                onOpenChange={(o) => !o && setCarneModalOpen(false)}
              >
                <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-black text-slate-800 text-center uppercase tracking-tight">
                      ADICIONAR NOVO CARNÊ
                    </DialogTitle>
                  </DialogHeader>

                  {(() => {
                    const breakdown = getSubscriptionPlanBreakdown(selectedSubForDetail);
                    const parsedVal = Number(String(carneInstallmentValue).replace(',', '.'));
                    const effectiveVal =
                      Number.isFinite(parsedVal) && parsedVal >= 0 ? parsedVal : breakdown.total;

                    return (
                      <div className="space-y-4 py-1 text-xs">
                        {/* Resumo dinâmico dos planos selecionados no cadastro */}
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                          <div className="font-bold text-emerald-950 flex items-center justify-between">
                            <span>Planos Selecionados no Cadastro:</span>
                            <span className="text-sm font-black text-[#004d00]">
                              Total: {formatCurrency(breakdown.total)}/mês
                            </span>
                          </div>
                          {breakdown.items.length > 0 && (
                            <div className="space-y-0.5 text-[11px] text-slate-700 border-t border-emerald-200 pt-1.5">
                              {breakdown.items.map((item) => (
                                <div key={item.memberId} className="flex justify-between gap-2">
                                  <span className="truncate">
                                    <strong>{item.role === 'TITULAR' ? 'Titular' : 'Dep.'}:</strong> {item.fullName} — {item.modalityName}
                                  </span>
                                  <span className="font-bold shrink-0">{formatCurrency(item.monthlyValue)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-800">
                              Data do 1º vencimento (Adesão):
                            </Label>
                            <Input
                              type="date"
                              value={carneAdhesionDueDate}
                              onChange={(e) => setCarneAdhesionDueDate(e.target.value)}
                              className="h-9 text-xs bg-white"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-800">
                              1ª mensalidade (Demais parcelas):
                            </Label>
                            <Input
                              type="date"
                              value={carneFirstDueDate}
                              onChange={(e) => setCarneFirstDueDate(e.target.value)}
                              className="h-9 text-xs bg-white"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs font-bold text-slate-800">
                                Número TOTAL de parcelas:
                              </Label>
                              <Input
                                type="number"
                                min="1"
                                max="36"
                                value={carneInstallmentCount}
                                onChange={(e) =>
                                  setCarneInstallmentCount(
                                    Math.max(1, Math.min(36, Number(e.target.value) || 12))
                                  )
                                }
                                className="h-9 text-xs bg-white font-bold"
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs font-bold text-slate-800">
                                Valor de cada parcela (R$):
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={carneInstallmentValue}
                                onChange={(e) => setCarneInstallmentValue(e.target.value)}
                                className="h-9 text-xs bg-white font-bold"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-800">Descrição / Plano:</Label>
                            <Input
                              value={carneDescription}
                              onChange={(e) => setCarneDescription(e.target.value)}
                              placeholder="Mensalidade"
                              className="h-9 text-xs bg-white"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-bold text-slate-800">
                                Recorrência? (Assinatura em Cartão)
                              </Label>
                              {!selectedSubForDetail.registeredCard && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCarneModalOpen(false);
                                    setClientDetailTool('CADASTRAR_CARTAO_PAGTO');
                                  }}
                                  className="text-[11px] font-bold text-emerald-700 hover:underline"
                                >
                                  + Cadastrar Cartão agora
                                </button>
                              )}
                            </div>
                            <select
                              value={carneRecurrenceMode}
                              onChange={(e) =>
                                setCarneRecurrenceMode(
                                  e.target.value === 'REGISTERED_CARD' ? 'REGISTERED_CARD' : 'NONE'
                                )
                              }
                              className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold bg-white text-slate-700"
                            >
                              {selectedSubForDetail.registeredCard ? (
                                <>
                                  <option value="REGISTERED_CARD">
                                    ATIVAR NO CARTÃO •••• {selectedSubForDetail.registeredCard.last4Digits} ({selectedSubForDetail.registeredCard.cardType === 'CREDIT' ? 'Crédito' : 'Débito'})
                                  </option>
                                  <option value="NONE">
                                    Sem recorrência em cartão (Boleto / PIX mensal)
                                  </option>
                                </>
                              ) : (
                                <>
                                  <option value="NONE">
                                    CADASTRE UM CARTÃO PARA ATIVAR RECORRÊNCIA
                                  </option>
                                </>
                              )}
                            </select>
                          </div>

                          {effectiveVal > 0 && (
                            <label className="flex items-center gap-2 p-2.5 bg-sky-50 border border-sky-200 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={carneEmitAsaasOnCreate}
                                onChange={(e) => setCarneEmitAsaasOnCreate(e.target.checked)}
                                className="w-4 h-4 rounded"
                              />
                              <span className="text-xs font-semibold text-sky-950">
                                Já emitir todas as cobranças mensais no Asaas agora
                              </span>
                            </label>
                          )}
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-[11px] text-slate-600">
                          <div>
                            Total do Carnê: <strong>{carneInstallmentCount}x de {formatCurrency(effectiveVal)}</strong> = <strong>{formatCurrency(carneInstallmentCount * effectiveVal)}</strong>
                          </div>
                          <div>
                            1ª parcela em <strong>{formatDateBR(carneAdhesionDueDate)}</strong> e mensalidades seguintes a partir de <strong>{formatDateBR(carneFirstDueDate)}</strong>.
                          </div>
                          {effectiveVal === 0 && (
                            <div className="text-amber-700 font-semibold">
                              Plano isento/gratuito (R$ 0,00): parcelas serão lançadas com valor zero e não geram boleto no Asaas.
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
                          <div className="flex items-center justify-center gap-3">
                            <Button
                              type="button"
                              disabled={carneCreateLoading}
                              onClick={() => setCarneModalOpen(false)}
                              className="flex-1 bg-[#d9534f] hover:bg-rose-700 text-white font-bold text-xs uppercase h-10"
                            >
                              CANCELAR
                            </Button>

                            <Button
                              type="button"
                              disabled={carneCreateLoading}
                              onClick={async () => {
                                setCarneCreateLoading(true);
                                try {
                                  await handleGenerateNewCarneForClient(
                                    selectedSubForDetail,
                                    carneInstallmentCount,
                                    effectiveVal,
                                    carneFirstDueDate,
                                    carneDescription.trim() || 'Mensalidade',
                                    'append',
                                    {
                                      adhesionDueDateStr: carneAdhesionDueDate,
                                      recurrenceMode: carneRecurrenceMode,
                                      emitInAsaas: carneEmitAsaasOnCreate,
                                    }
                                  );
                                  setCarneModalOpen(false);
                                } finally {
                                  setCarneCreateLoading(false);
                                }
                              }}
                              className="flex-1 bg-[#5cb85c] hover:bg-emerald-600 text-white font-bold text-xs uppercase h-10"
                            >
                              {carneCreateLoading ? 'GERANDO...' : 'GERAR'}
                            </Button>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            disabled={carneCreateLoading}
                            onClick={async () => {
                              setCarneCreateLoading(true);
                              try {
                                const updated = await handleGenerateNewCarneForClient(
                                  selectedSubForDetail,
                                  carneInstallmentCount,
                                  effectiveVal,
                                  carneFirstDueDate,
                                  carneDescription.trim() || 'Mensalidade',
                                  'append',
                                  {
                                    adhesionDueDateStr: carneAdhesionDueDate,
                                    recurrenceMode: carneRecurrenceMode,
                                    emitInAsaas: carneEmitAsaasOnCreate,
                                  }
                                );
                                setCarneModalOpen(false);
                                if (updated) {
                                  handlePrintCarneSimples(updated);
                                }
                              } finally {
                                setCarneCreateLoading(false);
                              }
                            }}
                            className="w-full text-xs font-bold h-9 border-slate-300 text-slate-800 hover:bg-slate-100"
                          >
                            <Printer className="w-4 h-4 mr-1.5" /> Gerar e Imprimir Carnê Simples Agora
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </DialogContent>
              </Dialog>

              {/* MODAL GERAR FATURA AVULSA (BOTÃO INFERIOR FATURA AVULSA) */}
              <Dialog
                open={showFaturaAvulsaForm}
                onOpenChange={(o) => !o && setShowFaturaAvulsaForm(false)}
              >
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-slate-800 text-center uppercase">
                      GERAR FATURA AVULSA
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4 py-1 text-xs">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Vencimento:</Label>
                      <Input
                        type="date"
                        value={avulsaDueDate}
                        onChange={(e) => setAvulsaDueDate(e.target.value)}
                        className="h-10 text-xs bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Valor:</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Ex.: 45,00"
                        value={avulsaAmount}
                        onChange={(e) => setAvulsaAmount(e.target.value)}
                        className="h-10 text-xs bg-white font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Descrição:</Label>
                      <Input
                        placeholder="Ex.: Taxa de reemissão de..."
                        value={avulsaDesc}
                        onChange={(e) => setAvulsaDesc(e.target.value)}
                        className="h-10 text-xs bg-white"
                      />
                    </div>

                    <label className="flex items-center gap-2 p-2.5 bg-sky-50 border border-sky-200 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={avulsaEmitAsaas}
                        onChange={(e) => setAvulsaEmitAsaas(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-xs font-semibold text-sky-950">
                        Emitir cobrança PIX / Link no Asaas imediatamente
                      </span>
                    </label>

                    <div className="flex items-center justify-center gap-3 pt-2 border-t border-slate-200">
                      <Button
                        type="button"
                        disabled={avulsaLoading}
                        onClick={() => setShowFaturaAvulsaForm(false)}
                        className="bg-[#d9534f] hover:bg-rose-700 text-white font-bold text-xs uppercase px-5 h-10"
                      >
                        FECHAR JANELA
                      </Button>

                      <Button
                        type="button"
                        disabled={avulsaLoading}
                        onClick={async () => {
                          const parsedAmount = Number(String(avulsaAmount).replace(',', '.'));
                          if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
                            toast({
                              title: 'Informe um valor válido',
                              description: 'Digite o valor da fatura avulsa maior que R$ 0,00.',
                              variant: 'destructive',
                            });
                            return;
                          }
                          if (!avulsaDueDate) {
                            toast({
                              title: 'Informe a data de vencimento',
                              variant: 'destructive',
                            });
                            return;
                          }

                          setAvulsaLoading(true);
                          try {
                            const nextNum = selectedSubForDetail.invoices.length + 1;
                            const newInv: ClubInvoice = {
                              id: `inv_avulsa_${Date.now()}`,
                              subscriptionId: selectedSubForDetail.id,
                              subscriptionCode: selectedSubForDetail.subscriptionCode,
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
                              amount: Number(parsedAmount.toFixed(2)),
                              dueDate: avulsaDueDate,
                              paymentMethod: 'PIX',
                              status: 'PENDING',
                              description: avulsaDesc.trim() || 'Fatura Avulsa',
                              carneGroup:
                                selectedCarneNumber !== 'ALL' ? Number(selectedCarneNumber) || 1 : 1,
                              invoiceKind: 'AVULSA',
                              createdAt: new Date().toISOString(),
                            };

                            const updatedSub: ClubSubscription = {
                              ...selectedSubForDetail,
                              invoices: [...selectedSubForDetail.invoices, newInv],
                              updatedAt: new Date().toISOString(),
                            };
                            const nextState: ClubDatabaseState = {
                              ...state!,
                              subscriptions: (state!.subscriptions || []).map((s) =>
                                s.id === updatedSub.id ? updatedSub : s
                              ),
                            };
                            setSelectedSubForDetail(updatedSub);
                            await persist(nextState);

                            if (avulsaEmitAsaas) {
                              try {
                                const charge = await generateAsaasChargeForClubInvoice(
                                  updatedSub,
                                  newInv,
                                  'PIX'
                                );
                                const syncedInv: ClubInvoice = {
                                  ...newInv,
                                  asaasPaymentId: charge.paymentId,
                                  invoiceUrl: charge.invoiceUrl,
                                  pixPayload: charge.pixPayload,
                                  pixQrCode: charge.pixQrCode,
                                };
                                const syncedSub: ClubSubscription = {
                                  ...updatedSub,
                                  invoices: updatedSub.invoices.map((i) =>
                                    i.id === syncedInv.id ? syncedInv : i
                                  ),
                                };
                                setSelectedSubForDetail(syncedSub);
                                setState({
                                  ...nextState,
                                  subscriptions: nextState.subscriptions.map((s) =>
                                    s.id === syncedSub.id ? syncedSub : s
                                  ),
                                });
                                toast({
                                  title: 'Fatura Avulsa lançada e emitida no Asaas!',
                                  description: `${newInv.description} — ${formatCurrency(newInv.amount)}`,
                                });
                              } catch (err: any) {
                                toast({
                                  title: 'Fatura Avulsa salva localmente',
                                  description: `Aviso Asaas: ${err?.message || 'verifique os dados do cliente'}`,
                                  variant: 'destructive',
                                });
                              }
                            } else {
                              toast({
                                title: 'Fatura Avulsa adicionada!',
                                description: `${newInv.description} — ${formatCurrency(newInv.amount)}`,
                              });
                            }
                            setShowFaturaAvulsaForm(false);
                          } finally {
                            setAvulsaLoading(false);
                          }
                        }}
                        className="bg-[#5cb85c] hover:bg-emerald-600 text-white font-bold text-xs uppercase px-5 h-10"
                      >
                        {avulsaLoading ? 'GERANDO...' : 'GERAR AVULSA!'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* MODAL GERAR CARNÊ NO ASAAS (BOTÃO INFERIOR GERAR CARNÊ) */}
              <Dialog
                open={gerarCarneAsaasModalOpen}
                onOpenChange={(o) => !o && setGerarCarneAsaasModalOpen(false)}
              >
                <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-slate-800 text-center uppercase">
                      CARNÊ
                    </DialogTitle>
                  </DialogHeader>

                  {(() => {
                    const baseInvoices =
                      selectedCarneNumber === 'ALL'
                        ? selectedSubForDetail.invoices
                        : selectedSubForDetail.invoices.filter(
                            (inv) => String(Number(inv.carneGroup) || 1) === selectedCarneNumber
                          );

                    // Exclui já emitidas no Asaas, pagas, canceladas, avulsas e adesões
                    const eligibleInvoices = baseInvoices.filter(
                      (inv) =>
                        inv.status !== 'PAID' &&
                        inv.status !== 'CANCELLED' &&
                        !inv.asaasPaymentId &&
                        inv.invoiceKind !== 'AVULSA' &&
                        inv.invoiceKind !== 'ADESAO' &&
                        inv.amount > 0
                    );
                    const totalEligible = Number(
                      eligibleInvoices.reduce((acc, inv) => acc + inv.amount, 0).toFixed(2)
                    );
                    const targetInvoices = eligibleInvoices.slice(0, gerarCarneAsaasCount);
                    const targetTotal = Number(
                      targetInvoices.reduce((acc, inv) => acc + inv.amount, 0).toFixed(2)
                    );
                    const equalizedValue =
                      targetInvoices.length > 0
                        ? Number((targetTotal / targetInvoices.length).toFixed(2))
                        : getSubscriptionPlanMonthlyTotal(selectedSubForDetail);

                    return (
                      <div className="space-y-4 py-1 text-xs">
                        <div className="text-center space-y-2 border-b border-slate-200 pb-3">
                          <p className="text-sm font-medium text-slate-800">
                            Deseja transformar esse grupo de cobranças em um <strong>CARNÊ</strong> no Asaas?
                          </p>
                          <p className="text-[11px] text-red-600 leading-relaxed">
                            Ps.: Obrigatoriamente, todas as parcelas incluídas no <strong>CARNÊ</strong> deverão ter o mesmo valor, dias de vencimento iguais e meses subsequentes.
                            <br />
                            Parcelas com diferentes valores serão somadas e divididas igualmente!
                            <br />
                            Como data base de vencimento, será usada a próxima cobrança a vencer (Faturas que já tiveram cobranças emitidas, avulsas e adesões não serão inclusas).
                          </p>
                        </div>

                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                          <div className="flex justify-between font-bold text-slate-700">
                            <span>Parcelas elegíveis em aberto (sem emissão Asaas):</span>
                            <span>{eligibleInvoices.length} parcela(s)</span>
                          </div>
                          <div className="flex justify-between font-bold text-slate-700">
                            <span>Serão emitidas no Asaas agora:</span>
                            <span className="text-[#004d00]">
                              {targetInvoices.length}x de {formatCurrency(equalizedValue)}
                            </span>
                          </div>
                          {eligibleInvoices.length === 0 && (
                            <div className="text-[11px] text-amber-800 font-semibold pt-1">
                              Nenhuma parcela mensal pendente sem cobrança Asaas (ou plano isento R$ 0,00). Utilize "+ ADD CARNÊ" para criar novas mensalidades primeiro.
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-700">Nº Parcelas</Label>
                            <Input
                              type="number"
                              min="1"
                              max={Math.max(1, eligibleInvoices.length)}
                              value={gerarCarneAsaasCount}
                              onChange={(e) =>
                                setGerarCarneAsaasCount(
                                  Math.max(
                                    1,
                                    Math.min(
                                      Math.max(1, eligibleInvoices.length),
                                      Number(e.target.value) || 1
                                    )
                                  )
                                )
                              }
                              className="h-9 text-xs bg-white font-bold"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-700">1º Vencimento Base</Label>
                            <Input
                              type="date"
                              value={gerarCarneAsaasFirstDue}
                              onChange={(e) => {
                                setGerarCarneAsaasFirstDue(e.target.value);
                                const d = Number(e.target.value.split('-')[2]);
                                if (d >= 1 && d <= 31) setGerarCarneAsaasDueDay(d);
                              }}
                              className="h-9 text-xs bg-white"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-700">Dia Fixo Mensal</Label>
                            <Input
                              type="number"
                              min="1"
                              max="31"
                              value={gerarCarneAsaasDueDay}
                              onChange={(e) =>
                                setGerarCarneAsaasDueDay(
                                  Math.max(1, Math.min(31, Number(e.target.value) || 10))
                                )
                              }
                              className="h-9 text-xs bg-white font-bold"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-700">Forma de Cobrança no Asaas</Label>
                            <select
                              value={gerarCarneAsaasBillingType}
                              onChange={(e) =>
                                setGerarCarneAsaasBillingType(e.target.value as 'UNDEFINED' | 'BOLETO' | 'PIX')
                              }
                              className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold bg-white text-slate-800"
                            >
                              <option value="UNDEFINED">Boleto / PIX / Cartão (Cliente escolhe)</option>
                              <option value="BOLETO">Carnê / Boleto Bancário</option>
                              <option value="PIX">PIX Mensal com QR Code</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-700">Assinatura em Cartão?</Label>
                            <select
                              value={gerarCarneAsaasRecurrence}
                              onChange={(e) =>
                                setGerarCarneAsaasRecurrence(
                                  e.target.value === 'REGISTERED_CARD' ? 'REGISTERED_CARD' : 'NONE'
                                )
                              }
                              className="w-full h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold bg-white text-slate-800"
                            >
                              {selectedSubForDetail.registeredCard ? (
                                <>
                                  <option value="REGISTERED_CARD">
                                    Ativar no Cartão •••• {selectedSubForDetail.registeredCard.last4Digits}
                                  </option>
                                  <option value="NONE">Cobrança comum sem vínculo em cartão</option>
                                </>
                              ) : (
                                <option value="NONE">Sem cartão cadastrado (Ir à aba Cartão p/ ativar)</option>
                              )}
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-3 pt-2 border-t border-slate-200">
                          <Button
                            type="button"
                            disabled={gerarCarneAsaasLoading}
                            onClick={() => setGerarCarneAsaasModalOpen(false)}
                            className="bg-[#d9534f] hover:bg-rose-700 text-white font-bold text-xs uppercase px-5 h-10"
                          >
                            FECHAR JANELA
                          </Button>

                          <Button
                            type="button"
                            disabled={
                              gerarCarneAsaasLoading ||
                              targetInvoices.length === 0 ||
                              totalEligible <= 0
                            }
                            onClick={async () => {
                              setGerarCarneAsaasLoading(true);
                              try {
                                const res = await emitCarneMonthlyChargesInAsaas({
                                  subscriptionId: selectedSubForDetail.id,
                                  invoiceIds: targetInvoices.map((i) => i.id),
                                  billingType: gerarCarneAsaasBillingType,
                                  firstDueDate: gerarCarneAsaasFirstDue,
                                  dueDay: gerarCarneAsaasDueDay,
                                  equalizedAmount: equalizedValue,
                                  activateCardRecurrence: gerarCarneAsaasRecurrence === 'REGISTERED_CARD',
                                  cardLast4: selectedSubForDetail.registeredCard?.last4Digits,
                                });
                                setState(res.state);
                                const updated = res.state.subscriptions.find(
                                  (s) => s.id === selectedSubForDetail.id
                                );
                                if (updated) {
                                  setSelectedSubForDetail(updated);
                                }
                                setGerarCarneAsaasModalOpen(false);
                                toast({
                                  title: `Carnê gerado no Asaas!`,
                                  description: `${res.generatedCount} cobrança(s) emitida(s) de ${formatCurrency(equalizedValue)}${res.failedCount > 0 ? ` (${res.failedCount} falha(s): ${res.firstError || ''})` : ''}.`,
                                  variant: res.generatedCount === 0 ? 'destructive' : 'default',
                                });
                              } catch (err: any) {
                                toast({
                                  title: 'Erro ao gerar Carnê no Asaas',
                                  description: err?.message || 'Verifique os dados do associado e tente novamente.',
                                  variant: 'destructive',
                                });
                              } finally {
                                setGerarCarneAsaasLoading(false);
                              }
                            }}
                            className="bg-[#5cb85c] hover:bg-emerald-600 text-white font-bold text-xs uppercase px-5 h-10"
                          >
                            {gerarCarneAsaasLoading ? 'EMITINDO NO ASAAS...' : 'GERAR CARNÊ!'}
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </DialogContent>
              </Dialog>

              {/* MODAL OBRIGATÓRIO DE CONFIRMAÇÃO DE EXCLUSÃO / ESTORNO DE PARCELA(S) */}
              <Dialog
                open={!!invoiceDeleteConfirm}
                onOpenChange={(o) => !o && setInvoiceDeleteConfirm(null)}
              >
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-base font-black text-red-700 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      {invoiceDeleteConfirm?.mode === 'BULK'
                        ? 'Confirmar Exclusão de Parcelas'
                        : 'Confirmar Exclusão / Estorno da Parcela'}
                    </DialogTitle>
                  </DialogHeader>

                  {invoiceDeleteConfirm && (
                    <div className="space-y-4 py-1 text-xs">
                      {invoiceDeleteConfirm.mode === 'BULK' ? (
                        <>
                          <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1.5 text-slate-800">
                            <p>
                              Você está prestes a <strong>excluir permanentemente {invoiceDeleteConfirm.invoices.length} parcela(s)</strong> do perfil financeiro de <strong>{selectedSubForDetail.holderName}</strong>.
                            </p>
                            <p className="font-bold text-red-800">
                              Valor somado selecionado:{' '}
                              {formatCurrency(
                                invoiceDeleteConfirm.invoices.reduce((acc, i) => acc + i.amount, 0)
                              )}
                            </p>
                            {invoiceDeleteConfirm.invoices.some((i) => i.status === 'PAID') && (
                              <p className="text-amber-800 font-semibold">
                                Atenção: há parcela(s) já marcada(s) como PAGO nesta seleção.
                              </p>
                            )}
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setInvoiceDeleteConfirm(null)}
                              className="h-9 text-xs font-bold text-slate-800 hover:bg-slate-100"
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              onClick={async () => {
                                const idsToRemove = new Set(
                                  invoiceDeleteConfirm.invoices.map((i) => i.id)
                                );
                                const remaining = selectedSubForDetail.invoices.filter(
                                  (i) => !idsToRemove.has(i.id)
                                );
                                const updatedSub: ClubSubscription = {
                                  ...selectedSubForDetail,
                                  invoices: remaining,
                                };
                                const nextState: ClubDatabaseState = {
                                  ...state!,
                                  subscriptions: (state!.subscriptions || []).map((s) =>
                                    s.id === updatedSub.id ? updatedSub : s
                                  ),
                                };
                                setSelectedSubForDetail(updatedSub);
                                setSelectedClientInvoiceIdsForDelete([]);
                                setInvoiceDeleteConfirm(null);
                                await persist(nextState);
                                toast({
                                  title: `${idsToRemove.size} parcela(s) excluída(s) com sucesso!`,
                                });
                              }}
                              className="h-9 bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Confirmar Exclusão
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1 text-slate-800">
                            <div>
                              <strong>Parcela:</strong> {invoiceDeleteConfirm.invoice.installmentNumber}/
                              {invoiceDeleteConfirm.invoice.totalInstallments} —{' '}
                              {invoiceDeleteConfirm.invoice.description || 'Mensalidade'}
                            </div>
                            <div>
                              <strong>Vencimento:</strong> {formatDateBR(invoiceDeleteConfirm.invoice.dueDate)} •{' '}
                              <strong>Valor:</strong> {formatCurrency(invoiceDeleteConfirm.invoice.amount)}
                            </div>
                            <div>
                              <strong>Status atual:</strong>{' '}
                              {invoiceDeleteConfirm.invoice.status === 'PAID' ? 'PAGO' : 'NÃO PAGA'}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
                            {invoiceDeleteConfirm.invoice.status === 'PAID' && (
                              <Button
                                type="button"
                                onClick={async () => {
                                  const target = invoiceDeleteConfirm.invoice;
                                  const updatedInvoices = selectedSubForDetail.invoices.map((i) =>
                                    i.id === target.id
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
                                    ...state!,
                                    subscriptions: (state!.subscriptions || []).map((s) =>
                                      s.id === updatedSub.id ? updatedSub : s
                                    ),
                                  };
                                  setSelectedSubForDetail(updatedSub);
                                  setInvoiceDeleteConfirm(null);
                                  await persist(nextState);
                                  toast({
                                    title: `Pagamento da parcela ${target.installmentNumber} estornado para NÃO PAGA.`,
                                  });
                                }}
                                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9"
                              >
                                Estornar Pagamento (Marcar como NÃO PAGA)
                              </Button>
                            )}

                            <Button
                              type="button"
                              onClick={async () => {
                                const target = invoiceDeleteConfirm.invoice;
                                const remaining = selectedSubForDetail.invoices.filter(
                                  (i) => i.id !== target.id
                                );
                                const updatedSub: ClubSubscription = {
                                  ...selectedSubForDetail,
                                  invoices: remaining,
                                };
                                const nextState: ClubDatabaseState = {
                                  ...state!,
                                  subscriptions: (state!.subscriptions || []).map((s) =>
                                    s.id === updatedSub.id ? updatedSub : s
                                  ),
                                };
                                setSelectedSubForDetail(updatedSub);
                                setSelectedClientInvoiceIdsForDelete((prev) =>
                                  prev.filter((id) => id !== target.id)
                                );
                                setInvoiceDeleteConfirm(null);
                                await persist(nextState);
                                toast({
                                  title: `Parcela ${target.installmentNumber} excluída do cadastro!`,
                                });
                              }}
                              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-9"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Excluir Parcela Permanentemente
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setInvoiceDeleteConfirm(null)}
                              className="w-full text-xs font-bold h-9 text-slate-800 hover:bg-slate-100"
                            >
                              Cancelar
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
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
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPreviewAttachment({
                                  name: att.name,
                                  dataUrl: att.dataUrl,
                                  mimeType: att.mimeType,
                                  createdAt: att.createdAt,
                                })
                              }
                              className="h-8 text-xs font-bold border-emerald-600 bg-white text-emerald-900 hover:bg-emerald-50 hover:text-emerald-950"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> Visualizar
                            </Button>
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

                  {/* SEÇÃO EXTRA: DOCUMENTOS COMPROBATÓRIOS POR INTEGRANTE (TITULAR E DEPENDENTES) */}
                  <div className="pt-4 border-t border-slate-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-black text-slate-800 flex items-center gap-1.5 uppercase">
                          <Paperclip className="w-4 h-4 text-emerald-700" />
                          Documentos Comprobatórios por Integrante — Titular e Dependentes (
                          {selectedSubForDetail.members.reduce(
                            (acc, m) =>
                              acc +
                              (m.attachments || []).length +
                              (m.documentProofUrl &&
                              !(m.attachments || []).some((a) => a.dataUrl === m.documentProofUrl)
                                ? 1
                                : 0),
                            0
                          )}
                          )
                        </h4>
                        <p className="text-xs text-slate-500">
                          Documentação individual do Titular e Dependentes (RG/CNH para Vitalício 60+, Certidão/RG Kids, Laudo PCD/TEA, Matrícula Student, Professor e Servidor).
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

                    <div className="space-y-3">
                      {selectedSubForDetail.members.map((memberItem, mIdx) => {
                        const docRule = getPlanDocumentRule(
                          memberItem.modalityCode,
                          memberItem.modalityName
                        );
                        const hasDoc = memberHasProofDocument(memberItem, selectedSubForDetail);
                        const missingDoc = isMemberBlockedForMissingDoc(
                          memberItem,
                          selectedSubForDetail
                        );
                        const combinedAttachments = [
                          ...(memberItem.documentProofUrl &&
                          !(memberItem.attachments || []).some(
                            (a) => a.dataUrl === memberItem.documentProofUrl
                          )
                            ? [
                                {
                                  id: `primary_${memberItem.id}`,
                                  name: memberItem.documentProofName || 'Documento Comprobatório',
                                  dataUrl: memberItem.documentProofUrl,
                                  mimeType: memberItem.documentProofUrl.startsWith('data:image/')
                                    ? 'image/jpeg'
                                    : 'application/pdf',
                                  createdAt: memberItem.createdAt,
                                },
                              ]
                            : []),
                          ...(memberItem.attachments || []),
                        ];

                        return (
                          <div
                            key={memberItem.id}
                            className={`p-3.5 rounded-xl border space-y-2.5 ${
                              missingDoc
                                ? 'border-amber-400 bg-amber-50/70'
                                : 'border-slate-200 bg-slate-50/80'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge
                                  className={
                                    memberItem.role === 'TITULAR' || mIdx === 0
                                      ? 'bg-emerald-800 text-white text-[10px]'
                                      : 'bg-blue-700 text-white text-[10px]'
                                  }
                                >
                                  {memberItem.role === 'TITULAR' || mIdx === 0
                                    ? 'TITULAR'
                                    : `DEP. #${mIdx}`}
                                </Badge>
                                <strong>{memberItem.fullName}</strong> ({memberItem.modalityName}) • Cartão #{memberItem.cardNumber}
                                <Badge
                                  className={
                                    isClubDateExpired(memberItem.expirationDate || selectedSubForDetail.endDate) ||
                                    memberItem.status !== 'ACTIVE'
                                      ? 'bg-rose-600 text-white text-[10px]'
                                      : 'bg-emerald-700 text-white text-[10px]'
                                  }
                                >
                                  {isClubDateExpired(memberItem.expirationDate || selectedSubForDetail.endDate)
                                    ? 'EXPIRADO'
                                    : memberItem.status === 'ACTIVE'
                                    ? 'ATIVO'
                                    : 'INATIVO'}
                                </Badge>
                                {docRule.requiresDocument && (
                                  <Badge
                                    className={
                                      missingDoc
                                        ? 'bg-rose-600 text-white text-[10px]'
                                        : 'bg-emerald-600 text-white text-[10px]'
                                    }
                                  >
                                    {missingDoc
                                      ? 'INATIVO — FALTA COMPROVAÇÃO'
                                      : memberItem.documentVerified
                                      ? 'VALIDADO PELO ADMIN'
                                      : 'COMPROVAÇÃO ANEXADA'}
                                  </Badge>
                                )}
                                {(memberItem.expirationDate || selectedSubForDetail.endDate) && (
                                  <span className="ml-1 font-semibold text-amber-800">
                                    • Expira: {formatDateBR(memberItem.expirationDate || selectedSubForDetail.endDate)}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {memberItem.role === 'DEPENDENTE' && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleToggleMemberStatus(
                                        selectedSubForDetail,
                                        memberItem.id,
                                        memberItem.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
                                      )
                                    }
                                    className={`h-7 text-[11px] font-bold cursor-pointer ${
                                      memberItem.status === 'ACTIVE'
                                        ? 'border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100'
                                        : 'border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                                    }`}
                                  >
                                    {memberItem.status === 'ACTIVE' ? 'Inativar' : 'Ativar'}
                                  </Button>
                                )}
                                {docRule.requiresDocument && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={memberItem.documentVerified ? 'outline' : 'default'}
                                    onClick={async () => {
                                      const saved = await verifyMemberProofDocument(
                                        selectedSubForDetail.id,
                                        memberItem.id,
                                        !memberItem.documentVerified
                                      );
                                      setState(saved);
                                      const refreshedSub = saved.subscriptions.find(
                                        (s) => s.id === selectedSubForDetail.id
                                      );
                                      if (refreshedSub) setSelectedSubForDetail(refreshedSub);
                                      toast({
                                        title: !memberItem.documentVerified
                                          ? 'Documento validado e carteirinha liberada!'
                                          : 'Validação manual revogada.',
                                      });
                                    }}
                                    className={
                                      memberItem.documentVerified
                                        ? 'h-7 text-[11px] font-bold border-emerald-600 text-emerald-800'
                                        : 'h-7 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white'
                                    }
                                  >
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    {memberItem.documentVerified
                                      ? 'Validado ✔'
                                      : 'Validar / Liberar'}
                                  </Button>
                                )}
                                <Label
                                  htmlFor={`anexos-tab-upload-${memberItem.id}`}
                                  className="inline-flex items-center px-2.5 py-1 rounded bg-[#004d00] hover:bg-emerald-800 text-white font-bold text-[11px] cursor-pointer"
                                >
                                  <Upload className="w-3 h-3 mr-1" /> + Anexar para {memberItem.fullName.split(' ')[0]}
                                </Label>
                                <input
                                  id={`anexos-tab-upload-${memberItem.id}`}
                                  type="file"
                                  accept="image/*,.pdf,.doc,.docx"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const dataUrl = file.type.startsWith('image/')
                                      ? await compressImageFile(file)
                                      : await fileToDataUrl(file);
                                    const saved = await attachMemberProofDocument(
                                      selectedSubForDetail.id,
                                      memberItem.id,
                                      {
                                        dataUrl,
                                        fileName: `${memberItem.fullName.split(' ')[0]} - ${file.name}`,
                                        mimeType: file.type || 'application/octet-stream',
                                      }
                                    );
                                    setState(saved);
                                    const refreshedSub = saved.subscriptions.find(
                                      (s) => s.id === selectedSubForDetail.id
                                    );
                                    if (refreshedSub) setSelectedSubForDetail(refreshedSub);
                                    toast({
                                      title: `Documento anexado para ${memberItem.fullName}!`,
                                      description: file.name,
                                    });
                                  }}
                                />
                              </div>
                            </div>

                            {missingDoc && docRule.requiresDocument && (
                              <div className="bg-white/90 rounded-lg border border-amber-300 p-2 text-[11px] text-amber-950">
                                <strong>Documentos aceitos ({memberItem.modalityName}):</strong>{' '}
                                {docRule.acceptedDocs.join(' • ')}
                              </div>
                            )}

                            {combinedAttachments.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic">
                                {hasDoc
                                  ? 'Documento validado pelo administrador.'
                                  : 'Nenhum documento anexado para este integrante.'}
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {combinedAttachments.map((att) => (
                                  <div
                                    key={att.id}
                                    className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {att.dataUrl?.startsWith('data:image/') && (
                                        <img
                                          src={att.dataUrl}
                                          alt={att.name}
                                          className="w-9 h-9 object-cover rounded border border-slate-200 shrink-0"
                                        />
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
                                    <div className="flex flex-wrap items-center gap-1 shrink-0">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          setPreviewAttachment({
                                            name: att.name,
                                            dataUrl: att.dataUrl,
                                            mimeType: att.mimeType,
                                            createdAt: att.createdAt,
                                          })
                                        }
                                        className="h-7 px-2 text-[11px] font-bold border-emerald-600 bg-white text-emerald-900 hover:bg-emerald-50 hover:text-emerald-950"
                                      >
                                        <Eye className="w-3 h-3 mr-1" /> Visualizar
                                      </Button>
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
                                            m.id === memberItem.id
                                              ? {
                                                  ...m,
                                                  documentProofUrl:
                                                    m.documentProofUrl === att.dataUrl ? '' : m.documentProofUrl,
                                                  documentProofName:
                                                    m.documentProofUrl === att.dataUrl ? '' : m.documentProofName,
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
                        );
                      })}
                    </div>
                  </div>

                  {/* MODAL DE VISUALIZAÇÃO DE ANEXO */}
                  <Dialog
                    open={Boolean(previewAttachment)}
                    onOpenChange={(open) => !open && setPreviewAttachment(null)}
                  >
                    <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-900 pr-6 truncate">
                          <Eye className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span className="truncate">{previewAttachment?.name}</span>
                        </DialogTitle>
                        {previewAttachment?.createdAt && (
                          <DialogDescription className="text-xs text-slate-500">
                            Enviado em {formatDateBR(previewAttachment.createdAt)}
                          </DialogDescription>
                        )}
                      </DialogHeader>

                      {previewAttachment && (
                        <div className="flex-1 overflow-auto bg-slate-100 rounded-xl border border-slate-200 p-3 flex items-center justify-center min-h-[300px]">
                          {previewAttachment.dataUrl?.startsWith('data:image/') ||
                          previewAttachment.mimeType?.startsWith('image/') ||
                          /\.(png|jpe?g|gif|webp)(\?|$)/i.test(previewAttachment.name || '') ? (
                            <img
                              src={previewAttachment.dataUrl}
                              alt={previewAttachment.name}
                              className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-md"
                            />
                          ) : previewAttachment.dataUrl?.startsWith('data:application/pdf') ||
                            previewAttachment.mimeType === 'application/pdf' ||
                            /\.pdf(\?|$)/i.test(previewAttachment.name || '') ? (
                            <iframe
                              src={previewAttachment.dataUrl}
                              title={previewAttachment.name}
                              className="w-full h-[65vh] rounded-lg border border-slate-300 bg-white"
                            />
                          ) : (
                            <div className="text-center space-y-3 p-6">
                              <FileText className="w-12 h-12 text-slate-400 mx-auto" />
                              <p className="text-sm font-bold text-slate-700">
                                Pré-visualização direta indisponível para este formato ({previewAttachment.mimeType || 'arquivo'}).
                              </p>
                              <a
                                href={previewAttachment.dataUrl}
                                download={previewAttachment.name}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#004d00] text-white text-xs font-bold"
                              >
                                <Download className="w-4 h-4" /> Baixar Arquivo
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {previewAttachment && (
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
                          <a
                            href={previewAttachment.dataUrl}
                            download={previewAttachment.name}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button
                              type="button"
                              size="sm"
                              className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs"
                            >
                              <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar Anexo
                            </Button>
                          </a>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setPreviewAttachment(null)}
                            className="font-bold text-xs"
                          >
                            Fechar
                          </Button>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
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
                                      <div className="font-bold text-sm text-slate-900 flex flex-wrap items-center gap-2">
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
                                        <Badge
                                          className={
                                            isExpired || dep.status !== 'ACTIVE'
                                              ? 'bg-rose-600 text-white text-[11px]'
                                              : 'bg-emerald-600 text-white text-[11px]'
                                          }
                                        >
                                          {isExpired
                                            ? 'EXPIRADO'
                                            : dep.status === 'ACTIVE'
                                            ? 'ATIVO'
                                            : 'INATIVO'}
                                        </Badge>
                                      </div>
                                      <div className="text-[11px] text-slate-500">
                                        CPF: <strong>{dep.cpf || 'Não informado'}</strong> • Nascimento:{' '}
                                        <strong>
                                          {dep.birthDate ? formatDateBR(dep.birthDate) : 'Não informado'}
                                        </strong> • Mensalidade:{' '}
                                        <strong>{formatCurrency(dep.monthlyValue || 0)}</strong>
                                        {dep.expirationDate && (
                                          <>
                                            {' '}• Expiração:{' '}
                                            <strong className={isExpired ? 'text-rose-700' : 'text-amber-900'}>
                                              {formatDateBR(dep.expirationDate)}
                                            </strong>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleToggleMemberStatus(
                                          selectedSubForDetail,
                                          dep.id,
                                          dep.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
                                        )
                                      }
                                      className={`text-xs font-bold h-8 cursor-pointer ${
                                        dep.status === 'ACTIVE'
                                          ? 'border-rose-400 text-rose-700 bg-rose-50 hover:bg-rose-100'
                                          : 'border-emerald-500 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                                      }`}
                                    >
                                      {dep.status === 'ACTIVE'
                                        ? 'Inativar Dependente'
                                        : 'Ativar Dependente'}
                                    </Button>

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

                              {/* DATA DE EXPIRAÇÃO INDIVIDUAL DESTE DEPENDENTE */}
                              <div className="bg-white rounded-lg border border-slate-200 p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
                                  <span className="font-bold text-slate-700">
                                    Data de Expiração deste Dependente:
                                  </span>
                                  <span className="text-slate-600">
                                    {dep.expirationDate
                                      ? formatDateBR(dep.expirationDate)
                                      : `Segue titular (${formatDateBR(selectedSubForDetail.endDate)})`}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Input
                                    type="date"
                                    value={depExpDrafts[dep.id] ?? dep.expirationDate ?? ''}
                                    onChange={(e) =>
                                      setDepExpDrafts((prev) => ({
                                        ...prev,
                                        [dep.id]: e.target.value,
                                      }))
                                    }
                                    className="h-8 text-xs w-36 bg-white"
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      handleUpdateMemberExpirationDate(
                                        selectedSubForDetail,
                                        dep.id,
                                        depExpDrafts[dep.id] ?? dep.expirationDate ?? ''
                                      )
                                    }
                                    className="h-8 text-xs font-bold bg-[#004d00] hover:bg-emerald-900 text-white cursor-pointer"
                                  >
                                    Salvar Expiração
                                  </Button>
                                  {dep.expirationDate && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleUpdateMemberExpirationDate(
                                          selectedSubForDetail,
                                          dep.id,
                                          ''
                                        )
                                      }
                                      className="h-8 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                    >
                                      Limpar
                                    </Button>
                                  )}
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
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-emerald-700" />
                        9. Termos de Uso Completos e Contrato Oficial Aceitos pelo Cliente
                      </h3>
                      <p className="text-xs text-slate-500">
                        Status do Aceite:{' '}
                        <strong>
                          {selectedSubForDetail.contractAccepted
                            ? `ACEITO E ASSINADO DIGITALMENTE EM ${new Date(
                                selectedSubForDetail.contractSignedAt || selectedSubForDetail.createdAt
                              ).toLocaleString('pt-BR')}`
                            : 'PENDENTE DE ASSINATURA DIGITAL'}
                        </strong>{' '}
                        • Titular: <strong>{selectedSubForDetail.holderName}</strong> (Cartão #{selectedSubForDetail.subscriptionCode})
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handlePrintCompleteTermsAndContract(selectedSubForDetail)}
                        className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 mr-1.5" /> Imprimir Termos Completos
                      </Button>
                    </div>
                  </div>

                  {/* DESTAQUE DE VALIDADE JURÍDICA DA ASSINATURA ELETRÔNICA */}
                  <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 text-xs text-emerald-950 space-y-1.5">
                    <div className="font-black text-emerald-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                      Validade Jurídica da Assinatura Eletrônica (Equivalente à Assinatura Presencial)
                    </div>
                    <p className="leading-relaxed text-slate-800">
                      Com pleno respaldo na legislação brasileira vigente — <strong>Medida Provisória nº 2.200-2/2001 (art. 10, § 2º)</strong>, <strong>Lei Federal nº 14.063/2020</strong> e <strong>artigos 104, 107, 219 e 422 do Código Civil Brasileiro</strong> — o aceite eletrônico dos Termos de Uso e do Contrato de Adesão validado pelo próprio usuário titular possui <strong>plena força jurídica, autenticidade e validade vinculante equivalente a uma assinatura presencial de próprio punho em documento físico</strong>.
                    </p>
                    <p className="text-[11px] text-emerald-800 font-semibold pt-0.5">
                      Registro de Auditoria: Titular {selectedSubForDetail.holderName} (CPF: {selectedSubForDetail.holderCpf}) • Aceite:{' '}
                      {selectedSubForDetail.contractAccepted
                        ? new Date(selectedSubForDetail.contractSignedAt || selectedSubForDetail.createdAt).toLocaleString('pt-BR')
                        : 'Aguardando confirmação'}{' '}
                      • Protocolo/IP: {selectedSubForDetail.contractSignatureIp || 'Assinatura Eletrônica Registrada'}
                    </p>
                  </div>

                  {/* PARTE 1: TERMOS DE USO E REGULAMENTO INTERNO COMPLETOS (TODAS AS 14 CLÁUSULAS) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900">
                        Parte I — Termos de Uso e Regulamento Interno Completos (Todas as Cláusulas)
                      </h4>
                      <span className="text-[11px] text-slate-500 font-semibold">
                        Cláusulas 1 a 14 integrais
                      </span>
                    </div>
                    <div
                      className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed max-h-[520px] overflow-y-auto prose max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: renderSiteTermsHtml(
                          selectedSubForDetail,
                          state.contractTemplates,
                          siteTermsText
                        ),
                      }}
                    />
                  </div>

                  {/* PARTE 2: CONTRATO OFICIAL COMPLETO PREENCHIDO COM DADOS DO CLIENTE E DEPENDENTES */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-emerald-700" />
                        Parte II — Contrato Oficial Completo de Adesão ({selectedSubForDetail.holderName})
                      </h4>
                      <span className="text-[11px] text-slate-500 font-semibold">
                        Dados cadastrais, integrantes, aceite e assinaturas
                      </span>
                    </div>
                    <div
                      className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed max-h-[600px] overflow-y-auto prose max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: renderSubscriptionContractHtml(
                          selectedSubForDetail,
                          state.contractTemplates
                        ),
                      }}
                    />
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

      {/* CAIXA DE CONFIRMAÇÃO DE ALTERAÇÃO DE STATUS / CADASTRO */}
      <Dialog
        open={Boolean(statusChangeFeedbackModal)}
        onOpenChange={(open) => !open && setStatusChangeFeedbackModal(null)}
      >
        <DialogContent className="max-w-md bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-2xl">
          {statusChangeFeedbackModal && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    statusChangeFeedbackModal.isActive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {statusChangeFeedbackModal.title}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    {statusChangeFeedbackModal.subjectName}
                  </p>
                </div>
              </div>

              <div
                className={`rounded-xl border p-3.5 text-xs space-y-2 ${
                  statusChangeFeedbackModal.isActive
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}
              >
                <p className="font-semibold leading-relaxed">
                  {statusChangeFeedbackModal.detail}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {statusChangeFeedbackModal.previousStatusLabel && (
                    <Badge variant="outline" className="bg-white border-slate-300 text-slate-700 text-[11px]">
                      Antes: {statusChangeFeedbackModal.previousStatusLabel}
                    </Badge>
                  )}
                  <Badge
                    className={`text-[11px] font-black ${
                      statusChangeFeedbackModal.isActive
                        ? 'bg-emerald-700 text-white'
                        : 'bg-rose-700 text-white'
                    }`}
                  >
                    Situação Atual: {statusChangeFeedbackModal.newStatusLabel}
                  </Badge>
                  {statusChangeFeedbackModal.expirationDate && (
                    <Badge variant="outline" className="bg-white border-slate-300 text-slate-700 text-[11px]">
                      Expiração: {formatDateBR(statusChangeFeedbackModal.expirationDate)}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => setStatusChangeFeedbackModal(null)}
                  className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold px-6 cursor-pointer"
                >
                  OK, Entendi
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE PRÉ-VISUALIZAÇÃO E SINCRONIZAÇÃO DE MENSALIDADES DO ASAAS (SEM ATIVAR CADASTROS) */}
      <Dialog open={isAsaasSyncModalOpen} onOpenChange={setIsAsaasSyncModalOpen}>
        <DialogContent className="w-[calc(100vw-16px)] max-w-5xl max-h-[92vh] overflow-y-auto bg-white p-4 sm:p-6">
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <DialogTitle className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                  <RefreshCw className={`w-5 h-5 text-emerald-700 ${isLoadingAsaasSync ? 'animate-spin' : ''}`} />
                  Sincronizar Mensalidades e Parcelas do Asaas
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-600 mt-0.5">
                  Visualize primeiro os clientes retornados pelo Asaas, descarte cobranças de reservas avulsas e selecione exatamente quem deseja importar.
                </DialogDescription>
              </div>
              {asaasSyncMeta && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <Badge className={asaasSyncMeta.isProd ? 'bg-emerald-700 text-white' : 'bg-amber-500 text-slate-950'}>
                    {asaasSyncMeta.isProd ? 'Asaas Produção' : 'Asaas Sandbox'}
                  </Badge>
                  <Badge variant="outline" className="bg-slate-50 text-slate-800 border-slate-300 font-bold">
                    {asaasSyncMeta.returnedCount} cliente(s) carregado(s)
                    {asaasSyncMeta.truncated ? ` de ${asaasSyncMeta.totalFound}` : ''}
                  </Badge>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Aviso obrigatório: Não ativa cadastros */}
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 text-xs text-amber-950 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Importação Segura (Sem Ativação Automática):</strong> Esta sincronização importa/atualiza <strong>somente as mensalidades no Perfil Financeiro</strong>. O status de sócios e dependentes <strong>não será alterado para Ativo</strong> (parcelas de <strong>R$ 25,00</strong> ou cadastros pendentes continuam aguardando validação e anexos de documentos).
              </div>
            </div>

            {asaasSyncError && (
              <div className="bg-rose-50 border border-rose-300 text-rose-900 rounded-xl p-3 text-xs space-y-1">
                <div className="font-bold">Não foi possível carregar os dados do Asaas:</div>
                <div>{asaasSyncError}</div>
                <div className="text-[11px] text-rose-700 pt-1">
                  Dica: verifique se a Edge Function <code>check-payment</code> foi implantada com a rota de listagem em lote (<code>list-asaas-installments</code>) e se <code>ASAAS_API_KEY</code> está configurada.
                </div>
              </div>
            )}

            {/* Barra de pesquisa e filtros */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={asaasSearchQuery}
                  onChange={(e) => setAsaasSearchQuery(e.target.value)}
                  placeholder="Filtrar por nome, CPF/CNPJ, descrição ou ID do Asaas..."
                  className="pl-9 h-9 text-xs bg-white"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isLoadingAsaasSync}
                onClick={handleLoadAsaasCandidates}
                className="h-9 text-xs font-bold text-slate-800 hover:bg-slate-100 hover:text-slate-950 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoadingAsaasSync ? 'animate-spin' : ''}`} />
                Atualizar do Asaas
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'ALL', label: `Todos (${asaasCandidates.length})` },
                    {
                      id: 'SUBSCRIPTION',
                      label: `Prováveis Assinaturas (${asaasCandidates.filter((c) => c.likelyCategory === 'SUBSCRIPTION' || c.likelyCategory === 'MIXED').length})`,
                    },
                    {
                      id: 'MATCHED',
                      label: `Já no Clube (${asaasCandidates.filter((c) => Boolean(c.matchedSubscriptionId)).length})`,
                    },
                    {
                      id: 'HALF_PRICE',
                      label: `Parcelas R$ 25,00 (${asaasCandidates.filter((c) => c.hasHalfPriceCharge).length})`,
                    },
                    {
                      id: 'RESERVATION',
                      label: `Possíveis Reservas (${asaasCandidates.filter((c) => c.likelyCategory === 'RESERVATION').length})`,
                    },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setAsaasFilterCategory(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                      asaasFilterCategory === f.id
                        ? 'bg-[#004d00] text-white border-[#004d00]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const next: Record<string, boolean> = {};
                    asaasCandidates.forEach((c) => {
                      if (
                        (c.likelyCategory === 'SUBSCRIPTION' || c.likelyCategory === 'MIXED') &&
                        Boolean(c.matchedSubscriptionId)
                      ) {
                        next[c.customerId] = true;
                      }
                    });
                    setAsaasSelectedCustomers(next);
                  }}
                  className="h-7 text-[11px] font-bold text-slate-800 hover:bg-slate-100 hover:text-slate-950"
                >
                  Marcar Assinaturas c/ Cadastro
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAsaasSelectedCustomers({})}
                  className="h-7 text-[11px] font-bold text-slate-800 hover:bg-slate-100 hover:text-slate-950"
                >
                  Desmarcar Todos
                </Button>
              </div>
            </div>

            {/* Lista de clientes retornados */}
            {isLoadingAsaasSync ? (
              <div className="py-12 text-center space-y-2 text-slate-600 text-sm">
                <RefreshCw className="w-7 h-7 animate-spin mx-auto text-emerald-700" />
                <div className="font-bold">Consultando assinaturas e cobranças ativas no Asaas...</div>
                <div className="text-xs text-slate-500">Isso pode levar alguns segundos conforme a quantidade de clientes.</div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {asaasCandidates
                  .filter((cand) => {
                    if (asaasFilterCategory === 'SUBSCRIPTION') {
                      if (cand.likelyCategory !== 'SUBSCRIPTION' && cand.likelyCategory !== 'MIXED') return false;
                    } else if (asaasFilterCategory === 'RESERVATION') {
                      if (cand.likelyCategory !== 'RESERVATION') return false;
                    } else if (asaasFilterCategory === 'MATCHED') {
                      if (!cand.matchedSubscriptionId) return false;
                    } else if (asaasFilterCategory === 'HALF_PRICE') {
                      if (!cand.hasHalfPriceCharge) return false;
                    }

                    if (!asaasSearchQuery.trim()) return true;
                    const q = asaasSearchQuery.toLowerCase();
                    return (
                      cand.name.toLowerCase().includes(q) ||
                      (cand.cpfCnpj || '').toLowerCase().includes(q) ||
                      cand.customerId.toLowerCase().includes(q) ||
                      (cand.matchedHolderName || '').toLowerCase().includes(q) ||
                      (cand.payments || []).some((p) => (p.description || '').toLowerCase().includes(q))
                    );
                  })
                  .map((cand) => {
                    const isChecked = Boolean(asaasSelectedCustomers[cand.customerId]);
                    const isExpanded = expandedAsaasCustomerId === cand.customerId;
                    const payFlags = asaasPaymentSelectionMap[cand.customerId] || {};
                    const selectedPayCount = (cand.payments || []).filter(
                      (p) => payFlags[p.id] !== false
                    ).length;

                    return (
                      <div
                        key={cand.customerId}
                        className={`rounded-xl border p-3 transition-colors ${
                          isChecked
                            ? 'border-emerald-600 bg-emerald-50/40'
                            : cand.likelyCategory === 'RESERVATION'
                            ? 'border-rose-200 bg-rose-50/20'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) =>
                                setAsaasSelectedCustomers((prev) => ({
                                  ...prev,
                                  [cand.customerId]: e.target.checked,
                                }))
                              }
                              className="mt-1 w-4 h-4 accent-emerald-700 cursor-pointer shrink-0"
                            />
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-black text-sm text-slate-900">
                                  {cand.name}
                                </span>
                                <span className="text-xs font-mono text-slate-600">
                                  {cand.cpfCnpj ? formatCpf(cand.cpfCnpj) : 'Sem CPF/CNPJ'}
                                </span>
                                {cand.likelyCategory === 'RESERVATION' ? (
                                  <Badge className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold">
                                    Provável Reserva (Não é Assinatura)
                                  </Badge>
                                ) : cand.hasActiveSubscription ? (
                                  <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold">
                                    Assinatura Recorrente Ativa ({cand.subscriptions.length})
                                  </Badge>
                                ) : (
                                  <Badge className="bg-blue-100 text-blue-900 border border-blue-300 text-[10px] font-bold">
                                    Parcelamento / Cobranças ({cand.payments.length})
                                  </Badge>
                                )}
                                {cand.hasHalfPriceCharge && (
                                  <Badge className="bg-amber-100 text-amber-950 border border-amber-400 text-[10px] font-bold">
                                    ⚠️ Parcela R$ 25,00 (Requer Comprovante p/ Ativar)
                                  </Badge>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                                <span>Tel: {cand.phone || '—'}</span>
                                <span>
                                  {cand.payments.length} cobrança(s) no Asaas •{' '}
                                  <strong>{selectedPayCount}</strong> marcada(s) p/ importar
                                </span>
                                {cand.matchedSubscriptionId ? (
                                  <span className="text-emerald-800 font-bold">
                                    ✅ Correspondência no Clube: {cand.matchedHolderName} ({cand.matchedStatus})
                                  </span>
                                ) : (
                                  <span className="text-slate-500 font-semibold">
                                    Ainda não cadastrado no Lessa Club
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pl-6 lg:pl-0">
                            <select
                              value={asaasTargetMap[cand.customerId] || cand.matchedSubscriptionId || 'CREATE_PENDING'}
                              onChange={(e) =>
                                setAsaasTargetMap((prev) => ({
                                  ...prev,
                                  [cand.customerId]: e.target.value,
                                }))
                              }
                              className="h-8 px-2 rounded-lg border border-slate-300 text-[11px] font-semibold bg-white text-slate-800 max-w-[260px]"
                            >
                              {cand.matchedSubscriptionId && (
                                <option value={cand.matchedSubscriptionId}>
                                  Vincular a: {cand.matchedHolderName} (Status preservado)
                                </option>
                              )}
                              <option value="CREATE_PENDING">
                                Criar novo registro Pendente (NÃO ativa)
                              </option>
                              {(state?.subscriptions || [])
                                .filter((s) => s.id !== cand.matchedSubscriptionId)
                                .slice(0, 60)
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    Vincular manual: {s.holderName} ({s.holderCpf})
                                  </option>
                                ))}
                            </select>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setExpandedAsaasCustomerId(isExpanded ? null : cand.customerId)
                              }
                              className="h-8 text-[11px] font-bold text-slate-800 hover:bg-slate-100 hover:text-slate-950"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              {isExpanded ? 'Ocultar Parcelas' : `Ver Parcelas (${cand.payments.length})`}
                            </Button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-slate-200 overflow-x-auto">
                            <table className="w-full text-[11px] border-collapse">
                              <thead>
                                <tr className="bg-slate-100 text-slate-700 text-left">
                                  <th className="py-1.5 px-2">Importar</th>
                                  <th className="py-1.5 px-2">Vencimento</th>
                                  <th className="py-1.5 px-2">Valor</th>
                                  <th className="py-1.5 px-2">Meio</th>
                                  <th className="py-1.5 px-2">Status Asaas</th>
                                  <th className="py-1.5 px-2">Descrição / Origem</th>
                                  <th className="py-1.5 px-2">Link</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(cand.payments || []).map((p) => {
                                  const payChecked = payFlags[p.id] !== false;
                                  const invSt = mapAsaasPaymentStatusToInvoiceStatus(p.status);
                                  return (
                                    <tr key={p.id} className={!payChecked ? 'opacity-50' : ''}>
                                      <td className="py-1.5 px-2">
                                        <input
                                          type="checkbox"
                                          checked={payChecked}
                                          onChange={(e) =>
                                            setAsaasPaymentSelectionMap((prev) => ({
                                              ...prev,
                                              [cand.customerId]: {
                                                ...(prev[cand.customerId] || {}),
                                                [p.id]: e.target.checked,
                                              },
                                            }))
                                          }
                                          className="w-3.5 h-3.5 accent-emerald-700"
                                        />
                                      </td>
                                      <td className="py-1.5 px-2 font-mono font-bold">
                                        {formatDateBR(p.dueDate)}
                                      </td>
                                      <td className="py-1.5 px-2 font-bold text-slate-900">
                                        {formatCurrency(p.value)}
                                      </td>
                                      <td className="py-1.5 px-2">{p.billingType}</td>
                                      <td className="py-1.5 px-2">
                                        <Badge
                                          className={`text-[10px] ${
                                            invSt === 'PAID'
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : invSt === 'OVERDUE'
                                              ? 'bg-rose-100 text-rose-800'
                                              : 'bg-amber-100 text-amber-800'
                                          }`}
                                        >
                                          {invSt === 'PAID'
                                            ? 'PAGA'
                                            : invSt === 'OVERDUE'
                                            ? 'ATRASADA'
                                            : 'PENDENTE'}
                                        </Badge>
                                      </td>
                                      <td className="py-1.5 px-2 text-slate-700 max-w-[280px] truncate">
                                        {p.looksLikeReservation && (
                                          <span className="text-rose-700 font-bold mr-1">[Reserva]</span>
                                        )}
                                        {p.description || '—'}
                                      </td>
                                      <td className="py-1.5 px-2">
                                        {p.invoiceUrl ? (
                                          <a
                                            href={p.invoiceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-700 underline font-semibold"
                                          >
                                            Fatura
                                          </a>
                                        ) : (
                                          '—'
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}

                {!isLoadingAsaasSync && asaasCandidates.length === 0 && !asaasSyncError && (
                  <div className="py-10 text-center text-xs text-slate-500">
                    Nenhum cliente com assinatura ou parcela ativa foi retornado pelo Asaas.
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="text-xs text-slate-700">
              <strong>
                {Object.values(asaasSelectedCustomers).filter(Boolean).length}
              </strong>{' '}
              cliente(s) selecionado(s) • Escolha importar mantendo o status atual ou já ativar os cadastros selecionados.
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAsaasSyncModalOpen(false)}
                className="text-slate-800 hover:bg-slate-100 hover:text-slate-950 font-bold"
              >
                Fechar
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={
                  isApplyingAsaasSync ||
                  isLoadingAsaasSync ||
                  Object.values(asaasSelectedCustomers).filter(Boolean).length === 0
                }
                onClick={() => handleApplyAsaasSync(false)}
                className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-950 font-bold cursor-pointer"
              >
                {isApplyingAsaasSync ? 'Sincronizando...' : 'Importar (Sem Ativar)'}
              </Button>
              <Button
                type="button"
                disabled={
                  isApplyingAsaasSync ||
                  isLoadingAsaasSync ||
                  Object.values(asaasSelectedCustomers).filter(Boolean).length === 0
                }
                onClick={() => handleApplyAsaasSync(true)}
                className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold cursor-pointer"
              >
                {isApplyingAsaasSync ? 'Sincronizando...' : 'Importar e Ativar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
