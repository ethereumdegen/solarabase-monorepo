import { useEffect, useState } from 'react';
import { getKbBilling, listDocuments, listKbMembers, listApiKeys } from '../api';
import BrailleSpinner from './ui/BrailleSpinner';
import type { BillingInfo } from '../types';

const PLAN_QUERY_LIMITS: Record<string, number | null> = {
  free: 1000,
  pro: 5000,
  team: null,
};

const PLAN_DOC_LIMITS: Record<string, number | null> = {
  free: 50,
  pro: null,
  team: null,
};

const PLAN_MEMBER_LIMITS: Record<string, number | null> = {
  free: 2,
  pro: 5,
  team: null,
};

const PLAN_API_KEY_LIMITS: Record<string, number | null> = {
  free: 3,
  pro: 10,
  team: null,
};

const PLAN_FILE_SIZE: Record<string, string> = {
  free: '100 MB',
  pro: '500 MB',
  team: '1 GB',
};

function UsageBar({ label, used, limit, color = 'blue' }: {
  label: string;
  used: number;
  limit: number | null;
  color?: 'blue' | 'purple' | 'green' | 'amber';
}) {
  const pct = limit ? Math.min((used / limit) * 100, 100) : null;
  const isHigh = pct !== null && pct >= 80;

  const colors = {
    blue: { bar: 'bg-blue-500', track: 'bg-blue-500/10', text: 'text-blue-400' },
    purple: { bar: 'bg-purple-500', track: 'bg-purple-500/10', text: 'text-purple-400' },
    green: { bar: 'bg-emerald-500', track: 'bg-emerald-500/10', text: 'text-emerald-400' },
    amber: { bar: 'bg-amber-500', track: 'bg-amber-500/10', text: 'text-amber-400' },
  };
  const c = colors[color];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white/60">{label}</span>
        <span className={`text-sm font-medium ${isHigh ? 'text-amber-400' : 'text-white/80'}`}>
          {used.toLocaleString()}{limit ? ` / ${limit.toLocaleString()}` : ''}
          {!limit && <span className="text-white/25 ml-1 text-xs">unlimited</span>}
        </span>
      </div>
      <div className={`h-2 rounded-full ${c.track} overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${isHigh ? 'bg-amber-500' : c.bar}`}
          style={{ width: pct !== null ? `${pct}%` : '100%', opacity: pct === null ? 0.15 : 1 }}
        />
      </div>
    </div>
  );
}

export function KbUsage({ kbId }: { kbId: string }) {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [docCount, setDocCount] = useState<number | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [apiKeyCount, setApiKeyCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      getKbBilling(kbId).then(setBilling),
      listDocuments(kbId).then((docs) => setDocCount(docs.length)),
      listKbMembers(kbId).then((m) => setMemberCount(m.length)),
      listApiKeys(kbId).then((k) => setApiKeyCount(k.length)),
    ]).finally(() => setLoading(false));
  }, [kbId]);

  if (loading) {
    return <div className="py-12"><BrailleSpinner animation="sparkle" size="lg" label="Loading usage..." /></div>;
  }

  const plan = billing?.subscription.plan || 'free';
  const queriesUsed = billing?.usage.queries || 0;
  const queryLimit = PLAN_QUERY_LIMITS[plan] ?? null;
  const docLimit = PLAN_DOC_LIMITS[plan] ?? null;
  const memberLimit = PLAN_MEMBER_LIMITS[plan] ?? null;
  const apiKeyLimit = PLAN_API_KEY_LIMITS[plan] ?? null;

  return (
    <div className="space-y-6">
      {/* Plan badge */}
      <div className="bg-[#111] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-2">Current Plan</h3>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-lg text-sm font-semibold capitalize ${
                plan === 'free' ? 'bg-white/5 text-white/50' :
                plan === 'pro' ? 'bg-blue-500/15 text-blue-400' :
                'bg-purple-500/15 text-purple-400'
              }`}>
                {plan}
              </span>
              <span className="text-xs text-white/25">Max file size: {PLAN_FILE_SIZE[plan] || '100 MB'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Usage bars */}
      <div className="bg-[#111] border border-white/5 rounded-xl p-5 space-y-5">
        <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider">Usage</h3>

        <UsageBar
          label="Queries this month"
          used={queriesUsed}
          limit={queryLimit}
          color="blue"
        />

        {docCount !== null && (
          <UsageBar
            label="Documents in this KB"
            used={docCount}
            limit={docLimit}
            color="purple"
          />
        )}

        {memberCount !== null && (
          <UsageBar
            label="Members"
            used={memberCount}
            limit={memberLimit}
            color="green"
          />
        )}

        {apiKeyCount !== null && (
          <UsageBar
            label="API keys"
            used={apiKeyCount}
            limit={apiKeyLimit}
            color="amber"
          />
        )}
      </div>

      {/* Limits reference */}
      <div className="bg-[#111] border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-4">Plan Limits</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          {(['free', 'pro', 'team'] as const).map((tier) => (
            <div key={tier} className={`rounded-lg p-4 ${tier === plan ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white/[0.02]'}`}>
              <p className={`font-semibold capitalize mb-3 ${tier === plan ? 'text-white/80' : 'text-white/30'}`}>
                {tier} {tier === plan && <span className="text-xs font-normal text-white/20">(current)</span>}
              </p>
              <div className="space-y-1.5 text-xs text-white/40">
                <p>{PLAN_QUERY_LIMITS[tier]?.toLocaleString() || 'Unlimited'} queries/mo</p>
                <p>{PLAN_DOC_LIMITS[tier] || 'Unlimited'} docs/KB</p>
                <p>{PLAN_MEMBER_LIMITS[tier] || 'Unlimited'} members</p>
                <p>{PLAN_API_KEY_LIMITS[tier] || 'Unlimited'} API keys</p>
                <p>{PLAN_FILE_SIZE[tier]} max file</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
