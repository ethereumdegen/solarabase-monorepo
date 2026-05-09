import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Layout } from '../components/Layout';
import BrailleSpinner from '../components/ui/BrailleSpinner';
import { adminListUsers, adminListKbs, adminListAgentLogs, adminListLlmLogs, adminGetAgentLog, adminListSubscriptions, adminListWebhookEvents } from '../api';
import type { User, Knowledgebase, AgentLog, ChatMessage, LlmLog, LlmStats, AdminSubscription, SubscriptionStats, WebhookEvent } from '../types';

type Tab = 'users' | 'knowledgebases' | 'subscriptions' | 'webhook-events' | 'agent-logs' | 'llm-logs';

const TAB_LABELS: Record<Tab, string> = {
  users: 'Users',
  knowledgebases: 'Knowledgebases',
  subscriptions: 'Subscriptions',
  'webhook-events': 'Webhooks',
  'agent-logs': 'Agent Logs',
  'llm-logs': 'LLM Logs',
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-green-500/15 text-green-400',
    ready: 'bg-yellow-500/15 text-yellow-400',
    in_progress: 'bg-blue-500/15 text-blue-400',
    failed: 'bg-red-500/15 text-red-400',
    success: 'bg-green-500/15 text-green-400',
    error: 'bg-red-500/15 text-red-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-white/5 text-white/30'}`}>
      {status}
    </span>
  );
}

function TimeAgo({ date }: { date: string | null }) {
  if (!date) return <span className="text-white/20">-</span>;
  const d = new Date(date);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return <span className="text-white/30">{Math.floor(diff / 1000)}s ago</span>;
  if (diff < 3_600_000) return <span className="text-white/30">{Math.floor(diff / 60_000)}m ago</span>;
  if (diff < 86_400_000) return <span className="text-white/30">{Math.floor(diff / 3_600_000)}h ago</span>;
  return <span className="text-white/30">{d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>;
}

function Pagination({ total, limit, offset, onChange }: {
  total: number; limit: number; offset: number;
  onChange: (offset: number) => void;
}) {
  const pages = Math.ceil(total / limit);
  const current = Math.floor(offset / limit);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-2 mt-4 text-sm">
      <button
        onClick={() => onChange(Math.max(0, offset - limit))}
        disabled={offset === 0}
        className="px-3 py-1 rounded bg-white/5 text-white/40 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Prev
      </button>
      <span className="text-white/30">
        {current + 1} / {pages} ({total} total)
      </span>
      <button
        onClick={() => onChange(offset + limit)}
        disabled={offset + limit >= total}
        className="px-3 py-1 rounded bg-white/5 text-white/40 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  );
}

/* ---------- Agent Log Detail View ---------- */
function AgentLogDetail({
  jobId,
  kbs,
  onBack,
}: {
  jobId: string;
  kbs: Knowledgebase[];
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<AgentLog | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [session, setSession] = useState<{ id: string; title: string; created_at: string } | null>(null);
  const [owner, setOwner] = useState<{ name: string; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    adminGetAgentLog(jobId)
      .then((r) => {
        setJob(r.job);
        setMessages(r.messages);
        setSession(r.session);
        setOwner(r.owner);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) {
    return <div className="py-12"><BrailleSpinner animation="pulse" size="lg" label="Loading agent log..." /></div>;
  }

  if (error || !job) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-xs text-white/30 hover:text-white/50">&larr; Back to logs</button>
        <p className="text-red-400">{error || 'Not found'}</p>
      </div>
    );
  }

  const kb = kbs.find((k) => k.id === job.kb_id);
  const duration = job.completed_at && job.claimed_at
    ? Math.round((new Date(job.completed_at).getTime() - new Date(job.claimed_at).getTime()) / 1000)
    : null;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button onClick={onBack} className="text-xs text-white/30 hover:text-white/50 transition-colors">
        &larr; Back to agent logs
      </button>

      {/* Header card */}
      <div className="bg-[#111] border border-white/5 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-white/90 mb-1">Agent Job</h2>
            <p className="text-xs text-white/20 font-mono">{job.id}</p>
          </div>
          <StatusBadge status={job.status} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-[10px] uppercase text-white/20 mb-1">Knowledgebase</div>
            <div className="text-white/60">{kb?.name || job.kb_id.slice(0, 8)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-white/20 mb-1">Owner</div>
            <div className="text-white/60">{owner ? `${owner.name} (${owner.email})` : job.owner_id.slice(0, 8)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-white/20 mb-1">Worker</div>
            <div className="text-white/60 font-mono text-xs">{job.worker_id || '-'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-white/20 mb-1">Duration</div>
            <div className="text-white/60">{duration !== null ? `${duration}s` : '-'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-white/20 mb-1">Created</div>
            <div className="text-white/60">{new Date(job.created_at).toLocaleString()}</div>
          </div>
          {job.claimed_at && (
            <div>
              <div className="text-[10px] uppercase text-white/20 mb-1">Claimed</div>
              <div className="text-white/60">{new Date(job.claimed_at).toLocaleString()}</div>
            </div>
          )}
          {job.completed_at && (
            <div>
              <div className="text-[10px] uppercase text-white/20 mb-1">Completed</div>
              <div className="text-white/60">{new Date(job.completed_at).toLocaleString()}</div>
            </div>
          )}
          {session && (
            <div>
              <div className="text-[10px] uppercase text-white/20 mb-1">Session</div>
              <div className="text-white/60 truncate" title={session.title}>{session.title}</div>
            </div>
          )}
        </div>
      </div>

      {/* Query */}
      <div className="bg-[#111] border border-white/5 rounded-xl p-5">
        <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">Query</h3>
        <p className="text-sm text-white/70 whitespace-pre-wrap">{job.content}</p>
      </div>

      {/* Error (if any) */}
      {job.error && (
        <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-5">
          <h3 className="text-xs font-medium text-red-400/50 uppercase tracking-wider mb-3">Error</h3>
          <pre className="text-xs text-red-400/70 whitespace-pre-wrap font-mono">{job.error}</pre>
        </div>
      )}

      {/* Conversation */}
      <div>
        <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">
          Conversation ({messages.length} messages)
        </h3>
        {messages.length === 0 ? (
          <p className="text-white/20 text-sm py-4 text-center">No messages in this session</p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`rounded-xl px-5 py-4 ${
                msg.role === 'user'
                  ? 'bg-white/10 ml-8'
                  : 'bg-[#111] border border-white/5 mr-8'
              }`}>
                <p className="text-[10px] font-medium mb-2 text-white/25 uppercase">
                  {msg.role}
                </p>
                {msg.role === 'user' ? (
                  <div className="text-white/80 text-sm">{msg.content}</div>
                ) : (
                  <div className="prose prose-sm prose-invert max-w-none text-white/70">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
                {msg.metadata && msg.metadata.reasoning_path && msg.metadata.reasoning_path.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-[10px] text-white/20 cursor-pointer hover:text-white/40">
                      Reasoning ({msg.metadata.tools_used?.length || 0} tools)
                    </summary>
                    <div className="mt-2 bg-white/5 rounded-lg p-3 text-xs text-white/30 space-y-1">
                      {msg.metadata.reasoning_path.map((step: string, j: number) => (
                        <p key={j} className="font-mono">{j + 1}. {step}</p>
                      ))}
                    </div>
                  </details>
                )}
                <div className="text-[10px] text-white/15 mt-2">
                  {new Date(msg.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Main Admin ---------- */
export function Admin() {
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [kbs, setKbs] = useState<Knowledgebase[]>([]);
  const [kbsTotal, setKbsTotal] = useState(0);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [agentTotal, setAgentTotal] = useState(0);
  const [agentOffset, setAgentOffset] = useState(0);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [llmLogs, setLlmLogs] = useState<LlmLog[]>([]);
  const [llmTotal, setLlmTotal] = useState(0);
  const [llmOffset, setLlmOffset] = useState(0);
  const [llmStats, setLlmStats] = useState<LlmStats | null>(null);
  const [subs, setSubs] = useState<AdminSubscription[]>([]);
  const [subsTotal, setSubsTotal] = useState(0);
  const [subsOffset, setSubsOffset] = useState(0);
  const [subsStats, setSubsStats] = useState<SubscriptionStats | null>(null);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [webhookTotal, setWebhookTotal] = useState(0);
  const [webhookOffset, setWebhookOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminListUsers()
      .then((r) => { setUsers(r.users); setUsersTotal(r.total); })
      .catch((e) => setError(e.message));
    adminListKbs()
      .then((r) => { setKbs(r.kbs); setKbsTotal(r.total); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (tab === 'agent-logs' && !selectedAgentId) {
      adminListAgentLogs(50, agentOffset)
        .then((r) => { setAgentLogs(r.jobs); setAgentTotal(r.total); })
        .catch((e) => setError(e.message));
    }
  }, [tab, agentOffset, selectedAgentId]);

  useEffect(() => {
    if (tab === 'llm-logs') {
      adminListLlmLogs(50, llmOffset)
        .then((r) => { setLlmLogs(r.logs); setLlmTotal(r.total); setLlmStats(r.stats); })
        .catch((e) => setError(e.message));
    }
  }, [tab, llmOffset]);

  useEffect(() => {
    if (tab === 'subscriptions') {
      adminListSubscriptions(50, subsOffset)
        .then((r) => { setSubs(r.subscriptions); setSubsTotal(r.total); setSubsStats(r.stats); })
        .catch((e) => setError(e.message));
    }
  }, [tab, subsOffset]);

  useEffect(() => {
    if (tab === 'webhook-events') {
      adminListWebhookEvents(50, webhookOffset)
        .then((r) => { setWebhookEvents(r.events); setWebhookTotal(r.total); })
        .catch((e) => setError(e.message));
    }
  }, [tab, webhookOffset]);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white/90 mb-6">Admin Dashboard</h1>

        {error && <p className="text-red-400 mb-4">{error}</p>}

        <div className="flex gap-2 mb-6 overflow-x-auto">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelectedAgentId(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                tab === t
                  ? 'bg-white/10 text-white'
                  : 'text-white/30 hover:text-white/60 hover:bg-white/5'
              }`}
            >
              {TAB_LABELS[t]}
              <span className="ml-1.5 text-xs opacity-50">
                {t === 'users' && usersTotal}
                {t === 'knowledgebases' && kbsTotal}
                {t === 'subscriptions' && subsTotal}
                {t === 'webhook-events' && webhookTotal}
                {t === 'agent-logs' && agentTotal}
                {t === 'llm-logs' && llmTotal}
              </span>
            </button>
          ))}
        </div>

        {tab === 'users' && (
          <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-white/30 text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/40">
                            {u.name[0]}
                          </div>
                        )}
                        <span className="text-white/70">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/40">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === 'admin' ? 'bg-purple-500/15 text-purple-400' : 'bg-white/5 text-white/30'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/30">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-white/30">{new Date(u.last_login_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'knowledgebases' && (
          <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-white/30 text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {kbs.map((kb) => {
                  const owner = users.find((u) => u.id === kb.owner_id);
                  return (
                    <tr key={kb.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3">
                        <a href={`/kb/${kb.id}`} className="text-white/70 hover:text-white/90 transition-colors">
                          {kb.name}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-white/30 font-mono text-xs">{kb.slug}</td>
                      <td className="px-4 py-3 text-white/40">{owner?.email || kb.owner_id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-white/30">{new Date(kb.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'subscriptions' && (
          <>
            {/* Stats cards */}
            {subsStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Total', value: subsStats.total },
                  { label: 'Free', value: subsStats.by_plan.free, color: 'text-white/50' },
                  { label: 'Pro', value: subsStats.by_plan.pro, color: 'text-blue-400' },
                  { label: 'Team', value: subsStats.by_plan.team, color: 'text-purple-400' },
                  { label: 'Active', value: subsStats.by_status.active, color: 'text-green-400' },
                  { label: 'Past Due', value: subsStats.by_status.past_due, color: 'text-amber-400' },
                  { label: 'Canceled', value: subsStats.by_status.canceled, color: 'text-red-400' },
                ].map((s) => (
                  <div key={s.label} className="bg-[#111] border border-white/5 rounded-xl px-4 py-3">
                    <div className="text-white/30 text-xs mb-1">{s.label}</div>
                    <div className={`text-lg font-medium ${s.color || 'text-white/80'}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-white/30 text-left">
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">KB</th>
                    <th className="px-4 py-3 font-medium">Owner</th>
                    <th className="px-4 py-3 font-medium">Stripe Customer</th>
                    <th className="px-4 py-3 font-medium">Period End</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((sub) => {
                    const kb = kbs.find((k) => k.id === sub.kb_id);
                    const owner = users.find((u) => u.id === sub.user_id);
                    return (
                      <tr key={sub.id} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                            sub.plan === 'pro' ? 'bg-blue-500/15 text-blue-400' :
                            sub.plan === 'team' ? 'bg-purple-500/15 text-purple-400' :
                            'bg-white/5 text-white/30'
                          }`}>
                            {sub.plan}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={sub.status} />
                        </td>
                        <td className="px-4 py-3">
                          <a href={`/kb/${sub.kb_id}`} className="text-white/60 hover:text-white/80 transition-colors text-xs">
                            {kb?.name || sub.kb_id.slice(0, 8)}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-white/40 text-xs">
                          {owner?.email || sub.user_id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-white/20 font-mono text-xs">
                          {sub.stripe_customer_id ? sub.stripe_customer_id.slice(0, 18) + '...' : '-'}
                        </td>
                        <td className="px-4 py-3 text-white/30 text-xs">
                          {sub.current_period_end
                            ? new Date(sub.current_period_end).toLocaleDateString()
                            : '-'
                          }
                        </td>
                        <td className="px-4 py-3">
                          <TimeAgo date={sub.updated_at} />
                        </td>
                      </tr>
                    );
                  })}
                  {subs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-white/20">
                        No subscriptions yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination total={subsTotal} limit={50} offset={subsOffset} onChange={setSubsOffset} />
          </>
        )}

        {tab === 'agent-logs' && selectedAgentId && (
          <AgentLogDetail
            jobId={selectedAgentId}
            kbs={kbs}
            onBack={() => setSelectedAgentId(null)}
          />
        )}

        {tab === 'agent-logs' && !selectedAgentId && (
          <>
            <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-white/30 text-left">
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Query</th>
                    <th className="px-4 py-3 font-medium">KB</th>
                    <th className="px-4 py-3 font-medium">Worker</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {agentLogs.map((job) => {
                    const kb = kbs.find((k) => k.id === job.kb_id);
                    const duration = job.completed_at && job.claimed_at
                      ? Math.round((new Date(job.completed_at).getTime() - new Date(job.claimed_at).getTime()) / 1000)
                      : null;
                    return (
                      <tr
                        key={job.id}
                        onClick={() => setSelectedAgentId(job.id)}
                        className="border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <StatusBadge status={job.status} />
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <div className="text-white/70 truncate" title={job.content}>
                            {job.content.slice(0, 80)}{job.content.length > 80 ? '...' : ''}
                          </div>
                          {job.error && (
                            <div className="text-red-400/70 text-xs mt-1 truncate" title={job.error}>
                              {job.error}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-white/30 text-xs">
                          {kb?.name || job.kb_id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-white/20 font-mono text-xs">
                          {job.worker_id || '-'}
                        </td>
                        <td className="px-4 py-3 text-white/30 text-xs">
                          {duration !== null ? `${duration}s` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <TimeAgo date={job.created_at} />
                        </td>
                      </tr>
                    );
                  })}
                  {agentLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-white/20">
                        No agent logs yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination total={agentTotal} limit={50} offset={agentOffset} onChange={setAgentOffset} />
          </>
        )}

        {tab === 'llm-logs' && (
          <>
            {llmStats && (
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Calls (24h)', value: llmStats.last_24h.total_calls.toLocaleString() },
                  { label: 'Input chars', value: (llmStats.last_24h.total_input_chars / 1000).toFixed(1) + 'k' },
                  { label: 'Output chars', value: (llmStats.last_24h.total_output_chars / 1000).toFixed(1) + 'k' },
                  { label: 'Avg latency', value: Math.round(llmStats.last_24h.avg_latency_ms) + 'ms' },
                ].map((s) => (
                  <div key={s.label} className="bg-[#111] border border-white/5 rounded-xl px-4 py-3">
                    <div className="text-white/30 text-xs mb-1">{s.label}</div>
                    <div className="text-white/80 text-lg font-medium">{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-white/30 text-left">
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Input</th>
                    <th className="px-4 py-3 font-medium">Output</th>
                    <th className="px-4 py-3 font-medium">Latency</th>
                    <th className="px-4 py-3 font-medium">KB</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {llmLogs.map((log) => {
                    const kb = kbs.find((k) => k.id === log.kb_id);
                    return (
                      <tr key={log.id} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-3">
                          <StatusBadge status={log.status} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-white/5 text-white/50 text-xs font-mono">
                            {log.request_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/40 font-mono text-xs">{log.model}</td>
                        <td className="px-4 py-3 text-white/30 text-xs">
                          {(log.input_chars / 1000).toFixed(1)}k
                        </td>
                        <td className="px-4 py-3 text-white/30 text-xs">
                          {(log.output_chars / 1000).toFixed(1)}k
                        </td>
                        <td className="px-4 py-3 text-white/30 text-xs">
                          <span className={log.latency_ms > 5000 ? 'text-yellow-400/70' : ''}>
                            {log.latency_ms > 1000
                              ? (log.latency_ms / 1000).toFixed(1) + 's'
                              : log.latency_ms + 'ms'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/30 text-xs">
                          {kb?.name || (log.kb_id ? log.kb_id.slice(0, 8) : '-')}
                        </td>
                        <td className="px-4 py-3">
                          <TimeAgo date={log.created_at} />
                          {log.error_msg && (
                            <div className="text-red-400/70 text-xs mt-1 truncate" title={log.error_msg}>
                              {log.error_msg.slice(0, 60)}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {llmLogs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-white/20">
                        No LLM logs yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination total={llmTotal} limit={50} offset={llmOffset} onChange={setLlmOffset} />
          </>
        )}

        {tab === 'webhook-events' && (
          <>
            <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-white/30 text-left">
                    <th className="px-4 py-3 font-medium">Event Type</th>
                    <th className="px-4 py-3 font-medium">Event ID</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {webhookEvents.map((evt) => {
                    const eventType = evt.action.replace('stripe_webhook:', '');
                    const eventId = evt.detail?.event_id || '-';
                    return (
                      <tr key={evt.id} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium font-mono ${
                            eventType.includes('completed') ? 'bg-green-500/15 text-green-400' :
                            eventType.includes('failed') ? 'bg-red-500/15 text-red-400' :
                            eventType.includes('deleted') ? 'bg-red-500/15 text-red-400' :
                            eventType.includes('updated') ? 'bg-blue-500/15 text-blue-400' :
                            'bg-white/5 text-white/40'
                          }`}>
                            {eventType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/20 font-mono text-xs">
                          {eventId.length > 30 ? eventId.slice(0, 30) + '...' : eventId}
                        </td>
                        <td className="px-4 py-3">
                          <TimeAgo date={evt.created_at} />
                        </td>
                      </tr>
                    );
                  })}
                  {webhookEvents.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-white/20">
                        No webhook events recorded yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination total={webhookTotal} limit={50} offset={webhookOffset} onChange={setWebhookOffset} />
          </>
        )}
      </div>
    </Layout>
  );
}
