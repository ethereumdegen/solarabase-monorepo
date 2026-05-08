import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { adminListUsers, adminListKbs } from '../api';
import type { User, Knowledgebase } from '../types';

type Tab = 'users' | 'knowledgebases';

export function Admin() {
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [kbs, setKbs] = useState<Knowledgebase[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminListUsers().then(setUsers).catch((e) => setError(e.message));
    adminListKbs().then(setKbs).catch((e) => setError(e.message));
  }, []);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-white/90 mb-6">Admin Dashboard</h1>

        {error && <p className="text-red-400 mb-4">{error}</p>}

        <div className="flex gap-2 mb-6">
          {(['users', 'knowledgebases'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? 'bg-white/10 text-white'
                  : 'text-white/30 hover:text-white/60 hover:bg-white/5'
              }`}
            >
              {t} ({t === 'users' ? users.length : kbs.length})
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
      </div>
    </Layout>
  );
}
