import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceItem {
  id: string;
  name: string;
  type: string;
  base_price: number;
}

export function useServices() {
  const { data: services = [], isLoading, error } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('ativo', true);
      
      if (error) {
        console.error('Error fetching services:', error);
        throw error;
      }
      return data as ServiceItem[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const getPrice = (type: string, fallbackPrice: number = 0): number => {
    const service = services.find((s) => s.type === type);
    return service ? Number(service.base_price) : fallbackPrice;
  };

  return { services, getPrice, isLoading, error };
}
