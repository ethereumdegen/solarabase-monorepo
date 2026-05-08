import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Layout } from '../components/Layout';
import { KbCard } from '../components/KbCard';
import { PlanBadge } from '../components/PlanBadge';
import { listWorkspaces, listKbs, createKb, createWorkspace } from '../api';
import type { Workspace, Knowledgebase } from '../types';

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [kbsByWs, setKbsByWs] = useState<Record<string, Knowledgebase[]>>({});
  const [showCreateKb, setShowCreateKb] = useState<string | null>(null);
  const [newKbName, setNewKbName] = useState('');

  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const ws = await listWorkspaces();
      setWorkspaces(ws);
      const kbMap: Record<string, Knowledgebase[]> = {};
      await Promise.all(
        ws.map(async (w) => {
          kbMap[w.id] = await listKbs(w.id);
        })
      );
      setKbsByWs(kbMap);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    }
  };

  useEffect(() => { load(); }, []);

  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateKb = async (wsId: string) => {
    if (!newKbName.trim()) return;
    setCreateError(null);
    const slug = newKbName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    try {
      await createKb(wsId, { name: newKbName.trim(), slug });
      setNewKbName('');
      setShowCreateKb(null);
      load();
    } catch (e: any) {
      setCreateError(e.message || 'Failed to create');
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white/90">Dashboard</h1>
            <p className="text-sm text-white/30 mt-1">Welcome back, {user?.name}</p>
          </div>
        </div>

        {error && <p className="text-red-400 mb-4">{error}</p>}

        {workspaces.map((ws) => (
          <div key={ws.id} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold text-white/80">{ws.name}</h2>
              <PlanBadge workspaceId={ws.id} />
              <Link
                to={`/workspace/${ws.id}/settings`}
                className="text-xs text-white/30 hover:text-white/60 ml-auto"
              >
                Settings
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(kbsByWs[ws.id] || []).map((kb) => (
                <KbCard
                  key={kb.id}
                  kb={kb}
                  onClick={() => navigate(`/kb/${kb.id}`)}
                />
              ))}

              {/* Create KB card */}
              {showCreateKb === ws.id ? (
                <div className="bg-[#111] border border-white/10 rounded-xl p-5">
                  <input
                    type="text"
                    value={newKbName}
                    onChange={(e) => setNewKbName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateKb(ws.id)}
                    placeholder="Knowledgebase name"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 mb-3 focus:outline-none focus:ring-1 focus:ring-white/30"
                    autoFocus
                  />
                  {createError && <p className="text-xs text-red-400 mb-2">{createError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCreateKb(ws.id)}
                      className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-sm hover:bg-white/15 transition-colors"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => { setShowCreateKb(null); setNewKbName(''); setCreateError(null); }}
                      className="px-3 py-1.5 text-white/30 text-sm hover:text-white/50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateKb(ws.id)}
                  className="border border-dashed border-white/10 rounded-xl p-5 text-white/30 hover:border-white/20 hover:text-white/50 transition-colors text-sm h-32 flex items-center justify-center"
                >
                  + New Knowledgebase
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
