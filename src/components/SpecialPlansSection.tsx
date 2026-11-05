import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Crown, Check, SlidersHorizontal, ArrowRight, ShieldCheck, Sparkles, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/booking-types';
import { CustomFamilyCheckoutModal } from '@/components/club/CustomFamilyCheckoutModal';
import type { BillingCycle } from '@/lib/club-types';

export function SpecialPlansSection() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('ANNUAL');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Contadores por perfil
  const [counts, setCounts] = useState<Record<string, number>>({
    ADULTO: 1,
    ESTUDANTE: 0,
    PROFESSOR: 0,
    SERVIDOR: 0,
    KIDS: 0,
    IDOSO_60: 0,
    PCD_TEA: 0,
  });

  const updateCount = (code: string, delta: number) => {
    setCounts((prev) => ({
      ...prev,
      [code]: Math.max(0, (prev[code] || 0) + delta),
    }));
  };

  const payingCount = (counts.ADULTO || 0) + (counts.ESTUDANTE || 0) + (counts.PROFESSOR || 0) + (counts.SERVIDOR || 0);
  const freeCount = (counts.KIDS || 0) + (counts.IDOSO_60 || 0) + (counts.PCD_TEA || 0);
  const totalPeople = payingCount + freeCount;

  // Preços mensais por modalidade
  const priceTable = useMemo(() => {
    const isAnnual = billingCycle === 'ANNUAL';
    return {
      ADULTO: isAnnual ? 44.91 : 49.90,
      ESTUDANTE: isAnnual ? 22.50 : 25.00,
      PROFESSOR: isAnnual ? 22.50 : 25.00,
      SERVIDOR: isAnnual ? 22.50 : 25.00,
      KIDS: 0,
      IDOSO_60: 0,
      PCD_TEA: 0,
    };
  }, [billingCycle]);

  // Totais
  const monthlySum = useMemo(() => {
    return (
      (counts.ADULTO || 0) * priceTable.ADULTO +
      (counts.ESTUDANTE || 0) * priceTable.ESTUDANTE +
      (counts.PROFESSOR || 0) * priceTable.PROFESSOR +
      (counts.SERVIDOR || 0) * priceTable.SERVIDOR
    );
  }, [counts, priceTable]);

  const annualSum = monthlySum * 12;
  const currentTotal = billingCycle === 'ANNUAL' ? annualSum : monthlySum;
  const formattedTotal = currentTotal.toFixed(2).split('.');
  const intPart = formattedTotal[0];
  const decPart = formattedTotal[1];

  const handleAderir = () => {
    if (totalPeople === 0) return;
    setIsCheckoutOpen(true);
  };

  return (
    <section id="especiais" className="py-12 sm:py-20 bg-transparent">
      <div className="container px-4">
        {/* Cabeçalho da Seção */}
        <div className="text-center space-y-3 max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Escolha ou Personalize seu Plano Lessa Club
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium">
            Selecione entre <strong>Plano Anual (10% OFF em até 12x)</strong> ou{' '}
            <strong>Plano Mensal Recorrente</strong> diretamente no plano escolhido.
          </p>

          <div className="inline-flex items-center bg-white p-1.5 rounded-2xl border-2 border-emerald-600/30 shadow-md mt-2">
            <button
              type="button"
              onClick={() => setBillingCycle('ANNUAL')}
              className={`px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center gap-2 ${
                billingCycle === 'ANNUAL'
                  ? 'bg-emerald-700 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Plano Anual (Até 12x)</span>
              <span className="bg-amber-400 text-emerald-950 text-[10px] px-2 py-0.5 rounded-full font-black">
                10% OFF
              </span>
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('MONTHLY')}
              className={`px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all ${
                billingCycle === 'MONTHLY'
                  ? 'bg-emerald-700 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Plano Mensal Recorrente
            </button>
          </div>
        </div>

        {/* ===============================================================
            NOVO SIMULADOR SUPER DESTAQUE: PLANO FAMÍLIA PERSONALIZADO
        =============================================================== */}
        <div className="relative rounded-3xl bg-gradient-to-br from-emerald-950 via-[#072e1d] to-slate-950 text-white p-6 sm:p-10 shadow-2xl border-2 border-amber-400/80 ring-8 ring-amber-400/10 overflow-hidden max-w-6xl mx-auto">
          {/* Brilhos decorativos */}
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-amber-400/15 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-emerald-500/15 blur-3xl rounded-full pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Coluna Esquerda: Apresentação + Carteirinhas */}
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-2 bg-amber-400 text-emerald-950 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-lg">
                <Crown className="w-4 h-4 fill-emerald-950" />
                EXCLUSIVO • MONTE DO SEU JEITO
              </div>

              <h3 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight text-white">
                Plano Família Personalizado{' '}
                <span className="text-amber-300 block sm:inline text-lg sm:text-2xl">
                  ({billingCycle === 'ANNUAL' ? 'Anual 10% OFF' : 'Mensal'})
                </span>
              </h3>

              <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed font-medium">
                Sua família tem perfis diferentes? Aqui você <strong>não precisa fazer assinaturas separadas</strong>! Combine <strong>Adulto Integral + Estudante + Professor + Servidor + Crianças Kids + Idosos 60+ + PCD/TEA</strong> em um único contrato e pagamento.
              </p>

              {/* Preview das artes das carteirinhas empilhadas */}
              <div className="flex items-center gap-3 pt-2">
                <img
                  src="/cards/17.png"
                  alt="Lessa Club"
                  className="w-28 sm:w-32 rounded-xl border-2 border-amber-400/60 shadow-lg"
                />
                <img
                  src="/cards/7.png"
                  alt="Student Pass"
                  className="w-24 sm:w-28 rounded-xl border border-white/20 shadow-md -ml-6 mt-3"
                />
                <img
                  src="/cards/37.png"
                  alt="Lessa Kids"
                  className="w-24 sm:w-28 rounded-xl border border-white/20 shadow-md -ml-6 -mt-2"
                />
              </div>

              <ul className="space-y-2 text-xs text-emerald-100/90 pt-3">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>1 Carteirinha Oficial individual (Frente e Verso) para cada membro</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Sem taxa de adesão • Acesso livre Sex, Sáb, Dom e Feriados</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Contrato único consolidado disponível no Portal do Sócio</span>
                </li>
              </ul>
            </div>

            {/* Coluna Direita: Montador Interativo + Preço e Aderir */}
            <div className="lg:col-span-7 bg-white text-slate-900 rounded-2xl p-5 sm:p-7 shadow-xl border border-slate-100 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-700" />
                  <span className="font-black text-sm uppercase tracking-wide text-slate-900">
                    Selecione os integrantes da sua família:
                  </span>
                </div>

                <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('MONTHLY')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      billingCycle === 'MONTHLY'
                        ? 'bg-white text-slate-900 shadow-sm font-black'
                        : 'text-slate-500'
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('ANNUAL')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      billingCycle === 'ANNUAL'
                        ? 'bg-emerald-700 text-white shadow-sm font-black'
                        : 'text-slate-500'
                    }`}
                  >
                    Anual 10% OFF
                  </button>
                </div>
              </div>

              {/* Cards de Incremento por Modalidade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    code: 'ADULTO',
                    label: 'Adulto Integral (Lessa Club)',
                    price: billingCycle === 'ANNUAL' ? 'R$ 44,91/mês' : 'R$ 49,90/mês',
                  },
                  {
                    code: 'ESTUDANTE',
                    label: 'Estudante (50% OFF)',
                    price: billingCycle === 'ANNUAL' ? 'R$ 22,50/mês' : 'R$ 25,00/mês',
                  },
                  {
                    code: 'PROFESSOR',
                    label: 'Professor (50% OFF)',
                    price: billingCycle === 'ANNUAL' ? 'R$ 22,50/mês' : 'R$ 25,00/mês',
                  },
                  {
                    code: 'SERVIDOR',
                    label: 'Servidor Público (50% OFF)',
                    price: billingCycle === 'ANNUAL' ? 'R$ 22,50/mês' : 'R$ 25,00/mês',
                  },
                  {
                    code: 'KIDS',
                    label: 'Lessa Kids (0 a 11 anos)',
                    price: 'GRÁTIS (R$ 0)',
                  },
                  {
                    code: 'IDOSO_60',
                    label: 'Lessa Vitalício 60+',
                    price: 'GRÁTIS (R$ 0)',
                  },
                  {
                    code: 'PCD_TEA',
                    label: 'Inclusão PCD e TEA',
                    price: 'GRÁTIS (R$ 0)',
                  },
                ].map((item) => {
                  const qty = counts[item.code] || 0;
                  return (
                    <div
                      key={item.code}
                      className={`flex items-center justify-between py-2 px-3 rounded-xl border text-xs transition-all ${
                        qty > 0
                          ? 'bg-emerald-50/80 border-emerald-400 shadow-sm'
                          : 'bg-slate-50 border-slate-200/80'
                      }`}
                    >
                      <div className="pr-2">
                        <span className="font-bold text-slate-900 block leading-tight">
                          {item.label}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold">
                          {item.price}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCount(item.code, -1)}
                          className="w-7 h-7 rounded-lg bg-white border border-slate-300 font-black text-slate-700 hover:bg-slate-100"
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-black text-sm text-slate-900">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCount(item.code, 1)}
                          className="w-7 h-7 rounded-lg bg-emerald-700 text-white font-black hover:bg-emerald-800"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Rodapé: Preço Final + Botão de Aderir */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total para {totalPeople} {totalPeople === 1 ? 'pessoa' : 'pessoas'}
                  </span>
                  <div className="text-slate-800 font-bold text-sm">
                    R${' '}
                    <span className="text-3xl font-black text-[#126b38]">
                      {intPart}
                    </span>
                    <span className="text-sm font-bold text-slate-500">
                      ,{decPart}
                    </span>
                    <span className="text-xs text-slate-500 font-normal ml-1">
                      {billingCycle === 'ANNUAL' ? '/ano' : '/mês'}
                    </span>
                  </div>
                  {billingCycle === 'ANNUAL' && monthlySum > 0 && (
                    <div className="text-xs font-black text-emerald-700">
                      ou em até 12x de {formatCurrency(monthlySum)}/mês
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={handleAderir}
                  disabled={totalPeople === 0}
                  className="w-full sm:w-auto px-8 h-12 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black text-sm uppercase tracking-wide rounded-xl shadow-lg"
                >
                  Aderir Plano Personalizado
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Unificado de Checkout do Plano Personalizado */}
      <CustomFamilyCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        familyCounts={counts}
        billingCycle={billingCycle}
      />
    </section>
  );
}