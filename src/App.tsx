import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
// Version: 1.1.2 - Premium Modal Update
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import Voucher from "./pages/Voucher";
import Consultar from "./pages/Consultar";
import Assinatura from "./pages/Assinatura";
import { MetaPixel } from "@/components/MetaPixel";

const queryClient = new QueryClient();

// Detectar se o acesso está vindo de um subdomínio de assinatura (ex: assinatura.balneario.com.br ou assinatura.balneariolessa.com.br)
const isAssinaturaSubdomain = typeof window !== 'undefined' && (
  window.location.hostname.toLowerCase().startsWith('assinatura.') ||
  window.location.hostname.toLowerCase().startsWith('clube.')
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <MetaPixel />
        <Routes>
          <Route path="/" element={isAssinaturaSubdomain ? <Assinatura /> : <Index />} />
          <Route path="/assinatura" element={<Assinatura />} />
          <Route path="/clube" element={<Assinatura />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/voucher/:code" element={<Voucher />} />
          <Route path="/consultar" element={<Consultar />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
