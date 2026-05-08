import { useQuery } from '@tanstack/react-query';
import { getKbBilling } from '../api';

export function useBilling(kbId: string) {
  return useQuery({
    queryKey: ['billing', kbId],
    queryFn: () => getKbBilling(kbId),
  });
}
