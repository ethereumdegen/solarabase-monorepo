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
    return <Layout><div className="text-gray-400 text-center py-20">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold">Workspace Settings</h1>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">General</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium"
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
