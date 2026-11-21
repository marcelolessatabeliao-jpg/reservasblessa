import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useLocation, Link } from 'react-router-dom';
import {
  CreditCard,
  FileText,
  Receipt,
  LogOut,
  Search,
  Copy,
  ExternalLink,
  Printer,
  RefreshCw,
  ArrowLeft,
  Sparkles,
  QrCode,
  Lock,
  CheckCircle2,
  MessageCircle,
  X,
  HelpCircle,
  Info,
  Calendar,
  Clock,
  Gift,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  Users,
  Eye,
  EyeOff,
  Camera,
  Upload,
  FileCheck,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  ClubInvoice,
  ClubMember,
  ClubSubscription,
  ClubConsultant,
} from '@/lib/club-types';
import {
  ClubDatabaseState,
  fetchClubState,
  getClubStateSync,
  saveClubState,
  findMemberOrSubscriptionByQuery,
  formatCurrency,
  formatDateBR,
  generateAsaasChargeForClubInvoice,
  generateAllAsaasInvoicesForSubscription,
  checkClubInvoicePaymentStatus,
  renderSubscriptionContractHtml,
  printDocumentHtml,
  cleanDigits,
  getBirthDatePassword,
  getQrCodeImageUrl,
  getPlanDocumentRule,
  memberHasProofDocument,
  resolveSubscriptionInactivityStatus,
  getValidityLabelFromDate,
  getMemberResolvedAttachments,
  isMemberBlockedForMissingDoc,
  isClubDateExpired,
  attachMemberProofDocument,
  compressImageFile,
  fileToDataUrl,
  buildConsultantReferralUrl,
  doesConsultantAllowModality,
  getSelectablePlansForConsultants,
  getConsultantSubscriptionMetrics,
  syncSubscriptionInvoicesWithAsaas,
} from '@/lib/club-service';
import { ClubMemberCardView } from '@/components/club/ClubMemberCardView';

