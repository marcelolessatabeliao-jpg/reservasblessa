import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Esse componente escuta todas as mudanças de rota no React (SPA)
 * e dispara um novo evento de 'PageView' para o Meta Pixel.
 */
export const MetaPixel = () => {
  const location = useLocation();

  useEffect(() => {
    // Verifica se a função fbq do Facebook já foi injetada no window (via index.html)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fbq = (window as any).fbq;
    
    if (typeof fbq === "function") {
      fbq("track", "PageView");
    }
  }, [location.pathname, location.search]);

  return null;
};
