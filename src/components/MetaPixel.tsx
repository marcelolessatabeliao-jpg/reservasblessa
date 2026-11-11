import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  isPixelBlockedRoute,
  META_PIXEL_ID,
  trackFBEvent,
} from '@/utils/pixel-events';

/**
 * Escuta mudanças de rota no SPA React e dispara:
 * - PageView único por navegação (sem duplicar no carregamento inicial)
 * - ViewContent contextualizado para Lazer/Turismo nas páginas públicas
 * - Bloqueia disparos em rotas administrativas (/admin, /clube-admin)
 */
export const MetaPixel = () => {
  const location = useLocation();
  const lastTrackedPathRef = useRef<string>('');
  const pixelInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (isPixelBlockedRoute(location.pathname)) {
      return;
    }

    const fbq = (window as any).fbq;
    if (typeof fbq !== 'function') return;

    if (!pixelInitializedRef.current && !(window as any)._lessaPixelInited) {
      fbq('init', META_PIXEL_ID);
      (window as any)._lessaPixelInited = true;
      pixelInitializedRef.current = true;
    }

    const routeKey = `${location.pathname}${location.search}`;
    if (lastTrackedPathRef.current === routeKey) {
      return;
    }
    lastTrackedPathRef.current = routeKey;

    fbq('track', 'PageView');

    const path = location.pathname.toLowerCase();
    if (path === '/' || path === '') {
      trackFBEvent(
        'ViewContent',
        {
          content_name: 'Balneário Lessa - Day Use e Lazer',
          content_category: 'Parque Aquático, Day Use e Reservas',
          content_type: 'product',
        },
        { dedupeKey: `view_${routeKey}` }
      );
    } else if (
      path.startsWith('/planos') ||
      path.startsWith('/aderir') ||
      path.startsWith('/assinatura') ||
      path.startsWith('/clube')
    ) {
      trackFBEvent(
        'ViewContent',
        {
          content_name: 'Lessa Club - Planos de Associado e Lazer',
          content_category: 'Clube de Vantagens e Lazer',
          content_type: 'product',
        },
        { dedupeKey: `view_${routeKey}` }
      );
    }
  }, [location.pathname, location.search]);

  return null;
};
