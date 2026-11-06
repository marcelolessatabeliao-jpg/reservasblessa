import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Search,
  Calendar,
  User,
  RefreshCw,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Info,
  Ticket,
  ArrowLeft,
  Home,
  Clock,
  Phone,
  FileText,
  Users,
  Baby,
  Sparkles,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Navbar } from '@/components/Navbar';
import { PaymentModal } from '@/components/booking/PaymentModal';
import { ChaleTermsModal, ChaleTermsAcceptanceRecord } from '@/components/booking/ChaleTermsModal';
import { formatCurrency } from '@/lib/booking-types';
import { formatProductDisplayName } from '@/utils/product-utils';
import {
  DEMO_HOSPEDAGEM_ORDER,
  extractChaleDetailsFromOrder,
  formatCpfDisplay,
  formatDateSafe,
  formatPhoneDisplay,
  getLocalChaleOrdersForSearch
} from '@/lib/chale-voucher-utils';

export default function Consultar() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [termsModalRecord, setTermsModalRecord] = useState<ChaleTermsAcceptanceRecord | null>(null);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLoadDemoHospedagem = () => {
    setHasSearched(true);
    setResults([DEMO_HOSPEDAGEM_ORDER]);
    setExpandedId(DEMO_HOSPEDAGEM_ORDER.id);
    toast({
      title: 'Reserva de Hospedagem Carregada',
      description: 'Exibindo a reserva fictícia CHA-8931 (Carlos Oliveira) com todos os detalhes.'
    });
  };

  const performSearch = async (searchQuery: string, background = false) => {
    if (!searchQuery) return;
    if (!background) setLoading(true);
    setHasSearched(true);

    try {
      const cleanQuery = searchQuery.replace(/\D/g, '');
      const rawQuery = searchQuery.trim();
      const rawQueryNoHash = rawQuery.replace(/^#/, '');
      const qLower = rawQueryNoHash.toLowerCase();

      // 1. Verificar reservas locais / fictícias de Hospedagem (ex: CHA-8931, Carlos Oliveira, (69) 99341-2290, 123.456.789-00)
      const localMatches = getLocalChaleOrdersForSearch().filter((loc) => {
        const codeMatch = (loc.confirmation_code || '').toLowerCase().includes(qLower);
        const nameMatch = (loc.customer_name || '').toLowerCase().includes(qLower);
        const phoneDigits = String(loc.customer_phone || '').replace(/\D/g, '');
        const cpfDigits = String(loc.customer_cpf || '').replace(/\D/g, '');
        const phoneMatch = cleanQuery.length >= 4 && phoneDigits.includes(cleanQuery);
        const cpfMatch = cleanQuery.length >= 4 && cpfDigits.includes(cleanQuery);
        return codeMatch || nameMatch || phoneMatch || cpfMatch;
      });

      let supabaseResults: any[] = [];

      // 2. Buscar também no Supabase
      try {
        let supabaseQuery = supabase.from('orders').select('*, order_items(*), quad_reservations(*)');
        let canQuerySupabase = true;

        if (cleanQuery.length >= 10 && cleanQuery.length <= 11 && !/[a-zA-Z]/.test(rawQuery)) {
          supabaseQuery = supabaseQuery.or(
            `customer_cpf.eq.${cleanQuery},customer_cpf.eq.${searchQuery},customer_phone.eq.${cleanQuery},customer_phone.eq.${searchQuery}`
          );
        } else if (rawQueryNoHash.length >= 3) {
          supabaseQuery = supabaseQuery.or(
            `confirmation_code.ilike.%${rawQueryNoHash}%,customer_name.ilike.%${rawQueryNoHash}%`
          );
        } else {
          canQuerySupabase = false;
        }

        if (canQuerySupabase) {
          let { data, error } = await supabaseQuery.order('visit_date', { ascending: false });
          if (!error && data && data.length > 0) {
            supabaseResults = data;
          } else if (
            (!data || data.length === 0) &&
            rawQueryNoHash.length >= 5 &&
            rawQueryNoHash.length <= 8 &&
            /^[a-zA-Z0-9]+$/.test(rawQueryNoHash)
          ) {
            const prefix = rawQueryNoHash.toLowerCase().padEnd(8, '0');
            const minUuid = `${prefix}-0000-0000-0000-000000000000`;
            const maxUuid = `${prefix}-ffff-ffff-ffff-ffffffffffff`;
            const { data: idData, error: idError } = await supabase
              .from('orders')
              .select('*, order_items(*), quad_reservations(*)')
              .gte('id', minUuid)
              .lte('id', maxUuid)
              .order('visit_date', { ascending: false });

            if (!idError && idData && idData.length > 0) {
              supabaseResults = idData;
            }
          }
        }
      } catch (dbErr) {
        console.warn('Aviso ao consultar banco:', dbErr);
      }

      // Mesclar resultados sem duplicar
      const merged = [...localMatches];
      supabaseResults.forEach((dbOrder) => {
        if (!merged.some((m) => m.id === dbOrder.id || (m.confirmation_code && m.confirmation_code === dbOrder.confirmation_code))) {
          merged.push(dbOrder);
        }
      });

      if (merged.length === 0) {
        if (!background) {
          setResults([]);
          toast({
            title: 'Nenhuma reserva encontrada',
            description: 'Verifique o Código, CPF ou Telefone informado e tente novamente.',
            variant: 'destructive'
          });
        }
      } else {
        setResults(merged);
        if (merged.length === 1) {
          setExpandedId(merged[0].id);
        }

        // Auto-sync any pending payments silently for real database orders
        const pendingOrders = supabaseResults.filter((r) =>
          ['pending', 'awaiting_payment', 'aguardando pgto', 'waiting_local', 'waiting_confirmation'].includes(r.status)
        );
        for (const order of pendingOrders) {
          try {
            const { data: syncData } = await supabase.functions.invoke('check-payment', { body: { orderId: order.id } });
            if (syncData?.success && syncData?.updated) {
              setResults((prev) => prev.map((r) => (r.id === order.id ? { ...r, status: 'paid' } : r)));
            }
          } catch (e) {
            console.error('Background sync error:', e);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      if (!background) {
        toast({
          title: 'Erro na busca',
          description: 'Não foi possível realizar a consulta agora.',
          variant: 'destructive'
        });
      }
    } finally {
      if (!background) setLoading(false);
    }
  };

  const [lastQuery, setLastQuery] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    setLastQuery(query);
    const currentQuery = query;
    setQuery('');
    await performSearch(currentQuery);
  };

  React.useEffect(() => {
    const handleFocus = () => {
      if (hasSearched && lastQuery) {
        performSearch(lastQuery, true);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [hasSearched, lastQuery]);

  const handleSyncPayment = async (e: React.MouseEvent, orderId: string) => {
    e.preventDefault();
    e.stopPropagation();

    setSyncingId(orderId);
    try {
      const { data, error } = await supabase.functions.invoke('check-payment', {
        body: { orderId }
      });

      if (error) throw error;

      if (data?.success) {
        if (data.updated) {
          toast({ title: 'Pagamento Confirmado!', description: 'Sua reserva foi marcada como PAGA.', variant: 'default' });
          setResults((prev) => prev.map((r) => (r.id === orderId ? { ...r, status: 'paid' } : r)));
        } else {
          toast({ title: 'Sincronização Concluída', description: 'Ainda aguardando pagamento. Nenhuma alteração.', variant: 'default' });
        }
      } else {
        toast({ title: 'Erro na Sincronização', description: data?.error || 'Erro desconhecido', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      toast({ title: 'Erro ao sincronizar', description: err.message, variant: 'destructive' });
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-100/80 via-emerald-50 to-teal-100/80 bg-fixed">
      <Navbar />

      <main className="max-w-4xl mx-auto px-3 sm:px-4 pt-24 sm:pt-32 pb-16 sm:pb-20">
        <div className="mb-5 sm:mb-8 flex justify-center sm:justify-start">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-emerald-800 hover:text-emerald-950 hover:bg-emerald-200/30 rounded-2xl flex items-center gap-2 font-black transition-all group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            VOLTAR PARA O INÍCIO
          </Button>
        </div>

        <div className="text-center mb-6 sm:mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-emerald-950 uppercase tracking-tighter mb-2 sm:mb-3">
            Consultar <span className="text-emerald-600">Minha Reserva</span>
          </h1>
          <p className="text-emerald-800/80 text-xs sm:text-base font-bold max-w-lg mx-auto px-2">
            Acesse seu voucher digital de Day Use, Hospedagem em Chalés ou Camping informando o Código da Reserva, CPF ou Telefone.
          </p>
        </div>

        <Card className="bg-white/80 backdrop-blur-xl border-2 border-emerald-200 shadow-2xl rounded-3xl sm:rounded-[2.5rem] overflow-hidden mb-8 sm:mb-10">
          <CardContent className="p-4 sm:p-10 space-y-4 sm:space-y-5">
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3 sm:gap-4">
              <div className="relative flex-1 group">
                <div className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-emerald-700 group-focus-within:scale-110 transition-transform">
                  <User className="w-5 h-5" />
                </div>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Código (ex: CHA-8931), CPF ou Telefone"
                  className="h-12 sm:h-16 pl-11 sm:pl-14 pr-4 sm:pr-6 rounded-2xl border-2 border-emerald-200 focus:border-emerald-600 bg-white text-sm sm:text-lg font-bold shadow-sm transition-all"
                />
              </div>
              <Button
                type="submit"
                disabled={loading || !query}
                className="h-12 sm:h-16 px-8 sm:px-10 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-base sm:text-lg shadow-xl transition-all active:scale-95 cursor-pointer"
              >
                {loading ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : <Search className="w-5 h-5 sm:w-6 sm:h-6" />}
              </Button>
            </form>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 pt-2 border-t border-emerald-100">
              <p className="text-[11px] sm:text-xs text-emerald-800 font-bold uppercase tracking-wider text-center sm:text-left">
                Consulte vouchers de Hospedagem, Day Use e Camping
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setTermsModalRecord(null);
                    setIsTermsModalOpen(true);
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-2 border-emerald-300 font-black text-[11px] sm:text-xs uppercase tracking-wider shadow-xs transition-all cursor-pointer text-center"
                >
                  <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Ler Termos de Hospedagem</span>
                </button>
                <button
                  type="button"
                  onClick={handleLoadDemoHospedagem}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-950 via-[#042817] to-slate-950 hover:from-emerald-900 hover:to-emerald-950 text-amber-300 border-2 border-amber-400 font-black text-[11px] sm:text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer text-center"
                >
                  <Home className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Ver Reserva Fictícia de Hospedagem (CHA-8931)</span>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {hasSearched && !loading && results.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="flex items-center gap-2 mb-4 ml-2">
              <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-white">
                <Search className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-black text-emerald-950 uppercase tracking-tight">
                Reservas Encontradas ({results.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-5">
              {results.map((res) => {
                const isPaid = res.status === 'confirmed' || res.status === 'paid' || res.status === 'pago';
                const isExpanded = expandedId === res.id;
                const chaleDetails = extractChaleDetailsFromOrder(res);
                const voucherCode = res.confirmation_code || (res.id ? res.id.replace(/-/g, '').slice(0, 8).toUpperCase() : '');

                return (
                  <div
                    key={res.id}
                    className="bg-white/95 backdrop-blur-md p-5 sm:p-7 rounded-3xl border-2 border-emerald-200 hover:border-amber-400 shadow-xl transition-all duration-300"
                  >
                    <div className="flex flex-col gap-4">
                      {/* Top Header Row */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-100 pb-4">
                        <div className="flex items-start sm:items-center gap-4">
                          <div className="w-13 h-13 sm:w-14 sm:h-14 bg-emerald-950 text-amber-400 border-2 border-amber-400 rounded-2xl flex items-center justify-center shrink-0 shadow-md">
                            {chaleDetails ? <Home className="w-6 h-6" /> : <Calendar className="w-6 h-6" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <Badge className="bg-emerald-950 text-amber-300 border border-amber-400/60 font-black text-[10px] uppercase px-2.5 py-0.5">
                                {chaleDetails ? '🏡 Reserva de Hospedagem' : '☀️ Reserva Balneário'}
                              </Badge>
                              <Badge className="bg-amber-100 text-amber-950 border border-amber-300 font-black text-[10px] uppercase px-2.5 py-0.5">
                                Cód: #{voucherCode}
                              </Badge>
                              <span
                                className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                  isPaid
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                                }`}
                              >
                                {isPaid ? '✓ Confirmada / Paga' : '⏳ Aguardando Pagamento'}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : res.id)}
                              className="text-xl sm:text-2xl font-black text-emerald-950 hover:text-emerald-700 transition-colors flex items-center gap-2 text-left cursor-pointer"
                            >
                              <span>{res.customer_name || 'Cliente'}</span>
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs font-bold text-slate-700">
                              <span className="flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5 text-emerald-700" />
                                {formatPhoneDisplay(res.customer_phone)}
                              </span>
                              <span className="flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5 text-emerald-700" />
                                CPF: {formatCpfDisplay(res.customer_cpf)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                          <div className="text-left md:text-right">
                            <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Valor Total</p>
                            <p className="text-2xl font-black text-emerald-950">{formatCurrency(res.total_amount || 0)}</p>
                            {res.payment_method && (
                              <span className="text-[10px] font-black uppercase text-emerald-700 block">
                                Forma de Pgto: {res.payment_method}
                              </span>
                            )}
                          </div>
                          <Link
                            to={`/voucher/${voucherCode}`}
                            className="px-4 h-12 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 shadow-md transition-all"
                          >
                            <Ticket className="w-4 h-4" />
                            <span>Abrir Voucher</span>
                          </Link>
                        </div>
                      </div>

                      {/* SE FOR HOSPEDAGEM EM CHALÉ: MOSTRA OS DETALHES COMPLETOS SEMPRE OU AO EXPANDIR */}
                      {chaleDetails && (
                        <div className="space-y-4 bg-emerald-50/60 p-4 sm:p-5 rounded-2xl border-2 border-emerald-200/80">
                          {/* Linha 1: Chalé, Pacote, Check-in e Check-out */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                              <span className="text-[10px] font-black uppercase text-emerald-800 block">Acomodação:</span>
                              <span className="text-xs sm:text-sm font-black text-emerald-950 block mt-0.5">
                                {chaleDetails.chaleLabel}
                              </span>
                              <span className="text-[10.5px] font-bold text-slate-700 block mt-0.5">
                                {chaleDetails.occupancyLabel}
                              </span>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                              <span className="text-[10px] font-black uppercase text-emerald-800 block">Pacote Escolhido:</span>
                              <span className="text-xs sm:text-sm font-black text-emerald-950 block mt-0.5">
                                {chaleDetails.packageTitle}
                              </span>
                              <span className="text-[10.5px] font-black text-amber-800 block mt-0.5">
                                Hospedagem: {formatCurrency(chaleDetails.chalePrice)}
                              </span>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                              <span className="text-[10px] font-black uppercase text-emerald-800 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-emerald-700" /> Check-in (Entrada):
                              </span>
                              <span className="text-xs sm:text-sm font-black text-emerald-950 block mt-0.5">
                                {formatDateSafe(chaleDetails.checkInDateStr)}
                              </span>
                              <span className="text-[10.5px] font-black text-emerald-700 block mt-0.5">
                                Horário: a partir das {chaleDetails.checkInTime}
                              </span>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                              <span className="text-[10px] font-black uppercase text-amber-900 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-700" /> Check-out (Saída):
                              </span>
                              <span className="text-xs sm:text-sm font-black text-emerald-950 block mt-0.5">
                                {chaleDetails.checkOutDateStr ? formatDateSafe(chaleDetails.checkOutDateStr) : 'Final da Estadia'}
                              </span>
                              <span className="text-[10.5px] font-black text-amber-800 block mt-0.5">
                                Horário: às {chaleDetails.checkOutTime}
                              </span>
                            </div>
                          </div>

                          {/* Linha 2: Nomes dos Adultos e das Crianças */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 space-y-2">
                              <span className="text-[11px] font-black uppercase text-emerald-950 flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-emerald-700" />
                                Adultos na Hospedagem ({chaleDetails.adultsList.length}):
                              </span>
                              <div className="space-y-1.5">
                                {chaleDetails.adultsList.map((ad, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between bg-emerald-50/70 px-3 py-1.5 rounded-lg border border-emerald-200/70 text-xs"
                                  >
                                    <span className="font-bold text-slate-700">{ad.label}:</span>
                                    <span className="font-black text-emerald-950">{ad.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 space-y-2">
                              <span className="text-[11px] font-black uppercase text-emerald-950 flex items-center gap-1.5">
                                <Baby className="w-4 h-4 text-amber-600" />
                                Crianças Adicionais ({chaleDetails.childrenList.length}):
                              </span>
                              {chaleDetails.childrenList.length > 0 ? (
                                <div className="space-y-1.5">
                                  {chaleDetails.childrenList.map((kid, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between bg-amber-50/80 px-3 py-1.5 rounded-lg border border-amber-200 text-xs"
                                    >
                                      <span className="font-bold text-amber-950">
                                        {kid.name}{' '}
                                        <span className="text-[10px] font-black bg-amber-200/80 text-amber-950 px-1.5 py-0.5 rounded ml-1">
                                          {kid.ageLabel}
                                        </span>
                                      </span>
                                      <span className="text-[10px] font-black text-slate-700">
                                        Chalé {String(kid.chaleId).padStart(2, '0')}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-600 font-bold py-1">
                                  Nenhuma criança adicional registrada nesta reserva.
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Linha 3: Benefícios Inclusos + Demais Itens da Reserva */}
                          <div className="bg-white p-3.5 rounded-xl border border-emerald-200 space-y-2.5">
                            <span className="text-[11px] font-black uppercase text-emerald-950 flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-amber-500" />
                              Benefícios e Demais Itens Inclusos na Reserva:
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200 font-bold text-emerald-950">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>Entradas e Day Use 100% Inclusos</span>
                              </div>
                              <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200 font-bold text-emerald-950">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>Café da manhã incluso (Sex a Dom, das 7h às 9h)</span>
                              </div>
                            </div>

                            {chaleDetails.otherItems.length > 0 && (
                              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                                <span className="text-[10px] font-black uppercase text-slate-700 block">
                                  Serviços Opcionais Contratados Junto à Reserva:
                                </span>
                                {chaleDetails.otherItems.map((oi, idx) => (
                                  <div
                                    key={idx}
                                    className="flex flex-wrap items-center justify-between gap-2 bg-amber-50/70 px-3 py-2 rounded-lg border border-amber-200 text-xs"
                                  >
                                    <div className="flex items-center gap-2 font-black text-slate-950">
                                      <span>
                                        {oi.quantity}x {oi.name}
                                      </span>
                                      {oi.timeSlot && (
                                        <span className="bg-emerald-950 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded">
                                          🕒 Horário: {oi.timeSlot}
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-black text-emerald-950">{formatCurrency(oi.totalPrice)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Linha 4: Termos de Hospedagem & Comprovante de Aceite Eletrônico */}
                          <div className="bg-slate-950 text-white p-3.5 sm:p-4 rounded-xl border-2 border-amber-400/70 space-y-2.5 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/15 pb-2.5">
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                                <div>
                                  <span className="text-[11px] font-black uppercase text-amber-300 tracking-wider block">
                                    Termos de Hospedagem e Condições Gerais ({chaleDetails.termsAcceptance.termsVersion})
                                  </span>
                                  <span className="text-[10.5px] text-emerald-200 font-bold block">
                                    ✓ Aceite eletrônico registrado e vinculado à reserva #{voucherCode}
                                  </span>
                                </div>
                              </div>

                              <Button
                                type="button"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setTermsModalRecord(chaleDetails.termsAcceptance);
                                  setIsTermsModalOpen(true);
                                }}
                                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] uppercase tracking-wider rounded-lg h-9 px-3.5 shrink-0 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5 mr-1.5" />
                                Ler Termos e Comprovante de Aceite
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10.5px] text-slate-300 font-medium">
                              <div>
                                <span className="text-slate-400 font-bold uppercase block text-[9.5px]">Hóspede / Reserva:</span>
                                <strong className="text-white">{chaleDetails.termsAcceptance.guestName} (#{voucherCode})</strong>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold uppercase block text-[9.5px]">Data e Horário do Aceite:</span>
                                <strong className="text-white">{chaleDetails.termsAcceptance.acceptedAtFormatted}</strong>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold uppercase block text-[9.5px]">Hash / Registro Técnico:</span>
                                <strong className="text-amber-300 font-mono">{chaleDetails.termsAcceptance.technicalLog.consentHash}</strong>
                              </div>
                            </div>
                          </div>

                          <Link
                            to={`/voucher/${voucherCode}`}
                            className="w-full h-12 bg-gradient-to-r from-emerald-950 via-[#042817] to-slate-950 hover:from-emerald-900 hover:to-emerald-950 text-amber-300 border-2 border-amber-400 font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-md text-xs sm:text-sm uppercase tracking-wider"
                          >
                            <Ticket className="w-5 h-5 text-amber-400" />
                            VISUALIZAR E BAIXAR VOUCHER DE HOSPEDAGEM COMPLETO
                          </Link>
                        </div>
                      )}

                      {/* SE NÃO FOR HOSPEDAGEM (DAY USE / CAMPING) E ESTIVER EXPANDIDO */}
                      {!chaleDetails && isExpanded && (
                        <div className="mt-2 p-5 bg-emerald-50/60 rounded-2xl border border-emerald-200 animate-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center gap-2 mb-4">
                            <Info className="w-4 h-4 text-emerald-700" />
                            <p className="text-[11px] font-black text-emerald-900 uppercase tracking-widest">Resumo da Reserva</p>
                          </div>
                          <div className="space-y-3">
                            {res.order_items?.map((item: any, i: number) => (
                              <div
                                key={i}
                                className="flex justify-between items-center text-sm border-b border-emerald-200/50 pb-2 last:border-0 last:pb-0"
                              >
                                <span className="font-bold text-emerald-950">
                                  {item.quantity}x {formatProductDisplayName(item.product_id, item.unit_price, item.product_name)}
                                </span>
                                <span className="font-mono font-black text-emerald-800">
                                  {formatCurrency(item.unit_price * item.quantity)}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 pt-4 border-t border-emerald-200 flex justify-between items-center">
                            <span className="text-xs font-black text-emerald-900 uppercase">Total da Reserva</span>
                            <span className="text-lg font-black text-emerald-950">{formatCurrency(res.total_amount || 0)}</span>
                          </div>
                          <Link
                            to={`/voucher/${voucherCode}`}
                            className="mt-5 w-full h-12 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl flex items-center justify-center gap-2 transition-all"
                          >
                            <Ticket className="w-5 h-5" />
                            VER VOUCHER COMPLETO
                          </Link>
                        </div>
                      )}

                      {!isPaid && !res.is_demo && (
                        <div className="mt-1 pt-3 border-t border-emerald-100 flex flex-wrap gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl flex-1 border-amber-300 text-amber-900 hover:bg-amber-100 font-bold"
                            disabled={syncingId === res.id}
                            onClick={(e) => handleSyncPayment(e, res.id)}
                          >
                            {syncingId === res.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Sincronizar Pagamento
                          </Button>
                          <Button
                            size="sm"
                            className="rounded-xl flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPaymentOrder(res);
                            }}
                          >
                            <CreditCard className="w-4 h-4 mr-2" />
                            Efetivar Pagamento
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {paymentOrder && (
          <PaymentModal
            open={!!paymentOrder}
            onOpenChange={(o) => !o && setPaymentOrder(null)}
            orderId={paymentOrder.id}
            name={paymentOrder.customer_name}
            email={paymentOrder.customer_email || ''}
            phone={paymentOrder.customer_phone || ''}
            cpf={paymentOrder.customer_cpf || ''}
            totalAmount={paymentOrder.total_amount || 0}
            initialMethod="PIX"
            isClient={true}
            onSuccess={() => {
              setResults((prev) => prev.map((r) => (r.id === paymentOrder.id ? { ...r, status: 'paid' } : r)));
              setPaymentOrder(null);
              toast({ title: 'Reserva Confirmada', description: 'O seu pagamento foi efetuado com sucesso!' });
            }}
          />
        )}

        {hasSearched && !loading && results.length === 0 && (
          <div className="text-center py-16 bg-white/70 rounded-3xl border border-emerald-200 animate-in fade-in duration-500 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <Search className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-emerald-950 uppercase">Nenhuma reserva encontrada</h3>
              <p className="text-emerald-800/70 font-bold mt-1 text-sm">
                Revise o CPF, Telefone ou Código informado, ou clique abaixo para ver o exemplo de Hospedagem.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleLoadDemoHospedagem}
              className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black uppercase text-xs rounded-xl px-5 h-11"
            >
              🏡 Ver Reserva Fictícia de Hospedagem (CHA-8931)
            </Button>
          </div>
        )}

        <ChaleTermsModal
          open={isTermsModalOpen}
          onOpenChange={setIsTermsModalOpen}
          acceptanceRecord={termsModalRecord}
        />
      </main>
    </div>
  );
}
