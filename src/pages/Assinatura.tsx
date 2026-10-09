import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Phone, 
  HelpCircle,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SpecialPlansSection } from '@/components/SpecialPlansSection';
import { PricingComparisonSection } from '@/components/PricingComparisonSection';
import logo from '@/assets/logo.png';
import { WHATSAPP_NUMBER } from '@/lib/booking-types';

export default function Assinatura() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(prev => prev === index ? null : index);
  };

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Olá! Gostaria de mais informações sobre a Assinatura do Lessa Club (Plano Anual em 12x).')}`;

  const faqItems = [
    {
      q: 'Como funciona o parcelamento em até 12x no cartão?',
      a: 'O valor total do Plano Anual pode ser parcelado em até 12 parcelas mensais diretamente no seu cartão de crédito, com débito automático mês a mês. Isso permite que você e sua família desfrutem de acesso livre durante 365 dias pagando uma mensalidade fixa e muito baixa.'
    },
    {
      q: 'Por que garantir o preço atual antes de 2027?',
      a: 'O Balneário Lessa está passando por ampliações contínuas de estrutura e novos atrativos. Os novos valores reajustados de mensalidade e Day Use entrarão em vigência a partir de 2027. Assinando agora o Plano Anual, você congela e garante o valor promocional de 2026 durante todo o seu contrato!'
    },
    {
      q: 'Crianças, Idosos e PCD/TEA precisam pagar assinatura?',
      a: 'Não! No Balneário Lessa, crianças de até 11 anos, idosos com 60 anos ou mais e pessoas com deficiência (PCD & TEA) possuem ACESSO LIVRE e GRATUITO. Eles não precisam de assinatura e entram gratuitamente acompanhando o titular sócio.'
    },
    {
      q: 'Quem tem direito ao Lessa Pass com 50% de desconto?',
      a: 'Professores, Servidores Públicos e Estudantes têm direito ao Lessa Pass com 50% de desconto (a partir de apenas R$ 22,50/mês no plano anual). Basta comprovar o vínculo na hora do cadastro ou envio da documentação.'
    },
    {
      q: 'Como acesso o balneário após assinar?',
      a: 'Após a contratação online, você recebe sua Carteirinha Digital de Sócio no WhatsApp e por e-mail com QR Code exclusivo. Ao chegar na bilheteria, basta apresentar sua carteirinha digital no celular e seu documento para entrada imediata e prioritária.'
    },
    {
      q: 'Posso levar convidados que não são sócios?',
      a: 'Sim! Como benefício exclusivo do Sócio Lessa Club, seus convidados que forem ao balneário com você pagam apenas MEIA-ENTRADA no Day Use!'
    },
    {
      q: 'O que NÃO faz parte da assinatura (serviços pagos à parte)?',
      a: 'A assinatura do Lessa Club garante acesso livre e ilimitado à entrada do balneário, piscinas naturais, áreas de banho e estrutura geral de lazer. Não estão inclusos e são contratados à parte: consumo no Restaurante e lanchonete (refeições, porções e bebidas), locação/reserva de Quiosques privativos com churrasqueira e atividades opcionais como Futebol de Sabão, Beach Tênis e Pesca Esportiva. Como sócio, você ainda aproveita descontos e cashback exclusivo em consumos!'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-100/80 via-emerald-50 to-teal-100/80 bg-fixed text-foreground font-body selection:bg-emerald-200">
      {/* 1. TOP ANNOUNCEMENT BAR */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 text-emerald-100 text-[11px] sm:text-xs py-2 px-3 text-center font-bold border-b border-emerald-800/60 sticky top-0 z-50 shadow-md">
        <div className="container mx-auto flex items-center justify-center gap-2 flex-wrap">
          <span className="bg-amber-400 text-emerald-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
            Tabela 2026
          </span>
          <span>
            Garanta o preço atual assinando o <strong>Plano Anual parcelado em até 12x no cartão</strong>. Novos valores entrarão em vigência a partir de <strong>2027</strong>!
          </span>
        </div>
      </div>

      {/* 2. NAVBAR */}
      <header className="bg-primary/95 backdrop-blur-md border-b border-primary-foreground/10 sticky top-[33px] sm:top-[33px] z-40 shadow-md">
        <div className="container mx-auto px-4 h-16 sm:h-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <img src={logo} alt="Balneário Lessa" className="h-9 sm:h-12 w-auto drop-shadow-sm" />
            <div>
              <span className="font-display font-black text-xl sm:text-2xl text-white block leading-none tracking-wide">
                Lessa Club
              </span>
              <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest text-amber-300 block mt-1">
                Clube de Vantagens & Sócios
              </span>
            </div>
          </a>
        </div>
      </header>

      {/* 3. HERO SECTION */}
      <section className="relative pt-10 pb-2 sm:pt-16 sm:pb-4 overflow-hidden bg-transparent">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-4 sm:space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-sun/20 text-emerald-950 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-sun/40 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              Acesso Livre Sex, Sáb, Dom e Feriados
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="font-display font-black text-3xl sm:text-5xl md:text-6xl text-foreground leading-[1.1] tracking-tight"
            >
              Seu refúgio natural com <br className="hidden sm:inline" />
              <span className="text-primary italic">
                Acesso Ilimitado o Ano Inteiro
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-base sm:text-xl text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed"
            >
              Garanta o preço atual assinando o valor referente ao <strong>Plano Anual parcelado em até 12x no cartão</strong>. Novos valores entrarão em vigência a partir de <strong>2027</strong>.
            </motion.p>
          </div>
        </div>
      </section>

      {/* 4. SIMULADOR DE MENSALIDADE DA FAMÍLIA (EXATAMENTE COMO NO SITE DE RESERVAS) */}
      {/* 4. SIMULADOR DE MENSALIDADE DA FAMÍLIA (EXATAMENTE COMO NO SITE DE RESERVAS) */}
      <div id="simulador">
        <div id="planos">
          <SpecialPlansSection />
        </div>
      </div>

      {/* 5. VANTAGENS EXCLUSIVAS DO ASSINANTE (O QUE VOCÊ GANHA SENDO SÓCIO LESSA) */}
      <section className="py-14 sm:py-20 bg-white/80 backdrop-blur-sm border-t border-emerald-900/10">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-12 space-y-3">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Vantagens do Clube
            </span>
            <h2 className="font-display font-black text-2xl sm:text-4xl text-emerald-950">
              O que você ganha sendo Sócio Lessa?
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: '🏊‍♂️',
                title: 'Acesso Ilimitado o Ano Todo',
                desc: 'Venha quando quiser nas sextas, sábados, domingos e feriados sem pagar ingressos avulsos.'
              },
              {
                icon: '🎟️',
                title: 'Convidado paga Meia-Entrada',
                desc: 'Traga um amigo ou parente com você: o convidado do sócio tem direito a meia-entrada no Day Use.'
              },
              {
                icon: '💳',
                title: 'Parcelamento em até 12x',
                desc: 'Contrate o Plano Anual no cartão de crédito em até 12 parcelas que cabem com folga no orçamento.'
              },
              {
                icon: '🍽️',
                title: 'Cashback e Descontos',
                desc: 'Tenha 5% a 10% de cashback e benefícios exclusivos de consumação em nosso restaurante caseiro.'
              },
              {
                icon: '📱',
                title: 'Carteirinha Digital Instantânea',
                desc: 'Acesse direto pelo seu smartphone com QR Code de entrada rápida e prioritária na portaria.'
              },
              {
                icon: '🔒',
                title: 'Preço Congelado até 2027',
                desc: 'Fique protegido de todos os reajustes de tarifa que entrarão em vigor no próximo ano.'
              },
            ].map((v, i) => (
              <div key={i} className="p-6 rounded-3xl bg-[#f7faf8] border border-emerald-900/10 hover:border-emerald-600/30 transition-all hover:shadow-md">
                <span className="text-3xl block mb-3">{v.icon}</span>
                <h3 className="font-display font-black text-lg text-emerald-950 mb-1.5">{v.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. POR QUE SER SÓCIO LESSA (EXATAMENTE COMO NO SITE DE RESERVAS) */}
      <PricingComparisonSection />

      {/* 9. FAQ / DÚVIDAS FREQUENTES */}
      <section id="faq" className="py-14 sm:py-20 bg-[#f7faf8]">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-10 space-y-3">
            <HelpCircle className="w-8 h-8 text-emerald-700 mx-auto" />
            <h2 className="font-display font-black text-2xl sm:text-4xl text-emerald-950">
              Perguntas Frequentes sobre a Assinatura
            </h2>
            <p className="text-muted-foreground text-sm font-medium">
              Tudo o que você precisa saber antes de assinar.
            </p>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <div 
                key={i} 
                className="bg-white rounded-2xl border border-emerald-900/10 overflow-hidden shadow-sm transition-all"
              >
                <button
                  onClick={() => toggleFaq(i)}
                  className="w-full p-4 sm:p-5 text-left font-bold text-sm sm:text-base text-emerald-950 flex items-center justify-between gap-4"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={`w-4 h-4 text-emerald-700 shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-5 sm:px-5 sm:pb-6 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed border-t border-emerald-900/5 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. FINAL CTA SECTION */}
      <section className="py-16 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 text-white relative overflow-hidden">
        <div className="container mx-auto px-4 text-center max-w-3xl space-y-6 relative z-10">
          <span className="bg-amber-400 text-emerald-950 text-xs font-black uppercase px-3 py-1 rounded-full tracking-widest inline-block">
            Não Perca o Prazo
          </span>
          <h2 className="font-display font-black text-3xl sm:text-5xl text-white leading-tight">
            Garanta agora o Preço de 2026 em até 12x no Cartão
          </h2>
          <p className="text-emerald-100/80 text-sm sm:text-base font-medium max-w-xl mx-auto leading-relaxed">
            Novos valores entrarão em vigência a partir de 2027. Assine hoje mesmo e tenha o melhor balneário de Rondônia à disposição da sua família o ano todo.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black text-base h-14 px-8 rounded-2xl shadow-xl"
            >
              <a href="#simulador">
                SIMULAR MINHA FAMÍLIA AGORA
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto bg-[#25D366] hover:bg-[#20ba5a] text-emerald-950 font-black text-base h-14 px-8 rounded-2xl shadow-xl border-none transition-all"
            >
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <Phone className="w-5 h-5 fill-emerald-950 text-emerald-950" /> Atendimento no WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* 11. FOOTER */}
      <footer className="bg-emerald-950 text-emerald-100/60 py-8 border-t border-emerald-900 text-xs">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Balneário Lessa" className="h-8 w-auto opacity-80" />
            <span className="font-bold text-white">Balneário Família Lessa</span>
          </div>
          <p>
            Via Araras, Setor 09 – Ariquemes/RO • Aberto Sex a Dom e Feriados das 9h às 17h
          </p>
          <div className="flex items-center gap-4">
            <a href="https://reservas.balneariolessa.com.br/" className="hover:text-white transition-colors underline">
              Site de Reservas
            </a>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors underline">
              Fale Conosco
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