const SocioPortal: React.FC = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isConsultantRoute =
    location.pathname.toLowerCase().includes('/consultor') ||
    location.pathname.toLowerCase().includes('/influencer');
  const initialCpfOrCard = searchParams.get('cpf') || searchParams.get('card') || '';
  const isDirectLogin = searchParams.get('direct') === '1' || searchParams.get('auto') === '1';

  const [state, setState] = useState<ClubDatabaseState>(() => getClubStateSync());
  const [loginInput, setLoginInput] = useState(initialCpfOrCard);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activePortalTab, setActivePortalTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('lessa_socio_portal_tab');
      if (saved) return saved;
    }
    return 'carteirinhas';
  });

  const [subscription, setSubscription] = useState<ClubSubscription | null>(() => {
    if (typeof window !== 'undefined') {
      const syncState = getClubStateSync();
      if (isDirectLogin && initialCpfOrCard && syncState) {
        const matches = findMemberOrSubscriptionByQuery(syncState, initialCpfOrCard);
        if (matches.length > 0) {
          sessionStorage.setItem('lessa_socio_sub_id', matches[0].subscription.id);
          return matches[0].subscription;
        }
      }
      const savedSubId = sessionStorage.getItem('lessa_socio_sub_id');
      if (savedSubId && syncState) {
        const found = syncState.subscriptions?.find(
          (s) => s.id === savedSubId || s.subscriptionCode === savedSubId || s.holderCpf === savedSubId
        );
        if (found) return found;
      }
    }
    return null;
  });
  const [loggedConsultant, setLoggedConsultant] = useState<ClubConsultant | null>(null);
  const [portalType, setPortalType] = useState<'ASSOCIADO' | 'CONSULTOR'>(
    isConsultantRoute ? 'CONSULTOR' : 'ASSOCIADO'
  );

  useEffect(() => {
    if (isConsultantRoute) {
      setPortalType('CONSULTOR');
    }
  }, [isConsultantRoute]);
  const [isSyncing, setIsSyncing] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [selectedInvoiceForPix, setSelectedInvoiceForPix] = useState<ClubInvoice | null>(null);
  const [paymentMethodTab, setPaymentMethodTab] = useState<'PIX' | 'CARD'>('PIX');
  const [generatingPixId, setGeneratingPixId] = useState<string | null>(null);
  const [checkingInvoiceId, setCheckingInvoiceId] = useState<string | null>(null);

  const sortedInvoices = useMemo(() => {
    if (!subscription?.invoices) return [];
    return [...subscription.invoices].sort(
      (a, b) => a.installmentNumber - b.installmentNumber
    );
  }, [subscription]);

  const nextPayableInvoice = useMemo(() => {
    return sortedInvoices.find((i) => i.status !== 'PAID');
  }, [sortedInvoices]);

  // Identifica todas as faturas vencidas do cadastro
  const overdueInvoices = useMemo(() => {
    return sortedInvoices.filter(
      (i) => i.status === 'OVERDUE' || (i.status === 'PENDING' && new Date(i.dueDate + 'T23:59:59') < new Date())
    );
  }, [sortedInvoices]);

  // Regra de liberação de faturas:
  // - TODAS as parcelas vencidas ficam liberadas simultaneamente para pagamento imediato (não precisa pagar uma para liberar a outra)
  // - Parcelas futuras (PENDING) permanecem liberadas mês a mês após a quitação das anteriores
  const isInvoicePayable = (inv: ClubInvoice) => {
    if (inv.status === 'PAID') return false;
    const isOverdue = inv.status === 'OVERDUE' || (inv.status === 'PENDING' && new Date(inv.dueDate + 'T23:59:59') < new Date());
    if (isOverdue) return true;
    if (overdueInvoices.length === 0 && inv.id === nextPayableInvoice?.id) {
      return true;
    }
    return false;
  };

  const isSubscriptionActive = useMemo(() => {
    if (!subscription) return false;

    // Se o status da assinatura foi definido como INATIVO, SUSPENSO, CANCELADO ou PENDENTE pelo admin, DEVE SER FALSO!
    if (
      subscription.status === 'INACTIVE' ||
      subscription.status === 'SUSPENDED' ||
      subscription.status === 'CANCELLED' ||
      subscription.status === 'PENDING'
    ) {
      return false;
    }

    // Cadastros que ainda estão pendentes de transferência e não confirmados não são ativos até a conclusão pela administração
    if (
      subscription.status === 'PENDING_TRANSFER' ||
      (!subscription.transferCompleted &&
        !subscription.manuallyConfirmedTransfer &&
        (subscription.origin === 'IMPORT_LABCARD' || subscription.id.startsWith('sub-labcard-')))
    ) {
      return false;
    }

    const isFamily =
      subscription.contractType === 'FAMILY_PUBLICIDADE' ||
      (subscription.planSummaryLabel && /family|adesiv|publicidade/i.test(subscription.planSummaryLabel));

    if (isFamily) {
      const hasSticker = !!subscription.vehicleStickerPhotoUrl;
      const dependents = subscription.members?.filter((m, idx) => m.role === 'DEPENDENTE' && idx > 0) || [];
      const hasAllDepDocs = dependents.length === 0 || dependents.every((d) => memberHasProofDocument(d, subscription));
      if (!hasSticker || !hasAllDepDocs) {
        return false;
      }
    }

    // Se estiver explicitamente ativo
    if (subscription.status === 'ACTIVE') return true;

    if (subscription.monthlyEquivalent === 0 || subscription.paymentMethod === 'COURTESY') return true;
    if (subscription.contractType === 'FAMILY_PUBLICIDADE') return true;
    if (subscription.planSummaryLabel && /publicidade|permuta/i.test(subscription.planSummaryLabel)) return true;
    return false;
  }, [subscription]);

  const isPendingTransfer = useMemo(() => {
    if (!subscription || isSubscriptionActive) return false;
    if (
      subscription.status === 'INACTIVE' ||
      subscription.status === 'SUSPENDED' ||
      subscription.status === 'CANCELLED'
    ) {
      return false;
    }
    return (
      subscription.status === 'PENDING_TRANSFER' ||
      (!subscription.transferCompleted &&
        !subscription.manuallyConfirmedTransfer &&
        (subscription.origin === 'IMPORT_LABCARD' || subscription.id.startsWith('sub-labcard-')))
    );
  }, [subscription, isSubscriptionActive]);

  useEffect(() => {
    let active = true;
    setIsSyncing(true);
    fetchClubState()
      .then((loaded) => {
        if (!active) return;
        setState(loaded);
        if (typeof window !== 'undefined') {
          const isDirect = searchParams.get('direct') === '1' || searchParams.get('auto') === '1';
          if (isDirect && initialCpfOrCard) {
            const matches = findMemberOrSubscriptionByQuery(loaded, initialCpfOrCard);
            if (matches.length > 0) {
              setSubscription(matches[0].subscription);
              sessionStorage.setItem('lessa_socio_sub_id', matches[0].subscription.id);
              return;
            }
          }
          const savedSubId = sessionStorage.getItem('lessa_socio_sub_id');
          if (savedSubId) {
            const found = loaded.subscriptions?.find(
              (s) => s.id === savedSubId || s.subscriptionCode === savedSubId || s.holderCpf === savedSubId
            );
            if (found) {
              setSubscription(found);
              return;
            }
          }
        }
        if (subscription?.id) {
          const fresh = loaded.subscriptions?.find((s) => s.id === subscription.id);
          if (fresh) setSubscription(fresh);
        }
      })
      .catch((err) => {
        console.warn('[SocioPortal] Falha ao sincronizar com servidor, mantendo cache local:', err);
      })
      .finally(() => {
        if (active) setIsSyncing(false);
      });
    return () => {
      active = false;
    };
  }, [initialCpfOrCard, searchParams]);

  useEffect(() => {
    if (subscription?.id && state?.subscriptions) {
      const fresh = state.subscriptions.find((s) => s.id === subscription.id);
      if (fresh && fresh !== subscription) {
        setSubscription(fresh);
      }
    }
  }, [state?.subscriptions]);

  const [isSyncingAsaas, setIsSyncingAsaas] = useState(false);

  const handleManualSyncAsaas = async () => {
    if (!subscription) return;
    setIsSyncingAsaas(true);
    try {
      const res = await syncSubscriptionInvoicesWithAsaas(subscription);
      if (res.updatedSub) {
        const resolved = resolveSubscriptionInactivityStatus(res.updatedSub);
        setSubscription(resolved);
      }
      if (res.state) {
        setState(res.state);
      }
      toast({
        title: 'Faturas Sincronizadas!',
        description: `${res.updatedSub?.invoices?.length || 0} mensalidade(s) sincronizadas com a base oficial do Asaas.`,
      });
    } catch (err: any) {
      console.error('[SocioPortal] Erro ao sincronizar com Asaas:', err);
      toast({
        title: 'Aviso de Sincronização',
        description: 'Não foi possível contatar o Asaas no momento. Exibindo dados em cache.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncingAsaas(false);
    }
  };

  // Sincronização automática em segundo plano das cobranças originais do Asaas para qualquer associado
  useEffect(() => {
    if (!subscription || !subscription.holderCpf) return;
    let active = true;
    syncSubscriptionInvoicesWithAsaas(subscription).then((res) => {
      if (!active) return;
      if (res.updatedSub) {
        const resolved = resolveSubscriptionInactivityStatus(res.updatedSub);
        setSubscription(resolved);
      }
      if (res.state) {
        setState(res.state);
      }
    });
    return () => {
      active = false;
    };
  }, [subscription?.id]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim()) return;

    const qClean = loginInput.trim().toLowerCase();
    const qDigits = cleanDigits(loginInput);

    setIsLoggingIn(true);
    try {
      let currentState = state;

      const findInState = (st: ClubDatabaseState) => {
        const cons = (st.consultants || []).find((c) => {
          const emailMatch = !!c.email && c.email.toLowerCase().trim() === qClean;
          const cpfMatch = !!c.cpf && cleanDigits(c.cpf) === qDigits && qDigits.length >= 6;
          const codeMatch = !!c.referralCode && c.referralCode.toLowerCase().trim() === qClean;
          return emailMatch || cpfMatch || codeMatch;
        });
        const memberMatches = findMemberOrSubscriptionByQuery(st, loginInput);
        return { cons, memberMatches };
      };

      let { cons: foundCons, memberMatches } = findInState(currentState);

      if (
        (portalType === 'CONSULTOR' && !foundCons) ||
        (portalType === 'ASSOCIADO' && memberMatches.length === 0 && !foundCons)
      ) {
        const freshState = await fetchClubState();
        setState(freshState);
        currentState = freshState;
        ({ cons: foundCons, memberMatches } = findInState(currentState));
      }

      // 1. Verifica se é acesso de Consultor ou Influencer (E-mail ou CPF + Senha, mesma mecânica do Associado)
      if (foundCons && (portalType === 'CONSULTOR' || memberMatches.length === 0)) {
        if (foundCons.status === 'INACTIVE') {
          toast({
            title: 'Cadastro inativo',
            description: 'Este acesso de consultor/influencer está desativado. Procure a administração.',
            variant: 'destructive',
          });
          return;
        }

        if (!passwordInput.trim()) {
          toast({
            title: 'Senha obrigatória',
            description: 'Informe sua senha de acesso ao Portal do Consultor.',
            variant: 'destructive',
          });
          return;
        }

        const pass = passwordInput.trim();
        const consCpfDigits = cleanDigits(foundCons.cpf);
        const validPasses = foundCons.password?.trim()
          ? [foundCons.password.trim()]
          : [consCpfDigits, consCpfDigits.slice(0, 6), '123456'].filter(Boolean);

        const isValid = validPasses.some(
          (p) => p === pass || (cleanDigits(p).length >= 4 && cleanDigits(p) === cleanDigits(pass))
        );
        if (!isValid) {
          toast({
            title: 'Senha incorreta',
            description: 'A senha informada não confere para este consultor/influencer.',
            variant: 'destructive',
          });
          return;
        }

        setLoggedConsultant(foundCons);
        toast({
          title: `Bem-vindo(a), ${foundCons.name.split(' ')[0]}!`,
          description: `Painel do ${foundCons.role === 'INFLUENCER' ? 'Influencer' : 'Consultor'} acessado com sucesso.`,
        });
        return;
      }

      if (portalType === 'CONSULTOR' && !foundCons) {
        toast({
          title: 'Consultor / Influencer não localizado',
          description: 'Verifique seu E-mail, CPF ou Código de Indicação e tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      // 2. Acesso do Associado (E-mail, CPF ou Carteirinha + Senha)
      if (memberMatches.length === 0) {
        toast({
          title: 'Cadastro não localizado',
          description: 'Verifique seu E-mail, CPF ou Carteirinha e tente novamente.',
          variant: 'destructive',
        });
        return;
      }
      const foundSub = memberMatches[0].subscription;

      if (!passwordInput.trim()) {
        toast({
          title: 'Senha obrigatória',
          description: 'Informe sua senha (data de nascimento no formato DDMMAAAA) para acessar.',
          variant: 'destructive',
        });
        return;
      }
      const cleanPass = cleanDigits(passwordInput);
      const holderPass = getBirthDatePassword(foundSub.holderBirthDate);
      const memberPasses = foundSub.members.map((m) => getBirthDatePassword(m.birthDate));
      const allValidPasses = [holderPass, ...memberPasses, '123456'];

      const isValid = allValidPasses.some((p) => p && cleanDigits(p) === cleanPass);
      if (!isValid) {
        toast({
          title: 'Senha incorreta',
          description: 'A senha informada não confere. Verifique seus dados e tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      setSubscription(foundSub);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('lessa_socio_sub_id', foundSub.id);
      }
      toast({
        title: `Bem-vindo(a), ${foundSub.holderName.split(' ')[0]}!`,
        description: 'Acesse suas carteirinhas, faturas e contrato abaixo.',
      });
    } catch (err: any) {
      console.error('[SocioPortal] Erro ao validar acesso:', err);
      toast({
        title: 'Erro ao acessar conta',
        description: err?.message || 'Não foi possível validar seus dados. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setSubscription(null);
    setLoggedConsultant(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('lessa_socio_sub_id');
      sessionStorage.removeItem('lessa_socio_portal_tab');
    }
  };

  const handleUpdateMemberPhoto = async (memberId: string, photoDataUrl: string) => {
    if (!state || !subscription) return;
    if (subscription.status !== 'ACTIVE') {
      toast({
        title: 'Plano Inativo (Aguardando Ativação)',
        description: 'A edição e download da carteirinha só são liberados após a confirmação do pagamento ou ativação do plano pela administração.',
        variant: 'destructive',
      });
      return;
    }
    const updatedSub: ClubSubscription = {
      ...subscription,
      updatedAt: new Date().toISOString(),
      members: subscription.members.map((m) =>
        m.id === memberId ? { ...m, photoUrl: photoDataUrl } : m
      ),
    };
    const nextState: ClubDatabaseState = {
      ...state,
      subscriptions: state.subscriptions.map((s) =>
        s.id === updatedSub.id ? updatedSub : s
      ),
    };
    const saved = await saveClubState(nextState);
    setState(saved);
    setSubscription(updatedSub);
    toast({
      title: 'Foto atualizada na carteirinha!',
      description: 'Sua carteirinha digital já está com a nova foto.',
    });
  };

  const [uploadingDocMemberId, setUploadingDocMemberId] = useState<string | null>(null);
  const [previewDocModal, setPreviewDocModal] = useState<{
    name: string;
    dataUrl: string;
    mimeType?: string;
  } | null>(null);

  const handleUploadMemberDocument = async (member: ClubMember, file: File) => {
    if (!subscription) return;
    setUploadingDocMemberId(member.id);
    try {
      const dataUrl = file.type.startsWith('image/')
        ? await compressImageFile(file)
        : await fileToDataUrl(file);
      const saved = await attachMemberProofDocument(subscription.id, member.id, {
        dataUrl,
        fileName: file.name,
        mimeType: file.type,
      });
      setState(saved);
      let updatedSub = saved.subscriptions.find((s) => s.id === subscription.id);
      if (updatedSub) {
        updatedSub = resolveSubscriptionInactivityStatus(updatedSub);
        setSubscription(updatedSub);
      }
      toast({
        title: 'Comprovante enviado com sucesso!',
        description: `Documento anexado para ${member.fullName}. Pendência documental regularizada!`,
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao anexar documento',
        description: err?.message || 'Não foi possível enviar o arquivo. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploadingDocMemberId(null);
    }
  };

  const [uploadingVehicleSticker, setUploadingVehicleSticker] = useState(false);

  const handleUploadVehicleStickerPhoto = async (file: File) => {
    if (!subscription || !state) return;
    setUploadingVehicleSticker(true);
    try {
      const dataUrl = file.type.startsWith('image/')
        ? await compressImageFile(file)
        : await fileToDataUrl(file);
      const updatedSub: ClubSubscription = {
        ...subscription,
        vehicleStickerPhotoUrl: dataUrl,
        vehicleStickerPhotoName: file.name,
        vehicleStickerStatus: 'PENDENTE',
        updatedAt: new Date().toISOString(),
      };
      const nextState: ClubDatabaseState = {
        ...state,
        subscriptions: state.subscriptions.map((s) =>
          s.id === updatedSub.id ? updatedSub : s
        ),
        lastSyncTimestamp: new Date().toISOString(),
      };
      const saved = await saveClubState(nextState);
      setState(saved);
      setSubscription(updatedSub);
      toast({
        title: 'Foto do veículo anexada com sucesso!',
        description: 'A foto do carro adesivado foi salva e enviada para conferência da administração.',
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao anexar foto do veículo',
        description: err?.message || 'Não foi possível salvar a imagem. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploadingVehicleSticker(false);
    }
  };

  const handleGeneratePixOrLink = async (
    invoice: ClubInvoice,
    billingType: 'PIX' | 'CREDIT_CARD' = 'PIX'
  ) => {
    if (!state || !subscription) return;
    if (!isInvoicePayable(invoice)) {
      toast({
        title: 'Parcela bloqueada',
        description: overdueInvoices.length > 0
          ? `Por favor, efetue primeiro o pagamento das parcelas vencidas em aberto. A liberação de faturas futuras ocorre após a quitação das vencidas.`
          : `Por favor, efetue primeiro o pagamento da parcela ${nextPayableInvoice?.installmentNumber}. A liberação para pagamento é realizada a cada mês para não pular mensalidades.`,
        variant: 'destructive',
      });
      return;
    }
    setGeneratingPixId(invoice.id);
    try {
      const charge = await generateAsaasChargeForClubInvoice(subscription, invoice, billingType);
      const refreshedState = await fetchClubState();
      setState(refreshedState);
      const refreshedSub =
        refreshedState.subscriptions.find((s) => s.id === subscription.id) || subscription;
      setSubscription(refreshedSub);
      const updatedInv =
        refreshedSub.invoices.find((i) => i.id === invoice.id) || {
          ...invoice,
          asaasPaymentId: charge.paymentId,
          invoiceUrl: charge.invoiceUrl,
          pixPayload: charge.pixPayload,
          pixQrCode: charge.pixQrCode,
        };
      setSelectedInvoiceForPix(updatedInv);
      if (billingType === 'CREDIT_CARD' && charge.invoiceUrl) {
        window.open(charge.invoiceUrl, '_blank');
      }
      toast({
        title:
          billingType === 'PIX'
            ? 'Cobrança PIX gerada com sucesso!'
            : 'Fatura de Cartão gerada com sucesso!',
      });
    } catch (err: any) {
      console.warn('Erro ao gerar via Asaas, abrindo opções de pagamento oficiais:', err);
      setSelectedInvoiceForPix(invoice);
      toast({
        title: 'Aviso Asaas',
        description: err?.message || 'Você pode pagar via Chave PIX oficial ou solicitar suporte.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingPixId(null);
    }
  };

  const handleCheckPayment = async (invoice: ClubInvoice) => {
    if (!state || !subscription) return;
    setCheckingInvoiceId(invoice.id);
    const isPaid = await checkClubInvoicePaymentStatus(subscription.id, invoice.id);
    setCheckingInvoiceId(null);

    if (isPaid) {
      const refreshed = await fetchClubState();
      setState(refreshed);
      let refreshedSub = refreshed.subscriptions.find((s) => s.id === subscription.id) || null;
      if (refreshedSub) {
        refreshedSub = resolveSubscriptionInactivityStatus(refreshedSub);
      }
      setSubscription(refreshedSub);
      toast({
        title: 'Pagamento confirmado!',
        description: 'Sua assinatura e faturas foram atualizadas com sucesso.',
      });
    } else {
      toast({
        title: 'Aguardando compensação',
        description: 'O banco ainda não confirmou o pagamento desta fatura. Tente novamente em instantes.',
      });
    }
  };

  const handlePrintContract = () => {
    if (!state || !subscription) return;
    const html = renderSubscriptionContractHtml(subscription, state.contractTemplates);
    printDocumentHtml(`Contrato Lessa Club - ${subscription.holderName}`, html);
  };

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-clip bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/assinatura"
              className="text-slate-300 hover:text-white flex items-center gap-1.5 text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Link>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span className="font-black tracking-tight text-sm md:text-base">
                PORTAL DO ASSOCIADO • LESSA CLUB
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://wa.me/5569992626140?text=Ol%C3%A1%2C+sou+associado+do+Balne%C3%A1rio+Lessa+e+gostaria+de+tirar+uma+d%C3%BAvida+sobre+a+%C3%A1rea+do+associado."
              target="_blank"
              rel="noreferrer"
            >
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm"
              >
                <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Dúvidas no WhatsApp
              </Button>
            </a>
            {(subscription || loggedConsultant) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sair
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 pt-8 max-w-6xl">
        {loggedConsultant ? (() => {
          const metrics = getConsultantSubscriptionMetrics(
            loggedConsultant,
            state?.subscriptions || []
          );
          const linkedSubs = metrics.linkedSubs;
          const paidSales = metrics.paidSales;
          const pendingSubs = metrics.pendingSubs;
          const totalPaidCommission = metrics.totalPaidCommission;

          const selectablePlans = getSelectablePlansForConsultants(state?.modalities);
          const allowedPlans =
            loggedConsultant.allowedPlanCodes && loggedConsultant.allowedPlanCodes.length > 0
              ? selectablePlans.filter((p) =>
                  doesConsultantAllowModality(loggedConsultant.allowedPlanCodes, p)
                )
              : selectablePlans;

          const referralLink = buildConsultantReferralUrl(
            window.location.origin,
            loggedConsultant
          );
          const qrCodeUrl = getQrCodeImageUrl(referralLink, 280);

          const copyReferralLink = (customUrl = referralLink) => {
            navigator.clipboard.writeText(customUrl);
            toast({
              title: 'Link copiado!',
              description: 'O seu link personalizado de indicação foi copiado para a área de transferência.',
            });
          };

          const shareWhatsApp = () => {
            const text = `🌿 Olá! Venha ser associado do *Balneário Família Lessa* com benefícios exclusivos! Faça sua adesão pelo meu link oficial de atendimento (*${loggedConsultant.name}*): ${referralLink}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
          };

          return (
            <div className="space-y-6 pb-16">
              {/* Top Banner Consultor */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        loggedConsultant.role === 'INFLUENCER'
                          ? 'bg-purple-800 text-white'
                          : 'bg-[#004d00] text-white'
                      }
                    >
                      {loggedConsultant.role === 'INFLUENCER'
                        ? 'INFLUENCER OFICIAL'
                        : 'CONSULTOR DE VENDAS'}
                    </Badge>
                    <Badge className="bg-emerald-600 text-white">ATIVO</Badge>
                  </div>
                  <h1 className="text-2xl font-black text-slate-900 mt-2">
                    Olá, {loggedConsultant.name}!
                  </h1>
                  <p className="text-xs text-slate-600">
                    Código de Indicação: <strong className="font-mono text-emerald-800">{loggedConsultant.referralCode}</strong> • CPF: {loggedConsultant.cpf}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sair do Painel
                  </Button>
                </div>
              </div>

              {/* Box de Vendas: Link e QR Code */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-gradient-to-br from-[#004d00] to-slate-950 text-white rounded-3xl p-6 shadow-md flex flex-col justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black tracking-tight mb-1 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-300" /> Seu Link Oficial de Vendas
                    </h2>
                    <p className="text-xs text-emerald-200 mb-4">
                      Divulgue este link no WhatsApp, redes sociais e clientes. Todas as adesões realizadas através dele serão creditadas automaticamente a você.
                    </p>
                    <div className="flex flex-col sm:flex-row items-stretch gap-2 bg-black/40 p-2 rounded-2xl border border-white/20">
                      <Input
                        readOnly
                        value={referralLink}
                        className="bg-transparent border-none text-white font-mono text-xs select-all focus-visible:ring-0"
                      />
                      <Button
                        type="button"
                        onClick={() => copyReferralLink(referralLink)}
                        className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar Link
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button
                      type="button"
                      onClick={shareWhatsApp}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Compartilhar no WhatsApp
                    </Button>
                    <a href={referralLink} target="_blank" rel="noopener noreferrer">
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white font-bold text-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir Minha Página
                      </Button>
                    </a>
                  </div>
                </div>

                {/* Card com QR Code */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    QR Code de Vendas
                  </span>
                  <div className="p-2 bg-white rounded-2xl border-2 border-emerald-800 shadow-sm">
                    <img src={qrCodeUrl} alt="QR Code" className="w-36 h-36 mx-auto object-contain" />
                  </div>
                  <a href={qrCodeUrl} download={`QRCode_${loggedConsultant.referralCode}.png`}>
                    <Button size="sm" variant="outline" className="text-xs font-bold border-slate-300 text-slate-800 hover:bg-slate-100 hover:text-slate-900">
                      <Printer className="w-3.5 h-3.5 mr-1.5" /> Baixar Imagem QR Code
                    </Button>
                  </a>
                </div>
              </div>

              {/* Planos Liberados para este Consultor */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Planos Disponíveis no Seu Link ({allowedPlans.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Clientes que acessam seu link ou QR Code visualizam exclusivamente estes planos configurados pela administração.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allowedPlans.map((plan) => {
                    const directPlanUrl = buildConsultantReferralUrl(
                      window.location.origin,
                      loggedConsultant,
                      plan.code
                    );
                    return (
                      <div
                        key={plan.code}
                        className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="font-black text-xs text-slate-900 block truncate">
                            {plan.name}
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-800 block">
                            {plan.isFreeTier
                              ? 'Gratuito (R$ 0,00)'
                              : `Mensal ${formatCurrency(plan.monthlyPrice)} • Anual ${formatCurrency(plan.annualPrice)}`}
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => copyReferralLink(directPlanUrl)}
                          className="h-7 px-2.5 text-[11px] font-bold bg-white border-emerald-600 text-emerald-900 hover:bg-emerald-50 shrink-0"
                        >
                          <Copy className="w-3 h-3 mr-1" /> Copiar
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Indicadores em Destaque */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-xs font-bold text-slate-500 block">Acessos ao Link / QR</span>
                  <span className="text-2xl font-black text-slate-900 mt-1 block">
                    {loggedConsultant.clicksCount || 0}
                  </span>
                  <span className="text-[10px] text-slate-400">visualizações rastreadas</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-xs font-bold text-slate-500 block">Pessoas que Aderiram</span>
                  <span className="text-2xl font-black text-slate-900 mt-1 block">
                    {linkedSubs.length}
                  </span>
                  <span className="text-[10px] text-slate-400">cadastros iniciados</span>
                </div>
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-sm">
                  <span className="text-xs font-bold text-emerald-800 block">Vendas Efetivamente Pagas</span>
                  <span className="text-2xl font-black text-emerald-950 mt-1 block">
                    {paidSales.length}
                  </span>
                  <span className="text-[10px] text-emerald-700">
                    Volume: {formatCurrency(metrics.totalPaidVolume)}
                  </span>
                </div>
                <div className="bg-[#004d00] text-white p-4 rounded-2xl shadow-sm">
                  <span className="text-xs font-bold text-emerald-300 block">Comissões a Receber</span>
                  <span className="text-2xl font-black text-white mt-1 block">
                    {formatCurrency(totalPaidCommission)}
                  </span>
                  <span className="text-[10px] text-emerald-200">
                    {loggedConsultant.commissionType === 'FIXED'
                      ? `R$ ${(loggedConsultant.commissionValue || 0).toFixed(2)} fixo por venda paga`
                      : `${loggedConsultant.commissionPercent || 10}% sobre vendas pagas`}
                  </span>
                </div>
              </div>

              {/* Tabela de Vendas Efetivamente Pagas (Contabilidade) */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      Contabilidade de Vendas Pagas & Comissões
                    </h3>
                    <p className="text-xs text-slate-500">
                      Comissões contabilizadas exclusivamente após o pagamento efetivo do plano pelo cliente.
                    </p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-900 font-bold text-xs self-start sm:self-auto">
                    {paidSales.length} {paidSales.length === 1 ? 'venda confirmada' : 'vendas confirmadas'}
                  </Badge>
                </div>

                {paidSales.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    Nenhuma venda com pagamento confirmado ainda. Compartilhe seu link ou QR Code para gerar suas primeiras comissões!
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#004d00] text-white text-[11px] font-bold">
                          <th className="py-2.5 px-3">Cliente</th>
                          <th className="py-2.5 px-3">Data Pgto</th>
                          <th className="py-2.5 px-3">Plano Contratado</th>
                          <th className="py-2.5 px-3">Valor do Plano</th>
                          <th className="py-2.5 px-3">Sua Comissão</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {paidSales.map((sale) => (
                          <tr key={sale.subscription.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {sale.subscription.holderName}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {formatDateBR(sale.paidAt)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              {sale.subscription.planSummaryLabel}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              <div>{formatCurrency(sale.planValue)}</div>
                              {sale.paidAmount > 0 && sale.paidAmount !== sale.planValue && (
                                <span className="text-[10px] text-emerald-700 block">
                                  Pago: {formatCurrency(sale.paidAmount)}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-black text-emerald-800">
                              {formatCurrency(sale.commissionValue)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-block px-2 py-0.5 rounded font-black text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                                PAGO
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {pendingSubs.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900">
                    <p className="font-bold mb-1">
                      ⚠️ {pendingSubs.length} {pendingSubs.length === 1 ? 'adesão aguardando pagamento' : 'adesões aguardando pagamento'}:
                    </p>
                    <p className="text-[11px] text-amber-800">
                      As comissões dessas vendas serão creditadas e liberadas assim que o cliente efetuar a compensação do pagamento.
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })() : !subscription ? (
          <>
            {/* Login Card */}
            <div className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200 shadow-xl p-8 mt-8">
              {/* Seletor Associado vs Consultor */}
              <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
                <button
                  type="button"
                  onClick={() => setPortalType('ASSOCIADO')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    portalType === 'ASSOCIADO'
                      ? 'bg-[#004d00] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Área do Associado
                </button>
                <button
                  type="button"
                  onClick={() => setPortalType('CONSULTOR')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    portalType === 'CONSULTOR'
                      ? 'bg-[#004d00] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Consultores & Influencers
                </button>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-5 mx-auto">
                <CreditCard className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-black text-center text-slate-900 mb-2">
                {portalType === 'CONSULTOR' ? 'Painel do Consultor / Influencer' : 'Área do Associado'}
              </h1>
              <p className="text-sm text-center text-slate-600 mb-6">
                {portalType === 'CONSULTOR'
                  ? 'Acesse suas vendas, acompanhe comissões em tempo real, copie seu link e gere QR Codes para divulgação.'
                  : 'Acesse suas carteirinhas digitais com QR Code, envie sua foto 3x4, consulte mensalidades e baixe seu contrato assinado.'}
              </p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-700 block mb-1.5">
                    {portalType === 'CONSULTOR'
                      ? 'E-mail ou CPF do Vendedor / Influencer'
                      : 'Usuário (E-mail, CPF ou Carteirinha)'}
                  </label>
                  <Input
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder={
                      portalType === 'CONSULTOR'
                        ? 'Ex: seuemail@gmail.com ou CPF'
                        : 'Ex: seuemail@gmail.com ou CPF'
                    }
                    className="h-12 text-base"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-700 block mb-1.5">
                    Senha * {portalType === 'CONSULTOR' && <span className="text-slate-400 font-normal lowercase">(cadastrada ou CPF)</span>}
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Digite sua senha"
                      className="h-12 text-base pr-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 transition-colors"
                      title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base rounded-xl shadow-md"
                >
                  <Search className="w-4 h-4 mr-2" /> {isLoggingIn ? 'Entrando...' : 'Acessar Minha Conta'}
                </Button>
                {isSyncing && !isLoggingIn && (
                  <p className="text-[11px] text-center text-slate-400">
                    Sincronizando cadastros mais recentes em segundo plano...
                  </p>
                )}
              </form>

              <div className="mt-6 pt-6 border-t border-slate-100 text-center space-y-3">
                <div>
                  <p className="text-xs text-slate-500 mb-2">Ainda não é sócio do Reserva Lessa?</p>
                  <Link to="/assinatura">
                    <Button variant="outline" size="sm" className="w-full font-bold">
                      Montar Meu Plano Personalizado
                    </Button>
                  </Link>
                </div>

                <a
                  href="https://wa.me/5569992626140?text=Ol%C3%A1%2C+preciso+de+ajuda+para+acessar+o+portal."
                  target="_blank"
                  rel="noreferrer"
                  className="block"
                >
                  <Button variant="ghost" size="sm" className="w-full text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 font-bold">
                    <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Dúvidas no acesso? Falar no WhatsApp
                  </Button>
                </a>
              </div>
            </div>

          <div className="mt-6 max-w-md mx-auto bg-emerald-950 text-white rounded-3xl p-5 border border-emerald-500/30 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Vantagens de ser nosso Associado
              </span>
              <span className="text-[10px] text-emerald-300 font-bold">9h às 17h</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-emerald-100">
              <div>🚫 Sem taxa de adesão</div>
              <div>🎟️ Entradas ilimitadas</div>
              <div>📅 Sex, Sáb, Dom e Feriados</div>
              <div>💳 Cartão digital e físico</div>
              <div className="col-span-2 text-amber-300 font-bold">🎟️ Seus convidados pagam apenas meia-entrada!</div>
            </div>
            <div className="text-center pt-2 border-t border-emerald-800/80 font-black text-amber-400 text-xs">
              💡 PAGUE UMA VEZ E APROVEITE O MÊS INTEIRO!
            </div>
          </div>
        </>
        ) : (
          /* Logged-in Member Dashboard */
          <div className="space-y-6">
            {/* Summary Header */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge
                    className={
                      isSubscriptionActive
                        ? 'bg-emerald-600 text-white font-black'
                        : isPendingTransfer
                        ? 'bg-amber-600 text-white font-black'
                        : 'bg-rose-600 text-white font-black'
                    }
                  >
                    {isSubscriptionActive
                      ? '● STATUS ATUAL: PLANO ATIVO (LIBERADO)'
                      : isPendingTransfer
                      ? '● STATUS ATUAL: CADASTRO EM TRANSFERÊNCIA (EM CONFERÊNCIA)'
                      : subscription.inactivityReason === 'MENSALIDADE_E_DOCUMENTOS'
                      ? '● STATUS ATUAL: PLANO INATIVO (MENSALIDADE VENCIDA + DOCS PENDENTES)'
                      : subscription.inactivityReason === 'MENSALIDADE_VENCIDA'
                      ? '● STATUS ATUAL: PLANO INATIVO (MENSALIDADE VENCIDA / PENDENTE)'
                      : subscription.inactivityReason === 'FALTA_DOCUMENTOS'
                      ? '● STATUS ATUAL: PLANO INATIVO (PENDÊNCIA DE DOCUMENTOS)'
                      : subscription.inactivityReason === 'SOLICITACAO_CLIENTE'
                      ? '● STATUS ATUAL: PLANO INATIVO (A PEDIDO DO ASSOCIADO)'
                      : subscription.inactivityReason === 'ADMINISTRATIVO'
                      ? '● STATUS ATUAL: PLANO INATIVO (BLOQUEIO ADMINISTRATIVO)'
                      : '● STATUS ATUAL: PLANO INATIVO (AGUARDANDO PAGAMENTO)'}
                  </Badge>
                  <span className="text-xs font-semibold text-slate-500">
                    Ciclo: {subscription.billingCycle === 'ANNUAL' ? 'Anual' : 'Mensal Recorrente'}
                  </span>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5 shadow-xs">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600 inline" />
                    Validade do Plano:{' '}
                    <strong className="text-emerald-950 font-black">
                      {subscription.endDate
                        ? formatDateBR(subscription.endDate)
                        : (subscription.members?.[0]?.validityLabel || '12/2027')}
                    </strong>
                  </span>
                </div>
                <h1 className="text-2xl font-black text-slate-900">
                  Olá, {subscription.holderName}
                </h1>
                <p className="text-sm text-slate-600">
                  {subscription.planSummaryLabel} •{' '}
                  <strong>
                    1 Titular + {Math.max(0, subscription.members.length - 1)} Dependente(s)
                  </strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-right">
                  <span className="text-[11px] uppercase font-bold text-slate-400 block">
                    {subscription.billingCycle === 'ANNUAL'
                      ? `Plano Anual (${formatCurrency(subscription.totalContractValue)})`
                      : 'Mensalidade Recorrente'}
                  </span>
                  <span className="text-lg font-black text-emerald-700">
                    {formatCurrency(subscription.monthlyEquivalent)}
                    <span className="text-xs font-normal text-slate-500">/mês</span>
                  </span>
                </div>
                <Button
                  variant="outline"
                  onClick={handlePrintContract}
                  className="border-slate-300 font-bold"
                >
                  <Printer className="w-4 h-4 mr-2" /> Imprimir Contrato
                </Button>
              </div>
            </div>

            {/* BANNER OFICIAL: AVISO DE VIGÊNCIA 2027 & OPORTUNIDADE DO PLANO ANUAL */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-amber-950 text-white p-5 sm:p-6 border-2 border-amber-400/50 shadow-lg">
              <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="space-y-2 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-xs">
                      <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                      Aviso Importante • Vigência 2027
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-amber-200 border border-amber-300/30">
                      🎁 10% OFF no Plano Anual
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-black text-amber-300 tracking-tight leading-snug">
                    Novos valores entrarão em vigência a partir de janeiro de 2027 para os planos mensais. Assine hoje mesmo!
                  </h3>

                  <p className="text-xs sm:text-sm text-emerald-100 font-medium leading-relaxed">
                    Garanta agora o <strong className="text-white underline decoration-amber-400 decoration-2">Preço de 2026 por mais 1 ano</strong> atualizando para o <strong className="text-amber-300 font-black">PLANO ANUAL</strong> e parcele em <strong className="text-white font-black">até 12x sem juros no Cartão com 10% de desconto</strong> e tenha o melhor balneário de Rondônia à disposição da sua família o ano todo.
                  </p>
                </div>

                <div className="shrink-0 w-full md:w-auto flex flex-col sm:flex-row md:flex-col gap-2.5">
                  <a
                    href={`https://wa.me/5569992626140?text=${encodeURIComponent(
                      `Olá! Sou associado(a) ${subscription.holderName} (Cartão #${subscription.subscriptionCode}) e tenho interesse em migrar para o PLANO ANUAL com 10% de desconto em até 12x sem juros para garantir o valor de 2026 por mais 12 meses!`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full"
                  >
                    <Button
                      type="button"
                      className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm h-11 px-5 rounded-xl shadow-md border border-amber-300 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <Gift className="w-4 h-4 text-slate-950" />
                      Garantir Preço de 2026 no Anual
                    </Button>
                  </a>
                  <a
                    href={`https://wa.me/5569992626140?text=${encodeURIComponent(
                      `Olá! Gostaria de tirar dúvidas sobre o PLANO ANUAL e formas de pagamento para o cadastro de ${subscription.holderName}.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full text-center"
                  >
                    <span className="text-[11px] font-bold text-amber-200 hover:text-white underline transition-colors inline-flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" /> Falar com atendimento no WhatsApp
                    </span>
                  </a>
                </div>
              </div>
            </div>

              {/* Main Tabs */}
              <Tabs
                value={activePortalTab}
                onValueChange={(val) => {
                  setActivePortalTab(val);
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem('lessa_socio_portal_tab', val);
                  }
                }}
                className="space-y-6"
              >
                <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full max-w-4xl bg-slate-200/80 p-1 rounded-2xl h-auto sm:h-12 gap-1">
                  <TabsTrigger
                    value="carteirinhas"
                    className="rounded-xl font-bold text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:text-emerald-700"
                  >
                    <CreditCard className="w-4 h-4 mr-1.5" /> Carteirinhas ({(subscription.members || []).length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="documentos"
                    className="rounded-xl font-bold text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:text-amber-700"
                  >
                    <FileCheck className="w-4 h-4 mr-1.5" /> Documentos
                    {subscription.members.some((m) => isMemberBlockedForMissingDoc(m, subscription)) && (
                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
                        Pendente
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="faturas"
                    className="rounded-xl font-bold text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:text-emerald-700"
                  >
                    <Receipt className="w-4 h-4 mr-1.5" /> Mensalidades ({(subscription.invoices || []).length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="contrato"
                    className="rounded-xl font-bold text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:text-emerald-700"
                  >
                    <FileText className="w-4 h-4 mr-1.5" /> Meu Contrato
                  </TabsTrigger>
                  <TabsTrigger
                    value="vantagens"
                    className="rounded-xl font-bold text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:text-amber-700"
                  >
                    <Sparkles className="w-4 h-4 mr-1.5 text-amber-500" /> Vantagens & Dúvidas
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: CARTEIRINHAS (DIVIDIDO EM TITULAR E DEPENDENTES) */}
                <TabsContent value="carteirinhas" className="space-y-6">
                  {/* EXPLICAÇÃO DO QR CODE DE ACESSO */}
                  <div className="bg-gradient-to-r from-emerald-950 to-slate-900 text-white rounded-3xl p-5 md:p-6 border border-emerald-500/30 shadow-md">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 text-emerald-400">
                          <QrCode className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-black text-sm md:text-base text-white flex items-center gap-2">
                            <span>📲 Como funciona o QR Code da sua Carteirinha?</span>
                            <Badge className="bg-emerald-500 text-slate-950 font-black text-[10px]">
                              Portaria Inteligente
                            </Badge>
                          </h4>
                          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                            Ao aproximar o QR Code da sua carteirinha do leitor da portaria ou da câmera da recepção, o sistema abre instantaneamente a página oficial de validação em tempo real. Aparece a sua <strong>foto de perfil 3x4</strong>, seus <strong>dados cadastrais</strong>, os <strong>dependentes vinculados</strong> e o <strong>status da mensalidade</strong>. Estando regularizado, a catraca é liberada de imediato sem necessidade de filas!
                          </p>
                        </div>
                      </div>
                      <Link
                        to={`/verificar/${encodeURIComponent(subscription.members[0]?.qrToken || subscription.members[0]?.cardNumber || '')}`}
                        target="_blank"
                        className="shrink-0 w-full md:w-auto"
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full md:w-auto border-emerald-400/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-white text-xs font-bold"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Simular Validação
                        </Button>
                      </Link>
                    </div>
                  </div>
                {/* AVISO UNIFICADO E COMPACTO DE SITUAÇÃO DO CADASTRO COM ATALHOS */}
                {(!isSubscriptionActive || subscription.members.some((m) => isMemberBlockedForMissingDoc(m, subscription))) ? (
                  <div className={`rounded-2xl p-3.5 sm:p-4 border-2 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isPendingTransfer
                      ? 'bg-amber-50 border-amber-300'
                      : 'bg-rose-50/90 border-rose-300'
                  }`}>
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                          isPendingTransfer ? 'bg-amber-500 text-slate-950' : 'bg-rose-600 text-white'
                        }`}>
                          <Lock className="w-3.5 h-3.5" />
                          {isPendingTransfer
                            ? 'Cadastro em Transferência'
                            : subscription.inactivityReason === 'MENSALIDADE_E_DOCUMENTOS'
                            ? 'Plano Inativo • Mensalidade e Documentos Pendentes'
                            : subscription.inactivityReason === 'FALTA_DOCUMENTOS'
                            ? 'Plano Inativo • Documentos Pendentes'
                            : subscription.inactivityReason === 'MENSALIDADE_VENCIDA'
                            ? 'Plano Inativo • Mensalidade Pendente'
                            : subscription.inactivityReason === 'SOLICITACAO_CLIENTE'
                            ? 'Plano Pausado a Pedido'
                            : subscription.inactivityReason === 'ADMINISTRATIVO'
                            ? 'Bloqueio Administrativo'
                            : 'Plano Inativo • Aguardando Regularização'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 font-medium leading-snug">
                        {isPendingTransfer
                          ? 'Cadastro em conferência pela administração. A liberação ocorrerá assim que finalizada a transferência.'
                          : 'Para liberar o acesso ao clube e suas carteirinhas digitais, regularize as pendências abaixo:'}
                      </p>

                      {/* Observação da Administração exibida apenas 1 vez */}
                      {Boolean(subscription.inactivityNotes?.trim()) && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-rose-300 text-rose-950 text-xs font-bold shadow-2xs">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Obs. da Administração: "{subscription.inactivityNotes.trim()}"</span>
                        </div>
                      )}
                    </div>

                    {/* Atalhos Rápidos para as Áreas Certas */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
                      {(subscription.inactivityReason === 'MENSALIDADE_E_DOCUMENTOS' ||
                        subscription.inactivityReason === 'MENSALIDADE_VENCIDA' ||
                        subscription.invoices?.some((i) => i.status !== 'PAID')) && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setActivePortalTab('faturas');
                            if (typeof window !== 'undefined') {
                              sessionStorage.setItem('lessa_socio_portal_tab', 'faturas');
                            }
                          }}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs h-9 px-3.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          Pagar Mensalidades
                        </Button>
                      )}

                      {(subscription.inactivityReason === 'MENSALIDADE_E_DOCUMENTOS' ||
                        subscription.inactivityReason === 'FALTA_DOCUMENTOS' ||
                        subscription.members.some((m) => isMemberBlockedForMissingDoc(m, subscription))) && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setActivePortalTab('documentos');
                            if (typeof window !== 'undefined') {
                              sessionStorage.setItem('lessa_socio_portal_tab', 'documentos');
                            }
                          }}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs h-9 px-3.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          Anexar Documentos
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between gap-4">
                    <div className="text-xs text-emerald-900 font-medium">
                      <strong className="font-black text-emerald-950">● Plano Ativo e Liberado!</strong> Clique nas carteirinhas abaixo para salvar a imagem no celular ou atualizar a foto 3x4.
                    </div>
                  </div>
                )}

                {/* SEÇÃO 1: CARTEIRINHA DO TITULAR PRINCIPAL */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-base sm:text-lg font-black text-emerald-950 uppercase tracking-tight">
                      1. Carteirinha do Titular Responsável
                    </h3>
                    <Badge className="bg-emerald-800 text-white text-xs">
                      Titular da Assinatura #{subscription.subscriptionCode}
                    </Badge>
                  </div>

                  {subscription.members
                    .filter((m, idx) => m.role === 'TITULAR' || idx === 0)
                    .slice(0, 1)
                    .map((member) => {
                      const docRule = getPlanDocumentRule(member.modalityCode, member.modalityName);
                      const hasDoc = memberHasProofDocument(member, subscription);
                      const missingDoc = isMemberBlockedForMissingDoc(member, subscription);
                      const effExp = member.expirationDate || subscription.endDate;
                      const isExpiredMember = isClubDateExpired(effExp);
                      const isLockedMember =
                        !isSubscriptionActive ||
                        member.status !== 'ACTIVE' ||
                        isExpiredMember ||
                        missingDoc;
                      return (
                        <div
                          key={member.id}
                          className="bg-white rounded-3xl border-2 border-emerald-600/40 p-5 shadow-sm space-y-4"
                        >
                          <ClubMemberCardView
                            member={
                              subscription.endDate
                                ? {
                                    ...member,
                                    expirationDate: subscription.endDate,
                                    validityLabel: getValidityLabelFromDate(subscription.endDate, member.validityLabel),
                                  }
                                : member
                            }
                            showBackSide={true}
                            locked={isLockedMember}
                            lockReason={
                              missingDoc
                                ? `Falta anexar: ${docRule.title || 'comprovante do plano'}`
                                : isExpiredMember
                                ? `Cadastro expirado em ${formatDateBR(effExp)}`
                                : !isSubscriptionActive || member.status !== 'ACTIVE'
                                ? (
                                    subscription.inactivityReason === 'MENSALIDADE_E_DOCUMENTOS'
                                      ? 'Bloqueado por mensalidade pendente e documentos'
                                      : subscription.inactivityReason === 'MENSALIDADE_VENCIDA'
                                      ? 'Bloqueado por mensalidade pendente'
                                      : subscription.inactivityReason === 'FALTA_DOCUMENTOS'
                                      ? 'Bloqueado por pendência documental'
                                      : subscription.inactivityReason === 'SOLICITACAO_CLIENTE'
                                      ? 'Plano pausado a pedido'
                                      : subscription.inactivityReason === 'ADMINISTRATIVO'
                                      ? 'Bloqueio administrativo'
                                      : 'Aguardando liberação do cadastro'
                                  )
                                : undefined
                            }
                            onUpdatePhoto={isLockedMember || !isSubscriptionActive ? undefined : handleUpdateMemberPhoto}
                          />

                          {(() => {
                            const memberDocs = getMemberResolvedAttachments(member, subscription);
                            const hasRealDoc = memberDocs.length > 0 || hasDoc;
                            const showSection = docRule.requiresDocument || hasRealDoc;
                            if (!showSection) return null;

                            const isApproved = hasRealDoc && (member.documentVerified === true || member.documentStatus === 'APROVADO');

                            return (
                              <div
                                className={`rounded-xl border p-2.5 sm:p-3 space-y-2 ${
                                  !hasRealDoc && docRule.requiresDocument
                                    ? 'bg-rose-50/80 border-rose-300'
                                    : missingDoc
                                    ? 'bg-amber-50/80 border-amber-300'
                                    : 'bg-emerald-50/60 border-emerald-200'
                                }`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                                    <FileCheck className={`w-3.5 h-3.5 ${!hasRealDoc && docRule.requiresDocument ? 'text-rose-600' : missingDoc ? 'text-amber-600' : 'text-emerald-700'}`} />
                                    <span>Comprovação ({member.modalityName})</span>
                                    {(() => {
                                      if (!hasRealDoc && docRule.requiresDocument) {
                                        return (
                                          <Badge className="bg-rose-600 text-white text-[9px] font-black uppercase px-2 py-0.5">
                                            DOCUMENTO PENDENTE
                                          </Badge>
                                        );
                                      }
                                      if (hasRealDoc && isApproved) {
                                        return (
                                          <Badge className="bg-emerald-700 text-white text-[9px] font-black uppercase px-2 py-0.5">
                                            ✓ COMPROVANTE APROVADO
                                          </Badge>
                                        );
                                      }
                                      if (hasRealDoc && !isApproved) {
                                        return (
                                          <Badge className="bg-amber-600 text-white text-[9px] font-black uppercase px-2 py-0.5">
                                            EM ANÁLISE
                                          </Badge>
                                        );
                                      }
                                      return (
                                        <Badge className="bg-slate-500 text-white text-[9px] font-bold uppercase px-2 py-0.5">
                                          DISPENSADO
                                        </Badge>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#004d00] hover:bg-emerald-900 text-white text-xs font-bold cursor-pointer shadow-xs">
                                      <Upload className="w-3.5 h-3.5" />
                                      {uploadingDocMemberId === member.id
                                        ? 'Enviando...'
                                        : memberDocs.length > 0
                                        ? 'Novo Comprovante'
                                        : 'Anexar Documento'}
                                      <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        className="hidden"
                                        disabled={uploadingDocMemberId === member.id}
                                        onChange={(e) => {
                                          const f = e.target.files?.[0];
                                          if (f) handleUploadMemberDocument(member, f);
                                        }}
                                      />
                                    </label>
                                  </div>
                                </div>
                                {missingDoc && (
                                  <div className="text-[10px] text-amber-900 bg-white/90 rounded-lg p-2 border border-amber-200/80 leading-snug">
                                    <span className="font-bold">Comprovantes aceitos: </span>
                                    <span>{docRule.acceptedDocs.join(' • ')}</span>
                                  </div>
                                )}
                                {memberDocs.length > 0 && (
                                  <div className="space-y-2 pt-1">
                                    <div className="text-[11px] font-bold text-slate-700">
                                      Documentos e comprovantes deste titular ({memberDocs.length}):
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {memberDocs.map((doc) => (
                                        <div
                                          key={doc.id}
                                          className="flex items-center justify-between gap-2.5 bg-white rounded-xl p-2.5 border border-emerald-200 shadow-xs"
                                        >
                                          <div className="flex items-center gap-2 min-w-0">
                                            {doc.dataUrl.startsWith('data:image/') || doc.mimeType?.startsWith('image/') ? (
                                              <img
                                                src={doc.dataUrl}
                                                alt={doc.name}
                                                className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                                              />
                                            ) : (
                                              <div className="w-10 h-10 rounded-lg bg-emerald-800 text-white font-black text-xs flex items-center justify-center shrink-0">
                                                PDF
                                              </div>
                                            )}
                                            <div className="min-w-0">
                                              <div className="font-bold text-xs text-slate-900 truncate" title={doc.name}>
                                                {doc.name}
                                              </div>
                                              <div className="text-[10px] text-emerald-700 font-semibold">
                                                {member.documentVerified || member.documentStatus === 'APROVADO' ? '✓ Validado pela Administração' : 'Anexado ao cadastro'}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              onClick={() =>
                                                setPreviewDocModal({
                                                  name: doc.name,
                                                  dataUrl: doc.dataUrl,
                                                  mimeType: doc.mimeType,
                                                })
                                              }
                                              className="h-7 px-2 text-xs font-bold border-emerald-600 bg-white text-emerald-800 hover:bg-emerald-50 hover:text-emerald-950"
                                            >
                                              <Eye className="w-3.5 h-3.5 mr-1" /> Visualizar
                                            </Button>
                                            <a
                                              href={doc.dataUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              download={doc.name}
                                            >
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="h-7 px-2 text-xs font-bold"
                                              >
                                                <Download className="w-3.5 h-3.5 mr-1" /> Baixar
                                              </Button>
                                            </a>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                </div>

                {/* SEÇÃO 2: CARTEIRINHAS DOS DEPENDENTES VINCULADOS */}
                {subscription.members.filter((m, idx) => m.role === 'DEPENDENTE' && idx > 0)
                  .length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between px-1">
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                          2. Carteirinhas dos Dependentes Vinculados (
                          {
                            subscription.members.filter(
                              (m, idx) => m.role === 'DEPENDENTE' && idx > 0
                            ).length
                          }
                          )
                        </h3>
                        <p className="text-xs text-slate-500">
                          Carteirinhas individuais vinculadas ao plano do titular {subscription.holderName}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      {subscription.members
                        .filter((m, idx) => m.role === 'DEPENDENTE' && idx > 0)
                        .map((member, depIdx) => {
                          const docRule = getPlanDocumentRule(member.modalityCode, member.modalityName);
                          const hasDoc = memberHasProofDocument(member, subscription);
                          const missingDoc = isMemberBlockedForMissingDoc(member, subscription);
                          const effExp = member.expirationDate || subscription.endDate;
                          const isExpiredDep = isClubDateExpired(effExp);
                          const isLockedDep =
                            !isSubscriptionActive ||
                            isDepInactive ||
                            member.status !== 'ACTIVE' ||
                            isExpiredDep ||
                            missingDoc;
                          return (
                            <div
                              key={member.id}
                              className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4"
                            >
                              <ClubMemberCardView
                                member={
                                  effExp
                                    ? {
                                        ...member,
                                        expirationDate: effExp,
                                        validityLabel: getValidityLabelFromDate(effExp, member.validityLabel),
                                      }
                                    : member
                                }
                                dependentIndex={depIdx + 1}
                                showBackSide={true}
                                locked={isLockedDep}
                                lockReason={
                                  missingDoc
                                    ? `Falta anexar: ${docRule.title || 'comprovante do plano'}`
                                    : isExpiredDep
                                    ? `Cadastro expirado em ${formatDateBR(effExp)}`
                                    : isDepInactive
                                    ? 'Dependente inativo no momento'
                                    : !isSubscriptionActive || member.status !== 'ACTIVE'
                                    ? (
                                        subscription.inactivityReason === 'MENSALIDADE_E_DOCUMENTOS'
                                          ? 'Bloqueado por mensalidade pendente e documentos'
                                          : subscription.inactivityReason === 'MENSALIDADE_VENCIDA'
                                          ? 'Bloqueado por mensalidade pendente'
                                          : subscription.inactivityReason === 'FALTA_DOCUMENTOS'
                                          ? 'Bloqueado por pendência documental'
                                          : subscription.inactivityReason === 'SOLICITACAO_CLIENTE'
                                          ? 'Plano pausado a pedido'
                                          : subscription.inactivityReason === 'ADMINISTRATIVO'
                                          ? 'Bloqueio administrativo'
                                          : 'Aguardando liberação do titular'
                                      )
                                    : undefined
                                }
                                onUpdatePhoto={isLockedDep || !isSubscriptionActive ? undefined : handleUpdateMemberPhoto}
                              />

                              {(() => {
                                const memberDocs = getMemberResolvedAttachments(member, subscription);
                                const hasRealDoc = memberDocs.length > 0 || hasDoc;
                                const showSection = docRule.requiresDocument || hasRealDoc;
                                if (!showSection) return null;

                                const isApproved = hasRealDoc && (member.documentVerified === true || member.documentStatus === 'APROVADO');

                                return (
                                  <div
                                    className={`rounded-xl border p-2.5 sm:p-3 space-y-2 ${
                                      !hasRealDoc && docRule.requiresDocument
                                        ? 'bg-rose-50/80 border-rose-300'
                                        : missingDoc
                                        ? 'bg-amber-50/80 border-amber-300'
                                        : 'bg-emerald-50/60 border-emerald-200'
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                                        <FileCheck className={`w-3.5 h-3.5 ${!hasRealDoc && docRule.requiresDocument ? 'text-rose-600' : missingDoc ? 'text-amber-600' : 'text-emerald-700'}`} />
                                        <span>Comprovação ({member.modalityName})</span>
                                        {(() => {
                                          if (!hasRealDoc && docRule.requiresDocument) {
                                            return (
                                              <Badge className="bg-rose-600 text-white text-[9px] font-black uppercase px-2 py-0.5">
                                                DOCUMENTO PENDENTE
                                              </Badge>
                                            );
                                          }
                                          if (hasRealDoc && isApproved) {
                                            return (
                                              <Badge className="bg-emerald-700 text-white text-[9px] font-black uppercase px-2 py-0.5">
                                                ✓ COMPROVANTE APROVADO
                                              </Badge>
                                            );
                                          }
                                          if (hasRealDoc && !isApproved) {
                                            return (
                                              <Badge className="bg-amber-600 text-white text-[9px] font-black uppercase px-2 py-0.5">
                                                EM ANÁLISE
                                              </Badge>
                                            );
                                          }
                                          return (
                                            <Badge className="bg-slate-500 text-white text-[9px] font-bold uppercase px-2 py-0.5">
                                              DISPENSADO
                                            </Badge>
                                          );
                                        })()}
                                      </div>
                                      <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#004d00] hover:bg-emerald-900 text-white text-xs font-bold cursor-pointer shadow-xs">
                                        <Upload className="w-3.5 h-3.5" />
                                        {uploadingDocMemberId === member.id
                                          ? 'Enviando...'
                                          : memberDocs.length > 0
                                          ? 'Novo Comprovante'
                                          : 'Anexar Documento'}
                                        <input
                                          type="file"
                                          accept="image/*,.pdf"
                                          className="hidden"
                                          disabled={uploadingDocMemberId === member.id}
                                          onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) handleUploadMemberDocument(member, f);
                                          }}
                                        />
                                      </label>
                                    </div>
                                    {missingDoc && (
                                      <div className="text-[10px] text-amber-900 bg-white/90 rounded-lg p-2 border border-amber-200/80 leading-snug">
                                        <span className="font-bold">Comprovantes aceitos: </span>
                                        <span>{docRule.acceptedDocs.join(' • ')}</span>
                                      </div>
                                    )}
                                    {memberDocs.length > 0 && (
                                      <div className="space-y-2 pt-1">
                                        <div className="text-[11px] font-bold text-slate-700">
                                          Documentos e comprovantes deste dependente ({memberDocs.length}):
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {memberDocs.map((doc) => (
                                            <div
                                              key={doc.id}
                                              className="flex items-center justify-between gap-2.5 bg-white rounded-xl p-2.5 border border-emerald-200 shadow-xs"
                                            >
                                              <div className="flex items-center gap-2 min-w-0">
                                                {doc.dataUrl.startsWith('data:image/') || doc.mimeType?.startsWith('image/') ? (
                                                  <img
                                                    src={doc.dataUrl}
                                                    alt={doc.name}
                                                    className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                                                  />
                                                ) : (
                                                  <div className="w-10 h-10 rounded-lg bg-emerald-800 text-white font-black text-xs flex items-center justify-center shrink-0">
                                                    PDF
                                                  </div>
                                                )}
                                                <div className="min-w-0">
                                                  <div className="font-bold text-xs text-slate-900 truncate" title={doc.name}>
                                                    {doc.name}
                                                  </div>
                                                  <div className="text-[10px] text-emerald-700 font-semibold">
                                                    {member.documentVerified || member.documentStatus === 'APROVADO' ? '✓ Validado pela Administração' : 'Anexado ao cadastro'}
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-1 shrink-0">
                                                <Button
                                                  type="button"
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() =>
                                                    setPreviewDocModal({
                                                      name: doc.name,
                                                      dataUrl: doc.dataUrl,
                                                      mimeType: doc.mimeType,
                                                    })
                                                  }
                                                  className="h-7 px-2 text-xs font-bold border-emerald-600 bg-white text-emerald-800 hover:bg-emerald-50 hover:text-emerald-950"
                                                >
                                                  <Eye className="w-3.5 h-3.5 mr-1" /> Visualizar
                                                </Button>
                                                <a
                                                  href={doc.dataUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  download={doc.name}
                                                >
                                                  <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 px-2 text-xs font-bold"
                                                  >
                                                    <Download className="w-3.5 h-3.5 mr-1" /> Baixar
                                                  </Button>
                                                </a>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* TAB DOCUMENTOS: VISUALIZAR JÁ ENVIADOS E IMPORTAR DOCUMENTOS PENDENTES POR PLANO */}
              <TabsContent value="documentos" className="space-y-4">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      Central de Documentos e Comprovações dos Planos
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Visualize os documentos já enviados pelo titular e dependentes ou importe os comprovantes obrigatórios pendentes para liberar suas carteirinhas.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* SEÇÃO VEÍCULO ADESIVADO PARA PLANO LESSA FAMILY */}
                    {(() => {
                      const isFamily =
                        subscription.contractType === 'FAMILY_PUBLICIDADE' ||
                        (subscription.planSummaryLabel && /family|adesiv|publicidade/i.test(subscription.planSummaryLabel));
                      if (!isFamily) return null;

                      const hasSticker = !!subscription.vehicleStickerPhotoUrl;

                      return (
                        <div
                          className={`rounded-2xl border-2 p-4 sm:p-5 space-y-3 ${
                            !hasSticker
                              ? 'border-amber-400 bg-amber-50/70'
                              : 'border-emerald-200 bg-emerald-50/40'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="bg-amber-800 text-white font-black text-xs">
                                  🚗 VEÍCULO DO TITULAR
                                </Badge>
                                <span className="font-black text-sm text-slate-900">
                                  {subscription.vehicleBrand || ''} {subscription.vehicleModel || 'Veículo Cadastrado'}
                                </span>
                                {subscription.vehiclePlate && (
                                  <Badge variant="outline" className="font-mono font-bold text-xs bg-white">
                                    Placa: {subscription.vehiclePlate}
                                  </Badge>
                                )}
                                {subscription.vehicleColor && (
                                  <span className="text-xs text-slate-600">
                                    Cor: {subscription.vehicleColor}
                                  </span>
                                )}
                                {hasSticker ? (
                                  <Badge className="bg-emerald-700 text-white text-[10px] font-black">
                                    ✓ FOTO DO CARRO ADESIVADO ENVIADA
                                  </Badge>
                                ) : (
                                  <Badge className="bg-rose-600 text-white text-[10px] font-black animate-pulse">
                                    ⚠️ FOTO DO CARRO ADESIVADO OBRIGATÓRIA PENDENTE
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 mt-1">
                                O Plano Lessa Family exige a comprovação do veículo adesivado para ativação do titular e seus dependentes.
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-black cursor-pointer shadow-sm">
                                <Camera className="w-3.5 h-3.5" />
                                Câmera
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  disabled={uploadingVehicleSticker}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleUploadVehicleStickerPhoto(f);
                                  }}
                                />
                              </label>
                              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-900 text-xs font-black cursor-pointer shadow-sm">
                                <Upload className="w-3.5 h-3.5" />
                                {uploadingVehicleSticker ? 'Enviando...' : hasSticker ? 'Substituir Foto' : 'Enviar Foto do Carro'}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={uploadingVehicleSticker}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleUploadVehicleStickerPhoto(f);
                                  }}
                                />
                              </label>
                            </div>
                          </div>

                          {subscription.vehicleStickerPhotoUrl && (
                            <div className="pt-2">
                              <div className="text-xs font-bold text-slate-700 mb-1.5">Foto do veículo cadastrada:</div>
                              <div
                                onClick={() =>
                                  setPreviewDocModal({
                                    name: subscription.vehicleStickerPhotoName || 'Foto do Carro Adesivado',
                                    dataUrl: subscription.vehicleStickerPhotoUrl!,
                                    mimeType: 'image/jpeg',
                                  })
                                }
                                className="w-36 h-24 rounded-xl border border-slate-300 overflow-hidden cursor-pointer hover:opacity-90 relative group shadow-xs"
                              >
                                <img
                                  src={subscription.vehicleStickerPhotoUrl}
                                  alt="Carro adesivado"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[11px] font-bold">
                                  <Eye className="w-4 h-4 mr-1" /> Ver foto
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {subscription.members.map((member, mIdx) => {
                      const docRule = getPlanDocumentRule(member.modalityCode, member.modalityName);
                      const hasDoc = memberHasProofDocument(member, subscription);
                      const missingDoc = isMemberBlockedForMissingDoc(member, subscription);
                      const allDocs = getMemberResolvedAttachments(member, subscription);

                      return (
                        <div
                          key={member.id}
                          className={`rounded-2xl border-2 p-4 sm:p-5 space-y-3 ${
                            missingDoc
                              ? 'border-amber-400 bg-amber-50/70'
                              : 'border-slate-200 bg-slate-50/60'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={member.role === 'TITULAR' ? 'bg-emerald-800 text-white' : 'bg-blue-700 text-white'}>
                                  {member.role === 'TITULAR' ? 'TITULAR' : `DEPENDENTE #${mIdx}`}
                                </Badge>
                                <span className="font-black text-sm text-slate-900">
                                  {member.fullName}
                                </span>
                                <Badge variant="outline" className="font-bold text-xs">
                                  {member.modalityName}
                                </Badge>
                                {(() => {
                                  if (!docRule.requiresDocument) {
                                    return (
                                      <Badge className="bg-slate-500 text-white text-[10px] font-bold">
                                        NÃO EXIGE DOCUMENTO
                                      </Badge>
                                    );
                                  }
                                  if (member.documentVerified || member.documentStatus === 'APROVADO') {
                                    return (
                                      <Badge className="bg-emerald-700 text-white text-[10px] font-black shadow-xs">
                                        ✓ DOCUMENTO APROVADO PELO ADMIN
                                      </Badge>
                                    );
                                  }
                                  if (member.documentRejectionReason) {
                                    return (
                                      <Badge className="bg-rose-700 text-white text-[10px] font-black shadow-xs">
                                        ✕ DOCUMENTO RECUSADO (ENVIAR NOVO)
                                      </Badge>
                                    );
                                  }
                                  if (hasDoc) {
                                    return (
                                      <Badge className="bg-amber-500 text-slate-950 text-[10px] font-black animate-pulse shadow-xs">
                                        ⏳ EM ANÁLISE PELO ADMIN
                                      </Badge>
                                    );
                                  }
                                  return (
                                    <Badge className="bg-rose-600 text-white text-[10px] font-black shadow-xs">
                                      ⚠️ COMPROVANTE OBRIGATÓRIO PENDENTE
                                    </Badge>
                                  );
                                })()}
                              </div>
                              <div className="text-xs text-slate-600 mt-1">
                                Cartão Nº <strong className="font-mono">{member.cardNumber}</strong> • CPF: {member.cpf || 'Não informado'}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#004d00] hover:bg-emerald-900 text-white text-xs font-black cursor-pointer shadow-sm">
                                <Camera className="w-3.5 h-3.5" />
                                Câmera
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  disabled={uploadingDocMemberId === member.id}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleUploadMemberDocument(member, f);
                                  }}
                                />
                              </label>
                              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-900 text-xs font-black cursor-pointer shadow-sm">
                                <Upload className="w-3.5 h-3.5" />
                                {uploadingDocMemberId === member.id ? 'Importando...' : 'Importar Arquivo (Foto / PDF)'}
                                <input
                                  type="file"
                                  accept="image/*,.pdf"
                                  className="hidden"
                                  disabled={uploadingDocMemberId === member.id}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleUploadMemberDocument(member, f);
                                  }}
                                />
                              </label>
                            </div>
                          </div>

                          {docRule.requiresDocument && (
                            <div className="bg-white rounded-xl p-3 border border-amber-200 text-xs text-slate-800 space-y-1">
                              <div className="font-black text-amber-950">
                                📄 {docRule.title} — Documentos necessários para {member.modalityName}:
                              </div>
                              <p className="text-[11px] text-slate-600">{docRule.summary}</p>
                              <ul className="space-y-0.5 pt-1">
                                {docRule.acceptedDocs.map((item, di) => (
                                  <li key={di} className="font-semibold text-slate-800">
                                    ✅ {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {member.documentRejectionReason && !member.documentVerified && member.documentStatus !== 'APROVADO' && (
                            <div className="bg-rose-100 border border-rose-300 text-rose-950 text-xs rounded-xl p-3 font-semibold space-y-1">
                              <div className="font-black text-rose-900 flex items-center gap-1.5 uppercase">
                                ⚠️ Motivo da Recusa pela Administração:
                              </div>
                              <p>{member.documentRejectionReason}</p>
                              <div className="text-[11px] text-rose-800 font-bold">
                                Por favor, tire uma nova foto nítida ou anexe o arquivo correto usando os botões acima.
                              </div>
                            </div>
                          )}

                          {hasDoc && !member.documentVerified && member.documentStatus !== 'APROVADO' && !member.documentRejectionReason && (
                            <div className="bg-amber-50 border border-amber-300 text-amber-950 text-xs rounded-xl p-3 font-medium">
                              <strong>⏳ Documentação em Análise:</strong> Seu comprovante foi recebido e está aguardando validação pela administração do clube para ativação final da carteirinha.
                            </div>
                          )}

                          {(member.documentVerified || member.documentStatus === 'APROVADO') && (
                            <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs rounded-xl p-3 font-medium">
                              <strong>✓ Documentação Aprovada:</strong> O comprovante deste integrante foi verificado e aprovado pela administração. Carteirinha liberada para acesso!
                            </div>
                          )}

                          {allDocs.length > 0 ? (
                            <div className="space-y-2">
                              <div className="text-xs font-bold text-slate-700">
                                Documentos já enviados ({allDocs.length}):
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {allDocs.map((doc) => (
                                  <div
                                    key={doc.id}
                                    className="flex items-center justify-between gap-3 bg-white border border-emerald-200 rounded-xl p-2.5"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {doc.dataUrl.startsWith('data:image/') ? (
                                        <img
                                          src={doc.dataUrl}
                                          alt={doc.name}
                                          className="w-11 h-11 object-cover rounded-lg border border-slate-200 shrink-0"
                                        />
                                      ) : (
                                        <div className="w-11 h-11 rounded-lg bg-emerald-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                          PDF
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <div className="font-bold text-xs text-slate-900 truncate">
                                          {doc.name}
                                        </div>
                                        <div className="text-[10px] text-emerald-700 font-semibold">
                                          Anexado ao cadastro
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          setPreviewDocModal({
                                            name: doc.name,
                                            dataUrl: doc.dataUrl,
                                            mimeType: doc.mimeType,
                                          })
                                        }
                                        className="h-7 px-2 text-xs font-bold border-emerald-600 bg-white text-emerald-800 hover:bg-emerald-50 hover:text-emerald-950"
                                      >
                                        <Eye className="w-3.5 h-3.5 mr-1" /> Visualizar
                                      </Button>
                                      <a
                                        href={doc.dataUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={doc.name}
                                      >
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-xs font-bold"
                                        >
                                          <Download className="w-3.5 h-3.5 mr-1" /> Baixar
                                        </Button>
                                      </a>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 italic">
                              Nenhum documento enviado ainda para este integrante.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* MODAL DE VISUALIZAÇÃO DO DOCUMENTO NO PORTAL DO SÓCIO */}
                <Dialog
                  open={Boolean(previewDocModal)}
                  onOpenChange={(open) => !open && setPreviewDocModal(null)}
                >
                  <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-900 pr-6 truncate">
                        <Eye className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span className="truncate">{previewDocModal?.name}</span>
                      </DialogTitle>
                    </DialogHeader>

                    {previewDocModal && (
                      <div className="flex-1 overflow-auto bg-slate-100 rounded-xl border border-slate-200 p-3 flex items-center justify-center min-h-[300px]">
                        {previewDocModal.dataUrl.startsWith('data:image/') ||
                        previewDocModal.mimeType?.startsWith('image/') ? (
                          <img
                            src={previewDocModal.dataUrl}
                            alt={previewDocModal.name}
                            className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-md"
                          />
                        ) : previewDocModal.dataUrl.startsWith('data:application/pdf') ||
                          previewDocModal.mimeType === 'application/pdf' ? (
                          <iframe
                            src={previewDocModal.dataUrl}
                            title={previewDocModal.name}
                            className="w-full h-[65vh] rounded-lg border border-slate-300 bg-white"
                          />
                        ) : (
                          <div className="text-center space-y-3 p-6">
                            <FileText className="w-12 h-12 text-slate-400 mx-auto" />
                            <p className="text-sm font-bold text-slate-700">
                              Pré-visualização direta indisponível para este formato.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {previewDocModal && (
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
                        <a
                          href={previewDocModal.dataUrl}
                          download={previewDocModal.name}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button
                            type="button"
                            size="sm"
                            className="bg-[#004d00] hover:bg-emerald-900 text-white font-bold text-xs"
                          >
                            <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar Documento
                          </Button>
                        </a>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setPreviewDocModal(null)}
                          className="font-bold text-xs"
                        >
                          Fechar
                        </Button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* TAB 2: FATURAS */}
              <TabsContent value="faturas" className="space-y-4">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-emerald-700" />
                        Histórico de Faturas e Mensalidades
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Cobranças vinculadas diretamente ao Asaas Oficial. Ao efetuar o pagamento da fatura ou via PIX, a baixa é realizada automaticamente no Asaas e no sistema do Balneário.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleManualSyncAsaas}
                      disabled={isSyncingAsaas}
                      className="border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-xs shrink-0 h-9"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncingAsaas ? 'animate-spin' : ''}`} />
                      {isSyncingAsaas ? 'Sincronizando...' : 'Atualizar Faturas do Asaas'}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {sortedInvoices.map((inv) => {
                      const isPaid = inv.status === 'PAID';
                      const isOverdue = inv.status === 'OVERDUE' || (!isPaid && new Date(inv.dueDate + 'T23:59:59') < new Date());
                      const isPayable = isInvoicePayable(inv);
                      return (
                        <div
                          key={inv.id}
                          className={`rounded-2xl border p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
                            isPaid
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : isOverdue
                              ? 'bg-rose-50/50 border-rose-300 ring-2 ring-rose-200/60 shadow-xs'
                              : isPayable
                              ? 'bg-amber-50/40 border-amber-300 ring-2 ring-amber-200/50'
                              : 'bg-slate-50/60 border-slate-200 opacity-80'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">
                                {inv.description || `Parcela ${inv.installmentNumber}/${inv.totalInstallments}`}
                              </span>
                              <Badge
                                className={
                                  isPaid
                                    ? 'bg-emerald-600 text-white font-bold'
                                    : isOverdue
                                    ? 'bg-red-600 text-white font-bold'
                                    : isPayable
                                    ? 'bg-amber-500 text-white font-bold'
                                    : 'bg-slate-300 text-slate-700 font-bold'
                                }
                              >
                                {isPaid ? 'PAGA' : isOverdue ? 'VENCIDA' : 'PENDENTE'}
                              </Badge>
                            </div>
                            <div className="text-xs text-slate-500">
                              Vencimento: <strong>{formatDateBR(inv.dueDate)}</strong> • Forma:{' '}
                              <strong>{inv.paymentMethod}</strong>
                              {inv.paidAt && (
                                <>
                                  {' '}
                                  • Pago em: {new Date(inv.paidAt).toLocaleDateString('pt-BR')}
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                            <span className="text-lg font-black text-slate-900 mr-2">
                              {formatCurrency(inv.amount)}
                            </span>

                            {/* Botão de Impressão / Fatura Oficial */}
                            {inv.invoiceUrl ? (
                              <a
                                href={inv.invoiceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir fatura oficial no Asaas (Pagar / Imprimir)"
                              >
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 px-2.5 rounded-xl border-slate-300 hover:bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center gap-1.5"
                                >
                                  <Printer className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="hidden sm:inline">Fatura Asaas</span>
                                </Button>
                              </a>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                title="Imprimir Recibo"
                                onClick={() => {
                                  const win = window.open('', '_blank', 'width=850,height=700');
                                  if (!win) return;
                                  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Recibo Parcela ${inv.installmentNumber}/${inv.totalInstallments}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#1e293b;}.box{border:2px solid #004d00;border-radius:12px;padding:24px;max-width:700px;margin:0 auto;}.header{display:flex;justify-content:space-between;border-bottom:2px solid #004d00;padding-bottom:12px;margin-bottom:16px;}.title{font-size:18px;font-weight:900;color:#004d00;}.row{margin:8px 0;font-size:14px;}</style></head><body><div class="box"><div class="header"><div><div class="title">BALNEÁRIO LESSA</div><div style="font-size:12px;color:#475569;">CNPJ: 46.891.134/0001-40 • Ariquemes/RO</div><div style="font-size:12px;font-weight:bold;margin-top:2px;">Recibo Oficial de Parcela</div></div><div style="text-align:right;font-weight:bold;">Parcela ${inv.installmentNumber}/${inv.totalInstallments}<br/>Valor: ${formatCurrency(inv.amount)}</div></div><div class="row"><strong>Associado:</strong> ${subscription.holderName} (Cartão ${subscription.subscriptionCode})</div><div class="row"><strong>Vencimento:</strong> ${formatDateBR(inv.dueDate)}</div><div class="row"><strong>Status:</strong> ${inv.status === 'PAID' ? 'PAGO (QUITADO)' : 'EM ABERTO'}</div></div><script>window.onload=()=>window.print();</script></body></html>`);
                                  win.document.close();
                                }}
                                className="h-9 px-2.5 rounded-xl border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5"
                              >
                                <Printer className="w-3.5 h-3.5 text-slate-500" />
                                <span className="hidden sm:inline">Recibo</span>
                              </Button>
                            )}

                            {isPaid && (
                              <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-xs py-1 px-2.5 font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Quitado
                              </Badge>
                            )}

                            {!isPaid && isPayable && (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedInvoiceForPix(inv);
                                    setPaymentMethodTab('PIX');
                                    if (!inv.pixPayload && !inv.pixQrCode) {
                                      handleGeneratePixOrLink(inv, 'PIX');
                                    }
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                                >
                                  <CreditCard className="w-4 h-4 mr-1.5" />
                                  Pagar Parcela (PIX / Cartão)
                                </Button>

                                {inv.asaasPaymentId && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={checkingInvoiceId === inv.id}
                                    onClick={() => handleCheckPayment(inv)}
                                    className="font-bold text-xs"
                                  >
                                    <RefreshCw
                                      className={`w-3.5 h-3.5 mr-1.5 ${
                                        checkingInvoiceId === inv.id ? 'animate-spin' : ''
                                      }`}
                                    />
                                    Já paguei
                                  </Button>
                                )}
                              </div>
                            )}

                            {!isPaid && !isPayable && (
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl">
                                <Lock className="w-3.5 h-3.5 text-slate-400" />
                                <span>
                                  {overdueInvoices.length > 0
                                    ? `Aguardando quitação das parcelas vencidas (${overdueInvoices.map((o) => o.installmentNumber).join(', ')})`
                                    : `Liberado a cada mês (após quitação da parcela ${nextPayableInvoice?.installmentNumber || 'anterior'})`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Modal Centralizado de Pagamento: PIX / CARTÃO */}
                  <Dialog
                    open={!!selectedInvoiceForPix}
                    onOpenChange={(open) => {
                      if (!open) setSelectedInvoiceForPix(null);
                    }}
                  >
                    <DialogContent className="max-w-md w-[95vw] p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
                      {selectedInvoiceForPix && (
                        <div className="space-y-4">
                          <DialogHeader className="text-left space-y-1.5 border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-emerald-800 text-white font-black text-xs">
                                PARCELA {selectedInvoiceForPix.installmentNumber}/{selectedInvoiceForPix.totalInstallments}
                              </Badge>
                              <span className="text-xs font-bold text-slate-500">
                                Vencimento: {formatDateBR(selectedInvoiceForPix.dueDate)}
                              </span>
                            </div>
                            <DialogTitle className="text-2xl font-black text-slate-900">
                              {formatCurrency(selectedInvoiceForPix.amount)}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-600">
                              {selectedInvoiceForPix.description || 'Mensalidade do Plano Lessa Club'}
                            </DialogDescription>
                          </DialogHeader>

                          {/* Link Direto para a Fatura Oficial no Asaas */}
                          {selectedInvoiceForPix.invoiceUrl && (
                            <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-2 text-left">
                              <div className="space-y-0.5">
                                <div className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                                  <Receipt className="w-4 h-4 text-blue-600" /> Cobrança Oficial Vinculada no Asaas
                                </div>
                                <p className="text-[11px] text-blue-800">
                                  Ao pagar via PIX ou Cartão, a quitação é compensada diretamente no Asaas sem duplicidades.
                                </p>
                              </div>
                              <a
                                href={selectedInvoiceForPix.invoiceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full sm:w-auto shrink-0"
                              >
                                <Button
                                  type="button"
                                  size="sm"
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-3 shadow-sm flex items-center justify-center gap-1.5"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" /> Abrir no Asaas
                                </Button>
                              </a>
                            </div>
                          )}

                          {/* Seletor de Método de Pagamento */}
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant={paymentMethodTab === 'PIX' ? 'default' : 'outline'}
                              onClick={() => setPaymentMethodTab('PIX')}
                              className={`font-bold h-11 text-xs sm:text-sm ${
                                paymentMethodTab === 'PIX'
                                  ? 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm'
                                  : 'bg-white text-emerald-950 border-emerald-300'
                              }`}
                            >
                              <QrCode className="w-4 h-4 mr-1.5" /> PIX Instantâneo
                            </Button>
                            <Button
                              type="button"
                              variant={paymentMethodTab === 'CARD' ? 'default' : 'outline'}
                              onClick={() => setPaymentMethodTab('CARD')}
                              className={`font-bold h-11 text-xs sm:text-sm ${
                                paymentMethodTab === 'CARD'
                                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                                  : 'bg-white text-blue-950 border-blue-200'
                              }`}
                            >
                              <CreditCard className="w-4 h-4 mr-1.5" /> Cartão de Crédito
                            </Button>
                          </div>

                          {/* ABA 1: PIX */}
                          {paymentMethodTab === 'PIX' && (
                            <div className="space-y-4 pt-1 text-center">
                              {generatingPixId === selectedInvoiceForPix.id ? (
                                <div className="py-8 space-y-3 bg-emerald-50/50 rounded-2xl border border-emerald-200">
                                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
                                  <p className="text-xs font-bold text-emerald-950">
                                    Gerando cobrança PIX no Asaas...
                                  </p>
                                </div>
                              ) : (
                                <>
                                  <p className="text-xs text-slate-600">
                                    Escaneie o QR Code abaixo com o aplicativo do seu banco ou use a chave:
                                  </p>

                                  {selectedInvoiceForPix.pixQrCode ? (
                                    <img
                                      src={`data:image/png;base64,${selectedInvoiceForPix.pixQrCode}`}
                                      alt="QR Code PIX Asaas"
                                      className="w-44 h-44 sm:w-48 sm:h-48 mx-auto rounded-2xl border-2 border-emerald-300 bg-white p-2 shadow-sm"
                                    />
                                  ) : (
                                    <img
                                      src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=46891134000140"
                                      alt="QR Code Chave PIX"
                                      className="w-44 h-44 sm:w-48 sm:h-48 mx-auto rounded-2xl border-2 border-emerald-300 bg-white p-2 shadow-sm"
                                    />
                                  )}

                                  <div className="space-y-1 text-left">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase">
                                      {selectedInvoiceForPix.pixPayload ? 'Código PIX Copia e Cola:' : 'Chave PIX Oficial (CNPJ):'}
                                    </label>
                                    <div className="flex gap-2">
                                      <Input
                                        readOnly
                                        value={selectedInvoiceForPix.pixPayload || '46.891.134/0001-40'}
                                        className="bg-slate-50 text-xs font-mono select-all h-9"
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          navigator.clipboard.writeText(
                                            selectedInvoiceForPix.pixPayload || '46.891.134/0001-40'
                                          );
                                          toast({ title: 'Código PIX copiado com sucesso!' });
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 px-3"
                                      >
                                        <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-left">
                                    Beneficiário: <strong>Balneário Família Lessa</strong><br />
                                    CNPJ: <strong>46.891.134/0001-40</strong>
                                  </div>

                                  {!selectedInvoiceForPix.pixPayload && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleGeneratePixOrLink(selectedInvoiceForPix, 'PIX')}
                                      className="w-full border-emerald-600 text-emerald-800 font-bold"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Atualizar QR Code Dinâmico
                                    </Button>
                                  )}

                                  <div className="pt-2 flex flex-col gap-2">
                                    {selectedInvoiceForPix.asaasPaymentId && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        disabled={checkingInvoiceId === selectedInvoiceForPix.id}
                                        onClick={() => handleCheckPayment(selectedInvoiceForPix)}
                                        className="w-full font-bold h-10"
                                      >
                                        <RefreshCw
                                          className={`w-4 h-4 mr-1.5 ${
                                            checkingInvoiceId === selectedInvoiceForPix.id ? 'animate-spin' : ''
                                          }`}
                                        />
                                        Já realizei o PIX (Verificar agora)
                                      </Button>
                                    )}

                                    <a
                                      href={`https://wa.me/5569992626140?text=${encodeURIComponent(
                                        `Olá! Segue o comprovante de pagamento da parcela ${selectedInvoiceForPix.installmentNumber} do Lessa Club (${subscription.subscriptionCode}) - Titular: ${subscription.holderName}`
                                      )}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="w-full"
                                    >
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full border-emerald-600 text-emerald-800 hover:bg-emerald-50 font-bold h-10"
                                      >
                                        <MessageCircle className="w-4 h-4 mr-1.5 text-emerald-600" />
                                        Enviar Comprovante no WhatsApp (69) 9 9262-6140
                                      </Button>
                                    </a>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {/* ABA 2: CARTÃO DE CRÉDITO */}
                          {paymentMethodTab === 'CARD' && (
                            <div className="space-y-4 pt-1 text-center">
                              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-left space-y-1">
                                <div className="flex items-center gap-2 font-black text-blue-950 text-sm">
                                  <CreditCard className="w-4 h-4 text-blue-600" /> Cartão de Crédito ou Débito
                                </div>
                                <p className="text-xs text-blue-900">
                                  Pagamento processado em ambiente 100% criptografado e seguro da instituição bancária Asaas.
                                </p>
                              </div>

                              {selectedInvoiceForPix.invoiceUrl ? (
                                <div className="space-y-3">
                                  <a
                                    href={selectedInvoiceForPix.invoiceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block"
                                  >
                                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black h-12 shadow-md text-sm">
                                      <CreditCard className="w-5 h-5 mr-2" />
                                      Pagar Fatura com Cartão no Asaas
                                      <ExternalLink className="w-4 h-4 ml-2" />
                                    </Button>
                                  </a>
                                  <p className="text-xs text-slate-500">
                                    Clique no botão acima para abrir a tela de pagamento seguro do Asaas e inserir seus dados de cartão.
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <p className="text-xs text-slate-600">
                                    Clique abaixo para gerar o link oficial de fatura de cartão:
                                  </p>
                                  <Button
                                    onClick={() => handleGeneratePixOrLink(selectedInvoiceForPix, 'CREDIT_CARD')}
                                    disabled={generatingPixId === selectedInvoiceForPix.id}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 shadow"
                                  >
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    {generatingPixId === selectedInvoiceForPix.id
                                      ? 'Gerando fatura de cartão...'
                                      : 'Gerar Fatura para Cartão de Crédito'}
                                  </Button>
                                </div>
                              )}

                              <div className="pt-2">
                                <a
                                  href={`https://wa.me/5569992626140?text=${encodeURIComponent(
                                    `Olá! Gostaria de pagar a parcela ${selectedInvoiceForPix.installmentNumber} do Lessa Club no cartão: ${subscription.holderName} (${subscription.subscriptionCode})`
                                  )}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block"
                                >
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="w-full text-xs text-slate-600 hover:text-slate-900"
                                  >
                                    Pagar presencialmente na maquininha ou solicitar suporte
                                  </Button>
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </TabsContent>

              {/* TAB 3: CONTRATO */}
              <TabsContent value="contrato">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">
                        Contrato Oficial de Adesão Vinculado ao Perfil
                      </h3>
                      <p className="text-xs text-slate-500">
                        Aceito digitalmente em{' '}
                        {new Date(subscription.contractSignedAt || subscription.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <Button
                      onClick={handlePrintContract}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      <Printer className="w-4 h-4 mr-2" /> Imprimir / Salvar PDF
                    </Button>
                  </div>

                  <div
                    className="prose prose-sm max-w-none bg-slate-50 p-6 rounded-2xl border border-slate-200"
                    dangerouslySetInnerHTML={{
                      __html: state
                        ? renderSubscriptionContractHtml(subscription, state.contractTemplates)
                        : '',
                    }}
                  />
                </div>
              </TabsContent>

              {/* TAB 4: VANTAGENS & DÚVIDAS */}
              <TabsContent value="vantagens" className="space-y-6">
                {/* BANNER PRINCIPAL DE VANTAGENS */}
                <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl space-y-6 border border-emerald-600/40">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-emerald-700/60 pb-6">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider mb-2">
                        ✨ Benefícios Exclusivos do Associado
                      </span>
                      <h3 className="text-2xl md:text-3xl font-black text-white">
                        Vantagens de ser nosso Associado!
                      </h3>
                      <p className="text-emerald-100 text-xs md:text-sm mt-1">
                        Aproveite com sua família tudo o que o Balneário Lessa tem a oferecer com máxima economia e conforto.
                      </p>
                    </div>

                    <a
                      href="https://wa.me/5569992626140?text=Ol%C3%A1%2C+sou+associado+do+Balne%C3%A1rio+Lessa+e+gostaria+de+tirar+uma+d%C3%BAvida+sobre+meus+benef%C3%ADcios."
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black shadow-lg">
                        <MessageCircle className="w-4 h-4 mr-2" /> Falar com o Balneário no WhatsApp
                      </Button>
                    </a>
                  </div>

                  {/* GRID DE VANTAGENS OFICIAIS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center shrink-0 text-base">
                        🚫
                      </div>
                      <div>
                        <strong className="text-sm font-black text-white block">Sem Taxa de Adesão</strong>
                        <p className="text-xs text-emerald-100">Zero custo de matrícula para entrar no clube.</p>
                      </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center shrink-0 text-base">
                        🎟️
                      </div>
                      <div>
                        <strong className="text-sm font-black text-white block">Entradas Ilimitadas</strong>
                        <p className="text-xs text-emerald-100">Acesse quantas vezes quiser durante todos os dias de funcionamento.</p>
                      </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center shrink-0 text-base">
                        📅
                      </div>
                      <div>
                        <strong className="text-sm font-black text-white block">Sextas, Sábados, Domingos & Feriados</strong>
                        <p className="text-xs text-emerald-100">Liberdade total de lazer nos melhores dias.</p>
                      </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center shrink-0 text-base">
                        ⏰
                      </div>
                      <div>
                        <strong className="text-sm font-black text-white block">Horário das 9h às 17h</strong>
                        <p className="text-xs text-emerald-100">Dia inteiro de sol, lazer e diversão em família.</p>
                      </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center shrink-0 text-base">
                        💳
                      </div>
                      <div>
                        <strong className="text-sm font-black text-white block">Carteirinha Digital e Física</strong>
                        <p className="text-xs text-emerald-100">Disponível no celular e em PVC de alta qualidade.</p>
                      </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center shrink-0 text-base">
                        📲
                      </div>
                      <div>
                        <strong className="text-sm font-black text-white block">QR Code Exclusivo</strong>
                        <p className="text-xs text-emerald-100">Acesso instantâneo e seguro sem filas na catraca.</p>
                      </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center shrink-0 text-base">
                        🎁
                      </div>
                      <div>
                        <strong className="text-sm font-black text-white block">Descontos Exclusivos</strong>
                        <p className="text-xs text-emerald-100">Cashback e promoções exclusivas em consumos.</p>
                      </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center shrink-0 text-base">
                        🎟️
                      </div>
                      <div>
                        <strong className="text-sm font-black text-white block">Convidados: Meia-Entrada!</strong>
                        <p className="text-xs text-emerald-100">Basta chegarem junto com você no balneário.</p>
                      </div>
                    </div>
                  </div>

                  {/* DESTAQUE PRINCIPAL */}
                  <div className="bg-amber-400 text-slate-950 rounded-2xl p-4 text-center font-black shadow-lg">
                    <span className="text-xs uppercase tracking-widest block text-slate-900 font-bold mb-0.5">
                      🌟 O MAIOR BENEFÍCIO DE TODOS
                    </span>
                    <span className="text-lg md:text-xl font-black">
                      💡 PAGUE UMA VEZ E APROVEITE O MÊS INTEIRO!
                    </span>
                  </div>
                </div>

                {/* FAQ / DÚVIDAS REFORMULADAS DE FORMA CURTA, CLARA E OBJETIVA */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
                  <div className="border-b border-slate-100 pb-4">
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-emerald-600" />
                      Perguntas Frequentes & Regras do Associado
                    </h3>
                    <p className="text-xs text-slate-500">
                      Entenda como funcionam as mensalidades, cortesias para crianças e idosos, regras de convidados e cancelamentos.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* CARD 1: ASSINATURA MENSAL */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        <span>A assinatura deve ser paga todo mês?</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        <strong>Sim.</strong> A assinatura de associado do Balneário Lessa é cobrada mensalmente, de forma contínua. <em>O não uso das dependências, piscinas ou serviços disponibilizados não isenta da obrigação de pagamento das mensalidades enquanto o plano permanecer ativo.</em>
                      </p>
                    </div>

                    {/* CARD 2: CANCELAMENTO */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-2">
                      <div className="flex items-center gap-2 text-rose-800 font-black text-sm">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <span>Como funciona o Cancelamento?</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Caso queira cancelar seu plano, <strong>todas as mensalidades anteriores em aberto devem estar quitadas e em dia</strong>. Se os pagamentos não forem realizados, o sistema continuará gerando as cobranças em seu nome até a formalização e quitação do saldo em aberto.
                      </p>
                    </div>

                    {/* CARD 3: CRIANÇAS, IDOSOS E PCD */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                        <Users className="w-4 h-4 text-emerald-600" />
                        <span>Crianças, Idosos e PCD/TEA precisam pagar assinatura?</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        <strong>Não!</strong> No Balneário Lessa, <strong>crianças de até 11 anos, idosos com 60 anos ou mais e pessoas com deficiência (PCD & TEA) possuem ACESSO LIVRE e GRATUITO</strong>. Eles não precisam de assinatura individual e entram gratuitamente acompanhando o titular sócio.
                      </p>
                    </div>

                    {/* CARD 4: CONVIDADOS */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                        <Gift className="w-4 h-4 text-emerald-600" />
                        <span>Posso levar convidados que não são sócios?</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        <strong>Sim!</strong> Como benefício exclusivo, seus convidados que forem ao balneário <strong>junto com você no mesmo dia pagam apenas MEIA-ENTRADA</strong> no valor do Day Use da portaria!
                      </p>
                    </div>

                    {/* CARD 5: O QUE NÃO ESTÁ INCLUSO */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-2 md:col-span-2">
                      <div className="flex items-center gap-2 text-slate-800 font-black text-sm">
                        <Info className="w-4 h-4 text-slate-600" />
                        <span>O que não está incluso na assinatura e é cobrado à parte?</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        A assinatura garante acesso irrestrito às piscinas, áreas de banho, gramados e estrutura de lazer. São contratados à parte: <strong>consumo no Restaurante e lanchonete</strong> (refeições, porções e bebidas), <strong>locação de Quiosques privativos com churrasqueira</strong> e atividades opcionais (como Futebol de Sabão, Beach Tênis e Pesca Esportiva). Como sócio, você ainda aproveita descontos e condições especiais!
                      </p>
                    </div>
                  </div>

                  {/* SUPORTE WHATSAPP */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-0.5 text-center sm:text-left">
                      <h4 className="font-black text-emerald-950 text-sm">
                        Ainda tem alguma dúvida ou precisa de suporte?
                      </h4>
                      <p className="text-xs text-emerald-800">
                        Nossa equipe de atendimento do Balneário Lessa está pronta para te atender.
                      </p>
                    </div>
                    <a
                      href="https://wa.me/5569992626140?text=Ol%C3%A1%2C+sou+associado+do+Balne%C3%A1rio+Lessa+e+preciso+de+ajuda+com+minha+assinatura."
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs">
                        <MessageCircle className="w-4 h-4 mr-1.5" /> (69) 99262-6140
                      </Button>
                    </a>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Floating WhatsApp Support Button */}
      <a
        href="https://wa.me/5569992626140?text=Ol%C3%A1%2C+sou+associado+do+Balne%C3%A1rio+Lessa+e+gostaria+de+tirar+uma+d%C3%BAvida+sobre+a+%C3%A1rea+do+associado."
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-3 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 border-2 border-white/30 text-xs sm:text-sm"
      >
        <MessageCircle className="w-5 h-5 text-white animate-bounce" />
        <span className="hidden sm:inline">Dúvidas? Fale no WhatsApp</span>
      </a>
    </div>
  );
};

export default SocioPortal;
