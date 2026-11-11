/**
 * Utilitário oficial para rastreamento de eventos do Meta Pixel (Dataset 761812239646587).
 * - Garante higienização e padronização de parâmetros (evitando parâmetros fora do padrão ou dados sensíveis)
 * - Deduplica eventos repetidos (ex: Purchase em Realtime + Check manual) via eventID
 * - Bloqueia disparos em rotas internas/administrativas (/admin, /clube-admin)
 */

export const META_PIXEL_ID = '761812239646587';
export const DEFAULT_PIXEL_CATEGORY = 'Parque Aquático, Lazer e Hospedagem';

const PRIVATE_ROUTE_PREFIXES = ['/admin', '/clube-admin'];
const trackedDedupeKeys = new Set<string>();

export const isPixelBlockedRoute = (pathname?: string): boolean => {
  const path =
    pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  return PRIVATE_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
};

export interface TrackFBEventOptions {
  eventId?: string;
  dedupeKey?: string;
}

const COMMERCE_EVENTS = new Set([
  'ViewContent',
  'Lead',
  'InitiateCheckout',
  'AddToCart',
  'Purchase',
]);

export const trackFBEvent = (
  eventName: string,
  params?: Record<string, any>,
  options?: TrackFBEventOptions
) => {
  if (typeof window === 'undefined') return;
  if (isPixelBlockedRoute()) return;

  const fbq = (window as any).fbq;
  if (typeof fbq !== 'function') {
    console.warn(`[MetaPixel] fbq not found. Could not track event: ${eventName}`);
    return;
  }

  const dedupeKey = options?.dedupeKey || options?.eventId;
  if (dedupeKey) {
    if (trackedDedupeKeys.has(dedupeKey)) {
      return;
    }
    trackedDedupeKeys.add(dedupeKey);
  }

  const sanitized: Record<string, any> = {};
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || k === 'payment_method') continue;
      if (k === 'value') {
        const num = Number(v);
        if (Number.isFinite(num) && num >= 0) {
          sanitized.value = Number(num.toFixed(2));
        }
        continue;
      }
      sanitized[k] = v;
    }
  }

  if (COMMERCE_EVENTS.has(eventName)) {
    if (!sanitized.content_category) {
      sanitized.content_category = DEFAULT_PIXEL_CATEGORY;
    }
    if (!sanitized.content_type && eventName !== 'Lead') {
      sanitized.content_type = 'product';
    }
    if (sanitized.value !== undefined && !sanitized.currency) {
      sanitized.currency = 'BRL';
    }
  }

  try {
    if (options?.eventId) {
      fbq('track', eventName, sanitized, { eventID: options.eventId });
    } else {
      fbq('track', eventName, sanitized);
    }
  } catch (err) {
    console.warn(`[MetaPixel] Error tracking event ${eventName}:`, err);
  }
};
