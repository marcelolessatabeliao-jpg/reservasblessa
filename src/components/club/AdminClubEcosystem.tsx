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
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  BillingCycle,
  ClubCashEntry,
  ClubConsultant,
  ClubContractTemplate,
  ClubInvoice,
  ClubMember,
  ClubModality,
  ClubPaymentMethod,
  ClubSubscription,
  ContractTemplateType,
} from '@/lib/club-types';
import {
  ClubDatabaseState,
  fetchClubState,
  saveClubState,
  createClubSubscription,
  markClubInvoicePaid,
  generateAsaasChargeForClubInvoice,
  renderSubscriptionContractHtml,
  findMemberOrSubscriptionByQuery,
  formatCurrency,
  formatDateBR,
  fileToDataUrl,
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

  // Consultores & Influencers state
  const [consultantRoleFilter, setConsultantRoleFilter] = useState<
    'CONSULTOR' | 'INFLUENCER'
  >('CONSULTOR');
  const [showNewConsultantForm, setShowNewConsultantForm] = useState(false);
  const [newConsName, setNewConsName] = useState('');
  const [newConsCpf, setNewConsCpf] = useState('');
  const [newConsPhone, setNewConsPhone] = useState('');
  const [newConsEmail, setNewConsEmail] = useState('');
  const [newConsCommission, setNewConsCommission] = useState<number>(10);
  const [newConsCode, setNewConsCode] = useState('');

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
  const [activateImmediately, setActivateImmediately] = useState(true);
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

    for (const sub of state.subscriptions) {
      const isSubActive = sub.status === 'ACTIVE';
      if (isSubActive) holdersActive++;
      else holdersInactive++;

      for (const m of sub.members) {
        if (m.role === 'DEPENDENTE') {
          if (m.status === 'ACTIVE' && isSubActive) dependentsActive++;
          else dependentsInactive++;
        }
      }

      for (const inv of sub.invoices) {
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
    for (const sub of state.subscriptions) {
      for (const member of sub.members) {
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
    for (const sub of state.subscriptions) {
      for (const invoice of sub.invoices) {
        list.push({ invoice, subscription: sub });
      }
    }
    return list;
  }, [state]);

  // Filtered subscriptions (supports Clientes PF, Empresas PJ, Status, Via Site)
  const filteredSubscriptions = useMemo(() => {
    if (!state) return [];
    return state.subscriptions.filter((sub) => {
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
        sub.holderName.toLowerCase().includes(q) ||
        (digits && sub.holderCpf.replace(/\D/g, '').includes(digits)) ||
        sub.members.some(
          (m) =>
            m.fullName.toLowerCase().includes(q) ||
            m.cardNumber.includes(q) ||
            (digits && m.cpf.replace(/\D/g, '').includes(digits))
        )
      );
    });
  }, [state, subSearch, subStatusFilter, personFilter, originFilter]);

  // Fluxo de Caixa consolidado (Faturas Pagas + Lançamentos Manuais Entrada/Saída)
  const cashFlowSummary = useMemo(() => {
    const entries: ClubCashEntry[] = [...(state?.cashEntries || [])];
    if (state) {
      for (const sub of state.subscriptions) {
        for (const inv of sub.invoices) {
          if (inv.status === 'PAID' && inv.amount > 0) {
            entries.push({
              id: `inv_${inv.id}`,
              type: 'IN',
              category: 'Mensalidade / Assinatura',
              description: `${sub.holderName} - ${inv.description || inv.referenceMonth}`,
              amount: inv.amount,
              paymentMethod: inv.paymentMethod,
              date: (inv.paidAt || inv.dueDate).split('T')[0],
              createdAt: inv.paidAt || inv.createdAt,
            });
          }
        }
      }
    }
    entries.sort((a, b) => b.date.localeCompare(a.date));
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
    const newCons: ClubConsultant = {
      id: `cons_${Date.now()}`,
      name: newConsName.trim(),
      cpf: newConsCpf.trim() || '000.000.000-00',
      phone: newConsPhone.trim(),
      email: newConsEmail.trim(),
      role: consultantRoleFilter,
      commissionPercent: Number(newConsCommission) || 10,
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
      title: `${
        consultantRoleFilter === 'INFLUENCER' ? 'Influencer' : 'Consultor'
      } cadastrado com sucesso!`,
      description: `Código: ${newCons.referralCode}`,
    });
  };

  const handleExportReportXlsx = (reportType: string) => {
    if (!state) return;
    let rows: Record<string, any>[] = [];
    if (reportType === 'CLIENTES' || reportType === 'EMPRESAS') {
      const targetSubs = state.subscriptions.filter((s) =>
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
    const holderMod = state.modalities.find((m) => m.code === holderModalityCode);
    let sum = holderMod
      ? cycle === 'ANNUAL'
        ? holderMod.annualInstallment
        : holderMod.monthlyPrice
      : 0;
    for (const dep of manualDependents) {
      const m = state.modalities.find((mod) => mod.code === dep.modalityCode);
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
    }
  }, [selectedSubForDetail]);

  const handleAdminCepBlur = async () => {
    const digits = zipCode.replace(/\D/g, '');
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setStreet(data.logradouro || '');
        setNeighborhood(data.bairro || '');
        setCity(data.localidade || 'Ariquemes');
        setUf(data.uf || 'RO');
      }
    } catch {}
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

    const members = [
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
      subscriptions: state.subscriptions.map((s) =>
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
        className="bg-[#004d00] text-white rounded-2xl shadow-xl border border-emerald-900 relative z-30"
        onMouseLeave={() => setOpenMenu(null)}
      >
        <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          {/* Logo Balneário Lessa */}
          <div
            onClick={() => {
              setActiveTab('dashboard');
              setOpenMenu(null);
            }}
            className="flex items-center gap-2.5 cursor-pointer py-1 pr-3"
          >
            <img src={logo} alt="Balneário Lessa" className="h-11 w-auto" />
          </div>

          {/* 9 Ícones e Menus com Dropdown Verde Escuro */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 flex-1 justify-around">
            {/* 1. DASHBOARD */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('dashboard');
                  setOpenMenu(null);
                }}
                onMouseEnter={() => setOpenMenu(null)}
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors ${
                  activeTab === 'dashboard'
                    ? 'bg-[#254d25] text-white'
                    : 'hover:bg-[#1a5c1a] text-white'
                }`}
              >
                <Home className="w-7 h-7 mb-1 stroke-[2.2]" />
                <span className="text-xs font-bold tracking-tight">Dashboard</span>
              </button>
            </div>

            {/* 2. CLIENTES ⌄ */}
            <div
              className="relative"
              onMouseEnter={() => setOpenMenu('clientes')}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'clientes' ? null : 'clientes')
                }
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors ${
                  openMenu === 'clientes' ||
                  (activeTab === 'associados' && personFilter !== 'PJ')
                    ? 'bg-[#254d25] text-white'
                    : 'hover:bg-[#1a5c1a] text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Users className="w-7 h-7 mb-1 stroke-[2.2]" />
                  <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                </div>
                <span className="text-xs font-bold tracking-tight">Clientes</span>
              </button>

              {openMenu === 'clientes' && (
                <div className="absolute left-0 top-full mt-0.5 w-52 bg-[#004d00] text-white rounded-b-lg shadow-2xl border border-emerald-800 py-2 z-50 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setPersonType('PF');
                      setHolderModalityCode('ADULTO');
                      setNewSubModalOpen(true);
                      setOpenMenu(null);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center justify-between"
                  >
                    <span>▶ Cadastrar</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPersonFilter('PF');
                      setOriginFilter('ALL');
                      setSubStatusFilter('ALL');
                      setActiveTab('associados');
                      setOpenMenu(null);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center justify-between"
                  >
                    <span>▶ Cadastrados</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
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
                      onClick={() => {
                        setPersonFilter('PF');
                        setSubStatusFilter(item.status);
                        setOriginFilter(item.origin);
                        setActiveTab('associados');
                        setOpenMenu(null);
                      }}
                      className="w-full px-5 py-2 text-left hover:bg-[#1a5c1a] flex items-center gap-2"
                    >
                      <span>•</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 3. EMPRESAS ⌄ */}
            <div
              className="relative"
              onMouseEnter={() => setOpenMenu('empresas')}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'empresas' ? null : 'empresas')
                }
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors ${
                  openMenu === 'empresas' ||
                  (activeTab === 'associados' && personFilter === 'PJ')
                    ? 'bg-[#254d25] text-white'
                    : 'hover:bg-[#1a5c1a] text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Store className="w-7 h-7 mb-1 stroke-[2.2]" />
                  <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                </div>
                <span className="text-xs font-bold tracking-tight">Empresas</span>
              </button>

              {openMenu === 'empresas' && (
                <div className="absolute left-0 top-full mt-0.5 w-48 bg-[#004d00] text-white rounded-b-lg shadow-2xl border border-emerald-800 py-2 z-50 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setPersonType('PJ');
                      setHolderModalityCode('CORPORATE');
                      setNewSubModalOpen(true);
                      setOpenMenu(null);
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center gap-2"
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
                    className="w-full px-5 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center gap-2"
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
                    className="w-full px-5 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center gap-2"
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
                    className="w-full px-5 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center gap-2"
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
              onMouseEnter={() => setOpenMenu('consultores')}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'consultores' ? null : 'consultores')
                }
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors ${
                  openMenu === 'consultores' ||
                  (activeTab === 'consultores' &&
                    consultantRoleFilter === 'CONSULTOR')
                    ? 'bg-[#254d25] text-white'
                    : 'hover:bg-[#1a5c1a] text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Briefcase className="w-7 h-7 mb-1 stroke-[2.2]" />
                  <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                </div>
                <span className="text-xs font-bold tracking-tight">
                  Consultores
                </span>
              </button>

              {openMenu === 'consultores' && (
                <div className="absolute left-0 top-full mt-0.5 w-48 bg-[#004d00] text-white rounded-b-lg shadow-2xl border border-emerald-800 py-2 z-50 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setConsultantRoleFilter('CONSULTOR');
                      setShowNewConsultantForm(true);
                      setActiveTab('consultores');
                      setOpenMenu(null);
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center gap-2"
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
                    className="w-full px-5 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center gap-2"
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
              onMouseEnter={() => setOpenMenu('influencer')}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'influencer' ? null : 'influencer')
                }
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors ${
                  openMenu === 'influencer' ||
                  (activeTab === 'consultores' &&
                    consultantRoleFilter === 'INFLUENCER')
                    ? 'bg-[#254d25] text-white'
                    : 'hover:bg-[#1a5c1a] text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Sparkles className="w-7 h-7 mb-1 stroke-[2.2]" />
                  <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                </div>
                <span className="text-xs font-bold tracking-tight">
                  Influencer
                </span>
              </button>

              {openMenu === 'influencer' && (
                <div className="absolute left-0 top-full mt-0.5 w-48 bg-[#004d00] text-white rounded-b-lg shadow-2xl border border-emerald-800 py-2 z-50 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setConsultantRoleFilter('INFLUENCER');
                      setShowNewConsultantForm(true);
                      setActiveTab('consultores');
                      setOpenMenu(null);
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center gap-2"
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
                    className="w-full px-5 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center gap-2"
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
                    className="w-full px-5 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center gap-2"
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
              onMouseEnter={() => setOpenMenu('financas')}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'financas' ? null : 'financas')
                }
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors ${
                  openMenu === 'financas' || activeTab === 'financeiro'
                    ? 'bg-[#254d25] text-white'
                    : 'hover:bg-[#1a5c1a] text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <DollarSign className="w-7 h-7 mb-1 stroke-[2.5]" />
                  <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                </div>
                <span className="text-xs font-bold tracking-tight">Finanças</span>
              </button>

              {openMenu === 'financas' && (
                <div className="absolute left-0 top-full mt-0.5 w-60 bg-[#004d00] text-white rounded-b-lg shadow-2xl border border-emerald-800 py-2 z-50 text-xs font-semibold">
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
                      className="w-full px-5 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center gap-2"
                    >
                      <span>•</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 7. RELATÓRIOS ⌄ */}
            <div
              className="relative"
              onMouseEnter={() => setOpenMenu('relatorios')}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'relatorios' ? null : 'relatorios')
                }
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors ${
                  openMenu === 'relatorios' || activeTab === 'relatorios'
                    ? 'bg-[#254d25] text-white'
                    : 'hover:bg-[#1a5c1a] text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <BarChart3 className="w-7 h-7 mb-1 stroke-[2.2]" />
                  <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                </div>
                <span className="text-xs font-bold tracking-tight">
                  Relatórios
                </span>
              </button>

              {openMenu === 'relatorios' && (
                <div className="absolute right-0 sm:left-0 top-full mt-0.5 w-48 bg-[#004d00] text-white rounded-b-lg shadow-2xl border border-emerald-800 py-2 z-50 text-xs font-semibold">
                  {(
                    [
                      { label: 'Clientes', view: 'CLIENTES' },
                      { label: 'Consultores', view: 'CONSULTORES' },
                      { label: 'Influencer', view: 'INFLUENCER' },
                      { label: 'Empresas', view: 'EMPRESAS' },
                      { label: 'Agenda', view: 'AGENDA' },
                      { label: "SMS's", view: 'SMS' },
                      { label: 'Outros', view: 'OUTROS' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.view}
                      type="button"
                      onClick={() => {
                        setReportSubView(item.view);
                        setActiveTab('relatorios');
                        setOpenMenu(null);
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center justify-between"
                    >
                      <span>▶ {item.label}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 8. CONFIG. ⌄ */}
            <div
              className="relative"
              onMouseEnter={() => setOpenMenu('config')}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'config' ? null : 'config')
                }
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors ${
                  openMenu === 'config' ||
                  activeTab === 'planos_contratos' ||
                  activeTab === 'impressao' ||
                  activeTab === 'importar'
                    ? 'bg-[#254d25] text-white'
                    : 'hover:bg-[#1a5c1a] text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Settings className="w-7 h-7 mb-1 stroke-[2.2]" />
                  <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                </div>
                <span className="text-xs font-bold tracking-tight">Config.</span>
              </button>

              {openMenu === 'config' && (
                <div className="absolute right-0 top-full mt-0.5 w-56 bg-[#004d00] text-white rounded-b-lg shadow-2xl border border-emerald-800 py-2 z-50 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('planos_contratos');
                      setOpenMenu(null);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center gap-2"
                  >
                    <span>•</span>
                    <span>Planos & Contratos Oficiais</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('impressao');
                      setOpenMenu(null);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center gap-2"
                  >
                    <span>•</span>
                    <span>Impressão 4 Carteirinhas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('importar');
                      setOpenMenu(null);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center gap-2"
                  >
                    <span>•</span>
                    <span>Importar Planilha Labcard</span>
                  </button>
                </div>
              )}
            </div>

            {/* 9. PERFIL ⌄ */}
            <div
              className="relative"
              onMouseEnter={() => setOpenMenu('perfil')}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'perfil' ? null : 'perfil')
                }
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors ${
                  openMenu === 'perfil'
                    ? 'bg-[#254d25] text-white'
                    : 'hover:bg-[#1a5c1a] text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <User className="w-7 h-7 mb-1 stroke-[2.2]" />
                  <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                </div>
                <span className="text-xs font-bold tracking-tight">Perfil</span>
              </button>

              {openMenu === 'perfil' && (
                <div className="absolute right-0 top-full mt-0.5 w-56 bg-[#004d00] text-white rounded-b-lg shadow-2xl border border-emerald-800 py-2 z-50 text-xs font-semibold">
                  <a
                    href="/planos"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full px-4 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center gap-2"
                  >
                    <span>•</span>
                    <span>Portal de Planos (/planos)</span>
                  </a>
                  <a
                    href="/socio"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full px-4 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center gap-2"
                  >
                    <span>•</span>
                    <span>Área do Sócio (/socio)</span>
                  </a>
                  <a
                    href="/verificar"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full px-4 py-2.5 text-left hover:bg-[#1a5c1a] flex items-center gap-2"
                  >
                    <span>•</span>
                    <span>Validador QR (/verificar)</span>
                  </a>
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
        className="fixed right-5 top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-full bg-[#004d00] hover:bg-emerald-800 text-white shadow-2xl border-2 border-white flex items-center justify-center transition-transform hover:scale-105"
      >
        <Search className="w-5 h-5" />
      </button>

      {/* CONTEÚDO DAS ABAS E FERRAMENTAS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {personFilter === 'PJ'
                    ? 'Empresas Conveniadas / Corporativas (PJ)'
                    : 'Clientes & Famílias Cadastradas'}
                  {originFilter === 'SITE' && ' — Cadastrados Via Site'}
                </h3>
                <p className="text-xs text-slate-500">
                  Gerencie status (Ativo, Inativo, Pendente, Prospect, Cancelado), imprima contratos e edite a Situação.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setPersonType(personFilter === 'PJ' ? 'PJ' : 'PF');
                    setNewSubModalOpen(true);
                  }}
                  className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold"
                >
                  <UserPlus className="w-4 h-4 mr-1.5" /> + Cadastrar{' '}
                  {personFilter === 'PJ' ? 'Empresa PJ' : 'Cliente PF'}
                </Button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={subSearch}
                  onChange={(e) => setSubSearch(e.target.value)}
                  placeholder="Filtrar por Nome do Titular, Dependente, CPF/CNPJ ou Nº do Cartão (121225xxxx)..."
                  className="pl-10 h-11"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
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
                    className={
                      subStatusFilter === st.id && originFilter === 'ALL'
                        ? 'bg-[#004d00] text-white text-xs'
                        : 'text-xs'
                    }
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
                  className={
                    originFilter === 'SITE'
                      ? 'bg-blue-700 text-white text-xs'
                      : 'text-xs'
                  }
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
              <div className="space-y-3">
                {filteredSubscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="rounded-2xl border border-slate-200 p-4 hover:border-emerald-500 transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-50/50"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-base text-slate-900">
                          {sub.holderName}
                        </span>
                        <Badge
                          className={
                            sub.status === 'ACTIVE'
                              ? 'bg-emerald-600 text-white'
                              : sub.status === 'PENDING'
                              ? 'bg-amber-500 text-white'
                              : sub.status === 'PROSPECT'
                              ? 'bg-blue-600 text-white'
                              : 'bg-rose-600 text-white'
                          }
                        >
                          {sub.status === 'ACTIVE'
                            ? 'ATIVO (LIBERADO)'
                            : sub.status === 'INACTIVE'
                            ? 'INATIVO'
                            : sub.status === 'PENDING'
                            ? 'PENDENTE'
                            : sub.status === 'PROSPECT'
                            ? 'PROSPECT'
                            : sub.status === 'ARCHIVED_PROSPECT'
                            ? 'PROSPECT ARQUIVADO'
                            : 'CANCELADO'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {sub.billingCycle === 'ANNUAL' ? 'Anual' : 'Mensal'} •{' '}
                          {formatCurrency(sub.monthlyEquivalent)}/mês
                        </Badge>
                        {sub.origin === 'SITE' && (
                          <Badge className="bg-blue-100 text-blue-800 text-[10px]">
                            Via Site
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-slate-600">
                        CPF/CNPJ: <strong>{sub.holderCpf}</strong> • Tel:{' '}
                        <strong>{sub.holderPhone || '—'}</strong> • Plano:{' '}
                        <strong>{sub.planSummaryLabel}</strong>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {sub.members.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1 text-[11px] bg-white border border-slate-200 px-2.5 py-0.5 rounded-full text-slate-700"
                          >
                            <strong>{m.role === 'TITULAR' ? '👑' : '👤'}</strong>{' '}
                            {m.fullName.split(' ')[0]} ({m.modalityName}) •{' '}
                            <code className="text-emerald-700 font-bold">
                              #{m.cardNumber}
                            </code>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedSubForDetail(sub)}
                        className="font-bold border-emerald-600 text-emerald-900"
                      >
                        <CreditCard className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />{' '}
                        Situação & Carteirinhas
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePrintContract(sub)}
                      >
                        <Printer className="w-3.5 h-3.5 mr-1.5" /> Contrato
                      </Button>
                      {sub.status !== 'ACTIVE' ? (
                        <Button
                          size="sm"
                          onClick={() => handleToggleSubStatus(sub, 'ACTIVE')}
                          className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold"
                        >
                          Liberar (Ativar)
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleSubStatus(sub, 'INACTIVE')}
                          className="border-rose-300 text-rose-700 hover:bg-rose-50 font-bold"
                        >
                          Inativar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* =====================================================================
            TAB CONSULTORES & INFLUENCER
        ===================================================================== */}
        <TabsContent value="consultores" className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {consultantRoleFilter === 'INFLUENCER'
                    ? 'Gestão de Influencers & Parceiros'
                    : 'Gestão de Consultores / Vendedores'}
                </h3>
                <p className="text-xs text-slate-500">
                  Cadastre consultores e influencers para atribuir vendas e acompanhar comissões.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={
                    consultantRoleFilter === 'CONSULTOR' ? 'default' : 'outline'
                  }
                  onClick={() => setConsultantRoleFilter('CONSULTOR')}
                >
                  Consultores
                </Button>
                <Button
                  size="sm"
                  variant={
                    consultantRoleFilter === 'INFLUENCER' ? 'default' : 'outline'
                  }
                  onClick={() => setConsultantRoleFilter('INFLUENCER')}
                >
                  Influencers
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowNewConsultantForm((p) => !p)}
                  className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold"
                >
                  <Plus className="w-4 h-4 mr-1" /> Cadastrar{' '}
                  {consultantRoleFilter === 'INFLUENCER'
                    ? 'Influencer'
                    : 'Consultor'}
                </Button>
              </div>
            </div>

            {showNewConsultantForm && (
              <form
                onSubmit={handleCreateConsultant}
                className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 space-y-4"
              >
                <h4 className="font-black text-sm text-emerald-950 uppercase">
                  Novo Cadastro de{' '}
                  {consultantRoleFilter === 'INFLUENCER'
                    ? 'Influencer'
                    : 'Consultor Comercial'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4">
                    <Label className="text-xs font-bold">Nome Completo *</Label>
                    <Input
                      value={newConsName}
                      onChange={(e) => setNewConsName(e.target.value)}
                      placeholder="Nome"
                      className="bg-white mt-1"
                      required
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="text-xs font-bold">CPF</Label>
                    <Input
                      value={newConsCpf}
                      onChange={(e) => setNewConsCpf(e.target.value)}
                      placeholder="000.000.000-00"
                      className="bg-white mt-1"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="text-xs font-bold">Telefone / WhatsApp</Label>
                    <Input
                      value={newConsPhone}
                      onChange={(e) => setNewConsPhone(e.target.value)}
                      placeholder="(69) 99999-9999"
                      className="bg-white mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-bold">% Comissão</Label>
                    <Input
                      type="number"
                      value={newConsCommission}
                      onChange={(e) =>
                        setNewConsCommission(Number(e.target.value))
                      }
                      className="bg-white mt-1"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewConsultantForm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-[#004d00] hover:bg-emerald-900 text-white font-black"
                  >
                    CADASTRAR
                  </Button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {state.consultants
                .filter((c) => c.role === consultantRoleFilter)
                .map((cons) => {
                  const salesCount = state.subscriptions.filter(
                    (s) =>
                      s.consultantName?.toLowerCase() ===
                        cons.name.toLowerCase() ||
                      s.influencerName?.toLowerCase() === cons.name.toLowerCase()
                  ).length;
                  return (
                    <div
                      key={cons.id}
                      className="rounded-2xl border border-slate-200 p-4 flex items-center justify-between bg-slate-50"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900">
                            {cons.name}
                          </span>
                          <Badge className="bg-emerald-600 text-white text-[10px]">
                            {cons.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Tel: {cons.phone || '—'} • Código:{' '}
                          <strong>{cons.referralCode}</strong> • Comissão:{' '}
                          <strong>{cons.commissionPercent}%</strong> • Vendas:{' '}
                          <strong>{salesCount}</strong>
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
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
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
            {/* Sub-barra de ferramentas de Finanças */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-4">
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
                  className={
                    financeSubView === tab.id
                      ? 'bg-[#004d00] text-white font-bold text-xs'
                      : 'text-xs'
                  }
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
                      <div className="flex items-center gap-3">
                        <span className="font-black text-emerald-800">
                          {formatCurrency(sub.monthlyEquivalent)}/mês
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedSubForDetail(sub)}
                        >
                          Abrir Situação
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
                      Selecione faturas para dar baixa em lote ou clique em "Dar Baixa Manual".
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
                                {subscription.holderName}
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
            ▶ Clientes | ▶ Consultores | ▶ Influencer | ▶ Empresas |
            ▶ Agenda | ▶ SMS's | ▶ Outros
        ===================================================================== */}
        <TabsContent value="relatorios" className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div className="flex flex-wrap items-center gap-1.5">
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
                    className={
                      reportSubView === r.id
                        ? 'bg-[#004d00] text-white font-bold text-xs'
                        : 'text-xs'
                    }
                  >
                    {r.label}
                  </Button>
                ))}
              </div>

              <Button
                size="sm"
                onClick={() => handleExportReportXlsx(reportSubView)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
              >
                <Download className="w-4 h-4 mr-1.5" /> Exportar Relatório Excel (.xlsx)
              </Button>
            </div>

            {reportSubView === 'SMS' ? (
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
                  {state.subscriptions.map((sub) => {
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
            ) : reportSubView === 'AGENDA' ? (
              <div className="space-y-3">
                <h4 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-700" /> Agenda de Renovações de Contratos e Vencimentos
                </h4>
                {state.subscriptions.map((sub) => (
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
            ) : (
              <div className="space-y-3">
                <h4 className="font-black text-base text-slate-900">
                  Relatório Detalhado: {reportSubView}
                </h4>
                <p className="text-xs text-slate-600">
                  Total de Titulares Ativos:{' '}
                  <strong>{metrics.holdersActive}</strong> • Titulares Inativos/Pendentes:{' '}
                  <strong>{metrics.holdersInactive}</strong> • Dependentes:{' '}
                  <strong>
                    {metrics.dependentsActive + metrics.dependentsInactive}
                  </strong>{' '}
                  • Total Recebido:{' '}
                  <strong>{formatCurrency(metrics.totalPaidAmount)}</strong>
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 5: MODALIDADES UNIFICADAS & CONTRATOS */}
        <TabsContent value="planos_contratos" className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Modalidades Unificadas (Sem Duplicar Mensal e Anual)
                </h3>
                <p className="text-xs text-slate-500">
                  Cada modalidade possui o Valor Mensal, Valor Anual e o Layout Oficial Frente/Verso da Carteirinha em um único cadastro.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  setEditingModality({
                    id: `mod_${Date.now()}`,
                    code: `CUSTOM_${Date.now()}`,
                    name: 'Nova Modalidade Lessa',
                    subtitle: 'Descrição da modalidade',
                    verse: '',
                    monthlyPrice: 49.9,
                    annualPrice: 538.92,
                    annualInstallment: 44.91,
                    adhesionFee: 0,
                    maxDependents: 99,
                    gracePeriodDays: 0,
                    frontCardUrl: '/cards/18.png',
                    backCardUrl: '/cards/24.png',
                    requiresDocument: false,
                    isFreeTier: false,
                    visibleOnSite: true,
                    visibleInSimulator: true,
                    visibleToConsultants: true,
                    visibleToInfluencers: true,
                    contractType: 'ADESAO_PF',
                    active: true,
                  })
                }
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Nova Modalidade
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {state.modalities.map((mod) => (
                <div
                  key={mod.id}
                  className="rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-4 bg-slate-50/50"
                >
                  <div className="flex items-center gap-3.5">
                    <img
                      src={mod.frontCardUrl}
                      alt={mod.name}
                      className="w-20 h-12 object-cover rounded-lg border border-slate-300 shadow-sm shrink-0"
                    />
                    <div>
                      <div className="font-black text-sm text-slate-900 flex items-center gap-2">
                        {mod.name}
                        {mod.isFreeTier && (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                            Grátis / Cortesia
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-600">
                        Mensal: <strong>{formatCurrency(mod.monthlyPrice)}</strong>{' '}
                        • Anual: <strong>{formatCurrency(mod.annualPrice)}</strong> (12x{' '}
                        {formatCurrency(mod.annualInstallment)})
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingModality(mod)}
                  >
                    Editar
                  </Button>
                </div>
              ))}
            </div>
          </div>

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
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedSubForDetail(subscription);
                        setQuickSearchOpen(false);
                      }}
                      className="bg-[#004d00] hover:bg-emerald-800 text-white font-bold"
                    >
                      Abrir Situação / Carteirinha
                    </Button>
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
          MODAL DE CADASTRO EXISTENTE: SITUAÇÃO (LIBERAR / INATIVAR / STATUS)
          + CARTEIRINHAS SEPARADAS (TITULAR vs DEPENDENTES)
      ===================================================================== */}
      <Dialog
        open={!!selectedSubForDetail}
        onOpenChange={(o) => !o && setSelectedSubForDetail(null)}
      >
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          {selectedSubForDetail && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-black flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Cadastro do Associado • {selectedSubForDetail.holderName}
                  </span>
                  <Badge
                    className={
                      selectedSubForDetail.status === 'ACTIVE'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }
                  >
                    STATUS ATUAL:{' '}
                    {selectedSubForDetail.status === 'ACTIVE'
                      ? 'ATIVO (LIBERADO)'
                      : 'INATIVO'}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              {/* BLOCO SITUAÇÃO (IDÊNTICO À IMAGEM ENVIADA: LIBERAR / INATIVAR / STATUS ? + SALVAR) */}
              <div className="bg-slate-50 rounded-2xl border-2 border-slate-200 p-5 space-y-4">
                <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">
                    SITUAÇÃO DO CADASTRO
                  </h3>
                  <span className="text-xs text-slate-500">
                    Cartão Principal: <strong>#{selectedSubForDetail.subscriptionCode}</strong> • CPF:{' '}
                    <strong>{selectedSubForDetail.holderCpf}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  {/* Liberar */}
                  <div className="sm:col-span-4 flex items-center gap-3">
                    <Label className="text-xs font-bold text-slate-600 w-20 text-right shrink-0">
                      Liberar
                    </Label>
                    <select
                      value={situacaoLiberar}
                      onChange={(e) => {
                        const val = e.target.value as 'SIM' | 'NAO';
                        setSituacaoLiberar(val);
                        setSituacaoInativar(val === 'SIM' ? 'NAO' : 'SIM');
                      }}
                      className="w-full h-10 rounded-lg border border-slate-300 px-3 text-xs font-bold bg-white"
                    >
                      <option value="SIM">SIM</option>
                      <option value="NAO">NÃO</option>
                    </select>
                  </div>

                  {/* Inativar */}
                  <div className="sm:col-span-4 flex items-center gap-3">
                    <Label className="text-xs font-bold text-slate-600 w-20 text-right shrink-0">
                      Inativar
                    </Label>
                    <select
                      value={situacaoInativar}
                      onChange={(e) => {
                        const val = e.target.value as 'NAO' | 'SIM';
                        setSituacaoInativar(val);
                        setSituacaoLiberar(val === 'SIM' ? 'NAO' : 'SIM');
                      }}
                      className="w-full h-10 rounded-lg border border-slate-300 px-3 text-xs font-bold bg-white"
                    >
                      <option value="NAO">NÃO</option>
                      <option value="SIM">SIM</option>
                    </select>
                  </div>

                  {/* Status ? */}
                  <div className="sm:col-span-4 flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-600">
                      Status <span className="text-blue-600">?</span>
                    </span>
                    <span
                      className={`text-sm font-black uppercase px-3 py-1 rounded-md ${
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
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrintContract(selectedSubForDetail)}
                    className="font-bold text-xs"
                  >
                    <Printer className="w-4 h-4 mr-1.5" /> Imprimir Contrato Assinado
                  </Button>

                  <Button
                    type="button"
                    onClick={() => {
                      const targetStatus =
                        situacaoLiberar === 'SIM' && situacaoInativar === 'NAO'
                          ? 'ACTIVE'
                          : 'INACTIVE';
                      handleToggleSubStatus(selectedSubForDetail, targetStatus);
                    }}
                    className="bg-[#004d00] hover:bg-emerald-900 text-white font-black uppercase tracking-wider px-8 h-10 rounded-md shadow"
                  >
                    SALVAR
                  </Button>
                </div>
              </div>

              {/* 1. CARTEIRINHA DO TITULAR PRINCIPAL */}
              <div className="space-y-4">
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
                              subscriptions: state.subscriptions.map((s) =>
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

                {/* 2. CARTEIRINHAS DOS DEPENDENTES VINCULADOS */}
                {selectedSubForDetail.members.some((m) => m.role === 'DEPENDENTE') && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
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
                                  subscriptions: state.subscriptions.map((s) =>
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* =====================================================================
          MANUAL CLIENT REGISTRATION MODAL (IDÊNTICO AO LABCARD:
          DADOS PESSOAIS | PLANOS + OBSERVAÇÕES | ENDEREÇO + CADASTRAR)
      ===================================================================== */}
      <Dialog open={newSubModalOpen} onOpenChange={setNewSubModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-3">
              CADASTRAR CLIENTE PF / FAMÍLIA
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateManualSubscription} className="space-y-6 pt-2">
            {/* SEÇÃO 1: DADOS PESSOAIS */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1.5">
                DADOS PESSOAIS
              </h4>

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
                    type="date"
                    value={holderBirthDate}
                    onChange={(e) => setHolderBirthDate(e.target.value)}
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
                    onChange={(e) => setHolderCpfCnpj(e.target.value)}
                    placeholder="000.000.000-00"
                    required
                  />
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
                  Telefone
                </Label>
                <div className="sm:col-span-5">
                  <Input
                    value={holderPhone}
                    onChange={(e) => setHolderPhone(e.target.value)}
                    placeholder="99999-9999"
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
                    placeholder="cliente@email.com"
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
                  Cartão principal/padrão:
                </Label>
                <div className="sm:col-span-6">
                  <select
                    value={holderCardCustom}
                    onChange={(e) => setHolderCardCustom(e.target.value)}
                    className="w-full h-10 rounded-md border border-slate-300 px-3 text-xs font-bold bg-white"
                  >
                    <option value="CARTÃO PADRÃO DESSE CLIENTE">
                      CARTÃO PADRÃO DESSE CLIENTE
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
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1.5">
                PLANOS
              </h4>

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
                    {state.modalities.map((m) => (
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
                      <div className="sm:col-span-3">
                        <Label className="text-[11px] font-bold">CPF</Label>
                        <Input
                          value={dep.cpf}
                          onChange={(e) => {
                            const val = e.target.value;
                            setManualDependents((prev) =>
                              prev.map((d, i) =>
                                i === idx ? { ...d, cpf: val } : d
                              )
                            );
                          }}
                          placeholder="CPF do dependente"
                        />
                      </div>
                      <div className="sm:col-span-4">
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
                          {state.modalities.map((m) => (
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
                    onChange={(e) => setZipCode(e.target.value)}
                    onBlur={handleAdminCepBlur}
                    placeholder="Apenas Números"
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

      {/* EDIT MODALITY MODAL */}
      <Dialog
        open={!!editingModality}
        onOpenChange={(o) => !o && setEditingModality(null)}
      >
        <DialogContent className="max-w-lg">
          {editingModality && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="font-black">
                  Configurar Modalidade • {editingModality.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-bold">Nome da Modalidade</Label>
                  <Input
                    value={editingModality.name}
                    onChange={(e) =>
                      setEditingModality({
                        ...editingModality,
                        name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold">
                      Valor Mensal Avulso (R$)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editingModality.monthlyPrice}
                      onChange={(e) =>
                        setEditingModality({
                          ...editingModality,
                          monthlyPrice: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold">Valor Anual Total (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editingModality.annualPrice}
                      onChange={(e) => {
                        const annual = Number(e.target.value);
                        setEditingModality({
                          ...editingModality,
                          annualPrice: annual,
                          annualInstallment: Number((annual / 12).toFixed(2)),
                        });
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold">
                      Imagem Frente (/cards/*.png)
                    </Label>
                    <Input
                      value={editingModality.frontCardUrl}
                      onChange={(e) =>
                        setEditingModality({
                          ...editingModality,
                          frontCardUrl: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold">
                      Imagem Verso (/cards/*.png)
                    </Label>
                    <Input
                      value={editingModality.backCardUrl}
                      onChange={(e) =>
                        setEditingModality({
                          ...editingModality,
                          backCardUrl: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <Button
                  onClick={async () => {
                    const exists = state.modalities.some(
                      (m) => m.id === editingModality.id
                    );
                    const nextModalities = exists
                      ? state.modalities.map((m) =>
                          m.id === editingModality.id ? editingModality : m
                        )
                      : [...state.modalities, editingModality];
                    await persist({ ...state, modalities: nextModalities });
                    setEditingModality(null);
                    toast({ title: 'Modalidade salva com sucesso!' });
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Salvar Modalidade
                </Button>
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
    </div>
  );
};
