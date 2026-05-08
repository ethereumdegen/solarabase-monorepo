import { useQuery } from '@tanstack/react-query';
import { getBilling } from '../api';

export function useBilling() {
  return useQuery({
    queryKey: ['billing'],
    queryFn: () => getBilling(),
  });
}
