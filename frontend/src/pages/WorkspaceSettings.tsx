import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { MemberList } from '../components/MemberList';
import { BillingCard } from '../components/BillingCard';
import { getWorkspace, updateWorkspace } from '../api';
import type { Workspace } from '../types';

export function WorkspaceSettings() {
  const { wsId } = useParams<{ wsId: string }>();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    if (wsId) {
      getWorkspace(wsId).then((w) => {
        setWs(w);
        setName(w.name);
      });
    }
  }, [wsId]);

  const handleSave = async () => {
    if (!wsId || !name.trim()) return;
    const updated = await updateWorkspace(wsId, { name: name.trim() });
    setWs(updated);
  };

  if (!wsId || !ws) {
    return <Layout><div className="text-white/30 text-center py-20">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-white/90">Workspace Settings</h1>

        <div className="bg-[#111] border border-white/5 rounded-xl p-6">
          <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-4">General</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
            />
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/15 transition-colors"
            >
              Save
            </button>
          </div>
        </div>

        <MemberList wsId={wsId} />
        <BillingCard wsId={wsId} />
      </div>
    </Layout>
  );
}
