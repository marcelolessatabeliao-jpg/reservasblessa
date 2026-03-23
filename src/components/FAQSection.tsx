import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WHATSAPP_NUMBER } from '@/lib/booking-types';

const faqs = [
  {
    question: 'Qual o horário de funcionamento?',
    answer: 'Funcionamos das 09h às 17h, todas as sextas, sábados, domingos, segundas e feriados. Terças, quartas e quintas o balneário fica fechado para manutenção.',
  },
  {
    question: 'É necessário reservar para o Day Use?',
    answer: 'Não é obrigatório, mas recomendamos fortemente carregar sua reserva online para agilizar o atendimento na entrada, especialmente aos domingos e feriados.',
  },
  {
    question: 'Posso levar comida e bebidas?',
    answer: 'Sim! É permitida a entrada de alimentos leves e petiscos. No entanto, é PROIBIDA a entrada e vendas de bebidas alcoólicas. Demais bebidas (sucos, refrigerantes, água, etc) apenas consumo local e recipientes de vidro por questões de segurança.',
  },
  {
    question: 'Tem restaurante no local?',
    answer: 'Sim, possuímos um restaurante completo com pratos típicos, porções e bebidas geladas. Servimos também café da manhã. Também temos quiosques para quem prefere fazer seu próprio churrasco (sob reserva).',
  },
  {
    question: 'O balneário aceita animais de estimação?',
    answer: 'Não, Ainda não temos estruturas para pets e por questões de segurança e limpeza do espaço não é permitido.',
  },
  {
    question: 'Como funcionam os passeios de quadriciclo?',
    answer: 'Os passeios são agendados por horários (09:00, 10:30, 14:00 e 15:30). O valor é cobrado à parte e você pode reservar o seu horário aqui mesmo no site com descontos!',
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="py-12 sm:py-16 bg-transparent">
      <div className="container px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16"
          >
            <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <HelpCircle className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground mb-4">
              Dúvidas Frequentes
            </h2>
            <p className="text-muted-foreground text-lg">
              Respostas rápidas para as perguntas mais comuns dos nossos visitantes.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card rounded-3xl border p-6 sm:p-10 shadow-xl"
          >
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-b last:border-0 border-muted-foreground/10">
                  <AccordionTrigger className="text-left font-display font-bold text-base sm:text-lg py-4 hover:no-underline hover:text-primary transition-colors">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>

          <motion.div
             initial={{ opacity: 0 }}
             whileInView={{ opacity: 1 }}
             viewport={{ once: true }}
             className="mt-12 text-center"
          >
            <p className="text-muted-foreground mb-6">Ainda tem alguma dúvida? Fale com a gente!</p>
            <Button asChild variant="outline" className="rounded-xl font-display font-bold px-8 py-6 border-2 group">
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-whatsapp group-hover:scale-110 transition-transform" />
                Chamar no WhatsApp
              </a>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
