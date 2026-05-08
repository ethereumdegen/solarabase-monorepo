import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Layout } from '../components/Layout';
import { KbCard } from '../components/KbCard';
import { listKbs, createKb } from '../api';
import type { Knowledgebase } from '../types';

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [kbs, setKbs] = useState<Knowledgebase[]>([]);
  const [showCreateKb, setShowCreateKb] = useState(false);
  const [newKbName, setNewKbName] = useState('');

  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const result = await listKbs();
      setKbs(result);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    }
  };

  useEffect(() => { load(); }, []);

  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateKb = async () => {
    if (!newKbName.trim()) return;
    setCreateError(null);
    const slug = newKbName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    try {
      await createKb({ name: newKbName.trim(), slug });
      setNewKbName('');
      setShowCreateKb(false);
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kbs.map((kb) => (
            <KbCard
              key={kb.id}
              kb={kb}
              onClick={() => navigate(`/kb/${kb.id}`)}
            />
          ))}

          {/* Create KB card */}
          {showCreateKb ? (
            <div className="bg-[#111] border border-white/10 rounded-xl p-5">
              <input
                type="text"
                value={newKbName}
                onChange={(e) => setNewKbName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateKb()}
                placeholder="Knowledgebase name"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 mb-3 focus:outline-none focus:ring-1 focus:ring-white/30"
                autoFocus
              />
              {createError && <p className="text-xs text-red-400 mb-2">{createError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleCreateKb}
                  className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-sm hover:bg-white/15 transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => { setShowCreateKb(false); setNewKbName(''); setCreateError(null); }}
                  className="px-3 py-1.5 text-white/30 text-sm hover:text-white/50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateKb(true)}
              className="border border-dashed border-white/10 rounded-xl p-5 text-white/30 hover:border-white/20 hover:text-white/50 transition-colors text-sm h-32 flex items-center justify-center"
            >
              + New Knowledgebase
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}
