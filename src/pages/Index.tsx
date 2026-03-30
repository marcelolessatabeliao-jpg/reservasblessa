import { Navbar } from '@/components/Navbar';
import { HeroSection } from '@/components/HeroSection';
import { AboutSection } from '@/components/AboutSection';
import { DayUsePricing, DayUseRules } from '@/components/DayUseInfoSection';
import { PricingComparisonSection } from '@/components/PricingComparisonSection';
import { LessaClubPlanCards } from '@/components/LessaClubPlanCards';
import { SpecialPlansSection } from '@/components/SpecialPlansSection';
import { SpecialPlansCards } from '@/components/SpecialPlansCards';
import { ServicesSection } from '@/components/ServicesSection';
import { TestimonialsSection } from '@/components/TestimonialsSection';
import { InstagramGallery } from '@/components/InstagramGallery';
import { BookingSection } from '@/components/BookingSection';
import { FAQSection } from '@/components/FAQSection';
import { ContactSection } from '@/components/ContactSection';
import { LocationSection } from '@/components/LocationSection';
import { Footer } from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-100/80 via-emerald-50 to-teal-100/80 bg-fixed">
      <Navbar />
      <HeroSection />
      <BookingSection />
      <SpecialPlansSection />
      <AboutSection />
      <DayUsePricing />
      <DayUseRules />
      <PricingComparisonSection />
      <LessaClubPlanCards />
      <SpecialPlansCards />
      <ServicesSection />
      <TestimonialsSection />
      <InstagramGallery />
      <FAQSection />
      <ContactSection />
      <LocationSection />
      <Footer />
    </div>
  );
};

export default Index;
