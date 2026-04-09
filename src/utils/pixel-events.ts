/**
 * Utilitário para disparar eventos do Meta Pixel (Facebook) de forma segura.
 * Verifica se a função 'fbq' existe no objeto window antes de chamar.
 */

export const trackFBEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && (window as any).fbq) {
    console.log(`[MetaPixel] Tracking event: ${eventName}`, params);
    (window as any).fbq('track', eventName, params);
  } else {
    console.warn(`[MetaPixel] fbq not found. Could not track event: ${eventName}`);
  }
};
