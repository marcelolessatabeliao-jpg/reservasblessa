import { cn } from '@/lib/utils';
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCircle2,
  MapPin,
  Calendar,
  Users,
  Phone,
  ArrowLeft,
  Download,
  Share2,
  Image as ImageIcon,
  Loader2,
  Bed,
  Clock,
  Coffee,
  ShieldCheck,
  CreditCard,
  Sparkles,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import html2canvas from 'html2canvas';
import { formatCurrency } from '@/lib/booking-types';
import { parseToRODate } from '@/utils/date-utils';
import { formatProductDisplayName } from '@/utils/product-utils';
import {
  getLocalChaleOrdersForSearch,
  extractChaleDetailsFromOrder,
  formatDateSafe,
  formatShortDateSafe,
  formatCpfDisplay,
  formatPhoneDisplay
} from '@/lib/chale-voucher-utils';
import { ChaleTermsModal } from '@/components/booking/ChaleTermsModal';

export default function Voucher() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qrBase64, setQrBase64] = useState<string>('');
  const [generatingImg, setGeneratingImg] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const voucherRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchVoucher() {
      if (!code) return;
      setLoading(true);
      const cleanCode = code.trim();

      let data: any = null;

      try {
        const res = await supabase
          .from('orders')
          .select(`*, order_items (*), quad_reservations (*)`)
          .ilike('confirmation_code', cleanCode)
          .maybeSingle() as any;

        if (res?.data) {
          data = res.data;
        }

        if (!data && cleanCode.length >= 5 && cleanCode.length <= 8 && /^[a-zA-Z0-9]+$/.test(cleanCode)) {
          const prefix = cleanCode.toLowerCase().padEnd(8, '0');
          const minUuid = `${prefix}-0000-0000-0000-000000000000`;
          const maxUuid = `${prefix}-ffff-ffff-ffff-ffffffffffff`;
          const { data: idData } = await supabase
            .from('orders')
            .select(`*, order_items (*), quad_reservations (*)`)
            .gte('id', minUuid)
            .lte('id', maxUuid)
            .maybeSingle() as any;

          if (idData) {
            data = idData;
          }
        }
      } catch (err) {
        console.warn('Erro ao buscar voucher no Supabase, verificando reservas locais:', err);
      }

      if (!data) {
        const localOrders = getLocalChaleOrdersForSearch();
        const upperCode = cleanCode.toUpperCase();
        const matchedLocal = localOrders.find((loc: any) => {
          const locCode = String(loc.confirmation_code || '').toUpperCase();
          const locShortId = String(loc.id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
          return locCode === upperCode || locShortId === upperCode || String(loc.id || '').toUpperCase() === upperCode;
        });
        if (matchedLocal) {
          data = matchedLocal;
        }
      }

      if (data) setOrder(data);
      setLoading(false);

      const voucherCodeForQr = data?.confirmation_code || data?.id?.replace(/-/g, '').slice(0, 8).toUpperCase();
      if (voucherCodeForQr) {
        fetch(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://reservas.balneariolessa.com.br/voucher/${voucherCodeForQr}`)
          .then(res => res.blob())
          .then(blob => {
            const reader = new FileReader();
            reader.onloadend = () => setQrBase64(reader.result as string);
            reader.readAsDataURL(blob);
          })
          .catch(err => console.error('Failed to load QR', err));
      }
    }
    fetchVoucher();
  }, [code]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-primary/5 font-black text-primary animate-pulse">CARREGANDO VOUCHER...</div>;

  if (!order) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-6 bg-white">
      <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-4xl">⚠️</div>
      <h1 className="text-2xl font-black text-primary uppercase">Voucher Não Encontrado</h1>
      <p className="text-muted-foreground max-w-xs">Verifique o código ou consulte sua reserva pelo CPF/Telefone.</p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link to="/consultar"><Button className="rounded-full px-6 bg-primary text-white font-black">CONSULTAR RESERVA</Button></Link>
        <Link to="/"><Button variant="outline" className="rounded-full px-6 font-bold">VOLTAR PARA O SITE</Button></Link>
      </div>
    </div>
  );

  const visitDate = order.visit_date ? parseToRODate(order.visit_date) : null;
  const isPaid = order.status === 'paid' || order.status === 'confirmed' || order.status === 'pago';
  const chaleDetails = extractChaleDetailsFromOrder(order);
  const voucherDisplayCode = order.confirmation_code || order.id?.replace(/-/g, '').slice(0, 8).toUpperCase();

  // Análise dos itens para identificar balcão e valores
  const counterItems = (order.order_items || []).filter((i: any) =>
    (i.product_id || i.product_name || '').toLowerCase().includes('balcão') ||
    (i.product_id || i.product_name || '').toLowerCase().includes('balcao')
  );
  const counterQty = counterItems.reduce((acc: number, i: any) => acc + (i.quantity || 1), 0);
  const counterTotal = counterQty * 50;

  // Itens cobrados online pelo valor cheio
  const paidOnlineItems = (order.order_items || []).filter((i: any) => (i.unit_price || 0) > 0);
  const itemsGrossSum = paidOnlineItems.reduce((acc: number, i: any) => {
    const itemGross = i.metadata?.chale_gross_price ? Number(i.metadata.chale_gross_price) : ((i.unit_price || 0) * (i.quantity || 1));
    return acc + itemGross;
  }, 0);

  let subtotalOnlineSemDesconto = itemsGrossSum;
  let onlineDiscountAmount = 0;

  if (itemsGrossSum > (order.total_amount || 0) && (order.total_amount || 0) > 0) {
    subtotalOnlineSemDesconto = itemsGrossSum;
    onlineDiscountAmount = Math.round((itemsGrossSum - (order.total_amount || 0)) * 100) / 100;
  } else if ((order.total_amount || 0) > 0 && (order.notes || '').includes('10%')) {
    subtotalOnlineSemDesconto = Math.round(((order.total_amount || 0) / 0.90) * 100) / 100;
    onlineDiscountAmount = Math.round((subtotalOnlineSemDesconto - (order.total_amount || 0)) * 100) / 100;
  }

  const valorTotalBalcao = (!isPaid ? subtotalOnlineSemDesconto : 0) + counterTotal;

  const handleSaveImage = async () => {
    setGeneratingImg(true);
    try {
      if (voucherRef.current) {
        const buttonsArea = voucherRef.current.querySelector('.voucher-buttons') as HTMLElement;
        if (buttonsArea) buttonsArea.style.display = 'none';

        const canvas = await html2canvas(voucherRef.current, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false,
        });

        if (buttonsArea) buttonsArea.style.display = 'flex';

        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Voucher_${voucherDisplayCode}.png`;
        link.href = dataUrl;
        link.click();
        toast({ title: "Sucesso!", description: "Imagem do voucher baixada com sucesso." });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Não foi possível gerar a imagem.", variant: "destructive" });
    } finally {
      setGeneratingImg(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans flex items-center justify-center">
      <div className="max-w-4xl w-full relative">

        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between mb-4 px-1">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-950 bg-white hover:bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-full uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          <Link
            to="/consultar"
            className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-900 hover:text-emerald-950 underline underline-offset-4"
          >
            Consultar outra reserva
          </Link>
        </div>

        <div ref={voucherRef} className="bg-white rounded-[2.2rem] shadow-2xl overflow-hidden border-2 border-emerald-950/10">

          {/* Header */}
          <div className="bg-gradient-to-r from-[#022c16] via-[#043d1f] to-[#022c16] p-6 md:p-8 text-white flex flex-col md:flex-row md:items-center md:justify-between text-center md:text-left gap-4 relative border-b-4 border-amber-400">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-2">
                {chaleDetails ? '🏡 Voucher Oficial de Hospedagem em Chalé' : '🌴 Voucher Oficial Day Use • Balneário Lessa'}
              </div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Balneário Lessa</h1>
              <p className="text-emerald-200/90 text-xs font-bold uppercase tracking-widest mt-0.5">
                {chaleDetails ? `${chaleDetails.chaleLabel} • ${chaleDetails.packageTitle}` : 'Comprovante Digital de Acesso e Reserva'}
              </p>
            </div>
            <div className="flex flex-col items-center md:items-end gap-1.5">
              <div className={cn(
                "text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider shadow-lg",
                isPaid ? "bg-amber-400 text-slate-950" : "bg-amber-100 text-amber-900 border border-amber-300"
              )}>
                {isPaid ? '✓ Reserva Confirmada & Paga' : '⏳ Aguardando Pagamento'}
              </div>
              <span className="text-[11px] font-mono font-black text-emerald-200 tracking-widest">
                CÓDIGO: #{voucherDisplayCode}
              </span>
            </div>
          </div>

          <div className="p-5 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Left Column: QR Code, Titular Data & Location */}
            <div className="lg:col-span-4 flex flex-col space-y-4">
              {/* QR Code Box */}
              <div className="bg-slate-50 border-2 border-slate-200/80 rounded-3xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
                <div className="p-2.5 bg-white border-2 border-emerald-950/10 rounded-2xl shadow-sm mb-2.5">
                  <img
                    src={qrBase64 || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://reservas.balneariolessa.com.br/voucher/${voucherDisplayCode}`}
                    alt="QR Code"
                    className="w-32 h-32 md:w-36 md:h-36"
                    crossOrigin={qrBase64 ? undefined : "anonymous"}
                  />
                </div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">CÓDIGO DE ACESSO</p>
                <p className="text-2xl font-mono font-black text-emerald-950 tracking-wider mt-0.5">
                  #{voucherDisplayCode}
                </p>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full mt-1.5">
                  Apresente na Recepção / Portaria
                </span>
              </div>

              {/* Dados do Titular (Nome, CPF, Telefone, Pagamento) */}
              <div className="bg-emerald-950 text-white rounded-3xl p-4 space-y-2.5 border border-emerald-800 shadow-md">
                <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-black uppercase tracking-wider border-b border-white/10 pb-2">
                  <FileText className="w-3.5 h-3.5" /> Dados do Titular da Reserva
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-emerald-300/80 block">Nome do Titular:</span>
                    <span className="font-black text-white text-sm">{order.customer_name || '—'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-300/80 block">CPF:</span>
                      <span className="font-black text-amber-300 text-xs">{formatCpfDisplay(order.customer_cpf)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-300/80 block">Telefone / WhatsApp:</span>
                      <span className="font-black text-white text-xs">{formatPhoneDisplay(order.customer_phone)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-300/80 block">Forma de Pagto:</span>
                      <span className="font-black text-emerald-300 uppercase text-xs">
                        {order.payment_method === 'credit_card' ? 'Cartão de Crédito' : (order.payment_method || 'PIX')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-300/80 block">Status:</span>
                      <span className="font-black text-amber-400 uppercase text-xs">
                        {isPaid ? 'PAGO ✓' : 'PENDENTE'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Localização */}
              <div className="bg-amber-50/90 rounded-2xl p-4 border border-amber-200 space-y-2 mt-auto">
                <div className="flex items-center gap-2 text-emerald-950">
                  <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-xs font-black uppercase">Localização do Parque</p>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed font-semibold">
                  Via Araras, Setor 09 – Ariquemes/RO.<br />
                  Obrigatório apresentar documento oficial com foto (e documento das crianças) no check-in.
                </p>
                <Button
                  asChild
                  className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-black rounded-xl text-[11px] h-9 shadow-sm border border-amber-500/30 mt-1"
                >
                  <a href="https://maps.app.goo.gl/cegNBpNfLQwraW8v8" target="_blank" rel="noopener noreferrer">
                    📍 ABRIR NO GOOGLE MAPS
                  </a>
                </Button>
              </div>
            </div>

            {/* Right Column: Hospedagem / Day Use Full Information */}
            <div className="lg:col-span-8 space-y-5">

              {chaleDetails ? (
                /* ================= LAYOUT COMPLETO DE HOSPEDAGEM EM CHALÉS ================= */
                <>
                  {/* Card 1: Pacote, Modalidade, Horários de Check-in e Check-out e Valores */}
                  <div className="bg-emerald-50/70 border-2 border-emerald-200 rounded-3xl p-4 md:p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/80 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-emerald-950 text-amber-400 flex items-center justify-center shrink-0">
                          <Bed className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 block">
                            Pacote & Acomodação Reservada
                          </span>
                          <h2 className="text-sm md:text-base font-black text-emerald-950">
                            {chaleDetails.chaleLabel}
                          </h2>
                        </div>
                      </div>
                      <span className="bg-emerald-950 text-amber-400 text-[11px] font-black uppercase px-3 py-1 rounded-full">
                        Modalidade: {chaleDetails.occupancyLabel}
                      </span>
                    </div>

                    {/* Pacote & Valores */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="bg-white rounded-2xl p-3 border border-emerald-200/80 sm:col-span-2">
                        <span className="text-[10px] font-black uppercase text-slate-500 block">Pacote Contratado</span>
                        <span className="text-xs md:text-sm font-black text-emerald-950 block mt-0.5">
                          {chaleDetails.packageTitle}
                        </span>
                        <span className="text-[11px] font-bold text-emerald-800 block mt-0.5">
                          Ocupação: {chaleDetails.adultsCount} Adulto(s){chaleDetails.childrenCount > 0 ? ` + ${chaleDetails.childrenCount} Criança(s)` : ''}
                        </span>
                      </div>
                      <div className="bg-emerald-950 text-white rounded-2xl p-3 border border-emerald-900 flex flex-col justify-center">
                        <span className="text-[10px] font-black uppercase text-amber-300 block">Valor Total da Reserva</span>
                        <span className="text-lg font-black text-amber-400 leading-tight mt-0.5">
                          {formatCurrency(order.total_amount || chaleDetails.chalePrice)}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-200">
                          Hospedagem: {formatCurrency(chaleDetails.chalePrice)}
                        </span>
                      </div>
                    </div>

                    {/* Datas e Horários de Check-in e Check-out */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-white rounded-2xl p-3.5 border-2 border-emerald-300 shadow-sm">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-800">
                          <Clock className="w-3.5 h-3.5 text-emerald-600" /> Check-in (Entrada no Chalé)
                        </div>
                        <p className="text-xs md:text-sm font-black text-slate-900 mt-1 capitalize">
                          {formatDateSafe(chaleDetails.checkInDateStr)}
                        </p>
                        <span className="inline-block mt-1 bg-emerald-100 text-emerald-950 text-[11px] font-black px-2.5 py-0.5 rounded-md">
                          🕒 Horário de Check-in: a partir das {chaleDetails.checkInTime}
                        </span>
                      </div>

                      <div className="bg-white rounded-2xl p-3.5 border-2 border-amber-300 shadow-sm">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-900">
                          <Clock className="w-3.5 h-3.5 text-amber-600" /> Check-out (Saída do Chalé)
                        </div>
                        <p className="text-xs md:text-sm font-black text-slate-900 mt-1 capitalize">
                          {chaleDetails.checkOutDateStr ? formatDateSafe(chaleDetails.checkOutDateStr) : 'Conforme pacote selecionado'}
                        </p>
                        <span className="inline-block mt-1 bg-amber-100 text-amber-950 text-[11px] font-black px-2.5 py-0.5 rounded-md">
                          🕒 Horário Check-out: {chaleDetails.checkOutTime}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Nomes dos Adultos e das Crianças + Detalhes */}
                  <div className="bg-white border-2 border-slate-200 rounded-3xl p-4 md:p-5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-700" />
                        <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-emerald-950">
                          Relação Nominal de Hóspedes (Adultos e Crianças)
                        </h3>
                      </div>
                      <span className="text-[11px] font-black text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        {chaleDetails.adultsCount + chaleDetails.childrenCount} Hóspede(s)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Lista de Adultos */}
                      <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                          👤 Adultos Responsáveis / Hóspedes ({chaleDetails.adultsList.length})
                        </span>
                        <div className="space-y-1.5">
                          {chaleDetails.adultsList.map((adult, idx) => (
                            <div key={idx} className="bg-white rounded-xl p-2.5 border border-slate-200/80 flex items-center justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-bold text-slate-500 block">{adult.label}</span>
                                <span className="text-xs font-black text-slate-900">{adult.name}</span>
                              </div>
                              <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full shrink-0">
                                Chalé {String(adult.chaleId).padStart(2, '0')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Lista de Crianças */}
                      <div className="bg-amber-50/60 rounded-2xl p-3.5 border border-amber-200/80 space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                          👶 Crianças Adicionais ({chaleDetails.childrenList.length})
                        </span>
                        {chaleDetails.childrenList.length > 0 ? (
                          <div className="space-y-1.5">
                            {chaleDetails.childrenList.map((child, idx) => (
                              <div key={idx} className="bg-white rounded-xl p-2.5 border border-amber-200 flex items-center justify-between gap-2">
                                <div>
                                  <span className="text-[10px] font-bold text-amber-800 block">
                                    {child.label} • {child.ageLabel}
                                  </span>
                                  <span className="text-xs font-black text-slate-900">{child.name}</span>
                                </div>
                                <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-950 px-2 py-0.5 rounded-full shrink-0">
                                  Filho(a) Hóspede
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-white/80 rounded-xl p-3 border border-amber-200/50 text-xs font-semibold text-slate-500">
                            Nenhuma criança adicional vinculada a esta reserva.
                          </div>
                        )}
                        <p className="text-[10px] font-bold text-amber-900 leading-snug pt-0.5">
                          ⚠️ O adicional de crianças é exclusivo e permitido apenas para filhos dos hóspedes.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Benefícios Inclusos na Hospedagem */}
                  <div className="bg-emerald-950 text-white rounded-3xl p-4 space-y-2.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Benefícios Já Inclusos na Sua Hospedagem
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="bg-white/10 rounded-xl p-2.5 border border-white/10 flex items-center gap-2 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Entradas e Day Use 100% Inclusos</span>
                      </div>
                      <div className="bg-white/10 rounded-xl p-2.5 border border-white/10 flex items-center gap-2 font-bold">
                        <Coffee className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Café da manhã: Sex a Dom, 7h às 9h</span>
                      </div>
                      <div className="bg-white/10 rounded-xl p-2.5 border border-white/10 flex items-center gap-2 font-bold">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Chalé privativo com ar, TV e frigobar</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Demais Itens Inclusos na Reserva (Quiosques, Quadriciclos, Diversões, etc.) */}
                  <div className="bg-white border-2 border-slate-200 rounded-3xl p-4 md:p-5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-950">
                        🛒 Resumo Financeiro & Demais Itens Inclusos na Reserva
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">
                        {1 + chaleDetails.otherItems.length} item(ns) na reserva
                      </span>
                    </div>

                    <div className="space-y-2">
                      {/* Item Principal: Hospedagem */}
                      <div className="flex items-center justify-between gap-3 bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200">
                        <div className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-black text-emerald-950">
                              1x {chaleDetails.chaleLabel} — {chaleDetails.packageTitle}
                            </p>
                            <p className="text-[11px] font-bold text-emerald-800">
                              Modalidade: {chaleDetails.occupancyLabel} • Check-in {formatShortDateSafe(chaleDetails.checkInDateStr)} ({chaleDetails.checkInTime}) até {formatShortDateSafe(chaleDetails.checkOutDateStr)} (12:00)
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-black text-emerald-950 shrink-0">
                          {formatCurrency(chaleDetails.chalePrice)}
                        </span>
                      </div>

                      {/* Demais Itens (Quiosque, Quadriciclo, Diversões, etc.) */}
                      {chaleDetails.otherItems.length > 0 ? (
                        chaleDetails.otherItems.map((extra, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                            <div className="flex items-start gap-2.5">
                              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-black text-slate-900">
                                  {extra.quantity}x {extra.name}
                                </p>
                                {extra.timeSlot && (
                                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black uppercase bg-amber-300/60 text-slate-950 px-2 py-0.5 rounded-md">
                                    🕒 Horário Agendado: {extra.timeSlot}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-black text-slate-900 shrink-0">
                              {formatCurrency(extra.totalPrice)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 font-semibold italic px-1">
                          Nenhum item opcional avulso (quiosque/quadriciclo) adicionado além da hospedagem completa.
                        </p>
                      )}
                    </div>

                    {/* Barra Final de Valor Total */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
                      <div>
                        <span className="text-[10px] font-black uppercase text-slate-500 block">
                          Valor Total da Reserva ({isPaid ? 'Pago' : 'A Pagar'})
                        </span>
                        {onlineDiscountAmount > 0 && (
                          <span className="text-[11px] font-bold text-emerald-700">
                            Economia de {formatCurrency(onlineDiscountAmount)} (10% OFF aplicado)
                          </span>
                        )}
                      </div>
                      <span className="text-xl font-black text-emerald-950">
                        {formatCurrency(order.total_amount || chaleDetails.chalePrice)}
                      </span>
                    </div>
                  </div>

                  {/* Card 5: Comprovante de Aceite Eletrônico dos Termos de Hospedagem */}
                  <div className="bg-slate-950 text-white rounded-3xl p-4 sm:p-5 border-2 border-amber-400/70 space-y-2.5 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/15 pb-2.5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <span className="text-[11px] font-black uppercase text-amber-300 tracking-wider block">
                            Termos e Condições de Hospedagem ({chaleDetails.termsAcceptance.termsVersion})
                          </span>
                          <span className="text-[10.5px] text-emerald-200 font-bold block">
                            ✓ Aceite eletrônico registrado • Reserva #{order.confirmation_code || order.id?.slice(0, 8).toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsTermsModalOpen(true)}
                        className="voucher-buttons bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] uppercase tracking-wider rounded-xl h-9 px-3.5 shrink-0 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                        Ler Termos Completos
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10.5px] text-slate-300 font-medium">
                      <div>
                        <span className="text-slate-400 font-bold uppercase block text-[9.5px]">Hóspede Titular:</span>
                        <strong className="text-white">{chaleDetails.termsAcceptance.guestName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase block text-[9.5px]">Data e Horário do Aceite:</span>
                        <strong className="text-white">{chaleDetails.termsAcceptance.acceptedAtFormatted}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase block text-[9.5px]">Registro Técnico (Hash):</span>
                        <strong className="text-amber-300 font-mono">{chaleDetails.termsAcceptance.technicalLog.consentHash}</strong>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* ================= LAYOUT PADRÃO DAY USE / CAMPING ================= */
                <>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div className="bg-muted/30 p-3 rounded-2xl border border-muted-foreground/10 text-center flex flex-col items-center justify-center">
                        <Calendar className="w-4 h-4 text-sun mb-1" />
                        <p className="text-[9px] font-black text-muted-foreground uppercase">Data da Visita</p>
                        <p className="text-xs font-black leading-tight">{visitDate ? format(visitDate, "dd/MM/yyyy (EEEE)", { locale: ptBR }) : '—'}</p>
                      </div>
                      <div className={cn(
                        "p-3 rounded-2xl border text-center flex flex-col items-center justify-center shadow-sm",
                        isPaid ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-300"
                      )}>
                        <p className="text-[9px] font-black text-amber-950 uppercase tracking-tight">
                          {isPaid ? "Total Pago" : "Total no Balcão"}
                        </p>
                        <p className="text-sm font-black text-amber-950 leading-tight">
                          {formatCurrency(isPaid ? (order.total_amount || 0) : valorTotalBalcao)}
                        </p>
                        <span className="text-[8px] font-bold opacity-75 uppercase mt-0.5">
                          {isPaid ? "Confirmado" : "Sem Desconto"}
                        </span>
                      </div>
                      <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-200 text-center flex flex-col items-center justify-center shadow-sm col-span-2 sm:col-span-1">
                        <p className="text-[9px] font-black text-emerald-900 uppercase tracking-tight">
                          {isPaid ? "Desconto Ganho" : "Online Antecipado"}
                        </p>
                        <p className="text-sm font-black text-emerald-700 leading-tight">
                          {isPaid ? formatCurrency(onlineDiscountAmount) : formatCurrency(order.total_amount || 0)}
                        </p>
                        <span className="text-[8px] font-black text-emerald-800 uppercase bg-emerald-100 px-1.5 py-0.5 rounded-full mt-0.5">
                          10% OFF
                        </span>
                      </div>
                    </div>

                    {!isPaid ? (
                      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3.5 text-xs text-amber-950 font-bold leading-relaxed space-y-1 shadow-sm">
                        <div className="flex items-center gap-1.5 text-amber-900 font-black uppercase tracking-tight text-[11px]">
                          <span>⚠️</span>
                          <span>Atenção: Regra de Desconto e Pagamento na Bilheteria:</span>
                        </div>
                        <p className="leading-snug">
                          O desconto de 10% é exclusivo para <u>pagamento antecipado no site</u>.
                        </p>
                      </div>
                    ) : counterQty > 0 ? (
                      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 text-xs text-amber-950 font-bold leading-relaxed flex items-start gap-2 shadow-sm">
                        <span className="text-base shrink-0 mt-0.5">💵</span>
                        <div>
                          <p className="font-black text-amber-900 uppercase text-[11px]">Entradas a Pagar no Balcão:</p>
                          <p className="leading-snug">
                            Sua reserva possui <strong>{counterQty}x Entrada(s) no Balcão</strong> a pagar na bilheteria.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Itens Inclusos no Day Use */}
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-sun/40 to-transparent" />
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest px-2">Itens Inclusos na Reserva</span>
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-sun/40 to-transparent" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {order.order_items?.map((item: any, i: number) => {
                        const unitPrice = item.unit_price ?? (item.total_price / (item.quantity || 1));
                        const displayName = formatProductDisplayName(item.product_id, unitPrice, item.product_name);

                        return (
                          <div key={i} className="flex items-start justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div className="flex items-start gap-2 min-w-0">
                              <div className={item.is_redeemed ? "bg-green-100 p-1 rounded-full shrink-0" : "bg-primary/10 p-1 rounded-full shrink-0"}>
                                <CheckCircle2 className={item.is_redeemed ? "w-3.5 h-3.5 text-green-600" : "w-3.5 h-3.5 text-primary"} />
                              </div>
                              <div className="min-w-0">
                                <p className={`text-xs font-black break-words ${item.is_redeemed ? "line-through opacity-50" : "text-foreground"}`}>
                                  {item.quantity}x {displayName}
                                </p>
                                {((item.product_id || '').toLowerCase().includes('quad') || (item.product_name || '').toLowerCase().includes('quad')) && (() => {
                                  const timeSlot = item.metadata?.time_slot ||
                                    (order.quad_reservations?.find((q: any) =>
                                      (q.quad_type || q.type || '').toUpperCase() === (item.product_id || '').toUpperCase() ||
                                      (item.product_id || '').toUpperCase().includes((q.quad_type || q.type || '').toUpperCase()) ||
                                      (item.product_name || '').toUpperCase().includes((q.quad_type || q.type || '').toUpperCase())
                                    )?.time_slot) ||
                                    (order.quad_reservations?.[0]?.time_slot);
                                  return timeSlot ? (
                                    <div className="mt-1">
                                      <span className="inline-flex items-center gap-1 text-emerald-950 font-black uppercase text-[10px] bg-sun/30 border border-sun/60 px-2 py-0.5 rounded shadow-sm">
                                        🕒 HORÁRIO: {timeSlot}
                                      </span>
                                    </div>
                                  ) : null;
                                })()}
                                {item.is_redeemed && <span className="block text-[8px] font-bold text-green-600 uppercase mt-0.5">Utilizado</span>}
                              </div>
                            </div>
                            <span className="text-xs font-black text-emerald-950 shrink-0">
                              {formatCurrency((item.unit_price || 0) * (item.quantity || 1))}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Footer Area with Buttons */}
          <div className="voucher-buttons p-6 md:p-8 pt-0 flex flex-col gap-3">
            <Button
              onClick={handleSaveImage}
              disabled={generatingImg}
              className="w-full h-13 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black shadow-lg flex gap-2 text-sm uppercase tracking-wider"
            >
              {generatingImg ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
              BAIXAR VOUCHER COMPLETO (IMAGEM)
            </Button>
            <div className="flex gap-3">
              <Button
                onClick={() => window.print()}
                variant="outline"
                className="flex-1 h-11 rounded-2xl font-black flex gap-2 border-2 border-emerald-950 text-emerald-950 hover:bg-emerald-950 hover:text-white transition-all text-xs uppercase"
              >
                <Download className="w-4 h-4" /> IMPRIMIR
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: 'Meu Voucher Balneário Lessa',
                      url: window.location.href
                    });
                  }
                }}
                className="flex-1 h-11 rounded-2xl font-black flex gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 transition-all text-xs uppercase"
              >
                <Share2 className="w-4 h-4" /> COMPARTILHAR
              </Button>
            </div>
          </div>
        </div>

        {chaleDetails && (
          <ChaleTermsModal
            open={isTermsModalOpen}
            onOpenChange={setIsTermsModalOpen}
            acceptanceRecord={chaleDetails.termsAcceptance}
          />
        )}

      </div>
    </div>
  );
}
