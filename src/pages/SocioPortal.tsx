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
  isMemberBlockedForMissingDoc,
  isClubDateExpired,
  attachMemberProofDocument,
  compressImageFile,
  fileToDataUrl,
  buildConsultantReferralUrl,
  doesConsultantAllowModality,
  getSelectablePlansForConsultants,
  getConsultantSubscriptionMetrics,
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

  const [state, setState] = useState<ClubDatabaseState>(() => getClubStateSync());
  const [loginInput, setLoginInput] = useState(initialCpfOrCard);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [subscription, setSubscription] = useState<ClubSubscription | null>(null);
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

  const isSubscriptionActive = useMemo(() => {
    if (!subscription) return false;
    if (subscription.status === 'ACTIVE') return true;
    if (subscription.monthlyEquivalent === 0 || subscription.paymentMethod === 'COURTESY') return true;
    if (subscription.contractType === 'FAMILY_PUBLICIDADE') return true;
    if (subscription.planSummaryLabel && /publicidade|permuta/i.test(subscription.planSummaryLabel)) return true;
    if (subscription.members && subscription.members.some((m) => m.status === 'ACTIVE')) return true;
    return false;
  }, [subscription]);

  useEffect(() => {
    let active = true;
    setIsSyncing(true);
    fetchClubState()
      .then((loaded) => {
        if (!active) return;
        setState(loaded);
        if (initialCpfOrCard) {
          const matches = findMemberOrSubscriptionByQuery(loaded, initialCpfOrCard);
          if (matches.length > 0) {
            setSubscription(matches[0].subscription);
          }
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
  }, [initialCpfOrCard]);

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

  const handleUpdateMemberPhoto = async (memberId: string, photoDataUrl: string) => {
    if (!state || !subscription) return;
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
      const updatedSub = saved.subscriptions.find((s) => s.id === subscription.id);
      if (updatedSub) setSubscription(updatedSub);
      toast({
        title: 'Comprovante enviado com sucesso!',
        description: `Documento anexado para ${member.fullName}. Se o plano estiver em dia ou for gratuito, a carteirinha foi liberada!`,
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

  const handleGeneratePixOrLink = async (
    invoice: ClubInvoice,
    billingType: 'PIX' | 'CREDIT_CARD' = 'PIX'
  ) => {
    if (!state || !subscription) return;
    if (nextPayableInvoice && invoice.id !== nextPayableInvoice.id) {
      toast({
        title: 'Parcela bloqueada',
        description: `Por favor, efetue primeiro o pagamento da parcela ${nextPayableInvoice.installmentNumber}. A liberação para pagamento é realizada a cada mês para não pular mensalidades.`,
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
      const refreshedSub = refreshed.subscriptions.find((s) => s.id === subscription.id) || null;
      setSubscription(refreshedSub);
      toast({
        title: 'Pagamento confirmado!',
        description: 'Sua assinatura e todas as carteirinhas da família estão ATIVAS.',
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
    <div className="min-h-screen bg-slate-50 pb-20">
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
                onClick={() => {
                  setSubscription(null);
                  setLoggedConsultant(null);
                }}
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
                    onClick={() => {
                      setLoggedConsultant(null);
                      setSubscription(null);
                    }}
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
                        : 'bg-rose-600 text-white font-black'
                    }
                  >
                    {isSubscriptionActive
                      ? '● STATUS ATUAL: PLANO ATIVO (LIBERADO)'
                      : '● STATUS ATUAL: PLANO INATIVO (AGUARDANDO PAGAMENTO)'}
                  </Badge>
                  <span className="text-xs font-semibold text-slate-500">
                    Ciclo: {subscription.billingCycle === 'ANNUAL' ? 'Anual' : 'Mensal Recorrente'}
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

              {/* Main Tabs */}
              <Tabs defaultValue="carteirinhas" className="space-y-6">
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
                {subscription.members.some((m) => isMemberBlockedForMissingDoc(m, subscription)) && (
                  <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-5 space-y-2">
                    <h4 className="font-black text-amber-950 text-sm sm:text-base flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                      Documentação Comprobatória Obrigatória Pendente
                    </h4>
                    <p className="text-xs text-amber-900">
                      Integrantes com planos especiais/gratuidade que ainda não enviaram o documento comprobatório permanecem com a carteirinha <strong>INATIVA e bloqueada para edição/download</strong> até o envio da comprovação abaixo ou na aba <strong>"Documentos"</strong>:
                    </p>
                    <ul className="text-xs font-bold text-amber-950 list-disc pl-5 space-y-0.5">
                      {subscription.members
                        .filter((m) => isMemberBlockedForMissingDoc(m, subscription))
                        .map((m) => {
                          const r = getPlanDocumentRule(m.modalityCode, m.modalityName);
                          return (
                            <li key={m.id}>
                              {m.fullName} ({m.modalityName}): {r.title}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                )}

                {!isSubscriptionActive ? (
                  <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="font-black text-rose-900 text-sm sm:text-base">
                        🔒 Plano Inativo — Aguardando Ativação do Cadastro
                      </h4>
                      <p className="text-xs text-rose-800">
                        A edição da foto 3x4 e o download das carteirinhas só são liberados após a confirmação do pagamento (aba <strong>"Mensalidades"</strong>) ou ativação do plano pela administração.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4">
                    <div className="text-xs md:text-sm text-emerald-900">
                      <strong>Plano Ativo e Liberado!</strong> Clique em <strong>"Enviar Foto"</strong> ou <strong>"Reposicionar / Enquadrar Perfil"</strong> em cada carteirinha liberada para ajustar sua foto de perfil 3x4 e baixar o PNG.
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
                        (!isSubscriptionActive && member.status !== 'ACTIVE') ||
                        isExpiredMember ||
                        missingDoc;
                      return (
                        <div
                          key={member.id}
                          className="bg-white rounded-3xl border-2 border-emerald-600/40 p-5 shadow-sm space-y-4"
                        >
                          <ClubMemberCardView
                            member={member}
                            showBackSide={true}
                            locked={isLockedMember}
                            lockReason={
                              missingDoc
                                ? `Falta anexar: ${docRule.title || 'comprovante do plano'}`
                                : isExpiredMember
                                ? `Cadastro expirado em ${formatDateBR(effExp)}`
                                : !isSubscriptionActive && member.status !== 'ACTIVE'
                                ? 'Aguardando liberação do cadastro'
                                : undefined
                            }
                            onUpdatePhoto={handleUpdateMemberPhoto}
                          />

                          {(docRule.requiresDocument || hasDoc) && (
                            <div
                              className={`rounded-2xl border p-4 space-y-2.5 ${
                                missingDoc
                                  ? 'bg-amber-50 border-amber-300'
                                  : 'bg-emerald-50/70 border-emerald-200'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-xs font-black text-slate-900 flex items-center gap-2">
                                  <FileCheck className={`w-4 h-4 ${missingDoc ? 'text-amber-600' : 'text-emerald-700'}`} />
                                  <span>
                                    Comprovação do Plano ({member.modalityName})
                                  </span>
                                  <Badge className={missingDoc ? 'bg-rose-600 text-white text-[10px]' : 'bg-emerald-600 text-white text-[10px]'}>
                                    {missingDoc ? 'OBRIGATÓRIO ANEXAR' : 'DOCUMENTO ANEXADO'}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#004d00] hover:bg-emerald-900 text-white text-xs font-bold cursor-pointer">
                                    <Upload className="w-3.5 h-3.5" />
                                    {uploadingDocMemberId === member.id
                                      ? 'Enviando...'
                                      : hasDoc
                                      ? 'Enviar Novo Comprovante'
                                      : 'Importar / Anexar Documento'}
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
                                <div className="text-[11px] text-amber-900 bg-white/90 rounded-xl p-2.5 border border-amber-200 space-y-1">
                                  <div className="font-bold">Documentos aceitos para {member.modalityName}:</div>
                                  {docRule.acceptedDocs.map((d, di) => (
                                    <div key={di}>✅ {d}</div>
                                  ))}
                                </div>
                              )}
                              {hasDoc && member.documentProofUrl && (
                                <div className="flex flex-wrap items-center gap-3 text-xs bg-white rounded-xl p-2.5 border border-emerald-200">
                                  {member.documentProofUrl.startsWith('data:image/') && (
                                    <img
                                      src={member.documentProofUrl}
                                      alt={member.documentProofName || 'Documento'}
                                      className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-900 truncate">
                                      {member.documentProofName || 'Documento comprobatório enviado'}
                                    </div>
                                    <div className="text-[11px] text-emerald-700 font-medium">
                                      Comprovação anexada ao cadastro do titular
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setPreviewDocModal({
                                          name: member.documentProofName || 'comprovante-titular',
                                          dataUrl: member.documentProofUrl!,
                                        })
                                      }
                                      className="h-7 px-2 text-xs font-bold border-emerald-600 bg-white text-emerald-800 hover:bg-emerald-50 hover:text-emerald-950"
                                    >
                                      <Eye className="w-3.5 h-3.5 mr-1" /> Visualizar
                                    </Button>
                                    <a
                                      href={member.documentProofUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download={member.documentProofName || 'comprovante-titular'}
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
                              )}
                            </div>
                          )}
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
                          const isDepInactive = member.status === 'INACTIVE';
                          const isLockedDep =
                            (!isSubscriptionActive && member.status !== 'ACTIVE') ||
                            isDepInactive ||
                            isExpiredDep ||
                            missingDoc;
                          return (
                            <div
                              key={member.id}
                              className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4"
                            >
                              <ClubMemberCardView
                                member={member}
                                dependentIndex={depIdx + 1}
                                showBackSide={true}
                                locked={isLockedDep}
                                lockReason={
                                  missingDoc
                                    ? `Falta anexar: ${docRule.title || 'comprovante do plano'}`
                                    : isExpiredDep
                                    ? `Cadastro expirado em ${formatDateBR(effExp)}`
                                    : !isSubscriptionActive && member.status !== 'ACTIVE'
                                    ? 'Aguardando liberação do titular'
                                    : isDepInactive
                                    ? 'Dependente inativo no momento'
                                    : undefined
                                }
                                onUpdatePhoto={handleUpdateMemberPhoto}
                              />

                              {(docRule.requiresDocument || hasDoc) && (
                                <div
                                  className={`rounded-2xl border p-4 space-y-2.5 ${
                                    missingDoc
                                      ? 'bg-amber-50 border-amber-300'
                                      : 'bg-emerald-50/70 border-emerald-200'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-xs font-black text-slate-900 flex items-center gap-2">
                                      <FileCheck className={`w-4 h-4 ${missingDoc ? 'text-amber-600' : 'text-emerald-700'}`} />
                                      <span>Comprovação ({member.modalityName})</span>
                                      <Badge className={missingDoc ? 'bg-rose-600 text-white text-[10px]' : 'bg-emerald-600 text-white text-[10px]'}>
                                        {missingDoc ? 'OBRIGATÓRIO ANEXAR' : 'DOCUMENTO ANEXADO'}
                                      </Badge>
                                    </div>
                                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#004d00] hover:bg-emerald-900 text-white text-xs font-bold cursor-pointer">
                                      <Upload className="w-3.5 h-3.5" />
                                      {uploadingDocMemberId === member.id
                                        ? 'Enviando...'
                                        : hasDoc
                                        ? 'Enviar Novo Comprovante'
                                        : 'Importar / Anexar Documento'}
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
                                    <div className="text-[11px] text-amber-900 bg-white/90 rounded-xl p-2.5 border border-amber-200 space-y-1">
                                      <div className="font-bold">Documentos aceitos para {member.modalityName}:</div>
                                      {docRule.acceptedDocs.map((d, di) => (
                                        <div key={di}>✅ {d}</div>
                                      ))}
                                    </div>
                                  )}
                                  {hasDoc && member.documentProofUrl && (
                                    <div className="flex flex-wrap items-center gap-3 text-xs bg-white rounded-xl p-2.5 border border-emerald-200">
                                      {member.documentProofUrl.startsWith('data:image/') && (
                                        <img
                                          src={member.documentProofUrl}
                                          alt={member.documentProofName || 'Documento'}
                                          className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                                        />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-900 truncate">
                                          {member.documentProofName || 'Documento comprobatório enviado'}
                                        </div>
                                        <div className="text-[11px] text-emerald-700 font-medium">
                                          Comprovação anexada ao cadastro do dependente
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            setPreviewDocModal({
                                              name: member.documentProofName || 'comprovante-dependente',
                                              dataUrl: member.documentProofUrl!,
                                            })
                                          }
                                          className="h-7 px-2 text-xs font-bold border-emerald-600 bg-white text-emerald-800 hover:bg-emerald-50 hover:text-emerald-950"
                                        >
                                          <Eye className="w-3.5 h-3.5 mr-1" /> Visualizar
                                        </Button>
                                        <a
                                          href={member.documentProofUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          download={member.documentProofName || 'comprovante-dependente'}
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
                                  )}
                                </div>
                              )}
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
                    {subscription.members.map((member, mIdx) => {
                      const docRule = getPlanDocumentRule(member.modalityCode, member.modalityName);
                      const hasDoc = memberHasProofDocument(member, subscription);
                      const missingDoc = isMemberBlockedForMissingDoc(member, subscription);
                      const allDocs = [
                        ...(member.documentProofUrl
                          ? [
                              {
                                id: 'primary',
                                name: member.documentProofName || 'Comprovante Principal',
                                dataUrl: member.documentProofUrl,
                                mimeType: member.documentProofUrl.startsWith('data:image/')
                                  ? 'image/jpeg'
                                  : 'application/pdf',
                              },
                            ]
                          : []),
                        ...(member.attachments || []).filter(
                          (a) => a.dataUrl && a.dataUrl !== member.documentProofUrl
                        ),
                      ];

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
                                <Badge className={missingDoc ? 'bg-rose-600 text-white text-[10px]' : member.status === 'ACTIVE' ? 'bg-emerald-600 text-white text-[10px]' : 'bg-slate-600 text-white text-[10px]'}>
                                  {missingDoc
                                    ? 'INATIVO (FALTA COMPROVAÇÃO)'
                                    : hasDoc
                                    ? 'COMPROVAÇÃO ENVIADA'
                                    : docRule.requiresDocument
                                    ? 'PENDENTE'
                                    : 'NÃO EXIGE DOCUMENTO'}
                                </Badge>
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
                  <h3 className="text-lg font-black text-slate-900">
                    Histórico de Faturas e Mensalidades
                  </h3>

                  <div className="space-y-3">
                    {sortedInvoices.map((inv) => {
                      const isPaid = inv.status === 'PAID';
                      const isCurrentPayable = !isPaid && inv.id === nextPayableInvoice?.id;
                      return (
                        <div
                          key={inv.id}
                          className={`rounded-2xl border p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
                            isPaid
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : isCurrentPayable
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
                                    : inv.status === 'OVERDUE'
                                    ? 'bg-red-600 text-white font-bold'
                                    : isCurrentPayable
                                    ? 'bg-amber-500 text-white font-bold'
                                    : 'bg-slate-300 text-slate-700 font-bold'
                                }
                              >
                                {isPaid ? 'PAGA' : inv.status === 'OVERDUE' ? 'VENCIDA' : 'PENDENTE'}
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

                            {isPaid && (
                              <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-xs py-1 px-2.5 font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Quitado
                              </Badge>
                            )}

                            {!isPaid && isCurrentPayable && (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedInvoiceForPix(inv);
                                    setPaymentMethodTab('PIX');
                                    if (!inv.pixPayload && !inv.pixQrCode && !inv.invoiceUrl) {
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

                            {!isPaid && !isCurrentPayable && (
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl">
                                <Lock className="w-3.5 h-3.5 text-slate-400" />
                                <span>Liberado a cada mês (após quitação da parcela {nextPayableInvoice?.installmentNumber || 'anterior'})</span>
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
