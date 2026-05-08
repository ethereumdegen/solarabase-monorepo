import { useEffect, useState } from 'react';
import { getBilling } from '../api';
import type { PlanTier } from '../types';

export function PlanBadge() {
  const [plan, setPlan] = useState<PlanTier | null>(null);

  useEffect(() => {
    getBilling()
      .then((b) => setPlan(b.subscription.plan))
      .catch(() => {});
  }, []);

  if (!plan) return null;

  const colors: Record<PlanTier, string> = {
    free: 'bg-white/5 text-white/30',
    pro: 'bg-blue-500/15 text-blue-400',
    team: 'bg-purple-500/15 text-purple-400',
  };

  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-medium capitalize ${colors[plan]}`}>
      {plan}
    </span>
  );
}
