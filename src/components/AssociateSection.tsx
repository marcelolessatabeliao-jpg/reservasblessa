import { motion } from 'framer-motion';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ENTRY_PRICE, ENTRY_HALF_PRICE, formatCurrency } from '@/lib/booking-types';
import { QuantityStepper } from '@/components/QuantityStepper';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, GraduationCap, Briefcase, BookOpen, Calculator } from 'lucide-react';

const plans = [
  {
    name: 'Lessa Servidor Pass',
    icon: Briefcase,
    benefits: ['Day Use por R$ 25,00', 'Gratuidade para dependentes até 11 anos', 'Acesso prioritário'],
    color: 'bg-primary/10 text-primary border-primary/30',
  },
  {
    name: 'Student Pass',
    icon: GraduationCap,
    benefits: ['Day Use por R$ 25,00', 'Meia-entrada com carteira de estudante', 'Desconto em quadriciclo'],
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  },
  {
    name: 'Professor Pass',
    icon: BookOpen,
    benefits: ['Day Use por R$ 25,00', 'Gratuidade para dependentes até 11 anos', 'Benefícios especiais'],
    color: 'bg-sun/20 text-foreground border-sun/30',
  },
];

export function AssociateSection() {
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(2);
  const [isAssociado, setIsAssociado] = useState(false);

  const pricePerAdult = isAssociado ? ENTRY_HALF_PRICE : ENTRY_PRICE;
  const totalNormal = (adults + children) * ENTRY_PRICE;
  const totalAssociado = adults * ENTRY_HALF_PRICE; // children free
  const savings = totalNormal - totalAssociado;

  return (
    <section id="associado" className="py-20 bg-gradient-to-b from-primary/10 to-background">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-block bg-sun/20 text-foreground font-bold text-sm px-4 py-1.5 rounded-full mb-4">
            🟢 Associado
          </span>
          <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">
            Faça sua Simulação
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Simule o valor do seu plano de associado de acordo com sua família
          </p>
        </motion.div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`bg-card rounded-xl border-2 ${plan.color} p-6 shadow-card`}
            >
              <plan.icon className="h-8 w-8 mb-3" />
              <h3 className="font-display font-bold text-lg mb-3">{plan.name}</h3>
              <ul className="space-y-2">
                {plan.benefits.map(b => (
                  <li key={b} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span> {b}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Simulator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-card rounded-xl border-2 border-primary/20 p-8 max-w-lg mx-auto shadow-elevated"
        >
          <div className="flex items-center gap-3 mb-6">
            <Calculator className="h-6 w-6 text-primary" />
            <h3 className="font-display font-bold text-xl">Simulador de Economia</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-medium">Adultos</span>
              </div>
              <QuantityStepper value={adults} onChange={setAdults} min={1} max={10} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-sun" />
                <span className="font-medium">Crianças (até 11 anos)</span>
              </div>
              <QuantityStepper value={children} onChange={setChildren} min={0} max={10} />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-4">
                <Checkbox id="sim-assoc" checked={isAssociado} onCheckedChange={(v) => setIsAssociado(!!v)} />
                <label htmlFor="sim-assoc" className="font-medium cursor-pointer">Simular como Associado</label>
              </div>

              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Sem plano ({adults} adultos + {children} crianças)</span>
                  <span className="font-medium">{formatCurrency(totalNormal)}</span>
                </div>
                {isAssociado && (
                  <>
                    <div className="flex justify-between text-sm text-primary">
                      <span>Com plano Associado</span>
                      <span className="font-bold">{formatCurrency(totalAssociado)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-whatsapp font-bold border-t pt-2">
                      <span>💰 Você economiza</span>
                      <span>{formatCurrency(savings)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <Button asChild className="w-full mt-6 bg-primary hover:bg-primary/90 text-primary-foreground font-display font-bold">
            <a href="#reservas">Fazer minha reserva</a>
          </Button>
        </motion.div>

        {/* Gratuidades */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-lg mx-auto mt-8 bg-card rounded-xl border p-6 shadow-card"
        >
          <h4 className="font-display font-bold mb-3">🎫 Gratuidades e Meias-entradas</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>Crianças até 10 anos</span><span className="font-bold text-whatsapp">Gratuito</span></li>
            <li className="flex justify-between"><span>PCD / TEA</span><span className="font-bold text-whatsapp">Gratuito</span></li>
            <li className="flex justify-between"><span>Idosos (60+)</span><span className="font-bold text-whatsapp">Gratuito</span></li>
            <li className="flex justify-between"><span>Estudante (com carteira)</span><span className="font-bold text-primary">Meia-entrada</span></li>
            <li className="flex justify-between"><span>Servidor público</span><span className="font-bold text-primary">Meia-entrada</span></li>
            <li className="flex justify-between"><span>Professor</span><span className="font-bold text-primary">Meia-entrada</span></li>
            <li className="flex justify-between"><span>Doação solidária (1kg)</span><span className="font-bold text-primary">Meia-entrada</span></li>
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
