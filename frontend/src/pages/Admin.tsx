import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { adminListUsers, adminListKbs, adminListAgentLogs, adminListLlmLogs } from '../api';
import type { User, Knowledgebase, AgentLog, LlmLog, LlmStats } from '../types';

type Tab = 'users' | 'knowledgebases' | 'agent-logs' | 'llm-logs';

const TAB_LABELS: Record<Tab, string> = {
  users: 'Users',
  knowledgebases: 'Knowledgebases',
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

export function Admin() {
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [kbs, setKbs] = useState<Knowledgebase[]>([]);
  const [kbsTotal, setKbsTotal] = useState(0);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [agentTotal, setAgentTotal] = useState(0);
  const [agentOffset, setAgentOffset] = useState(0);
  const [llmLogs, setLlmLogs] = useState<LlmLog[]>([]);
  const [llmTotal, setLlmTotal] = useState(0);
  const [llmOffset, setLlmOffset] = useState(0);
  const [llmStats, setLlmStats] = useState<LlmStats | null>(null);
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
    if (tab === 'agent-logs') {
      adminListAgentLogs(50, agentOffset)
        .then((r) => { setAgentLogs(r.jobs); setAgentTotal(r.total); })
        .catch((e) => setError(e.message));
    }
  }, [tab, agentOffset]);

  useEffect(() => {
    if (tab === 'llm-logs') {
      adminListLlmLogs(50, llmOffset)
        .then((r) => { setLlmLogs(r.logs); setLlmTotal(r.total); setLlmStats(r.stats); })
        .catch((e) => setError(e.message));
    }
  }, [tab, llmOffset]);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white/90 mb-6">Admin Dashboard</h1>

        {error && <p className="text-red-400 mb-4">{error}</p>}

        <div className="flex gap-2 mb-6 overflow-x-auto">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
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

        {tab === 'agent-logs' && (
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
                      <tr key={job.id} className="border-b border-white/5 last:border-0 group">
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
      </div>
    </Layout>
  );
}
