import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { QueryPanel } from '../components/QueryPanel';
import { FolderBrowser } from '../components/FolderBrowser';
import { WikiPanel } from '../components/WikiPanel';
import { KbSettings } from '../components/KbSettings';
import { getKbSettings } from '../api';
import type { Knowledgebase } from '../types';

type Tab = 'query' | 'documents' | 'wiki' | 'settings';

export function KnowledgebaseView() {
  const { kbId } = useParams<{ kbId: string }>();
  const [kb, setKb] = useState<Knowledgebase | null>(null);
  const [tab, setTab] = useState<Tab>('query');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kbId) {
      getKbSettings(kbId).then(setKb).catch((e) => setError(e.message));
    }
  }, [kbId]);

  if (error) {
    return <Layout><div className="text-center py-20"><p className="text-red-400 mb-4">{error}</p><Link to="/dashboard" className="text-sm text-white/30 hover:text-white/60">Back to Dashboard</Link></div></Layout>;
  }

  if (!kbId || !kb) {
    return <Layout><div className="text-white/30 text-center py-20">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Link to="/dashboard" className="text-xs text-white/30 hover:text-white/50 mb-1 inline-block">&larr; Dashboard</Link>
              <h1 className="text-2xl font-bold text-white/90">{kb.name}</h1>
              {kb.description && (
                <p className="text-sm text-white/30 mt-1">{kb.description}</p>
              )}
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {(['query', 'documents', 'wiki', 'settings'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize whitespace-nowrap cursor-pointer ${
                  tab === t
                    ? 'bg-white/10 text-white'
                    : 'text-white/30 hover:text-white/60 hover:bg-white/5'
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>

        {tab === 'query' && <QueryPanel kbId={kbId} />}
        {tab === 'documents' && <FolderBrowser kbId={kbId} />}
        {tab === 'wiki' && <WikiPanel kbId={kbId} />}
        {tab === 'settings' && <KbSettings kb={kb} onUpdated={setKb} />}
      </div>
    </Layout>
  );
}
