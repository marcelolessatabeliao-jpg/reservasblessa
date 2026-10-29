import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from '@/lib/club-service';
import { ClubMemberCardView } from '@/components/club/ClubMemberCardView';

const SocioPortal: React.FC = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const initialCpfOrCard = searchParams.get('cpf') || searchParams.get('card') || '';

  const [state, setState] = useState<ClubDatabaseState | null>(null);
  const [loginInput, setLoginInput] = useState(initialCpfOrCard);
  const [subscription, setSubscription] = useState<ClubSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedInvoiceForPix, setSelectedInvoiceForPix] = useState<ClubInvoice | null>(null);
  const [generatingPixId, setGeneratingPixId] = useState<string | null>(null);
  const [checkingInvoiceId, setCheckingInvoiceId] = useState<string | null>(null);

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
        description: 'Verifique seu CPF ou Número da Carteirinha e tente novamente.',
        variant: 'destructive',
      });
      return;
    }
    const foundSub = matches[0].subscription;
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

  const handleGeneratePixOrLink = async (invoice: ClubInvoice) => {
    if (!state || !subscription) return;
    setGeneratingPixId(invoice.id);
    try {
      const charge = await generateAsaasChargeForClubInvoice(subscription, invoice, 'PIX');
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
    } catch (err: any) {
      toast({
        title: 'Aviso ao gerar cobrança online',
        description: err?.message || 'Utilize o pagamento na recepção ou tente novamente.',
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
            <Link to="/verificar">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-800 text-xs"
              >
                <QrCode className="w-3.5 h-3.5 mr-1.5" /> Validar QR Code
              </Button>
            </Link>
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
          /* Login Card */
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
                  CPF ou Número da Carteirinha
                </label>
                <Input
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="Ex: 000.000.000-00 ou 1212253001"
                  className="h-12 text-base"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base rounded-xl"
              >
                <Search className="w-4 h-4 mr-2" /> Acessar Minha Conta
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500 mb-2">Ainda não é sócio do Reserva Lessa?</p>
              <Link to="/assinatura">
                <Button variant="outline" size="sm" className="w-full font-bold">
                  Montar Meu Plano Personalizado
                </Button>
              </Link>
            </div>
          </div>
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
              <TabsList className="grid grid-cols-3 w-full max-w-xl bg-slate-200/80 p-1 rounded-2xl h-12">
                <TabsTrigger
                  value="carteirinhas"
                  className="rounded-xl font-bold text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:text-emerald-700"
                >
                  <CreditCard className="w-4 h-4 mr-1.5" /> Carteirinhas ({subscription.members.length})
                </TabsTrigger>
                <TabsTrigger
                  value="faturas"
                  className="rounded-xl font-bold text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:text-emerald-700"
                >
                  <Receipt className="w-4 h-4 mr-1.5" /> Mensalidades ({subscription.invoices.length})
                </TabsTrigger>
                <TabsTrigger
                  value="contrato"
                  className="rounded-xl font-bold text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:text-emerald-700"
                >
                  <FileText className="w-4 h-4 mr-1.5" /> Meu Contrato
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: CARTEIRINHAS (DIVIDIDO EM TITULAR E DEPENDENTES) */}
              <TabsContent value="carteirinhas" className="space-y-6">
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
                    {subscription.invoices.map((inv) => {
                      const isPaid = inv.status === 'PAID';
                      return (
                        <div
                          key={inv.id}
                          className={`rounded-2xl border p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                            isPaid
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : 'bg-white border-slate-200'
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
                                    ? 'bg-emerald-600 text-white'
                                    : inv.status === 'OVERDUE'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-amber-500 text-white'
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

                            {!isPaid && (
                              <>
                                {inv.pixPayload || inv.invoiceUrl ? (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => setSelectedInvoiceForPix(inv)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                    >
                                      <QrCode className="w-4 h-4 mr-1.5" /> Pagar c/ PIX
                                    </Button>
                                    {inv.invoiceUrl && (
                                      <a
                                        href={inv.invoiceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        <Button size="sm" variant="outline">
                                          <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Fatura / Cartão
                                        </Button>
                                      </a>
                                    )}
                                    {inv.asaasPaymentId && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        disabled={checkingInvoiceId === inv.id}
                                        onClick={() => handleCheckPayment(inv)}
                                      >
                                        <RefreshCw
                                          className={`w-3.5 h-3.5 mr-1.5 ${
                                            checkingInvoiceId === inv.id ? 'animate-spin' : ''
                                          }`}
                                        />
                                        Já paguei
                                      </Button>
                                    )}
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    disabled={generatingPixId === inv.id}
                                    onClick={() => handleGeneratePixOrLink(inv)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                  >
                                    <QrCode className="w-4 h-4 mr-1.5" />
                                    {generatingPixId === inv.id
                                      ? 'Gerando PIX...'
                                      : 'Gerar PIX / Fatura Online'}
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Active PIX QR Code Drawer */}
                  {selectedInvoiceForPix && (
                    <div className="mt-6 bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 text-center space-y-3">
                      <h4 className="font-black text-emerald-950">
                        Pagamento Instantâneo via PIX ({selectedInvoiceForPix.description})
                      </h4>
                      {selectedInvoiceForPix.pixQrCode && (
                        <img
                          src={`data:image/png;base64,${selectedInvoiceForPix.pixQrCode}`}
                          alt="QR Code PIX"
                          className="w-48 h-48 mx-auto rounded-xl border bg-white p-2 shadow"
                        />
                      )}
                      {selectedInvoiceForPix.pixPayload && (
                        <div className="max-w-md mx-auto flex gap-2">
                          <Input
                            readOnly
                            value={selectedInvoiceForPix.pixPayload}
                            className="bg-white text-xs font-mono"
                          />
                          <Button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                selectedInvoiceForPix.pixPayload || ''
                              );
                              toast({ title: 'Código PIX Copia e Cola copiado!' });
                            }}
                          >
                            <Copy className="w-4 h-4 mr-1" /> Copiar
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
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
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
};

export default SocioPortal;
