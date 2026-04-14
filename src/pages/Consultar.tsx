import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Calendar, ChevronRight, User, Hash } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Navbar } from '@/components/Navbar';

export default function Consultar() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
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
                  placeholder="CPF ou Código (ex: L-XXXX)"
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
              {results.map((res) => (
                <Link 
                  key={res.id} 
                  to={`/voucher/${res.confirmation_code}`}
                  className="group bg-white/60 hover:bg-emerald-600 backdrop-blur-md p-6 rounded-3xl border border-white hover:border-emerald-400 shadow-lg hover:shadow-emerald-200 transition-all duration-300 flex items-center justify-between"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                      <Calendar className="w-7 h-7 text-emerald-600 group-hover:text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-emerald-600 group-hover:text-emerald-100 uppercase tracking-widest mb-1">
                        Data da Visita
                      </p>
                      <p className="text-xl font-black text-emerald-950 group-hover:text-white">
                        {res.visit_date ? format(parseISO(res.visit_date), "dd 'de' MMMM", { locale: ptBR }) : 'Data não definida'}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px] font-bold text-emerald-800/60 group-hover:text-emerald-200 uppercase">
                          Cód: {res.confirmation_code}
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className={`text-[11px] font-black uppercase ${
                          res.status === 'confirmed' || res.status === 'paid' ? 'text-emerald-600 group-hover:text-emerald-300' : 'text-amber-600 group-hover:text-amber-200'
                        }`}>
                          {res.status === 'confirmed' || res.status === 'paid' ? 'Confirmada' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full border-2 border-emerald-100 flex items-center justify-center group-hover:border-white/40 text-emerald-600 group-hover:text-white group-hover:translate-x-2 transition-all">
                    <ChevronRight className="w-6 h-6" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
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
