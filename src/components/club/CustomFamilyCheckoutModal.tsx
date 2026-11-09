import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  QrCode,
  UserPlus,
  Trash2,
  Camera,
  FileText,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Loader2,
  Download,
  Printer,
  Upload,
  FileCheck,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/booking-types';
import {
  DEFAULT_CLUB_MODALITIES,
  type BillingCycle,
  type ClubInvoice,
  type ClubPaymentMethod,
  type ClubSubscription,
} from '@/lib/club-types';
import {
  createClubSubscription,
  formatCpf,
  formatPhone,
  formatBirthDate,
  getMemberAccessMessage,
  isValidCpf,
  generateAsaasChargeForClubInvoice,
  checkClubInvoicePaymentStatus,
  renderSubscriptionContractHtml,
  compressImageFile,
  fetchAddressByCep,
  type CreateSubscriptionMemberInput,
} from '@/lib/club-service';
import { ClubMemberCardView } from './ClubMemberCardView';

export interface SimulatorQuantities {
  adult: number;
  student: number;
  teacher: number;
  server: number;
  child: number;
  senior: number;
  pcd: number;
}

interface CustomFamilyCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuantities: SimulatorQuantities;
  initialCycle?: BillingCycle;
}

export const CustomFamilyCheckoutModal: React.FC<CustomFamilyCheckoutModalProps> = ({
  open,
  onOpenChange,
  initialQuantities,
  initialCycle = 'ANNUAL',
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState<'PLAN' | 'MEMBERS' | 'CONTRACT' | 'PAYMENT' | 'SUCCESS'>('PLAN');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialCycle);
  const [paymentMethod, setPaymentMethod] = useState<ClubPaymentMethod>('PIX');
  const [installments, setInstallments] = useState<number>(12);

  // Dados do Titular
  const [holderName, setHolderName] = useState('');
  const [holderCpf, setHolderCpf] = useState('');
  const [holderRg, setHolderRg] = useState('');
  const [holderBirthDate, setHolderBirthDate] = useState('');
  const [holderSex, setHolderSex] = useState('Masculino');
  const [holderMaritalStatus, setHolderMaritalStatus] = useState('Casado(a)');
  const [holderPhone, setHolderPhone] = useState('');
  const [holderEmail, setHolderEmail] = useState('');

  // Endereço do Titular
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('Ariquemes');
  const [stateUf, setStateUf] = useState('RO');
  const [consultantName, setConsultantName] = useState('');

  // Lista de Membros da Família (Titular + Dependentes)
  const [membersList, setMembersList] = useState<CreateSubscriptionMemberInput[]>([]);
  const [contractAccepted, setContractAccepted] = useState(false);

  // Resultado da Assinatura & Cobrança Asaas
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSubscription, setCreatedSubscription] = useState<ClubSubscription | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<ClubInvoice | null>(null);
  const [asaasPayment, setAsaasPayment] = useState<{
    paymentId: string;
    invoiceUrl: string;
    pixPayload?: string;
    pixQrCode?: string;
  } | null>(null);
  const [asaasError, setAsaasError] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // Inicializa a lista de membros a partir das quantidades do simulador
  useEffect(() => {
    if (!open) return;
    setStep('PLAN');
    setBillingCycle(initialCycle);

    const list: CreateSubscriptionMemberInput[] = [];
    const pushCategory = (code: string, count: number) => {
      for (let i = 0; i < count; i++) {
        list.push({
          role: list.length === 0 ? 'TITULAR' : 'DEPENDENTE',
          modalityCode: code,
          fullName: '',
          cpf: '',
          birthDate: '',
          photoUrl: '',
          documentProofUrl: '',
          documentProofName: '',
        });
      }
    };

    pushCategory('ADULTO', initialQuantities.adult);
    pushCategory('ESTUDANTE', initialQuantities.student);
    pushCategory('PROFESSOR', initialQuantities.teacher);
    pushCategory('SERVIDOR', initialQuantities.server);
    pushCategory('KIDS', initialQuantities.child);
    pushCategory('IDOSO_60', initialQuantities.senior);
    pushCategory('PCD_TEA', initialQuantities.pcd);

    if (list.length === 0) {
      pushCategory('ADULTO', 1);
    }

    setMembersList(list);
  }, [open, initialQuantities, initialCycle]);

  // Sincroniza o 1º membro (Titular) com os campos principais do Titular
  useEffect(() => {
    setMembersList((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      copy[0] = {
        ...copy[0],
        role: 'TITULAR',
        fullName: holderName,
        cpf: holderCpf,
        rg: holderRg,
        birthDate: holderBirthDate,
        sex: holderSex,
        phone: holderPhone,
      };
      return copy;
    });
  }, [holderName, holderCpf, holderRg, holderBirthDate, holderSex, holderPhone]);

  // Busca automática de CEP
  const handleCepLookup = async (inputCep?: string) => {
    const raw = typeof inputCep === 'string' ? inputCep : cep;
    const clean = raw.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const result = await fetchAddressByCep(clean);
      if (result) {
        if (result.logradouro) setStreet(result.logradouro);
        if (result.bairro) setNeighborhood(result.bairro);
        if (result.localidade) setCity(result.localidade);
        if (result.uf) setStateUf(result.uf);
        toast({
          title: 'Endereço localizado via CEP!',
          description: `${result.logradouro || 'Rua'}, ${result.bairro || 'Bairro'} — ${result.localidade}/${result.uf}`,
        });
      }
    } catch {}
  };

  // Cálculo dinâmico de valores da família
  const pricingSummary = useMemo(() => {
    let monthlyTotal = 0;
    let annualTotal = 0;

    const detailed = membersList.map((m) => {
      const mod =
        DEFAULT_CLUB_MODALITIES.find((item) => item.code === m.modalityCode) ||
        DEFAULT_CLUB_MODALITIES[0];
      const unitMonthly = billingCycle === 'ANNUAL' ? mod.annualInstallment : mod.monthlyPrice;
      const unitAnnual = billingCycle === 'ANNUAL' ? mod.annualPrice : mod.monthlyPrice * 12;
      monthlyTotal += unitMonthly;
      annualTotal += unitAnnual;
      return {
        ...m,
        mod,
        unitMonthly,
        unitAnnual,
      };
    });

    return {
      detailed,
      monthlyTotal: Number(monthlyTotal.toFixed(2)),
      annualTotal: Number(annualTotal.toFixed(2)),
    };
  }, [membersList, billingCycle]);

  const handleAddMember = (modalityCode = 'ADULTO') => {
    setMembersList((prev) => [
      ...prev,
      {
        role: prev.length === 0 ? 'TITULAR' : 'DEPENDENTE',
        modalityCode,
        fullName: '',
        cpf: '',
        birthDate: '',
        photoUrl: '',
      },
    ]);
  };

  const handleRemoveMember = (idx: number) => {
    if (membersList.length <= 1) return;
    setMembersList((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length > 0) next[0].role = 'TITULAR';
      return next;
    });
  };

  const handleMemberFieldChange = (
    idx: number,
    field: keyof CreateSubscriptionMemberInput,
    value: string
  ) => {
    setMembersList((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
    if (idx === 0) {
      if (field === 'fullName') setHolderName(value);
      if (field === 'cpf') setHolderCpf(formatCpf(value));
      if (field === 'birthDate') setHolderBirthDate(value);
    }
  };

  const handleFileUpload = async (
    idx: number,
    field: 'photoUrl' | 'documentProofUrl',
    file?: File
  ) => {
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      setMembersList((prev) => {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          [field]: dataUrl,
          ...(field === 'documentProofUrl' ? { documentProofName: file.name } : {}),
        };
        return copy;
      });
    } catch (e) {
      console.warn('Erro ao processar imagem:', e);
    }
  };

  const validateMembersStep = () => {
    if (!holderName.trim() || holderName.trim().length < 3) {
      toast({
        title: 'Informe o nome completo do Titular',
        variant: 'destructive',
      });
      return false;
    }
    if (!isValidCpf(holderCpf)) {
      toast({
        title: 'CPF do Titular Inválido',
        description: 'Informe um CPF válido com 11 dígitos para o titular.',
        variant: 'destructive',
      });
      return false;
    }
    if (holderPhone.replace(/\D/g, '').length < 10) {
      toast({
        title: 'Informe o WhatsApp com DDD do Titular',
        variant: 'destructive',
      });
      return false;
    }
    for (let i = 1; i < membersList.length; i++) {
      if (!membersList[i].fullName.trim()) {
        toast({
          title: `Informe o nome completo do ${i + 1}º integrante`,
          variant: 'destructive',
        });
        return false;
      }
      if (membersList[i].cpf && !isValidCpf(membersList[i].cpf)) {
        toast({
          title: `CPF do ${i + 1}º integrante inválido`,
          description: `O CPF informado para ${membersList[i].fullName || 'dependente'} não é válido.`,
          variant: 'destructive',
        });
        return false;
      }
    }

    for (let i = 0; i < membersList.length; i++) {
      const m = membersList[i];
      const isReqDoc = ['PCD_TEA', 'KIDS', 'IDOSO_60'].includes(m.modalityCode);
      if (isReqDoc && !m.documentProofUrl) {
        const mod = DEFAULT_CLUB_MODALITIES.find((dm) => dm.code === m.modalityCode);
        toast({
          title: `Comprovante obrigatório pendente (${m.fullName || (i === 0 ? 'Titular' : `Dependente #${i}`)})`,
          description: `É obrigatório anexar ou tirar uma foto do documento comprobatório para o plano ${mod?.name || 'de gratuidade'} antes de ativar o cadastro.`,
          variant: 'destructive',
        });
        return false;
      }
    }

    return true;
  };

  // Preview do contrato antes de finalizar
  const previewContractHtml = useMemo(() => {
    const mockSub: ClubSubscription = {
      id: 'preview',
      subscriptionCode: '1212253001',
      personType: 'PF',
      holderName: holderName || 'NOME DO TITULAR',
      holderCpf: holderCpf || '000.000.000-00',
      holderRg: holderRg || '-',
      holderBirthDate: holderBirthDate || '-',
      holderPhone: holderPhone || '(69) 99999-9999',
      holderEmail: holderEmail || '-',
      addressCep: cep || '76870-000',
      addressStreet: street || '-',
      addressNumber: number || 'S/N',
      addressComplement: complement || '-',
      addressNeighborhood: neighborhood || '-',
      addressCity: city || 'Ariquemes',
      addressState: stateUf || 'RO',
      billingCycle,
      paymentMethod,
      installments: billingCycle === 'ANNUAL' ? installments : 12,
      monthlyEquivalent: pricingSummary.monthlyTotal,
      totalContractValue: pricingSummary.annualTotal,
      dueDay: new Date().getDate(),
      status: 'PENDING',
      origin: 'SITE',
      planSummaryLabel: `Assinatura Familiar Lessa Club (${membersList.length} integrante(s))`,
      contractType: 'ADESAO_PF',
      contractAccepted: true,
      contractSignedAt: new Date().toISOString(),
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      members: pricingSummary.detailed.map((m, i) => ({
        id: `m-${i}`,
        subscriptionId: 'preview',
        role: i === 0 ? 'TITULAR' : 'DEPENDENTE',
        modalityCode: m.mod.code,
        modalityName: m.mod.name,
        planCycleLabel: `${m.mod.name} (${billingCycle === 'ANNUAL' ? 'Anual' : 'Mensal'})`,
        fullName: (m.fullName || `Integrante ${i + 1}`).toUpperCase(),
        cpf: m.cpf || (i === 0 ? holderCpf : 'Dependente'),
        cardNumber: `121225300${i + 1}`,
        holderCardNumber: '1212253001',
        qrToken: `121225300${i + 1}`,
        frontCardUrl: m.mod.frontCardUrl,
        backCardUrl: m.mod.backCardUrl,
        validityLabel: '10/2027',
        monthlyValue: m.unitMonthly,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      })),
      invoices: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return renderSubscriptionContractHtml(mockSub);
  }, [
    holderName,
    holderCpf,
    holderRg,
    holderBirthDate,
    holderPhone,
    holderEmail,
    cep,
    street,
    number,
    complement,
    neighborhood,
    city,
    stateUf,
    billingCycle,
    paymentMethod,
    installments,
    pricingSummary,
    membersList.length,
  ]);

  const handleConfirmSubscription = async () => {
    if (!contractAccepted) {
      toast({
        title: 'Aceite o contrato para continuar',
        description: 'Marque a caixa confirmando que leu e concorda com o Termo de Adesão.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    setAsaasError(null);
    try {
      const { subscription, firstInvoice } = await createClubSubscription({
        personType: 'PF',
        holderName,
        holderCpf,
        holderRg,
        holderBirthDate,
        holderSex,
        holderMaritalStatus,
        holderPhone,
        holderEmail,
        addressCep: cep,
        addressStreet: street,
        addressNumber: number,
        addressComplement: complement,
        addressNeighborhood: neighborhood,
        addressCity: city,
        addressState: stateUf,
        billingCycle,
        paymentMethod,
        installments: billingCycle === 'ANNUAL' && paymentMethod === 'PIX' ? 1 : 12,
        origin: 'SITE',
        consultantName,
        members: membersList,
      });

      setCreatedSubscription(subscription);
      setCreatedInvoice(firstInvoice || null);

      // Se o plano for R$ 0,00 (ex: apenas gratuito), já vai direto para sucesso com carteirinhas ativas
      if (subscription.monthlyEquivalent === 0 || !firstInvoice || firstInvoice.amount === 0) {
        setStep('SUCCESS');
        toast({
          title: 'Assinatura e Carteirinhas Geradas com Sucesso!',
          description: `Seu código de associado é ${subscription.subscriptionCode}.`,
        });
        return;
      }

      // Gera cobrança real no Asaas para a 1ª fatura (ou valor integral no PIX Anual)
      setStep('PAYMENT');
      try {
        const charge = await generateAsaasChargeForClubInvoice(
          subscription,
          firstInvoice,
          paymentMethod === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX'
        );
        setAsaasPayment(charge);
      } catch (payErr: any) {
        console.warn('[ClubCheckout] Asaas charge warning:', payErr);
        setAsaasError(
          payErr?.message ||
            'Sua assinatura e carteirinhas já foram registradas! Finalize o pagamento pelo link ou no Portal do Sócio.'
        );
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar assinatura',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Polling automático de confirmação de pagamento no passo PAYMENT
  useEffect(() => {
    if (step !== 'PAYMENT' || !createdSubscription || !createdInvoice) return;
    const timer = setInterval(async () => {
      const paid = await checkClubInvoicePaymentStatus(
        createdSubscription.id,
        createdInvoice.id
      );
      if (paid) {
        clearInterval(timer);
        setStep('SUCCESS');
        toast({
          title: 'Pagamento Confirmado!',
          description: 'Suas carteirinhas já estão ATIVAS para uso imediato no Balneário Lessa!',
        });
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [step, createdSubscription, createdInvoice, toast]);

  const handleCopyPix = () => {
    if (!asaasPayment?.pixPayload) return;
    navigator.clipboard.writeText(asaasPayment.pixPayload);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
    toast({ title: 'Código PIX Copia e Cola copiado!' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-16px)] max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl p-4 sm:p-7 bg-white border-emerald-900/20 shadow-2xl">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-full">
                Ecossistema Oficial Lessa Club
              </span>
              <DialogTitle className="text-xl sm:text-2xl font-display font-black text-emerald-950 mt-1">
                {step === 'PLAN' && '1. Resumo & Modalidade da Assinatura Familiar'}
                {step === 'MEMBERS' && '2. Dados, Fotos e Integrantes da Família'}
                {step === 'CONTRACT' && '3. Termo de Adesão e Assinatura Digital'}
                {step === 'PAYMENT' && '4. Pagamento & Ativação das Carteirinhas'}
                {step === 'SUCCESS' && '🎉 Parabéns! Suas Carteirinhas e Contrato estão Prontos'}
              </DialogTitle>
            </div>
            <div className="text-right bg-amber-50 border border-amber-300/80 px-3.5 py-2 rounded-2xl">
              <span className="text-[10px] uppercase font-black text-amber-900 block">
                {billingCycle === 'ANNUAL' ? 'Plano Anual (10% OFF)' : 'Plano Mensal'}
              </span>
              <span className="text-lg sm:text-xl font-black text-emerald-950">
                {formatCurrency(pricingSummary.monthlyTotal)}
                <small className="text-xs font-bold text-slate-600">/mês</small>
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* PASSO 1: ESCOLHA ENTRE ANUAL (10% OFF) E MENSAL + FORMA DE PAGAMENTO */}
        {step === 'PLAN' && (
          <div className="space-y-6 pt-2">
            {/* Chave Anual vs Mensal (Sem precisar duplicar planos no banco!) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => setBillingCycle('ANNUAL')}
                className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative ${
                  billingCycle === 'ANNUAL'
                    ? 'border-amber-500 bg-gradient-to-br from-amber-50 via-yellow-50/60 to-amber-100/50 shadow-lg'
                    : 'border-slate-200 bg-slate-50/60 hover:border-amber-300'
                }`}
              >
                <span className="absolute top-3 right-3 bg-amber-500 text-emerald-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                  Mais Vantajoso • 10% OFF
                </span>
                <h4 className="font-black text-sm uppercase text-amber-950 mb-1">
                  👑 Plano Anual (Preço Congelado até 2027)
                </h4>
                <p className="text-2xl sm:text-3xl font-black text-emerald-950">
                  12x de {formatCurrency(pricingSummary.monthlyTotal)}
                </p>
                <p className="text-xs font-bold text-slate-600 mt-1">
                  Total anual: {formatCurrency(pricingSummary.annualTotal)} • Garante a tabela 2026 por 1 ano inteiro
                </p>
              </div>

              <div
                onClick={() => setBillingCycle('MONTHLY')}
                className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative ${
                  billingCycle === 'MONTHLY'
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-lg'
                    : 'border-slate-200 bg-slate-50/60 hover:border-emerald-300'
                }`}
              >
                <h4 className="font-black text-sm uppercase text-emerald-950 mb-1">
                  📅 Plano Mensal Recorrente
                </h4>
                <p className="text-2xl sm:text-3xl font-black text-emerald-800">
                  {formatCurrency(
                    membersList.reduce((acc, m) => {
                      const mod =
                        DEFAULT_CLUB_MODALITIES.find((x) => x.code === m.modalityCode) ||
                        DEFAULT_CLUB_MODALITIES[0];
                      return acc + mod.monthlyPrice;
                    }, 0)
                  )}{' '}
                  / mês
                </p>
                <p className="text-xs font-bold text-slate-600 mt-1">
                  Renovação mensal sem fidelidade • Cancele quando quiser
                </p>
              </div>
            </div>

            {/* Composição Personalizada da Família */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-black text-xs sm:text-sm uppercase text-emerald-950">
                  Integrantes na mesma Assinatura Familiar ({membersList.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_CLUB_MODALITIES.filter((m) => m.visibleInSimulator).map((mod) => (
                    <Button
                      key={mod.code}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddMember(mod.code)}
                      className="h-7 text-[11px] font-bold bg-white"
                    >
                      + {mod.emoji} {mod.name.replace('Lessa ', '')}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-200/80">
                {pricingSummary.detailed.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{item.mod.emoji || '🎟️'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs sm:text-sm text-slate-900">
                            {idx === 0 ? '1º Integrante (Titular)' : `${idx + 1}º Integrante (Dependente)`}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-bold">
                            {item.mod.name}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {item.mod.subtitle} • Carteirinha exclusiva com foto e QR Code
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-black text-sm text-emerald-800">
                        {item.unitMonthly === 0
                          ? 'GRÁTIS'
                          : `${formatCurrency(item.unitMonthly)}/mês`}
                      </span>
                      {membersList.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveMember(idx)}
                          className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Aviso Profissional de Assinatura */}
            <div className="text-[11px] text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-200 leading-relaxed flex items-start gap-2">
              <span className="text-emerald-700 text-sm">ℹ️</span>
              <div>
                <strong className="text-slate-800">Modalidade de Assinatura:</strong> Os planos Lessa Club constituem uma assinatura contínua com mensalidade regular para garantia e manutenção do acesso ilimitado e benefícios de associado, devidas mensalmente independentemente da frequência de uso ou visitação ao balneário.
              </div>
            </div>

            {/* Escolha do Meio de Pagamento */}
            {pricingSummary.monthlyTotal > 0 && (
              <div className="space-y-2.5">
                <Label className="text-xs font-black uppercase text-slate-700">
                  Escolha a Forma de Pagamento Preferida:
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setPaymentMethod('PIX')}
                    className={`cursor-pointer p-4 rounded-2xl border-2 flex items-center gap-3 transition-all ${
                      paymentMethod === 'PIX'
                        ? 'border-emerald-600 bg-emerald-50/70'
                        : 'border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <QrCode className="w-8 h-8 text-emerald-700 shrink-0" />
                    <div>
                      <p className="font-black text-sm text-emerald-950">
                        PIX (Liberação Imediata)
                      </p>
                      <p className="text-xs text-slate-600">
                        {billingCycle === 'ANNUAL'
                          ? `1ª Mensalidade de ${formatCurrency(pricingSummary.monthlyTotal)} hoje + carnê mensal PIX ou valor integral`
                          : `${formatCurrency(pricingSummary.monthlyTotal)}/mês via QR Code PIX`}
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setPaymentMethod('CREDIT_CARD')}
                    className={`cursor-pointer p-4 rounded-2xl border-2 flex items-center gap-3 transition-all ${
                      paymentMethod === 'CREDIT_CARD'
                        ? 'border-emerald-600 bg-emerald-50/70'
                        : 'border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <CreditCard className="w-8 h-8 text-amber-600 shrink-0" />
                    <div>
                      <p className="font-black text-sm text-emerald-950">
                        Cartão de Crédito / Recorrência
                      </p>
                      <p className="text-xs text-slate-600">
                        {billingCycle === 'ANNUAL'
                          ? `Até 12x de ${formatCurrency(pricingSummary.monthlyTotal)} no cartão via Asaas`
                          : `Recorrência mensal automática de ${formatCurrency(pricingSummary.monthlyTotal)}`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                size="lg"
                onClick={() => setStep('MEMBERS')}
                className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-2xl h-12 px-8"
              >
                Preencher Dados & Fotos das Carteirinhas
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* PASSO 2: DADOS DO TITULAR, ENDEREÇO E INTEGRANTES COM FOTO */}
        {step === 'MEMBERS' && (
          <div className="space-y-6 pt-2">
            {/* Dados Pessoais do Titular */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-black text-sm uppercase text-emerald-950 border-b border-slate-200 pb-2">
                Dados Principais do Titular Responsável
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs font-bold">Nome Completo do Titular *</Label>
                  <Input
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    placeholder="Ex: JOÃO DA SILVA LESSA"
                    className="bg-white font-bold uppercase"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">CPF do Titular *</Label>
                  <Input
                    value={holderCpf}
                    onChange={(e) => setHolderCpf(formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="bg-white font-bold"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">Data de Nascimento *</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={holderBirthDate}
                    onChange={(e) => setHolderBirthDate(formatBirthDate(e.target.value))}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    className="bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">RG</Label>
                  <Input
                    value={holderRg}
                    onChange={(e) => setHolderRg(e.target.value)}
                    placeholder="Opcional"
                    className="bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">WhatsApp (com DDD) *</Label>
                  <Input
                    value={holderPhone}
                    onChange={(e) => setHolderPhone(formatPhone(e.target.value))}
                    placeholder="(69) 99999-9999"
                    maxLength={15}
                    className="bg-white font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs font-bold">E-mail</Label>
                  <Input
                    type="email"
                    value={holderEmail}
                    onChange={(e) => setHolderEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">Consultor / Indicação (Opcional)</Label>
                  <Input
                    value={consultantName}
                    onChange={(e) => setConsultantName(e.target.value)}
                    placeholder="Nome do vendedor/influencer"
                    className="bg-white"
                  />
                </div>
              </div>

              {/* Endereço */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <Label className="text-xs font-bold">CEP</Label>
                  <Input
                    value={cep}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCep(val);
                      if (val.replace(/\D/g, '').length === 8) {
                        handleCepLookup(val);
                      }
                    }}
                    onBlur={() => handleCepLookup(cep)}
                    placeholder="76870-000"
                    className="bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-bold">Endereço / Rua</Label>
                  <Input
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Rua, Avenida..."
                    className="bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">Número</Label>
                  <Input
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="Nº"
                    className="bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">Bairro</Label>
                  <Input
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Bairro"
                    className="bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-bold">Cidade</Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">UF</Label>
                  <Input
                    value={stateUf}
                    onChange={(e) => setStateUf(e.target.value.toUpperCase())}
                    maxLength={2}
                    className="bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Ficha individual de cada Carteirinha (Titular + Dependentes) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-sm uppercase text-emerald-950">
                  Carteirinhas da Família ({membersList.length}) — Fotos & Comprovantes
                </h4>
              </div>

              {pricingSummary.detailed.map((memberItem, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl border-2 border-emerald-900/15 bg-emerald-50/30 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-800 text-white font-black">
                        {idx === 0 ? 'TITULAR' : `DEPENDENTE #${idx}`}
                      </Badge>
                      <select
                        value={memberItem.modalityCode}
                        onChange={(e) =>
                          handleMemberFieldChange(idx, 'modalityCode', e.target.value)
                        }
                        className="text-xs font-black bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-emerald-950"
                      >
                        {DEFAULT_CLUB_MODALITIES.filter((m) => m.visibleInSimulator).map((m) => (
                          <option key={m.code} value={m.code}>
                            {m.emoji} {m.name} (
                            {m.isFreeTier
                              ? 'Grátis'
                              : formatCurrency(
                                  billingCycle === 'ANNUAL' ? m.annualInstallment : m.monthlyPrice
                                ) + '/mês'}
                            )
                          </option>
                        ))}
                      </select>
                    </div>

                    <span className="text-xs font-black text-emerald-900">
                      {memberItem.unitMonthly === 0
                        ? 'ISENTO (R$ 0,00)'
                        : `${formatCurrency(memberItem.unitMonthly)}/mês`}
                    </span>
                  </div>

                  {idx > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs font-bold">Nome na Carteirinha *</Label>
                        <Input
                          value={memberItem.fullName}
                          onChange={(e) =>
                            handleMemberFieldChange(idx, 'fullName', e.target.value)
                          }
                          placeholder="Nome Completo do Dependente"
                          className="bg-white font-bold uppercase"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold">CPF do Dependente</Label>
                        <Input
                          value={memberItem.cpf}
                          onChange={(e) =>
                            handleMemberFieldChange(idx, 'cpf', formatCpf(e.target.value))
                          }
                          placeholder="000.000.000-00"
                          maxLength={14}
                          className="bg-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold">Data de Nascimento</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={memberItem.birthDate || ''}
                          onChange={(e) =>
                            handleMemberFieldChange(idx, 'birthDate', formatBirthDate(e.target.value))
                          }
                          placeholder="DD/MM/AAAA"
                          maxLength={10}
                          className="bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {/* Upload de Foto para a Carteirinha + Comprovante da Modalidade */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                      {memberItem.photoUrl ? (
                        <img
                          src={memberItem.photoUrl}
                          alt="Foto"
                          className="w-12 h-14 rounded-lg object-cover border-2 border-amber-400 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-14 rounded-lg bg-emerald-900/10 flex items-center justify-center shrink-0">
                          <Camera className="w-5 h-5 text-emerald-800" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <Label className="text-xs font-black text-emerald-950 block">
                          Foto para a Carteirinha ({idx === 0 ? 'Titular' : `Dep. #${idx}`})
                        </Label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleFileUpload(idx, 'photoUrl', e.target.files?.[0])
                          }
                          className="text-[11px] text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-emerald-700 file:text-white hover:file:bg-emerald-800 mt-1 w-full"
                        />
                      </div>
                    </div>

                    {memberItem.mod.requiresDocument && (
                      <div className="sm:col-span-2 bg-amber-50/90 p-3 rounded-xl border border-amber-300 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-black text-amber-950 uppercase flex items-center gap-1.5">
                              📄 Comprovante Obrigatório ({memberItem.mod.name})
                              <Badge className="bg-amber-400 text-amber-950 text-[9px] font-black">
                                OBRIGATÓRIO
                              </Badge>
                            </span>
                            <p className="text-[10px] text-amber-900 mt-0.5">
                              Para ativar este cadastro, é necessário comprovar com documento no ato da inscrição.
                            </p>
                          </div>
                        </div>

                        {memberItem.modalityCode === 'PCD_TEA' && (
                          <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200 text-[11px] text-slate-800 space-y-0.5">
                            <strong className="text-amber-950 block text-[11px]">
                              Documentos aceitos para comprovação (basta 1):
                            </strong>
                            <div>✅ Laudo médico com CID</div>
                            <div>✅ Carteira de Identificação da Pessoa com Deficiência</div>
                            <div>✅ Carteira do Autista (municipal, estadual ou nacional)</div>
                            <div>✅ Documento oficial que comprove a condição</div>
                          </div>
                        )}

                        {(memberItem.modalityCode === 'KIDS' ||
                          memberItem.modalityCode === 'IDOSO_60') && (
                          <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200 text-[11px] text-slate-800 space-y-0.5">
                            <strong className="text-amber-950 block text-[11px]">
                              Comprovação de idade obrigatória:
                            </strong>
                            <div>
                              ✅ Foto que comprove a idade (ex: RG com foto, nome e nascimento ou{' '}
                              {memberItem.modalityCode === 'KIDS'
                                ? 'Certidão de Nascimento'
                                : 'CNH oficial'}).
                            </div>
                          </div>
                        )}

                        <div>
                          {!memberItem.documentProofUrl ? (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {/* Câmera */}
                              <Label
                                htmlFor={`modal-cam-input-${idx}`}
                                className="flex-1 min-w-[150px] inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#004d00] hover:bg-emerald-900 text-white rounded-lg font-bold text-xs cursor-pointer shadow-sm transition-all"
                              >
                                <Camera className="w-3.5 h-3.5 text-emerald-300" />
                                📸 Tirar Foto na Hora (Câmera)
                              </Label>
                              <input
                                id={`modal-cam-input-${idx}`}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) =>
                                  handleFileUpload(
                                    idx,
                                    'documentProofUrl',
                                    e.target.files?.[0]
                                  )
                                }
                              />

                              {/* Arquivo / Galeria */}
                              <Label
                                htmlFor={`modal-file-input-${idx}`}
                                className="flex-1 min-w-[150px] inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg font-bold text-xs cursor-pointer shadow-sm transition-all"
                              >
                                <Upload className="w-3.5 h-3.5 text-slate-600" />
                                📁 Anexar Arquivo / Foto
                              </Label>
                              <input
                                id={`modal-file-input-${idx}`}
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) =>
                                  handleFileUpload(
                                    idx,
                                    'documentProofUrl',
                                    e.target.files?.[0]
                                  )
                                }
                              />
                            </div>
                          ) : (
                            <div className="bg-emerald-100/90 border border-emerald-400 p-2 rounded-lg flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 overflow-hidden text-xs">
                                {memberItem.documentProofUrl.startsWith('data:image/') ? (
                                  <img
                                    src={memberItem.documentProofUrl}
                                    alt="Comprovante"
                                    className="w-9 h-9 object-cover rounded border border-emerald-300 shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded bg-emerald-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                                    DOC
                                  </div>
                                )}
                                <div className="truncate">
                                  <div className="font-bold text-emerald-950 truncate flex items-center gap-1 text-[11px]">
                                    <FileCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                    {memberItem.documentProofName || 'Comprovante Anexado'}
                                  </div>
                                  <div className="text-[10px] text-emerald-800">
                                    Documento validado para ativação
                                  </div>
                                </div>
                              </div>

                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  handleMemberFieldChange(idx, 'documentProofUrl', '')
                                }
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-[11px] font-bold h-7 px-2"
                              >
                                <Trash2 className="w-3 h-3 mr-1" /> Trocar
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('PLAN')}
                className="rounded-xl font-bold"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Voltar
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  if (validateMembersStep()) setStep('CONTRACT');
                }}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-2xl h-12 px-8"
              >
                Revisar Contrato Digital
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* PASSO 3: VISUALIZAÇÃO E ACEITE DO CONTRATO OFICIAL */}
        {step === 'CONTRACT' && (
          <div className="space-y-5 pt-2">
            <div className="bg-emerald-950 text-white p-5 rounded-2xl flex items-center justify-between gap-3 shadow-md border border-emerald-500/30">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-amber-400 shrink-0" />
                <div>
                  <h4 className="font-black text-sm uppercase text-amber-300">
                    Contrato de Adesão de Associado • Validade Jurídica Plena
                  </h4>
                  <p className="text-xs text-emerald-100/90 leading-tight">
                    Conforme o Código Civil Brasileiro e a MP 2.200-2/2001, o aceite eletrônico possui força de assinatura física e gera obrigação contratual válida.
                  </p>
                </div>
              </div>
            </div>

            {/* AVISO DE CANCELAMENTO E CONTINUIDADE EM DESTAQUE */}
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-xs text-amber-950 space-y-1">
              <strong className="text-amber-900 block font-black uppercase tracking-wide">
                ⚠️ Cláusula Contratual em Destaque (Cobrança & Cancelamento):
              </strong>
              <p className="leading-relaxed">
                Este plano possui <strong>cobrança recorrente mensal</strong>. A <strong>ausência de frequência ou não uso das dependências do balneário NÃO suspende a cobrança</strong> das mensalidades enquanto o plano estiver ativo. Caso deseje solicitar o cancelamento, é obrigatório estar com as <strong>mensalidades anteriores integralmente em dia</strong>, formalizando o pedido pelo canal oficial do WhatsApp <strong>(69) 99262-6140</strong>.
              </p>
            </div>

            <div
              className="max-h-[360px] overflow-y-auto border-2 border-slate-200 rounded-2xl p-4 sm:p-6 bg-white shadow-inner"
              dangerouslySetInnerHTML={{ __html: previewContractHtml }}
            />

            <label className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-600/30 cursor-pointer hover:bg-emerald-100/60 transition-colors">
              <input
                type="checkbox"
                checked={contractAccepted}
                onChange={(e) => setContractAccepted(e.target.checked)}
                className="mt-1 w-5 h-5 accent-emerald-700 rounded"
              />
              <span className="text-xs sm:text-sm font-bold text-emerald-950 leading-snug">
                Li, compreendi e concordo integralmente com o <u>Contrato de Adesão de Associado</u> do Balneário Família Lessa, ciente da cobrança mensal contínua e das regras de cancelamento, autorizando a emissão das carteirinhas vinculadas.
              </span>
            </label>

            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('MEMBERS')}
                disabled={isSubmitting}
                className="rounded-xl font-bold"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Voltar aos Dados
              </Button>

              <Button
                type="button"
                size="lg"
                onClick={handleConfirmSubscription}
                disabled={isSubmitting}
                className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black rounded-2xl h-12 px-8 shadow-lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando Carteirinhas e Cobrança...
                  </>
                ) : (
                  <>
                    Assinar Contrato & Gerar Carteirinhas
                    <CheckCircle2 className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* PASSO 4: PAGAMENTO ASAAS (PIX QR CODE OU LINK CARTÃO) */}
        {step === 'PAYMENT' && createdSubscription && (
          <div className="space-y-6 pt-2 text-center">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl max-w-xl mx-auto">
              <Badge className="bg-emerald-700 text-white mb-2">
                Assinatura Nº {createdSubscription.subscriptionCode} Registrada!
              </Badge>
              <h4 className="font-black text-lg text-emerald-950">
                Realize o pagamento para ativar suas {createdSubscription.members.length} carteirinha(s)
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                Assim que o pagamento for identificado, suas carteirinhas mudam automaticamente para o status <strong>ATIVO</strong> na portaria.
              </p>
            </div>

            {asaasPayment?.pixQrCode && (
              <div className="max-w-md mx-auto bg-white border-2 border-emerald-600/30 rounded-3xl p-6 shadow-xl space-y-4">
                <img
                  src={`data:image/png;base64,${asaasPayment.pixQrCode}`}
                  alt="QR Code PIX Asaas"
                  className="w-52 h-52 mx-auto border p-2 rounded-2xl"
                />
                <div className="space-y-2">
                  <Button
                    type="button"
                    onClick={handleCopyPix}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black h-12 rounded-xl"
                  >
                    {copiedPix ? (
                      <>
                        <Check className="w-4 h-4 mr-2" /> Código PIX Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" /> Copiar Código PIX (Copia e Cola)
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {asaasPayment?.invoiceUrl && (
              <div className="max-w-md mx-auto space-y-3">
                <Button
                  asChild
                  size="lg"
                  className="w-full bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black h-12 rounded-2xl shadow-md"
                >
                  <a href={asaasPayment.invoiceUrl} target="_blank" rel="noopener noreferrer">
                    Abrir Fatura Segura Asaas (Cartão / PIX / Boleto)
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </div>
            )}

            {asaasError && (
              <div className="max-w-lg mx-auto bg-amber-50 border border-amber-300 text-amber-950 p-4 rounded-2xl text-xs font-bold">
                {asaasError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('SUCCESS')}
                className="font-bold rounded-xl"
              >
                Ver Minhas Carteirinhas e Contrato Agora
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* PASSO 5: SUCESSO — EXIBE TODAS AS CARTEIRINHAS GERADAS + CONTRATO + ACESSO AO PORTAL */}
        {step === 'SUCCESS' && createdSubscription && (
          <div className="space-y-6 pt-2">
            <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-900 text-white p-5 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="bg-amber-400 text-emerald-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                  Código Titular: {createdSubscription.subscriptionCode}
                </span>
                <h3 className="font-display font-black text-xl sm:text-2xl mt-1">
                  Bem-vindo(a) ao Lessa Club, {createdSubscription.holderName}!
                </h3>
                <p className="text-xs text-emerald-100/90 mt-0.5">
                  Abaixo estão as carteirinhas oficiais da sua família. Você também pode acessá-las quando quiser em <strong>/socio</strong> usando seu CPF.
                </p>
              </div>
              <Button
                asChild
                className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black rounded-xl shrink-0"
              >
                <a href={`/socio?cpf=${encodeURIComponent(createdSubscription.holderCpf)}`}>
                  Ir para Meu Portal do Sócio
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </a>
              </Button>
            </div>

            {/* CARD DE DADOS DE ACESSO (LOGIN = EMAIL, SENHA = DATA NASCIMENTO) */}
            {(() => {
              const access = getMemberAccessMessage(createdSubscription);
              return (
                <div className="bg-slate-900 text-white p-5 rounded-3xl border-2 border-amber-400 shadow-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                        🔑 Credenciais de Acesso ao Portal do Associado
                      </span>
                      <h4 className="text-base font-black text-white mt-0.5">
                        Login e Senha do Sócio
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(access.message);
                          toast({ title: 'Copiado!', description: 'Dados de acesso copiados para a área de transferência.' });
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

            <div className="space-y-6">
              {createdSubscription.members.map((member) => (
                <div
                  key={member.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-emerald-950">
                      {member.role}: {member.fullName} — {member.planCycleLabel}
                    </span>
                    <Badge
                      className={
                        member.status === 'ACTIVE'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500 text-emerald-950'
                      }
                    >
                      {member.status === 'ACTIVE' ? 'ATIVA' : 'AGUARDANDO COMPENSAÇÃO'}
                    </Badge>
                  </div>
                  <ClubMemberCardView member={member} showBackSide={false} />
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
