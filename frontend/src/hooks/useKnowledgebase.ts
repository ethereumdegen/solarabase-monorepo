import { useQuery } from '@tanstack/react-query';
import { getKbSettings } from '../api';

export function useKnowledgebase(kbId: string | undefined) {
  return useQuery({
    queryKey: ['kb', kbId],
    queryFn: () => getKbSettings(kbId!),
    enabled: !!kbId,
  });
}
