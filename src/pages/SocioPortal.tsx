import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
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
  ClubSubscription,
} from '@/lib/club-types';
import {
  ClubDatabaseState,
  fetchClubState,
  saveClubState,
  findMemberOrSubscriptionByQuery,
  formatCurrency,
  formatDateBR,
  generateAsaasChargeForClubInvoice,
  checkClubInvoicePaymentStatus,
  renderSubscriptionContractHtml,
  cleanDigits,
  getBirthDatePassword,
} from '@/lib/club-service';
import { ClubMemberCardView } from '@/components/club/ClubMemberCardView';

const SocioPortal: React.FC = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const initialCpfOrCard = searchParams.get('cpf') || searchParams.get('card') || '';

  const [state, setState] = useState<ClubDatabaseState | null>(null);
  const [loginInput, setLoginInput] = useState(initialCpfOrCard);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [subscription, setSubscription] = useState<ClubSubscription | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchClubState().then((loaded) => {
      setState(loaded);
      setLoading(false);
      if (initialCpfOrCard) {
        const matches = findMemberOrSubscriptionByQuery(loaded, initialCpfOrCard);
        if (matches.length > 0) {
          setSubscription(matches[0].subscription);
        }
      }
    });
  }, [initialCpfOrCard]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state || !loginInput.trim()) return;
    const matches = findMemberOrSubscriptionByQuery(state, loginInput);
    if (matches.length === 0) {
      toast({
        title: 'Associado não localizado',
        description: 'Verifique seu E-mail, CPF ou Carteirinha e tente novamente.',
        variant: 'destructive',
      });
      return;
    }
    const foundSub = matches[0].subscription;

    // Se senha foi digitada, valida com a data de nascimento
    if (passwordInput.trim()) {
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
    }

    setSubscription(foundSub);
    toast({
      title: `Bem-vindo(a), ${foundSub.holderName.split(' ')[0]}!`,
      description: 'Acesse suas carteirinhas, faturas e contrato abaixo.',
    });
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

  const handleGeneratePixOrLink = async (
    invoice: ClubInvoice,
    billingType: 'PIX' | 'CREDIT_CARD' = 'PIX'
  ) => {
    if (!state || !subscription) return;
    if (nextPayableInvoice && invoice.id !== nextPayableInvoice.id) {
      toast({
        title: 'Parcela bloqueada',
        description: `Por favor, efetue primeiro o pagamento da parcela ${nextPayableInvoice.installmentNumber}.`,
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
    const win = window.open('', '_blank', 'width=900,height=800');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Contrato Lessa Club - ${subscription.holderName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom:20px; text-align:right;">
            <button onclick="window.print()" style="padding:10px 20px; background:#059669; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">
              Imprimir / Salvar em PDF
            </button>
          </div>
          ${html}
        </body>
      </html>
    `);
    win.document.close();
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
            {subscription && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSubscription(null)}
                className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sair
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 pt-8 max-w-6xl">
        {!subscription ? (
          <>
            {/* Login Card */}
            <div className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200 shadow-xl p-8 mt-8">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-5 mx-auto">
              <CreditCard className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-center text-slate-900 mb-2">
              Área do Associado
            </h1>
            <p className="text-sm text-center text-slate-600 mb-6">
              Acesse suas carteirinhas digitais com QR Code, envie sua foto 3x4, consulte mensalidades e baixe seu contrato assinado.
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-700 block mb-1.5">
                  Usuário (E-mail, CPF ou Carteirinha)
                </label>
                <Input
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="Ex: seuemail@gmail.com ou CPF"
                  className="h-12 text-base"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-700 block mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Digite sua senha"
                    className="h-12 text-base pr-11"
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
                disabled={loading}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base rounded-xl"
              >
                <Search className="w-4 h-4 mr-2" /> Acessar Minha Conta
              </Button>
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
                href="https://wa.me/5569992626140?text=Ol%C3%A1%2C+sou+associado+e+preciso+de+ajuda+para+acessar+o+portal+do+s%C3%B3cio."
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
                      subscription.status === 'ACTIVE'
                        ? 'bg-emerald-600 text-white font-black'
                        : 'bg-rose-600 text-white font-black'
                    }
                  >
                    {subscription.status === 'ACTIVE'
                      ? '● STATUS ATUAL: PLANO ATIVO (PAGAMENTO IDENTIFICADO)'
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
                <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full max-w-3xl bg-slate-200/80 p-1 rounded-2xl h-auto sm:h-12 gap-1">
                  <TabsTrigger
                    value="carteirinhas"
                    className="rounded-xl font-bold text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:text-emerald-700"
                  >
                    <CreditCard className="w-4 h-4 mr-1.5" /> Carteirinhas ({(subscription.members || []).length})
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
                          className="w-full md:w-auto border-emerald-400/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs font-bold"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Simular Validação
                        </Button>
                      </Link>
                    </div>
                  </div>
                {subscription.status !== 'ACTIVE' ? (
                  <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="font-black text-rose-900 text-sm sm:text-base">
                        🔒 Plano Inativo — Aguardando Confirmação de Pagamento
                      </h4>
                      <p className="text-xs text-rose-800">
                        A edição da foto 3x4 e o download das carteirinhas só são liberados após a confirmação do pagamento da sua assinatura. Acesse a aba <strong>"Mensalidades"</strong> acima para realizar o pagamento ou aguarde a liberação pela recepção.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4">
                    <div className="text-xs md:text-sm text-emerald-900">
                      <strong>Plano Ativo e Liberado!</strong> Clique em <strong>"Enviar Foto"</strong> ou <strong>"Reposicionar / Enquadrar Perfil"</strong> em cada carteirinha abaixo para ajustar sua foto de perfil 3x4 e depois clique em <strong>"Baixar PNG Alta Resolução"</strong>.
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
                    .map((member) => (
                      <div
                        key={member.id}
                        className="bg-white rounded-3xl border-2 border-emerald-600/40 p-5 shadow-sm"
                      >
                        <ClubMemberCardView
                          member={member}
                          showBackSide={true}
                          locked={subscription.status !== 'ACTIVE'}
                          onUpdatePhoto={handleUpdateMemberPhoto}
                        />
                      </div>
                    ))}
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
                        .map((member, depIdx) => (
                          <div
                            key={member.id}
                            className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm"
                          >
                            <ClubMemberCardView
                              member={member}
                              dependentIndex={depIdx + 1}
                              showBackSide={true}
                              locked={subscription.status !== 'ACTIVE'}
                              onUpdatePhoto={handleUpdateMemberPhoto}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}
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
                                <span>Liberado após quitação da parcela {nextPayableInvoice?.installmentNumber || 'anterior'}</span>
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
                        <p className="text-xs text-emerald-100">Acesse quantas vezes quiser durante todo o mês.</p>
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
