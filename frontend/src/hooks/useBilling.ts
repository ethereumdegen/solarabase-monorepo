import { useQuery } from '@tanstack/react-query';
import { getBilling } from '../api';

export function useBilling(wsId: string | undefined) {
  return useQuery({
    queryKey: ['billing', wsId],
    queryFn: () => getBilling(wsId!),
    enabled: !!wsId,
  });
}
