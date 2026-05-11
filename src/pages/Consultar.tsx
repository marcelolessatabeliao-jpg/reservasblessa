import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Calendar, ChevronRight, User, Hash, RefreshCw, CreditCard } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Navbar } from '@/components/Navbar';
import { PaymentModal } from '@/components/booking/PaymentModal';

export default function Consultar() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<any>(null);

  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const cleanQuery = query.replace(/\D/g, '');
      const isCpf = cleanQuery.length === 11;

      let supabaseQuery = supabase.from('orders').select('*');

      if (isCpf) {
        supabaseQuery = supabaseQuery.eq('customer_cpf', cleanQuery);
      } else if (cleanQuery.length >= 10 && cleanQuery.length <= 11) {
        // It's a phone number
        supabaseQuery = supabaseQuery.eq('customer_phone', cleanQuery);
      } else {
        supabaseQuery = supabaseQuery.eq('confirmation_code', query.toUpperCase());
      }

      const { data, error } = await supabaseQuery.order('visit_date', { ascending: false });


      if (error) throw error;

      if (!data || data.length === 0) {
        setResults([]);
        toast({
          title: "Nenhuma reserva encontrada",
          description: "Verifique os dados e tente novamente.",
          variant: "destructive"
        });
      } else if (data.length === 1 && !isCpf) {
        // Direct redirect for code search with 1 result
        navigate(`/voucher/${data[0].confirmation_code}`);
      } else {
        setResults(data);
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro na busca",
        description: "Não foi possível realizar a consulta agora.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

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
          toast({ title: "Pagamento Confirmado!", description: `Sua reserva foi marcada como PAGA.`, variant: "default" });
          // Update the specific result locally
          setResults(prev => prev.map(r => r.id === orderId ? { ...r, status: 'paid' } : r));
        } else {
          toast({ title: "Sincronização Concluída", description: `Ainda aguardando pagamento. Nenhuma alteração.`, variant: "default" });
        }
      } else {
        toast({ title: "Erro na Sincronização", description: data?.error || "Erro desconhecido", variant: "destructive" });
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
    } finally {
      setSyncingId(null);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-100/80 via-emerald-50 to-teal-100/80 bg-fixed">
      <Navbar />
      
      <main className="max-w-4xl mx-auto px-4 pt-32 pb-20">
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl md:text-5xl font-black text-emerald-950 uppercase tracking-tighter mb-4">
            Consultar <span className="text-emerald-600">Minha Reserva</span>
          </h1>
          <p className="text-emerald-800/70 font-bold max-w-lg mx-auto">
            Acesse seu voucher digital informando o CPF utilizado na compra ou o código da reserva enviado após o pagamento.
          </p>
        </div>

        <Card className="bg-white/70 backdrop-blur-xl border-white shadow-2xl rounded-[2.5rem] overflow-hidden mb-12">
          <CardContent className="p-8 md:p-12">
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1 group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-600 group-focus-within:scale-110 transition-transform">
                  <Hash className="w-5 h-5" />
                </div>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="CPF, Código ou Telefone (Apenas números)"
                  className="h-16 pl-14 pr-6 rounded-2xl border-2 border-emerald-100 focus:border-emerald-500 bg-white text-lg font-bold shadow-sm transition-all"
                />
              </div>
              <Button 
                type="submit" 
                disabled={loading || !query}
                className="h-16 px-10 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg shadow-xl shadow-emerald-200 transition-all active:scale-95"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
              </Button>
            </form>
            <p className="text-center text-xs text-emerald-800/60 mt-4 font-bold uppercase tracking-widest">
              Consulte e pague reservas pendentes
            </p>
          </CardContent>
        </Card>

        {hasSearched && !loading && results.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="flex items-center gap-2 mb-6 ml-4">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white">
                <Search className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-black text-emerald-950 uppercase tracking-tight">
                Reservas Encontradas ({results.length})
              </h2>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {results.map((res) => {
                const isPaid = res.status === 'confirmed' || res.status === 'paid';
                return (
                <div key={res.id} className="group bg-white/60 hover:bg-emerald-50/80 backdrop-blur-md p-6 rounded-3xl border border-white hover:border-emerald-200 shadow-lg transition-all duration-300">
                  <Link 
                    to={`/voucher/${res.confirmation_code}`}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                        <Calendar className="w-7 h-7 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">
                          Data da Visita
                        </p>
                        <p className="text-xl font-black text-emerald-950">
                          {res.visit_date ? format(parseISO(res.visit_date), "dd 'de' MMMM", { locale: ptBR }) : 'Data não definida'}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[11px] font-bold text-emerald-800/60 uppercase">
                            Cód: {res.confirmation_code}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className={`text-[11px] font-black uppercase ${
                            isPaid ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            {isPaid ? 'Confirmada' : 'Aguardando Pagamento'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-full border-2 border-emerald-100 flex items-center justify-center group-hover:border-emerald-300 text-emerald-600 group-hover:translate-x-2 transition-all">
                      <ChevronRight className="w-6 h-6" />
                    </div>
                  </Link>
                  
                  {!isPaid && (
                    <div className="mt-4 pt-4 border-t border-emerald-100/50 flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl flex-1 border-amber-200 text-amber-700 hover:bg-amber-50"
                        disabled={syncingId === res.id}
                        onClick={(e) => handleSyncPayment(e, res.id)}
                      >
                        {syncingId === res.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Já Paguei (Sincronizar)
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-xl flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
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
              )})}
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
            onSuccess={() => {
              setResults(prev => prev.map(r => r.id === paymentOrder.id ? { ...r, status: 'paid' } : r));
              setPaymentOrder(null);
              toast({ title: 'Reserva Confirmada', description: 'O seu pagamento foi efetuado com sucesso!' });
            }}
          />
        )}

        {hasSearched && !loading && results.length === 0 && (
          <div className="text-center py-20 animate-in fade-in duration-500">
            <div className="w-20 h-20 bg-emerald-100/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-emerald-300" />
            </div>
            <h3 className="text-xl font-black text-emerald-900 uppercase">Nenhuma reserva encontrada</h3>
            <p className="text-emerald-700/60 font-bold mt-2">Revise o CPF ou o código e tente novamente.</p>
          </div>
        )}
      </main>
    </div>
  );
}
