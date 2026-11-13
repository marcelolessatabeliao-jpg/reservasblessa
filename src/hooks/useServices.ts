import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceItem {
  id: string;
  name: string;
  type: string;
  base_price: number;
}

const DEFAULT_SERVICES: ServiceItem[] = [
  { id: '1', name: 'Quiosque Maior', type: 'kiosk_maior', base_price: 150 },
  { id: '2', name: 'Quiosque Menor', type: 'kiosk_menor', base_price: 100 },
  { id: '3', name: 'Quiosque Familiar', type: 'kiosk_familiar', base_price: 75 },
  { id: '4', name: 'Quadriciclo Individual', type: 'quad_individual', base_price: 130 },
  { id: '5', name: 'Quadriciclo Dupla', type: 'quad_dupla', base_price: 195 },
  { id: '6', name: 'Futebol de Sabão', type: 'add_futebol-sabao', base_price: 10 },
  { id: '7', name: 'Pesca Esportiva', type: 'add_pesca', base_price: 15 },
];

export function useServices() {
  const { data: services = DEFAULT_SERVICES, error } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      try {
        const fetchPromise = supabase
          .from('services')
          .select('*')
          .eq('ativo', true);

        const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('Timeout') }), 1500)
        );

        const res: any = await Promise.race([fetchPromise, timeoutPromise]);
        if (res.error) {
          console.warn('[useServices] Usando tabela de serviços padrão:', res.error.message);
          return DEFAULT_SERVICES;
        }
        return (res.data && res.data.length > 0 ? res.data : DEFAULT_SERVICES) as ServiceItem[];
      } catch {
        return DEFAULT_SERVICES;
      }
    },
    initialData: DEFAULT_SERVICES,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const getPrice = (type: string, fallbackPrice: number = 0): number => {
    if (type === 'add_futebol-sabao' || type === 'futebol-sabao') {
      return 10;
    }
    const currentServices = services || DEFAULT_SERVICES;
    const service = currentServices.find((s) => s.type === type);
    return service ? Number(service.base_price) : fallbackPrice;
  };

  return { services: services || DEFAULT_SERVICES, getPrice, isLoading: false, error };
}
