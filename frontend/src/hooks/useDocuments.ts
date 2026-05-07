import { useQuery } from '@tanstack/react-query';
import { listDocuments } from '../api';

export function useDocuments(kbId: string) {
  return useQuery({
    queryKey: ['documents', kbId],
    queryFn: () => listDocuments(kbId),
    refetchInterval: 5000,
  });
}
