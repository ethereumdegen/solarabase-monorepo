import { useEffect, useState } from 'react';
import { getKbBilling, createKbCheckout, createPortal } from '../api';
import type { BillingInfo } from '../types';

const PLAN_LIMITS: Record<string, { docs: string; queries: string; members: string }> = {
  free: { docs: '50/KB', queries: '1,000/mo', members: '2' },
  pro: { docs: 'Unlimited', queries: '5,000/mo', members: '5' },
  team: { docs: 'Unlimited', queries: 'Unlimited', members: 'Unlimited' },
};

export function KbBillingCard({ kbId }: { kbId: string }) {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getKbBilling(kbId).then(setBilling).catch(() => {});
  }, [kbId]);

  const handleUpgrade = async (plan: string) => {
    setError(null);
    try {
      const { url } = await createKbCheckout(kbId, plan);
      window.location.href = url;
    } catch (e: any) {
      setError(e.message || 'Failed to start checkout');
    }
  };

  const handlePortal = async () => {
    setError(null);
    try {
      const { url } = await createPortal();
      window.location.href = url;
    } catch (e: any) {
      setError(e.message || 'Failed to open billing portal');
    }
  };

  if (!billing) return null;

  const plan = billing.subscription.plan;
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  return (
    <div className="bg-[#111] border border-white/5 rounded-xl p-6">
      <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-4">Plan & Usage</h2>

      <div className="flex items-center gap-3 mb-4">
        <span className={`px-3 py-1 rounded-lg text-sm font-medium capitalize ${
          plan === 'free' ? 'bg-white/5 text-white/40' :
          plan === 'pro' ? 'bg-blue-500/15 text-blue-400' :
          'bg-purple-500/15 text-purple-400'
        }`}>
          {plan}
        </span>
        <span className="text-sm text-white/30">
          {billing.usage.queries} queries used this period
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm mb-6 text-white/60">
        <div><span className="text-white/25 text-xs block">Docs</span>{limits.docs}</div>
        <div><span className="text-white/25 text-xs block">Queries</span>{limits.queries}</div>
        <div><span className="text-white/25 text-xs block">Members</span>{limits.members}</div>
      </div>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <div className="flex gap-3">
        {plan === 'free' && (
          <>
            <button onClick={() => handleUpgrade('pro')}
              className="px-4 py-2 bg-blue-500/15 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/25 transition-colors">
              Upgrade to Pro ($19/mo)
            </button>
            <button onClick={() => handleUpgrade('team')}
              className="px-4 py-2 bg-purple-500/15 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/25 transition-colors">
              Upgrade to Team ($49/mo)
            </button>
          </>
        )}
        {plan !== 'free' && (
          <button onClick={handlePortal}
            className="px-4 py-2 border border-white/10 text-white/50 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors">
            Manage Subscription
          </button>
        )}
      </div>
    </div>
  );
}
