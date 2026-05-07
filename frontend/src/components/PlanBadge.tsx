import { useEffect, useState } from 'react';
import { getBilling } from '../api';
import type { PlanTier } from '../types';

export function PlanBadge({ workspaceId }: { workspaceId: string }) {
  const [plan, setPlan] = useState<PlanTier | null>(null);

  useEffect(() => {
    getBilling(workspaceId)
      .then((b) => setPlan(b.subscription.plan))
      .catch(() => {});
  }, [workspaceId]);

  if (!plan) return null;

  const colors: Record<PlanTier, string> = {
    free: 'bg-gray-100 text-gray-500',
    pro: 'bg-blue-100 text-blue-700',
    team: 'bg-purple-100 text-purple-700',
  };

  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-medium capitalize ${colors[plan]}`}>
      {plan}
    </span>
  );
}
