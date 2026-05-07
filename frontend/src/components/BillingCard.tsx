import { useEffect, useState } from 'react';
import { getBilling, createCheckout, createPortal } from '../api';
import type { BillingInfo } from '../types';

const PLAN_LIMITS: Record<string, { kbs: string; docs: string; queries: string; members: string }> = {
  free: { kbs: '1', docs: '50/KB', queries: '100/mo', members: '1' },
  pro: { kbs: '5', docs: 'Unlimited', queries: '5,000/mo', members: '3' },
  team: { kbs: 'Unlimited', docs: 'Unlimited', queries: 'Unlimited', members: 'Unlimited' },
};

export function BillingCard({ wsId }: { wsId: string }) {
  const [billing, setBilling] = useState<BillingInfo | null>(null);

  useEffect(() => {
    getBilling(wsId).then(setBilling).catch(() => {});
  }, [wsId]);

  const handleUpgrade = async (plan: string) => {
    const { url } = await createCheckout(wsId, plan);
    window.location.href = url;
  };

  const handlePortal = async () => {
    const { url } = await createPortal(wsId);
    window.location.href = url;
  };

  if (!billing) return null;

  const plan = billing.subscription.plan;
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Billing</h2>

      <div className="flex items-center gap-3 mb-4">
        <span className={`px-3 py-1 rounded-lg text-sm font-medium capitalize ${
          plan === 'free' ? 'bg-gray-100 text-gray-600' :
          plan === 'pro' ? 'bg-blue-100 text-blue-700' :
          'bg-purple-100 text-purple-700'
        }`}>
          {plan}
        </span>
        <span className="text-sm text-gray-400">
          {billing.usage.queries} queries used this period
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3 text-sm mb-6">
        <div><span className="text-gray-400 text-xs block">KBs</span>{limits.kbs}</div>
        <div><span className="text-gray-400 text-xs block">Docs</span>{limits.docs}</div>
        <div><span className="text-gray-400 text-xs block">Queries</span>{limits.queries}</div>
        <div><span className="text-gray-400 text-xs block">Members</span>{limits.members}</div>
      </div>

      <div className="flex gap-3">
        {plan === 'free' && (
          <>
            <button onClick={() => handleUpgrade('pro')}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
              Upgrade to Pro ($19/mo)
            </button>
            <button onClick={() => handleUpgrade('team')}
              className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700">
              Upgrade to Team ($49/mo)
            </button>
          </>
        )}
        {plan !== 'free' && (
          <button onClick={handlePortal}
            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
            Manage Subscription
          </button>
        )}
      </div>
    </div>
  );
}
