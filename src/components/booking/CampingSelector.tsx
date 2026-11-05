import React from 'react';
import { 
  Tent, 
  Users, 
  Sparkles, 
  Check, 
  Info, 
  ShieldAlert, 
  Crown, 
  Calendar, 
  Clock, 
  Coffee, 
  Sun, 
  Zap, 
  UtensilsCrossed, 
  Baby, 
  HeartHandshake,
  AlertTriangle
} from 'lucide-react';
import { CampingBooking, CAMPING_PRICE_PER_PERSON, formatCurrency, isOperatingDay } from '@/lib/booking-types';
import { QuantityStepper } from '@/components/QuantityStepper';
import { Badge } from '@/components/ui/badge';
import { useServices } from '@/hooks/useServices';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  camping: CampingBooking;
  onUpdate: (updates: Partial<CampingBooking>) => void;
  visitDate?: Date | null;
  onUpdateVisitDate?: (date: Date | null) => void;
}

export function CampingSelector({ camping, onUpdate, visitDate, onUpdateVisitDate }: Props) {
  const { getPrice } = useServices();
  const pricePerPerson = getPrice('camping_per_person', CAMPING_PRICE_PER_PERSON);

  // Adultos pagantes (default para peopleCount se adultsCount não estiver definido)
  const adultsCount = camping.adultsCount !== undefined ? camping.adultsCount : (camping.peopleCount || 0);
  const childrenCount = camping.childrenCount || 0;
  const seniorsCount = camping.seniorsCount || 0;
  const totalCampers = adultsCount + childrenCount + seniorsCount;

  const total = adultsCount * pricePerPerson;

  const handleUpdateAdults = (val: number) => {
    const newTotal = val + childrenCount + seniorsCount;
    onUpdate({
      adultsCount: val,
      peopleCount: newTotal
    });
  };

  const handleUpdateChildren = (val: number) => {
    const newTotal = adultsCount + val + seniorsCount;
    onUpdate({
      childrenCount: val,
      peopleCount: newTotal
    });
  };

  const handleUpdateSeniors = (val: number) => {
    const newTotal = adultsCount + childrenCount + val;
    onUpdate({
      seniorsCount: val,
      peopleCount: newTotal
    });
  };

  const activeDate = camping.date || visitDate;
  const isDateValid = activeDate ? isOperatingDay(activeDate) : false;

  return (
    <div className="space-y-6">
      {/* Banner Oficial Camping Lessa */}
      <div className="bg-gradient-to-br from-emerald-950 via-[#042817] to-slate-950 text-white rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden border-2 border-emerald-600/50">
        <div className="absolute -right-8 -bottom-8 w-56 h-56 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 bg-amber-400 text-emerald-950 font-black uppercase text-[10px] sm:text-xs tracking-widest px-3.5 py-1 rounded-full shadow-lg">
              <Tent className="w-3.5 h-3.5 fill-emerald-950" />
              MODALIDADE ÁREA DE CAMPING
            </div>
            <span className="text-amber-400 font-bold text-xs uppercase tracking-wider">
              {totalCampers > 0 ? `${totalCampers} Campista(s) Selecionado(s)` : 'Opcional'}
            </span>
          </div>

          <div>
            <h3 className="font-sans font-black text-2xl sm:text-4xl text-white tracking-tight">
              Área de Camping <span className="text-amber-400">(Pernoite Sob as Estrelas)</span>
            </h3>
            <p className="text-emerald-100/90 text-xs sm:text-sm leading-relaxed max-w-2xl font-medium mt-2">
              Acampe imerso na natureza exuberante do Balneário Lessa. Aproveite a tranquilidade da noite e usufrua do parque com Day Use do dia seguinte incluso!
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
            <div className="bg-emerald-900/50 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-emerald-700/50 text-xs text-emerald-100">
              <span className="text-[10px] uppercase font-bold text-emerald-300 block">Tarifa por Pessoa</span>
              <span className="text-amber-400 font-black text-sm sm:text-base">{formatCurrency(pricePerPerson)}</span>
            </div>

            <div className="bg-emerald-900/50 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-emerald-700/50 text-xs text-emerald-100">
              <span className="text-[10px] uppercase font-bold text-emerald-300 block">Gratuidades Oficiais</span>
              <span className="text-white font-black text-xs sm:text-sm">Idosos 60+ e Crianças</span>
            </div>

            <div className="bg-emerald-900/50 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-emerald-700/50 text-xs text-emerald-100">
              <span className="text-[10px] uppercase font-bold text-emerald-300 block">Dia Seguinte</span>
              <span className="text-amber-300 font-black text-xs sm:text-sm">Day Use Incluso</span>
            </div>

            <div className="bg-emerald-900/50 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-emerald-700/50 text-xs text-emerald-100">
              <span className="text-[10px] uppercase font-bold text-emerald-300 block">Café da Manhã</span>
              <span className="text-rose-300 font-black text-xs sm:text-sm">NÃO Incluso</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de Dias de Funcionamento */}
      {activeDate && !isDateValid && (
        <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl flex items-start gap-3 text-amber-950">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="block text-amber-900 font-black">Atenção ao dia selecionado:</strong>
            O camping é permitido <strong>exclusivamente em dias de funcionamento do parque</strong> (sextas, sábados, domingos e feriados oficiais).
          </div>
        </div>
      )}

      {/* Card de Configuração de Campistas com Gratuidades (Idosos e Crianças) */}
      <div className="bg-white rounded-[2rem] border-2 border-emerald-100 p-5 sm:p-7 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h4 className="font-sans font-black text-emerald-950 text-base sm:text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-700" />
              Participantes do Camping
            </h4>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Informe a quantidade de pessoas. As gratuidades são mantidas para idosos (60+) e crianças (até 11 anos).
            </p>
          </div>

          {activeDate && (
            <Badge className="bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-bold self-start sm:self-auto py-1 px-3 rounded-xl">
              <Calendar className="w-3.5 h-3.5 mr-1 text-emerald-700" />
              {format(activeDate, "dd/MM/yyyy (EEE)", { locale: ptBR })}
            </Badge>
          )}
        </div>

        {/* Linhas de Seleção de Campistas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Adultos Pagantes */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-emerald-950">Adultos Pagantes</span>
                <span className="text-xs font-black text-emerald-700">{formatCurrency(pricePerPerson)}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">De 12 a 59 anos</span>
            </div>

            <div className="pt-2 flex justify-center">
              <QuantityStepper
                value={adultsCount}
                onChange={handleUpdateAdults}
                min={0}
                max={30}
                size="md"
              />
            </div>
          </div>

          {/* Crianças até 11 anos (Gratuidade mantida) */}
          <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-200 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-emerald-950 flex items-center gap-1.5">
                  <Baby className="w-4 h-4 text-emerald-600" /> Crianças
                </span>
                <Badge className="bg-emerald-600 text-white text-[9px] font-black uppercase">Grátis</Badge>
              </div>
              <span className="text-[11px] text-emerald-800">Até 11 anos (Gratuito)</span>
            </div>

            <div className="pt-2 flex justify-center">
              <QuantityStepper
                value={childrenCount}
                onChange={handleUpdateChildren}
                min={0}
                max={15}
                size="md"
              />
            </div>
          </div>

          {/* Idosos 60+ (Gratuidade mantida) */}
          <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-200 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-emerald-950 flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4 text-emerald-600" /> Idosos
                </span>
                <Badge className="bg-emerald-600 text-white text-[9px] font-black uppercase">Grátis</Badge>
              </div>
              <span className="text-[11px] text-emerald-800">A partir de 60 anos (Gratuito)</span>
            </div>

            <div className="pt-2 flex justify-center">
              <QuantityStepper
                value={seniorsCount}
                onChange={handleUpdateSeniors}
                min={0}
                max={15}
                size="md"
              />
            </div>
          </div>
        </div>

        {/* Resumo da Seleção de Camping */}
        {totalCampers > 0 && (
          <div className="border-t border-emerald-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⛺</span>
              <div>
                <span className="font-black text-sm text-emerald-950 block">
                  {totalCampers} campista{totalCampers > 1 ? 's' : ''} no total
                </span>
                <span className="text-[11px] text-emerald-800 font-medium">
                  {adultsCount} pagante{adultsCount !== 1 ? 's' : ''} ({formatCurrency(pricePerPerson)}/cada)
                  {childrenCount > 0 && ` · ${childrenCount} criança(s) grátis`}
                  {seniorsCount > 0 && ` · ${seniorsCount} idoso(s) grátis`}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total do Camping</span>
              <span className="text-2xl font-black text-emerald-950 font-sans">
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Regras Oficiais do Camping (Todas as 8 regras exigidas pelo cliente) */}
      <div className="bg-amber-50/90 border-2 border-amber-300 rounded-3xl p-5 sm:p-7 space-y-4 shadow-xs">
        <div className="flex items-center gap-2 text-amber-950 font-black text-sm uppercase tracking-wide">
          <ShieldAlert className="w-5 h-5 text-amber-700" />
          <span>Regras e Orientações Oficiais da Área de Camping</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-amber-950">
          <div className="flex items-start gap-2.5 bg-white/80 p-3 rounded-2xl border border-amber-200 shadow-xs">
            <span className="text-base">💰</span>
            <div>
              <strong className="block font-black text-amber-950">R$ 100 por pessoa</strong>
              <span>Tarifa única por campista adulto para a experiência de pernoite.</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-white/80 p-3 rounded-2xl border border-amber-200 shadow-xs">
            <span className="text-base">📅</span>
            <div>
              <strong className="block font-black text-amber-950">Apenas em dias de funcionamento</strong>
              <span>Permitido exclusivamente nas sextas, sábados, domingos e feriados oficiais.</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-white/80 p-3 rounded-2xl border border-amber-200 shadow-xs">
            <span className="text-base">🎁</span>
            <div>
              <strong className="block font-black text-amber-950">Gratuidades Mantidas</strong>
              <span>Crianças até 11 anos e idosos a partir de 60 anos não pagam a taxa de camping.</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-white/80 p-3 rounded-2xl border border-amber-200 shadow-xs">
            <span className="text-base">☀️</span>
            <div>
              <strong className="block font-black text-amber-950">Day use do dia seguinte incluso</strong>
              <span>Aproveite as piscinas, cachoeira e áreas de lazer durante o dia seguinte sem custo adicional.</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-white/80 p-3 rounded-2xl border border-amber-200 shadow-xs">
            <span className="text-base">☕</span>
            <div>
              <strong className="block font-black text-rose-900">Não incluso café da manhã</strong>
              <span>O café da manhã é exclusivo dos chalés; campistas devem trazer seus próprios alimentos matinais.</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-white/80 p-3 rounded-2xl border border-amber-200 shadow-xs">
            <span className="text-base">🔌</span>
            <div>
              <strong className="block font-black text-amber-950">Banheiros e tomadas após as 17h</strong>
              <span>Permitido utilizar banheiros e tomadas dos quiosques após o fechamento do parque para o público geral.</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-white/80 p-3 rounded-2xl border border-amber-200 shadow-xs">
            <span className="text-base">⛺</span>
            <div>
              <strong className="block font-black text-amber-950">Equipamentos por conta do cliente</strong>
              <span>Barracas, colchões, extensões, lanternas e itens pessoais devem ser trazidos pelo campista.</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-white/80 p-3 rounded-2xl border border-amber-200 shadow-xs">
            <span className="text-base">🍽️</span>
            <div>
              <strong className="block font-black text-rose-900">Sem alimentação após as 17h</strong>
              <span>O restaurante e lanchonetes fecham às 17h. Recomendamos trazer lanches para o jantar e noite.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
